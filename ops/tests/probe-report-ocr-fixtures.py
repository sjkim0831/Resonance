#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
import tempfile
import time

import pypdfium2 as pdfium
import requests


def render(pdf_path: Path, output: Path) -> list[Path]:
    document = pdfium.PdfDocument(str(pdf_path))
    pages: list[Path] = []
    for index in range(len(document)):
        target = output / f"page-{index + 1}.png"
        document[index].render(scale=4).to_pil().save(target, "PNG")
        pages.append(target)
    return pages


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--endpoint", default="http://127.0.0.1:8091/v1/report-ocr")
    parser.add_argument("pdf", nargs="+")
    args = parser.parse_args()
    for raw_path in args.pdf:
        pdf_path = Path(raw_path)
        with tempfile.TemporaryDirectory(prefix="report-ocr-probe-") as directory:
            pages = render(pdf_path, Path(directory))
            files = [("files", (page.name, page.open("rb"), "image/png")) for page in pages]
            started = time.monotonic()
            response = requests.post(args.endpoint, files=files, timeout=300)
            elapsed = time.monotonic() - started
            response.raise_for_status()
            payload = response.json()
            output = pdf_path.with_suffix(".ocr.json")
            output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
            print(json.dumps({
                "file": pdf_path.name,
                "pages": payload.get("pageCount"),
                "characters": len(payload.get("text", "")),
                "confidence": payload.get("confidence"),
                "elapsedSeconds": round(elapsed, 2),
                "result": str(output),
            }, ensure_ascii=False))


if __name__ == "__main__":
    main()
