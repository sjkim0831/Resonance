#!/usr/bin/env bash
set -euo pipefail

registry="${LOCAL_REGISTRY_URL:-http://127.0.0.1:5000}"
protected_ref="${PATRONI_PROTECTED_REF:-127.0.0.1:5000/spilo-16-uid1000:3.2-p3}"
upstream_ref="${PATRONI_UPSTREAM_REF:-ghcr.io/zalando/spilo-16:3.2-p3}"
archive="${PATRONI_PROTECTED_ARCHIVE:-/opt/Resonance/var/protected-images/spilo-16-3.2-p3.tar.gz}"
checksum="${archive}.sha256"
manifest_path="/v2/spilo-16-uid1000/manifests/3.2-p3"
accept="application/vnd.docker.distribution.manifest.v2+json"

if curl -fsSI -H "Accept: ${accept}" "${registry}${manifest_path}" >/dev/null; then
  echo "[protected-image] Patroni image is available in the local registry"
  exit 0
fi

echo "[protected-image] Patroni image is missing; restoring the protected copy"
if [[ -s "$archive" && -s "$checksum" ]] && (cd "$(dirname "$archive")" && sha256sum -c "$(basename "$checksum")"); then
  gzip -dc "$archive" | docker load >/dev/null
else
  mkdir -p "$(dirname "$archive")"
  docker pull "$upstream_ref" >/dev/null
  tmp="${archive}.tmp.$$"
  docker save "$upstream_ref" | gzip -1 >"$tmp"
  mv "$tmp" "$archive"
  sha256sum "$archive" >"$checksum"
fi

docker tag "$upstream_ref" "$protected_ref"
docker push "$protected_ref" >/dev/null
curl -fsSI -H "Accept: ${accept}" "${registry}${manifest_path}" >/dev/null
echo "[protected-image] Patroni image restored and verified"
