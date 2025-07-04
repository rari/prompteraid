import re

# List of old footer-related CSS selectors to remove
FOOTER_SELECTORS = [
    r'\.site-footer', r'\.modern-footer', r'\.footer-wave', r'\.footer-content', r'\.footer-main',
    r'\.footer-brand-section', r'\.footer-brand', r'\.footer-logo-container', r'\.footer-logo', r'\.logo-glow',
    r'\.brand-text', r'\.footer-title', r'\.footer-subtitle', r'\.footer-links-section', r'\.social-links',
    r'\.social-link', r'\.social-label', r'\.footer-bottom', r'\.footer-credit', r'\.creator-link',
    r'\.tool-link', r'\.footer-legal',
]

# Compile a regex pattern to match any of the selectors at the start of a CSS rule
selector_pattern = re.compile(r'^(\s*)(' + '|'.join(FOOTER_SELECTORS) + r')[^\{]*\{', re.MULTILINE)

# Read the CSS file
with open('styles/main.css', 'r', encoding='utf-8') as f:
    css = f.read()

# Function to remove a CSS block given the start index of the opening brace
def remove_css_block(text, start):
    depth = 0
    for i in range(start, len(text)):
        if text[i] == '{':
            depth += 1
        elif text[i] == '}':
            depth -= 1
            if depth == 0:
                return text[:start] + text[i+1:]
    return text  # fallback

# Remove all matching blocks
matches = list(selector_pattern.finditer(css))
removed = 0
for match in reversed(matches):
    start = match.start()
    open_brace = css.find('{', start)
    if open_brace != -1:
        css = remove_css_block(css, open_brace)
        removed += 1

# Save the cleaned CSS
with open('styles/main.css', 'w', encoding='utf-8') as f:
    f.write(css)

print(f"Removed {removed} old footer CSS blocks.") 