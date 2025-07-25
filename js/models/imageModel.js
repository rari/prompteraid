/**
 * PrompterAid Image Model
 * 
 * Model Role:
 * This model implements the MVC pattern's Model layer, responsible for data management,
 * business logic, and persistence. It serves as the single source of truth for all
 * application data and provides a clean interface for data operations.
 * 
 * Data Structures:
 * - images: Array of image objects with metadata (id, sref, path)
 * - selectedImages: Map tracking selected images with color indices
 * - favoriteImages: Set of favorited image IDs for persistence
 * - showOnlyFavorites: Boolean flag for filter state
 * - basePrompt: User's base prompt text
 * - isDiscordMode: Boolean flag for output format preference
 * - imageWeights: Map to store weights for each selected image
 * - weightColorIndices: Map to store color indices for weight displays
 * 
 * Primary Responsibilities:
 * - Image data loading and management
 * - Selection state tracking with visual color coding
 * - Favorites system with localStorage persistence
 * - Filter logic for view modes
 * - Prompt generation with format options
 * - Data persistence and error handling
 * 
 * Business Logic:
 * - Handles GitHub Pages path resolution for deployment
 * - Implements Fisher-Yates shuffle for image randomization
 * - Manages color cycling for multiple selections
 * - Coordinates prompt generation with selected styles
 * - Provides fallback mechanisms for data loading
 */
import { supabase } from '../utils/supabaseClient.js';
import { createItem, deleteItem, readItems, deleteItems } from '../utils/supabaseCrud.js';
import { getCurrentUser } from '../utils/auth.js';

export default class ImageModel {
  // In-memory cache shared across all instances. Structure: { modelKey: [images] }
  static imagesCache = {};

  constructor() {
    this.images = [];
    this.selectedImages = new Map();
    this.favoriteImages = new Set();
    this.showOnlyFavorites = false;
    this.basePrompt = '';
    this.suffix = '';
    this.aspectRatio = '1:1'; // Default aspect ratio
    this.currentColorIndex = 0;
    this.numSelectionColors = 5; // Pink, Orange, Yellow, Teal, Blue
    this.numWeightColors = 7; // Pink, Orange, Yellow, Green, Teal, Blue, Purple
    this.isDiscordMode = true; // Default to Discord mode
    this.imageWeights = new Map(); // Store weights for each selected image
    this.weightColorIndices = new Map(); // Store color indices for weight displays
    this.currentModel = 'niji-6'; // Default model
    
    // Detect if we're on GitHub Pages and get the repository name
    this.basePath = '';
    if (window.location.hostname.includes('github.io')) {
      // Extract repository name from path, but ensure we don't duplicate segments
      const pathParts = window.location.pathname.split('/').filter(part => part.trim() !== '');
      if (pathParts.length > 0) {
        // Use only the first segment (the repository name)
        this.basePath = '/' + pathParts[0];
        console.log(`Detected GitHub Pages repository: ${this.basePath}`);
      }
    }
  }

  loadFromStorage() {
    try {
      const favsKey = `prompteraid_favoriteImages_${this.currentModel}`;
      const favs = JSON.parse(localStorage.getItem(favsKey));
      console.log(`[DEBUG] loadFromStorage: Loading favorites for model ${this.currentModel}:`, favs);
      if (Array.isArray(favs)) {
        this.favoriteImages = new Set(favs);
        console.log(`[DEBUG] loadFromStorage: Set favoriteImages to:`, Array.from(this.favoriteImages));
      }
      // Always clear localStorage for this model after loading
      localStorage.removeItem(favsKey);
      console.log(`[DEBUG] loadFromStorage: Cleared localStorage key: ${favsKey}`);
      
      // Load Discord/Website mode preference (which is global)
      const isDiscordMode = localStorage.getItem('prompteraid_isDiscordMode');
      if (isDiscordMode !== null) {
        this.isDiscordMode = isDiscordMode === 'true';
      }
      const aspectRatio = localStorage.getItem('prompteraid_aspectRatio');
      if (aspectRatio !== null) {
        this.aspectRatio = aspectRatio;
      }
    } catch (e) {
      // Show a friendly error notification
      console.warn('Error loading preferences from local storage:', e);
      setTimeout(() => {
        const event = new CustomEvent('storage-error', { 
          detail: { message: 'Unable to load your preferences. Your favorites might not be available.' } 
        });
        document.dispatchEvent(event);
      }, 500);
    }
  }

