import { state } from './state.js';
import { ErrorHandler } from './errorhandler.js';
import { 
  APP_VERSION, 
  SCHEMA_VERSION, 
  DB_NAME, 
  DB_STORE, 
  DB_KEY, 
  LS_FALLBACK_KEY 
} from '../config.js';
import { now, today, uid } from './utils.js';

/* ============================================================
   MODULE: DATABASE (IndexedDB + localStorage fallback)
   ============================================================ */
let idb = null;

async function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(DB_STORE);
    };
    req.onsuccess = e => { idb = e.target.result; resolve(idb); };
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  if (!idb) await openIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  if (!idb) await openIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(DB_STORE, 'readwrite');
    const req = tx.objectStore(DB_STORE).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function load() {
  try {
    const data = await idbGet(DB_KEY);
    if (data) return data;
  } catch (e) {
    ErrorHandler.log('IDB load failed, using localStorage', e);
  }
  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(LS_FALLBACK_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    ErrorHandler.log('localStorage load failed', e);
  }
  return null;
}

async function save(data) {
  try {
    await idbSet(DB_KEY, data);
  } catch (e) {
    ErrorHandler.log('IDB save failed, using localStorage', e);
  }
  try {
    localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(data));
  } catch (e) {
    ErrorHandler.log('localStorage save failed', e);
  }
}

/* ============================================================
   MODULE: CORE — DEFAULT DATA & MIGRATION
   ============================================================ */
function buildDefaultMenu() {
  const categories = [
    { id: 'cat-platillos', name: 'Platillos' },
    { id: 'cat-bebidas', name: 'Bebidas' },
    { id: 'cat-postres', name: 'Postres' },
    { id: 'cat-variantes', name: 'Variantes' }
  ];
  let products = [
    { id: uid(), categoryId: 'cat-platillos', name: 'Tacos de pollo', price: 25 },
    { id: uid(), categoryId: 'cat-platillos', name: 'Tacos de res', price: 28 },
    { id: uid(), categoryId: 'cat-platillos', name: 'Burrito especial', price: 45 },
    { id: uid(), categoryId: 'cat-platillos', name: 'Quesadilla', price: 22 },
    { id: uid(), categoryId: 'cat-platillos', name: 'Hamburguesa clásica', price: 55 },
    { id: uid(), categoryId: 'cat-platillos', name: 'Hot dog', price: 20 },
    { id: uid(), categoryId: 'cat-platillos', name: 'Pizza personal', price: 60 },
    { id: uid(), categoryId: 'cat-platillos', name: 'Ensalada cesar', price: 40 },
    { id: uid(), categoryId: 'cat-platillos', name: 'Pasta boloñesa', price: 50 },
    { id: uid(), categoryId: 'cat-platillos', name: 'Pollo frito', price: 48 },
    { id: uid(), categoryId: 'cat-bebidas', name: 'Coca-Cola', price: 12 },
    { id: uid(), categoryId: 'cat-bebidas', name: 'Agua mineral', price: 10 },
    { id: uid(), categoryId: 'cat-bebidas', name: 'Jugo de naranja', price: 18 },
    { id: uid(), categoryId: 'cat-bebidas', name: 'Café americano', price: 15 },
    { id: uid(), categoryId: 'cat-bebidas', name: 'Cappuccino', price: 22 },
    { id: uid(), categoryId: 'cat-bebidas', name: 'Té helado', price: 14 },
    { id: uid(), categoryId: 'cat-bebidas', name: 'Limonada', price: 16 },
    { id: uid(), categoryId: 'cat-bebidas', name: 'Smoothie de fresa', price: 25 },
    { id: uid(), categoryId: 'cat-postres', name: 'Pastel de chocolate', price: 30 },
    { id: uid(), categoryId: 'cat-postres', name: 'Helado vainilla', price: 18 },
    { id: uid(), categoryId: 'cat-postres', name: 'Flan napolitano', price: 20 },
    { id: uid(), categoryId: 'cat-variantes', name: 'Extra queso', price: 5 },
    { id: uid(), categoryId: 'cat-variantes', name: 'Sin cebolla', price: 0 },
    { id: uid(), categoryId: 'cat-variantes', name: 'Doble porción', price: 15 }
  ];
  products = products.map(p => ({ ...p, priceHistory: [{ from: '2020-01-01', price: p.price }] }));
  return { categories, products };
}

export function defaultData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    config: { currency: 'Q', posCommission: 3.5, darkMode: false, recipeMargin: 60 },
    users: [
      { id: 'admin', username: 'admin', passwordHash: '', password: 'xekukuaabaj', role: 'admin', createdAt: now() },
      { id: 'v1', username: 'vendedor1', passwordHash: '', password: '1234', role: 'seller', createdAt: now() },
      { id: 'v2', username: 'vendedor2', passwordHash: '', password: '1234', role: 'seller', createdAt: now() },
      { id: 'v3', username: 'vendedor3', passwordHash: '', password: '1234', role: 'seller', createdAt: now() }
    ],
    workers: [],
    tables: generateTables(),
     menu: buildDefaultMenu(),
    inventory: [],
    recipes: [],
    orders: [],
    sales: [],
    expenses: [],
    cashFlow: { currentCash: 0, bankBalance: 0, dailyArchives: [] },
    credits: [],
    deletedRecords: { orders: [], salesItems: [], clients: [] },
    accounting: { journal: [], ledger: {} },
    workerPayments: [],
    attendance: [],
    auditLog: [],
    errorLog: []
  };
}

