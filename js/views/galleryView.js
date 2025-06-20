/*
 * PrompterAid JavaScript Architecture
 * 
 * Design Patterns:
 * 1. View Class Pattern
 *    - Encapsulates DOM manipulation and event handling
 *    - Maintains single source of truth for UI state
 *    - Uses event delegation for efficient handling
 * 
 * 2. Event Flow
 *    - Main menu buttons are primary event sources
 *    - Sticky header delegates events to main menu
 *    - State changes propagate from main menu outward
 * 
 * 3. Component Lifecycle
 *    - Initialization: Sets up event listeners and clones menus
 *    - Runtime: Handles scroll events and button interactions
 *    - Cleanup: Removes event listeners on destruction
 * 
 * AI Maintenance Guidelines:
 * - Maintain event delegation pattern
 * - Keep state management centralized
 * - Preserve button ID conventions
 * - Handle all error cases
 */

export default class GalleryView {
  constructor() {
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
    
    // Store quadrants for each image
    this.imageQuadrants = new Map();

    // Add 👁️ show-selected button
    this.addShowSelectedButton();

    // The 'back-to-top-btn' now exists in HTML, so we just need to handle its events.
    this.backToTopButton = document.getElementById('back-to-top-btn');

    // Add sticky action bar
    this.addStickyActionBar();
    
    // Unified scroll handler
    window.addEventListener('scroll', () => {
      this.handleStickyBarVisibility();
      this.handleBackToTopVisibility();
    });
    
    // Add bubble animation to title
    this.addTitleBubbleEffect();
    
    // Add toggle preview functionality
    this.addTogglePreviewFunctionality();

    // Initialize buttons
    this.initializeButtons();
    
    // Sync sticky menu with main menu to ensure all buttons work
    this.syncStickyMenu();
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

  /*
   * Sticky Header Implementation
   * - Clones main menu for consistency
   * - Updates button IDs with 'sticky-' prefix
   * - Maintains event delegation to main menu
   */
  addStickyActionBar() {
    if (document.getElementById('sticky-action-bar')) return;
    const origInputGroup = document.querySelector('.input-group');
    if (!origInputGroup) return;
    
    // Create sticky wrapper with proper styling
    const stickyWrapper = document.createElement('div');
    stickyWrapper.id = 'sticky-action-bar';
    stickyWrapper.className = 'sticky-action-bar';
    
    // Clone the input group and its buttons
    const stickyInputGroup = origInputGroup.cloneNode(true);

    // Button ID mapping for consistent targeting
    const buttonMap = {
      'clear-button': 'sticky-clear-button',
      'refresh-button': 'sticky-refresh-button',
      'favorites-toggle': 'sticky-favorites-toggle',
      'show-selected-btn': 'sticky-show-selected-btn',
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
    
    stickyWrapper.appendChild(stickyInputGroup);
    
    // Create prompt preview for sticky header
    const stickyPreview = document.createElement('div');
    stickyPreview.id = 'sticky-prompt-preview';
    stickyPreview.className = 'prompt-preview sticky-prompt-preview hidden';
    
    const stickyFinalPrompt = document.createElement('p');
    stickyFinalPrompt.id = 'sticky-final-prompt';
    
    stickyPreview.appendChild(stickyFinalPrompt);
    stickyWrapper.appendChild(stickyPreview);
    
    document.body.appendChild(stickyWrapper);

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
  }

  togglePreview() {
    const mainPreview = document.querySelector('.prompt-preview');
    const stickyPreview = document.querySelector('.sticky-prompt-preview');
    const mainToggle = document.getElementById('toggle-preview-button');
    const stickyToggle = document.getElementById('sticky-toggle-preview-button');
    
    if (!mainPreview || !stickyPreview || !mainToggle || !stickyToggle) return;
    
    const isHidden = mainPreview.classList.contains('hidden');
        
    // Toggle both previews
    mainPreview.classList.toggle('hidden', !isHidden);
    stickyPreview.classList.toggle('hidden', !isHidden);
        
    // Update both toggle buttons
    mainToggle.classList.toggle('active', !isHidden);
    stickyToggle.classList.toggle('active', !isHidden);
    
    // Set both icons to chevron-down, rotation is handled by CSS
    const mainIcon = mainToggle.querySelector('i');
    const stickyIcon = stickyToggle.querySelector('i');
    
    if (mainIcon) mainIcon.className = 'fas fa-chevron-down';
    if (stickyIcon) stickyIcon.className = 'fas fa-chevron-down';
  }

  /*
   * Scroll Handler
   * - Shows/hides sticky header based on scroll position
   * - Uses CSS classes for smooth transitions
   * - Maintains scroll position state
   */
  handleStickyBarVisibility() {
    const stickyBar = document.getElementById('sticky-action-bar');
    if (!stickyBar) return;
    
    if (window.scrollY > 200) {
      stickyBar.classList.add('visible');
    } else {
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

  renderGallery(images, selectedImages, favoriteImages) {
    // Remove sorting that moves selected images to the top

    // Clear existing gallery items except the no-favorites message
    Array.from(this.gallery.children).forEach(child => {
      if (child.id !== 'no-favorites') {
        this.gallery.removeChild(child);
      }
    });

    // Show or hide the no favorites message
    if (images.length === 0) {
      this.noFavoritesMessage.classList.remove('hidden');
    } else {
      this.noFavoritesMessage.classList.add('hidden');
    }

    // Update the image count subheader
    this.updateImageCountSubheader(
      images.length,
      selectedImages.size
    );

    // Create and append gallery items
    images.forEach(image => {
      const isSelected = selectedImages.has(image.id);
      const galleryItem = this.createGalleryItem(
        image, 
        isSelected, 
        favoriteImages.has(image.id),
        isSelected ? selectedImages.get(image.id) : -1
      );
      this.gallery.appendChild(galleryItem);
    });
  }

  createGalleryItem(image, isSelected, isFavorite, colorIndex) {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    
    // Add hover color class based on the image's position in the gallery
    // This ensures hover colors match the selection color logic
    const hoverColorIndex = this.getHoverColorIndex(image.id);
    item.classList.add(`hover-color-${hoverColorIndex}`);
    
    if (isSelected) {
      item.classList.add('selected', `selected-color-${colorIndex}`);
    }
    item.dataset.id = image.id;
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
    img.alt = `Style reference ${image.sref}`;
    img.className = `quadrant quadrant-${quadrant}`;
    img.loading = 'lazy'; // Enable lazy loading
    item.appendChild(img);

    const favButton = document.createElement('button');
    favButton.className = 'favorite-button';
    favButton.innerHTML = isFavorite 
      ? '<i class="fas fa-star"></i>' 
      : '<i class="far fa-star"></i>';
    favButton.dataset.id = image.id;
    item.appendChild(favButton);

    // Add quadrant flip button directly below the star
    const flipButton = document.createElement('button');
    flipButton.className = 'quadrant-flip-button';
    flipButton.innerHTML = '<i class="fas fa-sync-alt"></i>';
    flipButton.title = 'Flip quadrant';
    flipButton.dataset.id = image.id;
    flipButton.style.position = 'absolute';
    flipButton.style.top = '3.2rem';
    flipButton.style.right = '0.5rem';
    flipButton.style.zIndex = '3';
    flipButton.addEventListener('click', (e) => {
      e.stopPropagation();
      
      // Add spinning animation to the button icon
      const icon = flipButton.querySelector('i');
      icon.classList.add('spinning');
      
      // Remove the class after animation completes
      setTimeout(() => {
        icon.classList.remove('spinning');
      }, 300);
      
      let current = this.imageQuadrants.get(image.id) ?? 0;
      let next = (current + 1) % 4;
      this.imageQuadrants.set(image.id, next);
      
      // Suppress animation
      img.classList.add('no-transition');
      img.className = `quadrant quadrant-${next} no-transition`;
      
      // Remove the class after a short delay
      setTimeout(() => img.classList.remove('no-transition'), 50);
    });
    item.appendChild(flipButton);

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
    console.log('updateFavoritesToggle called with:', showOnlyFavorites);
    
    // Update main button
    if (this.favoritesToggle) {
      const icon = this.favoritesToggle.querySelector('i');
      console.log('Main favorites toggle found:', this.favoritesToggle);
      if (showOnlyFavorites) {
        this.favoritesToggle.classList.add('active');
        if (icon) {
          icon.className = 'fas fa-star';
          console.log('Main button set to filled star');
        }
      } else {
        this.favoritesToggle.classList.remove('active');
        if (icon) {
          icon.className = 'far fa-star';
          console.log('Main button set to outlined star');
        }
      }
    }
    
    // Update sticky button if present
    const sticky = document.getElementById('sticky-action-bar');
    console.log('Sticky action bar found:', sticky);
    if (sticky) {
      const stickyFavoritesBtn = sticky.querySelector('#sticky-favorites-toggle');
      console.log('Sticky favorites button found:', stickyFavoritesBtn);
      if (stickyFavoritesBtn) {
        const stickyIcon = stickyFavoritesBtn.querySelector('i');
        console.log('Sticky icon found:', stickyIcon);
        if (showOnlyFavorites) {
          stickyFavoritesBtn.classList.add('active');
          if (stickyIcon) {
            stickyIcon.className = 'fas fa-star';
            console.log('Sticky button set to filled star');
          }
        } else {
          stickyFavoritesBtn.classList.remove('active');
          if (stickyIcon) {
            stickyIcon.className = 'far fa-star';
            console.log('Sticky button set to outlined star');
          }
        }
      } else {
        console.log('Sticky favorites button NOT found!');
        // Let's see what buttons are actually in the sticky bar
        const allStickyButtons = sticky.querySelectorAll('button');
        console.log('All sticky buttons:', Array.from(allStickyButtons).map(btn => btn.id));
      }
    }
  }

  bindImageClick(handler) {
    this.gallery.addEventListener('click', event => {
      const galleryItem = event.target.closest('.gallery-item');
      if (galleryItem && !event.target.closest('.favorite-button')) {
        const id = galleryItem.dataset.id;
        handler(id);
      }
    });
  }

  bindFavoriteClick(handler) {
    this.gallery.addEventListener('click', event => {
      const favoriteButton = event.target.closest('.favorite-button');
      if (favoriteButton) {
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
        // Blur (deselect) the input field
        this.promptInput.blur();
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
            // Blur (deselect) the input field
            stickyPromptInput.blur();
          }
        });
      }
    }
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
    // Create or show a warning message at the top of the gallery
    let warning = document.getElementById('no-selected-warning');
    if (!warning) {
      warning = document.createElement('div');
      warning.id = 'no-selected-warning';
      warning.className = 'warning-message';
      warning.textContent = 'No images are selected.';
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

  showInfoNotification(message) {
    // Create or show an info notification at the top of the gallery
    let notification = document.getElementById('info-notification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'info-notification';
      notification.className = 'info-notification';
      notification.style.position = 'fixed';
      notification.style.top = '24px';
      notification.style.left = '50%';
      notification.style.transform = 'translateX(-50%)';
      notification.style.background = '#e6f7ff';
      notification.style.color = '#0066cc';
      notification.style.padding = '12px 24px';
      notification.style.border = '1px solid #91d5ff';
      notification.style.borderRadius = '8px';
      notification.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
      notification.style.zIndex = '2000';
      document.body.appendChild(notification);
    }
    notification.textContent = message;
    notification.style.display = 'block';
    setTimeout(() => {
      notification.style.display = 'none';
    }, 2000);
  }

  showErrorNotification(message) {
    // Create or show an error notification at the top of the gallery (with friendly styling)
    let notification = document.getElementById('error-notification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'error-notification';
      notification.className = 'error-notification';
      notification.style.position = 'fixed';
      notification.style.top = '24px';
      notification.style.left = '50%';
      notification.style.transform = 'translateX(-50%)';
      notification.style.background = '#fff2f0';
      notification.style.color = '#cf1322';
      notification.style.padding = '12px 24px';
      notification.style.border = '1px solid #ffccc7';
      notification.style.borderRadius = '8px';
      notification.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
      notification.style.zIndex = '2000';
      document.body.appendChild(notification);
    }
    notification.textContent = message;
    notification.style.display = 'block';
    setTimeout(() => {
      notification.style.display = 'none';
    }, 3000);
  }

  updateImageCountSubheader(totalCount, selectedCount) {
    if (!this.imageCountSubheader) return;
    
    if (selectedCount > 0) {
      this.imageCountSubheader.innerHTML = `
        <i class="fas fa-image" style="color: var(--tropical-turquoise); opacity: 0.8; font-size: 0.9em;"></i>
        <span class="selected-count">${selectedCount}</span> of 
        <span class="count">${totalCount}</span> pregenerated sref references selected
      `;
    } else {
      this.imageCountSubheader.innerHTML = `
        <i class="fas fa-image" style="color: var(--tropical-turquoise); opacity: 0.8; font-size: 0.9em;"></i>
        <span class="count">${totalCount}</span> pregenerated sref references
      `;
    }
  }

  bindClearButton(handler) {
    if (!this.clearButton) return;
    
    const applyFirstClickState = (button) => {
      // Just add shake animation on first click, don't change icon
      button.classList.add('shake-animation');
    };
    
    const applySecondClickState = (button) => {
      // Remove shake animation and change to solid icon on second click
      button.classList.remove('shake-animation');
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
      
      this.clearButtonClickCount++;
      
      // Clear any existing timeout
      if (this.clearButtonTimeout) {
        clearTimeout(this.clearButtonTimeout);
      }
      
      // First click - just shake the icon, don't execute handler
      if (this.clearButtonClickCount === 1) {
        applyFirstClickState(this.clearButton);
        
        // Also update sticky bar button if present
        const sticky = document.getElementById('sticky-action-bar');
        if (sticky) {
          const stickyClearBtn = sticky.querySelector('#sticky-clear-button');
          if (stickyClearBtn) {
            applyFirstClickState(stickyClearBtn);
          }
        }
        
        // Reset after 2 seconds if not clicked again
        this.clearButtonTimeout = setTimeout(() => {
          resetButtonState(this.clearButton);
          
          // Also reset sticky bar button
          const sticky = document.getElementById('sticky-action-bar');
          if (sticky) {
            const stickyClearBtn = sticky.querySelector('#sticky-clear-button');
            if (stickyClearBtn) {
              resetButtonState(stickyClearBtn);
            }
          }
          
          this.clearButtonClickCount = 0;
        }, 2000);
      } 
      // Second click - fill icon (no shake) and execute the clear action
      else if (this.clearButtonClickCount === 2) {
        // Fill the icon first (no shake animation)
        applySecondClickState(this.clearButton);
        
        // Also update sticky bar button
        const sticky = document.getElementById('sticky-action-bar');
        if (sticky) {
          const stickyClearBtn = sticky.querySelector('#sticky-clear-button');
          if (stickyClearBtn) {
            applySecondClickState(stickyClearBtn);
          }
        }
        
        // Execute the clear action after a brief delay to show the filled icon
        setTimeout(() => {
          handler(); // Only execute handler on second click
          resetButtonState(this.clearButton);
          
          // Also reset sticky bar button
          if (sticky) {
            const stickyClearBtn = sticky.querySelector('#sticky-clear-button');
            if (stickyClearBtn) {
              resetButtonState(stickyClearBtn);
            }
          }
          
          this.clearButtonClickCount = 0;
        }, 300);
      }
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
    
    // Create bubbles on click
    titleContainer.addEventListener('click', (e) => {
      this.createBubbles(e, titleContainer, titleText, 10, 15);
    });
    
    // Create bubbles continuously always - more frequently now (500ms instead of 800ms)
    setInterval(() => {
      this.createBubbles(null, titleContainer, titleText, 1, 2);
    }, 500);
    
    // Track mouse position for hover effect
    let mouseX = null;
    let mouseY = null;
    
    titleContainer.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });
    
    titleContainer.addEventListener('mouseleave', () => {
      mouseX = null;
      mouseY = null;
    });
    
    // Create bubbles that follow the cursor when hovering - more frequently (200ms instead of 300ms)
    setInterval(() => {
      if (mouseX !== null && mouseY !== null) {
        const e = { clientX: mouseX, clientY: mouseY };
        this.createBubbles(e, titleContainer, titleText, 1, 2);
      }
    }, 200);
  }
  
  createBubbles(e, container, titleText, minBubbles, maxBubbles) {
    // Create minBubbles-maxBubbles bubbles
    const bubbleCount = Math.floor(Math.random() * (maxBubbles - minBubbles + 1)) + minBubbles;
      
    // Get the neon colors from CSS variables
    const neonColors = [
      getComputedStyle(document.documentElement).getPropertyValue('--neon-pink').trim(),
      getComputedStyle(document.documentElement).getPropertyValue('--neon-purple').trim(),
      getComputedStyle(document.documentElement).getPropertyValue('--neon-yellow').trim(),
      getComputedStyle(document.documentElement).getPropertyValue('--neon-orange').trim(),
      getComputedStyle(document.documentElement).getPropertyValue('--neon-teal').trim(),
      getComputedStyle(document.documentElement).getPropertyValue('--neon-blue').trim()
    ];
    
    const containerRect = container.getBoundingClientRect();
    const titleRect = titleText.getBoundingClientRect();
      
      for (let i = 0; i < bubbleCount; i++) {
        // Create a bubble
        const bubble = document.createElement('div');
        bubble.classList.add('bubble');
        
      // Position bubbles only above the title text:
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
      const color = neonColors[Math.floor(Math.random() * neonColors.length)];
        
      // Random animation duration - faster now
      const duration = Math.random() * 2 + 1; // 1-3s instead of 2-5s
        
        // Set bubble styles
        bubble.style.width = `${size}px`;
        bubble.style.height = `${size}px`;
        bubble.style.left = `${x}px`;
        bubble.style.top = `${y}px`;
        bubble.style.background = `radial-gradient(circle at 30% 30%, ${color}80, ${color}20)`;
        bubble.style.animation = `float-up ${duration}s ease-in forwards`;
        
        // Add to DOM
      container.appendChild(bubble);
        
        // Remove after animation completes
        setTimeout(() => {
          if (bubble.parentNode) {
            bubble.parentNode.removeChild(bubble);
          }
        }, duration * 1000);
      }
  }

  addTogglePreviewFunctionality() {
    if (!this.togglePreviewButton || !this.promptPreview) return;
    
    const isHidden = this.promptPreview.classList.contains('hidden');
    
    this.togglePreviewButton.classList.toggle('active', !isHidden);
    const icon = this.togglePreviewButton.querySelector('i');
    if (icon) {
      // Always use chevron-down, rotation is handled by CSS
      icon.className = 'fas fa-chevron-down';
    }
    
    this.togglePreviewButton.addEventListener('click', (e) => {
      e.stopPropagation();
      
      const willBeHidden = !this.promptPreview.classList.contains('hidden');
      this.promptPreview.classList.toggle('hidden', willBeHidden);
      
      this.togglePreviewButton.classList.toggle('active', !willBeHidden);
      
      // No need to change icon class, CSS handles rotation
      
      // Also update any toggle button and preview in the sticky bar
      const stickyBar = document.querySelector('.sticky-action-bar');
      if (stickyBar) {
        const stickyToggleBtn = stickyBar.querySelector('#sticky-toggle-preview-button');
        const stickyPreview = stickyBar.querySelector('.sticky-prompt-preview');
        
        if (stickyToggleBtn) {
          stickyToggleBtn.classList.toggle('active', !willBeHidden);
          const stickyIcon = stickyToggleBtn.querySelector('i');
          if (stickyIcon) {
            // Always use chevron-down, rotation is handled by CSS
            stickyIcon.className = 'fas fa-chevron-down';
          }
        }
        
        if (stickyPreview) {
          stickyPreview.classList.toggle('hidden', willBeHidden);
        }
      }
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
  updateModeToggle(isDiscordMode) {
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
    
    // Show notification about mode change
    const mode = isDiscordMode ? 'Discord' : 'Website';
    this.showInfoNotification(`Switched to ${mode} mode`);
  }
} 