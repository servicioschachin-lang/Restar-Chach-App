import { state } from '../services/state.js';
import { saveDB } from '../services/database.js';
import { AuditLog } from '../services/audit.js';
import { 
  now, today, uid, fmt, fmtDate, fmtDateOnly, isAdmin, 
  getTable, methodColor, methodLabel 
} from '../services/utils.js';

/* ============================================================
   MODULE: MOVIMIENTOS
   ============================================================ */
let currentMovTab = 'sales';

export function renderMovimientos() {
  const page = document.getElementById('page-movimientos');
  if (!page) return;
  const todaySales = state.DB.sales.filter(s => s.date.startsWith(today()));
  const todayExp   = state.DB.expenses.filter(e => e.date.startsWith(today()));
  const totalSales = todaySales.reduce((s, x) => s + x.total, 0);
  const totalExp   = todayExp.reduce((s, x) => s + x.amount, 0);
  
  page.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Movimientos</h1><p class="page-subtitle">Ventas, egresos y caja del día</p></div>
      <div style="display:flex;gap:7px;flex-wrap:wrap">
        <button class="btn btn-sm btn-secondary" onclick="openExpenseModal()">➕ Egreso</button>
        ${isAdmin() ? `<button class="btn btn-sm btn-primary" onclick="switchAdminToReports()">📊 Reportes</button>` : ''}
      </div>
    </div>
    <div class="cards-grid">
      <div class="card card-accent-mint"><div class="card-title">Ventas Hoy</div><div class="card-value">${fmt(totalSales)}</div><div class="card-sub">${todaySales.length} transacciones</div></div>
      <div class="card card-accent-coral"><div class="card-title">Egresos Hoy</div><div class="card-value">${fmt(totalExp)}</div></div>
      <div class="card card-accent-gold"><div class="card-title">Balance Hoy</div><div class="card-value" style="${totalSales - totalExp >= 0 ? 'color:var(--mint-dark)' : 'color:var(--coral)'}">${fmt(totalSales - totalExp)}</div></div>
      ${isAdmin() ? `<div class="card card-accent-navy"><div class="card-title">Caja Efectivo</div><div class="card-value">${fmt(state.DB.cashFlow.currentCash)}</div></div>` : ''}
    </div>
    <div class="mov-tabs">
      <button class="mov-tab active" onclick="switchMovTab('sales',this)">💰 Ventas</button>
      <button class="mov-tab" onclick="switchMovTab('expenses',this)">🛒 Egresos</button>
      ${isAdmin() ? `<button class="mov-tab" onclick="switchMovTab('cashflow',this)">🏦 Caja</button>` : ''}
      ${isAdmin() ? `<button class="mov-tab" onclick="switchMovTab('credits',this)">📋 Créditos</button>` : ''}
    </div>
    <div id="mov-tab-content"></div>`;
  showMovTab('sales');
}

export function switchMovTab(tab, btn) {
  document.querySelectorAll('.mov-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  showMovTab(tab);
}

export function showMovTab(tab) {
  currentMovTab = tab;
  const el = document.getElementById('mov-tab-content'); 
  if (!el) return;
  if (tab === 'sales') {
    const sales = isAdmin() ? state.DB.sales : state.DB.sales.filter(s => s.createdBy === state.currentUser.id);
    const ts = sales.filter(s => s.date.startsWith(today()));
    el.innerHTML = `
      <div class="table-wrap"><table>
        <thead><tr><th>Fecha</th><th>Mesa</th><th>Cliente</th><th>Total</th><th>Método</th><th>Vendedor</th><th>Acciones</th></tr></thead>
        <tbody>
          ${!ts.length ? `<tr><td colspan="7" style="text-align:center;padding:28px;color:var(--g400)">Sin ventas hoy</td></tr>` : ''}
          ${ts.map(s => {
            const tbl = getTable(s.tableId);
            const sel = state.DB.users.find(u => u.id === s.createdBy);
            return `<tr>
              <td>${fmtDate(s.date)}</td><td>${tbl?.name || '—'}</td>
              <td>${s.clientName ? `<span class="client-tag">${s.clientName}</span>` : '<span style="color:var(--g400)">Mesa</span>'}</td>
              <td class="font-bold text-mint">${fmt(s.total)}</td>
              <td><span class="tag" style="background:${methodColor(s.paymentMethod).bg};color:${methodColor(s.paymentMethod).fg}">${methodLabel(s.paymentMethod)}</span></td>
              <td>${sel?.username || '—'}</td>
              <td>
                <button class="btn btn-xs btn-secondary" onclick="showSaleReceipt('${s.id}')">🧾 Ver</button>
                ${isAdmin() ? `<button class="btn btn-xs btn-danger" onclick="deleteSale('${s.id}')">Borrar</button>` : ''}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>`;
  } else if (tab === 'expenses') {
    const exp = (isAdmin() ? state.DB.expenses : state.DB.expenses.filter(e => e.createdBy === state.currentUser.id)).filter(e => e.date.startsWith(today()));
    el.innerHTML = `
      <div class="table-wrap"><table>
        <thead><tr><th>Fecha</th><th>Descripción</th><th>Monto</th><th>Vendedor</th><th>Foto</th><th>Acc.</th></tr></thead>
        <tbody>
          ${!exp.length ? `<tr><td colspan="6" style="text-align:center;padding:28px;color:var(--g400)">Sin egresos hoy</td></tr>` : ''}
          ${exp.map(e => {
            const sel = state.DB.users.find(u => u.id === e.createdBy);
            return `<tr>
              <td>${fmtDate(e.date)}</td><td>${e.description}</td>
              <td class="text-coral font-bold">${fmt(e.amount)}</td>
              <td>${sel?.username || '—'}</td>
              <td>${e.photo ? `<img src="${e.photo}" style="width:38px;height:38px;object-fit:cover;border-radius:4px;cursor:pointer" onclick="viewPhoto('${e.photo}')">` : '-'}</td>
              <td>${isAdmin() ? `<button class="btn btn-xs btn-danger" onclick="deleteExpense('${e.id}')">Borrar</button>` : ''}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>`;
  } else if (tab === 'cashflow' && isAdmin()) {
    const allS = state.DB.sales, allE = state.DB.expenses;
    const tIn  = allS.reduce((s, x) => s + x.total, 0);
    const tOut = allE.reduce((s, x) => s + x.amount, 0);
    el.innerHTML = `
      <div class="cards-grid">
        <div class="card card-accent-mint"><div class="card-title">Total Ventas</div><div class="card-value">${fmt(tIn)}</div></div>
        <div class="card card-accent-coral"><div class="card-title">Total Egresos</div><div class="card-value">${fmt(tOut)}</div></div>
        <div class="card card-accent-gold"><div class="card-title">Efectivo en Caja</div><div class="card-value">${fmt(state.DB.cashFlow.currentCash)}</div></div>
        <div class="card card-accent-navy"><div class="card-title">Saldo Bancario</div><div class="card-value">${fmt(state.DB.cashFlow.bankBalance)}</div></div>
      </div>
      <div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:14px">
        <button class="btn btn-sm btn-primary" onclick="openCashCut()">✂️ Corte de Caja</button>
        <button class="btn btn-sm btn-secondary" onclick="openCashAdjust()">💰 Ajustar Saldo</button>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Fecha</th><th>Descripción</th><th>Ingreso</th><th>Egreso</th></tr></thead>
        <tbody>
          ${[...allS.map(s => ({ date: s.date, desc: `Venta ${getTable(s.tableId)?.name || ''}`, income: s.total, expense: 0 })),
             ...allE.map(e => ({ date: e.date, desc: e.description, income: 0, expense: e.amount }))
            ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 50).map(r => `
            <tr><td>${fmtDate(r.date)}</td><td>${r.desc}</td>
              <td class="text-mint">${r.income > 0 ? fmt(r.income) : ''}</td>
              <td class="text-coral">${r.expense > 0 ? fmt(r.expense) : ''}</td>
            </tr>`).join('')}
        </tbody>
      </table></div>`;
  } else if (tab === 'credits' && isAdmin()) {
    el.innerHTML = `
      <div class="table-wrap"><table>
        <thead><tr><th>Fecha</th><th>Cliente</th><th>Monto</th><th>Estado</th><th>Pagado</th><th>Acc.</th></tr></thead>
        <tbody>
          ${!state.DB.credits.length ? `<tr><td colspan="6" style="text-align:center;padding:28px;color:var(--g400)">Sin créditos</td></tr>` : ''}
          ${state.DB.credits.map(c => {
            const paid = c.payments.reduce((s, p) => s + p.amount, 0);
            return `<tr>
              <td>${fmtDateOnly(c.date)}</td><td>${c.clientName}</td>
              <td class="font-bold">${fmt(c.amount)}</td>
              <td><span class="status ${c.paid ? 'status-paid' : 'status-credit'}">${c.paid ? 'Pagado' : 'Pendiente'}</span></td>
              <td>${fmt(paid)}</td>
              <td>${!c.paid ? `<button class="btn btn-xs btn-primary" onclick="payCredit('${c.id}')">💰 Abonar</button>` : ''}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>`;
  }
}

export function showSaleReceipt(saleId) { 
  const s = state.DB.sales.find(x => x.id === saleId); 
  if (s && window.showReceipt) {
    window.showReceipt(s); 
  }
}

export async function deleteSale(saleId) {
  if (!isAdmin()) return;
  const sale = state.DB.sales.find(s => s.id === saleId); 
  if (!sale) return;
  if (!confirm('¿Eliminar esta venta?')) return;
  if (sale.paymentMethod === 'cash') {
    state.DB.cashFlow.currentCash -= sale.total;
  } else if (['transfer', 'card'].includes(sale.paymentMethod)) {
    state.DB.cashFlow.bankBalance -= sale.total;
  }
  state.DB.deletedRecords.salesItems = state.DB.deletedRecords.salesItems || [];
  state.DB.deletedRecords.salesItems.push({ ...sale, deletedAt: now(), deletedBy: state.currentUser.id });
  state.DB.sales = state.DB.sales.filter(s => s.id !== saleId);
  AuditLog.append('SALE_DELETED', { saleId, total: sale.total, method: sale.paymentMethod, deletedBy: state.currentUser.username });
  await saveDB(); 
  showMovTab(currentMovTab); 
  if (window.showToast) window.showToast('Venta eliminada');
}

export async function deleteExpense(expId) {
  if (!isAdmin()) return;
  const exp = state.DB.expenses.find(e => e.id === expId);
  if (!confirm('¿Eliminar este egreso?')) return;
  if (exp) {
    state.DB.cashFlow.currentCash += exp.amount;
  }
  state.DB.expenses = state.DB.expenses.filter(e => e.id !== expId);
  AuditLog.append('EXPENSE_DELETED', { expId, deletedBy: state.currentUser.username });
  await saveDB(); 
  showMovTab(currentMovTab); 
  if (window.showToast) window.showToast('Egreso eliminado');
}

export async function payCredit(creditId) {
  const credit = state.DB.credits.find(c => c.id === creditId); 
  if (!credit) return;
  const paid = credit.payments.reduce((s, p) => s + p.amount, 0);
  const remaining = credit.amount - paid;
  const amount = parseFloat(prompt(`Monto a abonar (pendiente: ${fmt(remaining)}):`, ''));
  if (isNaN(amount) || amount <= 0) return;
  credit.payments.push({ amount: Math.min(amount, remaining), date: now() });
  const newPaid = credit.payments.reduce((s, p) => s + p.amount, 0);
  if (newPaid >= credit.amount) credit.paid = true;
  state.DB.cashFlow.currentCash += Math.min(amount, remaining);
  await saveDB(); 
  showMovTab('credits');
}

export function switchAdminToReports() { 
  if (window.navigateTo) {
    window.navigateTo('admin'); 
    setTimeout(() => {
      if (window.switchAdminTab) window.switchAdminTab('reports', null);
    }, 100);
  }
}

export function openCashCut() {
  const tS = state.DB.sales.filter(s => s.date.startsWith(today())).reduce((s, x) => s + x.total, 0);
  const tE = state.DB.expenses.filter(e => e.date.startsWith(today())).reduce((s, x) => s + x.amount, 0);
  const inner = document.getElementById('modal-cashcut-inner');
  if (inner) {
    inner.innerHTML = `
      <div class="modal-header"><h3 class="modal-title">✂️ Corte de Caja</h3><button class="modal-close" onclick="closeModal('modal-cashcut')">×</button></div>
      <div class="modal-body">
        <div class="alert alert-info">Se archivará el día de hoy.</div>
        <div class="card bg-gray mb-3">
          <div class="order-total-row"><span>Ventas hoy</span><span>${fmt(tS)}</span></div>
          <div class="order-total-row"><span>Egresos hoy</span><span>${fmt(tE)}</span></div>
          <div class="order-total-row final"><span>Balance</span><span>${fmt(tS - tE)}</span></div>
        </div>
        <div class="form-group"><label>Caja para mañana</label><input type="number" id="cc-assign" value="0" min="0"></div>
        <div class="form-group"><label>Notas</label><textarea id="cc-notes"></textarea></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('modal-cashcut')">Cancelar</button>
        <button class="btn btn-primary" onclick="processCashCut(${tS},${tE})">Archivar Corte</button>
      </div>`;
  }
  if (window.openModal) window.openModal('modal-cashcut');
}

export async function processCashCut(sales, exp) {
  const assign = parseFloat(document.getElementById('cc-assign').value) || 0;
  const notes  = document.getElementById('cc-notes').value;
  state.DB.cashFlow.dailyArchives.push({
    date: now(),
    totalSales: sales,
    totalExpenses: exp,
    assignedCash: assign,
    remaining: sales - exp - assign,
    previousCash: state.DB.cashFlow.currentCash,
    notes
  });
  state.DB.cashFlow.currentCash = assign;
  AuditLog.append('CASH_CUT', { sales, exp, assignedCash: assign, by: state.currentUser.username });
  await saveDB(); 
  if (window.closeModal) window.closeModal('modal-cashcut'); 
  showMovTab('cashflow'); 
  if (window.showToast) window.showToast('Corte archivado');
}

export function openCashAdjust() {
  const val = prompt(`Nuevo saldo de caja efectivo (actual: ${fmt(state.DB.cashFlow.currentCash)}):`);
  if (val !== null) { 
    state.DB.cashFlow.currentCash = parseFloat(val) || 0; 
    saveDB(); 
    showMovTab('cashflow'); 
  }
}

/* ============================================================
   MODULE: EXPENSE MODAL
   ============================================================ */
export function openExpenseModal() {
  const inner = document.getElementById('modal-expense-inner');
  if (inner) {
    inner.innerHTML = `
      <div class="modal-header"><h3 class="modal-title">➕ Registrar Egreso</h3><button class="modal-close" onclick="closeModal('modal-expense')">×</button></div>
      <div class="modal-body">
        <div class="form-group"><label>Descripción</label><input type="text" id="exp-desc" placeholder="Compra de camarón, etc…"></div>
        <div class="form-group"><label>Monto</label><input type="number" id="exp-amount" placeholder="0.00" min="0" step="0.01"></div>
        <div class="form-group">
          <label>Foto del comprobante (opcional)</label>
          <div class="photo-upload" onclick="document.getElementById('exp-photo-input').click()">
            <span>📷 Click para subir foto</span>
            <input type="file" id="exp-photo-input" accept="image/*" style="display:none" onchange="previewPhoto(this,'exp-photo-preview')">
            <img id="exp-photo-preview" class="photo-preview" style="display:none">
          </div>
        </div>
        <div class="form-group"><label>Notas</label><textarea id="exp-notes" placeholder="Observaciones…"></textarea></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('modal-expense')">Cancelar</button>
        <button class="btn btn-coral" onclick="saveExpense()">Guardar Egreso</button>
      </div>`;
  }
  if (window.openModal) window.openModal('modal-expense');
}

export function previewPhoto(input, previewId) {
  const file = input.files[0]; 
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.getElementById(previewId);
    if (img) { 
      img.src = e.target.result; 
      img.style.display = 'block'; 
    }
    input._base64 = e.target.result;
  };
  reader.readAsDataURL(file);
}

export async function saveExpense() {
  const desc   = document.getElementById('exp-desc').value.trim();
  const amount = parseFloat(document.getElementById('exp-amount').value);
  if (!desc || isNaN(amount) || amount <= 0) { alert('Completa descripción y monto'); return; }
  const photo = document.getElementById('exp-photo-input')._base64 || null;
  const exp = {
    id: uid(),
    description: desc,
    amount,
    photo,
    notes: document.getElementById('exp-notes').value,
    createdBy: state.currentUser.id,
    date: now()
  };
  state.DB.expenses.push(exp);
  state.DB.cashFlow.currentCash -= amount;
  AuditLog.append('EXPENSE_CREATED', { expId: exp.id, description: desc, amount, createdBy: state.currentUser.username });
  await saveDB(); 
  if (window.closeModal) window.closeModal('modal-expense'); 
  if (window.showToast) window.showToast('Egreso registrado'); 
  renderMovimientos();
}

export function viewPhoto(src) {
  const w = window.open('', '_blank'); 
  if (w) {
    w.document.write(`<html><body style="margin:0"><img src="${src}" style="max-width:100%"></body></html>`);
  }
}

// Bind to window for global inline HTML onclick handlers
window.renderMovimientos = renderMovimientos;
window.switchMovTab = switchMovTab;
window.showMovTab = showMovTab;
window.showSaleReceipt = showSaleReceipt;
window.deleteSale = deleteSale;
window.deleteExpense = deleteExpense;
window.payCredit = payCredit;
window.switchAdminToReports = switchAdminToReports;
window.openCashCut = openCashCut;
window.processCashCut = processCashCut;
window.openCashAdjust = openCashAdjust;
window.openExpenseModal = openExpenseModal;
window.previewPhoto = previewPhoto;
window.saveExpense = saveExpense;
window.viewPhoto = viewPhoto;
