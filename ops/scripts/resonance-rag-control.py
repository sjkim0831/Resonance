#!/usr/bin/env python3
"""Manage the Resonance RAG vector store and fine-tuning datasets."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path("/opt/Resonance")
DEFAULT_POLICY = ROOT / "var/ai-rag-control/rag-finetune-policy.json"
TOKEN_RE = re.compile(r"[0-9A-Za-z가-힣_./:-]+")
SKIP_DIRS = {
    ".git",
    ".gradle",
    ".mvn",
    "__pycache__",
    "build",
    "dist",
    "logs",
    "node_modules",
    "target",
    "venv",
}
INCLUDE_SUFFIXES = {
    ".css",
    ".html",
    ".java",
    ".js",
    ".json",
    ".jsx",
    ".md",
    ".py",
    ".sh",
    ".sql",
    ".ts",
    ".tsx",
    ".xml",
    ".yaml",
    ".yml",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def slug(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "-", str(value)).strip("-")[:120] or "model"


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def load_policy(path: Path) -> dict:
    if not path.exists():
        raise SystemExit(f"policy not found: {path}")
    return read_json(path)


def read_text(path: Path) -> str:
    for encoding in ("utf-8-sig", "utf-8", "cp949"):
        try:
            return path.read_text(encoding=encoding)
        except UnicodeDecodeError:
            continue
        except OSError:
            return ""
    return path.read_text(encoding="utf-8", errors="ignore")


def chunk_text(text: str, chunk_chars: int = 2200, overlap: int = 220) -> list[str]:
    text = re.sub(r"\n{4,}", "\n\n\n", text).strip()
    if not text:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(len(text), start + chunk_chars)
        if end < len(text):
            boundary = max(text.rfind("\n\n", start, end), text.rfind("\n", start, end))
            if boundary > start + chunk_chars // 2:
                end = boundary
        piece = text[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= len(text):
            break
        start = max(0, end - overlap)
    return chunks


def should_skip(path: Path) -> bool:
    if any(part in SKIP_DIRS for part in path.parts):
        return True
    value = path.as_posix()
    return "/var/releases/" in value or "/var/backups/" in value


def iter_source_files(policy: dict):
    roots = [
        ROOT / "docs/ai",
        ROOT / "docs/agent",
        ROOT / "docs/operations",
        ROOT / "ops/scripts",
        ROOT / "data/ai-runtime",
        ROOT / "projects/carbonet-frontend/source/src",
        ROOT / "modules/resonance-common",
        Path("/opt/util/ai/hermes/agent"),
        Path("/opt/util/ai/hermes/gateway"),
    ]
    for raw in policy.get("trainingData", {}).get("sources", []):
        path = Path(raw)
        if path.exists():
            roots.append(path)
    seen: set[Path] = set()
    for root in roots:
        if not root.exists():
            continue
        if root.is_file():
            candidates = [root]
        else:
            candidates = []
            for current, dirs, files in os.walk(root):
                current_path = Path(current)
                dirs[:] = [name for name in dirs if name not in SKIP_DIRS and not should_skip(current_path / name)]
                candidates.extend(current_path / name for name in files)
        for path in candidates:
            if path in seen or should_skip(path):
                continue
            seen.add(path)
            if path.suffix.lower() not in INCLUDE_SUFFIXES and path.name not in {"AGENTS.md", "HERMES.md", "Dockerfile"}:
                continue
            try:
                if path.stat().st_size <= 0 or path.stat().st_size > 524288:
                    continue
            except OSError:
                continue
            yield path


def load_sentence_model(model_name: str):
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(model_name)


def build_index(policy: dict) -> dict:
    import chromadb

    vector = policy["vectorDb"]
    persist_dir = Path(vector["persistDir"])
    persist_dir.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(path=str(persist_dir))
    collection = client.get_or_create_collection(vector.get("collection", "resonance_model_work"))
    model = load_sentence_model(vector.get("embeddingModel", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"))

    ids: list[str] = []
    docs: list[str] = []
    metas: list[dict] = []
    file_count = 0
    chunk_count = 0
    for path in iter_source_files(policy):
        text = read_text(path)
        chunks = chunk_text(text)
        if not chunks:
            continue
        file_count += 1
        for index, chunk in enumerate(chunks):
            rel = path.as_posix()
            digest = hashlib.sha1(f"{rel}:{index}:{chunk[:240]}".encode("utf-8")).hexdigest()
            ids.append(digest)
            docs.append(chunk)
            metas.append({"path": rel, "chunk": index, "source": "resonance-rag-control"})
            if len(ids) >= 64:
                embeddings = model.encode(docs, normalize_embeddings=True).tolist()
                collection.upsert(ids=ids, documents=docs, metadatas=metas, embeddings=embeddings)
                chunk_count += len(ids)
                ids, docs, metas = [], [], []
    if ids:
        embeddings = model.encode(docs, normalize_embeddings=True).tolist()
        collection.upsert(ids=ids, documents=docs, metadatas=metas, embeddings=embeddings)
        chunk_count += len(ids)
    manifest = {
        "generatedAt": now_iso(),
        "engine": "chroma",
        "persistDir": str(persist_dir),
        "collection": vector.get("collection", "resonance_model_work"),
        "embeddingModel": vector.get("embeddingModel"),
        "fileCount": file_count,
        "chunkCount": chunk_count,
    }
    manifest_path = Path(policy.get("policyPath", DEFAULT_POLICY)).parent / "chroma-manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest


def sqlite_query(policy: dict, question: str, limit: int) -> list[dict]:
    db_path = Path(policy.get("sqliteRag", {}).get("dbPath", ""))
    if not db_path.exists():
        return []
    query = " OR ".join(dict.fromkeys(token.lower() for token in TOKEN_RE.findall(question) if len(token) >= 2))
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
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
            return [dict(row) for row in rows]
        except sqlite3.OperationalError:
            pass
    rows = conn.execute(
        "SELECT root, path, kind, title, chunk_index, text, 0.0 AS rank FROM chunks WHERE lower(text) LIKE lower(?) LIMIT ?",
        (f"%{question}%", limit),
    ).fetchall()
    return [dict(row) for row in rows]


def chroma_query(policy: dict, question: str, limit: int) -> list[dict]:
    try:
        import chromadb
    except Exception:
        return []
    vector = policy.get("vectorDb", {})
    persist_dir = Path(vector.get("persistDir", ""))
    if not persist_dir.exists():
        return []
    client = chromadb.PersistentClient(path=str(persist_dir))
    collection = client.get_or_create_collection(vector.get("collection", "resonance_model_work"))
    if collection.count() == 0:
        return []
    model = load_sentence_model(vector.get("embeddingModel", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"))
    embedding = model.encode([question], normalize_embeddings=True).tolist()[0]
    result = collection.query(query_embeddings=[embedding], n_results=limit)
    items = []
    for doc, meta, distance in zip(result.get("documents", [[]])[0], result.get("metadatas", [[]])[0], result.get("distances", [[]])[0]):
        row = dict(meta or {})
        row.update({"text": doc, "distance": distance, "source": "chroma"})
        items.append(row)
    return items


def query(policy: dict, question: str, limit: int) -> dict:
    sqlite_rows = sqlite_query(policy, question, limit)
    chroma_rows = chroma_query(policy, question, min(limit, 5))
    return {
        "question": question,
        "sqlite": sqlite_rows,
        "chroma": chroma_rows,
        "contextPack": [
            {"path": row.get("path"), "title": row.get("title", ""), "text": (row.get("text") or "")[:1200], "source": "sqlite"}
            for row in sqlite_rows[:limit]
        ],
    }


def prepare_dataset(policy: dict, candidate: str) -> dict:
    dataset_dir = Path(policy.get("trainingData", {}).get("datasetDir", "/opt/util/ai/fine-tuning/resonance-rag-datasets"))
    dataset_dir.mkdir(parents=True, exist_ok=True)
    rows = sqlite_query(policy, "Hermes RAG build deploy model routing fine tuning", 80)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    out_path = dataset_dir / f"{stamp}-{slug(candidate)}.jsonl"
    count = 0
    with out_path.open("w", encoding="utf-8") as out:
        for row in rows:
            text = re.sub(r"\s+", " ", row.get("text") or "").strip()
            if len(text) < 120:
                continue
            record = {
                "messages": [
                    {"role": "system", "content": "Use Resonance RAG context, cite source paths, and preserve guarded build/redeploy policy."},
                    {"role": "user", "content": f"Context source: {row.get('path')}\\n\\n{text[:1800]}\\n\\nTask: produce a grounded operating rule for model work."},
                    {"role": "assistant", "content": f"Grounded rule from {row.get('path')}: use retrieved context before model work, keep deployment commands guarded, and record evidence before promotion."},
                ],
                "metadata": {"candidate": candidate, "sourcePath": row.get("path"), "kind": row.get("kind"), "generatedAt": now_iso()},
            }
            out.write(json.dumps(record, ensure_ascii=False) + "\n")
            count += 1
    plan_path = dataset_dir / f"{stamp}-{slug(candidate)}.training-plan.json"
    plan = {
        "candidate": candidate,
        "dataset": str(out_path),
        "records": count,
        "recommendedMethod": "QLoRA",
        "servingPromotion": policy.get("servingPolicy", {}).get("promotionFlow"),
        "notes": "Train in a shadow slot first, then expose through the existing model runtime profile start/stop flow.",
    }
    plan_path.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"dataset": str(out_path), "plan": str(plan_path), "records": count}


def status(policy: dict) -> dict:
    vector = policy.get("vectorDb", {})
    manifest = Path(policy.get("policyPath", DEFAULT_POLICY)).parent / "chroma-manifest.json"
    return {
        "policy": policy,
        "chromaManifest": read_json(manifest) if manifest.exists() else None,
        "sqliteManifest": read_json(Path(policy.get("sqliteRag", {}).get("manifestPath"))) if Path(policy.get("sqliteRag", {}).get("manifestPath", "")).exists() else None,
        "datasetDir": policy.get("trainingData", {}).get("datasetDir"),
        "vectorDb": vector,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--policy", default=str(DEFAULT_POLICY))
    parser.add_argument("--json", action="store_true")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("status")
    sub.add_parser("build-index")
    q = sub.add_parser("query")
    q.add_argument("--question", required=True)
    q.add_argument("--limit", type=int, default=8)
    d = sub.add_parser("prepare-dataset")
    d.add_argument("--candidate", required=True)
    args = parser.parse_args()
    policy = load_policy(Path(args.policy))
    policy["policyPath"] = str(Path(args.policy))
    if args.command == "status":
        result = status(policy)
    elif args.command == "build-index":
        result = build_index(policy)
    elif args.command == "query":
        result = query(policy, args.question, args.limit)
    elif args.command == "prepare-dataset":
        result = prepare_dataset(policy, args.candidate)
    else:
        raise SystemExit(2)
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(result)


if __name__ == "__main__":
    main()
