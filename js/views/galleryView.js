/**
 * PrompterAid Gallery View Component
 * 
 * Architecture Overview:
 * This view component implements the MVC pattern's View layer, responsible for:
 * - DOM manipulation and UI state management
 * - Event handling and user interaction
 * - Visual feedback and animations
 * - Responsive design with sticky navigation
 * 
 * Design Patterns Implemented:
 * 1. View Class Pattern
 *    - Encapsulates all DOM manipulation logic
 *    - Maintains single source of truth for UI state
 *    - Provides clean interface for controller communication
 * 
 * 2. Event Delegation Pattern
 *    - Main menu buttons serve as primary event sources
 *    - Sticky header delegates events to main menu for consistency
 *    - Reduces memory footprint and improves performance
 * 
 * 3. Component Lifecycle Management
 *    - Initialization: Sets up event listeners, clones menus, establishes state
 *    - Runtime: Handles scroll events, button interactions, state updates
 *    - Cleanup: Properly removes event listeners to prevent memory leaks
 * 
 * Key Features:
 * - Dual navigation system (main + sticky header)
 * - Real-time visual feedback for user actions
 * - Responsive design with scroll-based UI updates
 * - Accessibility-compliant keyboard navigation
 * 
 * Maintenance Guidelines:
 * - Preserve event delegation pattern for consistency
 * - Maintain centralized state management approach
 * - Follow established button ID conventions (main: 'button-id', sticky: 'sticky-button-id')
 * - Implement comprehensive error handling for all user interactions
 * - Ensure all animations are performant and accessible
 */

