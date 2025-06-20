import AppController from './controllers/appController.js';
import GalleryController from './controllers/galleryController.js';

// GitHub Pages compatibility helper
// Detect if we're on GitHub Pages and handle path issues
function setupGitHubPagesCompat() {
  // Check if we're on GitHub Pages (*.github.io domain)
  const isGitHubPages = window.location.hostname.includes('github.io');
  
  if (isGitHubPages) {
    console.info('GitHub Pages detected, applying compatibility fixes');
    
    // Add event listener to handle any asset loading errors
    window.addEventListener('error', function(e) {
      // Check if the error is related to loading a resource
      if (e.target && (e.target.tagName === 'SCRIPT' || e.target.tagName === 'LINK' || e.target.tagName === 'IMG')) {
        console.warn('Resource failed to load:', e.target.src || e.target.href);
        
        // Try to fix the path if it's a relative path starting with /
        const src = e.target.src || e.target.href;
        if (src && src.startsWith(window.location.origin + '/')) {
          // Get the base path from the current URL
          const basePath = window.location.pathname.split('/').slice(0, -1).join('/');
          const newSrc = window.location.origin + basePath + src.substring(window.location.origin.length);
          
          console.info('Attempting to fix path:', src, '->', newSrc);
          
          // Set the new source
          if (e.target.tagName === 'SCRIPT' || e.target.tagName === 'IMG') {
            e.target.src = newSrc;
          } else if (e.target.tagName === 'LINK') {
            e.target.href = newSrc;
          }
        }
      }
    }, true); // Use capture phase to catch errors before they bubble up
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Setup GitHub Pages compatibility
  setupGitHubPagesCompat();
  
  // Initialize controllers
  new AppController();
  new GalleryController();
});