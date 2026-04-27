#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/deploy-193-to-221.sh

Purpose:
  Build from a detached worktree, verify canonical app closure,
  upload the canonical app jar, restart the remote runtime, and verify
  remote freshness.

Canonical app jar:
  apps/carbonet-app/target/carbonet.jar

Related checks:
  bash ops/scripts/verify-large-move-app-closure.sh
  bash ops/scripts/codex-verify-18000-freshness.sh
EOF
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REPO_DIR="${REPO_DIR:-$ROOT_DIR}"
PRESSURE_CHECK_SCRIPT="${PRESSURE_CHECK_SCRIPT:-$ROOT_DIR/ops/scripts/check-runtime-pressure.sh}"
BRANCH="${BRANCH:-main}"
REMOTE_NAME="${REMOTE_NAME:-origin}"

BUILD_ROOT="${BUILD_ROOT:-/tmp/carbonet-runtime-deploy}"
BUILD_DIR=""
FETCH_REF=""

DEPLOY_REMOTE_USER="${DEPLOY_REMOTE_USER:-carbonet2026}"
DEPLOY_REMOTE_HOST="${DEPLOY_REMOTE_HOST:-136.117.100.221}"
DEPLOY_REMOTE_ROOT="${DEPLOY_REMOTE_ROOT:-/opt/Resonance}"
DEPLOY_REMOTE_PORT="${DEPLOY_REMOTE_PORT:-22}"
DEPLOY_REMOTE_PASSWORD="${DEPLOY_REMOTE_PASSWORD:-}"

DEPLOY_SERVICE_PORT="${DEPLOY_SERVICE_PORT:-18000}"
DEPLOY_HEALTH_PATH="${DEPLOY_HEALTH_PATH:-/actuator/health}"
DEPLOY_ARTIFACT_NAME="${DEPLOY_ARTIFACT_NAME:-carbonet.jar}"
DEPLOY_SSH_TARGET="${DEPLOY_REMOTE_USER}@${DEPLOY_REMOTE_HOST}"

IDLE_SSH_TARGETS="${IDLE_SSH_TARGETS:-sjkim08314@34.82.132.175 sjkim08315@35.247.80.209}"
NGINX_SITE_SYNC_ENABLED="${NGINX_SITE_SYNC_ENABLED:-true}"
NGINX_SITE_CONFIG_SOURCE="${NGINX_SITE_CONFIG_SOURCE:-$ROOT_DIR/ops/config/nginx/carbonet-duckdns.org.conf.example}"
NGINX_SITE_INSTALL_SCRIPT_SOURCE="${NGINX_SITE_INSTALL_SCRIPT_SOURCE:-$ROOT_DIR/ops/scripts/install-carbonet-duckdns-nginx.sh}"
NGINX_SITE_REMOTE_TMP_CONFIG="${NGINX_SITE_REMOTE_TMP_CONFIG:-/tmp/carbonet-duckdns.org.conf}"
NGINX_SITE_REMOTE_TMP_INSTALL="${NGINX_SITE_REMOTE_TMP_INSTALL:-/tmp/install-carbonet-duckdns-nginx.sh}"
NGINX_SITE_REMOTE_TARGET="${NGINX_SITE_REMOTE_TARGET:-/etc/nginx/sites-enabled/carbonet}"

SSH_OPTS=(
  -o StrictHostKeyChecking=no
  -o UserKnownHostsFile=/dev/null
  -p "$DEPLOY_REMOTE_PORT"
)

log() {
  printf '[deploy-193-to-221] %s\n' "$*"
}

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 1
  fi
}

cleanup() {
  if [[ -n "${BUILD_DIR:-}" && -d "${BUILD_DIR:-}" ]]; then
    git -C "$REPO_DIR" worktree remove --force "$BUILD_DIR" >/dev/null 2>&1 || true
  fi
}

ssh_cmd() {
  if [[ -n "$DEPLOY_REMOTE_PASSWORD" ]]; then
    require_command sshpass
    sshpass -p "$DEPLOY_REMOTE_PASSWORD" ssh "${SSH_OPTS[@]}" "$DEPLOY_SSH_TARGET" "$@"
  else
    ssh "${SSH_OPTS[@]}" "$DEPLOY_SSH_TARGET" "$@"
  fi
}

scp_cmd() {
  if [[ -n "$DEPLOY_REMOTE_PASSWORD" ]]; then
    require_command sshpass
    sshpass -p "$DEPLOY_REMOTE_PASSWORD" scp "${SSH_OPTS[@]}" "$@"
  else
    scp "${SSH_OPTS[@]}" "$@"
  fi
}

print_capacity_snapshot() {
  local target="$1"
  log "capacity snapshot: $target"
  if [[ -n "$DEPLOY_REMOTE_PASSWORD" && "$target" == "$DEPLOY_SSH_TARGET" ]]; then
    ssh_cmd "hostname; free -m; df -h /"
    return 0
  fi
  ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$target" \
    'hostname; free -m; df -h /' || true
}

print_pressure_state() {
  local target="$1"
  if [[ ! -x "$PRESSURE_CHECK_SCRIPT" ]]; then
    log "pressure check skipped: script is not executable: $PRESSURE_CHECK_SCRIPT"
    return 0
  fi

  log "pressure check: $target"
  "$PRESSURE_CHECK_SCRIPT" "$target" || true
}

