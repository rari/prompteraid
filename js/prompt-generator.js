class PromptGenerator {
  constructor() {
    this.promptWords = null;
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
    }

    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Only trigger shortcuts if not typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'g':
          this.generatePrompt();
          break;
        case 'c':
          this.copyPrompt();
          break;
        case 'p':
          this.toggleSettings();
          break;
      }
    });
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
    const categoryCheckboxes = document.querySelector('.category-checkboxes');
    const categoryIds = ['cat-presentation', 'cat-emotion', 'cat-subject', 'cat-clothing', 'cat-appearance', 'cat-pose', 'cat-setting', 'cat-lighting', 'cat-style', 'cat-details'];
    
    if (enabled) {
      // Disable all category checkboxes
      categoryCheckboxes.classList.add('disabled');
      categoryIds.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
          checkbox.disabled = true;
        }
      });
      // Always ensure Subject is checked when randomize is enabled
      const subjectCheckbox = document.getElementById('cat-subject');
      if (subjectCheckbox) {
        subjectCheckbox.checked = true;
      }
    } else {
      // Re-enable all category checkboxes
      categoryCheckboxes.classList.remove('disabled');
      categoryIds.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
          checkbox.disabled = false;
        }
      });
    }
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
        selectedWords[category] = words[Math.floor(Math.random() * words.length)];
      }
    });

    // Build a logical prompt structure
    const finalPrompt = this.buildLogicalPrompt(selectedWords);
    
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

  buildLogicalPrompt(parts) {
    // Build a logical, readable prompt structure
    let prompt = '';
    
    // <presentation>
    if (parts.Presentation) {
      prompt += parts.Presentation + ' of ';
    }
    
    // <emotion> <subject>
    if (parts.Emotion) {
      prompt += parts.Emotion + ' ';
    }
    if (parts.Subject) {
      prompt += parts.Subject;
    }
    
    // wearing <clothing>
    if (parts.Clothing) {
      prompt += ' wearing ' + parts.Clothing;
    }
    
    // with <appearance>
    if (parts.Appearance) {
      prompt += ' with ' + parts.Appearance;
    }
    
    // is <pose>
    if (parts.Pose) {
      prompt += ' is ' + parts.Pose;
    }
    
    // at <setting>
    if (parts.Setting) {
      prompt += ' at ' + parts.Setting;
    }
    
    // , <lighting>
    if (parts.Lighting) {
      prompt += ', ' + parts.Lighting;
    }
    
    // , <style>
    if (parts.Style) {
      prompt += ', ' + parts.Style;
    }
    
    // , <details>
    if (parts.Details) {
      prompt += ', ' + parts.Details;
    }
    
    // Clean up: remove extra spaces and commas
    prompt = prompt.replace(/\s+/g, ' ').replace(/,\s*,/g, ',').replace(/^,\s*/, '').replace(/,\s*$/, '');
    
    return prompt;
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
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PromptGenerator();
}); 