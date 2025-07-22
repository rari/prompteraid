#!/usr/bin/env python3
"""
Rename files in source-images and img subfolders to only contain the sref (first numeric string).

This script will:
1. Process all PNG files in data/source-images/*/ subfolders
2. Process all WebP files in img/*/*/ subfolders (excluding root img files)
3. Extract the first numeric string from each filename
4. Rename files to just the sref with the appropriate extension

Example:
- 1039843275_035facea-227d-4f36-a9d9-a9519de2c78c.png -> 1039843275.png
- 1071883336.webp -> 1071883336.webp (no change needed)
"""

import os
import re
import shutil
from pathlib import Path

def extract_sref(filename):
    """Extract the first numeric string from a filename."""
    # Remove extension first
    name_without_ext = os.path.splitext(filename)[0]
    
    # Find the first sequence of digits
    match = re.match(r'^(\d+)', name_without_ext)
    if match:
        return match.group(1)
    return None

def rename_files_in_directory(directory_path, file_extension):
    """Rename all files in a directory to only contain the sref."""
    directory = Path(directory_path)
    if not directory.exists():
        print(f"Directory does not exist: {directory_path}")
        return
    
    renamed_count = 0
    skipped_count = 0
    error_count = 0
    
    print(f"\nProcessing {directory_path}...")
    
    for file_path in directory.glob(f"*.{file_extension}"):
        try:
            filename = file_path.name
            sref = extract_sref(filename)
            
            if not sref:
                print(f"  ⚠️  Could not extract sref from: {filename}")
                error_count += 1
                continue
            
            # Create new filename with sref and original extension
            new_filename = f"{sref}.{file_extension}"
            new_file_path = file_path.parent / new_filename
            
            # Skip if the file is already correctly named
            if filename == new_filename:
                print(f"  ✅ Already correct: {filename}")
                skipped_count += 1
                continue
            
            # Check if target file already exists
            if new_file_path.exists():
                print(f"  ⚠️  Target already exists, skipping: {filename} -> {new_filename}")
                error_count += 1
                continue
            
            # Rename the file
            file_path.rename(new_file_path)
            print(f"  🔄 Renamed: {filename} -> {new_filename}")
            renamed_count += 1
            
        except Exception as e:
            print(f"  ❌ Error processing {filename}: {e}")
            error_count += 1
    
    print(f"  📊 Summary: {renamed_count} renamed, {skipped_count} skipped, {error_count} errors")
    return renamed_count, skipped_count, error_count

def main():
    """Main function to rename files in all relevant directories."""
    print("🔄 Starting file renaming process...")
    print("=" * 60)
    
    total_renamed = 0
    total_skipped = 0
    total_errors = 0
    
    # Process source-images subfolders (PNG files)
    source_images_root = Path("data/source-images")
    if source_images_root.exists():
        for model_dir in source_images_root.iterdir():
            if model_dir.is_dir():
                renamed, skipped, errors = rename_files_in_directory(model_dir, "png")
                total_renamed += renamed
                total_skipped += skipped
                total_errors += errors
    
    # Process img subfolders (WebP files) - exclude root img files
    img_root = Path("img")
    if img_root.exists():
        for model_dir in img_root.iterdir():
            if model_dir.is_dir():
                # Process subdirectories (numbered folders)
                for subdir in model_dir.iterdir():
                    if subdir.is_dir() and subdir.name.isdigit():
                        renamed, skipped, errors = rename_files_in_directory(subdir, "webp")
                        total_renamed += renamed
                        total_skipped += skipped
                        total_errors += errors
    
    print("\n" + "=" * 60)
    print("🎉 File renaming process completed!")
    print(f"📊 Total Summary:")
    print(f"   🔄 Renamed: {total_renamed} files")
    print(f"   ✅ Skipped: {total_skipped} files (already correct)")
    print(f"   ❌ Errors: {total_errors} files")
    print(f"   📁 Total processed: {total_renamed + total_skipped + total_errors} files")

if __name__ == "__main__":
    main() 