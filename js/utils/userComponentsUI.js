/**
 * User Components UI Manager
 * 
 * Handles the UI for saving and loading user prompt configurations
 */

class UserComponentsUI {
  constructor() {
    this.componentsManager = null;
    this.saveButton = null;
    this.loadDropdown = null;
    this.init();
  }

  async init() {
    // Wait for UserComponentsManager to be available
    if (window.UserComponentsManager) {
      this.componentsManager = new window.UserComponentsManager();
      this.createUI();
      this.setupAuthListener();
    } else {
      // Wait for it to load
      setTimeout(() => this.init(), 100);
    }
  }

  setupAuthListener() {
    // Listen for authentication state changes
    document.addEventListener('userAuthStateChanged', (event) => {
      this.updateButtonVisibility();
    });
  }

  createUI() {
    this.createSaveLoadInterface();
  }

  createSaveLoadInterface() {
    // Add save/load interface to the favorites tools section
    const favoritesTools = document.getElementById('favorites-tools');
    if (favoritesTools) {
      const favoritesButtons = favoritesTools.querySelector('.favorites-tools-buttons');
      if (favoritesButtons) {
        // Add separator
        const separator = document.createElement('div');
        separator.className = 'favorites-separator';
        separator.innerHTML = '<hr>';
        favoritesButtons.appendChild(separator);

        // Create container for save/load interface
        const saveLoadContainer = document.createElement('div');
        saveLoadContainer.className = 'save-load-container';
        saveLoadContainer.style.cssText = `
          display: flex;
          gap: 8px;
          align-items: center;
          width: 100%;
        `;

        // Add save button
        const saveButton = document.createElement('button');
        saveButton.id = 'save-component-btn';
        saveButton.className = 'action-button';
        saveButton.innerHTML = '<i class="fas fa-save"></i><span>Save</span>';
        saveButton.title = 'Save current prompt configuration';
        saveButton.setAttribute('aria-label', 'Save current prompt configuration');
        
        saveButton.addEventListener('click', () => {
          this.saveCurrentConfiguration();
        });

        saveLoadContainer.appendChild(saveButton);

        // Add load dropdown
        const loadDropdown = document.createElement('select');
        loadDropdown.id = 'load-component-dropdown';
        loadDropdown.className = 'load-dropdown';
        loadDropdown.style.cssText = `
          flex: 1;
          padding: 8px 12px;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          background: var(--bg-color);
          color: var(--text-color);
          font-size: 14px;
          cursor: pointer;
        `;
        
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Load saved config...';
        defaultOption.disabled = true;
        defaultOption.selected = true;
        loadDropdown.appendChild(defaultOption);

        loadDropdown.addEventListener('change', (e) => {
          if (e.target.value) {
            this.loadConfiguration(e.target.value);
            // Reset dropdown
            e.target.value = '';
          }
        });

        saveLoadContainer.appendChild(loadDropdown);

        favoritesButtons.appendChild(saveLoadContainer);

        // Store references
        this.saveButton = saveButton;
        this.loadDropdown = loadDropdown;

        // Initially hide the interface if not authenticated
        this.updateButtonVisibility();
        
        // Load saved configurations into dropdown
        this.loadSavedConfigurations();
      }
    }
  }

  updateButtonVisibility() {
    const saveLoadContainer = document.querySelector('.save-load-container');
    const separator = document.querySelector('.favorites-separator');

    if (this.componentsManager && this.componentsManager.isAuthenticated()) {
      // Show interface when authenticated
      if (saveLoadContainer) saveLoadContainer.style.display = 'flex';
      if (separator) separator.style.display = 'block';
    } else {
      // Hide interface when not authenticated
      if (saveLoadContainer) saveLoadContainer.style.display = 'none';
      if (separator) separator.style.display = 'none';
    }
  }

  async loadSavedConfigurations() {
    if (!this.componentsManager || !this.componentsManager.isAuthenticated()) {
      return;
    }

    try {
      const components = await this.componentsManager.getComponents();
      
      // Clear existing options except the first one
      while (this.loadDropdown.children.length > 1) {
        this.loadDropdown.removeChild(this.loadDropdown.lastChild);
      }

      // Add saved configurations
      components.forEach(component => {
        const option = document.createElement('option');
        option.value = component.id;
        
        // Create a descriptive name from the configuration
        let displayName = component.name;
        if (!displayName || displayName === 'Unknown') {
          const config = component.configuration;
          if (config.basePrompt) {
            displayName = config.basePrompt.substring(0, 30);
            if (config.basePrompt.length > 30) displayName += '...';
          } else {
            displayName = `Config ${component.id}`;
          }
        }
        
        // Add selection count if available
        if (component.configuration.selectedImages && component.configuration.selectedImages.length > 0) {
          displayName += ` (${component.configuration.selectedImages.length} selected)`;
        }
        
        option.textContent = displayName;
        this.loadDropdown.appendChild(option);
      });

    } catch (error) {
      console.error('Error loading saved configurations:', error);
    }
  }

  async saveCurrentConfiguration() {
    if (!this.componentsManager || !this.componentsManager.isAuthenticated()) {
      this.showNotification('Please sign in to save configurations', 'error');
      return;
    }

    try {
      // Generate a name based on current configuration
      const galleryController = window.galleryController;
      if (!galleryController || !galleryController.model) {
        this.showNotification('Gallery controller not available', 'error');
        return;
      }

      let configName = '';
      if (galleryController.model.basePrompt) {
        configName = galleryController.model.basePrompt.substring(0, 30);
        if (galleryController.model.basePrompt.length > 30) {
          configName += '...';
        }
      } else {
        configName = `Config ${Date.now()}`;
      }

      // Add selection count to name
      if (galleryController.model.selectedImages.size > 0) {
        configName += ` (${galleryController.model.selectedImages.size} selected)`;
      }

      // Save the configuration
      await this.componentsManager.saveComponent(configName);
      
      // Reload the dropdown
      await this.loadSavedConfigurations();
      
      this.showNotification('Configuration saved successfully!', 'success');
      
    } catch (error) {
      console.error('Error saving configuration:', error);
      this.showNotification(`Error saving configuration: ${error.message}`, 'error');
    }
  }

  async loadConfiguration(componentId) {
    if (!this.componentsManager || !this.componentsManager.isAuthenticated()) {
      this.showNotification('Please sign in to load configurations', 'error');
      return;
    }

    try {
      await this.componentsManager.loadComponent(componentId);
      this.showNotification('Configuration loaded successfully!', 'success');
    } catch (error) {
      console.error('Error loading configuration:', error);
      this.showNotification(`Error loading configuration: ${error.message}`, 'error');
    }
  }

  showNotification(message, type = 'info') {
    if (window.galleryController && window.galleryController.view) {
      if (type === 'error') {
        window.galleryController.view.showErrorNotification(message);
      } else if (type === 'success') {
        window.galleryController.view.showInfoNotification(message);
      } else {
        window.galleryController.view.showInfoNotification(message);
      }
    } else {
      // Fallback to alert if view not available
      alert(message);
    }
  }
}

// Make the class available globally
window.UserComponentsUI = UserComponentsUI; 