/**
 * User authentication utilities for PrompterAid
 * 
 * This module provides centralized user authentication functions
 * to eliminate code duplication across the application.
 */

import { supabase } from './supabaseClient.js';

/**
 * Get the current authenticated user from Supabase
 * @returns {Promise<Object|null>} User object or null if not authenticated
 */
export async function getCurrentUser() {
  try {
    const { data } = await supabase.auth.getUser();
    return data && data.user ? data.user : null;
  } catch (error) {
    console.warn('Error getting current user:', error);
    return null;
  }
}

/**
 * Check if a user is currently authenticated
 * @returns {Promise<boolean>} True if user is logged in, false otherwise
 */
export async function isUserLoggedIn() {
  const user = await getCurrentUser();
  return user !== null;
}

/**
 * Get user ID safely (returns null if not logged in)
 * @returns {Promise<string|null>} User ID or null if not authenticated
 */
export async function getCurrentUserId() {
  const user = await getCurrentUser();
  return user ? user.id : null;
} 