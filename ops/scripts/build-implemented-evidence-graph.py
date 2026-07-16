#!/usr/bin/env python3
"""Build an evidence graph for implemented screens, APIs, DB objects, authority and tests.

The graph is intentionally evidence-first: a relationship is emitted only when a
literal path/name is found or when a bounded token match can be explained.  It is
used to enrich the implemented-first process model, not to invent implementation.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs/architecture/executable-webapp/generated"
FRONT = ROOT / "projects/carbonet-frontend/source/src"
JAVA_ROOTS = [ROOT / "apps", ROOT / "modules/resonance-common"]
SOURCE_SUFFIXES = {".ts", ".tsx", ".js", ".jsx"}
TEST_MARKERS = ("/test/", "__tests__", ".test.", ".spec.", "Test.java", "Tests.java")

ROUTE_RE = re.compile(r"[\"'`](/(?:admin|en|emission|home|monitoring|mypage|api|co2|payment|report|certificate|education|support|trade|lca|reduction|external|content|system)[^\"'`\s?#${}]*)", re.I)
FETCH_RE = re.compile(r"(?:fetch|axios\.(?:get|post|put|patch|delete)|apiClient\.(?:get|post|put|patch|delete))\s*\(\s*[`\"']([^`\"']+)", re.I)
JAVA_MAP_RE = re.compile(r"@(RequestMapping|GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping)\s*(?:\(([^)]*)\))?", re.S)
JAVA_VALUE_RE = re.compile(r"[\"']([^\"']*)[\"']")
AUTH_RE = re.compile(r"@(PreAuthorize|Secured|RolesAllowed)\s*\(([^)]*)\)|has(?:Role|Authority)\s*\(\s*[\"']([^\"']+)", re.S)
SQL_TABLE_RE = re.compile(r"\b(?:from|join|into|update|delete\s+from)\s+([a-zA-Z_][\w$.]*)", re.I)


def text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def digest(path: Path) -> str:
    try:
        return hashlib.sha256(path.read_bytes()).hexdigest()
    except OSError:
        return ""


def normalize_path(value: str) -> str:
    value = value.split("?", 1)[0].strip()
    value = re.sub(r"\$\{[^}]+}", "{param}", value)
    value = re.sub(r"//+", "/", value)
    return value.rstrip("/") or "/"


def path_pattern(value: str) -> re.Pattern[str]:
    escaped = re.escape(normalize_path(value))
    escaped = re.sub(r"\\\{[^}]+\\\}", r"[^/]+", escaped)
    escaped = escaped.replace(r"\{param\}", "[^/]+")
    return re.compile("^" + escaped + "$", re.I)


def path_matches(left: str, right: str) -> bool:
    left, right = normalize_path(left), normalize_path(right)
    return left == right or bool(path_pattern(left).match(right)) or bool(path_pattern(right).match(left))


def tokens(value: str) -> set[str]:
    raw = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", value)
    return {x.lower() for x in re.findall(r"[A-Za-z0-9가-힣]{3,}", raw) if x.lower() not in {"admin", "page", "api", "list", "detail", "manage", "management"}}


def frontend_inventory() -> tuple[list[dict], list[dict]]:
    screens, api_calls = [], []
    for path in FRONT.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in SOURCE_SUFFIXES:
            continue
        body, source = text(path), rel(path)
        routes = sorted({normalize_path(x) for x in ROUTE_RE.findall(body) if not x.startswith("/api/")})
        calls = sorted({normalize_path(x) for x in FETCH_RE.findall(body) if x.startswith("/")})
        if path.name.endswith(("Page.tsx", "Pages.tsx")) or routes or calls:
            screens.append({"sourcePath": source, "componentName": path.stem, "routes": routes, "apiCalls": calls, "sha256": digest(path)})
        for call in calls:
            api_calls.append({"path": call, "sourcePath": source, "componentName": path.stem})
    return screens, api_calls


def java_inventory() -> tuple[list[dict], list[dict], dict[str, set[str]]]:
    controllers, endpoints = [], []
    tables_by_source: dict[str, set[str]] = defaultdict(set)
    table_files = []
    for root in JAVA_ROOTS:
        if root.exists():
            table_files.extend(p for p in root.rglob("*") if p.is_file() and p.suffix.lower() in {".java", ".xml", ".sql"})
    bodies: dict[str, str] = {}
    class_sources: dict[str, str] = {}
    for path in table_files:
        body, source = text(path), rel(path)
        bodies[source] = body
        class_sources[path.stem] = source
        for table in SQL_TABLE_RE.findall(body):
            tables_by_source[source].add(table.split(".")[-1].lower())
    # MyBatis XML commonly contains the SQL while Java interfaces/controllers
    # contain the dependency name.  Treat the shared stem/namespace as a literal
    # source dependency before walking the Java call graph.
    for source, body in bodies.items():
        if not source.endswith(".xml") or not tables_by_source[source]:
            continue
        namespace = re.search(r'<mapper\s+namespace="([^"]+)"', body)
        candidate = (namespace.group(1).split(".")[-1] if namespace else Path(source).stem)
        java_source = class_sources.get(candidate)
        if java_source:
            tables_by_source[java_source].update(tables_by_source[source])
    direct_dependencies: dict[str, set[str]] = defaultdict(set)
    for source, body in bodies.items():
        if not source.endswith(".java"):
            continue
        for class_name in set(re.findall(r"\b[A-Z][A-Za-z0-9_]{2,}\b", body)):
            dependency_source = class_sources.get(class_name)
            if dependency_source and dependency_source != source:
                direct_dependencies[source].add(dependency_source)
    expanded_tables: dict[str, set[str]] = defaultdict(set)
    for source in bodies:
        frontier, visited = [(source, 0)], set()
        while frontier:
            current, depth = frontier.pop(0)
            if current in visited or depth > 4:
                continue
            visited.add(current)
            expanded_tables[source].update(tables_by_source.get(current, set()))
            frontier.extend((dependency, depth + 1) for dependency in direct_dependencies.get(current, set()))
    for path in table_files:
        body, source = bodies[rel(path)], rel(path)
        if path.suffix.lower() != ".java" or ("@Controller" not in body and "@RestController" not in body):
            continue
        class_name = path.stem
        class_head = body[: body.find("class ") if "class " in body else 0]
        class_maps = []
        for annotation, args in JAVA_MAP_RE.findall(class_head):
            if annotation == "RequestMapping":
                class_maps.extend(JAVA_VALUE_RE.findall(args or ""))
        class_maps = class_maps or [""]
        authorities = sorted({(b or c).strip() for _annotation, b, c in AUTH_RE.findall(body) if (b or c).strip()})
        controller = {"className": class_name, "sourcePath": source, "classPaths": class_maps, "authorities": authorities, "sha256": digest(path)}
        controllers.append(controller)
        method_area = body[len(class_head):]
        for annotation, args in JAVA_MAP_RE.findall(method_area):
            method_paths = JAVA_VALUE_RE.findall(args or "") or [""]
            for base in class_maps:
                for method_path in method_paths:
                    full = normalize_path("/".join(x.strip("/") for x in (base, method_path) if x) or "/")
                    endpoints.append({"endpointId": f"{class_name}:{annotation}:{full}", "controller": class_name, "annotation": annotation, "path": full, "sourcePath": source, "authorities": authorities})
    return controllers, endpoints, expanded_tables


def test_inventory() -> list[dict]:
    rows = []
    roots = [ROOT / "apps", ROOT / "modules", FRONT]
    source_test_suffixes = {".java", ".kt", ".ts", ".tsx", ".js", ".jsx"}
    for root in roots:
        if not root.exists():
            continue
        for path in root.rglob("*"):
            source = path.as_posix()
            if not path.is_file() or path.suffix.lower() not in source_test_suffixes or not any(marker in source for marker in TEST_MARKERS):
                continue
            body = text(path)
            paths = sorted({normalize_path(x) for x in ROUTE_RE.findall(body)})
            rows.append({"sourcePath": rel(path), "referencedPaths": paths, "contentTokens": sorted(tokens(rel(path) + " " + body[:12000])), "sha256": digest(path)})
    return rows


def match_menu(menu: dict, screens: list[dict], api_calls: list[dict], endpoints: list[dict], tests: list[dict], tables_by_source: dict[str, set[str]], known_tables: set[str]) -> dict:
    url = normalize_path(menu.get("url") or "/")
    menu_tokens = tokens(f"{menu.get('name', '')} {url}")
    exact_screens = [s for s in screens if any(path_matches(url, route) for route in s["routes"])]
    if not exact_screens:
        scored = [(len(menu_tokens & tokens(s["componentName"] + " " + s["sourcePath"])), s) for s in screens]
        exact_screens = [s for score, s in sorted(scored, key=lambda x: (-x[0], x[1]["sourcePath"])) if score >= 2][:3]
    screen_sources = {s["sourcePath"] for s in exact_screens}
    calls = [c for c in api_calls if c["sourcePath"] in screen_sources]
    endpoint_hits = []
    for endpoint in endpoints:
        call_match = any(path_matches(call["path"], endpoint["path"]) for call in calls)
        route_prefix = url != "/" and (endpoint["path"].startswith(url + "/") or url.startswith(endpoint["path"] + "/"))
        token_score = len(menu_tokens & tokens(endpoint["controller"] + " " + endpoint["path"]))
        if call_match or route_prefix or token_score >= 2:
            endpoint_hits.append({**endpoint, "matchType": "FRONTEND_CALL" if call_match else "ROUTE_PREFIX" if route_prefix else "TOKEN_EXPLAINED"})
    endpoint_hits = endpoint_hits[:30]
    controller_sources = {e["sourcePath"] for e in endpoint_hits}
    table_names = sorted({table for source in controller_sources for table in tables_by_source.get(source, set()) if not known_tables or table in known_tables})
    evidence_tokens = menu_tokens | {token for e in endpoint_hits for token in tokens(e["controller"] + " " + e["path"])}
    test_hits = [t for t in tests if any(path_matches(url, p) for p in t["referencedPaths"]) or any(path_matches(e["path"], p) for e in endpoint_hits for p in t["referencedPaths"]) or len(evidence_tokens & set(t["contentTokens"])) >= 3][:30]
    authorities = sorted({a for e in endpoint_hits for a in e["authorities"]})
    status = "VERIFIED" if exact_screens and endpoint_hits else "PARTIAL" if exact_screens or endpoint_hits else "UNRESOLVED"
    return {
        "menuCode": menu.get("code"), "menuName": menu.get("name"), "menuUrl": menu.get("url"),
        "traceStatus": status, "screenEvidence": exact_screens, "apiEvidence": endpoint_hits,
        "databaseEvidence": table_names, "authorityEvidence": authorities, "testEvidence": test_hits,
        "coverage": {"screen": bool(exact_screens), "api": bool(endpoint_hits), "database": bool(table_names), "authority": bool(authorities), "test": bool(test_hits)},
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", type=Path, default=OUT / "runtime-db-inventory.json")
    parser.add_argument("--out", type=Path, default=OUT)
    args = parser.parse_args()
    db = json.loads(args.db.read_text(encoding="utf-8-sig"))
    screens, calls = frontend_inventory()
    controllers, endpoints, tables_by_source = java_inventory()
    tests = test_inventory()
    known_tables = {row["table_name"].lower() for row in db.get("tables", [])}
    traces = [match_menu(menu, screens, calls, endpoints, tests, tables_by_source, known_tables) for menu in db.get("menus", []) if menu.get("useAt") == "Y"]
    actor_bindings: dict[str, set[str]] = defaultdict(set)
    for binding in db.get("menuProcessBindings", []):
        if binding.get("actor_code"):
            actor_bindings[binding["menu_code"]].add(binding["actor_code"])
    for trace in traces:
        bound_actors = sorted(actor_bindings.get(trace["menuCode"], set()))
        if bound_actors:
            trace["authorityEvidence"] = [f"ACTOR:{actor}" for actor in bound_actors]
            trace["authorityMechanism"] = {
                "type": "CENTRAL_MENU_ACTOR_BINDING",
                "bindingSource": "runtime-db-inventory.menuProcessBindings",
                "enforcementSources": [
                    "modules/resonance-common/common-auth/src/main/java/com/resonance/common/auth/service/AuthService.java",
                    "modules/resonance-common/carbonet-common-core/src/main/resources/egovframework/mapper/com/platform/codex/AuthGroupManageMapper.xml",
                ],
            }
            trace["coverage"]["authority"] = True
    registered_screen_sources = {x["sourcePath"] for trace in traces for x in trace["screenEvidence"]}
    registered_endpoint_ids = {x["endpointId"] for trace in traces for x in trace["apiEvidence"]}
    registered_tables = {x for trace in traces for x in trace["databaseEvidence"]}
    registered_test_sources = {x["sourcePath"] for trace in traces for x in trace["testEvidence"]}
    unregistered = {
        "frontendScreens": sorted({x["sourcePath"] for x in screens} - registered_screen_sources),
        "javaEndpoints": sorted({x["endpointId"] for x in endpoints} - registered_endpoint_ids),
        "databaseObjects": sorted(known_tables - registered_tables),
        "testSources": sorted({x["sourcePath"] for x in tests} - registered_test_sources),
    }
    coverage = {key: sum(t["coverage"][key] for t in traces) for key in ("screen", "api", "database", "authority", "test")}
    unregistered_stat_names = {"frontendScreens": "unregisteredFrontendScreens", "javaEndpoints": "unregisteredJavaEndpoints", "databaseObjects": "unregisteredDatabaseObjects", "testSources": "unregisteredTestSources"}
    stats = {"implementedMenus": len(traces), "frontendScreens": len(screens), "frontendApiCalls": len(calls), "javaControllers": len(controllers), "javaEndpoints": len(endpoints), "databaseObjects": len(known_tables), "testSources": len(tests), **{f"menusWith{key.title()}Evidence": value for key, value in coverage.items()}, **{unregistered_stat_names[key]: len(value) for key, value in unregistered.items()}}
    validation = {"duplicateMenuTraces": len(traces) - len({t["menuCode"] for t in traces}), "unknownDatabaseObjects": sum(1 for t in traces for table in t["databaseEvidence"] if table not in known_tables)}
    validation["status"] = "PASSED" if not any(value for key, value in validation.items() if key != "status") else "FAILED"
    model = {"precedencePolicy": "IMPLEMENTED_EVIDENCE_FIRST", "stats": stats, "validation": validation, "unregisteredImplementedAssets": unregistered, "menuTraces": traces}
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "implemented-evidence-graph.json").write_text(json.dumps(model, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    lines = ["# 기개발 구현 증거 그래프", "", "화면, API, DB, 권한, 테스트를 실제 소스의 경로와 이름으로 연결한 자동 조사 결과입니다.", "", "## 수치", ""]
    lines.extend(f"- {key}: {value:,}" for key, value in stats.items())
    lines.extend(["", "## 검증", "", f"- status: {validation['status']}", f"- duplicateMenuTraces: {validation['duplicateMenuTraces']}", f"- unknownDatabaseObjects: {validation['unknownDatabaseObjects']}", ""])
    (args.out / "implemented-evidence-graph.md").write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps({"stats": stats, "validation": validation}, ensure_ascii=False))


if __name__ == "__main__":
    main()
