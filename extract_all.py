import fitz
import json
import os
import re
import pymupdf4llm

pdf_path = r"C:\Users\Jovin\OneDrive\Documents\TRADES ELAP 309A\2024 CEC Code book.pdf"
doc = fitz.open(pdf_path)

# Offset to map printed page number to 0-indexed physical page:
# printed page 1 is physical page 6 (0-indexed 6, i.e., 7th page of PDF)
# so 0-indexed page index = printed_page_number + 5.
# And 1-indexed page index = printed_page_number + 6.
offset = 5

sections_config = [
    {"id": "contents", "title": "Contents", "start": 1, "end": 8},
    {"id": "section-0", "title": "Section 0 — Object, scope, and definitions", "start": 53, "end": 67},
    {"id": "section-2", "title": "Section 2 — General Rules", "start": 68, "end": 75},
    {"id": "section-4", "title": "Section 4 — Conductors", "start": 76, "end": 82},
    {"id": "section-6", "title": "Section 6 — Services and service equipment", "start": 83, "end": 89},
    {"id": "section-8", "title": "Section 8 — Circuit loading and demand factors", "start": 90, "end": 97},
    {"id": "section-10", "title": "Section 10 — Grounding and bonding", "start": 98, "end": 107},
    {"id": "section-12", "title": "Section 12 — Wiring methods", "start": 108, "end": 156},
    {"id": "section-14", "title": "Section 14 — Protection and control", "start": 157, "end": 165},
    {"id": "section-16", "title": "Section 16 — Class 1 and Class 2 circuits", "start": 166, "end": 172},
    {"id": "section-18", "title": "Section 18 — Hazardous locations", "start": 173, "end": 191},
    {"id": "section-20", "title": "Section 20 — Flammable liquid and gasoline dispensing...", "start": 192, "end": 199},
    {"id": "section-22", "title": "Section 22 — Locations with corrosive liquids/moisture", "start": 200, "end": 203},
    {"id": "section-24", "title": "Section 24 — Patient care areas", "start": 204, "end": 210},
    {"id": "section-26", "title": "Section 26 — Installation of electrical equipment", "start": 211, "end": 231},
    {"id": "section-28", "title": "Section 28 — Motors and generators", "start": 232, "end": 244},
    {"id": "section-30", "title": "Section 30 — Installation of lighting equipment", "start": 245, "end": 257},
    {"id": "section-32", "title": "Section 32 — Fire alarm systems...", "start": 258, "end": 260},
    {"id": "section-34", "title": "Section 34 — Signs and outline lighting", "start": 261, "end": 264},
    {"id": "section-36", "title": "Section 36 — High-voltage installations", "start": 265, "end": 273},
    {"id": "section-38", "title": "Section 38 — Elevators, dumbwaiters, lifts...", "start": 274, "end": 282},
    {"id": "section-40", "title": "Section 40 — Electric cranes and hoists", "start": 283, "end": 284},
    {"id": "section-42", "title": "Section 42 — Electric welders", "start": 285, "end": 287},
    {"id": "section-44", "title": "Section 44 — Theatre installations", "start": 288, "end": 291},
    {"id": "section-46", "title": "Section 46 — Emergency power supply...", "start": 292, "end": 295},
    {"id": "section-52", "title": "Section 52 — Diagnostic imaging installations", "start": 296, "end": 297},
    {"id": "section-54", "title": "Section 54 — Community antenna/radio/TV...", "start": 298, "end": 305},
    {"id": "section-56", "title": "Section 56 — Optical fiber cables", "start": 306, "end": 307},
    {"id": "section-58", "title": "Section 58 — Passenger ropeways...", "start": 308, "end": 312},
    {"id": "section-60", "title": "Section 60 — Electrical communication systems", "start": 313, "end": 320},
    {"id": "section-62", "title": "Section 62 — Fixed electric heating systems", "start": 321, "end": 331},
    {"id": "section-64", "title": "Section 64 — Renewable energy systems...", "start": 332, "end": 359},
    {"id": "section-66", "title": "Section 66 — Amusement parks, midways, carnivals...", "start": 360, "end": 363},
    {"id": "section-68", "title": "Section 68 — Pools, tubs, and spas", "start": 364, "end": 370},
    {"id": "section-70", "title": "Section 70 — Factory-built relocatable/non-relocatable...", "start": 371, "end": 376},
    {"id": "section-72", "title": "Section 72 — Mobile home/recreational vehicle parks", "start": 377, "end": 378},
    {"id": "section-74", "title": "Section 74 — Airport installations", "start": 379, "end": 380},
    {"id": "section-76", "title": "Section 76 — Temporary wiring", "start": 381, "end": 382},
    {"id": "section-78", "title": "Section 78 — Marine wharves, docking facilities...", "start": 383, "end": 385},
    {"id": "section-80", "title": "Section 80 — Cathodic protection", "start": 386, "end": 387},
    {"id": "section-84", "title": "Section 84 — Interconnection of power sources", "start": 388, "end": 389},
    {"id": "section-86", "title": "Section 86 — Electric vehicle charging systems", "start": 390, "end": 392},
    {"id": "tables", "title": "Tables", "start": 393, "end": 514},
    {"id": "diagrams", "title": "Diagrams", "start": 515, "end": 523},
    {"id": "appendix-a", "title": "Appendix A — Safety standards for electrical equipment", "start": 524, "end": 555},
    {"id": "appendix-b", "title": "Appendix B — Notes on Rules", "start": 556, "end": 740},
    {"id": "appendix-c", "title": "Appendix C — Organization and rules of procedure", "start": 741, "end": 764},
    {"id": "appendix-d", "title": "Appendix D — Tabulated general information", "start": 765, "end": 837},
    {"id": "appendix-f", "title": "Appendix F — Descriptive system documents...", "start": 839, "end": 843},
    {"id": "appendix-g", "title": "Appendix G — Fire protection systems", "start": 844, "end": 849},
    {"id": "appendix-h", "title": "Appendix H — Combustible gas detection...", "start": 850, "end": 853},
    {"id": "appendix-i", "title": "Appendix I — Interpretations", "start": 854, "end": 855},
    {"id": "appendix-j", "title": "Appendix J — Class and Division system", "start": 856, "end": 919},
    {"id": "appendix-l", "title": "Appendix L — Hazardous area classifications", "start": 921, "end": 927},
    {"id": "appendix-m", "title": "Appendix M — Translated caution and warning markings", "start": 928, "end": 929},
    {"id": "index", "title": "Index", "start": 930, "end": 950}
]

