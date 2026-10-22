import { state } from '../services/state.js';
import { saveDB } from '../services/database.js';
import { isAdmin, tableOrders, tableTotal, today, uid, now } from '../services/utils.js';

// We will statically import render functions for each page
import { renderMesas } from './tables.js';
import { renderOrdenes } from './orders.js';
import { renderMovimientos } from './movimientos.js';
import { renderAdmin } from './admin.js';

/* ============================================================
   MODULE: UI MANAGEMENT
   ============================================================ */

export function showApp() {
  const appEl = document.getElementById('app');
  if (appEl) appEl.style.display = 'flex';
  applyDarkMode();
  buildNav(); 
  buildSidebar(); 
  navigateTo('mesas');
  if (!localStorage.getItem('restar_onboarding_seen')) {
    openModal('modal-onboarding');
  }
}

export function markAttendance() {
  const t = today();
  const exists = state.DB.attendance.find(a => a.userId === state.currentUser.id && a.date === t);
  if (!exists) {
    state.DB.attendance.push({ id: uid(), userId: state.currentUser.id, date: t, ts: now() });
    saveDB();
  }
}

const icons = {
  mesas: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 20h8M12 18v2"/></svg>',
  ordenes: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h6"/></svg>',
  movimientos: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  admin: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
};

export function buildNav() {
  const el = document.getElementById('sidebar-modules-inner');
  if (!el) return;
  const pages = [
    { id: 'mesas', label: 'Mesas', icon: icons.mesas },
    { id: 'ordenes', label: 'Órdenes', icon: icons.ordenes },
    { id: 'movimientos', label: 'Movimientos', icon: icons.movimientos },
    { id: 'menu', label: 'Menú', icon: icons.admin }
  ];
  if (isAdmin()) {
    pages.push({ id: 'admin', label: 'Administración', icon: icons.admin });
  }
  let html = pages.map(p => {
    const action = p.id === 'menu'
      ? "navigateTo('admin');setTimeout(function(){if(window.switchAdminTab)window.switchAdminTab('menu',null);},0);"
      : "navigateTo('" + p.id + "')";
    return `<div class="sidebar-item nav-module-item" id="nav-${p.id}" role="button" tabindex="0" onclick="${action}"><span class="nav-icon">${p.icon}</span><span>${p.label}</span></div>`;
  }).join('');
  if (isAdmin()) {
    const adminSubs = [
      { tab: 'menu', label: 'Menú' },
      { tab: 'inventory', label: 'Inventario' },
      { tab: 'recipes', label: 'Recetas' },
      { tab: 'workers', label: 'Trabajadores' },
      { tab: 'deleted', label: 'Borrados' },
      { tab: 'reports', label: 'Reportes' },
      { tab: 'backup', label: 'Respaldo' },
      { tab: 'accounting', label: 'Contabilidad' },
      { tab: 'audit', label: 'Auditoría' },
      { tab: 'config', label: 'Configuración' }
    ];
    html += `<div class="sidebar-title" style="margin-top:10px">Subsecciones</div>`;
    html += adminSubs.map(s =>
      `<div class="sidebar-item nav-admin-sub" role="button" tabindex="0" onclick="navigateTo('admin');setTimeout(function(){if(window.switchAdminTab)window.switchAdminTab('${s.tab}',null);},0);"><span class="nav-icon">${icons.admin}</span><span>${s.label}</span></div>`
    ).join('');
  }
  el.innerHTML = html;
}

export function closeMobileSidebars() {
  if (!window.matchMedia('(max-width:768px)').matches) return;
  const sm = document.getElementById('sidebar');
  const sx = document.getElementById('sidebar-modules');
  if (sm) sm.classList.remove('open');
  if (sx) sx.classList.remove('open');
}

export function navigateTo(page) {
  state.currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  
  const targetPage = document.getElementById('page-' + page);
  if (targetPage) targetPage.classList.add('active');
  
  document.querySelectorAll('.nav-module-item').forEach(b => b.classList.remove('active'));
  const nb = document.getElementById('nav-' + page); 
  if (nb) nb.classList.add('active');
  
  renderPage(page);
  closeMobileSidebars();
  showSectionTip(page);
}

const sectionTips = {
  mesas: 'Selecciona una mesa, agrega productos y confirma la orden.',
  ordenes: 'Revisa y gestiona las órdenes activas.',
  movimientos: 'Consulta ventas, gastos, caja y reportes.',
  admin: 'Administra menú, inventario, trabajadores y configuración.'
};

