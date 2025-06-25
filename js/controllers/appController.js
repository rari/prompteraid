/**
 * PrompterAid Application Controller
 * 
 * Global Application Management:
 * This controller manages application-wide features and settings that are
 * independent of the main gallery functionality. It handles user preferences,
 * theme management, and global UI behaviors.
 * 
 * Primary Responsibilities:
 * - Theme management (dark/light mode) with system preference detection
 * - User preference persistence using localStorage
 * - Image protection (prevents right-click saving, drag & drop)
 * - Information panel management
 * - Global UI state initialization
 * - AI model selection (Niji 6, Midjourney v7)
 * 
 * Key Features:
 * - Automatic theme detection and switching
 * - Persistent user preferences across sessions
 * - Content protection for AI-generated images
 * - Responsive UI state management
 * - Error handling for storage operations
 * - Model switching between different AI versions
 * 
 * Storage Strategy:
 * - Uses prefixed localStorage keys to avoid conflicts
 * - Implements graceful fallbacks for storage errors
 * - Maintains backward compatibility with existing preferences
 */
export default class AppController {
  constructor() {
    this.currentModel = 'niji-6'; // Default model
    this.init();
  }

  init() {
    // Determine the model first, in a specific order of priority
    this.initializeModel();

    // Initialize dark mode first to set the theme immediately
    this.initDarkMode();
    
    // Disable right-click on images
    this.disableImageSaving();

    // Initialize the More Info section functionality
    this.initMoreInfoSection();
    
    // Initialize the News section functionality
    this.initNewsSection();
    
    // Check localStorage immediately to control page appearance
    this.checkInitialSettings();
    
    // Handle other URL parameters
    this.handleUrlParameters();
    
    // Initialize model change listener
    this.initModelChangeListener();
  }
  
  initializeModel() {
    const urlParams = new URLSearchParams(window.location.search);
    const modelFromUrl = urlParams.get('model');

    if (modelFromUrl && (modelFromUrl === 'niji-6' || modelFromUrl === 'midjourney-7')) {
      this.currentModel = modelFromUrl;
      // Also update localStorage to stay in sync
      localStorage.setItem('prompteraid_model', modelFromUrl);
      return;
    }

    const modelFromStorage = localStorage.getItem('prompteraid_model');
    if (modelFromStorage && (modelFromStorage === 'niji-6' || modelFromStorage === 'midjourney-7')) {
      this.currentModel = modelFromStorage;
      return;
    }
  }

  // Initialize model change listener
  initModelChangeListener() {
    document.addEventListener('modelChange', (e) => {
      const selectedModel = e.detail.model;
      this.changeModel(selectedModel);
    });
  }
  
  // Change the current AI model
  changeModel(modelId) {
    if (modelId !== this.currentModel) {
      console.log(`Changing model from ${this.currentModel} to ${modelId}`);
      this.currentModel = modelId;
      
      // Save to localStorage
      try {
        localStorage.setItem('prompteraid_model', modelId);
      } catch (e) {
        console.error('Failed to save model preference to localStorage:', e);
      }

      // Reload the page with the new model parameter
      const url = new URL(window.location);
      url.searchParams.set('model', modelId);
      window.location.href = url.href;
    }
  }
  
