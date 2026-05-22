#!/usr/bin/env python3
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys


PROJECT_ID = "carbonet"
INTERESTING_SUFFIXES = {
    ".java", ".kt", ".xml", ".sql", ".ts", ".tsx", ".js", ".jsx", ".json",
    ".yml", ".yaml", ".md", ".html", ".css", ".scss", ".txt", ".csv",
}
EXCLUDED_DIRS = {
    ".git", "node_modules", "target", "build", "dist", ".gradle", ".idea",
    ".vscode", "__pycache__", ".cache", "coverage",
}
EXCLUDED_PARTS = {
    "src/main/resources/static/react-app/assets",
    "apps/carbonet-app/src/main/resources/static/react-app/assets",
    "apps/operations-console/src/main/resources/static/react-app/assets",
}


def now_batch_id():
    return "asset-scan-" + dt.datetime.now().strftime("%Y%m%d-%H%M%S")


def sha(text):
    return hashlib.sha256(text.encode("utf-8", errors="ignore")).hexdigest()


def file_hash(path):
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def rel(path, root):
    try:
        return path.resolve().relative_to(root.resolve()).as_posix()
    except Exception:
        return path.resolve().as_posix()


def sql_lit(value, limit=3900):
    text = "" if value is None else str(value)
    text = text.replace("\r", " ").replace("\x00", "")
    if len(text) > limit:
        text = text[:limit]
    return "'" + text.replace("'", "''") + "'"


def id_for(prefix, *parts, limit=120):
    digest = sha("|".join(str(part) for part in parts))[:24]
    base = prefix + "-" + re.sub(r"[^0-9A-Za-z_-]+", "-", str(parts[-1]))[: max(8, limit - len(prefix) - 28)]
    return (base.rstrip("-") + "-" + digest)[:limit]


def should_skip(path):
    parts = set(path.parts)
    if parts & EXCLUDED_DIRS:
        return True
    normalized = path.as_posix()
    return any(part in normalized for part in EXCLUDED_PARTS)


def owner_domain(path_text):
    if "/admin/" in path_text or "admin" in path_text.lower():
        return "admin"
    if "/home/" in path_text or "home" in path_text.lower():
        return "home"
    if "/platform" in path_text or "platform-" in path_text:
        return "platform"
    if "/screenbuilder" in path_text or "screen-builder" in path_text:
        return "builder"
    if "/ops/" in path_text or path_text.startswith("ops/"):
        return "ops"
    if "/docs/" in path_text or path_text.startswith("docs/"):
        return "docs"
    if "/modules/" in path_text or path_text.startswith("modules/"):
        return "shared"
    return "carbonet"


def asset_type_for(path):
    name = path.name
    suffix = path.suffix.lower()
    text = path.as_posix()
    if path.is_dir():
        return "DIRECTORY"
    if suffix in {".tsx", ".jsx"} and ("Page" in name or "MigrationPage" in name):
        return "PAGE"
    if suffix in {".tsx", ".jsx", ".ts", ".js"}:
        return "COMPONENT" if re.search(r"[A-Z][A-Za-z0-9]+", name) else "SCRIPT"
    if suffix == ".java":
        if name.endswith("Controller.java"):
            return "CONTROLLER"
        if name.endswith("Service.java") or name.endswith("ServiceImpl.java"):
            return "SERVICE"
        if name.endswith("Mapper.java"):
            return "MAPPER"
        return "JAVA"
    if suffix == ".xml" and ("mapper" in text.lower() or "Mapper" in name):
        return "MAPPER_XML"
    if suffix == ".sql":
        return "SQL"
    if suffix in {".md", ".txt"}:
        return "DOC"
    if suffix == ".html":
        return "DESIGN_SCREEN" if "/reference/" in text or "화면설계" in text else "HTML"
    if name in {"pom.xml", "package.json", "vite.config.ts", "tsconfig.json"}:
        return "FRAMEWORK_CONFIG"
    return "FILE"


def language_for(path):
    suffix = path.suffix.lower()
    return {
        ".java": "JAVA",
        ".xml": "XML",
        ".sql": "SQL",
        ".ts": "TS",
        ".tsx": "TSX",
        ".js": "JS",
        ".jsx": "JSX",
        ".json": "JSON",
        ".html": "HTML",
        ".md": "MARKDOWN",
        ".css": "CSS",
        ".scss": "SCSS",
    }.get(suffix, "")


def read_text(path):
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return ""


def extract_symbols(path, relative_path, asset_id, scan_batch_id):
    text = read_text(path)
    if not text:
        return []
    language = language_for(path)
    rows = []
    patterns = []
    if language == "JAVA":
        patterns = [
            ("CLASS", re.compile(r"\b(class|interface|enum)\s+([A-Za-z_][A-Za-z0-9_]*)")),
            ("METHOD", re.compile(r"\b(public|protected|private)\s+(?:static\s+)?[A-Za-z0-9_<>, ?\[\].]+\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(")),
            ("MAPPING", re.compile(r"@(GetMapping|PostMapping|PutMapping|DeleteMapping|RequestMapping)\s*(?:\(([^)]*)\))?")),
        ]
    elif language in {"TS", "TSX", "JS", "JSX"}:
        patterns = [
            ("FUNCTION", re.compile(r"\b(?:export\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(")),
            ("COMPONENT", re.compile(r"\b(?:const|let)\s+([A-Z][A-Za-z0-9_]*)\s*=\s*(?:\([^)]*\)|[A-Za-z0-9_]+)\s*=>")),
            ("HOOK", re.compile(r"\b(use[A-Z][A-Za-z0-9_]*)\s*\(")),
            ("ROUTE_LITERAL", re.compile(r"['\"](/(?:admin|home|api|en|react)[^'\"]*)['\"]")),
        ]
    elif language == "XML":
        patterns = [
            ("XML_ID", re.compile(r"\b(id)\s*=\s*['\"]([^'\"]+)['\"]")),
            ("NAMESPACE", re.compile(r"\bnamespace\s*=\s*['\"]([^'\"]+)['\"]")),
        ]
    elif language == "SQL":
        patterns = [
            ("TABLE", re.compile(r"\bCREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([A-Za-z0-9_]+)", re.I)),
            ("ALTER_TABLE", re.compile(r"\bALTER\s+TABLE\s+([A-Za-z0-9_]+)", re.I)),
            ("INSERT_TABLE", re.compile(r"\bINSERT\s+INTO\s+([A-Za-z0-9_]+)", re.I)),
        ]
    elif language == "HTML":
        patterns = [
            ("TITLE", re.compile(r"<title[^>]*>(.*?)</title>", re.I | re.S)),
            ("H1", re.compile(r"<h1[^>]*>(.*?)</h1>", re.I | re.S)),
        ]

    lines = text.splitlines()
    for symbol_type, regex in patterns:
        for match in regex.finditer(text):
            symbol = next((group for group in match.groups()[::-1] if group), match.group(0))
            symbol = re.sub(r"<[^>]+>", "", symbol).strip()[:240]
            if not symbol:
                continue
            line_no = text[: match.start()].count("\n") + 1
            line = lines[line_no - 1].strip() if line_no <= len(lines) else symbol
            pattern_code = infer_pattern(relative_path, symbol_type, symbol)
            rows.append({
                "code_structure_id": id_for("code", scan_batch_id, relative_path, symbol_type, symbol, line_no, limit=180),
                "asset_id": asset_id,
                "source_path": relative_path,
                "language_code": language,
                "symbol_type": symbol_type,
                "symbol_name": symbol,
                "parent_symbol": "",
                "line_no": line_no,
                "signature_hash": sha(line)[:64],
                "pattern_code": pattern_code,
                "summary": line[:1000],
            })
            if len(rows) >= 120:
                return rows
    return rows


