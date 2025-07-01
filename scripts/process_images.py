#!/usr/bin/env python3
"""
Image Processing Script for PrompterAid
Splits source images into four 4:5 quadrants for Instagram optimization
"""

import os
import re
from PIL import Image
import argparse
from pathlib import Path
import numpy as np
from collections import Counter
import colorsys
import concurrent.futures

def extract_style_id(filename):
    """Extract the style ID (first numeric code) from filename"""
    match = re.match(r'(\d+)_', filename)
    if match:
        return match.group(1)
    return None

def get_average_color(image_path):
    """
    Calculate the dominant subject color by ignoring background pixels and using the most frequent colorful pixel.
    Returns RGB tuple
    """
    try:
        with Image.open(image_path) as img:
            # Convert to RGB if necessary
            if img.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Resize for faster processing
            img_small = img.resize((100, 100), Image.Resampling.LANCZOS)
            img_array = np.array(img_small)
            pixels = img_array.reshape(-1, 3)
            
            # Convert to HSV for better filtering
            hsv_pixels = np.array([colorsys.rgb_to_hsv(*(p/255.0)) for p in pixels])
            
            # Filter: keep only pixels with reasonable saturation and brightness
            # (ignore very light, very dark, and gray pixels)
            mask = (
                (hsv_pixels[:,1] > 0.25) &  # Saturation > 0.25 (colorful)
                (hsv_pixels[:,2] > 0.15) &  # Value > 0.15 (not too dark)
                (hsv_pixels[:,2] < 0.95)    # Value < 0.95 (not too light)
            )
            filtered_pixels = pixels[mask]
            
            if len(filtered_pixels) == 0:
                # Fallback: use all pixels if nothing passes the filter
                filtered_pixels = pixels
            
            # Find the most common color (mode)
            pixel_tuples = [tuple(p) for p in filtered_pixels]
            most_common = Counter(pixel_tuples).most_common(1)
            if most_common:
                dominant_color = most_common[0][0]
            else:
                dominant_color = tuple(map(int, np.median(filtered_pixels, axis=0)))
            
            return tuple(map(int, dominant_color))
    except Exception as e:
        print(f"Error analyzing color for {image_path}: {e}")
        return (128, 128, 128)  # Default gray

def classify_color(rgb):
    """
    Classify RGB color into one of the specified color categories
    Returns color name as string
    """
    r, g, b = rgb
    # Calculate brightness and saturation
    brightness = (r + g + b) / 3
    max_val = max(r, g, b)
    min_val = min(r, g, b)
    saturation = (max_val - min_val) / max_val if max_val > 0 else 0
    # Black and white classification (low saturation)
    if saturation < 0.15:
        if brightness < 60:
            print(f"  Classified as black (sat={saturation:.2f}, bright={brightness:.2f})")
            return "black"
        elif brightness > 180:
            print(f"  Classified as white (sat={saturation:.2f}, bright={brightness:.2f})")
            return "white"
        else:
            print(f"  Classified as black (low sat, sat={saturation:.2f}, bright={brightness:.2f})")
            return "black"
    if max_val == min_val:
        print(f"  Classified as white (grayscale, sat={saturation:.2f}, bright={brightness:.2f})")
        return "white"
    # Calculate hue
    h, s, v = colorsys.rgb_to_hsv(r/255.0, g/255.0, b/255.0)
    hue = h * 360
    # Debug output
    print(f"  RGB: {rgb}, Hue: {hue:.1f}, Sat: {saturation:.2f}, Bright: {brightness:.2f}")
    # Refined hue boundaries
    if (0 <= hue <= 12) or (348 <= hue <= 360):
        return "red"
    elif 13 <= hue <= 40:
        return "orange"
    elif 41 <= hue <= 70:
        return "yellow"
    elif 71 <= hue <= 169:
        return "green"
    elif 170 <= hue <= 250:
        return "blue"
    elif 251 <= hue <= 275:
        return "indigo"
    elif 276 <= hue <= 347:
        return "violet"
    else:
        return "misc"  # Default fallback

def get_quadrant_center_color(quadrant_img):
    """
    Analyze the center 60% of a quadrant image and return the dominant color (mode of filtered pixels).
    Optimized: resizes center crop to 40x40 for speed.
    """
    w, h = quadrant_img.size
    left = int(w * 0.2)
    top = int(h * 0.2)
    right = int(w * 0.8)
    bottom = int(h * 0.8)
    center_img = quadrant_img.crop((left, top, right, bottom)).resize((40, 40), quadrant_img.resample if hasattr(quadrant_img, 'resample') else 1)
    img_array = np.array(center_img)
    pixels = img_array.reshape(-1, 3)
    hsv_pixels = np.array([colorsys.rgb_to_hsv(*(p/255.0)) for p in pixels])
    mask = (
        (hsv_pixels[:,1] > 0.25) &
        (hsv_pixels[:,2] > 0.15) &
        (hsv_pixels[:,2] < 0.95)
    )
    filtered_pixels = pixels[mask]
    if len(filtered_pixels) == 0:
        filtered_pixels = pixels
    pixel_tuples = [tuple(p) for p in filtered_pixels]
    most_common = Counter(pixel_tuples).most_common(1)
    if most_common:
        dominant_color = most_common[0][0]
    else:
        dominant_color = tuple(map(int, np.median(filtered_pixels, axis=0)))
    return tuple(map(int, dominant_color))

