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
      settingsBtn.addEventListener('click',()=>this.togglePanel());
    }
    
    document.addEventListener('keydown',e=>{
      if(['INPUT','TEXTAREA'].includes(e.target.tagName))return;
      const k=e.key.toLowerCase();
      if(k==='g')this.generate();
      if(k==='p'){
        this.ensurePromptMenuVisible();
        this.togglePanel();
      }
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
  
  generate(){
    if(!this.words)return;
    
    console.log('Prompt injector generate() called');
    
    const randomizeCheckbox = document.getElementById('randomize-categories');
    const isRandomizeMode = randomizeCheckbox && randomizeCheckbox.checked;

    // Get selected categories from checkboxes or randomize
    const selectedCategories = [];
    const categoryIds = ['cat-presentation', 'cat-subject', 'cat-appearance', 'cat-clothing', 'cat-pose', 'cat-emotion', 'cat-setting', 'cat-lighting', 'cat-style', 'cat-details'];
    const categoryNames = ['Presentation', 'Subject', 'Appearance', 'Clothing', 'Pose', 'Emotion', 'Setting', 'Lighting', 'Style', 'Details'];

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

    // Build a logical prompt structure
    const finalPrompt = this.buildLogicalPrompt(selectedWords);
    
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
}

// Wait for DOM to be loaded, then initialize
document.addEventListener('DOMContentLoaded',()=>{
  const promptInjector = new PromptInjector();
  // Bind after DOM is ready
  promptInjector.bind();
}); 