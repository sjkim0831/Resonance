#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
REFERENCE_ROOT="${REFERENCE_ROOT:-/opt/reference}"
INDEX_ROOT="${AI_SEARCH_INDEX_ROOT:-/opt/resonance-ai-search-index}"
COMMIT="$(git -C "$ROOT_DIR" rev-parse HEAD)"
VERSION="2"
SNAPSHOT="$INDEX_ROOT/snapshots/$COMMIT-v$VERSION"
CURRENT="$INDEX_ROOT/current"

mkdir -p "$SNAPSHOT"
if [ -s "$SNAPSHOT/repository.tsv" ] && [ -s "$SNAPSHOT/references.txt" ]; then
  ln -sfn "$SNAPSHOT" "$CURRENT"
  printf '%s\n' "$SNAPSHOT"
  exit 0
fi

tmp="$SNAPSHOT.tmp.$$"
rm -rf "$tmp"
mkdir -p "$tmp"

git -C "$ROOT_DIR" ls-files | awk '
function domain(p) {
  if (p ~ /emission|ghg|scope[123]/) return "EMISSION";
  if (p ~ /lca|survey/) return "LCA";
  if (p ~ /member|auth|signin|join|authority/) return "IDENTITY";
  if (p ~ /actor|process|workflow|simulation/) return "PROCESS";
  if (p ~ /menu|route|navigation/) return "NAVIGATION";
  if (p ~ /admin/) return "ADMIN";
  return "PLATFORM";
}
function layer(p) {
  if (p ~ /src\/features\/.*\.(tsx|ts)$/) return "PAGE";
  if (p ~ /routes\/families/) return "ROUTE";
  if (p ~ /Controller\.(java|kt)$/) return "API";
  if (p ~ /Service|service/) return "SERVICE";
  if (p ~ /db\/migration|\.sql$/) return "DB";
  if (p ~ /test|spec/) return "TEST";
  if (p ~ /docs\//) return "DOC";
  return "SOURCE";
}
function weight(p,l) {
  w=10;
  if (l=="PAGE") w+=25;
  if (l=="ROUTE") w+=22;
  if (l=="API" || l=="SERVICE") w+=20;
  if (l=="DB" || l=="TEST") w+=16;
  if (p ~ /actor-process|process-development/) w+=18;
  if (p ~ /generated|build|static\/react-app/) w-=15;
  return w;
}
{
  l=layer($0); d=domain($0);
  key=tolower($0); gsub(/[\/_.,-]+/," ",key);
  printf "%d\t%s\t%s\t%s\t%s\n",weight($0,l),d,l,$0,key;
}' | sort -t $'\t' -k1,1nr -k4,4 > "$tmp/repository.tsv"

# Route definitions are deliberately kept as compact source records. This lets
# an agent find menu labels and URLs without loading every route family file.
find "$ROOT_DIR/projects/carbonet-frontend/source/src/app/routes/families" -type f -name '*.ts' -print0 2>/dev/null \
  | xargs -0 grep -H -E 'id:.*(koPath|enPath):' 2>/dev/null \
  | sed "s#^$ROOT_DIR/##" > "$tmp/routes.txt" || true

if [ -d "$REFERENCE_ROOT" ]; then
  find "$REFERENCE_ROOT" -type f \
    -not -path '*/.git/*' -not -path '*/node_modules/*' -not -path '*/build/*' \
    -printf '%p\n' 2>/dev/null | sort > "$tmp/references.txt"
else
  : > "$tmp/references.txt"
fi

cat > "$tmp/README.txt" <<EOF
version=$VERSION
commit=$COMMIT
generated_at=$(date -Iseconds)
repository_columns=priority,domain,layer,path,normalized_path
route_records=routes.txt
EOF

mv "$tmp"/* "$SNAPSHOT"/
rmdir "$tmp"
ln -sfn "$SNAPSHOT" "$CURRENT"
find "$INDEX_ROOT/snapshots" -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf {} + 2>/dev/null || true
printf '%s\n' "$SNAPSHOT"