def infer_pattern(path_text, symbol_type="", symbol=""):
    low = path_text.lower()
    if "screen-builder" in low or "screenbuilder" in low:
        return "BUILDER_SCREEN_RUNTIME"
    if "environment-management" in low:
        return "BUILDER_INSTALL_BIND_CONSOLE"
    if "menu-management" in low or "fullstack" in low:
        return "REGISTRY_DETAIL_CONSOLE"
    if "controller" in low or symbol_type == "MAPPING":
        return "BACKEND_CONTROLLER_API"
    if "mapper" in low or symbol_type in {"XML_ID", "TABLE", "ALTER_TABLE", "INSERT_TABLE"}:
        return "DB_MAPPER_SCHEMA"
    if "migrationpage" in low or symbol_type in {"COMPONENT", "ROUTE_LITERAL"}:
        return "REACT_PAGE_COMPONENT"
    if "/docs/" in low or low.startswith("docs/"):
        return "DOC_GOVERNANCE_PATTERN"
    if "/ops/" in low or low.startswith("ops/"):
        return "OPS_SCRIPT_PATTERN"
    return "GENERAL_CODE_PATTERN"


def framework_nodes(root, scan_batch_id):
    rows = []
    for path in root.rglob("*"):
        if should_skip(path) or not path.is_file():
            continue
        name = path.name
        if name not in {"pom.xml", "package.json", "vite.config.ts", "tsconfig.json", "tsconfig.app.json"}:
            continue
        relative = rel(path, root)
        metadata = {}
        text = read_text(path)
        build_tool = "maven" if name == "pom.xml" else "node"
        package_name = ""
        if name == "package.json":
            try:
                metadata = json.loads(text)
                package_name = metadata.get("name") or ""
            except Exception:
                metadata = {}
        elif name == "pom.xml":
            artifact = re.search(r"<artifactId>([^<]+)</artifactId>", text)
            package_name = artifact.group(1) if artifact else path.parent.name
        rows.append({
            "framework_node_id": id_for("fw", scan_batch_id, relative, limit=160),
            "structure_type": "MAVEN_MODULE" if name == "pom.xml" else "FRONTEND_CONFIG",
            "node_name": package_name or path.parent.name,
            "node_path": relative,
            "parent_path": rel(path.parent, root),
            "framework_role": infer_pattern(relative),
            "build_tool": build_tool,
            "package_name": package_name,
            "metadata_json": json.dumps(metadata, ensure_ascii=False)[:3000] if metadata else "",
            "content_hash": file_hash(path),
        })
    return rows


def tree_nodes(root, scan_batch_id, max_depth):
    rows = []
    for path in root.rglob("*"):
        if should_skip(path):
            continue
        relative = rel(path, root)
        depth = 0 if relative == "." else len(Path(relative).parts)
        if path.is_dir() and depth > max_depth:
            continue
        if path.is_file() and path.suffix.lower() not in INTERESTING_SUFFIXES and path.name not in {"pom.xml", "package.json"}:
            continue
        if path.is_file() and path.stat().st_size > 2_000_000:
            continue
        rows.append({
            "tree_node_id": id_for("tree", scan_batch_id, root.as_posix(), relative, limit=160),
            "root_path": root.as_posix(),
            "node_path": relative,
            "parent_path": rel(path.parent, root) if path.parent != root else "",
            "node_type": "DIRECTORY" if path.is_dir() else "FILE",
            "node_depth": depth,
            "file_count": sum(1 for item in path.iterdir() if item.is_file()) if path.is_dir() else 0,
            "directory_count": sum(1 for item in path.iterdir() if item.is_dir()) if path.is_dir() else 0,
            "owner_domain": owner_domain(relative),
            "language_hint": language_for(path) if path.is_file() else "",
            "content_hash": file_hash(path) if path.is_file() else sha(relative)[:64],
        })
    return rows


