#!/usr/bin/env python3
"""Inventory Resonance routes, endpoints, tables, menus, and SDUI assets."""
import argparse, hashlib, json, re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROUTE_RE = re.compile(r'\{\s*id:\s*"([^"]+)"[^}]*?label:\s*"([^"]+)"[^}]*?koPath:\s*"([^"]+)"[^}]*?enPath:\s*"([^"]+)"', re.S)
LOADER_RE = re.compile(r'\{\s*id:\s*"([^"]+)"[^}]*?exportName:\s*"([^"]+)"[^}]*?import\("([^"]+)"\)', re.S)
CLASS_MAPPING_RE = re.compile(r'@RequestMapping\s*\(\s*(?:value\s*=\s*)?\{?\s*"([^"]+)"', re.S)
METHOD_MAPPING_RE = re.compile(r'@(Get|Post|Put|Delete|Patch|Request)Mapping\s*\((.*?)\)', re.S)
PATH_RE = re.compile(r'"(/[^"]*)"')
TABLE_RE = re.compile(r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z0-9_."]+)', re.I)

def normalized(path: str) -> str:
    value = re.sub(r"\{[^/]+\}", "{param}", path.strip())
    value = re.sub(r"/+", "/", value)
    return "/" + value.strip("/") if value != "/" else "/"

def scan_routes(root: Path) -> list[dict]:
    routes, loaders = [], {}
    family_root = root / "projects/carbonet-frontend/source/src/app/routes/families"
    for path in family_root.glob("*.ts"):
        text = path.read_text(errors="ignore")
        for route_id, export_name, module in LOADER_RE.findall(text): loaders[route_id] = (export_name, module)
        for route_id, label, ko_path, en_path in ROUTE_RE.findall(text):
            export_name, module = loaders.get(route_id, ("", ""))
            routes.append({"assetId": "ROUTE-" + route_id.upper(), "routeId": route_id, "label": label, "koPath": ko_path,
                "enPath": en_path, "exportName": export_name, "modulePath": module, "sourcePath": str(path)})
    return routes

def scan_endpoints(root: Path) -> list[dict]:
    endpoints = []
    java_roots = [root / "apps", root / "modules"]
    for java_root in java_roots:
        for path in java_root.rglob("*.java"):
            if "/build/" in path.as_posix(): continue
            text = path.read_text(errors="ignore")
            class_position = text.find(" class ")
            class_prefix = text[:class_position] if class_position >= 0 else text
            class_matches = list(CLASS_MAPPING_RE.finditer(class_prefix))
            class_match = class_matches[-1] if class_matches else None
            base = class_match.group(1) if class_match else ""
            for method, body in METHOD_MAPPING_RE.findall(text):
                http_method = "ANY" if method == "Request" else method.upper()
                for child in PATH_RE.findall(body) or [""]:
                    full = normalized(base + "/" + child)
                    key = f"{http_method} {full}"
                    endpoints.append({"assetId": "API-" + hashlib.sha256(key.encode()).hexdigest()[:16].upper(),
                        "method": http_method, "path": full, "contract": key, "sourcePath": str(path.relative_to(root))})
    unique = {item["contract"]: item for item in endpoints}
    return [unique[key] for key in sorted(unique)]

def scan_tables(root: Path) -> list[dict]:
    tables = {}
    for path in list((root / "apps").rglob("*.sql")) + list((root / "ops").rglob("*.sql")):
        if not path.is_file() or "/build/" in path.as_posix(): continue
        text = path.read_text(errors="ignore")
        for name in TABLE_RE.findall(text):
            clean = name.replace('"', '').lower(); tables.setdefault(clean, []).append(str(path.relative_to(root)))
    return [{"assetId": "DB-TABLE-" + name.upper().replace(".", "-"), "tableName": name, "sourcePaths": paths} for name, paths in sorted(tables.items())]

def scan_menu(root: Path) -> list[dict]:
    path = root / "apps/carbonet-api/src/main/resources/db/baseline/admin-menu-169.tsv"; rows = []
    if not path.exists(): return rows
    for line in path.read_text(errors="ignore").splitlines():
        values = line.split("\t")
        if len(values) >= 4: rows.append({"assetId": "MENU-" + values[0], "menuCode": values[0], "menuName": values[1], "menuUrl": values[3]})
    return rows

def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument("--root", default=".")
    parser.add_argument("--output", default="projects/carbonet-backend-metadata/customer-trace/resonance-source-registry.json")
    args = parser.parse_args(); root = Path(args.root).resolve()
    store = json.loads((root / "projects/carbonet-backend-metadata/builder/platform-builder-store.json").read_text())
    assets = {"routes": scan_routes(root), "apis": scan_endpoints(root), "tables": scan_tables(root), "menus": scan_menu(root),
        "sduiScreens": [{k: item.get(k) for k in ("screenId", "pageId", "menuCode", "menuUrl", "menuNm", "status", "version")} for item in store.get("screens", [])],
        "sduiComponents": [{k: item.get(k) for k in ("componentId", "componentNm", "componentType", "categoryCd", "useAt")} for item in store.get("components", [])],
        "sduiThemes": [{k: item.get(k) for k in ("themeId", "themeName", "themeType", "isDefault")} for item in store.get("themes", [])]}
    summary = {name: len(items) for name, items in assets.items()}
    payload = {"schemaVersion": 1, "generatedAt": datetime.now(timezone.utc).isoformat(), "summary": summary, **assets}
    output = Path(args.output); output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2)); return 0

if __name__ == "__main__": raise SystemExit(main())
