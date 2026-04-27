#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/jenkins-deploy-carbonet.sh

Purpose:
  Clone the target branch, build the canonical app jar, verify app closure,
  archive the artifact, deploy it to the main runtime, and verify remote freshness.

Canonical app jar:
  apps/carbonet-app/target/carbonet.jar

Related checks:
  bash ops/scripts/verify-large-move-app-closure.sh
  bash ops/scripts/codex-verify-18000-freshness.sh
EOF
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BRANCH="${BRANCH:-main}"
REPO_URL="${REPO_URL:-https://github.com/sjkim0831/2026_carbonet.git}"
WORKSPACE_ROOT="${WORKSPACE_ROOT:-${TMPDIR:-/tmp}}"
BUILD_ROOT=""
BUILD_DIR=""
ARTIFACT_DIR="${ARTIFACT_DIR:-$ROOT_DIR/var/artifacts/jenkins}"
ARTIFACT_NAME="${ARTIFACT_NAME:-carbonet.jar}"
GIT_CREDENTIALS_HEADER="${GIT_CREDENTIALS_HEADER:-}"
MAIN_TARGET="${MAIN_TARGET:-carbonet2026@136.117.100.221}"
MAIN_REMOTE_ROOT="${MAIN_REMOTE_ROOT:-/opt/Resonance}"
MAIN_REMOTE_PASSWORD="${MAIN_REMOTE_PASSWORD:-}"
MAIN_SSH_PASSWORD="${MAIN_SSH_PASSWORD:-$MAIN_REMOTE_PASSWORD}"
IDLE_SCALE_ENABLED="${IDLE_SCALE_ENABLED:-true}"
IDLE_RESTORE_ENABLED="${IDLE_RESTORE_ENABLED:-true}"
IDLE_SSH_PASSWORD="${IDLE_SSH_PASSWORD:-}"
LAST_DEPLOYED_COMMIT_FILE="${LAST_DEPLOYED_COMMIT_FILE:-$ARTIFACT_DIR/last-deployed-${BRANCH}.txt}"
CURRENT_COMMIT_SHA=""
NGINX_SITE_SYNC_ENABLED="${NGINX_SITE_SYNC_ENABLED:-true}"
NGINX_SITE_CONFIG_SOURCE="${NGINX_SITE_CONFIG_SOURCE:-$ROOT_DIR/ops/config/nginx/carbonet-duckdns.org.conf.example}"
NGINX_SITE_INSTALL_SCRIPT_SOURCE="${NGINX_SITE_INSTALL_SCRIPT_SOURCE:-$ROOT_DIR/ops/scripts/install-carbonet-duckdns-nginx.sh}"
NGINX_SITE_REMOTE_TMP_CONFIG="${NGINX_SITE_REMOTE_TMP_CONFIG:-/tmp/carbonet-duckdns.org.conf}"
NGINX_SITE_REMOTE_TMP_INSTALL="${NGINX_SITE_REMOTE_TMP_INSTALL:-/tmp/install-carbonet-duckdns-nginx.sh}"
NGINX_SITE_REMOTE_TARGET="${NGINX_SITE_REMOTE_TARGET:-/etc/nginx/sites-enabled/carbonet}"

log() {
  printf '[jenkins-deploy-carbonet] %s\n' "$*"
}

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 1
  fi
}

cleanup() {
  if [[ -n "$BUILD_ROOT" && -d "$BUILD_ROOT" ]]; then
    rm -rf "$BUILD_ROOT"
  fi
}

clone_branch() {
  mkdir -p "$WORKSPACE_ROOT"
  BUILD_ROOT="$(mktemp -d "$WORKSPACE_ROOT/carbonet-jenkins-${BRANCH}-XXXXXX")"
  BUILD_DIR="$BUILD_ROOT/repo"
  if [[ -n "$GIT_CREDENTIALS_HEADER" ]]; then
    git -c "http.https://github.com/.extraheader=${GIT_CREDENTIALS_HEADER}" clone --branch "$BRANCH" --single-branch "$REPO_URL" "$BUILD_DIR"
  else
    git clone --branch "$BRANCH" --single-branch "$REPO_URL" "$BUILD_DIR"
  fi
  CURRENT_COMMIT_SHA="$(git -C "$BUILD_DIR" rev-parse HEAD)"
  log "checked out branch=${BRANCH} commit=${CURRENT_COMMIT_SHA}"
}

should_skip_deploy() {
  if [[ ! -f "$LAST_DEPLOYED_COMMIT_FILE" ]]; then
    return 1
  fi

  local last_deployed_commit=""
  last_deployed_commit="$(tr -d '[:space:]' < "$LAST_DEPLOYED_COMMIT_FILE")"
  if [[ -z "$last_deployed_commit" || "$last_deployed_commit" != "$CURRENT_COMMIT_SHA" ]]; then
    return 1
  fi

  if [[ -n "${DRAIN_IDLE_TARGET_IP:-}" ]]; then
    log "commit unchanged but idle drain requested; skip disabled"
    return 1
  fi

  log "commit unchanged (${CURRENT_COMMIT_SHA}); build and deploy skipped"
  return 0
}

build_artifact() {
  log "frontend build"
  (cd "$BUILD_DIR/frontend" && npm run build)

  log "backend package"
  (cd "$BUILD_DIR" && mvn -q -pl apps/carbonet-app -am -DskipTests package)

  log "app closure verification"
  bash "$BUILD_DIR/ops/scripts/verify-large-move-app-closure.sh"
}

