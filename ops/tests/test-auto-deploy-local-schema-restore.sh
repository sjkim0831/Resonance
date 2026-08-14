#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY="$ROOT/ops/scripts/auto-deploy-main.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

python3 - "$DEPLOY" "$tmp/functions.sh" <<'PY'
import pathlib, sys
source = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
start = source.index("# BEGIN isolated-local-schema-restore")
end = source.index("# END isolated-local-schema-restore", start)
pathlib.Path(sys.argv[2]).write_text(source[start:end], encoding="utf-8")
PY
# shellcheck source=/dev/null
source "$tmp/functions.sh"

target_commit=0123456789abcdef0123456789abcdef01234567
schema="$tmp/schema.dump"
flyway="$tmp/flyway.dump"
printf 'schema fixture\n' >"$schema"
printf 'flyway fixture\n' >"$flyway"
STATE_DIR="$tmp/state"
mkdir -p "$STATE_DIR"
FAKE_MODE=success
printf '0\n' >"$STATE_DIR/container"
printf '0\n' >"$STATE_DIR/marker-polls"
printf '0\n' >"$STATE_DIR/early-ready"
printf '0\n' >"$STATE_DIR/rm-calls"
OWNED_ID="$(printf '%064d' 2)"
FOREIGN_ID="$(printf '%064d' 3)"

schema_restore_docker() {
  local command="${1:-}"
  shift || true
  case "$command" in
    info) return 0 ;;
    image)
      [[ "${1:-}" == inspect ]]
      printf 'sha256:%064d\n' 1
      ;;
    run)
      if [[ "$FAKE_MODE" == preexisting_name ]]; then
        printf '2\n' >"$STATE_DIR/container"
        return 1
      fi
      if [[ "$FAKE_MODE" == run_fail ]]; then
        printf '0\n' >"$STATE_DIR/container"
        return 1
      fi
      [[ "$FAKE_MODE" == label_mismatch ]] \
        && printf '3\n' >"$STATE_DIR/container" \
        || printf '1\n' >"$STATE_DIR/container"
      printf '%s\n' "$OWNED_ID"
      ;;
    logs)
      local marker_polls
      marker_polls="$(<"$STATE_DIR/marker-polls")"
      marker_polls=$((marker_polls + 1))
      printf '%s\n' "$marker_polls" >"$STATE_DIR/marker-polls"
      if (( marker_polls >= 3 )); then
        printf '%s\n' 'PostgreSQL init process complete; ready for start up.'
      fi
      ;;
    container)
      local sub="${1:-}"
      shift || true
      [[ "$sub" == inspect ]]
      local state target owned_name
      state="$(<"$STATE_DIR/container")"
      owned_name="${schema_restore_container:-${container_name:-}}"
      if [[ "${1:-}" == --format ]]; then
        local format="${2:-}"
        target="${3:-}"
        if [[ "$format" == '{{.State.Running}}' ]]; then
          [[ ( "$state" == 1 || "$state" == 3 ) \
             && ( "$target" == "$OWNED_ID" || "$target" == "$owned_name" ) ]] \
            && printf 'true\n'
        fi
      else
        target="${1:-}"
        if [[ ( "$state" == 1 || "$state" == 3 ) \
           && ( "$target" == "$OWNED_ID" || "$target" == "$owned_name" ) ]]; then
          local purpose=predeploy-schema-restore
          [[ "$state" == 3 ]] && purpose=foreign-purpose
          jq -cn --arg id "$OWNED_ID" --arg name "/$owned_name" \
            --arg image "sha256:$(printf '%064d' 1)" --arg source "$target_commit" \
            --arg purpose "$purpose" '[{
              Id:$id,Name:$name,Image:$image,
              HostConfig:{NetworkMode:"none",Binds:null,Tmpfs:{"/var/lib/postgresql/data":"rw,noexec,nosuid,size=805306368"}},
              Config:{Labels:{"resonance.ai/purpose":$purpose,"resonance.ai/source-commit":$source}}
            }]'
        elif [[ "$state" == 2 && "$target" == "$owned_name" ]]; then
          jq -cn --arg id "$FOREIGN_ID" --arg name "/$owned_name" '[{
            Id:$id,Name:$name,Image:"sha256:foreign",
            HostConfig:{NetworkMode:"bridge",Binds:null,Tmpfs:{}},
            Config:{Labels:{"resonance.ai/purpose":"foreign"}}
          }]'
        else
          return 1
        fi
      fi
      ;;
    exec)
      local interactive=false
      if [[ "${1:-}" == -i ]]; then interactive=true; shift; fi
      local container="${1:-}"; shift || true
      [[ ( "$(<"$STATE_DIR/container")" == 1 || "$(<"$STATE_DIR/container")" == 3 ) \
         && ( "$container" == "$OWNED_ID" || "$container" == "$schema_restore_container" ) ]] \
        || return 1
      case "${1:-}" in
        pg_isready)
          if (( $(<"$STATE_DIR/marker-polls") < 3 )); then
            local early_ready
            early_ready="$(<"$STATE_DIR/early-ready")"
            printf '%s\n' "$((early_ready + 1))" >"$STATE_DIR/early-ready"
          fi
          return 0
          ;;
        postgres)
          printf '%s\n' 'postgres (PostgreSQL) 16.3'
          ;;
        pg_restore)
          if [[ " $* " == *' --version '* ]]; then
            printf '%s\n' 'pg_restore (PostgreSQL) 16.3'
          elif [[ " $* " == *' --list '* ]]; then
            cat >/dev/null
            printf '%s\n' '1; 0 0 TABLE public fixture postgres'
          elif [[ "$FAKE_MODE" == partial_restore ]]; then
            cat >/dev/null
            return 1
          else
            cat >/dev/null
          fi
          ;;
        psql)
          if [[ " $* " == *"server_version_num"* ]]; then
            printf '160003\n'
          elif [[ " $* " == *'carbonet_flyway_schema_history'* ]]; then
            [[ "$FAKE_MODE" == row_zero ]] && printf '0\n' || printf '399\n'
          elif [[ " $* " == *'relnamespace not in'* ]]; then
            printf '1216\n'
          fi
          ;;
        *) return 1 ;;
      esac
      ;;
    rm)
      local rm_calls
      rm_calls="$(<"$STATE_DIR/rm-calls")"
      printf '%s\n' "$((rm_calls + 1))" >"$STATE_DIR/rm-calls"
      local remove_target="${*: -1}"
      [[ "$remove_target" == "$OWNED_ID" ]] || return 1
      if [[ "$FAKE_MODE" == residue ]]; then
        return 1
      fi
      [[ "$(<"$STATE_DIR/container")" == 1 ]] || return 1
      printf '0\n' >"$STATE_DIR/container"
      ;;
    *) return 1 ;;
  esac
}

