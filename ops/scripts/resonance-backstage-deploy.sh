#!/usr/bin/env bash
set -euo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
APP="$ROOT/platform/control-plane/backstage"
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

BACKSTAGE_URL="${BACKSTAGE_URL:-http://172.16.1.232:30707}"
BACKSTAGE_MIN_CATALOG_ENTITIES="${BACKSTAGE_MIN_CATALOG_ENTITIES:-22}"

wait_for_runtime() {
  local attempt
  for attempt in $(seq 1 30); do
    if curl -fsS --max-time 10 \
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
    identity="$(curl -fsS --max-time 10 -X POST \
      -H 'content-type: application/json' -d '{}' \
      "$BACKSTAGE_URL/api/auth/guest/refresh" 2>/dev/null || true)"
    token="$(IDENTITY_JSON="$identity" node -e \
      'try { process.stdout.write(JSON.parse(process.env.IDENTITY_JSON).backstageIdentity.token || "") } catch {}')"
    if [[ -n "$token" ]]; then
      count="$(curl -fsS --max-time 10 \
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

mode="${1:-deploy}"
case "$mode" in
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

    leader=""
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
    # A ConfigMap update preserves the image but must create a new pod so the
    # catalog snapshot and database-backed catalog converge immediately.
    kubectl -n "$NAMESPACE" rollout restart deployment/resonance-backstage
    kubectl -n "$NAMESPACE" rollout status deployment/resonance-backstage --timeout=600s
    wait_for_runtime
    wait_for_catalog
    echo "[backstage] PASS deployed $image at $BACKSTAGE_URL"
    ;;
  status)
    kubectl -n "$NAMESPACE" get deployment,pod,service -l app.kubernetes.io/name=resonance-backstage -o wide
    curl -fsS --max-time 10 "$BACKSTAGE_URL/.backstage/health/v1/readiness"
    echo
    wait_for_catalog
    ;;
  *)
    echo "usage: $0 {validate|deploy|status}" >&2
    exit 64
    ;;
esac
