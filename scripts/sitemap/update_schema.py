#!/usr/bin/env python3
"""
Update schema.org JSON-LD in index.html with all best-practice tweaks for DataCatalog, Datasets, Organization, and WebSite nodes.
"""
import json
import re
from pathlib import Path
from datetime import datetime
import os

# Paths
PROJECT_ROOT = Path(__file__).resolve().parents[2]
INDEX_HTML = PROJECT_ROOT / 'index.html'
IMAGES_JSON = PROJECT_ROOT / 'api/images.json'

# Friendly model names mapping and identifiers
MODELS = [
    {
        'key': 'niji6',
        'name': 'NijiJourney 6 SREF Library',
        'identifier': 'niji6',
        'keywords': 'sref, style-code, niji 6, ai art, prompt library',
        'dataset_id': 'https://www.prompteraid.com/#dataset-niji6',
        'description': 'Side-by-side thumbnails of 1398 Niji 6 style-codes for AI art and prompt engineering.'
    },
    {
        'key': 'mj7',
        'name': 'Midjourney v7 SREF Library',
        'identifier': 'mj7',
        'keywords': 'sref, style-code, midjourney v7, ai art, prompt library',
        'dataset_id': 'https://www.prompteraid.com/#dataset-mj7',
        'description': 'Side-by-side thumbnails of 1085 Midjourney v7 style-codes for AI art and prompt engineering.'
    }
]

FOUNDER_ID = "https://jennajuffuffles.com/#me"
FOUNDER_NAME = "Jenna Juffuffles"
FOUNDER_SAMEAS = [
    "https://twitter.com/jennajuffuffles",
    "https://jennajuffuffles.com/"
]
LICENSE_URL = "https://creativecommons.org/licenses/by-nc-sa/4.0/"
LOGO_URL = "https://www.prompteraid.com/img/logo.png"
ORG_ID = "https://www.prompteraid.com/#org"
CATALOG_ID = "https://www.prompteraid.com/#catalog"
ORG_SAMEAS = [
    "https://www.instagram.com/prompteraid/",
    "https://hub.prompteraid.com/"
]

# Optional: Data download URL (uncomment and set if available)
# DATA_DOWNLOAD_URL = "https://www.prompteraid.com/api/images.json"
DATA_DOWNLOAD_URL = None

def get_sample_counts_and_dates():
    """Read images.json and return per-model sample counts and dateModified info."""
    with open(IMAGES_JSON, encoding='utf-8') as f:
        data = json.load(f)
    sets = data.get('sets', {})
    per_model = {}
    per_model_dates = {}
    total = 0
    all_dates = []
    for model in MODELS:
        key = model['key']
        val = sets.get(key, {})
        count = len(val.get('images', []))
        per_model[key] = count
        total += count
        # Try to get dateModified from images.json, else fallback to file mtime
        date = val.get('dateModified')
        if not date:
            # fallback: use images.json mtime
            date = datetime.utcfromtimestamp(os.path.getmtime(IMAGES_JSON)).strftime('%Y-%m-%d')
        per_model_dates[key] = date
        all_dates.append(date)
    # Catalog date is latest
    catalog_date = max(all_dates)
    return total, per_model, per_model_dates, catalog_date

def update_schema_in_index():
    """Update the schema.org JSON-LD in index.html with all best-practice tweaks."""
    with open(INDEX_HTML, encoding='utf-8') as f:
        html = f.read()

    # Find the <script type="application/ld+json"> ... </script> block
    pattern = re.compile(r'(<script type="application/ld\+json">)(.*?)(</script>)', re.DOTALL)
    match = pattern.search(html)
    if not match:
        print("❌ Could not find schema.org JSON-LD block in index.html!")
        return False

    prefix, json_text, suffix = match.groups()

    # Get counts and dates
    total, per_model, per_model_dates, catalog_date = get_sample_counts_and_dates()

    # Build the new JSON-LD structure
    org = {
        "@type": "Organization",
        "@id": ORG_ID,
        "name": "PrompterAid",
        "url": "https://www.prompteraid.com/",
        "logo": {
            "@type": "ImageObject",
            "url": LOGO_URL
        },
        "founder": {
            "@type": "Person",
            "@id": FOUNDER_ID,
            "name": FOUNDER_NAME,
            "sameAs": FOUNDER_SAMEAS
        },
        "sameAs": ORG_SAMEAS
    }
    website = {
        "@type": "WebSite",
        "@id": "https://www.prompteraid.com/#website",
        "name": "PrompterAid",
        "url": "https://www.prompteraid.com/",
        "description": "Free style-code library and 1-click prompt generator for NijiJourney 6 & Midjourney 7.",
        "publisher": { "@id": ORG_ID },
        "potentialAction": {
            "@type": "SearchAction",
            "target": "https://www.prompteraid.com/?sref={search_term_string}",
            "query-input": "required name=search_term_string"
        },
        "about": { "@id": CATALOG_ID }
    }
    datasets = []
    for model in MODELS:
        key = model['key']
        dataset = {
            "@type": "Dataset",
            "@id": model['dataset_id'],
            "name": model['name'],
            "identifier": model['identifier'],
            "dateModified": per_model_dates[key],
            "license": LICENSE_URL,
            "keywords": model['keywords'],
            "author": { "@id": FOUNDER_ID },
            "creator": { "@id": ORG_ID },
            "description": model['description'],
            "inLanguage": "en",
            "isAccessibleForFree": True,
            "includedInDataCatalog": { "@id": CATALOG_ID },
            "additionalProperty": [{
                "@type": "PropertyValue",
                "name": "numSamples",
                "value": per_model[key]
            }]
        }
        if DATA_DOWNLOAD_URL:
            dataset["distribution"] = [{
                "@type": "DataDownload",
                "encodingFormat": "application/json",
                "contentUrl": DATA_DOWNLOAD_URL
            }]
        datasets.append(dataset)
    catalog = {
        "@type": "DataCatalog",
        "@id": CATALOG_ID,
        "name": "PrompterAid Style-Code Library",
        "dateModified": catalog_date,
        "dataset": datasets,
        "isAccessibleForFree": True,
        "inLanguage": "en",
        "additionalProperty": [{
            "@type": "PropertyValue",
            "name": "numSamples",
            "value": total
        }]
    }
    app = {
        "@type": "WebApplication",
        "@id": "https://www.prompteraid.com/#app",
        "name": "PrompterAid Prompt Generator",
        "url": "https://www.prompteraid.com/",
        "applicationCategory": "GraphicsApplication",
        "operatingSystem": "All",
        "softwareRequirements": "JavaScript; modern desktop & mobile browsers",
        "isAccessibleForFree": True,
        "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
        },
        "creator": { "@id": "https://www.prompteraid.com/#website" }
    }
    graph = [website, org, catalog, app]
    new_json_text = json.dumps({"@context": "https://schema.org", "@graph": graph}, indent=2, ensure_ascii=False)
    new_block = f'{prefix}\n{new_json_text}\n{suffix}'
    new_html = pattern.sub(new_block, html)

    with open(INDEX_HTML, 'w', encoding='utf-8') as f:
        f.write(new_html)
    print(f"✅ Updated schema.org JSON-LD with all best-practice tweaks. Total: {total}")
    return True

if __name__ == '__main__':
    update_schema_in_index() 