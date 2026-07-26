#!/usr/bin/env python3
import json, subprocess, sys
from pathlib import Path

root=Path(sys.argv[1]).resolve()
tracked=subprocess.check_output(["git","-C",str(root),"ls-files","-z"]).decode().split("\0")
names={"package.json","tsconfig.json","tsconfig.app.json","tsconfig.node.json",
       "vite.config.ts","vite.config.js","tailwind.config.js","postcss.config.js",
       "settings.gradle","settings.gradle.kts","gradle.properties"}
extensions={".properties",".yaml",".yml",".toml"}
prefixes=("ops/config/","deploy/","apps/carbonet-api/src/main/resources/",
          "projects/carbonet-frontend/source/")
denied=("secret","password","credential",".env","api-key","private-key","node_modules/",
        "/build/","/dist/","static/react-app/")
items=[]
for relative in tracked:
    if not relative or not relative.startswith(prefixes): continue
    low=relative.lower()
    if any(token in low for token in denied): continue
    path=root/relative
    if not path.is_file() or path.stat().st_size>1_000_000: continue
    if path.name not in names and path.suffix.lower() not in extensions: continue
    try: content=path.read_text(encoding="utf-8")
    except UnicodeDecodeError: continue
    items.append({"sourcePath":relative.replace("\\","/"),"artifactKind":"CONFIG_SOURCE",
      "languageCode":path.suffix.lstrip(".") or "config","sourceContent":content,
      "designHash":None,"metadata":{"bootstrap":"GIT_TRACKED_ALLOWLIST","dbAuthoritative":True}})
print(json.dumps(items,ensure_ascii=False,separators=(",",":")))
