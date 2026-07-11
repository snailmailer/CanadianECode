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
    # 1. Strip standard header/footer text (handling formatting wrappers like _ or **)
    text = re.sub(r'(?mi)^\s*_*CSA C22\.1:24_*\s*$', '', text)
    text = re.sub(r'(?mi)^\s*_*Canadian Electrical Code, Part I_*\s*$', '', text)
    text = re.sub(r'(?mi)^\s*_*March 2024_*\s*$', '', text)
    text = re.sub(r'(?mi)^\s*_*.\s*2024 Canadian Standards Association_*\s*$', '', text)
    text = re.sub(r'(?mi)^\s*_*©\s*2024 Canadian Standards Association_*\s*$', '', text)
    
    # 2. Strip standalone page numbers (e.g. **_53_** or similar page numbers at the footer/header)
    text = re.sub(r'(?m)^\s*\*\*_\s*\d+\s*_\*\*\s*$', '', text)
    text = re.sub(r'(?m)^\s*_\s*\d+\s*_\s*$', '', text)
    text = re.sub(r'(?m)^\s*\b\d+\b\s*$', '', text)
    
    # 3. Strip running headers (e.g. "**_Section 0_** _Object, scope, and definitions_" or similar)
    text = re.sub(r'(?m)^\s*\*\*_(Section \d+|Appendix [A-Z]|Tables|Diagrams|Index)_*\*\*\s*_[^_]+_\s*$', '', text)
    text = re.sub(r'(?m)^\s*_(Section \d+|Appendix [A-Z]|Tables|Diagrams|Index)_*\s*_[^_]+_\s*$', '', text)
    
    # 4. Collapse multiple consecutive blank lines to clean up the spacing
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    return text.strip()

def linkify_references(text):
    sec_map = {
        "0": "section-0-object-scope-and-definitions",
        "2": "section-2-general-rules",
        "4": "section-4-conductors",
        "6": "section-6-services-and-service-equipment",
        "8": "section-8-circuit-loading-and-demand-factors",
        "10": "section-10-grounding-and-bonding",
        "12": "section-12-wiring-methods",
        "14": "section-14-protection-and-control",
        "16": "section-16-class-1-and-class-2-circuits",
        "26": "section-26-installation-of-electrical-equipment",
    }
    
    # 1. Linkify "Appendix B" and "Appendix D" (case-insensitive)
    text = re.sub(r'(?i)\bAppendix B\b', r'[Appendix B](#appendix-b-notes-on-rules)', text)
    text = re.sub(r'(?i)\bAppendix D\b', r'[Appendix D](#appendix-d-tabulated-general-information)', text)
    
    # 2. Linkify "Table \d+" and "Diagram \d+"
    text = re.sub(r'(?i)\bTable (\d+)\b', r'[\g<0>](#tables)', text)
    text = re.sub(r'(?i)\bDiagram (\d+)\b', r'[\g<0>](#diagrams)', text)
    
    # 3. Linkify "Section \d+"
    def repl_sec(match):
        sec_num = match.group(1)
        if sec_num in sec_map:
            return f"[Section {sec_num}](#{sec_map[sec_num]})"
        return match.group(0)
    text = re.sub(r'(?i)\bSection (\d+)\b', repl_sec, text)
    
    # 4. Linkify "Rule \d+-\d+" (e.g. Rule 10-102(1)(a))
    def repl_rule(match):
        rule_text = match.group(0)
        prefix = match.group(1)
        if prefix in sec_map:
            return f"[{rule_text}](#{sec_map[prefix]})"
        return rule_text
    text = re.sub(r'(?i)\bRule (\d+)-\d+\w*(?:\([^)]+\))*', repl_rule, text)
    
    return text

output_data = []

for sec in sections:
    print(f"Extracting {sec['title']} (Physical Pages {sec['start']} to {sec['end']})...")
    
    start_idx = sec['start'] - 1
    end_idx = min(sec['end'] - 1, doc.page_count - 1)
    
    page_numbers = list(range(start_idx, end_idx + 1))
    
    md_text = pymupdf4llm.to_markdown(doc, pages=page_numbers)
    
    # Apply clean up and linkify references
    cleaned_md = clean_markdown(md_text)
    linkified_md = linkify_references(cleaned_md)
    
    safe_id = re.sub(r'[^a-zA-Z0-9]+', '-', sec['title'].lower()).strip('-')
    
    output_data.append({
        "id": safe_id,
        "title": sec['title'],
        "content": linkified_md
    })

os.makedirs("src/data", exist_ok=True)
with open("src/data/sections.json", "w", encoding="utf-8") as f:
    json.dump(output_data, f, ensure_ascii=False, indent=2)

print("Extraction complete. Output saved to src/data/sections.json")
