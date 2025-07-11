/**
 * Centralized Keyboard Shortcut Manager
 * 
 * Handles all keyboard shortcuts consistently across the application.
 * Prevents conflicts and provides a single source of truth for shortcut handling.
 */

class KeyboardShortcutManager {
  constructor() {
    this.shortcuts = new Map();
    this.isEnabled = true;
    this.inputSelectors = ['INPUT', 'TEXTAREA'];
    this.editableSelectors = ['[contenteditable="true"]', '[isContentEditable]'];
    
    this.init();
  }

  init() {
    // Register all shortcuts
    this.registerShortcuts();
    
    // Add global event listener
    document.addEventListener('keydown', (e) => this.handleKeydown(e));
  }

  registerShortcuts() {
    // Gallery shortcuts
    this.register('c', {
      description: 'Copy current prompt to clipboard',
      handler: () => this.handleCopy(),
      context: 'gallery'
    });

    this.register('r', {
      description: 'Refresh all images',
      handler: () => this.handleRefresh(),
      context: 'gallery'
    });

    this.register('d', {
      description: 'Deselect all images',
      handler: () => this.handleDeselect(),
      context: 'gallery'
    });

    this.register('f', {
      description: 'Toggle favorites view',
      handler: () => this.handleFavorites(),
      context: 'gallery'
    });

    this.register('v', {
      description: 'Toggle selected view',
      handler: () => this.handleSelected(),
      context: 'gallery'
    });

    this.register('s', {
      description: 'Toggle search',
      handler: (e) => this.handleSearch(e),
      context: 'gallery'
    });

    this.register('a', {
      description: 'Randomize selection',
      handler: () => this.handleRandomize(),
      context: 'gallery'
    });

    // Prompt generator shortcuts
    this.register('g', {
      description: 'Generate prompt',
      handler: () => this.handleGenerate(),
      context: 'prompt-generator'
    });

    this.register('p', {
      description: 'Toggle settings panel',
      handler: () => this.handleSettings(),
      context: 'prompt-generator'
    });
  }

  register(key, config) {
    const normalizedKey = key.toLowerCase();
    
    // Check for conflicts
    if (this.shortcuts.has(normalizedKey)) {
      console.warn(`Keyboard shortcut conflict: '${key}' is already registered. Overwriting.`);
    }
    
    this.shortcuts.set(normalizedKey, {
      ...config,
      key: normalizedKey
    });
  }

  handleKeydown(e) {
    if (!this.isEnabled) return;
    
    // Check if user is typing in an input field
    if (this.isInputField(e.target)) {
      return;
    }

    const key = e.key.toLowerCase();
    const shortcut = this.shortcuts.get(key);
    
    if (shortcut) {
      e.preventDefault();
      e.stopPropagation();
      
      try {
        shortcut.handler(e);
      } catch (error) {
        console.error(`Error executing keyboard shortcut '${key}':`, error);
      }
    }
  }

  isInputField(element) {
    // Check for input/textarea elements
    if (this.inputSelectors.includes(element.tagName)) {
      return true;
    }
    
    // Check for contenteditable elements
    for (const selector of this.editableSelectors) {
      if (element.matches(selector)) {
        return true;
      }
    }
    
    // Check for contentEditable property
    if (element.contentEditable === 'true' || element.isContentEditable) {
      return true;
    }
    
    return false;
  }

  // Gallery shortcut handlers
  handleCopy() {
    if (window.galleryController && window.galleryController.model) {
      const finalPrompt = window.galleryController.model.generateFinalPrompt();
      navigator.clipboard.writeText(finalPrompt)
        .then(() => {
          if (window.galleryController && window.galleryController.view) {
            window.galleryController.view.showInfoNotification('Prompt copied to clipboard.');
          }
        })
        .catch(err => {
          console.error('Failed to copy text: ', err);
          if (window.galleryController && window.galleryController.view) {
            window.galleryController.view.showInfoNotification('Failed to copy to clipboard.');
          }
        });
    }
  }

  handleRefresh() {
    if (window.galleryController) {
      window.galleryController.model.shuffleImages();
      window.galleryController.view.refreshImageQuadrants();
      window.galleryController.renderGallery();
    }
  }

  handleDeselect() {
    if (window.galleryController && window.galleryController.model) {
      if (window.galleryController.model.selectedImages.size === 0) {
        if (window.galleryController.view) {
          window.galleryController.view.showNoSelectedWarning();
        }
        return;
      }
      
      window.galleryController.model.selectedImages.clear();
      if (window.galleryController.view) {
        window.galleryController.view.showInfoNotification('All selections cleared.');
      }
      window.galleryController.renderGallery();
      window.galleryController.updatePrompt();
    }
  }