def inventory_and_code(root, scan_batch_id, max_files):
    assets = []
    code_rows = []
    count = 0
    for path in root.rglob("*"):
        if should_skip(path) or not path.is_file():
            continue
        if path.suffix.lower() not in INTERESTING_SUFFIXES and path.name not in {"pom.xml", "package.json"}:
            continue
        if path.stat().st_size > 2_000_000:
            continue
        relative = rel(path, root)
        asset_type = asset_type_for(path)
        asset_id = id_for("asset", root.as_posix(), relative)
        content_hash = file_hash(path)
        pattern = infer_pattern(relative)
        assets.append({
            "asset_id": asset_id,
            "asset_type": asset_type,
            "asset_name": path.stem[:200],
            "source_path": relative,
            "source_symbol": "",
            "content_hash": content_hash,
            "owner_domain": owner_domain(relative),
            "criticality": "HIGH" if asset_type in {"CONTROLLER", "SERVICE", "MAPPER", "SQL"} else "MEDIUM",
            "asset_family": "SERVICE" if asset_type in {"PAGE", "COMPONENT", "CONTROLLER", "SERVICE", "MAPPER"} else "GOVERNANCE",
            "owner_scope": pattern,
            "operator_owner": "Hermes",
            "service_owner": "hermes-sync-system-assets",
        })
        if asset_type in {"PAGE", "COMPONENT", "CONTROLLER", "SERVICE", "MAPPER", "MAPPER_XML", "SQL", "JAVA", "SCRIPT", "DESIGN_SCREEN"}:
            code_rows.extend(extract_symbols(path, relative, asset_id, scan_batch_id))
        count += 1
        if count >= max_files:
            break
    return assets, code_rows


def builder_gaps(root, reference_roots, scan_batch_id):
    gaps = []
    frontend = root / "frontend/src/features"
    if frontend.exists():
        for path in sorted(frontend.rglob("*.tsx")):
            if should_skip(path):
                continue
            if not is_react_page_file(path):
                continue
            relative = rel(path, root)
            text = read_text(path)
            page_name = path.stem
            low = text.lower()
            if re.search(r"todo|placeholder|준비|coming soon|임시|샘플", low):
                gap_type = "PARTIAL_IMPLEMENTATION"
                priority = 80
            elif not has_data_or_action_contract(text):
                gap_type = "PUBLISHED_ONLY_NO_DATA_CONTRACT"
                priority = 70
            else:
                gap_type = "BUILDER_SYSTEMIZATION_CHECK"
                priority = 45
            gaps.append({
                "gap_id": id_for("gap", scan_batch_id, relative, gap_type, limit=180),
                "source_kind": "REPO_REACT_PAGE",
                "source_path": relative,
                "page_name": page_name,
                "target_route": guess_route_from_name(page_name),
                "target_component_path": relative,
                "gap_type": gap_type,
                "priority_score": priority,
                "builder_role": infer_builder_role(relative),
                "recommendation": recommendation_for_gap(gap_type),
                "evidence_json": json.dumps({"size": len(text), "ownerDomain": owner_domain(relative)}, ensure_ascii=False),
            })

    repo_page_names = {gap["page_name"].lower().replace("migrationpage", "") for gap in gaps}
    for ref_root in reference_roots:
        if not ref_root.exists():
            continue
        for path in ref_root.rglob("*.html"):
            if should_skip(path):
                continue
            relative = path.resolve().as_posix()
            page_name = title_from_html(path) or path.stem
            norm = normalize_name(page_name)
            if any(norm and norm in existing for existing in repo_page_names):
                gap_type = "REFERENCE_LINK_NEEDS_TRACE"
                priority = 55
            else:
                gap_type = "REFERENCE_DESIGN_BACKLOG"
                priority = 25
            gaps.append({
                "gap_id": id_for("gap", scan_batch_id, relative, gap_type, limit=180),
                "source_kind": "REFERENCE_DESIGN",
                "source_path": relative,
                "page_name": page_name[:240],
                "target_route": "",
                "target_component_path": "",
                "gap_type": gap_type,
                "priority_score": priority,
                "builder_role": "design-source",
                "recommendation": recommendation_for_gap(gap_type),
                "evidence_json": json.dumps({"referenceRoot": ref_root.as_posix()}, ensure_ascii=False),
            })
    return gaps[:5000]


def empty_pages(root, scan_batch_id):
    rows = []
    frontend = root / "frontend/src/features"
    if not frontend.exists():
        return rows
    for path in sorted(frontend.rglob("*.tsx")):
        if should_skip(path) or not is_react_page_file(path):
            continue
        text = read_text(path)
        relative = rel(path, root)
        page_name = path.stem
        empty_type, severity, evidence = classify_empty_page(text, relative)
        if not empty_type:
            continue
        work_request_id = id_for("work", scan_batch_id, relative, empty_type, limit=180)
        rows.append({
            "empty_page_id": id_for("empty", scan_batch_id, relative, empty_type, limit=180),
            "page_name": page_name,
            "route_path": guess_route_from_name(page_name),
            "component_path": relative,
            "empty_type": empty_type,
            "severity_score": severity,
            "evidence_summary": evidence,
            "recommended_action": recommendation_for_empty_page(empty_type),
            "work_request_id": work_request_id,
        })
    return rows[:1000]


def classify_empty_page(text, path_text):
    low = text.lower()
    evidence = []
    placeholder_hits = re.findall(r"coming soon|구현 예정|개발 예정|상세 업무 화면은 아직|이관되지 않았|placeholder 연결|플레이스홀더|todo", low)
    sample_hits = re.findall(r"정적 샘플|샘플 행|sample rows|static sample", low)
    if placeholder_hits:
        evidence.append("placeholder_or_sample_terms=" + ",".join(sorted(set(placeholder_hits))[:8]))
    has_contract = has_data_or_action_contract(text)
    has_form = bool(re.search(r"<form|AdminInput|gov-input|onSubmit|onClick|button", text))
    has_table = bool(re.search(r"<table|data-table|GridToolbar|rows\\.", text)) or ".map(" in text
    has_placeholder_component = "placeholder" in path_text.lower() or "placeholderpage" in low
    static_rows = len(re.findall(r"const\s+[A-Z0-9_]+\s*[:=]", text))
    rendered_sections = len(re.findall(r"<section|<article|<table|<form|<button|<iframe|AdminPageShell|UserPortalHeader", text))
    rich_page = len(text) > 12000 and rendered_sections >= 8
    wrapper_page = (
        bool(re.search(r"return\s+<([A-Z][A-Za-z0-9_]+)", text))
        and len(text) < 2500
        and not re.search(r"<section|<main|<form|<table", text)
    )
    iframe_shell = "<iframe" in text
    handoff_page = "data-help-id=\"implementation-handoff\"" in text and has_contract
    if wrapper_page or iframe_shell or handoff_page:
        return "", 0, ""
    if has_placeholder_component:
        return "PLACEHOLDER_ROUTE", 100, "; ".join(evidence + ["placeholder component/page"])
    if rich_page and has_form and has_table:
        return "", 0, ""
    if (placeholder_hits or sample_hits) and not has_contract:
        return "EMPTY_OR_SAMPLE_ONLY", 90, "; ".join(evidence + ["no data/action contract"])
    if not has_contract and not has_form and not has_table:
        return "SHELL_ONLY_NO_CONTRACT", 82, "no data/action contract; no form/table interaction markers"
    if placeholder_hits or sample_hits:
        return "PARTIAL_WITH_PLACEHOLDER_COPY", 70, "; ".join(evidence + [f"has_contract={has_contract}"])
    if not has_contract and static_rows >= 3 and rendered_sections < 6:
        return "STATIC_SAMPLE_ONLY", 65, f"static constants={static_rows}; no data/action contract"
    return "", 0, ""


