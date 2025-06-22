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
  constructor() {
    this.model = new ImageModel();
    this.view = new GalleryView();
    this.showOnlySelected = false;
    this.searchNumber = null; // Track current search number
    
    this.init();
  }

  async init() {
    // Load images
    await this.model.loadImages();
    
    // Render initial gallery
    this.renderGallery();
    
    // Bind event handlers
    this.bindEvents();
    
    // Update prompt initially
    this.updatePrompt();
    
    // Listen for storage errors
    document.addEventListener('storage-error', (event) => {
      if (event.detail && event.detail.message) {
        this.view.showErrorNotification(event.detail.message);
      }
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
    // Corner case: both filters are on, but result is empty
    if (this.model.showOnlyFavorites && this.showOnlySelected) {
      const favoritedImages = this.model.getVisibleImages();
      const visibleImages = favoritedImages.filter(img => this.model.selectedImages.has(img.id));

      if (visibleImages.length === 0) {
        this.view.showErrorNotification("No images match both 'favorites' and 'selected' filters. Both views have been disabled.");
        
        // Disable both filters
        this.model.toggleFavoritesOnly(); // it will be true, so this toggles to false
        this.showOnlySelected = false;

        // Update UI
        this.view.updateFavoritesToggle(false);
        this.view.updateShowSelectedToggle(false);

        // Re-render with filters off
        this.renderGallery();
        return; // Stop current render
      }
    }

    let visibleImages = this.model.getVisibleImages();
    
    // Apply search filter if active
    if (this.searchNumber !== null && this.searchNumber !== '') {
      visibleImages = visibleImages.filter(img => {
        return img.sref.includes(this.searchNumber);
      });
      
      // If search returns no results, show a notification but keep the filter active
      if (visibleImages.length === 0) {
        this.view.showErrorNotification(`No images found matching "${this.searchNumber}"`);
        // Return early to prevent further filtering
        return;
      }
    }
    
    // Apply selected filter if active
    if (this.showOnlySelected) {
      visibleImages = visibleImages.filter(img => this.model.selectedImages.has(img.id));
    }
    
    this.view.renderGallery(
      visibleImages,
      this.model.selectedImages,
      this.model.favoriteImages
    );
    
    // Update weight displays after rendering the gallery
    this.view.updateAllWeightDisplays(
      (imageId) => this.model.getWeight(imageId),
      (imageId) => this.model.getWeightColorIndex(imageId)
    );
    
    // Update image count in the header
    this.view.updateImageCountSubheader(
      visibleImages.length,
      this.model.selectedImages.size
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
      
      // Update the favorite button UI without re-rendering the whole gallery
      const favoriteButton = document.querySelector(`.favorite-button[data-id="${imageId}"]`);
      if (favoriteButton) {
        favoriteButton.innerHTML = isFavorite 
          ? '<i class="fas fa-star"></i>' 
          : '<i class="far fa-star"></i>';
      }
      
      // If we're in favorites-only mode and unfavorited an image, check if any favorites remain
      if (this.model.showOnlyFavorites && !isFavorite) {
        // Get the actual favorited images that exist in the current gallery
        const validFavorites = this.model.images.filter(img => this.model.favoriteImages.has(img.id));
        
        // If no valid favorites remain, automatically toggle off favorites view
        if (validFavorites.length === 0) {
          this.model.toggleFavoritesOnly(); // Turn off favorites-only mode
          this.view.updateFavoritesToggle(false);
        }
        this.renderGallery();
      }
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
    
    // Favorites toggle
    this.view.bindFavoritesToggle(() => {
      this.model.toggleFavoritesOnly();
      this.view.updateFavoritesToggle(this.model.showOnlyFavorites);
      this.renderGallery();
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
      // Toggle the state
      this.showOnlySelected = !this.showOnlySelected;
      
      // Update the UI
      this.view.updateShowSelectedToggle(this.showOnlySelected);
      
      // If toggling on and no images are selected, show a warning
      if (this.showOnlySelected && this.model.selectedImages.size === 0) {
        this.view.showNoSelectedWarning();
        this.showOnlySelected = false;
        this.view.updateShowSelectedToggle(false);
        return;
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
    
    this.view.bindSearchInput((searchNumber) => {
      this.performSearch(searchNumber);
    });
    
    // Weight controls
    this.view.bindWeightControls(
      (imageId) => {
        this.model.increaseWeight(imageId);
        this.updatePrompt();
      },
      (imageId) => {
        this.model.decreaseWeight(imageId);
        this.updatePrompt();
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
            if (!this.model.showOnlyFavorites) {
              // Get the actual favorited images that exist in the current gallery
              const validFavorites = this.model.images.filter(img => this.model.favoriteImages.has(img.id));
              
              if (validFavorites.length === 0) {
                this.view.showNoFavoritesWarning();
                return false; // Prevent animation
              }
            }
            
            const showOnlyFavorites = this.model.toggleFavoritesOnly();
            this.model.saveToStorage();
            this.view.updateFavoritesToggle(showOnlyFavorites);
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
            if (!this.showOnlySelected && this.model.selectedImages.size === 0) {
              this.view.showNoSelectedWarning();
              return false; // Prevent animation
            }
            this.showOnlySelected = !this.showOnlySelected;
            this.view.updateShowSelectedToggle(this.showOnlySelected);
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
      }
    });
  }

  updatePrompt() {
    const finalPrompt = this.model.generateFinalPrompt();
    this.view.updateFinalPrompt(finalPrompt);
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
      this.searchNumber = null;
      searchInput.value = '';
      this.renderGallery();
      
      // Update button state
      searchButton.classList.remove('active');
      if (stickySearchButton) stickySearchButton.classList.remove('active');
      
      this.view.showInfoNotification('Search cleared');
    } else {
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
   * Performs a search by image number
   * @param {string|null} searchNumber - The number to search for, or null to clear search
   */
  performSearch(searchNumber) {
    if (searchNumber === null || searchNumber === '') {
      // Clear search - show all images
      this.searchNumber = null;
      this.renderGallery();
      
      // Update search button state
      const searchButton = document.getElementById('search-button');
      const stickySearchButton = document.getElementById('sticky-search-button');
      if (searchButton) searchButton.classList.remove('active');
      if (stickySearchButton) stickySearchButton.classList.remove('active');
      
      return;
    }
    
    // Store the search string
    this.searchNumber = searchNumber.toString().trim();
    if (this.searchNumber === '') {
      this.searchNumber = null;
      this.renderGallery();
      return;
    }
    
    // Find all images that contain the search number in their sref
    const matchingImages = this.model.images.filter(img => {
      return img.sref.includes(this.searchNumber);
    });
    
    if (matchingImages.length > 0) {
      // Show only the matching images
      this.view.renderGallery(matchingImages, this.model.selectedImages, this.model.favoriteImages);
      
      // Update weight displays after rendering the gallery
      this.view.updateAllWeightDisplays(
        (imageId) => this.model.getWeight(imageId),
        (imageId) => this.model.getWeightColorIndex(imageId)
      );
      
      // Update search button state to indicate search is active
      const searchButton = document.getElementById('search-button');
      const stickySearchButton = document.getElementById('sticky-search-button');
      if (searchButton) searchButton.classList.add('active');
      if (stickySearchButton) stickySearchButton.classList.add('active');
      
      this.view.showInfoNotification(`Found ${matchingImages.length} image(s) matching "${this.searchNumber}"`);
    } else {
      this.view.showErrorNotification(`No images found matching "${this.searchNumber}"`);
    }
  }

  /**
   * Exports favorites to a JSON file for download
   */
  exportFavorites() {
    try {
      // Get favorites data from model
      const exportData = this.model.exportFavorites();
      
      // Convert to JSON string with pretty formatting
      const jsonString = JSON.stringify(exportData, null, 2);
      
      // Create a Blob with the JSON data
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      // Create a temporary download link
      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(blob);
      downloadLink.download = `prompteraid-favorites-${new Date().toISOString().slice(0, 10)}.json`;
      
      // Trigger the download
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      // Show success notification
      this.view.showInfoNotification(`Exported ${exportData.favorites.length} favorites successfully.`);
    } catch (error) {
      console.error('Error exporting favorites:', error);
      this.view.showErrorNotification('Failed to export favorites. Please try again.');
    }
  }

  /**
   * Imports favorites from a JSON file
   * @param {File} file - The JSON file to import
   */
  importFavorites(file) {
    try {
      // Validate file type
      if (!file.name.endsWith('.json')) {
        this.view.showErrorNotification('Please select a valid JSON file.');
        return;
      }
      
      // Read the file
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          // Parse the JSON data
          const importData = JSON.parse(event.target.result);
          
          // Import favorites using the model
          const result = this.model.importFavorites(importData);
          
          // Show appropriate notification based on result
          if (result.success) {
            this.view.showInfoNotification(result.message);
            
            // Re-render gallery to show imported favorites
            this.renderGallery();
          } else {
            this.view.showErrorNotification(result.message);
          }
        } catch (parseError) {
          console.error('Error parsing import file:', parseError);
          this.view.showErrorNotification('The selected file contains invalid JSON data.');
        }
      };
      
      reader.onerror = () => {
        this.view.showErrorNotification('Failed to read the selected file.');
      };
      
      // Start reading the file
      reader.readAsText(file);
    } catch (error) {
      console.error('Error importing favorites:', error);
      this.view.showErrorNotification('An unexpected error occurred while importing favorites.');
    }
  }
} 