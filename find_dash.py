import re

file_path = r"c:\Users\HP\Documents\GitHub\ai-agent-digitivia-production\index.html"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'id="tab-dash' in line or 'data-view="dashboard"' in line or 'div id="dashboard"' in line:
         print(f"dashboard at {i+1}: {line.strip()[:100]}")
