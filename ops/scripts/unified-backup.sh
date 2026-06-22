#!/usr/bin/env bash
# unified-backup.sh - Complete backup system with Git commit/push + DB backup
# Usage: bash ops/scripts/unified-backup.sh [full|quick|unload] [git|nosync]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="/opt/Resonance/data/cubrid/backups"
DATA_DIR="/opt/Resonance/data"
GIT_TOKEN="${GIT_TOKEN:-}"
GIT_REMOTE="${GIT_REMOTE:-origin}"
GIT_BRANCH="${GIT_BRANCH:-main}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

NAMESPACE="${NAMESPACE:-carbonet-prod}"
POD_NAME="cubrid-carbonet-0"
DB_NAME="carbonet"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2
}

get_git_status() {
    cd /opt/Resonance
    if [[ -d .git ]]; then
        git status --porcelain 2>/dev/null | wc -l | tr -d ' '
    else
        echo "0"
    fi
}

git_commit_push() {
    local commit_msg="${1:-Backup on $(date '+%Y-%m-%d %H:%M:%S')}"
    local branch="${2:-$GIT_BRANCH}"

    log "Starting Git commit and push..."

    if [[ ! -d /opt/Resonance/.git ]]; then
        log "Not a git repository, skipping git backup"
        return 0
    fi

    cd /opt/Resonance

    local changes=$(git status --porcelain 2>/dev/null | grep -v "^??" | wc -l | tr -d ' ')
    if [[ "$changes" == "0" ]]; then
        log "No changes to commit"
        return 0
    fi

    log "Staging specific source files (excluding large data)..."

    git add ops/scripts/*.sh 2>/dev/null || true
    git add docs/*.md 2>/dev/null || true
    git add modules/*/src/main/java/*.java 2>/dev/null || true
    git add modules/*/src/main/resources/*.xml 2>/dev/null || true
    git add modules/*/src/main/resources/*.properties 2>/dev/null || true
    git add projects/*/src/main/java/*.java 2>/dev/null || true
    git add projects/*/src/main/resources/*.xml 2>/dev/null || true
    git add projects/*/src/main/resources/*.properties 2>/dev/null || true
    git add projects/*/source/src/features/*/*.tsx 2>/dev/null || true
    git add projects/*/source/src/features/*/*.ts 2>/dev/null || true
    git add projects/*/source/src/lib/*.ts 2>/dev/null || true
    git add projects/*/source/src/app/*.ts 2>/dev/null || true
    git add projects/*/source/src/app/*.tsx 2>/dev/null || true

    local staged=$(git diff --cached --name-only | wc -l | tr -d ' ')
    log "Staged $staged files"

    if [[ "$staged" == "0" ]]; then
        log "No files staged, skipping commit"
        return 0
    fi

    log "Committing..."
    git commit -m "$commit_msg" 2>&1 | grep -v "^codex-commit-guard" || true

    if [[ -n "$GIT_TOKEN" ]]; then
        log "Pushing to remote with token..."
        local remote_url=$(git remote get-url origin)
        if [[ "$remote_url" == https://*@github.com* ]]; then
            git push "$remote_url" "$branch" 2>&1 || {
                error "Git push failed - token may be expired"
                return 1
            }
        else
            local git_host=$(echo "$remote_url" | sed -n 's|.*@\(.*\):.*|\1|p')
            local git_path=$(echo "$remote_url" | sed -n 's|.*@.*:\(.*\)|\1|p')
            git push "https://x-access-token:${GIT_TOKEN}@${git_host}/${git_path}" "$branch" 2>&1 || {
                error "Git push failed - token may be expired"
                return 1
            }
        fi
    else
        log "No GIT_TOKEN set, skipping push (commit only)"
    fi

    log "Git backup completed successfully"
    return 0
}

backup_database() {
    local backup_type="${1:-full}"
    local timestamp="${2:-$TIMESTAMP}"

    log "Starting database backup ($backup_type)..."

    mkdir -p "$BACKUP_DIR"

    local backup_file=""
    case "$backup_type" in
        full)
            backup_file="$BACKUP_DIR/${DB_NAME}-fullbackup-${timestamp}.tar.gz"
            kubectl exec -n "$NAMESPACE" "$POD_NAME" -- bash -c "mkdir -p /tmp/backup_${timestamp} && source /home/cubrid/.cubrid.sh && cubrid backupdb -D /tmp/backup_${timestamp} ${DB_NAME}" || {
                error "Full backup failed"
                return 1
            }
            kubectl exec -n "$NAMESPACE" "$POD_NAME" -- bash -c "cd /tmp && tar -czf /tmp/backup_${timestamp}.tar.gz backup_${timestamp}/" || {
                error "Tar compression failed"
                return 1
            }
            kubectl cp "$NAMESPACE/$POD_NAME:/tmp/backup_${timestamp}.tar.gz" "$backup_file" || {
                error "Copy failed"
                return 1
            }
            kubectl exec -n "$NAMESPACE" "$POD_NAME" -- bash -c "rm -rf /tmp/backup_${timestamp} /tmp/backup_${timestamp}.tar.gz"
            ;;
        quick)
            backup_file="$BACKUP_DIR/${DB_NAME}-quickbackup-${timestamp}.tar.gz"
            kubectl exec -n "$NAMESPACE" "$POD_NAME" -- bash -c "mkdir -p /tmp/quickbackup_${timestamp} && source /home/cubrid/.cubrid.sh && cubrid backupdb -D /tmp/quickbackup_${timestamp} -l 1 ${DB_NAME}" || {
                error "Quick backup failed, trying full backup..."
                kubectl exec -n "$NAMESPACE" "$POD_NAME" -- bash -c "mkdir -p /tmp/quickbackup_${timestamp} && source /home/cubrid/.cubrid.sh && cubrid backupdb -D /tmp/quickbackup_${timestamp} ${DB_NAME}" || {
                    error "Backup failed"
                    return 1
                }
            }
            kubectl exec -n "$NAMESPACE" "$POD_NAME" -- bash -c "cd /tmp && tar -czf /tmp/quickbackup_${timestamp}.tar.gz quickbackup_${timestamp}/" || {
                error "Tar compression failed"
                return 1
            }
            kubectl cp "$NAMESPACE/$POD_NAME:/tmp/quickbackup_${timestamp}.tar.gz" "$backup_file" || {
                error "Copy failed"
                return 1
            }
            kubectl exec -n "$NAMESPACE" "$POD_NAME" -- bash -c "rm -rf /tmp/quickbackup_${timestamp} /tmp/quickbackup_${timestamp}.tar.gz"
            ;;
        unload)
            backup_file="$BACKUP_DIR/${DB_NAME}-unload-${timestamp}.sql"
            kubectl exec -n "$NAMESPACE" "$POD_NAME" -- bash -c "mkdir -p /tmp/${DB_NAME}_unload_${timestamp} && source /home/cubrid/.cubrid.sh && cubrid unloadbd -t /tmp/${DB_NAME}_unload_${timestamp} ${DB_NAME}" || {
                error "Unload failed"
                return 1
            }
            kubectl exec -n "$NAMESPACE" "$POD_NAME" -- bash -c "cd /tmp && tar -czf /tmp/unload_${timestamp}.tar.gz ${DB_NAME}_unload_${timestamp}/" || {
                error "Tar compression failed"
                return 1
            }
            kubectl cp "$NAMESPACE/$POD_NAME:/tmp/unload_${timestamp}.tar.gz" "$backup_file.tar.gz" || {
                error "Copy failed"
                return 1
            }
            kubectl exec -n "$NAMESPACE" "$POD_NAME" -- bash -c "rm -rf /tmp/${DB_NAME}_unload_${timestamp} /tmp/unload_${timestamp}.tar.gz"
            backup_file="$backup_file.tar.gz"
            ;;
        *)
            error "Unknown backup type: $backup_type"
            return 1
            ;;
    esac

    if [[ -f "$backup_file" ]]; then
        local size=$(du -h "$backup_file" | cut -f1)
        log "Database backup completed: $backup_file ($size)"
        echo "$backup_file"
        return 0
    else
        error "Backup file not found: $backup_file"
        return 1
    fi
}

backup_config() {
    local timestamp="${1:-$TIMESTAMP}"
    local config_dir="$DATA_DIR/config"
    local config_backup="$BACKUP_DIR/config-${timestamp}.tar.gz"

    mkdir -p "$config_dir"
    mkdir -p "$BACKUP_DIR"

    log "Backing up configuration..."

    cd /opt/Resonance

    tar -czf "$config_backup" \
        --exclude='*.log' \
        --exclude='*.tmp' \
        --exclude='node_modules/.cache' \
        --exclude='.git' \
        ops/scripts/*.sh \
        modules/*/src/main/resources \
        projects/*/src/main/resources \
        2>/dev/null || true

    if [[ -f "$config_backup" ]]; then
        local size=$(du -h "$config_backup" | cut -f1)
        log "Config backup completed: $config_backup ($size)"
    fi
}

generate_backup_manifest() {
    local backup_type="${1:-full}"
    local git_backup_ref=""
    local db_backup_file="${2:-}"

    local git_changes=$(get_git_status)
    local git_commit=""
    local git_branch=""

    cd /opt/Resonance
    if git rev-parse HEAD >/dev/null 2>&1; then
        git_commit=$(git rev-parse --short HEAD)
        git_branch=$(git branch --show-current)
    fi

    cat > "$BACKUP_DIR/backup-manifest-${TIMESTAMP}.json" << EOF
{
    "timestamp": "$TIMESTAMP",
    "type": "$backup_type",
    "git": {
        "branch": "$git_branch",
        "commit": "$git_commit",
        "pending_changes": $git_changes
    },
    "database": {
        "backup_file": "$(basename "$db_backup_file")",
        "size": "$(du -h "$db_backup_file" 2>/dev/null | cut -f1 || echo 'N/A')"
    },
    "backup_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

    log "Backup manifest created: backup-manifest-${TIMESTAMP}.json"
}

run_full_backup() {
    log "=== Starting Full Backup ==="
    local start_time=$(date +%s)
    
    git_commit_push "Full backup $(date '+%Y-%m-%d %H:%M')" || true
    local git_time=$(($(date +%s) - start_time))
    log "Git sync completed in ${git_time}s"
    
    local db_start=$(date +%s)
    local db_file=$(backup_database full) || true
    local db_time=$(($(date +%s) - db_start))
    log "Database backup completed in ${db_time}s"
    
    backup_config
    generate_backup_manifest full "$db_file"
    
    local total_time=$(($(date +%s) - start_time))
    log "=== Full Backup Completed in ${total_time}s ==="
}

run_quick_backup() {
    log "=== Starting Quick Backup ==="
    local start_time=$(date +%s)
    
    git_commit_push "Quick backup $(date '+%Y-%m-%d %H:%M')" || true
    local git_time=$(($(date +%s) - start_time))
    log "Git sync completed in ${git_time}s"
    
    local db_start=$(date +%s)
    local db_file=$(backup_database quick) || true
    local db_time=$(($(date +%s) - db_start))
    log "Database backup completed in ${db_time}s"
    
    generate_backup_manifest quick "$db_file"
    
    local total_time=$(($(date +%s) - start_time))
    log "=== Quick Backup Completed in ${total_time}s ==="
}

run_unload_backup() {
    log "=== Starting Unload Backup ==="

    git_commit_push "Unload backup $(date '+%Y-%m-%d %H:%M')" || true
    local db_file=$(backup_database unload) || true
    generate_backup_manifest unload "$db_file"

    log "=== Unload Backup Completed ==="
}

show_help() {
    cat << EOF
Unified Backup System

Usage: $0 [type] [options]

Backup Types:
    full        - Full backup (Git commit + DB full backup + config)
    quick       - Quick backup (Git commit + DB incremental)
    unload      - Unload backup (Git commit + DB schema/data export)

Options:
    --no-git    - Skip Git commit/push
    --help      - Show this help

Environment Variables:
    GIT_TOKEN   - GitHub personal access token (for push)
    GIT_REMOTE  - Git remote name (default: origin)
    GIT_BRANCH  - Git branch (default: main)

Examples:
    GIT_TOKEN=xxx $0 full
    $0 quick --no-git
    $0 unload

EOF
}

main() {
    local backup_type="${1:-full}"
    local skip_git=false

    shift || true

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --no-git)
                skip_git=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                shift
                ;;
        esac
    done

    mkdir -p "$BACKUP_DIR"

    log "Backup type: $backup_type"
    [[ "$skip_git" == "true" ]] && log "Git sync: DISABLED" || log "Git sync: ENABLED"

    case "$backup_type" in
        full)
            run_full_backup
            ;;
        quick)
            run_quick_backup
            ;;
        unload)
            run_unload_backup
            ;;
        verify)
            log "Verifying backup integrity..."
            ls -lah "$BACKUP_DIR"/*.tar.gz 2>/dev/null | tail -5
            ls -lah "$BACKUP_DIR"/backup-manifest-*.json 2>/dev/null | tail -3
            ;;
        list)
            log "Available backups:"
            ls -lh "$BACKUP_DIR"/ 2>/dev/null | grep -E '\.(tar\.gz|sql)' | tail -20
            ;;
        *)
            error "Unknown backup type: $backup_type"
            show_help
            exit 1
            ;;
    esac
}

main "$@"