def recommendation_for_empty_page(empty_type):
    return {
        "PLACEHOLDER_ROUTE": "Replace placeholder page with routed React implementation, manifest, help binding, authority scope, and route verification.",
        "EMPTY_OR_SAMPLE_ONLY": "Connect design source, data/query/action contract, and builder-ready component structure.",
        "SHELL_ONLY_NO_CONTRACT": "Add page identity, bootstrap/query/mutation contract, and meaningful content sections.",
        "PARTIAL_WITH_PLACEHOLDER_COPY": "Remove placeholder copy and close missing backend/API/authority/runtime evidence.",
        "STATIC_SAMPLE_ONLY": "Replace static sample rows with registered bootstrap/query source or mark as governed static reference page.",
    }.get(empty_type, "Review empty page classification and prepare implementation request.")


def design_artifacts(reference_roots, scan_batch_id):
    rows = []
    suffixes = {".html", ".htm", ".txt", ".md", ".json"}
    for ref_root in reference_roots:
        if not ref_root.exists():
            continue
        for path in sorted(ref_root.rglob("*")):
            if should_skip(path) or not path.is_file() or path.suffix.lower() not in suffixes:
                continue
            if path.stat().st_size > 3_000_000:
                continue
            artifact_type = design_artifact_type(path)
            title = design_title(path)
            source_path = path.resolve().as_posix()
            target_page = infer_target_page_hint(path, title)
            rows.append({
                "design_artifact_id": id_for("design", scan_batch_id, source_path, limit=180),
                "source_root": ref_root.as_posix(),
                "source_path": source_path,
                "artifact_type": artifact_type,
                "title": title[:300],
                "canonical_priority": design_priority(path, artifact_type),
                "target_route_hint": guess_route_from_design(path, title),
                "target_page_hint": target_page[:240],
                "content_hash": file_hash(path),
                "evidence_summary": json.dumps({"size": path.stat().st_size, "suffix": path.suffix.lower()}, ensure_ascii=False),
            })
            if len(rows) >= 5000:
                return rows
    return rows


def design_reference_maps(gap_rows, design_rows, scan_batch_id):
    rows = []
    frontend_gaps = [gap for gap in gap_rows if gap.get("source_kind") == "REPO_REACT_PAGE"]
    if not frontend_gaps:
        return rows
    for design in design_rows:
        design_key = normalize_name(design.get("target_page_hint") or design.get("title") or design.get("source_path"))
        if not design_key:
            continue
        best_gap = None
        best_score = 0.0
        for gap in frontend_gaps:
            page_key = normalize_name(gap.get("page_name", "").replace("MigrationPage", ""))
            path_key = normalize_name(Path(gap.get("source_path", "")).stem.replace("MigrationPage", ""))
            score = 0.0
            for key in [page_key, path_key]:
                if not key:
                    continue
                if key == design_key:
                    score = max(score, 0.950)
                elif key in design_key or design_key in key:
                    score = max(score, 0.820)
            if score > best_score:
                best_gap = gap
                best_score = score
        if not best_gap or best_score < 0.800:
            continue
        rows.append({
            "design_ref_id": id_for("designref", scan_batch_id, design["design_artifact_id"], best_gap["gap_id"], limit=180),
            "source_design_artifact_id": design["design_artifact_id"],
            "source_path": design["source_path"],
            "reference_kind": design["artifact_type"],
            "target_page_name": best_gap["page_name"],
            "target_route": best_gap["target_route"],
            "target_component_path": best_gap["target_component_path"],
            "match_status": "MATCHED_FRONTEND_CANDIDATE",
            "match_confidence": f"{best_score:.3f}",
            "usage_policy": "REFERENCE_ONLY",
            "evidence_json": json.dumps({
                "designTitle": design.get("title", ""),
                "gapType": best_gap.get("gap_type", ""),
                "policy": "Do not copy design HTML directly; improve existing React screen first.",
            }, ensure_ascii=False),
        })
        if len(rows) >= 1000:
            return rows
    return rows


def design_artifact_type(path):
    text = path.as_posix()
    name = path.name.lower()
    if path.suffix.lower() in {".html", ".htm"}:
        if "mapping_detail" in name:
            return "HTML_MAPPING_DETAIL"
        if "완성본" in text or "final" in name:
            return "HTML_FINAL_SCREEN"
        return "HTML_SCREEN"
    if "요구사항" in text or "requirements" in name:
        return "REQUIREMENT_MAPPING"
    if "api" in name or "컴포넌트" in name:
        return "COMPONENT_API_SPEC"
    if "데이터" in name or "ddl" in name:
        return "DATA_MODEL_SPEC"
    if path.suffix.lower() == ".json":
        return "DESIGN_JSON"
    return "DESIGN_DOC"


def design_priority(path, artifact_type):
    text = path.as_posix()
    if "설계HTML_완성본" in text or artifact_type == "HTML_FINAL_SCREEN":
        return 95
    if "HTML_서비스설계_v8" in text or artifact_type == "HTML_MAPPING_DETAIL":
        return 90
    if "화면설계서_최종통합" in text:
        return 88
    if "화면설계서_상세_컴포넌트_API" in text:
        return 86
    if "화면설계서_상호작용시나리오_데이터모델" in text:
        return 84
    if "설계" in text:
        return 80
    return 60


