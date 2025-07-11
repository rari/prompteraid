/**
 * User Components UI Manager
 * 
 * Handles the UI for saving and loading user prompt configurations
 */

class UserComponentsUI {
  constructor() {
    this.componentsManager = null;
    this.saveButton = null;
    this.savedTokensContainer = null;
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

        // Create container for save interface
        const saveContainer = document.createElement('div');
        saveContainer.className = 'save-container';
        saveContainer.style.cssText = `
          display: flex;
          gap: 8px;
          align-items: center;
          width: 100%;
          margin-bottom: 12px;
        `;

        // Add save button
        const saveButton = document.createElement('button');
        saveButton.id = 'save-component-btn';
        saveButton.className = 'action-button';
        saveButton.innerHTML = '<i class="fas fa-save"></i><span>Save Current</span>';
        saveButton.title = 'Save current prompt configuration';
        saveButton.setAttribute('aria-label', 'Save current prompt configuration');
        
        saveButton.addEventListener('click', () => {
          this.saveCurrentConfiguration();
        });

        saveContainer.appendChild(saveButton);

        // Add load button
        const loadButton = document.createElement('button');
        loadButton.id = 'load-component-btn';
        loadButton.className = 'action-button';
        loadButton.innerHTML = '<i class="fas fa-folder-open"></i><span>Load Config</span>';
        loadButton.title = 'Load saved prompt configuration';
        loadButton.setAttribute('aria-label', 'Load saved prompt configuration');
        
        loadButton.addEventListener('click', () => {
          // Show a simple prompt to select a configuration
          this.showLoadPrompt();
        });

        saveContainer.appendChild(loadButton);

        favoritesButtons.appendChild(saveContainer);

        // Create Saved Tokens section
        const savedTokensSection = document.createElement('div');
        savedTokensSection.className = 'saved-tokens-section';
        savedTokensSection.style.cssText = `
          width: 100%;
          margin-top: 12px;
        `;

        // Section header
        const sectionHeader = document.createElement('div');
        sectionHeader.className = 'saved-tokens-header';
        sectionHeader.style.cssText = `
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          font-weight: 600;
          color: var(--text-primary);
        `;
        sectionHeader.innerHTML = '<i class="fas fa-tokens"></i><span>Saved Tokens</span>';
        savedTokensSection.appendChild(sectionHeader);

        // Container for saved tokens
        const savedTokensContainer = document.createElement('div');
        savedTokensContainer.className = 'saved-tokens-container';
        savedTokensContainer.style.cssText = `
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 200px;
          overflow-y: auto;
        `;
        savedTokensSection.appendChild(savedTokensContainer);

        favoritesButtons.appendChild(savedTokensSection);

        // Store references
        this.saveButton = saveButton;
        this.savedTokensContainer = savedTokensContainer;

        // Initially hide the interface if not authenticated
        this.updateButtonVisibility();
        
        // Load saved configurations
        this.loadSavedConfigurations();
      }
    }
  }

  updateButtonVisibility() {
    const saveContainer = document.querySelector('.save-container');
    const savedTokensSection = document.querySelector('.saved-tokens-section');
    const separator = document.querySelector('.favorites-separator');

    if (this.componentsManager && this.componentsManager.isAuthenticated()) {
      // Show interface when authenticated
      if (saveContainer) saveContainer.style.display = 'flex';
      if (savedTokensSection) savedTokensSection.style.display = 'block';
      if (separator) separator.style.display = 'block';
    } else {
      // Hide interface when not authenticated
      if (saveContainer) saveContainer.style.display = 'none';
      if (savedTokensSection) savedTokensSection.style.display = 'none';
      if (separator) separator.style.display = 'none';
    }
  }

  async loadSavedConfigurations() {
    if (!this.componentsManager || !this.componentsManager.isAuthenticated()) {
      return;
    }

    try {
      const components = await this.componentsManager.getComponents();
      
      // Clear existing tokens
      this.savedTokensContainer.innerHTML = '';

      if (components.length === 0) {
        const noTokensMessage = document.createElement('div');
        noTokensMessage.style.cssText = `
          text-align: center;
          color: var(--text-secondary);
          font-style: italic;
          padding: 8px;
        `;
        noTokensMessage.textContent = 'No saved configurations yet';
        this.savedTokensContainer.appendChild(noTokensMessage);
        return;
      }

      // Add saved configurations as individual tokens
      components.forEach(component => {
        const tokenElement = this.createTokenElement(component);
        this.savedTokensContainer.appendChild(tokenElement);
      });

    } catch (error) {
      console.error('Error loading saved configurations:', error);
    }
  }

  createTokenElement(component) {
    const tokenElement = document.createElement('div');
    tokenElement.className = 'saved-token';
    tokenElement.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--card-background);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      font-size: 14px;
    `;

    // Token info
    const tokenInfo = document.createElement('div');
    tokenInfo.style.cssText = `
      flex: 1;
      min-width: 0;
    `;

    // Create a descriptive name from the configuration
    let displayName = component.name;
    if (!displayName || displayName === 'Unknown') {
      const config = component.configuration;
      if (config.basePrompt) {
        displayName = config.basePrompt.substring(0, 25);
        if (config.basePrompt.length > 25) displayName += '...';
      } else {
        displayName = `Config ${component.id}`;
      }
    }

    // Add selection count if available
    if (component.configuration.selectedImages && component.configuration.selectedImages.length > 0) {
      displayName += ` (${component.configuration.selectedImages.length})`;
    }

    tokenInfo.innerHTML = `
      <div style="font-weight: 500; color: var(--text-primary); margin-bottom: 2px;">${displayName}</div>
      <div style="font-size: 12px; color: var(--text-secondary);">${new Date(component.created_at).toLocaleDateString()}</div>
    `;

    tokenElement.appendChild(tokenInfo);

    // Action buttons container
    const actionButtons = document.createElement('div');
    actionButtons.style.cssText = `
      display: flex;
      gap: 4px;
    `;

    // Load button
    const loadBtn = document.createElement('button');
    loadBtn.className = 'action-button';
    loadBtn.style.cssText = `
      padding: 4px 8px;
      font-size: 12px;
      min-width: auto;
    `;
    loadBtn.innerHTML = '<i class="fas fa-folder-open"></i>';
    loadBtn.title = 'Load this configuration';
    loadBtn.addEventListener('click', () => {
      this.loadConfiguration(component.id);
    });

    // Save button (overwrite current token)
    const saveBtn = document.createElement('button');
    saveBtn.className = 'action-button';
    saveBtn.style.cssText = `
      padding: 4px 8px;
      font-size: 12px;
      min-width: auto;
    `;
    saveBtn.innerHTML = '<i class="fas fa-save"></i>';
    saveBtn.title = 'Save current config to this token';
    saveBtn.addEventListener('click', () => {
      this.saveToExistingToken(component.id);
    });

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-button';
    deleteBtn.style.cssText = `
      padding: 4px 8px;
      font-size: 12px;
      min-width: auto;
      color: #ef4444;
    `;
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    deleteBtn.title = 'Delete this configuration';
    deleteBtn.addEventListener('click', () => {
      this.deleteConfiguration(component.id);
    });

    actionButtons.appendChild(loadBtn);
    actionButtons.appendChild(saveBtn);
    actionButtons.appendChild(deleteBtn);
    tokenElement.appendChild(actionButtons);

    return tokenElement;
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
      
      // Reload the tokens
      await this.loadSavedConfigurations();
      
      this.showNotification('Configuration saved successfully!', 'success');
      
    } catch (error) {
      console.error('Error saving configuration:', error);
      this.showNotification(`Error saving configuration: ${error.message}`, 'error');
    }
  }

  async saveToExistingToken(componentId) {
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

      // Update the existing component
      await this.componentsManager.updateComponent(componentId, configName);
      
      // Reload the tokens
      await this.loadSavedConfigurations();
      
      this.showNotification('Configuration updated successfully!', 'success');
      
    } catch (error) {
      console.error('Error updating configuration:', error);
      this.showNotification(`Error updating configuration: ${error.message}`, 'error');
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

  async showLoadPrompt() {
    if (!this.componentsManager || !this.componentsManager.isAuthenticated()) {
      this.showNotification('Please sign in to load configurations', 'error');
      return;
    }

    try {
      const components = await this.componentsManager.getComponents();
      
      if (components.length === 0) {
        this.showNotification('No saved configurations found', 'info');
        return;
      }

      // Create a simple list for selection
      const componentNames = components.map((comp, index) => 
        `${index + 1}. ${comp.name}`
      ).join('\n');

      const selection = prompt(`Select a configuration to load (1-${components.length}):\n\n${componentNames}`);
      
      if (selection && !isNaN(selection)) {
        const index = parseInt(selection) - 1;
        if (index >= 0 && index < components.length) {
          await this.loadConfiguration(components[index].id);
        } else {
          this.showNotification('Invalid selection', 'error');
        }
      }
    } catch (error) {
      console.error('Error showing load prompt:', error);
      this.showNotification(`Error loading configurations: ${error.message}`, 'error');
    }
  }

  async deleteConfiguration(componentId) {
    if (!this.componentsManager || !this.componentsManager.isAuthenticated()) {
      this.showNotification('Please sign in to delete configurations', 'error');
      return;
    }

    if (!confirm('Are you sure you want to delete this configuration?')) {
      return;
    }

    try {
      await this.componentsManager.deleteComponent(componentId);
      
      // Reload the tokens
      await this.loadSavedConfigurations();
      
      this.showNotification('Configuration deleted successfully!', 'success');
    } catch (error) {
      console.error('Error deleting configuration:', error);
      this.showNotification(`Error deleting configuration: ${error.message}`, 'error');
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