def clean_markdown(text):
    # Strip CSA C22.1:24 and headers/footers
    text = re.sub(r'(?mi)^\s*_*CSA C22\.1:24_*\s*$', '', text)
    text = re.sub(r'(?mi)^\s*_*Canadian Electrical Code, Part I_*\s*$', '', text)
    text = re.sub(r'(?mi)^\s*_*March 2024_*\s*$', '', text)
    text = re.sub(r'(?mi)^\s*_*.\s*2024 Canadian Standards Association_*\s*$', '', text)
    text = re.sub(r'(?mi)^\s*_*©\s*2024 Canadian Standards Association_*\s*$', '', text)
    
    # Strip standalone page numbers
    text = re.sub(r'(?m)^\s*\*\*_\s*\d+\s*_\*\*\s*$', '', text)
    text = re.sub(r'(?m)^\s*_\s*\d+\s*_\s*$', '', text)
    text = re.sub(r'(?m)^\s*\b\d+\b\s*$', '', text)
    
    # Strip running section headers
    text = re.sub(r'(?m)^\s*\*\*_(Section \d+|Appendix [A-Z]|Tables|Diagrams|Index)_*\*\*\s*_[^_]+_\s*$', '', text)
    text = re.sub(r'(?m)^\s*_(Section \d+|Appendix [A-Z]|Tables|Diagrams|Index)_*\s*_[^_]+_\s*$', '', text)
    
    # Collapse multiple blank lines
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

# Build direct maps for routing links
section_ids = [s["id"] for s in sections_config]

def linkify_references(text, current_section_id):
    # Linkify "Appendix [A-M]"
    text = re.sub(r'(?i)\bAppendix ([A-M])\b', lambda m: f"[Appendix {m.group(1)}](#appendix-{m.group(1).lower()})" if f"appendix-{m.group(1).lower()}" in section_ids else m.group(0), text)
    
    # Linkify "Table \d+" and "Diagram \d+"
    text = re.sub(r'(?i)\bTable (\d+)\b', r'[\g<0>](#tables)', text)
    text = re.sub(r'(?i)\bDiagram (\d+)\b', r'[\g<0>](#diagrams)', text)
    
    # Linkify "Section \d+"
    def repl_sec(match):
        sec_num = match.group(1)
        target_id = f"section-{sec_num}"
        if target_id in section_ids:
            return f"[Section {sec_num}](#{target_id})"
        return match.group(0)
    text = re.sub(r'(?i)\bSection (\d+)\b', repl_sec, text)
    
    # Linkify rule-like numbers "XX-YYY" (e.g. 64-002, 2-120, 28-604)
    # Check if the prefix XX corresponds to a known section-XX
    def repl_rule_raw(match):
        full_num = match.group(0)
        prefix = match.group(1)
        target_id = f"section-{prefix}"
        if target_id in section_ids:
            return f"[{full_num}](#{target_id})"
        return full_num
    
    # Avoid double-wrapping already wrapped markdown links
    text = re.sub(r'(?<!\[)\b(\d+)-(\d+)\w*(?:\([^)]+\))*\b(?!\])', repl_rule_raw, text)
    
    return text

