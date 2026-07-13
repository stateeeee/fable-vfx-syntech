import re

with open('src/components/AiDirector.tsx', 'r') as f:
    content = f.read()

# Fix the broken ones:
content = content.replace('className=`}w-7', 'className="w-7')
content = content.replace('className=`}markdown-body', 'className="markdown-body')

# Wait, the closing `}` is at the end? Let's check the lines
