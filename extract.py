import fitz
import json
import os
import re
import pymupdf4llm

pdf_path = r"C:\Users\Jovin\OneDrive\Documents\TRADES ELAP 309A\2024 CEC Code book.pdf"
doc = fitz.open(pdf_path)

# Adding the offset of 6 to translate printed page numbers to physical PDF page numbers
offset = 6

sections = [
    {"title": "Section 0 — Object, scope, and definitions", "start": 53 + offset, "end": 67 + offset},
    {"title": "Section 2 — General Rules", "start": 68 + offset, "end": 75 + offset},
    {"title": "Section 4 — Conductors", "start": 76 + offset, "end": 82 + offset},
    {"title": "Section 6 — Services and service equipment", "start": 83 + offset, "end": 89 + offset},
    {"title": "Section 8 — Circuit loading and demand factors", "start": 90 + offset, "end": 97 + offset},
    {"title": "Section 10 — Grounding and bonding", "start": 98 + offset, "end": 107 + offset},
    {"title": "Section 12 — Wiring methods", "start": 108 + offset, "end": 156 + offset},
    {"title": "Section 14 — Protection and control", "start": 157 + offset, "end": 165 + offset},
    {"title": "Section 16 — Class 1 and Class 2 circuits", "start": 166 + offset, "end": 210 + offset},
    {"title": "Section 26 — Installation of electrical equipment", "start": 211 + offset, "end": 392 + offset},
    {"title": "Tables", "start": 393 + offset, "end": 514 + offset},
    {"title": "Diagrams", "start": 515 + offset, "end": 555 + offset},
    {"title": "Appendix B — Notes on Rules", "start": 556 + offset, "end": 764 + offset},
    {"title": "Appendix D — Tabulated general information", "start": 765 + offset, "end": 929 + offset},
    {"title": "Index", "start": 930 + offset, "end": 950 + offset}
]

def clean_markdown(text):
    # 1. Strip standard header/footer text
    text = re.sub(r'(?m)^CSA C22\.1:24\s*$', '', text)
    text = re.sub(r'(?m)^Canadian Electrical Code, Part I\s*$', '', text)
    text = re.sub(r'(?m)^March 2024\s*$', '', text)
    text = re.sub(r'(?m)^© 2024 Canadian Standards Association\s*$', '', text)
    
    # 2. Strip standalone page numbers
    text = re.sub(r'(?m)^\d+\s*$', '', text)
    
    # 3. Strip running headers (e.g. "Section 0 Object, scope, and definitions", "Section 2 General Rules", "Section 12 Wiring methods")
    # We want to be careful not to match markdown headers like "# Section 0", so we match lines that don't start with '#'
    text = re.sub(r'(?m)^(Section \d+|Appendix [A-Z]|Tables|Diagrams|Index)[^#\n]*$', '', text)
    
    # 4. Collapse multiple consecutive blank lines to clean up the spacing
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    return text.strip()

output_data = []

for sec in sections:
    print(f"Extracting {sec['title']} (Physical Pages {sec['start']} to {sec['end']})...")
    
    start_idx = sec['start'] - 1
    end_idx = min(sec['end'] - 1, doc.page_count - 1)
    
    page_numbers = list(range(start_idx, end_idx + 1))
    
    md_text = pymupdf4llm.to_markdown(doc, pages=page_numbers)
    
    # Apply clean up
    cleaned_md = clean_markdown(md_text)
    
    safe_id = re.sub(r'[^a-zA-Z0-9]+', '-', sec['title'].lower()).strip('-')
    
    output_data.append({
        "id": safe_id,
        "title": sec['title'],
        "content": cleaned_md
    })

os.makedirs("src/data", exist_ok=True)
with open("src/data/sections.json", "w", encoding="utf-8") as f:
    json.dump(output_data, f, ensure_ascii=False, indent=2)

print("Extraction complete. Output saved to src/data/sections.json")
