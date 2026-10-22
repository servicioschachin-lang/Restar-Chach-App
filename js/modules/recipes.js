// js/modules/recipes.js
// Recipe Book Module
// Maps products to their ingredient lists for inventory deduction.

import { state } from '../services/state.js';

/**
 * Get the recipe for a given product.
 * @param {string} productId
 * @returns {object|null} Recipe object with { productId, ingredients: [{ inventoryId, amount }] }
 */
export function getRecipe(productId) {
  const recipes = state.DB.recipes || [];
  return recipes.find(r => r.productId === productId) || null;
}

/**
 * Save or update a recipe.
 * @param {object} recipe - { productId, ingredients: [{ inventoryId, amount }] }
 */
export function saveRecipe(recipe) {
  const recipes = state.DB.recipes || [];
  const idx = recipes.findIndex(r => r.productId === recipe.productId);
  if (idx >= 0) {
    recipes[idx] = recipe;
  } else {
    recipes.push(recipe);
  }
}

/**
 * Delete a recipe by productId.
 */
export function deleteRecipe(productId) {
  state.DB.recipes = (state.DB.recipes || []).filter(r => r.productId !== productId);
}

/**
 * List all recipes.
 */
export function listRecipes() {
  return (state.DB.recipes || []).map(r => ({ ...r, ingredients: [...(r.ingredients || [])] }));
}
