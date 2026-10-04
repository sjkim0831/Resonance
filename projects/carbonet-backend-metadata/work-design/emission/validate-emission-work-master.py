#!/usr/bin/env python3
import json, pathlib, sys

path = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "emission-work-master-ledger.v1.json")
data = json.loads(path.read_text(encoding="utf-8"))
errors = []

def unique(items, key, label):
    values = [item[key] for item in items]
    duplicates = sorted({v for v in values if values.count(v) > 1})
    if duplicates: errors.append(f"{label} duplicate: {duplicates}")
    return set(values)

processes = unique(data["processes"], "code", "process")
actors = unique(data["actors"], "code", "actor")
steps = unique(data["steps"], "code", "step")
pages = unique(data["pages"], "code", "page")
tests = unique(data["testSuites"], "id", "test")

for p in data["processes"]:
    if p["parent"] and p["parent"] not in processes: errors.append(f"{p['code']} missing parent {p['parent']}")
    for step in p["steps"]:
        if step not in steps: errors.append(f"{p['code']} missing step {step}")
for s in data["steps"]:
    for field in ("process","actor","page"):
        target = {"process":processes,"actor":actors,"page":pages}[field]
        if s[field] not in target: errors.append(f"{s['code']} missing {field} {s[field]}")
    if not s["inputs"] or not s["outputs"] or not s["permissions"] or not s["completion"]:
        errors.append(f"{s['code']} incomplete contract")
    nxt = s["next"]
    for value in (nxt.values() if isinstance(nxt, dict) else [nxt]):
        if value and value not in steps: errors.append(f"{s['code']} missing next step {value}")
for p in data["pages"]:
    if not p["functions"] or not p["actors"] or not p["route"]:
        errors.append(f"{p['code']} incomplete page")
    for actor in p["actors"]:
        if actor not in actors: errors.append(f"{p['code']} missing actor {actor}")

top = [p for p in data["processes"] if p["parent"] is None]
sub = [p for p in data["processes"] if p["parent"]]
permissions = sorted({v for s in data["steps"] for v in s["permissions"]})
functions = sorted({v for p in data["pages"] for v in p["functions"]})
summary = {
    "status": "PASS" if not errors else "FAIL",
    "topLevelProcesses": len(top), "subprocesses": len(sub), "steps": len(steps),
    "actors": len(actors), "pages": len(pages), "functions": len(functions),
    "permissions": len(permissions), "tests": len(tests), "errors": errors
}

trace_path = path.with_name("emission-function-traceability.v1.json")
if trace_path.exists():
    trace = json.loads(trace_path.read_text(encoding="utf-8"))
    expected = {(p["code"], f) for p in data["pages"] for f in p["functions"]}
    actual = {(e["page"], e["function"]) for e in trace["entries"]}
    missing = sorted(expected - actual)
    extra = sorted(actual - expected)
    duplicate_ids = len({e["traceId"] for e in trace["entries"]}) != len(trace["entries"])
    incomplete = [e["traceId"] for e in trace["entries"] if not all(e.get(k) for k in ("method","endpoint","permission","testId","implementationStatus"))]
    if missing: errors.append(f"trace missing: {missing}")
    if extra: errors.append(f"trace extra: {extra}")
    if duplicate_ids: errors.append("trace duplicate ids")
    if incomplete: errors.append(f"trace incomplete: {incomplete}")
    summary["traceability"]={"expected":len(expected),"actual":len(actual),"missing":len(missing),"extra":len(extra),"incomplete":len(incomplete),"statusSummary":trace.get("statusSummary",{})}
    summary["status"] = "PASS" if not errors else "FAIL"
print(json.dumps(summary, ensure_ascii=False, indent=2))
sys.exit(1 if errors else 0)
