/**
 * Debug Utility for PrompterAid
 * 
 * Provides debugging tools and system health monitoring
 */

class DebugUtility {
  constructor() {
    this.isDebugMode = localStorage.getItem('prompteraid_debug_mode') === 'true';
    this.init();
  }

  init() {
    // Add debug mode toggle to console
    if (this.isDebugMode) {
      this.setupDebugCommands();
    }

    // Monitor system health
    this.startHealthMonitoring();
  }

  setupDebugCommands() {
    // Add debug commands to window for console access
    window.debugPrompterAid = {
      // Get error logs
      getErrors: () => {
        const logs = window.errorBoundary?.getErrorLogs() || [];
        console.table(logs);
        return logs;
      },

      // Clear error logs
      clearErrors: () => {
        window.errorBoundary?.clearErrorLogs();
        console.log('Error logs cleared');
      },

      // Get system state
      getState: () => {
        const state = {
          galleryController: !!window.galleryController,
          appController: !!window.appController,
          errorBoundary: !!window.errorBoundary,
          currentModel: window.galleryController?.model?.currentModel,
          imageCount: window.galleryController?.model?.images?.length || 0,
          selectedCount: window.galleryController?.model?.selectedImages?.size || 0,
          favoritesCount: window.galleryController?.model?.favoriteImages?.size || 0,
          isInErrorState: window.errorBoundary?.isInErrorState() || false
        };
        console.table(state);
        return state;
      },

      // Test error handling
      testError: () => {
        console.log('Testing error handling...');
        throw new Error('Test error for debugging');
      },

      // Test async error
      testAsyncError: async () => {
        console.log('Testing async error handling...');
        await new Promise((resolve, reject) => {
          setTimeout(() => reject(new Error('Test async error')), 100);
        });
      },

      // Toggle debug mode
      toggleDebug: () => {
        const newMode = !this.isDebugMode;
        localStorage.setItem('prompteraid_debug_mode', newMode.toString());
        this.isDebugMode = newMode;
        console.log(`Debug mode ${newMode ? 'enabled' : 'disabled'}. Refresh page to apply.`);
      },

      // Performance monitoring
      getPerformance: () => {
        const perf = performance.getEntriesByType('navigation')[0];
        const metrics = {
          loadTime: perf.loadEventEnd - perf.loadEventStart,
          domContentLoaded: perf.domContentLoadedEventEnd - perf.domContentLoadedEventStart,
          firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime,
          firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime
        };
        console.table(metrics);
        return metrics;
      }
    };

    console.log('🔧 PrompterAid Debug Mode Enabled');
    console.log('Available commands:');
    console.log('- debugPrompterAid.getErrors() - View error logs');
    console.log('- debugPrompterAid.clearErrors() - Clear error logs');
    console.log('- debugPrompterAid.getState() - View system state');
    console.log('- debugPrompterAid.testError() - Test error handling');
    console.log('- debugPrompterAid.testAsyncError() - Test async error handling');
    console.log('- debugPrompterAid.getPerformance() - View performance metrics');
    console.log('- debugPrompterAid.toggleDebug() - Toggle debug mode');
  }

  startHealthMonitoring() {
    // Only start monitoring if debug mode is enabled
    if (!this.isDebugMode) return;
    
    // Monitor memory usage (less frequently)
    if ('memory' in performance) {
      this.memoryMonitorId = setInterval(() => {
        const memory = performance.memory;
        const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
        
        // Only warn if usage is very high (>85%)
        if (usagePercent > 85) {
          console.warn('High memory usage detected:', {
            used: Math.round(memory.usedJSHeapSize / 1024 / 1024) + 'MB',
            limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024) + 'MB',
            usage: Math.round(usagePercent) + '%'
          });
        }
      }, 60000); // Check every minute instead of 30 seconds
    }

    // Monitor for memory leaks (less frequently)
    let lastImageCount = 0;
    let consecutiveIncreases = 0;
    
    this.leakMonitorId = setInterval(() => {
      const currentImageCount = window.galleryController?.model?.images?.length || 0;
      
      if (currentImageCount > lastImageCount + 50) { // Reduced threshold
        consecutiveIncreases++;
        if (consecutiveIncreases > 2) { // Only warn after 3 consecutive large increases
          console.warn('Possible memory leak detected:', {
            previousCount: lastImageCount,
            currentCount: currentImageCount,
            increase: currentImageCount - lastImageCount
          });
        }
      } else {
        consecutiveIncreases = 0; // Reset counter
      }
      
      lastImageCount = currentImageCount;
    }, 120000); // Check every 2 minutes instead of 1 minute
  }

  stopHealthMonitoring() {
    if (this.memoryMonitorId) {
      clearInterval(this.memoryMonitorId);
      this.memoryMonitorId = null;
    }
    
    if (this.leakMonitorId) {
      clearInterval(this.leakMonitorId);
      this.leakMonitorId = null;
    }
  }

  destroy() {
    this.stopHealthMonitoring();
    this.isDebugMode = false;
  }

  log(message, data = null) {
    if (this.isDebugMode) {
      console.log(`[PrompterAid Debug] ${message}`, data);
    }
  }

  warn(message, data = null) {
    if (this.isDebugMode) {
      console.warn(`[PrompterAid Debug] ${message}`, data);
    }
  }

  error(message, data = null) {
    if (this.isDebugMode) {
      console.error(`[PrompterAid Debug] ${message}`, data);
    }
  }
}

// Create global debug utility instance
window.debugUtility = new DebugUtility();

export default DebugUtility; 