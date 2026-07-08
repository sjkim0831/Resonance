#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
HERMES_ROOT="${HERMES_ROOT:-/opt/util/ai/hermes}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/data/ai-runtime}"
DB_PATH="${DB_PATH:-$OUT_DIR/hermes-rag-vector.sqlite3}"
MANIFEST_PATH="${MANIFEST_PATH:-$OUT_DIR/hermes-combined-rag-manifest.json}"

mkdir -p "$OUT_DIR" "$ROOT_DIR/var/ai-runtime"

echo "[rag] syncing Resonance project knowledge"
if [ -x "$ROOT_DIR/ops/scripts/hermes-sync-project-knowledge.sh" ]; then
  if ! bash "$ROOT_DIR/ops/scripts/hermes-sync-project-knowledge.sh" --apply --project-id carbonet; then
    echo "[rag][warn] project knowledge DB sync failed; continuing local RAG index" >&2
  fi
fi

echo "[rag] refreshing docs_ai focused index"
if [ -f "$ROOT_DIR/docs_ai.py" ]; then
  python3 "$ROOT_DIR/docs_ai.py" index \
    --root "$ROOT_DIR/docs/ai" \
    --root "$ROOT_DIR/docs/agent" \
    --root "$ROOT_DIR/docs/operations" \
    --root "$ROOT_DIR/ops/scripts" \
    --root "$ROOT_DIR/projects/carbonet-frontend/source/src/features/emission-ecoinvent-admin" \
    --root "$ROOT_DIR/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/emission" \
    --root "$HERMES_ROOT/agent" \
    --root "$HERMES_ROOT/gateway" \
    --root "$HERMES_ROOT/tests/cli" \
    --root "$HERMES_ROOT/tests/gateway" \
    --root "$HERMES_ROOT/cli.py" \
    --root "$HERMES_ROOT/run_agent.py" \
    --chunk-size 2200 \
    --overlap 220 || echo "[rag][warn] docs_ai refresh failed; continuing combined index" >&2
fi

echo "[rag] building combined Hermes/Resonance vector RAG index"
python3 - "$ROOT_DIR" "$HERMES_ROOT" "$DB_PATH" "$MANIFEST_PATH" <<'PY'
from __future__ import annotations

import hashlib
import json
import math
import os
import re
import sqlite3
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

root = Path(sys.argv[1]).resolve()
hermes_root = Path(sys.argv[2]).resolve()
db_path = Path(sys.argv[3]).resolve()
manifest_path = Path(sys.argv[4]).resolve()

max_file_bytes = int(os.getenv("HERMES_RAG_MAX_FILE_BYTES", "524288"))
chunk_chars = int(os.getenv("HERMES_RAG_CHUNK_CHARS", "5200"))
chunk_overlap = int(os.getenv("HERMES_RAG_CHUNK_OVERLAP", "500"))

include_suffixes = {
    ".css", ".html", ".java", ".js", ".json", ".jsx", ".md", ".mjs", ".properties",
    ".py", ".sql", ".sh", ".toml", ".ts", ".tsx", ".txt", ".xml", ".yaml", ".yml",
}
include_names = {"AGENTS.md", "HERMES.md", ".hermes.md", "Dockerfile", "Makefile"}
skip_dir_names = {
    ".git", ".gradle", ".idea", ".mvn", ".mypy_cache", ".pytest_cache", ".ruff_cache",
    ".venv", ".vite", ".vscode", "__pycache__", "build", "coverage", "dist", "logs",
    "node_modules", "site-packages", "target", "tmp", "venv",
}
skip_suffixes = {".class", ".db", ".jar", ".log", ".png", ".pyc", ".sqlite", ".sqlite3", ".war", ".zip"}
token_re = re.compile(r"[0-9A-Za-z가-힣_./:-]+")


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def run_text(command: list[str], cwd: Path | None = None) -> str:
    try:
        return subprocess.run(
            command,
            cwd=str(cwd or root),
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=20,
            check=False,
        ).stdout.strip()
    except Exception:
        return ""


