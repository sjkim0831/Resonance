#!/bin/bash
# Host metrics collection script
# Run via cron: * * * * * /opt/Resonance/data/monitoring/collect-host-metrics.sh

METRICS_DIR="/opt/Resonance/data/monitoring"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")

# Collect host processes (CPU)
> "$METRICS_DIR/top_cpu_processes"
ps aux --no-headers --sort=-pcpu 2>/dev/null | head -10 | while read line; do
  pid=$(echo "$line" | awk '{print $2}')
  user=$(echo "$line" | awk '{print $1}')
  cpu=$(echo "$line" | awk '{print $3}')
  mem=$(echo "$line" | awk '{print $4}')
  rss=$(echo "$line" | awk '{print $6}')
  cmd=$(echo "$line" | awk '{$1=$2=$3=$4=$5=$6=$7=$8=""; sub(/^  */, ""); print substr($0,1,80)}')
  echo "{\"pid\":$pid,\"user\":\"$user\",\"cpu\":$cpu,\"mem\":$mem,\"rss_kb\":$rss,\"cmd\":\"$cmd\"}" >> "$METRICS_DIR/top_cpu_processes"
done

# Collect host processes (Memory)
> "$METRICS_DIR/top_mem_processes"
ps aux --no-headers --sort=-pmem 2>/dev/null | head -10 | while read line; do
  pid=$(echo "$line" | awk '{print $2}')
  user=$(echo "$line" | awk '{print $1}')
  cpu=$(echo "$line" | awk '{print $3}')
  mem=$(echo "$line" | awk '{print $4}')
  rss=$(echo "$line" | awk '{print $6}')
  cmd=$(echo "$line" | awk '{$1=$2=$3=$4=$5=$6=$7=$8=""; sub(/^  */, ""); print substr($0,1,80)}')
  echo "{\"pid\":$pid,\"user\":\"$user\",\"cpu\":$cpu,\"mem\":$mem,\"rss_kb\":$rss,\"cmd\":\"$cmd\"}" >> "$METRICS_DIR/top_mem_processes"
done

# Collect GPU metrics
> "$METRICS_DIR/gpu_metrics"
GPU_COUNT=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | wc -l | tr -d ' ')
if [ "$GPU_COUNT" -gt 0 ] 2>/dev/null; then
  nvidia-smi --query-gpu=index,name,utilization.gpu,memory.used,memory.total,memory.free,temperature.gpu,fan.speed,power.draw,power.limit,clocks.current.sm,clocks.current.memory --format=csv,noheader,nounits 2>/dev/null | while IFS=',' read -r idx name util mem_used mem_total mem_free temp fan pwr pwr_limit sm mhz; do
    mem_pct=$(awk "BEGIN {printf \"%.1f\", $mem_used * 100 / $mem_total}")
    echo "{\"index\":$idx,\"name\":\"$name\",\"utilization_percent\":$util,\"memory_used_mb\":$mem_used,\"memory_total_mb\":$mem_total,\"memory_free_mb\":$mem_free,\"memory_used_percent\":$mem_pct,\"temperature_c\":$temp,\"fan_speed_percent\":$fan,\"power_draw_w\":$pwr,\"power_limit_w\":$pwr_limit,\"clock_sm_mhz\":$sm,\"clock_memory_mhz\":$mhz}" >> "$METRICS_DIR/gpu_metrics"
  done
fi

# Collect services
> "$METRICS_DIR/host_services"
systemctl list-units --type=service --state=running --no-pager --no-legend 2>/dev/null | while read line; do
  svc=$(echo "$line" | awk '{print $1}' | sed 's/\.service$//')
  echo "\"$svc\"" >> "$METRICS_DIR/host_services"
done

# Create combined JSON for container
CPU_PROC=$(cat "$METRICS_DIR/top_cpu_processes" 2>/dev/null | tr '\n' ',' | sed 's/,$//')
MEM_PROC=$(cat "$METRICS_DIR/top_mem_processes" 2>/dev/null | tr '\n' ',' | sed 's/,$//')
GPU_DEVICES=$(cat "$METRICS_DIR/gpu_metrics" 2>/dev/null | tr '\n' ',' | sed 's/,$//')
HOST_SVCS=$(cat "$METRICS_DIR/host_services" 2>/dev/null | tr '\n' ',' | sed 's/,$//')

echo "{\"timestamp\":\"$TIMESTAMP\",\"top_cpu_processes\":[$CPU_PROC],\"top_mem_processes\":[$MEM_PROC],\"gpu\":{\"available\":$GPU_COUNT,\"count\":$GPU_COUNT,\"devices\":[$GPU_DEVICES]},\"host_services\":[$HOST_SVCS]}" > "$METRICS_DIR/host_metrics.json"

chmod 644 "$METRICS_DIR/host_metrics.json" "$METRICS_DIR/top_cpu_processes" "$METRICS_DIR/top_mem_processes" "$METRICS_DIR/gpu_metrics" "$METRICS_DIR/host_services" 2>/dev/null