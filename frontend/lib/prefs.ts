// Tiny localStorage helpers for per-viewer UI conveniences (selected workspace, list/grid, dismissed tips).
// localStorage can throw or be empty (private windows, blocked storage), so every access is wrapped
// and the UI must render correctly without it.

export function readPref<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(`tf.${key}`);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writePref<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(`tf.${key}`, JSON.stringify(value));
  } catch {
    /* ignore: preference just won't persist */
  }
}
