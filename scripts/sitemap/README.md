# PrompterAid Scripts

This directory contains utility scripts for maintaining the PrompterAid website.

## Sitemap Updater

The sitemap updater automatically updates the `lastmod` dates in `sitemap.xml` based on when HTML files were last modified.

### Files

- `update_sitemap.py` - Main Python script
- `update_sitemap.bat` - Windows batch file
- `update_sitemap.sh` - Unix/Linux/macOS shell script
- `pre-commit-hook.py` - Git pre-commit hook
- `setup_git_hook.py` - Hook installation script

## Deployment Script

The deployment script merges changes from the `explore` branch to `master` and pushes for live deployment.

### Files

- `deploy_to_master.py` - Main Python deployment script
- `deploy_to_master.bat` - Windows batch file

### Usage

#### Manual Update

**Windows:**
```bash
# From project root
scripts\sitemap\update_sitemap.bat

# Or directly with Python
python scripts/sitemap/update_sitemap.py
```

**Unix/Linux/macOS:**
```bash
# From project root
./scripts/sitemap/update_sitemap.sh

# Or directly with Python
python3 scripts/sitemap/update_sitemap.py
```

#### Automatic Updates with Git Hook

Install the pre-commit hook to automatically update the sitemap when HTML files are committed:

```bash
# Install the hook
python scripts/sitemap/setup_git_hook.py

# Uninstall the hook (if needed)
python scripts/sitemap/setup_git_hook.py --uninstall

# Check authentication status
python scripts/sitemap/check-auth.py
```

#### Deploy to Master

Deploy changes from the `explore` branch to `master` for live deployment:

```bash
# Windows
scripts\sitemap\deploy_to_master.bat

# Or directly with Python
python scripts/sitemap/deploy_to_master.py

# Get help
python scripts/sitemap/deploy_to_master.py --help
```

**Note:** Make sure you're on the `explore` branch before running the deployment script.

### What It Does

The script:

1. Scans the HTML files listed in `sitemap.xml`:
   - `index.html`
   - `privacy.html`
   - `terms.html`
   - `404.html`

2. Gets the modification date of each file

3. Updates the corresponding `lastmod` entry in `sitemap.xml`

4. Shows which files were updated and which were already current

### Example Output

```
🔄 Updating PrompterAid sitemap.xml...
==================================================
✅ Updated index.html: 2024-12-19 → 2024-12-20
ℹ️  privacy.html: Already up to date (2024-12-19)
ℹ️  terms.html: Already up to date (2024-12-19)
ℹ️  404.html: Already up to date (2024-12-19)

🎉 Successfully updated 1 entries in sitemap.xml

✅ Sitemap update completed successfully!
```

### Benefits

- **SEO Improvement**: Keeps sitemap dates current for search engines
- **Automation**: No need to manually update dates
- **Consistency**: Ensures all pages have accurate modification dates
- **Git Integration**: Can run automatically before commits

### Requirements

- Python 3.6+
- Git (for hook functionality)
- Access to the project files

### Troubleshooting

**Script not found:**
- Make sure you're running from the project root directory
- Check that Python is installed and in your PATH

**Permission errors (Unix/Linux/macOS):**
```bash
chmod +x scripts/update_sitemap.sh
```

**Git hook not working:**
- Ensure you're in a Git repository
- Check that the hook file exists in `.git/hooks/pre-commit`
- Verify the hook file is executable
- Run `python scripts/sitemap/check-auth.py` to verify authentication

**Authentication issues:**
- The scripts work with any GitHub authentication method (PAT, SSH, etc.)
- Your account (rari) is properly configured and authenticated
- If you encounter issues, run the authentication check script 