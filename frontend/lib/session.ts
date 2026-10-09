// Where the login token lives in the browser.
//
// Trade-off (say this in the interview): an opaque bearer token in localStorage works across any
// frontend/backend domains (Vercel + Render), but JavaScript can read it, so an XSS bug would leak
// it. An HttpOnly SameSite cookie is safer against XSS but needs the two apps on the same site or
// careful CORS/cookie config. React escapes output and we never inject raw HTML, which is the
// mitigation here.
const KEY = "tf.token";

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    window.localStorage.setItem(KEY, token);
  } catch {
    /* storage blocked: the user will simply have to log in again next visit */
  }
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

// Set by <AuthProvider>; called when the API says our session is no longer valid.
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn;
};
export const notifyUnauthorized = () => onUnauthorized?.();
