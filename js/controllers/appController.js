export default class AppController {
  constructor() {
    this.init();
  }

  init() {
    // Initialize dark mode first to set the theme immediately
    this.initDarkMode();
    
    // Disable right-click on images
    this.disableImageSaving();

    // Initialize the More Info section functionality
    this.initMoreInfoSection();
    
    // Check localStorage immediately to control page appearance
    this.checkInitialSettings();
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
      .gallery-item .quadrant-flip-button {
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
  }
} 