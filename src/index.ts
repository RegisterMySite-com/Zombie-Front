import { DurableObject } from "cloudflare:workers";

export interface Env {
  LEADERBOARD: DurableObjectNamespace;
  ASSETS?: Fetcher;
}

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const ALLOWED_DIFFICULTIES = new Set(["Easy", "Normal", "Hard"]);
const ALLOWED_LEVELS = new Set([
  "NORMANDY VILLAGE",
  "SIEGFRIED TRENCHES",
  "INDUSTRIAL COMPLEX",
  "OCCULT FORTRESS",
  "Ruined Village",
  "Siegfried Trenches",
  "Industrial Factory",
  "Occult Fortress",
]);

const MAX_STORED_SCORES = 500;
const MAX_RETURNED_SCORES = 100;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_PER_WINDOW = 8;
const RATE_MIN_GAP_MS = 4_000;
const MAX_SCORE = 2_000_000;
const MAX_WAVE = 20;
const MAX_KILLS = 5_000;

export interface ScorePayload {
  playerName?: unknown;
  score?: unknown;
  wave?: unknown;
  levelName?: unknown;
  kills?: unknown;
  headshots?: unknown;
  difficulty?: unknown;
  createdAt?: unknown;
}

export interface ScoreRow {
  id: number;
  playerName: string;
  score: number;
  wave: number;
  levelName: string;
  kills: number;
  headshots: number;
  difficulty: string;
  createdAt: number;
}

function getLeaderboardNamespace(env: Env): DurableObjectNamespace | null {
  const record = env as unknown as Record<string, unknown>;
  const preferred = ["LEADERBOARD", "LEADERBOARD_DO", "LeaderboardDO", "APP", "App"];
  for (const key of preferred) {
    const value = record[key] as DurableObjectNamespace | undefined;
    if (value && typeof value.idFromName === "function" && typeof value.get === "function") {
      return value;
    }
  }
  for (const value of Object.values(record)) {
    if (
      value &&
      typeof (value as DurableObjectNamespace).idFromName === "function" &&
      typeof (value as DurableObjectNamespace).get === "function"
    ) {
      return value as DurableObjectNamespace;
    }
  }
  return null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });
}

function clientKey(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    request.headers.get("X-Leaderboard-Client") ||
    "unknown"
  );
}

