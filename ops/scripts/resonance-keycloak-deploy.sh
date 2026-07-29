#!/usr/bin/env bash
set -euo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NAMESPACE="${KEYCLOAK_NAMESPACE:-resonance-ops}"
MANIFEST="$ROOT/deploy/k8s/control-plane/keycloak.yaml"
KUBECONFIG="${KUBECONFIG:-/home/sjkim/.kube/config}"
TLS_ROOT="${BACKSTAGE_TLS_DIR:-/opt/resonance-data/pki/resonance-internal-ca}"
TLS_DIR="${KEYCLOAK_TLS_DIR:-/opt/resonance-data/pki/resonance-keycloak}"
KEYCLOAK_HOST="${KEYCLOAK_HOST:-identity.172.16.1.232.nip.io}"
KEYCLOAK_URL="https://$KEYCLOAK_HOST"
REALM="${KEYCLOAK_REALM:-resonance}"
CLIENT_ID="${KEYCLOAK_CLIENT_ID:-resonance-backstage}"
export KUBECONFIG

for command in kubectl openssl curl node xxd; do
  command -v "$command" >/dev/null || {
    echo "[keycloak] missing command: $command" >&2
    exit 1
  }
done

find_leader() {
  local podref pod state
  while IFS= read -r podref; do
    pod="${podref#pod/}"
    state="$(kubectl -n carbonet-prod exec "$pod" -c patroni -- \
      psql -h 127.0.0.1 -U postgres -d postgres -Atqc \
      'select pg_is_in_recovery()' 2>/dev/null || true)"
    if [[ "$state" == "f" ]]; then
      printf '%s' "$pod"
      return 0
    fi
  done < <(kubectl -n carbonet-prod get pods -l app=postgres-patroni -o name)
  return 1
}

ensure_tls() {
  mkdir -p "$TLS_DIR"
  chmod 700 "$TLS_DIR"
  [[ -s "$TLS_ROOT/ca.crt" && -s "$TLS_ROOT/ca.key" ]] || {
    echo "[keycloak] shared internal CA is missing at $TLS_ROOT" >&2
    exit 2
  }
  if [[ ! -s "$TLS_DIR/tls.crt" || ! -s "$TLS_DIR/tls.key" ]]; then
    openssl req -newkey rsa:3072 -sha256 -nodes \
      -keyout "$TLS_DIR/tls.key" \
      -out "$TLS_DIR/tls.csr" \
      -subj "/CN=$KEYCLOAK_HOST" \
      -addext "subjectAltName=DNS:$KEYCLOAK_HOST"
    openssl x509 -req -sha256 \
      -in "$TLS_DIR/tls.csr" \
      -CA "$TLS_ROOT/ca.crt" \
      -CAkey "$TLS_ROOT/ca.key" \
      -CAcreateserial \
      -out "$TLS_DIR/tls.crt" \
      -days 825 -copy_extensions copy
    chmod 600 "$TLS_DIR/tls.key"
  fi
  kubectl -n "$NAMESPACE" create secret tls resonance-keycloak-tls \
    --cert="$TLS_DIR/tls.crt" \
    --key="$TLS_DIR/tls.key" \
    --dry-run=client -o yaml | kubectl apply -f - >/dev/null
  kubectl -n "$NAMESPACE" create configmap resonance-internal-ca \
    --from-file=ca.crt="$TLS_ROOT/ca.crt" \
    --dry-run=client -o yaml | kubectl apply -f - >/dev/null
}

ensure_database() {
  local leader password role_exists database_exists
  leader="$(find_leader)" || {
    echo "[keycloak] writable Patroni leader not found" >&2
    exit 3
  }
  if kubectl -n "$NAMESPACE" get secret resonance-keycloak >/dev/null 2>&1; then
    password="$(kubectl -n "$NAMESPACE" get secret resonance-keycloak \
      -o jsonpath='{.data.KC_DB_PASSWORD}' | base64 -d)"
    admin_password="$(kubectl -n "$NAMESPACE" get secret resonance-keycloak \
      -o jsonpath='{.data.KC_BOOTSTRAP_ADMIN_PASSWORD}' | base64 -d)"
  else
    password="$(openssl rand -hex 24)"
    admin_password="$(openssl rand -base64 32 | tr -d '\n')"
  fi
  [[ -n "$password" ]] || password="$(openssl rand -hex 24)"
  [[ -n "$admin_password" ]] ||
    admin_password="$(openssl rand -base64 32 | tr -d '\n')"

  role_exists="$(kubectl -n carbonet-prod exec "$leader" -c patroni -- \
    psql -h 127.0.0.1 -U postgres -d postgres -Atqc \
    "select 1 from pg_roles where rolname='keycloak'")"
  if [[ "$role_exists" == "1" ]]; then
    kubectl -n carbonet-prod exec "$leader" -c patroni -- \
      psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 \
      -c "alter role keycloak login password '$password'" >/dev/null
  else
    kubectl -n carbonet-prod exec "$leader" -c patroni -- \
      psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 \
      -c "create role keycloak login password '$password'" >/dev/null
  fi
  database_exists="$(kubectl -n carbonet-prod exec "$leader" -c patroni -- \
    psql -h 127.0.0.1 -U postgres -d postgres -Atqc \
    "select 1 from pg_database where datname='keycloak'")"
  if [[ "$database_exists" != "1" ]]; then
    kubectl -n carbonet-prod exec "$leader" -c patroni -- \
      psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 \
      -c "create database keycloak owner keycloak" >/dev/null
  fi
  kubectl -n "$NAMESPACE" create secret generic resonance-keycloak \
    --from-literal=KC_DB_USERNAME=keycloak \
    --from-literal=KC_DB_PASSWORD="$password" \
    --from-literal=KC_BOOTSTRAP_ADMIN_USERNAME=resonance-admin \
    --from-literal=KC_BOOTSTRAP_ADMIN_PASSWORD="$admin_password" \
    --dry-run=client -o yaml | kubectl apply -f - >/dev/null
}

