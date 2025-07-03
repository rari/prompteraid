#!/usr/bin/env python3
"""
Update numsamples in images.json for PrompterAid
Counts the number of images in each set and writes numsamples for each set and the total.
"""
import json
from pathlib import Path

IMAGES_JSON_PATH = Path(__file__).parent.parent.parent / 'api' / 'images.json'

def update_numsamples():
    with open(IMAGES_JSON_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    total = 0
    for set_name, set_obj in data.get('sets', {}).items():
        num = len(set_obj.get('images', []))
        set_obj['numsamples'] = num
        total += num
    data['numsamples'] = total

    with open(IMAGES_JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')
    print(f"Updated numsamples: total={total}, per set={[ (k, v['numsamples']) for k,v in data['sets'].items() ]}")

if __name__ == '__main__':
    update_numsamples() 