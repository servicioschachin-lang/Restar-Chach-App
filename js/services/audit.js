import { state } from './state.js';
import { uid, now } from './utils.js';

/* ============================================================
   MODULE: AUDIT LOG (append-only)
   ============================================================ */
export const AuditLog = (() => {
  function append(action, details = {}) {
    if (!state.DB || !state.DB.auditLog) return;
    const entry = {
      id: uid(),
      ts: now(),
      userId: state.currentUser?.id || 'system',
      username: state.currentUser?.username || 'system',
      action,
      details
    };
    // Audit log is append-only — no delete allowed
    state.DB.auditLog.push(entry);
  }

  return { append };
})();
