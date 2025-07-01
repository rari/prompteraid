import AppController from './controllers/appController.js';
import GalleryController from './controllers/galleryController.js';

// Create the controllers
const appController = new AppController();

// Wait for DOM to be fully loaded before initializing gallery
document.addEventListener('DOMContentLoaded', () => {
  const galleryController = new GalleryController(appController);
  
  // Make controllers globally accessible for debugging and direct linking
  window.appController = appController;
  window.galleryController = galleryController;
}); 