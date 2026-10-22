import { state } from '../services/state.js';
import { deductInventoryForSale } from '../modules/inventory.js';
import { saveDB } from '../services/database.js';
import { AuditLog } from '../services/audit.js';
import { Security } from '../services/security.js';
import { ErrorHandler } from '../services/errorhandler.js';
import { APP_VERSION, SCHEMA_VERSION } from '../config.js';
import { 
  now, today, uid, fmt, fmtDate, isAdmin, 
  getProduct, getProductPrice, getCategory, getTable, 
  getOrder, tableOrders, tableTotal, orderTotal, 
  statusLabel, methodLabel, methodColor 
} from '../services/utils.js';
import { closeModal, openModal, showToast, buildSidebar, renderPage } from './ui.js';

/* ============================================================
   MODULE: MESAS
   ============================================================ */
export function renderMesas() {
  const page = document.getElementById('page-mesas');
  if (!page) return;
  const groups = {};
  state.DB.tables.forEach(t => { 
    if (!groups[t.area]) groups[t.area] = []; 
    groups[t.area].push(t); 
  });
  const names = { general: 'Mesas Generales (1-20)', vip: 'Área VIP', bar: 'Barra (1-15)', ger: 'Gerencial' };
  let html = `<div class="page-header"><div><h1 class="page-title">Mesas</h1><p class="page-subtitle">Selecciona una mesa para gestionar órdenes</p></div></div>`;
  Object.entries(groups).forEach(([area, tables]) => {
    html += `<h3 style="font-weight:800;color:var(--navy);margin:18px 0 10px">${names[area] || area}</h3><div class="tables-grid">`;
    tables.forEach(t => {
      const orders = tableOrders(t.id);
      const total  = tableTotal(t.id);
      const status = orders.length ? 'busy' : 'free';
      const icon   = t.area === 'bar' ? '🪑' : t.area === 'vip' ? '⭐' : t.area === 'ger' ? '👑' : '🪑';
      html += `<div class="table-card ${status}" onclick="openTable('${t.id}')">
        <div class="table-icon">${icon}</div>
        <div class="table-name">${t.name}</div>
        <div class="table-info">${orders.length ? orders.length + ' orden(es)' : 'Libre'}</div>
        ${total > 0 ? `<div class="table-amount">${fmt(total)}</div>` : ''}
      </div>`;
    });
    html += '</div>';
  });
  page.innerHTML = html;
}

