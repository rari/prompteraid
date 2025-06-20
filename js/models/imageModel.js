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
export default class ImageModel {
  constructor() {
    this.images = [];
    this.selectedImages = new Map();
    this.favoriteImages = new Set();
    this.showOnlyFavorites = false;
    this.basePrompt = '';
    this.currentColorIndex = 0;
    this.numSelectionColors = 5; // Pink, Orange, Yellow, Teal, Blue
    this.isDiscordMode = true; // Default to Discord mode
    this.loadFromStorage();
    
    // Detect if we're on GitHub Pages and get the repository name
    this.basePath = '';
    if (window.location.hostname.includes('github.io')) {
      // Extract repository name from path
      const pathParts = window.location.pathname.split('/');
      if (pathParts.length > 1 && pathParts[1]) {
        this.basePath = '/' + pathParts[1];
        console.log(`Detected GitHub Pages repository: ${this.basePath}`);
      }
    }
  }

  loadFromStorage() {
    try {
      // Only load favorites and Discord mode from storage
      const favs = JSON.parse(localStorage.getItem('prompteraid_favoriteImages'));
      if (Array.isArray(favs)) {
        this.favoriteImages = new Set(favs);
      }
      
      // Load Discord/Website mode preference
      const isDiscordMode = localStorage.getItem('prompteraid_isDiscordMode');
      if (isDiscordMode !== null) {
        this.isDiscordMode = isDiscordMode === 'true';
      }
    } catch (e) {
      // Show a friendly error notification
      console.warn('Error loading preferences from local storage:', e);
      // We'll use a callback to show the error notification after the view is initialized
      setTimeout(() => {
        const event = new CustomEvent('storage-error', { 
          detail: { message: 'Unable to load your preferences. Your favorites might not be available.' } 
        });
        document.dispatchEvent(event);
      }, 500);
    }
  }

  saveToStorage() {
    try {
      // Only save favorites and Discord mode to storage
      localStorage.setItem('prompteraid_favoriteImages', JSON.stringify(Array.from(this.favoriteImages)));
      localStorage.setItem('prompteraid_isDiscordMode', this.isDiscordMode);
    } catch (e) {
      // Show a friendly error notification
      console.warn('Error saving preferences to local storage:', e);
      const event = new CustomEvent('storage-error', { 
        detail: { message: 'Unable to save your preferences. Your favorites might not be remembered.' } 
      });
      document.dispatchEvent(event);
    }
  }

  async loadImages() {
    try {
      const imagePaths = await this.getImageFiles();
      this.images = imagePaths.map(path => {
        // Extract the filename from the path
        const filename = path.split('/').pop();
        // Extract sref from filename (before first underscore)
        const sref = filename.split('_')[0];
        
        return {
          id: path, // Use the full path as the ID to ensure uniqueness
          sref: sref,
          path: path // Use relative paths
        };
      });
      this.shuffleImages();
      return this.images;
    } catch (error) {
      console.error('Error loading images:', error);
      return [];
    }
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
      // Create an array of possible paths to try
      const pathsToTry = [
        'api/images.json',
        './api/images.json',
        `${this.basePath}/api/images.json`,
      ];
      
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
            
            // Handle both direct array and object with "images" property
            let imageArray = data;
            if (data && typeof data === 'object' && data.images && Array.isArray(data.images)) {
              imageArray = data.images;
            }
            
            if (Array.isArray(imageArray) && imageArray.length > 0) {
              console.log(`Successfully loaded ${imageArray.length} images from ${path}`);
              return imageArray;
            }
          }
        } catch (error) {
          console.warn(`Failed to load from ${path}:`, error);
        }
      }
      
      // If all else fails, return an empty array
      console.error('Failed to load any image paths');
      return [];
    } catch (error) {
      console.error('Error fetching image files:', error);
      return [];
    }
  }

  toggleImageSelection(imageId) {
    if (this.selectedImages.has(imageId)) {
      this.selectedImages.delete(imageId);
    } else {
      this.selectedImages.set(imageId, this.currentColorIndex);
      this.currentColorIndex = (this.currentColorIndex + 1) % this.numSelectionColors;
    }
    return this.selectedImages.has(imageId);
  }

  toggleImageFavorite(imageId) {
    if (this.favoriteImages.has(imageId)) {
      this.favoriteImages.delete(imageId);
    } else {
      this.favoriteImages.add(imageId);
    }
    this.saveToStorage();
    return this.favoriteImages.has(imageId);
  }

  toggleFavoritesOnly() {
    this.showOnlyFavorites = !this.showOnlyFavorites;
    return this.showOnlyFavorites;
  }

  setBasePrompt(prompt) {
    this.basePrompt = prompt;
    // No longer saving prompt to storage
  }

  getSelectedSrefs() {
    return Array.from(this.selectedImages.keys())
      .map(id => {
        const image = this.images.find(img => img.id === id);
        return image ? image.sref : null;
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
   * - Website: "beautiful mermaid --niji 6 --sref style1 style2"
   * 
   * @returns {string} The complete formatted prompt ready for use
   */
  generateFinalPrompt() {
    const selectedSrefs = this.getSelectedSrefs();
    const srefsString = selectedSrefs.length > 0 ? `--sref ${selectedSrefs.join(' ')}` : '';
    
    // Include "/imagine prompt:" prefix only in Discord mode
    const prefix = this.isDiscordMode ? "/imagine prompt: " : "";
    
    return `${prefix}${this.basePrompt} --niji 6 ${srefsString}`.trim();
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
} 