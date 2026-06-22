#!/usr/bin/env bash
# system-monitor.sh - Comprehensive system monitoring
# Usage: bash ops/scripts/system-monitor.sh [json|text]

set -euo pipefail

OUTPUT="${1:-json}"

timestamp() {
    date -u +"%Y-%m-%dT%H:%M:%SZ"
}

collect_hostname() {
    local hostname=$(hostname)
    local kernel=$(uname -r)
    local os=$(cat /etc/os-release 2>/dev/null | grep "PRETTY_NAME" | cut -d'"' -f2 || echo "Linux")
    local uptime_secs=$(awk '{print int($1)}' /proc/uptime)
    local uptime_days=$((uptime_secs / 86400))
    local uptime_hours=$(( (uptime_secs % 86400) / 3600 ))
    local uptime_mins=$(( (uptime_secs % 3600) / 60 ))

    if [[ "$OUTPUT" == "json" ]]; then
        cat << EOF
"hostname": {
    "name": "$hostname",
    "kernel": "$kernel",
    "os": "$os",
    "uptime_days": $uptime_days,
    "uptime_hours": $uptime_hours,
    "uptime_mins": $uptime_mins
}
EOF
    else
        echo "=== Hostname Info ==="
        echo "Hostname: $hostname"
        echo "Kernel: $kernel"
        echo "OS: $os"
        echo "Uptime: ${uptime_days}d ${uptime_hours}h ${uptime_mins}m"
    fi
}

collect_cpu() {
    local cores=$(nproc)
    local physical=$(grep "physical id" /proc/cpuinfo | sort -u | wc -l)
    local model=$(grep "model name" /proc/cpuinfo | head -1 | cut -d: -f2 | sed 's/^ *//')

    local cpu_line=$(top -bn1 | grep "Cpu(s)")
    local usage=$(echo "$cpu_line" | awk '{print $2}' | sed 's/%us,//')
    local system=$(echo "$cpu_line" | awk '{print $4}' | sed 's/%sy,//')
    local iowait=$(echo "$cpu_line" | awk '{print $6}' | sed 's/%id,//')
    local idle=$(echo "$cpu_line" | awk '{print $8}' | sed 's/%id,//')

    if [[ "$OUTPUT" == "json" ]]; then
        cat << EOF
"cpu": {
    "model": "$model",
    "cores": $cores,
    "physical_processors": $physical,
    "usage_percent": ${usage:-0},
    "idle_percent": ${idle:-0},
    "system_percent": ${system:-0},
    "iowait_percent": ${iowait:-0}
}
EOF
    else
        echo "=== CPU Info ==="
        echo "Model: $model"
        echo "Cores: $cores (Physical: $physical)"
        echo "Usage: ${usage:-0}% | System: ${system:-0}% | IOwait: ${iowait:-0}%"
    fi
}

collect_memory() {
    local total=$(free -b | awk '/^Mem:/{print $2}')
    local used=$(free -b | awk '/^Mem:/{print $3}')
    local free=$(free -b | awk '/^Mem:/{print $4}')
    local available=$(free -b | awk '/^Mem:/{print $7}')

    local swap_total=$(free -b | awk '/^Swap:/{print $2}')
    local swap_used=$(free -b | awk '/^Swap:/{print $3}')

    local usage_pct=$(awk -v used="$used" -v total="$total" 'BEGIN {printf "%.1f", (used/total)*100}')

    if [[ "$OUTPUT" == "json" ]]; then
        cat << EOF
"memory": {
    "total_bytes": $total,
    "used_bytes": $used,
    "free_bytes": $free,
    "available_bytes": $available,
    "usage_percent": $usage_pct,
    "swap_total_bytes": $swap_total,
    "swap_used_bytes": $swap_used,
    "swap_usage_percent": $([ $swap_total -gt 0 ] && awk "BEGIN {printf %.1f, ($swap_used/$swap_total)*100}" || echo "0")
}
EOF
    else
        echo "=== Memory Info ==="
        echo "Total: $(numfmt --to=iec $total) | Used: $(numfmt --to=iec $used) | Free: $(numfmt --to=iec $free)"
        echo "Available: $(numfmt --to=iec $available)"
        echo "Swap: $(numfmt --to=iec $swap_used) / $(numfmt --to=iec $swap_total)"
    fi
}