def extract_index_nested():
    """Extract and format the Index using span coordinates for clean nesting."""
    print("Extracting Index using nested span coordinate layout...")
    lines_formatted = []
    
    for page_num in range(930 + offset, 950 + offset + 1):
        if page_num >= len(doc):
            break
        p = doc[page_num]
        blocks = p.get_text("dict")["blocks"]
        
        # Sort blocks by top-left
        blocks.sort(key=lambda b: (b["bbox"][1], b["bbox"][0]))
        
        for b in blocks:
            if "lines" not in b:
                continue
            for l in b["lines"]:
                # Combine spans on the same line
                line_text = ""
                min_x0 = 999.0
                for s in l["spans"]:
                    t = s["text"]
                    line_text += t
                    min_x0 = min(min_x0, s["bbox"][0])
                
                line_text = line_text.strip()
                if not line_text:
                    continue
                
                # Ignore headers/footers
                if "CSA C22.1:24" in line_text or "Canadian Electrical Code" in line_text or "March 2024" in line_text or "Standards Association" in line_text:
                    continue
                if re.match(r'^\d+$', line_text) or line_text == "Index":
                    continue
                
                # Determine indentation level based on starting x-coordinate
                # Main entries start around 72.0
                # Level 1 sub-entries start around 90.0
                # Level 2 sub-entries start around 108.0
                if min_x0 < 80.0:
                    indent = ""
                    # Check if it's a single letter header like "A", "B", etc.
                    if len(line_text) == 1 and line_text.isupper():
                        lines_formatted.append(f"\n### **{line_text}**\n")
                        continue
                    else:
                        prefix_bullet = "* "
                elif min_x0 < 100.0:
                    indent = "  "
                    prefix_bullet = "* "
                else:
                    indent = "    "
                    prefix_bullet = "* "
                
                lines_formatted.append(f"{indent}{prefix_bullet}{line_text}")
                
    content = "\n".join(lines_formatted)
    return content

def linkify_contents_page(text):
    """Make page numbers in Contents clickable."""
    def repl_page_link(match):
        line = match.group(0)
        # Find the last number on the line, which is the page number
        nums = re.findall(r'\b\d+\b', line)
        if nums:
            page_num = int(nums[-1])
            # Find which section starts at this page number
            for sec in sections_config:
                if sec["id"] != "contents" and sec["start"] == page_num:
                    # Linkify the page number
                    return line.replace(str(page_num), f"[{page_num}](#{sec['id']})")
        return line

    lines = text.split("\n")
    processed_lines = []
    for line in lines:
        # Match lines that end with a number (possibly with trailing spaces)
        if re.search(r'\b\d+\s*$', line):
            processed_lines.append(repl_page_link(line))
        else:
            processed_lines.append(line)
    return "\n".join(processed_lines)


output_data = []

for sec in sections_config:
    sec_id = sec["id"]
    title = sec["title"]
    start_p = sec["start"]
    end_p = sec["end"]
    
    print(f"Extracting {title} (Printed Pages {start_p}-{end_p})...")
    
    if sec_id == "index":
        cleaned_md = extract_index_nested()
    else:
        # Convert printed page number to 0-indexed physical page
        p_start = start_p + offset
        p_end = end_p + offset
        page_range = list(range(p_start, p_end + 1))
        
        raw_md = pymupdf4llm.to_markdown(doc, pages=page_range)
        cleaned_md = clean_markdown(raw_md)
        
    # Linkify all internal references (Rules, Sections, Appendices, Tables, Diagrams)
    linkified_md = linkify_references(cleaned_md, sec_id)
    
    # If this is the Table of Contents page, also make the page numbers clickable!
    if sec_id == "contents":
        linkified_md = linkify_contents_page(linkified_md)
        
    output_data.append({
        "id": sec_id,
        "title": title,
        "content": linkified_md
    })

# Save to sections.json
os.makedirs("src/data", exist_ok=True)
with open("src/data/sections.json", "w", encoding="utf-8") as f:
    json.dump(output_data, f, ensure_ascii=False, indent=2)

print("\nAll sections extracted and processed successfully!")
