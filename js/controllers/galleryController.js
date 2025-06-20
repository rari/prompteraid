import ImageModel from '../models/imageModel.js';
import GalleryView from '../views/galleryView.js';

export default class GalleryController {
  constructor() {
    this.model = new ImageModel();
    this.view = new GalleryView();
    this.showOnlySelected = false;
    
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

  renderGallery() {
    let visibleImages = this.model.getVisibleImages();
    if (this.showOnlySelected) {
      visibleImages = visibleImages.filter(img => this.model.selectedImages.has(img.id));
    }
    this.view.renderGallery(
      visibleImages,
      this.model.selectedImages,
      this.model.favoriteImages
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
    this.view.bindPromptInput(promptText => {
      this.model.setBasePrompt(promptText);
      this.updatePrompt();
    });
    
    // Discord/Website mode toggle
    this.view.bindModeToggle(() => {
      const isDiscordMode = this.model.toggleDiscordMode();
      this.view.updateModeToggle(isDiscordMode);
      this.updatePrompt();
    });
    
    // Copy button
    this.view.bindCopyButton(() => {
      console.log('Copy button clicked - calling generateFinalPrompt');
      const finalPrompt = this.model.generateFinalPrompt();
      console.log('Generated prompt:', finalPrompt);
      navigator.clipboard.writeText(finalPrompt)
        .then(() => {
          // Show notification that text was copied
          this.view.showInfoNotification('Prompt copied to clipboard.');
        })
        .catch(err => {
          console.error('Failed to copy text: ', err);
          // Show error notification
          this.view.showInfoNotification('Failed to copy to clipboard.');
        });
    });
    
    // Favorites toggle
    this.view.bindFavoritesToggle(() => {
      // Check if we're trying to show favorites-only mode and there are no valid favorites
      if (!this.model.showOnlyFavorites) {
        // Get the actual favorited images that exist in the current gallery
        const validFavorites = this.model.images.filter(img => this.model.favoriteImages.has(img.id));
        
        if (validFavorites.length === 0) {
          this.view.showNoFavoritesWarning();
          return false; // Prevent animation
        }
      }
      
      const showOnlyFavorites = this.model.toggleFavoritesOnly();
      this.model.saveToStorage(); // Save favorites state
      this.view.updateFavoritesToggle(showOnlyFavorites);
      this.renderGallery();
      return true; // Allow animation
    });
    
    // Refresh button
    this.view.bindRefreshButton(() => {
      // Randomize image order and quadrants
      this.model.shuffleImages();
      this.view.refreshImageQuadrants();
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
      
      // Show notification
      this.view.showInfoNotification(`Randomly selected: ${randomImage.sref}`);
      
      // Re-render gallery and update prompt
      this.renderGallery();
      this.updatePrompt();
    });

    this.view.bindShowSelectedToggle(() => {
      if (!this.showOnlySelected && this.model.selectedImages.size === 0) {
        this.view.showNoSelectedWarning();
        return false; // Prevent animation
      }
      this.showOnlySelected = !this.showOnlySelected;
      this.view.updateShowSelectedToggle(this.showOnlySelected);
      this.renderGallery();
      this.model.saveToStorage(); // Save favorites state after render
      return true; // Allow animation
    });
    
    // Clear button
    this.view.bindClearButton(() => {
      // Clear all selections
      this.model.selectedImages.clear();
      
      // Reset prompt to original (empty)
      this.model.setBasePrompt('');
      this.view.promptInput.value = '';
      
      // If showing only selected, switch back to all images
      if (this.showOnlySelected) {
        this.showOnlySelected = false;
        this.view.updateShowSelectedToggle(false);
      }
      
      // If showing only favorites and no favorites remain, switch back to all images
      if (this.model.showOnlyFavorites) {
        // Get the actual favorited images that exist in the current gallery
        const validFavorites = this.model.images.filter(img => this.model.favoriteImages.has(img.id));
        
        if (validFavorites.length === 0) {
          this.model.toggleFavoritesOnly(); // Turn off favorites-only mode
          this.view.updateFavoritesToggle(false);
        }
      }
      
      // Show notification that selections were cleared
      this.view.showInfoNotification('All selections cleared.');
      
      // Re-render gallery and update prompt
      this.renderGallery();
      this.updatePrompt();
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
} 