#!/usr/bin/env python3
import argparse
import concurrent.futures
import json
import os
import stat
import urllib.request
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("candidates", type=Path)
parser.add_argument("--out", type=Path, required=True)
parser.add_argument("--batch", type=int, default=1)
parser.add_argument(
    "--key-file",
    type=Path,
    default=Path("/etc/resonance/secrets/e4b-api-key"),
)
args = parser.parse_args()
rows = json.loads(args.candidates.read_text(encoding="utf-8")).get("candidates", [])
key = os.environ.get("E4B_API_KEY", "")
if not key and args.key_file.is_file():
    if stat.S_IMODE(args.key_file.stat().st_mode) & 0o077:
        raise SystemExit("E4B key file must be mode 0600")
    key = args.key_file.read_text().strip()
if not key:
    raise SystemExit("E4B API key is not configured")

valid = [
    {"taskId": item["taskId"], "candidate": item["candidate"]}
    for item in rows
    if item.get("deterministicValidation") == "VALID"
]
batches = [
    valid[position : position + args.batch]
    for position in range(0, len(valid), args.batch)
]
workers = max(
    1,
    min(int(os.environ.get("E4B_SELECTOR_WORKERS", "4")), 8, len(batches) or 1),
)


def select_batch(batch):
    prompt = (
        "You are a bounded contract candidate selector. Never create IDs or code. "
        "Choose SELECT when the existing candidate conservatively resolves the stated "
        "gap, REVIEW when evidence is insufficient, otherwise REJECT. Copy taskId "
        "exactly. Return JSON only: "
        '{"selections":[{"taskId":"...","decision":"SELECT|REVIEW|REJECT",'
        '"confidence":0.0,"reason":"concise Korean evidence"}]} INPUT='
        + json.dumps(batch, ensure_ascii=False)
    )
    result = None
    for _ in range(2):
        body = json.dumps(
            {
                "model": "gemma4-e4b-gpu-shadow",
                "temperature": 0,
                "max_tokens": 700,
                "messages": [
                    {
                        "role": "system",
                        "content": "Strict JSON only. No markdown or trailing text.",
                    },
                    {"role": "user", "content": prompt},
                ],
            }
        ).encode()
        request = urllib.request.Request(
            "http://127.0.0.1:24451/v1/chat/completions",
            data=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {key}",
            },
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=120) as response:
            content = json.loads(response.read())["choices"][0]["message"]["content"]
        left, right = content.find("{"), content.rfind("}")
        try:
            result = json.loads(content[left : right + 1])
            break
        except (ValueError, TypeError):
            prompt = "Previous output was invalid. Return valid JSON only. " + prompt
    if result is None:
        return []
    allowed = {item["taskId"] for item in batch}
    return [
        item
        for item in result.get("selections", [])
        if item.get("taskId") in allowed
    ]


selections = []
with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
    for selected in pool.map(select_batch, batches):
        selections.extend(selected)
selection_order = {item["taskId"]: position for position, item in enumerate(valid)}
selections.sort(
    key=lambda item: selection_order.get(item.get("taskId"), len(valid))
)
output = {
    "schemaVersion": "1.0.0",
    "model": "gemma4-e4b-gpu-shadow",
    "selections": selections,
}
args.out.write_text(
    json.dumps(output, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)
print(
    json.dumps(
        {
            "success": len(selections) == len(valid),
            "selected": len(selections),
            "expected": len(valid),
            "workers": workers,
        }
    )
)
