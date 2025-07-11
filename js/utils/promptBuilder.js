/**
 * Shared prompt building utilities for PrompterAid
 * 
 * This module contains common logic for building AI art prompts
 * that is shared between different prompt generation components.
 */

// Global variable to store loaded prompt words data
let promptWordsData = null;

/**
 * Set the prompt words data (called when data is loaded)
 * @param {Object} data - The loaded prompt words data
 */
function setPromptWordsData(data) {
  promptWordsData = data;
}

/**
 * Get subject type from loaded data
 * @param {string} subject - The subject name to check
 * @returns {string} The subject type ('humanoid', 'animal', 'object', 'place', or 'unknown')
 */
function getSubjectType(subject) {
  if (!subject || !promptWordsData) return 'unknown';
  
  const normalized = subject.toLowerCase();
  
  // Check all subjects in the Subject array
  if (promptWordsData.Subject && promptWordsData.Subject.some(s => s.name.toLowerCase() === normalized)) {
    const subjectObj = promptWordsData.Subject.find(s => s.name.toLowerCase() === normalized);
    return subjectObj ? subjectObj.type : 'object';
  }
  
  return 'object';
}

/**
 * Build a logical, readable prompt structure from word parts
 * @param {Object} parts - Object containing category words (Presentation, Emotion, Subject, etc.)
 * @returns {string} Formatted prompt string
 */
function buildLogicalPrompt(parts) {
  let prompt = '';
  
  // Extract subject name and type
  let subjectName = '';
  let subjectType = 'object';
  
  if (parts.Subject) {
    if (typeof parts.Subject === 'object' && parts.Subject.name) {
      // Subject is an object with name and type
      subjectName = parts.Subject.name;
      subjectType = parts.Subject.type;
    } else if (typeof parts.Subject === 'string') {
      // Subject is a string, get type from data
      subjectName = parts.Subject;
      subjectType = getSubjectType(parts.Subject);
    }
  }

  // <presentation>
  if (parts.Presentation) {
    prompt += parts.Presentation + ' of ';
  }

  // <emotion> <subject>
  if (parts.Emotion) {
    prompt += parts.Emotion + ' ';
  }
  if (subjectName) {
    prompt += subjectName;
  }

  if (subjectType === 'humanoid') {
    if (parts.Clothing) {
      prompt += ' wearing ' + parts.Clothing;
    }
    if (parts.Appearance) {
      prompt += ' with ' + parts.Appearance;
    }
    if (parts.Pose) {
      prompt += ' is ' + parts.Pose;
    }
  } else if (subjectType === 'animal') {
    if (parts.Appearance) {
      prompt += ' with ' + parts.Appearance;
    }
    if (parts.Pose) {
      prompt += ' is ' + parts.Pose;
    }
  }

  // at <setting>
  if (parts.Setting) {
    prompt += ' at ' + parts.Setting;
  }

  // , <lighting>
  if (parts.Lighting) {
    prompt += ', ' + parts.Lighting;
  }

  // , <details>
  if (parts.Details) {
    prompt += ', ' + parts.Details;
  }

  // Clean up: remove extra spaces and commas
  prompt = prompt.replace(/\s+/g, ' ').replace(/,\s*,/g, ',').replace(/^,\s*/, '').replace(/,\s*$/, '');

  return prompt;
}

/**
 * Standard category configuration for prompt generation
 */
const PROMPT_CATEGORIES = {
  ids: ['cat-presentation', 'cat-subject', 'cat-appearance', 'cat-clothing', 'cat-pose', 'cat-emotion', 'cat-setting', 'cat-lighting', 'cat-style', 'cat-details'],
  names: ['Presentation', 'Subject', 'Appearance', 'Clothing', 'Pose', 'Emotion', 'Setting', 'Lighting', 'Style', 'Details']
};

/**
 * Get selected categories from checkboxes or randomize
 * @param {boolean} isRandomizeMode - Whether to randomize category selection
 * @returns {Array} Array of selected category names
 */
function getSelectedCategories(isRandomizeMode = false) {
  const selectedCategories = [];
  
  if (isRandomizeMode) {
    // Randomly select categories (Subject always included)
    const available = PROMPT_CATEGORIES.names.filter(n => n !== 'Subject');
    // choose 2-5 categories total including Subject
    const numToSelect = Math.floor(Math.random() * 4) + 2;
    selectedCategories.push('Subject');
    const shuffled = shuffle([...available]);
    for (let i = 0; i < Math.min(numToSelect - 1, shuffled.length); i++) {
      selectedCategories.push(shuffled[i]);
    }
  } else {
    // Get selected categories from checkboxes
    PROMPT_CATEGORIES.ids.forEach((id, index) => {
      const checkbox = document.getElementById(id);
      if (checkbox && checkbox.checked) {
        selectedCategories.push(PROMPT_CATEGORIES.names[index]);
      }
    });
  }
  
  return selectedCategories;
}

/**
 * Shuffle array using Fisher-Yates algorithm
 * @param {Array} array - Array to shuffle
 * @returns {Array} Shuffled array
 */
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
} 

// Expose globally for non-module scripts
if (typeof window !== 'undefined') {
  window.promptBuilder = window.promptBuilder || {};
  window.promptBuilder.buildLogicalPrompt = buildLogicalPrompt;
  window.promptBuilder.setPromptWordsData = setPromptWordsData;
  window.promptBuilder.getSelectedCategories = getSelectedCategories;
  window.promptBuilder.shuffle = shuffle;
  window.promptBuilder.PROMPT_CATEGORIES = PROMPT_CATEGORIES;
} 