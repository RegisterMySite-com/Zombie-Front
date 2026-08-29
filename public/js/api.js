// Leaderboard client — Durable Object API with localStorage fallback.

const STORAGE_KEY = "zf1944_leaderboard";
const LAST_NAME_KEY = "zf1944_player_name";

export class LeaderboardAPI {
  static getApiBase() {
    return "";
  }

  static async submitScore(scoreData) {
    const url = `${this.getApiBase()}/api/submit-score`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scoreData),
      });

      let result = null;
      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (!response.ok || !result?.success) {
        this.saveLocalScore(scoreData);
        return {
          success: false,
          isLocalFallback: true,
          error: result?.error || `Server returned HTTP ${response.status}`,
          message: result?.error || "Saved locally (server rejected or unreachable)",
        };
      }

      this.saveLocalScore(scoreData);
      if (scoreData.playerName) {
        try {
          localStorage.setItem(LAST_NAME_KEY, String(scoreData.playerName).slice(0, 20));
        } catch {
          /* ignore quota */
        }
      }
      return result;
    } catch (err) {
      this.saveLocalScore(scoreData);
      return {
        success: true,
        isLocalFallback: true,
        message: "Saved locally (offline / Durable Object unreachable)",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  static async getLeaderboard(difficulty = "All", limit = 50) {
    const url = `${this.getApiBase()}/api/leaderboard?difficulty=${encodeURIComponent(difficulty)}&limit=${limit}`;
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      if (data.success && Array.isArray(data.leaderboard)) {
        return { entries: data.leaderboard, source: "durable-object" };
      }
      throw new Error("Invalid response format");
    } catch (err) {
      return {
        entries: this.getLocalLeaderboard(difficulty),
        source: "local",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  static rememberName() {
    try {
      return localStorage.getItem(LAST_NAME_KEY) || "Private Ryan";
    } catch {
      return "Private Ryan";
    }
  }

  static saveLocalScore(scoreData) {
    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      existing.push({
        id: Date.now(),
        playerName: scoreData.playerName || "Anonymous",
        score: scoreData.score || 0,
        wave: scoreData.wave || 1,
        levelName: scoreData.levelName || "NORMANDY VILLAGE",
        kills: scoreData.kills || 0,
        headshots: scoreData.headshots || 0,
        difficulty: scoreData.difficulty || "Normal",
        createdAt: Date.now(),
      });
      existing.sort((a, b) => b.score - a.score || a.createdAt - b.createdAt);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.slice(0, 100)));
    } catch {
      /* ignore quota / private mode */
    }
  }

  static getLocalLeaderboard(difficulty = "All") {
    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      const filtered = difficulty !== "All" ? existing.filter((e) => e.difficulty === difficulty) : existing;
      return filtered.sort((a, b) => b.score - a.score);
    } catch {
      return [];
    }
  }
}
