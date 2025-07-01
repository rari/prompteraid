"""
File Management Script for PrompterAid Image Pipeline

This module manages the workflow of moving images from a downloads folder to the
processing pipeline. It handles file organization, duplicate detection, and
preparation for the main processing script (process.py).

The script works with two AI model folders:
- niji6: Niji Journey v6 anime-style images
- mj7: Midjourney v7 photorealistic images

Workflow:
1. Rename files in downloads folder to standardized format
2. Check for duplicate IDs (files with same numeric prefix)
3. Copy cleaned files to source-images for processing
4. Generate comprehensive reports of all operations

This script is typically run before process.py to prepare files for web processing.

Author: PrompterAid Team
"""

import os
import re
import shutil
import time
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from PIL import Image
import sys

# --- CONFIG ---
PROJECT_ROOT = Path(r"C:/Users/imiko/Documents/GitHub/website/prompteraid")
SOURCE_IMG_ROOT = PROJECT_ROOT / "data" / "source-images"  # Destination for processed files
DOWNLOADS_SREF_ROOT = Path(r"C:/Users/imiko/Downloads/sref")  # Source downloads folder
MODEL_FOLDERS = {"niji6": "niji-6", "mj7": "midjourney-7"}  # Model ID to folder mapping

def clean_filename(filename: str) -> str:
    """
    Standardize filenames by removing unwanted text and fixing formatting.
    
    Removes specific substrings (jennajuffuffles, mermaid), normalizes spaces
    and underscores, and ensures consistent naming pattern.
    
    Args:
        filename: Original filename to clean
        
    Returns:
        Cleaned filename with standardized format
    """
    # Remove unwanted substrings and fix underscores/spaces
    name = filename
    name = re.sub(r'jennajuffuffles|mermaid', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s+', '', name)
    name = re.sub(r'_+', '_', name)
    name = re.sub(r'^_+|_+$', '', name)
    # Ensure only one underscore (between numeric and rest)
    parts = name.split('_', 1)
    if len(parts) == 2:
        name = f"{parts[0]}_{parts[1]}"
    else:
        name = parts[0]
    return name

def restart_script() -> None:
    """Restart the script from the beginning after resolving conflicts."""
    print("Conflicts resolved. Restarting from the beginning...")
    python = sys.executable
    os.execv(python, [python] + sys.argv)

def get_image_size(image_path: Path) -> Optional[Tuple[int, int]]:
    """
    Get image dimensions without loading the full image into memory.
    
    Args:
        image_path: Path to the image file
        
    Returns:
        Tuple of (width, height) or None if image cannot be read
    """
    try:
        with Image.open(image_path) as img:
            return img.size
    except Exception:
        return None

def rename_and_check_duplicates_in_model_folders() -> List[str]:
    """
    Rename files in downloads folder and resolve conflicts/duplicates.
    
    Processes all PNG files in the downloads model folders, cleaning filenames
    and handling conflicts when multiple files would have the same name.
    Provides interactive resolution for conflicts and duplicate detection.
    
    Returns:
        List of report messages describing actions taken
    """
    report: List[str] = []
    conflicts_resolved = False
    
    while True:  # Loop until all conflicts are resolved
        current_conflicts = False
        
        for model_id, folder in MODEL_FOLDERS.items():
            folder_path = DOWNLOADS_SREF_ROOT / folder
            if not folder_path.exists():
                continue
                
            print(f"\nProcessing {model_id} model folder...")
            print(f"  Processing folder: {folder_path}")
            seen: Dict[str, Path] = {}
            dups: List[Tuple[Path, Path]] = []
            
            for png in folder_path.glob("*.png"):
                new_name = clean_filename(png.name)
                new_path = png.parent / new_name
                
                if png.name != new_name:
                    if new_path.exists():
                        print(f"\nCONFLICT: {png} would be renamed to {new_path}, but it already exists.")
                        
                        # Check if images are different sizes
                        size1 = get_image_size(png)
                        size2 = get_image_size(new_path)
                        show_images = False
                        
                        if size1 and size2 and size1 != size2:
                            print(f"Images have different sizes: {size1} vs {size2}")
                            show_images = True
                        elif size1 and size2 and size1 == size2:
                            print(f"Images have the same size: {size1}")
                            show_images = input("Show images anyway? (y/n): ").strip().lower() == 'y'
                        else:
                            print("Could not determine image sizes")
                            show_images = input("Show images? (y/n): ").strip().lower() == 'y'
                        
                        if show_images:
                            try:
                                os.startfile(str(png))
                                os.startfile(str(new_path))
                            except Exception as e:
                                print(f"Could not open images for preview: {e}")
                        
                        while True:
                            choice = input(f"Delete (1) original [{png.name}], (2) existing [{new_name}], or (s)kip? [1/2/s]: ").strip().lower()
                            if choice == '1':
                                png.unlink()
                                print(f"Deleted: {png}")
                                conflicts_resolved = True
                                current_conflicts = True
                                break
                            elif choice == '2':
                                new_path.unlink()
                                png.rename(new_path)
                                report.append(f"Renamed: {png.name} -> {new_name} (existing deleted)")
                                print(f"Deleted: {new_path}, Renamed: {png} -> {new_name}")
                                conflicts_resolved = True
                                current_conflicts = True
                                break
                            elif choice == 's':
                                print("Skipped both files.")
                                current_conflicts = True
                                break
                            else:
                                print("Invalid input. Please enter 1, 2, or s.")
                    else:
                        png.rename(new_path)
                        report.append(f"Renamed: {png.name} -> {new_name}")
                else:
                    new_path = png
                    
                prefix = new_name[:10]
                if prefix in seen:
                    dups.append((seen[prefix], new_path))
                else:
                    seen[prefix] = new_path
                    
            if dups:
                print(f"\nDUPLICATES FOUND in {folder_path}:")
                for a, b in dups:
                    print(f"  {a.name} <-> {b.name}")
                    
                    # Check if images are different sizes
                    size1 = get_image_size(a)
                    size2 = get_image_size(b)
                    show_images = False
                    
                    if size1 and size2 and size1 != size2:
                        print(f"Images have different sizes: {size1} vs {size2}")
                        show_images = True
                    elif size1 and size2 and size1 == size2:
                        print(f"Images have the same size: {size1}")
                        show_images = input("Show images anyway? (y/n): ").strip().lower() == 'y'
                    else:
                        print("Could not determine image sizes")
                        show_images = input("Show images? (y/n): ").strip().lower() == 'y'
                    
                    if show_images:
                        try:
                            os.startfile(str(a))
                            os.startfile(str(b))
                        except Exception as e:
                            print(f"Could not open images for preview: {e}")
                    
                    while True:
                        choice = input(f"Delete (1) first [{a.name}], (2) second [{b.name}], or (s)kip? [1/2/s]: ").strip().lower()
                        if choice == '1':
                            a.unlink()
                            print(f"Deleted: {a}")
                            conflicts_resolved = True
                            current_conflicts = True
                            break
                        elif choice == '2':
                            b.unlink()
                            print(f"Deleted: {b}")
                            conflicts_resolved = True
                            current_conflicts = True
                            break
                        elif choice == 's':
                            print("Skipped both files.")
                            current_conflicts = True
                            break
                        else:
                            print("Invalid input. Please enter 1, 2, or s.")
        
        # If no conflicts were found in this pass, we're done
        if not current_conflicts:
            break
        else:
            print("\nRe-scanning for conflicts after resolution...")
    
    if conflicts_resolved:
        restart_script()
    return report

def check_duplicate_ids() -> List[str]:
    """
    Check for duplicate IDs (numeric sequence before underscore) in each model folder.
    
    AI generators sometimes create multiple files with the same numeric ID but
    different suffixes. This function groups files by their ID and allows
    interactive selection of which file to keep.
    
    Returns:
        List of report messages describing actions taken
    """
    report: List[str] = []
    conflicts_resolved = False
    
    for model_id, folder in MODEL_FOLDERS.items():
        folder_path = DOWNLOADS_SREF_ROOT / folder
        if not folder_path.exists():
            continue
            
        print(f"\nChecking for duplicate IDs in {model_id} model folder...")
        print(f"  Processing folder: {folder_path}")
        
        # Group files by their ID (numeric part before underscore)
        id_groups: Dict[str, List[Path]] = {}
        for png in folder_path.glob("*.png"):
            # Extract the numeric ID from filename (e.g., "123_something.png" -> "123")
            match = re.match(r'^(\d+)', png.name)
            if match:
                file_id = match.group(1)
                if file_id not in id_groups:
                    id_groups[file_id] = []
                id_groups[file_id].append(png)
        
        # Check for duplicates
        duplicates_found = False
        for file_id, files in id_groups.items():
            if len(files) > 1:
                duplicates_found = True
                print(f"\nDUPLICATE ID '{file_id}' found in {folder_path}:")
                for i, file in enumerate(files, 1):
                    print(f"  {i}. {file.name}")
                
                # Check if images are different sizes
                sizes: List[Optional[Tuple[int, int]]] = []
                for file in files:
                    size = get_image_size(file)
                    sizes.append(size)
                    print(f"     Size: {size}")
                
                # Determine if we should show images
                show_images = False
                if all(sizes) and len(set(sizes)) > 1:
                    print(f"Images have different sizes - showing for comparison")
                    show_images = True
                elif all(sizes) and len(set(sizes)) == 1:
                    print(f"Images have the same size: {sizes[0]}")
                    show_images = input("Show images anyway? (y/n): ").strip().lower() == 'y'
                else:
                    print("Could not determine some image sizes")
                    show_images = input("Show images? (y/n): ").strip().lower() == 'y'
                
                if show_images:
                    try:
                        for file in files:
                            os.startfile(str(file))
                            time.sleep(0.5)  # Small delay between opening files
                    except Exception as e:
                        print(f"Could not open images for preview: {e}")
                
                while True:
                    print(f"Choose which file to keep (1-{len(files)}) or (s)kip all:")
                    choice = input(f"Enter choice [1-{len(files)}/s]: ").strip().lower()
                    
                    if choice == 's':
                        print("Skipped all files with duplicate ID.")
                        break
                    elif choice.isdigit():
                        file_index = int(choice) - 1
                        if 0 <= file_index < len(files):
                            # Keep the chosen file, delete the others
                            chosen_file = files[file_index]
                            for i, file in enumerate(files):
                                if i != file_index:
                                    file.unlink()
                                    print(f"Deleted: {file.name}")
                                    report.append(f"Deleted duplicate: {file.name} (kept {chosen_file.name})")
                            
                            print(f"Kept: {chosen_file.name}")
                            conflicts_resolved = True
                            break
                        else:
                            print(f"Invalid file number. Please enter 1-{len(files)} or s.")
                    else:
                        print(f"Invalid input. Please enter 1-{len(files)} or s.")
        
        if not duplicates_found:
            print(f"  No duplicate IDs found in {model_id} folder.")
    
    if conflicts_resolved:
        restart_script()
    return report

def copy_files_to_source() -> Tuple[List[str], Dict[str, int]]:
    """
    Copy all PNG files from Downloads/sref model folders to source-images/model folders.
    
    This function prepares files for processing by moving them from the downloads
    location to the source-images directory where process.py expects to find them.
    Skips files that already exist in the destination to avoid overwriting.
    
    Returns:
        Tuple of (report messages, model file counts)
    """
    report: List[str] = []
    model_counts: Dict[str, int] = {}
    
    for model_id, folder in MODEL_FOLDERS.items():
        downloads_folder_path = DOWNLOADS_SREF_ROOT / folder
        source_folder_path = SOURCE_IMG_ROOT / folder
        
        if not downloads_folder_path.exists():
            print(f"Source folder {downloads_folder_path} does not exist, skipping...")
            model_counts[model_id] = 0
            continue
            
        print(f"\nCopying files for {model_id} model...")
        print(f"From: {downloads_folder_path}")
        print(f"To: {source_folder_path}")
        
        # Create destination folder if it doesn't exist
        source_folder_path.mkdir(parents=True, exist_ok=True)
        
        # Get all PNG files
        png_files = list(downloads_folder_path.glob("*.png"))
        print(f"Found {len(png_files)} PNG files to copy")
        
        copied_count = 0
        skipped_count = 0
        
        for png_file in png_files:
            # Check if destination already exists
            dest_path = source_folder_path / png_file.name
            if dest_path.exists():
                print(f"  Skipped (exists): {png_file.name}")
                skipped_count += 1
                continue
            else:
                # Simple copy
                shutil.copy2(str(png_file), str(dest_path))
                report.append(f"Copied: {png_file} -> {dest_path}")
                print(f"  Copied: {png_file.name}")
                copied_count += 1
        
        print(f"  Summary: {copied_count} copied, {skipped_count} skipped")
        model_counts[model_id] = copied_count
    
    return report, model_counts

def print_report(rename_report: List[str], duplicate_report: List[str], 
                copy_report: List[str], model_counts: Dict[str, int], total_time: float) -> None:
    """
    Print a comprehensive report of all file management activities.
    
    Args:
        rename_report: List of rename operations performed
        duplicate_report: List of duplicate resolution operations
        copy_report: List of copy operations performed
        model_counts: Dictionary of model file counts
        total_time: Total processing time in seconds
    """
    print("\n--- RENAME REPORT ---")
    for line in rename_report:
        print(line)
    print("\n--- DUPLICATE ID REPORT ---")
    for line in duplicate_report:
        print(line)
    print("\n--- COPY REPORT ---")
    for line in copy_report:
        print(line)
    
    print("\n--- FILE COUNT SUMMARY ---")
    total_files = 0
    for model_id, count in model_counts.items():
        model_name = "Midjourney 7" if model_id == "mj7" else "NijiJourney 6"
        print(f"{model_name}: {count} files moved")
        total_files += count
    print(f"Total files moved: {total_files}")
    
    print(f"\nTotal processing time: {total_time:.2f} seconds")

if __name__ == "__main__":
    print("Starting move-it script...")
    print(f"Source: {DOWNLOADS_SREF_ROOT}")
    print(f"Destination: {SOURCE_IMG_ROOT}")
    print(f"Models: {list(MODEL_FOLDERS.keys())}")
    print("-" * 50)
    
    start_time = time.time()
    
    # Step 1: Rename files in model folders (mimicking process.py behavior)
    print("Step 1: Renaming files in model folders...")
    rename_report = rename_and_check_duplicates_in_model_folders()
    
    # Step 2: Check for duplicate IDs in model folders
    print("\nStep 2: Checking for duplicate IDs in model folders...")
    duplicate_report = check_duplicate_ids()
    
    # Step 3: Copy files to source-images
    print("\nStep 3: Copying files to source-images...")
    copy_report, model_counts = copy_files_to_source()
    
    total_time = time.time() - start_time
    print_report(rename_report, duplicate_report, copy_report, model_counts, total_time)
    
    print("\nScript completed!") 