import os
import json

IMG_DIR = os.path.join('img', 'midjourney-7')
JSON_PATH = os.path.join('api', 'images.json')

# Recursively list all .webp files in IMG_DIR
local_images = set()
for root, dirs, files in os.walk(IMG_DIR):
    for file in files:
        if file.lower().endswith('.webp'):
            rel_path = os.path.join(root, file).replace('\\', '/').replace('\\', '/')
            local_images.add(rel_path)

# Load images.json and extract mj7 image paths
with open(JSON_PATH, 'r', encoding='utf-8') as f:
    data = json.load(f)

json_images = set()
for img in data['sets']['mj7']['images']:
    json_images.add(img['path'])

print(f"Total .webp files in {IMG_DIR}: {len(local_images)}")
print(f"Total images in images.json (mj7): {len(json_images)}\n")

missing_in_folder = sorted(json_images - local_images)
missing_in_json = sorted(local_images - json_images)

if missing_in_folder:
    print("In JSON but missing from folder:")
    for path in missing_in_folder:
        print(f"  {path}")
else:
    print("No images missing from folder (all JSON entries exist as files).")

print()

if missing_in_json:
    print("In folder but missing from JSON:")
    for path in missing_in_json:
        print(f"  {path}")
else:
    print("No images missing from JSON (all files are listed in manifest).")

print('Done.') 