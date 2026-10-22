import { state } from '../services/state.js';
import { saveDB } from '../services/database.js';
import { AuditLog } from '../services/audit.js';
import { now, fmtDate, getTable, getOrder } from '../services/utils.js';

/* ============================================================
   MODULE: ÓRDENES / KITCHEN BOARD
   ============================================================ */
export function renderOrdenes() {
  const page = document.getElementById('page-ordenes');
  if (!page) return;
  const active = state.DB.orders.filter(o => !['paid', 'cancelled'].includes(o.status));
  const cols = {
    pending:   { label: '⏳ Pendiente', color: '#f59e0b', orders: [] },
    cooking:   { label: '🔥 Cocinando',  color: '#0d9488', orders: [] },
    ready:     { label: '✅ Listo',       color: '#22c55e', orders: [] },
    delivered: { label: '📦 Entregado',   color: '#94a3b8', orders: [] }
  };
  active.forEach(o => { 
    if (cols[o.status]) cols[o.status].orders.push(o); 
  });
  const itemCfg = {
    pending: { label: '⏳ Pendiente', border: '#f59e0b', bg: '#fef9c3', color: '#92400e', next: 'cooking' },
    cooking: { label: '🔥 Cocinando', border: '#0d9488', bg: '#ccfbf1', color: '#065f46', next: 'ready' },
    ready:   { label: '✅ Listo',     border: '#22c55e', bg: '#bbf7d0', color: '#14532d', next: null }
  };
  
  page.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Órdenes</h1><p class="page-subtitle">Tablero de cocina — estado por platillo</p></div>
      <button class="btn btn-secondary btn-sm" onclick="renderOrdenes()">🔄 Actualizar</button>
    </div>
    <div class="kitchen-board">
      ${Object.entries(cols).map(([status, col]) => `
        <div class="kitchen-col">
          <div class="kitchen-col-title col-${status}">
            ${col.label}
            <span style="background:rgba(0,0,0,.15);border-radius:50%;width:21px;height:21px;display:inline-flex;align-items:center;justify-content:center;font-size:.73rem;font-weight:800">${col.orders.length}</span>
          </div>
          ${!col.orders.length ? `<div class="empty-state" style="padding:14px"><span style="font-size:1.4rem">—</span></div>` : ''}
          ${col.orders.map(o => {
            const table = getTable(o.tableId);
            const nextOS = { pending: 'cooking', cooking: 'ready', ready: 'delivered' }[status];
            const prevOS = { cooking: 'pending', ready: 'cooking', delivered: 'ready' }[status];
            const allReady   = o.items.every(i => (i.itemStatus || 'pending') === 'ready');
            const allCooking = o.items.every(i => (i.itemStatus || 'pending') === 'cooking');
            const allPending = o.items.every(i => (i.itemStatus || 'pending') === 'pending');
            return `<div class="k-card ${status}">
              <div class="k-card-header">
                <span class="k-card-table">${table?.name || ''}</span>
                <span class="k-card-time">${fmtDate(o.createdAt).split(' ')[1] || ''}</span>
              </div>
              ${o.clientName ? `<div style="font-size:.78rem;color:var(--g500);margin-bottom:7px">👤 <b>${o.clientName}</b></div>` : ''}
              <div class="k-items-list">
                ${o.items.map(item => {
                  const ist = item.itemStatus || 'pending';
                  const cfg = itemCfg[ist] || itemCfg.pending;
                  return `<div class="k-item-row" style="border-left-color:${cfg.border}">
                    <div class="k-item-info">
                      <span class="k-item-qty">${item.qty}×</span>
                      <span class="k-item-name">${item.name}</span>
                    </div>
                    <div class="k-item-right">
                      <span class="k-item-badge" style="background:${cfg.bg};color:${cfg.color}">${cfg.label}</span>
                      ${cfg.next && status !== 'delivered'
                        ? `<button class="k-item-btn" onclick="moveItemStatus('${o.id}','${item.id}','${cfg.next}')">›</button>`
                        : `<div style="width:21px"></div>`}
                    </div>
                  </div>`;
                }).join('')}
              </div>
              ${o.notes ? `<div class="k-card-note">📝 ${o.notes}</div>` : ''}
              ${status !== 'delivered' ? `
              <div class="k-bulk-actions">
                <span style="font-size:.7rem;color:var(--g400);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Todo:</span>
                <button class="k-bulk-btn ${allPending ? 'k-bulk-active-pending' : ''}" onclick="markAllItems('${o.id}','pending')">⏳</button>
                <button class="k-bulk-btn ${allCooking ? 'k-bulk-active-cooking' : ''}" onclick="markAllItems('${o.id}','cooking')">🔥</button>
                <button class="k-bulk-btn ${allReady ? 'k-bulk-active-ready' : ''}" onclick="markAllItems('${o.id}','ready')">✅</button>
              </div>` : ''}
              <div style="margin-top:7px;display:flex;gap:5px;flex-wrap:wrap;border-top:1px solid var(--g100);padding-top:7px">
                ${prevOS ? `<button class="btn btn-xs btn-secondary" onclick="moveOrder('${o.id}','${prevOS}')">← Regresar</button>` : ''}
                ${nextOS ? `<button class="btn btn-xs btn-primary" onclick="moveOrder('${o.id}','${nextOS}')">${nextOS === 'delivered' ? '📦 Entregar' : 'Avanzar →'}</button>` : ''}
                <button class="btn btn-xs btn-coral" onclick="chargeOrderFromBoard('${o.id}')">💳 Cobrar</button>
                <button class="btn btn-xs btn-danger" onclick="cancelOrderFromBoard('${o.id}')">❌ Cancelar</button>
              </div>
            </div>`;
          }).join('')}
        </div>`).join('')}
    </div>`;
}

export function moveOrder(orderId, newStatus) {
  const order = getOrder(orderId); 
  if (!order) return;
  const itemStatus = { pending: 'pending', cooking: 'cooking', ready: 'ready', delivered: 'ready' }[newStatus] || newStatus;
  order.items = order.items.map(i => ({ ...i, itemStatus: newStatus === 'delivered' ? 'ready' : itemStatus }));
  order.status = newStatus; 
  saveDB(); 
  renderOrdenes();
}

export function moveItemStatus(orderId, itemId, newItemStatus) {
  const order = getOrder(orderId); 
  if (!order) return;
  const item = order.items.find(i => i.id === itemId); 
  if (!item) return;
  item.itemStatus = newItemStatus;
  recalcOrderStatus(order);
  saveDB(); 
  renderOrdenes();
}

export function markAllItems(orderId, newItemStatus) {
  const order = getOrder(orderId); 
  if (!order) return;
  order.items = order.items.map(i => ({ ...i, itemStatus: newItemStatus }));
  recalcOrderStatus(order);
  saveDB(); 
  renderOrdenes();
}

export function recalcOrderStatus(order) {
  const statuses = order.items.map(i => i.itemStatus || 'pending');
  if (['delivered', 'paid', 'cancelled'].includes(order.status)) return;
  if (statuses.every(s => s === 'ready')) {
    order.status = 'ready';
  } else if (statuses.some(s => ['cooking', 'ready'].includes(s))) {
    order.status = 'cooking';
  } else {
    order.status = 'pending';
  }
}

export async function cancelOrderFromBoard(orderId) {
  const order = getOrder(orderId); 
  if (!order) return;
  const reason = prompt('Motivo de cancelación (requerido):', '');
  if (reason === null) return;
  if (!reason.trim()) { alert('Debes ingresar un motivo'); return; }
  state.DB.deletedRecords.orders.push({ ...order, deletedAt: now(), deletedBy: state.currentUser.id, reason: reason.trim(), action: 'cancelled' });
  order.status = 'cancelled';
  AuditLog.append('ORDER_CANCELLED', { orderId, reason: reason.trim(), cancelledBy: state.currentUser.username });
  await saveDB();
  renderOrdenes();
  if (window.showToast) {
    window.showToast('Orden cancelada — auditoría registrada.');
  }
}

export function chargeOrderFromBoard(orderId) {
  const order = getOrder(orderId); 
  if (!order) return;
  state.selectedTableId = order.tableId;
  if (window.chargeTable) {
    window.chargeTable(order.tableId, order.clientName || 'table');
  }
}

// Bind to window for global inline HTML onclick handlers
window.renderOrdenes = renderOrdenes;
window.moveOrder = moveOrder;
window.moveItemStatus = moveItemStatus;
window.markAllItems = markAllItems;
window.cancelOrderFromBoard = cancelOrderFromBoard;
window.chargeOrderFromBoard = chargeOrderFromBoard;
