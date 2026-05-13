#!/usr/bin/env python3
"""Small local docs RAG over KRDS and Resonance references.

This intentionally uses only Python stdlib + SQLite FTS5 so it can run on a
fresh WSL host without model or vector DB setup.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "data" / "ai-runtime" / "docs_ai.sqlite3"
DEFAULT_ROOTS = [
    ROOT / "data" / "design-references" / "krds",
    Path("/opt/reference/krds-uiux-main/README.md"),
    Path("/opt/reference/krds-uiux-main/tokens/transformed_tokens.json"),
    Path("/opt/reference/krds-uiux-main/tokens/figma_token.json"),
    Path("/opt/reference/krds-uiux-main/resources/scss/common/_root.scss"),
    Path("/opt/reference/krds-uiux-main/resources/scss/common/_variables_for_code.scss"),
    Path("/opt/reference/krds-uiux-main/resources/scss/component"),
    Path("/opt/reference/krds-uiux-main/html/code"),
]
TEXT_SUFFIXES = {".md", ".txt", ".html", ".css", ".scss", ".js", ".json", ".csv", ".yaml", ".yml"}
TOKEN_RE = re.compile(r"[0-9A-Za-z가-힣_./:-]+")


@dataclass(frozen=True)
class Chunk:
    source_path: str
    title: str
    chunk_index: int
    text: str
    metadata: str


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS chunks (
          id INTEGER PRIMARY KEY,
          source_path TEXT NOT NULL,
          title TEXT NOT NULL,
          chunk_index INTEGER NOT NULL,
          text TEXT NOT NULL,
          metadata TEXT NOT NULL
        );
        CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
          title,
          text,
          source_path UNINDEXED,
          content='chunks',
          content_rowid='id',
          tokenize='unicode61'
        );
        CREATE TABLE IF NOT EXISTS index_meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
        """
    )
    conn.commit()


