"""
Image Processing Pipeline for PrompterAid Gallery

This module processes AI-generated images for the PrompterAid web gallery. It handles:
- Converting PNG files to optimized WebP format for web delivery
- Organizing images into subfolders based on filename patterns
- Maintaining a JSON database of image metadata
- Tracking "new" images for display purposes
- Handling filename conflicts and duplicate detection

The script processes images from two AI models:
- niji6: Niji Journey v6 anime-style images
- mj7: Midjourney v7 photorealistic images

Workflow:
1. Clean and standardize filenames
2. Resolve naming conflicts and duplicates
3. Convert PNG to WebP with optimization
4. Organize into subfolders by first digit
5. Update JSON metadata database
6. Generate processing reports

Author: PrompterAid Team
"""

import os
import re
import json
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any
from PIL import Image
from concurrent.futures import ThreadPoolExecutor, as_completed
import sys

# --- CONFIG ---
PROJECT_ROOT = Path(r"C:/Users/imiko/Documents/GitHub/website/prompteraid")
SOURCE_IMG_ROOT = PROJECT_ROOT / "source-images"  # Source PNG files from AI generators
IMG_ROOT = PROJECT_ROOT / "img"  # Output directory for processed WebP files
JSON_PATH = PROJECT_ROOT / "api" / "images.json"  # Metadata database
MODEL_FOLDERS = {"niji6": "niji-6", "mj7": "midjourney-7"}  # Model ID to folder mapping
NEW_WINDOW_DAYS = 7  # Images added within this many days are marked as "new" for gallery highlighting

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

def rename_and_check_duplicates() -> List[str]:
    """
    Rename files to standardized format and resolve conflicts/duplicates.
    
    Processes all PNG files in source folders, cleaning filenames and handling
    conflicts when multiple files would have the same name. Provides interactive
    resolution for conflicts and duplicate detection.
    
    Returns:
        List of report messages describing actions taken
    """
    report: List[str] = []
    conflicts_resolved = False
    
    while True:  # Loop until all conflicts are resolved
        current_conflicts = False
        
        for model_id, folder in MODEL_FOLDERS.items():
            folder_path = SOURCE_IMG_ROOT / folder
            if not folder_path.exists():
                continue
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
                print(f"\nDUPLICATES FOUND in {folder}:")
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

def convert_png_to_webp(png_path: Path, webp_path: Path) -> str:
    """
    Convert PNG image to optimized WebP format.
    
    Converts PNG to WebP with quality=5 for maximum compression while
    maintaining acceptable visual quality for web delivery.
    
    Args:
        png_path: Source PNG file path
        webp_path: Destination WebP file path
        
    Returns:
        Status message describing the conversion result
    """
    try:
        with Image.open(png_path) as img:
            if img.mode in ('RGBA', 'LA', 'P'):
                img = img.convert('RGB')
            # Quality=5 provides maximum compression for web delivery
            # This is a good balance between file size and visual quality
            img.save(webp_path, 'WEBP', quality=5, optimize=True)
        return f"Converted: {png_path.name} -> {webp_path.name}"
    except Exception as e:
        return f"ERROR converting {png_path.name}: {e}"