keycloak_exec() {
  local pod
  pod="$(kubectl -n "$NAMESPACE" get pod \
    -l app.kubernetes.io/name=resonance-keycloak \
    -o jsonpath='{.items[0].metadata.name}')"
  kubectl -n "$NAMESPACE" exec "$pod" -c keycloak -- "$@"
}

bootstrap_realm() {
  local admin_password client_secret pod
  admin_password="$(kubectl -n "$NAMESPACE" get secret resonance-keycloak \
    -o jsonpath='{.data.KC_BOOTSTRAP_ADMIN_PASSWORD}' | base64 -d)"
  if kubectl -n "$NAMESPACE" get secret resonance-backstage-oidc-client >/dev/null 2>&1; then
    client_secret="$(kubectl -n "$NAMESPACE" get secret resonance-backstage-oidc-client \
      -o jsonpath='{.data.AUTH_OIDC_CLIENT_SECRET}' | base64 -d)"
  else
    client_secret="$(openssl rand -hex 32)"
  fi
  pod="$(kubectl -n "$NAMESPACE" get pod \
    -l app.kubernetes.io/name=resonance-keycloak \
    -o jsonpath='{.items[0].metadata.name}')"

  kubectl -n "$NAMESPACE" exec "$pod" -c keycloak -- env \
    ADMIN_PASSWORD="$admin_password" CLIENT_SECRET="$client_secret" \
    REALM="$REALM" CLIENT_ID="$CLIENT_ID" bash -ceu '
      K=/opt/keycloak/bin/kcadm.sh
      "$K" config credentials --server http://localhost:8080 \
        --realm master --user resonance-admin --password "$ADMIN_PASSWORD" >/dev/null
      "$K" get "realms/$REALM" >/dev/null 2>&1 ||
        "$K" create realms -s realm="$REALM" -s enabled=true \
          -s loginWithEmailAllowed=false -s duplicateEmailsAllowed=true \
          -s resetPasswordAllowed=true >/dev/null
      "$K" update "realms/$REALM" -s enabled=true \
        -s loginWithEmailAllowed=false -s duplicateEmailsAllowed=true \
        -s resetPasswordAllowed=true >/dev/null
      for group in platform-engineering carbon-operations verification-governance; do
        "$K" get groups -r "$REALM" -q search="$group" |
          grep -q "\"name\" : \"$group\"" ||
          "$K" create groups -r "$REALM" -s name="$group" >/dev/null
      done
      cid=$("$K" get clients -r "$REALM" -q clientId="$CLIENT_ID" \
        --fields id --format csv --noquotes | head -n1)
      if [ -z "$cid" ]; then
        "$K" create clients -r "$REALM" \
          -s clientId="$CLIENT_ID" -s enabled=true -s publicClient=false \
          -s standardFlowEnabled=true -s directAccessGrantsEnabled=true \
          -s "redirectUris=[\"https://backstage.172.16.1.232.nip.io/api/auth/oidc/handler/frame\"]" \
          -s "webOrigins=[\"https://backstage.172.16.1.232.nip.io\"]" \
          -s secret="$CLIENT_SECRET" >/dev/null
        cid=$("$K" get clients -r "$REALM" -q clientId="$CLIENT_ID" \
          --fields id --format csv --noquotes | head -n1)
      else
        "$K" update "clients/$cid" -r "$REALM" \
          -s enabled=true -s publicClient=false -s standardFlowEnabled=true \
          -s directAccessGrantsEnabled=true \
          -s "redirectUris=[\"https://backstage.172.16.1.232.nip.io/api/auth/oidc/handler/frame\"]" \
          -s "webOrigins=[\"https://backstage.172.16.1.232.nip.io\"]" \
          -s secret="$CLIENT_SECRET" >/dev/null
      fi
      sid=$("$K" get client-scopes -r "$REALM" \
        --fields id,name --format csv --noquotes |
        grep ",groups$" | head -n1 | cut -d, -f1)
      if [ -z "$sid" ]; then
        "$K" create client-scopes -r "$REALM" \
          -s name=groups -s protocol=openid-connect >/dev/null
        sid=$("$K" get client-scopes -r "$REALM" \
          --fields id,name --format csv --noquotes |
          grep ",groups$" | head -n1 | cut -d, -f1)
      fi
      "$K" update "clients/$cid/optional-client-scopes/$sid" \
        -r "$REALM" -n >/dev/null
      mapper=$("$K" get "clients/$cid/protocol-mappers/models" -r "$REALM" |
        grep -c "\"name\" : \"groups\"" || true)
      if [ "$mapper" = 0 ]; then
        "$K" create "clients/$cid/protocol-mappers/models" -r "$REALM" \
          -s name=groups -s protocol=openid-connect \
          -s protocolMapper=oidc-group-membership-mapper \
          -s "config.\"claim.name\"=groups" \
          -s "config.\"full.path\"=false" \
          -s "config.\"id.token.claim\"=true" \
          -s "config.\"access.token.claim\"=true" \
          -s "config.\"userinfo.token.claim\"=true" >/dev/null
      fi
    '

  kubectl -n "$NAMESPACE" create secret generic resonance-backstage-oidc-client \
    --from-literal=AUTH_OIDC_METADATA_URL="$KEYCLOAK_URL/realms/$REALM/.well-known/openid-configuration" \
    --from-literal=AUTH_OIDC_CLIENT_ID="$CLIENT_ID" \
    --from-literal=AUTH_OIDC_CLIENT_SECRET="$client_secret" \
    --from-literal=AUTH_OIDC_DISPLAY_NAME="Resonance 통합계정" \
    --dry-run=client -o yaml | kubectl apply -f - >/dev/null
}

