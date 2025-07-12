import ImageModel from '../models/imageModel.js';
import GalleryView from '../views/galleryView.js';
import FavoritesController from './favoritesController.js';
import { supabase } from '../utils/supabaseClient.js';

/**
 * PrompterAid Gallery Controller
 * 
 * Controller Role:
 * This controller implements the MVC pattern's Controller layer, serving as the
 * intermediary between the View (UI) and Model (data/business logic). It manages
 * user interactions, coordinates data flow, and maintains application state.
 * 
 * Primary Responsibilities:
 * - Orchestrates communication between View and Model components
 * - Handles user interaction logic and input validation
 * - Manages application state transitions
 * - Coordinates UI updates based on data changes
 * - Implements business rules and workflow logic
 * 
 * Key Features Managed:
 * - Image selection and deselection workflow
 * - Favorites system with persistence
 * - Filter management (favorites-only, selected-only views)
 * - Prompt generation and clipboard integration
 * - Keyboard shortcut handling
 * - Error handling and user feedback
 * 
 * State Management:
 * - Tracks selected images and their visual states
 * - Manages filter states (showOnlySelected, showOnlyFavorites)
 * - Coordinates prompt generation and updates
 * - Handles mode switching (Discord vs Website)
 */

export default class GalleryController {
  constructor(appController) {
    this.model = new ImageModel();
    this.model.currentModel = appController.currentModel;
    this.view = new GalleryView();
    this.view.currentModel = appController.currentModel;
    this.showOnlySelected = false;
    this.searchNumber = null; // Track current search number
    this.isRandomizing = false;
    this.randomizeTimeout = null;
    
    // Create favorites controller
    this.favoritesController = new FavoritesController(this.model, this.view);
    
    this.init();
  }

  async init() {
    try {
      console.log(`🎯 Gallery Controller init - Current model: ${this.model.currentModel}`);
      
      // Initialize favorites controller
      await this.favoritesController.init();
      this.favoritesController.setRenderGalleryCallback(() => this.renderGallery());
      // Load images with error boundary if available, otherwise direct call
      if (window.errorBoundary && window.errorBoundary.wrapAsyncWithRetry) {
        await window.errorBoundary.wrapAsyncWithRetry(
          () => this.model.loadImages(),
          3,
          'Gallery Image Loading'
        );
      } else {
        // Fallback to direct call if error boundary not available
        await this.model.loadImages();
      }

      // Build imagesById map (id = sref from filename)
      const imagesById = {};
      this.model.images.forEach(img => {
        // Use sref as the id for matching
        imagesById[img.sref] = img;
      });

      // Load Styles of the Month JSON
      let stylesOfTheMonth = [];
      try {
        const resp = await fetch('api/styles-of-the-month.json');
        if (resp.ok) {
          const allStyles = await resp.json();
          // Filter styles by current model
          stylesOfTheMonth = allStyles.filter(style => style.model === this.model.currentModel);
        }
      } catch (e) {
        console.warn('Could not load styles-of-the-month.json', e);
      }

      // Get current month in mm-yyyy
      const now = new Date();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      const currentMonth = `${mm}-${yyyy}`;

      // Render Styles of the Month section
      // this.view.renderStylesOfTheMonthSection(
      //   stylesOfTheMonth,
      //   imagesById,
      //   this.model.selectedImages,
      //   this.model.favoriteImages,
      //   this.model.currentModel,
      //   currentMonth
      // );
      
      // Render new styles section
      this.view.renderNewStylesSection(this.model.getNewImages(), this.model.selectedImages, this.model.favoriteImages, this.model.currentModel);
      
      // Render initial gallery
      this.renderGallery();
      
      // Bind event handlers
      this.bindEvents();
        

    
      // Initialize DOM with model values
      this.view.initDOMWithModel(this.model);
    
      // Sync model with current DOM values before updating prompt
      // Use the view's method to ensure proper syncing, especially after model switching
      this.view.syncModelWithDOM(this.model);
    
      // Update prompt initially
      this.updatePrompt();
    
      // Initialize mode toggle UI to reflect current state
      this.view.updateModeToggle(this.model.isDiscordMode, false);
    
      // Listen for storage errors
      document.addEventListener('storage-error', (event) => {
        if (event.detail && event.detail.message) {
          this.view.showErrorNotification(event.detail.message);
        }
      });
    } catch (error) {
      console.error('Failed to initialize gallery:', error);
      this.view.showErrorNotification('Failed to load images. Please try refreshing the page.');
    }
  }