  handleUrlParameters() {
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const modelFromUrl = urlParams.get('model');
    if (modelFromUrl && (modelFromUrl === 'niji-6' || modelFromUrl === 'midjourney-7')) {
      this.currentModel = modelFromUrl;
      localStorage.setItem('prompteraid_model', modelFromUrl);
    }
    const sref = urlParams.get('sref');
    const quadrant = urlParams.get('q') || urlParams.get('quadrant'); // Support both short and long parameter names
    const searchQ = urlParams.get('q');
    // Model handling is now in initializeModel(), so we only handle sref here.
    if (sref && !searchQ) {
      // If we have a style reference in the URL, find it and focus on it
      console.log(`Looking for style reference: ${sref}`);
      // Wait for the gallery to load and the controller to be initialized
      const checkAndCreateLinkedView = () => {
        // Check if gallery controller is available
        if (!window.galleryController || !window.galleryController.view || !window.galleryController.model) {
          console.log("Gallery controller not yet available, waiting...");
          setTimeout(checkAndCreateLinkedView, 500);
          return;
        }
        // Find the image with the matching style reference
        const galleryItem = document.querySelector(`.gallery-item[data-sref="${sref}"]`);
        if (galleryItem) {
          // Create a linked view with divider
          this.createLinkedView(galleryItem, sref, quadrant);
        } else {
          console.warn(`Style reference ${sref} not found in gallery`);
        }
      };
      // Start checking
      setTimeout(checkAndCreateLinkedView, 1000);
    }
    // If q is present (search), trigger search UI and logic
    if (searchQ) {
      const trySearch = () => {
        if (!window.galleryController || !window.galleryController.view) {
          setTimeout(trySearch, 300);
          return;
        }
        // Open search UI if not already open
        const searchContainer = document.querySelector('.search-container');
        if (searchContainer && searchContainer.classList.contains('hidden')) {
          searchContainer.classList.remove('hidden');
        }
        // Set search input value
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
          searchInput.value = searchQ;
        }
        // Set searchNumber and trigger search
        window.galleryController.searchNumber = searchQ;
        window.galleryController.performSearch(searchQ);
      };
      setTimeout(trySearch, 800);
    }
  }
  
  createLinkedView(galleryItem, sref, quadrant) {
    // Get the gallery controller
    const galleryController = window.galleryController;
    
    if (!galleryController) {
      console.error("Gallery controller not available for linked view");
      return;
    }
    
    // Get the image ID from the gallery item
    const imageId = galleryItem.dataset.id;
    
    if (!imageId) {
      console.error("Image ID not found in gallery item");
      return;
    }
    
    // Find the image in the model
    const linkedImage = galleryController.model.images.find(img => img.id === imageId);
    
    if (!linkedImage) {
      console.error(`Image with ID ${imageId} not found in the model`);
      return;
    }
    
    // Clear the gallery
    galleryController.view.clearGallery();
    
    // Create the linked item
    const linkedItem = galleryController.view.createGalleryItem(
      linkedImage,
      false, // Not selected by default
      galleryController.model.favoriteImages.has(imageId),
      -1, // No color index
      this.currentModel // Pass the current model
    );
    
    // Add highlight class to make it stand out
    linkedItem.classList.add('highlight-item');
    
    // Append to gallery
    galleryController.view.gallery.appendChild(linkedItem);
    
    // Set the quadrant if specified
    if (quadrant !== null) {
      const quadrantNum = parseInt(quadrant, 10);
      if (!isNaN(quadrantNum) && quadrantNum >= 0 && quadrantNum <= 3) {
        const img = linkedItem.querySelector('img');
        
        if (img) {
          // Remove existing quadrant classes
          img.className = img.className
            .split(' ')
            .filter(cls => !cls.startsWith('quadrant-'))
            .join(' ');
          
          // Add the new quadrant class
          img.classList.add(`quadrant-${quadrantNum}`);
          
          // Store the quadrant in the gallery controller's view
          if (galleryController.view.imageQuadrants) {
            galleryController.view.imageQuadrants.set(imageId, quadrantNum);
          }
        }
      }
    }
    
    // Show the divider
    galleryController.view.showFilterDivider('linked', 1);
    
    // Get all images except the linked one
    const allImages = galleryController.model.images;
    const otherImages = allImages.filter(img => img.id !== linkedImage.id);
    
    // Append the other images
    otherImages.forEach(image => {
      const isSelected = galleryController.model.selectedImages.has(image.id);
      const isFavorite = galleryController.model.favoriteImages.has(image.id);
      
      const galleryItem = galleryController.view.createGalleryItem(
        image,
        isSelected,
        isFavorite,
        isSelected ? galleryController.model.selectedImages.get(image.id) : -1,
        this.currentModel // Pass the current model
      );
      
      galleryController.view.gallery.appendChild(galleryItem);
    });
    
    // Update weight displays
    galleryController.view.updateAllWeightDisplays(
      (imageId) => galleryController.model.getWeight(imageId),
      (imageId) => galleryController.model.getWeightColorIndex(imageId)
    );
    
    // Update image count in the header with the correct model
    galleryController.view.updateImageCountSubheader(
      allImages.length,
      galleryController.model.selectedImages.size,
      this.currentModel // Pass the current model
    );
    
    // Open the search if it exists
    const searchButton = document.querySelector('.button-search');
    const searchInput = document.getElementById('search-input');
    
    if (searchButton && searchInput) {
      // Activate search
      searchButton.classList.add('active');
      document.querySelector('.search-container')?.classList.remove('hidden');
      
      // Set the search input value to the style reference
      searchInput.value = sref;
      
      // Set the search number in the gallery controller
      galleryController.searchNumber = sref;
    }
    
    // Scroll to top to show the linked image
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Remove highlight after a few seconds
    setTimeout(() => {
      const highlightedItem = document.querySelector('.gallery-item.highlight-item');
      if (highlightedItem) {
        highlightedItem.classList.remove('highlight-item');
      }
    }, 3000);
    
    // Log to confirm the linked view is created
    console.log('Created linked view with divider and gallery');
  }

  initDarkMode() {
    // Get the theme toggle button
    this.themeToggle = document.getElementById('theme-toggle');
    
    // Remove theme modal elements
    const themeModalContainer = document.getElementById('theme-modal-container');
    if (themeModalContainer) {
      themeModalContainer.remove();
    }
    
    // Check for saved theme preference or default to dark mode
    // Add a prefix to localStorage keys to avoid conflicts with other GitHub Pages sites
    const savedTheme = localStorage.getItem('prompteraid_theme');
    
    // Set initial theme - default to dark mode if no preference is saved
    if (savedTheme) {
      this.setTheme(savedTheme);
    } else {
      // Default to dark mode
      this.setTheme('dark');
    }
    
    // Add event listener to theme toggle button
    if (this.themeToggle) {
      this.themeToggle.addEventListener('click', () => {
        // Toggle the theme immediately for better UX
        this.toggleTheme();
      });
    }
    
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      // Only auto-switch if user hasn't set a preference
      if (!localStorage.getItem('prompteraid_theme')) {
        this.setTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  setTheme(theme) {
    const isDark = theme === 'dark';
    
    // Update HTML element class for theme
    if (isDark) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
    
    // Update theme toggle icons (both main and sticky)
    const themeToggles = [
      this.themeToggle,
      document.getElementById('sticky-theme-toggle')
    ].filter(Boolean);
    
    themeToggles.forEach(toggle => {
      const icon = toggle.querySelector('i');
      if (icon) {
        icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
      }
      
      // Add appropriate color class to the button
      if (isDark) {
        toggle.classList.add('theme-toggle-dark');
        toggle.classList.remove('theme-toggle-light');
      } else {
        toggle.classList.add('theme-toggle-light');
        toggle.classList.remove('theme-toggle-dark');
      }
    });
    
    // Save preference to localStorage with prefix
    localStorage.setItem('prompteraid_theme', theme);
  }

  toggleTheme() {
    const isDarkMode = document.documentElement.classList.contains('dark-mode');
    const newTheme = isDarkMode ? 'light' : 'dark';
    this.setTheme(newTheme);
  }

  disableImageSaving() {
    // Prevent right-click context menu on images
    document.addEventListener('contextmenu', event => {
      if (event.target.tagName === 'IMG') {
        event.preventDefault();
        return false;
      }
    });

    // Prevent drag & drop of images
    document.addEventListener('dragstart', event => {
      if (event.target.tagName === 'IMG') {
        event.preventDefault();
        return false;
      }
    });

    // Prevent touch-and-hold on mobile (equivalent to right-click)
    document.addEventListener('touchstart', event => {
      if (event.target.tagName === 'IMG') {
        // Add CSS to prevent the default touch behavior
        event.target.style.webkitTouchCallout = 'none';
        event.target.style.webkitUserSelect = 'none';
      }
    }, { passive: true });

    // Add CSS rules to prevent image saving
    this.addImageProtectionStyles();
  }

  addImageProtectionStyles() {
    // Create a style element
    const style = document.createElement('style');
    style.innerHTML = `
      img {
        -webkit-touch-callout: none; /* iOS Safari */
        -webkit-user-select: none;   /* Safari */
        -khtml-user-select: none;    /* Konqueror HTML */
        -moz-user-select: none;      /* Firefox */
        -ms-user-select: none;       /* Internet Explorer/Edge */
        user-select: none;           /* Non-prefixed version */
        pointer-events: none;        /* Disable pointer events */
      }
      
      /* Re-enable pointer events for buttons and interactive elements within gallery items */
      .gallery-item button,
      .gallery-item .favorite-button,
      .gallery-item .quadrant-flip-button,
      .gallery-item .link-button {
        pointer-events: auto;
      }
    `;
    document.head.appendChild(style);
  }

  initMoreInfoSection() {
    const moreInfoContainer = document.querySelector('.more-info-container');
    const closeButton = document.getElementById('close-more-info');
    
    // Remove cookie modal
    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) {
      modalContainer.remove();
    }

    if (!moreInfoContainer || !closeButton) {
      return;
    }

    closeButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      moreInfoContainer.classList.add('hidden');
      // Save preference to localStorage with prefix
      localStorage.setItem('prompteraid_hideMoreInfo', 'true');
    });
  }

  initNewsSection() {
    const newsContainer = document.querySelector('.news-container');
    const closeButton = document.getElementById('close-news');
    
    if (!newsContainer || !closeButton) {
      return;
    }

    closeButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      newsContainer.classList.add('hidden');
      // Save preference to localStorage with prefix
      localStorage.setItem('prompteraid_hideNews', 'true');
    });
  }

  checkInitialSettings() {
    // Check theme preference
    const savedTheme = localStorage.getItem('prompteraid_theme');
    if (savedTheme) {
      this.setTheme(savedTheme);
    }
    
    // Check info section preference
    const hideMoreInfo = localStorage.getItem('prompteraid_hideMoreInfo');
    if (hideMoreInfo === 'true') {
      const moreInfoContainer = document.querySelector('.more-info-container');
      if (moreInfoContainer) {
        moreInfoContainer.classList.add('hidden');
      }
    }
    
    // Check news section preference
    const hideNews = localStorage.getItem('prompteraid_hideNews');
    if (hideNews === 'true') {
      const newsContainer = document.querySelector('.news-container');
      if (newsContainer) {
        newsContainer.classList.add('hidden');
      }
    }
  }
} 