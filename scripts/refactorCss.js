// scripts/refactorCss.js
// Quick one-off migration script to:
// 1. Delete redundant html.dark-mode blocks that only contain CSS custom properties
// 2. Gather the rest of html.dark-mode overrides into a single @media(prefers-color-scheme:dark)
//    wrapped in @layer components
// 3. Move rules into @layer components or utilities based on a heuristic
//    (utility = selector starts with .hidden, .sr-only, .text-*, .skip-link, etc.)
// 4. Write output to styles/working.refactored.css – you can diff & replace manually.

const fs = require('fs');
const postcss = require('postcss');
const selectorParser = require('postcss-selector-parser');

const WORKING_PATH = 'styles/working.css';
const OUTPUT_PATH  = 'styles/working.refactored.css';

const raw = fs.readFileSync(WORKING_PATH, 'utf8');

function isTokenDeclaration(decl) {
  // property contains var(-- or is only CSS custom property assignment
  if (!decl.prop) return false;
  return (
    decl.prop.startsWith('--') ||
    /var\(--/.test(decl.value)
  );
}

function looksUtility(selector) {
  return /\.(hidden|sr-only|text-|skip-link|menu-icon-style|subheader-inline|model-selector-inline)/.test(selector);
}

const root = postcss.parse(raw);

const baseLayer   = postcss.atRule({ name: 'layer', params: 'base' });
const compLayer   = postcss.atRule({ name: 'layer', params: 'components' });
const utilLayer   = postcss.atRule({ name: 'layer', params: 'utilities' });
const darkMedia   = postcss.atRule({ name: 'media', params: '(prefers-color-scheme: dark)' });

// The existing file already has @layer base; we only need to collect new rules.

root.walk(node => {
  if (node.type === 'rule') {
    const sel = node.selector.trim();

    // Handle html.dark-mode selectors
    if (sel.startsWith('html.dark-mode')) {
      // Does rule only re-declare variables?
      const onlyTokens = node.nodes.every(isTokenDeclaration);
      if (!onlyTokens) {
        const newRule = node.clone();
        // Strip html.dark-mode prefix from each selector part
        newRule.selectors = newRule.selectors.map(s => s.replace(/^html\.dark-mode\s*/,'').trim());
        darkMedia.append(newRule);
      }
      node.remove();
      return;
    }

    // Utilities vs components
    const firstSel = selectorParser(sel => sel).processSync(sel);
    if (looksUtility(firstSel)) {
      utilLayer.append(node.clone());
    } else {
      compLayer.append(node.clone());
    }
    node.remove();
  }
});

// Append consolidated structures to root
root.append(compLayer);
compLayer.append(darkMedia);
root.append(utilLayer);

fs.writeFileSync(OUTPUT_PATH, root.toResult().css, 'utf8');
console.log(`Refactor complete: wrote ${OUTPUT_PATH}`); 