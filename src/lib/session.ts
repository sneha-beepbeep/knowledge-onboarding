// The session token lives in localStorage and is sent as a Bearer header
// (template convention). Each request reads it fresh, so a token refreshed in
// another tab is picked up on retry (T3 session-expiry handling).
const KEY = "kc.session";
const RETURN_KEY = "kc.returnTo";

export const getToken = () => localStorage.getItem(KEY);
export const setToken = (t: string) => localStorage.setItem(KEY, t);
export const clearToken = () => localStorage.removeItem(KEY);

export const setReturnTo = (path: string) => sessionStorage.setItem(RETURN_KEY, path);
export function takeReturnTo(): string | null {
  const v = sessionStorage.getItem(RETURN_KEY);
  sessionStorage.removeItem(RETURN_KEY);
  return v && v.startsWith("/") && !v.startsWith("//") ? v : null;
}