def design_title(path):
    if path.suffix.lower() in {".html", ".htm"}:
        return title_from_html(path) or path.stem
    text = read_text(path)[:8000]
    for line in text.splitlines():
        clean = re.sub(r"^[#\s0-9.\-]+", "", line).strip()
        if len(clean) >= 4:
            return clean[:300]
    return path.stem


def infer_target_page_hint(path, title):
    stem = normalize_name(path.stem)
    title_norm = normalize_name(title)
    return title_norm or stem


def guess_route_from_design(path, title):
    raw = (title or path.stem).strip()
    words = re.findall(r"[A-Za-z0-9]+", raw)
    if words:
        return "/admin/" + "-".join(word.lower() for word in words[:8])
    return ""


def work_request_type_for_gap(gap_type):
    return {
        "PARTIAL_IMPLEMENTATION": "COMPLETE_PARTIAL_FRONTEND_PAGE",
        "PUBLISHED_ONLY_NO_DATA_CONTRACT": "ADD_DATA_ACTION_CONTRACT_TO_FRONTEND_PAGE",
        "BUILDER_SYSTEMIZATION_CHECK": "SYSTEMIZE_EXISTING_FRONTEND_PAGE",
        "REFERENCE_DESIGN_BACKLOG": "PLAN_REFERENCE_DESIGN_AFTER_FRONTEND_PRIORITIZATION",
        "REFERENCE_LINK_NEEDS_TRACE": "LINK_REFERENCE_DESIGN_TO_EXISTING_FRONTEND_PAGE",
        "CURATED_BUILDER_UPGRADE": "UPGRADE_BUILDER_ADMIN_CONSOLE",
    }.get(gap_type, "BUILD_PAGE_GAP")


def prompt_for_gap(row, design=None):
    source_kind = row.get("source_kind", "")
    gap_type = row.get("gap_type", "")
    page_name = row.get("page_name", "")
    route = row.get("target_route", "")
    component = row.get("target_component_path", "")
    source_path = row.get("source_path", "")
    role = row.get("builder_role", "")
    recommendation = row.get("recommendation", "")
    if source_kind == "REFERENCE_DESIGN":
        prompt = (
            f"설계 참조 갭 `{page_name}`를 기존 프론트 화면 개선 후보로 검토해줘. "
            f"설계 원천 `{source_path}`, route 후보 `{route}`. "
            f"gapType={gap_type}, builderRole={role}. "
            "설계 문서를 그대로 퍼블리싱하지 말고, 이미 존재하는 React 화면이나 명시된 메뉴 대상과 매칭될 때만 UI 개선/기획 보강/백엔드/API/DB 개발 순서로 전환해."
        )
    else:
        prompt = (
            f"구현 갭 `{page_name}`를 구축해줘. "
            f"route 후보 `{route}`, component `{component or source_path}`. "
            f"gapType={gap_type}, builderRole={role}. "
            "이미 개발된 프론트 화면을 기준으로 UI 업데이트, 화면 개선 기획 추가, 백엔드/API 개발, DB 개발 순서로 누락 계약을 닫아."
        )
    if recommendation:
        prompt += f" 권장 조치: {recommendation}"
    if design:
        prompt += f" 우선 설계 `{design['source_path']}`를 기준으로 반영해."
    return prompt


def work_requests(empty_rows, gap_rows, design_rows, scan_batch_id):
    requests = []
    design_by_hint = {}
    for design in design_rows:
        for key in [normalize_name(design.get("target_page_hint", "")), normalize_name(design.get("title", ""))]:
            if key and key not in design_by_hint:
                design_by_hint[key] = design
    for row in empty_rows:
        key = normalize_name(row["page_name"].replace("MigrationPage", ""))
        design = next((value for hint, value in design_by_hint.items() if key and (key in hint or hint in key)), None)
        request_type = "IMPLEMENT_EMPTY_PAGE_FROM_DESIGN" if design else "IMPLEMENT_EMPTY_PAGE_NEEDS_DESIGN_MATCH"
        prompt = (
            f"빈 화면 `{row['page_name']}`를 구현해줘. "
            f"route 후보 `{row['route_path']}`, component `{row['component_path']}`. "
            f"emptyType={row['empty_type']}. "
            "설계 원천을 먼저 확인하고, admin screen builder 최소 계약(pageId/menuCode/route/manifest/authority/data-action/runtime verification)을 만족시켜."
        )
        if design:
            prompt += f" 우선 설계 `{design['source_path']}`를 기준으로 반영해."
        requests.append({
            "work_request_id": row["work_request_id"],
            "request_group_id": "empty-page-bulk-" + scan_batch_id,
            "request_type": request_type,
            "priority_score": row["severity_score"],
            "page_name": row["page_name"],
            "route_path": row["route_path"],
            "component_path": row["component_path"],
            "design_artifact_id": design["design_artifact_id"] if design else "",
            "request_prompt": prompt,
            "expected_evidence": "source diff, design source ref, page manifest/help binding, build result, route proof",
        })
    for row in gap_rows:
        if row.get("source_kind") == "REFERENCE_DESIGN" and row.get("gap_type") == "REFERENCE_DESIGN_BACKLOG":
            continue
        key = normalize_name(row["page_name"].replace("MigrationPage", ""))
        design = next((value for hint, value in design_by_hint.items() if key and (key in hint or hint in key)), None)
        work_request_id = id_for("workgap", scan_batch_id, row["gap_id"], row["gap_type"], limit=180)
        requests.append({
            "work_request_id": work_request_id,
            "request_group_id": "gap-build-" + scan_batch_id,
            "request_type": work_request_type_for_gap(row["gap_type"]),
            "priority_score": row["priority_score"],
            "page_name": row["page_name"],
            "route_path": row["target_route"],
            "component_path": row["target_component_path"] or row["source_path"],
            "design_artifact_id": design["design_artifact_id"] if design else "",
            "request_prompt": prompt_for_gap(row, design),
            "expected_evidence": "design source ref, source diff, API/DB contract or static-page decision, authority scope, page manifest/help binding, build result, route/API proof",
        })
    return requests[:5000]


def is_react_page_file(path):
    name = path.name
    if name.endswith("MigrationPage.tsx"):
        return True
    if name.endswith("Page.tsx") or name.endswith("Pages.tsx"):
        return True
    return False


