class PromptGenerator {
  constructor() {
    this.promptWords = null;
    this.lastGenerateTs = 0;
    this.DEBOUNCE_MS = 250;
    this.init();
  }

  async init() {
    await this.loadPromptWords();
    this.bindEvents();
  }

  async loadPromptWords() {
    try {
      const response = await fetch('data/prompt-words.json');
      this.promptWords = await response.json();
      console.log('Prompt words loaded successfully');
    } catch (error) {
      console.error('Failed to load prompt words:', error);
      this.showError('Failed to load prompt words. Please refresh the page.');
    }
  }

  bindEvents() {
    const generateBtn = document.getElementById('generate-prompt-btn');
    const copyBtn = document.getElementById('copy-btn');
    const settingsBtn = document.getElementById('prompt-settings-btn');
    const settingsPanel = document.getElementById('prompt-settings-panel');
    const promptOutput = document.getElementById('prompt-output');
    const randomizeCheckbox = document.getElementById('randomize-categories');

    // Ensure icon starts with correct classes
    const icon = generateBtn.querySelector('i');
    if (icon) {
      icon.classList.add('fa-wand-magic', 'wand-magic-icon');
      icon.classList.remove('fa-wand-magic-sparkles', 'sparkle-wand-icon');
    }

    generateBtn.addEventListener('click', () => {
      this.generatePrompt();
    });

    copyBtn.addEventListener('click', () => {
      this.copyPrompt();
    });

    settingsBtn.addEventListener('click', () => {
      this.toggleSettings();
    });

    // Handle randomize checkbox
    if (randomizeCheckbox) {
      randomizeCheckbox.addEventListener('change', () => {
        this.toggleRandomize(randomizeCheckbox.checked);
      });

      // Apply initial state on load
      console.log('[PromptGen] Randomize checkbox default state:', randomizeCheckbox.checked);
      this.toggleRandomize(randomizeCheckbox.checked);
    }

    // Keyboard shortcuts are now handled by the main GalleryController
    // to avoid conflicts and ensure consistent behavior
  }

  toggleSettings() {
    const settingsPanel = document.getElementById('prompt-settings-panel');
    const settingsBtn = document.getElementById('prompt-settings-btn');
    const icon = settingsBtn.querySelector('i');
    settingsPanel.classList.toggle('hidden');
    settingsBtn.classList.toggle('active');
    if (settingsPanel.classList.contains('hidden')) {
      icon.className = 'fas fa-cog';
    } else {
      icon.className = 'fas fa-times';
    }
  }

