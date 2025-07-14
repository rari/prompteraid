# Maintenance Mode Toggle Scripts

These scripts allow you to easily switch between normal site mode and maintenance mode.

## Files
- `maintenance-toggle.bat` - Windows batch script
- `maintenance-toggle.sh` - Unix/Linux shell script

## How to Use

### Windows
```bash
# Run from project root directory
scripts\maintenance-toggle.bat
```

### Unix/Linux/Mac
```bash
# Make executable (first time only)
chmod +x scripts/maintenance-toggle.sh

# Run from project root directory
./scripts/maintenance-toggle.sh
```

## What the Scripts Do

### Activating Maintenance Mode
1. Renames `index.html` to `index.html.backup`
2. Renames `maintenance.html` to `index.html`
3. Shows maintenance page to all visitors

### Restoring Normal Site
1. Deletes current `index.html` (maintenance page)
2. Renames `index.html.backup` back to `index.html`
3. Restores normal site functionality

## Safety Features
- ✅ Checks for existing backups to prevent conflicts
- ✅ Provides clear status messages
- ✅ Handles error conditions gracefully
- ✅ Shows current mode status

## Manual Override
If scripts get stuck, you can manually fix:

**To restore normal site:**
```bash
# Delete maintenance page
rm index.html

# Restore original
mv index.html.backup index.html
```

**To activate maintenance:**
```bash
# Backup original
mv index.html index.html.backup

# Activate maintenance
mv maintenance.html index.html
```

## Git Integration
Remember to commit your changes after switching modes:
```bash
git add .
git commit -m "Switch to maintenance mode"
git push
``` 