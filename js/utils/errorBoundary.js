/**
 * Error Boundary Utility for PrompterAid
 * 
 * Provides comprehensive error handling for:
 * - Unhandled promise rejections
 * - Async function errors
 * - JavaScript runtime errors
 * - Network request failures
 * - Image loading errors
 * 
 * Features:
 * - Graceful error recovery
 * - User-friendly error messages
 * - Error logging and reporting
 * - Automatic retry mechanisms
 * - Fallback UI states
 */

class ErrorBoundary {
  constructor() {
    this.errorCount = 0;
    this.maxErrors = 5;
    this.retryDelays = [1000, 2000, 5000, 10000]; // Exponential backoff
    this.isRecovering = false;
    
    this.init();
  }

  init() {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handlePromiseRejection(event.reason, event.promise);
    });

    // Handle JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleError(event.error, event.filename, event.lineno);
    });

    // Handle async errors
    window.addEventListener('error', (event) => {
      if (event.error && event.error.stack) {
        this.handleAsyncError(event.error);
      }
    });

    // Handle network errors
    this.interceptFetchRequests();
    
    // Handle image loading errors
    this.interceptImageErrors();
  }

  /**
   * Handle unhandled promise rejections
   */
  handlePromiseRejection(reason, promise) {
    console.error('Unhandled Promise Rejection:', reason);
    
    // Prevent the default browser behavior
    event.preventDefault();
    
    // Log the error
    this.logError('Promise Rejection', {
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise: promise
    });

    // Show user-friendly error message
    this.showErrorMessage('Something went wrong. Please try again.', 'warning');
    
    // Attempt recovery if possible
    this.attemptRecovery(reason);
  }

  /**
   * Handle JavaScript runtime errors
   */
  handleError(error, filename, lineno) {
    console.error('JavaScript Error:', error);
    
    this.logError('Runtime Error', {
      message: error?.message,
      stack: error?.stack,
      filename,
      lineno
    });

    // Don't show error for non-critical errors
    if (this.isNonCriticalError(error)) {
      return;
    }

    this.showErrorMessage('An unexpected error occurred. The page will refresh.', 'error');
    
    // Refresh page after a delay for critical errors
    setTimeout(() => {
      window.location.reload();
    }, 3000);
  }

  /**
   * Handle async function errors
   */
  handleAsyncError(error) {
    console.error('Async Error:', error);
    
    this.logError('Async Error', {
      message: error?.message,
      stack: error?.stack
    });

    this.showErrorMessage('An operation failed. Please try again.', 'warning');
  }

  /**
   * Intercept fetch requests to handle network errors
   */
  interceptFetchRequests() {
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response;
      } catch (error) {
        this.handleNetworkError(error, args[0]);
        throw error; // Re-throw to let calling code handle it
      }
    };
  }

  /**
   * Handle network request errors
   */
  handleNetworkError(error, url) {
    console.error('Network Error:', error);
    
    this.logError('Network Error', {
      message: error?.message,
      url: url?.toString(),
      stack: error?.stack
    });

    // Show appropriate error message based on error type
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      this.showErrorMessage('Network connection failed. Please check your internet connection.', 'error');
    } else if (error.message.includes('404')) {
      this.showErrorMessage('The requested resource was not found.', 'warning');
    } else if (error.message.includes('500')) {
      this.showErrorMessage('Server error. Please try again later.', 'error');
    } else {
      this.showErrorMessage('Network request failed. Please try again.', 'warning');
    }
  }

  /**
   * Intercept image loading errors
   */
  interceptImageErrors() {
    document.addEventListener('error', (event) => {
      if (event.target.tagName === 'IMG') {
        this.handleImageError(event.target);
      }
    }, true);
  }

  /**
   * Handle image loading errors
   */
  handleImageError(imgElement) {
    console.warn('Image failed to load:', imgElement.src);
    
    // Replace with placeholder or hide the element
    imgElement.style.display = 'none';
    imgElement.parentElement?.classList.add('image-error');
    
    // Add error indicator
    const errorIndicator = document.createElement('div');
    errorIndicator.className = 'image-error-indicator';
    errorIndicator.innerHTML = '<i class="fas fa-image"></i>';
    errorIndicator.title = 'Image failed to load';
    imgElement.parentElement?.appendChild(errorIndicator);
  }

  /**
   * Wrap async functions with error handling
   */
  async wrapAsync(fn, context = 'Unknown') {
    try {
      return await fn();
    } catch (error) {
      this.handleAsyncError(error);
      this.logError('Wrapped Async Error', {
        context,
        message: error?.message,
        stack: error?.stack
      });
      throw error; // Re-throw to let calling code handle it
    }
  }

  /**
   * Wrap async functions with retry logic
   */
  async wrapAsyncWithRetry(fn, maxRetries = 3, context = 'Unknown') {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          this.handleAsyncError(error);
          this.logError('Retry Failed', {
            context,
            attempts: attempt + 1,
            message: error?.message,
            stack: error?.stack
          });
          throw error;
        }
        
        // Wait before retrying
        const delay = this.retryDelays[Math.min(attempt, this.retryDelays.length - 1)];
        await this.delay(delay);
        
        console.warn(`Retry attempt ${attempt + 1} for ${context}`);
      }
    }
  }

  /**
   * Show user-friendly error messages
   */
  showErrorMessage(message, type = 'warning') {
    // Check if notification system exists
    if (window.galleryController?.view) {
      if (type === 'error') {
        window.galleryController.view.showErrorNotification(message);
      } else {
        window.galleryController.view.showInfoNotification(message);
      }
    } else {
      // Fallback to alert if notification system not available
      console.warn('Error message:', message);
    }
  }

  /**
   * Log errors for debugging and monitoring
   */
  logError(type, details) {
    const errorLog = {
      type,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      details
    };

    console.error('Error Log:', errorLog);
    
    // Store in localStorage for debugging
    try {
      const logs = JSON.parse(localStorage.getItem('prompteraid_error_logs') || '[]');
      logs.push(errorLog);
      
      // Keep only last 50 errors
      if (logs.length > 50) {
        logs.splice(0, logs.length - 50);
      }
      
      localStorage.setItem('prompteraid_error_logs', JSON.stringify(logs));
    } catch (e) {
      console.warn('Failed to log error to localStorage:', e);
    }
  }

  /**
   * Attempt to recover from errors
   */
  attemptRecovery(error) {
    if (this.isRecovering) return;
    
    this.isRecovering = true;
    
    // Try to reinitialize critical components
    setTimeout(() => {
      try {
        if (window.galleryController) {
          window.galleryController.init();
        }
      } catch (e) {
        console.error('Recovery failed:', e);
      } finally {
        this.isRecovering = false;
      }
    }, 1000);
  }

  /**
   * Check if error is non-critical
   */
  isNonCriticalError(error) {
    const nonCriticalPatterns = [
      /Script error/,
      /ResizeObserver loop limit exceeded/,
      /Network request failed/,
      /Failed to fetch/
    ];
    
    return nonCriticalPatterns.some(pattern => 
      pattern.test(error?.message || '')
    );
  }

  /**
   * Utility function for delays
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get error logs for debugging
   */
  getErrorLogs() {
    try {
      return JSON.parse(localStorage.getItem('prompteraid_error_logs') || '[]');
    } catch (e) {
      return [];
    }
  }

  /**
   * Clear error logs
   */
  clearErrorLogs() {
    localStorage.removeItem('prompteraid_error_logs');
  }

  /**
   * Check if system is in error state
   */
  isInErrorState() {
    return this.errorCount > this.maxErrors;
  }
}

// Create global error boundary instance
window.errorBoundary = new ErrorBoundary();

export default ErrorBoundary; 