  /**
   * Helper method to filter images based on multiple search terms
   * @param {Array} images - Array of images to filter
   * @param {string} searchInput - Search input string (can contain multiple terms separated by spaces)
   * @returns {Array} Filtered array of images that match any of the search terms
   */
  filterImagesBySearch(images, searchInput) {
    if (!searchInput || searchInput.trim() === '') {
      return images;
    }
    
    // Split search input by spaces and trim whitespace
    const searchTerms = searchInput.split(' ').map(term => term.trim()).filter(term => term.length > 0);
    
    // Filter images based on search - match ANY of the search terms
    return images.filter(img => {
      return searchTerms.some(term => img.sref.includes(term));
    });
  }

  /**
   * Renders the gallery with current filter states and handles edge cases
   * 
   * This method orchestrates the display of images based on current filter states
   * (favorites-only, selected-only) and implements intelligent fallback behavior
   * when filters result in empty results.
   * 
   * Filter Logic:
   * 1. Favorites filter: Shows only favorited images (handled by model)
   * 2. Selected filter: Shows only currently selected images (handled by controller)
   * 3. Combined filters: Applies both filters sequentially
   * 
   * Edge Case Handling:
   * - When both filters are active but yield no results, automatically disables
   *   both filters and shows a user-friendly notification
   * - Prevents users from getting stuck with an empty gallery
   * - Maintains UI state consistency across filter changes
   * 
   * Performance Considerations:
   * - Filters are applied in order (favorites first, then selected)
   * - Only re-renders when necessary
   * - Uses efficient data structures (Set, Map) for lookups
   */
  renderGallery() {
    console.debug('renderGallery: searchNumber is', this.searchNumber);
    // Ensure only one filter is active at a time
    if (this.model.showOnlyFavorites && this.showOnlySelected) {
      // If both filters are somehow active, prioritize the most recently activated one
      // This should not happen with our updated toggle handlers, but just in case
      console.warn("Both filters are active. This should not happen. Prioritizing favorites view.");
      this.showOnlySelected = false;
      this.view.updateShowSelectedToggle(false);
    }

    // Check if we need to show the no-favorites warning banner
    const validFavorites = this.model.images.filter(img => this.model.favoriteImages.has(img.id));
    
    // Show the warning banner only if we're in favorites view and there are no favorites
    if (validFavorites.length === 0 && this.model.showOnlyFavorites) {
      this.view.showFullWidthNoFavoritesWarning();
    } else {
      this.view.hideFullWidthNoFavoritesWarning();
    }
    
    // Handle favorites view
    if (this.model.showOnlyFavorites) {
      // If there are no favorites, show all images with the warning banner
      if (validFavorites.length === 0) {
        // Get all images (unfiltered)
        let visibleImages = this.model.images;
        
        // Apply search filter if active
        if (this.searchNumber !== null && this.searchNumber !== '') {
          visibleImages = this.filterImagesBySearch(visibleImages, this.searchNumber);
        }
        
        // Apply selected filter if active
        if (this.showOnlySelected) {
          visibleImages = visibleImages.filter(img => this.model.selectedImages.has(img.id));
        }
        
        this.view.renderGallery(
          visibleImages,
          this.model.selectedImages,
          this.model.favoriteImages,
          this.model.currentModel
        );
        
        // Update weight displays after rendering the gallery
        this.view.updateAllWeightDisplays(
          (imageId) => this.model.getWeight(imageId),
          (imageId) => this.model.getWeightColorIndex(imageId)
        );
        
        // Update image count in the header
        this.view.updateImageCountSubheader(
          visibleImages.length,
          this.model.selectedImages.size,
          this.model.currentModel
        );
        
        // Re-render the New Styles section to reflect current selection states
        this.view.renderNewStylesSection(
          this.model.getNewImages(), 
          this.model.selectedImages, 
          this.model.favoriteImages, 
          this.model.currentModel
        );
        
        return; // Stop current render
      } else {
        // If there are favorites, show them first, then a divider, then all non-favorites
        
        // Get all visible images based on current filters
        let allVisibleImages = this.model.images;
        
        // Apply search filter if active
        if (this.searchNumber !== null && this.searchNumber !== '') {
          allVisibleImages = this.filterImagesBySearch(allVisibleImages, this.searchNumber);
        }
        
        // Split into favorites and non-favorites
        const favoriteImages = allVisibleImages.filter(img => this.model.favoriteImages.has(img.id));
        const nonFavoriteImages = allVisibleImages.filter(img => !this.model.favoriteImages.has(img.id));
        
        // Render the favorite images first
        this.view.renderGallery(
          favoriteImages,
          this.model.selectedImages,
          this.model.favoriteImages,
          this.model.currentModel
        );
        
        // Show the divider
        this.view.showFilterDivider('favorites', favoriteImages.length);
        
        // Append the non-favorite images
        nonFavoriteImages.forEach(image => {
          const isSelected = this.model.selectedImages.has(image.id);
          const galleryItem = this.view.createGalleryItem(
            image,
            isSelected,
            false, // Not a favorite by definition
            isSelected ? this.model.selectedImages.get(image.id) : -1
          );
          this.view.gallery.appendChild(galleryItem);
        });
        
        // Update weight displays after rendering the gallery
        this.view.updateAllWeightDisplays(
          (imageId) => this.model.getWeight(imageId),
          (imageId) => this.model.getWeightColorIndex(imageId)
        );
        
        // Update image count in the header
        this.view.updateImageCountSubheader(
          allVisibleImages.length,
          this.model.selectedImages.size,
          this.model.currentModel
        );
        
        // Re-render the New Styles section to reflect current selection states
        this.view.renderNewStylesSection(
          this.model.getNewImages(), 
          this.model.selectedImages, 
          this.model.favoriteImages, 
          this.model.currentModel
        );
        
        return; // Stop current render
      }
    } else {
      // Hide the favorites filter divider if not in favorites view
      this.view.hideFilterDivider('favorites');
    }

    let visibleImages = this.model.getVisibleImages();
    
    // Apply search filter if active
    if (this.searchNumber !== null && this.searchNumber !== '') {
        visibleImages = this.filterImagesBySearch(visibleImages, this.searchNumber);
      
      // If search returns no results, show a notification but keep the filter active
      if (visibleImages.length === 0) {
        const searchTerms = this.searchNumber.split(' ').map(term => term.trim()).filter(term => term.length > 0);
        const searchDisplay = searchTerms.length > 1 ? `"${searchTerms.join('", "')}"` : `"${this.searchNumber}"`;
        this.view.showErrorNotification(`No images found matching ${searchDisplay}`);
        this.view.clearGallery(); // <-- Fix: always clear gallery on no results
        // Return early to prevent further filtering
        return;
      }
      
      // If we have search results and not in another special view (favorites or selected),
      // show the search results with a divider
      if (!this.model.showOnlyFavorites && !this.showOnlySelected) {
        // Create a copy of all visible images before filtering
        const allVisibleImages = this.model.getVisibleImages();
        
        // Get images that match the search
        const searchMatchImages = visibleImages;
        
        // Get images that don't match the search
        const nonMatchImages = allVisibleImages.filter(img => 
          !searchMatchImages.some(matchImg => matchImg.id === img.id)
        );
        
        if (searchMatchImages.length > 0 && nonMatchImages.length > 0) {
          // Render the search match images first
          this.view.renderGallery(
            searchMatchImages,
            this.model.selectedImages,
            this.model.favoriteImages,
            this.model.currentModel
          );
          
          // Show the divider
          this.view.showFilterDivider('search', searchMatchImages.length);
          
          // Append the non-matching images
          nonMatchImages.forEach(image => {
            const isSelected = this.model.selectedImages.has(image.id);
            const galleryItem = this.view.createGalleryItem(
              image,
              isSelected,
              this.model.favoriteImages.has(image.id),
              isSelected ? this.model.selectedImages.get(image.id) : -1
            );
            this.view.gallery.appendChild(galleryItem);
          });
          
          // Update weight displays after rendering the gallery
          this.view.updateAllWeightDisplays(
            (imageId) => this.model.getWeight(imageId),
            (imageId) => this.model.getWeightColorIndex(imageId)
          );
          
          // Update image count in the header
          this.view.updateImageCountSubheader(
            allVisibleImages.length,
            this.model.selectedImages.size,
            this.model.currentModel
          );
          
          // Re-render the New Styles section to reflect current selection states
          this.view.renderNewStylesSection(
            this.model.getNewImages(), 
            this.model.selectedImages, 
            this.model.favoriteImages, 
            this.model.currentModel
          );
          
          return; // Stop current render
        }
      }
    } else {
      // Hide the search filter divider if search is not active
      this.view.hideFilterDivider('search');
    }
    
    // Check if we need to show the no-selected warning banner
    const hasSelectedImages = this.model.selectedImages.size > 0;
    
    // Show the warning banner only if we're in selected view and there are no selected images
    if (!hasSelectedImages && this.showOnlySelected) {
      this.view.showFullWidthNoSelectedWarning();
    } else {
      this.view.hideFullWidthNoSelectedWarning();
    }
    
    // Handle selected view with divider
    if (this.showOnlySelected) {
      // Get selected images
      const selectedImages = visibleImages.filter(img => this.model.selectedImages.has(img.id));
      
      // Get unselected images
      const unselectedImages = visibleImages.filter(img => !this.model.selectedImages.has(img.id));
      
      // If there are selected images, show them first, then a divider, then all unselected images
      if (selectedImages.length > 0) {
        // Render the selected images first
        this.view.renderGallery(selectedImages, this.model.selectedImages, this.model.favoriteImages, this.model.currentModel);
        
        // Show the divider
        this.view.showFilterDivider('selected', selectedImages.length);
        
        // Append the unselected images
        unselectedImages.forEach(image => {
          const isSelected = false; // These are unselected by definition
          const galleryItem = this.view.createGalleryItem(
            image,
            isSelected,
            this.model.favoriteImages.has(image.id),
            -1 // No color index for unselected images
          );
          this.view.gallery.appendChild(galleryItem);
        });
        
        // Update weight displays after rendering the gallery
        this.view.updateAllWeightDisplays(
          (imageId) => this.model.getWeight(imageId),
          (imageId) => this.model.getWeightColorIndex(imageId)
        );
        
        // Re-render the New Styles section to reflect current selection states
        this.view.renderNewStylesSection(
          this.model.getNewImages(), 
          this.model.selectedImages, 
          this.model.favoriteImages, 
          this.model.currentModel
        );
        
        // Return early since we've manually rendered everything
        return;
      } else {
        // If no images are selected, just show all images with the warning banner
        visibleImages = this.model.getVisibleImages();
      }
    } else {
      // Hide the selected filter divider if not in selected view
      this.view.hideFilterDivider('selected');
    }
    
    this.view.renderGallery(
      visibleImages,
      this.model.selectedImages,
      this.model.favoriteImages,
      this.model.currentModel
    );
    
    // Update weight displays after rendering the gallery
    this.view.updateAllWeightDisplays(
      (imageId) => this.model.getWeight(imageId),
      (imageId) => this.model.getWeightColorIndex(imageId)
    );
    
    // Update image count in the header
    this.view.updateImageCountSubheader(
      visibleImages.length,
      this.model.selectedImages.size,
      this.model.currentModel
    );

    // Re-render the New Styles section to reflect current selection states
    this.view.renderNewStylesSection(
      this.model.getNewImages(), 
      this.model.selectedImages, 
      this.model.favoriteImages, 
      this.model.currentModel
    );
  }

