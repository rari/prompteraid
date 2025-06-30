class PromptInjector{constructor(){this.words=null;this.load();}
async load(){try{const r=await fetch('prompt-words.json');this.words=await r.json();this.bind();}catch(e){console.error(e);}}
bind(){
  const genBtn = document.getElementById('generate-prompt-btn');
  genBtn.addEventListener('click',()=>{
    this.generate();
  });
  document.getElementById('prompt-settings-btn').addEventListener('click',()=>this.togglePanel());
  document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA'].includes(e.target.tagName))return;const k=e.key.toLowerCase();if(k==='g')this.generate();if(k==='p')this.togglePanel();});
}
shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
randomFrom(cat){const arr=this.words[cat];if(!arr||!arr.length)return '';return arr[Math.floor(Math.random()*arr.length)];}
generate(){if(!this.words)return;
  // Get selected categories from checkboxes
  const selectedCategories = [];
  const categoryIds = ['cat-camera', 'cat-subject', 'cat-appearance', 'cat-clothing', 'cat-pose', 'cat-emotion', 'cat-setting', 'cat-lighting', 'cat-style', 'cat-details'];
  const categoryNames = ['Camera', 'Subject', 'Appearance', 'Clothing', 'Pose', 'Emotion', 'Setting', 'Lighting', 'Style', 'Details'];
  
  categoryIds.forEach((id, index) => {
    const checkbox = document.getElementById(id);
    if (checkbox && checkbox.checked) {
      selectedCategories.push(categoryNames[index]);
    }
  });

  // Ensure at least one category is selected
  if (selectedCategories.length === 0) {
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

  // Build a logical prompt structure
  const finalPrompt = this.buildLogicalPrompt(selectedWords);
  
  // Update the input field with just the base prompt (suffix is handled by main app)
  const input = document.getElementById('prompt-input');
  input.value = finalPrompt;
  
  // Trigger the input event to integrate with the main application
  input.dispatchEvent(new Event('input', {bubbles: true}));
  
  // Update the preview
  const preview = document.getElementById('final-prompt');
  if (preview) preview.textContent = finalPrompt;
}
togglePanel(){const panel=document.getElementById('prompt-settings-panel');panel.classList.toggle('hidden');document.getElementById('prompt-settings-btn').classList.toggle('active');}
buildLogicalPrompt(parts) {
  // Build a logical, readable prompt structure
  let prompt = '';
  
  // <camera>
  if (parts.Camera) {
    prompt += parts.Camera + ' of ';
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
document.addEventListener('DOMContentLoaded',()=>new PromptInjector()); 