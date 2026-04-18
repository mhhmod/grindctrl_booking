import re
file_path = r"c:\Users\HP\Documents\GitHub\ai-agent-digitivia-production\index.html"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "landing-page" in line:
        print(f"landing page at {i+1}")
    if "app-container" in line or 'id="app"' in line or "flex h-screen" in line:
        print(f"app layout at {i+1}: {line.strip()[:100]}")
    if "sidebar" in line.lower() and "fixed" in line.lower() and "w-64" in line.lower():
        print(f"sidebar at {i+1}: {line.strip()[:100]}")
