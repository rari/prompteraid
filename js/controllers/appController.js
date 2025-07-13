/**
 * PrompterAid Application Controller
 * 
 * Global Application Management:
 * This controller manages application-wide features and settings that are
 * independent of the main gallery functionality. It handles user preferences,
 * theme management, and global UI behaviors.
 * 
 * Primary Responsibilities:
 * - Theme management (dark/light mode) with system preference detection
 * - User preference persistence using localStorage
 * - Image protection (prevents right-click saving, drag & drop)
 * - Information panel management
 * - Global UI state initialization
 * - AI model selection (Niji 6, Midjourney v7)
 * 
 * Key Features:
 * - Automatic theme detection and switching
 * - Persistent user preferences across sessions
 * - Content protection for AI-generated images
 * - Responsive UI state management
 * - Error handling for storage operations
 * - Model switching between different AI versions
 * 
 * Storage Strategy:
 * - Uses prefixed localStorage keys to avoid conflicts
 * - Implements graceful fallbacks for storage errors
 * - Maintains backward compatibility with existing preferences
 */
export default class AppController {
  constructor() {
    this.currentModel = 'niji-6'; // Default model
    this.themeToggle = null;
    this.init();
  }

  init() {
    // Determine the model first, in a specific order of priority
    this.initializeModel();

    // Initialize dark mode first to set the theme immediately
    this.initDarkMode();
    
    // Disable right-click on images
    this.disableImageSaving();

    // Initialize the More Info section functionality
    this.initMoreInfoSection();
    
    // Initialize the News section functionality
    this.initNewsSection();
    
    // Check localStorage immediately to control page appearance
    this.checkInitialSettings();
    
    // Handle other URL parameters
    this.handleUrlParameters();
    
    // Initialize model change listener
    this.initModelChangeListener();
    
    // Initialize docs notification (since tutorial is commented out)
    this.initDocsNotification();
  }
  
  initializeModel() {
    const urlParams = new URLSearchParams(window.location.search);
    const modelFromUrl = urlParams.get('model');

    if (modelFromUrl && (modelFromUrl === 'niji-6' || modelFromUrl === 'midjourney-7')) {
      this.currentModel = modelFromUrl;
      // Also update localStorage to stay in sync
      localStorage.setItem('prompteraid_model', modelFromUrl);
      return;
    }

    const modelFromStorage = localStorage.getItem('prompteraid_model');
    if (modelFromStorage && (modelFromStorage === 'niji-6' || modelFromStorage === 'midjourney-7')) {
      this.currentModel = modelFromStorage;
      return;
    }
  }

  // Initialize model change listener
  initModelChangeListener() {
    document.addEventListener('modelChange', (e) => {
      const selectedModel = e.detail.model;
      this.changeModel(selectedModel);
    });
  }
  
