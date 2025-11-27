import fitz  # PyMuPDF
import re
import json

doc = fitz.open("NCO - 2015.pdf")
job_data = []
pattern = re.compile(r"^(\d{4}\.\d{4})\s+(.+)")

for page_num in range(100, 500):  # Change to 1000 or 1200 if needed
    page = doc.load_page(page_num)
    lines = page.get_text().split('\n')
    current = {}
    for line in lines:
        match = pattern.match(line.strip())
        if match:
            if current:
                job_data.append(current)
            current = {
                "code": match.group(1),
                "title": match.group(2),
                "description": ""
            }
        elif current and line.strip():
            current["description"] += " " + line.strip()
    if current:
        job_data.append(current)

with open("nco_full_data.json", "w", encoding="utf-8") as f:
    json.dump(job_data, f, indent=2, ensure_ascii=False)

print(f"✅ Extracted {len(job_data)} job entries into nco_full_data.json")
