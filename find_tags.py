import re

file_path = r"c:\Users\HP\Documents\GitHub\ai-agent-digitivia-production\index.html"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "<style" in line.lower() or "</style>" in line.lower():
        print(f"STYLE TAG at line {i+1}: {line.strip()[:100]}")
    if "</head>" in line.lower() or "<body" in line.lower():
        print(f"HEAD/BODY TAG at line {i+1}: {line.strip()[:100]}")
