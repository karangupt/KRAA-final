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
const AUTH_FAIL_KEY = 'kraa_fail_count';
const AUTH_LOCK_KEY = 'kraa_lock_until';
const MAX_ATTEMPTS = 5;
const LOCK_MS = 30000; // 30s lockout after MAX_ATTEMPTS wrong tries

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

  // True only when there is no server-side (Sheets) auth configured AND
  // no local password has ever been created — i.e. this device genuinely
  // needs first-time setup. Never true again after a password exists.
  function needsSetup() {
    return !SheetsAPI.isConfigured() && !hasLocalPasswordSet();
  }

  async function createLocalPassword(password, confirmPassword) {
    if (!password || password.length < 4) {
      return { ok: false, error: 'Password must be at least 4 characters.' };
    }
    if (password !== confirmPassword) {
      return { ok: false, error: 'Passwords do not match.' };
    }
    const hash = await sha256Hex(password);
    localStorage.setItem(AUTH_LOCAL_HASH_KEY, hash);
    setToken(hash);
    _resetAttempts();
    return { ok: true };
  }

  function _getLockUntil() {
    return Number(localStorage.getItem(AUTH_LOCK_KEY) || 0);
  }
  function _getFailCount() {
    return Number(localStorage.getItem(AUTH_FAIL_KEY) || 0);
  }
  function _resetAttempts() {
    localStorage.removeItem(AUTH_FAIL_KEY);
    localStorage.removeItem(AUTH_LOCK_KEY);
  }
  function _registerFailure() {
    const count = _getFailCount() + 1;
    localStorage.setItem(AUTH_FAIL_KEY, String(count));
    if (count >= MAX_ATTEMPTS) {
      localStorage.setItem(AUTH_LOCK_KEY, String(Date.now() + LOCK_MS));
    }
  }
  function lockoutSecondsRemaining() {
    const until = _getLockUntil();
    if (!until) return 0;
    const remaining = Math.ceil((until - Date.now()) / 1000);
    return remaining > 0 ? remaining : 0;
  }

  // Strict verification only. Never creates or changes a password.
  // Returns { ok: true } or { ok: false, error }.
  async function login(password) {
    if (lockoutSecondsRemaining() > 0) {
      return { ok: false, error: `Too many attempts. Try again in ${lockoutSecondsRemaining()}s.` };
    }

    const hash = await sha256Hex(password);

    if (SheetsAPI.isConfigured()) {
      const ok = await SheetsAPI.verifyToken(hash);
      if (ok) { setToken(hash); _resetAttempts(); return { ok: true }; }
      _registerFailure();
      return { ok: false, error: 'Incorrect password.' };
    }

    // Local mode: a password must already exist by this point (needsSetup
    // is checked before this function is ever called for local mode).
    const stored = localStorage.getItem(AUTH_LOCAL_HASH_KEY);
    if (stored && stored === hash) {
      setToken(hash);
      _resetAttempts();
      return { ok: true };
    }
    _registerFailure();
    return { ok: false, error: 'Incorrect password.' };
  }

  function logout() {
    clearToken();
    location.reload();
  }

  return {
    getToken, isLoggedIn, login, logout,
    hasLocalPasswordSet, needsSetup, createLocalPassword,
    lockoutSecondsRemaining
  };
})();
