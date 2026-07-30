#!/usr/bin/env bash
set -Eeuo pipefail

NAMESPACE="${KEYCLOAK_NAMESPACE:-resonance-ops}"
REALM="${KEYCLOAK_REALM:-resonance}"
for command in kubectl node base64; do
  command -v "$command" >/dev/null || {
    echo "[e2e-scope-sync] missing command: $command" >&2
    exit 1
  }
done
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

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
kubectl -n "$NAMESPACE" exec "$pod" -c keycloak -- env \
  ADMIN_USERNAME="$admin_username" ADMIN_PASSWORD="$admin_password" \
  bash -ceu '
    K=/opt/keycloak/bin/kcadm.sh
    "$K" config credentials --server http://localhost:8080 \
      --realm master --user "$ADMIN_USERNAME" --password "$ADMIN_PASSWORD" >/dev/null
  '
kubectl -n "$NAMESPACE" exec "$pod" -c keycloak -- \
  /opt/keycloak/bin/kcadm.sh get users/profile -r "$REALM" \
  > "$work_dir/user-profile.json"
PROFILE_FILE="$work_dir/user-profile.json" node -e '
  const fs = require("fs");
  const file = process.env.PROFILE_FILE;
  const profile = JSON.parse(fs.readFileSync(file, "utf8"));
  profile.attributes ??= [];
  if (!profile.attributes.some(value => value.name === "resonanceProjectScopes")) {
    profile.attributes.push({
      name: "resonanceProjectScopes",
      displayName: "Resonance project scopes",
      permissions: { view: ["admin"], edit: ["admin"] },
      multivalued: true,
    });
  }
  fs.writeFileSync(file, JSON.stringify(profile));
'
kubectl -n "$NAMESPACE" exec -i "$pod" -c keycloak -- \
  /opt/keycloak/bin/kcadm.sh update users/profile -r "$REALM" \
  -f - < "$work_dir/user-profile.json" >/dev/null

kubectl -n "$NAMESPACE" exec "$pod" -c keycloak -- env \
  REALM="$REALM" bash -ceu '
    K=/opt/keycloak/bin/kcadm.sh
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
      observed=$("$K" get "users/$uid" -r "$REALM" | tr -d "[:space:]")
      printf "%s" "$observed" | grep -Fq "resonanceProjectScopes" || {
        echo "scope attribute name missing for $username" >&2
        exit 1
      }
      printf "%s" "$observed" | grep -Fq "\"$project_scope\"" || {
        echo "scope attribute missing for $username" >&2
        exit 1
      }
    done
  '
admin_password=
echo "[e2e-scope-sync] PASS accounts=3 project-scopes=verified"
