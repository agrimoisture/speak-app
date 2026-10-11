const KEY = "speak-app.apiKey";
const HIST = "speak-app.history";
const PREFS = "speak-app.prefs";
const MAX_HISTORY = 30;
const MAX_TRANSCRIPT_CHARS = 20000;

export function createStore(storage) {
  return {
    getKey() {
      return storage.getItem(KEY) || "";
    },
    setKey(value) {
      storage.setItem(KEY, value);
    },
    clearKey() {
      storage.removeItem(KEY);
    },
    getPrefs() {
      const defaults = { difficulty: "beginner", mode: "tap" };
      try {
        const saved = JSON.parse(storage.getItem(PREFS) || "null");
        if (!saved || typeof saved !== "object") return defaults;
        const difficulty = ["beginner", "intermediate", "advanced"].includes(saved.difficulty)
          ? saved.difficulty
          : defaults.difficulty;
        const mode = saved.mode === "handsfree" ? "handsfree" : "tap";
        return { difficulty, mode };
      } catch {
        return defaults;
      }
    },
    setPrefs(prefs) {
      const current = this.getPrefs();
      const next = { ...current };
      if (["beginner", "intermediate", "advanced"].includes(prefs.difficulty)) next.difficulty = prefs.difficulty;
      if (prefs.mode === "tap" || prefs.mode === "handsfree") next.mode = prefs.mode;
      storage.setItem(PREFS, JSON.stringify(next));
    },
    getHistory() {
      try {
        const parsed = JSON.parse(storage.getItem(HIST) || "[]");
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },
    addSession(item) {
      const history = this.getHistory();
      const transcript = trimTranscript(item.transcript);
      const next = [{ ...item, transcript }, ...history].slice(0, MAX_HISTORY);
      writeHistory(storage, next);
      return next;
    },
    updateSession(id, patch) {
      const next = this.getHistory().map((item) => (item.id === id ? { ...item, ...patch } : item));
      writeHistory(storage, next);
      return next;
    },
    clearHistory() {
      storage.removeItem(HIST);
    },
  };
}

function trimTranscript(lines) {
  const list = Array.isArray(lines) ? lines : [];
  const kept = [];
  let used = 0;
  for (const line of list) {
    const text = String(line?.text || "").slice(0, 2000);
    if (!text) continue;
    if (used + text.length > MAX_TRANSCRIPT_CHARS) break;
    used += text.length;
    kept.push({ role: line.role === "model" ? "model" : "user", text });
  }
  return kept;
}

function writeHistory(storage, history) {
  const payload = JSON.stringify(history);
  try {
    storage.setItem(HIST, payload);
  } catch {
    storage.setItem(HIST, JSON.stringify(history.slice(0, 5)));
  }
}

export function maskKey(key) {
  if (!key) return "尚未儲存";
  if (key.length < 8) return "已儲存";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

export function formatTaipei(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function normalizeApiKey(raw) {
  let text = String(raw || "").trim().replace(/^["']|["']$/g, "");
  const fromQuery = text.match(/(?:[?&]|^)key=([^\s&]+)/);
  if (fromQuery) text = decodeURIComponent(fromQuery[1]);
  return text.trim();
}

export function keyLooksUsable(key) {
  return typeof key === "string" && key.length >= 10 && !/\s/.test(key);
}
