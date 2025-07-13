#!/usr/bin/env python3
"""
Fix duplicate entries in images.json

This script removes duplicate image entries from the images.json file
based on the path field. It preserves the first occurrence of each path
and removes subsequent duplicates.
"""

import json
import sys
from pathlib import Path

def fix_duplicates_in_images_json():
    """Remove duplicate entries from images.json based on path field."""
    
    # Define paths
    project_root = Path(__file__).parent.parent
    json_path = project_root / "api" / "images.json"
    
    if not json_path.exists():
        print(f"Error: {json_path} does not exist")
        return False
    
    print(f"Loading {json_path}...")
    
    # Load the JSON file
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error loading JSON file: {e}")
        return False
    
    # Track duplicates and fixes
    total_duplicates = 0
    fixes_made = False
    
    # Process each model's images
    for model_id, model_data in data.get("sets", {}).items():
        if "images" not in model_data:
            continue
            
        images = model_data["images"]
        original_count = len(images)
        
        # Track seen paths to identify duplicates
        seen_paths = set()
        unique_images = []
        duplicates_found = []
        
        for img in images:
            path = img.get("path", "")
            if path in seen_paths:
                # This is a duplicate
                duplicates_found.append(path)
                total_duplicates += 1
            else:
                # First time seeing this path
                seen_paths.add(path)
                unique_images.append(img)
        
        # Update the model's images with deduplicated list
        if duplicates_found:
            print(f"\nModel {model_id}:")
            print(f"  Original count: {original_count}")
            print(f"  After deduplication: {len(unique_images)}")
            print(f"  Duplicates removed: {len(duplicates_found)}")
            print("  Duplicate paths:")
            for dup in duplicates_found:
                print(f"    - {dup}")
            
            model_data["images"] = unique_images
            fixes_made = True
        else:
            print(f"\nModel {model_id}: No duplicates found ({original_count} images)")
    
    if fixes_made:
        # Write the fixed JSON back to file
        print(f"\nWriting fixed JSON to {json_path}...")
        try:
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            print(f"Successfully removed {total_duplicates} duplicate entries")
            return True
        except Exception as e:
            print(f"Error writing JSON file: {e}")
            return False
    else:
        print("\nNo duplicates found. File is already clean.")
        return True

def main():
    """Main function to run the duplicate fixing script."""
    print("🔧 PrompterAid Duplicate Image Fixer")
    print("=" * 40)
    
    success = fix_duplicates_in_images_json()
    
    if success:
        print("\n✅ Duplicate fixing completed successfully!")
    else:
        print("\n❌ Duplicate fixing failed!")
        sys.exit(1)

if __name__ == "__main__":
    main() 