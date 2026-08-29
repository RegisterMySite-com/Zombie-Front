# Zombie Front 1944

A browser WW2-themed 3D zombie shooter (Three.js) with a **global high-score list stored in a single Cloudflare Durable Object**.

Scores survive Worker restarts, redeploys, and are visible from any device that hits the same deployed Worker.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/RegisterMySite-com/Zombie-Front)

## Project layout

```
├── src/index.ts              Worker front door + LeaderboardDO
├── wrangler.json             Wrangler 4 config (bindings + exports)
├── package.json
├── public/
│   ├── index.html
│   ├── favicon.svg
│   ├── css/style.css
│   ├── js/
│   └── textures/
│       ├── walls/     tiled onto boundary walls
│       └── posters/   hung on the inner wall faces
└── README.md
```

## Wall images

Drop PNG / JPG / WEBP / SVG files into:

- `public/textures/walls/` — wraps the four boundary walls
- `public/textures/posters/` — pictures on the inner face

Then list them in `public/js/wall-art.js`:

```js
{ src: "./textures/posters/my-photo.jpg", wall: "north", along: -8, y: 3.2, width: 4, height: 3 }
```

`wall` is `north` / `south` / `east` / `west`. `along` is meters along that wall (`-32` to `+32`).

## Durable Objects leaderboard

| Piece | Value |
| --- | --- |
| Class | `LeaderboardDO` |
| Binding | `LEADERBOARD` |
| Instance | `idFromName("global-leaderboard")` — one object for all players |
| Storage | SQLite via `exports.LeaderboardDO` (`storage: "sqlite"`) |
| Init | `blockConcurrencyWhile` so schema creation cannot race |

### Endpoints

- `POST /api/submit-score` — `{ playerName, score, wave, levelName, kills, headshots, difficulty }`
- `GET /api/leaderboard?difficulty=All&limit=50` — top scores, descending
- `GET /api/stats` — totals
- `GET /api/health` — confirms the DO is reachable and returns row count

## Setup

```bash
npm install
npx wrangler login
npm run dev
```

## Deploy

Click the **Deploy to Cloudflare** button above, or:

```bash
npm run deploy
```

Use `wrangler.json`. Do not add a `migrations` array (Wrangler 4 treats `migrations` and `exports` as mutually exclusive).

## Scripts

| Script | Action |
| --- | --- |
| `npm run dev` | Local Worker + assets + DO |
| `npm run deploy` | Production deploy |
| `npm run tail` | Live Worker logs |
| `npm run types` | Generate `worker-configuration.d.ts` |
