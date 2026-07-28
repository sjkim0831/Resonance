#!/usr/bin/env bash
set -euo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
APP="$ROOT/platform/control-plane/backstage"
BUILD_TMP_ROOT="${BACKSTAGE_BUILD_TMP_ROOT:-/opt/resonance-data/control-plane/build-tmp/backstage}"
mkdir -p "$BUILD_TMP_ROOT"
TMPDIR="$(mktemp -d "$BUILD_TMP_ROOT/run.XXXXXXXX")"
case "$(readlink -f "$TMPDIR")" in
  "$(readlink -f "$BUILD_TMP_ROOT")"/*) ;;
  *) echo "[backstage] unsafe build temp path: $TMPDIR" >&2; exit 2 ;;
esac
export TMPDIR
cleanup_build_tmp() {
  local resolved
  resolved="$(readlink -f "$TMPDIR" 2>/dev/null || true)"
  case "$resolved" in
    "$(readlink -f "$BUILD_TMP_ROOT")"/*) rm -rf -- "$resolved" ;;
  esac
}
trap cleanup_build_tmp EXIT
MANIFEST="$ROOT/deploy/k8s/control-plane/backstage.yaml"
NAMESPACE="${BACKSTAGE_NAMESPACE:-resonance-ops}"
REGISTRY="${BACKSTAGE_REGISTRY:-localhost:5000}"
IMAGE_REPOSITORY="$REGISTRY/resonance-backstage"
KUBECONFIG="${KUBECONFIG:-/home/sjkim/.kube/config}"
export KUBECONFIG

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[backstage] missing command: $1" >&2
    exit 1
  }
}

for command in git node corepack docker kubectl openssl curl; do require "$command"; done
docker buildx version >/dev/null 2>&1 || {
  echo "[backstage] Docker buildx is required (Ubuntu package: docker-buildx)" >&2
  exit 1
}
[[ -f "$APP/yarn.lock" && -f "$MANIFEST" ]] || {
  echo "[backstage] application or manifest is missing" >&2
  exit 2
}

BACKSTAGE_HOST="${BACKSTAGE_HOST:-backstage.172.16.1.232.nip.io}"
BACKSTAGE_URL="${BACKSTAGE_URL:-https://$BACKSTAGE_HOST}"
BACKSTAGE_MIN_CATALOG_ENTITIES="${BACKSTAGE_MIN_CATALOG_ENTITIES:-22}"
BACKSTAGE_TLS_DIR="${BACKSTAGE_TLS_DIR:-$HOME/.config/resonance/backstage-tls}"
CURL_TLS_ARGS=()
OIDC_READY=false
leader=""

ensure_auth_secret() {
  local session_secret metadata_url client_id client_secret display_name metadata
  if kubectl -n "$NAMESPACE" get secret resonance-backstage-auth >/dev/null 2>&1; then
    session_secret="$(kubectl -n "$NAMESPACE" get secret resonance-backstage-auth \
      -o jsonpath='{.data.AUTH_SESSION_SECRET}' | base64 -d)"
    metadata_url="$(kubectl -n "$NAMESPACE" get secret resonance-backstage-auth \
      -o jsonpath='{.data.AUTH_OIDC_METADATA_URL}' | base64 -d)"
    client_id="$(kubectl -n "$NAMESPACE" get secret resonance-backstage-auth \
      -o jsonpath='{.data.AUTH_OIDC_CLIENT_ID}' | base64 -d)"
    client_secret="$(kubectl -n "$NAMESPACE" get secret resonance-backstage-auth \
      -o jsonpath='{.data.AUTH_OIDC_CLIENT_SECRET}' | base64 -d)"
    display_name="$(kubectl -n "$NAMESPACE" get secret resonance-backstage-auth \
      -o jsonpath='{.data.AUTH_OIDC_DISPLAY_NAME}' | base64 -d)"
  else
    session_secret="$(openssl rand -hex 32)"
    metadata_url=""
    client_id=""
    client_secret=""
    display_name="Resonance 계정"
  fi
  [[ -n "$session_secret" ]] || session_secret="$(openssl rand -hex 32)"
  kubectl -n "$NAMESPACE" create secret generic resonance-backstage-auth \
    --from-literal=AUTH_SESSION_SECRET="$session_secret" \
    --from-literal=AUTH_OIDC_METADATA_URL="$metadata_url" \
    --from-literal=AUTH_OIDC_CLIENT_ID="$client_id" \
    --from-literal=AUTH_OIDC_CLIENT_SECRET="$client_secret" \
    --from-literal=AUTH_OIDC_DISPLAY_NAME="$display_name" \
    --dry-run=client -o yaml | kubectl apply -f -
  if [[ -n "$metadata_url" && -n "$client_id" && -n "$client_secret" ]]; then
    [[ "$metadata_url" == https://* ]] || {
      echo "[backstage] OIDC metadata URL must use HTTPS; guarded guest bootstrap remains enabled" >&2
      return 0
    }
    metadata="$(curl -fsS --max-time 10 "$metadata_url" 2>/dev/null || true)"
    if OIDC_METADATA="$metadata" node -e '
      const value = JSON.parse(process.env.OIDC_METADATA || "{}");
      for (const key of ["issuer", "authorization_endpoint", "token_endpoint", "jwks_uri"]) {
        if (typeof value[key] !== "string" || value[key].length === 0) process.exit(1);
      }
    '; then
      OIDC_READY=true
      echo "[backstage] OIDC configuration and metadata are valid; guest access will be disabled"
    else
      echo "[backstage] OIDC metadata is unreachable or incomplete; guarded guest bootstrap remains enabled" >&2
    fi
  else
    echo "[backstage] OIDC configuration is pending; guarded guest bootstrap remains enabled"
  fi
}

configure_auth_mode() {
  local args guest_rbac
  if [[ "$OIDC_READY" == "true" ]]; then
    args='["node","packages/backend","--config","app-config.yaml","--config","app-config.production.yaml","--config","app-config.oidc.yaml"]'
    guest_rbac=false
  else
    args='["node","packages/backend","--config","app-config.yaml","--config","app-config.production.yaml"]'
    guest_rbac=true
  fi
  kubectl -n "$NAMESPACE" patch deployment resonance-backstage --type=strategic \
    -p="{\"spec\":{\"template\":{\"spec\":{\"containers\":[{\"name\":\"backstage\",\"args\":$args,\"env\":[{\"name\":\"RESONANCE_ALLOW_GUEST_DESIGN_RBAC\",\"value\":\"$guest_rbac\"}]}]}}}}"
}

ensure_tls() {
  mkdir -p "$BACKSTAGE_TLS_DIR"
  chmod 700 "$BACKSTAGE_TLS_DIR"
  if [[ ! -s "$BACKSTAGE_TLS_DIR/ca.crt" ||
        ! -s "$BACKSTAGE_TLS_DIR/tls.crt" ||
        ! -s "$BACKSTAGE_TLS_DIR/tls.key" ]]; then
    openssl req -x509 -newkey rsa:3072 -sha256 -nodes \
      -keyout "$BACKSTAGE_TLS_DIR/ca.key" \
      -out "$BACKSTAGE_TLS_DIR/ca.crt" \
      -days 3650 -subj '/CN=Resonance Internal Root CA'
    openssl req -newkey rsa:3072 -sha256 -nodes \
      -keyout "$BACKSTAGE_TLS_DIR/tls.key" \
      -out "$BACKSTAGE_TLS_DIR/tls.csr" \
      -subj "/CN=$BACKSTAGE_HOST" \
      -addext "subjectAltName=DNS:$BACKSTAGE_HOST"
    openssl x509 -req -sha256 \
      -in "$BACKSTAGE_TLS_DIR/tls.csr" \
      -CA "$BACKSTAGE_TLS_DIR/ca.crt" \
      -CAkey "$BACKSTAGE_TLS_DIR/ca.key" \
      -CAcreateserial \
      -out "$BACKSTAGE_TLS_DIR/tls.crt" \
      -days 825 -copy_extensions copy
    chmod 600 "$BACKSTAGE_TLS_DIR/ca.key" "$BACKSTAGE_TLS_DIR/tls.key"
  fi
  kubectl -n "$NAMESPACE" create secret tls resonance-backstage-tls \
    --cert="$BACKSTAGE_TLS_DIR/tls.crt" \
    --key="$BACKSTAGE_TLS_DIR/tls.key" \
    --dry-run=client -o yaml | kubectl apply -f -
  CURL_TLS_ARGS=(--cacert "$BACKSTAGE_TLS_DIR/ca.crt")
}

ensure_ingress_https_port() {
  local index current
  index="$(kubectl -n ingress-nginx get service ingress-nginx-controller -o json |
    node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s);process.stdout.write(String(v.spec.ports.findIndex(p=>p.name==="https")))})')"
  [[ "$index" =~ ^[0-9]+$ ]] || {
    echo "[backstage] ingress HTTPS service port was not found" >&2
    return 1
  }
  current="$(kubectl -n ingress-nginx get service ingress-nginx-controller \
    -o "jsonpath={.spec.ports[$index].nodePort}")"
  if [[ "$current" != "443" ]]; then
    kubectl -n ingress-nginx patch service ingress-nginx-controller \
      --type=json \
      -p="[{\"op\":\"replace\",\"path\":\"/spec/ports/$index/nodePort\",\"value\":443}]"
  fi
}

wait_for_runtime() {
  local attempt
  for attempt in $(seq 1 30); do
    if curl "${CURL_TLS_ARGS[@]}" -fsS --max-time 10 \
      "$BACKSTAGE_URL/.backstage/health/v1/readiness" >/dev/null; then
      return 0
    fi
    sleep 2
  done
  echo "[backstage] readiness did not converge at $BACKSTAGE_URL" >&2
  return 1
}

wait_for_catalog() {
  local attempt identity token count
  for attempt in $(seq 1 30); do
    identity="$(curl "${CURL_TLS_ARGS[@]}" -fsS --max-time 10 -X POST \
      -H 'content-type: application/json' -d '{}' \
      "$BACKSTAGE_URL/api/auth/guest/refresh" 2>/dev/null || true)"
    token="$(IDENTITY_JSON="$identity" node -e \
      'try { process.stdout.write(JSON.parse(process.env.IDENTITY_JSON).backstageIdentity.token || "") } catch {}')"
    if [[ -n "$token" ]]; then
      count="$(curl "${CURL_TLS_ARGS[@]}" -fsS --max-time 10 \
        -H "authorization: Bearer $token" \
        "$BACKSTAGE_URL/api/catalog/entities" 2>/dev/null |
        node -e \
          'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const v=JSON.parse(s);process.stdout.write(String(Array.isArray(v)?v.length:0))}catch{process.stdout.write("0")}})' ||
        true)"
      if [[ "$count" =~ ^[0-9]+$ ]] &&
        (( count >= BACKSTAGE_MIN_CATALOG_ENTITIES )); then
        echo "[backstage] catalog ready: $count entities"
        return 0
      fi
    fi
    sleep 2
  done
  echo "[backstage] catalog did not reach $BACKSTAGE_MIN_CATALOG_ENTITIES entities" >&2
  return 1
}

wait_for_catalog_database() {
  local attempt count
  for attempt in $(seq 1 30); do
    count="$(kubectl -n carbonet-prod exec "$leader" -c patroni -- \
      psql -h 127.0.0.1 -U postgres -d backstage -Atqc \
      'select count(*) from final_entities' 2>/dev/null || true)"
    if [[ "$count" =~ ^[0-9]+$ ]] &&
      (( count >= BACKSTAGE_MIN_CATALOG_ENTITIES )); then
      echo "[backstage] catalog ready in database: $count entities"
      return 0
    fi
    sleep 2
  done
  echo "[backstage] catalog database did not reach $BACKSTAGE_MIN_CATALOG_ENTITIES entities" >&2
  return 1
}

mode="${1:-deploy}"
case "$mode" in
  configure-oidc)
    : "${AUTH_OIDC_METADATA_URL:?set AUTH_OIDC_METADATA_URL}"
    : "${AUTH_OIDC_CLIENT_ID:?set AUTH_OIDC_CLIENT_ID}"
    : "${AUTH_OIDC_CLIENT_SECRET:?set AUTH_OIDC_CLIENT_SECRET}"
    [[ "$AUTH_OIDC_METADATA_URL" == https://* ]] || {
      echo "[backstage] AUTH_OIDC_METADATA_URL must use HTTPS" >&2
      exit 2
    }
    if kubectl -n "$NAMESPACE" get secret resonance-backstage-auth >/dev/null 2>&1; then
      session_secret="$(kubectl -n "$NAMESPACE" get secret resonance-backstage-auth \
        -o jsonpath='{.data.AUTH_SESSION_SECRET}' | base64 -d)"
    else
      session_secret="$(openssl rand -hex 32)"
    fi
    kubectl -n "$NAMESPACE" create secret generic resonance-backstage-auth \
      --from-literal=AUTH_SESSION_SECRET="$session_secret" \
      --from-literal=AUTH_OIDC_METADATA_URL="$AUTH_OIDC_METADATA_URL" \
      --from-literal=AUTH_OIDC_CLIENT_ID="$AUTH_OIDC_CLIENT_ID" \
      --from-literal=AUTH_OIDC_CLIENT_SECRET="$AUTH_OIDC_CLIENT_SECRET" \
      --from-literal=AUTH_OIDC_DISPLAY_NAME="${AUTH_OIDC_DISPLAY_NAME:-Resonance 계정}" \
      --dry-run=client -o yaml | kubectl apply -f - >/dev/null
    echo "[backstage] OIDC secret updated without exposing credentials; run deploy to validate and activate"
    ;;
  validate)
    bash "$ROOT/ops/scripts/resonance-control-plane.sh" validate
    (
      cd "$APP"
      corepack yarn install --immutable
      corepack yarn tsc
    )
    echo "[backstage] PASS configuration and TypeScript contracts are valid"
    ;;
  deploy)
    bash "$ROOT/ops/scripts/resonance-control-plane.sh" validate
    ensure_tls
    ensure_auth_secret
    ensure_ingress_https_port
    (
      cd "$APP"
      corepack yarn validate:page-extensions
      corepack yarn generate:ccus-screen-designs
      corepack yarn validate:control-assets
corepack yarn validate:actor-process-control
corepack yarn validate:design-release-bridge
      corepack yarn generate:project-registry
    )
    # Tag by the Backstage source tree rather than the repository commit.
    # Documentation, deployment-script, or Carbonet changes then reuse the
    # already verified image without rebuilding an identical application.
    tag="$(git -C "$ROOT" rev-parse HEAD:platform/control-plane/backstage | cut -c1-12)"
    image="$IMAGE_REPOSITORY:$tag"

    # The dependency and Docker caches make subsequent control-plane builds
    # incremental. Carbonet's Java/Vite runtime is never rebuilt here.
    if ! docker image inspect "$image" >/dev/null 2>&1; then
      (
        cd "$APP"
        corepack yarn install --immutable
        corepack yarn tsc
        corepack yarn build:backend
      )
      DOCKER_BUILDKIT=1 docker build -t "$image" -f "$APP/packages/backend/Dockerfile" "$APP"
      docker push "$image"
    else
      echo "[backstage] reusing unchanged application image: $image"
    fi

    while IFS= read -r pod; do
      if [[ "$(kubectl -n carbonet-prod exec "$pod" -c patroni -- \
        psql -h 127.0.0.1 -U postgres -d postgres -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == "f" ]]; then
        leader="$pod"
        break
      fi
    done < <(kubectl -n carbonet-prod get pods -l app=postgres-patroni -o name | sed 's#pod/##')
    [[ -n "$leader" ]] || {
      echo "[backstage] writable PostgreSQL leader not found" >&2
      exit 3
    }

    if kubectl -n "$NAMESPACE" get secret resonance-backstage-database >/dev/null 2>&1; then
      password="$(kubectl -n "$NAMESPACE" get secret resonance-backstage-database \
        -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d)"
    else
      password="$(openssl rand -hex 24)"
    fi
    role_exists="$(kubectl -n carbonet-prod exec "$leader" -c patroni -- \
      psql -h 127.0.0.1 -U postgres -d postgres -Atqc \
      "select 1 from pg_roles where rolname='backstage'")"
    if [[ "$role_exists" != "1" ]]; then
      kubectl -n carbonet-prod exec "$leader" -c patroni -- \
        psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 \
        -c "create role backstage login createdb password '$password'"
    else
      kubectl -n carbonet-prod exec "$leader" -c patroni -- \
        psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 \
        -c "alter role backstage createdb password '$password'"
    fi
    database_exists="$(kubectl -n carbonet-prod exec "$leader" -c patroni -- \
      psql -h 127.0.0.1 -U postgres -d postgres -Atqc \
      "select 1 from pg_database where datname='backstage'")"
    if [[ "$database_exists" != "1" ]]; then
      kubectl -n carbonet-prod exec "$leader" -c patroni -- \
        psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 \
        -c "create database backstage owner backstage"
    fi

    kubectl -n "$NAMESPACE" create secret generic resonance-backstage-database \
      --from-literal=POSTGRES_USER=backstage \
      --from-literal=POSTGRES_PASSWORD="$password" \
      --dry-run=client -o yaml | kubectl apply -f -
    kubectl -n "$NAMESPACE" create configmap resonance-backstage-catalog \
      --from-file="$ROOT/platform/control-plane/catalog/organization.yaml" \
      --from-file="$ROOT/platform/control-plane/catalog/systems.yaml" \
      --from-file="$ROOT/platform/control-plane/catalog/components.yaml" \
      --from-file="$ROOT/platform/control-plane/catalog/apis.yaml" \
      --from-file="$ROOT/platform/control-plane/catalog/resources.yaml" \
      --from-file="$ROOT/platform/control-plane/catalog/environments.yaml" \
      --dry-run=client -o yaml | kubectl apply -f -
    kubectl apply -f "$MANIFEST"
    kubectl -n "$NAMESPACE" set image deployment/resonance-backstage backstage="$image"
    configure_auth_mode
    # A ConfigMap update preserves the image but must create a new pod so the
    # catalog snapshot and database-backed catalog converge immediately.
    kubectl -n "$NAMESPACE" rollout restart deployment/resonance-backstage
    kubectl -n "$NAMESPACE" rollout status deployment/resonance-backstage --timeout=600s
    wait_for_runtime
    if [[ "$OIDC_READY" == "true" ]]; then
      wait_for_catalog_database
    else
      wait_for_catalog
    fi
    echo "[backstage] PASS deployed $image at $BACKSTAGE_URL"
    ;;
  status)
    ensure_tls
    ensure_auth_secret
    kubectl -n "$NAMESPACE" get deployment,pod,service -l app.kubernetes.io/name=resonance-backstage -o wide
    curl "${CURL_TLS_ARGS[@]}" -fsS --max-time 10 "$BACKSTAGE_URL/.backstage/health/v1/readiness"
    echo
    if [[ "$OIDC_READY" == "true" ]]; then
      leader="$(kubectl -n carbonet-prod get pods -l app=postgres-patroni -o name |
        sed 's#pod/##' | head -n1)"
      wait_for_catalog_database
    else
      wait_for_catalog
    fi
    ;;
  *)
    echo "usage: $0 {configure-oidc|validate|deploy|status}" >&2
    exit 64
    ;;
esac
