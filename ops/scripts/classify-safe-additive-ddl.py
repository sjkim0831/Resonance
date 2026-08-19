#!/usr/bin/env python3
"""Fail-closed classifier for migrations that cannot change existing data."""

from __future__ import annotations

import hashlib
import re
import sys
from pathlib import Path


# These three migrations form one audited, ordered release.  Their top-level
# statements are limited to precondition checks, schema DDL, ACL changes and
# comments.  DML text occurs only inside function bodies that the migrations do
# not invoke.  A byte-level pin keeps this narrow exception fail-closed: a
# changed, missing, duplicated or mixed migration set falls back to a full
# backup instead of widening the general SQL grammar.
PINNED_SCHEMA_REVERSIBLE_BUNDLE = {
    "V20260813093000__compile_canonical_screen_design_release.sql":
        "c543f1f9d74d833034294b82aa0a6e30e3a1291b4a55a6687a45764622495176",
    "V20260813113000__compile_canonical_endpoint_contract_catalog.sql":
        "64db39d8fe72daddd8e502d12acd84e731e2506cf768f524ccc90f70c383a041",
    "V20260813150000__stage_validate_publish_legacy_endpoint_upgrade.sql":
        "72f25f4dd61e6b32a48b249a7b98da31f8e99a575f8041511ffbc1d340f4e267",
}


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


def classify_pinned_schema_reversible_bundle(
    paths: list[Path], schema_reversible: bool
) -> tuple[bool, str] | None:
    if not schema_reversible:
        return None

    names = [path.name for path in paths]
    expected_names = set(PINNED_SCHEMA_REVERSIBLE_BUNDLE)
    if not expected_names.intersection(names):
        return None
    if len(names) != len(expected_names) or set(names) != expected_names:
        return False, (
            "pinned-bundle-incomplete-or-mixed:"
            f"expected={len(expected_names)},actual={len(names)}"
        )

    mismatches = []
    for path in paths:
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        if actual != PINNED_SCHEMA_REVERSIBLE_BUNDLE[path.name]:
            mismatches.append(path.name)
    if mismatches:
        return False, "pinned-bundle-hash-mismatch:" + ",".join(sorted(mismatches))

    return True, (
        "pinned-schema-reversible-bundle="
        + ",".join(sorted(expected_names))
        + f",files={len(paths)}"
    )


def classify(
    paths: list[Path], schema_reversible: bool = False, flyway_forward_only: bool = False
) -> tuple[bool, str]:
    created_tables: set[str] = set()
    created_functions: set[str] = set()
    statements: list[tuple[Path, str]] = []
    for path in paths:
        if not path.is_file() or path.suffix.lower() != ".sql":
            return False, f"missing-or-non-sql:{path}"

    pinned_result = classify_pinned_schema_reversible_bundle(
        paths, schema_reversible=schema_reversible
    )
    if pinned_result is not None:
        return pinned_result

    for path in paths:
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
            if table in created_tables or flyway_forward_only:
                continue
            return False, f"index-on-existing-table:{path}:{table}"
        insert_match = re.match(
            r"(?is)^INSERT\s+INTO\s+([A-Za-z0-9_\".]+)\s*\(",
            statement,
        )
        if insert_match:
            table = normalized_name(insert_match.group(1))
            if table in created_tables or (
                flyway_forward_only and re.search(r"(?is)\bON\s+CONFLICT\b", statement)
            ):
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
        if (schema_reversible or flyway_forward_only) and re.match(r"(?is)^DO\s+\$[A-Za-z0-9_]*\$", statement):
            if flyway_forward_only:
                if re.search(r"(?is)\b(?:UPDATE|DELETE\s+FROM|TRUNCATE(?:\s+TABLE)?|DROP|ALTER)\b", statement):
                    return False, f"destructive-write-in-do-block:{path}"
                continue
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
    mode = "flyway-forward-only" if flyway_forward_only else "safe-additive"
    return True, f"mode={mode},new-tables={len(created_tables)},new-functions={len(created_functions)},statements={len(statements)}"


def main() -> int:
    args = sys.argv[1:]
    schema_reversible = "--schema-reversible" in args
    flyway_forward_only = "--flyway-forward-only" in args
    paths = [Path(value) for value in args if value not in {"--schema-reversible", "--flyway-forward-only"}]
    safe, reason = classify(
        paths,
        schema_reversible=schema_reversible,
        flyway_forward_only=flyway_forward_only,
    )
    print(("safe-additive " if safe else "full-backup ") + reason)
    return 0 if safe else 1


if __name__ == "__main__":
    raise SystemExit(main())
