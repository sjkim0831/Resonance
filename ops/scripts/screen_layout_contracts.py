#!/usr/bin/env python3
"""Deterministic reference geometry for Carbonet screen contracts.

The generated x/y values describe a reference viewport for review and visual
regression. CSS Grid/Flex constraints are the implementation source of truth;
absolute positioning is intentionally forbidden for normal page flow.
"""

from __future__ import annotations

import json
import re
from collections import Counter


BREAKPOINTS = {
    "desktop": {"width": 1440, "height": 900, "sidebar": 240, "topbar": 64, "margin": 24, "columns": 12, "gap": 24},
    "laptop": {"width": 1280, "height": 800, "sidebar": 216, "topbar": 64, "margin": 24, "columns": 12, "gap": 20},
    "tablet": {"width": 768, "height": 1024, "sidebar": 0, "topbar": 56, "margin": 20, "columns": 8, "gap": 16},
    "mobile": {"width": 360, "height": 800, "sidebar": 0, "topbar": 56, "margin": 16, "columns": 4, "gap": 12},
}


def parse(value):
    if value in (None, ""):
        return []
    if isinstance(value, (list, dict)):
        return value
    try:
        return json.loads(value)
    except Exception:
        return value


def slug(value: str) -> str:
    clean = re.sub(r"[^a-zA-Z0-9가-힣]+", "-", str(value or "")).strip("-").lower()
    return clean or "item"


def route_pattern(route: str) -> str:
    route = (route or "").lower().rstrip("/")
    tail = route.split("/")[-1]
    if route in ("", "/home") or any(k in tail for k in ("dashboard", "home")):
        return "DASHBOARD"
    if any(k in route for k in ("signin", "login", "findpassword", "findid")):
        return "AUTH"
    if any(k in tail for k in ("detail", "view", "info")):
        return "DETAIL"
    if any(k in tail for k in ("write", "create", "new", "register", "edit", "modify", "step", "join")):
        return "FORM"
    if any(k in tail for k in ("list", "management", "manage", "status", "history")):
        return "LIST"
    return "WORKSPACE"


def normalized_items(value, prefix: str) -> list[dict]:
    parsed = parse(value)
    if isinstance(parsed, dict):
        parsed = [parsed]
    if not isinstance(parsed, list):
        parsed = [parsed] if parsed else []
    result = []
    for idx, item in enumerate(parsed, 1):
        if isinstance(item, dict):
            label = item.get("label") or item.get("name") or item.get("title") or item.get("id") or f"{prefix} {idx}"
            result.append({"id": str(item.get("id") or f"{prefix.lower()}-{idx}"), "label": str(label), "raw": item, "provenance": "contract"})
        else:
            result.append({"id": f"{prefix.lower()}-{idx}", "label": str(item), "raw": item, "provenance": "contract"})
    return result


def template_sections(pattern: str) -> list[dict]:
    templates = {
        "DASHBOARD": [("summary", "KPI 요약", 176), ("visualization", "추이 및 분포", 336), ("recent", "최근 업무", 300)],
        "AUTH": [("auth", "인증 입력", 420), ("support", "인증 지원", 112)],
        "DETAIL": [("summary", "상세 요약", 176), ("detail", "상세 정보", 360), ("history", "이력 및 증적", 280)],
        "FORM": [("progress", "진행 단계", 80), ("form", "입력 항목", 440), ("actions", "처리 명령", 88)],
        "LIST": [("search", "검색 조건", 176), ("toolbar", "목록 명령", 64), ("results", "조회 결과", 420), ("pagination", "페이지 이동", 64)],
        "WORKSPACE": [("search", "업무 조건", 144), ("content", "업무 콘텐츠", 440), ("actions", "처리 명령", 88)],
    }
    return [{"id": key, "label": label, "height": height, "provenance": "template-derived"} for key, label, height in templates[pattern]]


def component_type(label: str, group: str) -> str:
    value = label.lower()
    if group == "command":
        return "Button"
    if any(k in value for k in ("date", "일자", "기간")):
        return "DatePicker"
    if any(k in value for k in ("status", "상태", "유형", "구분")):
        return "Select"
    if any(k in value for k in ("content", "내용", "설명", "비고")):
        return "Textarea"
    return "TextField"


def geometry_for(bp: dict, section_count: int, pattern: str) -> dict:
    content_x = bp["sidebar"] + bp["margin"]
    content_y = bp["topbar"] + bp["margin"]
    content_w = bp["width"] - bp["sidebar"] - (bp["margin"] * 2)
    header_h = 104 if bp["width"] >= 768 else 120
    return {
        "viewport": {"x": 0, "y": 0, "width": bp["width"], "height": bp["height"]},
        "shell": {
            "topbar": {"x": 0, "y": 0, "width": bp["width"], "height": bp["topbar"]},
            "sidebar": {"x": 0, "y": bp["topbar"], "width": bp["sidebar"], "height": max(0, bp["height"] - bp["topbar"])},
            "content": {"x": content_x, "y": content_y, "width": content_w, "minHeight": max(0, bp["height"] - content_y - bp["margin"])},
        },
        "pageHeader": {"x": content_x, "y": content_y, "width": content_w, "height": header_h},
        "grid": {"columns": bp["columns"], "gap": bp["gap"], "placement": "css-grid", "normalFlow": True},
        "contentStartY": content_y + header_h + bp["gap"],
        "singleColumn": bp["width"] < 768 or pattern in {"AUTH", "FORM"},
        "sectionCount": section_count,
    }


