#!/usr/bin/env python3
"""Generate embeddings using NVIDIA API keys with round-robin rotation."""

import json
import os
import sys
import time
from pathlib import Path
from typing import Iterator

NVIDIA_API_KEYS_FILE_DEFAULT = "/etc/resonance/secrets/nvidia-api-keys"

API_ENDPOINT = "https://integrate.api.nvidia.com/v1"


def _load_api_keys() -> list[str]:
    """Load NVIDIA API keys from the secret file (never hardcode keys here).

    Same convention as ops/scripts/import-hermes-nvidia-key-pool.py:
    NVIDIA_API_KEYS_FILE env var, defaulting to /etc/resonance/secrets/nvidia-api-keys
    (one key per line, file must exist and be non-empty).
    """
    keys_file = Path(os.environ.get("NVIDIA_API_KEYS_FILE", NVIDIA_API_KEYS_FILE_DEFAULT))
    if not keys_file.is_file():
        raise SystemExit(f"missing NVIDIA API keys file: {keys_file}")
    keys = [line.strip() for line in keys_file.read_text().splitlines() if line.strip()]
    if not keys:
        raise SystemExit(f"NVIDIA API keys file is empty: {keys_file}")
    return keys


def get_key(round_robin: int, keys: list[str]) -> str:
    return keys[round_robin % len(keys)]


def chunked(file_path: Path, chunk_size: int = 500) -> Iterator[list[dict]]:
    """Read JSONL file and yield chunks of records."""
    with open(file_path, "r", encoding="utf-8") as f:
        batch = []
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                batch.append(json.loads(line))
            except json.JSONDecodeError:
                continue
            if len(batch) >= chunk_size:
                yield batch
                batch = []
        if batch:
            yield batch


def generate_embedding(text: str, api_key: str, model: str = "nvidia/nv-embed-v2") -> list[float] | None:
    """Generate embedding using NVIDIA API."""
    import urllib.request

    payload = json.dumps({
        "input": text,
        "model": model,
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{API_ENDPOINT}/embeddings",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            return result["data"][0]["embedding"]
    except Exception as e:
        print(f"Error generating embedding: {e}", file=sys.stderr)
        return None


def process_batch(batch: list[dict], round_robin: int, model: str, keys: list[str]) -> tuple[list[dict], int]:
    """Process a batch of records and return with updated round_robin."""
    results = []
    for record in batch:
        text = record.get("text") or record.get("english", "")
        if not text:
            continue

        api_key = get_key(round_robin, keys)
        round_robin += 1

        embedding = generate_embedding(text, api_key, model)
        if embedding:
            results.append({
                "id": record.get("id", ""),
                "text": text,
                "korean": record.get("korean", ""),
                "embedding": embedding,
                "type": record.get("type", "unknown"),
                "category": record.get("category", "other"),
            })

        if round_robin % 16 == 0:
            time.sleep(0.5)

    return results, round_robin


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Generate embeddings using NVIDIA API")
    parser.add_argument("--input-dir", default="/opt/Resonance/data/vector",
                        help="Directory containing batch_*.jsonl files")
    parser.add_argument("--output", default="/opt/Resonance/data/ai-runtime/hermes-rag-vector.sqlite3",
                        help="Output SQLite database path")
    parser.add_argument("--model", default="nvidia/nv-embed-v2",
                        help="Embedding model")
    parser.add_argument("--batch-size", type=int, default=500,
                        help="Records per batch")
    args = parser.parse_args()

    keys = _load_api_keys()

    input_dir = Path(args.input_dir)
    output_path = Path(args.output)

    print(f"Processing vector data from {input_dir}")
    print(f"Output to {output_path}")
    print(f"Using model: {args.model}")

    batch_files = sorted(input_dir.glob("batch_*.jsonl"))
    print(f"Found {len(batch_files)} batch files")

    import sqlite3

    output_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(output_path)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS embeddings (
            id TEXT PRIMARY KEY,
            text TEXT NOT NULL,
            korean TEXT,
            embedding BLOB NOT NULL,
            type TEXT,
            category TEXT
        )
    """)
    cursor.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS embeddings_fts USING fts5(
            id, text, korean, type, category,
            content='embeddings',
            content_rowid='rowid'
        )
    """)
    conn.commit()

    round_robin = 0
    total_processed = 0

    for batch_file in batch_files:
        print(f"Processing {batch_file.name}...")
        for chunk in chunked(batch_file, args.batch_size):
            results, round_robin = process_batch(chunk, round_robin, args.model, keys)

            if results:
                embedding_rows = [
                    (r["id"], r["text"], r.get("korean"),
                     json.dumps(r["embedding"]), r.get("type"), r.get("category"))
                    for r in results
                ]
                cursor.executemany(
                    "INSERT OR REPLACE INTO embeddings (id, text, korean, embedding, type, category) VALUES (?, ?, ?, ?, ?, ?)",
                    embedding_rows
                )
                conn.commit()
                total_processed += len(results)
                print(f"  Processed {total_processed} records so far...")

    print(f"Complete! Total processed: {total_processed} records")
    conn.close()


if __name__ == "__main__":
    main()
