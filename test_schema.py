#!/usr/bin/env python3
import re
import json
from datetime import datetime

# Test reading docs.html
try:
    with open('docs.html', 'r', encoding='utf-8') as f:
        html = f.read()
    print("✅ Successfully read docs.html")
    print(f"   File length: {len(html)} characters")
    print(f"   First 100 chars: {html[:100]}")
except Exception as e:
    print(f"❌ Error reading docs.html: {e}")
    exit(1)

# Test regex pattern
pattern = re.compile(r'(<script type="application/ld\+json">)(.*?)(</script>)', re.DOTALL)
match = pattern.search(html)

if match:
    print("✅ Found schema block")
    prefix, json_text, suffix = match.groups()
    print(f"   JSON text length: {len(json_text)} characters")
    print(f"   JSON preview: {json_text[:100]}...")
    
    # Test JSON parsing
    try:
        schema_data = json.loads(json_text.strip())
        print("✅ Successfully parsed JSON")
        
        # Test date update
        current_date = datetime.now().strftime('%Y-%m-%d')
        print(f"   Current date: {current_date}")
        
        if '@graph' in schema_data:
            updated_count = 0
            for node in schema_data['@graph']:
                if 'dateModified' in node:
                    old_date = node['dateModified']
                    node['dateModified'] = current_date
                    print(f"   Updated {node.get('@type', 'Unknown')}: {old_date} → {current_date}")
                    updated_count += 1
            print(f"   Total nodes updated: {updated_count}")
        else:
            print("   No @graph found in schema")
            
    except json.JSONDecodeError as e:
        print(f"❌ Error parsing JSON: {e}")
else:
    print("❌ No schema block found")
    print("   Looking for pattern: <script type=\"application/ld+json\">")
    print(f"   File contains 'script': {'script' in html}")
    print(f"   File contains 'application/ld+json': {'application/ld+json' in html}") 