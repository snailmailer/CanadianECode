#!/usr/bin/env python3
"""
Link table numbers in the Tables index list to their actual table content.
Each - **X** entry in the index list is turned into a [**X**](#tables?hl=Table%20X) link
so clicking it scrolls to and highlights that table heading.
"""
import json
import re
import sys
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
json_path = os.path.join(script_dir, 'src', 'data', 'sections.json')

with open(json_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

tables_section = next((s for s in data if s['id'] == 'tables'), None)
if not tables_section:
    print("ERROR: Tables section not found!")
    sys.exit(1)

content = tables_section['content']

# The index list ends and actual table content begins at the first "### Δ"
marker_idx = content.find('\n\n### Δ')
if marker_idx == -1:
    print("ERROR: Could not find split marker '### Δ'")
    sys.exit(1)

index_part = content[:marker_idx]
rest_part = content[marker_idx:]

print(f"Index part: {len(index_part)} chars | Rest: {len(rest_part)} chars")

# Tables that are now specific diagrams: table_number -> diagram_number
diagram_tables = {
    '46': '1', '47': '2', '49': '3', '54': '4', '55': '5'
}

# Tables that are deleted or moved — no content to link to
no_link_tables = {
    '6',   # Deleted
    '9',   # Deleted
    '10A', # Deleted
    '10B', # Deleted
    '10C', # Deleted
    '11',  # Deleted
    '16A', # Deleted
    '16B', # Deleted
    '20',  # Deleted
    '26',  # Now Table D16 (in Appendix D, not in Tables section)
    '38',  # Deleted
    '39',  # Deleted
    '42',  # Deleted
}

# All table numbers in the Tables section
all_table_nums = [
    '1', '2', '3', '4', '5A', '5B', '5C', '5D',
    '6', '6A', '6B', '6C', '6D', '6E', '6F', '6G', '6H', '6I', '6J', '6K',
    '7', '8', '9',
    '9A', '9B', '9C', '9D', '9E', '9F', '9G', '9H',
    '10A', '10B', '10C', '10D', '11', '11A', '11B',
    '12', '12A', '12B', '12C', '12D', '12E',
    '13', '14', '15', '16', '16A', '16B', '17', '18', '18A', '19', '20',
    '21', '22', '23', '24', '25', '26', '27', '28', '29',
    '30', '31', '32', '33', '34', '35',
    '36A', '36B', '37', '38', '39', '40', '41',
    '42', '42A', '42B', '42C', '43', '44', '45', '46', '47', '48', '49',
    '50', '51', '52', '53', '54', '55', '56', '57', '58', '59', '60',
    '61', '62', '63', '64', '65', '66', '67', '68', '69', '70', '71', '72'
]

# Sort longest-first so '10A' matches before '10', '36A' before '36', etc.
all_table_nums_sorted = sorted(all_table_nums, key=len, reverse=True)

def get_link(table_num):
    """Return the href for a table number, or None if no link should be added."""
    if table_num in no_link_tables:
        return None
    elif table_num in diagram_tables:
        diagram_num = diagram_tables[table_num]
        return f'#diagrams?hl=Diagram%20{diagram_num}'
    else:
        return f'#tables?hl=Table%20{table_num}'

# Build regex that matches **X** where X is a known table number
pattern_parts = [re.escape(n) for n in all_table_nums_sorted]
full_pattern = r'\*\*(' + '|'.join(pattern_parts) + r')\*\*'
table_ref_re = re.compile(full_pattern)

def replace_table_refs(line_text):
    """Replace all **X** table refs in a line with markdown links."""
    def do_replace(m):
        table_num = m.group(1)
        link = get_link(table_num)
        if link is None:
            return m.group(0)  # Keep bold, but no link (deleted/moved)
        return f'[**{table_num}**]({link})'
    return table_ref_re.sub(do_replace, line_text)

# Process the index part line by line
# Only modify lines that start with '- **' (list items with table numbers)
lines = index_part.split('\n')
new_lines = []
modified_count = 0

for line in lines:
    if line.startswith('- **'):
        new_line = replace_table_refs(line)
        if new_line != line:
            modified_count += 1
        new_lines.append(new_line)
    else:
        new_lines.append(line)

print(f"Modified {modified_count} list items")

# Rebuild content and save
new_index_part = '\n'.join(new_lines)
tables_section['content'] = new_index_part + rest_part

with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("SUCCESS: sections.json updated with table index links!")

# Print a sample of what was changed for verification
print("\nSample modifications:")
sample_count = 0
for orig, modified in zip(lines, new_lines):
    if orig != modified and orig.startswith('- **'):
        print(f"  BEFORE: {orig[:100]}")
        print(f"  AFTER:  {modified[:100]}")
        print()
        sample_count += 1
        if sample_count >= 5:
            print("  ... (more changes) ...")
            break
