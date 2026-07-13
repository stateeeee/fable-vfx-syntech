import re

with open('src/components/AiDirector.tsx', 'r') as f:
    content = f.read()

# Fix the nested template literals
content = content.replace("? '${isDayMode ? 'bg-white border-neutral-200 text-neutral-800 shadow-sm' : 'bg-black/60 border-gold-500/15 text-neutral-300'}'",
"? (isDayMode ? 'bg-white border-neutral-200 text-neutral-800 shadow-sm' : 'bg-black/60 border-gold-500/15 text-neutral-300')")

content = content.replace(": '${isDayMode ? 'bg-gold-500/10 border-gold-500/30 text-gold-800' : 'bg-gold-500/10 border-gold-500/35 text-gold-200'}'",
": (isDayMode ? 'bg-gold-500/10 border-gold-500/30 text-gold-800' : 'bg-gold-500/10 border-gold-500/35 text-gold-200')")

with open('src/components/AiDirector.tsx', 'w') as f:
    f.write(content)
