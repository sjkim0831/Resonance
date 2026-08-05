#!/usr/bin/env python3
"""Create a timestamped PostgreSQL Flyway migration only after fail-closed validation."""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path


MIGRATION_DIR = Path("apps/carbonet-api/src/main/resources/db/migration/postgresql")
PROFILE = "-- resonance-deploy-profile: safe-additive-schema"


def slug(value: str) -> str:
    result = re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_")
    if not result:
        raise ValueError("migration name must contain an ASCII letter or digit")
    return result


def repository_root() -> Path:
    completed = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"], check=True, capture_output=True, text=True
    )
    return Path(completed.stdout.strip())


def next_version(target_dir: Path) -> str:
    base = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    value = int(base)
    existing = {path.name.split("__", 1)[0][1:] for path in target_dir.glob("V*__*.sql")}
    while str(value) in existing:
        value += 1
    return str(value)


def validate(root: Path, sql: str) -> str:
    classifier = root / "ops/scripts/classify-safe-additive-ddl.py"
    if not classifier.is_file():
        raise FileNotFoundError(classifier)
    with tempfile.NamedTemporaryFile("w", suffix=".sql", encoding="utf-8", delete=False) as handle:
        handle.write(sql)
        temporary = Path(handle.name)
    try:
        completed = subprocess.run(
            [sys.executable, str(classifier), str(temporary)], capture_output=True, text=True
        )
    finally:
        temporary.unlink(missing_ok=True)
    if completed.returncode != 0:
        reason = (completed.stdout or completed.stderr).strip()
        raise ValueError(f"unsafe migration rejected: {reason}")
    return completed.stdout.strip()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Register a validated additive migration in the canonical PostgreSQL Flyway path."
    )
    parser.add_argument("--name", required=True, help="descriptive migration name")
    parser.add_argument("--input", required=True, type=Path, help="SQL body to validate and register")
    parser.add_argument("--version", help="14 digit UTC Flyway version; normally generated automatically")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    root = repository_root()
    target_dir = root / MIGRATION_DIR
    target_dir.mkdir(parents=True, exist_ok=True)
    body = args.input.read_text(encoding="utf-8").strip() + "\n"
    classification = validate(root, body)
    version = args.version or next_version(target_dir)
    if not re.fullmatch(r"\d{14}", version):
        parser.error("--version must be exactly 14 digits (UTC YYYYMMDDhhmmss)")
    target = target_dir / f"V{version}__{slug(args.name)}.sql"
    if target.exists():
        parser.error(f"migration already exists: {target.relative_to(root)}")

    output = f"{PROFILE}\n-- generated-by: create-safe-additive-migration.py\n\n{body}"
    if not args.dry_run:
        target.write_text(output, encoding="utf-8")
    print(f"path={target.relative_to(root)}")
    print(f"classification={classification}")
    print("written=false" if args.dry_run else "written=true")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
