#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DOMAIN="${DOMAIN:-carbonet2026.duckdns.org}"
STATE_DIR="${STATE_DIR:-$ROOT_DIR/var/nginx-duckdns-local}"
CA_DIR="${CA_DIR:-$STATE_DIR/ca}"
CERT_DIR="${CERT_DIR:-$STATE_DIR/certs/$DOMAIN}"
CA_KEY_PATH="$CA_DIR/carbonet-local-root-ca.key"
CA_CERT_PATH="$CA_DIR/carbonet-local-root-ca.pem"
SERVER_KEY_PATH="$CERT_DIR/privkey.pem"
SERVER_CSR_PATH="$CERT_DIR/$DOMAIN.csr"
SERVER_CERT_PATH="$CERT_DIR/fullchain.pem"
SERVER_LEAF_PATH="$CERT_DIR/cert.pem"
SERVER_EXT_PATH="$CERT_DIR/$DOMAIN.ext"
VALIDITY_DAYS="${VALIDITY_DAYS:-825}"
CA_VALIDITY_DAYS="${CA_VALIDITY_DAYS:-3650}"
CA_SUBJECT="${CA_SUBJECT:-/C=KR/ST=Seoul/L=Seoul/O=Carbonet/OU=Local Root CA/CN=Carbonet Local Root CA}"
SERVER_SUBJECT="${SERVER_SUBJECT:-/C=KR/ST=Seoul/L=Seoul/O=Carbonet/OU=Local Proxy/CN=$DOMAIN}"
ALT_NAMES="${ALT_NAMES:-DNS:$DOMAIN,DNS:localhost,IP:127.0.0.1}"

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
}

prepare_dirs() {
  mkdir -p "$CA_DIR" "$CERT_DIR"
}

generate_ca_if_missing() {
  if [[ -f "$CA_KEY_PATH" && -f "$CA_CERT_PATH" ]]; then
    return
  fi

  openssl req -x509 -nodes -newkey rsa:4096 \
    -keyout "$CA_KEY_PATH" \
    -out "$CA_CERT_PATH" \
    -days "$CA_VALIDITY_DAYS" \
    -sha256 \
    -subj "$CA_SUBJECT" \
    -addext "basicConstraints=critical,CA:TRUE,pathlen:1" \
    -addext "keyUsage=critical,keyCertSign,cRLSign" \
    -addext "subjectKeyIdentifier=hash"
}

write_server_extensions() {
  cat >"$SERVER_EXT_PATH" <<EOF
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=$ALT_NAMES
EOF
}

generate_server_cert() {
  openssl req -nodes -newkey rsa:2048 \
    -keyout "$SERVER_KEY_PATH" \
    -out "$SERVER_CSR_PATH" \
    -subj "$SERVER_SUBJECT" >/dev/null 2>&1

  openssl x509 -req \
    -in "$SERVER_CSR_PATH" \
    -CA "$CA_CERT_PATH" \
    -CAkey "$CA_KEY_PATH" \
    -CAcreateserial \
    -out "$SERVER_LEAF_PATH" \
    -days "$VALIDITY_DAYS" \
    -sha256 \
    -extfile "$SERVER_EXT_PATH"

  cat "$SERVER_LEAF_PATH" "$CA_CERT_PATH" >"$SERVER_CERT_PATH"
}

print_summary() {
  cat <<EOF
ca_cert=$CA_CERT_PATH
server_cert=$SERVER_CERT_PATH
server_leaf=$SERVER_LEAF_PATH
server_key=$SERVER_KEY_PATH
install_root_ca=true
EOF
}

main() {
  require_command openssl
  prepare_dirs
  generate_ca_if_missing
  write_server_extensions
  generate_server_cert
  print_summary
}

main "$@"