  async saveToStorage(user = null) {
    try {
      // If no user provided, check if user is logged in
      if (!user) {
        user = await getCurrentUser();
      }

      // Only save favorites to localStorage if user is NOT logged in
      if (!user) {
        const favsKey = `prompteraid_favoriteImages_${this.currentModel}`;
        console.log(`[DEBUG] saveToStorage: Saving favorites for model ${this.currentModel}:`, Array.from(this.favoriteImages));
        localStorage.setItem(favsKey, JSON.stringify(Array.from(this.favoriteImages)));
        console.log(`[DEBUG] saveToStorage: Saved to localStorage key: ${favsKey}`);
      } else {
        console.log(`[DEBUG] saveToStorage: User is logged in, skipping favorites save to localStorage`);
      }
      
      // Save Discord/Website mode preference (which is global)
      localStorage.setItem('prompteraid_isDiscordMode', this.isDiscordMode.toString());
      localStorage.setItem('prompteraid_aspectRatio', this.aspectRatio);
    } catch (e) {
      console.warn('Error saving preferences to local storage:', e);
    }
  }

  async loadImages() {
    console.log('🖼️  loadImages: Starting image loading process...');
    try {
      // Use error boundary if available, otherwise fall back to direct call
      let imagePaths;
      if (window.errorBoundary && window.errorBoundary.wrapAsyncWithRetry) {
        console.log('🖼️  loadImages: Using error boundary for image loading');
        imagePaths = await window.errorBoundary.wrapAsyncWithRetry(
          () => this.getImageFiles(),
          3,
          'Image Files Fetch'
        ) || [];
      } else {
        // Fallback to direct call if error boundary not available
        console.log('🖼️  loadImages: Using direct call for image loading');
        imagePaths = await this.getImageFiles();
      }
      
      console.log('🖼️  loadImages: Received imagePaths:', imagePaths);
      console.log('🖼️  loadImages: Number of imagePaths:', imagePaths ? imagePaths.length : 0);
      
      this.images = imagePaths
        .filter(p => {
          // If object, examine .path, else string
          const testPath = typeof p === 'object' && p !== null ? p.path : p;
          const fname = testPath.split('/').pop().split('\\').pop();
          const shouldKeep = !fname.startsWith('_');
          if (!shouldKeep) {
            console.log('🖼️  loadImages: Filtering out image with underscore prefix:', fname);
          }
          return shouldKeep;
        })
        .map(pathOrObj => {
        // If the entry is an object (new format), preserve all fields
        if (typeof pathOrObj === 'object' && pathOrObj !== null) {
          // Extract sref as before
          const filename = pathOrObj.path.split('/').pop().split('\\').pop();
          const filenameWithoutPath = filename.split('_')[0];
          const srefMatch = filenameWithoutPath.match(/(\d+)/);
          const sref = srefMatch ? srefMatch[0] : filenameWithoutPath;
          return {
            ...pathOrObj,
            id: pathOrObj.path, // Use path as unique ID
            sref: sref,
          };
        } else {
          // Old format: just a string path
          const filename = pathOrObj.split('/').pop().split('\\').pop();
          const filenameWithoutPath = filename.split('_')[0];
          const srefMatch = filenameWithoutPath.match(/(\d+)/);
          const sref = srefMatch ? srefMatch[0] : filenameWithoutPath;
          return {
            id: pathOrObj,
            sref: sref,
            path: pathOrObj
          };
        }
      });
      
      console.log('🖼️  loadImages: Processed images:', this.images.length);
      console.log('🖼️  loadImages: First few images:', this.images.slice(0, 3));
      
      this.shuffleImages();
      return this.images;
    } catch (error) {
      console.error('Error loading images:', error);
      // Show user-friendly error message if error boundary is available
      if (window.errorBoundary && window.errorBoundary.showErrorMessage) {
        window.errorBoundary.showErrorMessage('Failed to load images. Please refresh the page.', 'error');
      }
      return [];
    }
  }

  /**
   * Reload images for a specific model
   * This method is used when switching between models to ensure fresh data
   */
  async reloadImagesForModel(modelId) {
    console.log(`🔄 Reloading images for model: ${modelId}`);
    // Update the current model
    this.currentModel = modelId;
    
    // Clear current images and reload
    this.images = [];
    const result = await this.loadImages();
    console.log(`✅ Reloaded ${result.length} images for model ${modelId}`);
    return result;
  }

