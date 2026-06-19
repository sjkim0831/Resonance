#!/usr/bin/env python3
"""JSONL to InfluxDB migration script.

Usage:
    python migrate_to_influxdb.py --file /path/to/events.jsonl --measurement my_events
    python migrate_to_influxdb.py --dir /path/to/*.jsonl --measurement default
"""

import json
import os
import sys
import argparse
from pathlib import Path
from datetime import datetime

try:
    from influxdb_client import InfluxDBClient
    from influxdb_client.client.write_api import SYNCHRONOUS
    INFLUXDB_AVAILABLE = True
except ImportError:
    INFLUXDB_AVAILABLE = False

INFLUXDB_URL = os.environ.get("INFLUXDB_URL", "http://127.0.0.1:8086")
INFLUXDB_TOKEN = os.environ.get("INFLUXDB_TOKEN", "hermes-admin-token")
INFLUXDB_ORG = os.environ.get("INFLUXDB_ORG", "hermes")
INFLUXDB_BUCKET = os.environ.get("INFLUXDB_BUCKET", "events")


def get_client():
    if not INFLUXDB_AVAILABLE:
        return None
    try:
        client = InfluxDBClient(
            url=INFLUXDB_URL,
            token=INFLUXDB_TOKEN,
            org=INFLUXDB_ORG,
            timeout=10000
        )
        client.ping()
        return client
    except Exception as e:
        print(f"InfluxDB connection failed: {e}")
        return None


def parse_timestamp(event):
    ts = event.get("ts") or event.get("timestamp") or event.get("time")
    if ts:
        try:
            ts = int(ts)
            if ts > 1e12:
                return ts * 1e6
            return ts * 1e9
        except:
            pass
    return int(datetime.now().timestamp() * 1e9)


def jsonl_to_influxdb(file_path: Path, measurement: str, batch_size: int = 500):
    client = get_client()
    if not client:
        print("InfluxDB not available. Install: pip install influxdb-client")
        return 0

    write_api = client.write_api(write_options=SYNCHRONOUS)
    count = 0
    from influxdb_client import Point

    print(f"Importing {file_path} -> {measurement}...")

    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        batch = []
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue

            point = Point(measurement)

            for key, value in event.items():
                if key in ("ts", "timestamp", "time"):
                    continue
                if value is None:
                    continue
                if isinstance(value, (int, float)):
                    point.field(key, float(value) if isinstance(value, int) else value)
                elif isinstance(value, bool):
                    point.field(key, value)
                else:
                    str_val = str(value)[:1024]
                    if key in ("status", "type", "kind", "action", "result"):
                        point.tag(key, str_val)
                    else:
                        point.field(key, str_val)

            point.time(parse_timestamp(event))
            batch.append(point)
            count += 1

            if len(batch) >= batch_size:
                write_api.write(bucket=INFLUXDB_BUCKET, org=INFLUXDB_ORG, record=batch)
                batch = []

        if batch:
            write_api.write(bucket=INFLUXDB_BUCKET, org=INFLUXDB_ORG, record=batch)

    client.close()
    return count


def main():
    parser = argparse.ArgumentParser(description="Migrate JSONL files to InfluxDB")
    parser.add_argument("--file", type=str, help="Single JSONL file to import")
    parser.add_argument("--dir", type=str, help="Directory with JSONL files (glob pattern)")
    parser.add_argument("--measurement", type=str, default="events",
                        help="InfluxDB measurement name")
    parser.add_argument("--batch-size", type=int, default=500,
                        help="Batch size for writing")
    args = parser.parse_args()

    total = 0

    if args.file:
        path = Path(args.file)
        if path.exists():
            total += jsonl_to_influxdb(path, args.measurement, args.batch_size)
        else:
            print(f"File not found: {path}")

    elif args.dir:
        dir_path = Path(args.dir)
        for jsonl_file in dir_path.glob("*.jsonl"):
            if jsonl_file.stat().st_size == 0:
                continue
            try:
                count = jsonl_to_influxdb(jsonl_file, args.measurement, args.batch_size)
                total += count
                print(f"  Imported {count} events from {jsonl_file.name}")
            except Exception as e:
                print(f"  Failed to import {jsonl_file.name}: {e}")

    else:
        print("Specify --file or --dir")
        return 1

    print(f"\nTotal events imported: {total}")
    return 0


if __name__ == "__main__":
    sys.exit(main())