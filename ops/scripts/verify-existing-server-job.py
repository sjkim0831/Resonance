#!/usr/bin/env python3
"""Deterministically decide whether a server-side development job already exists.

This verifier is intentionally conservative. It never changes source or database state;
it emits an evidence document that a separate adopter may consume.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

SUPPORTED = {"BACKEND", "API", "API_QUALITY", "DATABASE", "DATABASE_QUALITY", "TEST", "ACTOR_TEST"}
SOURCE_SUFFIXES = {".java", ".kt", ".xml", ".sql"}
TEST_MARKERS = ("@Test", "describe(", "test(", "it(", "assert", "expect(")
ROUTE_RE = re.compile(r"/[A-Za-z0-9_{}?&=./:-]+")
ENTITY_RE = re.compile(r"\b[a-z][a-z0-9_]{4,}\b")


def read(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""


def rel(root: Path, path: Path) -> str:
    return path.relative_to(root).as_posix()


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inventory(root: Path) -> list[tuple[Path, str]]:
    bases = [root / "modules", root / "projects", root / "ops"]
    rows: list[tuple[Path, str]] = []
    ignored = {"node_modules", "build", "dist", "target", ".git", "var"}
    for base in bases:
        if not base.exists():
            continue
        for path in base.rglob("*"):
            if not path.is_file() or path.suffix.lower() not in SOURCE_SUFFIXES:
                continue
            if any(part in ignored for part in path.parts):
                continue
            rows.append((path, read(path)))
    return rows


def is_test(path: Path, body: str) -> bool:
    name = path.as_posix().lower()
    return ("/test/" in name or "/tests/" in name or path.stem.lower().endswith("test")) and any(x in body for x in TEST_MARKERS)


def specification(job: dict) -> str:
    raw = job.get("specification_json") or job.get("specification") or {}
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            return raw
    return json.dumps(raw, ensure_ascii=False, sort_keys=True)


def contract_values(job: dict) -> list[str]:
    raw = job.get("specification_json") or job.get("specification") or {}
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            return [raw]
    values: list[str] = []
    def walk(value: object) -> None:
        if isinstance(value, str): values.append(value)
        elif isinstance(value, dict):
            for child in value.values(): walk(child)
        elif isinstance(value, list):
            for child in value: walk(child)
    walk(raw)
    return values


def significant_tokens(values: list[str]) -> set[str]:
    stop = {"string", "true", "false", "null", "process", "screen", "actor", "status", "required", "verified"}
    return {
        x.lower() for value in values if not value.startswith("/")
        for x in re.findall(r"[A-Za-z][A-Za-z0-9_]{4,}", value)
        if x.lower() not in stop and ("_" in x or any(ch.isupper() for ch in x[1:]))
    }


def evidence(root: Path, job: dict) -> dict:
    kind = str(job.get("job_type", "")).upper()
    target = str(job.get("target_path", "")).strip()
    spec = specification(job)
    values = contract_values(job) + [
        str(job.get(key) or "") for key in (
            "target_path", "user_path", "admin_path", "api_contract",
            "requirement_text", "input_contract", "output_contract",
            "command_code", "from_state", "to_state",
        )
    ]
    routes = sorted({route for value in values for route in ROUTE_RE.findall(value)})
    tokens = significant_tokens(values)
    rows = inventory(root)

    direct: list[tuple[Path, str]] = []
    if target:
        candidate = root / target.lstrip("/")
        if candidate.is_file():
            direct = [(candidate, read(candidate))]

    route_hits = [(p, b) for p, b in rows if routes and any(route.split("?", 1)[0] in b for route in routes)]
    token_hits = []
    for path, body in rows:
        haystack = (path.as_posix() + " " + body[:200000]).lower()
        score = sum(re.search(rf"\b{re.escape(token)}\b", haystack, re.I) is not None for token in tokens)
        if score >= 1:
            token_hits.append((path, body))
    candidates = {p: b for p, b in direct + route_hits + token_hits}

    controllers = [(p, b) for p, b in candidates.items() if "controller" in p.name.lower() or "@RequestMapping" in b or "@GetMapping" in b or "@PostMapping" in b]
    services = [(p, b) for p, b in candidates.items() if "service" in p.name.lower() and ("class " in b or "interface " in b)]
    schemas = [(p, b) for p, b in candidates.items() if p.suffix.lower() in {".sql", ".xml"} and any(x in b.lower() for x in ("create table", "alter table", "insert into", "<select", "<insert", "<update"))]
    tests = [(p, b) for p, b in rows if is_test(p, b) and (any(r in b for r in routes) or any(t in (p.as_posix() + b).lower() for t in tokens))]

    checks: dict[str, bool]
    if kind == "BACKEND":
        checks = {"implementation": bool(controllers), "service": bool(services), "test": bool(tests)}
    elif kind in {"API", "API_QUALITY"}:
        checks = {"declaredRoute": bool(routes), "controller": bool(controllers), "test": bool(tests)}
    elif kind in {"DATABASE", "DATABASE_QUALITY"}:
        checks = {"schemaOrMapper": bool(schemas), "consumer": bool(controllers or services), "test": bool(tests)}
    else:
        checks = {"executableTest": bool(tests), "targetBinding": bool(routes or tokens)}

    files = sorted({p for group in (controllers, services, schemas, tests, direct) for p, _ in group})
    return {
        "schemaVersion": 1,
        "strategy": "ADOPT_EXISTING_SERVER_IMPLEMENTATION",
        "job": {k: job.get(k) for k in ("job_id", "process_code", "step_code", "job_type", "target_path")},
        "decision": "ADOPTABLE" if kind in SUPPORTED and all(checks.values()) else "NOT_ADOPTABLE",
        "checks": checks,
        "routes": routes,
        "evidence": [{"path": rel(root, p), "sha256": digest(p)} for p in files],
        "guardrails": ["NO_SOURCE_MUTATION", "NO_DATABASE_MUTATION", "ALL_TYPE_GATES_REQUIRED", "HASHED_EVIDENCE"],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--job-json", required=True, help="JSON string or path")
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    raw = Path(args.job_json)
    job = json.loads(read(raw) if raw.is_file() else args.job_json)
    result = evidence(args.root.resolve(), job)
    payload = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(payload, encoding="utf-8")
    sys.stdout.write(payload)
    return 0 if result["decision"] == "ADOPTABLE" else 3


if __name__ == "__main__":
    raise SystemExit(main())