collect_disks() {
    local result_json="["
    local first=true

    while read -r line; do
        local filesystem=$(echo "$line" | awk '{print $1}')
        local size=$(echo "$line" | awk '{print $2}')
        local used=$(echo "$line" | awk '{print $3}')
        local available=$(echo "$line" | awk '{print $4}')
        local usage_pct=$(echo "$line" | awk '{print $5}' | sed 's/%//')
        local mounted=$(echo "$line" | awk '{print $6}')

        if [[ "$filesystem" != "Filesystem" && "$filesystem" != tmpfs* ]]; then
            if [[ "$first" == "false" ]]; then
                result_json="${result_json},"
            fi
            result_json="${result_json}{\"filesystem\":\"$filesystem\",\"total\":\"$size\",\"used\":\"$used\",\"available\":\"$available\",\"usage_percent\":$usage_pct,\"mounted\":\"$mounted\"}"
            first=false
        fi
    done < <(df -B1 --output=source,size,used,avail,pcent,mountpoint 2>/dev/null)

    result_json="${result_json}]"

    if [[ "$OUTPUT" == "json" ]]; then
        echo "\"disks\": $result_json"
    else
        echo "=== Disk Usage ==="
        df -h --output=source,size,used,avail,pcent,mountpoint 2>/dev/null | head -10
    fi
}

collect_disk_io() {
    if command -v iostat &>/dev/null; then
        local iostat_output=$(iostat -dx 2>/dev/null | grep -A1 "Device" | tail -1)
        local tps=$(echo "$iostat_output" | awk '{print $2}')
        local read_kb=$(echo "$iostat_output" | awk '{print $5}')
        local write_kb=$(echo "$iostat_output" | awk '{print $6}')
        local await=$(echo "$iostat_output" | awk '{print $9}')
        local util=$(echo "$iostat_output" | awk '{print $12}')

        if [[ "$OUTPUT" == "json" ]]; then
            cat << EOF
"disk_io": {
    "tps": ${tps:-0},
    "read_kb_s": ${read_kb:-0},
    "write_kb_s": ${write_kb:-0},
    "await_ms": ${await:-0},
    "util_percent": ${util:-0}
}
EOF
        else
            echo "=== Disk I/O ==="
            echo "TPS: ${tps:-N/A} | Read: ${read_kb:-0}KB/s | Write: ${write_kb:-0}KB/s | Util: ${util:-0}%"
        fi
    else
        if [[ "$OUTPUT" == "json" ]]; then
            echo "\"disk_io\": {}"
        fi
    fi
}

collect_network() {
    local result_json="["
    local first=true

    for iface in $(ls /sys/class/net/ 2>/dev/null | grep -v lo); do
        local rx_bytes=$(cat /sys/class/net/$iface/statistics/rx_bytes 2>/dev/null || echo "0")
        local tx_bytes=$(cat /sys/class/net/$iface/statistics/tx_bytes 2>/dev/null || echo "0")
        local rx_packets=$(cat /sys/class/net/$iface/statistics/rx_packets 2>/dev/null || echo "0")
        local tx_packets=$(cat /sys/class/net/$iface/statistics/tx_packets 2>/dev/null || echo "0")
        local speed=$(cat /sys/class/net/$iface/speed 2>/dev/null || echo "0")
        local status=$(cat /sys/class/net/$iface/operstate 2>/dev/null || echo "unknown")

        if [[ "$first" == "false" ]]; then
            result_json="${result_json},"
        fi
        result_json="${result_json}{\"name\":\"$iface\",\"rx_bytes\":$rx_bytes,\"tx_bytes\":$tx_bytes,\"rx_packets\":$rx_packets,\"tx_packets\":$tx_packets,\"speed_mbps\":$speed,\"status\":\"$status\"}"
        first=false
    done

    result_json="${result_json}]"

    if [[ "$OUTPUT" == "json" ]]; then
        echo "\"network\": $result_json"
    else
        echo "=== Network Interfaces ==="
        ip -br addr show 2>/dev/null
    fi
}

collect_load() {
    local load1=$(awk '{print $1}' /proc/loadavg)
    local load5=$(awk '{print $2}' /proc/loadavg)
    local load15=$(awk '{print $3}' /proc/loadavg)
    local running=$(awk '{print $4}' /proc/loadavg)
    local total_threads=$(ps aux --no-headers 2>/dev/null | wc -l)

    if [[ "$OUTPUT" == "json" ]]; then
        cat << EOF
"load": {
    "load_1m": $load1,
    "load_5m": $load5,
    "load_15m": $load15,
    "running_processes": "$running",
    "total_threads": $total_threads
}
EOF
    else
        echo "=== Load Average ==="
        echo "Load: $load1 (1m), $load5 (5m), $load15 (15m)"
        echo "Processes: $running running, $total_threads total"
    fi
}

