#!/usr/bin/env python3
"""Compile explicit approved design schema changes into validated Flyway migrations."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any


IDENTIFIER = re.compile(r"^[a-z][a-z0-9_]{0,62}$")
TYPE = re.compile(
    r"^(?:uuid|bigint|bigserial|integer|boolean|text|jsonb|date|timestamp|timestamptz|"
    r"varchar\([1-9][0-9]{0,4}\)|numeric\([1-9][0-9]?,[0-9]{1,2}\))$"
)
DEFAULT = re.compile(
    r"^(?:CURRENT_TIMESTAMP|CURRENT_DATE|gen_random_uuid\(\)|true|false|-?[0-9]+(?:\.[0-9]+)?|'[^']{0,200}')$",
    re.I,
)
ON_DELETE = {"CASCADE", "RESTRICT", "SET NULL", "NO ACTION"}


class ContractError(ValueError):
    pass


def identifier(value: Any, label: str) -> str:
    if not isinstance(value, str) or not IDENTIFIER.fullmatch(value):
        raise ContractError(f"{label} must match {IDENTIFIER.pattern}: {value!r}")
    return value


def sql_type(value: Any) -> str:
    if not isinstance(value, str) or not TYPE.fullmatch(value.lower()):
        raise ContractError(f"unsupported column type: {value!r}")
    return value.lower()


def render_column(column: dict[str, Any]) -> str:
    name = identifier(column.get("name"), "column name")
    parts = [name, sql_type(column.get("type"))]
    if column.get("primaryKey") is True:
        parts.append("PRIMARY KEY")
    if column.get("nullable") is False:
        parts.append("NOT NULL")
    if "default" in column:
        default = str(column["default"])
        if not DEFAULT.fullmatch(default):
            raise ContractError(f"unsupported default for {name}: {default!r}")
        parts.extend(["DEFAULT", default])
    reference = column.get("references")
    if reference is not None:
        if not isinstance(reference, dict):
            raise ContractError(f"references for {name} must be an object")
        table = identifier(reference.get("table"), "reference table")
        target = identifier(reference.get("column"), "reference column")
        parts.extend(["REFERENCES", f"{table}({target})"])
        on_delete = reference.get("onDelete")
        if on_delete is not None:
            normalized = str(on_delete).upper()
            if normalized not in ON_DELETE:
                raise ContractError(f"unsupported onDelete for {name}: {on_delete!r}")
            parts.extend(["ON DELETE", normalized])
    return " ".join(parts)


def render_change(change: dict[str, Any]) -> str:
    if change.get("operation") != "CREATE_TABLE":
        raise ContractError(f"only CREATE_TABLE is safe for automatic generation: {change.get('operation')!r}")
    table = identifier(change.get("tableName"), "table name")
    columns = change.get("columns")
    if not isinstance(columns, list) or not columns:
        raise ContractError(f"{table}: columns must be a non-empty array")
    names = [identifier(column.get("name"), "column name") for column in columns if isinstance(column, dict)]
    if len(names) != len(columns) or len(set(names)) != len(names):
        raise ContractError(f"{table}: column entries must be objects with unique names")
    definitions = ["  " + render_column(column) for column in columns]
    for unique in change.get("uniqueConstraints", []):
        if not isinstance(unique, list) or not unique:
            raise ContractError(f"{table}: unique constraint must be a non-empty column array")
        values = [identifier(value, "unique column") for value in unique]
        if not set(values).issubset(names):
            raise ContractError(f"{table}: unique constraint references an unknown column")
        definitions.append("  UNIQUE (" + ", ".join(values) + ")")
    statements = [f"CREATE TABLE {table} (\n" + ",\n".join(definitions) + "\n);"]
    for index in change.get("indexes", []):
        if not isinstance(index, dict):
            raise ContractError(f"{table}: index must be an object")
        index_name = identifier(index.get("name"), "index name")
        values = [identifier(value, "index column") for value in index.get("columns", [])]
        if not values or not set(values).issubset(names):
            raise ContractError(f"{table}: index {index_name} has unknown or empty columns")
        unique = "UNIQUE " if index.get("unique") is True else ""
        statements.append(f"CREATE {unique}INDEX {index_name} ON {table} (" + ", ".join(values) + ");")
    return "\n".join(statements)


def stable_hash(changes: list[dict[str, Any]]) -> str:
    body = json.dumps(changes, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(body.encode()).hexdigest()


def existing_hashes(root: Path) -> set[str]:
    result: set[str] = set()
    migration_dir = root / "apps/carbonet-api/src/main/resources/db/migration/postgresql"
    for path in migration_dir.glob("V*__*.sql"):
        match = re.search(r"^-- design-schema-hash: ([0-9a-f]{64})$", path.read_text(encoding="utf-8"), re.M)
        if match:
            result.add(match.group(1))
    return result


def existing_tables(root: Path) -> set[str]:
    result: set[str] = set()
    migration_dir = root / "apps/carbonet-api/src/main/resources/db/migration/postgresql"
    for path in migration_dir.glob("V*__*.sql"):
        sql = re.sub(r"/\*.*?\*/|--[^\n]*", " ", path.read_text(encoding="utf-8"), flags=re.S)
        result.update(
            match.lower()
            for match in re.findall(r"(?is)\bCREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-z][a-z0-9_]*)", sql)
        )
    return result


def name_part(value: Any) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", str(value).lower()).strip("_")
    if not normalized:
        raise ContractError(f"empty process/step code: {value!r}")
    return normalized[:80]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("packages", type=Path, help="generated package directory or one package JSON")
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--check", action="store_true", help="validate and report without writing migrations")
    args = parser.parse_args()
    paths = [args.packages] if args.packages.is_file() else sorted(args.packages.glob("*.json"))
    paths = [path for path in paths if path.name != "index.json"]
    known = existing_hashes(args.root)
    tables = existing_tables(args.root)
    generated = skipped = legacy = review = 0
    plans = []
    for path in paths:
        package = json.loads(path.read_text(encoding="utf-8"))
        database = package.get("database") or {}
        auto = database.get("autoGenerateMigration") is True
        changes = database.get("schemaChanges")
        if not auto:
            legacy += 1
            continue
        if not isinstance(changes, list) or not changes:
            review += 1
            plans.append({"package": path.name, "status": "REVIEW_REQUIRED", "reason": "schemaChanges is empty"})
            continue
        digest = stable_hash(changes)
        if digest in known:
            skipped += 1
            plans.append({"package": path.name, "status": "UNCHANGED", "hash": digest})
            continue
        requested_tables = {
            str(change.get("tableName", "")).lower()
            for change in changes if isinstance(change, dict) and change.get("operation") == "CREATE_TABLE"
        }
        conflicts = sorted(requested_tables & tables)
        if conflicts:
            review += 1
            plans.append({"package": path.name, "status": "REVIEW_REQUIRED",
                          "reason": "table already exists: " + ",".join(conflicts)})
            continue
        try:
            rendered = "\n\n".join(render_change(change) for change in changes)
        except ContractError as exc:
            review += 1
            plans.append({"package": path.name, "status": "REVIEW_REQUIRED", "reason": str(exc)})
            continue
        process = name_part(package["process"]["code"])
        step = name_part(package["step"]["code"])
        markers = "\n".join(
            f"COMMENT ON TABLE {identifier(table, 'table name')} IS 'design-schema-hash:{digest}';"
            for table in sorted(requested_tables)
        )
        body = (f"-- design-schema-hash: {digest}\n-- design-package: {path.name}\n\n"
                f"{rendered}\n\n{markers}\n")
        plans.append({"package": path.name, "status": "VALIDATED" if args.check else "GENERATED", "hash": digest})
        if not args.check:
            with tempfile.NamedTemporaryFile("w", suffix=".sql", encoding="utf-8", delete=False) as handle:
                handle.write(body)
                temporary = Path(handle.name)
            try:
                subprocess.run(
                    [sys.executable, str(args.root / "ops/scripts/create-safe-additive-migration.py"),
                     "--name", f"design {process} {step}", "--input", str(temporary)],
                    cwd=args.root, check=True, capture_output=True, text=True,
                )
            finally:
                temporary.unlink(missing_ok=True)
            known.add(digest)
            generated += 1
        tables.update(requested_tables)
    result = {"success": review == 0, "packages": len(paths), "generated": generated,
              "unchanged": skipped, "legacySkipped": legacy, "reviewRequired": review, "plans": plans}
    print(json.dumps(result, ensure_ascii=False, sort_keys=True, separators=(",", ":")))
    return 0 if review == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
