#!/usr/bin/env python3
"""
Sitemap Updater for PrompterAid
Automatically updates lastmod dates in sitemap.xml based on file modification times.
"""

import os
import sys
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

# Add the parent directory to the path so we can import from the root
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def get_file_modification_date(file_path):
    """Get the modification date of a file in YYYY-MM-DD format."""
    try:
        stat = os.stat(file_path)
        mod_time = datetime.fromtimestamp(stat.st_mtime)
        return mod_time.strftime('%Y-%m-%d')
    except (OSError, FileNotFoundError):
        return None

def update_sitemap():
    """Update the sitemap.xml file with current lastmod dates."""
    
    # Define the pages in the sitemap and their corresponding file paths
    sitemap_pages = {
        'https://www.prompteraid.com/': 'index.html',
        'https://www.prompteraid.com/privacy.html': 'privacy.html',
        'https://www.prompteraid.com/terms.html': 'terms.html',
        'https://www.prompteraid.com/docs.html': 'docs.html',
        'https://www.prompteraid.com/about.html': 'about.html',
    }
    
    sitemap_path = Path('sitemap.xml')
    
    if not sitemap_path.exists():
        print("❌ Error: sitemap.xml not found!")
        return False
    
    try:
        # Parse the existing sitemap
        tree = ET.parse(sitemap_path)
        root = tree.getroot()
        
        # Define the namespace
        namespace = {'sitemap': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
        
        updated_count = 0
        
        # Update each URL entry
        for url_elem in root.findall('.//sitemap:url', namespace):
            loc_elem = url_elem.find('sitemap:loc', namespace)
            if loc_elem is None:
                continue
                
            url = loc_elem.text
            if url in sitemap_pages:
                file_path = sitemap_pages[url]
                
                # Get the current modification date
                mod_date = get_file_modification_date(file_path)
                
                if mod_date:
                    # Find or create the lastmod element
                    lastmod_elem = url_elem.find('sitemap:lastmod', namespace)
                    if lastmod_elem is None:
                        lastmod_elem = ET.SubElement(url_elem, 'lastmod')
                    
                    old_date = lastmod_elem.text
                    lastmod_elem.text = mod_date
                    
                    if old_date != mod_date:
                        print(f"✅ Updated {file_path}: {old_date} → {mod_date}")
                        updated_count += 1
                    else:
                        print(f"ℹ️  {file_path}: Already up to date ({mod_date})")
                else:
                    print(f"⚠️  Warning: Could not get modification date for {file_path}")
        
        # Write the updated sitemap
        tree.write(sitemap_path, encoding='UTF-8', xml_declaration=True)
        
        if updated_count > 0:
            print(f"\n🎉 Successfully updated {updated_count} entries in sitemap.xml")
        else:
            print("\n✨ Sitemap is already up to date!")
            
        return True
        
    except ET.ParseError as e:
        print(f"❌ Error parsing sitemap.xml: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def main():
    """Main function to run the sitemap updater."""
    print("🔄 Updating PrompterAid sitemap.xml...")
    print("=" * 50)
    
    success = update_sitemap()
    
    if success:
        print("\n✅ Sitemap update completed successfully!")
    else:
        print("\n❌ Sitemap update failed!")
        sys.exit(1)

if __name__ == "__main__":
    main() 