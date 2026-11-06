/* Star ratings for Steve's virtual gallery.
 *
 * A Cloudflare Worker with one D1 database bound as DB. It creates its own
 * tables on first use, so there is nothing to set up inside the database.
 *
 *   GET  /ratings?hall=ai          every piece's ratings, plus the weekly snapshots
 *   POST /rate  {src, stars, voter} add or change one visitor's rating (1-5)
 *
 * The gallery decides how long each piece stays on the wall from a snapshot
 * of the ratings taken at the start of each week. Votes cast during a week
 * count toward next week's hang, so the walls never change mid-week and
 * every visitor sees the same hang.
 *
 * Settings (Worker → Settings → Variables and Secrets), all optional:
 *   SALT     any long random text; used to hash visitors' IP addresses so no
 *            raw address is ever stored
 *   ORIGINS  comma-separated sites allowed to send ratings
 *            (default: https://www.swow.ca,https://swow.ca,https://swowanders.github.io)
 */

// Must match ROTATE_FROM / ROTATE_DAYS in gallery.html: midnight Monday 26 Oct 2026, Toronto time.
const ROTATE_FROM = Date.UTC(2026, 9, 26, 4);
const ROTATE_DAYS = 7;
const HALLS = ['ai', 'traditional'];
const PER_IP = 3;            // at most this many different voters from one connection per piece
const SRC_RE = /^art\/(ai|traditional)\/[A-Za-z0-9._-]{1,120}$/;
const VOTER_RE = /^[A-Za-z0-9_-]{12,64}$/;

const thisWeek = () => Math.max(0, Math.floor((Date.now() - ROTATE_FROM) / (ROTATE_DAYS * 864e5)));

let ready = false;
async function setup(db) {
  if (ready) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS votes (src TEXT NOT NULL, voter TEXT NOT NULL, iph TEXT NOT NULL,
                stars INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (src, voter))`),
    db.prepare(`CREATE INDEX IF NOT EXISTS votes_ip ON votes (src, iph)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS snaps (hall TEXT NOT NULL, week INTEGER NOT NULL, data TEXT NOT NULL,
                PRIMARY KEY (hall, week))`),
  ]);
  ready = true;
}

// { src: [sum, count] } for one hall
async function tally(db, hall) {
  const { results } = await db.prepare(
    `SELECT src, SUM(stars) AS s, COUNT(*) AS n FROM votes WHERE src LIKE ? GROUP BY src`
  ).bind(`art/${hall}/%`).all();
  const out = {};
  for (const r of results) out[r.src] = [r.s, r.n];
  return out;
}

async function sha(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
}

function cors(req, env) {
  const allowed = (env.ORIGINS || 'https://www.swow.ca,https://swow.ca,https://swowanders.github.io')
    .split(',').map(s => s.trim()).filter(Boolean);
  const origin = req.headers.get('Origin') || '';
  const ok = allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    ok,
    headers: {
      'Access-Control-Allow-Origin': ok ? origin : allowed[0],
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    },
  };
}

const json = (body, status, headers) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const c = cors(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: c.headers });
    if (!env.DB) return json({ error: 'The D1 database is not connected to this Worker (binding name DB).' }, 500, c.headers);
    await setup(env.DB);

    if (req.method === 'GET' && url.pathname === '/ratings') {
      const hall = HALLS.includes(url.searchParams.get('hall')) ? url.searchParams.get('hall') : 'ai';
      const week = thisWeek();
      const live = await tally(env.DB, hall);
      // freeze this week's snapshot the first time anyone asks for it
      await env.DB.prepare(`INSERT OR IGNORE INTO snaps (hall, week, data) VALUES (?, ?, ?)`)
        .bind(hall, week, JSON.stringify(live)).run();
      const { results } = await env.DB.prepare(`SELECT week, data FROM snaps WHERE hall = ? ORDER BY week`).bind(hall).all();
      const snaps = {};
      for (const r of results) snaps[r.week] = JSON.parse(r.data);
      return json({ week, live, snaps }, 200, { ...c.headers, 'Cache-Control': 'no-store' });
    }

    if (req.method === 'POST' && url.pathname === '/rate') {
      if (!c.ok) return json({ error: 'Ratings can only be sent from the gallery.' }, 403, c.headers);
      let body;
      try { body = await req.json(); } catch { return json({ error: 'Bad request.' }, 400, c.headers); }
      const { src, voter } = body || {};
      const stars = Number(body && body.stars);
      if (!SRC_RE.test(src || '') || !VOTER_RE.test(voter || '') || !(Number.isInteger(stars) && stars >= 1 && stars <= 5))
        return json({ error: 'Bad request.' }, 400, c.headers);
      const ip = req.headers.get('CF-Connecting-IP') || '';
      const iph = await sha((env.SALT || 'swow-gallery') + '|' + ip);
      const crowd = await env.DB.prepare(`SELECT COUNT(*) AS n FROM votes WHERE src = ? AND iph = ? AND voter != ?`)
        .bind(src, iph, voter).first();
      if (crowd && crowd.n >= PER_IP)
        return json({ error: 'This piece already has several ratings from your connection.' }, 429, c.headers);
      await env.DB.prepare(`INSERT INTO votes (src, voter, iph, stars, at) VALUES (?, ?, ?, ?, ?)
                            ON CONFLICT (src, voter) DO UPDATE SET stars = excluded.stars, iph = excluded.iph, at = excluded.at`)
        .bind(src, voter, iph, stars, Date.now()).run();
      const r = await env.DB.prepare(`SELECT SUM(stars) AS s, COUNT(*) AS n FROM votes WHERE src = ?`).bind(src).first();
      return json({ src, rating: [r.s, r.n] }, 200, c.headers);
    }

    return json({ error: 'Not found.' }, 404, c.headers);
  },
};
