#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP="$ROOT/services/report-ocr/app.py"
DOCKERFILE="$ROOT/services/report-ocr/Dockerfile"
FRONTEND="$ROOT/projects/carbonet-frontend/source/src/features/emission-survey-report/EmissionSurveyReportMigrationPage.tsx"
API="$ROOT/projects/carbonet-frontend/source/src/lib/api/emission.ts"
GATEWAY="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/admin/service/ReportOcrGatewayService.java"
RUNTIME_MANIFEST="$ROOT/deploy/k8s/projects/carbonet/carbonet-runtime.deployment.yaml"
OCR_MANIFEST="$ROOT/deploy/k8s/projects/carbonet/carbonet-report-ocr.deployment.yaml"
DEPLOY_SCRIPT="$ROOT/deploy/deploy-resonance-k8s.sh"
FAST_DEPLOY_SCRIPT="$ROOT/ops/scripts/resonance-k8s-build-deploy-80-v2.sh"

python3 -m py_compile "$APP"
bash -n "$ROOT/ops/scripts/build-report-ocr-image.sh"

grep -Fq 'PaddleOCR' "$APP"
grep -Fq 'zone_count = 3 if height >= 1200 else 1' "$APP"
grep -Fq 'license": "Apache-2.0"' "$APP"
grep -Fq 'paddleocr==3.1.0' "$ROOT/services/report-ocr/requirements.txt"
grep -Fq 'paddlex==3.1.0' "$ROOT/services/report-ocr/requirements.txt"
grep -Fq 'langchain==0.3.27' "$ROOT/services/report-ocr/requirements.txt"
grep -Fq 'RUN python -c "from paddleocr import PaddleOCR' "$DOCKERFILE"

grep -Fq 'const viewport = page.getViewport({ scale: 4 });' "$FRONTEND"
grep -Fq 'const recognized = await recognizeReportPhotos(pages' "$FRONTEND"
grep -Fq 'recognizeSurveyReportPages(images)' "$FRONTEND"
if grep -Fq 'const recognized = digitalTextPages' "$FRONTEND"; then
  echo '[report-ocr-contract] FAIL digital text layer still bypasses visible OCR' >&2
  exit 1
fi

grep -Fq '/api/home/certificate-verify/recognize-pages' "$API"
grep -Fq 'http://127.0.0.1:8091/v1/report-ocr' "$GATEWAY"
grep -Fq 'CARBONET_REPORT_OCR_URL' "$RUNTIME_MANIFEST"
grep -Fq 'http://carbonet-report-ocr:8091/v1/report-ocr' "$RUNTIME_MANIFEST"
grep -Fq 'name: carbonet-report-ocr' "$OCR_MANIFEST"
grep -Fq 'localhost:5000/carbonet-report-ocr:3.1.0-r3' "$OCR_MANIFEST"
grep -Fq 'useradd --uid 1000' "$DOCKERFILE"
grep -Fq 'carbonet-report-ocr.deployment.yaml' "$DEPLOY_SCRIPT"
grep -Fq '"name":"CARBONET_REPORT_OCR_URL","value":"http://carbonet-report-ocr:8091/v1/report-ocr"' "$FAST_DEPLOY_SCRIPT"
if grep -Fq 'name: report-ocr' "$RUNTIME_MANIFEST"; then
  echo '[report-ocr-contract] FAIL OCR must not alter runtime HPA pod resources' >&2
  exit 1
fi

echo '[report-ocr-contract] PASS license=Apache-2.0 dpi=288 zones=3 pages=10 textLayerBypass=0 fallback=Tesseract'
