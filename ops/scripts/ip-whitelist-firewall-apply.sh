#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: $0 <ip_or_cidr> <port> [label]" >&2
  exit 64
}

IP_OR_CIDR="${1:-}"
PORT="${2:-}"
LABEL="${3:-ip-whitelist}"

[[ -n "$IP_OR_CIDR" && -n "$PORT" ]] || usage

if ! [[ "$PORT" =~ ^[0-9]{1,5}$ ]] || (( PORT < 1 || PORT > 65535 )); then
  echo "invalid port: $PORT" >&2
  exit 65
fi

if ! [[ "$IP_OR_CIDR" =~ ^[0-9a-fA-F:.]+(/[0-9]{1,3})?$ ]]; then
  echo "invalid ip or cidr: $IP_OR_CIDR" >&2
  exit 66
fi

if command -v iptables >/dev/null 2>&1; then
  if [[ "$(id -u)" -eq 0 ]]; then
    IPTABLES=(iptables)
  elif command -v sudo >/dev/null 2>&1; then
    IPTABLES=(sudo -n iptables)
  else
    echo "iptables is available but root privileges are required." >&2
    exit 67
  fi

  if "${IPTABLES[@]}" -C INPUT -p tcp -s "$IP_OR_CIDR" --dport "$PORT" -j ACCEPT >/dev/null 2>&1; then
    echo "already applied: ip=$IP_OR_CIDR port=$PORT via iptables"
    exit 0
  fi

  "${IPTABLES[@]}" -I INPUT -p tcp -s "$IP_OR_CIDR" --dport "$PORT" -m comment --comment "$LABEL" -j ACCEPT
  echo "applied: ip=$IP_OR_CIDR port=$PORT via iptables"
  exit 0
fi

if command -v nft >/dev/null 2>&1; then
  echo "nft is available but automatic nft rule wiring is not configured yet." >&2
  exit 68
fi

echo "no supported firewall tool found" >&2
exit 69