def build_layout(contract: dict, duplicate_count: int) -> dict:
    pattern = route_pattern(contract.get("route_path") or "")
    declared_sections = normalized_items(contract.get("section_contract"), "Section")
    sections = (
        [{"id": slug(x["id"]), "label": x["label"], "height": 240, "provenance": "contract"} for x in declared_sections]
        or template_sections(pattern)
    )
    fields = normalized_items(contract.get("field_contract"), "Field")
    commands = normalized_items(contract.get("command_contract"), "Command")
    components = []
    for group, items in (("field", fields), ("command", commands)):
        for idx, item in enumerate(items, 1):
            components.append({
                "id": slug(item["id"]),
                "label": item["label"],
                "group": group,
                "component": component_type(item["label"], group),
                "provenance": item["provenance"],
                "required": bool(item["raw"].get("required")) if isinstance(item["raw"], dict) else False,
            })
    if not components:
        components = [
            {"id": "primary-content", "label": "주요 콘텐츠", "group": "content", "component": "ContentRegion", "provenance": "template-derived", "required": False},
            {"id": "primary-action", "label": "주요 작업", "group": "command", "component": "Button", "provenance": "template-derived", "required": False},
        ]

    responsive = {}
    desktop_sections = []
    for bp_name, bp in BREAKPOINTS.items():
        frame = geometry_for(bp, len(sections), pattern)
        y = frame["contentStartY"]
        current = []
        for idx, section in enumerate(sections):
            height = section["height"]
            if bp["width"] < 768 and height > 200:
                height = int(height * 1.2)
            rect = {"x": frame["shell"]["content"]["x"], "y": y, "width": frame["shell"]["content"]["width"], "height": height}
            current.append({
                "sectionId": section["id"],
                "rect": rect,
                "grid": {"columnStart": 1, "columnSpan": bp["columns"], "row": idx + 1},
                "layout": "grid" if section["id"] in {"search", "form", "summary"} else "flex-column",
            })
            y += height + bp["gap"]
        frame["sections"] = current
        frame["documentHeight"] = y + bp["margin"]
        responsive[bp_name] = frame
        if bp_name == "desktop":
            desktop_sections = current

    section_ids = [x["id"] for x in sections]
    for idx, component in enumerate(components):
        target = "form" if "form" in section_ids and component["group"] == "field" else (
            "actions" if "actions" in section_ids and component["group"] == "command" else section_ids[min(idx, len(section_ids) - 1)]
        )
        host = next(x for x in desktop_sections if x["sectionId"] == target)
        columns = 2 if component["group"] == "field" and pattern in {"FORM", "LIST"} else 1
        component["sectionId"] = target
        component["referenceRect"] = {
            "x": host["rect"]["x"] + 24 + ((idx % columns) * ((host["rect"]["width"] - 72) // columns)),
            "y": host["rect"]["y"] + 56 + ((idx // columns) * 72),
            "width": (host["rect"]["width"] - 72) // columns if columns > 1 else host["rect"]["width"] - 48,
            "height": 48,
        }
        component["css"] = {"display": "block", "width": "100%", "minWidth": 0, "position": "static"}

    states = normalized_items(contract.get("state_contract"), "State")
    state_names = [x["label"] for x in states] or ["LOADING", "EMPTY", "ERROR", "FORBIDDEN", "READY"]
    return {
        "schemaVersion": "2.0.0",
        "identity": {
            "contractId": contract.get("contract_id"),
            "route": contract.get("route_path"),
            "screenName": contract.get("screen_name"),
            "actorCode": contract.get("actor_code"),
            "processCode": contract.get("process_code"),
            "stepCode": contract.get("step_code"),
            "duplicateRouteContracts": duplicate_count,
        },
        "layoutPolicy": {
            "authoritative": "CSS Grid/Flex constraints and component order",
            "referenceOnly": "x/y/width/height at named reference viewports",
            "absolutePositioning": "FORBIDDEN for normal page flow",
            "spacingScalePx": [4, 8, 12, 16, 20, 24, 32, 40, 48],
            "focusOrder": "DOM order follows visual order",
        },
        "pattern": pattern,
        "sections": sections,
        "components": components,
        "responsive": responsive,
        "states": [{"name": name, "presentation": "content-region overlay", "preserveLayout": True} for name in state_names],
        "traceability": {
            "sectionSource": "section_contract" if declared_sections else "route-pattern template",
            "fieldSource": "field_contract" if fields else "route-pattern template",
            "commandSource": "command_contract" if commands else "route-pattern template",
            "generated": True,
            "requiresHumanReview": not bool(declared_sections and (fields or commands)),
        },
    }


def build_layout_catalog(contracts: list[dict]) -> dict:
    route_counts = Counter(x.get("route_path") for x in contracts)
    layouts = [build_layout(x, route_counts[x.get("route_path")]) for x in contracts]
    layouts.sort(key=lambda x: (x["identity"]["route"] or "", x["identity"]["contractId"] or 0))
    return {
        "schemaVersion": "2.0.0",
        "referenceViewports": BREAKPOINTS,
        "contractCount": len(layouts),
        "routeCount": len(route_counts),
        "contracts": layouts,
    }
