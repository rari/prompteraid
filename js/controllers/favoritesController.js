import { supabase } from '../utils/supabaseClient.js';
import { getCurrentUser } from '../utils/auth.js';

/**
 * PrompterAid Favorites Controller
 * 
 * Controller Role:
 * This controller manages all favorites-related functionality including:
 * - Toggling individual favorites
 * - Clearing all favorites
 * - Importing/exporting favorites
 * - Syncing favorites between localStorage and Supabase
 * - Loading favorites from storage
 * 
 * Primary Responsibilities:
 * - Handle user authentication for favorites operations
 * - Coordinate between localStorage and Supabase storage
 * - Manage favorites UI state and updates
 * - Provide error handling and user feedback
 * - Ensure data consistency across storage locations
 */
export default class FavoritesController {
  constructor(imageModel, galleryView) {
    this.model = imageModel;
    this.view = galleryView;
  }

  /**
   * Initialize favorites functionality
   * Loads favorites from appropriate storage and sets up event handlers
   */
  async init() {
    try {
      // Get current user
      const user = await getCurrentUser();

      if (user) {
        // Sync any localStorage favorites to Supabase
        await this.syncFavoritesToSupabase(user, this.model.currentModel);
        // Load favorites from Supabase
        await this.loadFavoritesFromSupabase(user, this.model.currentModel);
      } else {
        // Not logged in, load from localStorage
        this.model.loadFromStorage();
      }

      // Set up event handlers
      this.bindEventHandlers();
    } catch (error) {
      console.error('Failed to initialize favorites:', error);
      this.view.showErrorNotification('Failed to load favorites. Please try refreshing the page.');
    }
  }

  /**
   * Bind all favorites-related event handlers
   */
  bindEventHandlers() {
    // Export favorites button
    this.view.bindExportFavoritesButton(() => {
      this.model.exportFavorites();
    });

    // Import favorites button
    this.view.bindImportFavoritesButton((file) => {
      this.handleImportFavorites(file);
    });

    // Clear favorites button
    this.view.bindClearFavoritesButton(async () => {
      await this.clearAllFavorites();
    });

    // Bind favorite button clicks using the view's method
    this.view.bindFavoriteClick(async (imageId) => {
      await this.toggleFavorite(imageId);
    });
  }

  /**
   * Handle importing favorites from a file
   */
  handleImportFavorites(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const result = this.model.importFavorites(e.target.result);
        if (result) {
          // If user is logged in, sync imported favorites to Supabase
          const user = await getCurrentUser();
          if (user) {
            await this.syncFavoritesToSupabase(user, this.model.currentModel);
          }

          this.view.showInfoNotification('Favorites imported successfully.');
          this.renderGallery();
        }
      } catch (error) {
        this.view.showErrorNotification(error.message);
      }
    };
    reader.onerror = () => {
      this.view.showErrorNotification('Failed to read the file.');
    };
    reader.readAsText(file);
  }

  /**
   * Clear all favorites from all storage locations
   */
  async clearAllFavorites() {
    try {
      // Get current user
      const user = await getCurrentUser();
      
      const success = await this.model.clearAllFavorites(user, this.model.currentModel);
      if (success) {
        this.view.showInfoNotification('All favorites cleared successfully.');
        this.renderGallery();
      } else {
        this.view.showErrorNotification('Failed to clear favorites.');
      }
    } catch (error) {
      console.error('Error clearing favorites:', error);
      this.view.showErrorNotification('Failed to clear favorites.');
    }
  }

  /**
   * Toggle favorite state for a specific image
   */
  async toggleFavorite(imageId) {
    try {
      // Get current user
      const user = await getCurrentUser();

      const isFavorite = await this.model.toggleImageFavorite(
        imageId,
        user,
        this.model.currentModel
      );

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

      return isFavorite;
    } catch (error) {
      console.error('Error toggling favorite:', error);
      this.view.showErrorNotification('Failed to update favorite.');
      return false;
    }
  }



  /**
   * Sync localStorage favorites to Supabase
   */
  async syncFavoritesToSupabase(user, currentModel) {
    if (!user || !currentModel) return;
    
    try {
      await this.model.syncFavoritesToSupabase(user, currentModel);
    } catch (error) {
      console.error('Error syncing favorites to Supabase:', error);
      this.view.showErrorNotification('Failed to sync favorites to cloud storage.');
    }
  }

  /**
   * Load favorites from Supabase
   */
  async loadFavoritesFromSupabase(user, currentModel) {
    if (!user || !currentModel) return;
    
    try {
      await this.model.loadFavoritesFromSupabase(user, currentModel);
    } catch (error) {
      console.error('Error loading favorites from Supabase:', error);
      this.view.showErrorNotification('Failed to load favorites from cloud storage.');
    }
  }

  /**
   * Re-render the gallery (delegates to gallery controller)
   */
  renderGallery() {
    // This will be set by the gallery controller
    if (this._renderGalleryCallback) {
      this._renderGalleryCallback();
    }
  }

  /**
   * Set the render gallery callback
   */
  setRenderGalleryCallback(callback) {
    this._renderGalleryCallback = callback;
  }
} 