import re

with open('src/components/AiDirector.tsx', 'r') as f:
    content = f.read()

replacements = [
    ('bg-[#050505]', "${isDayMode ? 'bg-[#fbfaf7]' : 'bg-[#050505]'}"),
    ('border-gold-500/20 bg-black', "${isDayMode ? 'border-neutral-200 bg-white' : 'border-gold-500/20 bg-black'}"),
    ('text-[#a882ff]', "${isDayMode ? 'text-[#7b51b7]' : 'text-[#a882ff]'}"),
    ('text-neutral-400', "${isDayMode ? 'text-neutral-500' : 'text-neutral-400'}"),
    ('bg-[#0a0a0a]', "${isDayMode ? 'bg-[#fbfaf7]' : 'bg-[#0a0a0a]'}"),
    ('border-gold-500/10', "${isDayMode ? 'border-neutral-200' : 'border-gold-500/10'}"),
    ('bg-gold-950/40 border border-gold-500/30 text-gold-500', "${isDayMode ? 'bg-gold-500/10 border border-gold-500/30 text-gold-600' : 'bg-gold-950/40 border border-gold-500/30 text-gold-500'}"),
    ('bg-black/60 border-gold-500/15 text-neutral-300', "${isDayMode ? 'bg-white border-neutral-200 text-neutral-800 shadow-sm' : 'bg-black/60 border-gold-500/15 text-neutral-300'}"),
    ('bg-gold-500/10 border-gold-500/35 text-gold-200', "${isDayMode ? 'bg-gold-500/10 border-gold-500/30 text-gold-800' : 'bg-gold-500/10 border-gold-500/35 text-gold-200'}"),
    ('bg-neutral-950 border border-gold-500/25 px-4', "${isDayMode ? 'bg-white border border-neutral-300 px-4 shadow-inner' : 'bg-neutral-950 border border-gold-500/25 px-4'}"),
    ('border-t border-gold-500/15 p-4 bg-[#0a0a0a]', "${isDayMode ? 'border-t border-neutral-200 p-4 bg-[#f5f4f0]' : 'border-t border-gold-500/15 p-4 bg-[#0a0a0a]'}"),
    ('border-t border-gold-500/15 space-y-2', "${isDayMode ? 'border-t border-neutral-200 space-y-2' : 'border-t border-gold-500/15 space-y-2'}"),
    ('bg-gold-500/20 border border-gold-500/40 text-gold-300', "${isDayMode ? 'bg-gold-500/20 border border-gold-500/40 text-gold-700' : 'bg-gold-500/20 border border-gold-500/40 text-gold-300'}"),
    ('text-neutral-600', "${isDayMode ? 'text-neutral-400' : 'text-neutral-600'}"),
    ('text-gold-400', "${isDayMode ? 'text-gold-600' : 'text-gold-400'}"),
    ('text-white focus:outline-none focus:border-gold-500/60 placeholder-neutral-600', "${isDayMode ? 'text-neutral-900 focus:outline-none focus:border-gold-500/60 placeholder-neutral-400' : 'text-white focus:outline-none focus:border-gold-500/60 placeholder-neutral-600'}")
]

for old, new in replacements:
    content = content.replace('className="' + old + '"', 'className={`' + new + '`}')
    content = content.replace(old, new)
    
with open('src/components/AiDirector.tsx', 'w') as f:
    f.write(content)
