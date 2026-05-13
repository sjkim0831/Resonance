#!/usr/bin/env python3
import argparse
import json
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB = ROOT / "data" / "ai-runtime" / "pattern-card-registry.sqlite"


def decode(value):
    return json.loads(value) if value else []


def row_to_card(row):
    keys = [
        "pattern_id",
        "schema_version",
        "title",
        "layer",
        "languages_json",
        "purpose",
        "inputs_json",
        "read_first_json",
        "allowed_outputs_json",
        "forbidden_json",
        "verification_json",
        "risk",
        "model_role",
        "notes",
    ]
    item = dict(zip(keys, row))
    return {
        "patternId": item["pattern_id"],
        "schemaVersion": item["schema_version"],
        "title": item["title"],
        "layer": item["layer"],
        "languages": decode(item["languages_json"]),
        "purpose": item["purpose"],
        "inputs": decode(item["inputs_json"]),
        "readFirst": decode(item["read_first_json"]),
        "allowedOutputs": decode(item["allowed_outputs_json"]),
        "forbidden": decode(item["forbidden_json"]),
        "verification": decode(item["verification_json"]),
        "risk": item["risk"],
        "modelRole": item["model_role"],
        "notes": item["notes"],
    }


def main():
    parser = argparse.ArgumentParser(description="Query the Resonance pattern-card registry.")
    parser.add_argument("--db", default=str(DEFAULT_DB), help="SQLite DB path")
    parser.add_argument("--pattern-id", help="Exact pattern id")
    parser.add_argument("--layer", help="Filter by layer")
    parser.add_argument("--risk", help="Filter by risk")
    parser.add_argument("--language", help="Filter by language")
    parser.add_argument("--keyword", help="Filter by id, title, or purpose keyword")
    parser.add_argument("--limit", type=int, default=100, help="Maximum rows")
    parser.add_argument("--json", action="store_true", help="Print full JSON cards")
    args = parser.parse_args()

    con = sqlite3.connect(args.db)
    where = []
    params = []
    if args.pattern_id:
        where.append("pattern_id = ?")
        params.append(args.pattern_id)
    if args.layer:
        where.append("layer = ?")
        params.append(args.layer)
    if args.risk:
        where.append("risk = ?")
        params.append(args.risk)
    if args.language:
        where.append("languages_json LIKE ?")
        params.append(f'%"{args.language}"%')
    if args.keyword:
        where.append("(pattern_id LIKE ? OR title LIKE ? OR purpose LIKE ?)")
        keyword = f"%{args.keyword}%"
        params.extend([keyword, keyword, keyword])

    sql = """
      SELECT pattern_id, schema_version, title, layer, languages_json, purpose,
             inputs_json, read_first_json, allowed_outputs_json, forbidden_json,
             verification_json, risk, model_role, notes
      FROM pattern_cards
    """
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY pattern_id LIMIT ?"
    params.append(args.limit)

    cards = [row_to_card(row) for row in con.execute(sql, params)]
    if args.json:
        print(json.dumps({"cards": cards, "count": len(cards)}, ensure_ascii=False, indent=2))
        return

    print(f"cards={len(cards)}")
    for card in cards:
        print(f"- {card['patternId']} | {card['layer']} | {card['risk']} | {card.get('modelRole') or '-'}")


if __name__ == "__main__":
    main()
