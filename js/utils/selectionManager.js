/**
 * Selection Manager for PrompterAid
 * 
 * Handles saving and loading complete prompt configurations
 * including base prompt, selected references, aspect ratio, and suffix
 * 
 * Storage Strategy:
 * - Non-logged-in users: localStorage only
 * - Logged-in users: Supabase only (with localStorage sync on first login)
 * - Model-specific storage keys for both localStorage and Supabase
 */

import { supabase } from './supabaseClient.js';
import { getCurrentUser } from './auth.js';
import { createItem, readItems, deleteItem, deleteItems } from './supabaseCrud.js';

class SelectionManager {
  constructor() {
    this.maxSlots = 5;
    this.selections = {};
    // Get current model from gallery controller if available, otherwise default
    this.currentModel = window.galleryController?.model?.currentModel || 'niji-6';
  }

  /**
   * Initialize the selection manager
   */
  async init() {
    try {
      // Get current user
      const user = await getCurrentUser();

      if (user) {
        // Sync any localStorage selections to Supabase
        await this.syncSelectionsToSupabase(user, this.currentModel);
        // Load selections from Supabase
        await this.loadSelectionsFromSupabase(user, this.currentModel);
      } else {
        // Not logged in, load from localStorage
        this.loadSelectionsFromStorage();
      }

      // Set up event handlers
      this.bindEvents();
      this.updateSlotDisplay();
      
      // Listen for model changes
      this.bindModelChangeEvents();
      // Listen for Supabase auth changes to keep selections in sync
      this.bindAuthChangeEvents();
    } catch (error) {
      console.error('Failed to initialize selections:', error);
      // Fallback to localStorage
      this.loadSelectionsFromStorage();
      this.bindEvents();
      this.updateSlotDisplay();
      this.bindModelChangeEvents();
    }
  }

  /**
   * Bind event handlers for selection tools
   */
  bindEvents() {
    // Bind slot action buttons
    this.bindSlotEvents();
  }

  /**
   * Bind model change events
   */
  bindModelChangeEvents() {
    // Listen for model changes from the app controller
    document.addEventListener('modelChange', async (e) => {
      const newModel = e.detail.model;
      if (newModel && newModel !== this.currentModel) {
        await this.updateModel(newModel);
      }
    });
  }

