#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="${CUBRID_CONTAINER_NAME:-11.2}"
LOB_DIR="${CUBRID_LOB_DIR:-/var/lib/cubrid/com/lob}"
DB_NAME="${CUBRID_DB:-carbonet}"
DB_USER="${CUBRID_USER:-dba}"

if ! command -v docker >/dev/null 2>&1; then
  echo "[cubrid-lob-permissions] docker command not found" >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  echo "[cubrid-lob-permissions] CUBRID container is not running: $CONTAINER_NAME" >&2
  exit 1
fi

echo "[cubrid-lob-permissions] checking $CONTAINER_NAME:$LOB_DIR"
docker exec "$CONTAINER_NAME" bash -lc "
  set -euo pipefail
  test -d '$LOB_DIR'
  chown -R cubrid:cubrid '$LOB_DIR'
  remaining=\$(find '$LOB_DIR' -maxdepth 1 \\( -not -user cubrid -o -not -group cubrid \\) -print | head -n 1)
  if [[ -n \"\$remaining\" ]]; then
    echo '[cubrid-lob-permissions] unresolved ownership entry:' \"\$remaining\" >&2
    exit 1
  fi
  csql -u '$DB_USER' '$DB_NAME' -c \"select char_to_clob('carbonet-lob-permission-check') as c;\" >/tmp/cubrid-lob-permission-check.out
"

echo "[cubrid-lob-permissions] CLOB write check OK"
