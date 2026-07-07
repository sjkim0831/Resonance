#!/usr/bin/env bash
# React bundle integrity verifier
# Fails pre-commit or CI if index.html references bundles that don't exist on disk.
# Usage: bash ops/scripts/resonance-react-bundle-integrity.sh
set -euo pipefail

OVERLAY="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/projects/carbonet-frontend/src/main/resources/static/react-app"
INDEX="$OVERLAY/index.html"
errors=0

if [[ ! -f "$INDEX" ]]; then
  echo "[bundle-integrity] SKIP: $INDEX not found (no React overlay yet)"
  exit 0
fi

echo "[bundle-integrity] scanning $INDEX"

# Extract every /assets/react/assets/*.{js,css,mjs} reference from index.html
grep -oE '/assets/react/assets/[A-Za-z0-9_+./-]+\.(js|css|mjs)' "$INDEX" | sort -u > /tmp/index-refs.txt

echo "[bundle-integrity] references in index.html ($(wc -l < /tmp/index-refs.txt) files):"
sed 's/^/  /' /tmp/index-refs.txt

echo "[bundle-integrity] checking existence..."
while IFS= read -r path; do
  rel="${path#/assets/react/}"
  f="$OVERLAY/$rel"
  if [[ ! -f "$f" ]]; then
    echo "  MISSING: $path -> $f"
    errors=$((errors+1))
  fi
done < /tmp/index-refs.txt

# Also check that all referenced preloads actually exist
grep -oE 'href="/assets/react/assets/[^"]+"' "$INDEX" | sed 's/href=//g' | tr -d '"' | sort -u > /tmp/preload-refs.txt
while IFS= read -r path; do
  rel="${path#/assets/react/}"
  f="$OVERLAY/$rel"
  if [[ ! -f "$f" ]]; then
    echo "  MISSING (preload): $path -> $f"
    errors=$((errors+1))
  fi
done < /tmp/preload-refs.txt

if (( errors > 0 )); then
  echo "[bundle-integrity] FAILED: $errors missing bundle file(s)"
  echo "[bundle-integrity] Run 'cd projects/carbonet-frontend/source && npm run build' to regenerate."
  exit 1
fi

echo "[bundle-integrity] OK: all referenced bundles exist"
exit 0