def has_data_or_action_contract(text):
    return bool(re.search(
        r"fetch\s*\(|axios|/api/|useQuery|useMutation|loader\s*=|bootstrap|adminShell|adminActions|screenCommand|mutate|submit|save|delete|approve",
        text,
        re.I,
    ))


def normalize_name(value):
    return re.sub(r"[^0-9a-zA-Z가-힣]+", "", str(value).lower())


def title_from_html(path):
    text = read_text(path)[:20000]
    for regex in [r"<title[^>]*>(.*?)</title>", r"<h1[^>]*>(.*?)</h1>"]:
        match = re.search(regex, text, re.I | re.S)
        if match:
            return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", match.group(1))).strip()
    return ""


def guess_route_from_name(name):
    stem = re.sub(r"MigrationPage$", "", name)
    words = re.findall(r"[A-Z]?[a-z0-9]+|[A-Z]+(?=[A-Z]|$)", stem)
    slug = "-".join(word.lower() for word in words if word)
    if not slug:
        return ""
    return "/admin/" + slug


def infer_builder_role(path_text):
    low = path_text.lower()
    if "screen-builder" in low:
        return "package-builder"
    if "environment-management" in low:
        return "install-bind"
    if "currentruntimecompare" in low or "screenruntime" in low:
        return "validator-result"
    if "repairworkbench" in low:
        return "rollback-history"
    if "fullstack" in low:
        return "detail"
    if "menumanagement" in low or "menu-management" in low:
        return "registry"
    if "theme" in low:
        return "theme-package"
    return "page-systemization"


def recommendation_for_gap(gap_type):
    return {
        "PARTIAL_IMPLEMENTATION": "Complete data/action contracts, authority scope, runtime verification, and builder-ready manifest.",
        "PUBLISHED_ONLY_NO_DATA_CONTRACT": "Add bootstrap/query/mutation contract or explicitly mark as static informational page.",
        "BUILDER_SYSTEMIZATION_CHECK": "Run page-systemization checklist and register component/API/DB chain.",
        "REFERENCE_DESIGN_BACKLOG": "Keep design as a planning reference; do not publish directly until an existing frontend page or explicit menu target is selected.",
        "REFERENCE_LINK_NEEDS_TRACE": "Link reference design source to the existing frontend page and store parity evidence.",
    }.get(gap_type, "Review and classify builder readiness.")


def dev_pattern_bindings(assets, scan_batch_id):
    rows = []
    for asset in assets:
        pattern = asset.get("owner_scope") or "GENERAL_CODE_PATTERN"
        rows.append({
            "binding_id": id_for("bind", scan_batch_id, asset["asset_id"], pattern, limit=160),
            "asset_id": asset["asset_id"],
            "asset_path": asset["source_path"],
            "pattern_id": pattern,
            "pattern_scope": asset["asset_type"],
            "confidence_score": "0.750",
            "evidence_ref": "hermes-sync-system-assets.py",
        })
    return rows[:8000]


def insert_select_not_exists(table, columns, values, key_column, key_value):
    cols = ", ".join(columns)
    vals = ", ".join(values)
    return f"INSERT INTO {table} ({cols}) SELECT {vals} FROM db_root WHERE NOT EXISTS (SELECT 1 FROM {table} WHERE {key_column} = {sql_lit(key_value)});"