def create_instagram_quadrant(image_path, output_dir, style_id, quadrant, model_name):
    """
    Create a 4:5 Instagram-optimized quadrant from the source image and return the quadrant image (not saved yet)
    """
    try:
        with Image.open(image_path) as img:
            if img.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            width, height = img.size
            target_width = 1080
            target_height = 1350
            crop_size = min(width, height)
            left = (width - crop_size) // 2
            top = (height - crop_size) // 2
            right = left + crop_size
            bottom = top + crop_size
            square_img = img.crop((left, top, right, bottom))
            quadrant_width = crop_size // 2
            quadrant_height = crop_size // 2
            quadrant_coords = [
                (0, 0),
                (quadrant_width, 0),
                (0, quadrant_height),
                (quadrant_width, quadrant_height)
            ]
            x, y = quadrant_coords[quadrant]
            quadrant_img = square_img.crop((x, y, x + quadrant_width, y + quadrant_height))
            # Crop to 4:5 aspect ratio
            q_w, q_h = quadrant_img.size
            if q_w > q_h * 0.8:
                new_width = int(q_h * 0.8)
                left = (q_w - new_width) // 2
                quadrant_img = quadrant_img.crop((left, 0, left + new_width, q_h))
            elif q_h > q_w * 1.25:
                new_height = int(q_w * 1.25)
                top = (q_h - new_height) // 2
                quadrant_img = quadrant_img.crop((0, top, q_w, top + new_height))
            quadrant_img = quadrant_img.resize((target_width, target_height), Image.Resampling.LANCZOS)
            return quadrant_img
    except Exception as e:
        print(f"✗ Error processing {image_path}: {e}")
        return None

def process_image_set(args):
    """
    Process a single image file: create quadrants, analyze color, and return info for saving.
    """
    image_file, output_dir, style_id, model_name = args
    results = []
    quadrants = []
    colors = []
    for quadrant in range(4):
        quadrant_img = create_instagram_quadrant(
            str(image_file),
            output_dir,
            style_id,
            quadrant,
            model_name
        )
        if quadrant_img is not None:
            color_rgb = get_quadrant_center_color(quadrant_img)
            color_class = classify_color(color_rgb)
            colors.append(color_class)
            quadrants.append(quadrant_img)
    if len(set(colors)) == 1:
        folder = colors[0]
    elif set(colors).issubset({'black', 'white'}):
        folder = 'bw'
    else:
        folder = "misc"
    return (image_file, style_id, model_name, quadrants, folder)

def process_source_images(source_dir="data/source-images", output_dir="data/processed-images"):
    """
    Process all images in source-images directory
    
    Args:
        source_dir: Directory containing source images
        output_dir: Directory to save processed images
    """
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Process each subdirectory (niji-6, midjourney-7, etc.)
    source_path = Path(source_dir)
    if not source_path.exists():
        print(f"Error: Source directory '{source_dir}' does not exist")
        return
    
    total_processed = 0
    total_quadrants = 0
    color_stats = Counter()
    tasks = []
    
    for subdir in source_path.iterdir():
        if subdir.is_dir():
            print(f"\nProcessing {subdir.name}...")
            
            # Process each image file
            for image_file in subdir.glob("*.png"):
                style_id = extract_style_id(image_file.name)
                if not style_id:
                    print(f"Warning: Could not extract style ID from {image_file.name}")
                    continue
                tasks.append((image_file, output_dir, style_id, subdir.name))
    
    with concurrent.futures.ProcessPoolExecutor() as executor:
        for result in executor.map(process_image_set, tasks):
            image_file, style_id, model_name, quadrants, folder = result
            if not quadrants:
                continue
            color_stats[folder] += 1
            for quadrant, quadrant_img in enumerate(quadrants):
                color_dir = os.path.join(output_dir, folder)
                os.makedirs(color_dir, exist_ok=True)
                output_filename = f"{model_name}_{style_id}_quadrant{quadrant}.jpg"
                output_path = os.path.join(color_dir, output_filename)
                quadrant_img.save(
                    output_path,
                    'JPEG',
                    quality=80,
                    optimize=True,
                    progressive=True
                )
                print(f"✓ Created {folder}/{output_filename}")
                total_quadrants += 1
            total_processed += 1
    
    print(f"\n🎉 Processing complete!")
    print(f"📁 Processed {total_processed} source images")
    print(f"🖼️  Created {total_quadrants} quadrant images")
    print(f"📂 Output saved to: {output_dir}")
    
    print(f"\n📊 Color Distribution:")
    for color, count in color_stats.most_common():
        print(f"  {color}: {count} images")

def main():
    parser = argparse.ArgumentParser(description="Process source images into Instagram-optimized quadrants")
    parser.add_argument("--source", default="data/source-images", help="Source directory (default: data/source-images)")
    parser.add_argument("--output", default="data/processed-images", help="Output directory (default: data/processed-images)")
    
    args = parser.parse_args()
    
    print("🧜‍♀️ PrompterAid Image Processor")
    print("=" * 40)
    print("📸 Creating Instagram 4:5 quadrants...")
    print("🎨 Sorting by average color...")
    print(f"📁 Source: {args.source}")
    print(f"📂 Output: {args.output}")
    print()
    
    process_source_images(args.source, args.output)

if __name__ == "__main__":
    main() 