fetch_latest() {
  cd "$REPO_DIR"
  if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    local auth
    auth="$(printf 'x-access-token:%s' "$GITHUB_TOKEN" | base64 -w0)"
    git -c "http.https://github.com/.extraheader=AUTHORIZATION: basic ${auth}" \
      fetch "$REMOTE_NAME" "$BRANCH"
  else
    git fetch "$REMOTE_NAME" "$BRANCH"
  fi
  FETCH_REF="$(git rev-parse FETCH_HEAD)"
}

prepare_build_worktree() {
  mkdir -p "$BUILD_ROOT"
  BUILD_DIR="$(mktemp -d "$BUILD_ROOT/worktree-XXXXXX")"
  git -C "$REPO_DIR" worktree add --detach "$BUILD_DIR" "$FETCH_REF" >/dev/null
}

build_artifact() {
  local frontend_dir="$BUILD_DIR/frontend"
  local jar_path="$BUILD_DIR/apps/carbonet-app/target/carbonet.jar"

  log "frontend build started"
  (cd "$frontend_dir" && npm run build)

  log "backend package started"
  (cd "$BUILD_DIR" && mvn -q -pl apps/carbonet-app -am -DskipTests package)

  if [[ ! -f "$jar_path" ]]; then
    echo "Built jar not found: $jar_path" >&2
    exit 1
  fi

  log "app closure verification started"
  bash "$BUILD_DIR/ops/scripts/verify-large-move-app-closure.sh"
}

deploy_remote() {
  local remote_tmp="/tmp/${DEPLOY_ARTIFACT_NAME}"
  local remote_target="$DEPLOY_REMOTE_ROOT/apps/carbonet-app/target/${DEPLOY_ARTIFACT_NAME}"
  local remote_backup_dir="$DEPLOY_REMOTE_ROOT/var/backups/manual-deploy"
  local remote_restart="$DEPLOY_REMOTE_ROOT/ops/scripts/restart-18000.sh"
  local remote_verify="$DEPLOY_REMOTE_ROOT/ops/scripts/codex-verify-18000-freshness.sh"
  local jar_path="$BUILD_DIR/apps/carbonet-app/target/carbonet.jar"

  log "prepare remote directories"
  ssh_cmd "mkdir -p '$DEPLOY_REMOTE_ROOT/apps/carbonet-app/target' '$remote_backup_dir'"

  if [[ "$NGINX_SITE_SYNC_ENABLED" == "true" ]]; then
    if [[ ! -f "$NGINX_SITE_CONFIG_SOURCE" ]]; then
      echo "Nginx site config not found: $NGINX_SITE_CONFIG_SOURCE" >&2
      exit 1
    fi
    if [[ ! -f "$NGINX_SITE_INSTALL_SCRIPT_SOURCE" ]]; then
      echo "Nginx install script not found: $NGINX_SITE_INSTALL_SCRIPT_SOURCE" >&2
      exit 1
    fi

    log "upload nginx site config"
    scp_cmd "$NGINX_SITE_CONFIG_SOURCE" "${DEPLOY_SSH_TARGET}:${NGINX_SITE_REMOTE_TMP_CONFIG}"
    scp_cmd "$NGINX_SITE_INSTALL_SCRIPT_SOURCE" "${DEPLOY_SSH_TARGET}:${NGINX_SITE_REMOTE_TMP_INSTALL}"
    ssh_cmd "
      set -euo pipefail
      chmod +x '$NGINX_SITE_REMOTE_TMP_INSTALL'
      sudo '$NGINX_SITE_REMOTE_TMP_INSTALL' '$NGINX_SITE_REMOTE_TMP_CONFIG' '$NGINX_SITE_REMOTE_TARGET'
    "
  else
    log "nginx site sync skipped"
  fi

  log "upload jar to $DEPLOY_SSH_TARGET:$remote_tmp"
  scp_cmd "$jar_path" "${DEPLOY_SSH_TARGET}:${remote_tmp}"

  log "backup current remote jar and replace target"
  ssh_cmd "
    set -euo pipefail
    if [ -f '$remote_target' ]; then
      cp '$remote_target' '$remote_backup_dir/carbonet-$(date +%Y%m%d-%H%M%S).jar'
    fi
    mv '$remote_tmp' '$remote_target'
    bash '$remote_restart'
    bash '$remote_verify'
  "
}

verify_remote() {
  local health_url="http://127.0.0.1:${DEPLOY_SERVICE_PORT}${DEPLOY_HEALTH_PATH}"
  log "remote health check: $health_url"
  ssh_cmd "curl -sS '$health_url'"
}

main() {
  require_command git
  require_command npm
  require_command mvn
  require_command ssh
  require_command scp
  require_command curl
  trap cleanup EXIT

  log "main runtime target: $DEPLOY_SSH_TARGET"
  print_capacity_snapshot "$DEPLOY_SSH_TARGET"
  print_pressure_state "$DEPLOY_SSH_TARGET"

  for idle_target in $IDLE_SSH_TARGETS; do
    print_capacity_snapshot "$idle_target"
    print_pressure_state "$idle_target"
  done

  log "git fetch started"
  fetch_latest
  prepare_build_worktree
  build_artifact
  deploy_remote
  verify_remote

  log "completed"
}

main "$@"
