#!/usr/bin/env python3
"""Query the combined Hermes/Resonance local RAG index."""

from __future__ import annotations

import argparse
import re
import sqlite3
from pathlib import Path


DEFAULT_DB = Path("/opt/Resonance/data/ai-runtime/hermes-rag-vector.sqlite3")
TOKEN_RE = re.compile(r"[0-9A-Za-z가-힣_]+")


def fts_query(question: str) -> str:
    terms: list[str] = []
    for token in TOKEN_RE.findall(question):
        token = token.strip("_").lower()
        if len(token) >= 2:
            terms.append(token)
    if not terms:
        return ""
    return " OR ".join(dict.fromkeys(terms))


def compact(value: str, width: int) -> str:
    text = re.sub(r"\s+", " ", value or "").strip()
    return text if len(text) <= width else text[: width - 3] + "..."


def search(db_path: Path, question: str, limit: int, snippet_chars: int) -> list[sqlite3.Row]:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    query = fts_query(question)
    if query:
        try:
            rows = conn.execute(
                """
                SELECT c.root, c.path, c.kind, c.title, c.chunk_index, c.text,
                       bm25(chunks_fts, 6.0, 1.0, 1.0) AS rank
                FROM chunks_fts
                JOIN chunks c ON c.id = chunks_fts.rowid
                WHERE chunks_fts MATCH ?
                ORDER BY rank
                LIMIT ?
                """,
                (query, limit),
            ).fetchall()
            if rows:
                return rows
        except sqlite3.OperationalError:
            pass
    return conn.execute(
        """
        SELECT root, path, kind, title, chunk_index, text, 0.0 AS rank
        FROM chunks
        WHERE lower(text) LIKE lower(?)
           OR lower(path) LIKE lower(?)
           OR lower(title) LIKE lower(?)
        LIMIT ?
        """,
        (f"%{question}%", f"%{question}%", f"%{question}%", limit),
    ).fetchall()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("question", help="Search question or keywords.")
    parser.add_argument("--db", default=str(DEFAULT_DB), help="RAG DB path.")
    parser.add_argument("--limit", type=int, default=8)
    parser.add_argument("--snippet-chars", type=int, default=520)
    args = parser.parse_args()

    db_path = Path(args.db)
    if not db_path.exists():
        raise SystemExit(f"RAG DB not found: {db_path}")

    rows = search(db_path, args.question, args.limit, args.snippet_chars)
    if not rows:
        print("NO_MATCH")
        return

    for index, row in enumerate(rows, start=1):
        print(
            f"[{index}] score={float(row['rank']):.4f} "
            f"{row['root']}:{row['path']} :: {row['title']}#{row['chunk_index']} ({row['kind']})"
        )
        print(compact(row["text"], args.snippet_chars))
        print()


if __name__ == "__main__":
    main()
