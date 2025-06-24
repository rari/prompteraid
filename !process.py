import os
import json
import time
from datetime import datetime, timedelta, timezone
from PIL import Image
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

def convert_single_png(png_path, model_type, base_dst_dir_str):
    """
    Converts a single PNG to WebP and returns its full relative path, or None on failure.
    
    Args:
        png_path: Path to the PNG file
        model_type: Either 'niji6' or 'mj7'
        base_dst_dir_str: Base destination directory
    """
    try:
        filename = png_path.name
        
        # Clean the filename
        clean_filename = filename.replace(' ', '').replace('__', '_')
        
        # Extract the first digit
        first_digit = next((char for char in clean_filename if char.isdigit()), None)
        
        if first_digit is None:
            print(f"Skipping {filename}: no digit found in name")
            return None
        
        # Define output paths using os.path.join for clarity
        output_filename = clean_filename.rsplit('.', 1)[0] + '.webp'
        
        # Determine the appropriate subfolder based on model type
        if model_type == 'niji6':
            model_folder = 'niji-6'
        else:  # mj7
            model_folder = 'midjourney-7'
        
        # Relative path for the JSON file (e.g., "img/niji-6/1/1_image.webp")
        json_path_str = os.path.join('img', model_folder, first_digit, output_filename)
        
        # Absolute path for saving the file
        absolute_save_dir = os.path.join(base_dst_dir_str, model_folder, first_digit)
        os.makedirs(absolute_save_dir, exist_ok=True)
        absolute_output_path = os.path.join(absolute_save_dir, output_filename)

        # Open, convert, and save the image
        with Image.open(png_path) as img:
            if img.mode in ('RGBA', 'LA', 'P'):
                img = img.convert('RGB')
            img.save(absolute_output_path, 'WEBP', quality=10, optimize=True)
        
        print(f"Converted {filename} -> {json_path_str}")
        return json_path_str
    
    except Exception as e:
        print(f"Error converting {png_path.name}: {e}")
        return None

def process_images_in_parallel():
    start_time = time.time()
    
    # Use string-based paths for clarity
    src_dir_str = str(Path(__file__).parent)
    base_dst_dir_str = r"C:\Users\imiko\Documents\GitHub\website\prompteraid\img"
    json_path_str = r"C:\Users\imiko\Documents\GitHub\website\prompteraid\api\images.json"
    
    # Define model folders to process
    model_folders = {
        'niji6': 'niji-6',
        'mj7': 'midjourney-7'
    }
    
    # Dictionary to store converted paths for each model
    converted_paths = {
        'niji6': [],
        'mj7': []
    }
    
    total_files = 0
    total_converted = 0
    
    # --- Load existing JSON for dateadded/new tracking ---
    old_json = None
    if os.path.exists(json_path_str):
        with open(json_path_str, 'r', encoding='utf-8') as f:
            try:
                old_json = json.load(f)
            except Exception:
                old_json = None
    old_images = {}
    if old_json:
        for model_id in ['niji6', 'mj7']:
            if 'sets' in old_json and model_id in old_json['sets']:
                for img in old_json['sets'][model_id].get('images', []):
                    if isinstance(img, dict):
                        old_images[img['path']] = img
                    else:
                        old_images[img] = {'path': img}

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=48)

    # Process each model folder
    for model_id, folder_name in model_folders.items():
        model_src_dir = os.path.join(src_dir_str, folder_name)
        
        # Skip if folder doesn't exist
        if not os.path.exists(model_src_dir):
            print(f"Folder {model_src_dir} not found, skipping.")
            continue
        
        # Get all PNG files for this model
        png_files = [f for f in Path(model_src_dir).glob("*.png")]
        
        if not png_files:
            print(f"No PNG files found in {folder_name} to process.")
            continue

        print(f"Found {len(png_files)} PNG files to process in {folder_name}.")
        total_files += len(png_files)
        
        # Process files in parallel
        with ThreadPoolExecutor(max_workers=os.cpu_count()) as executor:
            future_to_png = {
                executor.submit(convert_single_png, png_file, model_id, base_dst_dir_str): png_file 
                for png_file in png_files
            }
            
            for future in as_completed(future_to_png):
                result_path = future.result()
                if result_path:
                    converted_paths[model_id].append(result_path)
                    total_converted += 1
    
    # --- Build new images list with 'new' and 'dateadded' ---
    new_json_data = {"sets": {}, "default": "niji6"}
    for model_id in ['niji6', 'mj7']:
        model_images = []
        for img_path in sorted(converted_paths[model_id]):
            # If this image existed before, preserve its dateadded/new
            old = old_images.get(img_path)
            if old and 'dateadded' in old:
                dateadded = old['dateadded']
                # Remove 'new' if >48h old
                try:
                    dt = datetime.fromisoformat(dateadded.replace('Z', '+00:00'))
                except Exception:
                    dt = now
                is_new = old.get('new', False) and dt > cutoff
            else:
                # New image
                dateadded = now.isoformat().replace('+00:00', 'Z')
                is_new = True
            entry = {
                'path': img_path,
                'dateadded': dateadded
            }
            if is_new:
                entry['new'] = True
            model_images.append(entry)
        new_json_data['sets'][model_id] = {
            'name': old_json['sets'][model_id]['name'] if old_json and 'sets' in old_json and model_id in old_json['sets'] else model_id,
            'images': model_images
        }
    
    # --- Write new JSON ---
    try:
        with open(json_path_str, 'w', encoding='utf-8') as f:
            json.dump(new_json_data, f, indent=2, ensure_ascii=False)
        print(f"\nSuccessfully updated {json_path_str} with:")
        for model_id in ['niji6', 'mj7']:
            print(f"- {len(new_json_data['sets'][model_id]['images'])} {model_id} images")
    except Exception as e:
        print(f"\nError updating {json_path_str}: {e}")

if __name__ == "__main__":
    process_images_in_parallel()