  bindEvents() {
    // Image selection
    this.view.bindImageClick(imageId => {
      this.model.toggleImageSelection(imageId);
      
      // If we're in selected-only mode and unselected an image, check if any selections remain
      if (this.showOnlySelected) {
        // If no selections remain, automatically toggle off selected view
        if (this.model.selectedImages.size === 0) {
          this.showOnlySelected = false;
          this.view.updateShowSelectedToggle(false);
        }
      }
      
      this.renderGallery();
      this.updatePrompt();
      
      // Initialize weight displays after selection changes
      this.view.updateAllWeightDisplays(
        (imageId) => this.model.getWeight(imageId),
        (imageId) => this.model.getWeightColorIndex(imageId)
      );
    });
    
    // Handle image selection from New Styles gallery
    document.addEventListener('imageSelection', (event) => {
      const { imageId, source } = event.detail;
      
      // Use the same selection logic as the main gallery
      this.model.toggleImageSelection(imageId);
      
      // If we're in selected-only mode and unselected an image, check if any selections remain
      if (this.showOnlySelected) {
        // If no selections remain, automatically toggle off selected view
        if (this.model.selectedImages.size === 0) {
          this.showOnlySelected = false;
          this.view.updateShowSelectedToggle(false);
        }
      }
      
      this.renderGallery();
      this.updatePrompt();
      
      // Initialize weight displays after selection changes
      this.view.updateAllWeightDisplays(
        (imageId) => this.model.getWeight(imageId),
        (imageId) => this.model.getWeightColorIndex(imageId)
      );
    });
    
    // Handle weight control clicks from New Styles gallery
    document.addEventListener('weightControl', (event) => {
      const { imageId, action, source } = event.detail;
      
      let newWeight;
      
      if (action === 'increase') {
        newWeight = this.model.increaseWeight(imageId);
        console.log(`Increased weight to ${newWeight}`);
      } else if (action === 'decrease') {
        newWeight = this.model.decreaseWeight(imageId);
        console.log(`Decreased weight to ${newWeight}`);
      }
      
      // Update the prompt with the new weight
      this.updatePrompt();
      
      // Update all weight displays to reflect the change
      this.view.updateAllWeightDisplays(
        (imageId) => this.model.getWeight(imageId),
        (imageId) => this.model.getWeightColorIndex(imageId)
      );
    });
    

    
    // Prompt input
    this.view.bindPromptInput(prompt => {
      this.model.setBasePrompt(prompt);
      this.updatePrompt();
    });
    
    // Suffix input
    this.view.bindSuffixInput((newValue) => {
      this.model.setSuffix(newValue.trim());
      this.updatePrompt();
    });

    // Aspect ratio dropdown
    this.view.bindAspectRatioDropdown((newValue) => {
      this.model.setAspectRatio(newValue);
      this.updatePrompt();
    });
    
    // Copy button
    this.view.bindCopyButton(() => {
      const promptText = this.model.generateFinalPrompt();
      navigator.clipboard.writeText(promptText)
        .then(() => {
          this.view.showCopyFeedback();
          this.view.showInfoNotification('Prompt copied to clipboard.');
        })
        .catch(err => {
          console.error('Could not copy text: ', err);
          this.view.showErrorNotification('Failed to copy to clipboard. Please try again or copy manually.');
        });
    });
    
    // Favorites toggle - use the view's method with our handler
    this.view.bindFavoritesToggle(() => {
      // If selected view is active, turn it off
      if (this.showOnlySelected && !this.model.showOnlyFavorites) {
        this.showOnlySelected = false;
        this.view.updateShowSelectedToggle(false);
      }
      
      // If search is active, turn it off
      if (this.searchNumber !== null && this.searchNumber !== '') {
        this.clearSearchState();
      }
      
      // Toggle the state
      this.model.toggleFavoritesOnly();
      
      // Update the UI
      this.view.updateFavoritesToggle(this.model.showOnlyFavorites);
      
      // Scroll to top when activating favorites view
      if (this.model.showOnlyFavorites) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      
      // Render the gallery (our renderGallery method now handles the no-favorites case)
      this.renderGallery();
      
      // Close collapsible sections after rendering to prevent them from being reopened
      this.view.closeAllCollapsibleSections();
      
      return true; // Allow animation
    });
    
    // Refresh button
    this.view.bindRefreshButton(() => {
      this.model.shuffleImages();
      this.renderGallery();
    });

    // Randomize button
    this.view.bindRandomizeButton(() => {
      // Get all unselected images
      const unselectedImages = this.model.images.filter(img => !this.model.selectedImages.has(img.id));
      
      if (unselectedImages.length === 0) {
        this.view.showInfoNotification('All images are already selected.');
        return;
      }
      
      // Randomly select one unselected image
      const randomIndex = Math.floor(Math.random() * unselectedImages.length);
      const randomImage = unselectedImages[randomIndex];
      
      // Add the randomly selected image to selections
      this.model.toggleImageSelection(randomImage.id);
      
      // Extract just the numeric sref code for the notification
      const srefCode = randomImage.sref;
      
      // Show notification with clean sref code
      this.view.showInfoNotification(`Randomly selected: ${srefCode}`);
      
      // Re-render gallery and update prompt
      this.renderGallery();
      this.updatePrompt();
    });
    
    // Clear button
    this.view.bindClearButton(() => {
      // Clear all selections
      this.model.selectedImages.clear();
      
      // Show notification
      this.view.showInfoNotification('All selections cleared.');
      
      // If we're in selected-only view, automatically toggle it off
      if (this.showOnlySelected) {
        this.showOnlySelected = false;
        this.view.updateShowSelectedToggle(false);
      }
      
      this.renderGallery();
      this.updatePrompt();
    });
    
    // Show selected toggle
    this.view.bindShowSelectedToggle(() => {
      // If favorites view is active, turn it off
      if (this.model.showOnlyFavorites && !this.showOnlySelected) {
        this.model.showOnlyFavorites = false;
          this.view.updateFavoritesToggle(false);
      }
      
      // If search is active, turn it off
      if (this.searchNumber !== null && this.searchNumber !== '') {
        this.clearSearchState();
      }
      
      // Toggle the state
      this.showOnlySelected = !this.showOnlySelected;
      
      // Update the UI
      this.view.updateShowSelectedToggle(this.showOnlySelected);
      
      // Scroll to top when activating selected view
      if (this.showOnlySelected) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      
      // If toggling on and no images are selected, don't revert but show the warning banner
      if (this.showOnlySelected && this.model.selectedImages.size === 0) {
        this.view.showFullWidthNoSelectedWarning();
      } else {
        this.view.hideFullWidthNoSelectedWarning();
      }
      
      this.renderGallery();
      
      // Close collapsible sections after rendering to prevent them from being reopened
      this.view.closeAllCollapsibleSections();
    });
    
    // Mode toggle (Discord/Website)
    this.view.bindModeToggle(() => {
      this.model.toggleDiscordMode();
      this.view.updateModeToggle(this.model.isDiscordMode);
      this.updatePrompt();
    });
    
    // Search functionality
    this.view.bindSearchButton(() => {
      this.toggleSearch();
    });
    
    this.view.bindSearchInput((searchInput) => {
      this.performSearch(searchInput);
    });
    
    // Weight controls
    this.view.bindWeightControls(
      (imageId) => {
        const weight = this.model.increaseWeight(imageId);
        this.updatePrompt();
        return weight;
      },
      (imageId) => {
        const weight = this.model.decreaseWeight(imageId);
        this.updatePrompt();
        return weight;
      },
      (imageId) => this.model.getWeight(imageId),
      (imageId) => this.model.getWeightColorIndex(imageId)
    );

    // Keyboard shortcuts are now handled by the centralized KeyboardShortcutManager
  }



