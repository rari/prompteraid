/**
 * Gallery Model
 * 
 * This model manages the state of the gallery, including:
 * - Loading and storing images
 * - Tracking selected images
 * - Managing favorites
 * - Handling weights for selected images
 */
export default class GalleryModel {
  constructor() {
    this.images = [];
    this.selectedImages = new Map(); // Map of id -> colorIndex
    this.favoriteImages = new Set();
    this.weights = new Map(); // Map of id -> weight
    this.defaultWeight = 5;
    this.minWeight = 1;
    this.maxWeight = 9;
  }

  // Load images from the provided data
  loadImages(images) {
    this.images = images;
    console.log(`Loaded ${images.length} images`);
  }

  // Toggle selection state of an image
  toggleImageSelection(id) {
    if (this.selectedImages.has(id)) {
      // Image is already selected, deselect it
      this.selectedImages.delete(id);
      this.weights.delete(id);
      return false;
    } else {
      // Image is not selected, select it with a new color index
      const colorIndex = this.getNextColorIndex();
      this.selectedImages.set(id, colorIndex);
      this.weights.set(id, this.defaultWeight);
      return true;
    }
  }

  // Get the next color index for selection
  getNextColorIndex() {
    // Find the lowest unused color index
    const usedIndices = new Set(this.selectedImages.values());
    for (let i = 0; i < 10; i++) {
      if (!usedIndices.has(i)) {
        return i;
      }
    }
    // If all indices are used, return a random one
    return Math.floor(Math.random() * 10);
  }

  // Get the color index for a selected image
  getWeightColorIndex(id) {
    return this.selectedImages.get(id) || 0;
  }

  // Toggle favorite state of an image
  toggleFavorite(id) {
    if (this.favoriteImages.has(id)) {
      this.favoriteImages.delete(id);
      return false;
    } else {
      this.favoriteImages.add(id);
      return true;
    }
  }

  // Get all selected image IDs
  getSelectedImageIds() {
    return Array.from(this.selectedImages.keys());
  }

  // Get all favorite image IDs
  getFavoriteImageIds() {
    return Array.from(this.favoriteImages);
  }

  // Clear all selected images
  clearSelectedImages() {
    console.log('Model: Clearing selected images');
    console.log('Model: Before clearing - selectedImages size:', this.selectedImages.size);
    console.log('Model: Before clearing - weights size:', this.weights.size);
    
    this.selectedImages.clear();
    this.weights.clear();
    
    console.log('Model: After clearing - selectedImages size:', this.selectedImages.size);
    console.log('Model: After clearing - weights size:', this.weights.size);
  }

  // Get weight for an image
  getWeight(id) {
    return this.weights.get(id) || this.defaultWeight;
  }

  // Increase weight for an image
  increaseWeight(id) {
    const currentWeight = this.weights.get(id) || this.defaultWeight;
    const newWeight = Math.min(currentWeight + 1, this.maxWeight);
    this.weights.set(id, newWeight);
    return newWeight;
  }

  // Decrease weight for an image
  decreaseWeight(id) {
    const currentWeight = this.weights.get(id) || this.defaultWeight;
    const newWeight = Math.max(currentWeight - 1, this.minWeight);
    this.weights.set(id, newWeight);
    return newWeight;
  }

  // Update image paths based on the selected model
  updateImagePaths(modelId) {
    // Only update if we have images loaded
    if (!this.images || this.images.length === 0) {
      console.warn('No images to update paths for');
      return;
    }
    
    console.log(`Updating image paths for model: ${modelId}`);
    
    // Update each image's path
    this.images.forEach(image => {
      // Keep the original image ID and sref
      const originalId = image.id;
      const originalSref = image.sref;
      
      // Update paths based on model
      if (modelId === 'niji-6') {
        image.path = `img/niji-6/${originalSref}.jpg`;
      } else if (modelId === 'midjourney-7') {
        image.path = `img/midjourney-7/${originalSref}.jpg`;
      }
      
      // Keep the original ID and sref
      image.id = originalId;
      image.sref = originalSref;
    });
    
    // Dispatch an event to notify that images have been updated
    const event = new CustomEvent('imagesPathsUpdated', { 
      detail: { model: modelId } 
    });
    document.dispatchEvent(event);
  }
} 