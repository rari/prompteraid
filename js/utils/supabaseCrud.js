// Generic Supabase CRUD Utility
// Usage: import { createItem, readItems, updateItem, deleteItem } from './supabaseCrud.js';

/**
 * @param {object} supabase - Supabase client instance
 * @param {string} table - Table name
 * @param {object} values - Row values to insert
 * @returns {Promise<{data, error}>}
 */
export async function createItem(supabase, table, values) {
  console.debug(`[CRUD] createItem: table=${table}`, values);
  const { data, error } = await supabase.from(table).insert(values).select();
  console.debug(`[CRUD] createItem result: data=`, JSON.stringify(data, null, 2), 'error=', error);
  return { data, error };
}

/**
 * @param {object} supabase - Supabase client instance
 * @param {string} table - Table name
 * @param {object} [filters] - Optional filters (object of column: value)
 * @returns {Promise<{data, error}>}
 */
export async function readItems(supabase, table, filters = {}) {
  console.debug(`[CRUD] readItems: table=${table}`, filters);
  let query = supabase.from(table).select('*');
  for (const [col, val] of Object.entries(filters)) {
    query = query.eq(col, val);
  }
  const { data, error } = await query;
  console.debug(`[CRUD] readItems result: data=`, JSON.stringify(data, null, 2), 'error=', error);
  return { data, error };
}

/**
 * @param {object} supabase - Supabase client instance
 * @param {string} table - Table name
 * @param {object} match - Filter for rows to update (object of column: value)
 * @param {object} values - Values to update
 * @returns {Promise<{data, error}>}
 */
export async function updateItem(supabase, table, match, values) {
  console.debug(`[CRUD] updateItem: table=${table}`, { match, values });
  let query = supabase.from(table).update(values);
  for (const [col, val] of Object.entries(match)) {
    query = query.eq(col, val);
  }
  const { data, error } = await query.select();
  console.debug(`[CRUD] updateItem result: data=`, JSON.stringify(data, null, 2), 'error=', error);
  return { data, error };
}

/**
 * @param {object} supabase - Supabase client instance
 * @param {string} table - Table name
 * @param {object} match - Filter for rows to delete (object of column: value)
 * @returns {Promise<{data, error}>}
 */
export async function deleteItem(supabase, table, match) {
  console.debug(`[CRUD] deleteItem: table=${table}`, match);
  let query = supabase.from(table).delete();
  for (const [col, val] of Object.entries(match)) {
    query = query.eq(col, val);
  }
  const { data, error } = await query;
  console.debug(`[CRUD] deleteItem result: data=`, JSON.stringify(data, null, 2), 'error=', error);
  return { data, error };
}

/**
 * @param {object} supabase - Supabase client instance
 * @param {string} table - Table name
 * @param {object} match - Filter for rows to delete (object of column: value)
 * @returns {Promise<{data, error}>}
 */
export async function deleteItems(supabase, table, match) {
  console.debug(`[CRUD] deleteItems: table=${table}`, match);
  let query = supabase.from(table).delete();
  for (const [col, val] of Object.entries(match)) {
    query = query.eq(col, val);
  }
  const { data, error } = await query;
  console.debug(`[CRUD] deleteItems result: data=`, JSON.stringify(data, null, 2), 'error=', error);
  return { data, error };
} 