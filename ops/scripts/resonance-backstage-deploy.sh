#!/usr/bin/env bash
set -euo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
APP="$ROOT/platform/control-plane/backstage"
BUILD_TMP_ROOT="${BACKSTAGE_BUILD_TMP_ROOT:-/opt/resonance-data/control-plane/build-tmp/backstage}"
DEPENDENCY_CACHE_ROOT="${BACKSTAGE_DEPENDENCY_CACHE_ROOT:-/opt/resonance-data/control-plane/dependency-cache/backstage}"
BUILDKIT_CACHE_ROOT="${BACKSTAGE_BUILDKIT_CACHE_ROOT:-/opt/resonance-data/control-plane/build-cache/backstage-buildkit}"
mkdir -p "$BUILD_TMP_ROOT"
TMPDIR="$(mktemp -d "$BUILD_TMP_ROOT/run.XXXXXXXX")"
case "$(readlink -f "$TMPDIR")" in
  "$(readlink -f "$BUILD_TMP_ROOT")"/*) ;;
  *) echo "[backstage] unsafe build temp path: $TMPDIR" >&2; exit 2 ;;
esac
export TMPDIR
WORKTREE_LOCKED=false
if [[ -f "$ROOT/.git" ]]; then
  git -C "$ROOT" worktree lock --reason "resonance-backstage-deploy" "$ROOT"
  WORKTREE_LOCKED=true
fi
cleanup_build_tmp() {
  local resolved
  resolved="$(readlink -f "$TMPDIR" 2>/dev/null || true)"
  case "$resolved" in
    "$(readlink -f "$BUILD_TMP_ROOT")"/*) rm -rf -- "$resolved" ;;
  esac
  if [[ "$WORKTREE_LOCKED" == "true" ]]; then
    git -C "$ROOT" worktree unlock "$ROOT" >/dev/null 2>&1 || true
  fi
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

phase_started_at=0
deploy_started_at="$(date +%s)"
start_phase() {
  phase_started_at="$(date +%s)"
  echo "[backstage][timing] start $1"
}
finish_phase() {
  local phase_name="$1" elapsed
  elapsed="$(( $(date +%s) - phase_started_at ))"
  echo "[backstage][timing] finish $phase_name seconds=$elapsed"
}

run_yarn_script_if_defined() {
  local script_name="$1"
  if node -e \
    'const p=require("./package.json"); process.exit(p.scripts?.[process.argv[1]] ? 0 : 1)' \
    "$script_name"; then
    corepack yarn "$script_name"
  else
    echo "[backstage] optional validator is not registered in this source revision: $script_name"
  fi
}

build_backstage_application() {
  local typecheck_log bundle_log typecheck_pid bundle_pid typecheck_rc bundle_rc
  typecheck_log="$TMPDIR/typecheck.log"
  bundle_log="$TMPDIR/backend-bundle.log"
  # TypeScript validation only reads the source graph while the Backstage
  # package build writes packages/backend/dist. Running both concurrently
  # removes the typecheck duration from the critical path without weakening
  # either fail-closed gate.
  corepack yarn tsc >"$typecheck_log" 2>&1 &
  typecheck_pid="$!"
  corepack yarn build:backend >"$bundle_log" 2>&1 &
  bundle_pid="$!"
  typecheck_rc=0
  bundle_rc=0
  wait "$typecheck_pid" || typecheck_rc="$?"
  wait "$bundle_pid" || bundle_rc="$?"
  cat "$typecheck_log"
  cat "$bundle_log"
  if (( typecheck_rc != 0 || bundle_rc != 0 )); then
    echo "[backstage] concurrent application build failed: typecheck=$typecheck_rc bundle=$bundle_rc" >&2
    return 1
  fi
  echo "[backstage] TypeScript and backend bundle gates completed concurrently"
}

install_backstage_dependencies() {
  local cache_key cache_dir cache_modules cache_state cache_lock state_marker
  cache_key="$(
    {
      sha256sum "$APP/yarn.lock" "$APP/package.json" | awk '{print $1}'
      node --version
      corepack yarn --version
    } | sha256sum | awk '{print $1}'
  )"
  cache_dir="$DEPENDENCY_CACHE_ROOT/$cache_key"
  cache_modules="$cache_dir/node_modules"
  cache_state="$cache_dir/install-state.gz"
  cache_lock="$DEPENDENCY_CACHE_ROOT/.cache.lock"
  state_marker="$APP/node_modules/.resonance-immutable-cache-key"
  mkdir -p "$DEPENDENCY_CACHE_ROOT"
  exec 8>"$cache_lock"
  flock -w 300 8 || {
    echo "[backstage] dependency cache lock timed out" >&2
    return 1
  }
  if [[ -d "$APP/node_modules" &&
        -x "$APP/node_modules/.bin/backstage-cli" &&
        -x "$APP/node_modules/.bin/tsc" &&
        -f "$state_marker" &&
        "$(cat "$state_marker")" == "$cache_key" ]]; then
    echo "[backstage] dependency state matches immutable cache $cache_key; install skipped"
    flock -u 8
    return 0
  fi
  if [[ ! -d "$APP/node_modules" && -d "$cache_modules" && -f "$cache_state" ]]; then
    echo "[backstage] restoring immutable dependency tree from cache $cache_key"
    cp -al -- "$cache_modules" "$APP/node_modules"
    mkdir -p "$APP/.yarn"
    cp -a -- "$cache_state" "$APP/.yarn/install-state.gz"
    printf '%s\n' "$cache_key" >"$state_marker"
    # The key is derived from the immutable lockfile, root manifest and tool
    # versions. Re-running Yarn mutates/rebuilds an otherwise exact hard-linked
    # tree and costs 15-20 seconds on every isolated deployment.
    flock -u 8
    return 0
  fi
  if corepack yarn install --immutable; then
    printf '%s\n' "$cache_key" >"$state_marker"
    if [[ ! -d "$cache_modules" ]]; then
      local cache_tmp
      cache_tmp="$(mktemp -d "$DEPENDENCY_CACHE_ROOT/.${cache_key}.XXXXXX")"
      cp -al -- "$APP/node_modules" "$cache_tmp/node_modules"
      if [[ -f "$APP/.yarn/install-state.gz" ]]; then
        cp -a -- "$APP/.yarn/install-state.gz" "$cache_tmp/install-state.gz"
      fi
      mv -- "$cache_tmp" "$cache_dir"
      echo "[backstage] dependency cache populated $cache_key"
    fi
    flock -u 8
    return 0
  fi
  local modules_path resolved_app resolved_modules
  modules_path="$APP/node_modules"
  resolved_app="$(readlink -f "$APP")"
  resolved_modules="$(readlink -m "$modules_path")"
  case "$resolved_modules" in
    "$resolved_app"/node_modules)
      echo "[backstage] dependency link failed; rebuilding the isolated node_modules tree once" >&2
      rm -rf -- "$resolved_modules"
      corepack yarn install --immutable
      printf '%s\n' "$cache_key" >"$state_marker"
      ;;
    *)
      echo "[backstage] refusing unsafe node_modules cleanup: $resolved_modules" >&2
      return 2
      ;;
  esac
  flock -u 8
}

for command in git node corepack docker kubectl openssl curl flock sha256sum; do
  require "$command"
done
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
BACKSTAGE_TLS_DIR="${BACKSTAGE_TLS_DIR:-/opt/resonance-data/pki/resonance-internal-ca}"
CURL_TLS_ARGS=()
OIDC_READY=false
leader=""

find_patroni_leader() {
  local pod
  leader=""
  while IFS= read -r pod; do
    if [[ "$(kubectl -n carbonet-prod exec "$pod" -c patroni -- \
      psql -h 127.0.0.1 -U postgres -d postgres -Atqc \
      'select pg_is_in_recovery()' 2>/dev/null || true)" == "f" ]]; then
      leader="$pod"
      break
    fi
  done < <(kubectl -n carbonet-prod get pods -l app=postgres-patroni -o name | sed 's#pod/##')
  [[ -n "$leader" ]] || {
    echo "[backstage] writable PostgreSQL leader not found" >&2
    return 1
  }
}

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
  if kubectl -n "$NAMESPACE" get secret resonance-backstage-oidc-client >/dev/null 2>&1; then
    metadata_url="$(kubectl -n "$NAMESPACE" get secret resonance-backstage-oidc-client \
      -o jsonpath='{.data.AUTH_OIDC_METADATA_URL}' | base64 -d)"
    client_id="$(kubectl -n "$NAMESPACE" get secret resonance-backstage-oidc-client \
      -o jsonpath='{.data.AUTH_OIDC_CLIENT_ID}' | base64 -d)"
    client_secret="$(kubectl -n "$NAMESPACE" get secret resonance-backstage-oidc-client \
      -o jsonpath='{.data.AUTH_OIDC_CLIENT_SECRET}' | base64 -d)"
    display_name="$(kubectl -n "$NAMESPACE" get secret resonance-backstage-oidc-client \
      -o jsonpath='{.data.AUTH_OIDC_DISPLAY_NAME}' | base64 -d)"
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
    metadata="$(curl "${CURL_TLS_ARGS[@]}" -fsS --max-time 10 \
      "$metadata_url" 2>/dev/null || true)"
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

ensure_runtime_preview_https() {
  local preview_host preview_tls_dir
  preview_host="${RESONANCE_PREVIEW_HOST:-resonance.172.16.1.232.nip.io}"
  preview_tls_dir="${RESONANCE_PREVIEW_TLS_DIR:-$HOME/.config/resonance/runtime-preview-tls}"
  mkdir -p "$preview_tls_dir"
  chmod 700 "$preview_tls_dir"
  if [[ ! -s "$preview_tls_dir/tls.crt" ||
        ! -s "$preview_tls_dir/tls.key" ]] ||
    ! openssl x509 -in "$preview_tls_dir/tls.crt" -noout -checkend 604800 >/dev/null 2>&1 ||
    ! openssl x509 -in "$preview_tls_dir/tls.crt" -noout -ext subjectAltName 2>/dev/null | grep -q "DNS:$preview_host"; then
    openssl req -newkey rsa:3072 -sha256 -nodes \
      -keyout "$preview_tls_dir/tls.key" \
      -out "$preview_tls_dir/tls.csr" \
      -subj "/CN=$preview_host" \
      -addext "subjectAltName=DNS:$preview_host"
    openssl x509 -req -sha256 \
      -in "$preview_tls_dir/tls.csr" \
      -CA "$BACKSTAGE_TLS_DIR/ca.crt" \
      -CAkey "$BACKSTAGE_TLS_DIR/ca.key" \
      -CAcreateserial \
      -out "$preview_tls_dir/tls.crt" \
      -days 825 -copy_extensions copy
    chmod 600 "$preview_tls_dir/tls.key"
  fi
  kubectl -n carbonet-prod create secret tls resonance-preview-tls \
    --cert="$preview_tls_dir/tls.crt" --key="$preview_tls_dir/tls.key" \
    --dry-run=client -o yaml | kubectl apply -f -
  cat <<YAML | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: resonance-preview
  namespace: carbonet-prod
spec:
  ingressClassName: nginx
  tls:
    - hosts: [$preview_host]
      secretName: resonance-preview-tls
  rules:
    - host: $preview_host
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: carbonet-web
                port:
                  number: 80
YAML
}

wait_for_runtime() {
  local attempt
  for attempt in $(seq 1 30); do
    if curl "${CURL_TLS_ARGS[@]}" -fsS --max-time 10 \
      "$BACKSTAGE_URL/.backstage/health/v1/readiness" >/dev/null; then
      return 0
    fi
    sleep 0.5
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
    sleep 0.5
  done
  echo "[backstage] catalog did not reach $BACKSTAGE_MIN_CATALOG_ENTITIES entities" >&2
  return 1
}

wait_for_catalog_database() {
  local attempt count
  for attempt in $(seq 1 30); do
    count="$(kubectl -n carbonet-prod exec "$leader" -c patroni -- \
      psql -h 127.0.0.1 -U postgres -d backstage_plugin_catalog -Atqc \
      'select count(*) from final_entities' 2>/dev/null || true)"
    if [[ "$count" =~ ^[0-9]+$ ]] &&
      (( count >= BACKSTAGE_MIN_CATALOG_ENTITIES )); then
      echo "[backstage] catalog ready in database: $count entities"
      return 0
    fi
    sleep 0.5
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
      install_backstage_dependencies
      corepack yarn tsc
    )
    echo "[backstage] PASS configuration and TypeScript contracts are valid"
    ;;
  deploy)
    start_phase preflight
    bash "$ROOT/ops/scripts/resonance-control-plane.sh" validate
    # Exercise the complete API admission chain before dependency installation,
    # image construction, secret mutation, or rollout. The independent nightly
    # job retains the full 16-route visual regression.
    bash "$ROOT/ops/scripts/resonance-kubernetes-admission-preflight.sh" "$NAMESPACE"
    ensure_tls
    ensure_auth_secret
    ensure_ingress_https_port
    ensure_runtime_preview_https
    finish_phase preflight
    # Tag only production runtime inputs. E2E specifications and documentation
    # still run their own gates but cannot invalidate an identical image.
    tag="$(bash "$ROOT/ops/scripts/resonance-backstage-runtime-fingerprint.sh" "$ROOT" HEAD | cut -c1-12)"
    image="$IMAGE_REPOSITORY:$tag"
    legacy_tag="$(git -C "$ROOT" rev-parse HEAD:platform/control-plane/backstage | cut -c1-12)"
    legacy_image="$IMAGE_REPOSITORY:$legacy_tag"
    if ! docker image inspect "$image" >/dev/null 2>&1 &&
      docker image inspect "$legacy_image" >/dev/null 2>&1; then
      docker tag "$legacy_image" "$image"
      docker push "$image"
      echo "[backstage] promoted verified legacy image to runtime fingerprint: $image"
    fi

    # An immutable image with the same source-tree hash has already passed all
    # dependency-backed generators, TypeScript checks and the backend build.
    # Do not materialize node_modules in a disposable worktree merely to deploy
    # that exact image again after a transient readiness or browser-test error.
    if ! docker image inspect "$image" >/dev/null 2>&1; then
      start_phase application-build
      (
        cd "$APP"
        install_backstage_dependencies
        run_yarn_script_if_defined validate:page-extensions
        run_yarn_script_if_defined generate:ccus-screen-designs
        run_yarn_script_if_defined validate:control-assets
        run_yarn_script_if_defined validate:actor-process-control
        run_yarn_script_if_defined validate:design-release-bridge
        run_yarn_script_if_defined generate:project-registry
        build_backstage_application
      )
      finish_phase application-build
      start_phase image-build
      # Do not exit awk early: with pipefail, closing the pipe can make buildx
      # report SIGPIPE (255) and abort a healthy deployment.
      buildx_driver="$(docker buildx inspect 2>/dev/null | awk '/^Driver:/ {print $2}')"
      if [[ "$buildx_driver" == "docker" || -z "$buildx_driver" ]]; then
        # The Docker driver keeps a daemon-local incremental layer cache but
        # cannot export type=local caches. Selecting by capability prevents a
        # cache optimization from breaking an otherwise healthy rollout.
        DOCKER_BUILDKIT=1 docker build \
          -t "$image" \
          -f "$APP/packages/backend/Dockerfile" \
          "$APP"
      else
        build_cache_args=()
        mkdir -p "$(dirname "$BUILDKIT_CACHE_ROOT")"
        if [[ -s "$BUILDKIT_CACHE_ROOT/index.json" ]]; then
          build_cache_args+=(--cache-from "type=local,src=$BUILDKIT_CACHE_ROOT")
        fi
        rm -rf -- "$BUILDKIT_CACHE_ROOT.next"
        docker buildx build \
          --load \
          "${build_cache_args[@]}" \
          --cache-to "type=local,dest=$BUILDKIT_CACHE_ROOT.next,mode=max" \
          -t "$image" \
          -f "$APP/packages/backend/Dockerfile" \
          "$APP"
        rm -rf -- "$BUILDKIT_CACHE_ROOT.previous"
        if [[ -d "$BUILDKIT_CACHE_ROOT" ]]; then
          mv -- "$BUILDKIT_CACHE_ROOT" "$BUILDKIT_CACHE_ROOT.previous"
        fi
        mv -- "$BUILDKIT_CACHE_ROOT.next" "$BUILDKIT_CACHE_ROOT"
        rm -rf -- "$BUILDKIT_CACHE_ROOT.previous"
      fi
      finish_phase image-build
      start_phase image-push
      docker push "$image"
      finish_phase image-push
    else
      echo "[backstage] reusing verified application image without dependency install: $image"
    fi

    start_phase runtime-config
    find_patroni_leader

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
    kubectl -n carbonet-prod get secret resonance-ops-bridge -o json \
      | jq 'del(.metadata.namespace,.metadata.resourceVersion,.metadata.uid,.metadata.creationTimestamp,.metadata.managedFields)
            | .metadata.namespace="resonance-ops"' \
      | kubectl apply -f -
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
    # Roll out exactly once. The image, auth mode and catalog digest together
    # define the pod template; an unchanged digest must not restart a healthy
    # runtime, while a catalog-only change still converges immediately.
    catalog_digest="$(
      sha256sum \
        "$ROOT/platform/control-plane/catalog/organization.yaml" \
        "$ROOT/platform/control-plane/catalog/systems.yaml" \
        "$ROOT/platform/control-plane/catalog/components.yaml" \
        "$ROOT/platform/control-plane/catalog/apis.yaml" \
        "$ROOT/platform/control-plane/catalog/resources.yaml" \
        "$ROOT/platform/control-plane/catalog/environments.yaml" |
        sha256sum | awk '{print $1}'
    )"
    kubectl -n "$NAMESPACE" patch deployment resonance-backstage --type=merge \
      -p="{\"spec\":{\"template\":{\"metadata\":{\"annotations\":{\"resonance.io/catalog-digest\":\"$catalog_digest\"}}}}}"
    finish_phase runtime-config
    start_phase rollout-readiness
    kubectl -n "$NAMESPACE" rollout status deployment/resonance-backstage --timeout=600s
    wait_for_runtime
    if [[ "$OIDC_READY" == "true" ]]; then
      wait_for_catalog_database
    else
      wait_for_catalog
    fi
    finish_phase rollout-readiness
    echo "[backstage][timing] total seconds=$(( $(date +%s) - deploy_started_at )) target=60"
    echo "[backstage] PASS deployed $image at $BACKSTAGE_URL"
    ;;
  status)
    ensure_tls
    ensure_auth_secret
    kubectl -n "$NAMESPACE" get deployment,pod,service -l app.kubernetes.io/name=resonance-backstage -o wide
    curl "${CURL_TLS_ARGS[@]}" -fsS --max-time 10 "$BACKSTAGE_URL/.backstage/health/v1/readiness"
    echo
    if [[ "$OIDC_READY" == "true" ]]; then
      find_patroni_leader
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
