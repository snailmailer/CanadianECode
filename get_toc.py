import fitz

pdf_path = r"C:\Users\Jovin\OneDrive\Documents\TRADES ELAP 309A\2024 CEC Code book.pdf"
doc = fitz.open(pdf_path)

print("--- Table of Contents Extracted ---")
for p in range(6, 14): # physical pages 6 to 13
    print(f"--- Physical Page {p} (Printed Page {p-5}) ---")
    print(doc[p].get_text())
