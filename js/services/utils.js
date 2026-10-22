import { state } from './state.js';

/* ============================================================
   MODULE: UTILS
   ============================================================ */
export function now() { 
  return new Date().toISOString(); 
}

export function today() { 
  return new Date().toISOString().split('T')[0]; 
}

export function uid() { 
  return Date.now().toString(36) + Math.random().toString(36).slice(2,6); 
}

export function fmt(n) { 
  return (state.DB?.config?.currency || 'Q') + ' ' + Number(n||0).toFixed(2); 
}

export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-GT') + ' ' + d.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
}

export function fmtDateOnly(iso) { 
  if(!iso) return ''; 
  return new Date(iso).toLocaleDateString('es-GT'); 
}

export function isAdmin() { 
  return state.currentUser && state.currentUser.role === 'admin'; 
}

export function getProduct(id) { 
  return state.DB.menu?.products?.find(p => p.id === id); 
}

export function getProductPrice(id, date) {
  const p = getProduct(id); 
  if(!p) return 0;
  const hist = p.priceHistory.filter(h => h.from <= date).sort((a,b) => b.from.localeCompare(a.from));
  return hist.length ? hist[0].price : (p.priceHistory[0]?.price || 0);
}

export function getCategory(id) { 
  return state.DB.menu?.categories?.find(c => c.id === id); 
}

export function getTable(id) { 
  return state.DB.tables?.find(t => t.id === id); 
}

export function getOrder(id) { 
  return state.DB.orders?.find(o => o.id === id); 
}

export function tableOrders(tid) { 
  return state.DB.orders?.filter(o => o.tableId === tid && o.status !== 'paid' && o.status !== 'cancelled') || []; 
}

export function tableTotal(tid) { 
  return tableOrders(tid).reduce((s,o) => s + orderTotal(o), 0); 
}

export function orderTotal(ord) { 
  return ord.items.reduce((s,i) => s + (i.qty * i.price), 0); 
}

export function statusLabel(s) { 
  return { pending: '⏳ Pendiente', cooking: '🔥 Cocinando', ready: '✅ Listo', delivered: '📦 Entregado', paid: '💳 Pagado', cancelled: '❌ Cancelado' }[s] || s; 
}

export function togglePw(id, btn) { 
  const el = document.getElementById(id); 
  el.type = el.type === 'password' ? 'text' : 'password'; 
  btn.textContent = el.type === 'password' ? '👁️' : '🙈'; 
}

export function methodLabel(m) { 
  return { cash: '💵 Efectivo', card: '💳 Tarjeta', transfer: '📱 Transferencia', credit: '📋 Crédito' }[m] || m; 
}

export function methodColor(m) { 
  return { cash: { bg: '#d1fae5', fg: '#065f46' }, card: { bg: '#dbeafe', fg: '#1e40af' }, transfer: { bg: '#ede9fe', fg: '#5b21b6' }, credit: { bg: '#fef3c7', fg: '#92400e' } }[m] || { bg: '#f0f4f6', fg: '#4a6572' }; 
}
