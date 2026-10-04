#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
BASE=/opt/Resonance/backups/native-postgresql
BIN=/opt/Resonance/runtime/postgresql16/runtime/usr/lib/postgresql/16/bin
export PGHOST=/opt/Resonance/runtime/postgresql16/socket PGPORT=35433 PGUSER=postgres
exec 9>"$BASE/.backup.lock"
flock -n 9 || { echo 'Backup already running'; exit 1; }
available=$(df -Pk "$BASE" | awk 'NR==2 {print $4}')
(( available > 20971520 )) || { echo 'FAIL: less than 20 GiB available'; exit 1; }
stamp=$(date -u +%Y%m%dT%H%M%SZ)
work="$BASE/.incomplete-$stamp"
mkdir "$work"
trap 'echo "FAIL: incomplete backup retained at $work"' ERR
"$BIN/pg_dumpall" --globals-only > "$work/globals.sql"
"$BIN/psql" -X -d postgres -At -F $'\t' -c 'SELECT oid,datname FROM pg_database WHERE NOT datistemplate AND datallowconn ORDER BY oid' > "$work/databases.tsv"
while IFS=$'\t' read -r oid db; do
  echo "Backing up database OID $oid"
  "$BIN/pg_dump" --format=custom --compress=1 --dbname="$db" --file="$work/$oid.dump"
  "$BIN/pg_restore" --list "$work/$oid.dump" > "$work/$oid.toc"
  test -s "$work/$oid.dump"
done < "$work/databases.tsv"
cd "$work"
sha256sum globals.sql databases.tsv ./*.dump ./*.toc > SHA256SUMS
sha256sum -c SHA256SUMS --quiet
printf 'Completed UTC: %s\nPort: 35433\nValidation: dump exit status, TOC, SHA256; not a restore drill\n' "$(date -u --iso-8601=seconds)" > SUCCESS.txt
mv "$work" "$BASE/$stamp"
echo "SUCCESS $BASE/$stamp"
