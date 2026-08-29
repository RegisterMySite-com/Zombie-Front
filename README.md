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
│   └── js/                   Game client (ES modules, no bundler)
└── README.md
```

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

Worker `run_worker_first = ["/api/*"]` so API hits the Worker (and then the DO). Everything else is served from `public/` as Workers Assets.

### Safety rails

- Names sanitized (letters/numbers/space/`_-.`, max 20 chars)
- Difficulty / map allowlists
- Headshots cannot exceed kills
- Hard score / wave / kill caps plus a plausibility ceiling from reported stats
- Per-client rate limit: min 4s between posts, max 8 per minute (`CF-Connecting-IP`)
- Table pruned to the top 500 scores
- Client falls back to `localStorage` if the DO is unreachable and labels the board as local

## Setup

```bash
npm install
npx wrangler login          # once per machine
npm run dev                 # wrangler dev — game + API on localhost
```

Open the printed localhost URL (not a raw `public/index.html` file). The Durable Object only exists inside Wrangler / the deployed Worker.

## Deploy

Click the **Deploy to Cloudflare** button above, or from a clone:

```bash
npm run deploy
```

Use `wrangler.json` as the source of truth. Wrangler 4.x treats `migrations` and `exports` as mutually exclusive — this project uses `exports` only. If the CLI complains about two config files, keep `wrangler.json` and delete `wrangler.toml`.

If submit-score says the Durable Object binding is missing, redeploy after confirming `durable_objects.bindings` and `exports.LeaderboardDO` are in `wrangler.json`, then hit `/api/health`.

Required config:

```json
{
  "durable_objects": {
    "bindings": [{ "name": "LEADERBOARD", "class_name": "LeaderboardDO" }]
  },
  "exports": {
    "LeaderboardDO": { "type": "durable-object", "storage": "sqlite" }
  }
}
```

## How to verify the leaderboard across devices

1. Deploy and copy the `*.workers.dev` (or custom) URL.
2. On device A: `GET /api/health` should return `{ ok: true, object: "LeaderboardDO", rows: N }`.
3. Play a short run on device A, submit a unique soldier name on Game Over.
4. Confirm the response shows `Score recorded! Global Rank #…` (not “Saved locally”).
5. On device B (other browser, phone, or incognito): open the **same URL** → Global Leaderboard.
6. The name/score from step 3 must appear, with source text `LIVE — Cloudflare Durable Object`.
7. Redeploy and reload device B — the score must still be there.

Example submit:

```bash
curl -sS -X POST https://YOUR-WORKER/api/submit-score \
  -H 'content-type: application/json' \
  -d '{"playerName":"Test Rifleman","score":1200,"wave":2,"levelName":"NORMANDY VILLAGE","kills":8,"headshots":2,"difficulty":"Normal"}'
```

## Gameplay notes

- Four maps × five waves; wave 5 is the map boss.
- Drops: ammo, health, armor, double-damage, insta-kill, speed, nuke.
- Armory between waves.
- Desktop: WASD + mouse + pointer lock. Mobile: left stick, right look pad, FIRE / ADS / R / JUMP.

## Scripts

| Script | Action |
| --- | --- |
| `npm run dev` | Local Worker + assets + DO |
| `npm run deploy` | Production deploy |
| `npm run tail` | Live Worker logs |
| `npm run types` | Generate `worker-configuration.d.ts` |
