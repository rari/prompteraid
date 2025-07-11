/**
 * Component UI Manager for PrompterAid
 * 
 * Handles the UI for displaying and managing saved components in the favorites bar
 */

class ComponentUI {
  constructor(componentManager) {
    this.componentManager = componentManager;
    this.container = null;
    this.init();
  }

  init() {
    console.log('ComponentUI init called');
    // Create the component container in the favorites bar
    this.createComponentContainer();
    
    // Listen for component changes
    this.componentManager.onComponentsChange = () => {
      console.log('Components changed, updating display');
      this.updateComponentDisplay();
    };
    
    // Listen for favorites tools visibility changes
    this.observeFavoritesToolsVisibility();
    console.log('ComponentUI init completed');
  }

  observeFavoritesToolsVisibility() {
    // Create a mutation observer to watch for class changes on favorites-tools
    const favoritesTools = document.getElementById('favorites-tools');
    if (favoritesTools) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const isVisible = !favoritesTools.classList.contains('hidden');
            if (isVisible) {
              // Ensure component section exists and is updated
              this.ensureComponentSectionExists();
            }
          }
        });
      });
      
      observer.observe(favoritesTools, { attributes: true });
    }
  }

  ensureComponentSectionExists() {
    const componentSection = document.getElementById('component-section');
    if (!componentSection) {
      this.createComponentContainer();
    } else {
      this.updateComponentDisplay();
    }
  }

  createComponentContainer() {
    console.log('createComponentContainer called');
    // Check if component section already exists
    let componentSection = document.getElementById('component-section');
    if (!componentSection) {
      console.log('Creating new component section');
      // Create component section
      componentSection = document.createElement('div');
      componentSection.id = 'component-section';
      componentSection.className = 'component-section';
      
      // Create header
      const header = document.createElement('div');
      header.className = 'component-section-header';
      header.innerHTML = `
        <i class="fas fa-save"></i>
        <h4>Saved Components</h4>
        <button id="save-component-btn" class="action-button" title="Save current configuration" aria-label="Save current configuration">
          <i class="fas fa-plus"></i>
          <span>Save</span>
        </button>
      `;
      
      // Create component list container
      const componentList = document.createElement('div');
      componentList.id = 'component-list';
      componentList.className = 'component-list';
      
      componentSection.appendChild(header);
      componentSection.appendChild(componentList);
      
      // Try to insert in favorites tools first, fallback to main content
      const favoritesTools = document.getElementById('favorites-tools');
      console.log('Favorites tools found:', !!favoritesTools);
      if (favoritesTools) {
        const favoritesHeader = favoritesTools.querySelector('.favorites-tools-header');
        console.log('Favorites header found:', !!favoritesHeader);
        if (favoritesHeader) {
          console.log('Inserting component section after favorites header');
          favoritesHeader.parentNode.insertBefore(componentSection, favoritesHeader.nextSibling);
        } else {
          console.log('Inserting component section at end of favorites tools');
          favoritesTools.appendChild(componentSection);
        }
      } else {
        console.log('Favorites tools not found, inserting in main content');
        // Fallback: insert in main content area
        const mainContent = document.querySelector('main');
        if (mainContent) {
          mainContent.appendChild(componentSection);
        }
      }
    } else {
      console.log('Component section already exists');
    }
    
    this.container = componentSection;
    
    // Bind save button
    const saveBtn = document.getElementById('save-component-btn');
    console.log('Save button found:', !!saveBtn);
    if (saveBtn) {
      console.log('Adding click listener to save button');
      saveBtn.addEventListener('click', () => {
        console.log('Save button clicked - event listener triggered');
        this.showSaveDialog();
      });
    } else {
      console.error('Save button not found in DOM');
    }
    
    // Initial update
    this.updateComponentDisplay();
  }

  updateComponentDisplay() {
    const componentList = document.getElementById('component-list');
    if (!componentList) return;

    const components = this.componentManager.getComponents();
    const count = this.componentManager.getComponentsCount();
    const canSaveMore = this.componentManager.canSaveMore();

    // Update save button state
    const saveBtn = document.getElementById('save-component-btn');
    if (saveBtn) {
      saveBtn.disabled = !canSaveMore;
      saveBtn.title = canSaveMore ? 'Save current configuration' : `Maximum ${this.componentManager.maxComponents} components allowed`;
    }

    // Clear existing components
    componentList.innerHTML = '';

    if (components.length === 0) {
      componentList.innerHTML = `
        <div class="no-components">
          <p>No saved components yet</p>
          <p class="component-hint">Save your current prompt configuration for quick access</p>
        </div>
      `;
      return;
    }

    // Create component items
    components.forEach(component => {
      const componentItem = this.createComponentItem(component);
      componentList.appendChild(componentItem);
    });

    // Show count
    const countElement = document.createElement('div');
    countElement.className = 'component-count';
    countElement.textContent = `${count}/${this.componentManager.maxComponents} components`;
    componentList.appendChild(countElement);
  }

  createComponentItem(component) {
    const item = document.createElement('div');
    item.className = 'component-item';
    item.dataset.componentId = component.id;
    
    const config = component.configuration;
    const timestamp = new Date(component.created_at).toLocaleDateString();
    
    item.innerHTML = `
      <div class="component-info">
        <div class="component-name">${component.name}</div>
        <div class="component-details">
          <span class="component-prompt">${config.prompt ? config.prompt.substring(0, 30) + '...' : 'No prompt'}</span>
          <span class="component-timestamp">${timestamp}</span>
        </div>
      </div>
      <div class="component-actions">
        <button class="component-load-btn" title="Load this component" aria-label="Load component ${component.name}">
          <i class="fas fa-download"></i>
        </button>
        <button class="component-edit-btn" title="Edit component name" aria-label="Edit component ${component.name}">
          <i class="fas fa-edit"></i>
        </button>
        <button class="component-delete-btn" title="Delete this component" aria-label="Delete component ${component.name}">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;

    // Bind actions
    const loadBtn = item.querySelector('.component-load-btn');
    const editBtn = item.querySelector('.component-edit-btn');
    const deleteBtn = item.querySelector('.component-delete-btn');

    loadBtn.addEventListener('click', () => this.loadComponent(component.id));
    editBtn.addEventListener('click', () => this.editComponent(component));
    deleteBtn.addEventListener('click', () => this.deleteComponent(component.id));

    return item;
  }

  async loadComponent(componentId) {
    try {
      await this.componentManager.loadComponent(componentId);
      this.showNotification('Component loaded successfully', 'success');
    } catch (error) {
      console.error('Error loading component:', error);
      this.showNotification('Failed to load component', 'error');
    }
  }

  async deleteComponent(componentId) {
    if (!confirm('Are you sure you want to delete this component?')) {
      return;
    }

    try {
      await this.componentManager.deleteComponent(componentId);
      this.updateComponentDisplay();
      this.showNotification('Component deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting component:', error);
      this.showNotification('Failed to delete component', 'error');
    }
  }

  editComponent(component) {
    // Update component with current configuration and auto-generated name
    this.componentManager.updateComponent(component.id)
      .then(() => {
        this.updateComponentDisplay();
        this.showNotification('Component updated successfully', 'success');
      })
      .catch(error => {
        console.error('Error updating component:', error);
        this.showNotification('Failed to update component', 'error');
      });
  }

  showSaveDialog() {
    console.log('Save button clicked - showSaveDialog called');
    console.log('ComponentManager available:', !!this.componentManager);
    console.log('Current user:', this.componentManager?.currentUser);
    
    this.componentManager.saveComponent()
      .then(() => {
        console.log('Component saved successfully');
        this.updateComponentDisplay();
        this.showNotification('Component saved successfully', 'success');
      })
      .catch(error => {
        console.error('Error saving component:', error);
        this.showNotification(error.message || 'Failed to save component', 'error');
      });
  }

  showNotification(message, type = 'info') {
    // Use the existing notification system if available
    if (window.galleryController && window.galleryController.view) {
      if (type === 'success') {
        window.galleryController.view.showInfoNotification(message);
      } else if (type === 'error') {
        window.galleryController.view.showErrorNotification(message);
      } else {
        window.galleryController.view.showInfoNotification(message);
      }
    } else {
      // Fallback notification
      console.log(`${type.toUpperCase()}: ${message}`);
    }
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ComponentUI;
}

// Make available globally
window.ComponentUI = ComponentUI; 