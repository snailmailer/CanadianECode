import fitz
import json
import os
import re

pdf_path = r"C:\Users\Jovin\OneDrive\Documents\TRADES ELAP 309A\2024 CEC Code book.pdf"
doc = fitz.open(pdf_path)

sections = [
    {"title": "Section 0 — Object, scope, and definitions", "start": 53, "end": 67},
    {"title": "Section 2 — General Rules", "start": 68, "end": 75},
    {"title": "Section 4 — Conductors", "start": 76, "end": 82},
    {"title": "Section 6 — Services and service equipment", "start": 83, "end": 89},
    {"title": "Section 8 — Circuit loading and demand factors", "start": 90, "end": 97},
    {"title": "Section 10 — Grounding and bonding", "start": 98, "end": 107},
    {"title": "Section 12 — Wiring methods", "start": 108, "end": 156},
    {"title": "Section 14 — Protection and control", "start": 157, "end": 165},
    {"title": "Section 16 — Class 1 and Class 2 circuits", "start": 166, "end": 210},
    {"title": "Section 26 — Installation of electrical equipment", "start": 211, "end": 392},
    {"title": "Tables", "start": 393, "end": 514},
    {"title": "Diagrams", "start": 515, "end": 555},
    {"title": "Appendix B — Notes on Rules", "start": 556, "end": 764},
    {"title": "Appendix D — Tabulated general information", "start": 765, "end": 929},
    {"title": "Index", "start": 930, "end": 950}
]

# Quick test to see if the page matches
test_page = doc[53 - 1].get_text("text")
print("FIRST 100 CHARS OF PAGE 53 (0-indexed 52):")
print(test_page[:100])

output_data = []

for sec in sections:
    print(f"Extracting {sec['title']}...")
    text = ""
    # Assuming the numbers given by user are PDF physical pages (1-indexed)
    start_idx = sec['start'] - 1
    end_idx = min(sec['end'] - 1, doc.page_count - 1)
    
    for i in range(start_idx, end_idx + 1):
        if i >= doc.page_count:
            break
        page = doc[i]
        text += page.get_text("text") + "\n\n"
    
    # create a clean id
    safe_id = re.sub(r'[^a-zA-Z0-9]+', '-', sec['title'].lower()).strip('-')
    
    output_data.append({
        "id": safe_id,
        "title": sec['title'],
        "content": text
    })

os.makedirs("src/data", exist_ok=True)
with open("src/data/sections.json", "w", encoding="utf-8") as f:
    json.dump(output_data, f, ensure_ascii=False, indent=2)

print("Extraction complete. Output saved to src/data/sections.json")