export default class GalleryView {
  // At the top of the class, add this static method:
  static restoreMenuStateIfModelSwitch() {
    if (sessionStorage.getItem('prompteraid-model-switch') === '1') {
      const state = JSON.parse(sessionStorage.getItem('prompteraid-menu-state') || '{}');
      // Restore prompt
      if (state.prompt !== undefined) {
        const promptInput = document.getElementById('prompt-input');
        if (promptInput) {
          promptInput.value = state.prompt;
          promptInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
      // Restore suffix
      if (state.suffix !== undefined) {
        const suffixInput = document.getElementById('prompt-suffix');
        if (suffixInput) {
          suffixInput.value = state.suffix;
          suffixInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
      // Restore aspect ratio
      if (state.aspectRatio !== undefined) {
        const aspectRatioSelect = document.getElementById('aspect-ratio-select');
        if (aspectRatioSelect) {
          aspectRatioSelect.value = state.aspectRatio;
          aspectRatioSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      // Restore checkboxes
      if (state.checkboxes) {
        Object.entries(state.checkboxes).forEach(([id, checked]) => {
          const cb = document.getElementById(id);
          if (cb) {
            cb.checked = checked;
            cb.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      }
      // Clear after restore
      sessionStorage.removeItem('prompteraid-menu-state');
      sessionStorage.removeItem('prompteraid-model-switch');
      return true; // Indicate that restoration happened
    }
    return false; // No restoration happened
  }

  constructor() {
    const wasRestored = GalleryView.restoreMenuStateIfModelSwitch();
    this.wasModelSwitchRestored = wasRestored; // Store this for later use
    this.gallery = document.getElementById('image-gallery');
    this.promptInput = document.getElementById('prompt-input');
    this.finalPrompt = document.getElementById('final-prompt');
    this.copyButton = document.getElementById('copy-button');
    this.favoritesToggle = document.getElementById('favorites-toggle');
    this.refreshButton = document.getElementById('refresh-button');
    this.noFavoritesMessage = document.getElementById('no-favorites');
    this.imageCountSubheader = document.getElementById('image-count-subheader');
    this.clearButton = document.getElementById('clear-button');
    this.togglePreviewButton = document.getElementById('toggle-preview-button');
    this.promptPreview = document.querySelector('.prompt-preview');
    this.modeToggle = document.getElementById('mode-toggle');
    this.clearButtonClickCount = 0;
    this.clearButtonTimeout = null;
    
    // Model selector initialization flags
    // this.documentClickHandlerAdded = false; // No longer needed for hover menu
    
    // Favorites tools bar
    this.favoritesTools = document.getElementById('favorites-tools');
    this.exportFavoritesButton = document.getElementById('export-favorites-button');
    this.importFavoritesButton = document.getElementById('import-favorites-button');
    this.clearFavoritesButton = document.getElementById('clear-favorites-button');
    this.importFavoritesInput = document.getElementById('import-favorites-input');
    
    // Store quadrants for each image
    this.imageQuadrants = new Map();

    // Add 👁️ show-selected button
    this.addShowSelectedButton();

    // The 'back-to-top-btn' now exists in HTML, so we just need to handle its events.
    this.backToTopButton = document.getElementById('back-to-top-btn');

    // Add sticky action bar
    this.addStickyActionBar();
    
    // Enhanced scroll handler with direction detection
    this.lastScrollY = 0;
    this.scrollThreshold = 10; // Minimum scroll distance to trigger direction change
    this.isScrollingUp = false;
    this.isScrollingDown = false;
    this.isInteractingWithSticky = false; // Track if user is interacting with sticky menu
    this.interactionTimeout = null; // Timeout to reset interaction state
    
    window.addEventListener('scroll', () => {
      this.handleScrollDirection();
      this.handleStickyBarVisibility();
      this.handleBackToTopVisibility();
    });
    
    // Reset scroll direction on window resize (e.g., device rotation)
    window.addEventListener('resize', () => {
      this.lastScrollY = window.scrollY;
      this.isScrollingUp = false;
      this.isScrollingDown = false;
      this.handleStickyBarVisibility(); // Re-evaluate visibility after resize
    });
    
    // Track interactions with sticky menu to prevent hiding during use
    this.setupStickyMenuInteractionTracking();
    
    // Add bubble animation to title
    this.addTitleBubbleEffect();
    
    // Add toggle preview functionality
    this.addTogglePreviewFunctionality();
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      this.stopBubbleAnimation();
    });

    // Initialize buttons
    this.initializeButtons();
    
    // Sync sticky menu with main menu to ensure all buttons work
    this.syncStickyMenu();

    // Store event handlers for direct access
    this._eventHandlers = {
      favoriteClick: []
    };

    // Initialize notification container
    this.initializeNotificationContainer();

    if (!this.gallery) {
      console.error('Gallery element not found');
    }

    // Add click-to-copy for prompt preview
    this.bindPromptPreviewCopy(this.getPromptText.bind(this));
    
    // Initialize tutorial section icon click handler
    this.initTutorialIconClick();

    // Aspect Ratio Enable/Disable Logic
    this.setupAspectRatioEnable();
  }

  initTutorialIconClick() {
    // Use a more robust approach that waits for DOM to be ready
    const initTutorialIcon = () => {
      const tutorialSection = document.querySelector('.more-info-container');
      if (tutorialSection) {
        console.log('Found tutorial section');
        
        const collapseButton = tutorialSection.querySelector('#minimize-tutorial');
        if (collapseButton) {
          console.log('Found tutorial collapse button, adding click handler');
          // Remove any existing click handlers to avoid duplicates
          collapseButton.removeEventListener('click', this.handleTutorialCollapse);
          collapseButton.addEventListener('click', this.handleTutorialCollapse);
        } else {
          console.log('Tutorial collapse button not found');
        }

        // Add click handler for the summary (icon/span) to minimize the section
        const summary = tutorialSection.querySelector('summary');
        if (summary) {
          console.log('Found tutorial summary, adding click handler');
          // Remove any existing click handlers to avoid duplicates
          summary.removeEventListener('click', this.handleTutorialSummaryClick);
          summary.addEventListener('click', this.handleTutorialSummaryClick);
        } else {
          console.log('Tutorial summary not found');
        }

        // Add toggle event listener to track state changes and update icon
        const details = tutorialSection.querySelector('details');
        if (details) {
          details.addEventListener('toggle', () => {
            this.updateSectionIcon(details, 'minimize-tutorial');
          });
          // Initialize the icon state
          this.updateSectionIcon(details, 'minimize-tutorial');
        }
      } else {
        console.log('Tutorial section not found');
      }
    };

    // Try immediately
    initTutorialIcon();
    
    // Also try after a short delay in case DOM isn't ready yet
    setTimeout(initTutorialIcon, 100);
  }

  // Separate handler methods for better organization
  handleTutorialCollapse = (e) => {
    console.log('Tutorial collapse button clicked');
    e.preventDefault();
    e.stopPropagation(); // Prevent the summary click from also firing
    const tutorialSection = document.querySelector('.more-info-container');
    const details = tutorialSection.querySelector('details');
    if (details) {
      details.open = !details.open;
      console.log('Tutorial section toggled, open:', details.open);
      this.updateSectionIcon(details, 'minimize-tutorial');
    }
  }

  handleTutorialSummaryClick = (e) => {
    // Check if the click was on the icon or span
    const clickedElement = e.target;
    const isIconClick = clickedElement.tagName === 'I' || 
                       clickedElement.tagName === 'SPAN' ||
                       clickedElement.closest('span');
    
    if (isIconClick) {
      console.log('Tutorial icon/span clicked, target:', clickedElement);
      e.stopPropagation(); // Prevent the summary click from also firing
      const tutorialSection = document.querySelector('.more-info-container');
      const details = tutorialSection.querySelector('details');
      if (details) {
        details.open = !details.open;
        console.log('Tutorial section toggled via icon/span, open:', details.open);
        this.updateSectionIcon(details, 'minimize-tutorial');
      }
    }
  }

  /**
   * Updates the icon of a section based on its open/closed state
   * @param {HTMLElement} details - The details element
   * @param {string} buttonId - The ID of the button to update
   */
  updateSectionIcon(details, buttonId) {
    const button = document.getElementById(buttonId);
    if (!button) return;
    
    const icon = button.querySelector('i');
    if (!icon) return;
    
    if (details.open) {
      // Section is open - show expand icon (arrows pointing outward)
      icon.className = 'fa-solid fa-up-right-and-down-left-from-center';
    } else {
      // Section is closed - show compress icon (arrows pointing inward)
      icon.className = 'fa-solid fa-down-left-and-up-right-to-center';
    }
  }

  getPromptText() {
    return this.finalPrompt ? this.finalPrompt.textContent : '';
  }

  bindPromptPreviewCopy(getPromptText) {
    const promptPreview = document.querySelector('.prompt-preview');
    if (promptPreview) {
      promptPreview.style.cursor = 'pointer';
      promptPreview.title = 'Click to copy prompt';
      promptPreview.addEventListener('click', () => {
        const promptText = getPromptText();
        if (promptText && promptText.trim() !== '') {
          navigator.clipboard.writeText(promptText)
            .then(() => {
              this.showCopyFeedback();
              this.showInfoNotification('Prompt copied to clipboard.');
            })
            .catch(err => {
              console.error('Could not copy text: ', err);
              this.showErrorNotification('Failed to copy to clipboard. Please try again or copy manually.');
            });
        }
      });
    }
  }

  initializeButtons() {
    // Initialize trash button
    const trashBtn = document.getElementById('clear-button');
    if (trashBtn) {
      let clickCount = 0;
      let clickTimer = null;
      
      trashBtn.addEventListener('click', () => {
        // Check if there are any selected images
        const selectedImages = document.querySelectorAll('.gallery-item.selected');
        const hasSelectedImages = selectedImages.length > 0;
        
        clickCount++;
        
        if (clickCount === 1) {
          // Only shake if there are selected images
          if (hasSelectedImages) {
            trashBtn.classList.add('shake');
          }
          
          clickTimer = setTimeout(() => {
            clickCount = 0;
            trashBtn.classList.remove('shake');
          }, 500);
        } else if (clickCount === 2) {
          clearTimeout(clickTimer);
          clickCount = 0;
          
          // Fill icon on second click (no shake animation)
          const icon = trashBtn.querySelector('i');
          if (icon) {
            icon.className = 'fas fa-trash-can';
          }
          trashBtn.classList.add('filled');
          
          setTimeout(() => {
            trashBtn.classList.remove('filled');
            if (icon) {
              icon.className = 'far fa-trash-can';
            }
          }, 2000);
        }
      });
    }

    // Initialize refresh button
    const refreshBtn = document.getElementById('refresh-button');
    const stickyRefreshBtn = document.getElementById('sticky-refresh-button');
    function spinBothRefreshButtons() {
      if (refreshBtn) refreshBtn.classList.add('spinning');
      if (stickyRefreshBtn) stickyRefreshBtn.classList.add('spinning');
      setTimeout(() => {
        if (refreshBtn) refreshBtn.classList.remove('spinning');
        if (stickyRefreshBtn) stickyRefreshBtn.classList.remove('spinning');
      }, 600);
    }
    if (refreshBtn) {
      refreshBtn.addEventListener('click', spinBothRefreshButtons);
    }
    if (stickyRefreshBtn) {
      stickyRefreshBtn.addEventListener('click', spinBothRefreshButtons);
    }

    // Handle the click event for the back-to-top button
    if (this.backToTopButton) {
      this.backToTopButton.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    }
  }

  syncStickyMenu() {
    const sticky = document.getElementById('sticky-action-bar');
    if (!sticky) return;
    
    console.log('Syncing sticky menu with main menu...');
    
    // Get all buttons from main menu
    const mainButtons = document.querySelector('.input-group').querySelectorAll('button');
    const stickyButtons = sticky.querySelectorAll('button');
    
    console.log('Main menu buttons:', Array.from(mainButtons).map(btn => btn.id));
    console.log('Sticky menu buttons:', Array.from(stickyButtons).map(btn => btn.id));
    
    // Ensure all main menu buttons have corresponding sticky buttons
    mainButtons.forEach(mainBtn => {
      const mainId = mainBtn.id;
      const stickyId = `sticky-${mainId}`;
      const stickyBtn = sticky.querySelector(`#${stickyId}`);
      
      if (stickyBtn) {
        console.log(`Found sticky button for ${mainId}: ${stickyId}`);
        // Ensure the sticky button has the same classes as the main button
        stickyBtn.className = mainBtn.className;
      } else {
        console.log(`Missing sticky button for ${mainId}`);
        // Try to add the missing button
        this.addMissingStickyButton(mainBtn, sticky);
      }
    });
  }

  addMissingStickyButton(mainBtn, sticky) {
    const mainId = mainBtn.id;
    const stickyId = `sticky-${mainId}`;
    
    console.log(`Adding missing sticky button: ${stickyId}`);
    
    // Create the sticky button
    const stickyBtn = mainBtn.cloneNode(true);
    stickyBtn.id = stickyId;
    stickyBtn.className = mainBtn.className;
    
    // Don't add event listeners for these buttons - they'll be handled by their bind methods
    if (mainId === 'favorites-toggle' || mainId === 'show-selected-btn' || mainId === 'copy-button') {
      console.log(`Skipping event listener for ${mainId} - will be handled by bind method`);
    } else {
      // Add event delegation for other buttons
      stickyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const originalButton = document.getElementById(mainId);
        if (originalButton) {
          originalButton.click();
        }
      });
    }
    
    // Insert in the same position as in main menu
    const stickyInputGroup = sticky.querySelector('.input-group');
    if (stickyInputGroup) {
      // Try to find the right position by looking at the main button's position
      const mainParent = mainBtn.parentNode;
      const mainButtons = Array.from(mainParent.children);
      const mainIndex = mainButtons.indexOf(mainBtn);
      
      // Insert at the same index in sticky menu
      if (mainIndex >= 0 && mainIndex < stickyInputGroup.children.length) {
        stickyInputGroup.insertBefore(stickyBtn, stickyInputGroup.children[mainIndex]);
      } else {
        stickyInputGroup.appendChild(stickyBtn);
      }
    }
  }

  /**
   * Creates and configures the sticky action bar for responsive navigation
   * 
   * This method implements a dual navigation system that provides consistent
   * access to all controls when the user scrolls away from the main menu.
   * The sticky bar is a clone of the main menu with modified IDs and event
   * delegation to maintain state consistency.
   * 
   * Implementation Details:
   * - Clones the main input group to ensure visual consistency
   * - Maps button IDs with 'sticky-' prefix for unique identification
   * - Implements event delegation for most buttons to maintain single source of truth
   * - Provides direct event handling for preview toggle (independent functionality)
   * - Excludes certain buttons from delegation to prevent conflicts with bind methods
   * - Ensures the show-selected button exists in both menus
   * - Synchronizes prompt input between main and sticky menus
   * 
   * Event Delegation Strategy:
   * - Most buttons delegate clicks to their main menu counterparts
   * - Preview toggle has independent functionality for responsive behavior
   * - Favorites, show-selected, and copy buttons are handled by their respective bind methods
   * - This prevents duplicate event listeners and maintains state consistency
   */
  addStickyActionBar() {
    if (document.getElementById('sticky-action-bar')) return;
    const origInputGroup = document.querySelector('.input-group');
    if (!origInputGroup) return;
    
    // Create sticky wrapper with proper styling
    const stickyWrapper = document.createElement('div');
    stickyWrapper.id = 'sticky-action-bar';
    stickyWrapper.className = 'sticky-action-bar';
    
    // Create outer container for all sticky menu content
    const stickyOuterContainer = document.createElement('div');
    stickyOuterContainer.className = 'sticky-prompt-container-outer';
    
    // Clone the input group and its buttons
    const stickyInputGroup = origInputGroup.cloneNode(true);

    // Button ID mapping for consistent targeting
    const buttonMap = {
      'clear-button': 'sticky-clear-button',
      'refresh-button': 'sticky-refresh-button',
      'favorites-toggle': 'sticky-favorites-toggle',
      'show-selected-btn': 'sticky-show-selected-btn',
      'search-button': 'sticky-search-button',
      'randomize-button': 'sticky-randomize-button',
      'copy-button': 'sticky-copy-button',
      'toggle-preview-button': 'sticky-toggle-preview-button',
      'mode-toggle': 'sticky-mode-toggle',
      'theme-toggle': 'sticky-theme-toggle'
    };
    
    // Update button IDs and maintain event delegation
    Array.from(stickyInputGroup.querySelectorAll('button')).forEach(button => {
      const originalId = button.id;
      console.log('Processing sticky button with original ID:', originalId);
      if (buttonMap[originalId]) {
        button.id = buttonMap[originalId];
        console.log('Mapped button ID from', originalId, 'to', buttonMap[originalId]);
        // Preserve styling classes
        const originalButton = origInputGroup.querySelector(`#${originalId}`);
        if (originalButton) {
          button.className = originalButton.className;
        }
        
        // Special handling for toggle preview button
        if (originalId === 'toggle-preview-button') {
          button.addEventListener('click', (e) => {
            e.preventDefault();
            this.togglePreview();
          });
        } else if (originalId === 'favorites-toggle' || originalId === 'show-selected-btn' || originalId === 'copy-button') {
          // Don't add event listeners for these buttons here - they'll be handled by their bind methods
          console.log(`Skipping event listener for ${originalId} - will be handled by bind method`);
        } else if (originalId === 'generate-prompt-btn' || originalId === 'prompt-settings-btn') {
          // Delegate prompt injector button events to main menu
          button.addEventListener('click', (e) => {
            e.preventDefault();
            const originalButton = document.getElementById(originalId);
            if (originalButton) {
              originalButton.click();
            }
          });
        } else {
          // Delegate other button events to main menu
          button.addEventListener('click', (e) => {
            e.preventDefault();
            const originalButton = document.getElementById(originalId);
            if (originalButton) {
              originalButton.click();
            }
          });
        }
      }
    });
    
    // Ensure the show-selected button exists in sticky menu
    this.ensureStickyShowSelectedButton(stickyInputGroup);
    
    // Add input group to outer container
    stickyOuterContainer.appendChild(stickyInputGroup);
    
    // Create prompt preview for sticky header
    const stickyPreviewContainer = document.createElement('div');
    stickyPreviewContainer.className = 'sticky-prompt-container';
    
    // Create a row container that matches the main menu structure
    const stickyPreviewRow = document.createElement('div');
    stickyPreviewRow.className = 'prompt-preview-row sticky-prompt-preview-row hidden';
    
    // Create the preview and buttons container
    const stickyPreviewAndButtons = document.createElement('div');
    stickyPreviewAndButtons.className = 'preview-and-buttons';
    
    // Create the prompt preview section
    const stickyPreview = document.createElement('div');
    stickyPreview.className = 'prompt-preview';
    stickyPreview.style.cssText = 'flex: 1 1 auto; display: flex; align-items: center;';
    
    const stickyFinalPrompt = document.createElement('p');
    stickyFinalPrompt.id = 'sticky-final-prompt';
    stickyFinalPrompt.style.cssText = 'flex: 1 1 auto;';
    
    stickyPreview.appendChild(stickyFinalPrompt);
    stickyPreviewAndButtons.appendChild(stickyPreview);
    
    // Create the inline buttons container (matching main menu structure)
    const stickyInlineButtons = document.createElement('div');
    stickyInlineButtons.className = 'prompt-gen-inline-buttons';
    
    // Add prompt injector buttons inside the inline buttons container
    const mainGenerateBtn = document.getElementById('generate-prompt-btn');
    const mainSettingsBtn = document.getElementById('prompt-settings-btn');
    
    if (mainGenerateBtn) {
      const stickyGenerateBtn = mainGenerateBtn.cloneNode(true);
      stickyGenerateBtn.id = 'sticky-generate-prompt-btn';
      stickyGenerateBtn.className = 'action-button prompt-gen';
      
      // Add event listener to delegate to main button
      stickyGenerateBtn.addEventListener('click', (e) => {
        e.preventDefault();
        mainGenerateBtn.click();
      });
      
      stickyInlineButtons.appendChild(stickyGenerateBtn);
    }
    
    if (mainSettingsBtn) {
      const stickySettingsBtn = mainSettingsBtn.cloneNode(true);
      stickySettingsBtn.id = 'sticky-prompt-settings-btn';
      stickySettingsBtn.className = 'action-button prompt-settings';
      
      // Add event listener to delegate to main button
      stickySettingsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        mainSettingsBtn.click();
      });
      
      stickyInlineButtons.appendChild(stickySettingsBtn);
    }
    
    // Add the inline buttons to the preview and buttons container
    stickyPreviewAndButtons.appendChild(stickyInlineButtons);
    
    // Add the preview and buttons container to the row
    stickyPreviewRow.appendChild(stickyPreviewAndButtons);
    
    // Create prompt settings panel for sticky header (inside the preview row)
    const mainSettingsPanel = document.getElementById('prompt-settings-panel');
    if (mainSettingsPanel) {
      const stickySettingsPanel = mainSettingsPanel.cloneNode(true);
      stickySettingsPanel.id = 'sticky-prompt-settings-panel';
      stickySettingsPanel.className = 'prompt-settings-panel sticky-prompt-settings-panel hidden';
      
      // Update any IDs in the cloned panel to avoid conflicts
      const checkboxes = stickySettingsPanel.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach((checkbox, index) => {
        if (checkbox.id) {
          checkbox.id = `sticky-${checkbox.id}`;
        }
      });
      
      // Update the suffix input ID in the sticky panel
      const stickySuffixInput = stickySettingsPanel.querySelector('#prompt-suffix');
      if (stickySuffixInput) {
        stickySuffixInput.id = 'sticky-prompt-suffix';
        // Also update the label's for attribute
        const stickySuffixLabel = stickySettingsPanel.querySelector('label[for="prompt-suffix"]');
        if (stickySuffixLabel) {
          stickySuffixLabel.setAttribute('for', 'sticky-prompt-suffix');
        }
      }

      // Update the aspect ratio dropdown ID in the sticky panel
      const stickyAspectRatioSelect = stickySettingsPanel.querySelector('#aspect-ratio-select');
      if (stickyAspectRatioSelect) {
        stickyAspectRatioSelect.id = 'sticky-aspect-ratio-select';
        // Also update the label's for attribute
        const stickyAspectRatioLabel = stickySettingsPanel.querySelector('label[for="aspect-ratio-select"]');
        if (stickyAspectRatioLabel) {
          stickyAspectRatioLabel.setAttribute('for', 'sticky-aspect-ratio-select');
        }
      }

      // Update the custom aspect ratio input ID in the sticky panel
      const stickyCustomAspectRatioInput = stickySettingsPanel.querySelector('#custom-aspect-ratio-input');
      if (stickyCustomAspectRatioInput) {
        stickyCustomAspectRatioInput.id = 'sticky-custom-aspect-ratio-input';
      }
      
      // Add the settings panel to the preview row (not the outer container)
      stickyPreviewRow.appendChild(stickySettingsPanel);
      
      // Note: The sticky settings button event listener is handled by the delegation
      // in the button mapping section above, which calls the main button's click event.
      // The prompt-injector.js togglePanel() function handles syncing both panels.
    }
    
    // Add the row to the container
    stickyPreviewContainer.appendChild(stickyPreviewRow);
    stickyOuterContainer.appendChild(stickyPreviewContainer);
    
    // Add outer container to sticky wrapper
    stickyWrapper.appendChild(stickyOuterContainer);
    document.body.appendChild(stickyWrapper);

    // Initialize sticky toggle button state to match main button
    const stickyToggleBtn = stickyWrapper.querySelector('#sticky-toggle-preview-button');
    if (stickyToggleBtn) {
      const mainPreviewRow = document.querySelector('.prompt-preview-row');
      if (mainPreviewRow) {
        const isHidden = mainPreviewRow.classList.contains('hidden');
        console.log('Sticky toggle initialization:');
        console.log('- Main preview hidden:', isHidden);
        console.log('- Setting sticky toggle active to:', !isHidden);
        stickyToggleBtn.classList.toggle('active', !isHidden);
      }
    }

    // Initialize sticky settings button state to match main button
    const stickySettingsBtn = stickyWrapper.querySelector('#sticky-prompt-settings-btn');
    const mainSettingsBtnForInit = document.getElementById('prompt-settings-btn');
    if (stickySettingsBtn && mainSettingsBtnForInit) {
      const isActive = mainSettingsBtnForInit.classList.contains('active');
      console.log('Sticky settings button initialization:');
      console.log('- Main settings button active:', isActive);
      console.log('- Setting sticky settings button active to:', isActive);
      stickySettingsBtn.classList.toggle('active', isActive);
    }

    // Initialize sticky settings panel visibility to match main panel
    const stickySettingsPanel = stickyWrapper.querySelector('#sticky-prompt-settings-panel');
    const mainSettingsPanelForInit = document.getElementById('prompt-settings-panel');
    if (stickySettingsPanel && mainSettingsPanelForInit) {
      const isHidden = mainSettingsPanelForInit.classList.contains('hidden');
      console.log('Sticky settings panel initialization:');
      console.log('- Main settings panel hidden:', isHidden);
      console.log('- Setting sticky settings panel hidden to:', isHidden);
      stickySettingsPanel.classList.toggle('hidden', isHidden);
      
      // Also sync the sticky action bar settings-open class
      const stickyActionBar = document.getElementById('sticky-action-bar');
      if (stickyActionBar) {
        stickyActionBar.classList.toggle('settings-open', !isHidden);
      }
    }

    // Sync category checkboxes between main and sticky panels
    const categoryIds = ['cat-presentation', 'cat-subject', 'cat-appearance', 'cat-clothing', 'cat-pose', 'cat-emotion', 'cat-setting', 'cat-lighting', 'cat-style', 'cat-details'];
    categoryIds.forEach(categoryId => {
      const mainCheckbox = document.getElementById(categoryId);
      const stickyCheckbox = document.getElementById(`sticky-${categoryId}`);
      
      if (mainCheckbox && stickyCheckbox) {
        // Sync initial state
        stickyCheckbox.checked = mainCheckbox.checked;
        
        // Sync main checkbox changes to sticky
        mainCheckbox.addEventListener('change', () => {
          stickyCheckbox.checked = mainCheckbox.checked;
          // Show info notification if Subject is unchecked
          if (categoryId === 'cat-subject' && !mainCheckbox.checked) {
            this.showInfoNotification('It is recommended to keep the Subject category enabled for best results.');
          }
        });
        
        // Sync sticky checkbox changes to main
        stickyCheckbox.addEventListener('change', () => {
          mainCheckbox.checked = stickyCheckbox.checked;
          // Show info notification if Subject is unchecked
          if (categoryId === 'cat-subject' && !stickyCheckbox.checked) {
            this.showInfoNotification('It is recommended to keep the Subject category enabled for best results.');
          }
        });
      }
    });

    // Sync suffix input between main and sticky panels
    // Note: This is now handled by bindSuffixInput method in the controller

    // Sync aspect ratio dropdown between main and sticky panels
    // Note: This is now handled by bindAspectRatioDropdown method in the controller

    // Sync prompt input value
    const mainInput = document.getElementById('prompt-input');
    const stickyInput = stickyInputGroup.querySelector('#prompt-input');
    if (stickyInput) {
      stickyInput.id = 'sticky-prompt-input';
      
      mainInput.addEventListener('input', () => {
        stickyInput.value = mainInput.value;
      });
      
      stickyInput.addEventListener('input', () => {
        mainInput.value = stickyInput.value;
        // Trigger input event on main input to update preview
        const event = new Event('input', { bubbles: true });
        mainInput.dispatchEvent(event);
      });
      
      // Add Enter key handler to the sticky prompt input
      stickyInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault(); // Prevent default form submission behavior
          // Blur (deselect) the input field
          stickyInput.blur();
          // Also focus on document body to ensure no element has focus
          document.body.focus();
        }
      });
    }
    
    // Handle scroll events for sticky header visibility
    window.addEventListener('scroll', () => this.handleStickyBarVisibility());
    
    // Initial position check
    this.handleStickyBarVisibility();
  }