migrate_users() {
  local leader pod admin_password test_password
  leader="$(find_leader)"
  pod="$(kubectl -n "$NAMESPACE" get pod \
    -l app.kubernetes.io/name=resonance-keycloak \
    -o jsonpath='{.items[0].metadata.name}')"
  admin_password="$(kubectl -n "$NAMESPACE" get secret resonance-keycloak \
    -o jsonpath='{.data.KC_BOOTSTRAP_ADMIN_PASSWORD}' | base64 -d)"
  test_password="$(openssl rand -base64 24 | tr -d '\n')"
  kubectl -n "$NAMESPACE" create secret generic resonance-keycloak-e2e-users \
    --from-literal=PASSWORD="$test_password" \
    --dry-run=client -o yaml | kubectl apply -f - >/dev/null

  kubectl -n carbonet-prod exec "$leader" -c patroni -- \
    psql -h 127.0.0.1 -U postgres -d carbonet -AtF '|' -c "
      select encode(convert_to(trim(u.user_id),'UTF8'),'hex'),
             encode(convert_to(coalesce(nullif(trim(u.user_nm),''),trim(u.user_id)),'UTF8'),'hex'),
             encode(convert_to(trim(u.user_email),'UTF8'),'hex'),
             encode(convert_to(
               case
                 when bool_or(s.author_code='ROLE_SYSTEM_MASTER') then 'verification-governance'
                 when bool_or(s.author_code='ROLE_OPERATION_ADMIN') then 'carbon-operations'
                 else 'platform-engineering'
               end,'UTF8'),'hex')
      from comvnusermaster u
      left join comtnemplyrscrtyestbs s
        on trim(s.scrty_dtrmn_trget_id)=trim(u.esntl_id)
      where nullif(trim(u.user_id),'') is not null
        and nullif(trim(u.user_email),'') is not null
      group by u.user_id,u.user_nm,u.user_email
      order by trim(u.user_id)" |
    while IFS='|' read -r user_hex name_hex email_hex group_hex; do
      legacy_username="$(printf '%s' "$user_hex" | xxd -r -p)"
      username="$(RAW_USERNAME="$legacy_username" node -e '
        const value = String(process.env.RAW_USERNAME || "")
          .trim().toLocaleLowerCase("en-US")
          .replace(/[^a-z0-9_.-]+/g, "-")
          .replace(/^-+|-+$/g, "").slice(0, 63);
        if (!value) process.exit(2);
        process.stdout.write(value);
      ')"
      email="$(printf '%s' "$email_hex" | xxd -r -p)"
      group="$(printf '%s' "$group_hex" | xxd -r -p)"
      kubectl -n "$NAMESPACE" exec "$pod" -c keycloak -- env \
        USERNAME="$username" \
        EMAIL="$email" GROUP="$group" \
        REALM="$REALM" bash -ceu '
          K=/opt/keycloak/bin/kcadm.sh
          uid=$("$K" get users -r "$REALM" -q username="$USERNAME" \
            --fields id --format csv --noquotes | head -n1)
          if [ -z "$uid" ]; then
            "$K" create users -r "$REALM" -s username="$USERNAME" \
              -s enabled=true -s email="$EMAIL" -s emailVerified=false \
              -s "requiredActions=[\"UPDATE_PASSWORD\"]" >/dev/null 2>&1
            uid=$("$K" get users -r "$REALM" -q username="$USERNAME" \
              --fields id --format csv --noquotes | head -n1)
          fi
          gid=$("$K" get groups -r "$REALM" -q exact=true -q search="$GROUP" \
            --fields id --format csv --noquotes | head -n1)
          [ -n "$uid" ] && [ -n "$gid" ] &&
            "$K" update "users/$uid/groups/$gid" -r "$REALM" -n >/dev/null
        '
    done

  for spec in \
    "resonance-requester:platform-engineering" \
    "resonance-reviewer:carbon-operations" \
    "resonance-approver:verification-governance"; do
    username="${spec%%:*}"
    group="${spec#*:}"
    kubectl -n "$NAMESPACE" exec "$pod" -c keycloak -- env \
      TEST_PASSWORD="$test_password" \
      USERNAME="$username" GROUP="$group" REALM="$REALM" bash -ceu '
        K=/opt/keycloak/bin/kcadm.sh
        uid=$("$K" get users -r "$REALM" -q username="$USERNAME" \
          --fields id --format csv --noquotes | head -n1)
        if [ -z "$uid" ]; then
          "$K" create users -r "$REALM" -s username="$USERNAME" \
            -s enabled=true -s email="$USERNAME@resonance.local" \
            -s firstName=Resonance -s lastName="$GROUP" \
            -s emailVerified=true >/dev/null
          uid=$("$K" get users -r "$REALM" -q username="$USERNAME" \
            --fields id --format csv --noquotes | head -n1)
        fi
        "$K" update "users/$uid" -r "$REALM" \
          -s enabled=true -s email="$USERNAME@resonance.local" \
          -s firstName=Resonance -s lastName="$GROUP" \
          -s emailVerified=true -s "requiredActions=[]" >/dev/null
        "$K" set-password -r "$REALM" --username "$USERNAME" \
          --new-password "$TEST_PASSWORD" --temporary=false >/dev/null
        gid=$("$K" get groups -r "$REALM" -q exact=true -q search="$GROUP" \
          --fields id --format csv --noquotes | head -n1)
        "$K" update "users/$uid/groups/$gid" -r "$REALM" -n >/dev/null
      '
  done
}

