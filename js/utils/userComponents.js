/**
 * User Components Manager
 * 
 * Handles saving and loading user prompt configurations
 * using the user_components table in Supabase.
 */

import { supabase } from './supabaseClient.js';

class UserComponentsManager {
  constructor() {
    this.supabase = supabase;
    this.maxComponents = 7;
    this.currentUser = null;
    this.init();
  }

  async init() {
    // Listen for auth state changes
    this.supabase.auth.onAuthStateChange((event, session) => {
      this.currentUser = session?.user || null;
      if (this.currentUser) {
        console.log('UserComponentsManager: User authenticated');
      } else {
        console.log('UserComponentsManager: User signed out');
      }
      
      // Notify UI to update button visibility
      this.notifyAuthStateChange();
    });
  }

  notifyAuthStateChange() {
    // Dispatch custom event for UI to listen to
    const event = new CustomEvent('userAuthStateChanged', {
      detail: { isAuthenticated: this.isAuthenticated() }
    });
    document.dispatchEvent(event);
  }

  /**
   * Save current prompt configuration
   */
  async saveComponent(name = null) {
    if (!this.currentUser) {
      throw new Error('User must be authenticated to save components');
    }

    try {
      // Get current configuration from the gallery controller
      const galleryController = window.galleryController;
      if (!galleryController || !galleryController.model) {
        throw new Error('Gallery controller not available');
      }

      const configuration = {
        basePrompt: galleryController.model.basePrompt || '',
        suffix: galleryController.model.suffix || '',
        aspectRatio: galleryController.model.aspectRatio || '1:1',
        selectedImages: Array.from(galleryController.model.selectedImages || []),
        model: galleryController.model.currentModel || 'niji-6',
        timestamp: new Date().toISOString()
      };

      // Generate name if not provided
      if (!name) {
        name = configuration.basePrompt || `Unknown ${Date.now()}`;
        // Truncate if too long
        if (name.length > 50) {
          name = name.substring(0, 47) + '...';
        }
      }

      // Check if we're at the limit
      const existingComponents = await this.getComponents();
      if (existingComponents.length >= this.maxComponents) {
        throw new Error(`Maximum of ${this.maxComponents} components allowed. Please delete one before saving.`);
      }

      // Insert new component
      const { data, error } = await this.supabase
        .from('user_components')
        .insert({
          user_id: this.currentUser.id,
          name: name,
          configuration: configuration
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving component:', error);
        throw new Error(`Failed to save component: ${error.message}`);
      }

      console.log('Component saved successfully:', data);
      return data;

    } catch (error) {
      console.error('Error in saveComponent:', error);
      throw error;
    }
  }

  /**
   * Load a saved component
   */
  async loadComponent(componentId) {
    if (!this.currentUser) {
      throw new Error('User must be authenticated to load components');
    }

    try {
      const { data, error } = await this.supabase
        .from('user_components')
        .select('*')
        .eq('id', componentId)
        .eq('user_id', this.currentUser.id)
        .single();

      if (error) {
        console.error('Error loading component:', error);
        throw new Error(`Failed to load component: ${error.message}`);
      }

      if (!data) {
        throw new Error('Component not found');
      }

      // Apply the configuration
      await this.applyConfiguration(data.configuration);

      console.log('Component loaded successfully:', data);
      return data;

    } catch (error) {
      console.error('Error in loadComponent:', error);
      throw error;
    }
  }

  /**
   * Get all user components
   */
  async getComponents() {
    if (!this.currentUser) {
      return [];
    }

    try {
      const { data, error } = await this.supabase
        .from('user_components')
        .select('*')
        .eq('user_id', this.currentUser.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching components:', error);
        throw new Error(`Failed to fetch components: ${error.message}`);
      }

      return data || [];

    } catch (error) {
      console.error('Error in getComponents:', error);
      return [];
    }
  }

  /**
   * Delete a component
   */
  async deleteComponent(componentId) {
    if (!this.currentUser) {
      throw new Error('User must be authenticated to delete components');
    }

    try {
      const { error } = await this.supabase
        .from('user_components')
        .delete()
        .eq('id', componentId)
        .eq('user_id', this.currentUser.id);

      if (error) {
        console.error('Error deleting component:', error);
        throw new Error(`Failed to delete component: ${error.message}`);
      }

      console.log('Component deleted successfully');
      return true;

    } catch (error) {
      console.error('Error in deleteComponent:', error);
      throw error;
    }
  }

  /**
   * Apply a configuration to the current state
   */
  async applyConfiguration(configuration) {
    const galleryController = window.galleryController;
    if (!galleryController || !galleryController.model) {
      throw new Error('Gallery controller not available');
    }

    try {
      // Apply base prompt
      if (configuration.basePrompt) {
        galleryController.model.setBasePrompt(configuration.basePrompt);
      }

      // Apply suffix
      if (configuration.suffix) {
        galleryController.model.setSuffix(configuration.suffix);
      }

      // Apply aspect ratio
      if (configuration.aspectRatio) {
        galleryController.model.setAspectRatio(configuration.aspectRatio);
      }

      // Apply selected images
      if (configuration.selectedImages && Array.isArray(configuration.selectedImages)) {
        galleryController.model.selectedImages.clear();
        configuration.selectedImages.forEach(imageId => {
          galleryController.model.selectedImages.add(imageId);
        });
      }

      // Apply model
      if (configuration.model) {
        galleryController.model.currentModel = configuration.model;
      }

      // Update the UI
      galleryController.updatePrompt();
      galleryController.renderGallery();

      // Update UI elements
      if (galleryController.view) {
        // Update prompt input
        const promptInput = document.getElementById('prompt-input');
        if (promptInput && configuration.basePrompt) {
          promptInput.value = configuration.basePrompt;
        }

        // Update suffix input
        const suffixInput = document.getElementById('prompt-suffix');
        if (suffixInput && configuration.suffix) {
          suffixInput.value = configuration.suffix;
        }

        // Update aspect ratio dropdown
        const aspectRatioSelect = document.getElementById('aspect-ratio-select');
        if (aspectRatioSelect && configuration.aspectRatio) {
          aspectRatioSelect.value = configuration.aspectRatio;
        }

        // Update model selector
        if (configuration.model) {
          galleryController.view.handleModelSelection(configuration.model);
        }
      }

      console.log('Configuration applied successfully');

    } catch (error) {
      console.error('Error applying configuration:', error);
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.currentUser;
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return this.currentUser;
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UserComponentsManager;
}

// Make the class available globally for the UI manager
window.UserComponentsManager = UserComponentsManager; 