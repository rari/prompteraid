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
      if(k==='p')this.togglePanel();
    });
  }
  
  shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  
  randomFrom(cat){const arr=this.words[cat];if(!arr||!arr.length)return '';return arr[Math.floor(Math.random()*arr.length)];}
  
  generate(){
    if(!this.words)return;
    
    console.log('Prompt injector generate() called');
    
    // Get selected categories from checkboxes
    const selectedCategories = [];
    const categoryIds = ['cat-presentation', 'cat-subject', 'cat-appearance', 'cat-clothing', 'cat-pose', 'cat-emotion', 'cat-setting', 'cat-lighting', 'cat-style', 'cat-details'];
    const categoryNames = ['Presentation', 'Subject', 'Appearance', 'Clothing', 'Pose', 'Emotion', 'Setting', 'Lighting', 'Style', 'Details'];
    
    categoryIds.forEach((id, index) => {
      const checkbox = document.getElementById(id);
      if (checkbox && checkbox.checked) {
        selectedCategories.push(categoryNames[index]);
      }
    });

    console.log('Selected categories:', selectedCategories);

    // Ensure at least one category is selected
    if (selectedCategories.length === 0) {
      console.log('No categories selected, returning');
      return;
    }
    
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
}

// Wait for DOM to be loaded, then initialize
document.addEventListener('DOMContentLoaded',()=>{
  const promptInjector = new PromptInjector();
  // Bind after DOM is ready
  promptInjector.bind();
}); 