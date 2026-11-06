# Star ratings: one-time setup

Visitors can rate every piece in the galleries out of five stars. The ratings need somewhere to live that every visitor shares, and GitHub Pages can't store anything, so they're kept by a small Cloudflare Worker with a free D1 database. This takes about ten minutes, once.

Until it's set up, the galleries work exactly as before, just without the stars.

## 1. Create the database

1. Log in at **dash.cloudflare.com**.
2. Go to **Storage & Databases → D1 SQL Database → Create**.
3. Name it `gallery-ratings` and click **Create**.

You don't need to add tables. The Worker creates them itself the first time it runs.

## 2. Create the Worker

1. Go to **Compute (Workers) → Workers & Pages → Create → Create Worker** (the "Hello World" starter).
2. Name it `gallery-ratings` and click **Deploy**.
3. Click **Edit code**. Delete everything in `worker.js`, paste in the whole of [`worker.js`](worker.js) from this folder, and click **Deploy**.

## 3. Connect the database to the Worker

1. Open the Worker's **Settings → Bindings → Add → D1 database**.
2. Variable name: `DB` (capitals, exactly that).
3. Database: `gallery-ratings`. Click **Deploy**.

## 4. Add a secret (recommended)

The Worker turns each visitor's internet address into a scrambled code, so it can limit repeat voting without storing anyone's real address. A secret makes that code impossible to reverse.

1. Worker **Settings → Variables and Secrets → Add**.
2. Type **Secret**, name `SALT`, value: any long random jumble of letters and numbers. Click **Deploy**.

## 5. Point the gallery at the Worker

1. Copy the Worker's address from its overview page. It looks like `https://gallery-ratings.yourname.workers.dev`.
2. Check it works: open that address with `/ratings` on the end. You should see something like `{"week":1,"live":{},"snaps":{"1":{}}}`.
3. In `gallery.html`, find this line near the top:

   ```js
   const RATINGS_URL = '';
   ```

   and paste the address between the quotes:

   ```js
   const RATINGS_URL = 'https://gallery-ratings.yourname.workers.dev';
   ```

4. Commit. The stars appear in a minute or two. (Or just send Claude the address.)

## How ratings shape the walls

Every Monday the walls are re-hung. Each piece stays up for a number of weeks set by its average rating at that moment:

| Average rating | Stays on the wall |
|---|---|
| Not rated yet | 1 week |
| Under 3 stars | 1 week |
| 3 to 3.9 | 2 weeks |
| 4 to 4.4 | 3 weeks |
| 4.5 to 4.9 | 4 weeks |
| A perfect 5.0 | As long as it keeps a perfect 5.0 |

When a piece's time is up, it goes back into the queue and the next piece in line takes its spot. Pieces that stay keep their spot on the wall.

- **Ratings count from the next Monday.** The Worker freezes a copy of the ratings at the start of each week. That way the walls never change mid-week, and everyone sees the same hang.
- **Change the rules** by editing `STAY_WEEKS` near the top of `gallery.html`.
- **`pin: true`** in `gallery.html` still keeps a piece up no matter what.
- **One rating per visitor per piece.** Visitors can change their rating whenever they like. To stop one person rating the same piece many times, the Worker accepts at most three different voters per internet connection for each piece.
- Ratings can only be sent from swow.ca and swowanders.github.io. To allow another address, add a variable `ORIGINS` listing the allowed sites, separated by commas.

A perfect 5.0 is easy to get from a single visitor: one 5-star vote on an unrated piece makes it permanent until someone rates it lower. If that turns out to be too easy, the rule can be changed to require a minimum number of ratings.

## Looking at the votes

In the D1 database's **Console** tab, this lists the top-rated pieces:

```sql
SELECT src, ROUND(AVG(stars), 2) AS average, COUNT(*) AS ratings
FROM votes GROUP BY src ORDER BY average DESC, ratings DESC;
```

The free plan allows 100,000 Worker requests a day and 5 GB of database storage, far more than the gallery will need.
