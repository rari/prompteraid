# PrompterAid Scripts

This directory contains utility scripts for maintaining the PrompterAid website.

## 📁 Script Categories

### 🔄 Sitemap Management
**Location:** `sitemap/`

Automated tools for keeping your sitemap.xml current with file modification dates.

- **Main Script:** `update_sitemap.py` - Updates lastmod dates in sitemap.xml
- **Wrappers:** `update_sitemap.bat` (Windows) and `update_sitemap.sh` (Unix/Linux/macOS)
- **Git Integration:** `pre-commit-hook.py` and `setup_git_hook.py` for automatic updates
- **Documentation:** See `sitemap/README.md` for detailed usage instructions

### 🖼️ Image Processing
**Location:** Root of scripts/

Tools for processing and organizing image assets.

- **`process_images.py`** - Process and organize image files
- **`move-it.py`** - Move and organize files
- **`requirements.txt`** - Python dependencies for image processing

## 🚀 Quick Start

### Update Sitemap
```bash
# Windows
scripts\sitemap\update_sitemap.bat

# Unix/Linux/macOS
./scripts/sitemap/update_sitemap.sh

# Direct Python
python scripts/sitemap/update_sitemap.py
```

### Setup Git Hook (Automatic Sitemap Updates)
```bash
# Install
python scripts/sitemap/setup_git_hook.py

# Uninstall
python scripts/sitemap/setup_git_hook.py --uninstall
```

## 📋 Requirements

- Python 3.6+
- Git (for hook functionality)
- Access to project files

## 🛠️ Development

All scripts are designed to be:
- **Cross-platform** - Work on Windows, macOS, and Linux
- **Self-contained** - Minimal external dependencies
- **Well-documented** - Clear usage instructions and examples
- **Error-handled** - Graceful handling of edge cases

## 📖 Documentation

Each script category has its own README with detailed instructions:
- `sitemap/README.md` - Complete sitemap updater documentation 