  // Keyboard shortcuts are now handled by the centralized KeyboardShortcutManager

  updatePrompt() {
    const finalPrompt = this.model.generateFinalPrompt();
    
    // Always show the prompt preview - generateFinalPrompt handles showing model tag and prefix
    this.view.updateFinalPrompt(finalPrompt);
  }
  
  /**
   * Clears the search state and updates UI accordingly
   */
  clearSearchState() {
    console.debug('clearSearchState called');
    this.searchNumber = null;
    console.debug('searchNumber:', this.searchNumber);
    const searchContainer = document.querySelector('.search-container');
    const searchButton = document.getElementById('search-button');
    const stickySearchButton = document.getElementById('sticky-search-button');
    const searchInput = document.getElementById('search-input');
    
    if (searchContainer) searchContainer.classList.add('hidden');
    if (searchButton) searchButton.classList.remove('active');
    if (stickySearchButton) stickySearchButton.classList.remove('active');
    if (searchInput) {
      searchInput.value = '';
      searchInput.classList.remove('search-active');
    }
    
    // Update search button icons to show inactive state
    this.view.updateSearchButtonIcons(false);
    
    this.view.hideFilterDivider('search');
    
    console.debug('renderGallery called from clearSearchState');
    this.renderGallery();
  }

  /**
   * Toggles the search functionality on/off
   * Shows/hides the search input and updates button state
   */
  toggleSearch() {
    console.debug('toggleSearch called');
    const searchContainer = document.querySelector('.search-container');
    const searchButton = document.getElementById('search-button');
    const stickySearchButton = document.getElementById('sticky-search-button');
    const searchInput = document.getElementById('search-input');

    const isNowHidden = searchContainer.classList.toggle('hidden');
    console.debug('Search button clicked. Search is now', isNowHidden ? 'inactive (hidden)' : 'active (visible)');
    console.debug('Current searchNumber:', this.searchNumber);

    // If search is being deactivated (now hidden), clear search state
    if (isNowHidden) {
      this.clearSearchState();
      return; // Prevent further UI updates since clearSearchState handles them
    }

    // Sync active state on both buttons
    searchButton.classList.toggle('active', !isNowHidden);
    if (stickySearchButton) {
      stickySearchButton.classList.toggle('active', !isNowHidden);
    }

    // Update search button icons based on active state
    this.view.updateSearchButtonIcons(!isNowHidden);

    // If search is now visible, focus the input
    if (!isNowHidden && searchInput) {
      searchInput.focus();
    } else if (isNowHidden && searchInput) {
      // Remove search-active class when search is hidden
      searchInput.classList.remove('search-active');
    }

    // Turn off other exclusive views when activating search
    if (!isNowHidden) {
      if (this.model.showOnlyFavorites) {
        this.model.showOnlyFavorites = false;
        this.view.updateFavoritesToggle(false);
      }
      if (this.showOnlySelected) {
        this.showOnlySelected = false;
        this.view.updateShowSelectedToggle(false);
      }
    }
  }
  
