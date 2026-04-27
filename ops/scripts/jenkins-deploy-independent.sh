#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/jenkins-deploy-independent.sh [PROJECT_ID]

Purpose:
  Build and deploy a specific independent project runtime (e.g., p003).
  This script uses the new separated JAR architecture.
EOF
  exit 0
fi

PROJECT_ID="${1:-}"
if [ -z "$PROJECT_ID" ]; then
    echo "Error: PROJECT_ID must be provided."
    exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BRANCH="${BRANCH:-main}"
REPO_URL="${REPO_URL:-https://github.com/sjkim0831/2026_carbonet.git}"
WORKSPACE_ROOT="${WORKSPACE_ROOT:-${TMPDIR:-/tmp}}"
ARTIFACT_DIR="${ARTIFACT_DIR:-$ROOT_DIR/var/artifacts/jenkins-independent}"
MAIN_TARGET="${MAIN_TARGET:-carbonet2026@136.117.100.221}"
MAIN_REMOTE_ROOT="${MAIN_REMOTE_ROOT:-/opt/Resonance}"
GIT_CREDENTIALS_HEADER="${GIT_CREDENTIALS_HEADER:-}"
CURRENT_COMMIT_SHA=""
BUILD_DIR=""

log() {
  printf '[jenkins-deploy-independent] %s\n' "$*"
}

clone_branch() {
  mkdir -p "$WORKSPACE_ROOT"
  local BUILD_ROOT="$(mktemp -d "$WORKSPACE_ROOT/carbonet-jenkins-${BRANCH}-XXXXXX")"
  BUILD_DIR="$BUILD_ROOT/repo"
  
  if [[ -n "$GIT_CREDENTIALS_HEADER" ]]; then
    git -c "http.https://github.com/.extraheader=${GIT_CREDENTIALS_HEADER}" clone --branch "$BRANCH" --single-branch "$REPO_URL" "$BUILD_DIR"
  else
    git clone --branch "$BRANCH" --single-branch "$REPO_URL" "$BUILD_DIR"
  fi
  CURRENT_COMMIT_SHA="$(git -C "$BUILD_DIR" rev-parse HEAD)"
  log "checked out branch=${BRANCH} commit=${CURRENT_COMMIT_SHA}"
}

assemble_artifact() {
  log "Assembling release package for project: $PROJECT_ID"
  # Execute the assembly script we created
  bash "$BUILD_DIR/ops/scripts/assemble-project-release.sh" "$PROJECT_ID"
}

archive_artifact() {
  log "Archiving assembled package"
  mkdir -p "$ARTIFACT_DIR/$PROJECT_ID"
  
  # Archive the entire release folder for this build
  local timestamp=$(date +%Y%m%d-%H%M%S)
  local archive_name="${PROJECT_ID}-${timestamp}.tar.gz"
  
  tar -czf "$ARTIFACT_DIR/$PROJECT_ID/$archive_name" -C "$BUILD_DIR/var/releases" "$PROJECT_ID"
  log "Archived to $ARTIFACT_DIR/$PROJECT_ID/$archive_name"
}

deploy_main() {
  log "Deploying release package to main target ($MAIN_TARGET) using Blue/Green Zero-Downtime strategy"
  
  # Set a default base port based on project (you can enhance this to be dynamic)
  local BASE_PORT=18000
  if [ "$PROJECT_ID" == "p004" ]; then BASE_PORT=18002; fi

  # Sync the files to the remote server using the BG script we created
  # We override the ROOT_DIR inside the subshell to point to the cloned repo
  (cd "$BUILD_DIR" && bash ops/scripts/deploy-project-bg.sh "$PROJECT_ID" "$BASE_PORT" "$MAIN_TARGET" "$MAIN_REMOTE_ROOT")
}

main() {
  log "Starting deployment pipeline for independent project: $PROJECT_ID"
  clone_branch
  assemble_artifact
  archive_artifact
  deploy_main
  log "Pipeline completed successfully for $PROJECT_ID"
}

main "$@"
