import { loadDB, saveDB } from './services/database.js';
import { showApp } from './modules/ui.js';
import { state } from './services/state.js';
import { ErrorHandler } from './services/errorhandler.js';

// Set up periodic auto-save
setInterval(() => {
  if (state.currentUser) {
    saveDB();
  }
}, 30000);

window.addEventListener('load', async () => {
  try {
    await loadDB();
    if (!state.DB || typeof state.DB !== 'object') state.DB = {};
    if (!state.DB.users) state.DB.users = [];
    state.currentUser = { id: 'system', username: 'Restar Chach App', role: 'admin' };
    showApp();
  } catch (e) {
    ErrorHandler.log('Init error', e);
    state.currentUser = { id: 'system', username: 'Restar Chach App', role: 'admin' };
    showApp();
  }
});

(function forceCoffeeLogo() {
  const logoUrl = './logo.jpeg';
  const setLogo = (img) => {
    try {
      if (!img || img.tagName !== 'IMG') return;
      if (logoUrl) img.src = logoUrl;
    } catch (e) {}
  };
  try { document.querySelectorAll('img.logo-img').forEach(setLogo); } catch (e) {}
})();