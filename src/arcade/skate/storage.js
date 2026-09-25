// Saved progress: best score, level and which of the current challenges are already done.
const KEY = "vaiinilla.arcade.skate.v1";
const FRESH = { best: 0, level: 0, done: [] };

export function loadProgress() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...FRESH };
    const p = JSON.parse(raw);
    return { best: Number(p.best) || 0, level: Number(p.level) || 0, done: Array.isArray(p.done) ? p.done : [] };
  } catch (error) {
    console.warn("[storage] could not read progress, starting fresh", error);
    return { ...FRESH };
  }
}

export function saveProgress(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch (error) {
    console.warn("[storage] could not save progress", error);
  }
}
