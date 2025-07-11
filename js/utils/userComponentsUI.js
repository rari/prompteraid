/**
 * User Components UI Manager
 * 
 * Handles the UI for saving and loading user prompt configurations
 */

class UserComponentsUI {
  constructor() {
    console.log('UserComponentsUI: Constructor called');
    this.componentsManager = null;
    this.saveModal = null;
    this.loadModal = null;
    // Delay initialization to ensure everything is loaded
    setTimeout(() => this.init(), 100);
  }

  async init() {
    console.log('UserComponentsUI: Initializing...');
    
    // Wait for UserComponentsManager to be available
    if (window.UserComponentsManager) {
      console.log('UserComponentsUI: UserComponentsManager found, creating instance...');
      try {
        this.componentsManager = new window.UserComponentsManager();
        console.log('UserComponentsUI: UserComponentsManager created successfully');
        this.createUI();
        this.setupAuthListener();
      } catch (error) {
        console.error('UserComponentsUI: Error creating UserComponentsManager:', error);
        // Retry after a delay
        setTimeout(() => this.init(), 500);
      }
    } else {
      console.log('UserComponentsUI: UserComponentsManager not found, retrying...');
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
    this.createSaveLoadButtons();
    this.createModals();
  }

  createSaveLoadButtons() {
    // Add save/load buttons to the favorites tools section
    const favoritesTools = document.getElementById('favorites-tools');
    if (favoritesTools) {
      const favoritesButtons = favoritesTools.querySelector('.favorites-tools-buttons');
      if (favoritesButtons) {
        // Add separator
        const separator = document.createElement('div');
        separator.className = 'favorites-separator';
        separator.innerHTML = '<hr>';
        favoritesButtons.appendChild(separator);

        // Add save button
        const saveButton = document.createElement('button');
        saveButton.id = 'save-component-btn';
        saveButton.className = 'action-button';
        saveButton.innerHTML = '<i class="fas fa-save"></i><span>Save Config</span>';
        saveButton.title = 'Save current prompt configuration';
        saveButton.setAttribute('aria-label', 'Save current prompt configuration');
        
        saveButton.addEventListener('click', () => {
          this.showSaveModal();
        });

        favoritesButtons.appendChild(saveButton);

        // Add load button
        const loadButton = document.createElement('button');
        loadButton.id = 'load-component-btn';
        loadButton.className = 'action-button';
        loadButton.innerHTML = '<i class="fas fa-folder-open"></i><span>Load Config</span>';
        loadButton.title = 'Load saved prompt configuration';
        loadButton.setAttribute('aria-label', 'Load saved prompt configuration');
        
        loadButton.addEventListener('click', () => {
          this.showLoadModal();
        });

        favoritesButtons.appendChild(loadButton);

        // Initially hide the buttons if not authenticated
        this.updateButtonVisibility();
      }
    }
  }

  updateButtonVisibility() {
    const saveButton = document.getElementById('save-component-btn');
    const loadButton = document.getElementById('load-component-btn');
    const separator = document.querySelector('.favorites-separator');

    if (this.componentsManager && this.componentsManager.isAuthenticated()) {
      // Show buttons when authenticated
      if (saveButton) saveButton.style.display = 'flex';
      if (loadButton) loadButton.style.display = 'flex';
      if (separator) separator.style.display = 'block';
    } else {
      // Hide buttons when not authenticated
      if (saveButton) saveButton.style.display = 'none';
      if (loadButton) loadButton.style.display = 'none';
      if (separator) separator.style.display = 'none';
    }
  }

  createModals() {
    this.createSaveModal();
    this.createLoadModal();
  }

  createSaveModal() {
    // Create save modal
    const modal = document.createElement('div');
    modal.id = 'save-component-modal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Save Prompt Configuration</h3>
          <button class="modal-close" aria-label="Close modal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="component-name">Name:</label>
            <input type="text" id="component-name" placeholder="Enter a name for this configuration">
          </div>
          <div class="form-group">
            <label>Current Configuration:</label>
            <div id="current-config-preview" class="config-preview"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button id="save-component-confirm" class="btn btn-primary">Save</button>
          <button id="save-component-cancel" class="btn btn-secondary">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.saveModal = modal;

    // Add event listeners
    this.saveModal.querySelector('.modal-close').addEventListener('click', () => {
      this.hideSaveModal();
    });

    this.saveModal.querySelector('#save-component-cancel').addEventListener('click', () => {
      this.hideSaveModal();
    });

    this.saveModal.querySelector('#save-component-confirm').addEventListener('click', () => {
      this.saveComponent();
    });

    // Close on backdrop click
    this.saveModal.addEventListener('click', (e) => {
      if (e.target === this.saveModal) {
        this.hideSaveModal();
      }
    });
  }

  createLoadModal() {
    // Create load modal
    const modal = document.createElement('div');
    modal.id = 'load-component-modal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Load Prompt Configuration</h3>
          <button class="modal-close" aria-label="Close modal">×</button>
        </div>
        <div class="modal-body">
          <div id="saved-components-list" class="components-list">
            <div class="loading">Loading saved configurations...</div>
          </div>
        </div>
        <div class="modal-footer">
          <button id="load-component-cancel" class="btn btn-secondary">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.loadModal = modal;

    // Add event listeners
    this.loadModal.querySelector('.modal-close').addEventListener('click', () => {
      this.hideLoadModal();
    });

    this.loadModal.querySelector('#load-component-cancel').addEventListener('click', () => {
      this.hideLoadModal();
    });

    // Close on backdrop click
    this.loadModal.addEventListener('click', (e) => {
      if (e.target === this.loadModal) {
        this.hideLoadModal();
      }
    });
  }

  async showSaveModal() {
    if (!this.componentsManager.isAuthenticated()) {
      this.showNotification('Please sign in to save configurations', 'error');
      return;
    }

    // Update preview
    this.updateSavePreview();
    
    // Show modal
    this.saveModal.classList.remove('hidden');
    
    // Focus on name input
    setTimeout(() => {
      const nameInput = this.saveModal.querySelector('#component-name');
      if (nameInput) {
        nameInput.focus();
      }
    }, 100);
  }

  hideSaveModal() {
    this.saveModal.classList.add('hidden');
    // Clear name input
    const nameInput = this.saveModal.querySelector('#component-name');
    if (nameInput) {
      nameInput.value = '';
    }
  }

  async showLoadModal() {
    if (!this.componentsManager.isAuthenticated()) {
      this.showNotification('Please sign in to load configurations', 'error');
      return;
    }

    // Load and display components
    await this.loadComponentsList();
    
    // Show modal
    this.loadModal.classList.remove('hidden');
  }

  hideLoadModal() {
    this.loadModal.classList.add('hidden');
  }

  updateSavePreview() {
    const preview = this.saveModal.querySelector('#current-config-preview');
    if (!preview) return;

    const galleryController = window.galleryController;
    if (!galleryController || !galleryController.model) {
      preview.innerHTML = '<div class="error">Gallery controller not available</div>';
      return;
    }

    const config = {
      basePrompt: galleryController.model.basePrompt || '',
      suffix: galleryController.model.suffix || '',
      aspectRatio: galleryController.model.aspectRatio || '1:1',
      selectedImages: galleryController.model.selectedImages.size,
      model: galleryController.model.currentModel || 'niji-6'
    };

    preview.innerHTML = `
      <div class="config-item">
        <strong>Base Prompt:</strong> ${config.basePrompt || 'None'}
      </div>
      <div class="config-item">
        <strong>Suffix:</strong> ${config.suffix || 'None'}
      </div>
      <div class="config-item">
        <strong>Aspect Ratio:</strong> ${config.aspectRatio}
      </div>
      <div class="config-item">
        <strong>Selected Images:</strong> ${config.selectedImages}
      </div>
      <div class="config-item">
        <strong>Model:</strong> ${config.model}
      </div>
    `;
  }

  async loadComponentsList() {
    const listContainer = this.loadModal.querySelector('#saved-components-list');
    if (!listContainer) return;

    try {
      listContainer.innerHTML = '<div class="loading">Loading...</div>';
      
      const components = await this.componentsManager.getComponents();
      
      if (components.length === 0) {
        listContainer.innerHTML = '<div class="no-components">No saved configurations found</div>';
        return;
      }

      listContainer.innerHTML = components.map(component => `
        <div class="component-item" data-id="${component.id}">
          <div class="component-info">
            <div class="component-name">${component.name}</div>
            <div class="component-date">${new Date(component.created_at).toLocaleDateString()}</div>
            <div class="component-preview">
              <strong>Prompt:</strong> ${component.configuration.basePrompt || 'None'} |
              <strong>Images:</strong> ${component.configuration.selectedImages?.length || 0}
            </div>
          </div>
          <div class="component-actions">
            <button class="btn btn-small btn-primary load-component-btn" data-id="${component.id}">
              <i class="fas fa-folder-open"></i> Load
            </button>
            <button class="btn btn-small btn-danger delete-component-btn" data-id="${component.id}">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `).join('');

      // Add event listeners
      listContainer.querySelectorAll('.load-component-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const componentId = e.target.dataset.id;
          this.loadComponent(componentId);
        });
      });