  handleFavorites() {
    if (window.galleryController) {
      // If selected view is active, turn it off
      if (window.galleryController.showOnlySelected && !window.galleryController.model.showOnlyFavorites) {
        window.galleryController.showOnlySelected = false;
        window.galleryController.view.updateShowSelectedToggle(false);
      }
      
      // If search is active, turn it off
      if (window.galleryController.searchNumber !== null && window.galleryController.searchNumber !== '') {
        window.galleryController.clearSearchState();
      }
      
      // Toggle the state
      window.galleryController.model.toggleFavoritesOnly();
      
      // Update the UI
      window.galleryController.view.updateFavoritesToggle(window.galleryController.model.showOnlyFavorites);
      
      // Scroll to top when activating favorites view
      if (window.galleryController.model.showOnlyFavorites) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      
      // Render the gallery
      window.galleryController.renderGallery();
      
      // Close collapsible sections
      window.galleryController.view.closeAllCollapsibleSections();
      
      // Trigger button animation
      const favoritesBtn = document.getElementById('favorites-toggle');
      if (favoritesBtn) {
        favoritesBtn.classList.add('bounce');
        setTimeout(() => {
          favoritesBtn.classList.remove('bounce');
        }, 600);
      }
    }
  }

  handleSelected() {
    if (window.galleryController) {
      // If favorites view is active, turn it off
      if (window.galleryController.model.showOnlyFavorites && !window.galleryController.showOnlySelected) {
        window.galleryController.model.showOnlyFavorites = false;
        window.galleryController.view.updateFavoritesToggle(false);
      }
      
      // If search is active, turn it off
      if (window.galleryController.searchNumber !== null && window.galleryController.searchNumber !== '') {
        window.galleryController.clearSearchState();
      }
      
      window.galleryController.showOnlySelected = !window.galleryController.showOnlySelected;
      window.galleryController.view.updateShowSelectedToggle(window.galleryController.showOnlySelected);
      
      // Scroll to top when activating selected view
      if (window.galleryController.showOnlySelected) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      
      // If toggling on and no images are selected, show warning
      if (window.galleryController.showOnlySelected && window.galleryController.model.selectedImages.size === 0) {
        window.galleryController.view.showFullWidthNoSelectedWarning();
      } else {
        window.galleryController.view.hideFullWidthNoSelectedWarning();
      }
      
      window.galleryController.renderGallery();
      window.galleryController.model.saveToStorage();
      
      // Close collapsible sections
      window.galleryController.view.closeAllCollapsibleSections();
      
      // Trigger button animation
      const selectedBtn = document.getElementById('show-selected-btn');
      if (selectedBtn) {
        selectedBtn.classList.toggle('active');
      }
    }
  }

  handleSearch(e) {
    if (window.galleryController) {
      window.galleryController.toggleSearch();
    }
  }

  handleRandomize() {
    if (window.galleryController) {
      window.galleryController.randomizeSelection();
    }
  }

  // Prompt generator shortcut handlers
  handleGenerate() {
    // Try prompt generator first
    if (window.promptGenerator && typeof window.promptGenerator.generatePrompt === 'function') {
      window.promptGenerator.generatePrompt();
    }
    // Fallback to prompt injector
    else if (window.promptInjector && typeof window.promptInjector.generate === 'function') {
      window.promptInjector.generate();
    }
  }

  handleSettings() {
    // Try prompt generator first
    if (window.promptGenerator && typeof window.promptGenerator.toggleSettings === 'function') {
      window.promptGenerator.ensurePromptMenuVisible();
      window.promptGenerator.toggleSettings();
    }
    // Fallback to prompt injector
    else if (window.promptInjector && typeof window.promptInjector.togglePanel === 'function') {
      window.promptInjector.ensurePromptMenuVisible();
      window.promptInjector.togglePanel();
    }
  }

  // Utility methods
  enable() {
    this.isEnabled = true;
  }

  disable() {
    this.isEnabled = false;
  }

  getShortcuts() {
    return Array.from(this.shortcuts.values());
  }

  getShortcutsByContext(context) {
    return this.getShortcuts().filter(shortcut => shortcut.context === context);
  }

  // Debug method to verify shortcuts are registered
  debug() {
    console.log('KeyboardShortcutManager Debug Info:');
    console.log('Enabled:', this.isEnabled);
    console.log('Registered shortcuts:', this.getShortcuts());
    console.log('Gallery shortcuts:', this.getShortcutsByContext('gallery'));
    console.log('Prompt generator shortcuts:', this.getShortcutsByContext('prompt-generator'));
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = KeyboardShortcutManager;
}

// Make available globally
window.KeyboardShortcutManager = KeyboardShortcutManager; 