  /**
   * Bind Supabase authentication state changes.
   * Ensures that after the user signs in we move any local slots to the cloud
   * and refresh the in-memory/DOM display. On sign-out we revert to localStorage.
   */
  bindAuthChangeEvents() {
    supabase.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user || null;

      if (user) {
        // User is authenticated (INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED)
        try {
          await this.syncSelectionsToSupabase(user, this.currentModel);
          await this.loadSelectionsFromSupabase(user, this.currentModel);
          this.updateSlotDisplay();
        } catch (err) {
          console.error('Error handling auth sign-in event:', err);
        }
      } else if (event === 'SIGNED_OUT') {
        // User signed out – purge any stored data for privacy/sync hygiene
        this.purgeLocalStorageData();

        // Reload (now-empty) selections from storage and update UI
        this.loadSelectionsFromStorage();
        this.updateSlotDisplay();
      }
    });
  }

  /**
   * Remove all localStorage keys that belong to PrompterAid (prefixed with "prompteraid-").
   * Called when the user signs out to ensure personal data isn’t left on shared devices.
   */
  purgeLocalStorageData() {
    try {
      const prefix = 'prompteraid-';
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          localStorage.removeItem(key);
        }
      }
      console.log('[DEBUG] purgeLocalStorageData: Cleared all PrompterAid data from localStorage');
    } catch (err) {
      console.error('Error purging PrompterAid localStorage data:', err);
    }
  }

  /**
   * Bind events for individual slot buttons
   */
  bindSlotEvents() {
    // Use event delegation for slot clicks and trash buttons
    document.addEventListener('click', (e) => {
      const slot = e.target.closest('.selection-slot');
      if (!slot) return;

      const slotNumber = parseInt(slot.dataset.slot);
      
      // Handle edit button clicks
      if (e.target.closest('.slot-edit-btn')) {
        this.startEditingSlot(slotNumber);
        return;
      }
      
      // Handle trash button clicks
      if (e.target.closest('.slot-clear-btn')) {
        this.clearSlot(slotNumber);
        return;
      }
      
      // Handle slot clicks (save or load)
      if (e.target.closest('.selection-slot') && !e.target.closest('.slot-actions')) {
        const config = this.selections[slotNumber];
        if (config) {
          // Slot has data - load it
          this.loadFromSlot(slotNumber);
        } else {
          // Slot is empty - save current configuration
          this.saveToSlot(slotNumber);
        }
      }
    });

    // Handle editing completion (Enter key or blur)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.classList.contains('slot-name')) {
        e.preventDefault();
        this.finishEditingSlot(e.target);
      }
    });

    document.addEventListener('blur', (e) => {
      if (e.target.classList.contains('slot-name') && e.target.getAttribute('contenteditable') === 'true') {
        this.finishEditingSlot(e.target);
      }
    }, true);
  }

  /**
   * Show the selection tools (called when entering selected view)
   */
  showSelectionTools() {
    const selectionTools = document.getElementById('selection-tools');
    if (selectionTools) {
      selectionTools.classList.remove('hidden');
    }
  }

  /**
   * Hide the selection tools (called when leaving selected view)
   */
  hideSelectionTools() {
    const selectionTools = document.getElementById('selection-tools');
    if (selectionTools) {
      selectionTools.classList.add('hidden');
    }
  }

  /**
   * Save current configuration to a specific slot
   * @param {number} slotNumber - The slot number (1-5)
   */
  async saveToSlot(slotNumber) {
    if (slotNumber < 1 || slotNumber > this.maxSlots) {
      console.error(`Invalid slot number: ${slotNumber}`);
      return;
    }

    // Get current configuration
    const currentConfig = this.getCurrentConfiguration();
    
    // Check if configuration is valid (not null due to validation errors)
    if (!currentConfig) {
      // Error notification already shown in getCurrentConfiguration()
      return;
    }
    
    // Save to selections
    this.selections[slotNumber] = currentConfig;
    
    // Save to appropriate storage based on authentication status
    const user = await getCurrentUser();
    
          if (user) {
        // User is logged in, save to Supabase
        try {
          // Use upsert to handle both create and update
          const { data, error } = await supabase
            .from('user_selections')
            .upsert({
              user_id: user.id,
              slot_number: slotNumber,
              model: this.currentModel,
              configuration: JSON.stringify(currentConfig)
            }, {
              onConflict: 'user_id,slot_number,model'
            })
            .select();
          
          if (error) {
            console.error('Error saving selection to Supabase:', error);
            this.showNotification('Failed to save configuration to cloud storage.', 'error');
            return;
          }
          
          console.log(`[DEBUG] saveToSlot: Successfully saved to Supabase:`, data);
        } catch (error) {
          console.error('Error saving selection to Supabase:', error);
          this.showNotification('Failed to save configuration to cloud storage.', 'error');
          return;
        }
    } else {
      // Not logged in, save to localStorage
      await this.saveSelections();
    }
    
    // Update the slot display
    this.updateSlotDisplay();
    
    // Show notification
    this.showNotification(`Configuration saved to slot ${slotNumber}`);
  }

  /**
   * Load configuration from a specific slot
   * @param {number} slotNumber - The slot number (1-5)
   */
  loadFromSlot(slotNumber) {
    if (slotNumber < 1 || slotNumber > this.maxSlots) {
      console.error(`Invalid slot number: ${slotNumber}`);
      return;
    }

    const config = this.selections[slotNumber];
    if (!config) {
      this.showNotification(`Slot ${slotNumber} is empty`);
      return;
    }

    // Check for model mismatch
    const currentModel = window.galleryController?.model?.currentModel || 'niji-6';
    const hasModelMismatch = config.model && config.model !== currentModel;
    
    if (hasModelMismatch) {
      this.showNotification(`Configuration loaded from slot ${slotNumber}. Note: References from ${config.model} cannot be loaded in ${currentModel} mode.`);
    }

    // Apply the configuration with model mismatch handling
    this.applyConfiguration(config, hasModelMismatch);
    
    // Show success notification
    const notificationMessage = hasModelMismatch 
      ? `Configuration loaded from slot ${slotNumber} (references skipped due to model mismatch)`
      : `Configuration loaded from slot ${slotNumber}`;
    this.showNotification(notificationMessage);
  }

  /**
   * Clear a specific slot
   * @param {number} slotNumber - The slot number (1-5)
   */
  async clearSlot(slotNumber) {
    if (slotNumber < 1 || slotNumber > this.maxSlots) {
      console.error(`Invalid slot number: ${slotNumber}`);
      return;
    }

    delete this.selections[slotNumber];
    
    // Clear from appropriate storage based on authentication status
    const user = await getCurrentUser();
    
    if (user) {
      // User is logged in, clear from Supabase
      try {
        const { data, error } = await deleteItem(supabase, 'user_selections', {
          user_id: user.id,
          slot_number: slotNumber,
          model: this.currentModel
        });
        
        if (error) {
          console.error('Error clearing selection from Supabase:', error);
          this.showNotification('Failed to clear configuration from cloud storage.', 'error');
          return;
        }
        
        console.log(`[DEBUG] clearSlot: Successfully cleared from Supabase:`, data);
        
        // Also clear from localStorage for logged-in users to prevent conflicts
        const storageKey = this.getStorageKey();
        const localSelections = JSON.parse(localStorage.getItem(storageKey) || '{}');
        if (localSelections[slotNumber]) {
          delete localSelections[slotNumber];
          localStorage.setItem(storageKey, JSON.stringify(localSelections));
          console.log(`[DEBUG] clearSlot: Also cleared slot ${slotNumber} from localStorage`);
        }
      } catch (error) {
        console.error('Error clearing selection from Supabase:', error);
        this.showNotification('Failed to clear configuration from cloud storage.', 'error');
        return;
      }
    } else {
      // Not logged in, clear from localStorage
      await this.saveSelections();
    }
    
    this.updateSlotDisplay();
    
    this.showNotification(`Slot ${slotNumber} cleared`);
  }

  /**
   * Clear all slots for the current model
   */
  async clearAllSlots() {
    try {
      const user = await getCurrentUser();
      
      if (user) {
        // User is logged in, clear from Supabase
        try {
          const { data, error } = await deleteItems(supabase, 'user_selections', {
            user_id: user.id,
            model: this.currentModel
          });
          
          if (error) {
            console.error('Error clearing all selections from Supabase:', error);
            this.showNotification('Failed to clear all configurations from cloud storage.', 'error');
            return false;
          }
          
          console.log(`[DEBUG] clearAllSlots: Successfully cleared from Supabase:`, data);
        } catch (error) {
          console.error('Error clearing all selections from Supabase:', error);
          this.showNotification('Failed to clear all configurations from cloud storage.', 'error');
          return false;
        }
      }
      
      // Always clear from localStorage regardless of login status
      const storageKey = this.getStorageKey();
      localStorage.removeItem(storageKey);
      console.log(`[DEBUG] clearAllSlots: Cleared selections from localStorage key: ${storageKey}`);
      
      // Clear in-memory selections
      this.selections = {};
      this.updateSlotDisplay();
      
      this.showNotification('All slots cleared');
      return true;
    } catch (error) {
      console.error('Error clearing all slots:', error);
      this.showNotification('Failed to clear all slots.', 'error');
      return false;
    }
  }

  /**
   * Get current configuration from the app
   * @returns {Object|null} Current configuration or null if not available
   */
  getCurrentConfiguration() {
    try {
      // Get base prompt
      const promptInput = document.getElementById('prompt-input');
      const basePrompt = promptInput ? promptInput.value : '';

      // Check base prompt length limit (300 characters)
      if (basePrompt.length > 300) {
        this.showNotification('Base prompt is too long. Please keep it under 300 characters.', 'error');
        return null;
      }

      // Get selected images from the model with weights
      const selectedImages = [];
      const imageWeights = {};
      const weightColorIndices = {};
      
      if (window.galleryController?.model?.selectedImages) {
        window.galleryController.model.selectedImages.forEach((colorIndex, imageId) => {
          selectedImages.push([imageId, colorIndex]);
          
          // Get weight for this image
          const weight = window.galleryController.model.imageWeights.get(imageId) || 1;
          imageWeights[imageId] = weight;
          
          // Get weight color index for this image
          const weightColorIndex = window.galleryController.model.weightColorIndices.get(imageId) || 0;
          weightColorIndices[imageId] = weightColorIndex;
        });
      }

      // Get aspect ratio
      const aspectRatioSelect = document.getElementById('aspect-ratio-select');
      const customAspectRatioInput = document.getElementById('custom-aspect-ratio-input');
      let aspectRatio = '1:1';
      if (aspectRatioSelect) {
        if (aspectRatioSelect.value === 'custom' && customAspectRatioInput) {
          aspectRatio = customAspectRatioInput.value.trim() || '1:1';
        } else {
          aspectRatio = aspectRatioSelect.value;
        }
      }

      // Get suffix
      const promptSuffix = document.getElementById('prompt-suffix');
      const suffix = promptSuffix ? promptSuffix.value : '';

      // Get current model
      const currentModel = window.galleryController?.model?.currentModel || 'niji-6';

      // Get aspect ratio enable state
      const enableAspectRatio = document.getElementById('enable-aspect-ratio');
      const aspectRatioEnabled = enableAspectRatio ? enableAspectRatio.checked : false;

      return {
        basePrompt,
        selectedImages,
        imageWeights,
        weightColorIndices,
        aspectRatio,
        aspectRatioEnabled,
        suffix,
        model: currentModel,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error getting current configuration:', error);
      return null;
    }
  }

  /**
   * Apply a configuration to the app
   * @param {Object} config - Configuration to apply
   * @param {boolean} modelMismatch - Whether there's a model mismatch (skip references if true)
   */
  applyConfiguration(config, modelMismatch = false) {
    try {
      // Apply base prompt
      const promptInput = document.getElementById('prompt-input');
      if (promptInput && config.basePrompt !== undefined) {
        promptInput.value = config.basePrompt;
        promptInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // Apply aspect ratio enable state
      const enableAspectRatio = document.getElementById('enable-aspect-ratio');
      if (enableAspectRatio && config.aspectRatioEnabled !== undefined) {
        enableAspectRatio.checked = config.aspectRatioEnabled;
        enableAspectRatio.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Apply aspect ratio
      const aspectRatioSelect = document.getElementById('aspect-ratio-select');
      const customAspectRatioInput = document.getElementById('custom-aspect-ratio-input');
      if (aspectRatioSelect && config.aspectRatio) {
        // Check if it's a custom aspect ratio
        const predefinedOptions = ['1:1', '4:5', '2:3', '3:4', '3:2', '5:4', '4:3', '1.91:1', '2:1', '16:9', '9:16'];
        if (predefinedOptions.includes(config.aspectRatio)) {
          aspectRatioSelect.value = config.aspectRatio;
          if (customAspectRatioInput) {
            customAspectRatioInput.value = '';
          }
        } else {
          aspectRatioSelect.value = 'custom';
          if (customAspectRatioInput) {
            customAspectRatioInput.value = config.aspectRatio;
          }
        }
        aspectRatioSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Apply suffix
      const promptSuffix = document.getElementById('prompt-suffix');
      if (promptSuffix && config.suffix !== undefined) {
        promptSuffix.value = config.suffix;
        promptSuffix.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // Apply selected images only if there's no model mismatch
      if (!modelMismatch && config.selectedImages && window.galleryController?.model) {
        // Clear current selections and weights
        window.galleryController.model.selectedImages.clear();
        window.galleryController.model.imageWeights.clear();
        window.galleryController.model.weightColorIndices.clear();
        
        // Add new selections
        config.selectedImages.forEach(([imageId, colorIndex]) => {
          window.galleryController.model.selectedImages.set(imageId, colorIndex);
        });
        
        // Apply weights if available (for backward compatibility)
        if (config.imageWeights) {
          Object.entries(config.imageWeights).forEach(([imageId, weight]) => {
            window.galleryController.model.imageWeights.set(imageId, weight);
          });
        }
        
        // Apply weight color indices if available (for backward compatibility)
        if (config.weightColorIndices) {
          Object.entries(config.weightColorIndices).forEach(([imageId, colorIndex]) => {
            window.galleryController.model.weightColorIndices.set(imageId, colorIndex);
          });
        }
        
        // Re-render the gallery to show the selections
        if (window.galleryController.renderGallery) {
          window.galleryController.renderGallery();
        }
      }

      // Apply model if different (but don't change models automatically)
      if (config.model && window.galleryController?.model) {
        const currentModel = window.galleryController.model.currentModel;
        if (config.model !== currentModel) {
          // This would need to be handled by the model selector
          console.log('Model change would be applied here:', config.model);
        }
      }

      // Update the prompt display
      if (window.galleryController?.updatePrompt) {
        window.galleryController.updatePrompt();
      }

    } catch (error) {
      console.error('Error applying configuration:', error);
      this.showNotification('Error applying configuration');
    }
  }

  /**
   * Generate a name for a slot based on its content
   * @param {Object} config - Configuration object
   * @returns {Object} Object with customName and stats properties
   */
  generateSlotName(config) {
    const stats = [];
    
    // Add first 3 words of base prompt (limited by characters)
    if (config.basePrompt && config.basePrompt.trim()) {
      const words = config.basePrompt.trim().split(/\s+/);
      let firstThreeWords = words.slice(0, 3).join(' ');
      
      // Limit to 30 characters for the preview
      if (firstThreeWords.length > 30) {
        firstThreeWords = firstThreeWords.substring(0, 27) + '...';
      } else if (words.length > 3) {
        firstThreeWords += '...';
      }
      
      stats.push(`"${firstThreeWords}"`);
    }
    
    // Add selected images count with model info if different
    if (config.selectedImages && config.selectedImages.length > 0) {
      const currentModel = window.galleryController?.model?.currentModel || 'niji-6';
      if (config.model && config.model !== currentModel) {
        stats.push(`${config.selectedImages.length} refs (${config.model})`);
      } else {
        stats.push(`${config.selectedImages.length} refs`);
      }
    }
    
    // Add aspect ratio if enabled
    if (config.aspectRatioEnabled && config.aspectRatio) {
      stats.push(`AR: ${config.aspectRatio}`);
    }
    
    // Add model
    if (config.model) {
      stats.push(config.model);
    }
    
    return {
      customName: config.customName || '',
      stats: stats.join(' • ')
    };
  }

  /**
   * Update the display of all slots
   */
  updateSlotDisplay() {
    for (let i = 1; i <= this.maxSlots; i++) {
      const slot = document.querySelector(`[data-slot="${i}"]`);
      if (!slot) continue;

      const slotName = slot.querySelector('.slot-name');
      const slotStats = slot.querySelector('.slot-stats');
      const config = this.selections[i];

      if (config && slotName && slotStats) {
        // Generate name and stats based on the configuration
        const nameData = this.generateSlotName(config);
        slotName.textContent = nameData.customName || 'Untitled';
        slotStats.textContent = nameData.stats;
        slot.classList.add('filled');
        slot.classList.remove('empty');
        // Hide edit button if slot is empty
        const editBtn = slot.querySelector('.slot-edit-btn');
        if (editBtn) {
          editBtn.style.display = (slotName.textContent === 'Empty') ? 'none' : '';
        }
      } else if (slotName && slotStats) {
        // Check if there's a custom name saved even for empty slots
        const customName = this.selections[i]?.customName;
        slotName.textContent = customName || 'Empty';
        slotStats.textContent = ''; // Clear stats for empty slots
        slot.classList.add('empty');
        slot.classList.remove('filled');
        // Hide edit button for empty slot
        const editBtn = slot.querySelector('.slot-edit-btn');
        if (editBtn) {
          editBtn.style.display = 'none';
        }
      }
    }
  }

  /**
   * Get the storage key for the current model
   * @returns {string} Storage key
   */
  getStorageKey() {
    return `prompteraid-selections-${this.currentModel}`;
  }

  /**
   * Load selections from localStorage
   */
  loadSelectionsFromStorage() {
    try {
      const storageKey = this.getStorageKey();
      const stored = localStorage.getItem(storageKey);
      this.selections = stored ? JSON.parse(stored) : {};
      console.log(`[DEBUG] loadSelectionsFromStorage: Loaded selections for model ${this.currentModel}:`, this.selections);
    } catch (error) {
      console.error('Error loading selections from localStorage:', error);
      this.selections = {};
    }
  }

  /**
   * Save selections to appropriate storage based on authentication status
   */
  async saveSelections() {
    try {
      // Get current user
      const user = await getCurrentUser();

      // Only save to localStorage if user is NOT logged in
      if (!user) {
        const storageKey = this.getStorageKey();
        console.log(`[DEBUG] saveSelections: Saving selections for model ${this.currentModel}:`, this.selections);
        localStorage.setItem(storageKey, JSON.stringify(this.selections));
        console.log(`[DEBUG] saveSelections: Saved to localStorage key: ${storageKey}`);
      } else {
        console.log(`[DEBUG] saveSelections: User is logged in, skipping selections save to localStorage`);
      }
    } catch (error) {
      console.error('Error saving selections:', error);
    }
  }

  /**
   * Load selections from Supabase
   */
  async loadSelectionsFromSupabase(user, currentModel) {
    try {
      console.log(`[DEBUG] loadSelectionsFromSupabase: Loading selections for user ${user.id}, model ${currentModel}`);
      const { data, error } = await readItems(supabase, 'user_selections', {
        user_id: user.id,
        model: currentModel
      });
      
      if (error) {
        console.error('Error loading selections from Supabase:', error);
        return;
      }
      
      console.log(`[DEBUG] loadSelectionsFromSupabase: Received data from Supabase:`, data);
      this.selections = {};
      data.forEach(row => {
        this.selections[row.slot_number] = JSON.parse(row.configuration);
      });
      console.log(`[DEBUG] loadSelectionsFromSupabase: Set selections to:`, this.selections);
    } catch (error) {
      console.error('Error loading selections from Supabase:', error);
    }
  }

  /**
   * Update the current model and reload selections for the new model
   * @param {string} newModel - The new model to switch to
   */
  async updateModel(newModel) {
    if (this.currentModel === newModel) return;
    
    console.log(`[DEBUG] updateModel: Switching from ${this.currentModel} to ${newModel}`);
    this.currentModel = newModel;
    
    try {
      // Get current user
      const user = await getCurrentUser();

      if (user) {
        // User is logged in, load from Supabase
        await this.loadSelectionsFromSupabase(user, newModel);
      } else {
        // Not logged in, load from localStorage
        this.loadSelectionsFromStorage();
      }

      // Update the slot display
      this.updateSlotDisplay();
    } catch (error) {
      console.error('Failed to update selections for new model:', error);
      // Fallback to localStorage
      this.loadSelectionsFromStorage();
      this.updateSlotDisplay();
    }
  }

  /**
   * Sync localStorage selections to Supabase
   */
  async syncSelectionsToSupabase(user, currentModel) {
    try {
      // Get localStorage selections
      const storageKey = this.getStorageKey();
      const localSelections = JSON.parse(localStorage.getItem(storageKey) || '{}');
      console.log(`[DEBUG] syncSelectionsToSupabase: Found selections in localStorage for model ${currentModel}:`, localSelections);
      
      if (Object.keys(localSelections).length === 0) {
        console.log(`[DEBUG] syncSelectionsToSupabase: No localStorage selections to sync`);
        return;
      }

      // Get existing Supabase selections
      const { data: existingSelections, error: readError } = await readItems(supabase, 'user_selections', {
        user_id: user.id,
        model: currentModel
      });
      
      if (readError) {
        console.error('Error reading existing selections from Supabase:', readError);
        return;
      }
      
      console.log(`[DEBUG] syncSelectionsToSupabase: Found ${existingSelections.length} existing selections in Supabase`);
      
      const existingSlots = new Set(existingSelections.map(s => s.slot_number));
      const conflictingSlots = [];
      const newSelections = [];
      
      // Check for conflicts and separate new vs conflicting selections
      Object.entries(localSelections).forEach(([slotNumber, configuration]) => {
        const slotNum = parseInt(slotNumber);
        if (existingSlots.has(slotNum)) {
          conflictingSlots.push(slotNum);
        } else {
          newSelections.push([slotNumber, configuration]);
        }
      });
      
      // Handle conflicts by trying to move them to open slots
      if (conflictingSlots.length > 0) {
        console.log(`[DEBUG] syncSelectionsToSupabase: Found conflicts in slots:`, conflictingSlots);
        
        // Find available open slots (1-5 that don't exist in Supabase)
        const allSlots = new Set([1, 2, 3, 4, 5]);
        const availableSlots = Array.from(allSlots).filter(slot => !existingSlots.has(slot));
        
        console.log(`[DEBUG] syncSelectionsToSupabase: Available slots:`, availableSlots);
        
        // Try to move conflicting selections to available slots
        const movedSelections = [];
        const deletedSelections = [];
        
        for (let i = 0; i < conflictingSlots.length && i < availableSlots.length; i++) {
          const oldSlot = conflictingSlots[i];
          const newSlot = availableSlots[i];
          const configuration = localSelections[oldSlot];
          
          try {
            const { data, error } = await createItem(supabase, 'user_selections', {
              user_id: user.id,
              slot_number: newSlot,
              model: currentModel,
              configuration: JSON.stringify(configuration)
            });
            
            if (error) {
              console.error(`Error moving selection from slot ${oldSlot} to ${newSlot}:`, error);
              deletedSelections.push(oldSlot);
            } else {
              console.log(`[DEBUG] syncSelectionsToSupabase: Successfully moved slot ${oldSlot} to ${newSlot}`);
              movedSelections.push({ from: oldSlot, to: newSlot });
              // Update the configuration in our local data
              localSelections[newSlot] = configuration;
            }
          } catch (error) {
            console.error(`Error moving selection from slot ${oldSlot} to ${newSlot}:`, error);
            deletedSelections.push(oldSlot);
          }
        }
        
        // Delete any remaining conflicting slots that couldn't be moved
        for (let i = availableSlots.length; i < conflictingSlots.length; i++) {
          deletedSelections.push(conflictingSlots[i]);
        }
        
        // Remove conflicting slots from localStorage data
        conflictingSlots.forEach(slotNum => {
          delete localSelections[slotNum];
        });
        
        // Show warning only for deleted selections
        if (deletedSelections.length > 0) {
          const deletedMessage = `Slots ${deletedSelections.join(', ')} could not be moved and were deleted.`;
          this.showNotification(deletedMessage, 'warning');
        }
      }
      
      console.log(`[DEBUG] syncSelectionsToSupabase: ${newSelections.length} new selections to add:`, newSelections);
      
      // Add new selections to Supabase
      for (const [slotNumber, configuration] of newSelections) {
        try {
          const { data, error } = await createItem(supabase, 'user_selections', {
            user_id: user.id,
            slot_number: parseInt(slotNumber),
            model: currentModel,
            configuration: JSON.stringify(configuration)
          });
          
          if (error) {
            console.error(`Error adding selection ${slotNumber} to Supabase:`, error);
            this.showNotification(`Failed to sync slot ${slotNumber} to cloud storage.`, 'error');
          } else {
            console.log(`[DEBUG] syncSelectionsToSupabase: Successfully added slot ${slotNumber} to Supabase`);
          }
        } catch (error) {
          console.error(`Error adding selection ${slotNumber} to Supabase:`, error);
          this.showNotification(`Failed to sync slot ${slotNumber} to cloud storage.`, 'error');
        }
      }
      
      // Clear localStorage after sync (only non-conflicting data was synced)
      localStorage.removeItem(storageKey);
      console.log(`[DEBUG] syncSelectionsToSupabase: Cleared localStorage key: ${storageKey}`);
      
      // Update in-memory selections with the cleaned data
      this.selections = { ...localSelections };
    } catch (error) {
      console.error('Error syncing selections to Supabase:', error);
      this.showNotification('Failed to sync selections to cloud storage.', 'error');
    }
  }

  /**
   * Show a notification using the app's notification system
   * @param {string} message - The notification message
   * @param {string} type - The type of notification ('error', 'info', 'warning')
   */
  showNotification(message, type = 'info') {
    // Use the app's notification system if available
    if (window.galleryController && window.galleryController.view) {
      switch (type) {
        case 'error':
          window.galleryController.view.showErrorNotification(message);
          break;
        case 'warning':
          window.galleryController.view.showWarningNotification(message);
          break;
        default:
          window.galleryController.view.showInfoNotification(message);
      }
    } else {
      // Fallback to console
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Start editing a slot name
   * @param {number} slotNumber - The slot number to edit
   */
  startEditingSlot(slotNumber) {
    const slot = document.querySelector(`[data-slot="${slotNumber}"]`);
    if (!slot) return;

    const slotName = slot.querySelector('.slot-name');
    if (!slotName) return;

    // Make the slot name editable
    slotName.setAttribute('contenteditable', 'true');
    slotName.focus();
    
    // Select all text for easy replacement
    const range = document.createRange();
    range.selectNodeContents(slotName);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  /**
   * Finish editing a slot name
   * @param {HTMLElement} slotNameElement - The slot name element being edited
   */
  async finishEditingSlot(slotNameElement) {
    const slot = slotNameElement.closest('.selection-slot');
    if (!slot) return;

    const slotNumber = parseInt(slot.dataset.slot);
    const newName = slotNameElement.textContent.trim();

    // Check label length limit (30 characters)
    if (newName.length > 30) {
      this.showNotification('Label is too long. Please keep it under 30 characters.', 'error');
      // Reset to previous value or default
      const config = this.selections[slotNumber];
      slotNameElement.textContent = config?.customName || 'Empty';
      slotNameElement.setAttribute('contenteditable', 'false');
      return;
    }

    // Make the slot name non-editable
    slotNameElement.setAttribute('contenteditable', 'false');

    // Save the custom name if the slot has data
    if (this.selections[slotNumber]) {
      this.selections[slotNumber].customName = newName;
      
      // Save to appropriate storage based on authentication status
      const user = await getCurrentUser();
      
      if (user) {
        // User is logged in, update in Supabase
        try {
          // Use upsert to handle both create and update
          const { data, error } = await supabase
            .from('user_selections')
            .upsert({
              user_id: user.id,
              slot_number: slotNumber,
              model: this.currentModel,
              configuration: JSON.stringify(this.selections[slotNumber])
            }, {
              onConflict: 'user_id,slot_number,model'
            })
            .select();
          
          if (error) {
            console.error('Error updating selection name in Supabase:', error);
            this.showNotification('Failed to update slot name in cloud storage.', 'error');
            return;
          }
          
          console.log(`[DEBUG] finishEditingSlot: Successfully updated in Supabase:`, data);
        } catch (error) {
          console.error('Error updating selection name in Supabase:', error);
          this.showNotification('Failed to update slot name in cloud storage.', 'error');
          return;
        }
      } else {
        // Not logged in, save to localStorage
        await this.saveSelections();
      }
      
      this.showNotification(`Slot ${slotNumber} renamed to "${newName}"`);
    } else {
      // If slot is empty, just update the display
      slotNameElement.textContent = newName || 'Empty';
    }
  }
}

// Initialize the selection manager when the DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  window.selectionManager = new SelectionManager();
  await window.selectionManager.init();
});

// Export for module usage
export default SelectionManager; 