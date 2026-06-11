#!/usr/bin/env python3
"""Generate embeddings using NVIDIA API keys with round-robin rotation."""

import json
import os
import sys
import time
from pathlib import Path
from typing import Iterator

NVIDIA_API_KEYS = [
    "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",
    "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",
    "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",
    "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",
    "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",
    "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",
    "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",
    "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",
    "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",
    "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",
    "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",
    "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",
    "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",
    "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",
    "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",
    "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",
]

API_ENDPOINT = "https://integrate.api.nvidia.com/v1"


def get_key(round_robin: int) -> str:
    return NVIDIA_API_KEYS[round_robin % len(NVIDIA_API_KEYS)]


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


def process_batch(batch: list[dict], round_robin: int, model: str) -> tuple[list[dict], int]:
    """Process a batch of records and return with updated round_robin."""
    results = []
    for record in batch:
        text = record.get("text") or record.get("english", "")
        if not text:
            continue

        api_key = get_key(round_robin)
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
            results, round_robin = process_batch(chunk, round_robin, args.model)

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