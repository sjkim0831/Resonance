from __future__ import annotations

import os
import tempfile
from pathlib import Path
from threading import Lock
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from paddleocr import PaddleOCR
import cv2
from PIL import Image

MAX_PAGES = 10
MAX_PAGE_BYTES = 12 * 1024 * 1024
MAX_PAGE_PIXELS = 40_000_000
_MODEL: PaddleOCR | None = None
_MODEL_LOCK = Lock()

app = FastAPI(title="Carbonet Report OCR", version="1.0.0")


def model() -> PaddleOCR:
    global _MODEL
    with _MODEL_LOCK:
        if _MODEL is None:
            _MODEL = PaddleOCR(
                lang=os.getenv("REPORT_OCR_LANGUAGE", "korean"),
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_textline_orientation=False,
            )
        return _MODEL


def result_payload(result: Any) -> dict[str, Any]:
    if hasattr(result, "json"):
        payload = result.json
        if callable(payload):
            payload = payload()
        if isinstance(payload, dict):
            return payload.get("res", payload)
    if isinstance(result, dict):
        return result.get("res", result)
    return {}


def recognized_lines(image: Any, y_offset: int = 0) -> list[dict[str, Any]]:
    lines: list[dict[str, Any]] = []
    for prediction in model().predict(input=image):
        payload = result_payload(prediction)
        recognized = payload.get("overall_ocr_res", payload)
        rec_texts = recognized.get("rec_texts", []) or []
        rec_scores = recognized.get("rec_scores", []) or []
        polygons = recognized.get("dt_polys", []) or []
        for index, raw_text in enumerate(rec_texts):
            text = str(raw_text).strip()
            if not text:
                continue
            score = float(rec_scores[index]) if index < len(rec_scores) else 0.0
            polygon = polygons[index].tolist() if index < len(polygons) and hasattr(polygons[index], "tolist") else (polygons[index] if index < len(polygons) else [])
            polygon = [[float(point[0]), float(point[1]) + y_offset] for point in polygon] if polygon else []
            lines.append({"text": text, "confidence": round(score * 100, 2), "polygon": polygon})
    return lines


def page_result(path: Path) -> dict[str, Any]:
    with Image.open(path) as header:
        width, height = header.size
        if width <= 0 or height <= 0 or width * height > MAX_PAGE_PIXELS:
            raise HTTPException(status_code=413, detail="page image exceeds 40 million pixels")
    image = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="page image is invalid")
    height = int(image.shape[0])
    # Whole-page OCR loses small table digits. Split tall report pages into
    # overlapping horizontal zones so each line reaches the recognizer at a
    # useful scale. Coordinate offsets preserve original reading order.
    zone_count = 3 if height >= 1200 else 1
    overlap = int(height * 0.04)
    lines: list[dict[str, Any]] = []
    for zone_index in range(zone_count):
        start = max(0, int(height * zone_index / zone_count) - overlap)
        end = min(height, int(height * (zone_index + 1) / zone_count) + overlap)
        lines.extend(recognized_lines(image[start:end, :], start))
    lines.sort(key=lambda line: (
        min((point[1] for point in line["polygon"]), default=0),
        min((point[0] for point in line["polygon"]), default=0),
    ))
    unique: list[dict[str, Any]] = []
    for line in lines:
        center_y = sum((point[1] for point in line["polygon"]), 0.0) / max(1, len(line["polygon"]))
        duplicate = any(
            existing["text"] == line["text"]
            and abs((sum((point[1] for point in existing["polygon"]), 0.0) / max(1, len(existing["polygon"]))) - center_y) < 24
            for existing in unique
        )
        if not duplicate:
            unique.append(line)
    lines = unique
    texts = [line["text"] for line in lines]
    scores = [float(line["confidence"]) / 100.0 for line in lines]
    confidence = round(sum(scores) / len(scores) * 100, 2) if scores else 0.0
    return {"text": "\n".join(texts), "confidence": confidence, "lines": lines, "zoneCount": zone_count}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "UP", "engine": "PaddleOCR", "license": "Apache-2.0"}


@app.post("/v1/report-ocr")
async def report_ocr(files: list[UploadFile] = File(...)) -> dict[str, Any]:
    if not files or len(files) > MAX_PAGES:
        raise HTTPException(status_code=400, detail=f"1-{MAX_PAGES} page images are required")
    pages: list[dict[str, Any]] = []
    with tempfile.TemporaryDirectory(prefix="carbonet-report-ocr-") as directory:
        for index, upload in enumerate(files):
            content = await upload.read(MAX_PAGE_BYTES + 1)
            if len(content) > MAX_PAGE_BYTES:
                raise HTTPException(status_code=413, detail=f"page {index + 1} exceeds 12 MB")
            target = Path(directory) / f"page-{index + 1}.png"
            target.write_bytes(content)
            result = page_result(target)
            result["pageNumber"] = index + 1
            pages.append(result)
    confidences = [float(page["confidence"]) for page in pages if page["text"]]
    return {
        "engine": "PaddleOCR-3.1",
        "license": "Apache-2.0",
        "pageCount": len(pages),
        "confidence": round(sum(confidences) / len(confidences), 2) if confidences else 0.0,
        "text": "\n".join(page["text"] for page in pages if page["text"]),
        "pages": pages,
    }
