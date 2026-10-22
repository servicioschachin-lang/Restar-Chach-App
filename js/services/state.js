/* ============================================================
   GLOBAL STATE MODULE
   ============================================================ */
export const state = {
  DB: {},
  currentUser: null,
  currentPage: 'mesas',
  selectedTableId: null,
  orderDraft: { items: [], clientName: '', notes: '' },
  failedAttempts: 0,
  lockUntil: 0,
  inactivityTimer: null,
  inactivityWarnTimer: null,
  inactivityCountdownInterval: null,
  _saveQueued: false
};