export function generateTables() {
  const t = [];
  for (let i = 1; i <= 20; i++) {
    t.push({ id: `t${i}`, name: `Mesa ${i}`, area: 'general', status: 'free', clients: [], currentOrderIds: [] });
  }
  ['A', 'B', 'C'].forEach(v => {
    t.push({ id: `vip${v}`, name: `VIP ${v}`, area: 'vip', status: 'free', clients: [], currentOrderIds: [] });
  });
  for (let i = 1; i <= 15; i++) {
    t.push({ id: `b${i}`, name: `Barra ${i}`, area: 'bar', status: 'free', clients: [], currentOrderIds: [] });
  }
  t.push({ id: 'ger', name: 'Gerencial', area: 'ger', status: 'free', clients: [], currentOrderIds: [] });
  return t;
}

export function migrateData(data) {
  try {
    let v = data.schemaVersion || 1;
    if (v < 2) { data.workerPayments = data.workerPayments || []; v = 2; }
    if (v < 3) { data.attendance = data.attendance || []; data.config = data.config || {}; data.config.currency = data.config.currency || 'Q'; v = 3; }
    if (v < 4) {
      (data.orders || []).forEach(order => {
        order.items = (order.items || []).map(item => ({
          ...item,
          itemStatus: item.itemStatus || (order.status === 'pending' ? 'pending' : order.status === 'cooking' ? 'cooking' : 'ready')
        }));
      });
      v = 4;
    }
    if (v < 5) {
      data.auditLog = data.auditLog || [];
      data.errorLog = data.errorLog || [];
      data.config = data.config || {};
      data.config.darkMode = data.config.darkMode || false;
      (data.users || []).forEach(u => { u.passwordHash = u.passwordHash || ''; });
      v = 5;
    }
    if (v < 6) {
    data.menu = data.menu || { categories: [], products: [] };
    if (!data.menu.categories || data.menu.categories.length === 0) data.menu.categories = buildDefaultMenu().categories;
    if (!data.menu.products || data.menu.products.length < 5) {
      const existing = new Set((data.menu.products || []).map(p => p.name));
      const extra = buildDefaultMenu().products.filter(p => !existing.has(p.name));
      data.menu.products = (data.menu.products || []).concat(extra);
    }
    (data.menu.products || []).forEach(p => { if (!p.priceHistory || !p.priceHistory.length) p.priceHistory = [{ from: '2020-01-01', price: p.price || 0 }]; });
      v = 6;
    }
    if (v < 7) {
      data.config = data.config || {};
      data.config.recipeMargin = data.config.recipeMargin ?? 60;
      v = 7;
    }
    data.schemaVersion = SCHEMA_VERSION;
    data.appVersion = APP_VERSION;
    if (!data.users || data.users.length === 0) {
      data.users = defaultData().users;
    }
    data.auditLog = data.auditLog || [];
    data.menu = data.menu || { categories: [], products: [] };
    if (!data.menu.categories || data.menu.categories.length === 0) data.menu.categories = buildDefaultMenu().categories;
    if (!data.menu.products || data.menu.products.length < 5) {
      const existing = new Set((data.menu.products || []).map(p => p.name));
      const extra = buildDefaultMenu().products.filter(p => !existing.has(p.name));
      data.menu.products = (data.menu.products || []).concat(extra);
    }
    (data.menu.products || []).forEach(p => { if (!p.priceHistory || !p.priceHistory.length) p.priceHistory = [{ from: '2020-01-01', price: p.price || 0 }]; });
    data.inventory = data.inventory || [];
    data.recipes = data.recipes || [];
    return data;
  } catch (e) {
    ErrorHandler.log('Migration error', e);
    return data;
  }
}

/* ============================================================
   MODULE: DATABASE OPERATIONS
   ============================================================ */
export async function loadDB() {
  try {
    const raw = await load();
    if (raw) {
      state.DB = migrateData(raw);
    } else {
      state.DB = defaultData();
    }
    await saveDB();
    verifyIntegrity();
  } catch (e) {
    ErrorHandler.log('loadDB error', e);
    state.DB = defaultData();
    await saveDB();
  }
}

export function verifyIntegrity() {
  const required = [
    'users', 'tables', 'menu', 'orders', 'sales', 'expenses', 
    'cashFlow', 'credits', 'deletedRecords', 'accounting', 
    'workerPayments', 'attendance', 'auditLog', 'inventory', 'recipes'
  ];
  const missing = required.filter(k => !state.DB[k]);
  if (missing.length > 0) {
    ErrorHandler.log('Integrity check: missing fields', missing);
    missing.forEach(k => { state.DB[k] = defaultData()[k] || []; });
    if (window.showToast) {
      window.showToast('⚠️ Modo seguro: se restauraron campos faltantes', 4000);
    }
    return false;
  }
  return true;
}

let _saveTimer = null;
export async function saveDB() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async () => {
    try {
      state.DB.schemaVersion = SCHEMA_VERSION;
      state.DB.appVersion = APP_VERSION;
      await save(state.DB);
    } catch (e) {
      ErrorHandler.log('saveDB error', e);
      if (window.showToast) {
        window.showToast('⚠️ Error al guardar datos', 4000);
      }
    }
  }, 300);
}