  /**
   * Loads image file paths with robust fallback strategy for different deployment environments
   * 
   * This method implements a multi-path resolution strategy to handle various deployment
   * scenarios, particularly GitHub Pages which serves content from subdirectories.
   * 
   * Path Resolution Strategy:
   * 1. Local development: 'api/images.json' (relative to current directory)
   * 2. Standard deployment: './api/images.json' (explicit relative path)
   * 3. GitHub Pages: '/username/repo/api/images.json' (repository-specific path)
   * 
   * Data Format Handling:
   * - Supports both direct array format: ['image1.jpg', 'image2.jpg']
   * - Supports object format: { images: ['image1.jpg', 'image2.jpg'] }
   * - Handles BOM (Byte Order Mark) removal for UTF-8 files
   * - Validates data structure before processing
   * 
   * Error Handling:
   * - Graceful degradation when individual paths fail
   * - Comprehensive logging for debugging deployment issues
   * - Returns empty array as fallback to prevent application crashes
   * 
   * Performance Considerations:
   * - Sequential path attempts to minimize unnecessary requests
   * - Early termination on successful load
   * - Efficient JSON parsing with error boundaries
   */
  async getImageFiles() {
    try {
      // Return from cache if available
      const cacheKey = this.currentModel || 'niji-6';
      if (ImageModel.imagesCache[cacheKey]) {
        console.log(`🗄️  Returning ${ImageModel.imagesCache[cacheKey].length} cached images for model ${cacheKey}`);
        return ImageModel.imagesCache[cacheKey];
      }
      // Create an array of possible paths to try
      const pathsToTry = [
        'api/images.json', // Local development
        './api/images.json', // Standard deployment
      ];
      
      // Add GitHub Pages path if applicable
      if (window.location.hostname.includes('github.io') && this.basePath) {
        pathsToTry.push(`${this.basePath}/api/images.json`);
        console.log(`Added GitHub Pages path: ${this.basePath}/api/images.json`);
      }
      
      // Try each path in order
      for (const path of pathsToTry) {
        try {
          console.log(`Trying to fetch from: ${path}`);
          const response = await fetch(path);
          if (response.ok) {
            const text = await response.text();
            // Remove BOM if present
            const cleanText = text.replace(/^\uFEFF/, '');
            const data = JSON.parse(cleanText);
            
            // Check for the new model sets format
            if (data && typeof data === 'object' && data.sets) {
              // Get the current model (default to the one specified in the JSON or niji-6)
              const currentModel = this.currentModel || data.default || 'niji-6';
              console.log(`🔍 Current model: ${currentModel}`);
              
              // Map UI model IDs to JSON keys
              const modelKeyMap = {
                'niji-6': 'niji6',
                'midjourney-6': 'mj6',
                'midjourney-7': 'mj7'
              };
              
              const jsonKey = modelKeyMap[currentModel] || currentModel;
              console.log(`🔍 JSON key: ${jsonKey}`);
              console.log(`🔍 Available sets:`, Object.keys(data.sets));
              
              // Get the images for the current model
              const modelSet = data.sets[jsonKey];
              if (modelSet && Array.isArray(modelSet.images)) {
                console.log(`✅ Successfully loaded ${modelSet.images.length} images for model ${currentModel} (JSON key: ${jsonKey})`);
                // Save to cache and return
                ImageModel.imagesCache[cacheKey] = modelSet.images;
                return modelSet.images;
              } else {
                console.warn(`❌ No images found for model ${currentModel} (JSON key: ${jsonKey})`);
                console.warn(`Available models:`, Object.keys(data.sets));
              }
            }
            
            // Fall back to old format handling
            let imageArray = data;
            if (data && typeof data === 'object' && data.images && Array.isArray(data.images)) {
              imageArray = data.images;
            }
            
            if (Array.isArray(imageArray) && imageArray.length > 0) {
              console.log(`Successfully loaded ${imageArray.length} images from ${path}`);
              ImageModel.imagesCache[cacheKey] = imageArray;
              return imageArray;
            }
          }
        } catch (error) {
          console.warn(`Failed to load from ${path}:`, error);
        }
      }
      
      // If all else fails, return an empty array
      console.error('Failed to load any image paths');
      // cache negative result to avoid repeated attempts for this session
      ImageModel.imagesCache[cacheKey] = [];
      return [];
    } catch (error) {
      console.error('Error fetching image files:', error);
      return [];
    }
  }

