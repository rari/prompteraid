import AppController from './controllers/appController.js';
import GalleryController from './controllers/galleryController.js';
import ErrorBoundary from './utils/errorBoundary.js';
import DebugUtility from './utils/debug.js';

// Initialize core utilities first
const errorBoundary = new ErrorBoundary();
const debugUtility = new DebugUtility();

// Create the controllers with error handling
const appController = new AppController();

// Wait for DOM to be fully loaded before initializing gallery
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const galleryController = new GalleryController(appController);
    
    // Make controllers and core utilities globally accessible
    window.appController = appController;
    window.galleryController = galleryController;
    window.errorBoundary = errorBoundary;
    window.debugUtility = debugUtility;
    
    // Initialize optimization utilities (optional - won't break if they fail)
    try {
      const ProgressiveLoader = (await import('./utils/progressiveLoader.js')).default;
      const VirtualScroller = (await import('./utils/virtualScroller.js')).default;
      const LoadingIndicator = (await import('./utils/loadingIndicator.js')).default;
      
      const progressiveLoader = new ProgressiveLoader();
      const loadingIndicator = new LoadingIndicator(document.body);
      
      window.progressiveLoader = progressiveLoader;
      window.loadingIndicator = loadingIndicator;
      
      // Bind loading indicator to progressive loader
      loadingIndicator.bindToProgressiveLoader(progressiveLoader);
      
      console.log('✅ Optimization utilities loaded successfully');
    } catch (optError) {
      console.warn('⚠️ Optimization utilities failed to load, continuing without them:', optError);
    }
    
    debugUtility.log('PrompterAid initialized successfully');
    console.log('✅ PrompterAid initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize PrompterAid:', error);
    errorBoundary.handleError(error);
  }
}); 