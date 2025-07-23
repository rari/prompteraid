#!/usr/bin/env python3
"""
Update api/images.json to match the new sref-only filenames.

This script will:
1. Load the current api/images.json file
2. Extract the sref (first numeric string) from each filename
3. Update all image paths to use the new sref-only format
4. Save the updated JSON file

Example:
- "img/niji-6/1/1000932749_f29f4b24-244f-4505-9a0b-cccd447b1170.webp" -> "img/niji-6/1/1000932749.webp"
"""

import json
import re
import os
from pathlib import Path

def extract_sref(filename):
    """Extract the first numeric string from a filename."""
    # Remove extension first
    name_without_ext = os.path.splitext(filename)[0]
    # Find the first sequence of digits
    match = re.search(r'^(\d+)', name_without_ext)
    if match:
        return match.group(1)
    return None

def update_images_json():
    """Update the images.json file to use sref-only filenames."""
    
    # Path to the JSON file
    json_path = Path("api/images.json")
    
    if not json_path.exists():
        print(f"❌ Error: {json_path} not found!")
        return False
    
    print(f"📖 Loading {json_path}...")
    
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"❌ Error loading JSON: {e}")
        return False
    
    print("🔄 Updating image paths...")
    
    total_images = 0
    updated_images = 0
    skipped_images = 0
    
    # Process each set
    for set_name, set_data in data['sets'].items():
        print(f"  Processing {set_name}...")
        
        for image in set_data['images']:
            total_images += 1
            old_path = image['path']
            
            # Extract filename from path
            filename = os.path.basename(old_path)
            
            # Check if this is already in sref-only format
            if '_' not in filename:
                skipped_images += 1
                continue
            
            # Extract sref
            sref = extract_sref(filename)
            if not sref:
                print(f"    ⚠️  Could not extract sref from: {filename}")
                skipped_images += 1
                continue
            
            # Get the directory and extension
            directory = os.path.dirname(old_path)
            extension = os.path.splitext(filename)[1]
            
            # Create new path
            new_filename = f"{sref}{extension}"
            new_path = os.path.join(directory, new_filename)
            
            # Update the path
            image['path'] = new_path
            updated_images += 1
            
            if updated_images % 1000 == 0:
                print(f"    Updated {updated_images} images...")
    
    print(f"\n📊 Summary:")
    print(f"  Total images: {total_images}")
    print(f"  Updated: {updated_images}")
    print(f"  Skipped (already correct): {skipped_images}")
    
    # Save the updated JSON
    print(f"\n💾 Saving updated {json_path}...")
    
    try:
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print("✅ Successfully updated images.json!")
        return True
    except Exception as e:
        print(f"❌ Error saving JSON: {e}")
        return False

if __name__ == "__main__":
    print("🔄 Updating api/images.json to match new sref-only filenames...")
    success = update_images_json()
    if success:
        print("🎉 Done! The images.json file now matches the renamed image files.")
    else:
        print("❌ Failed to update images.json") 