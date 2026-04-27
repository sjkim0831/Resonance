#!/usr/bin/env bash
set -euo pipefail

# Show status of all independent project runtimes on the remote server
# Usage: bash ops/scripts/show-project-runtimes-status.sh [REMOTE_TARGET] [REMOTE_ROOT]

REMOTE_TARGET="${1:-carbonet2026@136.117.100.221}"
REMOTE_ROOT="${2:-/opt/Resonance}"

echo "========================================================================"
echo " Carbonet Independent Project Runtimes Status"
echo " Target: $REMOTE_TARGET"
echo "========================================================================"
printf "%-10s | %-15s | %-10s | %-20s\n" "PROJECT" "STATUS" "PORT" "ACTIVE VERSION"
echo "------------------------------------------------------------------------"

# Remote execution to gather status
ssh -o StrictHostKeyChecking=no "$REMOTE_TARGET" "
    cd $REMOTE_ROOT
    if [[ ! -d \"var/run/project-runtime\" ]]; then
        echo \"No project runtimes directory found at $REMOTE_ROOT/var/run/project-runtime\"
        exit 0
    fi
    for p_dir in \$(ls -d var/run/project-runtime/*/ 2>/dev/null); do
        project_id=\$(basename \"\$p_dir\")
        # Check service status using new management script
        status=\$(bash ops/scripts/manage-project-runtime.sh status \"\$project_id\" | grep -o 'RUNNING\|STOPPED' || echo 'UNKNOWN')
        
        # Parse port from manifest
        port_info=\$(python3 -c \"
import json, re
try:
  with open('data/version-control/project-runtime-manifest.json') as f:
    data = json.load(f)
  cmd = data.get('projects', {}).get('\$project_id', {}).get('runtime', {}).get('bootCommand', '')
  match = re.search(r'--server\\.port=(\d+)', cmd)
  print(match.group(1) if match else '18000')
except Exception:
  print('18000')
\" 2>/dev/null || echo '18000')

        # Check active version via release dir if it exists
        version='unknown'
        if [ -L \"var/releases/\$project_id/current\" ]; then
            version=\$(readlink \"var/releases/\$project_id/current\" | xargs basename)
        fi
        
        printf '%-10s | %-15s | %-10s | %-20s\n' \"\$project_id\" \"\$status\" \"\$port_info\" \"\$version\"
    done
"
echo "========================================================================"