def reset_db(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        DELETE FROM chunks_fts;
        DELETE FROM chunks;
        DELETE FROM index_meta;
        """
    )
    conn.commit()


def iter_files(roots: Iterable[Path]) -> Iterable[Path]:
    for root in roots:
        if not root.exists():
            continue
        if root.is_file():
            candidates = [root]
        else:
            candidates = sorted(p for p in root.rglob("*") if p.is_file())
        for path in candidates:
            name = path.name
            if name.endswith(":Zone.Identifier") or ":Zone.Identifier" in str(path):
                continue
            if path.suffix.lower() not in TEXT_SUFFIXES:
                continue
            yield path


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8-sig")
    except UnicodeDecodeError:
        return path.read_text(encoding="cp949", errors="ignore")


def title_for(path: Path, text: str) -> str:
    for line in text.splitlines()[:20]:
        stripped = line.strip()
        if stripped.startswith("#"):
            return stripped.lstrip("#").strip() or path.name
        if "<!--" in stripped and "-->" in stripped:
            return stripped.replace("<!--", "").replace("-->", "").strip() or path.name
    return path.stem


def chunk_plain(path: Path, text: str, size: int, overlap: int) -> list[Chunk]:
    title = title_for(path, text)
    normalized = re.sub(r"\n{3,}", "\n\n", text).strip()
    if not normalized:
        return []
    chunks: list[Chunk] = []
    start = 0
    index = 0
    while start < len(normalized):
        end = min(start + size, len(normalized))
        if end < len(normalized):
            boundary = max(normalized.rfind("\n\n", start, end), normalized.rfind("\n", start, end))
            if boundary > start + size // 2:
                end = boundary
        piece = normalized[start:end].strip()
        if piece:
            chunks.append(
                Chunk(
                    source_path=str(path),
                    title=title,
                    chunk_index=index,
                    text=piece,
                    metadata=json.dumps({"kind": path.suffix.lower().lstrip(".") or "text"}, ensure_ascii=False),
                )
            )
            index += 1
        if end >= len(normalized):
            break
        start = max(0, end - overlap)
    return chunks


def chunk_json(path: Path, text: str, size: int, overlap: int) -> list[Chunk]:
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return chunk_plain(path, text, size, overlap)
    chunks: list[Chunk] = []
    if isinstance(data, dict):
        for idx, (key, value) in enumerate(data.items()):
            body = json.dumps({key: value}, ensure_ascii=False, indent=2)
            if len(body) > size * 2:
                for sub in chunk_plain(path, body, size, overlap):
                    chunks.append(
                        Chunk(
                            source_path=sub.source_path,
                            title=f"{path.stem}:{key}",
                            chunk_index=len(chunks),
                            text=sub.text,
                            metadata=json.dumps({"kind": "json", "json_key": key}, ensure_ascii=False),
                        )
                    )
            else:
                chunks.append(
                    Chunk(
                        source_path=str(path),
                        title=f"{path.stem}:{key}",
                        chunk_index=idx,
                        text=body,
                        metadata=json.dumps({"kind": "json", "json_key": key}, ensure_ascii=False),
                    )
                )
    else:
        chunks = chunk_plain(path, json.dumps(data, ensure_ascii=False, indent=2), size, overlap)
    return chunks


def build_chunks(path: Path, size: int, overlap: int) -> list[Chunk]:
    text = read_text(path)
    if path.suffix.lower() == ".json":
        return chunk_json(path, text, size, overlap)
    if path.suffix.lower() == ".csv":
        try:
            rows = list(csv.reader(text.splitlines()))
            text = "\n".join(" | ".join(row) for row in rows)
        except csv.Error:
            pass
    return chunk_plain(path, text, size, overlap)


def insert_chunks(conn: sqlite3.Connection, chunks: Iterable[Chunk]) -> int:
    count = 0
    for chunk in chunks:
        cur = conn.execute(
            "INSERT INTO chunks(source_path, title, chunk_index, text, metadata) VALUES (?, ?, ?, ?, ?)",
            (chunk.source_path, chunk.title, chunk.chunk_index, chunk.text, chunk.metadata),
        )
        rowid = cur.lastrowid
        conn.execute(
            "INSERT INTO chunks_fts(rowid, title, text, source_path) VALUES (?, ?, ?, ?)",
            (rowid, chunk.title, chunk.text, chunk.source_path),
        )
        count += 1
    return count


def index_docs(args: argparse.Namespace) -> None:
    roots = [Path(p) for p in args.root] if args.root else DEFAULT_ROOTS
    conn = connect()
    init_db(conn)
    reset_db(conn)
    files = list(iter_files(roots))
    total_chunks = 0
    for path in files:
        chunks = build_chunks(path, args.chunk_size, args.overlap)
        total_chunks += insert_chunks(conn, chunks)
    conn.execute("INSERT INTO index_meta(key, value) VALUES ('root_count', ?)", (str(len(roots)),))
    conn.execute("INSERT INTO index_meta(key, value) VALUES ('file_count', ?)", (str(len(files)),))
    conn.execute("INSERT INTO index_meta(key, value) VALUES ('chunk_count', ?)", (str(total_chunks),))
    conn.commit()
    print(f"INDEXED files={len(files)} chunks={total_chunks} db={DB_PATH}")


def fts_query(question: str) -> str:
    terms = []
    for token in TOKEN_RE.findall(question):
        token = token.strip("_")
        if len(token) >= 2:
            terms.append(token.replace('"', ""))
    if not terms:
        return question
    return " OR ".join(dict.fromkeys(terms))


def search(question: str, limit: int) -> list[sqlite3.Row]:
    conn = connect()
    conn.row_factory = sqlite3.Row
    init_db(conn)
    query = fts_query(question)
    try:
        rows = conn.execute(
            """
            SELECT c.id, c.source_path, c.title, c.chunk_index, c.text, c.metadata,
                   bm25(chunks_fts, 8.0, 1.0) AS rank
            FROM chunks_fts
            JOIN chunks c ON c.id = chunks_fts.rowid
            WHERE chunks_fts MATCH ?
            ORDER BY rank
            LIMIT ?
            """,
            (query, limit),
        ).fetchall()
    except sqlite3.OperationalError:
        rows = []
    if rows:
        return rows
    return conn.execute(
        """
        SELECT id, source_path, title, chunk_index, text, metadata, 0.0 AS rank
        FROM chunks
        WHERE lower(text) LIKE lower(?)
        LIMIT ?
        """,
        (f"%{question}%", limit),
    ).fetchall()


def compact(text: str, width: int = 500) -> str:
    cleaned = re.sub(r"\s+", " ", text).strip()
    return cleaned if len(cleaned) <= width else cleaned[: width - 3] + "..."


def cmd_search(args: argparse.Namespace) -> None:
    rows = search(args.question, args.limit)
    for i, row in enumerate(rows, start=1):
        print(f"[{i}] score={float(row['rank']):.4f} {row['source_path']} :: {row['title']}#{row['chunk_index']}")
        print(compact(row["text"], args.snippet_chars))
        print()


def confidence(rows: list[sqlite3.Row]) -> str:
    if not rows:
        return "low"
    unique_sources = len({row["source_path"] for row in rows})
    return "high" if len(rows) >= 3 and unique_sources >= 2 else "medium"


def cmd_ask(args: argparse.Namespace) -> None:
    rows = search(args.question, args.limit)
    conf = confidence(rows)
    print(f"confidence: {conf}")
    print("answer:")
    if not rows:
        print("- 근거 문서를 찾지 못했습니다. 질문어나 인덱스 범위를 조정하세요.")
        return
    print("- Retrieved KRDS/Resonance evidence below. Use these sources before implementing or answering.")
    print("- For home screens, prefer KRDS header, main menu, masthead, footer, token, and component examples.")
    print("- For admin screens, prefer KRDS token-compatible tables, filters, tabs, side navigation, badges, modals, and forms.")
    print()
    print("sources:")
    for i, row in enumerate(rows, start=1):
        print(f"[{i}] {row['source_path']} :: {row['title']}#{row['chunk_index']}")
        print(f"    {compact(row['text'], args.snippet_chars)}")


def cmd_sources(_: argparse.Namespace) -> None:
    conn = connect()
    conn.row_factory = sqlite3.Row
    init_db(conn)
    rows = conn.execute(
        "SELECT source_path, COUNT(*) AS chunks FROM chunks GROUP BY source_path ORDER BY source_path"
    ).fetchall()
    for row in rows:
        print(f"{row['chunks']:4d} {row['source_path']}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Local SQLite FTS RAG for KRDS and Resonance docs.")
    sub = parser.add_subparsers(dest="command", required=True)

    p_index = sub.add_parser("index", help="Build or rebuild the local docs RAG index.")
    p_index.add_argument("--root", action="append", help="File or directory to index. May be repeated.")
    p_index.add_argument("--chunk-size", type=int, default=1800)
    p_index.add_argument("--overlap", type=int, default=180)
    p_index.set_defaults(func=index_docs)

    p_search = sub.add_parser("search", help="Search indexed docs.")
    p_search.add_argument("question")
    p_search.add_argument("--limit", type=int, default=5)
    p_search.add_argument("--snippet-chars", type=int, default=500)
    p_search.set_defaults(func=cmd_search)

    p_ask = sub.add_parser("ask", help="Return a source-grounded retrieval answer.")
    p_ask.add_argument("question")
    p_ask.add_argument("--limit", type=int, default=5)
    p_ask.add_argument("--snippet-chars", type=int, default=420)
    p_ask.set_defaults(func=cmd_ask)

    p_sources = sub.add_parser("sources", help="List indexed source files.")
    p_sources.set_defaults(func=cmd_sources)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
