/**
 * Progressive Loading Utility for PrompterAid
 * 
 * This utility implements staged loading to improve perceived performance
 * and reduce search engine suspicion by loading images progressively
 * instead of all at once.
 */

class ProgressiveLoader {
  constructor() {
    this.loadingPhases = [
      { delay: 0, count: 50, name: 'initial' },
      { delay: 100, count: 100, name: 'quick' },
      { delay: 500, count: 200, name: 'medium' },
      { delay: 1000, count: 300, name: 'slow' },
      { delay: 2000, count: null, name: 'remaining' } // null means load all remaining
    ];
    
    this.loadedImages = new Set();
    this.isLoading = false;
    this.onProgress = null;
    this.onComplete = null;
  }

  /**
   * Load images progressively in phases
   */
  async loadImagesProgressively(allImages, options = {}) {
    if (this.isLoading) {
      console.warn('Progressive loading already in progress');
      return;
    }

    this.isLoading = true;
    this.loadedImages.clear();
    
    const {
      onProgress = () => {},
      onComplete = () => {},
      onPhaseStart = () => {},
      onPhaseComplete = () => {}
    } = options;

    this.onProgress = onProgress;
    this.onComplete = onComplete;

    let processedCount = 0;
    const totalImages = allImages.length;

    console.log(`Starting progressive loading of ${totalImages} images`);

    // Phase 1: Immediate load of first batch
    await this.loadPhase(allImages, 0, this.loadingPhases[0].count, {
      onPhaseStart: () => onPhaseStart('initial', 0, this.loadingPhases[0].count),
      onPhaseComplete: () => onPhaseComplete('initial')
    });
    processedCount += this.loadingPhases[0].count;

    // Subsequent phases with delays
    for (let i = 1; i < this.loadingPhases.length; i++) {
      const phase = this.loadingPhases[i];
      
      // Wait for the specified delay
      await this.delay(phase.delay);
      
      const startIndex = processedCount;
      const endIndex = phase.count === null 
        ? totalImages 
        : Math.min(processedCount + phase.count, totalImages);
      
      if (startIndex >= totalImages) break;

      await this.loadPhase(allImages, startIndex, endIndex - startIndex, {
        onPhaseStart: () => onPhaseStart(phase.name, startIndex, endIndex - startIndex),
        onPhaseComplete: () => onPhaseComplete(phase.name)
      });
      
      processedCount = endIndex;
    }

    this.isLoading = false;
    console.log(`Progressive loading completed. Loaded ${this.loadedImages.size} images`);
    this.onComplete(this.loadedImages);
  }

  /**
   * Load a specific phase of images
   */
  async loadPhase(allImages, startIndex, count, callbacks = {}) {
    const { onPhaseStart, onPhaseComplete } = callbacks;
    
    if (onPhaseStart) onPhaseStart();
    
    const endIndex = Math.min(startIndex + count, allImages.length);
    const phaseImages = allImages.slice(startIndex, endIndex);
    
    console.log(`Loading phase: ${startIndex} to ${endIndex} (${phaseImages.length} images)`);
    
    // Load images in small batches to avoid blocking
    const batchSize = 10;
    for (let i = 0; i < phaseImages.length; i += batchSize) {
      const batch = phaseImages.slice(i, i + batchSize);
      
      // Load batch asynchronously
      await Promise.all(batch.map(image => this.loadSingleImage(image)));
      
      // Small delay between batches to prevent blocking
      if (i + batchSize < phaseImages.length) {
        await this.delay(10);
      }
    }
    
    if (onPhaseComplete) onPhaseComplete();
  }

  /**
   * Load a single image
   */
  async loadSingleImage(image) {
    if (this.loadedImages.has(image.id)) {
      return image;
    }

    try {
      // Preload the image
      await this.preloadImage(image.path);
      this.loadedImages.add(image.id);
      
      if (this.onProgress) {
        this.onProgress(image, this.loadedImages.size);
      }
      
      return image;
    } catch (error) {
      console.warn(`Failed to load image ${image.id}:`, error);
      return image; // Return image even if preload fails
    }
  }

  /**
   * Preload an image
   */
  preloadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      
      // Set a timeout to prevent hanging
      const timeout = setTimeout(() => {
        reject(new Error(`Image load timeout: ${src}`));
      }, 10000); // 10 second timeout
      
      img.onload = () => {
        clearTimeout(timeout);
        resolve(img);
      };
      
      img.onerror = () => {
        clearTimeout(timeout);
        reject(new Error(`Failed to load image: ${src}`));
      };
      
      img.src = src;
    });
  }

  /**
   * Utility function for delays
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get loading progress
   */
  getProgress() {
    return {
      isLoading: this.isLoading,
      loadedCount: this.loadedImages.size,
      loadedImages: Array.from(this.loadedImages)
    };
  }

  /**
   * Cancel ongoing loading
   */
  cancel() {
    this.isLoading = false;
    console.log('Progressive loading cancelled');
  }

  /**
   * Check if an image is loaded
   */
  isImageLoaded(imageId) {
    return this.loadedImages.has(imageId);
  }

  /**
   * Get all loaded image IDs
   */
  getLoadedImageIds() {
    return Array.from(this.loadedImages);
  }
}

// Create global instance
window.progressiveLoader = new ProgressiveLoader();

export default ProgressiveLoader; 