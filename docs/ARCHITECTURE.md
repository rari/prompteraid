# PrompterAid Architecture Documentation

## 🧜‍♀️ Welcome to PrompterAid! 🧜‍♀️

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

🐚 Welcome, human! 🐚

🌊 Dive into the depths of AI art creation with our mermaid-themed style library!

You've discovered a magical realm of mermaids! Here, every style reference is a
pearl of wisdom, every prompt a treasure map to stunning creations.

🧜‍♀️ Make a splash and create with us! xoxo Jenna Juffuffles 🧜‍♀️

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

## Component Architecture

### 1. Main Menu (input-group)
- Primary interaction point
- Contains all action buttons with consistent styling
- Uses semantic class names for button actions (e.g., button-trash, button-star)

### 2. Sticky Header
- Cloned from main menu for consistency
- Appears on scroll (controlled by galleryView.js)
- Maintains identical functionality with main menu

### 3. Button System
Each button has:
- Unique ID for JavaScript targeting
- Semantic class for styling (action-button)
- Action-specific class for color theming (button-*)
- Font Awesome icon

### 4. Event Delegation
- Main menu buttons are primary event sources
- Sticky header buttons delegate to main menu
- All state changes flow through main menu buttons

## AI Maintenance Notes

- Maintain button order consistency between menus
- Preserve class naming conventions for styling inheritance
- Keep IDs unique between main and sticky menus (sticky-* prefix)
- Ensure Font Awesome classes stay consistent (fas vs far)

## File Structure

```
prompteraid/
├── index.html              # Main application page
├── privacy.html            # Privacy policy
├── terms.html              # Terms of service
├── 404.html               # Error page
├── js/                     # JavaScript modules
│   ├── app.js             # Main application logic
│   ├── controllers/       # MVC controllers
│   ├── models/            # Data models
│   └── views/             # UI views
├── styles/                # CSS stylesheets
├── img/                   # Image assets
├── data/                  # Data files
├── scripts/               # Utility scripts
└── docs/                  # Documentation
```

## SEO Considerations

- Clean HTML structure starting with DOCTYPE
- Proper meta tags and structured data
- Semantic HTML elements
- Accessibility features
- Mobile-responsive design 