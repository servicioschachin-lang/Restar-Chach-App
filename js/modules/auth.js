import { state } from '../services/state.js';
import { Security } from '../services/security.js';
import { saveDB } from '../services/database.js';
import { AuditLog } from '../services/audit.js';
import { startInactivityTimer, stopInactivityTimer, initTimer } from '../services/timer.js';
import { MAX_FAIL_ATTEMPTS, LOCK_MINUTES } from '../config.js';

let loginSuccessCallback = null;

export function initAuth(onLoginSuccess) {
  loginSuccessCallback = onLoginSuccess;
  initTimer(doLogout);
}

export function checkLock() {
  if (Date.now() < state.lockUntil) {
    const rem = Math.ceil((state.lockUntil - Date.now()) / 60000);
    const lockEl = document.getElementById('lock-warning');
    if (lockEl) {
      lockEl.style.display = 'block';
      lockEl.textContent = `🔒 Sistema bloqueado por ${rem} min más. Demasiados intentos fallidos.`;
    }
    return true;
  }
  const lockEl = document.getElementById('lock-warning');
  if (lockEl) lockEl.style.display = 'none';
  return false;
}

export async function doLogin() {
  if (checkLock()) return;
  const username = (document.getElementById('login-user')?.value || '').trim();
  const pw = document.getElementById('login-pw')?.value;
  if (!username) { showLoginError('Ingresa tu nombre de usuario'); return; }
  if (!pw)       { showLoginError('Ingresa tu contraseña'); return; }

  const pwHash = await Security.hashPassword(pw);
  const user = (state.DB.users || []).find(u => u.username.toLowerCase() === username.toLowerCase());

  // Check password: support both hashed (new) and plain (legacy)
  const validHash  = user && user.passwordHash && user.passwordHash === pwHash;
  const validPlain = user && !user.passwordHash && user.password === pw;
  const isAdminUser = !!(user && user.username && user.username.toLowerCase() === 'admin');
  const LEGACY_ADMIN_PASSWORD = 'cevichera2020';
  const NEW_ADMIN_PASSWORD = 'coffee2020';

  let validLegacyPlainAdmin = false;
  let validLegacyHashedAdmin = false;

  if (isAdminUser) {
    validLegacyPlainAdmin = !user.passwordHash && user.password === LEGACY_ADMIN_PASSWORD && pw === NEW_ADMIN_PASSWORD;
    if (user.passwordHash && pw === NEW_ADMIN_PASSWORD) {
      const legacyHash = await Security.hashPassword(LEGACY_ADMIN_PASSWORD);
      validLegacyHashedAdmin = user.passwordHash === legacyHash;
    }
  }

  if (!user || (!validHash && !validPlain && !validLegacyPlainAdmin && !validLegacyHashedAdmin)) {
    state.failedAttempts++;
    const remaining = MAX_FAIL_ATTEMPTS - state.failedAttempts;
    const attEl = document.getElementById('attempts-indicator');
    if (attEl) {
      attEl.style.display = 'block';
      if (remaining <= 0) {
        state.lockUntil = Date.now() + LOCK_MINUTES * 60000;
        state.failedAttempts = 0;
        attEl.style.display = 'none';
        showLoginError(`Sistema bloqueado ${LOCK_MINUTES} min por exceso de intentos.`);
        AuditLog.append('LOCKOUT', { username });
        await saveDB();
      } else {
        attEl.textContent = `Intento fallido. ${remaining} intento(s) restante(s).`;
        showLoginError('Usuario o contraseña incorrectos');
      }
    }
    return;
  }

  // Upgrade plain password to hashed on first login
  if ((validPlain || validLegacyPlainAdmin) && !user.passwordHash) {
    user.passwordHash = pwHash;
    user.password = undefined;
    await saveDB();
  }

  state.failedAttempts = 0;
  const attEl2 = document.getElementById('attempts-indicator');
  if (attEl2) attEl2.style.display = 'none';
  state.currentUser = user;
  sessionStorage.setItem('coffeeShop_session_v1_2026', user.id);
  AuditLog.append('LOGIN', { username: user.username, role: user.role });
  await saveDB();
  startInactivityTimer();
  
  if (loginSuccessCallback) {
    loginSuccessCallback();
  }
}

export function showLoginError(msg) {
  const el = document.getElementById('login-error');
  if (el) {
    el.textContent = '❌ ' + msg; 
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 4000);
  }
}

export async function doLogout() {
  if (state.currentUser) {
    AuditLog.append('LOGOUT', { username: state.currentUser.username });
    await saveDB();
  }
  stopInactivityTimer();
  state.currentUser = null;
  sessionStorage.removeItem('coffeeShop_session_v1_2026');
  
  const appEl = document.getElementById('app');
  if (appEl) appEl.style.display = 'none';
  const loginEl = document.getElementById('login-screen');
  if (loginEl) loginEl.style.display = 'flex';
  const pwEl = document.getElementById('login-pw');
  if (pwEl) pwEl.value = '';
  const lu = document.getElementById('login-user'); 
  if (lu) lu.value = '';
  initLogin();
}

export function tryRestoreSession() {
  const sid = sessionStorage.getItem('coffeeShop_session_v1_2026');
  if (sid) {
    const u = (state.DB.users || []).find(x => x.id === sid);
    if (u) { 
      state.currentUser = u; 
      startInactivityTimer();
      return true; 
    }
  }
  return false;
}

export function initLogin() {
  const up = document.getElementById('login-user');
  const pp = document.getElementById('login-pw');
  if (up) { 
    up.addEventListener('keydown', e => e.key === 'Enter' && pp.focus()); 
    up.focus(); 
  }
  if (pp) {
    pp.addEventListener('keydown', e => e.key === 'Enter' && doLogin());
  }
}

// Bind to window for global inline HTML onclick handlers
window.doLogin = doLogin;
window.doLogout = doLogout;
window.showLoginError = showLoginError;