function sanitizeName(raw: unknown): string {
  const cleaned = String(raw ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[^\p{L}\p{N} _.\-']/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20);
  return cleaned.length >= 2 ? cleaned : "Anonymous Private";
}

function asInt(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

function validateScore(body: ScorePayload): { ok: true; entry: Omit<ScoreRow, "id"> } | { ok: false; error: string } {
  const playerName = sanitizeName(body.playerName);
  const score = asInt(body.score, 0);
  const wave = asInt(body.wave, 1);
  const kills = asInt(body.kills, 0);
  const headshots = asInt(body.headshots, 0);
  const difficultyRaw = String(body.difficulty ?? "Normal");
  const difficulty = ALLOWED_DIFFICULTIES.has(difficultyRaw) ? difficultyRaw : "Normal";
  const levelRaw = String(body.levelName ?? "NORMANDY VILLAGE").slice(0, 40);
  const levelName = ALLOWED_LEVELS.has(levelRaw) ? levelRaw : "NORMANDY VILLAGE";

  if (score < 0 || score > MAX_SCORE) return { ok: false, error: "Score rejected (out of range)." };
  if (wave < 1 || wave > MAX_WAVE) return { ok: false, error: "Wave rejected (out of range)." };
  if (kills < 0 || kills > MAX_KILLS) return { ok: false, error: "Kills rejected (out of range)." };
  if (headshots < 0 || headshots > kills) return { ok: false, error: "Headshots cannot exceed kills." };

  const maxPlausible = Math.max(500, kills * 250 * 10 + wave * 8_000 + 12_000);
  if (score > maxPlausible) return { ok: false, error: "Score rejected (implausible for reported stats)." };

  return {
    ok: true,
    entry: { playerName, score, wave, levelName, kills, headshots, difficulty, createdAt: Date.now() },
  };
}

export class LeaderboardDO extends DurableObject {
  private ready: Promise<void>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ready = this.ctx.blockConcurrencyWhile(async () => {
      this.initSchema();
    });
  }

  private initSchema(): void {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS leaderboard (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_name TEXT NOT NULL,
        score INTEGER NOT NULL,
        wave INTEGER NOT NULL,
        level_name TEXT NOT NULL,
        kills INTEGER NOT NULL,
        headshots INTEGER NOT NULL,
        difficulty TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard(score DESC, created_at ASC);
      CREATE INDEX IF NOT EXISTS idx_leaderboard_diff_score ON leaderboard(difficulty, score DESC);
      CREATE TABLE IF NOT EXISTS rate_limits (
        client_key TEXT PRIMARY KEY,
        window_start INTEGER NOT NULL,
        submit_count INTEGER NOT NULL,
        last_submit INTEGER NOT NULL
      );
    `);
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    try {
      if (path === "/api/submit-score" && request.method === "POST") return await this.handleSubmit(request);
      if (path === "/api/leaderboard" && request.method === "GET") return this.handleList(url);
      if (path === "/api/stats" && request.method === "GET") return this.handleStats();
      if (path === "/api/health" && request.method === "GET") {
        const count = this.ctx.storage.sql.exec(`SELECT COUNT(*) AS c FROM leaderboard`).one() as { c: number };
        return json({ success: true, ok: true, object: "LeaderboardDO", rows: count.c });
      }
      return json({ success: false, error: "Not found" }, 404);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Durable Object error";
      return json({ success: false, error: message }, 500);
    }
  }

  private checkRateLimit(key: string): { allowed: true } | { allowed: false; retryAfterMs: number } {
    const now = Date.now();
    const row = this.ctx.storage.sql
      .exec(
        `SELECT window_start AS windowStart, submit_count AS submitCount, last_submit AS lastSubmit FROM rate_limits WHERE client_key = ?`,
        key
      )
      .toArray()[0] as { windowStart: number; submitCount: number; lastSubmit: number } | undefined;

    if (!row) {
      this.ctx.storage.sql.exec(
        `INSERT INTO rate_limits (client_key, window_start, submit_count, last_submit) VALUES (?, ?, 1, ?)`,
        key,
        now,
        now
      );
      return { allowed: true };
    }
    if (now - row.lastSubmit < RATE_MIN_GAP_MS) {
      return { allowed: false, retryAfterMs: RATE_MIN_GAP_MS - (now - row.lastSubmit) };
    }
    const inWindow = now - row.windowStart < RATE_WINDOW_MS;
    const nextCount = inWindow ? row.submitCount + 1 : 1;
    const nextWindow = inWindow ? row.windowStart : now;
    if (inWindow && row.submitCount >= RATE_MAX_PER_WINDOW) {
      return { allowed: false, retryAfterMs: RATE_WINDOW_MS - (now - row.windowStart) };
    }
    this.ctx.storage.sql.exec(
      `UPDATE rate_limits SET window_start = ?, submit_count = ?, last_submit = ? WHERE client_key = ?`,
      nextWindow,
      nextCount,
      now,
      key
    );
    return { allowed: true };
  }

  private async handleSubmit(request: Request): Promise<Response> {
    let body: ScorePayload;
    try {
      body = (await request.json()) as ScorePayload;
    } catch {
      return json({ success: false, error: "Invalid JSON body." }, 400);
    }
    const validated = validateScore(body);
    if (!validated.ok) return json({ success: false, error: validated.error }, 400);
    const rate = this.checkRateLimit(clientKey(request));
    if (!rate.allowed) {
      return json(
        {
          success: false,
          error: "Too many submissions. Please wait before posting another score.",
          retryAfterMs: Math.ceil(rate.retryAfterMs),
        },
        429
      );
    }
    const e = validated.entry;
    this.ctx.storage.sql.exec(
      `INSERT INTO leaderboard (player_name, score, wave, level_name, kills, headshots, difficulty, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      e.playerName,
      e.score,
      e.wave,
      e.levelName,
      e.kills,
      e.headshots,
      e.difficulty,
      e.createdAt
    );
    const total = (this.ctx.storage.sql.exec(`SELECT COUNT(*) AS c FROM leaderboard`).one() as { c: number }).c;
    if (total > MAX_STORED_SCORES) {
      this.ctx.storage.sql.exec(
        `DELETE FROM leaderboard WHERE id NOT IN (SELECT id FROM leaderboard ORDER BY score DESC, created_at ASC LIMIT ?)`,
        MAX_STORED_SCORES
      );
    }
    const rankRow = this.ctx.storage.sql.exec(`SELECT COUNT(*) + 1 AS rank FROM leaderboard WHERE score > ?`, e.score).one() as {
      rank: number;
    };
    return json({
      success: true,
      rank: rankRow.rank,
      playerName: e.playerName,
      score: e.score,
      message: "Score recorded on Durable Object.",
    });
  }

  private handleList(url: URL): Response {
    const difficultyFilter = url.searchParams.get("difficulty");
    const limit = Math.min(MAX_RETURNED_SCORES, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10) || 50));
    let query = `SELECT id, player_name AS playerName, score, wave, level_name AS levelName, kills, headshots, difficulty, created_at AS createdAt FROM leaderboard`;
    const params: (string | number)[] = [];
    if (difficultyFilter && difficultyFilter !== "All" && ALLOWED_DIFFICULTIES.has(difficultyFilter)) {
      query += ` WHERE difficulty = ?`;
      params.push(difficultyFilter);
    }
    query += ` ORDER BY score DESC, created_at ASC LIMIT ?`;
    params.push(limit);
    const rows = this.ctx.storage.sql.exec(query, ...params).toArray() as unknown as ScoreRow[];
    return json({ success: true, leaderboard: rows, count: rows.length });
  }

  private handleStats(): Response {
    const stats = this.ctx.storage.sql
      .exec(
        `SELECT COUNT(*) AS totalGames, COALESCE(SUM(kills), 0) AS totalKills, COALESCE(SUM(headshots), 0) AS totalHeadshots, COALESCE(MAX(score), 0) AS highestScore FROM leaderboard`
      )
      .one();
    return json({ success: true, stats });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    const path = url.pathname;
    if (path.startsWith("/api/")) {
      try {
        const ns = getLeaderboardNamespace(env);
        if (!ns) {
          const bindingNames = Object.keys(env as unknown as Record<string, unknown>);
          return json(
            {
              success: false,
              error:
                "Leaderboard Durable Object binding is missing. Redeploy with wrangler.json (durable_objects.bindings + exports.LeaderboardDO).",
              bindingsSeen: bindingNames,
            },
            503
          );
        }
        const id = ns.idFromName("global-leaderboard");
        return await ns.get(id).fetch(request);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Leaderboard unavailable";
        return json({ success: false, error: message, offline: true }, 503);
      }
    }
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return json({ success: false, error: "Not found" }, 404);
  },
} satisfies ExportedHandler<Env>;
