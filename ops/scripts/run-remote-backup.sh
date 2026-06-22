#!/bin/bash
#============================================
# Manual Remote Backup Runner
# Run this when SSH to 172.16.1.231 is available
#============================================

echo "=== CUBRID Remote Backup Runner ==="
echo ""
echo "Target: jwchoi@172.16.1.231"
echo "Email: imaneya@gmail.com"
echo ""

# First test SSH
echo "1. Testing SSH connection..."
if ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no jwchoi@172.16.1.231 "echo 'SSH OK'" 2>/dev/null; then
    echo "   SSH connected successfully!"
else
    echo "   SSH FAILED - please check:"
    echo "   - Remote server is running"
    echo "   - SSH service is started on 172.16.1.231"
    echo "   - Firewall allows port 22"
    exit 1
fi

echo ""
echo "2. Running remote backup sync..."
/opt/Resonance/ops/scripts/remote-backup.sh sync

echo ""
echo "3. Verifying remote backup..."
/opt/Resonance/ops/scripts/remote-backup.sh verify

echo ""
echo "4. Listing remote backups..."
/opt/Resonance/ops/scripts/remote-backup.sh list

echo ""
echo "Done! Check email for confirmation."