def generate_sql(scan_batch_id, root, tree, frameworks, assets, code_rows, bindings, gaps, empty_rows, design_rows, design_ref_rows, request_rows, summary):
    statements = [
        "UPDATE system_asset_tree_snapshot SET active_yn='N' WHERE project_id='carbonet';",
        "UPDATE system_asset_framework_structure SET active_yn='N' WHERE project_id='carbonet';",
        "UPDATE system_asset_code_structure SET active_yn='N' WHERE project_id='carbonet';",
        "UPDATE system_asset_development_pattern_binding SET active_yn='N' WHERE project_id='carbonet';",
        "UPDATE system_builder_page_gap SET active_yn='N' WHERE project_id='carbonet' AND source_kind <> 'CURATED_BUILDER_BACKLOG';",
        "UPDATE system_empty_page_inventory SET active_yn='N' WHERE project_id='carbonet';",
        "UPDATE system_design_artifact_registry SET active_yn='N' WHERE project_id='carbonet';",
        "UPDATE system_design_reference_map SET active_yn='N' WHERE project_id='carbonet';",
        "UPDATE system_builder_work_request_queue SET active_yn='N' WHERE project_id='carbonet' AND (request_group_id LIKE 'empty-page-bulk-%' OR request_group_id LIKE 'gap-build-%');",
        "UPDATE system_asset_inventory SET active_yn='N' WHERE service_owner='hermes-sync-system-assets';",
        "INSERT INTO hermes_project_scan_batch (scan_batch_id, project_id, scan_type, root_path, status, asset_count, evidence_ref, summary, scanned_by) VALUES ("
        + ", ".join([
            sql_lit(scan_batch_id), "'carbonet'", "'SYSTEM_ASSET_BUILDER_REGISTRY'", sql_lit(root.as_posix()), "'COMPLETED'",
            str(len(assets)), sql_lit("system_asset_inventory/system_builder_page_gap"), sql_lit(json.dumps(summary, ensure_ascii=False)),
            "'hermes-sync-system-assets.py'",
        ])
        + ");",
    ]

    for row in assets:
        statements.append(
            "UPDATE system_asset_inventory SET "
            + ", ".join([
                f"asset_type={sql_lit(row['asset_type'], 40)}",
                f"asset_name={sql_lit(row['asset_name'], 200)}",
                f"source_path={sql_lit(row['source_path'], 500)}",
                f"source_symbol={sql_lit(row['source_symbol'], 200)}",
                f"content_hash={sql_lit(row['content_hash'], 64)}",
                f"owner_domain={sql_lit(row['owner_domain'], 30)}",
                f"criticality={sql_lit(row['criticality'], 20)}",
                "health_status='OK'",
                "last_scan_at=CURRENT_DATETIME",
                "active_yn='Y'",
                f"asset_family={sql_lit(row['asset_family'], 30)}",
                f"owner_scope={sql_lit(row['owner_scope'], 30)}",
                f"operator_owner={sql_lit(row['operator_owner'], 100)}",
                f"service_owner={sql_lit(row['service_owner'], 100)}",
                "updated_at=CURRENT_DATETIME",
            ])
            + f" WHERE asset_id={sql_lit(row['asset_id'], 120)};"
        )
        statements.append(insert_select_not_exists(
            "system_asset_inventory",
            ["asset_id", "asset_type", "asset_name", "asset_version", "source_path", "source_symbol", "content_hash", "owner_domain", "criticality", "health_status", "last_scan_at", "active_yn", "created_at", "updated_at", "asset_family", "owner_scope", "operator_owner", "service_owner"],
            [sql_lit(row["asset_id"], 120), sql_lit(row["asset_type"], 40), sql_lit(row["asset_name"], 200), "'1.0.0'", sql_lit(row["source_path"], 500), "''", sql_lit(row["content_hash"], 64), sql_lit(row["owner_domain"], 30), sql_lit(row["criticality"], 20), "'OK'", "CURRENT_DATETIME", "'Y'", "CURRENT_DATETIME", "CURRENT_DATETIME", sql_lit(row["asset_family"], 30), sql_lit(row["owner_scope"], 30), sql_lit(row["operator_owner"], 100), sql_lit(row["service_owner"], 100)],
            "asset_id",
            row["asset_id"],
        ))

    for row in tree:
        statements.append(insert_select_not_exists(
            "system_asset_tree_snapshot",
            ["tree_node_id", "project_id", "scan_batch_id", "root_path", "node_path", "parent_path", "node_type", "node_depth", "file_count", "directory_count", "owner_domain", "language_hint", "content_hash"],
            [sql_lit(row["tree_node_id"], 160), "'carbonet'", sql_lit(scan_batch_id), sql_lit(row["root_path"], 1000), sql_lit(row["node_path"], 1000), sql_lit(row["parent_path"], 1000), sql_lit(row["node_type"], 40), str(row["node_depth"]), str(row["file_count"]), str(row["directory_count"]), sql_lit(row["owner_domain"], 80), sql_lit(row["language_hint"], 80), sql_lit(row["content_hash"], 80)],
            "tree_node_id",
            row["tree_node_id"],
        ))

    for row in frameworks:
        statements.append(insert_select_not_exists(
            "system_asset_framework_structure",
            ["framework_node_id", "project_id", "scan_batch_id", "structure_type", "node_name", "node_path", "parent_path", "framework_role", "build_tool", "package_name", "metadata_json", "content_hash"],
            [sql_lit(row["framework_node_id"], 160), "'carbonet'", sql_lit(scan_batch_id), sql_lit(row["structure_type"], 80), sql_lit(row["node_name"], 240), sql_lit(row["node_path"], 1000), sql_lit(row["parent_path"], 1000), sql_lit(row["framework_role"], 120), sql_lit(row["build_tool"], 80), sql_lit(row["package_name"], 240), sql_lit(row["metadata_json"]), sql_lit(row["content_hash"], 80)],
            "framework_node_id",
            row["framework_node_id"],
        ))

    for row in code_rows:
        statements.append(insert_select_not_exists(
            "system_asset_code_structure",
            ["code_structure_id", "project_id", "scan_batch_id", "asset_id", "source_path", "language_code", "symbol_type", "symbol_name", "parent_symbol", "line_no", "signature_hash", "pattern_code", "summary"],
            [sql_lit(row["code_structure_id"], 180), "'carbonet'", sql_lit(scan_batch_id), sql_lit(row["asset_id"], 120), sql_lit(row["source_path"], 1000), sql_lit(row["language_code"], 40), sql_lit(row["symbol_type"], 80), sql_lit(row["symbol_name"], 240), sql_lit(row["parent_symbol"], 240), str(row["line_no"]), sql_lit(row["signature_hash"], 80), sql_lit(row["pattern_code"], 120), sql_lit(row["summary"])],
            "code_structure_id",
            row["code_structure_id"],
        ))

    for row in bindings:
        statements.append(insert_select_not_exists(
            "system_asset_development_pattern_binding",
            ["binding_id", "project_id", "scan_batch_id", "asset_id", "asset_path", "pattern_id", "pattern_scope", "confidence_score", "evidence_ref"],
            [sql_lit(row["binding_id"], 160), "'carbonet'", sql_lit(scan_batch_id), sql_lit(row["asset_id"], 120), sql_lit(row["asset_path"], 1000), sql_lit(row["pattern_id"], 120), sql_lit(row["pattern_scope"], 80), row["confidence_score"], sql_lit(row["evidence_ref"], 1000)],
            "binding_id",
            row["binding_id"],
        ))

    for row in gaps:
        statements.append(insert_select_not_exists(
            "system_builder_page_gap",
            ["gap_id", "project_id", "scan_batch_id", "source_kind", "source_path", "page_name", "target_route", "target_component_path", "gap_type", "gap_status", "priority_score", "builder_role", "recommendation", "evidence_json"],
            [sql_lit(row["gap_id"], 180), "'carbonet'", sql_lit(scan_batch_id), sql_lit(row["source_kind"], 80), sql_lit(row["source_path"], 1000), sql_lit(row["page_name"], 240), sql_lit(row["target_route"], 500), sql_lit(row["target_component_path"], 1000), sql_lit(row["gap_type"], 80), "'OPEN'", str(row["priority_score"]), sql_lit(row["builder_role"], 80), sql_lit(row["recommendation"]), sql_lit(row["evidence_json"])],
            "gap_id",
            row["gap_id"],
        ))

    for row in empty_rows:
        statements.append(insert_select_not_exists(
            "system_empty_page_inventory",
            ["empty_page_id", "project_id", "scan_batch_id", "page_name", "route_path", "component_path", "empty_type", "severity_score", "evidence_summary", "recommended_action", "work_request_id"],
            [sql_lit(row["empty_page_id"], 180), "'carbonet'", sql_lit(scan_batch_id), sql_lit(row["page_name"], 240), sql_lit(row["route_path"], 500), sql_lit(row["component_path"], 1000), sql_lit(row["empty_type"], 80), str(row["severity_score"]), sql_lit(row["evidence_summary"]), sql_lit(row["recommended_action"]), sql_lit(row["work_request_id"], 180)],
            "empty_page_id",
            row["empty_page_id"],
        ))

    for row in design_rows:
        statements.append(insert_select_not_exists(
            "system_design_artifact_registry",
            ["design_artifact_id", "project_id", "scan_batch_id", "source_root", "source_path", "artifact_type", "title", "canonical_priority", "target_route_hint", "target_page_hint", "content_hash", "evidence_summary"],
            [sql_lit(row["design_artifact_id"], 180), "'carbonet'", sql_lit(scan_batch_id), sql_lit(row["source_root"], 1000), sql_lit(row["source_path"], 1200), sql_lit(row["artifact_type"], 80), sql_lit(row["title"], 300), str(row["canonical_priority"]), sql_lit(row["target_route_hint"], 500), sql_lit(row["target_page_hint"], 240), sql_lit(row["content_hash"], 80), sql_lit(row["evidence_summary"])],
            "design_artifact_id",
            row["design_artifact_id"],
        ))

    for row in design_ref_rows:
        statements.append(insert_select_not_exists(
            "system_design_reference_map",
            ["design_ref_id", "project_id", "scan_batch_id", "source_design_artifact_id", "source_path", "reference_kind", "target_page_name", "target_route", "target_component_path", "match_status", "match_confidence", "usage_policy", "evidence_json"],
            [sql_lit(row["design_ref_id"], 180), "'carbonet'", sql_lit(scan_batch_id), sql_lit(row["source_design_artifact_id"], 180), sql_lit(row["source_path"], 1200), sql_lit(row["reference_kind"], 80), sql_lit(row["target_page_name"], 240), sql_lit(row["target_route"], 500), sql_lit(row["target_component_path"], 1000), sql_lit(row["match_status"], 40), row["match_confidence"], sql_lit(row["usage_policy"], 80), sql_lit(row["evidence_json"])],
            "design_ref_id",
            row["design_ref_id"],
        ))

    for row in request_rows:
        statements.append(insert_select_not_exists(
            "system_builder_work_request_queue",
            ["work_request_id", "project_id", "scan_batch_id", "request_group_id", "request_type", "request_status", "priority_score", "page_name", "route_path", "component_path", "design_artifact_id", "request_prompt", "expected_evidence"],
            [sql_lit(row["work_request_id"], 180), "'carbonet'", sql_lit(scan_batch_id), sql_lit(row["request_group_id"], 160), sql_lit(row["request_type"], 80), "'READY'", str(row["priority_score"]), sql_lit(row["page_name"], 240), sql_lit(row["route_path"], 500), sql_lit(row["component_path"], 1000), sql_lit(row["design_artifact_id"], 180), sql_lit(row["request_prompt"]), sql_lit(row["expected_evidence"])],
            "work_request_id",
            row["work_request_id"],
        ))

    statements.append("COMMIT;")
    return "\n".join(statements) + "\n"


