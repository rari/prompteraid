/**
 * Component Manager for PrompterAid
 * 
 * Handles saving and loading prompt configurations (prompt, suffix, aspect ratio, code selections)
 * using Supabase. Users can save up to 5 components.
 */

import { supabase } from './supabaseClient.js';

class ComponentManager {
  constructor() {
    this.maxComponents = 5;
    this.currentUser = null;
    this.components = [];
    this.init();
  }

  async init() {
    // Listen for auth state changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session && session.user) {
        this.currentUser = session.user;
        await this.loadComponents();
        this.notifyComponentsChange();
      } else {
        this.currentUser = null;
        this.components = [];
        this.notifyComponentsChange();
      }
    });
  }

  notifyComponentsChange() {
    if (this.onComponentsChange) {
      this.onComponentsChange();
    }
  }

  /**
   * Get current prompt configuration from the UI
   */
  getCurrentConfiguration() {
    const promptInput = document.getElementById('prompt-input');
    const suffixInput = document.getElementById('prompt-suffix');
    const aspectRatioSelect = document.getElementById('aspect-ratio-select');
    
    // Get selected code categories
    const categoryIds = ['cat-presentation', 'cat-emotion', 'cat-subject', 'cat-clothing', 'cat-appearance', 'cat-pose', 'cat-setting', 'cat-lighting', 'cat-style', 'cat-details'];
    const selectedCategories = {};
    
    categoryIds.forEach(id => {
      const checkbox = document.getElementById(id);
      if (checkbox) {
        selectedCategories[id] = checkbox.checked;
      }
    });

    return {
      prompt: promptInput ? promptInput.value : '',
      suffix: suffixInput ? suffixInput.value : '',
      aspectRatio: aspectRatioSelect ? aspectRatioSelect.value : '',
      selectedCategories: selectedCategories,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Apply a saved configuration to the UI
   */
  applyConfiguration(config) {
    const promptInput = document.getElementById('prompt-input');
    const suffixInput = document.getElementById('prompt-suffix');
    const aspectRatioSelect = document.getElementById('aspect-ratio-select');
    
    if (promptInput && config.prompt !== undefined) {
      promptInput.value = config.prompt;
      promptInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    if (suffixInput && config.suffix !== undefined) {
      suffixInput.value = config.suffix;
      suffixInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    if (aspectRatioSelect && config.aspectRatio !== undefined) {
      aspectRatioSelect.value = config.aspectRatio;
      aspectRatioSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    // Apply selected categories
    if (config.selectedCategories) {
      Object.entries(config.selectedCategories).forEach(([id, checked]) => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
          checkbox.checked = checked;
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    }
    
    // Update the main application if available
    if (window.galleryController && window.galleryController.updatePrompt) {
      window.galleryController.updatePrompt();
    }
  }

  /**
   * Generate a component name based on prompt text
   */
  generateComponentName(promptText) {
    if (!promptText || promptText.trim() === '') {
      // Find the next available unnamed slot
      const existingUnnamed = this.components.filter(c => c.name.startsWith('Unnamed #'));
      const usedNumbers = existingUnnamed.map(c => {
        const match = c.name.match(/Unnamed #(\d+)/);
        return match ? parseInt(match[1]) : 0;
      });
      
      let nextNumber = 1;
      while (usedNumbers.includes(nextNumber)) {
        nextNumber++;
      }
      
      return `Unnamed #${nextNumber}`;
    }
    
    // Use the first 30 characters of the prompt as the name
    const cleanPrompt = promptText.trim();
    const name = cleanPrompt.length > 30 ? cleanPrompt.substring(0, 30) + '...' : cleanPrompt;
    
    // Check if this name already exists
    let finalName = name;
    let counter = 1;
    while (this.components.some(c => c.name === finalName)) {
      finalName = `${name} (${counter})`;
      counter++;
    }
    
    return finalName;
  }

  /**
   * Save a new component
   */
  async saveComponent() {
    if (!this.currentUser) {
      throw new Error('User must be logged in to save components');
    }

    if (this.components.length >= this.maxComponents) {
      throw new Error(`Maximum ${this.maxComponents} components allowed`);
    }

    const config = this.getCurrentConfiguration();
    const name = this.generateComponentName(config.prompt);
    
    const { data, error } = await supabase
      .from('user_components')
      .insert({
        user_id: this.currentUser.id,
        name: name,
        configuration: config,
        created_at: new Date().toISOString()
      })
      .select();

    if (error) {
      console.error('Error saving component:', error);
      throw error;
    }

    await this.loadComponents();
    this.notifyComponentsChange();
    return data[0];
  }

  /**
   * Load all components for the current user
   */
  async loadComponents() {
    if (!this.currentUser) {
      this.components = [];
      return;
    }

    const { data, error } = await supabase
      .from('user_components')
      .select('*')
      .eq('user_id', this.currentUser.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading components:', error);
      this.components = [];
      return;
    }

    this.components = data || [];
  }

  /**
   * Load a specific component
   */
  async loadComponent(componentId) {
    const component = this.components.find(c => c.id === componentId);
    if (component) {
      this.applyConfiguration(component.configuration);
      return component;
    }
    throw new Error('Component not found');
  }

  /**
   * Delete a component
   */
  async deleteComponent(componentId) {
    if (!this.currentUser) {
      throw new Error('User must be logged in to delete components');
    }

    const { error } = await supabase
      .from('user_components')
      .delete()
      .eq('id', componentId)
      .eq('user_id', this.currentUser.id);

    if (error) {
      console.error('Error deleting component:', error);
      throw error;
    }

    await this.loadComponents();
    this.notifyComponentsChange();
  }

  /**
   * Update a component
   */
  async updateComponent(componentId) {
    if (!this.currentUser) {
      throw new Error('User must be logged in to update components');
    }

    const config = this.getCurrentConfiguration();
    const name = this.generateComponentName(config.prompt);
    
    const { data, error } = await supabase
      .from('user_components')
      .update({
        name: name,
        configuration: config,
        updated_at: new Date().toISOString()
      })
      .eq('id', componentId)
      .eq('user_id', this.currentUser.id)
      .select();

    if (error) {
      console.error('Error updating component:', error);
      throw error;
    }

    await this.loadComponents();
    this.notifyComponentsChange();
    return data[0];
  }

  /**
   * Get components count
   */
  getComponentsCount() {
    return this.components.length;
  }

  /**
   * Check if user can save more components
   */
  canSaveMore() {
    return this.components.length < this.maxComponents;
  }

  /**
   * Get all components
   */
  getComponents() {
    return this.components;
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ComponentManager;
}

// Make available globally
window.ComponentManager = ComponentManager; 