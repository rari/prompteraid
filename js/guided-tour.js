// Shepherd.js Guided Tour for PrompterAid
// Steps: Mode Toggle, Model Selector, Gallery, Prompt Generator, Copy Button

document.addEventListener('DOMContentLoaded', function() {
  const startTourBtn = document.getElementById('start-tour-link');
  if (!startTourBtn || typeof Shepherd === 'undefined') return;

  const tour = new Shepherd.Tour({
    defaultStepOptions: {
      scrollTo: { behavior: 'smooth', block: 'center' },
      cancelIcon: { enabled: true },
      classes: 'shepherd-theme-arrows',
      modalOverlayOpeningPadding: 6,
      modalOverlayOpeningRadius: 8
    }
  });

  tour.addStep({
    title: 'Select Mode',
    text: 'Switch between Discord and Website modes to get the right format for your platform.',
    attachTo: { element: '#mode-toggle', on: 'bottom' },
    buttons: [
      { text: 'Next', action: tour.next }
    ]
  });

  tour.addStep({
    title: 'Choose a Model',
    text: 'Switch between NijiJourney 6 and Midjourney 7 using the model selector.',
    attachTo: { element: '#image-count-subheader .model-selector', on: 'bottom' },
    buttons: [
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  });

  tour.addStep({
    title: 'Browse & Select Styles',
    text: 'Scroll through the style library and click on images to select them for your prompt.',
    attachTo: { element: '#image-gallery', on: 'top' },
    scrollTo: false,
    scrollToHandler: () => {
      // Scroll the gallery container into view, but keep header/prompt visible
      const gallery = document.getElementById('gallery-top');
      if (gallery) {
        const y = gallery.getBoundingClientRect().top + window.scrollY - 80; // offset for header
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    },
    buttons: [
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  });

  tour.addStep({
    title: 'Generate Prompt',
    text: 'Use the prompt generator or create your own.',
    attachTo: { element: '#generate-prompt-btn', on: 'top' },
    scrollTo: false,
    scrollToHandler: () => {
      // Scroll the prompt area into view
      const prompt = document.querySelector('.prompt-container');
      if (prompt) {
        const y = prompt.getBoundingClientRect().top + window.scrollY - 40;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    },
    buttons: [
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  });

  tour.addStep({
    title: 'Copy & Use',
    text: 'Copy the final prompt to use in your AI art tool.',
    attachTo: { element: '#copy-button', on: 'top' },
    buttons: [
      { text: 'Back', action: tour.back },
      { text: 'Finish', action: tour.complete }
    ]
  });

  startTourBtn.addEventListener('click', function(e) {
    e.preventDefault();
    tour.start();
  });
}); 