reset_case() {
  FAKE_MODE="$1"
  printf '0\n' >"$STATE_DIR/container"
  printf '0\n' >"$STATE_DIR/marker-polls"
  printf '0\n' >"$STATE_DIR/early-ready"
  printf '0\n' >"$STATE_DIR/rm-calls"
  schema_restore_database=""
  schema_restore_container=""
  schema_restore_container_id=""
  schema_restore_image_ref=""
  schema_restore_image_id=""
  schema_restore_postgres_version=""
  schema_restore_verifier=""
  restored_history_count=""
  restored_schema_object_count=""
  unset CARBONET_LOCAL_SCHEMA_RESTORE_IMAGE || true
}

reset_case success
verify_schema_backup_restore_locally "$schema" "$flyway" 399 1216
[[ "$schema_restore_verifier" == local-pg16-tmpfs ]]
[[ "$schema_restore_image_ref" == postgres@sha256:11a9d238fbb48bab14599c57e41123254452b1a2d93c6c8595bce96f346bd082 ]]
[[ "$restored_history_count" == 399 && "$restored_schema_object_count" == 1216 ]]
[[ "$(<"$STATE_DIR/early-ready")" == 0 ]]
[[ "$(<"$STATE_DIR/marker-polls")" -ge 3 ]]
[[ "$(<"$STATE_DIR/rm-calls")" == 1 && "$(<"$STATE_DIR/container")" == 0 ]]
[[ -z "$schema_restore_database" ]]

reset_case partial_restore
partial_rc=0
verify_schema_backup_restore_locally "$schema" "$flyway" 399 1216 || partial_rc=$?
[[ "$partial_rc" == 1 && "$(<"$STATE_DIR/rm-calls")" == 1 && "$(<"$STATE_DIR/container")" == 0 ]]
# A failed local attempt must not lend its image/version/counts to Patroni
# fallback evidence.
[[ -z "$schema_restore_image_id" && -z "$schema_restore_postgres_version" \
   && -z "$schema_restore_image_ref" && -z "$schema_restore_verifier" \
   && -z "$restored_history_count" \
   && -z "$restored_schema_object_count" ]]
schema_restore_verifier=patroni-scratch
[[ -z "$schema_restore_image_id" ]]

reset_case row_zero
row_rc=0
verify_schema_backup_restore_locally "$schema" "$flyway" 399 1216 || row_rc=$?
[[ "$row_rc" == 1 && "$(<"$STATE_DIR/rm-calls")" == 1 && "$(<"$STATE_DIR/container")" == 0 ]]