      listContainer.querySelectorAll('.delete-component-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const componentId = e.target.dataset.id;
          this.deleteComponent(componentId);
        });
      });

    } catch (error) {
      console.error('Error loading components:', error);
      listContainer.innerHTML = '<div class="error">Error loading configurations</div>';
    }
  }

  async saveComponent() {
    try {
      const nameInput = this.saveModal.querySelector('#component-name');
      const name = nameInput.value.trim();

      await this.componentsManager.saveComponent(name);
      
      this.hideSaveModal();
      this.showNotification('Configuration saved successfully!', 'success');
      
    } catch (error) {
      console.error('Error saving component:', error);
      this.showNotification(error.message, 'error');
    }
  }

  async loadComponent(componentId) {
    try {
      await this.componentsManager.loadComponent(componentId);
      
      this.hideLoadModal();
      this.showNotification('Configuration loaded successfully!', 'success');
      
    } catch (error) {
      console.error('Error loading component:', error);
      this.showNotification(error.message, 'error');
    }
  }

  async deleteComponent(componentId) {
    if (!confirm('Are you sure you want to delete this configuration?')) {
      return;
    }

    try {
      await this.componentsManager.deleteComponent(componentId);
      
      // Refresh the list
      await this.loadComponentsList();
      this.showNotification('Configuration deleted successfully!', 'success');
      
    } catch (error) {
      console.error('Error deleting component:', error);
      this.showNotification(error.message, 'error');
    }
  }

  showNotification(message, type = 'info') {
    // Use existing notification system if available
    if (window.galleryController && window.galleryController.view) {
      if (type === 'success') {
        window.galleryController.view.showInfoNotification(message);
      } else if (type === 'error') {
        window.galleryController.view.showErrorNotification(message);
      } else {
        window.galleryController.view.showInfoNotification(message);
      }
    } else {
      // Fallback to alert
      alert(message);
    }
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UserComponentsUI;
}

// Make available globally
window.UserComponentsUI = UserComponentsUI; 