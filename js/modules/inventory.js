// js/modules/inventory.js
// Inventory Management Module
// Handles stock deduction on sales and low‑stock alerts.

import { state } from '../services/state.js';
import { saveDB } from '../services/database.js';
import { AuditLog } from '../services/audit.js';
import { showToast } from './ui.js';
import { getRecipe } from './recipes.js';

/**
 * Deduct inventory quantities based on sold items.
 * @param {Array} orderItems - Array of items from orders being charged.
 *   Each item should have { productId, qty }.
 *   The function looks up the recipe for the product to know which
 *   inventory items and amounts to subtract.
 */
export async function deductInventoryForSale(orderItems) {
  if (!Array.isArray(orderItems) || orderItems.length === 0) return;

  const inventory = state.DB.inventory || [];
  const lowStockItems = [];

  // Helper to find inventory entry by id
  const findInv = (id) => inventory.find(i => i.id === id);

  // Iterate each sold item
  for (const soldItem of orderItems) {
    const { productId, qty } = soldItem;
    if (!productId || !qty) continue;

    const recipe = getRecipe(productId);
    if (!recipe || !Array.isArray(recipe.ingredients)) continue;

    // For each ingredient, compute total amount to deduct
    for (const ingr of recipe.ingredients) {
      const invItem = findInv(ingr.inventoryId);
      if (!invItem) continue;
      const toDeduct = (ingr.amount || 0) * qty; // amount per unit * quantity sold
      invItem.quantity = Math.max(0, (invItem.quantity || 0) - toDeduct);
      // Record low‑stock if below threshold after deduction
      if (invItem.lowThreshold != null && invItem.quantity <= invItem.lowThreshold) {
        lowStockItems.push(invItem);
      }
    }
  }

  // Persist changes
  await saveDB();

  // Audit log for stock movement
  AuditLog.append('INVENTORY_DEDUCTED', {
    itemsDeducted: orderItems.map(i => ({ productId: i.productId, qty: i.qty })),
    performedBy: state.currentUser?.username || 'system'
  });

  // Notify user of low stock items
  if (lowStockItems.length) {
    const names = lowStockItems.map(i => i.name || i.id).join(', ');
    if (showToast) {
      showToast(`⚠️ Stock bajo: ${names}`, 8000);
    }
  }
}

/**
 * Utility to manually adjust inventory quantity.
 * Used by admin UI when adding/editing inventory items.
 */
export async function adjustInventory(itemId, newQuantity) {
  const inv = state.DB.inventory.find(i => i.id === itemId);
  if (!inv) return;
  inv.quantity = newQuantity;
  await saveDB();
  AuditLog.append('INVENTORY_ADJUSTED', { itemId, newQuantity, by: state.currentUser?.username });
}

/**
 * Returns the current inventory list (read‑only copy).
 */
export function listInventory() {
  return (state.DB.inventory || []).map(i => ({ ...i }));
}

/**
 * Checks all inventory items for low stock and shows a toast if any.
 * Can be called after any DB mutation or on app start.
 */
export function checkLowStockAlerts() {
  const low = (state.DB.inventory || []).filter(i => i.lowThreshold != null && i.quantity <= i.lowThreshold);
  if (low.length && showToast) {
    const names = low.map(i => i.name || i.id).join(', ');
    showToast(`⚠️ Stock bajo: ${names}`, 8000);
  }
}
