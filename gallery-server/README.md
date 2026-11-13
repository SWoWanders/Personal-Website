# Sound Gallery room server: one-time setup

This small Cloudflare Worker lets real people share the Sound Gallery: up to 8 inside at once, a queue for everyone else, one player per sound machine, and everyone hearing the same music. It also makes private rooms work (the **PRIVATE ROOM · SHARE A LINK** button).

It sends no sound, only small messages (where people are, which buttons they pressed), so it fits comfortably in Cloudflare's free plan. Until it's set up, the gallery works on its own exactly as before, with a few pretend visitors.

## 1. Deploy it (one click)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/swowanders/personal-website/tree/main/gallery-server)

1. Click the button above (on GitHub, from this file), and log in to Cloudflare.
2. It asks to make a copy of this folder in your GitHub account (that's how Cloudflare keeps it up to date). Accept the suggested name, `sound-gallery-rooms`.
3. Click **Create and deploy**. It takes a minute or two.
4. When it's done, open the Worker's overview page and copy its address. It looks like
   `https://sound-gallery-rooms.yourname.workers.dev`.
5. Check it works: open that address in your browser. You should see
   `{"ok":true,"service":"sound-gallery-rooms",...}`.

<details>
<summary>Or, with the command line instead of the button</summary>

```
cd gallery-server
npx wrangler login
npx wrangler deploy
```
It prints the Worker's address at the end.
</details>

## 2. Point the gallery at it

In `sound-gallery.html`, find this line:

```js
const NET_URL = '';
```

and put the address between the quotes, starting with `wss://` instead of `https://`:

```js
const NET_URL = 'wss://sound-gallery-rooms.yourname.workers.dev';
```

Commit, and in a minute or two the gallery is shared. (Or just send Claude the address.)

You can also try a server without changing the file: add `?server=wss://sound-gallery-rooms.yourname.workers.dev` to the gallery's address.

## How it behaves

- **The public gallery** is the room everyone joins by default. **Private rooms** are made with the button on the title screen; the link carries the room's name (`?room=...`), and only people with the link find it. Each room holds 8; anyone else queues and the title screen says how many are inside.
- **One player per machine.** While someone plays a machine, a ring glows at its feet in their shirt colour, and the others hear every note but can't take it over until they step away.
- **Shared clock.** The Rhythm Wheel, Optigan backings, bass patterns and the calliope all lock to the server's clock, so everyone's beat lines up and everyone's recording has the same music.
- **Five minutes.** When someone's time is up, the others see the light beam take them. The server also shows out anyone who stays far too long.
- **Nothing is kept.** When a room empties, its settings are forgotten.

## Costs

On Cloudflare's free plan this uses a Durable Object (the free, SQLite-backed kind). Each visitor sends a few small messages a second. That allows many hours of visits a day for free. If the gallery ever gets very busy, Cloudflare's dashboard shows the usage under **Workers & Pages → sound-gallery-rooms → Metrics**.