archive_artifact() {
  local built_jar_path="$BUILD_DIR/apps/carbonet-app/target/$ARTIFACT_NAME"
  mkdir -p "$ARTIFACT_DIR"
  cp "$built_jar_path" "$ARTIFACT_DIR/$ARTIFACT_NAME"
  cp "$built_jar_path" "$ARTIFACT_DIR/carbonet-$(date +%Y%m%d-%H%M%S).jar"
  printf '%s\n' "$CURRENT_COMMIT_SHA" > "$LAST_DEPLOYED_COMMIT_FILE"
}

sync_nginx_site() {
  if [[ "$NGINX_SITE_SYNC_ENABLED" != "true" ]]; then
    log "nginx site sync skipped"
    return 0
  fi

  if [[ ! -f "$NGINX_SITE_CONFIG_SOURCE" ]]; then
    echo "Nginx site config not found: $NGINX_SITE_CONFIG_SOURCE" >&2
    exit 1
  fi

  if [[ ! -f "$NGINX_SITE_INSTALL_SCRIPT_SOURCE" ]]; then
    echo "Nginx install script not found: $NGINX_SITE_INSTALL_SCRIPT_SOURCE" >&2
    exit 1
  fi

  log "upload nginx site config"
  if [[ -n "$MAIN_REMOTE_PASSWORD" ]]; then
    require_command sshpass
    sshpass -p "$MAIN_REMOTE_PASSWORD" scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
      "$NGINX_SITE_CONFIG_SOURCE" "${MAIN_TARGET}:${NGINX_SITE_REMOTE_TMP_CONFIG}"
    sshpass -p "$MAIN_REMOTE_PASSWORD" scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
      "$NGINX_SITE_INSTALL_SCRIPT_SOURCE" "${MAIN_TARGET}:${NGINX_SITE_REMOTE_TMP_INSTALL}"
    sshpass -p "$MAIN_REMOTE_PASSWORD" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$MAIN_TARGET" \
      "chmod +x '$NGINX_SITE_REMOTE_TMP_INSTALL' && sudo '$NGINX_SITE_REMOTE_TMP_INSTALL' '$NGINX_SITE_REMOTE_TMP_CONFIG' '$NGINX_SITE_REMOTE_TARGET'"
    return 0
  fi

  scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    "$NGINX_SITE_CONFIG_SOURCE" "${MAIN_TARGET}:${NGINX_SITE_REMOTE_TMP_CONFIG}"
  scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    "$NGINX_SITE_INSTALL_SCRIPT_SOURCE" "${MAIN_TARGET}:${NGINX_SITE_REMOTE_TMP_INSTALL}"
  ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$MAIN_TARGET" \
    "chmod +x '$NGINX_SITE_REMOTE_TMP_INSTALL' && sudo '$NGINX_SITE_REMOTE_TMP_INSTALL' '$NGINX_SITE_REMOTE_TMP_CONFIG' '$NGINX_SITE_REMOTE_TARGET'"
}

deploy_main() {
  local remote_tmp="/tmp/$ARTIFACT_NAME"
  local remote_target_dir="$MAIN_REMOTE_ROOT/apps/carbonet-app/target"
  local remote_verify="$MAIN_REMOTE_ROOT/ops/scripts/codex-verify-18000-freshness.sh"
  sync_nginx_site
  if [[ -n "$MAIN_REMOTE_PASSWORD" ]]; then
    require_command sshpass
    sshpass -p "$MAIN_REMOTE_PASSWORD" scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
      "$ARTIFACT_DIR/$ARTIFACT_NAME" "${MAIN_TARGET}:${remote_tmp}"
    sshpass -p "$MAIN_REMOTE_PASSWORD" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$MAIN_TARGET" \
      "mkdir -p '$remote_target_dir' && mv '$remote_tmp' '$remote_target_dir/$ARTIFACT_NAME' && bash '$MAIN_REMOTE_ROOT/ops/scripts/deploy-blue-green-221.sh' && bash '$remote_verify'"
    return 0
  fi

  scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    "$ARTIFACT_DIR/$ARTIFACT_NAME" "${MAIN_TARGET}:${remote_tmp}"
  ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$MAIN_TARGET" \
    "mkdir -p '$remote_target_dir' && mv '$remote_tmp' '$remote_target_dir/$ARTIFACT_NAME' && bash '$MAIN_REMOTE_ROOT/ops/scripts/deploy-blue-green-221.sh' && bash '$remote_verify'"
}

scale_idle_if_needed() {
  if [[ "$IDLE_SCALE_ENABLED" != "true" ]]; then
    log "idle scale skipped"
    return 0
  fi
  SOURCE_JAR_PATH="$ARTIFACT_DIR/$ARTIFACT_NAME" bash "$ROOT_DIR/ops/scripts/scale-out-idle-runtime.sh"
}

restore_idle_if_requested() {
  if [[ "$IDLE_RESTORE_ENABLED" != "true" ]]; then
    log "idle restore skipped"
    return 0
  fi
  if [[ "${DRAIN_IDLE_TARGET_IP:-}" == "" ]]; then
    return 0
  fi
  TARGET_IP="$DRAIN_IDLE_TARGET_IP" bash "$ROOT_DIR/ops/scripts/restore-idle-node-state.sh"
}

main() {
  trap cleanup EXIT
  require_command git
  require_command npm
  require_command mvn

  clone_branch
  if should_skip_deploy; then
    restore_idle_if_requested
    exit 0
  fi
  build_artifact
  archive_artifact
  deploy_main
  scale_idle_if_needed
  restore_idle_if_requested
  log "completed"
}

main "$@"