function showSectionTip(page) {
  if (!localStorage.getItem('restar_onboarding_seen')) return;
  const key = 'restar_tip_' + page;
  if (localStorage.getItem(key)) return;
  const modal = document.getElementById('modal-onboarding');
  if (!modal) return;
  const title = modal.querySelector('.modal-title');
  const body = modal.querySelector('.modal-body');
  const footer = modal.querySelector('.modal-footer');
  if (title) title.textContent = 'Guía: ' + page;
  if (body) body.innerHTML = `<p>${sectionTips[page] || 'Explora esta sección.'}</p>`;
  if (footer) footer.innerHTML = `<button class="btn btn-primary" onclick="closeModal('modal-onboarding');localStorage.setItem('restar_tip_${page}','1')">Entendido</button>`;
  openModal('modal-onboarding');
  localStorage.setItem(key, '1');
}

export function toggleSidebarMesas() {
  const sm = document.getElementById('sidebar');
  const sx = document.getElementById('sidebar-modules');
  if (!sm) return;
  const open = sm.classList.toggle('open');
  if (open && sx) sx.classList.remove('open');
}

export function toggleSidebarModules() {
  const sm = document.getElementById('sidebar');
  const sx = document.getElementById('sidebar-modules');
  if (!sx) return;
  const open = sx.classList.toggle('open');
  if (open && sm) sm.classList.remove('open');
}

export function toggleSidebar() { 
  toggleSidebarMesas(); 
}

export function buildSidebar() {
  const el = document.getElementById('sidebar-tables');
  if (!el) return;
  const groups = {
    general: { label: 'Mesas (1-20)', tables: [] },
    vip: { label: 'Área VIP', tables: [] },
    bar: { label: 'Barra', tables: [] },
    ger: { label: 'Especial', tables: [] }
  };
  state.DB.tables.forEach(t => { 
    if (groups[t.area]) groups[t.area].tables.push(t); 
  });
  
  el.innerHTML = Object.entries(groups).map(([key, g]) => `
    <div class="sidebar-title" style="margin-top:10px">${g.label}</div>
    ${g.tables.map(t => {
      const busy = tableOrders(t.id).length > 0;
      const badge = t.area === 'vip' ? 'badge-vip' : t.area === 'bar' ? 'badge-bar' : t.area === 'ger' ? 'badge-ger' : '';
      const areaLabel = t.area === 'vip' ? 'VIP' : t.area === 'bar' ? 'Bar' : t.area === 'ger' ? 'Ger' : '';
      return `<div class="sidebar-item ${state.selectedTableId === t.id ? 'active' : ''}" onclick="openTable('${t.id}')">
        <span>${t.name}</span>
        ${areaLabel ? `<span class="area-badge ${badge}">${areaLabel}</span>` : ''}
        <span class="table-status ${busy ? 'status-busy' : 'status-free'}"></span>
      </div>`;
    }).join('')}
  `).join('');
}

export function renderPage(page) {
  switch (page) {
    case 'mesas': renderMesas(); break;
    case 'ordenes': renderOrdenes(); break;
    case 'movimientos': renderMovimientos(); break;
    case 'admin': if (isAdmin()) renderAdmin(); break;
  }
}

export function toggleDark() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? '' : 'dark');
  state.DB.config.darkMode = !isDark;
  saveDB();
}

export function applyDarkMode() {
  if (state.DB.config && state.DB.config.darkMode) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
}

/* ============================================================
   MODAL HELPERS
   ============================================================ */
export function openModal(id) { 
  const el = document.getElementById(id);
  if (el) el.classList.add('open'); 
}

export function closeModal(id) { 
  const el = document.getElementById(id);
  if (el) el.classList.remove('open'); 
}

// Add overlay click events for all modals
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-overlay').forEach(m => {
    m.addEventListener('click', e => { 
      if (e.target === m) m.classList.remove('open'); 
    });
  });
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

/* ============================================================
   TOAST NOTIFICATIONS
   ============================================================ */
export function showToast(msg, duration = 3000) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = 'position:fixed;bottom:22px;right:22px;background:var(--navy);color:#fff;padding:11px 18px;border-radius:var(--r-sm);box-shadow:var(--sh-md);z-index:9999;font-size:.88rem;transition:all .3s;transform:translateY(100px);opacity:0;max-width:320px';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.transform = 'translateY(0)'; 
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { 
    toast.style.transform = 'translateY(100px)'; 
    toast.style.opacity = '0'; 
  }, duration);
}

// Bind to window for global inline HTML onclick handlers
window.navigateTo = navigateTo;
window.toggleSidebarMesas = toggleSidebarMesas;
window.toggleSidebarModules = toggleSidebarModules;
window.toggleSidebar = toggleSidebar;
window.toggleDark = toggleDark;
window.openModal = openModal;
window.closeModal = closeModal;
window.showToast = showToast;
