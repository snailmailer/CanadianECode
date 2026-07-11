import fitz
import re

pdf_path = r"C:\Users\Jovin\OneDrive\Documents\TRADES ELAP 309A\2024 CEC Code book.pdf"
doc = fitz.open(pdf_path)

print(f"Total pages: {len(doc)}")

# We will scan each page to find the main section headers.
# Usually, a new section page starts with "Section XX" or "Appendix XX" or "Tables" or "Diagrams" or "Index".
# Let's inspect the top lines of each page.
sections_found = []

for page_num in range(len(doc)):
    text = doc[page_num].get_text("blocks")
    if not text:
        continue
    
    # Sort blocks by top-left coordinate
    text.sort(key=lambda b: (b[1], b[0]))
    
    # Look at the first few blocks
    top_blocks = text[:5]
    block_texts = [b[4].strip() for b in top_blocks]
    
    # Combine block texts to scan for headers
    combined_header = " ".join(block_texts).replace("\n", " ")
    
    # Check for Section X
    # Matches "Section 0", "Section 2", etc.
    sec_match = re.search(r'\bSection\s+(\d+)\b', combined_header)
    app_match = re.search(r'\bAppendix\s+([A-Z])\b', combined_header)
    
    is_tables = "Tables" in combined_header[:50] and page_num > 300
    is_diagrams = "Diagrams" in combined_header[:50] and page_num > 400
    is_index = "Index" in combined_header[:50] and page_num > 800
    
    # Let's do more precise checks:
    # A page starting a section typically has "Section X" as a prominent header.
    # In PyMuPDF, we can also search for the exact text on the page.
    page_text = doc[page_num].get_text()
    lines = [line.strip() for line in page_text.split("\n") if line.strip()]
    
    # Check if this page contains a line that is exactly "Section X" or "Appendix X"
    for line in lines[:5]:
        if re.match(r'^Section\s+\d+$', line) or re.match(r'^Section\s+\d+\s+—.*$', line) or re.match(r'^Section\s+\d+\s+–.*$', line) or re.match(r'^Section\s+\d+\s+.*$', line):
            m = re.match(r'^Section\s+(\d+)', line)
            if m:
                sec_num = int(m.group(1))
                sections_found.append(("section", sec_num, page_num, line))
                break
        elif re.match(r'^Appendix\s+[A-Z]$', line) or re.match(r'^Appendix\s+[A-Z]\s+—.*$', line) or re.match(r'^Appendix\s+[A-Z]\s+–.*$', line) or re.match(r'^Appendix\s+[A-Z]\s+.*$', line):
            m = re.match(r'^Appendix\s+([A-Z])', line)
            if m:
                app_letter = m.group(1)
                sections_found.append(("appendix", app_letter, page_num, line))
                break
        elif line == "Tables" and page_num > 300:
            sections_found.append(("tables", "Tables", page_num, line))
            break
        elif line == "Diagrams" and page_num > 400:
            sections_found.append(("diagrams", "Diagrams", page_num, line))
            break
        elif line == "Index" and page_num > 800:
            sections_found.append(("index", "Index", page_num, line))
            break

# De-duplicate sections_found (sometimes we might get multiple hits on the same page or sequential hits)
unique_sections = []
seen_pages = set()
for item in sections_found:
    p = item[2]
    if p not in seen_pages:
        seen_pages.add(p)
        unique_sections.append(item)

# Sort by page number
unique_sections.sort(key=lambda x: x[2])

print(f"Found {len(unique_sections)} section markers:")
for item in unique_sections:
    print(f"Type: {item[0]}, Name: {item[1]}, Physical Page: {item[2]} (Printed: {item[2]-5}), Line: {repr(item[3])}")
