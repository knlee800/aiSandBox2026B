roadmap = r'C:\Users\knlee\aiSandBox2026B\docs\AINOW-EXECUTION-ROADMAP.md'
em = '\u2014'

with open(roadmap, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the broken near-term table section (section 11)
# Locate by finding the section header then the rows
section_marker = '## 11. Near-Term Sequence'
sec_idx = content.find(section_marker)
end_marker = '## 12. Medium-Term Sequence'
end_idx = content.find(end_marker)

near_term_block = content[sec_idx:end_idx]
print("Near-term block:")
print(repr(near_term_block))