  toggleImageSelection(imageId) {
    if (this.selectedImages.has(imageId)) {
      this.selectedImages.delete(imageId);
      this.imageWeights.delete(imageId); // Remove weight when unselecting
      this.weightColorIndices.delete(imageId); // Remove color index when unselecting
    } else {
      this.selectedImages.set(imageId, this.currentColorIndex);
      this.imageWeights.set(imageId, 1); // Default weight is 1
      this.weightColorIndices.set(imageId, 0); // Start with color index 0 (pink)
      this.currentColorIndex = (this.currentColorIndex + 1) % this.numSelectionColors;
    }
    return this.selectedImages.has(imageId);
  }

  async toggleImageFavorite(imageId, user = null, currentModel = null) {
    const isFavorite = this.favoriteImages.has(imageId);
    console.log(`[DEBUG] toggleImageFavorite: Toggling image ${imageId}, currently favorite: ${isFavorite}, user: ${user ? user.id : 'null'}, model: ${currentModel}`);
    
    if (user && currentModel) {
      // User is logged in, use Supabase only
      if (isFavorite) {
        console.log(`[DEBUG] toggleImageFavorite: Removing from Supabase`);
        try {
          const { data, error } = await deleteItem(supabase, 'user_favorites', {
            user_id: user.id,
            image_id: imageId,
            model: currentModel
          });
          
          if (error) {
            console.error(`[DEBUG] toggleImageFavorite: Error deleting from Supabase:`, error);
            return this.favoriteImages.has(imageId); // Return current state on error
          }
          
          console.log(`[DEBUG] toggleImageFavorite: Successfully deleted from Supabase:`, data);
          this.favoriteImages.delete(imageId);
        } catch (error) {
          console.error(`[DEBUG] toggleImageFavorite: Exception deleting from Supabase:`, error);
          return this.favoriteImages.has(imageId); // Return current state on error
        }
      } else {
        console.log(`[DEBUG] toggleImageFavorite: Adding to Supabase`);
        try {
          const { data, error } = await createItem(supabase, 'user_favorites', {
            user_id: user.id,
            image_id: imageId,
            model: currentModel
          });
          
          if (error) {
            console.error(`[DEBUG] toggleImageFavorite: Error adding to Supabase:`, error);
            return this.favoriteImages.has(imageId); // Return current state on error
          }
          
          console.log(`[DEBUG] toggleImageFavorite: Successfully added to Supabase:`, data);
          this.favoriteImages.add(imageId);
        } catch (error) {
          console.error(`[DEBUG] toggleImageFavorite: Exception adding to Supabase:`, error);
          return this.favoriteImages.has(imageId); // Return current state on error
        }
      }
      // Do NOT save to localStorage when logged in
      console.log(`[DEBUG] toggleImageFavorite: After Supabase operation, favoriteImages:`, Array.from(this.favoriteImages));
    } else {
      // Not logged in, use localStorage
      if (isFavorite) {
        this.favoriteImages.delete(imageId);
      } else {
        this.favoriteImages.add(imageId);
      }
      this.saveToStorage();
      console.log(`[DEBUG] toggleImageFavorite: After localStorage operation, favoriteImages:`, Array.from(this.favoriteImages));
    }
    return this.favoriteImages.has(imageId);
  }

  toggleFavoritesOnly() {
    this.showOnlyFavorites = !this.showOnlyFavorites;
    return this.showOnlyFavorites;
  }

  setBasePrompt(prompt) {
    this.basePrompt = prompt;
    this.saveToStorage();
  }

  setSuffix(suffix) {
    this.suffix = suffix;
    this.saveToStorage();
  }

  setAspectRatio(aspectRatio) {
    this.aspectRatio = aspectRatio;
    this.saveToStorage();
  }

  getSelectedSrefs() {
    return Array.from(this.selectedImages.keys())
      .map(id => {
        const image = this.images.find(img => img.id === id);
        const weight = this.imageWeights.get(id) || 1;
        
        if (!image) return null;
        
        // Extract only the numeric sref code from the image.sref
        // The sref should be the filename before the first underscore
        const srefCode = image.sref;
        
        // Don't include weights for Midjourney 7 since multiprompt is not available
        if (this.currentModel === 'midjourney-7') {
          return srefCode;
        } else {
          return `${srefCode}::${weight}`;
        }
      })
      .filter(sref => sref !== null);
  }