def get_existing_webp_paths() -> Dict[str, set]:
    """
    Get a set of existing WebP file paths from images.json to avoid reprocessing.
    
    Returns:
        Dictionary mapping model IDs to sets of existing WebP file paths
    """
    existing_paths: Dict[str, set] = {model: set() for model in MODEL_FOLDERS}
    
    if not JSON_PATH.exists():
        return existing_paths
    
    try:
        with open(JSON_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        for model_id in MODEL_FOLDERS:
            if model_id in data.get("sets", {}):
                for img in data["sets"][model_id].get("images", []):
                    # Convert JSON path to actual file path for comparison
                    webp_path = Path(__file__).parent / img["path"]
                    if webp_path.exists():
                        existing_paths[model_id].add(webp_path)
    except Exception as e:
        print(f"Warning: Could not load existing paths from {JSON_PATH}: {e}")
    
    return existing_paths

def get_png_to_webp_mapping(png_path: Path) -> Path:
    """
    Get the corresponding WebP path for a given PNG file.
    
    Args:
        png_path: Path to the PNG file
        
    Returns:
        Path where the WebP file should be saved
    """
    webp_name = png_path.with_suffix('.webp').name
    # Extract first digit from filename for subfolder organization
    first_digit = webp_name[0] if webp_name and webp_name[0].isdigit() else '0'
    
    # Determine the model folder from the PNG path
    model_folder = None
    for model_id, folder in MODEL_FOLDERS.items():
        if folder in str(png_path):
            model_folder = folder
            break
    
    if not model_folder:
        raise ValueError(f"Could not determine model folder for {png_path}")
    
    dst_folder_path = IMG_ROOT / model_folder
    subfolder = dst_folder_path / first_digit
    return subfolder / webp_name

def process_images_concurrently() -> Tuple[Dict[str, List[Path]], List[str], float]:
    """
    Process PNG files concurrently, converting to WebP format.
    
    Uses ThreadPoolExecutor for parallel processing to speed up conversion.
    Only processes files that haven't been converted yet, based on existing
    WebP files and images.json entries.
    
    Returns:
        Tuple of (webp_paths_by_model, conversion_report, processing_time)
    """
    report: List[str] = []
    webp_paths: Dict[str, List[Path]] = {model: [] for model in MODEL_FOLDERS}
    start = time.time()
    
    # Get existing WebP paths to avoid reprocessing
    existing_webp_paths = get_existing_webp_paths()
    
    # Get orphaned files to include in final results
    orphaned_files = find_orphaned_webp_files()
    
    for model_id, folder in MODEL_FOLDERS.items():
        src_folder_path = SOURCE_IMG_ROOT / folder
        dst_folder_path = IMG_ROOT / folder
        if not src_folder_path.exists():
            continue
        
        print(f"\nProcessing {model_id} model...")
        dst_folder_path.mkdir(parents=True, exist_ok=True)
        pngs = list(src_folder_path.glob("*.png"))
        print(f"Found {len(pngs)} PNG files")
        
        # Filter out PNGs that already have corresponding WebP files
        pngs_to_process = []
        skipped_count = 0
        
        for png in pngs:
            try:
                webp_path = get_png_to_webp_mapping(png)
                if webp_path in existing_webp_paths[model_id]:
                    # WebP already exists and is in images.json
                    webp_paths[model_id].append(webp_path)
                    skipped_count += 1
                elif webp_path.exists():
                    # WebP exists but not in images.json - add it to tracking
                    webp_paths[model_id].append(webp_path)
                    report.append(f"Skipped (exists): {png.name} -> {webp_path.name}")
                    skipped_count += 1
                else:
                    # Need to convert this PNG
                    pngs_to_process.append((png, webp_path))
            except Exception as e:
                print(f"Error processing {png.name}: {e}")
                continue
        
        print(f"  Skipping {skipped_count} already processed files")
        print(f"  Converting {len(pngs_to_process)} new files")
        
        if not pngs_to_process:
            print(f"  No new files to convert for {model_id}")
        else:
            with ThreadPoolExecutor() as executor:
                futures = []
                for png, webp_path in pngs_to_process:
                    # Ensure subfolder exists
                    webp_path.parent.mkdir(parents=True, exist_ok=True)
                    futures.append(executor.submit(convert_png_to_webp, png, webp_path))
                    webp_paths[model_id].append(webp_path)
            
            # Show progress as files complete
            completed = 0
            for fut in as_completed(futures):
                completed += 1
                if completed % 10 == 0 or completed == len(futures):  # Show progress every 10 files
                    print(f"  Converted {completed}/{len(futures)} files...")
                report.append(fut.result())
        
        # Add orphaned files to the results
        if orphaned_files[model_id]:
            print(f"  Including {len(orphaned_files[model_id])} orphaned files")
            webp_paths[model_id].extend(orphaned_files[model_id])
        
        print(f"Completed {model_id} model ({len(pngs_to_process)} converted, {skipped_count} skipped)")
    
    elapsed = time.time() - start
    return webp_paths, report, elapsed

def update_images_json(webp_paths: Dict[str, List[Path]]) -> Dict[str, Any]:
    """
    Update the JSON metadata database with processed image information.
    
    Maintains a database of all images with metadata including:
    - File paths relative to project root
    - Date added timestamps
    - "New" status based on age (within NEW_WINDOW_DAYS)
    
    Args:
        webp_paths: Dictionary mapping model IDs to lists of WebP file paths
        
    Returns:
        Dictionary containing change statistics (added, removed, updated counts)
    """
    print("\nUpdating images.json...")
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=NEW_WINDOW_DAYS)
    # Load old JSON
    if JSON_PATH.exists():
        with open(JSON_PATH, "r", encoding="utf-8") as f:
            old_json = json.load(f)
    else:
        old_json = {"sets": {}}
    old_lookup: Dict[str, Dict[str, Any]] = {}
    for model_id in MODEL_FOLDERS:
        for img in old_json.get("sets", {}).get(model_id, {}).get("images", []):
            old_lookup[img["path"]] = img

    new_json = {"sets": {}, "default": "niji6"}
    changes = {"added": [], "removed": [], "updated": [], "new_count": {k: 0 for k in MODEL_FOLDERS}}
    for model_id, folder in MODEL_FOLDERS.items():
        print(f"  Processing {model_id} entries...")
        images = []
        for webp in sorted(webp_paths[model_id]):
            rel_path = str(webp.relative_to(Path(__file__).parent)).replace("\\", "/")
            old = old_lookup.get(rel_path)
            if old:
                dateadded = old["dateadded"]
            else:
                dateadded = now.isoformat().replace("+00:00", "Z")
                changes["added"].append(rel_path)
            dt = datetime.fromisoformat(dateadded.replace("Z", "+00:00"))
            is_new = dt > cutoff
            entry = {"path": rel_path, "dateadded": dateadded}
            if is_new:
                entry["new"] = True
                changes["new_count"][model_id] += 1
            else:
                entry["new"] = False
                if old and "new" in old:
                    changes["updated"].append(rel_path)
            images.append(entry)
        # Detect removed images
        old_paths = set(img["path"] for img in old_json.get("sets", {}).get(model_id, {}).get("images", []))
        new_paths = set(str(w.relative_to(Path(__file__).parent)).replace("\\", "/") for w in webp_paths[model_id])
        for removed in old_paths - new_paths:
            changes["removed"].append(removed)
        new_json["sets"][model_id] = {"name": old_json.get("sets", {}).get(model_id, {}).get("name", model_id), "images": images}
    
    print("  Writing images.json...")
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(new_json, f, indent=2, ensure_ascii=False)
    print("  JSON update complete!")
    return changes