  // Change the current AI model
  changeModel(modelId) {
    if (modelId !== this.currentModel) {
      console.log(`Changing model from ${this.currentModel} to ${modelId}`);
      this.currentModel = modelId;
      
      // Save to localStorage
      try {
        localStorage.setItem('prompteraid_model', modelId);
      } catch (e) {
        console.error('Failed to save model preference to localStorage:', e);
      }

      // Update URL without page reload - clear all parameters except model
      const url = new URL(window.location);
      url.searchParams.set('model', modelId);
      // Clear all other parameters that might interfere with the new model
      url.searchParams.delete('sref');
      url.searchParams.delete('q');
      url.searchParams.delete('quadrant');
      url.searchParams.delete('search');
      url.searchParams.delete('favorites');
      url.searchParams.delete('selected');
      window.history.replaceState({}, '', url.href);

      // Update the gallery controller's model and re-render
      if (window.galleryController && window.galleryController.model) {
        // Clear search state and UI
        if (window.galleryController.searchNumber !== null && window.galleryController.searchNumber !== '') {
          window.galleryController.clearSearchState();
        }
        
        // Clear any active filters (favorites, selected, etc.)
        if (window.galleryController.model.showOnlyFavorites) {
          window.galleryController.model.showOnlyFavorites = false;
          if (window.galleryController.view) {
            window.galleryController.view.updateFavoritesToggle(false);
          }
        }
        
        if (window.galleryController.showOnlySelected) {
          window.galleryController.showOnlySelected = false;
          if (window.galleryController.view) {
            window.galleryController.view.updateShowSelectedToggle(false);
          }
        }
        
        // Clear search input and hide search container
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
          searchInput.value = '';
          searchInput.classList.remove('search-active');
        }
        
        const searchContainer = document.querySelector('.search-container');
        if (searchContainer) {
          searchContainer.classList.add('hidden');
        }
        
        // Clear any warning banners
        if (window.galleryController.view) {
          window.galleryController.view.hideFullWidthNoSelectedWarning();
          window.galleryController.view.hideFilterDivider('search');
          window.galleryController.view.hideFilterDivider('selected');
          window.galleryController.view.hideFilterDivider('linked');
        }
        
        // Reload images for the new model with error boundary if available
        const switchModel = async () => {
          await window.galleryController.model.reloadImagesForModel(modelId);
          
          // Clear selections when switching models
          window.galleryController.model.selectedImages.clear();
          window.galleryController.model.imageWeights.clear();
          window.galleryController.model.weightColorIndices.clear();
          
          // Load favorites for the new model from appropriate location
          try {
            const user = await window.galleryController.favoritesController.getCurrentUser();
            if (user) {
              // User is logged in, load from Supabase
              await window.galleryController.favoritesController.loadFavoritesFromSupabase(user, modelId);
            } else {
              // Not logged in, load from localStorage
              window.galleryController.model.loadFromStorage();
            }
          } catch (error) {
            console.error('Failed to load favorites after model switch:', error);
            // Fallback to localStorage if Supabase fails
            window.galleryController.model.loadFromStorage();
          }
          
          // Re-render the gallery
          window.galleryController.renderGallery();
          
          // Add a brief flash animation to indicate model change
          const gallery = document.getElementById('image-gallery');
          if (gallery) {
            gallery.classList.add('model-change-active');
            setTimeout(() => {
              gallery.classList.remove('model-change-active');
            }, 1000);
          }
        };
        
        if (window.errorBoundary && window.errorBoundary.wrapAsyncWithRetry) {
          window.errorBoundary.wrapAsyncWithRetry(
            switchModel,
            2,
            'Model Switch'
          ).catch(error => {
            console.error('Failed to switch models:', error);
            if (window.errorBoundary && window.errorBoundary.showErrorMessage) {
              window.errorBoundary.showErrorMessage('Failed to switch models. Please try again.', 'error');
            }
          });
        } else {
          // Fallback to direct call if error boundary not available
          switchModel().catch(error => {
            console.error('Failed to switch models:', error);
          });
        }
      }
    }
  }
  
  handleUrlParameters() {
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const modelFromUrl = urlParams.get('model');
    if (modelFromUrl && (modelFromUrl === 'niji-6' || modelFromUrl === 'midjourney-7')) {
      this.currentModel = modelFromUrl;
      localStorage.setItem('prompteraid_model', modelFromUrl);
    }
    const sref = urlParams.get('sref');
    const quadrant = urlParams.get('quadrant'); // Use full parameter name for SEO
    
    // Handle sref (style reference) - this takes priority over search
    if (sref) {
      // Check if this is a single image link or multiple images
      // First, try to find a single image with the exact sref
      const checkSingleImage = () => {
        if (!window.galleryController || !window.galleryController.view || !window.galleryController.model) {
          console.log("Gallery controller not yet available, waiting...");
          setTimeout(checkSingleImage, 500);
          return;
        }
        
        // Try to find the image with the exact sref first
        const galleryItem = document.querySelector(`.gallery-item[data-sref="${sref}"]`);
        if (galleryItem) {
          // Single image found - create linked view
          console.log(`Found single style reference: ${sref} with quadrant: ${quadrant || 'none'}`);
          this.createLinkedView(galleryItem, sref, quadrant);
          return;
        }
        
        // If no single image found, treat as multiple style references
        // Split by commas first, then by spaces for backward compatibility
        const srefParts = sref.split(/[,\s]+/).filter(part => part.trim().length > 0);
        console.log(`Multiple style references detected, treating as search: ${srefParts.join(', ')}`);
        
        const trySearch = () => {
          if (!window.galleryController || !window.galleryController.view) {
            setTimeout(trySearch, 300);
            return;
          }
          // Open search UI if not already open
          const searchContainer = document.querySelector('.search-container');
          if (searchContainer && searchContainer.classList.contains('hidden')) {
            searchContainer.classList.remove('hidden');
          }
          // Set search input value to the comma-separated style references
          const searchInput = document.getElementById('search-input');
          if (searchInput) {
            searchInput.value = srefParts.join(' ');
            // Add search-active class for neon-teal border
            searchInput.classList.add('search-active');
          }
          // Set searchNumber and trigger search (filter out weight syntax)
          const filteredSref = this.filterSearchInput(srefParts.join(' '));
          window.galleryController.searchNumber = filteredSref;
          window.galleryController.performSearch(filteredSref);
        };
        setTimeout(trySearch, 800);
      };
      
      // Start checking
      setTimeout(checkSingleImage, 1000);
      return; // Exit early, don't process as search
    }
    
    // Handle search (only if no sref is present)
    const searchQ = urlParams.get('q');
    if (searchQ && !sref) {
      const trySearch = () => {
        if (!window.galleryController || !window.galleryController.view) {
          setTimeout(trySearch, 300);
          return;
        }
        // Open search UI if not already open
        const searchContainer = document.querySelector('.search-container');
        if (searchContainer && searchContainer.classList.contains('hidden')) {
          searchContainer.classList.remove('hidden');
        }
        // Set search input value
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
          searchInput.value = searchQ;
          // Add search-active class for neon-teal border
          searchInput.classList.add('search-active');
        }
        // Set searchNumber and trigger search (filter out weight syntax)
        const filteredSearchQ = this.filterSearchInput(searchQ);
        window.galleryController.searchNumber = filteredSearchQ;
        window.galleryController.performSearch(filteredSearchQ);
      };
      setTimeout(trySearch, 800);
    }
  }
  
  createLinkedView(galleryItem, sref, quadrant) {
    // Get the gallery controller
    const galleryController = window.galleryController;
    
    if (!galleryController) {
      console.error("Gallery controller not available for linked view");
      return;
    }
    
    // Get the image ID from the gallery item
    const imageId = galleryItem.dataset.id;
    
    if (!imageId) {
      console.error("Image ID not found in gallery item");
      return;
    }
    
    // Find the image in the model
    const linkedImage = galleryController.model.images.find(img => img.id === imageId);
    
    if (!linkedImage) {
      console.error(`Image with ID ${imageId} not found in the model`);
      return;
    }
    
    // Clear the gallery
    galleryController.view.clearGallery();
    
    // Create the linked item
    const linkedItem = galleryController.view.createGalleryItem(
      linkedImage,
      false, // Not selected by default
      galleryController.model.favoriteImages.has(imageId),
      -1, // No color index
      this.currentModel // Pass the current model
    );
    
    // Add highlight class to make it stand out
    linkedItem.classList.add('highlight-item');
    
    // Append to gallery
    galleryController.view.gallery.appendChild(linkedItem);
    
    // Set the quadrant if specified
    if (quadrant !== null) {
      const quadrantNum = parseInt(quadrant, 10);
      if (!isNaN(quadrantNum) && quadrantNum >= 0 && quadrantNum <= 3) {
        const img = linkedItem.querySelector('img');
        
        if (img) {
          // Remove existing quadrant classes
          img.className = img.className
            .split(' ')
            .filter(cls => !cls.startsWith('quadrant-'))
            .join(' ');
          
          // Add the new quadrant class
          img.classList.add(`quadrant-${quadrantNum}`);
          
          // Store the quadrant in the gallery controller's view
          if (galleryController.view.imageQuadrants) {
            galleryController.view.imageQuadrants.set(imageId, quadrantNum);
          }
        }
      }
    }
    
    // Show the divider
    galleryController.view.showFilterDivider('linked', 1);
    
    // Get all images except the linked one
    const allImages = galleryController.model.images;
    const otherImages = allImages.filter(img => img.id !== linkedImage.id);
    
    // Append the other images
    otherImages.forEach(image => {
      const isSelected = galleryController.model.selectedImages.has(image.id);
      const isFavorite = galleryController.model.favoriteImages.has(image.id);
      
      const galleryItem = galleryController.view.createGalleryItem(
        image,
        isSelected,
        isFavorite,
        isSelected ? galleryController.model.selectedImages.get(image.id) : -1,
        this.currentModel // Pass the current model
      );
      
      galleryController.view.gallery.appendChild(galleryItem);
    });
    
    // Update weight displays
    galleryController.view.updateAllWeightDisplays(
      (imageId) => galleryController.model.getWeight(imageId),
      (imageId) => galleryController.model.getWeightColorIndex(imageId)
    );
    
    // Update image count in the header with the correct model
    galleryController.view.updateImageCountSubheader(
      allImages.length,
      galleryController.model.selectedImages.size,
      this.currentModel // Pass the current model
    );
    
    // Open the search if it exists
    const searchButton = document.querySelector('.button-search');
    const searchInput = document.getElementById('search-input');
    
    if (searchButton && searchInput) {
      // Activate search
      searchButton.classList.add('active');
      document.querySelector('.search-container')?.classList.remove('hidden');
      
      // Set the search input value to the style reference
      searchInput.value = sref;
      
      // Add search-active class for neon-teal border
      searchInput.classList.add('search-active');
      
      // Set the search number in the gallery controller
      galleryController.searchNumber = sref;
      
      // Update search button icons to show active state
      galleryController.view.updateSearchButtonIcons(true);
    }
    
    // Scroll to top to show the linked image
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Remove highlight after a few seconds
    setTimeout(() => {
      const highlightedItem = document.querySelector('.gallery-item.highlight-item');
      if (highlightedItem) {
        highlightedItem.classList.remove('highlight-item');
      }
    }, 3000);
    
    // Log to confirm the linked view is created
    console.log('Created linked view with divider and gallery');
  }

  initDarkMode() {
    // Get the theme toggle button
    this.themeToggle = document.getElementById('theme-toggle');
    
    // Remove theme modal elements
    const themeModalContainer = document.getElementById('theme-modal-container');
    if (themeModalContainer) {
      themeModalContainer.remove();
    }
    
    // Check for saved theme preference
    // Add a prefix to localStorage keys to avoid conflicts with other GitHub Pages sites
    const savedTheme = localStorage.getItem('prompteraid_theme');
    
    // Set initial theme based on saved preference or system preference
    if (savedTheme) {
      // User has manually set a preference
      this.setTheme(savedTheme);
    } else {
      // Use system preference as default
      this.setSystemTheme();
    }
    
    // Add event listener to theme toggle button
    if (this.themeToggle) {
      this.themeToggle.addEventListener('click', () => {
        // Toggle the theme immediately for better UX
        this.toggleTheme();
      });
    }
    
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      // Only auto-switch if user hasn't set a manual preference
      if (!localStorage.getItem('prompteraid_theme')) {
        this.setSystemTheme();
      }
    });
  }

  setSystemTheme() {
    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = prefersDark ? 'dark' : 'light';
    
    // ALWAYS ensure a corresponding class is present so CSS theme overrides work
    document.documentElement.classList.remove('dark-mode', 'light-mode');
    document.documentElement.classList.add(prefersDark ? 'dark-mode' : 'light-mode');

    // Update theme toggle icons to reflect system preference
    this.updateThemeToggleIcons(theme);
  }

  setTheme(theme) {
    const isDark = theme === 'dark';
    const isLight = theme === 'light';
    
    // Remove all theme classes first
    document.documentElement.classList.remove('dark-mode', 'light-mode');
    
    // Add appropriate theme class
    if (isDark) {
      document.documentElement.classList.add('dark-mode');
    } else if (isLight) {
      document.documentElement.classList.add('light-mode');
    }
    
    // Update theme toggle icons
    this.updateThemeToggleIcons(theme);
    
    // Save preference to localStorage with prefix
    localStorage.setItem('prompteraid_theme', theme);
  }

  updateThemeToggleIcons(theme) {
    const isDark = theme === 'dark';
    
    // Update theme toggle icons (both main and sticky)
    const themeToggles = [
      this.themeToggle,
      document.getElementById('sticky-theme-toggle')
    ].filter(Boolean);
    
    themeToggles.forEach(toggle => {
      const icon = toggle.querySelector('i');
      if (icon) {
        icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
      }
      
      // Add appropriate color class to the button
      if (isDark) {
        toggle.classList.add('theme-toggle-dark');
        toggle.classList.remove('theme-toggle-light');
      } else {
        toggle.classList.add('theme-toggle-light');
        toggle.classList.remove('theme-toggle-dark');
      }
    });
  }

  toggleTheme() {
    const hasDarkMode = document.documentElement.classList.contains('dark-mode');
    const newTheme = hasDarkMode ? 'light' : 'dark';
    this.setTheme(newTheme);
  }

  disableImageSaving() {
    // Prevent right-click context menu on images
    document.addEventListener('contextmenu', event => {
      if (event.target.tagName === 'IMG') {
        event.preventDefault();
        return false;
      }
    });

    // Prevent drag & drop of images
    document.addEventListener('dragstart', event => {
      if (event.target.tagName === 'IMG') {
        event.preventDefault();
        return false;
      }
    });

    // Prevent touch-and-hold on mobile (equivalent to right-click)
    document.addEventListener('touchstart', event => {
      if (event.target.tagName === 'IMG') {
        // Add CSS to prevent the default touch behavior
        event.target.style.webkitTouchCallout = 'none';
        event.target.style.webkitUserSelect = 'none';
      }
    }, { passive: true });

    // Add CSS rules to prevent image saving
    this.addImageProtectionStyles();
  }

  addImageProtectionStyles() {
    // Create a style element
    const style = document.createElement('style');
    style.innerHTML = `
      img {
        -webkit-touch-callout: none; /* iOS Safari */
        -webkit-user-select: none;   /* Safari */
        -khtml-user-select: none;    /* Konqueror HTML */
        -moz-user-select: none;      /* Firefox */
        -ms-user-select: none;       /* Internet Explorer/Edge */
        user-select: none;           /* Non-prefixed version */
        pointer-events: none;        /* Disable pointer events */
      }
      
      /* Re-enable pointer events for buttons and interactive elements within gallery items */
      .gallery-item button,
      .gallery-item .favorite-button,
      .gallery-item .quadrant-flip-button,
      .gallery-item .link-button {
        pointer-events: auto;
      }
    `;
    document.head.appendChild(style);
  }

  initMoreInfoSection() {
    const moreInfoContainer = document.querySelector('.more-info-container');
    const closeButton = document.getElementById('close-more-info');
    
    // Remove cookie modal
    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) {
      modalContainer.remove();
    }

    if (!moreInfoContainer || !closeButton) {
      return;
    }

    closeButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      moreInfoContainer.classList.add('hidden');
      // Save preference to localStorage with prefix
      localStorage.setItem('prompteraid_hideMoreInfo', 'true');
    });
  }



  initNewsSection() {
    const newsContainer = document.querySelector('.news-container');
    const closeButton = document.getElementById('close-news');
    
    if (!newsContainer || !closeButton) {
      return;
    }

    closeButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      newsContainer.classList.add('hidden');
      // Save preference to localStorage with prefix
      localStorage.setItem('prompteraid_hideNews', 'true');
    });
  }

  initDocsNotification() {
    const dismissNotificationButton = document.getElementById('dismiss-docs-notification');
    const docsNotification = document.getElementById('docs-notification');
    
    // Since tutorial is commented out, show notification by default unless dismissed
    const notificationDismissed = localStorage.getItem('prompteraid_docsNotificationDismissed');
    
    if (notificationDismissed !== 'true' && docsNotification) {
      // Add a delay to ensure the page is fully loaded
      setTimeout(() => {
        // Explicitly re-apply the theme class to the notification BEFORE showing it
        docsNotification.classList.remove('dark-mode', 'light-mode');
        if (document.documentElement.classList.contains('dark-mode')) {
          docsNotification.classList.add('dark-mode');
        } else if (document.documentElement.classList.contains('light-mode')) {
          docsNotification.classList.add('light-mode');
        } else {
          // Fallback: check system preference if no theme class is set
          if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            docsNotification.classList.add('dark-mode');
          } else {
            docsNotification.classList.add('light-mode');
          }
        }
        // Only remove hidden class after theme is applied
        docsNotification.classList.remove('hidden');
      }, 1500);
    }

    // Handle dismiss notification button
    if (dismissNotificationButton && docsNotification) {
      dismissNotificationButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        docsNotification.classList.add('fading-out');
        setTimeout(() => {
        docsNotification.classList.add('hidden');
          docsNotification.classList.remove('fading-out');
        }, 350); // match the CSS transition duration
        localStorage.setItem('prompteraid_docsNotificationDismissed', 'true');
      });
    }
  }

  checkInitialSettings() {
    // Check theme preference
    const savedTheme = localStorage.getItem('prompteraid_theme');
    if (savedTheme) {
      this.setTheme(savedTheme);
    } else {
      // Use system preference if no manual preference is saved
      this.setSystemTheme();
    }
    
    // Check info section preference
    const hideMoreInfo = localStorage.getItem('prompteraid_hideMoreInfo');
    if (hideMoreInfo === 'true') {
      const moreInfoContainer = document.querySelector('.more-info-container');
      if (moreInfoContainer) {
        moreInfoContainer.classList.add('hidden');
      }
    }
    
    // Check news section preference
    const hideNews = localStorage.getItem('prompteraid_hideNews');
    if (hideNews === 'true') {
      const newsContainer = document.querySelector('.news-container');
      if (newsContainer) {
        newsContainer.classList.add('hidden');
      }
    }
    

  }

  /**
   * Helper function to filter out weight syntax from search input
   * @param {string} searchInput - The search input string
   * @returns {string} Filtered search input with weight syntax removed
   */
  filterSearchInput(searchInput) {
    if (!searchInput) return '';
    
    return searchInput
      .replace(/::\d+(?:\.\d+)?/g, '') // Remove :: followed by numbers (including decimals)
      .replace(/[^0-9\s]/g, '') // Remove any other non-numeric characters except spaces
      .replace(/\s+/g, ' ') // Normalize multiple spaces to single spaces
      .trim(); // Remove leading/trailing whitespace
  }
} 