#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
HELPER="$ROOT/ops/scripts/postdeploy-attempt-journal.py"
[[ -x "$HELPER" || -f "$HELPER" ]] || { echo '[attempt-journal-test] helper missing' >&2; exit 1; }

work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT
journal="$work/state/attempt.json"
candidate='postdeploy:test:durable:123456'
source='1111111111111111111111111111111111111111'
base='0000000000000000000000000000000000000000'
runtime='2222222222222222222222222222222222222222222222222222222222222222'
sha='3333333333333333333333333333333333333333333333333333333333333333'
image_id='docker-pullable://registry.invalid/carbonet@sha256:4444444444444444444444444444444444444444444444444444444444444444'

payload="$(jq -cn \
  --arg attempt "$candidate" --arg source "$source" --arg base "$base" \
  --arg sha "$sha" --arg imageId "$image_id" '
  {
    schemaVersion:2,lifecycleStatus:"STAGED",rollbackStage:"SNAPSHOT_CAPTURED",dbAttemptStaged:false,
    attemptId:$attempt,candidateId:$attempt,
    sourceCommit:$source,baseCommit:$base,runtimeIdentityHash:null,terminalReason:null,
    stagedAt:"2026-08-12T08:00:00Z",terminalAt:null,
    rollback:{
      snapshotId:"snapshot-durable-1",snapshotDir:"/opt/resonance-data/deploy/snapshots/snapshot-durable-1",
      snapshotManifestSha256:$sha,runtimeImageRef:"registry.invalid/carbonet:baseline",
      runtimeImageId:$imageId,deploymentUid:"deployment-uid-baseline",deploymentGeneration:7,
      deploymentAnnotationsSha256:$sha,podTemplateSha256:$sha,
      appliedMarkerCommit:$base,appliedMarkerSha256:$sha,
      runtimeMarkerCommit:$base,runtimeMarkerSha256:$sha
    }
  }')"

printf '%s\n' "$payload" | python3 "$HELPER" --file "$journal" stage >/dev/null
[[ "$(stat -c %a "$journal")" == 600 ]]
[[ "$(stat -c %a "$work/state/.attempt.json.lock")" == 600 ]]
[[ ! -L "$journal" && "$(find "$work/state" -name '.attempt.json.tmp.*' | wc -l)" == 0 ]]
python3 "$HELPER" --file "$journal" read | jq -e \
  --arg candidate "$candidate" --arg source "$source" '
  .lifecycleStatus=="STAGED" and .rollbackStage=="SNAPSHOT_CAPTURED"
  and .dbAttemptStaged==false and .candidateId==$candidate and .sourceCommit==$source
  and .rollback.deploymentGeneration==7
' >/dev/null

# Exact idempotence is accepted; any different active identity is rejected.
printf '%s\n' "$payload" | python3 "$HELPER" --file "$journal" stage >/dev/null
different="$(jq '.rollback.deploymentGeneration=8' <<<"$payload")"
if printf '%s\n' "$different" | python3 "$HELPER" --file "$journal" stage >/dev/null 2>&1; then
  echo '[attempt-journal-test] non-identical active journal escaped' >&2; exit 1
fi

python3 "$HELPER" --file "$journal" mark-db-staged "$candidate" "$source" >/dev/null
python3 "$HELPER" --file "$journal" transition ABORTED "$candidate" "$source" - VALIDATION_FAILED >/dev/null
python3 "$HELPER" --file "$journal" transition ABORTED "$candidate" "$source" - VALIDATION_FAILED >/dev/null
if python3 "$HELPER" --file "$journal" transition ABORTED "$candidate" "$source" - OTHER_FAILURE >/dev/null 2>&1; then
  echo '[attempt-journal-test] divergent terminal CAS escaped' >&2; exit 1
fi
if python3 "$HELPER" --file "$journal" clear-terminal PROMOTED "$candidate" "$source" >/dev/null 2>&1; then
  echo '[attempt-journal-test] wrong terminal clear escaped' >&2; exit 1
fi
if python3 "$HELPER" --file "$journal" clear-terminal ABORTED "$candidate" "$source" >/dev/null 2>&1; then
  echo '[attempt-journal-test] incomplete rollback clear escaped' >&2; exit 1
fi
python3 "$HELPER" --file "$journal" advance-rollback "$candidate" "$source" ABORT_AUTHORIZED PHYSICAL_RESTORED >/dev/null
python3 "$HELPER" --file "$journal" advance-rollback "$candidate" "$source" PHYSICAL_RESTORED RESTORED_VERIFIED >/dev/null
python3 "$HELPER" --file "$journal" clear-terminal ABORTED "$candidate" "$source" >/dev/null
[[ ! -e "$journal" ]]

