import ImageModel from '../models/imageModel.js';
import GalleryView from '../views/galleryView.js';

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
    
    this.init();
  }

  async init() {
    try {
    // Load model-specific favorites
    this.model.loadFromStorage();
    
    // Load images
    await this.model.loadImages();
    
    // Render initial gallery
    this.renderGallery();
    
    // Bind event handlers
    this.bindEvents();
      
      // Add direct document-level handler for favorite button clicks
      this.addDirectFavoriteHandler();
    
    // Update prompt initially
    this.updatePrompt();
    
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
    
    // Favorite toggling
    this.view.bindFavoriteClick(imageId => {
      const isFavorite = this.model.toggleImageFavorite(imageId);
      
      // Update all favorite buttons with the same ID
      document.querySelectorAll(`.favorite-button[data-id="${imageId}"]`).forEach(button => {
        button.innerHTML = isFavorite 
          ? '<i class="fas fa-star"></i>' 
          : '<i class="far fa-star"></i>';
        button.title = isFavorite ? 'Remove from favorites' : 'Add to favorites';
      });
      
      // If we're in favorites-only mode and unfavorited an image, re-render the gallery
      if (this.model.showOnlyFavorites) {
        this.renderGallery();
      }
      
      return isFavorite; // Return the new favorite state
    });
    
    // Prompt input
    this.view.bindPromptInput(prompt => {
      this.model.setBasePrompt(prompt);
      this.updatePrompt();
    });
    
    // Copy button
    this.view.bindCopyButton(() => {
      const promptText = this.model.generateFinalPrompt();
      navigator.clipboard.writeText(promptText)
        .then(() => {
          this.view.showCopyFeedback();
        })
        .catch(err => {
          console.error('Could not copy text: ', err);
          this.view.showErrorNotification('Failed to copy to clipboard. Please try again or copy manually.');
        });
    });
    
    // Favorites toggle - use our updated method
    this.bindFavoritesToggle();
    
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
    
    // Export favorites
    this.view.bindExportFavoritesButton(() => {
      this.exportFavorites();
    });
    
    // Import favorites
    this.view.bindImportFavoritesButton((file) => {
      this.importFavorites(file);
    });

    // Keyboard shortcuts
    this.bindKeyboardShortcuts();
  }

  bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Only trigger shortcuts if not typing in an input field or contentEditable element
      if (e.target.tagName === 'INPUT' || 
          e.target.tagName === 'TEXTAREA' || 
          e.target.contentEditable === 'true' ||
          e.target.isContentEditable) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'c':
          // Copy current prompt to clipboard
          const finalPrompt = this.model.generateFinalPrompt();
          navigator.clipboard.writeText(finalPrompt)
            .then(() => {
              this.view.showInfoNotification('Prompt copied to clipboard.');
            })
            .catch(err => {
              console.error('Failed to copy text: ', err);
              this.view.showInfoNotification('Failed to copy to clipboard.');
            });
          break;
          
        case 'r':
          // Refresh all images
          this.model.shuffleImages();
          this.view.refreshImageQuadrants();
          this.renderGallery();
          break;
          
        case 'd':
          // Deselect all images
          console.log('D key pressed for deselect');
          console.log('Selected images size:', this.model.selectedImages.size);
          
          if (this.model.selectedImages.size === 0) {
            console.log('No images selected, showing warning');
            this.view.showNoSelectedWarning();
            return;
          }
          console.log('Clearing selections');
          this.model.selectedImages.clear();
          this.view.showInfoNotification('All selections cleared.');
          this.renderGallery();
          this.updatePrompt();
          break;
          
        case 'f':
          // Toggle favorites view - call the same handler as the button
          const favoritesHandler = () => {
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
            
            return true; // Allow animation
          };
          
          // Call the handler and trigger button animation if allowed
          const shouldAnimateFavorites = favoritesHandler();
          if (shouldAnimateFavorites) {
            // Trigger the button animation manually
            const favoritesBtn = document.getElementById('favorites-toggle');
            if (favoritesBtn) {
              favoritesBtn.classList.add('bounce');
              setTimeout(() => {
                favoritesBtn.classList.remove('bounce');
              }, 600);
            }
          }
          break;
          
        case 'v':
          // Toggle selected view - call the same handler as the button
          const selectedHandler = () => {
            // If favorites view is active, turn it off
            if (this.model.showOnlyFavorites && !this.showOnlySelected) {
              this.model.showOnlyFavorites = false;
              this.view.updateFavoritesToggle(false);
            }
            
            // If search is active, turn it off
            if (this.searchNumber !== null && this.searchNumber !== '') {
              this.clearSearchState();
            }
            
            this.showOnlySelected = !this.showOnlySelected;
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
            this.model.saveToStorage();
            return true; // Allow animation
          };
          
          // Call the handler and trigger button animation if allowed
          const shouldAnimateSelected = selectedHandler();
          if (shouldAnimateSelected) {
            // Trigger the button animation manually
            const selectedBtn = document.getElementById('show-selected-btn');
            if (selectedBtn) {
              selectedBtn.classList.toggle('active');
            }
          }
          break;
          
        case 's':
          // Toggle search - call the same handler as the button
          this.toggleSearch();
          break;
          
        case 'a':
          // Randomize selection - call the same handler as the button
          this.randomizeSelection();
          break;
      }
    });
  }

  updatePrompt() {
    const finalPrompt = this.model.generateFinalPrompt();
    this.view.updateFinalPrompt(finalPrompt);
  }
  
  /**
   * Clears the search state and updates UI accordingly
   */
  clearSearchState() {
    this.searchNumber = null;
    const searchContainer = document.querySelector('.search-container');
    const searchButton = document.getElementById('search-button');
    const stickySearchButton = document.getElementById('sticky-search-button');
    const searchInput = document.getElementById('search-input');
    
    if (searchContainer) searchContainer.classList.add('hidden');
    if (searchButton) searchButton.classList.remove('active');
    if (stickySearchButton) stickySearchButton.classList.remove('active');
    if (searchInput) searchInput.value = '';
    this.view.hideFilterDivider('search');
  }

  /**
   * Toggles the search functionality on/off
   * Shows/hides the search input and updates button state
   */
  toggleSearch() {
    const searchContainer = document.querySelector('.search-container');
    const searchButton = document.getElementById('search-button');
    const stickySearchButton = document.getElementById('sticky-search-button');
    const searchInput = document.getElementById('search-input');

    const isNowHidden = searchContainer.classList.toggle('hidden');

    // Sync active state on both buttons
    searchButton.classList.toggle('active', !isNowHidden);
    if (stickySearchButton) {
      stickySearchButton.classList.toggle('active', !isNowHidden);
    }

    if (isNowHidden) {
      // If we're closing the search, clear the search and re-render
      this.clearSearchState();
      
      this.view.showInfoNotification('Search cleared');
    } else {
      // If we're opening the search, turn off other exclusive views
      if (this.model.showOnlyFavorites) {
        this.model.showOnlyFavorites = false;
        this.view.updateFavoritesToggle(false);
      }
      if (this.showOnlySelected) {
        this.showOnlySelected = false;
        this.view.updateShowSelectedToggle(false);
      }
      
      // If we're opening the search, scroll to the top and focus the input
      window.scrollTo({ top: 0, behavior: 'smooth' });
      searchInput.focus();
      
      // If there's an existing search, populate the input
      if (this.searchNumber !== null && this.searchNumber !== '') {
        searchInput.value = this.searchNumber;
      }
    }
  }
  
  /**
   * Performs a search by image number(s)
   * @param {string|null} searchInput - The search terms to search for, or null to clear search
   * Supports multiple IDs separated by spaces (e.g., "1 2 7" will find images matching any of these)
   */
  performSearch(searchInput) {
    // Set the search input
    this.searchNumber = searchInput;
    
    // If the search is empty, clear it
    if (!searchInput || searchInput.trim() === '') {
      this.clearSearchState();
      this.renderGallery();
      
      // Update search button state
      const searchButton = document.getElementById('search-button');
      const stickySearchButton = document.getElementById('sticky-search-button');
      if (searchButton) searchButton.classList.remove('active');
      if (stickySearchButton) stickySearchButton.classList.remove('active');
      
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
    const searchTerms = searchInput.split(' ').map(term => term.trim()).filter(term => term.length > 0);
    
    // Filter images based on search - match ANY of the search terms
    const matchingImages = allImages.filter(img => {
      return searchTerms.some(term => img.sref.includes(term));
    });
    
    // If no matches, show notification but keep the search active
    if (matchingImages.length === 0) {
      const searchDisplay = searchTerms.length > 1 ? `"${searchTerms.join('", "')}"` : `"${searchInput}"`;
      this.view.showErrorNotification(`No images found matching ${searchDisplay}`);
      this.view.hideFilterDivider('search');
      this.renderGallery();
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
    
    // Show notification about search results
    const searchDisplay = searchTerms.length > 1 ? `"${searchTerms.join('", "')}"` : `"${searchInput}"`;
    this.view.showInfoNotification(`Found ${matchingImages.length} image(s) matching ${searchDisplay}`);
  }

  /**
   * Exports favorites to a JSON file for download
   */
  exportFavorites() {
    try {
      this.model.exportFavorites();
    } catch (error) {
      console.error('Export failed:', error);
      this.view.showErrorNotification('Failed to export favorites.');
    }
  }

  /**
   * Imports favorites from a JSON file
   * @param {File} file - The JSON file to import
   */
  importFavorites(file) {
    if (!file) {
      this.view.showErrorNotification('No file selected for import.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const fileContent = event.target.result;
        const success = this.model.importFavorites(fileContent);
        
        if (success) {
          this.view.showInfoNotification('Favorites imported successfully!');
          this.renderGallery(); // Re-render to show newly imported favorites
        }
        // Error case is handled by the event listener in init()
      } catch (e) {
        this.view.showErrorNotification(e.message || 'An unexpected error occurred while importing favorites.');
      }
    };
    
    reader.onerror = () => {
      this.view.showErrorNotification('Failed to read the selected file.');
    };
    
    reader.readAsText(file);
  }

  bindFavoritesToggle() {
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
    });
  }

  // Add a direct document-level handler for favorite button clicks
  addDirectFavoriteHandler() {
    document.addEventListener('click', (event) => {
      // Check if the click was directly on a favorite button or its icon
      const favoriteButton = event.target.closest('.favorite-button');
      if (favoriteButton) {
        // Get the image ID from the button's data attribute
        const imageId = favoriteButton.dataset.id;
        
        if (imageId) {
          console.log('Direct document handler: favorite button clicked for image', imageId);
          event.stopPropagation();
          
          // Toggle the favorite state
          const isFavorite = this.model.toggleImageFavorite(imageId);
          
          // Update all buttons with this ID
          document.querySelectorAll(`.favorite-button[data-id="${imageId}"]`).forEach(button => {
            button.innerHTML = isFavorite 
              ? '<i class="fas fa-star"></i>' 
              : '<i class="far fa-star"></i>';
            button.title = isFavorite ? 'Remove from favorites' : 'Add to favorites';
          });
            
          // If we're in favorites-only mode, re-render the gallery
          if (this.model.showOnlyFavorites) {
            this.renderGallery();
          }
        }
      }
    });
  }

  /**
   * Randomly selects an unselected image
   * This method is called by the keyboard shortcut 'L'
   */
  randomizeSelection() {
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
  }
} 