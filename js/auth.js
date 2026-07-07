/* KRAA Auth
   ------------------------------------------------------------
   ONE universal password, same on every device. The password
   itself is never stored in plain text — only its SHA-256 hash
   sits in this file. Paste your hash into UNIVERSAL_PASSWORD_HASH
   below (see README for how to generate it).

   Reminder: this repo is public, so this hash is technically
   visible to anyone who looks at the source. A determined person
   could brute-force a weak password offline. This is a deterrent
   gate, not bank-grade security — for real protection, connect
   Google Sheets (js/sheets-api.js) so the check happens on
   Google's servers instead, where the password is never exposed.
*/

const UNIVERSAL_PASSWORD_HASH = '4de91767635ed1cfc9f3ab3067e2b216e2a47d2a190e3a3cb0b9fab49414dbf8'; // <-- paste your SHA-256 password hash here

const AUTH_SESSION_KEY = 'kraa_session_token';
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

  // Strict verification against ONE universal password. Same check,
  // same password, on every device — nothing is ever created or
  // changed from the login screen.
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

    if (!UNIVERSAL_PASSWORD_HASH) {
      return { ok: false, error: 'No password has been configured yet. See README to set one.' };
    }

    if (hash === UNIVERSAL_PASSWORD_HASH) {
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

  return { getToken, isLoggedIn, login, logout, lockoutSecondsRemaining };
})();
