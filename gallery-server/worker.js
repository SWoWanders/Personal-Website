/* The Sound Gallery's room server.
   Each room (the public gallery, or a private room made from a link) is one Durable Object. It keeps:
   - who is inside (up to 8) and who is queueing, in order;
   - who is playing which sound machine (one player per machine);
   - each machine's latest settings, so a newcomer hears the room as it is;
   and passes messages between the visitors: where everyone is, what they're playing, the notes they strike.
   It never sends or stores sound, only small messages, and it keeps nothing once the room is empty.
   It also tells each visitor the server's time, so all the beat machines everyone hears share one clock. */

const MAX_INSIDE = 8;
const VISIT_MS = (10 + 60 + 300 + 60) * 1000;       // countdown + walk in + five minutes + a minute's grace: a backstop only
const ORIGINS = '*';                                 // the page may be served from anywhere (swow.ca, GitHub Pages, a test copy)

const cors = { 'Access-Control-Allow-Origin': ORIGINS, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...cors } });
// one more Durable Object keeps the day's count of visitors across all rooms (its name can't be a room's: rooms are letters, digits and dashes)
const statsStub = (env) => env.ROOMS.get(env.ROOMS.idFromName('__stats'));
// "today" in the gallery's home time zone, so the count starts again at midnight in Ottawa
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const roomName = (s) => (String(s || 'public').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24) || 'public');

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    const url = new URL(request.url);
    const room = roomName(url.searchParams.get('room'));
    const stub = env.ROOMS.get(env.ROOMS.idFromName(room));
    if (url.pathname === '/ws') return stub.fetch(request);
    if (url.pathname === '/status') {                    // this room's numbers, plus everyone who has visited today (any room)
      const [s, c] = await Promise.all([stub.fetch(request).then((r) => r.json()), statsStub(env).fetch('https://stats/today').then((r) => r.json()).catch(() => ({ today: null }))]);
      return json({ ...s, today: c.today });
    }
    return json({ ok: true, service: 'sound-gallery-rooms', hint: 'connect to /ws?room=public' });
  },
};

