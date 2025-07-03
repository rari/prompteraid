#!/bin/bash
# Sitemap Updater Shell Script for PrompterAid
# This script runs the Python sitemap updater

echo "🔄 Running PrompterAid Sitemap Updater..."
echo

# Change to the project root directory (assuming script is run from scripts folder)
cd "$(dirname "$0")/.."

# Run the Python script
python3 scripts/deploy/update_sitemap.py

echo
echo "Press Enter to continue..."
read 