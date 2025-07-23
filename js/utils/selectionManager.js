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
    
    // If gallery controller is available, also get the model reference
    if (window.galleryController?.model) {
      this.model = window.galleryController.model;
    }
  }

  /**
   * Initialize the selection manager
   */
  async init() {
    console.log(`[DEBUG] init: Starting selection manager initialization`);
    try {
      // Get current user
      const user = await getCurrentUser();
      console.log(`[DEBUG] init: User status:`, user ? 'logged in' : 'not logged in');

      if (user) {
        // Sync any localStorage selections to Supabase
        console.log(`[DEBUG] init: Syncing localStorage selections to Supabase`);
        await this.syncSelectionsToSupabase(user, this.currentModel);
        // Load selections from Supabase
        console.log(`[DEBUG] init: Loading selections from Supabase`);
        await this.loadSelectionsFromSupabase(user, this.currentModel);
      } else {
        // Not logged in, load from localStorage
        console.log(`[DEBUG] init: Loading selections from localStorage`);
        this.loadSelectionsFromStorage();
      }

      // Set up event handlers
      console.log(`[DEBUG] init: Setting up event handlers`);
      this.bindEvents();
      this.updateSlotDisplay();
      
      // Listen for model changes
      console.log(`[DEBUG] init: Setting up model change events`);
      this.bindModelChangeEvents();
      // Listen for Supabase auth changes to keep selections in sync
      console.log(`[DEBUG] init: Setting up auth change events`);
      this.bindAuthChangeEvents();
      
      console.log(`[DEBUG] init: Selection manager initialization completed successfully`);
    } catch (error) {
      console.error('Failed to initialize selections:', error);
      // Fallback to localStorage
      console.log(`[DEBUG] init: Falling back to localStorage due to error`);
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
    console.log(`[DEBUG] bindSlotEvents: Setting up event delegation for slot clicks`);
    
    // Use event delegation for slot clicks and trash buttons
    document.addEventListener('click', async (e) => {
      const slot = e.target.closest('.selection-slot');
      if (!slot) return;

      const slotNumber = parseInt(slot.dataset.slot);
      console.log(`[DEBUG] bindSlotEvents: Slot ${slotNumber} clicked`);
      
      // Handle edit button clicks
      if (e.target.closest('.slot-edit-btn')) {
        console.log(`[DEBUG] bindSlotEvents: Edit button clicked for slot ${slotNumber}`);
        this.startEditingSlot(slotNumber);
        return;
      }
      
      // Handle trash button clicks
      if (e.target.closest('.slot-clear-btn')) {
        console.log(`[DEBUG] bindSlotEvents: Clear button clicked for slot ${slotNumber}`);
        await this.clearSlot(slotNumber);
        console.log(`[DEBUG] bindSlotEvents: clearSlot completed for slot ${slotNumber}`);
        return;
      }
      
      // Handle slot clicks (save or load)
      if (e.target.closest('.selection-slot') && !e.target.closest('.slot-actions')) {
        const config = this.selections[slotNumber];
        if (config) {
          // Slot has data - load it
          console.log(`[DEBUG] bindSlotEvents: Loading from slot ${slotNumber}`);
          this.loadFromSlot(slotNumber);
        } else {
          // Slot is empty - save current configuration
          console.log(`[DEBUG] bindSlotEvents: Saving to slot ${slotNumber}`);
          this.saveToSlot(slotNumber);
        }
      }
    });

    // Handle editing completion (Enter key or blur)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.classList.contains('slot-name')) {
        e.preventDefault();
        console.log(`[DEBUG] bindSlotEvents: Enter key pressed for slot name editing`);
        this.finishEditingSlot(e.target);
      }
    });

    document.addEventListener('blur', (e) => {
      if (e.target.classList.contains('slot-name') && e.target.getAttribute('contenteditable') === 'true') {
        console.log(`[DEBUG] bindSlotEvents: Blur event for slot name editing`);
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
    console.log(`[DEBUG] saveToSlot: Starting save for slot ${slotNumber}`);
    
    if (slotNumber < 1 || slotNumber > this.maxSlots) {
      console.error(`Invalid slot number: ${slotNumber}`);
      this.showNotification(`Invalid slot number: ${slotNumber}`, 'error');
      return;
    }

    // Get current configuration
    const currentConfig = this.getCurrentConfiguration();
    console.log(`[DEBUG] saveToSlot: Current config:`, currentConfig);
    
    // Check if configuration is valid (not null due to validation errors)
    if (!currentConfig) {
      console.error(`[DEBUG] saveToSlot: Configuration is null, aborting save`);
      this.showNotification('Failed to save slot: configuration is invalid or missing required fields. Please check your prompt and selections.', 'error');
      return;
    }
    
    // Additional validation
    if (!currentConfig.basePrompt && (!currentConfig.selectedImages || currentConfig.selectedImages.length === 0)) {
      console.error(`[DEBUG] saveToSlot: Configuration has no prompt and no selected images`);
      this.showNotification('Please add a prompt or select at least one image before saving.', 'error');
      return;
    }
    
    // Save to selections
    this.selections[slotNumber] = currentConfig;
    console.log(`[DEBUG] saveToSlot: Saved to in-memory selections:`, this.selections);
    
    // Save to appropriate storage based on authentication status
    const user = await getCurrentUser();
    console.log(`[DEBUG] saveToSlot: User status:`, user ? 'logged in' : 'not logged in');
    
    if (user) {
      // User is logged in, save to Supabase
      try {
        console.log(`[DEBUG] saveToSlot: Attempting to save to Supabase for user ${user.id}`);
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
      try {
        console.log(`[DEBUG] saveToSlot: Saving to localStorage`);
        await this.saveSelections();
        console.log(`[DEBUG] saveToSlot: Saved to localStorage`);
      } catch (error) {
        console.error('Error saving selection to localStorage:', error);
        this.showNotification('Failed to save configuration to local storage.', 'error');
        return;
      }
    }
    
    // Update the slot display
    try {
      this.updateSlotDisplay();
      console.log(`[DEBUG] saveToSlot: Slot display updated`);
    } catch (error) {
      console.error('Error updating slot display:', error);
      this.showNotification('Failed to update slot display after saving.', 'error');
      return;
    }
    
    // Show notification
    this.showNotification(`Configuration saved to slot ${slotNumber}`);
    console.log(`[DEBUG] saveToSlot: Save completed successfully for slot ${slotNumber}`);
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
      console.log(`[DEBUG] getCurrentConfiguration: Starting configuration gathering`);
      
      // Get base prompt
      const promptInput = document.getElementById('prompt-input');
      const basePrompt = promptInput ? this.sanitizePrompt(promptInput.value) : '';
      console.log(`[DEBUG] getCurrentConfiguration: Base prompt: "${basePrompt}"`);

      // Check base prompt length limit (500 characters - increased from 300)
      console.log(`[DEBUG] getCurrentConfiguration: Base prompt length: ${basePrompt.length} chars`);
      if (basePrompt.length > 500) {
        console.error(`[DEBUG] getCurrentConfiguration: Base prompt too long (${basePrompt.length} chars)`);
        this.showNotification('Base prompt is too long. Please keep it under 500 characters.', 'error');
        return null;
      }

      // Get selected images from the model with weights
      const selectedImages = [];
      const imageWeights = {};
      const weightColorIndices = {};
      
      if (window.galleryController?.model?.selectedImages) {
        console.log(`[DEBUG] getCurrentConfiguration: Found ${window.galleryController.model.selectedImages.size} selected images`);
        window.galleryController.model.selectedImages.forEach((colorIndex, imageId) => {
          selectedImages.push([imageId, colorIndex]);
          
          // Get weight for this image
          const weight = window.galleryController.model.imageWeights.get(imageId) || 1;
          imageWeights[imageId] = weight;
          
          // Get weight color index for this image
          const weightColorIndex = window.galleryController.model.weightColorIndices.get(imageId) || 0;
          weightColorIndices[imageId] = weightColorIndex;
        });
      } else {
        console.log(`[DEBUG] getCurrentConfiguration: No galleryController or selectedImages found`);
      }

      // Sanitize image data
      const sanitizedImageData = this.sanitizeImageData(selectedImages, imageWeights, weightColorIndices);

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
      // Sanitize aspect ratio
      aspectRatio = this.sanitizeAspectRatio(aspectRatio);
      console.log(`[DEBUG] getCurrentConfiguration: Aspect ratio: ${aspectRatio}`);

      // Get suffix
      const promptSuffix = document.getElementById('prompt-suffix');
      const suffix = promptSuffix ? this.sanitizeSuffix(promptSuffix.value) : '';
      console.log(`[DEBUG] getCurrentConfiguration: Suffix: "${suffix}"`);

      // Get current model
      const currentModel = this.sanitizeModel(window.galleryController?.model?.currentModel || 'niji-6');
      console.log(`[DEBUG] getCurrentConfiguration: Current model: ${currentModel}`);

      // Get aspect ratio enable state
      const enableAspectRatio = document.getElementById('enable-aspect-ratio');
      const aspectRatioEnabled = enableAspectRatio ? enableAspectRatio.checked : false;
      console.log(`[DEBUG] getCurrentConfiguration: Aspect ratio enabled: ${aspectRatioEnabled}`);

      const config = {
        basePrompt,
        selectedImages: sanitizedImageData.selectedImages,
        imageWeights: sanitizedImageData.imageWeights,
        weightColorIndices: sanitizedImageData.weightColorIndices,
        aspectRatio,
        aspectRatioEnabled,
        suffix,
        model: currentModel,
        timestamp: Date.now()
      };
      
      console.log(`[DEBUG] getCurrentConfiguration: Final config:`, config);
      
      // Additional validation before returning
      if (!config.basePrompt && (!config.selectedImages || config.selectedImages.length === 0)) {
        console.warn(`[DEBUG] getCurrentConfiguration: Configuration has no prompt and no selected images`);
        this.showNotification('Please add a prompt or select at least one image before saving.', 'warning');
        return null;
      }
      
      // Test notification system (remove this after testing)
      if (basePrompt.length > 100) {
        console.log(`[DEBUG] getCurrentConfiguration: Testing notification system with long prompt (${basePrompt.length} chars)`);
        this.showNotification(`Test: Your prompt is ${basePrompt.length} characters long.`, 'info');
      }
      
      return config;
    } catch (error) {
      console.error('Error getting current configuration:', error);
      this.showNotification('Failed to create configuration. Please try again.', 'error');
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
        promptInput.value = this.sanitizePrompt(config.basePrompt);
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
        // Sanitize the aspect ratio first
        const sanitizedAspectRatio = this.sanitizeAspectRatio(config.aspectRatio);
        
        // Check if it's a custom aspect ratio
        const predefinedOptions = ['1:1', '4:5', '2:3', '3:4', '3:2', '5:4', '4:3', '1.91:1', '2:1', '16:9', '9:16'];
        if (predefinedOptions.includes(sanitizedAspectRatio)) {
          aspectRatioSelect.value = sanitizedAspectRatio;
          if (customAspectRatioInput) {
            customAspectRatioInput.value = '';
          }
        } else {
          aspectRatioSelect.value = 'custom';
          if (customAspectRatioInput) {
            customAspectRatioInput.value = sanitizedAspectRatio;
          }
        }
        aspectRatioSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Apply suffix
      const promptSuffix = document.getElementById('prompt-suffix');
      if (promptSuffix && config.suffix !== undefined) {
        promptSuffix.value = this.sanitizeSuffix(config.suffix);
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
    const newName = this.sanitizeSlotName(slotNameElement.textContent.trim());

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

  /**
   * Sanitize text input to prevent XSS and ensure clean data
   * @param {string} input - The input text to sanitize
   * @param {number} maxLength - Maximum allowed length
   * @returns {string} Sanitized text
   */
  sanitizeText(input, maxLength = 300) {
    if (!input || typeof input !== 'string') {
      return '';
    }
    
    // Remove HTML tags and entities
    let sanitized = input.replace(/<[^>]*>/g, '');
    sanitized = sanitized.replace(/&[a-zA-Z0-9#]+;/g, '');
    
    // Remove potentially dangerous characters
    sanitized = sanitized.replace(/[<>\"'&]/g, '');
    
    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    
    // Truncate to max length
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }
    
    return sanitized;
  }

  /**
   * Sanitize slot name/label for safe storage
   * @param {string} name - The slot name to sanitize
   * @returns {string} Sanitized slot name
   */
  sanitizeSlotName(name) {
    return this.sanitizeText(name, 30); // 30 character limit for slot names
  }

  /**
   * Sanitize prompt text for safe storage
   * @param {string} prompt - The prompt text to sanitize
   * @returns {string} Sanitized prompt text
   */
  sanitizePrompt(prompt) {
    return this.sanitizeText(prompt, 500); // 500 character limit for prompts (increased from 300)
  }

  /**
   * Sanitize suffix text for safe storage
   * @param {string} suffix - The suffix text to sanitize
   * @returns {string} Sanitized suffix text
   */
  sanitizeSuffix(suffix) {
    return this.sanitizeText(suffix, 200); // 200 character limit for suffixes
  }

  /**
   * Validate and sanitize image data for safe storage
   * @param {Array} selectedImages - Array of [imageId, colorIndex] pairs
   * @param {Object} imageWeights - Object mapping imageId to weight
   * @param {Object} weightColorIndices - Object mapping imageId to color index
   * @returns {Object} Sanitized image data
   */
  sanitizeImageData(selectedImages, imageWeights, weightColorIndices) {
    console.log(`[DEBUG] sanitizeImageData: Input selectedImages:`, selectedImages);
    console.log(`[DEBUG] sanitizeImageData: Input imageWeights:`, imageWeights);
    console.log(`[DEBUG] sanitizeImageData: Input weightColorIndices:`, weightColorIndices);
    
    const sanitizedImages = [];
    const sanitizedWeights = {};
    const sanitizedColorIndices = {};
    
    if (Array.isArray(selectedImages)) {
      selectedImages.forEach(([imageId, colorIndex]) => {
        console.log(`[DEBUG] sanitizeImageData: Processing imageId: "${imageId}", colorIndex: ${colorIndex}`);
        // Validate imageId is a string and contains only safe characters for file paths
        if (typeof imageId === 'string' && /^[a-zA-Z0-9\/\-_.\\]+$/.test(imageId) && imageId.length > 0) {
          // Validate colorIndex is a number between 0 and 4
          const validColorIndex = typeof colorIndex === 'number' && colorIndex >= 0 && colorIndex <= 4 ? colorIndex : 0;
          sanitizedImages.push([imageId, validColorIndex]);
          console.log(`[DEBUG] sanitizeImageData: Added valid image: ${imageId}`);
        } else {
          console.warn(`[DEBUG] sanitizeImageData: Invalid imageId: "${imageId}" (type: ${typeof imageId})`);
        }
      });
    }
    
    // Sanitize weights
    if (imageWeights && typeof imageWeights === 'object') {
      Object.entries(imageWeights).forEach(([imageId, weight]) => {
        if (typeof imageId === 'string' && /^[a-zA-Z0-9\/\-_.\\]+$/.test(imageId)) {
          // Validate weight is a number between 1 and 6
          const validWeight = typeof weight === 'number' && weight >= 1 && weight <= 6 ? weight : 1;
          sanitizedWeights[imageId] = validWeight;
        }
      });
    }
    
    // Sanitize color indices
    if (weightColorIndices && typeof weightColorIndices === 'object') {
      Object.entries(weightColorIndices).forEach(([imageId, colorIndex]) => {
        if (typeof imageId === 'string' && /^[a-zA-Z0-9\/\-_.\\]+$/.test(imageId)) {
          // Validate colorIndex is a number between 0 and 6
          const validColorIndex = typeof colorIndex === 'number' && colorIndex >= 0 && colorIndex <= 6 ? colorIndex : 0;
          sanitizedColorIndices[imageId] = validColorIndex;
        }
      });
    }
    
    const result = {
      selectedImages: sanitizedImages,
      imageWeights: sanitizedWeights,
      weightColorIndices: sanitizedColorIndices
    };
    
    console.log(`[DEBUG] sanitizeImageData: Output:`, result);
    return result;
  }

  /**
   * Validate aspect ratio for safe storage
   * @param {string} aspectRatio - The aspect ratio to validate
   * @returns {string} Validated aspect ratio
   */
  sanitizeAspectRatio(aspectRatio) {
    if (!aspectRatio || typeof aspectRatio !== 'string') {
      return '1:1';
    }
    
    // Allow predefined ratios and custom ratios with safe format
    const predefinedOptions = ['1:1', '4:5', '2:3', '3:4', '3:2', '5:4', '4:3', '1.91:1', '2:1', '16:9', '9:16'];
    
    if (predefinedOptions.includes(aspectRatio)) {
      return aspectRatio;
    }
    
    // For custom ratios, validate format (e.g., "16:9", "1.5:1")
    if (/^\d+(\.\d+)?:\d+(\.\d+)?$/.test(aspectRatio)) {
      return aspectRatio;
    }
    
    return '1:1'; // Default fallback
  }

  /**
   * Validate model name for safe storage
   * @param {string} model - The model name to validate
   * @returns {string} Validated model name
   */
  sanitizeModel(model) {
    if (!model || typeof model !== 'string') {
      return 'niji-6';
    }
    
    // Only allow known model names
    const validModels = ['niji-6', 'midjourney-7'];
    if (validModels.includes(model)) {
      return model;
    }
    
    return 'niji-6'; // Default fallback
  }
}

// SelectionManager is now initialized by app.js after gallery controller is ready

// Export for module usage
export default SelectionManager; 