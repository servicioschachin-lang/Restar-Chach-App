import { state } from '../services/state.js';
import { saveDB, verifyIntegrity, migrateData } from '../services/database.js';
import { AuditLog } from '../services/audit.js';
import { Security } from '../services/security.js';
import { ErrorHandler } from '../services/errorhandler.js';
import { APP_VERSION, SCHEMA_VERSION } from '../config.js';
import { 
  now, today, uid, fmt, fmtDate, fmtDateOnly, isAdmin, 
  getCategory, getTable, methodLabel, getProduct 
} from '../services/utils.js';

/* ============================================================
   MODULE: ADMIN
   ============================================================ */
export function renderAdmin() {
  const page = document.getElementById('page-admin');
  if (!page) return;
  page.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Administración</h1><p class="page-subtitle">Gestión completa del sistema</p></div>
      <button class="btn btn-xs btn-secondary" onclick="openModal('modal-changelog')">📋 Changelog</button>
    </div>
    <div class="mov-tabs">
      <button class="mov-tab active" onclick="switchAdminTab('menu',this)">🍽️ Menú</button>
      <button class="mov-tab" onclick="switchAdminTab('inventory',this)">📦 Inventario</button>
      <button class="mov-tab" onclick="switchAdminTab('recipes',this)">📝 Recetas</button>

      <button class="mov-tab" onclick="switchAdminTab('workers',this)">👷 Trabajadores</button>
      <button class="mov-tab" onclick="switchAdminTab('deleted',this)">🗑️ Borrados</button>
      <button class="mov-tab" onclick="switchAdminTab('reports',this)">📊 Reportes</button>
      <button class="mov-tab" onclick="switchAdminTab('backup',this)">💾 Respaldo</button>
      <button class="mov-tab" onclick="switchAdminTab('accounting',this)">📒 Contabilidad</button>
      <button class="mov-tab" onclick="switchAdminTab('audit',this)">🔍 Auditoría</button>
      <button class="mov-tab" onclick="switchAdminTab('config',this)">⚙️ Configuración</button>
    </div>
    <div id="admin-tab-content"></div>`;
  showAdminTab('menu');
}

export function switchAdminTab(tab, btn) {
  document.querySelectorAll('#page-admin .mov-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  showAdminTab(tab);
}

export function showAdminTab(tab) {
  const el = document.getElementById('admin-tab-content'); 
  if (!el) return;
  if      (tab === 'menu')       renderMenuTab(el);
  else if (tab === 'inventory')  renderInventoryTab(el);
  else if (tab === 'recipes')     renderRecipesTab(el);

  else if (tab === 'workers')    renderWorkersTab(el);
  else if (tab === 'deleted')    renderDeletedTab(el);
  else if (tab === 'reports')    renderReportsTab(el);
  else if (tab === 'backup')     renderBackupTab(el);
  else if (tab === 'accounting') renderAccountingTab(el);
  else if (tab === 'audit')      renderAuditTab(el);
  else if (tab === 'config')     renderConfigTab(el);
}

/* ===== MENU TAB ===== */
export function renderMenuTab(el) {
  el.innerHTML = `
    <div style="display:flex;gap:14px;flex-wrap:wrap">
      <div style="flex:1;min-width:270px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:11px">
          <h4 style="color:var(--navy);font-weight:800">Categorías</h4>
          <button class="btn btn-sm btn-primary" onclick="openCatModal()">➕ Categoría</button>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>Categoría</th><th>Acc.</th></tr></thead>
          <tbody>
            ${(state.DB.menu?.categories || []).map(c => `<tr>
              <td>${c.name}</td>
              <td>
                <button class="btn btn-xs btn-secondary" onclick="openCatModal('${c.id}')">✏️</button>
                <button class="btn btn-xs btn-danger" onclick="deleteCat('${c.id}')">🗑️</button>
              </td></tr>`).join('')}
          </tbody>
        </table></div>
      </div>
      <div style="flex:2;min-width:310px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:11px">
          <h4 style="color:var(--navy);font-weight:800">Productos</h4>
          <button class="btn btn-sm btn-primary" onclick="openProductModal()">➕ Producto</button>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>Producto</th><th>Categoría</th><th>Precio</th><th>Costo</th><th>Margen</th><th>Acc.</th></tr></thead>
          <tbody>
            ${(state.DB.menu?.products || []).map(p => {
              const cat = getCategory(p.categoryId);
              const price = p.priceHistory[p.priceHistory.length - 1]?.price || 0;
              const cost = getRecipeCost(p.id);
              const margin = price > 0 && cost > 0 ? ((price - cost) / price * 100).toFixed(1) : '—';
              const marginColor = price > 0 && cost > 0 && (price - cost) / price * 100 < (state.DB.config?.recipeMargin || 60) ? 'color:var(--coral)' : 'color:var(--mint-dark)';
              return `<tr>
                <td>${p.name}</td><td>${cat?.name || '—'}</td>
                <td class="text-mint font-bold">${fmt(price)}</td>
                <td>${cost ? fmt(cost) : '—'}</td>
                <td style="${marginColor};font-weight:700">${margin !== '—' ? margin + '%' : '—'}</td>
                <td>
                  <button class="btn btn-xs btn-secondary" onclick="openProductModal('${p.id}')">✏️</button>
                  <button class="btn btn-xs btn-secondary" onclick="openRecipeModal('${p.id}')">📝</button>
                  <button class="btn btn-xs btn-danger" onclick="deleteProduct('${p.id}')">🗑️</button>
                </td></tr>`;
            }).join('')}
          </tbody>
        </table></div>
      </div>
    </div>`;
}

export function openCatModal(id) {
  if (!state.DB.menu || !state.DB.menu.categories) state.DB.menu = { categories: [], products: [] };
  const cat = id ? state.DB.menu.categories.find(c => c.id === id) : null;
  const inner = document.getElementById('modal-product-inner');
  if (inner) {
    inner.innerHTML = `
      <div class="modal-header"><h3 class="modal-title">${cat ? 'Editar' : 'Nueva'} Categoría</h3><button class="modal-close" onclick="closeModal('modal-product')">×</button></div>
      <div class="modal-body"><div class="form-group"><label>Nombre</label><input type="text" id="cat-name" value="${cat?.name || ''}"></div></div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('modal-product')">Cancelar</button>
        <button class="btn btn-primary" onclick="saveCat('${id || ''}')">Guardar</button>
      </div>`;
  }
  if (window.openModal) window.openModal('modal-product');
}

export async function saveCat(id) {
  const name = document.getElementById('cat-name').value.trim(); 
  if (!name) return;
  if (!state.DB.menu || !state.DB.menu.categories) state.DB.menu = { categories: [], products: [] };
  if (id) { 
    const c = state.DB.menu.categories.find(x => x.id === id); 
    if (c) c.name = name; 
  } else {
    state.DB.menu.categories.push({ id: uid(), name });
  }
  AuditLog.append(id ? 'CAT_UPDATED' : 'CAT_CREATED', { name, by: state.currentUser.username });
  await saveDB(); 
  if (window.closeModal) window.closeModal('modal-product'); 
  showAdminTab('menu');
}

export function deleteCat(id) {
  if (!state.DB.menu || !state.DB.menu.categories) state.DB.menu = { categories: [], products: [] };
  if (confirm('¿Eliminar categoría?')) { 
    state.DB.menu.categories = state.DB.menu.categories.filter(c => c.id !== id); 
    saveDB(); 
    showAdminTab('menu'); 
  }
}

export function openProductModal(id) {
  if (!state.DB.menu || !state.DB.menu.categories || !state.DB.menu.products) state.DB.menu = { categories: [], products: [] };
  const prod = id ? state.DB.menu.products.find(p => p.id === id) : null;
  const price = prod ? (prod.priceHistory[prod.priceHistory.length - 1]?.price || 0) : '';
  const inner = document.getElementById('modal-product-inner');
  if (inner) {
    inner.innerHTML = `
      <div class="modal-header"><h3 class="modal-title">${prod ? 'Editar' : 'Nuevo'} Producto</h3><button class="modal-close" onclick="closeModal('modal-product')">×</button></div>
      <div class="modal-body">
        <div class="form-group"><label>Nombre</label><input type="text" id="prod-name" value="${prod?.name || ''}"></div>
        <div class="form-group"><label>Categoría</label>
          <select id="prod-cat">
            ${(state.DB.menu?.categories || []).map(c => `<option value="${c.id}" ${prod?.categoryId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Precio</label><input type="number" id="prod-price" value="${price}" min="0" step="0.01"></div>
        ${prod ? `<div class="alert alert-info" style="font-size:.83rem">💡 Cambiar el precio no afecta ventas anteriores</div>` : ''}
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('modal-product')">Cancelar</button>
        <button class="btn btn-primary" onclick="saveProduct('${id || ''}')">Guardar</button>
      </div>`;
  }
  if (window.openModal) window.openModal('modal-product');
}

export async function saveProduct(id) {
  const name  = document.getElementById('prod-name').value.trim();
  const catId = document.getElementById('prod-cat').value;
  const price = parseFloat(document.getElementById('prod-price').value);
  if (!name || isNaN(price)) { alert('Completa todos los campos'); return; }
  if (!state.DB.menu || !state.DB.menu.categories || !state.DB.menu.products) state.DB.menu = { categories: [], products: [] };
  if (id) {
    const p = state.DB.menu.products.find(x => x.id === id);
    if (p) {
      p.name = name; 
      p.categoryId = catId;
      if (p.priceHistory[p.priceHistory.length - 1]?.price !== price) {
        p.priceHistory.push({ price, from: today() });
      }
    }
  } else {
    state.DB.menu.products.push({ id: uid(), name, categoryId: catId, priceHistory: [{ price, from: today() }] });
  }
  AuditLog.append(id ? 'PRODUCT_UPDATED' : 'PRODUCT_CREATED', { name, price, by: state.currentUser.username });
  await saveDB(); 
  if (window.closeModal) window.closeModal('modal-product'); 
  showAdminTab('menu'); 
  if (window.showToast) window.showToast('Producto guardado');
}

export function deleteProduct(id) { 
  if (!state.DB.menu || !state.DB.menu.products) state.DB.menu = { categories: [], products: [] };
  if (confirm('¿Eliminar producto?')) { 
    state.DB.menu.products = state.DB.menu.products.filter(p => p.id !== id); 
    saveDB(); 
    showAdminTab('menu'); 
  } 
}

/* ===== INVENTORY HELPERS ===== */
export function getInventoryItem(id) {
  return (state.DB.inventory || []).find(i => i.id === id);
}

export function getRecipeCost(productId) {
  const recipes = state.DB.recipes || [];
  const inventory = state.DB.inventory || [];
  const recipe = recipes.find(r => r.productId === productId);
  if (!recipe || !Array.isArray(recipe.ingredients)) return 0;
  return recipe.ingredients.reduce((sum, ing) => {
    const item = inventory.find(i => i.id === ing.inventoryId);
    const unitCost = item?.unitCost || 0;
    return sum + (ing.amount || 0) * unitCost;
  }, 0);
}

export function getSuggestedPrice(productId, marginPercent) {
  const cost = getRecipeCost(productId);
  if (!cost || !marginPercent) return 0;
  return cost / (1 - marginPercent / 100);
}

/* ===== INVENTORY TAB ===== */
export function getInventoryCategories() {
  const items = state.DB.inventory || [];
  const cats = new Set(items.map(i => i.category).filter(Boolean));
  return Array.from(cats).sort();
}

export function renderInventoryTab(el) {
  const items = state.DB.inventory || [];
  const cats = getInventoryCategories();
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:11px">
      <h4 style="color:var(--navy);font-weight:800">📦 Inventario</h4>
      <button class="btn btn-sm btn-primary" onclick="openInventoryModal()">➕ Ingrediente</button>
    </div>
    ${cats.map(cat => `
      <h5 style="color:var(--navy);margin:14px 0 8px;font-weight:700">${cat}</h5>
      <div class="table-wrap" style="margin-bottom:18px"><table>
        <thead><tr><th>Ingrediente</th><th>Unidad</th><th>Stock</th><th>Compra</th><th>Costo unit.</th><th>Stock bajo</th><th>Acc.</th></tr></thead>
        <tbody>
          ${items.filter(i => i.category === cat).map(i => `
            <tr style="${i.lowThreshold != null && i.quantity <= i.lowThreshold ? 'background:#fef3c7' : ''}">
              <td><strong>${i.name}</strong></td>
              <td>${i.unit || '—'}</td>
              <td>${i.quantity != null ? i.quantity.toFixed(2) : '—'} ${i.unit || ''}</td>
              <td>${i.purchaseQty != null ? i.purchaseQty.toFixed(2) : '—'} ${i.unit || ''} × ${fmt(i.purchaseCost || 0)}</td>
              <td>${fmt(i.unitCost || 0)}</td>
              <td>${i.lowThreshold != null ? i.lowThreshold.toFixed(2) : '—'}</td>
              <td>
                <button class="btn btn-xs btn-secondary" onclick="openInventoryModal('${i.id}')">✏️</button>
                <button class="btn btn-xs btn-danger" onclick="deleteInventoryItem('${i.id}')">🗑️</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table></div>
    `).join('')}
    ${!items.length ? '<div style="text-align:center;padding:30px;color:var(--g400)">Sin ingredientes registrados</div>' : ''}
    ${items.length && !cats.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Ingrediente</th><th>Unidad</th><th>Stock</th><th>Compra</th><th>Costo unit.</th><th>Stock bajo</th><th>Acc.</th></tr></thead>
        <tbody>
          ${items.map(i => `
            <tr style="${i.lowThreshold != null && i.quantity <= i.lowThreshold ? 'background:#fef3c7' : ''}">
              <td><strong>${i.name}</strong></td>
              <td>${i.unit || '—'}</td>
              <td>${i.quantity != null ? i.quantity.toFixed(2) : '—'} ${i.unit || ''}</td>
              <td>${i.purchaseQty != null ? i.purchaseQty.toFixed(2) : '—'} ${i.unit || ''} × ${fmt(i.purchaseCost || 0)}</td>
              <td>${fmt(i.unitCost || 0)}</td>
              <td>${i.lowThreshold != null ? i.lowThreshold.toFixed(2) : '—'}</td>
              <td>
                <button class="btn btn-xs btn-secondary" onclick="openInventoryModal('${i.id}')">✏️</button>
                <button class="btn btn-xs btn-danger" onclick="deleteInventoryItem('${i.id}')">🗑️</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table></div>
    ` : ''}`;
}

export function openInventoryModal(id) {
  const item = id ? getInventoryItem(id) : null;
  const inner = document.getElementById('modal-product-inner');
  const existingCats = getInventoryCategories();
  if (inner) {
    inner.innerHTML = `
      <div class="modal-header"><h3 class="modal-title">${item ? 'Editar' : 'Nuevo'} Ingrediente</h3><button class="modal-close" onclick="closeModal('modal-product')">×</button></div>
      <div class="modal-body">
        <div class="form-group"><label>Nombre</label><input type="text" id="inv-name" value="${item?.name || ''}"></div>
        <div class="form-group"><label>Categoría</label>
          <input type="text" id="inv-category" list="inv-cat-list" value="${item?.category || ''}" placeholder="Ej. Lácteos, Café, Bebidas...">
          <datalist id="inv-cat-list">${existingCats.map(c => `<option value="${c}">`).join('')}</datalist>
        </div>
        <div class="form-group"><label>Unidad que usarás en recetas (g, ml, uds, etc.)</label><input type="text" id="inv-unit" value="${item?.unit || ''}" placeholder="Ej. g, ml, uds"></div>
        <div class="alert alert-info" style="font-size:.83rem;margin-bottom:11px">
          <strong>Importante:</strong> La cantidad debe estar en la <em>misma unidad</em> que usarás en las recetas.<br>
          Ejemplo: Si compraste 1 libra de café (454g) por Q10, pon <strong>Cantidad=454</strong>, <strong>Unidad=g</strong>, <strong>Costo=10</strong>.
        </div>
        <div style="display:flex;gap:12px">
          <div class="form-group" style="flex:1"><label>Cantidad total comprada</label><input type="number" id="inv-purchase-qty" value="${item?.purchaseQty != null ? item.purchaseQty : ''}" min="0" step="0.01" placeholder="Ej. 454"></div>
          <div class="form-group" style="flex:1"><label>Costo total de esa compra</label><input type="number" id="inv-purchase-cost" value="${item?.purchaseCost != null ? item.purchaseCost : ''}" min="0" step="0.01" placeholder="Ej. 10"></div>
        </div>
        <div class="form-group"><label>Cantidad en stock actual</label><input type="number" id="inv-qty" value="${item?.quantity != null ? item.quantity : ''}" min="0" step="0.01"></div>
        <div class="form-group"><label>Umbral de stock bajo (opcional)</label><input type="number" id="inv-low" value="${item?.lowThreshold != null ? item.lowThreshold : ''}" min="0" step="0.01"></div>
        <div id="inv-unit-cost-display" style="font-size:.9rem;color:var(--navy);margin-top:8px;padding:8px;background:var(--mint-light);border-radius:6px"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('modal-product')">Cancelar</button>
        <button class="btn btn-primary" onclick="saveInventoryItem('${id || ''}')">Guardar</button>
      </div>`;
    // Live update unit cost preview
    const pqEl = document.getElementById('inv-purchase-qty');
    const pcEl = document.getElementById('inv-purchase-cost');
    const disp = document.getElementById('inv-unit-cost-display');
    function updateUnitCost() {
      const pq = parseFloat(pqEl?.value);
      const pc = parseFloat(pcEl?.value);
      const unit = document.getElementById('inv-unit')?.value?.trim() || 'unidad';
      if (pq > 0 && pc >= 0) {
        const unitCost = pc / pq;
        disp.innerHTML = `💰 <strong>Costo unitario:</strong> ${fmt(unitCost)} por cada ${unit}<br><span style="font-size:.78rem;color:var(--g500)">Si en una receta usas 50${unit}, el costo será ${fmt(unitCost * 50)}</span>`;
      } else {
        disp.innerHTML = '💰 Ingresa la cantidad comprada y el costo total para ver el costo unitario';
      }
    }
    pqEl?.addEventListener('input', updateUnitCost);
    pcEl?.addEventListener('input', updateUnitCost);
    document.getElementById('inv-unit')?.addEventListener('input', updateUnitCost);
    updateUnitCost();
  }
  if (window.openModal) window.openModal('modal-product');
}

export async function saveInventoryItem(id) {
  const name     = document.getElementById('inv-name').value.trim();
  const category = document.getElementById('inv-category').value.trim();
  const unit     = document.getElementById('inv-unit').value.trim();
  const pq       = parseFloat(document.getElementById('inv-purchase-qty').value);
  const pc       = parseFloat(document.getElementById('inv-purchase-cost').value);
  const qty      = parseFloat(document.getElementById('inv-qty').value);
  const low      = parseFloat(document.getElementById('inv-low').value);
  if (!name) { alert('Ingresa un nombre'); return; }
  if (isNaN(qty)) { alert('Ingresa una cantidad válida de stock'); return; }
  if (isNaN(pq) || pq <= 0) { alert('Ingresa una cantidad comprada válida (mayor a 0)'); return; }
  if (isNaN(pc) || pc < 0) { alert('Ingresa un costo de compra válido'); return; }
  const unitCost = pc / pq;
  state.DB.inventory = state.DB.inventory || [];
  if (id) {
    const it = state.DB.inventory.find(x => x.id === id);
    if (it) { it.name = name; it.category = category; it.unit = unit; it.purchaseQty = pq; it.purchaseCost = pc; it.unitCost = unitCost; it.quantity = qty; it.lowThreshold = isNaN(low) ? null : low; }
  } else {
    state.DB.inventory.push({ id: uid(), name, category, unit, purchaseQty: pq, purchaseCost: pc, unitCost, quantity: qty, lowThreshold: isNaN(low) ? null : low });
  }
  AuditLog.append(id ? 'INVENTORY_UPDATED' : 'INVENTORY_CREATED', { name, category, by: state.currentUser.username });
  await saveDB();
  if (window.closeModal) window.closeModal('modal-product');
  showAdminTab('inventory');
  if (window.showToast) window.showToast('Ingrediente guardado');
}

export function deleteInventoryItem(id) {
  if (confirm('¿Eliminar ingrediente? Se perderá el historial de costos.')) {
    state.DB.inventory = (state.DB.inventory || []).filter(i => i.id !== id);
    saveDB();
    showAdminTab('inventory');
  }
}

/* ===== RECIPES TAB ===== */
export function renderRecipesTab(el) {
  const products = (state.DB.menu?.products || []);
  const recipes  = state.DB.recipes || [];
  const inventory = state.DB.inventory || [];
  const marginGoal = state.DB.config?.recipeMargin || 60;
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:11px">
      <h4 style="color:var(--navy);font-weight:800">📝 Recetas & Costos</h4>
      <div style="display:flex;gap:8px;align-items:center">
        <label style="font-size:.83rem;color:var(--g600)">Margen deseado:</label>
        <input type="number" id="recipe-margin" value="${marginGoal}" min="0" max="99" step="1" style="width:60px;text-align:center" onchange="saveRecipeMargin()">%
      </div>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Producto</th><th>Costo prod.</th><th>Precio actual</th><th>Margen real</th><th>Precio sugerido (${marginGoal}%)</th><th>Ingredientes</th><th>Acc.</th></tr></thead>
      <tbody>
        ${products.map(p => {
          const cost = getRecipeCost(p.id);
          const price = p.priceHistory?.[p.priceHistory.length - 1]?.price || 0;
          const margin = price > 0 ? ((price - cost) / price * 100).toFixed(1) : '—';
          const suggested = cost ? fmt(getSuggestedPrice(p.id, marginGoal)) : '—';
          const recipe = recipes.find(r => r.productId === p.id);
          const ingCount = recipe?.ingredients?.length || 0;
          const marginColor = price > 0 && (price - cost) / price * 100 < marginGoal ? 'color:var(--coral)' : 'color:var(--mint-dark)';
          return `<tr>
            <td><strong>${p.name}</strong></td>
            <td>${cost ? fmt(cost) : '—'}</td>
            <td>${fmt(price)}</td>
            <td style="${marginColor};font-weight:700">${margin !== '—' ? margin + '%' : '—'}</td>
            <td><strong>${suggested}</strong></td>
            <td>${ingCount} ingrediente(s)</td>
            <td>
              <button class="btn btn-xs btn-secondary" onclick="openRecipeModal('${p.id}')">📝 Receta</button>
            </td>
          </tr>`;
        }).join('')}
        ${!products.length ? '<tr><td colspan="7" style="text-align:center;padding:18px;color:var(--g400)">Sin productos en el menú. Crea productos primero.</td></tr>' : ''}
      </tbody>
    </table></div>`;
}

export async function saveRecipeMargin() {
  const val = parseFloat(document.getElementById('recipe-margin')?.value);
  if (isNaN(val)) return;
  state.DB.config = state.DB.config || {};
  state.DB.config.recipeMargin = val;
  await saveDB();
  showAdminTab('recipes');
}

export function renderInventoryOptions(selectedId) {
  const inventory = state.DB.inventory || [];
  const cats = getInventoryCategories();
  if (!cats.length) {
    return inventory.map(i => `<option value="${i.id}" ${i.id === selectedId ? 'selected' : ''}>${i.name} (${i.unit || 'uds'})</option>`).join('');
  }
  const grouped = {};
  cats.forEach(c => grouped[c] = []);
  grouped['Sin categoría'] = [];
  inventory.forEach(i => {
    const cat = i.category || 'Sin categoría';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(i);
  });
  return Object.entries(grouped)
    .filter(([, items]) => items.length)
    .map(([cat, items]) => `
      <optgroup label="${cat}">
        ${items.map(i => `<option value="${i.id}" ${i.id === selectedId ? 'selected' : ''}>${i.name} — ${fmt(i.unitCost || 0)}/${i.unit || 'ud'}</option>`).join('')}
      </optgroup>`).join('');
}

export function openRecipeModal(productId) {
  const prod = (state.DB.menu?.products || []).find(p => p.id === productId);
  const recipes = state.DB.recipes || [];
  let recipe = recipes.find(r => r.productId === productId);
  if (!recipe) recipe = { productId, ingredients: [] };
  const inner = document.getElementById('modal-product-inner');
  if (inner) {
    inner.innerHTML = `
      <div class="modal-header"><h3 class="modal-title">📝 Receta — ${prod?.name || ''}</h3><button class="modal-close" onclick="closeModal('modal-product')">×</button></div>
      <div class="modal-body">
        <div class="alert alert-info" style="font-size:.83rem;margin-bottom:11px">Define qué ingredientes y en qué cantidad usa este producto. El costo se calcula automáticamente según el costo unitario de cada ingrediente.</div>
        <div id="recipe-ingredients">
          ${recipe.ingredients.map((ing, idx) => {
            const invItem = (state.DB.inventory || []).find(i => i.id === ing.inventoryId);
            const lineCost = (invItem?.unitCost || 0) * (ing.amount || 0);
            return `<div class="form-group recipe-ingredient-row" style="display:flex;gap:8px;align-items:flex-end;margin-bottom:4px">
              <select id="ri-inv-${idx}" style="flex:2" onchange="updateRecipeLineCost(this)">${renderInventoryOptions(ing.inventoryId)}</select>
              <div style="flex:1;display:flex;align-items:center;gap:6px">
                <input type="number" id="ri-qty-${idx}" value="${ing.amount}" min="0" step="0.01" placeholder="Cantidad" style="flex:1" oninput="updateRecipeLineCost(this)">
                <span class="ri-unit-label" style="font-size:.78rem;color:var(--g400);white-space:nowrap">${invItem?.unit || 'uds'}</span>
              </div>
              <button class="btn btn-xs btn-danger" onclick="removeRecipeIngredient('${productId}',${idx})">×</button>
            </div>
            <div class="ri-cost-preview" style="font-size:.78rem;color:var(--g500);margin:-8px 0 8px 4px">Costo: ${fmt(lineCost)}</div>`;
          }).join('')}
        </div>
        <button class="btn btn-sm btn-secondary" onclick="addRecipeIngredientRow('${productId}')">➕ Agregar ingrediente</button>
        <div style="margin-top:14px;padding:10px;background:var(--mint-light);border-radius:8px">
          <div class="order-total-row"><span>Costo de producción</span><span><strong id="recipe-total-cost">${fmt(getRecipeCost(productId))}</strong></span></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('modal-product')">Cancelar</button>
        <button class="btn btn-primary" onclick="saveRecipe('${productId}')">Guardar receta</button>
      </div>`;
  }
  if (window.openModal) window.openModal('modal-product');
}

export function addRecipeIngredientRow(productId) {
  const container = document.getElementById('recipe-ingredients');
  if (!container) return;
  const idx = container.querySelectorAll('.recipe-ingredient-row').length;
  const rowDiv = document.createElement('div');
  rowDiv.className = 'form-group recipe-ingredient-row';
  rowDiv.style.cssText = 'display:flex;gap:8px;align-items:flex-end;margin-bottom:4px';
  rowDiv.innerHTML = `
    <select id="ri-inv-${idx}" style="flex:2" onchange="updateRecipeLineCost(this)">${renderInventoryOptions()}</select>
    <div style="flex:1;display:flex;align-items:center;gap:6px">
      <input type="number" id="ri-qty-${idx}" value="" min="0" step="0.01" placeholder="Cantidad" style="flex:1" oninput="updateRecipeLineCost(this)">
      <span class="ri-unit-label" style="font-size:.78rem;color:var(--g400);white-space:nowrap">uds</span>
    </div>
    <button class="btn btn-xs btn-danger" onclick="this.closest('.recipe-ingredient-row').nextElementSibling?.remove(); this.closest('.recipe-ingredient-row').remove(); updateRecipeTotalCost();">×</button>`;
  const costDiv = document.createElement('div');
  costDiv.className = 'ri-cost-preview';
  costDiv.style.cssText = 'font-size:.78rem;color:var(--g500);margin:-8px 0 8px 4px';
  costDiv.textContent = 'Costo: Q 0.00';
  container.appendChild(rowDiv);
  container.appendChild(costDiv);
}

export function updateRecipeLineCost(el) {
  const row = el.closest('.recipe-ingredient-row');
  if (!row) return;
  const sel = row.querySelector('select');
  const qtyInput = row.querySelector('input[type="number"]');
  const unitLabel = row.querySelector('.ri-unit-label');
  const costPreview = row.nextElementSibling;
  const invItem = (state.DB.inventory || []).find(i => i.id === sel?.value);
  if (unitLabel && invItem) unitLabel.textContent = invItem.unit || 'uds';
  const cost = (invItem?.unitCost || 0) * (parseFloat(qtyInput?.value) || 0);
  if (costPreview) costPreview.textContent = `Costo: ${fmt(cost)}`;
  updateRecipeTotalCost();
}

export function updateRecipeTotalCost() {
  const totalEl = document.getElementById('recipe-total-cost');
  if (!totalEl) return;
  let total = 0;
  document.querySelectorAll('.recipe-ingredient-row').forEach(row => {
    const sel = row.querySelector('select');
    const qtyInput = row.querySelector('input[type="number"]');
    const invItem = (state.DB.inventory || []).find(i => i.id === sel?.value);
    total += (invItem?.unitCost || 0) * (parseFloat(qtyInput?.value) || 0);
  });
  totalEl.textContent = fmt(total);
}

export async function saveRecipe(productId) {
  const container = document.getElementById('recipe-ingredients');
  if (!container) return;
  const ingredients = [];
  container.querySelectorAll('.recipe-ingredient-row').forEach(row => {
    const sel = row.querySelector('select');
    const qty = row.querySelector('input[type="number"]');
    if (sel && qty && sel.value && qty.value) {
      ingredients.push({ inventoryId: sel.value, amount: parseFloat(qty.value) });
    }
  });
  state.DB.recipes = state.DB.recipes || [];
  const idx = state.DB.recipes.findIndex(r => r.productId === productId);
  if (idx >= 0) {
    state.DB.recipes[idx] = { productId, ingredients };
  } else {
    state.DB.recipes.push({ productId, ingredients });
  }
  AuditLog.append('RECIPE_SAVED', { productId, ingredientCount: ingredients.length, by: state.currentUser.username });
  await saveDB();
  if (window.closeModal) window.closeModal('modal-product');
  showAdminTab('recipes');
  if (window.showToast) window.showToast('Receta guardada');
}

export function removeRecipeIngredient(productId, idx) {
  const recipes = state.DB.recipes || [];
  const recipe = recipes.find(r => r.productId === productId);
  if (recipe && recipe.ingredients) {
    recipe.ingredients.splice(idx, 1);
    saveDB();
    openRecipeModal(productId);
  }
}

/* ===== USERS TAB ===== */
export function renderUsersTab(el) {
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:11px">
      <h4 style="color:var(--navy);font-weight:800">Usuarios del Sistema</h4>
      <button class="btn btn-sm btn-primary" onclick="openUserModal()">➕ Usuario</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Usuario</th><th>Rol</th><th>Creado</th><th>Acc.</th></tr></thead>
      <tbody>
        ${state.DB.users.map(u => `<tr>
          <td><strong>${u.username}</strong></td>
          <td><span class="tag tag-${u.role}">${u.role === 'admin' ? '👑 Admin' : '🧑 Vendedor'}</span></td>
          <td>${fmtDateOnly(u.createdAt)}</td>
          <td>
            <button class="btn btn-xs btn-secondary" onclick="openUserModal('${u.id}')">✏️</button>
            ${u.id !== 'admin' ? `<button class="btn btn-xs btn-danger" onclick="deleteUser('${u.id}')">🗑️</button>` : ''}
          </td></tr>`).join('')}
      </tbody>
    </table></div>`;
}

export function openUserModal(id) {
  const user = id ? state.DB.users.find(u => u.id === id) : null;
  const inner = document.getElementById('modal-user-inner');
  if (inner) {
    inner.innerHTML = `
      <div class="modal-header"><h3 class="modal-title">${user ? 'Editar' : 'Nuevo'} Usuario</h3><button class="modal-close" onclick="closeModal('modal-user')">×</button></div>
      <div class="modal-body">
        <div class="form-group"><label>Usuario</label><input type="text" id="user-name" value="${user?.username || ''}"></div>
        <div class="form-group"><label>${user ? 'Nueva contraseña (vacío = sin cambio)' : 'Contraseña'}</label>
          <div class="pw-wrap">
            <input type="password" id="user-pw" value="">
            <button class="pw-toggle" onclick="togglePw('user-pw',this)">👁️</button>
          </div>
        </div>
        <div class="form-group"><label>Rol</label>
          <select id="user-role">
            <option value="seller" ${user?.role === 'seller' ? 'selected' : ''}>Vendedor</option>
            <option value="admin"  ${user?.role === 'admin' ? 'selected' : ''}>Administrador</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('modal-user')">Cancelar</button>
        <button class="btn btn-primary" onclick="saveUser('${id || ''}')">Guardar</button>
      </div>`;
  }
  if (window.openModal) window.openModal('modal-user');
}

export function togglePw(inputId, btn) {
  const el = document.getElementById(inputId);
  if (el) {
    const isPw = el.type === 'password';
    el.type = isPw ? 'text' : 'password';
    btn.textContent = isPw ? '🔒' : '👁️';
  }
}

export async function saveUser(id) {
  const username = document.getElementById('user-name').value.trim();
  const pw       = document.getElementById('user-pw').value;
  const role     = document.getElementById('user-role').value;
  if (!username) { alert('Ingresa un nombre de usuario'); return; }
  if (!id && !pw) { alert('Ingresa una contraseña'); return; }

  if (id) {
    const u = state.DB.users.find(x => x.id === id);
    if (u) {
      u.username = username; 
      u.role = role;
      if (pw) { 
        u.passwordHash = await Security.hashPassword(pw); 
        u.password = undefined; 
      }
    }
  } else {
    if (state.DB.users.find(u => u.username === username)) { alert('Usuario ya existe'); return; }
    const passwordHash = await Security.hashPassword(pw);
    state.DB.users.push({ id: uid(), username, passwordHash, role, createdAt: now() });
  }
  AuditLog.append(id ? 'USER_UPDATED' : 'USER_CREATED', { username, role, by: state.currentUser.username });
  await saveDB(); 
  if (window.closeModal) window.closeModal('modal-user'); 
  showAdminTab('users');
  if (id === state.currentUser.id) { 
    state.currentUser = state.DB.users.find(u => u.id === id); 
    const label = document.getElementById('current-user-label');
    if (label) label.textContent = state.currentUser.username; 
  }
  if (window.buildNav) window.buildNav(); 
  if (window.showToast) window.showToast('Usuario guardado');
}

export function deleteUser(id) {
  if (id === 'admin') return;
  if (confirm('¿Eliminar usuario?')) { 
    state.DB.users = state.DB.users.filter(u => u.id !== id); 
    saveDB(); 
    showAdminTab('users'); 
  }
}

/* ===== WORKERS TAB ===== */
export function renderWorkersTab(el) {
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:11px">
      <h4 style="color:var(--navy);font-weight:800">Trabajadores</h4>
      <button class="btn btn-sm btn-primary" onclick="openWorkerModal()">➕ Trabajador</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Nombre</th><th>Salario Diario</th><th>Asistencias (mes)</th><th>Saldo</th><th>Acc.</th></tr></thead>
      <tbody>
        ${!state.DB.workers.length ? `<tr><td colspan="5" style="text-align:center;padding:28px;color:var(--g400)">Sin trabajadores</td></tr>` : ''}
        ${state.DB.workers.map(w => {
          const month = new Date().toISOString().slice(0, 7);
          const atts = state.DB.attendance.filter(a => {
            const u = state.DB.users.find(u => u.id === a.userId && u.username === w.userId);
            return u && a.date.startsWith(month);
          });
          const days = atts.length, total = days * w.dailyRate;
          const paid = state.DB.workerPayments.filter(p => p.workerId === w.id && p.date.startsWith(month)).reduce((s, p) => s + p.amount, 0);
          return `<tr>
            <td><strong>${w.name}</strong></td><td>${fmt(w.dailyRate)}</td><td>${days} días</td>
            <td class="font-bold ${total - paid > 0 ? 'text-coral' : ''}">${fmt(total - paid)}</td>
            <td>
              <button class="btn btn-xs btn-secondary" onclick="openWorkerModal('${w.id}')">✏️</button>
              <button class="btn btn-xs btn-primary" onclick="payWorker('${w.id}')">💰 Pagar</button>
              <button class="btn btn-xs btn-danger" onclick="deleteWorker('${w.id}')">🗑️</button>
            </td></tr>`;
        }).join('')}
      </tbody>
    </table></div>
    ${state.DB.workerPayments.length ? `
      <h4 style="margin:18px 0 11px;color:var(--navy);font-weight:800">Historial de Pagos</h4>
      <div class="table-wrap"><table>
        <thead><tr><th>Fecha</th><th>Trabajador</th><th>Monto</th><th>Período</th></tr></thead>
        <tbody>
          ${state.DB.workerPayments.map(p => {
            const w = state.DB.workers.find(x => x.id === p.workerId);
            return `<tr><td>${fmtDate(p.date)}</td><td>${w?.name || '—'}</td><td class="text-mint font-bold">${fmt(p.amount)}</td><td>${p.period || '—'}</td></tr>`;
          }).join('')}
        </tbody>
      </table></div>` : ''}`;
}

export function openWorkerModal(id) {
  const w = id ? state.DB.workers.find(x => x.id === id) : null;
  const users = state.DB.users.filter(u => u.role === 'seller');
  const inner = document.getElementById('modal-worker-inner');
  if (inner) {
    inner.innerHTML = `
      <div class="modal-header"><h3 class="modal-title">${w ? 'Editar' : 'Nuevo'} Trabajador</h3><button class="modal-close" onclick="closeModal('modal-worker')">×</button></div>
      <div class="modal-body">
        <div class="form-group"><label>Nombre completo</label><input type="text" id="wk-name" value="${w?.name || ''}"></div>
        <div class="form-group"><label>Usuario vinculado</label>
          <select id="wk-user">
            <option value="">— Sin vincular —</option>
            ${users.map(u => `<option value="${u.username}" ${w?.userId === u.username ? 'selected' : ''}>${u.username}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Salario diario</label><input type="number" id="wk-rate" value="${w?.dailyRate || ''}" min="0" step="0.01"></div>
        <div class="form-group"><label>Fecha inicio</label><input type="date" id="wk-start" value="${w?.startDate || today()}"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('modal-worker')">Cancelar</button>
        <button class="btn btn-primary" onclick="saveWorker('${id || ''}')">Guardar</button>
      </div>`;
  }
  if (window.openModal) window.openModal('modal-worker');
}

export async function saveWorker(id) {
  const name = document.getElementById('wk-name').value.trim();
  const userId = document.getElementById('wk-user').value;
  const dailyRate = parseFloat(document.getElementById('wk-rate').value);
  const startDate = document.getElementById('wk-start').value;
  if (!name || isNaN(dailyRate)) { alert('Completa nombre y salario'); return; }
  if (id) {
    const w = state.DB.workers.find(x => x.id === id);
    if (w) Object.assign(w, { name, userId, dailyRate, startDate });
  } else {
    state.DB.workers.push({ id: uid(), name, userId, dailyRate, startDate });
  }
  await saveDB(); 
  if (window.closeModal) window.closeModal('modal-worker'); 
  showAdminTab('workers');
}

export async function payWorker(workerId) {
  const w = state.DB.workers.find(x => x.id === workerId); 
  if (!w) return;
  const month = new Date().toISOString().slice(0, 7);
  const atts = state.DB.attendance.filter(a => {
    const u = state.DB.users.find(u => u.username === w.userId);
    return u && a.userId === u.id && a.date.startsWith(month);
  });
  const days = atts.length, suggested = days * w.dailyRate;
  const paid = state.DB.workerPayments.filter(p => p.workerId === workerId && p.date.startsWith(month)).reduce((s, p) => s + p.amount, 0);
  const pending = suggested - paid;
  const amount = parseFloat(prompt(`Pagar a ${w.name}\nDías: ${days} | Diario: ${fmt(w.dailyRate)} | Pendiente: ${fmt(pending)}\nMonto:`, pending));
  if (isNaN(amount) || amount <= 0) return;
  state.DB.workerPayments.push({ id: uid(), workerId, amount, date: now(), period: month, days, dailyRate: w.dailyRate });
  state.DB.cashFlow.currentCash -= amount;
  AuditLog.append('WORKER_PAID', { worker: w.name, amount, period: month, by: state.currentUser.username });
  await saveDB(); 
  showAdminTab('workers'); 
  if (window.showToast) window.showToast(`Pago de ${fmt(amount)} registrado para ${w.name}`);
}

export function deleteWorker(id) {
  if (confirm('¿Eliminar trabajador?')) {
    state.DB.workers = state.DB.workers.filter(w => w.id !== id);
    saveDB();
    showAdminTab('workers');
  }
}

/* ===== DELETED RECORDS TAB ===== */
export function renderDeletedTab(el) {
  const delO = state.DB.deletedRecords.orders || [];
  const delS = state.DB.deletedRecords.salesItems || [];
  const delC = state.DB.deletedRecords.clients || [];

  function itemsBlock(items) {
    if (!items || !items.length) return `<em style="color:var(--g400);font-size:.78rem">Sin detalle de items guardado</em>`;
    const total = items.reduce((s, i) => s + (i.qty * (i.price || 0)), 0);
    return `
      <div style="background:var(--g50);border-radius:8px;padding:10px;margin-top:8px;border:1px solid var(--g200)">
        <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--g400);margin-bottom:6px">Lo que tenía ordenado</div>
        ${items.map(i => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px dotted var(--g200);font-size:.83rem">
            <span style="flex:1"><strong>${i.qty}×</strong> ${i.name}</span>
            <span style="color:var(--g400);margin:0 8px;font-size:.78rem">Q ${(i.price || 0).toFixed(2)} c/u</span>
            <span style="font-weight:700;min-width:55px;text-align:right">Q ${((i.qty || 0) * (i.price || 0)).toFixed(2)}</span>
            <span style="margin-left:8px;font-size:.68rem;padding:1px 6px;border-radius:20px;background:var(--g100);color:var(--g600)">${i.itemStatus || '—'}</span>
          </div>`).join('')}
        <div style="display:flex;justify-content:flex-end;padding-top:6px;font-weight:800;font-size:.88rem;color:var(--navy)">
          Total aprox: Q ${total.toFixed(2)}
        </div>
      </div>`;
  }

  window._toggleDelDetail = (id) => {
    const d = document.getElementById(id);
    if (d) { d.style.display = d.style.display === 'none' ? 'block' : 'none'; }
  };

  el.innerHTML = `
    <div class="alert alert-warn">🔒 Sección de auditoría — solo visible para administradores. Registros inmutables.</div>

    <!-- ÓRDENES CANCELADAS / ELIMINADAS -->
    <h4 style="margin:0 0 11px;color:var(--navy);font-weight:800">
      Órdenes Canceladas / Eliminadas
      <span style="font-size:.76rem;font-weight:400;color:var(--g400);margin-left:6px">${delO.length} registro(s)</span>
    </h4>
    <div style="margin-bottom:22px">
      ${!delO.length
        ? `<div style="text-align:center;padding:20px;color:var(--g400);background:var(--white);border-radius:var(--r);border:1px solid var(--g200)">Sin registros</div>`
        : delO.map((o, i) => {
            const tbl = getTable(o.tableId);
            const usr = state.DB.users.find(u => u.id === o.deletedBy);
            const creador = state.DB.users.find(u => u.id === o.createdBy);
            const label = o.action === 'deleted'
              ? `<span class="status" style="background:#fee2e2;color:#991b1b">🗑️ Eliminada</span>`
              : `<span class="status" style="background:#fef3c7;color:#92400e">❌ Cancelada</span>`;
            const dId = 'do_' + i;
            return `
              <div class="deleted-record" style="background:var(--white);border:1px solid var(--g200);border-radius:10px;padding:12px 14px;margin-bottom:8px">
                <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px">
                  ${label}
                  <span style="font-weight:700;color:var(--navy)">${tbl?.name || 'Mesa ?'}</span>
                  ${o.clientName ? `<span class="client-tag">${o.clientName}</span>` : ''}
                  <span style="font-size:.78rem;color:var(--g400)">${fmtDate(o.deletedAt)}</span>
                  <span style="font-size:.78rem;color:var(--g600);margin-left:auto">Canceló: <strong>${usr?.username || '—'}</strong></span>
                  <button onclick="_toggleDelDetail('${dId}')"
                    style="background:var(--mint-light);color:var(--mint-dark);border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:.78rem;font-weight:700">
                    👁 Ver items
                  </button>
                </div>
                ${o.reason ? `<div style="margin-top:5px;font-size:.78rem;color:var(--coral)">⚠️ Motivo: ${o.reason}</div>` : ''}
                ${o.createdBy ? `<div style="margin-top:3px;font-size:.75rem;color:var(--g400)">Creada por: ${creador?.username || '—'} · ${fmtDate(o.createdAt)}</div>` : ''}
                <div id="${dId}" style="display:none">
                  ${itemsBlock(o.items)}
                  ${o.notes ? `<div style="margin-top:6px;font-size:.78rem;padding:5px 8px;background:var(--gold);border-radius:5px;color:var(--navy)">📝 Nota: ${o.notes}</div>` : ''}
                </div>
              </div>`;
          }).join('')}
    </div>

    <!-- VENTAS ELIMINADAS -->
    <h4 style="margin:0 0 11px;color:var(--navy);font-weight:800">
      Ventas Eliminadas
      <span style="font-size:.76rem;font-weight:400;color:var(--g400);margin-left:6px">${delS.length} registro(s)</span>
    </h4>
    <div style="margin-bottom:22px">
      ${!delS.length
        ? `<div style="text-align:center;padding:20px;color:var(--g400);background:var(--white);border-radius:var(--r);border:1px solid var(--g200)">Sin registros</div>`
        : delS.map((s, i) => {
            const tbl = getTable(s.tableId);
            const usr = state.DB.users.find(u => u.id === s.deletedBy);
            const dId = 'ds_' + i;
            const sItems = (s.ordersSnapshot || []).flatMap(o => o.items || []);
            return `
              <div class="deleted-record" style="background:var(--white);border:1px solid var(--g200);border-radius:10px;padding:12px 14px;margin-bottom:8px">
                <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px">
                  <span class="status status-paid">🗑️ Eliminada</span>
                  <span style="font-weight:700;color:var(--navy)">${tbl?.name || '—'}</span>
                  ${s.clientName ? `<span class="client-tag">${s.clientName}</span>` : ''}
                  <span style="font-size:.78rem;color:var(--g400)">${fmtDate(s.date)}</span>
                  <span style="font-weight:700;color:var(--coral)">${fmt(s.total)}</span>
                  <span style="font-size:.8rem">${methodLabel(s.paymentMethod)}</span>
                  <span style="font-size:.78rem;color:var(--g600);margin-left:auto">Eliminó: <strong>${usr?.username || '—'}</strong></span>
                  ${sItems.length ? `<button onclick="_toggleDelDetail('${dId}')"
                    style="background:var(--mint-light);color:var(--mint-dark);border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:.78rem;font-weight:700">
                    👁 Ver items
                  </button>` : ''}
                </div>
                <div id="${dId}" style="display:none">
                  ${itemsBlock(sItems)}
                  <div style="display:flex;gap:16px;margin-top:6px;font-size:.78rem;color:var(--g600)">
                    <span>Subtotal: ${fmt(s.subtotal || s.total)}</span>
                    ${(s.commission || 0) > 0 ? `<span>Comisión: ${fmt(s.commission)}</span>` : ''}
                    <span style="font-weight:700;color:var(--navy)">Total: ${fmt(s.total)}</span>
                  </div>
                </div>
              </div>`;
          }).join('')}
    </div>

    <!-- CLIENTES REMOVIDOS -->
    <h4 style="margin:0 0 11px;color:var(--navy);font-weight:800">
      Clientes Removidos
      <span style="font-size:.76rem;font-weight:400;color:var(--g400);margin-left:6px">${delC.length} registro(s)</span>
    </h4>
    <div>
      ${!delC.length
        ? `<div style="text-align:center;padding:20px;color:var(--g400);background:var(--white);border-radius:var(--r);border:1px solid var(--g200)">Sin registros</div>`
        : delC.map((c, i) => {
            const tbl = getTable(c.tableId);
            const usr = state.DB.users.find(u => u.id === c.removedBy);
            const creador = state.DB.users.find(u => u.id === c.orderCreatedBy);
            const dId = 'dc_' + i;
            const items = c.itemsSnapshot || [];
            return `
              <div class="deleted-record" style="background:var(--white);border:1px solid var(--g200);border-left:4px solid var(--coral);border-radius:10px;padding:12px 14px;margin-bottom:8px">
                <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px">
                  <span class="client-tag" style="font-size:.88rem;font-weight:800">👤 ${c.clientName}</span>
                  <span style="font-weight:600;color:var(--navy)">${tbl?.name || '—'}</span>
                  <span style="font-size:.78rem;color:var(--g400)">${fmtDate(c.removedAt)}</span>
                  <span style="font-size:.78rem;color:var(--g600);margin-left:auto">Removió: <strong>${usr?.username || '—'}</strong></span>
                  ${items.length ? `<button onclick="_toggleDelDetail('${dId}')"
                    style="background:#fdf0ec;color:var(--coral);border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:.78rem;font-weight:700">
                    🍽 Ver lo que ordenó
                  </button>` : ''}
                </div>
                ${c.reason ? `<div style="margin-top:5px;font-size:.78rem;color:var(--coral)">⚠️ Motivo: ${c.reason}</div>` : ''}
                ${creador ? `<div style="margin-top:3px;font-size:.75rem;color:var(--g400)">Orden creada por: ${creador.username} · ${fmtDate(c.orderCreatedAt)} · Estado: ${c.orderStatus || '—'}</div>` : ''}
                <div id="${dId}" style="display:none">
                  ${itemsBlock(items)}
                  ${c.orderNotes ? `<div style="margin-top:6px;font-size:.78rem;padding:5px 8px;background:var(--gold);border-radius:5px;color:var(--navy)">📝 Nota: ${c.orderNotes}</div>` : ''}
                </div>
              </div>`;
          }).join('')}
    </div>`;
}

/* ===== AUDIT LOG TAB ===== */
export function renderAuditTab(el) {
  const log = (state.DB.auditLog || []).slice().reverse().slice(0, 200);
  el.innerHTML = `
    <div class="alert alert-info">🔒 Bitácora de auditoría — registros inmutables, no se pueden eliminar.</div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:11px">
      <button class="btn btn-sm btn-secondary" onclick="exportAuditLog()">⬇️ Exportar Bitácora</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Fecha/Hora</th><th>Usuario</th><th>Acción</th><th>Detalles</th></tr></thead>
      <tbody>
        ${!log.length ? `<tr><td colspan="4" style="text-align:center;padding:18px;color:var(--g400)">Sin registros</td></tr>` : ''}
        ${log.map(e => `<tr>
          <td style="white-space:nowrap;font-size:.8rem">${fmtDate(e.ts)}</td>
          <td><strong>${e.username}</strong></td>
          <td><span class="audit-badge">${e.action}</span></td>
          <td style="font-size:.8rem;color:var(--g600)">${JSON.stringify(e.details || {}).slice(0, 120)}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
}

export function exportAuditLog() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const blob = new Blob([JSON.stringify(state.DB.auditLog, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); 
  a.download = `LaOla_Bitacora_${ts}.json`;
  a.click(); 
  URL.revokeObjectURL(a.href);
}

/* ===== REPORTS TAB ===== */
export function renderReportsTab(el) {
  el.innerHTML = `
    <div class="card mb-4">
      <h4 style="color:var(--navy);margin-bottom:14px;font-weight:800">Generar Reporte</h4>
      <div class="form-row">
        <div class="form-group"><label>Tipo de reporte</label>
          <select id="rpt-type">
            <option value="daily">Diario</option>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensual</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>
        <div class="form-group"><label>Vendedor</label>
          <select id="rpt-seller">
            <option value="">Todos</option>
            ${state.DB.users.map(u => `<option value="${u.id}">${u.username}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row" id="custom-dates" style="display:none">
        <div class="form-group"><label>Desde</label><input type="date" id="rpt-from" value="${today()}"></div>
        <div class="form-group"><label>Hasta</label><input type="date" id="rpt-to" value="${today()}"></div>
      </div>
      <button class="btn btn-primary" onclick="generateReport()">📊 Ver Reporte</button>
    </div>
    <div id="report-output"></div>`;
  
  const rptSelect = document.getElementById('rpt-type');
  if (rptSelect) {
    rptSelect.addEventListener('change', e => {
      const cd = document.getElementById('custom-dates');
      if (cd) cd.style.display = e.target.value === 'custom' ? 'grid' : 'none';
    });
  }
}

export function getDateRange(type) {
  const d = new Date();
  if (type === 'daily') return [today(), today()];
  if (type === 'weekly') { 
    const f = new Date(d); 
    f.setDate(d.getDate() - 7); 
    return [f.toISOString().split('T')[0], today()]; 
  }
  if (type === 'monthly') { 
    const f = new Date(d.getFullYear(), d.getMonth(), 1); 
    return [f.toISOString().split('T')[0], today()]; 
  }
  return [document.getElementById('rpt-from')?.value || today(), document.getElementById('rpt-to')?.value || today()];
}

export function generateReport() {
  const type = document.getElementById('rpt-type').value;
  const seller = document.getElementById('rpt-seller').value;
  const [from, to] = getDateRange(type);
  let sales = state.DB.sales.filter(s => s.date.split('T')[0] >= from && s.date.split('T')[0] <= to);
  if (seller) sales = sales.filter(s => s.createdBy === seller);
  let expenses = state.DB.expenses.filter(e => e.date.split('T')[0] >= from && e.date.split('T')[0] <= to);
  
  const totalSales = sales.reduce((s, x) => s + x.total, 0);
  const totalExp   = expenses.reduce((s, x) => s + x.amount, 0);
  const byCash     = sales.filter(s => s.paymentMethod === 'cash').reduce((s, x) => s + x.total, 0);
  const byCard     = sales.filter(s => s.paymentMethod === 'card').reduce((s, x) => s + x.total, 0);
  const byTrans    = sales.filter(s => s.paymentMethod === 'transfer').reduce((s, x) => s + x.total, 0);
  const byCredit   = sales.filter(s => s.paymentMethod === 'credit').reduce((s, x) => s + x.total, 0);
  
  const catSales = {};
  sales.forEach(s => { 
    s.ordersSnapshot?.forEach(o => { 
      o.items?.forEach(i => { 
        const p = getProduct(i.productId); 
        const cat = getCategory(p?.categoryId); 
        const k = cat?.name || 'Sin categoría'; 
        catSales[k] = (catSales[k] || 0) + i.qty * i.price; 
      }); 
    }); 
  });
  
  const el = document.getElementById('report-output');
  if (el) {
    el.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:7px">
          <h4 style="color:var(--navy);font-weight:800">📊 Reporte ${type === 'daily' ? 'Diario' : type === 'weekly' ? 'Semanal' : type === 'monthly' ? 'Mensual' : 'Personalizado'} — ${from} a ${to}</h4>
          <button class="btn btn-sm btn-secondary" onclick="printReport()">🖨️ Imprimir</button>
        </div>
        <div class="cards-grid">
          <div class="card card-accent-mint"><div class="card-title">Total Ventas</div><div class="card-value">${fmt(totalSales)}</div><div class="card-sub">${sales.length} transacciones</div></div>
          <div class="card card-accent-coral"><div class="card-title">Egresos</div><div class="card-value">${fmt(totalExp)}</div></div>
          <div class="card card-accent-gold"><div class="card-title">Utilidad</div><div class="card-value">${fmt(totalSales - totalExp)}</div></div>
        </div>
        <div class="form-row mt-4">
          <div>
            <h5 style="color:var(--navy);margin-bottom:11px;font-weight:700">Por Método de Pago</h5>
            <div class="order-total-row"><span>💵 Efectivo</span><span class="font-bold">${fmt(byCash)}</span></div>
            <div class="order-total-row"><span>💳 Tarjeta</span><span class="font-bold">${fmt(byCard)}</span></div>
            <div class="order-total-row"><span>📱 Transferencia</span><span class="font-bold">${fmt(byTrans)}</span></div>
            <div class="order-total-row"><span>📋 Crédito</span><span class="font-bold">${fmt(byCredit)}</span></div>
          </div>
          <div>
            <h5 style="color:var(--navy);margin-bottom:11px;font-weight:700">Por Categoría</h5>
            ${Object.entries(catSales).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="order-total-row"><span>${k}</span><span class="font-bold">${fmt(v)}</span></div>`).join('')}
            ${!Object.keys(catSales).length ? `<p class="text-gray text-sm">Sin datos</p>` : ''}
          </div>
        </div>
        ${sales.length ? `
          <h5 style="color:var(--navy);margin:18px 0 11px;font-weight:700">Detalle de Ventas</h5>
          <div class="table-wrap"><table>
            <thead><tr><th>Fecha</th><th>Mesa</th><th>Total</th><th>Método</th><th>Vendedor</th></tr></thead>
            <tbody>
              ${sales.map(s => {
                const tbl = getTable(s.tableId);
                const sel = state.DB.users.find(u => u.id === s.createdBy);
                return `<tr><td>${fmtDate(s.date)}</td><td>${tbl?.name || '—'}</td><td class="text-mint font-bold">${fmt(s.total)}</td><td>${methodLabel(s.paymentMethod)}</td><td>${sel?.username || '—'}</td></tr>`;
              }).join('')}
            </tbody>
          </table></div>` : ''}
      </div>`;
  }
}

export function printReport() {
  const content = document.getElementById('report-output')?.innerHTML;
  if (!content) return;
  const w = window.open('', '_blank');
  if (w) {
    w.document.write(`<html><head><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px}.card{border:1px solid #ddd;padding:14px;margin:7px 0;border-radius:7px}</style></head><body>${content}</body></html>`);
    w.document.close(); 
    w.print();
  }
}

/* ===== BACKUP TAB ===== */
export function renderBackupTab(el) {
  const lastBk = localStorage.getItem('laola_last_backup');
  const systemIntegrity = verifyIntegrity();
  el.innerHTML = `
    <div class="card mb-4">
      <h4 style="color:var(--navy);margin-bottom:14px;font-weight:800">💾 Respaldo del Sistema</h4>
      <div class="alert ${systemIntegrity ? 'alert-success' : 'alert-error'} mb-3">
        ${systemIntegrity ? '✅ Integridad del sistema: <strong>OK</strong>' : '⚠️ Se detectaron problemas de integridad. Respalde inmediatamente.'}
      </div>
      ${lastBk ? `<div class="alert alert-info mb-3">Último respaldo: ${fmtDate(lastBk)}</div>` : ''}
      <p class="text-gray text-sm mb-3">El respaldo incluye checksum SHA para verificar integridad al importar.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="exportBackup()">⬇️ Exportar Respaldo (.json)</button>
        <button class="btn btn-secondary" onclick="document.getElementById('import-file').click()">⬆️ Importar Respaldo</button>
        <input type="file" id="import-file" accept=".json" style="display:none" onchange="importBackup(this)">
      </div>
    </div>
    <div class="card mb-4">
      <h4 style="color:var(--navy);margin-bottom:11px;font-weight:800">ℹ️ Información del Sistema</h4>
      <div class="order-total-row"><span>Versión App</span><span>v${APP_VERSION}</span></div>
      <div class="order-total-row"><span>Versión Esquema</span><span>v${state.DB.schemaVersion}</span></div>
      <div class="order-total-row"><span>Total ventas</span><span>${state.DB.sales.length}</span></div>
      <div class="order-total-row"><span>Total egresos</span><span>${state.DB.expenses.length}</span></div>
      <div class="order-total-row"><span>Total órdenes</span><span>${state.DB.orders.length}</span></div>
      <div class="order-total-row"><span>Usuarios</span><span>${state.DB.users.length}</span></div>
      <div class="order-total-row"><span>Registros de auditoría</span><span>${(state.DB.auditLog || []).length}</span></div>
      <div class="order-total-row"><span>Productos en menú</span><span>${(state.DB.menu?.products || []).length}</span></div>
    </div>
    <div class="card">
      <h4 style="color:var(--navy);margin-bottom:11px;font-weight:800">🔧 Registros de Error del Sistema</h4>
      <div style="font-size:.8rem;color:var(--g600);max-height:200px;overflow-y:auto;background:var(--g50);padding:10px;border-radius:7px;font-family:monospace">
        ${ErrorHandler.getLogs().slice(-30).reverse().map(e => `<div>${e.ts.slice(0, 19)} — ${e.msg}${e.err ? ' | ' + e.err : ''}</div>`).join('') || 'Sin errores registrados'}
      </div>
    </div>`;
}

export async function exportBackup() {
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `CoffeeShopPOS_backup_${ts}.json`;
    const payload = {
      exportedAt: now(),
      exportedBy: state.currentUser.username,
      appVersion: APP_VERSION,
      schemaVersion: SCHEMA_VERSION,
      data: state.DB
    };
    payload.checksum = Security.generateChecksum(payload.data);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); 
    a.href = URL.createObjectURL(blob); 
    a.download = filename;
    a.click(); 
    URL.revokeObjectURL(a.href);
    localStorage.setItem('laola_last_backup', now());
    AuditLog.append('BACKUP_EXPORTED', { filename, by: state.currentUser.username });
    await saveDB();
    if (window.showToast) window.showToast('✅ Respaldo exportado: ' + filename);
    showAdminTab('backup');
  } catch (e) {
    ErrorHandler.log('exportBackup error', e);
    if (window.showToast) window.showToast('⚠️ Error al exportar respaldo', 4000);
  }
}

export async function importBackup(input) {
  const file = input.files[0]; 
  if (!file) return;
  if (!confirm('⚠️ Importar sobrescribirá TODOS los datos actuales. ¿Continuar?')) { input.value = ''; return; }
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const payload = JSON.parse(e.target.result);
      let data = payload.data || payload;
      if (!data.schemaVersion) throw new Error('Archivo inválido: sin schemaVersion');
      
      if (payload.checksum) {
        const expectedChecksum = Security.generateChecksum(data);
        if (expectedChecksum !== payload.checksum) {
          if (!confirm('⚠️ El checksum no coincide. El archivo puede estar corrupto. ¿Importar de todas formas?')) return;
        }
      }
      const migrated = migrateData(data);
      state.DB = migrated;
      AuditLog.append('BACKUP_IMPORTED', { importedBy: state.currentUser.username, originalExport: payload.exportedAt || 'unknown' });
      await saveDB();
      if (window.showToast) window.showToast('✅ Respaldo importado exitosamente');
      if (window.showApp) window.showApp();
    } catch (err) {
      ErrorHandler.log('importBackup error', err);
      alert('Error al importar: ' + err.message);
    }
  };
  reader.readAsText(file);
}

/* ===== ACCOUNTING TAB ===== */
export function renderAccountingTab(el) {
  const allS = state.DB.sales, allE = state.DB.expenses;
  const tI = allS.reduce((s, x) => s + x.total, 0);
  const tE = allE.reduce((s, x) => s + x.amount, 0);
  const wP = state.DB.workerPayments.reduce((s, p) => s + p.amount, 0);
  const net = tI - tE - wP;
  
  el.innerHTML = `
    <div class="cards-grid mb-4">
      <div class="card card-accent-mint"><div class="card-title">Ingresos Totales</div><div class="card-value">${fmt(tI)}</div></div>
      <div class="card card-accent-coral"><div class="card-title">Egresos Operativos</div><div class="card-value">${fmt(tE)}</div></div>
      <div class="card card-accent-gold"><div class="card-title">Nómina Pagada</div><div class="card-value">${fmt(wP)}</div></div>
      <div class="card card-accent-navy"><div class="card-title">Utilidad Neta</div><div class="card-value" style="${net >= 0 ? 'color:var(--mint-dark)' : 'color:var(--coral)'}">${fmt(net)}</div></div>
    </div>
    <div class="form-row">
      <div>
        <h4 style="color:var(--navy);margin-bottom:11px;font-weight:800">📒 Libro Diario (últimas 20)</h4>
        <div class="table-wrap"><table>
          <thead><tr><th>Fecha</th><th>Descripción</th><th>Debe</th><th>Haber</th></tr></thead>
          <tbody>
            ${state.DB.accounting.journal.slice(-20).reverse().map(e => `<tr>
              <td>${fmtDate(e.date)}</td><td>${e.desc}</td>
              <td class="text-mint">${e.debit > 0 ? fmt(e.debit) : ''}</td>
              <td class="text-coral">${e.credit > 0 ? fmt(e.credit) : ''}</td>
            </tr>`).join('')}
            ${!state.DB.accounting.journal.length ? `<tr><td colspan="4" style="text-align:center;padding:18px;color:var(--g400)">Sin movimientos</td></tr>` : ''}
          </tbody>
        </table></div>
      </div>
      <div>
        <h4 style="color:var(--navy);margin-bottom:11px;font-weight:800">📊 Estado de Resultados</h4>
        <div class="card">
          <div style="font-weight:700;margin-bottom:7px;color:var(--navy)">INGRESOS</div>
          <div class="order-total-row"><span>Ventas Efectivo</span><span>${fmt(allS.filter(s => s.paymentMethod === 'cash').reduce((s, x) => s + x.total, 0))}</span></div>
          <div class="order-total-row"><span>Ventas Tarjeta</span><span>${fmt(allS.filter(s => s.paymentMethod === 'card').reduce((s, x) => s + x.total, 0))}</span></div>
          <div class="order-total-row"><span>Transferencias</span><span>${fmt(allS.filter(s => s.paymentMethod === 'transfer').reduce((s, x) => s + x.total, 0))}</span></div>
          <div class="order-total-row final"><span>TOTAL INGRESOS</span><span class="text-mint">${fmt(tI)}</span></div>
          <div class="divider"></div>
          <div style="font-weight:700;margin-bottom:7px;color:var(--navy)">EGRESOS</div>
          <div class="order-total-row"><span>Compras / Materia Prima</span><span>${fmt(tE)}</span></div>
          <div class="order-total-row"><span>Nómina</span><span>${fmt(wP)}</span></div>
          <div class="order-total-row final"><span>TOTAL EGRESOS</span><span class="text-coral">${fmt(tE + wP)}</span></div>
          <div class="divider"></div>
          <div class="order-total-row final" style="font-size:1.1rem"><span>UTILIDAD NETA</span><span style="${net >= 0 ? 'color:var(--mint-dark)' : 'color:var(--coral)'}">${fmt(net)}</span></div>
        </div>
      </div>
    </div>`;
}

export function renderConfigTab(el) {
  const cfg = state.DB.config || {};
  el.innerHTML = `
    <div class="card" style="max-width:520px">
      <h4 style="color:var(--navy);font-weight:800;margin-bottom:12px">Configuración de empresa</h4>
      <div class="form-group"><label>Nombre de la empresa</label><input type="text" id="cfg-company" value="${cfg.companyName || 'Restar Chach App'}"></div>
      <div class="form-group"><label>Logo para recibos (URL)</label><input type="text" id="cfg-logo" value="${cfg.logoUrl || './logo-blanco.png'}"></div>
      <div class="form-group"><label>Subir logo</label><input type="file" id="cfg-logo-file" accept="image/*" onchange="handleLogoUpload(this)"></div>
      <button class="btn btn-primary" onclick="saveConfig()">Guardar</button>
    </div>`;
}

export function handleLogoUpload(input) {
  const file = input?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const url = e.target.result;
    const el = document.getElementById('cfg-logo');
    if (el) el.value = url;
  };
  reader.readAsDataURL(file);
}

export async function saveConfig() {
  state.DB.config = state.DB.config || {};
  state.DB.config.companyName = document.getElementById('cfg-company')?.value || 'Restar Chach App';
  state.DB.config.logoUrl = document.getElementById('cfg-logo')?.value || './logo-blanco.png';
  await saveDB();
  if (window.showToast) window.showToast('Configuración guardada');
}

// Bind to window for global inline HTML onclick handlers
window.renderAdmin = renderAdmin;
window.switchAdminTab = switchAdminTab;
window.showAdminTab = showAdminTab;
window.openCatModal = openCatModal;
window.saveCat = saveCat;
window.deleteCat = deleteCat;
window.openProductModal = openProductModal;
window.saveProduct = saveProduct;
window.deleteProduct = deleteProduct;
window.openUserModal = openUserModal;
window.togglePw = togglePw;
window.saveUser = saveUser;
window.deleteUser = deleteUser;
window.openWorkerModal = openWorkerModal;
window.saveWorker = saveWorker;
window.payWorker = payWorker;
window.deleteWorker = deleteWorker;
window.exportAuditLog = exportAuditLog;
window.saveConfig = saveConfig;
window.handleLogoUpload = handleLogoUpload;
window.generateReport = generateReport;
window.printReport = printReport;
window.exportBackup = exportBackup;
window.importBackup = importBackup;
window.openInventoryModal = openInventoryModal;
window.saveInventoryItem = saveInventoryItem;
window.deleteInventoryItem = deleteInventoryItem;
window.openRecipeModal = openRecipeModal;
window.saveRecipe = saveRecipe;
window.addRecipeIngredientRow = addRecipeIngredientRow;
window.removeRecipeIngredient = removeRecipeIngredient;
window.saveRecipeMargin = saveRecipeMargin;
window.updateRecipeLineCost = updateRecipeLineCost;
window.updateRecipeTotalCost = updateRecipeTotalCost;