export class Room {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env;
    this.next = 1;                 // visitor numbers in this room
    this.vis = new Map();          // id → { ws, shirt, inside, at, pos }
    this.queue = [];               // ids waiting, first in line first
    this.locks = {};               // alcove → id of the player
    this.states = {};              // alcove → that machine's latest settings (a string, as sent)
    this.timer = null;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.hostname === 'stats') {                      // the counter (only ever reached from inside the Worker)
      const day = today(), saved = (await this.ctx.storage.get('count')) || { day, n: 0 };
      const c = saved.day === day ? saved : { day, n: 0 };
      if (url.pathname === '/hit') { c.n++; await this.ctx.storage.put('count', c); }
      return json({ today: c.n, day });
    }
    if (url.pathname === '/status') return json({ inside: this.insideCount(), queue: this.queue.length, max: MAX_INSIDE });
    if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'expected a WebSocket' }, 426);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    const id = this.next++;
    const v = { id, ws: server, shirt: 0, inside: false, at: 0, pos: null, hello: false };
    this.vis.set(id, v);
    server.addEventListener('message', (e) => { try { this.onMessage(v, JSON.parse(e.data)); } catch (err) {} });
    const gone = () => this.remove(id, false);
    server.addEventListener('close', gone);
    server.addEventListener('error', gone);
    if (!this.timer) this.timer = setInterval(() => this.tick(), 10000);
    return new Response(null, { status: 101, webSocket: client });
  }

  insideCount() { let n = 0; for (const v of this.vis.values()) if (v.inside) n++; return n; }
  send(v, msg) { try { v.ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg)); } catch (e) {} }
  toInside(msg, except) { const s = JSON.stringify(msg); for (const v of this.vis.values()) if (v.inside && v.id !== except) this.send(v, s); }

  onMessage(v, m) {
    switch (m.t) {
      case 'hello':                                   // { shirt }: wants in
        if (v.hello) return;
        v.hello = true; v.shirt = Number(m.shirt) || 0;
        if (this.insideCount() < MAX_INSIDE && !this.queue.length) this.admit(v);
        else { this.queue.push(v.id); this.queueUpdate(); }
        return;
      case 'ping': this.send(v, { t: 'pong', c: m.c, s: Date.now() }); return;
    }
    if (!v.inside) return;
    switch (m.t) {
      case 'p':                                       // where I am: { x, z, y (yaw), a (alcove playing or -1), s (stage) }
        v.pos = { x: m.x, z: m.z, y: m.y, a: m.a, s: m.s };
        this.toInside({ t: 'p', id: v.id, x: m.x, z: m.z, y: m.y, a: m.a, s: m.s }, v.id);
        return;
      case 'lock': {                                  // I'd like to play alcove al
        const al = String(m.al);
        for (const k in this.locks) if (this.locks[k] === v.id && k !== al) delete this.locks[k];
        if (!this.locks[al]) this.locks[al] = v.id;
        this.toInside({ t: 'locks', locks: this.locks });
        return;
      }
      case 'unlock': {
        const al = String(m.al);
        if (this.locks[al] === v.id) { delete this.locks[al]; this.toInside({ t: 'locks', locks: this.locks }); }
        return;
      }
      case 'st': {                                    // a machine's settings, from the person playing it
        const al = String(m.al);
        if (this.locks[al] !== v.id) return;
        if (typeof m.s !== 'string' || m.s.length > 20000) return;
        this.states[al] = m.s;
        this.toInside({ t: 'st', al: m.al, s: m.s, from: v.id }, v.id);
        return;
      }
      case 'ev':                                      // a note struck, a ripple dropped: passed straight on
        if (JSON.stringify(m.a || []).length > 2000) return;
        this.toInside({ t: 'ev', al: m.al, f: m.f, a: m.a, from: v.id }, v.id);
        return;
      case 'bye':                                     // time's up (the others see the light beam take them)
        this.remove(v.id, !!m.beam);
        try { v.ws.close(1000, 'bye'); } catch (e) {}
        return;
    }
  }

  admit(v) {
    v.inside = true; v.at = Date.now();
    try { this.ctx.waitUntil(statsStub(this.env).fetch('https://stats/hit')); } catch (e) {}   // one more visitor today
    const others = [];
    for (const o of this.vis.values()) if (o.inside && o.id !== v.id) others.push({ id: o.id, shirt: o.shirt, pos: o.pos });
    this.send(v, { t: 'welcome', id: v.id, now: Date.now(), others, locks: this.locks, states: this.states, max: MAX_INSIDE });
    this.toInside({ t: 'join', id: v.id, shirt: v.shirt }, v.id);
  }

  remove(id, beam) {
    const v = this.vis.get(id); if (!v) return;
    this.vis.delete(id);
    const qi = this.queue.indexOf(id); if (qi >= 0) this.queue.splice(qi, 1);
    if (v.inside) {
      let changed = false;
      for (const k in this.locks) if (this.locks[k] === id) { delete this.locks[k]; changed = true; }
      this.toInside({ t: 'leave', id, beam });
      if (changed) this.toInside({ t: 'locks', locks: this.locks });
    }
    // let the next in line in
    while (this.queue.length && this.insideCount() < MAX_INSIDE) {
      const n = this.vis.get(this.queue.shift()); if (n) this.admit(n);
    }
    this.queueUpdate();
    if (!this.vis.size) {                             // an empty room forgets everything
      this.locks = {}; this.states = {};
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
    }
  }

  queueUpdate() {
    const inside = this.insideCount();
    this.queue.forEach((id, k) => { const v = this.vis.get(id); if (v) this.send(v, { t: 'queued', ahead: k, inside, max: MAX_INSIDE }); });
  }

  tick() {                                            // a backstop: anyone who has outstayed the visit is shown out
    const now = Date.now();
    for (const v of [...this.vis.values()]) {
      if (v.inside && now - v.at > VISIT_MS) { this.remove(v.id, true); try { v.ws.close(1000, 'time'); } catch (e) {} }
    }
  }
}