  /**
   * Performs a search by image number(s)
   * @param {string|null} searchInput - The search terms to search for, or null to clear search
   * Supports multiple IDs separated by spaces (e.g., "1 2 7" will find images matching any of these)
   */
  performSearch(searchInput) {
    // Check if --sref is present in the search input
    const srefMatch = searchInput.match(/--sref\s+([^-]+?)(?=\s*--|$)/gi);
    let filteredInput;
    
    if (srefMatch) {
      // If --sref is present, extract only the numbers after it
      const srefNumbers = srefMatch[0].replace(/--sref\s+/gi, '').trim();
      // Remove weight syntax (:: followed by numbers) from the style reference numbers
      filteredInput = srefNumbers.replace(/::\d+(?:\.\d+)?/g, '').trim();
    } else {
      // Otherwise, use the existing filtering logic
      filteredInput = searchInput
        .replace(/--niji\s*6/gi, '') // Remove --niji 6 (case-insensitive, optional space)
        .replace(/--v\s*7/gi, '')    // Remove --v 7 (case-insensitive, optional space)
        .replace(/--ar\s*-?\d+(?::\d+)?/gi, '') // Remove --ar ratios like --ar 16:9 or --ar -1:2
        .replace(/--(s|iw|cw|sw|weird|chaos)\s*-?\d+(?:\.\d+)?/gi, '') // Remove --s, --iw, --cw, --sw, --weird, --chaos followed by numbers (including negative and decimals)
        .replace(/::\d+(?:\.\d+)?/g, '') // Remove :: followed by numbers (including decimals)
        .replace(/[^0-9\s]/g, '') // Remove any other non-numeric characters except spaces
        .replace(/\s+/g, ' ') // Normalize multiple spaces to single spaces
        .trim(); // Remove leading/trailing whitespace
    }
    
    // Set the search input (use filtered version)
    this.searchNumber = filteredInput;
    
    // If the search is empty, clear it
    if (!filteredInput || filteredInput.trim() === '') {
      // Show error notification if the original input was not empty (user entered only text)
      if (searchInput && searchInput.trim() !== '') {
        this.view.showErrorNotification('Please enter one or more style reference numbers.');
        // Clear the search input and keep the box open and focused
        const searchInputBox = document.getElementById('search-input');
        if (searchInputBox) {
          searchInputBox.value = '';
          searchInputBox.focus();
        }
        // Do not close the search box
        return;
      }
      this.clearSearchState();
      this.renderGallery();
      return;
    }
    
    // Turn off other exclusive views when performing a search
    if (this.model.showOnlyFavorites) {
      this.model.showOnlyFavorites = false;
      this.view.updateFavoritesToggle(false);
    }
    if (this.showOnlySelected) {
      this.showOnlySelected = false;
      this.view.updateShowSelectedToggle(false);
    }
    
    // Get all images
    const allImages = this.model.images;
    
    // Split search input by spaces and trim whitespace
    const searchTerms = filteredInput.split(' ').map(term => term.trim()).filter(term => term.length > 0);
    
    // Filter images based on search - match ANY of the search terms
    const matchingImages = allImages.filter(img => {
      return searchTerms.some(term => img.sref.includes(term));
    });
    
    // If no matches, show notification but keep the search active
    if (matchingImages.length === 0) {
      const searchDisplay = searchTerms.length > 1 ? `"${searchTerms.join('", "')}"` : `"${filteredInput}"`;
      this.view.showErrorNotification(`No images found matching ${searchDisplay}`);
      this.view.hideFilterDivider('search');
      this.view.clearGallery(); // <-- Fix: always clear gallery on no results
      // Add search-active class even when no matches found
      const searchInputElement = document.getElementById('search-input');
      if (searchInputElement) {
        searchInputElement.classList.add('search-active');
      }
      return;
    }
    
    // Clear the gallery
    this.view.clearGallery();
    
    // Render the matching images first
    matchingImages.forEach(image => {
      const isSelected = this.model.selectedImages.has(image.id);
      const isFavorite = this.model.favoriteImages.has(image.id);
      const galleryItem = this.view.createGalleryItem(
        image,
        isSelected,
        isFavorite,
        isSelected ? this.model.selectedImages.get(image.id) : -1
      );
      this.view.gallery.appendChild(galleryItem);
    });
    
    // Show the divider
    this.view.showFilterDivider('search', matchingImages.length);
    
    // Get non-matching images
    const nonMatchingImages = allImages.filter(img => 
      !matchingImages.some(match => match.id === img.id)
    );
    
    // Append the non-matching images
    nonMatchingImages.forEach(image => {
      const isSelected = this.model.selectedImages.has(image.id);
      const isFavorite = this.model.favoriteImages.has(image.id);
      const galleryItem = this.view.createGalleryItem(
        image,
        isSelected,
        isFavorite,
        isSelected ? this.model.selectedImages.get(image.id) : -1
      );
      this.view.gallery.appendChild(galleryItem);
    });
    
    // Update weight displays
    this.view.updateAllWeightDisplays(
      (imageId) => this.model.getWeight(imageId),
      (imageId) => this.model.getWeightColorIndex(imageId)
    );
    
    // Update image count in the header
    this.view.updateImageCountSubheader(
      allImages.length,
      this.model.selectedImages.size,
      this.model.currentModel
    );
    
    // Update search button state to indicate search is active
    const searchButton = document.getElementById('search-button');
    const stickySearchButton = document.getElementById('sticky-search-button');
    if (searchButton) searchButton.classList.add('active');
    if (stickySearchButton) stickySearchButton.classList.add('active');
    
    // Update search button icons to show active state
    this.view.updateSearchButtonIcons(true);
    
    // Add search-active class to search input for neon-teal border
    const searchInputElement = document.getElementById('search-input');
    if (searchInputElement) {
      searchInputElement.classList.add('search-active');
    }
    
    // Show notification about search results
    const searchDisplay = searchTerms.length > 1 ? `"${searchTerms.join('", "')}"` : `"${filteredInput}"`;
    this.view.showInfoNotification(`Found ${matchingImages.length} image(s) matching ${searchDisplay}`);
  }



  /**
   * Selects a random unselected image and adds it to the selection
   * Debounced/throttled and guarded to prevent double selection
   */
  randomizeSelection() {
    if (this.isRandomizing) return;
    this.isRandomizing = true;
    clearTimeout(this.randomizeTimeout);
    this.randomizeTimeout = setTimeout(() => {
      this.isRandomizing = false;
    }, 400); // 400ms throttle

    // Get all images that are not currently selected
    const unselectedImages = this.model.images.filter(img => !this.model.selectedImages.has(img.id));
    if (unselectedImages.length === 0) {
      this.view.showWarningNotification('All images are already selected!');
      return;
    }
    // Pick a random image
    const randomIndex = Math.floor(Math.random() * unselectedImages.length);
    const randomImage = unselectedImages[randomIndex];
    // Add to selection
    this.model.selectedImages.set(randomImage.id, 0); // 0 = default color index/weight
    this.renderGallery();
    this.updatePrompt();
    this.view.showInfoNotification('Random image selected!');
  }
} 