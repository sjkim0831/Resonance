#!/usr/bin/env bash
set -euo pipefail

CA_DIR="${RESONANCE_INTERNAL_CA_DIR:-/opt/resonance-data/pki/resonance-internal-ca}"
TRUST_DIR="${RESONANCE_CLIENT_TRUST_DIR:-/opt/resonance-data/control-plane/trust}"
MIN_VALID_SECONDS="${RESONANCE_CERT_MIN_VALID_SECONDS:-7776000}"
KEYCLOAK_TLS_DIR="${RESONANCE_KEYCLOAK_TLS_DIR:-/opt/resonance-data/pki/resonance-keycloak}"

for command in openssl kubectl install; do
  command -v "$command" >/dev/null || {
    echo "[internal-ca] missing command: $command" >&2
    exit 1
  }
done

for file in ca.crt ca.key; do
  [[ -s "$CA_DIR/$file" ]] || {
    echo "[internal-ca] missing protected CA file: $CA_DIR/$file" >&2
    exit 2
  }
done

cert_public="$(openssl x509 -in "$CA_DIR/ca.crt" -pubkey -noout |
  openssl pkey -pubin -outform DER 2>/dev/null | openssl sha256)"
key_public="$(openssl pkey -in "$CA_DIR/ca.key" -pubout -outform DER 2>/dev/null |
  openssl sha256)"
[[ "$cert_public" == "$key_public" ]] || {
  echo "[internal-ca] CA certificate and private key do not match" >&2
  exit 3
}
openssl x509 -checkend "$MIN_VALID_SECONDS" -noout -in "$CA_DIR/ca.crt" ||
  { echo "[internal-ca] CA expires inside the safety window" >&2; exit 4; }

issue_leaf() {
  local host="$1" directory="$2" csr
  mkdir -p "$directory"
  chmod 700 "$directory"
  csr="$(mktemp "$directory/.tls.XXXXXXXX.csr")"
  openssl req -newkey rsa:3072 -sha256 -nodes \
    -keyout "$directory/tls.key.new" -out "$csr" \
    -subj "/CN=$host" -addext "subjectAltName=DNS:$host" >/dev/null 2>&1
  openssl x509 -req -sha256 -in "$csr" \
    -CA "$CA_DIR/ca.crt" -CAkey "$CA_DIR/ca.key" -CAcreateserial \
    -out "$directory/tls.crt.new" -days 825 -copy_extensions copy >/dev/null 2>&1
  mv -f "$directory/tls.key.new" "$directory/tls.key"
  mv -f "$directory/tls.crt.new" "$directory/tls.crt"
  rm -f -- "$csr"
  chmod 600 "$directory/tls.key"
  chmod 644 "$directory/tls.crt"
  echo "[internal-ca] renewed leaf certificate: $host"
}

ensure_leaf() {
  local host="$1" directory="$2" secret="$3" cert_public key_public attempt leaf
  if [[ ! -s "$directory/tls.crt" || ! -s "$directory/tls.key" ]] ||
     ! openssl x509 -checkend "$MIN_VALID_SECONDS" -noout \
       -in "$directory/tls.crt" >/dev/null 2>&1 ||
     ! openssl verify -CAfile "$CA_DIR/ca.crt" -verify_hostname "$host" \
       "$directory/tls.crt" >/dev/null 2>&1; then
    issue_leaf "$host" "$directory"
  fi
  cert_public="$(openssl x509 -in "$directory/tls.crt" -pubkey -noout |
    openssl pkey -pubin -outform DER 2>/dev/null | openssl sha256)"
  key_public="$(openssl pkey -in "$directory/tls.key" -pubout -outform DER 2>/dev/null |
    openssl sha256)"
  if [[ "$cert_public" != "$key_public" ]]; then
    issue_leaf "$host" "$directory"
  fi
  kubectl -n resonance-ops create secret tls "$secret" \
    --cert="$directory/tls.crt" --key="$directory/tls.key" \
    --dry-run=client -o yaml | kubectl apply -f - >/dev/null
  for attempt in $(seq 1 15); do
    leaf="$(mktemp)"
    if echo | openssl s_client -connect "$host:443" -servername "$host" \
      -CAfile "$CA_DIR/ca.crt" -verify_return_error 2>/dev/null |
      openssl x509 -out "$leaf" 2>/dev/null &&
      openssl verify -CAfile "$CA_DIR/ca.crt" -verify_hostname "$host" \
        "$leaf" >/dev/null 2>&1 &&
      openssl x509 -checkend "$MIN_VALID_SECONDS" -noout -in "$leaf" \
        >/dev/null 2>&1; then
      rm -f -- "$leaf"
      return 0
    fi
    rm -f -- "$leaf"
    sleep 2
  done
  echo "[internal-ca] live certificate did not converge: $host" >&2
  return 5
}

ensure_leaf "backstage.172.16.1.232.nip.io" "$CA_DIR" "resonance-backstage-tls"
ensure_leaf "identity.172.16.1.232.nip.io" "$KEYCLOAK_TLS_DIR" "resonance-keycloak-tls"

mkdir -p "$TRUST_DIR"
tmp="$(mktemp "$TRUST_DIR/.ca.XXXXXXXX")"
install -m 0644 "$CA_DIR/ca.crt" "$tmp"
mv -f "$tmp" "$TRUST_DIR/Resonance-Internal-Root-CA.crt"
fingerprint="$(openssl x509 -in "$CA_DIR/ca.crt" -noout -fingerprint -sha256 |
  cut -d= -f2)"
printf '%s\n' "$fingerprint" >"$TRUST_DIR/Resonance-Internal-Root-CA.sha256"
echo "[internal-ca] PASS hosts=2 clientTrust=$TRUST_DIR fingerprint=$fingerprint"
