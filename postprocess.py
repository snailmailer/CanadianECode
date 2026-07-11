"""Post-process sections.json to remove headers/footers and linkify references."""
import json
import re

with open("src/data/sections.json", "r", encoding="utf-8") as f:
    data = json.load(f)

def clean_markdown(text):
    # Strip CSA C22.1:24 in various markdown formatting
    text = re.sub(r'(?m)^.*?CSA C22\.1:24.*?$', '', text)
    # Strip Canadian Electrical Code, Part I
    text = re.sub(r'(?m)^.*?Canadian Electrical Code, Part I.*?$', '', text)
    # Strip March 2024
    text = re.sub(r'(?m)^.*?March 2024.*?$', '', text)
    # Strip © 2024 Canadian Standards Association
    text = re.sub(r'(?m)^.*?2024 Canadian Standards Association.*?$', '', text)
    # Strip standalone bold/italic page numbers like **_53_** or _53_ or just 53
    text = re.sub(r'(?m)^\s*\*{0,2}_?\s*\d{1,4}\s*_?\*{0,2}\s*$', '', text)
    # Strip running section headers (e.g. **_Section 0_** _Object, scope..._)
    text = re.sub(r'(?m)^\s*\*{0,2}_?(?:Section \d+|Appendix [A-Z]|Tables|Diagrams|Index)_?\*{0,2}\s+_[^_\n]+_\s*$', '', text)
    # Collapse triple+ newlines
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
    
    # Linkify "Appendix B" and "Appendix D"
    text = re.sub(r'(?<!\[)\bAppendix B\b(?!\])', r'[Appendix B](#appendix-b-notes-on-rules)', text)
    text = re.sub(r'(?<!\[)\bAppendix D\b(?!\])', r'[Appendix D](#appendix-d-tabulated-general-information)', text)
    
    # Linkify "Table \d+"
    text = re.sub(r'(?<!\[)\bTable (\d+)\b', r'[Table \1](#tables)', text)
    # Linkify "Diagram \d+"
    text = re.sub(r'(?<!\[)\bDiagram (\d+)\b', r'[Diagram \1](#diagrams)', text)
    
    # Linkify "Section \d+"
    def repl_sec(match):
        sec_num = match.group(1)
        if sec_num in sec_map:
            return f"[Section {sec_num}](#{sec_map[sec_num]})"
        return match.group(0)
    text = re.sub(r'(?<!\[)\bSection (\d+)\b', repl_sec, text)
    
    # Linkify "Rule \d+-\d+..." references
    def repl_rule(match):
        rule_text = match.group(0)
        prefix = match.group(1)
        if prefix in sec_map:
            return f"[{rule_text}](#{sec_map[prefix]})"
        return rule_text
    text = re.sub(r'(?<!\[)\bRule (\d+)-\d+\w*(?:\([^)]+\))*', repl_rule, text)
    
    return text

for section in data:
    section["content"] = clean_markdown(section["content"])
    section["content"] = linkify_references(section["content"])

with open("src/data/sections.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

# Verify
sample = data[0]["content"][:500]
still_has = "CSA C22.1:24" in sample or "March 2024" in sample
print(f"Headers still in first 500 chars of Section 0: {still_has}")
print(f"Sample (first 300 chars):\n{sample[:300]}")
print("\nDone! sections.json cleaned and linkified.")
