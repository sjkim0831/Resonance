FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True \
    REPORT_OCR_PORT=8091

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 libglib2.0-0 libgl1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
COPY app.py /app/app.py
COPY THIRD_PARTY_NOTICES.md /app/THIRD_PARTY_NOTICES.md

RUN useradd --uid 1000 --create-home reportocr \
    && chown -R reportocr:reportocr /app /home/reportocr
USER 1000

# Download and validate the Apache-2.0 Korean models at image-build time. The
# production verifier therefore performs no first-request model download.
RUN python -c "from paddleocr import PaddleOCR; PaddleOCR(lang='korean', use_doc_orientation_classify=False, use_doc_unwarping=False, use_textline_orientation=False)"

EXPOSE 8091
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8091/health', timeout=3)"
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8091", "--workers", "1"]
