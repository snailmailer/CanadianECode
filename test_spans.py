import fitz

pdf_path = r"C:\Users\Jovin\OneDrive\Documents\TRADES ELAP 309A\2024 CEC Code book.pdf"
doc = fitz.open(pdf_path)
p = doc[935]

# Let's extract spans of text with their coordinates
# get_text("dict") returns blocks, which contain lines, which contain spans.
# Each span has coordinates and text.
blocks = p.get_text("dict")["blocks"]

for b in blocks:
    if "lines" not in b:
        continue
    for l in b["lines"]:
        for s in l["spans"]:
            text = s["text"]
            x0 = s["bbox"][0]
            print(f"x={x0:.1f} | {repr(text)}")