# PROMOTED requires an immutable runtime identity and fixed reason.
printf '%s\n' "$payload" | python3 "$HELPER" --file "$journal" stage >/dev/null
python3 "$HELPER" --file "$journal" mark-db-staged "$candidate" "$source" >/dev/null
python3 "$HELPER" --file "$journal" transition PROMOTED "$candidate" "$source" "$runtime" PROMOTION_COMMITTED >/dev/null
python3 "$HELPER" --file "$journal" read | jq -e --arg runtime "$runtime" '
  .lifecycleStatus=="PROMOTED" and .runtimeIdentityHash==$runtime
  and .terminalReason=="PROMOTION_COMMITTED"
' >/dev/null
python3 "$HELPER" --file "$journal" clear-terminal PROMOTED "$candidate" "$source" >/dev/null

# A non-canonical same-source retry is truthfully ABORTED in DB and journal,
# but DISARMED because the canonical source promotion must never be restored.
printf '%s\n' "$payload" | python3 "$HELPER" --file "$journal" stage >/dev/null
python3 "$HELPER" --file "$journal" mark-db-staged "$candidate" "$source" >/dev/null
python3 "$HELPER" --file "$journal" transition ABORTED "$candidate" "$source" "$runtime" \
  RECONCILED_TO_EXISTING_SOURCE_PROMOTION >/dev/null
python3 "$HELPER" --file "$journal" read | jq -e --arg runtime "$runtime" '
  .lifecycleStatus=="ABORTED" and .rollbackStage=="DISARMED"
  and .runtimeIdentityHash==$runtime
  and .terminalReason=="RECONCILED_TO_EXISTING_SOURCE_PROMOTION"
' >/dev/null
python3 "$HELPER" --file "$journal" clear-terminal ABORTED "$candidate" "$source" >/dev/null

# A first-upgrade failure before the lifecycle migration may retire only the
# observe-only, never-mutated snapshot path.
printf '%s\n' "$payload" | python3 "$HELPER" --file "$journal" stage >/dev/null
python3 "$HELPER" --file "$journal" cancel-pre-runtime "$candidate" "$source" >/dev/null
python3 "$HELPER" --file "$journal" read | jq -e '
  .lifecycleStatus=="ABORTED" and .rollbackStage=="RESTORED_VERIFIED"
  and .dbAttemptStaged==false and .terminalReason=="PRE_RUNTIME_FAILURE"
' >/dev/null
python3 "$HELPER" --file "$journal" clear-terminal ABORTED "$candidate" "$source" >/dev/null

# Strict parsing rejects duplicate keys, wrong modes, symlink targets and a
# parent path that resolves through a symlink.
duplicate="$(sed 's/{/{\"schemaVersion\":2,/' <<<"$payload")"
if printf '%s\n' "$duplicate" | python3 "$HELPER" --file "$journal" stage >/dev/null 2>&1; then
  echo '[attempt-journal-test] duplicate JSON key escaped' >&2; exit 1
fi
printf '%s\n' "$payload" | python3 "$HELPER" --file "$journal" stage >/dev/null
chmod 0644 "$journal"
if python3 "$HELPER" --file "$journal" read >/dev/null 2>&1; then
  echo '[attempt-journal-test] non-0600 journal escaped' >&2; exit 1
fi
rm -f "$journal"
ln -s "$work/outside" "$journal"
if python3 "$HELPER" --file "$journal" read >/dev/null 2>&1; then
  echo '[attempt-journal-test] journal symlink escaped' >&2; exit 1
fi
rm -f "$journal"
mkdir "$work/real-parent"
ln -s "$work/real-parent" "$work/link-parent"
if printf '%s\n' "$payload" | python3 "$HELPER" --file "$work/link-parent/attempt.json" stage >/dev/null 2>&1; then
  echo '[attempt-journal-test] symlink parent escaped' >&2; exit 1
fi
mkdir "$work/writable-parent"
chmod 0770 "$work/writable-parent"
if printf '%s\n' "$payload" | python3 "$HELPER" --file "$work/writable-parent/attempt.json" stage >/dev/null 2>&1; then
  echo '[attempt-journal-test] group-writable parent escaped' >&2; exit 1
fi

echo '[attempt-journal-test] PASS atomic=fsync+replace mode=0600 strict=keys+duplicates+symlinks+owner+parent lifecycle=STAGED-to-PROMOTED-or-ABORTED exactCAS=pass'