reset_case residue
residue_rc=0
verify_schema_backup_restore_locally "$schema" "$flyway" 399 1216 || residue_rc=$?
[[ "$residue_rc" == 79 && "$(<"$STATE_DIR/container")" == 1 ]]
FAKE_MODE=success
printf '0\n' >"$STATE_DIR/container"
schema_restore_container=""
schema_restore_container_id=""

# A run failure before container creation is proven residue-free and remains
# eligible for the Patroni fallback rather than becoming a false hard failure.
reset_case run_fail
run_fail_rc=0
verify_schema_backup_restore_locally "$schema" "$flyway" 399 1216 || run_fail_rc=$?
[[ "$run_fail_rc" == 2 && "$(<"$STATE_DIR/container")" == 0 ]]
[[ "$(<"$STATE_DIR/rm-calls")" == 0 && -z "$schema_restore_container" \
   && -z "$schema_restore_container_id" ]]

# A foreign container holding the generated name makes docker run fail. Since
# no owned ID was returned, fallback is allowed and no remove is attempted.
reset_case preexisting_name
preexisting_rc=0
verify_schema_backup_restore_locally "$schema" "$flyway" 399 1216 || preexisting_rc=$?
[[ "$preexisting_rc" == 2 && "$(<"$STATE_DIR/container")" == 2 ]]
[[ "$(<"$STATE_DIR/rm-calls")" == 0 && -z "$schema_restore_container" \
   && -z "$schema_restore_container_id" ]]

# If the owned ID disappears and the name is reused, cleanup must fail closed
# without deleting the replacement.
reset_case success
schema_restore_container=carbonet-schema-restore-0123456789ab-123-456
schema_restore_container_id="$OWNED_ID"
printf '2\n' >"$STATE_DIR/container"
id_swap_rc=0
cleanup_local_schema_restore_container || id_swap_rc=$?
[[ "$id_swap_rc" == 79 && "$(<"$STATE_DIR/container")" == 2 \
   && "$(<"$STATE_DIR/rm-calls")" == 0 ]]
schema_restore_container=""
schema_restore_container_id=""

# Matching ID/name is insufficient: both ownership labels must match before
# cleanup may remove anything.
reset_case label_mismatch
label_rc=0
verify_schema_backup_restore_locally "$schema" "$flyway" 399 1216 || label_rc=$?
[[ "$label_rc" == 79 && "$(<"$STATE_DIR/container")" == 3 \
   && "$(<"$STATE_DIR/rm-calls")" == 0 ]]
printf '0\n' >"$STATE_DIR/container"
schema_restore_container=""
schema_restore_container_id=""

# Mutable image tags are never executed by the local fast path.
reset_case success
CARBONET_LOCAL_SCHEMA_RESTORE_IMAGE=postgres:16
unpinned_rc=0
verify_schema_backup_restore_locally "$schema" "$flyway" 399 1216 || unpinned_rc=$?
[[ "$unpinned_rc" == 2 && "$(<"$STATE_DIR/container")" == 0 \
   && "$(<"$STATE_DIR/rm-calls")" == 0 ]]
unset CARBONET_LOCAL_SCHEMA_RESTORE_IMAGE


grep -Fq 'local_restore_rc == 79' "$DEPLOY"
grep -Fq 'using Patroni scratch fallback' "$DEPLOY"
grep -Fq 'verify_schema_backup_restore_in_scratch' "$DEPLOY"
grep -Fq 'restore-evidence.json' "$DEPLOY"
grep -Fq -- '--network none' "$DEPLOY"
grep -Fq -- '--pull never' "$DEPLOY"
grep -Fq 'schema_restore_docker rm -f' "$DEPLOY"
grep -Fq 'schema_restore_docker rm -f -- "$container_id"' "$DEPLOY"
grep -Fq 'postgres@sha256:11a9d238fbb48bab14599c57e41123254452b1a2d93c6c8595bce96f346bd082' "$DEPLOY"
grep -Fq "PostgreSQL init process complete; ready for start up." "$DEPLOY"
grep -Fq "relnamespace not in" "$DEPLOY"
grep -Fq 'sudo -n docker' "$DEPLOY"
grep -Fq 'schema_restore_database_name=' "$DEPLOY"
! grep -Fq 'schema_restore_database="carbonet_schema_verify_${timestamp//-/_}_$$"' "$DEPLOY"

echo '[local-schema-restore] PASS success=1 earlyPgIsReady=blocked partialRestore=fallback row0=fallback runFail=fallback foreignName=remove0 idSwap=hard-fail labelMismatch=hard-fail residue=hard-fail network=none tmpfs=768m image=pinned-digest+immutable-id major=16 evidence=exact-counts'
