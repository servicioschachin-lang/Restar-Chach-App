import { state } from './state.js';
import { INACTIVITY_MS, WARN_BEFORE_MS } from '../config.js';

let logoutCallback = null;

export function initTimer(onLogout) {
  logoutCallback = onLogout;
}

export function resetInactivityTimer() {
  if (!state.currentUser) return;
  clearTimeout(state.inactivityTimer);
  clearTimeout(state.inactivityWarnTimer);
  clearInterval(state.inactivityCountdownInterval);
  
  const warningEl = document.getElementById('inactivity-warning');
  if (warningEl) warningEl.style.display = 'none';

  state.inactivityWarnTimer = setTimeout(() => {
    let secsLeft = Math.ceil(WARN_BEFORE_MS / 1000);
    const warningEl2 = document.getElementById('inactivity-warning');
    if (warningEl2) warningEl2.style.display = 'block';
    
    const countdownEl = document.getElementById('inactivity-countdown');
    if (countdownEl) countdownEl.textContent = secsLeft + 's';
    
    state.inactivityCountdownInterval = setInterval(() => {
      secsLeft--;
      const cd = document.getElementById('inactivity-countdown');
      if (cd) cd.textContent = secsLeft + 's';
    }, 1000);
  }, INACTIVITY_MS - WARN_BEFORE_MS);

  state.inactivityTimer = setTimeout(() => {
    if (window.showToast) {
      window.showToast('⏰ Sesión cerrada por inactividad');
    }
    if (logoutCallback) {
      logoutCallback();
    }
  }, INACTIVITY_MS);
}

export function startInactivityTimer() {
  ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach(ev => {
    document.addEventListener(ev, resetInactivityTimer, { passive: true });
  });
  resetInactivityTimer();
}

export function stopInactivityTimer() {
  clearTimeout(state.inactivityTimer);
  clearTimeout(state.inactivityWarnTimer);
  clearInterval(state.inactivityCountdownInterval);
  ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach(ev => {
    document.removeEventListener(ev, resetInactivityTimer);
  });
}
