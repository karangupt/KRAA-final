/* KRAA Auth
   ------------------------------------------------------------
   The login screen is a UI gate. Real protection happens on the
   backend (Apps Script checks a password hash stored in Script
   Properties — never committed to GitHub). In local-only mode
   (no Sheets connected yet) this still sets up the same pattern
   so nothing needs to change later.

   Session token is kept in sessionStorage only (cleared when the
   browser tab closes) so the token isn't sitting in localStorage
   indefinitely on a shared device.
*/

const AUTH_SESSION_KEY = 'kraa_session_token';
const AUTH_LOCAL_HASH_KEY = 'kraa_local_pw_hash'; // only used when Sheets isn't connected yet

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const Auth = (() => {
  function getToken() {
    return sessionStorage.getItem(AUTH_SESSION_KEY) || '';
  }

  function setToken(hash) {
    sessionStorage.setItem(AUTH_SESSION_KEY, hash);
  }

  function clearToken() {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
  }

  function isLoggedIn() {
    return !!getToken();
  }

  function hasLocalPasswordSet() {
    return !!localStorage.getItem(AUTH_LOCAL_HASH_KEY);
  }

  async function setLocalPassword(password) {
    const hash = await sha256Hex(password);
    localStorage.setItem(AUTH_LOCAL_HASH_KEY, hash);
    return hash;
  }

  // Verifies a password. If Sheets is connected, the backend is the source
  // of truth (real security). If not, we fall back to a locally-stored
  // hash (a soft lock — protects against casual access on a shared device,
  // not against someone reading the browser's storage directly).
  async function login(password) {
    const hash = await sha256Hex(password);

    if (SheetsAPI.isConfigured()) {
      const res = await SheetsAPI.verifyToken(hash);
      if (res) setToken(hash);
      return res;
    }

    if (!hasLocalPasswordSet()) {
      await setLocalPassword(password);
      setToken(hash);
      return true;
    }

    const stored = localStorage.getItem(AUTH_LOCAL_HASH_KEY);
    const ok = stored === hash;
    if (ok) setToken(hash);
    return ok;
  }

  function logout() {
    clearToken();
    location.reload();
  }

  return { getToken, isLoggedIn, login, logout, hasLocalPasswordSet };
})();
