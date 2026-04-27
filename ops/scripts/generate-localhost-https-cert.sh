#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CERT_DIR="${CERT_DIR:-$ROOT_DIR/ops/config/certs}"
CERT_ALIAS="${CERT_ALIAS:-carbonet-local}"
CERT_PASSWORD="${CERT_PASSWORD:-changeit}"
CERT_FILE="${CERT_FILE:-$CERT_DIR/carbonet-localhost.p12}"
CERT_VALIDITY_DAYS="${CERT_VALIDITY_DAYS:-3650}"
STATE_DIR="${STATE_DIR:-$ROOT_DIR/var/nginx-duckdns-local}"
CA_DIR="${CA_DIR:-$STATE_DIR/ca}"
CA_KEY_PATH="$CA_DIR/carbonet-local-root-ca.key"
CA_CERT_PATH="$CA_DIR/carbonet-local-root-ca.pem"
SERVER_KEY_PATH="$CERT_DIR/carbonet-localhost.key"
SERVER_CSR_PATH="$CERT_DIR/carbonet-localhost.csr"
SERVER_CERT_PATH="$CERT_DIR/carbonet-localhost.crt"
SERVER_EXT_PATH="$CERT_DIR/carbonet-localhost.ext"
SERVER_SUBJECT="${SERVER_SUBJECT:-/C=KR/ST=Seoul/L=Seoul/O=Carbonet/OU=Local Runtime/CN=localhost}"
ALT_NAMES="${ALT_NAMES:-DNS:localhost,IP:127.0.0.1}"

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
}

generate_ca_if_missing() {
  if [[ -f "$CA_KEY_PATH" && -f "$CA_CERT_PATH" ]]; then
    return
  fi

  bash "$ROOT_DIR/ops/scripts/generate-local-browser-trusted-cert.sh" >/dev/null
}

write_server_extensions() {
  cat >"$SERVER_EXT_PATH" <<EOF
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=$ALT_NAMES
EOF
}

mkdir -p "$CERT_DIR"

require_command keytool
require_command openssl
generate_ca_if_missing
write_server_extensions

openssl req -nodes -newkey rsa:2048 \
  -keyout "$SERVER_KEY_PATH" \
  -out "$SERVER_CSR_PATH" \
  -subj "$SERVER_SUBJECT" >/dev/null 2>&1

openssl x509 -req \
  -in "$SERVER_CSR_PATH" \
  -CA "$CA_CERT_PATH" \
  -CAkey "$CA_KEY_PATH" \
  -CAcreateserial \
  -out "$SERVER_CERT_PATH" \
  -days "$CERT_VALIDITY_DAYS" \
  -sha256 \
  -extfile "$SERVER_EXT_PATH" >/dev/null

openssl pkcs12 -export \
  -name "$CERT_ALIAS" \
  -inkey "$SERVER_KEY_PATH" \
  -in "$SERVER_CERT_PATH" \
  -certfile "$CA_CERT_PATH" \
  -out "$CERT_FILE" \
  -passout "pass:$CERT_PASSWORD" >/dev/null

echo "[generate-localhost-https-cert] generated $CERT_FILE"
echo "[generate-localhost-https-cert] add these to ops/config/carbonet-18000.env if needed:"
echo "SERVER_SSL_ENABLED=true"
echo "SERVER_SSL_KEY_STORE=$CERT_FILE"
echo "SERVER_SSL_KEY_STORE_PASSWORD=$CERT_PASSWORD"
echo "SERVER_SSL_KEY_STORE_TYPE=PKCS12"
echo "SERVER_SSL_KEY_ALIAS=$CERT_ALIAS"
echo "CARBONET_RUNTIME_SCHEME=https"
echo "CARBONET_CURL_INSECURE=true"
echo "CARBONET_HEALTH_CHECK_URL=https://127.0.0.1:18000/actuator/health"
