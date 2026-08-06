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
    dollar_quote = ""
    index = 0
    while index < len(sql):
        char = sql[index]
        if dollar_quote:
            if sql.startswith(dollar_quote, index):
                current.extend(dollar_quote)
                index += len(dollar_quote) - 1
                dollar_quote = ""
            else:
                current.append(char)
        elif quote:
            current.append(char)
            if char == quote:
                if index + 1 < len(sql) and sql[index + 1] == quote:
                    current.append(sql[index + 1])
                    index += 1
                else:
                    quote = ""
        elif char == "$":
            match = re.match(r"\$[A-Za-z0-9_]*\$", sql[index:])
            if match:
                dollar_quote = match.group(0)
                current.extend(dollar_quote)
                index += len(dollar_quote) - 1
            else:
                current.append(char)
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


def classify(paths: list[Path], schema_reversible: bool = False) -> tuple[bool, str]:
    created_tables: set[str] = set()
    created_functions: set[str] = set()
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
        function_match = re.match(
            r"(?is)^CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+([A-Za-z0-9_\".]+)\s*\(",
            statement,
        )
        if function_match:
            if function_match.group(1) and not schema_reversible:
                return False, f"replace-function:{path}:{normalized_name(function_match.group(2))}"
            function_name = normalized_name(function_match.group(2))
            if re.search(r"(?is)\bEXECUTE\s+(FORMAT\s*\(|[^F])", statement):
                return False, f"dynamic-sql-in-function:{path}:{function_name}"
            if re.search(r"(?is)\b(DROP|ALTER)\s+(TABLE|SCHEMA|DATABASE|FUNCTION|TRIGGER)\b", statement):
                return False, f"ddl-in-function:{path}:{function_name}"
            write_targets = {
                normalized_name(value)
                for value in re.findall(
                    r"(?is)\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE(?:\s+TABLE)?)\s+([A-Za-z0-9_\".]+)",
                    statement,
                )
            }
            foreign_targets = sorted(write_targets - created_tables)
            if foreign_targets:
                return False, f"function-writes-existing-table:{path}:{function_name}:{','.join(foreign_targets)}"
            created_functions.add(function_name)
            continue
        if schema_reversible and re.match(r"(?is)^DO\s+\$[A-Za-z0-9_]*\$", statement):
            if re.search(r"(?is)\bEXECUTE\s+(FORMAT\s*\(|[^F])", statement):
                return False, f"dynamic-sql-in-do-block:{path}"
            if re.search(r"(?is)\b(DROP|ALTER|CREATE|TRUNCATE)\s+(TABLE|SCHEMA|DATABASE|FUNCTION|TRIGGER)\b", statement):
                return False, f"ddl-in-do-block:{path}"
            if re.search(r"(?is)\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE(?:\s+TABLE)?)\s+", statement):
                return False, f"write-in-do-block:{path}"
            continue
        drop_trigger_match = re.match(
            r"(?is)^DROP\s+TRIGGER\s+IF\s+EXISTS\s+[A-Za-z0-9_\".]+\s+ON\s+([A-Za-z0-9_\".]+)$",
            statement,
        )
        if drop_trigger_match:
            table = normalized_name(drop_trigger_match.group(1))
            if table in created_tables:
                continue
            return False, f"drop-trigger-on-existing-table:{path}:{table}"
        trigger_match = re.match(
            r"(?is)^CREATE\s+TRIGGER\s+[A-Za-z0-9_\".]+\s+.*?\s+ON\s+([A-Za-z0-9_\".]+)\s+.*?EXECUTE\s+FUNCTION\s+([A-Za-z0-9_\".]+)\s*\(",
            statement,
        )
        if trigger_match:
            table = normalized_name(trigger_match.group(1))
            function = normalized_name(trigger_match.group(2))
            if table in created_tables and function in created_functions:
                continue
            return False, f"trigger-outside-new-schema:{path}:{table}:{function}"
        return False, f"unsafe-statement:{path}:{statement[:80]}"

    if not created_tables and not (schema_reversible and created_functions):
        return False, "no-new-table-or-reversible-function"
    return True, f"new-tables={len(created_tables)},new-functions={len(created_functions)},statements={len(statements)}"


def main() -> int:
    args = sys.argv[1:]
    schema_reversible = "--schema-reversible" in args
    paths = [Path(value) for value in args if value != "--schema-reversible"]
    safe, reason = classify(paths, schema_reversible=schema_reversible)
    print(("safe-additive " if safe else "full-backup ") + reason)
    return 0 if safe else 1


if __name__ == "__main__":
    raise SystemExit(main())
