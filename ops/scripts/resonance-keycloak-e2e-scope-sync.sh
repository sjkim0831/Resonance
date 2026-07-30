#!/usr/bin/env bash
set -Eeuo pipefail

NAMESPACE="${KEYCLOAK_NAMESPACE:-resonance-ops}"
REALM="${KEYCLOAK_REALM:-resonance}"
for command in kubectl jq base64 curl; do
  command -v "$command" >/dev/null || {
    echo "[e2e-scope-sync] missing command: $command" >&2
    exit 1
  }
done

service_ip="$(
  kubectl -n "$NAMESPACE" get service resonance-keycloak \
    -o jsonpath='{.spec.clusterIP}'
)"
[[ -n "$service_ip" && "$service_ip" != "None" ]] || {
  echo "[e2e-scope-sync] Keycloak service endpoint is missing" >&2
  exit 1
}
admin_url="${KEYCLOAK_ADMIN_URL:-http://${service_ip}:8080}"
admin_username="$(
  kubectl -n "$NAMESPACE" get secret resonance-keycloak \
    -o jsonpath='{.data.KC_BOOTSTRAP_ADMIN_USERNAME}' | base64 -d
)"
admin_password="$(
  kubectl -n "$NAMESPACE" get secret resonance-keycloak \
    -o jsonpath='{.data.KC_BOOTSTRAP_ADMIN_PASSWORD}' | base64 -d
)"
admin_token="$(
  curl -fsS --max-time 10 \
    -X POST "$admin_url/realms/master/protocol/openid-connect/token" \
    --data-urlencode 'client_id=admin-cli' \
    --data-urlencode "username=$admin_username" \
    --data-urlencode "password=$admin_password" \
    --data-urlencode 'grant_type=password' |
    jq -er '.access_token'
)"
admin_password=

keycloak_get() {
  curl -fsS --max-time 10 \
    -H "Authorization: Bearer $admin_token" \
    "$admin_url$1"
}

keycloak_put() {
  local endpoint="$1" payload="$2"
  curl -fsS --max-time 10 \
    -X PUT \
    -H "Authorization: Bearer $admin_token" \
    -H 'Content-Type: application/json' \
    --data-binary "$payload" \
    "$admin_url$endpoint" >/dev/null
}

# Reconcile the user-profile schema only when the custom attribute is absent.
# The REST token is reused for every operation, avoiding repeated kcadm JVM
# startups while retaining an immediately verified, fail-closed update.
profile="$(keycloak_get "/admin/realms/$REALM/users/profile")"
if ! jq -e '.attributes[]? | select(.name == "resonanceProjectScopes")' \
  >/dev/null <<<"$profile"; then
  profile="$(
    jq -c '
      .attributes = ((.attributes // []) + [{
        name: "resonanceProjectScopes",
        displayName: "Resonance project scopes",
        permissions: {view: ["admin"], edit: ["admin"]},
        multivalued: true
      }])
    ' <<<"$profile"
  )"
  keycloak_put "/admin/realms/$REALM/users/profile" "$profile"
fi

updated=0
for spec in \
  "resonance-requester:*" \
  "resonance-reviewer:PRJ-2026-AD5D0F" \
  "resonance-approver:*"; do
  username="${spec%%:*}"
  project_scope="${spec#*:}"
  user="$(
    keycloak_get "/admin/realms/$REALM/users?username=$username&exact=true&max=2" |
      jq -ce --arg username "$username" '
        [.[] | select((.username | ascii_downcase) == ($username | ascii_downcase))]
        | if length == 1 then .[0] else error("identity lookup is not unique") end
      '
  )"
  user_id="$(jq -er '.id' <<<"$user")"
  observed_scope="$(
    jq -r '.attributes.resonanceProjectScopes[0] // ""' <<<"$user"
  )"
  if [[ "$observed_scope" != "$project_scope" ]]; then
    payload="$(
      jq -c --arg scope "$project_scope" '
        .attributes = (.attributes // {})
        | .attributes.resonanceProjectScopes = [$scope]
      ' <<<"$user"
    )"
    keycloak_put "/admin/realms/$REALM/users/$user_id" "$payload"
    updated=$((updated + 1))
  fi
  observed="$(
    keycloak_get "/admin/realms/$REALM/users/$user_id" |
      jq -er '.attributes.resonanceProjectScopes[0]'
  )"
  [[ "$observed" == "$project_scope" ]] || {
    echo "[e2e-scope-sync] scope verification failed for $username" >&2
    exit 1
  }
done

admin_token=
echo "[e2e-scope-sync] PASS accounts=3 updated=$updated project-scopes=verified mode=rest-token-reuse"