  /**
   * Generates the final prompt string with selected style references and format options
   * 
   * This method constructs the complete prompt that users can copy and paste into
   * AI image generation tools like NijiJourney or MidJourney.
   * 
   * Prompt Structure:
   * - Base prompt: User's custom text input
   * - Style references: Selected --sref codes joined with spaces
   * - Model specification: --niji 6 for NijiJourney 6 compatibility
   * - Format prefix: Optional "/imagine prompt:" for Discord bots
   * 
   * Format Modes:
   * - Discord Mode: Includes "/imagine prompt:" prefix for direct bot usage
   * - Website Mode: Clean format without prefix for web interfaces
   * 
   * Style Reference Handling:
   * - Extracts sref codes from selected image filenames
   * - Joins multiple references with spaces
   * - Omits style references section if no images are selected
   * - Maintains proper spacing and formatting
   * 
   * Output Examples:
   * - Discord: "/imagine prompt: beautiful mermaid --niji 6 --sref style1 style2"
   * - Website: "beautiful mermaid --v 7 --sref style1 style2"
   * 
   * @returns {string} The complete formatted prompt ready for use
   */
  generateFinalPrompt() {
    const srefs = this.getSelectedSrefs();
    
    // Get the model tag based on the current model
    let modelTag = '';
    if (this.currentModel === 'niji-6') {
      modelTag = '--niji 6';
    } else if (this.currentModel === 'midjourney-7') {
      modelTag = '--v 7';
    }

    const srefsString = srefs.length > 0 ? `--sref ${srefs.join(' ')}` : '';
    // Only include aspect ratio if enabled
    const aspectRatioEnabled = localStorage.getItem('prompteraid_enable_aspect_ratio') === 'true';
    const aspectRatioString = aspectRatioEnabled ? `--ar ${this.aspectRatio}` : '';
    const prefix = this.isDiscordMode ? '/imagine prompt: ' : '';
    
    // Combine all parts, ensuring there are spaces where needed
    // Order: basePrompt, suffix, modelTag, aspectRatio, srefsString
    const parts = [this.basePrompt, this.suffix, modelTag, aspectRatioString, srefsString].filter(part => part.trim() !== '');
    
    // If no user input and no styles selected, still show the model parameter and prefix
    if (parts.length === 0) {
      return `${prefix}${modelTag}`.trim();
    }
    
    return `${prefix}${parts.join(' ')}`.trim();
  }

  getVisibleImages() {
    if (this.showOnlyFavorites) {
      return this.images.filter(img => this.favoriteImages.has(img.id));
    }
    return this.images;
  }

