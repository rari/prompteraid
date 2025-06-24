import os
import re
import json
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from PIL import Image
from concurrent.futures import ThreadPoolExecutor, as_completed
import sys

# --- CONFIG ---
PROJECT_ROOT = Path(r"C:/Users/imiko/Documents/GitHub/website/prompteraid")
SOURCE_IMG_ROOT = PROJECT_ROOT / "source-images"
IMG_ROOT = PROJECT_ROOT / "img"
JSON_PATH = PROJECT_ROOT / "api" / "images.json"
MODEL_FOLDERS = {"niji6": "niji-6", "mj7": "midjourney-7"}
NEW_WINDOW_DAYS = 7

def clean_filename(filename):
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

def restart_script():
    print("Conflicts resolved. Restarting from the beginning...")
    python = sys.executable
    os.execv(python, [python] + sys.argv)

def rename_and_check_duplicates():
    report = []
    conflicts_resolved = False
    for model_id, folder in MODEL_FOLDERS.items():
        folder_path = SOURCE_IMG_ROOT / folder
        if not folder_path.exists():
            continue
        seen = {}
        dups = []
        for png in folder_path.glob("*.png"):
            new_name = clean_filename(png.name)
            new_path = png.parent / new_name
            if png.name != new_name:
                if new_path.exists():
                    print(f"\nCONFLICT: {png} would be renamed to {new_path}, but it already exists.")
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
                            break
                        elif choice == '2':
                            new_path.unlink()
                            png.rename(new_path)
                            report.append(f"Renamed: {png.name} -> {new_name} (existing deleted)")
                            print(f"Deleted: {new_path}, Renamed: {png} -> {new_name}")
                            conflicts_resolved = True
                            break
                        elif choice == 's':
                            print("Skipped both files.")
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
                        break
                    elif choice == '2':
                        b.unlink()
                        print(f"Deleted: {b}")
                        conflicts_resolved = True
                        break
                    elif choice == 's':
                        print("Skipped both files.")
                        break
                    else:
                        print("Invalid input. Please enter 1, 2, or s.")
    if conflicts_resolved:
        restart_script()
    return report

def convert_png_to_webp(png_path, webp_path):
    try:
        with Image.open(png_path) as img:
            if img.mode in ('RGBA', 'LA', 'P'):
                img = img.convert('RGB')
            img.save(webp_path, 'WEBP', quality=10, optimize=True)
        return f"Converted: {png_path.name} -> {webp_path.name}"
    except Exception as e:
        return f"ERROR converting {png_path.name}: {e}"

def process_images_concurrently():
    report = []
    webp_paths = {model: [] for model in MODEL_FOLDERS}
    start = time.time()
    for model_id, folder in MODEL_FOLDERS.items():
        src_folder_path = SOURCE_IMG_ROOT / folder
        dst_folder_path = IMG_ROOT / folder
        if not src_folder_path.exists():
            continue
        dst_folder_path.mkdir(parents=True, exist_ok=True)
        pngs = list(src_folder_path.glob("*.png"))
        with ThreadPoolExecutor() as executor:
            futures = []
            for png in pngs:
                webp_name = png.with_suffix('.webp').name
                webp_path = dst_folder_path / webp_name
                futures.append(executor.submit(convert_png_to_webp, png, webp_path))
                webp_paths[model_id].append(webp_path)
            for fut in as_completed(futures):
                report.append(fut.result())
    elapsed = time.time() - start
    return webp_paths, report, elapsed

def update_images_json(webp_paths):
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=NEW_WINDOW_DAYS)
    # Load old JSON
    if JSON_PATH.exists():
        with open(JSON_PATH, "r", encoding="utf-8") as f:
            old_json = json.load(f)
    else:
        old_json = {"sets": {}}
    old_lookup = {}
    for model_id in MODEL_FOLDERS:
        for img in old_json.get("sets", {}).get(model_id, {}).get("images", []):
            old_lookup[img["path"]] = img

    new_json = {"sets": {}, "default": "niji6"}
    changes = {"added": [], "removed": [], "updated": [], "new_count": {k: 0 for k in MODEL_FOLDERS}}
    for model_id, folder in MODEL_FOLDERS.items():
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
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(new_json, f, indent=2, ensure_ascii=False)
    return changes

def print_report(rename_report, convert_report, changes, total_time, total_files):
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

if __name__ == "__main__":
    start_time = time.time()
    rename_report = rename_and_check_duplicates()
    webp_paths, convert_report, convert_time = process_images_concurrently()
    total_files = sum(len(v) for v in webp_paths.values())
    changes = update_images_json(webp_paths)
    total_time = time.time() - start_time
    print_report(rename_report, convert_report, changes, total_time, total_files) 