def print_report(rename_report: List[str], convert_report: List[str], 
                changes: Dict[str, Any], total_time: float, total_files: int) -> None:
    """
    Print a comprehensive report of all processing activities.
    
    Args:
        rename_report: List of rename operations performed
        convert_report: List of conversion operations performed
        changes: Dictionary of JSON database changes
        total_time: Total processing time in seconds
        total_files: Total number of files processed
    """
    print("\n--- RENAME REPORT ---")
    for line in rename_report:
        print(line)
    print("\n--- CONVERT REPORT ---")
    for line in convert_report:
        print(line)
    print("\n--- JSON CHANGES ---")
    print(f"Added: {len(changes['added'])}")
    for a in changes["added"]:
        print(f"  + {a}")
    print(f"Removed: {len(changes['removed'])}")
    for r in changes["removed"]:
        print(f"  - {r}")
    print(f"Updated 'new' flag: {len(changes['updated'])}")
    for u in changes["updated"]:
        print(f"  * {u}")
    print("\n--- NEW IMAGES BY CATEGORY (within last 7 days) ---")
    for model_id in changes["new_count"]:
        print(f"{model_id}: {changes['new_count'][model_id]}")
    print(f"\nTotal processing time: {total_time:.2f} seconds")
    avg = (total_time / total_files) if total_files else 0
    print(f"Average time per file: {avg:.3f} seconds")

def mark_old_images_not_new(json_path: Path, hours: int = 1) -> None:
    """
    Update the "new" status of images older than specified hours.
    
    This function is useful for maintaining accurate "new" status when
    images have been in the system for longer than the NEW_WINDOW_DAYS period.
    
    Args:
        json_path: Path to the JSON metadata file
        hours: Age threshold in hours for marking images as not new
    """
    if not json_path.exists():
        print(f"No {json_path} found, skipping mark_old_images_not_new.")
        return
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=hours)
    changed = False
    for model_id in data.get("sets", {}):
        for img in data["sets"][model_id].get("images", []):
            dateadded = img.get("dateadded")
            if dateadded:
                dt = datetime.fromisoformat(dateadded.replace("Z", "+00:00"))
                if dt < cutoff and img.get("new", False):
                    img["new"] = False
                    changed = True
    if changed:
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Updated 'new' flags for images older than {hours} hour(s).")
    else:
        print(f"No images needed 'new' flag update.")