  shuffleImages() {
    // Fisher-Yates shuffle
    for (let i = this.images.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.images[i], this.images[j]] = [this.images[j], this.images[i]];
    }
  }

  moveSelectedToTop() {
    this.images.sort((a, b) => {
      const aSelected = this.selectedImages.has(a.id) ? -1 : 0;
      const bSelected = this.selectedImages.has(b.id) ? -1 : 0;
      return bSelected - aSelected;
    });
  }

  // Toggle between Discord and Website modes
  toggleDiscordMode() {
    this.isDiscordMode = !this.isDiscordMode;
    this.saveToStorage();
    return this.isDiscordMode;
  }

  // Increase the weight of an image (1-9, cycles back to 1)
  increaseWeight(imageId) {
    // Make sure the image is still selected
    if (!this.selectedImages.has(imageId)) {
      // If somehow the image is not selected, select it
      this.selectedImages.set(imageId, this.currentColorIndex);
      this.currentColorIndex = (this.currentColorIndex + 1) % this.numSelectionColors;
    }
    
    let weight = this.imageWeights.get(imageId) || 1;
    weight = weight >= 9 ? 1 : weight + 1;
    this.imageWeights.set(imageId, weight);
    
    // Cycle color forward
    let colorIndex = this.weightColorIndices.get(imageId) || 0;
    colorIndex = (colorIndex + 1) % this.numWeightColors;
    this.weightColorIndices.set(imageId, colorIndex);
    
    return weight;
  }
  
  // Decrease the weight of an image (1-9, cycles back to 9)
  decreaseWeight(imageId) {
    // Make sure the image is still selected
    if (!this.selectedImages.has(imageId)) {
      // If somehow the image is not selected, select it
      this.selectedImages.set(imageId, this.currentColorIndex);
      this.currentColorIndex = (this.currentColorIndex + 1) % this.numSelectionColors;
    }
    
    let weight = this.imageWeights.get(imageId) || 1;
    weight = weight <= 1 ? 9 : weight - 1;
    this.imageWeights.set(imageId, weight);
    
    // Cycle color backward
    let colorIndex = this.weightColorIndices.get(imageId) || 0;
    colorIndex = (colorIndex - 1 + this.numWeightColors) % this.numWeightColors;
    this.weightColorIndices.set(imageId, colorIndex);
    
    return weight;
  }
  
  // Get the current weight of an image
  getWeight(imageId) {
    return this.imageWeights.get(imageId) || 1;
  }
  
  // Get the current color index for a weight display
  getWeightColorIndex(imageId) {
    // If no weight color index is stored, initialize it
    if (!this.weightColorIndices.has(imageId)) {
      // Get the selection color index for this image
      const selectionColorIndex = this.selectedImages.get(imageId) % this.numSelectionColors;
      this.weightColorIndices.set(imageId, selectionColorIndex);
    }
    
    // Get the current weight
    const weight = this.getWeight(imageId);
    
    // Calculate color index based on weight (0-6 for the 7 colors)
    // Pink(0) → Orange(1) → Yellow(2) → Green(3) → Teal(4) → Blue(5) → Purple(6) → Pink(0)
    return (weight - 1) % this.numWeightColors;
  }

  /**
   * Exports favorites to a JSON file
   * @returns {Object} Favorites data object
   */
  exportFavorites() {
    try {
      const exportObject = {
        model: this.currentModel,
        favorites: Array.from(this.favoriteImages)
      };
      
      const dataStr = JSON.stringify(exportObject, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const a = document.createElement('a');
      a.href = url;
      const modelName = this.currentModel.replace('-', '');
      a.download = `prompteraid_favorites_${modelName}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Error exporting favorites:', e);
      const event = new CustomEvent('storage-error', { 
        detail: { message: 'An unexpected error occurred while exporting favorites.' } 
      });
      document.dispatchEvent(event);
    }
  }

  /**
   * Imports favorites from a JSON file with sanitization
   * @param {Object} importData - The imported data object
   * @returns {Object} Result with success flag and message
   */
  importFavorites(importData) {
    try {
      const imported = JSON.parse(importData);
      
      if (typeof imported !== 'object' || !imported.model || !Array.isArray(imported.favorites)) {
        throw new Error('Invalid favorites file format.');
      }
      
      if (imported.model !== this.currentModel) {
        const expectedModel = this.currentModel === 'niji-6' ? 'Niji 6' : 'Midjourney v7';
        const importedModelName = imported.model === 'niji-6' ? 'Niji 6' : imported.model === 'midjourney-7' ? 'Midjourney v7' : imported.model;
        
        const event = new CustomEvent('storage-error', { 
          detail: { 
            message: `Import failed: These favorites are for ${importedModelName}, but you are currently using ${expectedModel}.`
          } 
        });
        document.dispatchEvent(event);
        return false;
      }
      
      // Sterilize the import: only accept valid image IDs that exist for the current model
      const allImageIds = new Set(this.images.map(img => img.id));
      const sanitizedFavorites = imported.favorites.filter(favId => {
        const isString = typeof favId === 'string';
        if (!isString) {
            console.warn(`Sanitization: removed non-string favorite ID from import:`, favId);
        }
        const exists = allImageIds.has(favId);
        if (isString && !exists) {
            console.warn(`Sanitization: removed favorite ID not found in current model's image set:`, favId);
        }
        return isString && exists;
      });

      if (sanitizedFavorites.length === 0 && imported.favorites.length > 0) {
          throw new Error('None of the favorites in the file match the images for the current model.');
      }
      
      this.favoriteImages = new Set(sanitizedFavorites);
      this.saveToStorage();
      return true;
    } catch (e) {
      console.error('Error importing favorites:', e);
      throw new Error('Could not parse the imported file. Please make sure it is a valid favorites file.');
    }
  }

  async loadFavoritesFromSupabase(user, currentModel) {
    try {
      console.log(`[DEBUG] loadFavoritesFromSupabase: Loading favorites for user ${user.id}, model ${currentModel}`);
      const { data, error } = await readItems(supabase, 'user_favorites', {
        user_id: user.id,
        model: currentModel
      });
      
      if (error) {
        console.error('Error loading favorites from Supabase:', error);
        return;
      }
      
      console.log(`[DEBUG] loadFavoritesFromSupabase: Received data from Supabase:`, data);
      this.favoriteImages = new Set(data.map(row => row.image_id));
      console.log(`[DEBUG] loadFavoritesFromSupabase: Set favoriteImages to:`, Array.from(this.favoriteImages));
    } catch (error) {
      console.error('Error loading favorites from Supabase:', error);
    }
  }

  async syncFavoritesToSupabase(user, currentModel) {
    try {
      // Get localStorage favorites
      const favsKey = `prompteraid_favoriteImages_${currentModel}`;
      const localFavorites = JSON.parse(localStorage.getItem(favsKey) || '[]');
      console.log(`[DEBUG] syncFavoritesToSupabase: Found ${localFavorites.length} favorites in localStorage for model ${currentModel}:`, localFavorites);
      
      if (localFavorites.length === 0) {
        console.log(`[DEBUG] syncFavoritesToSupabase: No localStorage favorites to sync`);
        return;
      }

      // Get existing Supabase favorites
      const { data: existingFavorites, error: readError } = await readItems(supabase, 'user_favorites', {
        user_id: user.id,
        model: currentModel
      });
      
      if (readError) {
        console.error('Error reading existing favorites from Supabase:', readError);
        return;
      }
      
      console.log(`[DEBUG] syncFavoritesToSupabase: Found ${existingFavorites.length} existing favorites in Supabase:`, existingFavorites.map(f => f.image_id));
      
      const existingIds = new Set(existingFavorites.map(f => f.image_id));
      const newFavorites = localFavorites.filter(id => !existingIds.has(id));
      
      console.log(`[DEBUG] syncFavoritesToSupabase: ${newFavorites.length} new favorites to add:`, newFavorites);
      
      // Add new favorites to Supabase
      for (const imageId of newFavorites) {
        await createItem(supabase, 'user_favorites', {
          user_id: user.id,
          image_id: imageId,
          model: currentModel
        });
      }
      
      // Clear localStorage after successful sync
      localStorage.removeItem(favsKey);
      console.log(`[DEBUG] syncFavoritesToSupabase: Cleared localStorage key: ${favsKey}`);
      
      // Update in-memory favorites
      this.favoriteImages = new Set([...existingIds, ...newFavorites]);
      console.log(`[DEBUG] syncFavoritesToSupabase: Updated in-memory favorites:`, Array.from(this.favoriteImages));
      
    } catch (error) {
      console.error('Error syncing favorites to Supabase:', error);
    }
  }

  async clearAllFavorites(user = null, currentModel = null) {
    console.log(`[DEBUG] clearAllFavorites: Clearing all favorites, user: ${user ? user.id : 'null'}, model: ${currentModel}`);
    
    const modelToUse = currentModel || this.currentModel;
    let success = true;
    
    // Always clear from localStorage regardless of login status
    const favsKey = `prompteraid_favoriteImages_${modelToUse}`;
    localStorage.removeItem(favsKey);
    console.log(`[DEBUG] clearAllFavorites: Cleared favorites from localStorage key: ${favsKey}`);
    
    // If user is logged in, also clear from Supabase
    if (user && modelToUse) {
      try {
        const { error } = await deleteItems(supabase, 'user_favorites', {
          user_id: user.id,
          model: modelToUse
        });
        
        if (error) {
          console.error('Error clearing favorites from Supabase:', error);
          success = false;
        } else {
          console.log(`[DEBUG] clearAllFavorites: Cleared favorites from Supabase`);
        }
      } catch (error) {
        console.error('Error clearing favorites from Supabase:', error);
        success = false;
      }
    }
    
    // Always clear in-memory favorites
    this.favoriteImages.clear();
    console.log(`[DEBUG] clearAllFavorites: Cleared in-memory favorites`);
    
    return success;
  }

  getNewImages() {
    return this.images.filter(img => img.new === true);
  }
} 