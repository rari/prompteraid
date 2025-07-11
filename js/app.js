import AppController from './controllers/appController.js';
import GalleryController from './controllers/galleryController.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { supabase } from './utils/supabaseClient.js';

/**
 * PrompterAid Application Entry Point
 * 
 * Application Initialization:
 * This module serves as the main entry point for the PrompterAid application.
 * It handles application startup, GitHub Pages compatibility, and controller
 * initialization in the proper sequence.
 * 
 * GitHub Pages Compatibility:
 * Due to GitHub Pages serving from a subdirectory (e.g., /username/repo/),
 * relative paths need special handling. This module provides automatic
 * path resolution and error recovery for asset loading issues.
 */

/**
 * Sets up GitHub Pages compatibility for proper asset loading
 * 
 * Problem: GitHub Pages serves sites from subdirectories (e.g., /username/repo/),
 * which can cause relative paths to break when they start with '/'.
 * 
 * Solution: Intercepts failed resource loads and attempts to fix paths
 * by prepending the repository base path.
 */
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

/**
 * Application initialization sequence
 * 
 * Ensures proper setup order:
 * 1. GitHub Pages compatibility (if needed)
 * 2. App controller (theme, settings, global features)
 * 3. Gallery controller (main application functionality)
 */
document.addEventListener('DOMContentLoaded', () => {
  // Setup GitHub Pages compatibility
  setupGitHubPagesCompat();
  
  // Initialize keyboard shortcut manager
  const keyboardManager = new KeyboardShortcutManager();
  window.keyboardManager = keyboardManager;
  
  // Delay user components UI initialization to ensure dependencies are loaded
  setTimeout(() => {
    console.log('app.js: Initializing UserComponentsUI...');
    const userComponentsUI = new UserComponentsUI();
    window.userComponentsUI = userComponentsUI;
  }, 200);
  
  // Debug: Log keyboard shortcuts info
  setTimeout(() => {
    if (window.keyboardManager) {
      window.keyboardManager.debug();
    }
  }, 1000);
  
  // Initialize controllers in dependency order
  const appController = new AppController();  // Global app features (theme, settings)
  const galleryController = new GalleryController(appController); // Main application functionality
  
  // Make controllers accessible globally for URL parameter handling and debugging
  window.appController = appController;
  window.galleryController = galleryController;

  const discordLoginBtn = document.getElementById('discord-login-btn');
  const emailLoginBtn = document.getElementById('email-login-btn');
  const signInLabel = document.querySelector('.header-signin-label');
  const userInfo = document.getElementById('user-info');
  const userEmail = document.getElementById('user-email');
  const signOutBtn = document.getElementById('sign-out-btn');

  // Listen for auth state changes
  supabase.auth.onAuthStateChange((event, session) => {
    if (session && session.user) {
      if (discordLoginBtn) discordLoginBtn.style.display = 'none';
      if (emailLoginBtn) emailLoginBtn.style.display = 'none';
      if (signInLabel) signInLabel.style.display = 'none';
      if (userInfo && userEmail) {
        userEmail.textContent = `Hi ${session.user.email}`;
        userInfo.style.display = 'flex';
      }
    } else {
      if (discordLoginBtn) discordLoginBtn.style.display = '';
      if (emailLoginBtn) emailLoginBtn.style.display = '';
      if (signInLabel) signInLabel.style.display = '';
      if (userInfo) userInfo.style.display = 'none';
    }
  });

  // Sign out logic
  if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
      await supabase.auth.signOut();
    });
  }

  // Discord login button logic
  if (discordLoginBtn) {
    discordLoginBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await supabase.auth.signInWithOAuth({ provider: 'discord' });
    });
    discordLoginBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        discordLoginBtn.click();
      }
    });
  }

  // Email login button logic
  if (emailLoginBtn) {
    emailLoginBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const email = prompt('Enter your email to sign in:');
      if (email) {
        const { error } = await supabase.auth.signInWithOtp({ email });
        if (error) {
          alert('Error sending sign-in email: ' + error.message);
        } else {
          alert('Check your email for a sign-in link!');
        }
      }
    });
    emailLoginBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        emailLoginBtn.click();
      }
    });
  }
});