  ensureStickyShowSelectedButton(stickyInputGroup) {
    // Check if the show-selected button exists in main menu but not in sticky
    const mainShowSelectedBtn = document.getElementById('show-selected-btn');
    const stickyShowSelectedBtn = stickyInputGroup.querySelector('#sticky-show-selected-btn');
    
    if (mainShowSelectedBtn && !stickyShowSelectedBtn) {
      console.log('Adding missing show-selected button to sticky menu');
      
      // Create the sticky show-selected button
      const stickyEyeBtn = mainShowSelectedBtn.cloneNode(true);
      stickyEyeBtn.id = 'sticky-show-selected-btn';
      stickyEyeBtn.className = mainShowSelectedBtn.className;
      
      // Don't add event listener here - it will be handled by bindShowSelectedToggle
      console.log('Created sticky show-selected button - event listener will be added by bind method');
      
      // Insert in the same position as in main menu
      const starBtn = stickyInputGroup.querySelector('#sticky-favorites-toggle');
      if (starBtn && starBtn.parentNode) {
        starBtn.parentNode.insertBefore(stickyEyeBtn, starBtn.nextSibling);
      } else {
        stickyInputGroup.appendChild(stickyEyeBtn);
      }
    }
    
    // Check if the search button exists in main menu but not in sticky
    const mainSearchBtn = document.getElementById('search-button');
    const stickySearchBtn = stickyInputGroup.querySelector('#sticky-search-button');
    
    if (mainSearchBtn && !stickySearchBtn) {
      console.log('Adding missing search button to sticky menu');
      
      // Create the sticky search button
      const stickySearchBtn = mainSearchBtn.cloneNode(true);
      stickySearchBtn.id = 'sticky-search-button';
      stickySearchBtn.className = mainSearchBtn.className;
      
      // Don't add event listener here - it will be handled by bindSearchButton
      console.log('Created sticky search button - event listener will be added by bind method');
      
      // Insert in the same position as in main menu (between eye and lightbulb)
      const eyeBtn = stickyInputGroup.querySelector('#sticky-show-selected-btn');
      const lightbulbBtn = stickyInputGroup.querySelector('#sticky-randomize-button');
      if (eyeBtn && eyeBtn.parentNode) {
        eyeBtn.parentNode.insertBefore(stickySearchBtn, eyeBtn.nextSibling);
      } else if (lightbulbBtn && lightbulbBtn.parentNode) {
        lightbulbBtn.parentNode.insertBefore(stickySearchBtn, lightbulbBtn);
      } else {
        stickyInputGroup.appendChild(stickySearchBtn);
      }
    }
  }

  togglePreview() {
    const mainPreviewRow = document.querySelector('.prompt-preview-row');
    const stickyPreviewRow = document.querySelector('.sticky-prompt-preview-row');
    const mainToggle = document.getElementById('toggle-preview-button');
    const stickyToggle = document.getElementById('sticky-toggle-preview-button');
    
    if (!mainPreviewRow || !stickyPreviewRow || !mainToggle || !stickyToggle) return;
    
    const isHidden = mainPreviewRow.classList.contains('hidden');
    
    console.log('togglePreview called:');
    console.log('- Preview isHidden:', isHidden);
    console.log('- Main toggle active before:', mainToggle.classList.contains('active'));
    console.log('- Sticky toggle active before:', stickyToggle.classList.contains('active'));
        
    // Toggle both previews
    mainPreviewRow.classList.toggle('hidden', !isHidden);
    stickyPreviewRow.classList.toggle('hidden', !isHidden);
        
    // Update both toggle buttons - when preview is visible, button should be active
    const previewIsVisible = !mainPreviewRow.classList.contains('hidden');
    mainToggle.classList.toggle('active', previewIsVisible);
    stickyToggle.classList.toggle('active', previewIsVisible);
    
    console.log('- Preview isVisible:', previewIsVisible);
    console.log('- Main toggle active after:', mainToggle.classList.contains('active'));
    console.log('- Sticky toggle active after:', stickyToggle.classList.contains('active'));
    
    // Let CSS handle the icon rotation based on .active class
    // No need to manually set icon classes
  }

  /*
   * Scroll Handler
   * - Shows/hides sticky header based on scroll position and direction
   * - Uses CSS classes for smooth transitions
   * - Maintains scroll position state
   * - On mobile: hides on scroll down, shows on scroll up
   * - Only shows when main menu is out of view
   * - Prevents hiding when user is interacting with sticky menu
   */
  handleStickyBarVisibility() {
    const stickyBar = document.getElementById('sticky-action-bar');
    if (!stickyBar) return;
    
    const scrollY = window.scrollY;
    // Get the main menu element to calculate when it's out of view
    const mainMenu = document.querySelector('.prompt-container');
    if (!mainMenu) return;
    const mainMenuRect = mainMenu.getBoundingClientRect();
    const mainMenuBottom = mainMenuRect.bottom;
    const isMainMenuVisible = mainMenuBottom > 0;
    // Don't hide if user is currently interacting with sticky menu
    if (this.isInteractingWithSticky) {
      if (!isMainMenuVisible) {
      stickyBar.classList.add('visible');
      }
      return;
    }
    // Unified behavior: hide on scroll down, show on scroll up, but only when main menu is out of view
    if (!isMainMenuVisible) {
      if (this.isScrollingUp) {
        stickyBar.classList.add('visible');
      } else if (this.isScrollingDown) {
        stickyBar.classList.remove('visible');
      }
    } else {
      // Hide when main menu is visible
      stickyBar.classList.remove('visible');
    }
  }

  handleBackToTopVisibility() {
    if (!this.backToTopButton) return;
    if (window.scrollY > 200) {
      this.backToTopButton.classList.add('visible');
    } else {
      this.backToTopButton.classList.remove('visible');
    }
  }

  renderGallery(images, selectedImages, favoriteImages, currentModel) {
    this.gallery.innerHTML = '';
    
    if (images.length === 0) {
      if (this.showOnlyFavorites) {
        this.showFullWidthNoFavoritesWarning();
      }
      return;
    }
    
    images.forEach(image => {
      const isSelected = selectedImages.has(image.id);
      const isFavorite = favoriteImages.has(image.id);
      const colorIndex = isSelected ? selectedImages.get(image.id) : -1;
      const item = this.createGalleryItem(image, isSelected, isFavorite, colorIndex, currentModel);
      this.gallery.appendChild(item);
    });

    this.hideFullWidthNoFavoritesWarning();
    this.hideFullWidthNoSelectedWarning();
  }

