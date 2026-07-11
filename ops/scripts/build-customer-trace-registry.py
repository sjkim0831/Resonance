#!/usr/bin/env python3
"""Create a reproducible, read-only registry of customer reference evidence."""
from __future__ import annotations

import argparse, hashlib, json, re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

UC_RE = re.compile(r"\bUC-[A-Z0-9][A-Z0-9_-]*\b", re.I)
REQ_RE = re.compile(r"\b(?:FR|NR|IR|DR|SR)-\d{2}(?:-\d{1,3})?\b", re.I)
TEXT_EXT = {".txt", ".csv", ".md", ".json", ".xml", ".html", ".sql", ".yml", ".yaml"}
DOMAINS = (
    ("MEMBER_AUTH", ("회원", "인증", "auth", "member", "login")),
    ("EMISSION", ("탄소배출", "배출", "emission", "lca", "lci", "gwp", "수식")),
    ("REPORT_CERTIFICATE", ("보고서", "인증서", "certificate", "report")),
    ("CARBON_INFORMATION", ("탄소정보", "co2", "ccu", "mrv", "rec")),
    ("MONITORING", ("모니터링", "monitoring", "sensor")),
    ("TRADE", ("거래", "trade")), ("PAYMENT", ("결제", "payment", "refund", "정산")),
    ("EXTERNAL", ("외부연계", "external", "webhook")),
    ("CONTENT", ("콘텐츠", "고객지원", "content", "support", "faq", "notice")),
    ("SYSTEM", ("시스템", "system", "infra", "backup")),
    ("EDUCATION", ("교육", "edu", "course")), ("MOBILE", ("모바일", "mobile")),
    ("MAINTENANCE", ("유지보수", "maintenance", "mtn", "patch")),
    ("COMMON", ("공통", "common", "krds", "표준용어")),
)

def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(block)
    return value.hexdigest()

def authority(path: str) -> tuple[str, str]:
    value = path.lower()
    if "제안요청서" in value or "요구사항추적성" in value or "master_ucs" in value:
        return "A", "CONTRACT_REQUIREMENT"
    if any(x in value for x in ("요구사항정의서", "비즈니스규칙", "데이터모델", "테이블정의서", "수식 설계")):
        return "B", "DOMAIN_RULE"
    if any(x in value for x in ("화면정의서", "api설계서", "테스트", "설계html_완성본", "krds-uiux")):
        return "C", "DESIGN_EVIDENCE"
    if any(x in value for x in ("all-in-one", "modules/certlogin", "modules/gnrlogin")):
        return "D", "LEGACY_REFERENCE"
    if any(x in value for x in ("로그", "무한반복", "zone.identifier")):
        return "X", "EXCLUDED_GENERATED"
    return "C", "SUPPORTING_REFERENCE"

def domain(path: str) -> str:
    value = path.lower()
    score, name = max((sum(value.count(x) for x in keys), name) for name, keys in DOMAINS)
    return name if score else "UNCLASSIFIED"

def text_of(path: Path) -> str:
    if path.suffix.lower() not in TEXT_EXT or path.stat().st_size > 5 * 1024 * 1024:
        return ""
    raw = path.read_bytes()
    for encoding in ("utf-8-sig", "utf-8", "cp949"):
        try: return raw.decode(encoding)
        except UnicodeDecodeError: pass
    return ""

def canonical_use_cases(root: Path) -> list[dict]:
    master = root / "화면설계" / "설계" / "00_Master_UCS.csv"
    if not master.exists(): return []
    rows = []
    for line in master.read_text(encoding="utf-8-sig", errors="replace").splitlines():
        columns = [value.strip() for value in line.split(",")]
        if columns and re.fullmatch(r"UC-[A-Z0-9_-]+", columns[0], re.I):
            rows.append({"useCaseId": columns[0].upper(), "domain": columns[1] if len(columns) > 1 else "",
                "title": columns[2] if len(columns) > 2 else "", "endpoint": columns[3] if len(columns) > 3 else "",
                "userScreenId": columns[4] if len(columns) > 4 else "", "adminScreenId": columns[5] if len(columns) > 5 else ""})
    return rows

def build(root: Path) -> dict:
    documents, hashes = [], defaultdict(list)
    requirements, use_cases = set(), set()
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.name.endswith(":Zone.Identifier"): continue
        relative, checksum = path.relative_to(root).as_posix(), digest(path)
        hashes[checksum].append(relative)
        tier, evidence_type = authority(relative)
        text = text_of(path)
        reqs = sorted({x.upper() for x in REQ_RE.findall(text)})
        ucs = sorted({x.upper() for x in UC_RE.findall(text)})
        requirements.update(reqs); use_cases.update(ucs)
        documents.append({"evidenceId": "REF-" + checksum[:16].upper(), "sourcePath": str(path),
            "relativePath": relative, "fileName": path.name, "extension": path.suffix.lower() or "[none]",
            "sizeBytes": path.stat().st_size, "sha256": checksum, "authorityTier": tier,
            "evidenceType": evidence_type, "domain": domain(relative),
            "indexPolicy": "EXCLUDE" if tier == "X" else ("METADATA_ONLY" if tier == "D" else "INDEX"), "requirementIds": reqs, "useCaseIds": ucs})
    duplicates = {key: paths for key, paths in hashes.items() if len(paths) > 1}
    canonical = canonical_use_cases(root)
    summary = {"documentCount": len(documents), "indexedDocumentCount": sum(x["indexPolicy"] == "INDEX" for x in documents),
        "metadataOnlyDocumentCount": sum(x["indexPolicy"] == "METADATA_ONLY" for x in documents),
        "excludedDocumentCount": sum(x["indexPolicy"] == "EXCLUDE" for x in documents),
        "duplicateGroupCount": len(duplicates), "duplicateDocumentCount": sum(map(len, duplicates.values())),
        "requirementIdCount": len(requirements), "extractedUseCaseIdCount": len(use_cases), "canonicalUseCaseCount": len(canonical),
        "byAuthorityTier": dict(sorted(Counter(x["authorityTier"] for x in documents).items())),
        "byDomain": dict(sorted(Counter(x["domain"] for x in documents).items())),
        "byExtension": dict(Counter(x["extension"] for x in documents).most_common())}
    return {"schemaVersion": 1, "generatedAt": datetime.now(timezone.utc).isoformat(), "sourceRoot": str(root),
        "summary": summary, "requirementIds": sorted(requirements), "useCaseIds": sorted(use_cases), "canonicalUseCases": canonical,
        "duplicateGroups": [{"sha256": key, "paths": paths} for key, paths in sorted(duplicates.items())], "documents": documents}

def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument("--reference-root", default="/opt/reference")
    parser.add_argument("--output", default="var/customer-trace/reference-registry.json")
    parser.add_argument("--summary-output", default="projects/carbonet-backend-metadata/customer-trace/reference-registry-summary.json")
    args = parser.parse_args(); registry = build(Path(args.reference_root).resolve())
    for name, payload in ((args.output, registry), (args.summary_output, {k: registry[k] for k in ("schemaVersion", "generatedAt", "sourceRoot", "summary", "requirementIds", "useCaseIds", "canonicalUseCases")})):
        output = Path(name); output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(registry["summary"], ensure_ascii=False, indent=2)); return 0

if __name__ == "__main__": raise SystemExit(main())
