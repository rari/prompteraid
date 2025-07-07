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
    
    // Initialize aspect ratio dropdown
    this.initAspectRatioDropdown();

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
          this.ensurePromptMenuVisible();
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
    
    // Add aspect ratio to suffix if selected
    const aspectRatioSuffix = this.getAspectRatioSuffix();
    if (aspectRatioSuffix) {
      suffix = suffix ? `${suffix} ${aspectRatioSuffix}` : aspectRatioSuffix;
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

  initAspectRatioDropdown() {
    // Handle both main and sticky panels
    this.initAspectRatioDropdownForPanel('prompt-settings-panel');
    this.initAspectRatioDropdownForPanel('sticky-prompt-settings-panel');
  }

  initAspectRatioDropdownForPanel(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;

    // Handle both main and sticky panel IDs
    const isSticky = panelId === 'sticky-prompt-settings-panel';
    const aspectRatioBtn = panel.querySelector(isSticky ? '#sticky-aspect-ratio-select' : '#aspect-ratio-select');
    const dropdownMenu = panel.querySelector(isSticky ? '#sticky-aspect-ratio-dropdown-menu' : '#aspect-ratio-dropdown-menu');
    const customRatioContainer = panel.querySelector(isSticky ? '#sticky-custom-ratio-container' : '#custom-ratio-container');
    const customRatioInput = panel.querySelector(isSticky ? '#sticky-custom-ratio-input' : '#custom-ratio-input');
    const selectedRatioSpan = panel.querySelector('.selected-ratio');

    if (!aspectRatioBtn || !dropdownMenu) {
      console.warn(`Aspect ratio dropdown elements not found in ${panelId}`);
      return;
    }

    // Toggle dropdown menu
    aspectRatioBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle('hidden');
    });

    // Handle ratio option selection
    dropdownMenu.addEventListener('click', (e) => {
      const ratioOption = e.target.closest('.ratio-option');
      if (!ratioOption) return;

      const ratio = ratioOption.dataset.ratio;
      const ratioText = ratioOption.querySelector('span').textContent;

      // Update selected ratio display for both panels
      this.updateSelectedRatioDisplay(ratioText);

      // Handle custom ratio
      if (ratio === 'custom') {
        customRatioContainer.classList.remove('hidden');
        customRatioInput.focus();
      } else {
        customRatioContainer.classList.add('hidden');
        // Store the selected ratio
        this.selectedAspectRatio = ratio;
      }

      // Update visual selection
      dropdownMenu.querySelectorAll('.ratio-option').forEach(option => {
        option.classList.remove('selected');
      });
      ratioOption.classList.add('selected');

      // Close dropdown
      dropdownMenu.classList.add('hidden');
    });

    // Handle custom ratio input
    if (customRatioInput) {
      customRatioInput.addEventListener('input', (e) => {
        const value = e.target.value.trim();
        if (value && this.isValidAspectRatio(value)) {
          this.selectedAspectRatio = value;
          this.updateSelectedRatioDisplay(`Custom: ${value}`);
        }
      });

      customRatioInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          dropdownMenu.classList.add('hidden');
        }
      });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!aspectRatioBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
        dropdownMenu.classList.add('hidden');
      }
    });

    // Set default selection
    const defaultOption = dropdownMenu.querySelector('[data-ratio="1:1"]');
    if (defaultOption) {
      defaultOption.classList.add('selected');
      this.selectedAspectRatio = '1:1';
    }
  }

  isValidAspectRatio(ratio) {
    // Simple validation for aspect ratio format (e.g., "16:9", "4:3", "1.91:1")
    const ratioPattern = /^\d+(\.\d+)?:\d+(\.\d+)?$/;
    return ratioPattern.test(ratio);
  }

  updateSelectedRatioDisplay(ratioText) {
    // Update both main and sticky panels
    const mainSpan = document.querySelector('#prompt-settings-panel .selected-ratio');
    const stickySpan = document.querySelector('#sticky-prompt-settings-panel .selected-ratio');
    
    if (mainSpan) mainSpan.textContent = ratioText;
    if (stickySpan) stickySpan.textContent = ratioText;
    
    // Also sync the visual selection in both dropdowns
    const mainDropdown = document.querySelector('#aspect-ratio-dropdown-menu');
    const stickyDropdown = document.querySelector('#sticky-aspect-ratio-dropdown-menu');
    
    if (mainDropdown && stickyDropdown) {
      // Find the selected option in main dropdown and apply same selection to sticky
      const mainSelected = mainDropdown.querySelector('.ratio-option.selected');
      if (mainSelected) {
        const ratio = mainSelected.dataset.ratio;
        const stickyOption = stickyDropdown.querySelector(`[data-ratio="${ratio}"]`);
        if (stickyOption) {
          stickyDropdown.querySelectorAll('.ratio-option').forEach(option => {
            option.classList.remove('selected');
          });
          stickyOption.classList.add('selected');
        }
      }
    }
  }

  getAspectRatioSuffix() {
    if (this.selectedAspectRatio && this.selectedAspectRatio !== '1:1') {
      return ` --ar ${this.selectedAspectRatio}`;
    }
    return '';
  }

  // Public method to re-initialize aspect ratio dropdown after sticky panel is created
  reinitAspectRatioDropdown() {
    console.log('Re-initializing aspect ratio dropdown for sticky panel');
    this.initAspectRatioDropdownForPanel('sticky-prompt-settings-panel');
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.promptGenerator = new PromptGenerator();
}); 