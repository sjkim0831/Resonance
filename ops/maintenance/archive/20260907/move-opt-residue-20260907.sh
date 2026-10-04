#!/usr/bin/env bash
set -euo pipefail
base=/opt/Resonance/runtime/host-data/relocated-20260907
log=/opt/Resonance/docs/operations/opt-residue-move-20260907.txt
mkdir -p "$base"
date -Is >> "$log"
for src in /root/.gradle /root/.m2 /home/sjkim/db_trans /home/sjkim/docker-build /home/sjkim/web-viewer-sample.before-ccus-20260906-210627; do
  name=$(basename "$src")
  dst="$base/$name"
  if [ -L "$src" ]; then echo "ALREADY_LINKED $src" >> "$log"; continue; fi
  test -d "$src"
  test ! -e "$dst"
  active=$(lsof -t +D "$src" 2>/dev/null | sort -u || true)
  if [ -n "$active" ]; then echo "SKIPPED_ACTIVE $src PIDS=$active" >> "$log"; continue; fi
  mkdir "$dst"
  rsync -aHAX --numeric-ids "$src/" "$dst/"
  diff=$(rsync -aHAXnc --numeric-ids --delete --itemize-changes "$src/" "$dst/")
  test -z "$diff"
  active=$(lsof -t +D "$src" 2>/dev/null | sort -u || true)
  if [ -n "$active" ]; then echo "COPIED_NOT_SWITCHED_ACTIVE $src" >> "$log"; continue; fi
  retired="${src}.relocated-20260907"
  test ! -e "$retired"
  mv -- "$src" "$retired"
  ln -s "$dst" "$src"
  diff=$(rsync -aHAXnc --numeric-ids --delete --itemize-changes "$retired/" "$dst/")
  test -z "$diff"
  case "$retired" in /root/.gradle.relocated-20260907|/root/.m2.relocated-20260907|/home/sjkim/db_trans.relocated-20260907|/home/sjkim/docker-build.relocated-20260907|/home/sjkim/web-viewer-sample.before-ccus-20260906-210627.relocated-20260907) rm -rf -- "$retired";; *) exit 2;; esac
  echo "MOVED_VERIFIED $src -> $dst checksum_diff=0" >> "$log"
done
date -Is >> "$log"
cat "$log"
systemctl is-active carbonet-production-direct ccus-postgresql-native carbonet-frontend-fast-dev
curl -fsS http://127.0.0.1:18080/actuator/health
