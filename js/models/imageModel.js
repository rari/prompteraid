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
export default class ImageModel {
  constructor() {
    this.images = [];
    this.selectedImages = new Map();
    this.favoriteImages = new Set();
    this.showOnlyFavorites = false;
    this.basePrompt = '';
    this.currentColorIndex = 0;
    this.numSelectionColors = 5; // Pink, Orange, Yellow, Teal, Blue
    this.numWeightColors = 7; // Pink, Orange, Yellow, Green, Teal, Blue, Purple
    this.isDiscordMode = true; // Default to Discord mode
    this.imageWeights = new Map(); // Store weights for each selected image
    this.weightColorIndices = new Map(); // Store color indices for weight displays
    this.loadFromStorage();
    
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
        const filename = path.split('/').pop().split('\\').pop();
        
        // Extract sref from filename (before first underscore)
        // For files like "1092443072_a08d2cee-275d-4f15-b6d3-d3c369939788.webp"
        // or files in paths like "img\sref\1\1092443072_..."
        const filenameWithoutPath = filename.split('_')[0];
        
        // Extract just the numeric part, removing any directory structure
        // This handles cases where the filename might still have directory info
        const srefMatch = filenameWithoutPath.match(/(\d+)/);
        const sref = srefMatch ? srefMatch[0] : filenameWithoutPath;
        
        // For GitHub Pages, ensure we're not duplicating the basePath
        let imagePath = path;
        if (window.location.hostname.includes('github.io') && this.basePath && path.startsWith(this.basePath)) {
          // Path already contains the basePath, so use it as is
          console.log(`Path already contains basePath: ${path}`);
        } else if (window.location.hostname.includes('github.io') && this.basePath) {
          // Add basePath only once for GitHub Pages
          imagePath = `${this.basePath}/${path}`;
          console.log(`Adding basePath to path: ${imagePath}`);
        }
        
        return {
          id: path, // Keep the original path as the ID to ensure uniqueness
          sref: sref,
          path: imagePath // Use the properly constructed path
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
        const weight = this.imageWeights.get(id) || 1;
        
        if (!image) return null;
        
        // Extract only the numeric sref code from the image.sref
        // The sref should be the filename before the first underscore
        const srefCode = image.sref;
        return `${srefCode}::${weight}`;
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

  // Increase the weight of an image (1-9, cycles back to 1)
  increaseWeight(imageId) {
    if (!this.selectedImages.has(imageId)) return 1;
    
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
    if (!this.selectedImages.has(imageId)) return 1;
    
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
    // Create a data object with favorites and metadata
    const exportData = {
      version: 1,
      timestamp: new Date().toISOString(),
      app: 'PrompterAid',
      favorites: Array.from(this.favoriteImages)
    };
    
    return exportData;
  }

  /**
   * Imports favorites from a JSON file with sanitization
   * @param {Object} importData - The imported data object
   * @returns {Object} Result with success flag and message
   */
  importFavorites(importData) {
    try {
      // Validate the imported data
      if (!importData || typeof importData !== 'object') {
        return { success: false, message: 'Invalid import data format.' };
      }
      
      // Check for required properties
      if (!importData.version || !importData.app || !Array.isArray(importData.favorites)) {
        return { success: false, message: 'Import data is missing required properties.' };
      }
      
      // Validate app name to ensure it's from our application
      if (importData.app !== 'PrompterAid') {
        return { success: false, message: 'Import data is not from PrompterAid.' };
      }
      
      // Sanitize favorites array - only allow string IDs
      const sanitizedFavorites = importData.favorites.filter(id => {
        // Only accept string IDs that match our expected format
        return typeof id === 'string' && /^img\/sref\/\d+\/\d+/.test(id);
      });
      
      // Check if we have any valid favorites after sanitization
      if (sanitizedFavorites.length === 0) {
        return { success: false, message: 'No valid favorites found in import data.' };
      }
      
      // Validate against existing images to ensure they exist
      const validFavorites = sanitizedFavorites.filter(id => {
        return this.images.some(img => img.id === id);
      });
      
      // If no valid favorites after checking against existing images
      if (validFavorites.length === 0) {
        return { success: false, message: 'None of the imported favorites match your available images.' };
      }
      
      // Add the valid favorites to the current favorites
      validFavorites.forEach(id => {
        this.favoriteImages.add(id);
      });
      
      // Save to storage
      this.saveToStorage();
      
      return { 
        success: true, 
        message: `Successfully imported ${validFavorites.length} favorites.`,
        importedCount: validFavorites.length,
        totalCount: importData.favorites.length
      };
    } catch (error) {
      console.error('Error importing favorites:', error);
      return { success: false, message: 'An error occurred while importing favorites.' };
    }
  }
} 