#!/usr/bin/env bash
set -euo pipefail

fake_kubectl() {
  local joined=" $* " pod="" index
  if [[ "$joined" == *" get pods "* && "$joined" == *" app=postgres-patroni "* ]]; then
    printf 'patroni-0\npatroni-1\npatroni-2\n'
    return 0
  fi
  if [[ "$joined" == *" exec "* && "$joined" == *" select pg_is_in_recovery() "* ]]; then
    for ((index=1; index<=$#; index+=1)); do
      if [[ "${!index}" == "exec" ]]; then
        index=$((index + 1))
        pod="${!index}"
        break
      fi
    done
    case "${FAKE_PATRONI_STATE:-one}:$pod" in
      one:patroni-1|two:patroni-0|two:patroni-1) printf 'f\n' ;;
      one:patroni-0|one:patroni-2|zero:patroni-0|zero:patroni-1|zero:patroni-2|two:patroni-2) printf 't\n' ;;
      *) echo "unexpected fake Patroni probe state=${FAKE_PATRONI_STATE:-unset} pod=$pod" >&2; return 2 ;;
    esac
    return 0
  fi
  echo "unexpected fake kubectl invocation: $*" >&2
  return 2
}

if [[ "${0##*/}" == "kubectl" ]]; then
  fake_kubectl "$@"
  exit $?
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LIVE="$ROOT/ops/tests/test-auth-logout-revocation-live.sh"
TMP_DIR="$(mktemp -d /tmp/auth-logout-leader-contract.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

fail() {
  echo "[auth-logout-leader-contract] FAIL: $*" >&2
  exit 1
}

assert_source_contract() {
  local candidate="$1"
  grep -Fq "select pg_is_in_recovery()" "$candidate" || return 1
  grep -Fq '${#leaders[@]} != 1' "$candidate" || return 1
  grep -Fq "{range .items[*]}{.metadata.name}" "$candidate" || return 1
  ! grep -Fq ".items[0].metadata.name" "$candidate"
}

assert_source_contract "$LIVE" || fail 'live logout verifier must reject first-pod selection and require exactly one leader'
MUTANT="$TMP_DIR/items-zero-mutant.sh"
sed 's/{range \.items\[\*\]}{\.metadata\.name}{"\\n"}{end}/{.items[0].metadata.name}/' "$LIVE" > "$MUTANT"
if assert_source_contract "$MUTANT"; then
  fail 'items[0] mutation survived the leader contract'
fi

mkdir -p "$TMP_DIR/bin"
install -m 0700 "$ROOT/ops/tests/test-auth-logout-revocation-leader-contract.sh" "$TMP_DIR/bin/kubectl"

run_probe() {
  local state="$1" expected_outcome="$2" expected_value="$3" status=0 output error_file
  error_file="$TMP_DIR/${state}.err"
  output="$(PATH="$TMP_DIR/bin:$PATH" FAKE_PATRONI_STATE="$state" \
    bash "$LIVE" --resolve-leader-only 2>"$error_file")" || status=$?
  if [[ "$expected_outcome" == "pass" ]]; then
    [[ "$status" == "0" && "$output" == "$expected_value" ]] \
      || fail "state=$state expected leader=$expected_value status=0; actual leader=$output status=$status"
  else
    [[ "$status" != "0" ]] || fail "state=$state unexpectedly selected leader=$output"
    grep -Fq "expected exactly one writable Patroni leader; found=${expected_value}" "$error_file" \
      || fail "state=$state did not report leader cardinality=${expected_value}"
  fi
}

run_probe one pass patroni-1
run_probe zero fail 0
run_probe two fail 2

printf '[auth-logout-leader-contract] PASS selected=patroni-1 zeroLeaders=failed twoLeaders=failed items0Mutation=killed\n'