def should_skip(path: Path) -> bool:
    parts = set(path.parts)
    if parts & skip_dir_names:
        return True
    if path.suffix.lower() in skip_suffixes:
        return True
    if path.name.endswith(":Zone.Identifier"):
        return True
    as_posix = path.as_posix()
    if "/var/releases/" in as_posix or "/var/backups/" in as_posix:
        return True
    if "/data/ai-runtime/hermes-rag-vector" in as_posix:
        return True
    return False


def rel_to_base(path: Path, base: Path) -> str:
    try:
        return path.relative_to(base).as_posix()
    except ValueError:
        return path.as_posix()


def iter_files(base: Path):
    if not base.exists():
        return
    if base.is_file():
        candidates = [base]
    else:
        candidates = []
        for current, dirs, files in os.walk(base):
            current_path = Path(current)
            dirs[:] = [name for name in dirs if name not in skip_dir_names and not should_skip(current_path / name)]
            for name in files:
                candidates.append(current_path / name)
    for path in sorted(candidates):
        if should_skip(path):
            continue
        if path.name not in include_names and path.suffix.lower() not in include_suffixes:
            continue
        try:
            size = path.stat().st_size
        except OSError:
            continue
        if size <= 0 or size > max_file_bytes:
            continue
        yield path


def read_text(path: Path) -> str:
    for encoding in ("utf-8-sig", "utf-8", "cp949"):
        try:
            return path.read_text(encoding=encoding)
        except UnicodeDecodeError:
            continue
        except OSError:
            return ""
    return path.read_text(encoding="utf-8", errors="ignore")


def title_for(path: Path, text: str) -> str:
    for line in text.splitlines()[:80]:
        stripped = line.strip()
        if stripped.startswith("#"):
            return stripped.lstrip("#").strip()[:180] or path.name
        if stripped.startswith("class ") or stripped.startswith("def ") or stripped.startswith("export "):
            return stripped[:180]
    return path.stem[:180]


def classify(path: Path) -> str:
    suffix = path.suffix.lower()
    p = path.as_posix().lower()
    if suffix == ".md":
        return "doc"
    if suffix in {".ts", ".tsx", ".js", ".jsx", ".css", ".html"}:
        return "frontend"
    if suffix in {".java", ".xml", ".properties"}:
        return "backend"
    if suffix in {".py", ".sh", ".mjs"}:
        return "tooling"
    if suffix == ".sql":
        return "database"
    if "test" in p:
        return "test"
    return suffix.lstrip(".") or "text"