mode="${1:-deploy}"
case "$mode" in
  deploy)
    ensure_tls
    ensure_database
    kubectl apply -f "$MANIFEST"
    kubectl -n "$NAMESPACE" rollout status deployment/resonance-keycloak --timeout=600s
    curl --cacert "$TLS_ROOT/ca.crt" -fsS --max-time 15 \
      "$KEYCLOAK_URL/realms/master/.well-known/openid-configuration" >/dev/null
    bootstrap_realm
    migrate_users
    authorization_status="$(curl --cacert "$TLS_ROOT/ca.crt" -sS -o /dev/null \
      -w '%{http_code}' \
      "$KEYCLOAK_URL/realms/$REALM/protocol/openid-connect/auth?client_id=$CLIENT_ID&response_type=code&redirect_uri=https%3A%2F%2Fbackstage.172.16.1.232.nip.io%2Fapi%2Fauth%2Foidc%2Fhandler%2Fframe&scope=openid%20profile%20email%20groups")"
    [[ "$authorization_status" == "200" ]] || {
      echo "[keycloak] OIDC authorization request failed: HTTP $authorization_status" >&2
      exit 4
    }
    echo "[keycloak] PASS realm, client, groups, and member identities are synchronized"
    ;;
  status)
    kubectl -n "$NAMESPACE" get deployment,pod,service,ingress \
      -l app.kubernetes.io/name=resonance-keycloak -o wide
    curl --cacert "$TLS_ROOT/ca.crt" -fsS --max-time 15 \
      "$KEYCLOAK_URL/realms/$REALM/.well-known/openid-configuration" >/dev/null
    echo "[keycloak] PASS $KEYCLOAK_URL"
    ;;
  *)
    echo "usage: $0 {deploy|status}" >&2
    exit 64
    ;;
esac
