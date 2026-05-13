#!/usr/bin/env python3
import argparse
import json
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB = ROOT / "data" / "ai-runtime" / "pattern-card-registry.sqlite"
DEFAULT_SEED = ROOT / "data" / "ai-runtime" / "pattern-cards.seed.json"
DEFAULT_SEED_GLOB = "pattern-cards*.json"


def as_json(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def connect(db_path):
    db_path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(db_path)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA foreign_keys=ON")
    return con


def migrate(con):
    con.executescript(
        """
        CREATE TABLE IF NOT EXISTS pattern_cards (
          pattern_id TEXT PRIMARY KEY,
          schema_version TEXT NOT NULL,
          title TEXT NOT NULL,
          layer TEXT NOT NULL CHECK (layer IN (
            'builder-system',
            'operations-platform',
            'common-framework',
            'project-carbonet'
          )),
          languages_json TEXT NOT NULL CHECK (json_valid(languages_json)),
          purpose TEXT NOT NULL,
          inputs_json TEXT NOT NULL CHECK (json_valid(inputs_json)),
          read_first_json TEXT NOT NULL CHECK (json_valid(read_first_json)),
          allowed_outputs_json TEXT NOT NULL CHECK (json_valid(allowed_outputs_json)),
          forbidden_json TEXT NOT NULL CHECK (json_valid(forbidden_json)),
          verification_json TEXT NOT NULL CHECK (json_valid(verification_json)),
          risk TEXT NOT NULL CHECK (risk IN ('low', 'medium', 'high', 'master-only')),
          model_role TEXT CHECK (model_role IN ('router', 'draft', 'review', 'validator')),
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_pattern_cards_layer
          ON pattern_cards(layer);
        CREATE INDEX IF NOT EXISTS idx_pattern_cards_risk
          ON pattern_cards(risk);
        CREATE INDEX IF NOT EXISTS idx_pattern_cards_model_role
          ON pattern_cards(model_role);
        """
    )


def validate_card(card):
    required = [
        "schemaVersion",
        "patternId",
        "title",
        "layer",
        "languages",
        "purpose",
        "inputs",
        "readFirst",
        "allowedOutputs",
        "forbidden",
        "verification",
        "risk",
    ]
    missing = [key for key in required if key not in card]
    if missing:
        raise ValueError(f"{card.get('patternId', '<unknown>')}: missing {', '.join(missing)}")
    for key in ["languages", "inputs", "readFirst", "allowedOutputs", "forbidden", "verification"]:
        if not isinstance(card[key], list):
            raise ValueError(f"{card['patternId']}: {key} must be a list")


def upsert_card(con, card):
    validate_card(card)
    con.execute(
        """
        INSERT INTO pattern_cards (
          pattern_id,
          schema_version,
          title,
          layer,
          languages_json,
          purpose,
          inputs_json,
          read_first_json,
          allowed_outputs_json,
          forbidden_json,
          verification_json,
          risk,
          model_role,
          notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(pattern_id) DO UPDATE SET
          schema_version = excluded.schema_version,
          title = excluded.title,
          layer = excluded.layer,
          languages_json = excluded.languages_json,
          purpose = excluded.purpose,
          inputs_json = excluded.inputs_json,
          read_first_json = excluded.read_first_json,
          allowed_outputs_json = excluded.allowed_outputs_json,
          forbidden_json = excluded.forbidden_json,
          verification_json = excluded.verification_json,
          risk = excluded.risk,
          model_role = excluded.model_role,
          notes = excluded.notes,
          updated_at = datetime('now')
        """,
        (
            card["patternId"],
            card["schemaVersion"],
            card["title"],
            card["layer"],
            as_json(card["languages"]),
            card["purpose"],
            as_json(card["inputs"]),
            as_json(card["readFirst"]),
            as_json(card["allowedOutputs"]),
            as_json(card["forbidden"]),
            as_json(card["verification"]),
            card["risk"],
            card.get("modelRole"),
            card.get("notes"),
        ),
    )


def load_seed(seed_path):
    payload = json.loads(seed_path.read_text(encoding="utf-8"))
    cards = payload.get("cards", [])
    if not cards:
        raise ValueError(f"no cards found in {seed_path}")
    return cards


def default_seed_paths():
    return sorted((ROOT / "data" / "ai-runtime").glob(DEFAULT_SEED_GLOB))


def main():
    parser = argparse.ArgumentParser(description="Initialize the Resonance pattern-card SQLite registry.")
    parser.add_argument("--db", default=str(DEFAULT_DB), help="SQLite DB path")
    parser.add_argument(
        "--seed",
        action="append",
        default=None,
        help="Seed pattern card JSON path. Can be passed more than once.",
    )
    args = parser.parse_args()

    db_path = Path(args.db)
    seed_paths = [Path(seed) for seed in args.seed] if args.seed else default_seed_paths()
    if not seed_paths:
        seed_paths = [DEFAULT_SEED]
    cards = []
    for seed_path in seed_paths:
        cards.extend(load_seed(seed_path))

    with connect(db_path) as con:
        migrate(con)
        for card in cards:
            upsert_card(con, card)
        con.commit()
        rows = con.execute(
            "SELECT pattern_id, layer, risk, model_role FROM pattern_cards ORDER BY pattern_id"
        ).fetchall()

    print(f"pattern-card-db={db_path}")
    print(f"cards={len(rows)}")
    for pattern_id, layer, risk, model_role in rows:
        print(f"- {pattern_id} | {layer} | {risk} | {model_role or '-'}")


if __name__ == "__main__":
    main()