  toggleRandomize(enabled) {
    const categoryContainers = document.querySelectorAll('.category-checkboxes');
    const categoryIds = ['cat-presentation', 'cat-emotion', 'cat-subject', 'cat-clothing', 'cat-appearance', 'cat-pose', 'cat-setting', 'cat-lighting', 'cat-style', 'cat-details'];

    console.log('[PromptGen] toggleRandomize called. enabled=', enabled);
    if (enabled) {
      console.log('[PromptGen] Enabling randomize visual lock');
      // Save current states
      this.prevCategoryStates = {};
      categoryIds.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
          this.prevCategoryStates[id] = checkbox.checked;
          checkbox.checked = true; // visually show all selected
          checkbox.disabled = true;
        }
      });
      categoryContainers.forEach(c=>{
        c.classList.add('disabled');
      });
    } else {
      console.log('[PromptGen] Disabling randomize visual lock');
      // Restore previous states
      categoryIds.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
          checkbox.disabled = false;
          if (this.prevCategoryStates && id in this.prevCategoryStates) {
            checkbox.checked = this.prevCategoryStates[id];
          }
        }
      });
      categoryContainers.forEach(c=>{
        c.classList.remove('disabled');
      });
    }
    console.log('[PromptGen] toggleRandomize done');
  }

  buildNaturalPrompt(parts) {
    // parts: { Framing, View, Subject, Clothing, Appearance, Pose, Keyword, Effects }
    let prompt = '';
    if (parts.Framing) prompt += parts.Framing + ' ';
    if (parts.View) prompt += parts.View + ' ';
    if (parts.Subject) prompt += parts.Subject + ' ';
    if (parts.Clothing) {
      prompt += 'wearing ' + parts.Clothing + ' ';
    }
    if (parts.Appearance) {
      prompt += (parts.Clothing ? 'with ' : 'with ') + parts.Appearance + ' ';
    }
    if (parts.Pose) {
      prompt += 'is ' + parts.Pose + ', ';
    }
    if (parts.Keyword) prompt += parts.Keyword + ', ';
    if (parts.Effects) prompt += parts.Effects;
    // Clean up: remove extra spaces/commas
    return prompt.replace(/ +/g, ' ').replace(/, $/, '').trim();
  }

  generatePrompt() {
    const now = Date.now();
    if (now - this.lastGenerateTs < this.DEBOUNCE_MS) {
      console.log('[PromptGen] Ignoring rapid generate call');
      return;
    }
    this.lastGenerateTs = now;

    if (!this.promptWords) {
      this.showError('Prompt words not loaded yet. Please wait...');
      return;
    }

    const randomizeCheckbox = document.getElementById('randomize-categories');
    const isRandomizeMode = randomizeCheckbox && randomizeCheckbox.checked;

    // Get selected categories from checkboxes
    const selectedCategories = [];
    const categoryIds = ['cat-presentation', 'cat-emotion', 'cat-subject', 'cat-clothing', 'cat-appearance', 'cat-pose', 'cat-setting', 'cat-lighting', 'cat-style', 'cat-details'];
    const categoryNames = ['Presentation', 'Emotion', 'Subject', 'Clothing', 'Appearance', 'Pose', 'Setting', 'Lighting', 'Style', 'Details'];
    
    if (isRandomizeMode) {
      // In randomize mode, randomly select categories (Subject is always included)
      const availableCategories = categoryNames.filter(name => name !== 'Subject');
      const numToSelect = Math.floor(Math.random() * 4) + 2; // Select 2-5 categories plus Subject
      
      // Always include Subject
      selectedCategories.push('Subject');
      
      // Randomly select other categories
      const shuffled = this.shuffleArray(availableCategories);
      for (let i = 0; i < Math.min(numToSelect - 1, shuffled.length); i++) {
        selectedCategories.push(shuffled[i]);
      }
    } else {
      // Normal mode - get selected categories from checkboxes
    categoryIds.forEach((id, index) => {
      const checkbox = document.getElementById(id);
      if (checkbox && checkbox.checked) {
        selectedCategories.push(categoryNames[index]);
      }
    });

    // Ensure at least Subject is selected
    if (selectedCategories.length === 0) {
      this.showError('Please select at least one category.');
      return;
      }
    }

    // Get suffix from model if available, otherwise from DOM
    let suffix = '';
    if (window.galleryController && window.galleryController.model) {
      suffix = window.galleryController.model.suffix || '';
    } else {
      let suffixInput = document.getElementById('prompt-suffix');
      if (!suffixInput) suffixInput = document.getElementById('sticky-prompt-suffix');
      suffix = suffixInput ? suffixInput.value.trim() : '';
    }
    
    // Pick a random word for each selected category
    const selectedWords = {};
    selectedCategories.forEach(category => {
      const words = this.promptWords[category];
      if (words && words.length > 0) {
        const selectedWord = words[Math.floor(Math.random() * words.length)];
        
        console.log(`Selected for ${category}:`, selectedWord);
        
        // For Subject category, preserve the object structure
        if (category === 'Subject') {
          selectedWords[category] = selectedWord; // Keep the full object {name, type}
        } else {
          // For other categories, use the string value
          selectedWords[category] = selectedWord;
        }
      }
    });
    
    console.log('Final selectedWords:', selectedWords);

    // Filter categories based on subject type
    const filteredWords = this.filterCategoriesBySubjectType(selectedWords);
    
    console.log('Filtered words:', filteredWords);

    // Build a logical prompt structure
    const finalPrompt = window.promptBuilder.buildLogicalPrompt(filteredWords);
    
    // Add suffix if provided
    const fullPrompt = suffix ? `${finalPrompt} ${suffix}` : finalPrompt;
    
    // Update the display
    const finalPromptElement = document.getElementById('final-prompt');
    if (finalPromptElement) {
      finalPromptElement.textContent = fullPrompt;
    }
    // Store the full prompt for copying
    this.lastFullPrompt = fullPrompt;
  }

  filterCategoriesBySubjectType(selectedWords) {
    const filtered = { ...selectedWords };
    
    // Get subject type
    let subjectType = 'object';
    if (filtered.Subject) {
      if (typeof filtered.Subject === 'object' && filtered.Subject.type) {
        subjectType = filtered.Subject.type;
      }
    }
    
    console.log('Subject type for filtering:', subjectType);
    
    // Filter based on subject type
    if (subjectType === 'object' || subjectType === 'place') {
      // Remove clothing, appearance, pose, and emotion for objects/places
      delete filtered.Clothing;
      delete filtered.Appearance;
      delete filtered.Pose;
      delete filtered.Emotion;
      console.log('Filtered out Clothing, Appearance, Pose, Emotion for object/place');
    } else if (subjectType === 'animal') {
      // Remove clothing for animals
      delete filtered.Clothing;
      console.log('Filtered out Clothing for animal');
    }
    // humanoid subjects keep all categories
    
    return filtered;
  }

  async copyPrompt() {
    // Use the last generated full prompt (with suffix)
    const text = this.lastFullPrompt ? this.lastFullPrompt.trim() : '';
    
    if (!text) {
      this.showError('No prompt to copy!');
      return;
    }
    
    try {
      await navigator.clipboard.writeText(text);
      // Visual feedback
      const copyBtn = document.getElementById('copy-btn');
      const icon = copyBtn.querySelector('i');
      copyBtn.classList.add('copied');
      icon.className = 'fas fa-check';
      this.showSuccess('Prompt copied to clipboard!');
      // Reset after animation
      setTimeout(() => {
        copyBtn.classList.remove('copied');
        icon.className = 'far fa-clipboard';
      }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      this.showError('Failed to copy to clipboard. Please try again.');
    }
  }

  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}-notification`;
    notification.textContent = message;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Remove after delay
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  /**
   * Ensures the prompt generator panel is visible by opening the preview menu
   * if it is currently collapsed (simulates clicking the chevron button).
   */
  ensurePromptMenuVisible() {
    const previewRow = document.querySelector('.prompt-preview-row');
    const toggleBtn = document.getElementById('toggle-preview-button');
    if (previewRow && previewRow.classList.contains('hidden') && toggleBtn) {
      toggleBtn.click();
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PromptGenerator();
}); 