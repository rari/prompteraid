#!/usr/bin/env python3
"""
Git Pre-commit Hook for PrompterAid
Automatically updates sitemap.xml before committing changes.
"""

import os
import sys
import subprocess
from pathlib import Path

# Import the sitemap updater
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from update_sitemap import update_sitemap

def check_if_html_files_changed():
    """Check if any HTML files in the sitemap have been modified."""
    try:
        # Get list of staged files
        result = subprocess.run(['git', 'diff', '--cached', '--name-only'], 
                              capture_output=True, text=True, check=True)
        
        staged_files = result.stdout.strip().split('\n')
        
        # Check if any sitemap HTML files are staged
        sitemap_files = ['index.html', 'privacy.html', 'terms.html', '404.html']
        sitemap_files.append('docs.html')
        
        for file in staged_files:
            if file in sitemap_files:
                return True
                
        return False
        
    except subprocess.CalledProcessError as e:
        print(f"⚠️  Warning: Could not check staged files: {e}")
        return False

def main():
    """Main function for the pre-commit hook."""
    print("🔍 Checking for HTML file changes...")
    
    # Only update sitemap if HTML files have changed
    if check_if_html_files_changed():
        print("📝 HTML files detected in commit. Updating sitemap...")
        
        # Change to the repository root
        try:
            repo_root = subprocess.run(['git', 'rev-parse', '--show-toplevel'], 
                                     capture_output=True, text=True, check=True).stdout.strip()
            os.chdir(repo_root)
        except subprocess.CalledProcessError as e:
            print(f"❌ Error: Could not find repository root: {e}")
            sys.exit(1)
        
        # Update the sitemap
        if update_sitemap():
            print("✅ Sitemap updated successfully!")
            
            # Stage the updated sitemap
            try:
                subprocess.run(['git', 'add', 'sitemap.xml'], check=True)
                print("📦 Updated sitemap.xml staged for commit")
            except subprocess.CalledProcessError as e:
                print(f"⚠️  Warning: Could not stage updated sitemap.xml: {e}")
        else:
            print("❌ Failed to update sitemap!")
            sys.exit(1)
    else:
        print("ℹ️  No HTML files changed. Skipping sitemap update.")

if __name__ == "__main__":
    main() 