def apply_sql(sql_path, namespace, pod, db_name, db_user):
    remote = f"/tmp/{sql_path.name}"
    subprocess.run(["kubectl", "-n", namespace, "cp", str(sql_path), f"{pod}:{remote}"], check=True)
    subprocess.run(["kubectl", "-n", namespace, "exec", pod, "--", "bash", "-lc", f"csql -u {db_user} {db_name} -i {remote}"], check=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".")
    parser.add_argument("--reference-root", action="append", default=[])
    parser.add_argument("--out", default="")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--namespace", default="carbonet-prod")
    parser.add_argument("--pod", default="cubrid-carbonet-0")
    parser.add_argument("--db-name", default="carbonet")
    parser.add_argument("--db-user", default="dba")
    parser.add_argument("--max-files", type=int, default=int(os.environ.get("HERMES_ASSET_MAX_FILES", "6000")))
    parser.add_argument("--max-depth", type=int, default=int(os.environ.get("HERMES_ASSET_MAX_DEPTH", "6")))
    args = parser.parse_args()

    root = Path(args.root).resolve()
    reference_roots = [Path(item).resolve() for item in args.reference_root]
    scan_batch_id = now_batch_id()

    tree = tree_nodes(root, scan_batch_id, args.max_depth)
    frameworks = framework_nodes(root, scan_batch_id)
    assets, code_rows = inventory_and_code(root, scan_batch_id, args.max_files)
    for reference_root in reference_roots:
        if reference_root.exists():
            ref_assets, ref_code = inventory_and_code(reference_root, scan_batch_id, max(500, args.max_files // 3))
            assets.extend(ref_assets)
            code_rows.extend(ref_code)
            tree.extend(tree_nodes(reference_root, scan_batch_id, min(args.max_depth, 4)))
    bindings = dev_pattern_bindings(assets, scan_batch_id)
    gaps = builder_gaps(root, reference_roots, scan_batch_id)
    empty_rows = empty_pages(root, scan_batch_id)
    design_rows = design_artifacts(reference_roots, scan_batch_id)
    design_ref_rows = design_reference_maps(gaps, design_rows, scan_batch_id)
    request_rows = work_requests(empty_rows, gaps, design_rows, scan_batch_id)
    summary = {
        "scanBatchId": scan_batch_id,
        "root": root.as_posix(),
        "referenceRoots": [item.as_posix() for item in reference_roots],
        "treeNodes": len(tree),
        "frameworkNodes": len(frameworks),
        "assets": len(assets),
        "codeStructures": len(code_rows),
        "patternBindings": len(bindings),
        "builderGaps": len(gaps),
        "emptyPages": len(empty_rows),
        "designArtifacts": len(design_rows),
        "designReferences": len(design_ref_rows),
        "workRequests": len(request_rows),
    }
    sql = generate_sql(scan_batch_id, root, tree, frameworks, assets, code_rows, bindings, gaps, empty_rows, design_rows, design_ref_rows, request_rows, summary)
    out_path = Path(args.out or f"/tmp/{scan_batch_id}.sql")
    out_path.write_text(sql, encoding="utf-8")
    print(json.dumps({"sqlPath": str(out_path), **summary}, ensure_ascii=False, indent=2))
    if args.apply:
        apply_sql(out_path, args.namespace, args.pod, args.db_name, args.db_user)


if __name__ == "__main__":
    main()
