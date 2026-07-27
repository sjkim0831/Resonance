#!/usr/bin/env python3
"""Extract the governed 82-screen public/user legacy HTML catalog."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

INCLUDED_FAMILIES = (
    "0. Gnb메뉴",
    "1. 메인화면",
    "2. 회원인증",
    "4. 메뉴화면",
    "고객지원 메뉴",
)

PROCESS_RULES = (
    (("회원가입", "가입", "join"), ("MEMBER_REGISTRATION",)),
    (("로그인", "login", "로그아웃"), ("LOGIN_AUTHENTICATION",)),
    (("비밀번호", "아이디"), ("PASSWORD_RECOVERY",)),
    (("본인인증", "휴대폰 인증", "otp"), ("IDENTITY_VERIFICATION",)),
    (("마이페이지", "회원정보"), ("MEMBER_LIFECYCLE",)),
    (("검색",), ("CONTENT_OPERATION",)),
    (("인증서", "진위"), ("CERTIFICATE_VERIFICATION",)),
    (("문의", "고객지원", "faq", "공지"), ("CUSTOMER_INQUIRY",)),
    (("gnb", "메뉴"), ("MENU_SCREEN_GOVERNANCE",)),
    (("메인", "home"), ("CUSTOMER_WORK_COORDINATION",)),
)


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


class ContractParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title_parts: list[str] = []
        self.headings: list[dict[str, str]] = []
        self.links: list[dict[str, str]] = []
        self.forms: list[dict[str, object]] = []
        self.buttons: list[str] = []
        self.inputs: list[dict[str, str]] = []
        self.scripts: list[str] = []
        self.stylesheets: list[str] = []
        self._capture: str | None = None
        self._buffer: list[str] = []
        self._current_link: dict[str, str] | None = None
        self._current_form: dict[str, object] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = {k.lower(): v or "" for k, v in attrs}
        tag = tag.lower()
        if tag in {"title", "h1", "h2", "h3", "button"}:
            self._capture, self._buffer = tag, []
        if tag == "a":
            self._capture, self._buffer = "a", []
            self._current_link = {"href": data.get("href", "")}
        elif tag == "form":
            self._current_form = {
                "action": data.get("action", ""),
                "method": data.get("method", "get").upper(),
                "fields": [],
            }
        elif tag in {"input", "select", "textarea"}:
            field = {
                "tag": tag,
                "name": data.get("name", ""),
                "type": data.get("type", tag),
                "required": "required" if "required" in data else "",
            }
            self.inputs.append(field)
            if self._current_form is not None:
                self._current_form["fields"].append(field)
        elif tag == "script" and data.get("src"):
            self.scripts.append(data["src"])
        elif tag == "link" and "stylesheet" in data.get("rel", "").lower():
            self.stylesheets.append(data.get("href", ""))

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag == "form" and self._current_form is not None:
            self.forms.append(self._current_form)
            self._current_form = None
        if self._capture == tag:
            text = clean("".join(self._buffer))
            if tag == "title":
                self.title_parts.append(text)
            elif tag in {"h1", "h2", "h3"} and text:
                self.headings.append({"level": tag, "text": text})
            elif tag == "button" and text:
                self.buttons.append(text)
            self._capture, self._buffer = None, []
        elif tag == "a" and self._capture == "a":
            text = clean("".join(self._buffer))
            if self._current_link is not None:
                self._current_link["text"] = text
                self.links.append(self._current_link)
            self._current_link = None
            self._capture, self._buffer = None, []

    def handle_data(self, data: str) -> None:
        if self._capture:
            self._buffer.append(data)


def uniq(items):
    seen = set()
    output = []
    for item in items:
        marker = json.dumps(item, ensure_ascii=False, sort_keys=True)
        if marker not in seen:
            seen.add(marker)
            output.append(item)
    return output


def route_candidates(links: list[dict[str, str]]) -> list[str]:
    routes = []
    for link in links:
        href = clean(link.get("href", ""))
        if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
            continue
        parsed = urlsplit(href)
        if parsed.scheme and parsed.scheme not in {"http", "https"}:
            continue
        path = parsed.path
        if path.startswith("/") and not path.startswith("/admin/"):
            routes.append(path)
    return uniq(routes)


def process_hints(
    name: str, headings: list[dict[str, str]], source_relative_path: str
) -> list[str]:
    corpus = (
        name
        + " "
        + source_relative_path
        + " "
        + " ".join(h["text"] for h in headings)
    ).lower()
    hints: list[str] = []
    for needles, codes in PROCESS_RULES:
        if any(needle.lower() in corpus for needle in needles):
            hints.extend(codes)
    return uniq(hints) or ["CUSTOMER_WORK_COORDINATION"]


def classify_audience(name: str) -> str:
    public_tokens = ("메인", "로그인", "회원가입", "찾기", "검색", "고객지원", "인증")
    return "PUBLIC" if any(token in name for token in public_tokens) else "USER"


def extract(path: Path, root: Path) -> dict[str, object]:
    raw = path.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    text = raw.decode("utf-8", errors="replace")
    parser = ContractParser()
    parser.feed(text)
    rel = path.relative_to(root)
    family = rel.parts[0]
    folder_name = path.parent.name if path.name.lower() == "code.html" else path.stem
    title = next((x for x in parser.title_parts if x), folder_name)
    name = clean(title) or clean(folder_name)
    lang = "en" if re.search(r"(^|[-_ ])en($|[-_ ])", str(rel), re.I) else "ko"
    responsive = bool(
        re.search(r'name=["\']viewport["\']', text, re.I)
        or re.search(r"@media\s*\(", text, re.I)
    )
    contract = {
        "sourceRelativePath": str(rel).replace(os.sep, "/"),
        "documentTitle": name,
        "sections": uniq(parser.headings),
        "links": uniq(parser.links),
        "routeCandidates": route_candidates(parser.links),
        "forms": parser.forms,
        "fields": uniq(parser.inputs),
        "buttons": uniq(parser.buttons),
        "scripts": uniq(parser.scripts),
        "stylesheets": uniq(parser.stylesheets),
        "responsiveEvidence": {
            "viewportOrMediaQuery": responsive,
            "mobileReference": "모바일" in str(rel),
        },
        "backendRequired": False,
        "activationPolicy": "REVIEW_BEFORE_ADOPTION",
    }
    return {
        "referenceId": "LEGACY-" + digest[:20].upper(),
        "sourcePath": str(path),
        "sourceFamily": family,
        "screenName": name[:300],
        "languageCode": lang,
        "audience": classify_audience(name),
        "assetKind": "HTML_FRONTEND",
        "reuseDecision": "REVIEW_REQUIRED",
        "contentHash": digest,
        "contract": contract,
        "processHints": process_hints(name, parser.headings, str(rel)),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default="/opt/reference/screen")
    parser.add_argument("--output", required=True)
    parser.add_argument("--expected-count", type=int, default=82)
    args = parser.parse_args()

    root = Path(args.root)
    paths = sorted(
        path
        for family in INCLUDED_FAMILIES
        for path in (root / family).rglob("*")
        if path.is_file() and path.suffix.lower() in {".html", ".htm"}
    )
    if len(paths) != args.expected_count:
        raise SystemExit(
            f"legacy public frontend count drift: expected={args.expected_count} actual={len(paths)}"
        )

    records = [extract(path, root) for path in paths]
    ids = [row["referenceId"] for row in records]
    sources = [row["sourcePath"] for row in records]
    if len(ids) != len(set(ids)) or len(sources) != len(set(sources)):
        raise SystemExit("duplicate legacy reference id or source path")

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(records, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "status": "READY",
                "count": len(records),
                "families": {
                    family: sum(1 for row in records if row["sourceFamily"] == family)
                    for family in INCLUDED_FAMILIES
                },
                "output": str(output),
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
