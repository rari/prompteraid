class PromptInjector{
  constructor(){
    this.words=null;
    this.load();
  }
  
  async load(){
    try{
      const r=await fetch('data/prompt-words.json');
      this.words=await r.json();
      // Don't bind here - wait for DOM to be ready
    }catch(e){
      console.error('Failed to load prompt words:', e);
    }
  }
  
  bind(){
    const genBtn = document.getElementById('generate-prompt-btn');
    if (genBtn) {
      genBtn.addEventListener('click',()=>{
        this.generate();
      });
    }
    
    const settingsBtn = document.getElementById('prompt-settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click',()=>{
        console.log('[PromptInjector] Settings button clicked');
        this.togglePanel();
      });
    }
    
    // Keyboard shortcuts are now handled by the centralized KeyboardShortcutManager

    // Randomize checkbox logic
    const randomizeCheckbox = document.getElementById('randomize-categories');
    if(randomizeCheckbox){
      randomizeCheckbox.addEventListener('change',()=>this.toggleRandomizeVisual(randomizeCheckbox.checked));
      // apply initial
      this.toggleRandomizeVisual(randomizeCheckbox.checked);
    }
  }
  
  shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  
  randomFrom(cat){const arr=this.words[cat];if(!arr||!arr.length)return '';return arr[Math.floor(Math.random()*arr.length)];}
  
  generate() {
    console.log('Prompt injector generate() called');
    
    const randomizeCheckbox = document.getElementById('randomize-categories');
    const isRandomizeMode = randomizeCheckbox && randomizeCheckbox.checked;

    // Get selected categories from checkboxes
    const selectedCategories = [];
    const categoryIds = ['cat-presentation', 'cat-emotion', 'cat-subject', 'cat-clothing', 'cat-appearance', 'cat-pose', 'cat-setting', 'cat-lighting', 'cat-style', 'cat-details'];
    const categoryNames = ['Presentation', 'Emotion', 'Subject', 'Clothing', 'Appearance', 'Pose', 'Setting', 'Lighting', 'Style', 'Details'];

    if (isRandomizeMode) {
      // Randomly select categories (Subject always included)
      const available = categoryNames.filter(n => n !== 'Subject');
      // choose 2-5 categories total including Subject
      const numToSelect = Math.floor(Math.random()*4)+2;
      selectedCategories.push('Subject');
      const shuffled = this.shuffle([...available]);
      for(let i=0;i<Math.min(numToSelect-1,shuffled.length);i++){
        selectedCategories.push(shuffled[i]);
      }
    } else {
      categoryIds.forEach((id,index)=>{
        const checkbox=document.getElementById(id);
        if(checkbox&&checkbox.checked){selectedCategories.push(categoryNames[index]);}
      });
      if(selectedCategories.length===0){
        console.log('No categories selected, returning');
        return;
      }
    }

    console.log('Selected categories:', selectedCategories);

    // Pick a random word for each selected category
    const selectedWords = {};
    selectedCategories.forEach(category => {
      const words = this.words[category];
      if (words && words.length > 0) {
        selectedWords[category] = words[Math.floor(Math.random() * words.length)];
      }
    });

    console.log('Selected words:', selectedWords);

    // Filter categories based on subject type
    const filteredWords = this.filterCategoriesBySubjectType(selectedWords);
    
    console.log('Filtered words:', filteredWords);

    // Build a logical prompt structure
    // Use shared promptBuilder
    const finalPrompt = window.promptBuilder.buildLogicalPrompt(filteredWords);
    
    console.log('Final prompt:', finalPrompt);
    
    // Update the input field with just the base prompt (suffix is handled by main app)
    const input = document.getElementById('prompt-input');
    if (input) {
      console.log('Found prompt input, setting value to:', finalPrompt);
      input.value = finalPrompt;
      
      // Use the main application's prompt system to preserve prefix and suffix
      if (window.galleryController && window.galleryController.model) {
        console.log('Found gallery controller, calling setBasePrompt and updatePrompt');
        window.galleryController.model.setBasePrompt(finalPrompt);
        window.galleryController.updatePrompt();
      } else {
        console.log('Gallery controller not found:', {
          galleryController: window.galleryController,
          model: window.galleryController?.model
        });
      }
      
      // Trigger the input event to integrate with the main application
      console.log('Dispatching input event');
      input.dispatchEvent(new Event('input', {bubbles: true}));
    } else {
      console.log('Prompt input not found');
    }
  }
  
  togglePanel(){
    console.log('[PromptInjector] togglePanel() called');
    
    const panel = document.getElementById('prompt-settings-panel');
    const stickyPanel = document.getElementById('sticky-prompt-settings-panel');
    const stickyActionBar = document.getElementById('sticky-action-bar');
    
    console.log('[PromptInjector] Panel elements found:', {
      panel: !!panel,
      stickyPanel: !!stickyPanel,
      stickyActionBar: !!stickyActionBar
    });
    
    // If we are about to OPEN the panel, ensure preview row is visible first
    const willOpen = panel && panel.classList.contains('hidden');
    console.log('[PromptInjector] Will open settings panel:', willOpen);
    
    if (willOpen) {
      console.log('[PromptInjector] Calling ensurePromptMenuVisible() from togglePanel');
      this.ensurePromptMenuVisible();
    }
    
    if (panel) {
      panel.classList.toggle('hidden');
    }
    
    // Also toggle the sticky panel if it exists
    if (stickyPanel) {
      stickyPanel.classList.toggle('hidden');
    }
    
    // Toggle the settings-open class on the sticky action bar
    if (stickyActionBar) {
      stickyActionBar.classList.toggle('settings-open');
    }
    
    const settingsBtn = document.getElementById('prompt-settings-btn');
    if (settingsBtn) {
      settingsBtn.classList.toggle('active');
    }
    
    // Update the sticky settings button if it exists
    const stickySettingsBtn = document.getElementById('sticky-prompt-settings-btn');
    if (stickySettingsBtn) {
      stickySettingsBtn.classList.toggle('active');
    }
    
    console.log('[PromptInjector] Settings panel toggled, hidden:', panel ? panel.classList.contains('hidden') : 'panel not found');
  }
  


  toggleRandomizeVisual(enabled){
    const containers=document.querySelectorAll('.category-checkboxes');
    const ids=['cat-presentation','cat-emotion','cat-subject','cat-clothing','cat-appearance','cat-pose','cat-setting','cat-lighting','cat-style','cat-details'];
    if(enabled){
      this.prevStates={};
      ids.forEach(id=>{
        const cb=document.getElementById(id);
        if(cb){
          this.prevStates[id]=cb.checked;
          cb.checked=true;
          cb.disabled=true;
        }
      });
      containers.forEach(c=>c.classList.add('disabled'));
    }else{
      ids.forEach(id=>{
        const cb=document.getElementById(id);
        if(cb){
          cb.disabled=false;
          if(this.prevStates&&id in this.prevStates){
            cb.checked=this.prevStates[id];
          }
        }
      });
      containers.forEach(c=>c.classList.remove('disabled'));
    }
  }

  ensurePromptMenuVisible(){
    console.log('[PromptInjector] ensurePromptMenuVisible() called');
    
    const previewRow=document.querySelector('.prompt-preview-row');
    const toggleBtn=document.getElementById('toggle-preview-button');
    
    console.log('[PromptInjector] Elements found:', {
      previewRow: !!previewRow,
      toggleBtn: !!toggleBtn
    });
    
    if(previewRow&&previewRow.classList.contains('hidden')&&toggleBtn){
      console.log('[PromptInjector] Preview row is hidden, clicking toggle button');
      toggleBtn.click();
    } else {
      console.log('[PromptInjector] Preview row not hidden or toggle button not found');
    }
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
}

// Wait for DOM to be loaded, then initialize
document.addEventListener('DOMContentLoaded',()=>{
  const promptInjector = new PromptInjector();
  // Bind after DOM is ready
  promptInjector.bind();
  // Make available globally for keyboard shortcuts
  window.promptInjector = promptInjector;
}); 