def find_orphaned_webp_files() -> Dict[str, List[Path]]:
    """
    Find WebP files that exist on disk but are not tracked in images.json.
    
    These could be files that were created but the JSON update failed,
    or files that were manually added to the img directory.
    
    Returns:
        Dictionary mapping model IDs to lists of orphaned WebP file paths
    """
    orphaned_files: Dict[str, List[Path]] = {model: [] for model in MODEL_FOLDERS}
    
    # Get all paths currently in images.json
    tracked_paths: Dict[str, set] = {model: set() for model in MODEL_FOLDERS}
    
    if JSON_PATH.exists():
        try:
            with open(JSON_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            for model_id in MODEL_FOLDERS:
                if model_id in data.get("sets", {}):
                    for img in data["sets"][model_id].get("images", []):
                        tracked_paths[model_id].add(img["path"])
        except Exception as e:
            print(f"Warning: Could not load tracked paths from {JSON_PATH}: {e}")
    
    # Scan for WebP files on disk
    for model_id, folder in MODEL_FOLDERS.items():
        model_img_path = IMG_ROOT / folder
        if not model_img_path.exists():
            continue
            
        for webp_file in model_img_path.rglob("*.webp"):
            # Convert to relative path for comparison
            rel_path = str(webp_file.relative_to(Path(__file__).parent)).replace("\\", "/")
            if rel_path not in tracked_paths[model_id]:
                orphaned_files[model_id].append(webp_file)
    
    return orphaned_files

def calculate_efficiency_stats(total_pngs: int, processed_pngs: int, total_time: float) -> Dict[str, Any]:
    """
    Calculate efficiency statistics for the processing run.
    
    Args:
        total_pngs: Total number of PNG files found
        processed_pngs: Number of PNG files actually processed
        total_time: Total processing time in seconds
        
    Returns:
        Dictionary containing efficiency statistics
    """
    skipped_pngs = total_pngs - processed_pngs
    skip_percentage = (skipped_pngs / total_pngs * 100) if total_pngs > 0 else 0
    
    # Estimate time saved (assuming average 0.5 seconds per file)
    estimated_time_per_file = 0.5
    estimated_time_saved = skipped_pngs * estimated_time_per_file
    
    return {
        "total_pngs": total_pngs,
        "processed_pngs": processed_pngs,
        "skipped_pngs": skipped_pngs,
        "skip_percentage": skip_percentage,
        "total_time": total_time,
        "estimated_time_saved": estimated_time_saved,
        "efficiency_gain": f"{skip_percentage:.1f}%"
    }

def print_efficiency_report(stats: Dict[str, Any]) -> None:
    """
    Print an efficiency report showing processing optimization results.
    
    Args:
        stats: Efficiency statistics dictionary
    """
    print("\n--- EFFICIENCY REPORT ---")
    print(f"Total PNG files found: {stats['total_pngs']}")
    print(f"Files processed: {stats['processed_pngs']}")
    print(f"Files skipped (already existed): {stats['skipped_pngs']}")
    print(f"Efficiency gain: {stats['efficiency_gain']} of files skipped")
    print(f"Actual processing time: {stats['total_time']:.2f} seconds")
    print(f"Estimated time saved: {stats['estimated_time_saved']:.2f} seconds")
    
    if stats['skip_percentage'] > 50:
        print("🎉 Excellent efficiency! Most files were already processed.")
    elif stats['skip_percentage'] > 25:
        print("👍 Good efficiency! Many files were already processed.")
    else:
        print("📝 Processing most files - this is normal for new batches.")

if __name__ == "__main__":
    print("Starting image processing script...")
    print(f"Source: {SOURCE_IMG_ROOT}")
    print(f"Output: {IMG_ROOT}")
    print(f"Models: {list(MODEL_FOLDERS.keys())}")
    print("-" * 50)

    # Check for orphaned files
    orphaned_files = find_orphaned_webp_files()
    total_orphaned = sum(len(files) for files in orphaned_files.values())
    if total_orphaned > 0:
        print(f"\nFound {total_orphaned} orphaned WebP files (exist on disk but not in images.json):")
        for model_id, files in orphaned_files.items():
            if files:
                print(f"  {model_id}: {len(files)} files")
        print("These will be included in the JSON update.")

    # Option to mark all images as not new if older than 1 hour
    choice = input("Mark all images as not new if older than 1 hour? (y/n): ").strip().lower()
    if choice == 'y':
        mark_old_images_not_new(JSON_PATH, hours=1)

    start_time = time.time()
    rename_report = rename_and_check_duplicates()
    webp_paths, convert_report, convert_time = process_images_concurrently()
    total_files = sum(len(v) for v in webp_paths.values())
    changes = update_images_json(webp_paths)
    total_time = time.time() - start_time
    
    # Calculate efficiency statistics
    total_pngs = sum(len(list((SOURCE_IMG_ROOT / folder).glob("*.png"))) 
                    for folder in MODEL_FOLDERS.values() 
                    if (SOURCE_IMG_ROOT / folder).exists())
    processed_pngs = len([msg for msg in convert_report if msg.startswith("Converted:")])
    efficiency_stats = calculate_efficiency_stats(total_pngs, processed_pngs, total_time)
    
    print_report(rename_report, convert_report, changes, total_time, total_files) 
    print_efficiency_report(efficiency_stats) 