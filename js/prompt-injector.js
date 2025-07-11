class PromptInjector{
  constructor(){
    this.words=null;
    this.lastGenerateTs=0;
    this.DEBOUNCE_MS=250;
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
      settingsBtn.addEventListener('click',()=>this.togglePanel());
    }
    
    document.addEventListener('keydown',e=>{
      if(['INPUT','TEXTAREA'].includes(e.target.tagName))return;
      const k=e.key.toLowerCase();
      
      // Only handle 'p' key, let other keys pass through to main controller
      if(k==='p'){
        this.ensurePromptMenuVisible();
        this.togglePanel();
      }
      // Note: 'g' key for generate and 'a' key for randomize are handled by the main gallery controller
    });

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
    const now=Date.now();
    if(now-this.lastGenerateTs<this.DEBOUNCE_MS){console.log('[PromptInjector] Ignoring rapid generate');return;}
    this.lastGenerateTs=now;
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
    const panel = document.getElementById('prompt-settings-panel');
    const stickyPanel = document.getElementById('sticky-prompt-settings-panel');
    const stickyActionBar = document.getElementById('sticky-action-bar');
    
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
    const previewRow=document.querySelector('.prompt-preview-row');
    const toggleBtn=document.getElementById('toggle-preview-button');
    if(previewRow&&previewRow.classList.contains('hidden')&&toggleBtn){
      toggleBtn.click();
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
  // Make it globally accessible for the gallery controller
  window.promptInjector = promptInjector;
  // Bind after DOM is ready
  promptInjector.bind();
}); 