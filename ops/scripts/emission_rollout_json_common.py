import json

SCHEMA_VERSION = 1


def split_scopes(raw):
    return [item.strip().upper() for item in raw.split() if item.strip()]


def schema_payload(**kwargs):
    return {
        "schemaVersion": SCHEMA_VERSION,
        **kwargs,
    }


def emit_json(**kwargs):
    print(json.dumps(schema_payload(**kwargs), ensure_ascii=False, indent=2))


def prefixed(prefix, message):
    return f"[{prefix}] {message}"


def render_scope_lines(prefix, scopes, include_heading=True):
    lines = [prefixed(prefix, "scopes")] if include_heading else []
    for row in scopes:
        lines.append(
            prefixed(
                prefix,
                f"  {row['scope']} (inputVar={row['expectedInputVar']}, fixture={row['fixtureFile']})",
            )
        )
    return lines


def render_board_summary_lines(prefix, cards, rows):
    lines = [prefixed(prefix, "board summary")]
    for card in cards:
        lines.append(prefixed(prefix, f"  {card.get('title')}: {card.get('value')}"))
    lines.append(prefixed(prefix, f"board rows: {len(rows)}"))
    lines.extend(render_board_row_lines(prefix, rows))
    return lines


def render_board_row_lines(prefix, rows):
    lines = []
    for row in rows:
        lines.append(
            prefixed(
                prefix,
                "  "
                f"{row.get('scope')} -> {row.get('promotionStatus')} "
                f"(adopted={row.get('definitionFormulaAdopted')}, draftId={row.get('draftId')}, "
                f"sessionId={row.get('sessionId')}, resultId={row.get('resultId')})",
            )
        )
    return lines
