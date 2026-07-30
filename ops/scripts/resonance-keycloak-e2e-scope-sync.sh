#!/usr/bin/env bash
set -Eeuo pipefail

NAMESPACE="${KEYCLOAK_NAMESPACE:-resonance-ops}"
REALM="${KEYCLOAK_REALM:-resonance}"
pod="$(kubectl -n "$NAMESPACE" get pods \
  -l app.kubernetes.io/name=resonance-keycloak \
  -o jsonpath='{.items[0].metadata.name}')"
[[ -n "$pod" ]] || {
  echo "[e2e-scope-sync] Keycloak pod is missing" >&2
  exit 1
}
admin_username="$(kubectl -n "$NAMESPACE" get secret resonance-keycloak \
  -o jsonpath='{.data.KC_BOOTSTRAP_ADMIN_USERNAME}' | base64 -d)"
admin_password="$(kubectl -n "$NAMESPACE" get secret resonance-keycloak \
  -o jsonpath='{.data.KC_BOOTSTRAP_ADMIN_PASSWORD}' | base64 -d)"

kubectl -n "$NAMESPACE" exec "$pod" -c keycloak -- env \
  ADMIN_USERNAME="$admin_username" ADMIN_PASSWORD="$admin_password" \
  REALM="$REALM" bash -ceu '
    K=/opt/keycloak/bin/kcadm.sh
    "$K" config credentials --server http://localhost:8080 \
      --realm master --user "$ADMIN_USERNAME" --password "$ADMIN_PASSWORD" >/dev/null
    for spec in \
      "resonance-requester:*" \
      "resonance-reviewer:PRJ-2026-AD5D0F" \
      "resonance-approver:*"; do
      username=${spec%%:*}
      project_scope=${spec#*:}
      uid=$("$K" get users -r "$REALM" -q username="$username" \
        --fields id --format csv --noquotes | head -n1)
      [ -n "$uid" ]
      "$K" update "users/$uid" -r "$REALM" \
        -s "attributes={\"resonanceProjectScopes\":[\"$project_scope\"]}" >/dev/null
      observed=$("$K" get "users/$uid" -r "$REALM" --fields attributes \
        | tr -d "[:space:]")
      case "$observed" in
        *"resonanceProjectScopes"*) ;;
        *) echo "scope attribute missing for $username" >&2; exit 1 ;;
      esac
    done
  '
admin_password=
echo "[e2e-scope-sync] PASS accounts=3 project-scopes=verified"
