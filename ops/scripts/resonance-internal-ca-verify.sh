#!/usr/bin/env bash
set -euo pipefail

CA_DIR="${RESONANCE_INTERNAL_CA_DIR:-/opt/resonance-data/pki/resonance-internal-ca}"
TRUST_DIR="${RESONANCE_CLIENT_TRUST_DIR:-/opt/resonance-data/control-plane/trust}"
MIN_VALID_SECONDS="${RESONANCE_CERT_MIN_VALID_SECONDS:-7776000}"
declare -a hosts=(
  "backstage.172.16.1.232.nip.io"
  "identity.172.16.1.232.nip.io"
)

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

for host in "${hosts[@]}"; do
  leaf="$(mktemp)"
  trap 'rm -f -- "${leaf:-}"' EXIT INT TERM
  echo | openssl s_client -connect "$host:443" -servername "$host" \
    -CAfile "$CA_DIR/ca.crt" -verify_return_error 2>/dev/null |
    openssl x509 -out "$leaf"
  openssl verify -CAfile "$CA_DIR/ca.crt" -verify_hostname "$host" "$leaf" >/dev/null
  openssl x509 -checkend "$MIN_VALID_SECONDS" -noout -in "$leaf" ||
    { echo "[internal-ca] $host expires inside the safety window" >&2; exit 5; }
  rm -f -- "$leaf"
  trap - EXIT INT TERM
done

for secret in resonance-backstage-tls resonance-keycloak-tls; do
  kubectl -n resonance-ops get secret "$secret" >/dev/null
done

mkdir -p "$TRUST_DIR"
tmp="$(mktemp "$TRUST_DIR/.ca.XXXXXXXX")"
install -m 0644 "$CA_DIR/ca.crt" "$tmp"
mv -f "$tmp" "$TRUST_DIR/Resonance-Internal-Root-CA.crt"
fingerprint="$(openssl x509 -in "$CA_DIR/ca.crt" -noout -fingerprint -sha256 |
  cut -d= -f2)"
printf '%s\n' "$fingerprint" >"$TRUST_DIR/Resonance-Internal-Root-CA.sha256"
echo "[internal-ca] PASS hosts=${#hosts[@]} clientTrust=$TRUST_DIR fingerprint=$fingerprint"
