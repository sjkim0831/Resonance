#!/bin/bash
set -euo pipefail
ROOT=/opt/Resonance
OUT=/opt/p006-runtime/backend/classes
mkdir -p "$OUT"
javac -proc:none -cp '/opt/ccus-runtime/backend/certificate-verification/backend/runtime/BOOT-INF/lib/*' -d "$OUT" "$ROOT/projects/P006/backend/P006LocalApplication.java" "$ROOT/apps/carbonet-api/src/main/java/egovframework/com/web/P006ProjectAuthController.java" "$ROOT/apps/carbonet-api/src/main/java/egovframework/com/web/P006FactorySceneController.java"
