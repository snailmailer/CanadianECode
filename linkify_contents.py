import json
import re

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

with open("src/data/sections.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# Find contents section
contents_sec = [s for s in data if s["id"] == "contents"][0]

def linkify_contents_page(text):
    def repl_page_num(match):
        full_match = match.group(0)
        num_str = match.group(1)
        page_num = int(num_str)
        
        for sec in sections_config:
            if sec["id"] != "contents" and sec["start"] <= page_num <= sec["end"]:
                return f"_[{page_num}](#{sec['id']})_"
        return full_match

    # Match _108_ or similar numbers surrounded by underscores
    text = re.sub(r'_(\d+)_', repl_page_num, text)
    return text

contents_sec["content"] = linkify_contents_page(contents_sec["content"])

with open("src/data/sections.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Contents page numbers successfully linkified!")
