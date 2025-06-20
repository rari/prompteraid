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
            if (Array.isArray(data) && data.length > 0) {
              console.log(`Successfully loaded ${data.length} images from ${path}`);
              return data;
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