#!/usr/bin/env python3
import json, re, sys
from pathlib import Path

root, process, step, job_id, target = sys.argv[1:]
root = Path(root)
route = target.split("?", 1)[0] if target.startswith("/") else ""
target_source = target.removeprefix("projects/carbonet-frontend/source/src/") if not route else ""
inventory = root / "projects/carbonet-frontend/source/src/features/builder-studio/routeSourceInventory.ts"
manifest = root / "projects/carbonet-frontend/source/src/platform/screen-registry/pageManifests.ts"
text = inventory.read_text(encoding="utf-8")
blocks = re.findall(r"\{\s*\"routeId\".*?\n\s*\},", text, re.S)
if route:
    match = next((b for b in blocks if f'\"koPath\": \"{route}\"' in b or f'\"enPath\": \"{route}\"' in b), None)
else:
    match = next((b for b in blocks if f'\"sourcePath\": \"{target_source}\"' in b or f'\"effectiveSourcePath\": \"{target_source}\"' in b), None)
if not match:
    raise SystemExit(f"route inventory has no exact route or source: {target}")
def field(name):
    found = re.search(rf'\"{name}\": \"([^\"]+)\"', match)
    return found.group(1) if found else ""
source = field("effectiveSourcePath") or field("sourcePath")
route_id = field("routeId")
route = route or field("koPath")
source_file = root / "projects/carbonet-frontend/source/src" / source
if not source or not source_file.is_file():
    raise SystemExit(f"registered source is missing: {source}")
manifest_text = manifest.read_text(encoding="utf-8")
manifest_bound = f'\"{route_id}\"' in manifest_text and f'routePath: \"{route}\"' in manifest_text
family_rel = field("routeFamilyFile")
family_file = root / "projects/carbonet-frontend/source/src" / family_rel
family_text = family_file.read_text(encoding="utf-8") if family_file.is_file() else ""
family_bound = f'id: \"{route_id}\"' in family_text and f'koPath: \"{route}\"' in family_text
if not manifest_bound and not family_bound:
    raise SystemExit(f"neither page manifest nor route family binds {route_id} to {route}")
artifact = root / "docs/ai/80-adopted-existing" / process.lower() / f"job-{job_id}.md"
artifact.parent.mkdir(parents=True, exist_ok=True)
artifact.write_text(f"""# Existing frontend adoption: job {job_id}

- Process: `{process}`
- Step: `{step}`
- Route: `{target}`
- Route ID: `{route_id}`
- Implemented source: `projects/carbonet-frontend/source/src/{source}`
- Route inventory: `projects/carbonet-frontend/source/src/features/builder-studio/routeSourceInventory.ts`
- Binding registry: `{'projects/carbonet-frontend/source/src/platform/screen-registry/pageManifests.ts' if manifest_bound else 'projects/carbonet-frontend/source/src/' + family_rel}`

The approved job resolved to an existing registered implementation. The worker preserved that implementation, verified the exact route-to-source and page-manifest bindings, and requires the shared TypeScript gate before adoption. This artifact records traceability; it does not replace runtime or actor-process tests.
""", encoding="utf-8")
print(json.dumps({"route": route, "routeId": route_id, "source": str(source_file.relative_to(root)), "artifact": str(artifact.relative_to(root))}))