def chunk_text(text: str) -> list[str]:
    normalized = re.sub(r"\n{4,}", "\n\n\n", text).strip()
    if not normalized:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(normalized):
        end = min(start + chunk_chars, len(normalized))
        if end < len(normalized):
            boundary = max(normalized.rfind("\n\n", start, end), normalized.rfind("\n", start, end))
            if boundary > start + chunk_chars // 2:
                end = boundary
        piece = normalized[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= len(normalized):
            break
        start = max(0, end - chunk_overlap)
    return chunks


def tokenize(text: str) -> list[str]:
    values: list[str] = []
    for token in token_re.findall(text):
        token = token.strip("_").lower()
        if len(token) >= 2:
            values.append(token)
    return values


db_path.parent.mkdir(parents=True, exist_ok=True)
conn = sqlite3.connect(db_path)
conn.execute("PRAGMA journal_mode=WAL")
conn.executescript(
    """
    DROP TABLE IF EXISTS chunks_fts;
    DROP TABLE IF EXISTS document_vectors;
    DROP TABLE IF EXISTS chunks;
    DROP TABLE IF EXISTS documents;
    DROP TABLE IF EXISTS index_meta;

    CREATE TABLE documents (
      id INTEGER PRIMARY KEY,
      root TEXT NOT NULL,
      path TEXT NOT NULL,
      absolute_path TEXT NOT NULL,
      kind TEXT NOT NULL,
      size INTEGER NOT NULL,
      mtime REAL NOT NULL,
      sha1 TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL
    );

    CREATE TABLE chunks (
      id INTEGER PRIMARY KEY,
      document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      root TEXT NOT NULL,
      path TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      text TEXT NOT NULL
    );

    CREATE VIRTUAL TABLE chunks_fts USING fts5(
      title,
      text,
      path UNINDEXED,
      root UNINDEXED,
      content='chunks',
      content_rowid='id',
      tokenize='unicode61'
    );

    CREATE TABLE document_vectors (
      document_id INTEGER PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
      dimensions TEXT NOT NULL,
      norm REAL NOT NULL
    );

    CREATE TABLE index_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    """
)

roots = [("resonance", root), ("hermes", hermes_root)]
doc_term_counts: dict[int, Counter[str]] = {}
doc_freq: Counter[str] = Counter()
root_file_counts = defaultdict(int)
root_chunk_counts = defaultdict(int)
inserted_docs = 0
inserted_chunks = 0
skipped_missing = []

for root_name, base in roots:
    if not base.exists():
        skipped_missing.append(str(base))
        continue
    for path in iter_files(base):
        text = read_text(path)
        if not text.strip():
            continue
        data = text.encode("utf-8", errors="ignore")
        digest = hashlib.sha1(data).hexdigest()
        title = title_for(path, text)
        kind = classify(path)
        rel_path = rel_to_base(path, base)
        summary = re.sub(r"\s+", " ", "\n".join(line.strip() for line in text.splitlines() if line.strip())[:1200]).strip()
        stat = path.stat()
        cur = conn.execute(
            """
            INSERT INTO documents(root, path, absolute_path, kind, size, mtime, sha1, title, summary)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (root_name, rel_path, str(path), kind, stat.st_size, stat.st_mtime, digest, title, summary[:900]),
        )
        document_id = int(cur.lastrowid)
        counts = Counter(tokenize(title + "\n" + text))
        doc_term_counts[document_id] = counts
        doc_freq.update(counts.keys())
        inserted_docs += 1
        root_file_counts[root_name] += 1

        for chunk_index, chunk in enumerate(chunk_text(text)):
            chunk_cur = conn.execute(
                """
                INSERT INTO chunks(document_id, root, path, kind, title, chunk_index, text)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (document_id, root_name, rel_path, kind, title, chunk_index, chunk),
            )
            rowid = int(chunk_cur.lastrowid)
            conn.execute(
                "INSERT INTO chunks_fts(rowid, title, text, path, root) VALUES (?, ?, ?, ?, ?)",
                (rowid, title, chunk, rel_path, root_name),
            )
            inserted_chunks += 1
            root_chunk_counts[root_name] += 1

total_docs = max(1, inserted_docs)
for document_id, counts in doc_term_counts.items():
    weighted: dict[str, float] = {}
    for term, tf in counts.most_common(240):
        idf = math.log((1.0 + total_docs) / (1.0 + doc_freq[term])) + 1.0
        weighted[term] = round((1.0 + math.log(tf)) * idf, 6)
    norm = math.sqrt(sum(value * value for value in weighted.values()))
    conn.execute(
        "INSERT INTO document_vectors(document_id, dimensions, norm) VALUES (?, ?, ?)",
        (document_id, json.dumps(weighted, ensure_ascii=False, sort_keys=True), norm),
    )

meta = {
    "generatedAt": now_iso(),
    "dbPath": str(db_path),
    "manifestPath": str(manifest_path),
    "roots": [{"name": name, "path": str(path)} for name, path in roots],
    "documentCount": inserted_docs,
    "chunkCount": inserted_chunks,
    "rootFileCounts": dict(root_file_counts),
    "rootChunkCounts": dict(root_chunk_counts),
    "skippedMissingRoots": skipped_missing,
    "queryCommand": "python3 /opt/Resonance/ops/scripts/query-hermes-rag.py \"검색어\" --limit 8",
    "indexKind": "sqlite-fts5-with-sparse-document-vectors",
    "maxFileBytes": max_file_bytes,
    "chunkChars": chunk_chars,
    "chunkOverlap": chunk_overlap,
}
for key, value in meta.items():
    conn.execute(
        "INSERT INTO index_meta(key, value) VALUES (?, ?)",
        (key, json.dumps(value, ensure_ascii=False) if not isinstance(value, str) else value),
    )
conn.commit()

manifest_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

context_pack_path = root / "data" / "ai-runtime" / "hermes-rag-context-pack.json"
if context_pack_path.exists():
    try:
        pack = json.loads(context_pack_path.read_text(encoding="utf-8"))
        pack["generatedAt"] = meta["generatedAt"]
        pack.setdefault("ragIndexes", {})
        pack["ragIndexes"]["combinedHermesResonance"] = {
            "dbPath": meta["dbPath"],
            "manifestPath": meta["manifestPath"],
            "queryCommand": meta["queryCommand"],
            "indexKind": meta["indexKind"],
            "documentCount": meta["documentCount"],
            "chunkCount": meta["chunkCount"],
            "roots": meta["roots"],
        }
        objectives = pack.setdefault("activeObjectives", [])
        objectives = [item for item in objectives if item.get("id") != "hermes-codex55-grade-40b-rag"]
        objectives.insert(
            0,
            {
                "id": "hermes-codex55-grade-40b-rag",
                "zone": "operations-platform",
                "status": "combined-rag-vector-ready",
                "summary": "Use the combined Resonance plus Hermes sparse-vector RAG index before broad repository scans so 40B Hermes work stays accurate and within timeout budgets.",
                "readFirst": [
                    "data/ai-runtime/hermes-combined-rag-manifest.json",
                    "data/ai-runtime/hermes-rag-vector.sqlite3",
                    "ops/scripts/query-hermes-rag.py",
                    "ops/scripts/update-hermes-vector-rag.sh",
                    "data/ai-runtime/hermes-rag-context-pack.json",
                    "/opt/util/ai/hermes/.hermes.md",
                    "/opt/util/ai/hermes/cli.py",
                    "/opt/util/ai/hermes/agent/prompt_builder.py",
                    "docs/ai/hermes-carbonet-40b-qlora-rag.md",
                ],
            },
        )
        pack["activeObjectives"] = objectives
        moves = pack.setdefault("nextSafeMoves", [])
        for move in [
            "Before scanning more than a narrow file set, query the combined Hermes/Resonance RAG DB with ops/scripts/query-hermes-rag.py.",
            "On forced Hermes shutdown, resume from /opt/Resonance/var/ai-runtime/hermes-resume/latest.json or ~/.hermes/resume/latest.json.",
            "For 40B Hermes work, read data/ai-runtime/hermes-combined-rag-manifest.json and then pull only the top matching sources.",
        ]:
            if move not in moves:
                moves.insert(0, move)
        context_pack_path.write_text(json.dumps(pack, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except Exception as exc:
        print(f"[rag][warn] context pack update failed: {exc}", file=sys.stderr)

guidance = f"""# Hermes Local RAG Guidance

- Start substantial work by reading `{manifest_path}`.
- Query the combined Resonance/Hermes RAG index before broad scans:
  `python3 /opt/Resonance/ops/scripts/query-hermes-rag.py "question or keywords" --limit 8`
- The index DB is `{db_path}` and covers `/opt/Resonance` plus `/opt/util/ai/hermes` with generated code/build artifacts excluded.
- For long tasks, checkpoint progress in the session transcript and check forced-resume markers at `/opt/Resonance/var/ai-runtime/hermes-resume/latest.json` and `~/.hermes/resume/latest.json`.
- For frontend-only Carbonet changes, use `/opt/Resonance/ops/scripts/resonance-k8s-build-deploy-80.sh`; it auto-selects frontend-only deploy when only React/static frontend paths changed, or `FRONTEND_ONLY=true` can force that path.
- Keep model work source-grounded: cite retrieved file paths, inspect only the matching source files, run the smallest verification first, then widen only when evidence is insufficient.
"""
for target in (root / ".hermes.md", hermes_root / ".hermes.md"):
    try:
        target.write_text(guidance, encoding="utf-8")
    except Exception as exc:
        print(f"[rag][warn] failed to write {target}: {exc}", file=sys.stderr)

pointer = {
    "generatedAt": meta["generatedAt"],
    "manifestPath": meta["manifestPath"],
    "dbPath": meta["dbPath"],
    "queryCommand": meta["queryCommand"],
}
try:
    (hermes_root / ".hermes-rag.json").write_text(json.dumps(pointer, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
except Exception as exc:
    print(f"[rag][warn] failed to write Hermes RAG pointer: {exc}", file=sys.stderr)

print(json.dumps(meta, ensure_ascii=False, indent=2))
PY

echo "[rag] combined RAG manifest: $MANIFEST_PATH"
echo "[rag] combined RAG DB: $DB_PATH"

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
# shellcheck source=ops/scripts/build.sh
source "$ROOT_DIR/ops/scripts/build.sh" 2>/dev/null || true
init_build_tool
HERMES_ROOT="${HERMES_ROOT:-/opt/util/ai/hermes}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/data/ai-runtime}"
DB_PATH="${DB_PATH:-$OUT_DIR/hermes-rag-vector.sqlite3}"
MANIFEST_PATH="${MANIFEST_PATH:-$OUT_DIR/hermes-combined-rag-manifest.json}"

mkdir -p "$OUT_DIR" "$ROOT_DIR/var/ai-runtime"

echo "[rag] syncing Resonance project knowledge"
if [ -x "$ROOT_DIR/ops/scripts/hermes-sync-project-knowledge.sh" ]; then
  if ! bash "$ROOT_DIR/ops/scripts/hermes-sync-project-knowledge.sh" --apply --project-id carbonet; then
    echo "[rag][warn] project knowledge DB sync failed; continuing local RAG index" >&2
  fi
fi

echo "[rag] refreshing docs_ai focused index"
if [ -f "$ROOT_DIR/docs_ai.py" ]; then
  python3 "$ROOT_DIR/docs_ai.py" index \
    --root "$ROOT_DIR/docs/ai" \
    --root "$ROOT_DIR/docs/agent" \
    --root "$ROOT_DIR/docs/operations" \
    --root "$ROOT_DIR/ops/scripts" \
    --root "$ROOT_DIR/projects/carbonet-frontend/source/src/features/emission-ecoinvent-admin" \
    --root "$ROOT_DIR/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/emission" \
    --root "$HERMES_ROOT/agent" \
    --root "$HERMES_ROOT/gateway" \
    --root "$HERMES_ROOT/tests/cli" \
    --root "$HERMES_ROOT/tests/gateway" \
    --root "$HERMES_ROOT/cli.py" \
    --root "$HERMES_ROOT/run_agent.py" \
    --chunk-size 2200 \
    --overlap 220 || echo "[rag][warn] docs_ai refresh failed; continuing combined index" >&2
fi

echo "[rag] building combined Hermes/Resonance vector RAG index"
python3 - "$ROOT_DIR" "$HERMES_ROOT" "$DB_PATH" "$MANIFEST_PATH" <<'PY'
from __future__ import annotations

import hashlib
import json
import math
import os
import re
import sqlite3
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

root = Path(sys.argv[1]).resolve()
hermes_root = Path(sys.argv[2]).resolve()
db_path = Path(sys.argv[3]).resolve()
manifest_path = Path(sys.argv[4]).resolve()

max_file_bytes = int(os.getenv("HERMES_RAG_MAX_FILE_BYTES", "524288"))
chunk_chars = int(os.getenv("HERMES_RAG_CHUNK_CHARS", "5200"))
chunk_overlap = int(os.getenv("HERMES_RAG_CHUNK_OVERLAP", "500"))

include_suffixes = {
    ".css", ".html", ".java", ".js", ".json", ".jsx", ".md", ".mjs", ".properties",
    ".py", ".sql", ".sh", ".toml", ".ts", ".tsx", ".txt", ".xml", ".yaml", ".yml",
}
include_names = {"AGENTS.md", "HERMES.md", ".hermes.md", "Dockerfile", "Makefile"}
skip_dir_names = {
    ".git", ".gradle", ".idea", ".mvn", ".mypy_cache", ".pytest_cache", ".ruff_cache",
    ".venv", ".vite", ".vscode", "__pycache__", "build", "coverage", "dist", "logs",
    "node_modules", "site-packages", "target", "tmp", "venv",
}
skip_suffixes = {".class", ".db", ".jar", ".log", ".png", ".pyc", ".sqlite", ".sqlite3", ".war", ".zip"}
token_re = re.compile(r"[0-9A-Za-z가-힣_./:-]+")


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def run_text(command: list[str], cwd: Path | None = None) -> str:
    try:
        return subprocess.run(
            command,
            cwd=str(cwd or root),
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=20,
            check=False,
        ).stdout.strip()
    except Exception:
        return ""


def should_skip(path: Path) -> bool:
    parts = set(path.parts)
    if parts & skip_dir_names:
        return True
    if path.suffix.lower() in skip_suffixes:
        return True
    if path.name.endswith(":Zone.Identifier"):
        return True
    as_posix = path.as_posix()
    if "/var/releases/" in as_posix or "/var/backups/" in as_posix:
        return True
    if "/data/ai-runtime/hermes-rag-vector" in as_posix:
        return True
    return False


def rel_to_base(path: Path, base: Path) -> str:
    try:
        return path.relative_to(base).as_posix()
    except ValueError:
        return path.as_posix()


def iter_files(base: Path):
    if not base.exists():
        return
    if base.is_file():
        candidates = [base]
    else:
        candidates = []
        for current, dirs, files in os.walk(base):
            current_path = Path(current)
            dirs[:] = [name for name in dirs if name not in skip_dir_names and not should_skip(current_path / name)]
            for name in files:
                candidates.append(current_path / name)
    for path in sorted(candidates):
        if should_skip(path):
            continue
        if path.name not in include_names and path.suffix.lower() not in include_suffixes:
            continue
        try:
            size = path.stat().st_size
        except OSError:
            continue
        if size <= 0 or size > max_file_bytes:
            continue
        yield path


def read_text(path: Path) -> str:
    for encoding in ("utf-8-sig", "utf-8", "cp949"):
        try:
            return path.read_text(encoding=encoding)
        except UnicodeDecodeError:
            continue
        except OSError:
            return ""
    return path.read_text(encoding="utf-8", errors="ignore")


def title_for(path: Path, text: str) -> str:
    for line in text.splitlines()[:80]:
        stripped = line.strip()
        if stripped.startswith("#"):
            return stripped.lstrip("#").strip()[:180] or path.name
        if stripped.startswith("class ") or stripped.startswith("def ") or stripped.startswith("export "):
            return stripped[:180]
    return path.stem[:180]


def classify(path: Path) -> str:
    suffix = path.suffix.lower()
    p = path.as_posix().lower()
    if suffix == ".md":
        return "doc"
    if suffix in {".ts", ".tsx", ".js", ".jsx", ".css", ".html"}:
        return "frontend"
    if suffix in {".java", ".xml", ".properties"}:
        return "backend"
    if suffix in {".py", ".sh", ".mjs"}:
        return "tooling"
    if suffix == ".sql":
        return "database"
    if "test" in p:
        return "test"
    return suffix.lstrip(".") or "text"


def chunk_text(text: str) -> list[str]:
    normalized = re.sub(r"\n{4,}", "\n\n\n", text).strip()
    if not normalized:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(normalized):
        end = min(start + chunk_chars, len(normalized))
        if end < len(normalized):
            boundary = max(normalized.rfind("\n\n", start, end), normalized.rfind("\n", start, end))
            if boundary > start + chunk_chars // 2:
                end = boundary
        piece = normalized[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= len(normalized):
            break
        start = max(0, end - chunk_overlap)
    return chunks


def tokenize(text: str) -> list[str]:
    values: list[str] = []
    for token in token_re.findall(text):
        token = token.strip("_").lower()
        if len(token) >= 2:
            values.append(token)
    return values


db_path.parent.mkdir(parents=True, exist_ok=True)
conn = sqlite3.connect(db_path)
conn.execute("PRAGMA journal_mode=WAL")
conn.executescript(
    """
    DROP TABLE IF EXISTS chunks_fts;
    DROP TABLE IF EXISTS document_vectors;
    DROP TABLE IF EXISTS chunks;
    DROP TABLE IF EXISTS documents;
    DROP TABLE IF EXISTS index_meta;

    CREATE TABLE documents (
      id INTEGER PRIMARY KEY,
      root TEXT NOT NULL,
      path TEXT NOT NULL,
      absolute_path TEXT NOT NULL,
      kind TEXT NOT NULL,
      size INTEGER NOT NULL,
      mtime REAL NOT NULL,
      sha1 TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL
    );

    CREATE TABLE chunks (
      id INTEGER PRIMARY KEY,
      document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      root TEXT NOT NULL,
      path TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      text TEXT NOT NULL
    );

    CREATE VIRTUAL TABLE chunks_fts USING fts5(
      title,
      text,
      path UNINDEXED,
      root UNINDEXED,
      content='chunks',
      content_rowid='id',
      tokenize='unicode61'
    );

    CREATE TABLE document_vectors (
      document_id INTEGER PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
      dimensions TEXT NOT NULL,
      norm REAL NOT NULL
    );

    CREATE TABLE index_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    """
)

roots = [("resonance", root), ("hermes", hermes_root)]
doc_term_counts: dict[int, Counter[str]] = {}
doc_freq: Counter[str] = Counter()
root_file_counts = defaultdict(int)
root_chunk_counts = defaultdict(int)
inserted_docs = 0
inserted_chunks = 0
skipped_missing = []

for root_name, base in roots:
    if not base.exists():
        skipped_missing.append(str(base))
        continue
    for path in iter_files(base):
        text = read_text(path)
        if not text.strip():
            continue
        data = text.encode("utf-8", errors="ignore")
        digest = hashlib.sha1(data).hexdigest()
        title = title_for(path, text)
        kind = classify(path)
        rel_path = rel_to_base(path, base)
        summary = re.sub(r"\s+", " ", "\n".join(line.strip() for line in text.splitlines() if line.strip())[:1200]).strip()
        stat = path.stat()
        cur = conn.execute(
            """
            INSERT INTO documents(root, path, absolute_path, kind, size, mtime, sha1, title, summary)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (root_name, rel_path, str(path), kind, stat.st_size, stat.st_mtime, digest, title, summary[:900]),
        )
        document_id = int(cur.lastrowid)
        counts = Counter(tokenize(title + "\n" + text))
        doc_term_counts[document_id] = counts
        doc_freq.update(counts.keys())
        inserted_docs += 1
        root_file_counts[root_name] += 1

        for chunk_index, chunk in enumerate(chunk_text(text)):
            chunk_cur = conn.execute(
                """
                INSERT INTO chunks(document_id, root, path, kind, title, chunk_index, text)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (document_id, root_name, rel_path, kind, title, chunk_index, chunk),
            )
            rowid = int(chunk_cur.lastrowid)
            conn.execute(
                "INSERT INTO chunks_fts(rowid, title, text, path, root) VALUES (?, ?, ?, ?, ?)",
                (rowid, title, chunk, rel_path, root_name),
            )
            inserted_chunks += 1
            root_chunk_counts[root_name] += 1

total_docs = max(1, inserted_docs)
for document_id, counts in doc_term_counts.items():
    weighted: dict[str, float] = {}
    for term, tf in counts.most_common(240):
        idf = math.log((1.0 + total_docs) / (1.0 + doc_freq[term])) + 1.0
        weighted[term] = round((1.0 + math.log(tf)) * idf, 6)
    norm = math.sqrt(sum(value * value for value in weighted.values()))
    conn.execute(
        "INSERT INTO document_vectors(document_id, dimensions, norm) VALUES (?, ?, ?)",
        (document_id, json.dumps(weighted, ensure_ascii=False, sort_keys=True), norm),
    )

meta = {
    "generatedAt": now_iso(),
    "dbPath": str(db_path),
    "manifestPath": str(manifest_path),
    "roots": [{"name": name, "path": str(path)} for name, path in roots],
    "documentCount": inserted_docs,
    "chunkCount": inserted_chunks,
    "rootFileCounts": dict(root_file_counts),
    "rootChunkCounts": dict(root_chunk_counts),
    "skippedMissingRoots": skipped_missing,
    "queryCommand": "python3 /opt/Resonance/ops/scripts/query-hermes-rag.py \"검색어\" --limit 8",
    "indexKind": "sqlite-fts5-with-sparse-document-vectors",
    "maxFileBytes": max_file_bytes,
    "chunkChars": chunk_chars,
    "chunkOverlap": chunk_overlap,
}
for key, value in meta.items():
    conn.execute(
        "INSERT INTO index_meta(key, value) VALUES (?, ?)",
        (key, json.dumps(value, ensure_ascii=False) if not isinstance(value, str) else value),
    )
conn.commit()

manifest_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

context_pack_path = root / "data" / "ai-runtime" / "hermes-rag-context-pack.json"
if context_pack_path.exists():
    try:
        pack = json.loads(context_pack_path.read_text(encoding="utf-8"))
        pack["generatedAt"] = meta["generatedAt"]
        pack.setdefault("ragIndexes", {})
        pack["ragIndexes"]["combinedHermesResonance"] = {
            "dbPath": meta["dbPath"],
            "manifestPath": meta["manifestPath"],
            "queryCommand": meta["queryCommand"],
            "indexKind": meta["indexKind"],
            "documentCount": meta["documentCount"],
            "chunkCount": meta["chunkCount"],
            "roots": meta["roots"],
        }
        objectives = pack.setdefault("activeObjectives", [])
        objectives = [item for item in objectives if item.get("id") != "hermes-codex55-grade-40b-rag"]
        objectives.insert(
            0,
            {
                "id": "hermes-codex55-grade-40b-rag",
                "zone": "operations-platform",
                "status": "combined-rag-vector-ready",
                "summary": "Use the combined Resonance plus Hermes sparse-vector RAG index before broad repository scans so 40B Hermes work stays accurate and within timeout budgets.",
                "readFirst": [
                    "data/ai-runtime/hermes-combined-rag-manifest.json",
                    "data/ai-runtime/hermes-rag-vector.sqlite3",
                    "ops/scripts/query-hermes-rag.py",
                    "ops/scripts/update-hermes-vector-rag.sh",
                    "data/ai-runtime/hermes-rag-context-pack.json",
                    "/opt/util/ai/hermes/.hermes.md",
                    "/opt/util/ai/hermes/cli.py",
                    "/opt/util/ai/hermes/agent/prompt_builder.py",
                    "docs/ai/hermes-carbonet-40b-qlora-rag.md",
                ],
            },
        )
        pack["activeObjectives"] = objectives
        moves = pack.setdefault("nextSafeMoves", [])
        for move in [
            "Before scanning more than a narrow file set, query the combined Hermes/Resonance RAG DB with ops/scripts/query-hermes-rag.py.",
            "On forced Hermes shutdown, resume from /opt/Resonance/var/ai-runtime/hermes-resume/latest.json or ~/.hermes/resume/latest.json.",
            "For 40B Hermes work, read data/ai-runtime/hermes-combined-rag-manifest.json and then pull only the top matching sources.",
        ]:
            if move not in moves:
                moves.insert(0, move)
        context_pack_path.write_text(json.dumps(pack, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except Exception as exc:
        print(f"[rag][warn] context pack update failed: {exc}", file=sys.stderr)

guidance = f"""# Hermes Local RAG Guidance

- Start substantial work by reading `{manifest_path}`.
- Query the combined Resonance/Hermes RAG index before broad scans:
  `python3 /opt/Resonance/ops/scripts/query-hermes-rag.py "question or keywords" --limit 8`
- The index DB is `{db_path}` and covers `/opt/Resonance` plus `/opt/util/ai/hermes` with generated code/build artifacts excluded.
- For long tasks, checkpoint progress in the session transcript and check forced-resume markers at `/opt/Resonance/var/ai-runtime/hermes-resume/latest.json` and `~/.hermes/resume/latest.json`.
- For frontend-only Carbonet changes, use `/opt/Resonance/ops/scripts/resonance-k8s-build-deploy-80.sh`; it auto-selects frontend-only deploy when only React/static frontend paths changed, or `FRONTEND_ONLY=true` can force that path.
- Keep model work source-grounded: cite retrieved file paths, inspect only the matching source files, run the smallest verification first, then widen only when evidence is insufficient.
"""
for target in (root / ".hermes.md", hermes_root / ".hermes.md"):
    try:
        target.write_text(guidance, encoding="utf-8")
    except Exception as exc:
        print(f"[rag][warn] failed to write {target}: {exc}", file=sys.stderr)

pointer = {
    "generatedAt": meta["generatedAt"],
    "manifestPath": meta["manifestPath"],
    "dbPath": meta["dbPath"],
    "queryCommand": meta["queryCommand"],
}
try:
    (hermes_root / ".hermes-rag.json").write_text(json.dumps(pointer, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
except Exception as exc:
    print(f"[rag][warn] failed to write Hermes RAG pointer: {exc}", file=sys.stderr)

print(json.dumps(meta, ensure_ascii=False, indent=2))
PY

echo "[rag] combined RAG manifest: $MANIFEST_PATH"
echo "[rag] combined RAG DB: $DB_PATH"