  createGalleryItem(image, isSelected, isFavorite, colorIndex, currentModel) {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.tabIndex = 0; // Make gallery items focusable
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', `Style reference ${image.sref} - ${isSelected ? 'Selected' : 'Not selected'}`);
    item.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    
    // Add hover color class based on the image's position in the gallery
    // This ensures hover colors match the selection color logic
    const hoverColorIndex = this.getHoverColorIndex(image.id);
    item.classList.add(`hover-color-${hoverColorIndex}`);
    
    if (isSelected) {
      item.classList.add('selected', `selected-color-${colorIndex}`);
    }
    item.dataset.id = image.id;
    item.dataset.sref = image.sref;
    item.dataset.sref = image.sref;

    let quadrant;
    if (!this.imageQuadrants.has(image.id)) {
      quadrant = this.getRandomQuadrant();
      this.imageQuadrants.set(image.id, quadrant);
    } else {
      quadrant = this.imageQuadrants.get(image.id);
    }
    
    const img = document.createElement('img');
    img.src = image.path;
    img.alt = `Style reference ${image.sref} - Mermaid-themed example showing visual style characteristics`;
    img.className = `quadrant quadrant-${quadrant}`;
    img.loading = 'lazy'; // Enable lazy loading
    item.appendChild(img);

    // 1. Copy link button (top)
    const linkButton = document.createElement('button');
    linkButton.className = 'link-button copy-link-button';
    linkButton.innerHTML = '<i class="fas fa-link"></i>';
    linkButton.dataset.id = image.id;
    linkButton.dataset.sref = image.sref;
    linkButton.title = `Copy link to style ${image.sref}`;
    linkButton.setAttribute('aria-label', `Copy direct link to style reference ${image.sref}`);
    linkButton.tabIndex = isSelected ? 0 : -1;
    
    linkButton.addEventListener('click', (e) => {
      e.stopPropagation();
      
      // Get the current quadrant for this image
      const currentQuadrant = this.imageQuadrants.get(image.id) ?? 0;
      
      // Create a shareable URL with the style reference and quadrant
      const url = new URL(window.location.href);
      // Use the correct style reference (sref) from the image object
      url.searchParams.set('sref', image.sref);
      url.searchParams.set('quadrant', currentQuadrant); // Using full parameter name for SEO
      if (currentModel) {
        url.searchParams.set('model', currentModel);
      }
      
      // Copy to clipboard
      navigator.clipboard.writeText(url.toString())
        .then(() => {
          // Show feedback animation
          const icon = linkButton.querySelector('i');
          icon.className = 'fas fa-check';
          linkButton.classList.add('copied');
          
          // Show notification
          this.showInfoNotification(`Link to style ${image.sref} copied to clipboard`);
          
          // Reset after animation
          setTimeout(() => {
            icon.className = 'fas fa-link';
            linkButton.classList.remove('copied');
          }, 2000);
        })
        .catch(err => {
          console.error('Could not copy URL: ', err);
          this.showErrorNotification('Failed to copy link. Please try again.');
        });
    });
    
    item.appendChild(linkButton);

    // 2. Flip quadrant button
    const flipButton = document.createElement('button');
    flipButton.className = 'link-button flip-quadrant-button';
    flipButton.innerHTML = '<i class="fa-solid fa-border-all"></i>';
    flipButton.title = 'Flip quadrant';
    flipButton.dataset.id = image.id;
    flipButton.tabIndex = isSelected ? 0 : -1;
    flipButton.addEventListener('click', (e) => {
      e.stopPropagation();
      // Animate like link-button: scale and color
      const icon = flipButton.querySelector('i');
      icon.className = 'fa-solid fa-border-none';
      icon.classList.add('flip-animate');
      setTimeout(() => {
        icon.classList.remove('flip-animate');
      }, 300);
      // Switch back to border-all after 0.3s (match link-button animation)
      setTimeout(() => {
        icon.className = 'fa-solid fa-border-all';
      }, 300);
      let current = this.imageQuadrants.get(image.id) ?? 0;
      let next = (current + 1) % 4;
      this.imageQuadrants.set(image.id, next);
      // Suppress animation
      img.classList.add('no-transition');
      img.className = `quadrant quadrant-${next} no-transition`;
      setTimeout(() => img.classList.remove('no-transition'), 50);
    });
    item.appendChild(flipButton);

    // 3. Add favorite button
    const favButton = document.createElement('button');
    favButton.className = 'link-button favorite-button';
    favButton.innerHTML = isFavorite 
      ? '<i class="fas fa-star"></i>' 
      : '<i class="far fa-star"></i>';
    favButton.dataset.id = image.id;
    favButton.title = isFavorite ? 'Remove from favorites' : 'Add to favorites';
    favButton.setAttribute('aria-label', isFavorite ? `Remove style reference ${image.sref} from favorites` : `Add style reference ${image.sref} to favorites`);
    favButton.setAttribute('aria-pressed', isFavorite ? 'true' : 'false');
    favButton.tabIndex = isSelected ? 0 : -1;
    
    // Use the same direct addEventListener approach as the quadrant flip button
    favButton.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log('Favorite button clicked for image:', image.id);
      
      // The actual toggling will be handled in the controller
      // We just need to ensure the event is properly triggered
      const id = favButton.dataset.id;
      
      // Find the handler function from bindFavoriteClick
      const favoriteHandlers = this._eventHandlers && this._eventHandlers.favoriteClick;
      if (favoriteHandlers && favoriteHandlers.length > 0) {
        // Call the handler and get the new favorite state
        const newIsFavorite = favoriteHandlers[0](id);
        
        // Update the button appearance immediately
        favButton.innerHTML = newIsFavorite 
          ? '<i class="fas fa-star"></i>' 
          : '<i class="far fa-star"></i>';
        favButton.title = newIsFavorite ? 'Remove from favorites' : 'Add to favorites';
      }
    });
    
    item.appendChild(favButton);

    // 4. Copy prompt code button (bottom)
    const copyPromptButton = document.createElement('button');
    copyPromptButton.className = 'link-button copy-prompt-button';
    copyPromptButton.innerHTML = '<i class="fas fa-copy"></i>';
    copyPromptButton.dataset.id = image.id;
    copyPromptButton.dataset.sref = image.sref;
    copyPromptButton.title = `Copy prompt code for style ${image.sref}`;
    copyPromptButton.setAttribute('aria-label', `Copy prompt code for style reference ${image.sref}`);
    copyPromptButton.tabIndex = isSelected ? 0 : -1;
    
    copyPromptButton.addEventListener('click', (e) => {
      e.stopPropagation();
      
      // Copy just the style reference number
      const styleRef = image.sref;
      
      if (!styleRef) {
        this.showErrorNotification('No style reference available to copy.');
        return;
      }
      
      // Copy to clipboard
      navigator.clipboard.writeText(styleRef)
        .then(() => {
          // Show feedback animation
          const icon = copyPromptButton.querySelector('i');
          icon.className = 'fas fa-check';
          copyPromptButton.classList.add('copied');
          
          // Show notification
          this.showInfoNotification(`Style reference ${styleRef} copied to clipboard`);
          
          // Reset after animation
      setTimeout(() => {
            icon.className = 'fas fa-copy';
            copyPromptButton.classList.remove('copied');
          }, 2000);
        })
        .catch(err => {
          console.error('Could not copy style reference: ', err);
          this.showErrorNotification('Failed to copy style reference. Please try again.');
        });
    });
    
    item.appendChild(copyPromptButton);

    // Add weight controls for selected images (disabled for Midjourney 7)
    if (isSelected && currentModel !== 'midjourney-7') {
      const weightControls = document.createElement('div');
      weightControls.className = 'weight-controls';
      weightControls.dataset.id = image.id;
      weightControls.style.opacity = '1';
      weightControls.style.visibility = 'visible';
      weightControls.style.display = 'flex';
      
      // Plus button (positive - top side)
      const plusButton = document.createElement('button');
      plusButton.className = 'weight-control-button weight-plus';
      plusButton.innerHTML = '+';
      plusButton.title = 'Increase weight';
      plusButton.dataset.id = image.id;
      plusButton.dataset.action = 'increase';
      plusButton.setAttribute('aria-label', `Increase weight for style reference ${image.sref}`);
      plusButton.tabIndex = 0;
      weightControls.appendChild(plusButton);
      
      // Weight display
      const weightDisplay = document.createElement('div');
      weightDisplay.className = 'weight-display';
      weightDisplay.setAttribute('role', 'status');
      weightDisplay.setAttribute('aria-label', `Current weight for style reference ${image.sref}`);
      // We'll add the color class in updateAllWeightDisplays
      weightDisplay.dataset.id = image.id;
      // We'll set the actual weight value in updateAllWeightDisplays
      weightDisplay.textContent = '1'; // Placeholder value
      weightDisplay.style.opacity = '1';
      weightDisplay.style.visibility = 'visible';
      weightDisplay.style.display = 'flex';
      weightControls.appendChild(weightDisplay);
      
      // Minus button (negative - bottom side)
      const minusButton = document.createElement('button');
      minusButton.className = 'weight-control-button weight-minus';
      minusButton.innerHTML = '−'; // Using minus sign (not hyphen)
      minusButton.title = 'Decrease weight';
      minusButton.dataset.id = image.id;
      minusButton.dataset.action = 'decrease';
      minusButton.setAttribute('aria-label', `Decrease weight for style reference ${image.sref}`);
      weightControls.appendChild(minusButton);
      
      item.appendChild(weightControls);
    }

    return item;
  }

  getRandomQuadrant() {
    // Return a random number between 0 and 3 (inclusive)
    // 0: top-left, 1: top-right, 2: bottom-left, 3: bottom-right
    return Math.floor(Math.random() * 4);
  }

  getHoverColorIndex(imageId) {
    // Generate a consistent color index for each image ID
    // This ensures the hover color matches what the selection color would be
    let hash = 0;
    for (let i = 0; i < imageId.length; i++) {
      const char = imageId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 5; // 5 colors in the palette
  }

  getClipPathForQuadrant(quadrant) {
    // Create a clip path for the specified quadrant
    switch(quadrant) {
      case 0: // top-left
        return 'inset(0% 50% 50% 0%)';
      case 1: // top-right
        return 'inset(0% 0% 50% 50%)';
      case 2: // bottom-left
        return 'inset(50% 50% 0% 0%)';
      case 3: // bottom-right
        return 'inset(50% 0% 0% 50%)';
      default:
        return 'none';
    }
  }

  refreshImageQuadrants() {
    // Clear stored quadrants to force new random selections
    this.imageQuadrants.clear();
    
    // Add spinning animation to the refresh button
    this.refreshButton.querySelector('i').classList.add('spinning');
    
    // Remove the animation class after it completes
    setTimeout(() => {
      this.refreshButton.querySelector('i').classList.remove('spinning');
    }, 800);
  }

  updateFinalPrompt(promptText) {
    this.finalPrompt.textContent = promptText;
    
    // Also update the sticky preview if it exists
    const stickyFinalPrompt = document.getElementById('sticky-final-prompt');
    if (stickyFinalPrompt) {
      stickyFinalPrompt.textContent = promptText;
    }
  }

  updateFavoritesToggle(showOnlyFavorites) {
    // Update main favorites button
    if (this.favoritesToggle) {
      if (showOnlyFavorites) {
        this.favoritesToggle.classList.add('active');
        this.favoritesToggle.querySelector('i').className = 'fas fa-star';
        this.favoritesToggle.setAttribute('title', 'Show all images');
      } else {
        this.favoritesToggle.classList.remove('active');
        this.favoritesToggle.querySelector('i').className = 'far fa-star';
        this.favoritesToggle.setAttribute('title', 'Show only favorites');
      }
    }
    
    // Update sticky favorites button if it exists
    const stickyFavoritesToggle = document.getElementById('sticky-favorites-toggle');
    if (stickyFavoritesToggle) {
      if (showOnlyFavorites) {
        stickyFavoritesToggle.classList.add('active');
        stickyFavoritesToggle.querySelector('i').className = 'fas fa-star';
        stickyFavoritesToggle.setAttribute('title', 'Show all images');
      } else {
        stickyFavoritesToggle.classList.remove('active');
        stickyFavoritesToggle.querySelector('i').className = 'far fa-star';
        stickyFavoritesToggle.setAttribute('title', 'Show only favorites');
      }
    }
    
    // Update favorites tools bar visibility
    this.updateFavoritesToolsVisibility(showOnlyFavorites);
    
    // Show or hide the "no favorites" message
    if (this.noFavoritesMessage) {
      // We'll handle the visibility in the renderGallery method
      // based on whether there are any favorites to show
    }
  }

  /**
   * Updates the favorites tools bar visibility based on favorites view state
   * @param {boolean} showOnlyFavorites - Whether the favorites view is active
   */
  updateFavoritesToolsVisibility(showOnlyFavorites) {
    if (this.favoritesTools) {
      if (showOnlyFavorites) {
        this.favoritesTools.classList.remove('hidden');
      } else {
        this.favoritesTools.classList.add('hidden');
      }
    }
  }

  /**
   * Bind event handlers for export favorites button
   * @param {Function} handler - Function to call when export button is clicked
   */
  bindExportFavoritesButton(handler) {
    if (this.exportFavoritesButton) {
      this.exportFavoritesButton.addEventListener('click', () => {
        handler();
      });
    }
  }

  /**
   * Bind event handlers for import favorites button
   * @param {Function} handler - Function to call when a file is selected for import
   */
  bindImportFavoritesButton(handler) {
    if (this.importFavoritesButton && this.importFavoritesInput) {
      // When import button is clicked, trigger the hidden file input
      this.importFavoritesButton.addEventListener('click', () => {
        this.importFavoritesInput.click();
      });

      // When a file is selected, call the handler with the file
      this.importFavoritesInput.addEventListener('change', (event) => {
        if (event.target.files.length > 0) {
          const file = event.target.files[0];
          handler(file);
          // Reset the input so the same file can be selected again
          event.target.value = '';
        }
      });
    }
  }

  /**
   * Bind event handlers for clear favorites button
   * @param {Function} handler - Function to call when clear button is clicked
   */
  bindClearFavoritesButton(handler) {
    if (this.clearFavoritesButton) {
      this.clearFavoritesButton.addEventListener('click', () => {
        handler();
      });
    }
  }

  bindImageClick(handler) {
    this.gallery.addEventListener('click', event => {
      const galleryItem = event.target.closest('.gallery-item');
      // Don't trigger selection if clicking on a button or weight controls
      if (galleryItem && 
          !event.target.closest('.favorite-button') && 
          !event.target.closest('.quadrant-flip-button') &&
          !event.target.closest('.weight-controls') &&
          !event.target.closest('.weight-control-button') &&
          !event.target.closest('.weight-display')) {
        const id = galleryItem.dataset.id;
        handler(id);
      }
    });
    
    // Add keyboard navigation support
    this.gallery.addEventListener('keydown', event => {
      const galleryItem = event.target.closest('.gallery-item');
      if (galleryItem && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        const id = galleryItem.dataset.id;
        handler(id);
      }
    });
  }

  bindFavoriteClick(handler) {
    // Store the handler for direct access from buttons
    this._eventHandlers.favoriteClick = [handler];
    
    // Listen for regular click events (delegation approach)
    this.gallery.addEventListener('click', event => {
      const favoriteButton = event.target.closest('.favorite-button');
      if (favoriteButton) {
        console.log('Favorite button clicked via delegation:', favoriteButton);
        event.stopPropagation();
        const id = favoriteButton.dataset.id;
        handler(id);
      }
    });
  }

  bindPromptInput(handler) {
    // Bind the main prompt input
    this.promptInput.addEventListener('input', () => {
      handler(this.promptInput.value);
    });
    
    // Add Enter key handler to blur the input field
    this.promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault(); // Prevent default form submission behavior
        // Blur (deselect) the input field
        this.promptInput.blur();
        // Also focus on document body to ensure no element has focus
        document.body.focus();
      }
    });
    
    // Also bind any sticky prompt input that might exist
    const stickyBar = document.getElementById('sticky-action-bar');
    if (stickyBar) {
      const stickyPromptInput = stickyBar.querySelector('#prompt-input');
      if (stickyPromptInput) {
        stickyPromptInput.addEventListener('input', () => {
          handler(stickyPromptInput.value);
        });
        
        // Add Enter key handler to the sticky prompt input as well
        stickyPromptInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault(); // Prevent default form submission behavior
            // Blur (deselect) the input field
            stickyPromptInput.blur();
            // Also focus on document body to ensure no element has focus
            document.body.focus();
          }
        });
      }
    }
  }

  bindSuffixInput(handler) {
    // Bind both suffix inputs to update the prompt when either changes
    const mainSuffixInput = document.getElementById('prompt-suffix');
    const stickySuffixInput = document.getElementById('sticky-prompt-suffix');
    
    // Sync initial values
    if (mainSuffixInput && stickySuffixInput) {
      stickySuffixInput.value = mainSuffixInput.value;
    }
    
    // Create a unified handler that syncs both inputs and calls the provided handler
    const unifiedHandler = (e) => {
      const newValue = e.target.value;
      
      // Sync both inputs
      if (mainSuffixInput && stickySuffixInput) {
        mainSuffixInput.value = stickySuffixInput.value = newValue;
      }
      
      // Call the provided handler with the new value
      handler(newValue);
    };
    
    // Bind to both inputs
    [mainSuffixInput, stickySuffixInput].forEach(input => {
      if (input) {
        input.addEventListener('input', unifiedHandler);
        input.addEventListener('blur', unifiedHandler);
      }
      });
  }

  bindAspectRatioDropdown(handler) {
    const mainAspectRatioSelect = document.getElementById('aspect-ratio-select');
    const stickyAspectRatioSelect = document.getElementById('sticky-aspect-ratio-select');
    const mainCustomRow = document.querySelector('.custom-aspect-ratio-row');
    const stickyCustomRow = document.querySelector('.sticky-prompt-settings-panel .custom-aspect-ratio-row');
    const mainCustomInput = document.getElementById('custom-aspect-ratio-input');
    const stickyCustomInput = document.getElementById('sticky-custom-aspect-ratio-input');
    
    // Sync initial values
    if (mainAspectRatioSelect && stickyAspectRatioSelect) {
      stickyAspectRatioSelect.value = mainAspectRatioSelect.value;
    }
    
    // Function to handle custom aspect ratio visibility
    const handleCustomVisibility = (select, customRow, customInput) => {
      if (select && customRow && customInput) {
        if (select.value === 'custom') {
          customRow.classList.remove('hidden');
          customInput.focus();
        } else {
          customRow.classList.add('hidden');
        }
      }
    };
    
    // Create a unified handler that syncs both dropdowns and calls the provided handler
    const unifiedHandler = (e) => {
      const newValue = e.target.value;
      
      // Sync both dropdowns
      if (mainAspectRatioSelect && stickyAspectRatioSelect) {
        mainAspectRatioSelect.value = stickyAspectRatioSelect.value = newValue;
      }
      
      // Handle custom input visibility
      handleCustomVisibility(mainAspectRatioSelect, mainCustomRow, mainCustomInput);
      handleCustomVisibility(stickyAspectRatioSelect, stickyCustomRow, stickyCustomInput);
      
      // Call the provided handler with the new value
      handler(newValue);
    };
    
    // Create a unified handler for custom input changes
    const customInputHandler = (e) => {
      const customValue = e.target.value.trim();
      if (customValue && /^[0-9]+(\.[0-9]+)?:[0-9]+(\.[0-9]+)?$/.test(customValue)) {
        handler(customValue);
      }
    };
    
    // Bind to both dropdowns
    [mainAspectRatioSelect, stickyAspectRatioSelect].forEach(select => {
      if (select) {
        select.addEventListener('change', unifiedHandler);
      }
    });
    
    // Bind to both custom inputs
    [mainCustomInput, stickyCustomInput].forEach(input => {
      if (input) {
        input.addEventListener('input', customInputHandler);
        input.addEventListener('blur', customInputHandler);
      }
    });
    
    // Initialize custom input visibility
    handleCustomVisibility(mainAspectRatioSelect, mainCustomRow, mainCustomInput);
    handleCustomVisibility(stickyAspectRatioSelect, stickyCustomRow, stickyCustomInput);
  }

  bindCopyButton(handler) {
    const copyBtn = document.getElementById('copy-button');
    const stickyCopyBtn = document.getElementById('sticky-copy-button');
    
    console.log('bindCopyButton called');
    console.log('Main copy button found:', copyBtn);
    console.log('Sticky copy button found:', stickyCopyBtn);
    
    function animateBothCopyButtons() {
      console.log('animateBothCopyButtons called');
      
      // Animate main button
      if (copyBtn) {
        copyBtn.classList.add('active');
        const icon = copyBtn.querySelector('i');
        if (icon) {
          icon.className = 'fas fa-clipboard';
          console.log('Main button animated to filled');
        }
      }
      
      // Animate sticky button
      if (stickyCopyBtn) {
        stickyCopyBtn.classList.add('active');
        const stickyIcon = stickyCopyBtn.querySelector('i');
        if (stickyIcon) {
          stickyIcon.className = 'fas fa-clipboard';
          console.log('Sticky button animated to filled');
        }
      }
      
      // Call the handler
      console.log('Calling copy handler');
      handler();
      
      // Remove active class and change back to outline icon after animation
      setTimeout(() => {
        if (copyBtn) {
          copyBtn.classList.remove('active');
          const icon = copyBtn.querySelector('i');
          if (icon) {
            icon.className = 'far fa-clipboard';
            console.log('Main button reset to outline');
          }
        }
        if (stickyCopyBtn) {
          stickyCopyBtn.classList.remove('active');
          const stickyIcon = stickyCopyBtn.querySelector('i');
          if (stickyIcon) {
            stickyIcon.className = 'far fa-clipboard';
            console.log('Sticky button reset to outline');
          }
        }
      }, 300);
    }
    
    if (copyBtn) {
      copyBtn.addEventListener('click', animateBothCopyButtons);
      console.log('Added click listener to main copy button');
    }
    
    if (stickyCopyBtn) {
      stickyCopyBtn.addEventListener('click', animateBothCopyButtons);
      console.log('Added click listener to sticky copy button');
    }
  }

  bindRandomizeButton(handler) {
    const randomizeBtn = document.getElementById('randomize-button');
    const stickyRandomizeBtn = document.getElementById('sticky-randomize-button');
    
    function animateBothRandomizeButtons() {
      // Animate main button
      if (randomizeBtn) {
        randomizeBtn.classList.add('active');
        const icon = randomizeBtn.querySelector('i');
        if (icon) {
          icon.className = 'fas fa-lightbulb';
        }
      }
      
      // Animate sticky button
      if (stickyRandomizeBtn) {
        stickyRandomizeBtn.classList.add('active');
        const stickyIcon = stickyRandomizeBtn.querySelector('i');
        if (stickyIcon) {
          stickyIcon.className = 'fas fa-lightbulb';
        }
      }
      
      // Call the handler
      handler();
      
      // Remove active class and change back to outline icon after animation
      setTimeout(() => {
        if (randomizeBtn) {
          randomizeBtn.classList.remove('active');
          const icon = randomizeBtn.querySelector('i');
          if (icon) {
            icon.className = 'far fa-lightbulb';
          }
        }
        if (stickyRandomizeBtn) {
          stickyRandomizeBtn.classList.remove('active');
          const stickyIcon = stickyRandomizeBtn.querySelector('i');
          if (stickyIcon) {
            stickyIcon.className = 'far fa-lightbulb';
          }
        }
      }, 300);
    }
    
    if (randomizeBtn) {
      randomizeBtn.addEventListener('click', animateBothRandomizeButtons);
    }
    
    if (stickyRandomizeBtn) {
      stickyRandomizeBtn.addEventListener('click', animateBothRandomizeButtons);
    }
  }

  showCopyFeedback() {
    // Show visual feedback for keyboard copy shortcut
    document.querySelectorAll('#copy-button').forEach(btn => {
      const originalHTML = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-clipboard"></i>'; // Solid icon
      
      // Reset after delay
      setTimeout(() => {
        btn.innerHTML = '<i class="far fa-clipboard"></i>'; // Back to outlined
      }, 1200);
    });
  }

  bindFavoritesToggle(handler) {
    const favoritesBtn = document.getElementById('favorites-toggle');
    const stickyFavoritesBtn = document.getElementById('sticky-favorites-toggle');
    
    function handleFavoritesButtonClick() {
      // Call the handler first to check if warning should be shown
      const shouldProceed = handler();
      
      // Only add animation if the handler didn't show a warning
      if (shouldProceed !== false) {
        // Add brief animation class for visual feedback
        if (favoritesBtn) {
          favoritesBtn.classList.add('active');
        }
        if (stickyFavoritesBtn) {
          stickyFavoritesBtn.classList.add('active');
        }
        
        // Remove animation class after brief delay
        setTimeout(() => {
          if (favoritesBtn) {
            favoritesBtn.classList.remove('active');
          }
          if (stickyFavoritesBtn) {
            stickyFavoritesBtn.classList.remove('active');
          }
        }, 150);
      }
    }
    
    if (favoritesBtn) {
      favoritesBtn.addEventListener('click', handleFavoritesButtonClick);
    }
    
    if (stickyFavoritesBtn) {
      stickyFavoritesBtn.addEventListener('click', handleFavoritesButtonClick);
    }
  }

  bindRefreshButton(handler) {
    this.refreshButton.addEventListener('click', () => {
      this.refreshImageQuadrants();
      handler();
    });
  }

  addShowSelectedButton() {
    if (document.getElementById('show-selected-btn')) return;
    const eyeBtn = document.createElement('button');
    eyeBtn.id = 'show-selected-btn';
    eyeBtn.className = 'action-button';
    eyeBtn.title = 'Show only selected images';
    eyeBtn.innerHTML = '<i class="far fa-eye"></i>'; // Outline eye
    // Insert after refresh and star buttons
    const refreshBtn = document.getElementById('refresh-button');
    const starBtn = document.getElementById('favorites-toggle');
    if (starBtn && starBtn.parentNode) {
      starBtn.parentNode.insertBefore(eyeBtn, starBtn.nextSibling);
    } else if (refreshBtn && refreshBtn.parentNode) {
      refreshBtn.parentNode.appendChild(eyeBtn);
    }
  }

  updateShowSelectedToggle(isActive) {
    console.log('updateShowSelectedToggle called with:', isActive);
    
    const eyeBtn = document.getElementById('show-selected-btn');
    console.log('Main eye button found:', eyeBtn);
    if (eyeBtn) {
      const icon = eyeBtn.querySelector('i');
      if (isActive) {
        eyeBtn.classList.add('active');
        if (icon) {
          icon.className = 'fas fa-eye';
          console.log('Main button set to filled eye');
        }
      } else {
        eyeBtn.classList.remove('active');
        if (icon) {
          icon.className = 'far fa-eye';
          console.log('Main button set to outlined eye');
        }
      }
    }
    // Also update in sticky bar if present
    const sticky = document.getElementById('sticky-action-bar');
    console.log('Sticky action bar found for eye button:', sticky);
    if (sticky) {
      const stickyEyeBtn = sticky.querySelector('#sticky-show-selected-btn');
      console.log('Sticky eye button found:', stickyEyeBtn);
      if (stickyEyeBtn) {
        const stickyIcon = stickyEyeBtn.querySelector('i');
        console.log('Sticky eye icon found:', stickyIcon);
        if (isActive) {
          stickyEyeBtn.classList.add('active');
          if (stickyIcon) {
            stickyIcon.className = 'fas fa-eye';
            console.log('Sticky button set to filled eye');
          }
        } else {
          stickyEyeBtn.classList.remove('active');
          if (stickyIcon) {
            stickyIcon.className = 'far fa-eye';
            console.log('Sticky button set to outlined eye');
          }
        }
      } else {
        console.log('Sticky eye button NOT found!');
        // Let's see what buttons are actually in the sticky bar
        const allStickyButtons = sticky.querySelectorAll('button');
        console.log('All sticky buttons for eye:', Array.from(allStickyButtons).map(btn => btn.id));
      }
    }
    
    // Update selection tools visibility
    this.updateSelectionToolsVisibility(isActive);
  }

  /**
   * Updates the selection tools bar visibility based on selected view state
   * @param {boolean} showOnlySelected - Whether the selected view is active
   */
  updateSelectionToolsVisibility(showOnlySelected) {
    const selectionTools = document.getElementById('selection-tools');
    if (selectionTools) {
      if (showOnlySelected) {
        selectionTools.classList.remove('hidden');
      } else {
        selectionTools.classList.add('hidden');
      }
    }
  }

  bindShowSelectedToggle(handler) {
    const eyeBtn = document.getElementById('show-selected-btn');
    const stickyEyeBtn = document.getElementById('sticky-show-selected-btn');
    
    function handleEyeButtonClick() {
      // Call the handler first to check if warning should be shown
      const shouldProceed = handler();
      
      // Only add animation if the handler didn't show a warning
      if (shouldProceed !== false) {
        // Add brief animation class for visual feedback
        if (eyeBtn) {
          eyeBtn.classList.add('active');
        }
        if (stickyEyeBtn) {
          stickyEyeBtn.classList.add('active');
        }
        
        // Remove animation class after brief delay
        setTimeout(() => {
          if (eyeBtn) {
            eyeBtn.classList.remove('active');
          }
          if (stickyEyeBtn) {
            stickyEyeBtn.classList.remove('active');
          }
        }, 150);
      }
    }
    
    if (eyeBtn) {
      eyeBtn.addEventListener('click', handleEyeButtonClick);
    }
    
    if (stickyEyeBtn) {
      stickyEyeBtn.addEventListener('click', handleEyeButtonClick);
    }
  }

  showNoSelectedWarning() {
    this.showWarningNotification('No images are selected.');
  }

  showNoFavoritesWarning() {
    // Create or show a warning message at the top of the gallery
    let warning = document.getElementById('no-favorites-warning');
    if (!warning) {
      warning = document.createElement('div');
      warning.id = 'no-favorites-warning';
      warning.className = 'warning-message';
      warning.textContent = 'No images are favorited. Please star at least one image.';
      warning.style.position = 'fixed';
      warning.style.top = '24px';
      warning.style.left = '50%';
      warning.style.transform = 'translateX(-50%)';
      warning.style.background = '#fffbe6';
      warning.style.color = '#b26a00';
      warning.style.padding = '12px 24px';
      warning.style.border = '1px solid #ffe58f';
      warning.style.borderRadius = '8px';
      warning.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
      warning.style.zIndex = '2000';
      document.body.appendChild(warning);
    }
    warning.style.display = 'block';
    setTimeout(() => {
      warning.style.display = 'none';
    }, 2000);
  }

  /**
   * Announce status changes to screen readers
   * @param {string} message - The message to announce
   * @param {string} region - The live region to use ('status', 'search', or 'prompt')
   */
  announceToScreenReader(message, region = 'status') {
    const regionId = `${region}-announcements`;
    const liveRegion = document.getElementById(regionId);
    
    if (liveRegion) {
      // Clear the region first
      liveRegion.textContent = '';
      
      // Add the new message after a brief delay to ensure it's announced
      setTimeout(() => {
        liveRegion.textContent = message;
      }, 100);
    }
  }

  /**
   * Show info notification with screen reader announcement
   * @param {string} message - The notification message
   */
  showInfoNotification(message) {
    // Existing notification logic
    if (this.notificationContainer) {
      this.notificationContainer.textContent = message;
      this.notificationContainer.className = 'notification info-notification';
      this.notificationContainer.style.display = 'block';
      
      // Announce to screen reader
      this.announceToScreenReader(message, 'status');
      
    setTimeout(() => {
        this.notificationContainer.style.display = 'none';
      }, 3000);
    }
  }

  /**
   * Show error notification with screen reader announcement
   * @param {string} message - The error message
   */
  showErrorNotification(message) {
    if (this.notificationContainer) {
      this.notificationContainer.textContent = message;
      this.notificationContainer.className = 'notification error-notification';
      this.notificationContainer.style.display = 'block';
      
      // Announce to screen reader
      this.announceToScreenReader(message, 'status');
      
    setTimeout(() => {
        this.notificationContainer.style.display = 'none';
      }, 5000);
    }
  }

  /**
   * Show warning notification with screen reader announcement
   * @param {string} message - The warning message
   */
  showWarningNotification(message) {
    if (this.notificationContainer) {
      this.notificationContainer.textContent = message;
      this.notificationContainer.className = 'notification warning-notification';
      this.notificationContainer.style.display = 'block';
      // Announce to screen reader
      this.announceToScreenReader(message, 'status');
      setTimeout(() => {
        this.notificationContainer.style.display = 'none';
      }, 4000);
    }
  }

  updateImageCountSubheader(totalCount, selectedCount, currentModel) {
    if (!this.imageCountSubheader) return;

    // Add icons for models
    const modelIcons = {
      'niji-6': '<i class="fa-solid fa-rainbow" style="color: #00e5ff; margin-right: 0.3em;"></i>',
      'midjourney-7': '<i class="fa-solid fa-sailboat" style="color: #00e5ff; margin-right: 0.3em;"></i>'
    };
    const modelDisplayName = currentModel === 'niji-6' ? `${modelIcons['niji-6']}<span>Niji&nbsp;6</span>` : `${modelIcons['midjourney-7']}<span>Midjourney&nbsp;v7</span>`;

    // Define all available models
    const allModels = [
      { id: 'niji-6', name: 'Niji&nbsp;6', icon: modelIcons['niji-6'] },
      { id: 'midjourney-7', name: 'Midjourney&nbsp;v7', icon: modelIcons['midjourney-7'] }
    ];

    // Filter out the current model to only show the other option(s)
    const otherModels = allModels.filter(model => model.id !== currentModel);
    
    // Combine the text and model selector into a single span for no-break
    const innerHTML = `
      <span class=\"image-count-number\">${totalCount}</span>
      <span class=\"subheader-inline\">pregenerated style references for
        <span class=\"model-selector-inline model-selector\">
          <span class=\"current-model\" tabindex=\"0\" role=\"button\">${modelDisplayName}</span>
          <span class=\"model-dropdown\" role=\"listbox\">
            ${otherModels.map(model => `<span class=\"model-option\" data-model=\"${model.id}\" tabindex=\"0\" role=\"option\">${model.icon}<span>${model.name}</span></span>`).join('')}
          </span>
        </span>
      </span>
    `;
    
    this.imageCountSubheader.innerHTML = innerHTML;
    
    // Always set up events after re-rendering the HTML
    this.setupModelSelectorEvents();

    // Reposition mode/theme toggles and prompt generator/options buttons
    this.repositionHeaderControls();
  }

  // New method: move mode/theme toggles to subheader and swap generator/settings buttons
  repositionHeaderControls() {
    try {
      const subheader = this.imageCountSubheader;
      if (!subheader) return;

      // Ensure a container exists for the controls
      let controlsContainer = subheader.querySelector('.header-controls');
      if (!controlsContainer) {
        controlsContainer = document.createElement('span');
        controlsContainer.className = 'header-controls';
        controlsContainer.style.display = 'inline-flex';
        controlsContainer.style.alignItems = 'center';
        controlsContainer.style.gap = '0.5rem';
        subheader.appendChild(controlsContainer);
      }

      // Move mode and theme toggle buttons into the subheader
      const modeBtn = document.getElementById('mode-toggle');
      const themeBtn = document.getElementById('theme-toggle');
      if (modeBtn && !controlsContainer.contains(modeBtn)) {
        controlsContainer.appendChild(modeBtn);
      }
      if (themeBtn && !controlsContainer.contains(themeBtn)) {
        controlsContainer.appendChild(themeBtn);
      }

      // Swap prompt generator & options buttons into former toggle containers
      const themeContainer = document.querySelector('.theme-toggle-container');
      const modeContainer = document.querySelector('.mode-toggle-container');
      const genBtn = document.getElementById('generate-prompt-btn');
      const settingsBtn = document.getElementById('prompt-settings-btn');

      if (themeContainer && genBtn && !themeContainer.contains(genBtn)) {
        themeContainer.innerHTML = '';
        themeContainer.appendChild(genBtn);
      }
      if (modeContainer && settingsBtn && !modeContainer.contains(settingsBtn)) {
        modeContainer.innerHTML = '';
        modeContainer.appendChild(settingsBtn);
      }
    } catch (err) {
      console.error('Error repositioning header controls:', err);
    }
  }

  setupModelSelectorEvents() {
    const modelSelector = this.imageCountSubheader.querySelector('.model-selector');
    if (modelSelector) {
      const currentModel = modelSelector.querySelector('.current-model');
      const modelDropdown = modelSelector.querySelector('.model-dropdown');
      const modelOptions = modelSelector.querySelectorAll('.model-option');
      
      // Handle current model button
      if (currentModel) {
        currentModel.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleModelDropdown(currentModel, modelDropdown);
        });
        
        currentModel.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.toggleModelDropdown(currentModel, modelDropdown);
          }
        });
        
        currentModel.addEventListener('focus', () => {
          currentModel.setAttribute('aria-expanded', 'false');
        });
      }
      
      // Handle model options
      modelOptions.forEach(option => {
        option.addEventListener('click', (e) => {
          e.stopPropagation();
          const selectedModel = option.dataset.model;
          this.handleModelSelection(selectedModel);
          this.closeModelDropdown(currentModel, modelDropdown);
        });
        
        option.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const selectedModel = option.dataset.model;
            this.handleModelSelection(selectedModel);
            this.closeModelDropdown(currentModel, modelDropdown);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            this.closeModelDropdown(currentModel, modelDropdown);
            currentModel?.focus();
          }
        });
      });
      
      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!modelSelector.contains(e.target)) {
          this.closeModelDropdown(currentModel, modelDropdown);
        }
      });
    }
  }

  toggleModelDropdown(currentModel, modelDropdown) {
    const isExpanded = currentModel.getAttribute('aria-expanded') === 'true';
    if (isExpanded) {
      this.closeModelDropdown(currentModel, modelDropdown);
    } else {
      this.openModelDropdown(currentModel, modelDropdown);
    }
  }

  openModelDropdown(currentModel, modelDropdown) {
    currentModel.setAttribute('aria-expanded', 'true');
    modelDropdown.style.opacity = '1';
    modelDropdown.style.visibility = 'visible';
    modelDropdown.style.pointerEvents = 'auto';
    modelDropdown.style.transform = 'translateY(0) translateX(-50%)';
    
    // Focus first option
    const firstOption = modelDropdown.querySelector('.model-option');
    if (firstOption) {
      firstOption.focus();
    }
  }

  closeModelDropdown(currentModel, modelDropdown) {
    currentModel.setAttribute('aria-expanded', 'false');
    modelDropdown.style.opacity = '0';
    modelDropdown.style.visibility = 'hidden';
    modelDropdown.style.pointerEvents = 'none';
    modelDropdown.style.transform = 'translateY(5px) translateX(-50%)';
  }

  handleModelSelection(selectedModel) {
    if (selectedModel !== this.currentModel) {
      // Save menu state to sessionStorage
      const promptInput = document.getElementById('prompt-input');
      const suffixInput = document.getElementById('prompt-suffix');
      const categoryIds = ['cat-presentation', 'cat-subject', 'cat-appearance', 'cat-clothing', 'cat-pose', 'cat-emotion', 'cat-setting', 'cat-lighting', 'cat-style', 'cat-details'];
      const checkboxes = {};
      categoryIds.forEach(id => {
        const cb = document.getElementById(id);
        if (cb) checkboxes[id] = cb.checked;
      });
      const aspectRatioSelect = document.getElementById('aspect-ratio-select');
      const customAspectRatioInput = document.getElementById('custom-aspect-ratio-input');
      
      // Get the actual aspect ratio value (custom input if custom is selected)
      let aspectRatioValue = '1:1';
      if (aspectRatioSelect) {
        if (aspectRatioSelect.value === 'custom' && customAspectRatioInput) {
          aspectRatioValue = customAspectRatioInput.value.trim() || '1:1';
        } else {
          aspectRatioValue = aspectRatioSelect.value;
        }
      }
      
      const state = {
        prompt: promptInput ? promptInput.value : '',
        suffix: suffixInput ? suffixInput.value : '',
        aspectRatio: aspectRatioValue,
        checkboxes
      };
      sessionStorage.setItem('prompteraid-menu-state', JSON.stringify(state));
      sessionStorage.setItem('prompteraid-model-switch', '1');

      this.currentModel = selectedModel;
      // Dispatch custom event for model change
      const event = new CustomEvent('modelChange', { 
        detail: { model: selectedModel } 
      });
      document.dispatchEvent(event);
    }
  }

  bindClearButton(handler) {
    if (!this.clearButton) return;
    
    const applyClearState = (button) => {
      // Add shake animation and change to filled icon
      button.classList.add('shake-animation');
      const icon = button.querySelector('i');
      if (icon) {
        icon.className = 'fas fa-trash-can';
      }
      button.classList.add('clear-button-active');
    };
    
    const resetButtonState = (button) => {
      // Remove shake animation and reset icon
      button.classList.remove('shake-animation');
      const icon = button.querySelector('i');
      if (icon) {
        icon.className = 'far fa-trash-can';
      }
      button.classList.remove('clear-button-active');
    };
    
    this.clearButton.addEventListener('click', () => {
      // Check if there are any selected images before proceeding
      const selectedImages = document.querySelectorAll('.gallery-item.selected');
      const hasSelectedImages = selectedImages.length > 0;
      
      // If no images are selected, show warning and don't proceed
      if (!hasSelectedImages) {
        this.showNoSelectedWarning();
        return; // Exit early, don't proceed with click behavior
      }
      
      // Apply visual feedback immediately
      applyClearState(this.clearButton);
        
        // Also update sticky bar button if present
        const sticky = document.getElementById('sticky-action-bar');
        if (sticky) {
          const stickyClearBtn = sticky.querySelector('#sticky-clear-button');
          if (stickyClearBtn) {
          applyClearState(stickyClearBtn);
          }
        }
        
      // Execute the clear action after a brief delay to show the visual feedback
        setTimeout(() => {
        handler(); // Execute handler immediately on first click
        
        // Reset button state after execution
          resetButtonState(this.clearButton);
          
          // Also reset sticky bar button
          if (sticky) {
            const stickyClearBtn = sticky.querySelector('#sticky-clear-button');
            if (stickyClearBtn) {
              resetButtonState(stickyClearBtn);
            }
          }
        }, 300);
    });
    
    // Also bind in sticky bar if present
    const sticky = document.getElementById('sticky-action-bar');
    if (sticky) {
      const stickyClearBtn = sticky.querySelector('#sticky-clear-button');
      if (stickyClearBtn) {
        stickyClearBtn.addEventListener('click', () => {
          this.clearButton.click();
        });
      }
    }
  }

  addTitleBubbleEffect() {
    const titleContainer = document.querySelector('.cute-title-container');
    if (!titleContainer) return;
    
    // Get the title text element for positioning bubbles only above it
    const titleText = titleContainer.querySelector('.cute-title');
    if (!titleText) return;
    
    // Performance guard: Disable bubble effects on low-end devices
    if (this.shouldDisableBubbleEffects()) {
      console.log('Bubble effects disabled for performance');
      return;
    }
    
    this.bubbleAnimationId = null;
    this.isBubbleAnimationActive = true;
    
    // Create bubbles on click (burst)
    titleContainer.addEventListener('click', (e) => {
      this.createBubbles(e, titleContainer, titleText, 10, 15);
    });
    
    // Throttled bubble animation (every 250ms)
    this.startBubbleAnimation(titleContainer, titleText);
  }

  startBubbleAnimation(container, titleText) {
    let lastBubbleTime = 0;
    const throttleMs = 250;
    const animate = (now) => {
      if (!this.isBubbleAnimationActive) return;
      if (!lastBubbleTime || now - lastBubbleTime >= throttleMs) {
        this.createBubbles(null, container, titleText, 1, 2);
        lastBubbleTime = now;
      }
      this.bubbleAnimationId = requestAnimationFrame(animate);
    };
    this.bubbleAnimationId = requestAnimationFrame(animate);
  }

  stopBubbleAnimation() {
    this.isBubbleAnimationActive = false;
    
    if (this.bubbleAnimationId) {
      cancelAnimationFrame(this.bubbleAnimationId);
      this.bubbleAnimationId = null;
    }
  }

  shouldDisableBubbleEffects() {
    // Check for low-end devices or performance issues
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isLowMemory = navigator.deviceMemory && navigator.deviceMemory < 4; // Less than 4GB
    const isSlowConnection = navigator.connection && navigator.connection.effectiveType === 'slow-2g';
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    // Disable if any performance concern is detected
    return isMobile || isLowMemory || isSlowConnection || prefersReducedMotion;
  }
  
  createBubbles(e, container, titleText, minBubbles, maxBubbles) {
    // Performance optimization: Batch DOM operations
    const bubbleCount = Math.floor(Math.random() * (maxBubbles - minBubbles + 1)) + minBubbles;
    
    // Get the neon colors from CSS variables (cache this)
    if (!this.neonColors) {
      this.neonColors = [
        getComputedStyle(document.documentElement).getPropertyValue('--neon-pink').trim(),
        getComputedStyle(document.documentElement).getPropertyValue('--neon-purple').trim(),
        getComputedStyle(document.documentElement).getPropertyValue('--neon-yellow').trim(),
        getComputedStyle(document.documentElement).getPropertyValue('--neon-orange').trim(),
        getComputedStyle(document.documentElement).getPropertyValue('--neon-teal').trim(),
        getComputedStyle(document.documentElement).getPropertyValue('--neon-blue').trim()
      ];
    }
    
    const containerRect = container.getBoundingClientRect();
    const titleRect = titleText.getBoundingClientRect();
    
    // Create document fragment for batching
    const fragment = document.createDocumentFragment();
    const bubbles = [];
    
    for (let i = 0; i < bubbleCount; i++) {
      // Create a bubble
      const bubble = document.createElement('div');
      bubble.classList.add('bubble');
      
      // Position bubbles only above the title text
      let x, y;
      
      if (e && e.clientX) {
        // Use horizontal position near cursor but constrained to title text width
        const cursorRelativeX = e.clientX - containerRect.left;
        
        // Only create bubble if cursor is over the title text
        if (cursorRelativeX >= titleRect.left - containerRect.left && 
            cursorRelativeX <= titleRect.right - containerRect.left) {
          x = cursorRelativeX + (Math.random() * 10 - 5); // Small random offset
        } else {
          // If cursor is outside title text, position randomly within title text
          x = (titleRect.left - containerRect.left) + Math.random() * titleRect.width;
        }
      } else {
        // Random position across title text width only
        x = (titleRect.left - containerRect.left) + Math.random() * titleRect.width;
      }
      
      // Always position bubbles at or slightly above the top of the title text
      y = (titleRect.top - containerRect.top) - 5 - (Math.random() * 10); // Negative values place bubbles above
      
      // Random size - slightly smaller for more delicate effect
      const size = Math.floor(Math.random() * 25) + 6; // 6-30px
      
      // Random color from neon palette
      const color = this.neonColors[Math.floor(Math.random() * this.neonColors.length)];
      
      // Random animation duration - faster now
      const duration = Math.random() * 2 + 1; // 1-3s instead of 2-5s
      
      // Set bubble styles
      bubble.style.width = `${size}px`;
      bubble.style.height = `${size}px`;
      bubble.style.left = `${x}px`;
      bubble.style.top = `${y}px`;
      bubble.style.background = `radial-gradient(circle at 30% 30%, ${color}80, ${color}20)`;
      bubble.style.animation = `float-up ${duration}s ease-in forwards`;
      
      // Add to fragment for batching
      fragment.appendChild(bubble);
      bubbles.push({ bubble, duration });
    }
    
    // Batch add all bubbles to DOM
    container.appendChild(fragment);
    
    // Batch remove bubbles after animation completes
    bubbles.forEach(({ bubble, duration }) => {
      setTimeout(() => {
        if (bubble.parentNode) {
          bubble.parentNode.removeChild(bubble);
        }
      }, duration * 1000);
    });
  }

  addTogglePreviewFunctionality() {
    const previewRow = document.querySelector('.prompt-preview-row');
    if (!this.togglePreviewButton || !previewRow) return;
    
    const isHidden = previewRow.classList.contains('hidden');
    console.log('addTogglePreviewFunctionality:');
    console.log('- Preview row hidden:', isHidden);
    console.log('- Setting main toggle active to:', !isHidden);
    
    this.togglePreviewButton.classList.toggle('active', !isHidden);
    
    this.togglePreviewButton.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log('Main toggle button clicked');
      this.togglePreview(); // Use the centralized togglePreview function
    });
  }

  // Bind mode toggle button
  bindModeToggle(handler) {
    if (this.modeToggle) {
      this.modeToggle.addEventListener('click', () => {
        handler();
      });
    }
    
    // Also bind in sticky bar if present
    const stickyModeToggle = document.getElementById('sticky-mode-toggle');
    if (stickyModeToggle) {
      stickyModeToggle.addEventListener('click', () => {
        handler();
      });
    }
  }
  
  // Update mode toggle button state
  updateModeToggle(isDiscordMode, showNotification = true) {
    const mainToggle = document.getElementById('mode-toggle');
    if (mainToggle) {
      if (isDiscordMode) {
        mainToggle.classList.remove('website-mode');
      } else {
        mainToggle.classList.add('website-mode');
      }
    }
    
    // Update sticky toggle if present
    const stickyToggle = document.getElementById('sticky-mode-toggle');
    if (stickyToggle) {
      if (isDiscordMode) {
        stickyToggle.classList.remove('website-mode');
      } else {
        stickyToggle.classList.add('website-mode');
      }
    }
    
    // Show notification about mode change only if requested
    if (showNotification) {
    const mode = isDiscordMode ? 'Discord' : 'Website';
    this.showInfoNotification(`Switched to ${mode} mode`);
    }
  }

  bindSearchButton(handler) {
    const searchButton = document.getElementById('search-button');
    if (searchButton) {
      searchButton.addEventListener('click', handler);
    }
  }

  /**
   * Updates the search button icons based on active state
   * @param {boolean} isActive - Whether the search is currently active
   */
  updateSearchButtonIcons(isActive) {
    const searchButton = document.getElementById('search-button');
    const stickySearchButton = document.getElementById('sticky-search-button');
    
    // Update main search button
    if (searchButton) {
      const icon = searchButton.querySelector('i');
      if (icon) {
        const newClass = isActive ? 'fa-solid fa-magnifying-glass-plus' : 'fa-solid fa-magnifying-glass';
        icon.className = newClass;
      }
      // Also update the button's active class
      if (isActive) {
        searchButton.classList.add('active');
      } else {
        searchButton.classList.remove('active');
      }
    }
    
    // Update sticky search button
    if (stickySearchButton) {
      const stickyIcon = stickySearchButton.querySelector('i');
      if (stickyIcon) {
        const newClass = isActive ? 'fa-solid fa-magnifying-glass-plus' : 'fa-solid fa-magnifying-glass';
        stickyIcon.className = newClass;
      }
      // Also update the button's active class
      if (isActive) {
        stickySearchButton.classList.add('active');
      } else {
        stickySearchButton.classList.remove('active');
      }
    }
  }
  
  bindSearchInput(handler) {
    const searchInput = document.getElementById('search-input');
    const searchContainer = document.querySelector('.search-container');
    
    if (searchInput) {
      // Handle input changes with a small delay to avoid excessive updates
      let debounceTimer;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const value = e.target.value.trim();
          handler(value === '' ? null : value);
        }, 300); // 300ms delay
      });
      
      // Handle Enter key for immediate search
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          clearTimeout(debounceTimer); // Clear any pending debounce
          const value = e.target.value.trim();
          handler(value === '' ? null : value);
        }
        
        // Handle Escape key to close search
        if (e.key === 'Escape' && !searchContainer.classList.contains('hidden')) {
          // Clear search and hide the search container
          if (window.galleryController && typeof window.galleryController.clearSearchState === 'function') {
            window.galleryController.clearSearchState();
          } else {
            searchInput.value = '';
            handler(null);
            searchContainer.classList.add('hidden');
            // Update button states
            const searchButton = document.getElementById('search-button');
            const stickySearchButton = document.getElementById('sticky-search-button');
            if (searchButton) searchButton.classList.remove('active');
            if (stickySearchButton) stickySearchButton.classList.remove('active');
          }
        }
      });
    }
  }

  bindWeightControls(increaseHandler, decreaseHandler, weightGetter, colorIndexGetter) {
    // Use event delegation on the gallery
    this.gallery.addEventListener('click', (e) => {
      // Check if we clicked directly on a weight button (not just in the container)
      if (e.target.classList.contains('weight-control-button') || 
          (e.target.parentElement && e.target.parentElement.classList.contains('weight-control-button'))) {
        e.preventDefault();
        e.stopPropagation();
        
        // Get the button element
        const weightButton = e.target.classList.contains('weight-control-button') ? 
                            e.target : e.target.parentElement;
        
        const imageId = weightButton.dataset.id;
        const action = weightButton.dataset.action;
        
        // Check if we're in Midjourney 7 mode - if so, ignore weight control clicks
        const currentModel = window.galleryController?.model?.currentModel || 'niji-6';
        if (currentModel === 'midjourney-7') {
          console.log(`Weight control clicked but disabled for Midjourney 7: ${action} for image ${imageId}`);
          return;
        }
        
        let newWeight;
        
        console.log(`Weight button clicked: ${action} for image ${imageId}`);
        
        if (action === 'increase') {
          newWeight = increaseHandler(imageId);
          console.log(`Increased weight to ${newWeight}`);
        } else if (action === 'decrease') {
          newWeight = decreaseHandler(imageId);
          console.log(`Decreased weight to ${newWeight}`);
        }
        
        // Find the gallery item that contains this button
        const galleryItem = weightButton.closest('.gallery-item');
        
        // Make sure the gallery item stays selected
        if (galleryItem && !galleryItem.classList.contains('selected')) {
          galleryItem.classList.add('selected');
        }
        
        // Update weight display - use the same parent container to find the display
        const container = weightButton.closest('.weight-controls');
        if (container) {
          // Make sure the container is visible
          container.style.opacity = '1';
          container.style.visibility = 'visible';
          container.style.display = 'flex';
          
          const weightDisplay = container.querySelector('.weight-display');
          if (weightDisplay) {
            console.log(`Updating weight display to ${newWeight}`);
            
            // Get the new color index
            const colorIndex = colorIndexGetter(imageId);
            
            // Update color class
            weightDisplay.className = 'weight-display';
            weightDisplay.classList.add(`weight-color-${colorIndex}`);
            
            // Make sure the weight display is visible
            weightDisplay.style.opacity = '1';
            weightDisplay.style.visibility = 'visible';
            weightDisplay.style.display = 'flex';
            
            // Add pop animation
            weightDisplay.classList.add('pop-animation');
            weightDisplay.textContent = newWeight;
            
            // Remove animation class after it completes
            setTimeout(() => {
              weightDisplay.classList.remove('pop-animation');
              
              // Keep the weight display visible after animation
              weightDisplay.style.opacity = '1';
              weightDisplay.style.visibility = 'visible';
              weightDisplay.style.display = 'flex';
              
              // Make sure the gallery item is still selected
              if (galleryItem && !galleryItem.classList.contains('selected')) {
                galleryItem.classList.add('selected');
              }
            }, 300);
          }
        }
      }
    });
  }
  
  updateAllWeightDisplays(weightGetter, colorIndexGetter) {
    if (!weightGetter) return;
    
    console.log('Updating all weight displays');
    const weightDisplays = document.querySelectorAll('.weight-display');
    console.log(`Found ${weightDisplays.length} weight displays to update`);
    
    weightDisplays.forEach(display => {
      const imageId = display.dataset.id;
      if (imageId) {
        const weight = weightGetter(imageId);
        console.log(`Updating weight display for image ${imageId} to ${weight}`);
        display.textContent = weight;
        
        // Make sure the display is visible
        display.style.opacity = '1';
        display.style.visibility = 'visible';
        display.style.display = 'flex';
        
        // Update color class if color index getter is available
        if (colorIndexGetter) {
          const colorIndex = colorIndexGetter(imageId);
          display.className = 'weight-display';
          display.classList.add(`weight-color-${colorIndex}`);
        }
        
        // Also make sure the parent container is visible
        const container = display.closest('.weight-controls');
        if (container) {
          container.style.opacity = '1';
          container.style.visibility = 'visible';
          container.style.display = 'flex';
        }
      }
    });
  }

  /**
   * Shows a full-width warning banner for no favorites
   * This is displayed within the favorites view when no favorites exist
   */
  showFullWidthNoFavoritesWarning() {
    // Check if the warning already exists
    let warningBanner = document.getElementById('no-favorites-banner');
    
    if (!warningBanner) {
      // Create the warning banner
      warningBanner = document.createElement('div');
      warningBanner.id = 'no-favorites-banner';
      warningBanner.className = 'no-favorites-banner';
      
      // Create the warning message
      const warningMessage = document.createElement('p');
      warningMessage.innerHTML = 'No favorites. Mark images to appear in this view.';
      warningBanner.appendChild(warningMessage);
      
      // Insert before the gallery (not inside it)
      const galleryContainer = document.querySelector('.gallery-container');
      const galleryElement = document.getElementById('image-gallery');
      galleryContainer.insertBefore(warningBanner, galleryElement);
    } else {
      // Show the existing warning
      warningBanner.classList.remove('hidden');
    }
  }

  /**
   * Hides the full-width no favorites warning banner
   */
  hideFullWidthNoFavoritesWarning() {
    const warningBanner = document.getElementById('no-favorites-banner');
    if (warningBanner) {
      warningBanner.classList.add('hidden');
    }
  }

  /**
   * Shows a full-width warning banner for no selected images
   * This is displayed within the selected view when no images are selected
   */
  showFullWidthNoSelectedWarning() {
    // Check if the warning already exists
    let warningBanner = document.getElementById('no-selected-banner');
    
    if (!warningBanner) {
      // Create the warning banner
      warningBanner = document.createElement('div');
      warningBanner.id = 'no-selected-banner';
      warningBanner.className = 'no-selected-banner';
      
      // Create the warning message
      const warningMessage = document.createElement('p');
      warningMessage.innerHTML = 'Click on any image to select it and add its style to your prompt.';
      warningBanner.appendChild(warningMessage);
      
      // Insert before the gallery (not inside it)
      const galleryContainer = document.querySelector('.gallery-container');
      const galleryElement = document.getElementById('image-gallery');
      galleryContainer.insertBefore(warningBanner, galleryElement);
    } else {
      // Show the existing warning
      warningBanner.classList.remove('hidden');
    }
  }
  
  /**
   * Hides the full-width no selected warning banner
   */
  hideFullWidthNoSelectedWarning() {
    const warningBanner = document.getElementById('no-selected-banner');
    if (warningBanner) {
      warningBanner.classList.add('hidden');
    }
  }

  /**
   * Creates a divider between filtered and unfiltered images
   * @param {string} type - The type of divider ('favorites', 'selected', 'linked', or 'search')
   * @param {number} count - The number of filtered images
   * @returns {HTMLElement} The created divider element
   */
  createFilterDivider(type, count) {
    // Remove existing divider if any
    const existingDivider = document.getElementById(`${type}-filter-divider`);
    if (existingDivider) {
      existingDivider.remove();
    }
    
    // Create new divider
    const divider = document.createElement('div');
    divider.id = `${type}-filter-divider`;
    divider.className = 'filter-divider';
    
    // Create divider label
    const label = document.createElement('span');
    label.className = 'filter-divider-label';
    
    // Set appropriate text based on type
    if (type === 'favorites') {
      label.innerHTML = `<i class=\"far fa-star\"></i> ${count} favorite${count !== 1 ? 's' : ''} above`;
      // Create the create link lozenge as a sibling
      const linkLozenge = document.createElement('span');
      linkLozenge.className = 'filter-divider-label filter-divider-link';
      linkLozenge.style.marginLeft = '1em';
      linkLozenge.style.cursor = 'pointer';
      linkLozenge.innerHTML = `<i class=\"fas fa-link\" style=\"color: var(--neon-pink);\"></i> Create a link`;
      linkLozenge.tabIndex = 0;
      linkLozenge.setAttribute('role', 'button');
      linkLozenge.setAttribute('aria-label', 'Create a shareable link for these favorite images');
      linkLozenge.addEventListener('click', () => {
        // Get current model and favorite images
        const model = window.galleryController?.model?.currentModel || 'niji-6';
        const favoriteImages = window.galleryController?.model?.favoriteImages || new Set();
        
        // Get the style references of favorite images
        let srefs = [];
        if (window.galleryController && favoriteImages.size > 0) {
          const allImages = window.galleryController.model.images;
          srefs = Array.from(favoriteImages).map(imageId => {
            const image = allImages.find(img => img.id === imageId);
            return image ? image.sref : null;
          }).filter(sref => sref !== null);
        }
        
        // Build the link - only include model and sref, no q parameter
        const params = new URLSearchParams();
        if (model) params.set('model', model);
        if (srefs.length > 0) params.set('sref', srefs.join(' '));
        const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
        
        // Copy to clipboard
        navigator.clipboard.writeText(url).then(() => {
          this.showCopyFeedback && this.showCopyFeedback();
          this.showInfoNotification && this.showInfoNotification('Shareable favorite images link copied!');
        }).catch(() => {
          this.showErrorNotification && this.showErrorNotification('Failed to copy link.');
        });
      });
      // Accessibility: trigger click on Enter or Space
      linkLozenge.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          linkLozenge.click();
        }
      });
      divider.appendChild(label);
      divider.appendChild(linkLozenge);
    } else if (type === 'selected') {
      label.innerHTML = `<i class=\"far fa-eye\"></i> ${count} selected image${count !== 1 ? 's' : ''} above`;
      // Create the create link lozenge as a sibling
      const linkLozenge = document.createElement('span');
      linkLozenge.className = 'filter-divider-label filter-divider-link';
      linkLozenge.style.marginLeft = '1em';
      linkLozenge.style.cursor = 'pointer';
      linkLozenge.innerHTML = `<i class=\"fas fa-link\" style=\"color: var(--neon-pink);\"></i> Create a link`;
      linkLozenge.tabIndex = 0;
      linkLozenge.setAttribute('role', 'button');
      linkLozenge.setAttribute('aria-label', 'Create a shareable link for these selected images');
      linkLozenge.addEventListener('click', () => {
        // Get current model and selected images
        const model = window.galleryController?.model?.currentModel || 'niji-6';
        const selectedImages = window.galleryController?.model?.selectedImages || new Map();
        
        // Get the style references of selected images
        let srefs = [];
        if (window.galleryController && selectedImages.size > 0) {
          const allImages = window.galleryController.model.images;
          srefs = Array.from(selectedImages.keys()).map(imageId => {
            const image = allImages.find(img => img.id === imageId);
            return image ? image.sref : null;
          }).filter(sref => sref !== null);
        }
        
        // Build the link - only include model and sref, no q parameter
        const params = new URLSearchParams();
        if (model) params.set('model', model);
        if (srefs.length > 0) params.set('sref', srefs.join(' '));
        const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
        
        // Copy to clipboard
        navigator.clipboard.writeText(url).then(() => {
          this.showCopyFeedback && this.showCopyFeedback();
          this.showInfoNotification && this.showInfoNotification('Shareable selected images link copied!');
        }).catch(() => {
          this.showErrorNotification && this.showErrorNotification('Failed to copy link.');
        });
      });
      // Accessibility: trigger click on Enter or Space
      linkLozenge.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          linkLozenge.click();
        }
      });
      divider.appendChild(label);
      divider.appendChild(linkLozenge);
    } else if (type === 'linked') {
      label.innerHTML = `<i class=\"fas fa-link\"></i> Linked style above`;
      divider.appendChild(label);
    } else if (type === 'search') {
      label.innerHTML = `<i class=\"fas fa-search\"></i> ${count} search result${count !== 1 ? 's' : ''} above`;
      // Create the create link lozenge as a sibling
      const linkLozenge = document.createElement('span');
      linkLozenge.className = 'filter-divider-label filter-divider-link';
      linkLozenge.style.marginLeft = '1em';
      linkLozenge.style.cursor = 'pointer';
      linkLozenge.innerHTML = `<i class=\"fas fa-link\" style=\"color: var(--neon-pink);\"></i> Create a link`;
      linkLozenge.tabIndex = 0;
      linkLozenge.setAttribute('role', 'button');
      linkLozenge.setAttribute('aria-label', 'Create a shareable link for this search');
      linkLozenge.addEventListener('click', () => {
        // Get current model and search query
        const model = window.galleryController?.model?.currentModel || 'niji-6';
        const search = window.galleryController?.searchNumber || '';
        // Get all visible images matching the search
        let srefs = [];
        if (window.galleryController && search) {
          const allImages = window.galleryController.model.images;
          const searchTerms = search.split(' ').map(term => term.trim()).filter(term => term.length > 0);
          const matchingImages = allImages.filter(img => searchTerms.some(term => img.sref.includes(term)));
          srefs = matchingImages.map(img => img.sref);
        }
        // Build the link
        const params = new URLSearchParams();
        params.set('model', model);
        if (srefs.length > 0) params.set('sref', srefs.join(' '));
        const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
        // Copy to clipboard
        navigator.clipboard.writeText(url).then(() => {
          this.showCopyFeedback && this.showCopyFeedback();
          this.showInfoNotification && this.showInfoNotification('Shareable search link copied!');
        }).catch(() => {
          this.showErrorNotification && this.showErrorNotification('Failed to copy link.');
        });
      });
      // Accessibility: trigger click on Enter or Space
      linkLozenge.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          linkLozenge.click();
        }
      });
      divider.appendChild(label);
      divider.appendChild(linkLozenge);
    }
    
    return divider;
  }
  
  /**
   * Shows a divider between filtered and unfiltered images
   * @param {string} type - The type of divider ('favorites' or 'selected')
   * @param {number} count - The number of filtered images
   */
  showFilterDivider(type, count) {
    const divider = this.createFilterDivider(type, count);
    this.gallery.appendChild(divider);
  }
  
  /**
   * Hides the filter divider
   * @param {string} type - The type of divider ('favorites' or 'selected')
   */
  hideFilterDivider(type) {
    const divider = document.getElementById(`${type}-filter-divider`);
    if (divider) {
      divider.remove();
    }
  }

  /**
   * Clears all content from the gallery
   */
  clearGallery() {
    while (this.gallery.firstChild) {
      this.gallery.removeChild(this.gallery.firstChild);
    }
  }

  // Initialize notification container
  initializeNotificationContainer() {
    this.notificationContainer = document.createElement('div');
    this.notificationContainer.id = 'notification-container';
    this.notificationContainer.className = 'notification-container';
    this.notificationContainer.style.position = 'fixed';
    this.notificationContainer.style.top = '24px';
    this.notificationContainer.style.left = '50%';
    this.notificationContainer.style.transform = 'translateX(-50%)';
    this.notificationContainer.style.zIndex = '2000';
    this.notificationContainer.style.display = 'none';
    // Removed inline background, color, border, borderRadius, boxShadow, and padding to allow CSS classes to style notifications
    document.body.appendChild(this.notificationContainer);
  }

  renderNewStylesSection(newImages, selectedImages, favoriteImages, currentModel) {
    const section = document.getElementById('new-styles-section');
    if (!section) return;

    if (!newImages || newImages.length === 0) {
      section.style.display = 'none';
      section.innerHTML = '';
      return;
    }

    // Collapsible state logic
    const storageKey = 'prompteraid_newStyles_expanded';
    let expanded = localStorage.getItem(storageKey);
    if (expanded === null) {
      expanded = 'true';
      localStorage.setItem(storageKey, 'true');
    }
    expanded = expanded === 'true';

    // Always show only 5 randomly selected images
    const maxToShow = 5;
    
    let imagesToShow;
    if (newImages.length <= maxToShow) {
      // If we have 5 or fewer new images, show all of them
      imagesToShow = newImages;
    } else {
      // Randomly select 5 images from all new images
      const shuffled = [...newImages].sort(() => Math.random() - 0.5);
      imagesToShow = shuffled.slice(0, maxToShow);
    }

    // Section header
    let html = `<div class="new-styles-container">
      <details${expanded ? ' open' : ''}>
        <summary>
          <span><i class=\"fa-solid fa-bolt\" style=\"color: var(--neon-pink); margin-right: 0.3em;\"></i>New Styles</span>
          <button id="minimize-new-styles" class="close-button" title="Minimize this section" aria-label="Minimize new styles section"><i class="fa-solid fa-up-right-and-down-left-from-center"></i></button>
        </summary>
        <div class="new-styles-content">`;
    html += '<div class="new-styles-gallery">';
    
    // Use createGalleryItem for each image to get full functionality
    imagesToShow.forEach(image => {
      const isSelected = selectedImages.has(image.id);
      const isFavorite = favoriteImages.has(image.id);
      const colorIndex = isSelected ? selectedImages.get(image.id) : -1;
      const galleryItem = this.createGalleryItem(image, isSelected, isFavorite, colorIndex, currentModel);
      
      // Add the new-styles-item class for reduced margins
      galleryItem.classList.add('new-styles-item');
      
      // Convert to HTML string for insertion
      const tempDiv = document.createElement('div');
      tempDiv.appendChild(galleryItem);
      html += tempDiv.innerHTML;
    });
    
    html += '</div>';
    
    // Replace MORE/LESS button with count display
    html += `<div class="new-styles-count" style="text-align: center; margin-top: 1rem; color: var(--text-secondary); font-size: 0.9rem;">
      <strong>${newImages.length}</strong> new style references recently added!
    </div>`;
    
    html += '</div></details></div>';
    section.innerHTML = html;
    section.style.display = '';

    // Add event delegation for image selection to the new styles gallery
    const newStylesGallery = section.querySelector('.new-styles-gallery');
    if (newStylesGallery) {
      // Remove any existing event listeners to avoid duplicates
      newStylesGallery.removeEventListener('click', this.handleNewStylesImageClick);
      newStylesGallery.removeEventListener('keydown', this.handleNewStylesImageKeydown);
      
      // Add click event listener for image selection
      newStylesGallery.addEventListener('click', this.handleNewStylesImageClick);
      
      // Add keyboard navigation support
      newStylesGallery.addEventListener('keydown', this.handleNewStylesImageKeydown);
      
      // Add weight control event delegation
      newStylesGallery.addEventListener('click', this.handleNewStylesWeightClick);
    }

    // Add click handler for the icon to minimize the section
    const summary = section.querySelector('summary');
    if (summary) {
      console.log('Found new styles summary, adding click handler');
      summary.addEventListener('click', (e) => {
        // Check if the click was on the icon or span
        const clickedElement = e.target;
        const isIconClick = clickedElement.tagName === 'I' || 
                           clickedElement.tagName === 'SPAN' ||
                           clickedElement.closest('span');
        
        if (isIconClick) {
          console.log('New styles icon/span clicked, target:', clickedElement);
          e.stopPropagation(); // Prevent the summary click from also firing
          const details = section.querySelector('details');
          if (details) {
            details.open = !details.open;
            localStorage.setItem(storageKey, details.open ? 'true' : 'false');
            this.updateSectionIcon(details, 'minimize-new-styles');
          }
        }
      });
    } else {
      console.log('New styles summary not found');
    }

    // Add toggle event to always track open/collapsed state
    const detailsElem = section.querySelector('details');
    if (detailsElem) {
      detailsElem.addEventListener('toggle', () => {
        localStorage.setItem(storageKey, detailsElem.open ? 'true' : 'false');
        this.updateSectionIcon(detailsElem, 'minimize-new-styles');
      });
      // Initialize the icon state
      this.updateSectionIcon(detailsElem, 'minimize-new-styles');
    }
  }

  // Event handler for New Styles image clicks
  handleNewStylesImageClick = (event) => {
    const galleryItem = event.target.closest('.gallery-item');
    // Don't trigger selection if clicking on a button or weight controls
    if (galleryItem && 
        !event.target.closest('.favorite-button') && 
        !event.target.closest('.quadrant-flip-button') &&
        !event.target.closest('.weight-controls') &&
        !event.target.closest('.weight-control-button') &&
        !event.target.closest('.weight-display')) {
      const id = galleryItem.dataset.id;
      
      // Dispatch a custom event that the controller can listen for
      const selectionEvent = new CustomEvent('imageSelection', { 
        detail: { imageId: id, source: 'new-styles' } 
      });
      document.dispatchEvent(selectionEvent);
    }
  }

  // Event handler for New Styles image keyboard navigation
  handleNewStylesImageKeydown = (event) => {
    const galleryItem = event.target.closest('.gallery-item');
    if (galleryItem && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      const id = galleryItem.dataset.id;
      
      // Dispatch a custom event that the controller can listen for
      const selectionEvent = new CustomEvent('imageSelection', { 
        detail: { imageId: id, source: 'new-styles' } 
      });
      document.dispatchEvent(selectionEvent);
    }
  }

  // Event handler for New Styles weight control clicks
  handleNewStylesWeightClick = (event) => {
    // Check if we clicked directly on a weight button (not just in the container)
    if (event.target.classList.contains('weight-control-button') || 
        (event.target.parentElement && event.target.parentElement.classList.contains('weight-control-button'))) {
      event.preventDefault();
      event.stopPropagation();
      
      // Get the button element
      const weightButton = event.target.classList.contains('weight-control-button') ? 
                          event.target : event.target.parentElement;
      
      const imageId = weightButton.dataset.id;
      const action = weightButton.dataset.action;
      
      // Check if we're in Midjourney 7 mode - if so, ignore weight control clicks
      const currentModel = window.galleryController?.model?.currentModel || 'niji-6';
      if (currentModel === 'midjourney-7') {
        console.log(`Weight control clicked but disabled for Midjourney 7: ${action} for image ${imageId}`);
        return;
      }
      
      console.log(`New Styles weight button clicked: ${action} for image ${imageId}`);
      
      // Dispatch a custom event that the controller can listen for
      const weightEvent = new CustomEvent('weightControl', { 
        detail: { imageId: imageId, action: action, source: 'new-styles' } 
      });
      document.dispatchEvent(weightEvent);
    }
  }

  /**
   * Renders the Styles of the Month section
   * @param {Array} stylesOfTheMonth - Array of {id, model, month}
   * @param {Object} imagesById - Map of id to image data (from images.json)
   * @param {Set} selectedImages
   * @param {Set} favoriteImages
   * @param {string} currentModel
   * @param {string} currentMonth - mm-yyyy string for current month
   */
  renderStylesOfTheMonthSection(stylesOfTheMonth, imagesById, selectedImages, favoriteImages, currentModel, currentMonth) {
    const section = document.getElementById('styles-of-the-month-section');
    if (!section) return;

    if (!stylesOfTheMonth || stylesOfTheMonth.length === 0) {
      section.style.display = 'none';
      section.innerHTML = '';
      return;
    }

    // Collapsible state logic
    const storageKey = 'prompteraid_stylesOfTheMonth_expanded';
    let expanded = localStorage.getItem(storageKey);
    if (expanded === null) expanded = 'true';
    expanded = expanded === 'true';

    // Sort by month descending (most recent left)
    const sorted = [...stylesOfTheMonth].sort((a, b) => {
      const [am, ay] = a.month.split('-').map(Number);
      const [bm, by] = b.month.split('-').map(Number);
      return by !== ay ? by - ay : bm - am;
    });

    // Section header
    let html = `<div class="new-styles-container">
      <details${expanded ? ' open' : ''}>
        <summary>
          <span><i class=\"fa-solid fa-crown\" style=\"color: var(--neon-orange); margin-right: 0.3em;\"></i>Styles of the Month</span>
          <button id="minimize-styles-of-the-month" class="close-button" title="Minimize this section" aria-label="Minimize styles of the month section"><i class="fa-solid fa-up-right-and-down-left-from-center"></i></button>
        </summary>
        <div class="new-styles-content">
          <div class="new-styles-gallery">`;

    sorted.forEach(entry => {
      const image = imagesById[entry.id];
      if (!image) return;
      const isSelected = selectedImages.has(entry.id);
      const isFavorite = favoriteImages.has(entry.id);
      const colorIndex = isSelected ? selectedImages.get(entry.id) : -1;
      const galleryItem = this.createGalleryItem(image, isSelected, isFavorite, colorIndex, currentModel);
      galleryItem.classList.add('new-styles-item');
      // Add yellow glow if current month
      if (entry.month === currentMonth) {
        galleryItem.style.boxShadow = '0 0 12px 2px var(--neon-yellow), 0 2px 8px rgba(0,0,0,0.12)';
      }
      // Add month label at the bottom
      const monthLabel = document.createElement('div');
      monthLabel.textContent = entry.month;
      monthLabel.className = entry.month === currentMonth ? 'month-label current' : 'month-label';
      galleryItem.appendChild(monthLabel);
      // Convert to HTML string
      const tempDiv = document.createElement('div');
      tempDiv.appendChild(galleryItem);
      html += tempDiv.innerHTML;
    });

    html += '</div></div></details></div>';
    section.innerHTML = html;
    section.style.display = '';

    // Collapse/expand logic
    const details = section.querySelector('details');
    const btn = section.querySelector('#minimize-styles-of-the-month');
    if (btn && details) {
      btn.onclick = (e) => {
        e.preventDefault();
        details.open = !details.open;
        localStorage.setItem(storageKey, details.open ? 'true' : 'false');
        this.updateSectionIcon(details, 'minimize-styles-of-the-month');
      };
    }

    // Add click handler for the icon to minimize the section
    const summary = section.querySelector('summary');
    if (summary) {
      console.log('Found styles of month summary, adding click handler');
      summary.addEventListener('click', (e) => {
        // Check if the click was on the icon or span
        const clickedElement = e.target;
        const isIconClick = clickedElement.tagName === 'I' || 
                           clickedElement.tagName === 'SPAN' ||
                           clickedElement.closest('span');
        
        if (isIconClick) {
          console.log('Styles of month icon/span clicked, target:', clickedElement);
          e.stopPropagation(); // Prevent the summary click from also firing
          if (details) {
            details.open = !details.open;
            localStorage.setItem(storageKey, details.open ? 'true' : 'false');
            this.updateSectionIcon(details, 'minimize-styles-of-the-month');
          }
        }
      });
    } else {
      console.log('Styles of month summary not found');
    }

    // Add toggle event to always track open/collapsed state
    const detailsElem = section.querySelector('details');
    if (detailsElem) {
      detailsElem.addEventListener('toggle', () => {
        localStorage.setItem(storageKey, detailsElem.open ? 'true' : 'false');
        this.updateSectionIcon(detailsElem, 'minimize-styles-of-the-month');
      });
      // Initialize the icon state
      this.updateSectionIcon(detailsElem, 'minimize-styles-of-the-month');
    }
  }

  // Add methods to close sections
  closeNewStylesSection() {
    const section = document.getElementById('new-styles-section');
    if (section) {
      const details = section.querySelector('details');
      if (details && details.open) {
        details.open = false;
        localStorage.setItem('prompteraid_newStyles_expanded', 'false');
      }
    }
  }

  closeTutorialSection() {
    // Find the tutorial section specifically by looking for the one with the graduation cap icon
    const allMoreInfoContainers = document.querySelectorAll('.more-info-container');
    let tutorialSection = null;
    
    for (const container of allMoreInfoContainers) {
      if (container.querySelector('.fa-graduation-cap')) {
        tutorialSection = container;
        break;
      }
    }
    
    if (tutorialSection) {
      const details = tutorialSection.querySelector('details');
      if (details && details.open) {
        details.open = false;
      }
    }
  }

  closeStylesOfTheMonthSection() {
    const section = document.getElementById('styles-of-the-month-section');
    if (section) {
      const details = section.querySelector('details');
      if (details && details.open) {
        details.open = false;
        localStorage.setItem('prompteraid_stylesOfTheMonth_expanded', 'false');
      }
    }
  }

  // Method to close all collapsible sections
  closeAllCollapsibleSections() {
    this.closeNewStylesSection();
    this.closeTutorialSection();
    this.closeStylesOfTheMonthSection();
  }

  /*
   * Scroll Direction Detection
   * - Tracks scroll direction for mobile sticky menu behavior
   * - Uses threshold to prevent jittery behavior
   */
  handleScrollDirection() {
    const currentScrollY = window.scrollY;
    const scrollDelta = Math.abs(currentScrollY - this.lastScrollY);
    
    // Only update direction if scroll distance exceeds threshold
    if (scrollDelta > this.scrollThreshold) {
      if (currentScrollY > this.lastScrollY) {
        this.isScrollingDown = true;
        this.isScrollingUp = false;
      } else if (currentScrollY < this.lastScrollY) {
        this.isScrollingUp = true;
        this.isScrollingDown = false;
      }
      this.lastScrollY = currentScrollY;
    }
  }

  /*
   * Sticky Menu Interaction Tracking
   * - Prevents sticky menu from hiding when user is interacting with it
   * - Tracks clicks, hovers, and focus events
   * - Uses timeout to reset interaction state
   */
  setupStickyMenuInteractionTracking() {
    const stickyBar = document.getElementById('sticky-action-bar');
    if (!stickyBar) return;

    const setInteractionActive = () => {
      this.isInteractingWithSticky = true;
      
      // Clear existing timeout
      if (this.interactionTimeout) {
        clearTimeout(this.interactionTimeout);
      }
      
      // Reset interaction state after 2 seconds of no interaction
      this.interactionTimeout = setTimeout(() => {
        this.isInteractingWithSticky = false;
      }, 2000);
    };

    // Track mouse interactions
    stickyBar.addEventListener('mouseenter', setInteractionActive);
    stickyBar.addEventListener('click', setInteractionActive);
    
    // Track focus events (for keyboard navigation)
    stickyBar.addEventListener('focusin', setInteractionActive);
    
    // Track when submenus are opened
    const stickySettingsPanel = stickyBar.querySelector('.sticky-prompt-settings-panel');
    if (stickySettingsPanel) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const isOpen = !stickySettingsPanel.classList.contains('hidden');
            if (isOpen) {
              setInteractionActive();
            }
          }
        });
      });
      
      observer.observe(stickySettingsPanel, {
        attributes: true,
        attributeFilter: ['class']
      });
    }
  }

  // Method to sync model with current DOM values (for external use)
  syncModelWithDOM(model) {
    const promptInput = document.getElementById('prompt-input');
    const suffixInput = document.getElementById('prompt-suffix');
    const aspectRatioSelect = document.getElementById('aspect-ratio-select');
    const customAspectRatioInput = document.getElementById('custom-aspect-ratio-input');
    
    if (promptInput && promptInput.value !== undefined) {
      model.setBasePrompt(promptInput.value);
    }
    
    if (suffixInput && suffixInput.value !== undefined) {
      model.setSuffix(suffixInput.value);
    }

    if (aspectRatioSelect && aspectRatioSelect.value !== undefined) {
      // Get the actual aspect ratio value (custom input if custom is selected)
      let aspectRatioValue = aspectRatioSelect.value;
      if (aspectRatioSelect.value === 'custom' && customAspectRatioInput) {
        aspectRatioValue = customAspectRatioInput.value.trim() || '1:1';
      }
      model.setAspectRatio(aspectRatioValue);
    }
  }

  // Method to initialize DOM with model values
  initDOMWithModel(model) {
    const promptInput = document.getElementById('prompt-input');
    const suffixInput = document.getElementById('prompt-suffix');
    const aspectRatioSelect = document.getElementById('aspect-ratio-select');
    const stickyAspectRatioSelect = document.getElementById('sticky-aspect-ratio-select');
    const mainCustomRow = document.querySelector('.custom-aspect-ratio-row');
    const stickyCustomRow = document.querySelector('.sticky-prompt-settings-panel .custom-aspect-ratio-row');
    const customAspectRatioInput = document.getElementById('custom-aspect-ratio-input');
    const stickyCustomAspectRatioInput = document.getElementById('sticky-custom-aspect-ratio-input');
    
    if (promptInput && model.basePrompt !== undefined) {
      promptInput.value = model.basePrompt;
    }
    
    if (suffixInput && model.suffix !== undefined) {
      suffixInput.value = model.suffix;
    }

    if (aspectRatioSelect && model.aspectRatio !== undefined) {
      // Check if the aspect ratio is a custom value (not in the predefined options)
      const predefinedOptions = ['1:1', '4:5', '2:3', '3:4', '3:2', '5:4', '4:3', '1.91:1', '2:1', '16:9', '9:16'];
      if (predefinedOptions.includes(model.aspectRatio)) {
        aspectRatioSelect.value = model.aspectRatio;
        if (mainCustomRow) mainCustomRow.classList.add('hidden');
      } else {
        aspectRatioSelect.value = 'custom';
        if (mainCustomRow) {
          mainCustomRow.classList.remove('hidden');
          if (customAspectRatioInput) customAspectRatioInput.value = model.aspectRatio;
        }
      }
    }

    if (stickyAspectRatioSelect && model.aspectRatio !== undefined) {
      // Check if the aspect ratio is a custom value (not in the predefined options)
      const predefinedOptions = ['1:1', '4:5', '2:3', '3:4', '3:2', '5:4', '4:3', '1.91:1', '2:1', '16:9', '9:16'];
      if (predefinedOptions.includes(model.aspectRatio)) {
        stickyAspectRatioSelect.value = model.aspectRatio;
        if (stickyCustomRow) stickyCustomRow.classList.add('hidden');
      } else {
        stickyAspectRatioSelect.value = 'custom';
        if (stickyCustomRow) {
          stickyCustomRow.classList.remove('hidden');
          if (stickyCustomAspectRatioInput) stickyCustomAspectRatioInput.value = model.aspectRatio;
        }
      }
    }
  }

  // Aspect Ratio Enable/Disable Logic
  setupAspectRatioEnable() {
    const enableCheckbox = document.getElementById('enable-aspect-ratio');
    const aspectDropdown = document.getElementById('aspect-ratio-select');

    // Load saved state
    const saved = localStorage.getItem('prompteraid_enable_aspect_ratio');
    if (saved === null) {
      enableCheckbox.checked = false;
    } else {
      enableCheckbox.checked = saved === 'true';
    }

    function updateDropdownState() {
      if (enableCheckbox.checked) {
        aspectDropdown.disabled = false;
        aspectDropdown.classList.remove('disabled');
      } else {
        aspectDropdown.disabled = true;
        aspectDropdown.classList.add('disabled');
      }
      localStorage.setItem('prompteraid_enable_aspect_ratio', enableCheckbox.checked);
      // Update the prompt when the aspect ratio enable state changes
      if (window.galleryController && typeof window.galleryController.updatePrompt === 'function') {
        window.galleryController.updatePrompt();
      }
    }

    enableCheckbox.addEventListener('change', updateDropdownState);
    updateDropdownState();
  }
} 