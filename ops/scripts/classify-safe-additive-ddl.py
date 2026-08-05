#!/usr/bin/env python3
"""Fail-closed classifier for migrations that cannot change existing data."""

from __future__ import annotations

import re
import sys
from pathlib import Path


def strip_comments(sql: str) -> str:
    sql = re.sub(r"/\*.*?\*/", " ", sql, flags=re.S)
    return re.sub(r"--[^\n]*", " ", sql)


def split_statements(sql: str) -> list[str]:
    statements: list[str] = []
    current: list[str] = []
    quote = ""
    index = 0
    while index < len(sql):
        char = sql[index]
        if quote:
            current.append(char)
            if char == quote:
                if index + 1 < len(sql) and sql[index + 1] == quote:
                    current.append(sql[index + 1])
                    index += 1
                else:
                    quote = ""
        elif char in {"'", '"'}:
            quote = char
            current.append(char)
        elif char == ";":
            statement = "".join(current).strip()
            if statement:
                statements.append(statement)
            current = []
        else:
            current.append(char)
        index += 1
    tail = "".join(current).strip()
    if tail:
        statements.append(tail)
    return statements


def normalized_name(value: str) -> str:
    return value.replace('"', "").lower()


def classify(paths: list[Path]) -> tuple[bool, str]:
    created_tables: set[str] = set()
    statements: list[tuple[Path, str]] = []
    for path in paths:
        if not path.is_file() or path.suffix.lower() != ".sql":
            return False, f"missing-or-non-sql:{path}"
        for statement in split_statements(strip_comments(path.read_text(encoding="utf-8"))):
            statements.append((path, re.sub(r"\s+", " ", statement).strip()))

    for path, statement in statements:
        match = re.match(
            r"(?is)^CREATE TABLE(?: IF NOT EXISTS)?\s+([A-Za-z0-9_\".]+)\s*\(",
            statement,
        )
        if match:
            created_tables.add(normalized_name(match.group(1)))
            continue
        if re.match(r"(?is)^(BEGIN|COMMIT)$", statement):
            continue
        if re.match(r"(?is)^COMMENT ON (TABLE|COLUMN|INDEX)\s+", statement):
            continue
        index_match = re.match(
            r"(?is)^CREATE(?: UNIQUE)? INDEX(?: IF NOT EXISTS)?\s+"
            r"[A-Za-z0-9_\".]+\s+ON\s+([A-Za-z0-9_\".]+)\s*",
            statement,
        )
        if index_match:
            table = normalized_name(index_match.group(1))
            if table in created_tables:
                continue
            return False, f"index-on-existing-table:{path}:{table}"
        insert_match = re.match(
            r"(?is)^INSERT\s+INTO\s+([A-Za-z0-9_\".]+)\s*\(",
            statement,
        )
        if insert_match:
            table = normalized_name(insert_match.group(1))
            if table in created_tables:
                continue
            return False, f"insert-on-existing-table:{path}:{table}"
        return False, f"unsafe-statement:{path}:{statement[:80]}"

    if not created_tables:
        return False, "no-new-table"
    return True, f"new-tables={len(created_tables)},statements={len(statements)}"


def main() -> int:
    paths = [Path(value) for value in sys.argv[1:]]
    safe, reason = classify(paths)
    print(("safe-additive " if safe else "full-backup ") + reason)
    return 0 if safe else 1


if __name__ == "__main__":
    raise SystemExit(main())
