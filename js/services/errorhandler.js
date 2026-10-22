/* ============================================================
   MODULE: ERROR HANDLER
   ============================================================ */
export const ErrorHandler = (() => {
  const log_arr = [];

  function log(msg, err = null) {
    const entry = { ts: new Date().toISOString(), msg, err: err ? String(err) : null };
    log_arr.push(entry);
    if (log_arr.length > 200) log_arr.shift();
    console.warn('[LaOla]', msg, err || '');
  }

  function getLogs() { 
    return [...log_arr]; 
  }

  return { log, getLogs };
})();
