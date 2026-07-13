import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# Add import for Panel, PanelGroup, PanelResizeHandle
if "react-resizable-panels" not in content:
    content = content.replace("import { Home as HomeIcon", "import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';\nimport { Home as HomeIcon")

with open('src/App.tsx', 'w') as f:
    f.write(content)
