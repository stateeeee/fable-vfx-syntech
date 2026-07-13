import re

with open('src/components/AiDirector.tsx', 'r') as f:
    content = f.read()

# First let's undo all className={`...`} that we might have messed up just now
content = content.replace('className={`', 'className="')

def replacer(match):
    inner = match.group(1)
    if "${" in inner:
        return 'className={`' + inner + '`}'
    else:
        return 'className="' + inner + '"'

content = re.sub(r'className="([^"]*)"', replacer, content)

with open('src/components/AiDirector.tsx', 'w') as f:
    f.write(content)
