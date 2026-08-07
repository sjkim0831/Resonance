#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VALIDATOR="$ROOT_DIR/ops/scripts/validate-carbonet-web-nodeport-client-ip-contract.sh"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

pass_count=0
expect_pass() {
  local name="$1" file="$2"
  if "$VALIDATOR" --manifest "$file" >/dev/null 2>&1; then
    pass_count=$((pass_count + 1))
    printf 'PASS %s\n' "$name"
  else
    printf 'FAIL %s expected success\n' "$name" >&2
    exit 1
  fi
}
expect_fail() {
  local name="$1" file="$2"
  if "$VALIDATOR" --manifest "$file" >/dev/null 2>&1; then
    printf 'FAIL %s expected rejection\n' "$name" >&2
    exit 1
  else
    pass_count=$((pass_count + 1))
    printf 'PASS %s\n' "$name"
  fi
}

mkdir -p "$TMP_DIR/bin"
cat > "$TMP_DIR/bin/kubectl" <<'SH'
#!/usr/bin/env bash
printf '%s' "${FAKE_LIVE_CONTRACT:-NodePort|Local}"
SH
chmod +x "$TMP_DIR/bin/kubectl"

if PATH="$TMP_DIR/bin:$PATH" FAKE_LIVE_CONTRACT='NodePort|Local' "$VALIDATOR" --manifest "$ROOT_DIR/manifests/carbonet-split-runtime.yaml" --live >/dev/null 2>&1; then
  pass_count=$((pass_count + 1))
  printf 'PASS live-local\n'
else
  printf 'FAIL live-local expected success\n' >&2
  exit 1
fi
if PATH="$TMP_DIR/bin:$PATH" FAKE_LIVE_CONTRACT='NodePort|Cluster' "$VALIDATOR" --manifest "$ROOT_DIR/manifests/carbonet-split-runtime.yaml" --live >/dev/null 2>&1; then
  printf 'FAIL live-cluster expected rejection\n' >&2
  exit 1
else
  pass_count=$((pass_count + 1))
  printf 'PASS live-cluster\n'
fi

cat > "$TMP_DIR/valid.yaml" <<'YAML'
apiVersion: v1
kind: Service
metadata:
  name: carbonet-web
spec:
  type: NodePort
  externalTrafficPolicy: Local
  selector:
    app: carbonet-web
YAML
expect_pass valid-local "$TMP_DIR/valid.yaml"

sed '/externalTrafficPolicy:/d' "$TMP_DIR/valid.yaml" > "$TMP_DIR/missing.yaml"
expect_fail missing-policy "$TMP_DIR/missing.yaml"

sed 's/externalTrafficPolicy: Local/externalTrafficPolicy: Cluster/' "$TMP_DIR/valid.yaml" > "$TMP_DIR/cluster.yaml"
expect_fail cluster-policy "$TMP_DIR/cluster.yaml"

sed 's/type: NodePort/type: ClusterIP/' "$TMP_DIR/valid.yaml" > "$TMP_DIR/cluster-ip.yaml"
expect_fail non-nodeport "$TMP_DIR/cluster-ip.yaml"

awk '1; /externalTrafficPolicy: Local/ { print "  externalTrafficPolicy: Local" }' "$TMP_DIR/valid.yaml" > "$TMP_DIR/duplicate-policy.yaml"
expect_fail duplicate-policy "$TMP_DIR/duplicate-policy.yaml"

cat "$TMP_DIR/valid.yaml" "$TMP_DIR/valid.yaml" > "$TMP_DIR/duplicate-service.yaml"
expect_fail duplicate-service "$TMP_DIR/duplicate-service.yaml"

cat > "$TMP_DIR/wrong-service.yaml" <<'YAML'
apiVersion: v1
kind: Service
metadata:
  name: carbonet-api
spec:
  type: NodePort
  externalTrafficPolicy: Local
YAML
expect_fail wrong-service "$TMP_DIR/wrong-service.yaml"

expect_pass repository-contract "$ROOT_DIR/manifests/carbonet-split-runtime.yaml"

printf '[carbonet-web-client-ip-contract-test] PASS checks=%d\n' "$pass_count"
