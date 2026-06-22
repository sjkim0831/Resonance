#!/bin/bash
#============================================
# Process Rollback System v2
# - Version control for recovery scripts
# - One-command rollback to previous version
# - Automatic backup before any changes
# - Git integration for audit trail
#============================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

SCRIPT_DIR="/opt/Resonance/ops/scripts"
BACKUP_DIR="/opt/Resonance/var/process-backups"
LOG_DB="/opt/Resonance/var/lib/cubrid_operations.db"
GIT_REPO="/opt/Resonance/data/process-versions"

mkdir -p "$BACKUP_DIR" "$GIT_REPO"

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; }
log_ok() { echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${NC} $1"; }
log_err() { echo -e "${RED}[$(date +%H:%M:%S)] ✗${NC} $1"; }

#============================================
# TRACKED SCRIPTS
#============================================
TRACKED_SCRIPTS=(
    "cubrid-framework.sh"
    "cubrid-recover-v4.sh"
    "ai-guardian-v2.sh"
    "backup-guardian-v2.sh"
    "error-guardian.sh"
    "incremental-backup.sh"
    "git-db-tracker.sh"
)

#============================================
# BACKUP CURRENT VERSION (변경 전 백업)
#============================================
backup_current() {
    local script_name="$1"
    local script_path="$SCRIPT_DIR/$script_name"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_path="$BACKUP_DIR/${script_name}.${timestamp}"
    
    if [ -f "$script_path" ]; then
        cp "$script_path" "$backup_path"
        log "Backed up: $script_name -> $(basename $backup_path)"
        echo "$backup_path"
    else
        log_err "Script not found: $script_name"
        return 1
    fi
}

#============================================
# SAVE VERSION
#============================================
save_version() {
    local script_name="$1"
    local version_tag="${2:-v$(date +%Y%m%d_%H%M%S)}"
    local script_path="$SCRIPT_DIR/$script_name"
    local version_dir="$GIT_REPO/$script_name/versions"
    local desc="${3:-no description}"
    
    mkdir -p "$version_dir"
    
    # Save current version
    cp "$script_path" "$version_dir/$version_tag.sh"
    
    # Save metadata
    cat > "$version_dir/$version_tag.meta" << EOF
version=$version_tag
date=$(date -Iseconds)
description=$desc
checksum=$(md5sum "$script_path" | cut -d' ' -f1)
EOF
    
    # Update latest
    cp "$script_path" "$GIT_REPO/$script_name/latest.sh"
    cp "$version_dir/$version_tag.meta" "$GIT_REPO/$script_name/latest.meta"
    
    log_ok "Saved version: $script_name $version_tag"
    
    # Log to SQLite
    python3 -c "
import sqlite3
conn=sqlite3.connect('$LOG_DB')
conn.execute('INSERT INTO script_versions(script_name,version_tag,description,checksum) VALUES(?,?,?,?)',
    ('$script_name','$version_tag','$desc','$(md5sum $script_path | cut -d' ' -f1)'))
conn.commit()
conn.close()
" 2>/dev/null
}

#============================================
# ROLLBACK TO VERSION
#============================================
rollback_to() {
    local script_name="$1"
    local version_tag="$2"
    
    if [ -z "$script_name" ] || [ -z "$version_tag" ]; then
        log_err "Usage: rollback <script> <version>"
        return 1
    fi
    
    local version_file="$GIT_REPO/$script_name/versions/$version_tag.sh"
    
    if [ ! -f "$version_file" ]; then
        log_err "Version not found: $script_name/$version_tag"
        return 1
    fi
    
    # Backup current before rollback
    backup_current "$script_name" > /dev/null
    
    # Apply rollback
    cp "$version_file" "$SCRIPT_DIR/$script_name"
    chmod +x "$SCRIPT_DIR/$script_name"
    
    log_ok "Rolled back: $script_name -> $version_tag"
    
    # Log rollback
    python3 -c "
import sqlite3
conn=sqlite3.connect('$LOG_DB')
conn.execute('INSERT INTO rollbacks(script_name,version_tag,timestamp) VALUES(?,?,datetime('now'))',
    ('$script_name','$version_tag'))
conn.commit()
conn.close()
" 2>/dev/null
}

#============================================
# LIST VERSIONS
#============================================
list_versions() {
    local script_name="$1"
    
    echo "╔═══════════════════════════════════════════════════════════════════╗"
    echo "║                    VERSION HISTORY                                ║"
    echo "╠═══════════════════════════════════════════════════════════════════╣"
    
    if [ -n "$script_name" ]; then
        local version_dir="$GIT_REPO/$script_name/versions"
        if [ -d "$version_dir" ]; then
            for v in $(ls -t "$version_dir"/*.sh 2>/dev/null); do
                local tag=$(basename "$v" .sh)
                local meta="${v%.sh}.meta"
                local desc="no description"
                local date_str=""
                
                if [ -f "$meta" ]; then
                    desc=$(grep "^description=" "$meta" 2>/dev/null | cut -d= -f2)
                    date_str=$(grep "^date=" "$meta" 2>/dev/null | cut -d= -f2)
                fi
                
                printf "║ %-15s │ %s ║\n" "$tag" "$desc"
            done
        fi
    else
        # List all scripts
        for script in "${TRACKED_SCRIPTS[@]}"; do
            local version_dir="$GIT_REPO/$script/versions"
            local count=$(ls "$version_dir"/*.sh 2>/dev/null | wc -l)
            printf "║ %-20s │ %d versions ║\n" "$script" "$count"
        done
    fi
    
    echo "╚═══════════════════════════════════════════════════════════════════╝"
}

#============================================
# SAVE ALL SCRIPTS
#============================================
save_all() {
    local version_tag="${1:-v$(date +%Y%m%d_%H%M%S)}"
    local desc="${2:-auto-save}"
    
    log "Saving all scripts as $version_tag..."
    
    for script in "${TRACKED_SCRIPTS[@]}"; do
        if [ -f "$SCRIPT_DIR/$script" ]; then
            save_version "$script" "${version_tag}_$script" "$desc"
        fi
    done
    
    log_ok "All scripts saved as $version_tag"
}

#============================================
# COMPARE VERSIONS
#============================================
compare() {
    local script_name="$1"
    local v1="$2"
    local v2="$3"
    
    local f1="$GIT_REPO/$script_name/versions/$v1.sh"
    local f2="$GIT_REPO/$script_name/versions/$v2.sh"
    
    if [ ! -f "$f1" ] || [ ! -f "$f2" ]; then
        log_err "One or both versions not found"
        return 1
    fi
    
    echo "Comparing: $v1 vs $v2"
    diff -u "$f1" "$f2" | head -50
}

#============================================
# ENTRY
#============================================
case "${1:-help}" in
    save|save-version) save_version "$2" "$3" "$4" ;;
    save-all) save_all "$2" "$3" ;;
    rollback) rollback_to "$2" "$3" ;;
    list|versions) list_versions "$2" ;;
    compare) compare "$2" "$3" "$4" ;;
    current)
        echo "Current versions:"
        for script in "${TRACKED_SCRIPTS[@]}"; do
            if [ -f "$SCRIPT_DIR/$script" ]; then
                echo "  $script: $(md5sum $SCRIPT_DIR/$script | cut -d' ' -f1)"
            fi
        done
        ;;
    *)
        echo "Usage: $0 {save|save-all|rollback|list|compare|current}"
        echo ""
        echo "  save <script> <version> [desc]  - Save current version"
        echo "  save-all [tag] [desc]           - Save all scripts"
        echo "  rollback <script> <version>     - Rollback to version"
        echo "  list [script]                   - List versions"
        echo "  compare <script> <v1> <v2>      - Compare two versions"
        echo "  current                         - Show current checksums"
        ;;
esac
