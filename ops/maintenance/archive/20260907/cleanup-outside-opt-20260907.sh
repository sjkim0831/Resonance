#!/usr/bin/env bash
set -euo pipefail
e=/opt/Resonance/docs/operations/outside-opt-cleanup-20260907
mkdir -p "$e"
date -Is > "$e/started.txt"
df -B1 / /opt > "$e/disk-before.txt"
for p in /root/.npm/_cacache /root/.cache/pip /home/sjkim/.cache/pip /home/sjkim/.cache/node-gyp /tmp/node-compile-cache; do
  test -d "$p" || continue
  if [ -L "$p" ] || [ "$(realpath "$p")" != "$p" ]; then echo "SKIP_LINK $p" >> "$e/deleted.txt"; continue; fi
  active=$(lsof -t +D "$p" 2>/dev/null | sort -u || true)
  if [ -n "$active" ]; then echo "SKIP_ACTIVE $p $active" >> "$e/deleted.txt"; continue; fi
  key=$(echo "$p" | tr / _)
  find "$p" -xdev -type f -printf '%s %T@ %p\n' > "$e/$key.manifest"
  du -sb "$p" >> "$e/deleted.txt"
  # The explicit allowlist contains only regenerable caches; never follow links or cross mounts.
  case "$p" in /root/.npm/_cacache|/root/.cache/pip|/home/sjkim/.cache/pip|/home/sjkim/.cache/node-gyp|/tmp/node-compile-cache) find "$p" -xdev -depth -mindepth 1 -delete;; *) exit 2;; esac
  echo "CLEANED $p" >> "$e/deleted.txt"
done
systemctl is-active carbonet-production-direct ccus-postgresql-native carbonet-frontend-fast-dev resonance-p006-web docker containerd kubelet > "$e/services.txt"
curl -fsS http://127.0.0.1:18080/actuator/health > "$e/health.json"
curl -s -o /dev/null -w 'HOME %{http_code}\n' http://127.0.0.1/home > "$e/http.txt"
curl -s -o /dev/null -w 'P006 %{http_code}\n' http://127.0.0.1:5174/ >> "$e/http.txt"
df -B1 / /opt > "$e/disk-after.txt"
date -Is > "$e/completed.txt"
cat "$e/deleted.txt" "$e/services.txt" "$e/health.json" "$e/http.txt" "$e/completed.txt"
