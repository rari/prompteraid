/**
 * Loading Indicator Component for PrompterAid
 * 
 * Provides visual feedback during progressive image loading
 * to improve perceived performance and user experience.
 */

class LoadingIndicator {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      showProgress: true,
      showPhaseInfo: true,
      showSkeleton: true,
      skeletonCount: 20,
      ...options
    };
    
    this.isVisible = false;
    this.currentPhase = '';
    this.progress = 0;
    this.totalItems = 0;
    this.loadedItems = 0;
    
    this.createElements();
  }

  createElements() {
    // Create loading overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'loading-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s ease, visibility 0.3s ease;
    `;

    // Create loading content
    this.content = document.createElement('div');
    this.content.className = 'loading-content';
    this.content.style.cssText = `
      text-align: center;
      color: white;
      max-width: 400px;
      padding: 2rem;
    `;

    // Create spinner
    this.spinner = document.createElement('div');
    this.spinner.className = 'loading-spinner';
    this.spinner.innerHTML = `
      <div style="
        width: 40px;
        height: 40px;
        border: 4px solid rgba(255, 255, 255, 0.3);
        border-top: 4px solid var(--neon-pink, #ff6b9d);
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 1rem;
      "></div>
    `;

    // Create title
    this.title = document.createElement('h3');
    this.title.textContent = 'Loading PrompterAid';
    this.title.style.cssText = `
      margin: 0 0 1rem;
      font-size: 1.5rem;
      color: var(--neon-pink, #ff6b9d);
    `;

    // Create phase info
    this.phaseInfo = document.createElement('div');
    this.phaseInfo.className = 'loading-phase';
    this.phaseInfo.style.cssText = `
      margin: 0 0 1rem;
      font-size: 0.9rem;
      opacity: 0.8;
    `;

    // Create progress bar
    this.progressContainer = document.createElement('div');
    this.progressContainer.className = 'loading-progress';
    this.progressContainer.style.cssText = `
      width: 100%;
      height: 8px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      overflow: hidden;
      margin: 0 0 1rem;
    `;

    this.progressBar = document.createElement('div');
    this.progressBar.className = 'loading-progress-bar';
    this.progressBar.style.cssText = `
      height: 100%;
      background: linear-gradient(90deg, var(--neon-pink, #ff6b9d), var(--neon-orange, #ff9f43));
      width: 0%;
      transition: width 0.3s ease;
    `;

    // Create progress text
    this.progressText = document.createElement('div');
    this.progressText.className = 'loading-progress-text';
    this.progressText.style.cssText = `
      font-size: 0.8rem;
      opacity: 0.7;
    `;

    // Create skeleton loader
    this.skeletonContainer = document.createElement('div');
    this.skeletonContainer.className = 'loading-skeleton';
    this.skeletonContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--background-primary, #0e1117);
      z-index: 9998;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s ease, visibility 0.3s ease;
    `;

    // Assemble the loading indicator
    this.progressContainer.appendChild(this.progressBar);
    this.content.appendChild(this.spinner);
    this.content.appendChild(this.title);
    this.content.appendChild(this.phaseInfo);
    this.content.appendChild(this.progressContainer);
    this.content.appendChild(this.progressText);
    this.overlay.appendChild(this.content);

    // Add to container
    this.container.appendChild(this.overlay);
    this.container.appendChild(this.skeletonContainer);

    // Add CSS animation
    this.addCSSAnimation();
  }

  addCSSAnimation() {
    if (!document.getElementById('loading-animations')) {
      const style = document.createElement('style');
      style.id = 'loading-animations';
      style.textContent = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        
        .skeleton-item {
          background: linear-gradient(90deg, 
            rgba(255, 255, 255, 0.1) 25%, 
            rgba(255, 255, 255, 0.2) 50%, 
            rgba(255, 255, 255, 0.1) 75%
          );
          background-size: 200% 100%;
          animation: skeleton-pulse 1.5s ease-in-out infinite;
          border-radius: 8px;
          margin-bottom: 1rem;
        }
      `;
      document.head.appendChild(style);
    }
  }

  show() {
    this.isVisible = true;
    this.overlay.style.opacity = '1';
    this.overlay.style.visibility = 'visible';
    
    if (this.options.showSkeleton) {
      this.showSkeleton();
    }
  }

  hide() {
    this.isVisible = false;
    this.overlay.style.opacity = '0';
    this.overlay.style.visibility = 'hidden';
    
    if (this.options.showSkeleton) {
      this.hideSkeleton();
    }
  }

  showSkeleton() {
    this.skeletonContainer.style.opacity = '1';
    this.skeletonContainer.style.visibility = 'visible';
    this.createSkeletonItems();
  }

  hideSkeleton() {
    this.skeletonContainer.style.opacity = '0';
    this.skeletonContainer.style.visibility = 'hidden';
  }

  createSkeletonItems() {
    this.skeletonContainer.innerHTML = '';
    
    for (let i = 0; i < this.options.skeletonCount; i++) {
      const skeletonItem = document.createElement('div');
      skeletonItem.className = 'skeleton-item';
      skeletonItem.style.cssText = `
        height: 200px;
        margin: 1rem;
        border-radius: 8px;
      `;
      this.skeletonContainer.appendChild(skeletonItem);
    }
  }

  updateProgress(loaded, total, phase = '') {
    this.loadedItems = loaded;
    this.totalItems = total;
    this.progress = total > 0 ? (loaded / total) * 100 : 0;
    this.currentPhase = phase;

    // Update progress bar
    this.progressBar.style.width = `${this.progress}%`;

    // Update progress text
    this.progressText.textContent = `${loaded} of ${total} images loaded`;

    // Update phase info
    if (this.options.showPhaseInfo && phase) {
      this.phaseInfo.textContent = `Phase: ${phase}`;
    }

    // Update title with progress
    if (this.options.showProgress) {
      this.title.textContent = `Loading PrompterAid (${Math.round(this.progress)}%)`;
    }
  }

  updatePhase(phase, description = '') {
    this.currentPhase = phase;
    this.phaseInfo.textContent = description || `Phase: ${phase}`;
  }

  setTitle(title) {
    this.title.textContent = title;
  }

  showError(message) {
    this.title.textContent = 'Loading Error';
    this.title.style.color = 'var(--neon-orange, #ff9f43)';
    this.phaseInfo.textContent = message;
    this.progressContainer.style.display = 'none';
    this.progressText.style.display = 'none';
  }

  showSuccess(message = 'Loading Complete!') {
    this.title.textContent = message;
    this.title.style.color = 'var(--neon-green, #10b981)';
    this.progressBar.style.background = 'var(--neon-green, #10b981)';
    
    // Hide after a short delay
    setTimeout(() => {
      this.hide();
    }, 1000);
  }

  // Integration with ProgressiveLoader
  bindToProgressiveLoader(progressiveLoader) {
    progressiveLoader.onProgress = (image, loadedCount) => {
      this.updateProgress(loadedCount, progressiveLoader.data?.length || 0);
    };

    progressiveLoader.onPhaseStart = (phaseName, startIndex, count) => {
      this.updatePhase(phaseName, `Loading ${count} images (${startIndex + 1}-${startIndex + count})`);
    };

    progressiveLoader.onPhaseComplete = (phaseName) => {
      this.updatePhase(phaseName, `${phaseName} phase complete`);
    };

    progressiveLoader.onComplete = (loadedImages) => {
      this.showSuccess();
    };
  }

  // Utility methods
  isVisible() {
    return this.isVisible;
  }

  getProgress() {
    return {
      progress: this.progress,
      loaded: this.loadedItems,
      total: this.totalItems,
      phase: this.currentPhase
    };
  }

  destroy() {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    if (this.skeletonContainer && this.skeletonContainer.parentNode) {
      this.skeletonContainer.parentNode.removeChild(this.skeletonContainer);
    }
  }
}

// Create global instance
window.loadingIndicator = new LoadingIndicator(document.body);

export default LoadingIndicator; 