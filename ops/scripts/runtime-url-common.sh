#!/usr/bin/env bash

carbonet_bool_true() {
  case "${1:-}" in
    1|true|TRUE|yes|YES|on|ON)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

carbonet_runtime_scheme() {
  if [[ -n "${CARBONET_RUNTIME_SCHEME:-}" ]]; then
    printf '%s\n' "$CARBONET_RUNTIME_SCHEME"
    return 0
  fi
  if carbonet_bool_true "${SERVER_SSL_ENABLED:-false}"; then
    printf '%s\n' "https"
    return 0
  fi
  printf '%s\n' "http"
}

carbonet_runtime_host() {
  printf '%s\n' "${CARBONET_RUNTIME_HOST:-127.0.0.1}"
}

carbonet_runtime_port() {
  printf '%s\n' "${PORT:-18000}"
}

carbonet_runtime_base_url() {
  local scheme
  local host
  local port
  scheme="$(carbonet_runtime_scheme)"
  host="$(carbonet_runtime_host)"
  port="$(carbonet_runtime_port)"
  printf '%s://%s:%s\n' "$scheme" "$host" "$port"
}

carbonet_runtime_health_url() {
  if [[ -n "${CARBONET_HEALTH_CHECK_URL:-}" ]]; then
    printf '%s\n' "$CARBONET_HEALTH_CHECK_URL"
    return 0
  fi
  printf '%s/actuator/health\n' "$(carbonet_runtime_base_url)"
}

carbonet_set_curl_args() {
  CARBONET_CURL_ARGS=()
  if carbonet_bool_true "${CARBONET_CURL_INSECURE:-false}"; then
    CARBONET_CURL_ARGS+=("-k")
  fi
}
