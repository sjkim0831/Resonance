#!/bin/bash
# metrics-updater.sh - Update metrics.json periodically
# Usage: ./metrics-updater.sh [interval_seconds]

INTERVAL=${1:-30}
METRICS_FILE="/opt/Resonance/data/monitoring/metrics.json"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

mkdir -p "$(dirname "$METRICS_FILE")"

echo "Starting metrics updater (interval: ${INTERVAL}s)"
echo "Output: $METRICS_FILE"

while true; do
    "$SCRIPT_DIR/system-monitor.sh" json > "$METRICS_FILE" 2>/dev/null
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Metrics updated"
    sleep "$INTERVAL"
done