collect_top_cpu() {
    local result_json="["
    local first=true

    while read -r line; do
        local pid=$(echo "$line" | awk '{print $1}')
        local user=$(echo "$line" | awk '{print $2}')
        local cpu=$(echo "$line" | awk '{print $3}')
        local mem=$(echo "$line" | awk '{print $4}')
        local cmd=$(echo "$line" | cut -d' ' -f11- | head -c 50 | sed 's/"/\\"/g')

        if [[ "$first" == "false" ]]; then
            result_json="${result_json},"
        fi
        result_json="${result_json}{\"pid\":$pid,\"user\":\"$user\",\"cpu\":$cpu,\"mem\":$mem,\"cmd\":\"$cmd\"}"
        first=false
    done < <(ps aux --no-headers 2>/dev/null | sort -k3 -rn | head -10)

    result_json="${result_json}]"

    if [[ "$OUTPUT" == "json" ]]; then
        echo "\"top_cpu_processes\": $result_json"
    else
        echo "=== Top 10 CPU Processes ==="
        ps aux --no-headers 2>/dev/null | sort -k3 -rn | head -10 | awk '{printf "%s %s %s%% %s%% %s\n", $1, $2, $3, $4, $11}'
    fi
}

collect_top_mem() {
    local result_json="["
    local first=true

    while read -r line; do
        local pid=$(echo "$line" | awk '{print $1}')
        local user=$(echo "$line" | awk '{print $2}')
        local cpu=$(echo "$line" | awk '{print $3}')
        local mem=$(echo "$line" | awk '{print $4}')
        local cmd=$(echo "$line" | cut -d' ' -f11- | head -c 50 | sed 's/"/\\"/g')

        if [[ "$first" == "false" ]]; then
            result_json="${result_json},"
        fi
        result_json="${result_json}{\"pid\":$pid,\"user\":\"$user\",\"cpu\":$cpu,\"mem\":$mem,\"cmd\":\"$cmd\"}"
        first=false
    done < <(ps aux --no-headers 2>/dev/null | sort -k4 -rn | head -10)

    result_json="${result_json}]"

    if [[ "$OUTPUT" == "json" ]]; then
        echo "\"top_mem_processes\": $result_json"
    else
        echo "=== Top 10 Memory Processes ==="
        ps aux --no-headers 2>/dev/null | sort -k4 -rn | head -10 | awk '{printf "%s %s %s%% %s%% %s\n", $1, $2, $3, $4, $11}'
    fi
}

collect_services() {
    local services=("kubelet" "containerd" "docker")
    local result_json="{"
    local first=true

    for svc in "${services[@]}"; do
        local status=$(systemctl is-active $svc 2>/dev/null || echo "unknown")
        local enabled=$(systemctl is-enabled $svc 2>/dev/null || echo "unknown")

        if [[ "$first" == "false" ]]; then
            result_json="${result_json},"
        fi
        result_json="${result_json}\"$svc\":{\"status\":\"$status\",\"enabled\":\"$enabled\"}"
        first=false
    done

    result_json="${result_json}}"

    if [[ "$OUTPUT" == "json" ]]; then
        echo "\"services\": $result_json"
    else
        echo "=== Services Status ==="
        for svc in "${services[@]}"; do
            echo "$svc: $(systemctl is-active $svc 2>/dev/null || echo 'unknown')"
        done
    fi
}

collect_tcp_udp() {
    local tcp_estab=$(grep " 01 " /proc/net/tcp 2>/dev/null | wc -l || echo "0")
    local tcp_timewait=$(grep " 06 " /proc/net/tcp 2>/dev/null | wc -l || echo "0")
    local udp_sockets=$(cat /proc/net/udp 2>/dev/null | wc -l || echo "0")
    udp_sockets=$((udp_sockets - 1))

    if [[ "$OUTPUT" == "json" ]]; then
        cat << EOF
"tcp_udp": {
    "tcp_established": $tcp_estab,
    "tcp_timewait": $tcp_timewait,
    "udp_sockets": $udp_sockets
}
EOF
    else
        echo "=== TCP/UDP Stats ==="
        echo "TCP Established: $tcp_estab | Timewait: $tcp_timewait"
        echo "UDP Sockets: $udp_sockets"
    fi
}

collect_all() {
    echo "{"
    echo "\"timestamp\": \"$(timestamp)\","
    collect_hostname
    echo ","
    collect_cpu
    echo ","
    collect_memory
    echo ","
    collect_disks
    echo ","
    collect_disk_io
    echo ","
    collect_network
    echo ","
    collect_load
    echo ","
    collect_top_cpu
    echo ","
    collect_top_mem
    echo ","
    collect_services
    echo ","
    collect_tcp_udp
    echo "}"
}

case "${1:-json}" in
    json|detail)
        collect_all
        ;;
    text)
        echo "=== System Monitor - $(timestamp) ==="
        echo ""
        collect_hostname
        echo ""
        collect_cpu
        echo ""
        collect_memory
        echo ""
        collect_disks
        echo ""
        collect_load
        echo ""
        collect_services
        ;;
    *)
        echo "Usage: $0 [json|text]"
        ;;
esac