export function selectClientForNewOrder(clientName) {
  const el = document.getElementById('oc-client');
  if (el) {
    el.value = clientName;
    el.focus();
    const modalBody = el.closest('.modal-body');
    if (modalBody) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

export function reopenReceipt(saleId) {
  const sale = state.DB.sales.find(s => s.id === saleId);
  if (sale) {
    showReceipt(sale);
  } else {
    showToast('⚠️ No se encontró la venta');
  }
}

export function openTable(tableId) {
  state.selectedTableId = tableId;
  if (window.matchMedia('(max-width:768px)').matches) {
    const sm = document.getElementById('sidebar');
    if (sm) sm.classList.remove('open');
  }
  const table  = getTable(tableId);
  const orders = tableOrders(tableId);
  const total  = tableTotal(tableId);
  state.orderDraft = { items: [], clientName: '', notes: '' };

  const uniqueClients = [...new Set(orders.map(o => o.clientName).filter(Boolean))];
  let clientsHtml = '';
  if (orders.length) {
    clientsHtml = `
      <div class="mb-3">
        <strong style="font-size:.83rem;color:var(--g600)">CUENTAS ABIERTAS (POR CLIENTE)</strong>
        <div class="mt-2" style="display:flex;flex-wrap:wrap;align-items:center;gap:6px">
          ${uniqueClients.map(c => {
            const ct = orders.filter(o => o.clientName === c).reduce((s, o) => s + orderTotal(o), 0);
            return `<span class="client-tag" title="Haga clic para agregar más pedidos a este cliente" onclick="selectClientForNewOrder('${c}')" style="cursor:pointer">
              👤 ${c} <span style="font-size:.73rem;color:var(--mint-dark);font-weight:700">${fmt(ct)}</span>
              <button class="btn btn-xs btn-secondary" style="padding:2px 5px;font-size:.68rem;margin-left:5px" onclick="event.stopPropagation();selectClientForNewOrder('${c}')" title="Agregar más pedidos">➕</button>
              <button class="btn btn-xs btn-coral" style="padding:2px 5px;font-size:.68rem;margin-left:2px" onclick="event.stopPropagation();closeModal('modal-table');chargeTable('${tableId}','${c}')" title="Cobrar Cuenta">💳</button>
              ${isAdmin() ? `<button onclick="event.stopPropagation();removeClient('${tableId}','${c}')" style="color:var(--coral);background:none;border:none;cursor:pointer;font-size:.88rem;margin-left:2px" title="Eliminar Cuenta">×</button>` : ''}
            </span>`;
          }).join('')}
          ${orders.some(o => !o.clientName) ? `
            <span class="client-tag" onclick="selectClientForNewOrder('')" style="cursor:pointer" title="Haga clic para agregar más pedidos a la cuenta general">
              👤 General <span style="font-size:.73rem;color:var(--mint-dark);font-weight:700">${fmt(orders.filter(o => !o.clientName).reduce((s, o) => s + orderTotal(o), 0))}</span>
              <button class="btn btn-xs btn-secondary" style="padding:2px 5px;font-size:.68rem;margin-left:5px" onclick="event.stopPropagation();selectClientForNewOrder('')">➕</button>
              <button class="btn btn-xs btn-coral" style="padding:2px 5px;font-size:.68rem;margin-left:2px" onclick="event.stopPropagation();closeModal('modal-table');chargeTable('${tableId}','table')">💳</button>
            </span>
          ` : ''}
        </div>
      </div><div class="divider"></div>`;
  }

  let ordersHtml = orders.length ? `
    <div class="mb-3">
      <strong style="font-size:.83rem;color:var(--g600)">ÓRDENES ACTIVAS</strong>
      <div class="mt-2">
        ${orders.map(o => {
          const ot = orderTotal(o);
          return `<div class="k-card ${o.status} mt-2">
            <div class="k-card-header">
              <span class="k-card-table">${o.clientName || 'Mesa'}</span>
              <span class="status status-${o.status}">${statusLabel(o.status)}</span>
            </div>
            ${o.items.map(i => `<div style="display:flex;justify-content:space-between;font-size:.83rem;padding:3px 0;border-bottom:1px solid var(--g100)"><span>${i.qty}x ${i.name}</span><span>${fmt(i.qty * i.price)}</span></div>`).join('')}
            ${o.notes ? `<div class="k-card-note">📝 ${o.notes}</div>` : ''}
            <div style="margin-top:7px;display:flex;gap:5px;flex-wrap:wrap;align-items:center">
              <span style="font-size:.8rem;font-weight:700;color:var(--navy)">${fmt(ot)}</span>
              <button class="btn btn-xs btn-coral" onclick="closeModal('modal-table');chargeTable('${tableId}','${o.clientName || 'table'}')">💳 Cobrar</button>
              <button class="btn btn-xs btn-secondary" onclick="editOrderNotes('${o.id}')">📝 Notas</button>
              <button class="btn btn-xs btn-danger" onclick="cancelOrderFromTable('${o.id}','${tableId}')">❌ Cancelar</button>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div><div class="divider"></div>` : '';

  const todayPaidSales = state.DB.sales ? state.DB.sales.filter(s => 
    s.tableId === tableId && 
    s.date.startsWith(today())
  ) : [];

  let paidSalesHtml = '';
  if (todayPaidSales.length) {
    paidSalesHtml = `
      <div class="divider"></div>
      <div class="mb-3">
        <strong style="font-size:.83rem;color:var(--g600)">CUENTAS COBRADAS HOY</strong>
        <div class="mt-2" style="display:flex;flex-wrap:wrap;align-items:center;gap:6px">
          ${todayPaidSales.map(s => {
            const label = s.clientName ? `👤 ${s.clientName}` : '👤 General (Cobrado)';
            const methodSymbol = s.paymentMethod === 'cash' ? '💵' : s.paymentMethod === 'credit' ? '⚠️' : '💳';
            return `<span class="client-tag" style="background:rgba(255,255,255,0.06);border:1px dashed rgba(255,255,255,0.18)" title="Cuenta cobrada">
              <span style="text-decoration:line-through;opacity:0.65;margin-right:4px">${label}</span>
              <span style="font-size:.73rem;color:var(--gold);font-weight:700">${fmt(s.total)}</span>
              <span style="font-size:.7rem;margin-left:3px" title="Método: ${s.paymentMethod}">${methodSymbol}</span>
              <button class="btn btn-xs btn-secondary" style="padding:2px 5px;font-size:.68rem;margin-left:6px" onclick="reopenReceipt('${s.id}')" title="Ver/Imprimir Ticket">📄 Recibo</button>
              ${s.clientName ? `<button class="btn btn-xs btn-gold" style="padding:2px 5px;font-size:.68rem;margin-left:2px" onclick="selectClientForNewOrder('${s.clientName}')" title="Crear nueva cuenta para este cliente">🆕 Reabrir</button>` : ''}
            </span>`;
          }).join('')}
        </div>
      </div>`;
  }

  const inner = document.getElementById('modal-table-inner');
  if (inner) {
    inner.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">🪑 ${table.name}</h3>
        <button class="modal-close" onclick="closeModal('modal-table')">×</button>
      </div>
      <div class="modal-body">
        ${clientsHtml}${ordersHtml}${paidSalesHtml}
        <div class="order-builder">
          <div>
            <h4 style="margin-bottom:11px;color:var(--navy)">Nueva Orden</h4>
            <div class="form-group"><label>Cliente</label><input type="text" id="oc-client" placeholder="Nombre del cliente (opcional)"></div>
            <div class="form-group"><label>Notas</label><textarea id="oc-notes" placeholder="Sin cebolla, sin sal…"></textarea></div>
            <div class="cat-filter" id="cat-filter">
              <div class="cat-chip active" onclick="filterCat(null,this)">Todos</div>
              ${(state.DB.menu?.categories || []).map(c => `<div class="cat-chip" onclick="filterCat('${c.id}',this)">${c.name}</div>`).join('')}
            </div>
            <div class="menu-grid" id="menu-grid">
              ${(state.DB.menu?.products || []).map(p => `
                <div class="menu-item-btn" data-cat="${p.categoryId}" onclick="addToOrder('${p.id}')">
                   <div class="mi-name">${p.name}</div>
                   <div class="mi-price">${fmt(getProductPrice(p.id, today()))}</div>
                </div>`).join('')}
            </div>
          </div>
          <div class="order-panel card">
            <h4 style="margin-bottom:11px;color:var(--navy)">Orden Actual</h4>
            <div class="order-items" id="order-items-list"><div class="empty-state" style="padding:18px"><span class="es-icon">🛒</span><p>Agrega items</p></div></div>
            <div class="divider"></div>
            <div id="order-total-section"></div>
            <div style="display:flex;flex-direction:column;gap:7px;margin-top:11px">
              <button class="btn btn-primary btn-full" onclick="confirmOrder('${tableId}')">✅ Confirmar Orden</button>
              ${orders.length > 0 ? `<button class="btn btn-coral btn-full" onclick="closeModal('modal-table');chargeTable('${tableId}')">💳 Cobrar Mesa Completa (${fmt(total)})</button>` : ''}
            </div>
          </div>
        </div>
      </div>`;
  }
  openModal('modal-table');
  buildSidebar(); renderMesas();
}

let activeCatFilter = null;
export function filterCat(catId, el) {
  activeCatFilter = catId;
  document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('#menu-grid .menu-item-btn').forEach(b => {
    b.style.display = (!catId || b.dataset.cat === catId) ? '' : 'none';
  });
}

export function addToOrder(productId) {
  const p = getProduct(productId); 
  if (!p) return;
  const price = getProductPrice(productId, today());
  const existing = state.orderDraft.items.find(i => i.productId === productId);
  if (existing) {
    existing.qty++;
  } else {
    state.orderDraft.items.push({ id: uid(), productId, name: p.name, qty: 1, price, note: '' });
  }
  renderDraftOrder();
}

export function renderDraftOrder() {
  const list = document.getElementById('order-items-list');
  const totSec = document.getElementById('order-total-section');
  if (!list) return;
  if (!state.orderDraft.items.length) {
    list.innerHTML = '<div class="empty-state" style="padding:18px"><span class="es-icon">🛒</span><p>Agrega items</p></div>';
    if (totSec) totSec.innerHTML = '';
    return;
  }
  list.innerHTML = state.orderDraft.items.map(i => `
    <div class="order-item-row">
      <div class="oir-qty">
        <button onclick="changeQty('${i.id}',-1)">−</button>
        <span style="min-width:18px;text-align:center">${i.qty}</span>
        <button onclick="changeQty('${i.id}',1)">+</button>
      </div>
      <div class="oir-name">${i.name}</div>
      <div class="oir-price">${fmt(i.qty * i.price)}</div>
    </div>`).join('');
  const t = state.orderDraft.items.reduce((s, i) => s + i.qty * i.price, 0);
  if (totSec) totSec.innerHTML = `<div class="order-total-row final"><span>Total</span><span>${fmt(t)}</span></div>`;
}

export function changeQty(itemId, delta) {
  const idx = state.orderDraft.items.findIndex(i => i.id === itemId); 
  if (idx < 0) return;
  state.orderDraft.items[idx].qty += delta;
  if (state.orderDraft.items[idx].qty <= 0) {
    state.orderDraft.items.splice(idx, 1);
  }
  renderDraftOrder();
}

export async function confirmOrder(tableId) {
  if (!state.orderDraft.items.length) { alert('Agrega al menos un producto'); return; }
  
  const table = getTable(tableId);
  const tableName = table ? table.name : '';
  const rawClientInput = (document.getElementById('oc-client')?.value || '').trim();

  const normalize = (name) => {
    const n = (name || '').trim().toLowerCase();
    const t = tableName.toLowerCase();
    if (!n || n === 'mesa' || n === 'general' || n === 'table' || n === t) {
      return '';
    }
    return n;
  };

  const normalizedClient = normalize(rawClientInput);

  // Find if there is an active order for this table with the SAME normalized client name
  const existingOrder = state.DB.orders.find(o => 
    o.tableId === tableId && 
    normalize(o.clientName) === normalizedClient && 
    o.status !== 'paid' && 
    o.status !== 'cancelled'
  );

  if (existingOrder) {
    // Merge new items into existing order!
    state.orderDraft.items.forEach(draftItem => {
      const existingItem = existingOrder.items.find(i => i.productId === draftItem.productId);
      if (existingItem) {
        existingItem.qty += draftItem.qty;
      } else {
        existingOrder.items.push({ ...draftItem, itemStatus: 'pending' });
      }
    });
    // Append notes if there are new notes
    const notes = (document.getElementById('oc-notes')?.value || '').trim();
    if (notes) {
      existingOrder.notes = existingOrder.notes 
        ? existingOrder.notes + ' | ' + notes 
        : notes;
    }
    AuditLog.append('ORDER_UPDATED', { orderId: existingOrder.id, tableId, itemsCount: existingOrder.items.length, updatedBy: state.currentUser.username });
  } else {
    // Create new order card
    const order = {
      id: uid(), tableId, clientName: normalizedClient, notes: (document.getElementById('oc-notes')?.value || '').trim(),
      items: state.orderDraft.items.map(i => ({ ...i, itemStatus: 'pending' })),
      status: 'pending', createdBy: state.currentUser.id, createdAt: now()
    };
    state.DB.orders.push(order);
    AuditLog.append('ORDER_CREATED', { orderId: order.id, tableId, items: order.items.length, createdBy: state.currentUser.username });
  }

  await saveDB();
  showToast('✅ Orden confirmada');
  state.orderDraft = { items: [], clientName: '', notes: '' };
  closeModal('modal-table');
  openTable(tableId);
  buildSidebar(); renderMesas();
}

export function editOrderNotes(orderId) {
  const order = getOrder(orderId); 
  if (!order) return;
  const note = prompt('Notas de la orden:', order.notes || '');
  if (note !== null) { 
    order.notes = note; 
    saveDB(); 
    openTable(order.tableId); 
  }
}

export async function cancelOrderFromTable(orderId, tableId) {
  const order = getOrder(orderId); 
  if (!order) return;
  const reason = prompt('Motivo de cancelación (requerido):', '');
  if (reason === null) return;
  if (!reason.trim()) { alert('Debes ingresar un motivo'); return; }
  state.DB.deletedRecords.orders.push({ ...order, deletedAt: now(), deletedBy: state.currentUser.id, reason: reason.trim(), action: 'cancelled' });
  order.status = 'cancelled';
  AuditLog.append('ORDER_CANCELLED', { orderId, reason: reason.trim(), cancelledBy: state.currentUser.username });
  await saveDB();
  closeModal('modal-table'); 
  openTable(tableId); 
  buildSidebar(); renderMesas();
  showToast('Orden cancelada — auditoría registrada.');
}

export async function removeClient(tableId, clientName) {
  if (!isAdmin()) return;
  const reason = prompt(`Motivo para remover a ${clientName}:`, '');
  if (reason === null) return; 
  state.DB.orders.filter(o => o.tableId === tableId && o.clientName === clientName).forEach(o => {
    state.DB.deletedRecords.clients.push({
      clientName, tableId, orderId: o.id,
      removedAt: now(), removedBy: state.currentUser.id, reason,
      itemsSnapshot: (o.items || []).map(i => ({
        name: i.name, qty: i.qty, price: i.price, itemStatus: i.itemStatus || 'pending'
      })),
      orderNotes: o.notes || '',
      orderStatus: o.status,
      orderCreatedAt: o.createdAt,
      orderCreatedBy: o.createdBy
    });
    state.DB.orders = state.DB.orders.filter(x => x.id !== o.id);
  });
  AuditLog.append('CLIENT_REMOVED', { clientName, tableId, reason, removedBy: state.currentUser.username });
  await saveDB();
  closeModal('modal-table'); 
  openTable(tableId); 
  buildSidebar(); renderMesas();
}

/* ============================================================
   MODULE: COBRO
   ============================================================ */
export function chargeTable(tableId, preselectedClient) {
  const table  = getTable(tableId);
  const orders = tableOrders(tableId);
  const total  = tableTotal(tableId);
  closeModal('modal-table');
  const clients = [...new Set(orders.map(o => o.clientName).filter(Boolean))];
  const clientOptions = clients.map(c => {
    const ct = orders.filter(o => o.clientName === c).reduce((s, o) => s + orderTotal(o), 0);
    return `<option value="${c}" ${preselectedClient === c ? 'selected' : ''}>${c} (${fmt(ct)})</option>`;
  }).join('');

  const inner = document.getElementById('modal-charge-inner');
  if (inner) {
    inner.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">💳 Cobrar — ${table.name}</h3>
        <button class="modal-close" onclick="closeModal('modal-charge');openTable('${tableId}')">×</button>
      </div>
      <div class="modal-body">
        <div class="cards-grid" style="margin-bottom:14px">
          <div class="card card-accent-mint"><div class="card-title">Total Mesa</div><div class="card-value">${fmt(total)}</div></div>
          <div class="card card-accent-coral"><div class="card-title">Clientes</div><div class="card-value">${clients.length || 1}</div></div>
        </div>
        <div class="form-group"><label>Cobrar por</label>
          <select id="charge-by" onchange="updateChargeCalc()">
            <option value="table" ${!preselectedClient ? 'selected' : ''}>Toda la mesa</option>
            ${clientOptions ? `<optgroup label="Por cliente">${clientOptions}</optgroup>` : ''}
          </select>
        </div>
        <div class="form-group"><label>Método de pago</label>
          <select id="charge-method" onchange="updateChargeCalc()">
            <option value="cash">💵 Efectivo</option>
            <option value="card">💳 Tarjeta (+ comisión POS al cliente)</option>
            <option value="transfer">📱 Transferencia</option>
            <option value="credit">📋 Crédito</option>
          </select>
        </div>
        <div id="card-commission-section" style="display:none" class="form-group">
          <label>Comisión POS (%) — <span style="color:var(--coral);font-weight:700">se cobra al cliente; nosotros la pagamos después al banco</span></label>
          <input type="number" id="pos-commission" value="${state.DB.config.posCommission}" oninput="updateChargeCalc()" min="0" max="50" step="0.5">
        </div>
        <div id="charge-calc" class="card bg-gray mt-2"></div>
        <div class="form-group mt-3"><label>Notas del cobro</label><textarea id="charge-notes" placeholder="Observaciones…"></textarea></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('modal-charge');openTable('${tableId}')">Cancelar</button>
        <button class="btn btn-primary" onclick="processCharge('${tableId}')">Procesar Cobro</button>
      </div>`;
  }
  openModal('modal-charge');
  updateChargeCalc();
}

export function updateChargeCalc() {
  const method  = document.getElementById('charge-method')?.value;
  const chargeBy= document.getElementById('charge-by')?.value;
  const commSec = document.getElementById('card-commission-section');
  if (commSec) commSec.style.display = method === 'card' ? 'block' : 'none';
  
  const orders = tableOrders(state.selectedTableId);
  let subtotal = chargeBy && chargeBy !== 'table'
    ? orders.filter(o => o.clientName === chargeBy).reduce((s, o) => s + orderTotal(o), 0)
    : orders.reduce((s, o) => s + orderTotal(o), 0);
  let commission = 0, total = subtotal;
  if (method === 'card') {
    const rate = parseFloat(document.getElementById('pos-commission')?.value || 0) / 100;
    commission = subtotal * rate; 
    total = subtotal + commission;
  }
  const calc = document.getElementById('charge-calc');
  const clientLabel = chargeBy && chargeBy !== 'table' ? `<div class="order-total-row" style="color:var(--mint-dark)"><span>👤 Cliente</span><span><b>${chargeBy}</b></span></div>` : '';
  if (calc) {
    calc.innerHTML = `
      ${clientLabel}
      <div class="order-total-row"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
      ${commission > 0 ? `<div class="order-total-row"><span>Comisión POS</span><span>${fmt(commission)}</span></div>` : ''}
      <div class="order-total-row final"><span>TOTAL A COBRAR</span><span>${fmt(total)}</span></div>`;
  }
}

export async function processCharge(tableId) {
  try {
    const method   = document.getElementById('charge-method').value;
    const notes    = document.getElementById('charge-notes').value;
    const chargeBy = document.getElementById('charge-by').value;
    const allOrders= tableOrders(tableId);
    let ordersToCharge = chargeBy === 'table' ? allOrders : allOrders.filter(o => o.clientName === chargeBy);
    const subtotal = ordersToCharge.reduce((s, o) => s + orderTotal(o), 0);
    let commission = 0, total = subtotal;
    if (method === 'card') {
      const rate = parseFloat(document.getElementById('pos-commission').value || 0) / 100;
      commission = subtotal * rate; 
      total = subtotal + commission;
    }
    const saleId = uid();
    const clientLabel = chargeBy !== 'table' ? chargeBy : (ordersToCharge[0]?.clientName || null);
    const sale = {
      id: saleId, tableId, ordersSnapshot: ordersToCharge.map(o => ({ ...o, items: [...o.items] })),
      paymentMethod: method, subtotal, commission, total, notes, clientName: clientLabel,
      createdBy: state.currentUser.id, date: now()
    };
    state.DB.sales.push(sale);
    
    if (method === 'cash') {
      state.DB.cashFlow.currentCash += total;
    } else if (['transfer', 'card'].includes(method)) {
      state.DB.cashFlow.bankBalance += total;
    } else if (method === 'credit') {
      state.DB.credits.push({ id: uid(), saleId, clientName: clientLabel || 'Cliente', amount: total, paid: false, payments: [], date: now() });
    }
    ordersToCharge.forEach(o => { o.status = 'paid'; });
    const allSoldItems = ordersToCharge.flatMap(o => o.items.map(i => ({ productId: i.productId, qty: i.qty })));
    await deductInventoryForSale(allSoldItems);
    addJournalEntry('Venta', method, total, saleId);
    AuditLog.append('SALE_PROCESSED', { saleId, tableId, total, method, createdBy: state.currentUser.username, clientName: clientLabel });
    await saveDB();
    closeModal('modal-charge');
    buildSidebar(); renderMesas();
    showReceipt(sale);
    renderPage(state.currentPage);
  } catch (e) {
    ErrorHandler.log('processCharge error', e);
    showToast('⚠️ Error al procesar cobro', 4000);
  }
}

export function addJournalEntry(desc, method, amount, refId) {
  const entry = { id: uid(), date: now(), desc: `${desc} #${refId}`, debit: 0, credit: 0, refId };
  if (['cash', 'transfer', 'card', 'credit'].includes(method)) { 
    entry.debit = amount; 
    entry.desc += ` (${method})`; 
  }
  entry.credit = amount;
  state.DB.accounting.journal.push(entry);
}

export function buildReceiptHTML(sale, format) {
  format = format || 'thermal80';
  const table = getTable(sale.tableId);
  const seller = state.DB.users.find(u => u.id === sale.createdBy);
  const items = sale.ordersSnapshot.flatMap(o => o.items);
  const isPartial = !!sale.clientName;
  const receiptNo = sale.id.slice(-8).toUpperCase();
  const grouped = {};
  items.forEach(i => {
    const k = i.name + '|' + i.price;
    if (!grouped[k]) grouped[k] = { name: i.name, price: i.price, qty: 0 };
    grouped[k].qty += i.qty;
  });
  const groupedItems = Object.values(grouped);
  const cur = state.DB.config.currency || 'Q';

  const fmts = {
    thermal80: {
      pageSize: '80mm auto',
      bodyWidth: '302px',
      bodyPad: '8px 10px 16px',
      bodyFont: "'Courier New', Courier, monospace",
      fontSize: '11px',
      logoSize: '72px',
      bizNameSize: '16px',
      metaSize: '9.5px',
      itemSize: '10.5px',
      totalSize: '13px',
      footerSize: '9.5px',
      label: 'Impresora Térmica 80mm'
    },
    letter: {
      pageSize: 'letter portrait',
      bodyWidth: '680px',
      bodyPad: '40px 60px',
      bodyFont: "'Segoe UI', Arial, sans-serif",
      fontSize: '13px',
      logoSize: '90px',
      bizNameSize: '22px',
      metaSize: '12px',
      itemSize: '13px',
      totalSize: '16px',
      footerSize: '11px',
      label: 'Carta (Letter)'
    },
    a4: {
      pageSize: 'A4 portrait',
      bodyWidth: '700px',
      bodyPad: '36px 56px',
      bodyFont: "'Segoe UI', Arial, sans-serif",
      fontSize: '13px',
      logoSize: '90px',
      bizNameSize: '22px',
      metaSize: '12px',
      itemSize: '13px',
      totalSize: '16px',
      footerSize: '11px',
      label: 'A4'
    }
  };
  const f = fmts[format] || fmts.thermal80;
  const isThermal = format === 'thermal80';
  const dashedBorder = isThermal ? '2px dashed #000' : '2px solid #ccc';
  const companyName = state.DB.config?.companyName || 'Restar Chach App';
const logoUrl = state.DB.config?.logoUrl || './logo-blanco.png';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Recibo — ${companyName}</title>
<style>
  @page { size: ${f.pageSize}; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: ${f.bodyFont};
    font-size: ${f.fontSize};
    color: #000; background: #fff;
    width: ${f.bodyWidth};
    padding: ${f.bodyPad};
  }
  .logo-wrap {
    text-align: center;
    padding: ${isThermal ? '8px 0 6px' : '16px 0 12px'};
    border-bottom: ${dashedBorder};
    margin-bottom: ${isThermal ? '8px' : '14px'};
  }
  .logo-img {
    width: ${f.logoSize}; height: ${f.logoSize};
    border-radius: 50%; object-fit: cover;
    display: block; margin: 0 auto ${isThermal ? '6px' : '10px'};
    ${!isThermal ? 'border: 3px solid #eee;' : ''}
  }
  .biz-name {
    font-size: ${f.bizNameSize}; font-weight: 900;
    letter-spacing: 1px; text-transform: uppercase;
    font-family: ${isThermal ? 'Arial Black, Arial, sans-serif' : 'inherit'};
  }
  .biz-sub { font-size: ${isThermal ? '9px' : '11px'}; color: #555; margin-top: 2px; }
  .receipt-meta {
    font-size: ${f.metaSize}; color: #333;
    margin-bottom: ${isThermal ? '8px' : '14px'};
    border-bottom: 1px dashed #aaa;
    padding-bottom: ${isThermal ? '6px' : '10px'};
    ${!isThermal ? 'display:grid; grid-template-columns:1fr 1fr; gap:3px 20px;' : ''}
  }
  .receipt-meta div { margin: ${isThermal ? '1.5px' : '3px'} 0; }
  .meta-label { font-weight: 700; }
  .client-box {
    background: #000; color: #fff;
    padding: ${isThermal ? '4px 8px' : '8px 14px'};
    margin-bottom: ${isThermal ? '8px' : '12px'};
    font-weight: 700; font-size: ${isThermal ? '10px' : '13px'};
    text-align: center; border-radius: ${isThermal ? '3px' : '6px'};
  }
  .section-title {
    font-size: ${isThermal ? '9px' : '10px'}; font-weight: 700;
    text-transform: uppercase; letter-spacing: 1px;
    border-bottom: 1px solid #000;
    padding-bottom: 2px; margin-bottom: ${isThermal ? '5px' : '8px'}; color: #555;
  }
  .item-header {
    display: flex; justify-content: space-between;
    font-size: ${isThermal ? '8px' : '10px'}; color: #777; font-weight: 700;
    text-transform: uppercase; letter-spacing: .5px;
    margin-bottom: 3px; padding-bottom: 2px;
    border-bottom: 1px dotted #ccc;
  }
  .item-row {
    display: flex; justify-content: space-between;
    align-items: flex-start;
    padding: ${isThermal ? '2.5px' : '5px'} 0;
    font-size: ${f.itemSize};
    border-bottom: ${isThermal ? 'none' : '1px dotted #eee'};
  }
  .item-name { flex: 1; padding-right: 4px; line-height: 1.3; }
  .item-qty { font-weight: 700; min-width: 22px; text-align: right; }
  .item-unit { min-width: ${isThermal ? '50px' : '70px'}; text-align: right; color: #555; }
  .item-total { min-width: ${isThermal ? '52px' : '70px'}; text-align: right; font-weight: 700; }
  .totals {
    border-top: ${dashedBorder};
    padding-top: ${isThermal ? '6px' : '10px'};
    margin-top: ${isThermal ? '6px' : '10px'};
    ${!isThermal ? 'max-width:300px; margin-left:auto;' : ''}
  }
  .total-row {
    display: flex; justify-content: space-between;
    font-size: ${isThermal ? '10.5px' : '13px'};
    padding: ${isThermal ? '2px' : '4px'} 0;
  }
  .total-row.grand {
    font-size: ${f.totalSize}; font-weight: 900;
    border-top: 1px solid #000; border-bottom: 2px solid #000;
    margin: ${isThermal ? '4px' : '6px'} 0;
    padding: ${isThermal ? '4px' : '6px'} 0;
    font-family: ${isThermal ? 'Arial Black, Arial, sans-serif' : 'inherit'};
  }
  .commission-note { font-size: ${isThermal ? '8.5px' : '10px'}; color: #666; font-style: italic; text-align: right; margin-bottom: 4px; }
  .payment-box {
    background: #f0f0f0; border: 1px solid #ccc;
    border-radius: ${isThermal ? '4px' : '8px'};
    padding: ${isThermal ? '5px 8px' : '10px 14px'};
    margin-top: ${isThermal ? '8px' : '14px'};
    font-size: ${isThermal ? '10px' : '12px'};
    ${!isThermal ? 'display:flex; justify-content:space-between; align-items:center;' : ''}
  }
  .payment-box .method { font-size: ${isThermal ? '12px' : '15px'}; font-weight: 900; text-transform: uppercase; }
  .separator { text-align: center; font-size: ${isThermal ? '8px' : '10px'}; color: #aaa; margin: ${isThermal ? '8px' : '12px'} 0 ${isThermal ? '6px' : '10px'}; letter-spacing: 2px; }
  .footer {
    text-align: center;
    margin-top: ${isThermal ? '8px' : '16px'};
    border-top: ${dashedBorder};
    padding-top: ${isThermal ? '8px' : '14px'};
    font-size: ${f.footerSize}; color: #333; line-height: 1.6;
  }
  .footer .gracias { font-size: ${isThermal ? '12px' : '18px'}; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
  .receipt-no { font-size: ${isThermal ? '8.5px' : '10px'}; color: #888; text-align: center; margin-top: 4px; letter-spacing: 1px; }
  @media print {
    @page { size: ${f.pageSize}; margin: 0; }
    body { padding: ${isThermal ? '4px 6px 10px' : f.bodyPad}; }
  }
</style>
</head>
<body>
  <div class="logo-wrap">
    <img src="${logoUrl}" class="logo-img" alt="Restar Chach App">
    <div class="biz-name">${companyName}</div>
    <div class="biz-sub">San Juan la Laguna, Sololá</div>
    <div class="biz-sub">Restaurante</div>
    ${!isThermal ? `<div style="font-size:11px;color:#aaa;margin-top:4px">Formato: ${f.label}</div>` : ''}
  </div>

  <div class="receipt-meta">
    <div><span class="meta-label">Recibo # </span>${receiptNo}</div>
    <div><span class="meta-label">Fecha: </span>${sale.date ? new Date(sale.date).toLocaleDateString('es-GT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</div>
    <div><span class="meta-label">Hora: </span>${sale.date ? new Date(sale.date).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}</div>
    <div><span class="meta-label">Mesa: </span>${table?.name || '—'}</div>
    <div><span class="meta-label">Atendido por: </span>${seller?.username || state.currentUser.username}</div>
    <div><span class="meta-label">Tipo: </span>${isPartial ? 'Cuenta separada' : 'Cuenta completa'}</div>
  </div>

  ${isPartial ? `<div class="client-box">👤 CUENTA DE: ${sale.clientName.toUpperCase()}</div>` : ''}

  <div class="section-title">Detalle de Consumo</div>
  <div class="item-header">
    <span style="flex:1">Descripción</span>
    <span style="min-width:22px;text-align:right">Cant</span>
    <span style="min-width:${isThermal ? '50' : '70'}px;text-align:right">Precio</span>
    <span style="min-width:${isThermal ? '52' : '70'}px;text-align:right">Importe</span>
  </div>
  ${groupedItems.map(i => `
    <div class="item-row">
      <span class="item-name">${i.name}</span>
      <span class="item-qty">${i.qty}</span>
      <span class="item-unit">${cur} ${i.price.toFixed(2)}</span>
      <span class="item-total">${cur} ${(i.qty * i.price).toFixed(2)}</span>
    </div>`).join('')}

  <div class="totals">
    <div class="total-row"><span>Subtotal</span><span>${fmt(sale.subtotal)}</span></div>
    ${sale.commission > 0 ? `
    <div class="total-row">
      <span>Comisión POS tarjeta (${state.DB.config.posCommission || 3.5}%)</span>
      <span>${fmt(sale.commission)}</span>
    </div>
    <div class="commission-note">* El banco nos cobra esta comisión; se traslada al cliente.</div>` : ''}
    <div class="total-row grand"><span>TOTAL</span><span>${fmt(sale.total)}</span></div>
  </div>

  <div class="payment-box">
    <div>
      <div class="method">${methodLabel(sale.paymentMethod)}</div>
      <div style="font-size:${isThermal ? '9' : '11'}px;color:#666;margin-top:2px">Método de pago</div>
    </div>
    ${sale.paymentMethod === 'credit' ? `<div style="font-size:${isThermal ? '9' : '11'}px;color:#c00;font-weight:700">⚠️ CRÉDITO — pendiente de cobro</div>` : ''}
  </div>

  ${sale.notes ? `<div class="separator">— NOTAS —</div><div style="font-size:${isThermal ? '10' : '12'}px;padding:3px 0">${sale.notes}</div>` : ''}

  <div class="separator">- - - - - - - - - - - - - - - - -</div>
  <div class="footer">
    <div class="gracias">¡Gracias por su visita!</div>
    <div style="margin-top:4px">Vuelva pronto ☕</div>
    <div style="margin-top:5px">${companyName}<br>Síguenos en Instagram y Facebook</div>
    <div class="receipt-no">Folio: ${receiptNo} · v${APP_VERSION}</div>
  </div>
</body>
</html>`;
}

export function showReceipt(sale) {
  const isPartial = !!sale.clientName;
  window._currentReceiptSale = sale;
  window._currentReceiptFormat = 'thermal80';

  function rebuildPreview(fmt) {
    window._currentReceiptFormat = fmt;
    const iframeEl = document.getElementById('receipt-iframe');
    if (!iframeEl) return;
    const doc = iframeEl.contentDocument || iframeEl.contentWindow.document;
    doc.open(); 
    doc.write(buildReceiptHTML(sale, fmt)); 
    doc.close();
    setTimeout(() => {
      try {
        const h = doc.body.scrollHeight;
        iframeEl.style.height = (Math.min(h + 20, fmt === 'thermal80' ? 800 : 1050)) + 'px';
      } catch (e) {}
    }, 250);
    ['thermal80', 'letter', 'a4'].forEach(f => {
      const btn = document.getElementById('fmt-btn-' + f);
      if (btn) {
        btn.style.background = f === fmt ? 'var(--mint-dark)' : 'var(--g100)';
        btn.style.color = f === fmt ? '#fff' : 'var(--g800)';
      }
    });
  }
  window._rebuildReceiptPreview = rebuildPreview;

  const inner = document.getElementById('modal-receipt-inner');
  if (inner) {
    inner.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">🧾 Comprobante${isPartial ? ' (Cuenta Separada)' : ''}</h3>
        <button class="modal-close" onclick="closeModal('modal-receipt')">×</button>
      </div>
      <div class="modal-body" style="padding:12px">
        <div style="background:var(--g50);border-radius:8px;padding:12px;margin-bottom:12px">
          <div style="font-size:.8rem;font-weight:700;color:var(--g600);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">📄 Formato de impresión / PDF</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button id="fmt-btn-thermal80" onclick="_rebuildReceiptPreview('thermal80')"
              style="background:var(--mint-dark);color:#fff;border:none;border-radius:7px;padding:7px 14px;cursor:pointer;font-size:.82rem;font-weight:700;transition:.15s">
              🖨️ Térmica 80mm
            </button>
            <button id="fmt-btn-letter" onclick="_rebuildReceiptPreview('letter')"
              style="background:var(--g100);color:var(--g800);border:none;border-radius:7px;padding:7px 14px;cursor:pointer;font-size:.82rem;font-weight:700;transition:.15s">
              📄 Carta (Letter)
            </button>
            <button id="fmt-btn-a4" onclick="_rebuildReceiptPreview('a4')"
              style="background:var(--g100);color:var(--g800);border:none;border-radius:7px;padding:7px 14px;cursor:pointer;font-size:.82rem;font-weight:700;transition:.15s">
              📋 A4
            </button>
          </div>
          <div style="font-size:.75rem;color:var(--g400);margin-top:7px">
            💡 Seleccioná el formato que coincida con tu impresora o el tamaño de PDF que quieras compartir.
          </div>
        </div>
        <div style="display:flex;justify-content:center;overflow:auto">
          <div style="border:1px solid #ddd;border-radius:6px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.1)">
            <iframe id="receipt-iframe" style="width:340px;height:600px;border:none" scrolling="yes"></iframe>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('modal-receipt')">Cerrar</button>
        <button class="btn btn-gold" onclick="shareReceiptPDF()">📤 Compartir / PDF</button>
        <button class="btn btn-primary" onclick="printReceipt()">🖨️ Imprimir</button>
      </div>`;
  }
  openModal('modal-receipt');
  rebuildPreview('thermal80');
}

export function printReceipt() {
  const sale = window._currentReceiptSale;
  const fmt  = window._currentReceiptFormat || 'thermal80';
  if (!sale) return;
  const w = window.open('', '_blank', 'width=480,height=750');
  w.document.write(buildReceiptHTML(sale, fmt));
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 350);
}

export function shareReceiptPDF() {
  const sale = window._currentReceiptSale;
  const fmt  = window._currentReceiptFormat || 'thermal80';
  if (!sale) return;
  const w = window.open('', '_blank', 'width=480,height=750');
  w.document.write(buildReceiptHTML(sale, fmt));
  w.document.close();
  w.focus();
  const fmtLabel = { thermal80: '80mm', letter: 'Carta', a4: 'A4' }[fmt] || fmt;
  showToast(`💡 Para guardar como PDF: Ctrl+P → "Guardar como PDF" → Tamaño ${fmtLabel}`, 6000);
}

// Bind to window for global inline HTML onclick handlers
window.openTable = openTable;
window.filterCat = filterCat;
window.addToOrder = addToOrder;
window.changeQty = changeQty;
window.confirmOrder = confirmOrder;
window.editOrderNotes = editOrderNotes;
window.cancelOrderFromTable = cancelOrderFromTable;
window.removeClient = removeClient;
window.chargeTable = chargeTable;
window.updateChargeCalc = updateChargeCalc;
window.processCharge = processCharge;
window.printReceipt = printReceipt;
window.shareReceiptPDF = shareReceiptPDF;
window.selectClientForNewOrder = selectClientForNewOrder;
window.reopenReceipt = reopenReceipt;
window.showReceipt = showReceipt;
