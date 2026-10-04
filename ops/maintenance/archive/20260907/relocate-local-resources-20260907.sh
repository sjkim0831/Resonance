#!/usr/bin/env bash
set -euo pipefail
base=/opt/Resonance/runtime/host-data/user-local
evidence=/opt/Resonance/docs/operations/local-relocation-20260907
mkdir -p "$base/share" "$base/lib" "$evidence"
date -Is > "$evidence/started.txt"
df -h /opt / > "$evidence/disk-before.txt"
sudo -u sjkim python3 -c 'import numpy, torch; print(numpy.__version__, torch.__version__)' > "$evidence/python-before.txt" 2>&1 || true
for relative in share/kilo share/ov lib/python3.14; do
  src="/home/sjkim/.local/$relative"
  dst="$base/$relative"
  key=${relative//\//-}
  test -d "$src" && test ! -L "$src" && test ! -e "$dst"
  active=$(lsof -t +D "$src" 2>/dev/null | sort -u || true)
  if [ -n "$active" ]; then echo "SKIPPED_ACTIVE $relative $active" | tee -a "$evidence/result.txt"; continue; fi
  mkdir "$dst"
  rsync -aHAX --numeric-ids "$src/" "$dst/"
  rsync -aHAXnc --numeric-ids --delete --itemize-changes "$src/" "$dst/" > "$evidence/$key.diff"
  test ! -s "$evidence/$key.diff"
  active=$(lsof -t +D "$src" 2>/dev/null | sort -u || true)
  if [ -n "$active" ]; then echo "COPIED_ONLY_ACTIVE $relative $active" | tee -a "$evidence/result.txt"; continue; fi
  retired="$src.relocated-20260907"
  test ! -e "$retired"
  mv "$src" "$retired"
  ln -s "$dst" "$src"
  chown -h sjkim:sjkim "$src"
  rsync -aHAXnc --numeric-ids --delete --itemize-changes "$retired/" "$dst/" > "$evidence/$key.final.diff"
  if [ -s "$evidence/$key.final.diff" ]; then
    unlink "$src"; mv "$retired" "$src"; exit 3
  fi
  echo "MOVED_CHECKSUM_VERIFIED $src -> $dst" | tee -a "$evidence/result.txt"
  # Keep retired source until all smoke tests complete.
done
sudo -u sjkim python3 -c 'import numpy, torch; print(numpy.__version__, torch.__version__)' > "$evidence/python-after.txt" 2>&1 || true
cmp "$evidence/python-before.txt" "$evidence/python-after.txt"
systemctl is-active carbonet-production-direct ccus-postgresql-native carbonet-frontend-fast-dev resonance-p006-web > "$evidence/services.txt"
curl -fsS http://127.0.0.1:18080/actuator/health > "$evidence/health.json"
for relative in share/kilo share/ov lib/python3.14; do
  src="/home/sjkim/.local/$relative"
  retired="$src.relocated-20260907"
  test -L "$src" || continue
  test -d "$retired" || continue
  active=$(lsof -t +D "$retired" 2>/dev/null | sort -u || true)
  if [ -n "$active" ]; then echo "RETAINED_ACTIVE $retired" >> "$evidence/result.txt"; continue; fi
  case "$retired" in /home/sjkim/.local/share/kilo.relocated-20260907|/home/sjkim/.local/share/ov.relocated-20260907|/home/sjkim/.local/lib/python3.14.relocated-20260907) rm -rf -- "$retired";; *) exit 4;; esac
done
date -Is > "$evidence/completed.txt"
df -h /opt / > "$evidence/disk-after.txt"
cat "$evidence/result.txt" "$evidence/python-after.txt" "$evidence/disk-after.txt"
