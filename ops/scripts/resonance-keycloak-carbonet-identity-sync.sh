#!/usr/bin/env bash
set -Eeuo pipefail

NAMESPACE="${KEYCLOAK_NAMESPACE:-resonance-ops}"
REALM="${KEYCLOAK_REALM:-resonance}"
LOCK_FILE="${IDENTITY_SYNC_LOCK_FILE:-/tmp/resonance-keycloak-carbonet-identity-sync.lock}"
MANAGED_GROUPS='["platform-engineering","carbon-operations","verification-governance"]'

for command in kubectl jq base64 openssl flock xxd; do
  command -v "$command" >/dev/null || {
    echo "[identity-sync] missing command: $command" >&2
    exit 1
  }
done

exec 9>"$LOCK_FILE"
flock -n 9 || {
  echo "[identity-sync] another synchronization is running"
  exit 0
}

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

find_keycloak_pod() {
  kubectl -n "$NAMESPACE" get pods \
    -l app.kubernetes.io/name=resonance-keycloak \
    --field-selector=status.phase=Running \
    -o json |
    jq -r '
      [.items[]
       | select(any(.status.conditions[]?; .type == "Ready" and .status == "True"))
       | .metadata.name][0] // empty
    '
}

hex() {
  printf '%s' "$1" | xxd -p -c 1000000
}

leader="$(find_leader)" || {
  echo "[identity-sync] writable Patroni leader was not found" >&2
  exit 2
}
keycloak_pod="$(find_keycloak_pod)"
[[ -n "$keycloak_pod" ]] || {
  echo "[identity-sync] Keycloak pod was not found" >&2
  exit 2
}

admin_password="$(
  kubectl -n "$NAMESPACE" get secret resonance-keycloak \
    -o jsonpath='{.data.KC_BOOTSTRAP_ADMIN_PASSWORD}' | base64 -d
)"
kubectl -n "$NAMESPACE" exec "$keycloak_pod" -c keycloak -- \
  /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://localhost:8080 --realm master \
  --user resonance-admin --password "$admin_password" >/dev/null
admin_password=

users_json="$(
  kubectl -n "$NAMESPACE" exec "$keycloak_pod" -c keycloak -- \
    /opt/keycloak/bin/kcadm.sh get users -r "$REALM" \
    --fields id,username,email,firstName,lastName,enabled,attributes --format json
)"
# Keycloak's collection endpoint intentionally returns a brief representation
# and omits custom attributes. Enrich the bounded E2E identities that carry
# project scopes so the authorization projection is not silently widened to *.
for scoped_username in resonance-requester resonance-reviewer resonance-approver; do
  scoped_id="$(jq -r --arg username "$scoped_username" \
    '.[] | select(.username == $username) | .id' <<<"$users_json" | head -n1)"
  [[ -n "$scoped_id" ]] || continue
  scoped_user="$(
    kubectl -n "$NAMESPACE" exec "$keycloak_pod" -c keycloak -- \
      /opt/keycloak/bin/kcadm.sh get "users/$scoped_id" -r "$REALM"
  )"
  users_json="$(jq -c --arg id "$scoped_id" --argjson detail "$scoped_user" \
    'map(if .id == $id then . + $detail else . end)' <<<"$users_json")"
done
groups_catalog="$(
  kubectl -n "$NAMESPACE" exec "$keycloak_pod" -c keycloak -- \
    /opt/keycloak/bin/kcadm.sh get groups -r "$REALM" \
    --fields id,name --format json
)"
group_memberships='{}'
while IFS= read -r managed_group; do
  group_id="$(jq -r --arg name "$managed_group" '.[] | select(.name == $name) | .id' <<<"$groups_catalog" | head -n1)"
  [[ -n "$group_id" ]] || continue
  members="$(
    kubectl -n "$NAMESPACE" exec "$keycloak_pod" -c keycloak -- \
      /opt/keycloak/bin/kcadm.sh get "groups/$group_id/members" -r "$REALM" \
      --fields id --format json
  )"
  group_memberships="$(
    jq -c --arg group "$managed_group" --argjson members "$members" '
      reduce $members[] as $member (.;
        .[$member.id] = ((.[$member.id] // []) + [$group] | unique)
      )
    ' <<<"$group_memberships"
  )"
done < <(jq -r '.[]' <<<"$MANAGED_GROUPS")

integrated_username=""
integrated_hash=""
if kubectl -n "$NAMESPACE" get secret resonance-keycloak-integrated-admin \
  >/dev/null 2>&1; then
  integrated_username="$(
    kubectl -n "$NAMESPACE" get secret resonance-keycloak-integrated-admin \
      -o jsonpath='{.data.USERNAME}' | base64 -d
  )"
  integrated_password="$(
    kubectl -n "$NAMESPACE" get secret resonance-keycloak-integrated-admin \
      -o jsonpath='{.data.PASSWORD}' | base64 -d
  )"
  integrated_hash="$(
    printf '%s%s' "$integrated_username" "$integrated_password" |
      openssl dgst -sha256 -binary | base64 -w0
  )"
  integrated_password=
fi

synced=0
while IFS= read -r user; do
  subject="$(jq -r '.id // ""' <<<"$user")"
  username="$(jq -r '.username // "" | ascii_downcase' <<<"$user")"
  [[ "$username" =~ ^[a-z0-9_.-]{3,63}$ ]] || continue
  email="$(jq -r '.email // (.username + "@resonance.local")' <<<"$user")"
  display_name="$(
    jq -r '[.firstName // "", .lastName // ""] | map(select(length > 0)) | join(" ")' \
      <<<"$user"
  )"
  [[ -n "$display_name" ]] || display_name="$username"
  enabled="$(jq -r 'if .enabled == false then "N" else "Y" end' <<<"$user")"
  tenant_id="$(
    jq -r '
      (.attributes.resonanceTenantId[0] // "DEFAULT")
      | select(test("^[A-Za-z0-9_.:-]{1,80}$")) // "DEFAULT"
    ' <<<"$user"
  )"
  project_scopes_json="$(
    jq -c '
      [
        (.attributes.resonanceProjectScopes // ["*"])[]
        | select(test("^[A-Za-z0-9*_.:-]{1,100}$"))
      ]
      | unique
      | if length == 0 then ["*"] else . end
    ' <<<"$user"
  )"
  data_scope="$(
    jq -r '
      [
        (.attributes.resonanceDataScopes // ["*"])[]
        | select(test("^[A-Za-z0-9*_.:/-]{1,80}$"))
      ]
      | unique
      | if length == 0 then ["*"] else . end
      | join(",")
    ' <<<"$user"
  )"
  groups_json="$(jq -c --arg subject "$subject" '.[$subject] // []' <<<"$group_memberships")"
  password_hash="$(
    if [[ "$username" == "$integrated_username" && -n "$integrated_hash" ]]; then
      printf '%s' "$integrated_hash"
    else
      printf '%s%s' "$username" "OIDC_ONLY:$subject" |
        openssl dgst -sha256 -binary | base64 -w0
    fi
  )"
  essential_id="KC$(printf '%s' "$subject" | openssl dgst -sha256 | awk '{print substr($2,1,18)}')"

  sql="$(
    cat <<SQL
BEGIN;
DO \$sync\$
DECLARE
  v_username text := convert_from(decode('$(hex "$username")','hex'),'UTF8');
  v_subject text := convert_from(decode('$(hex "$subject")','hex'),'UTF8');
  v_email text := convert_from(decode('$(hex "$email")','hex'),'UTF8');
  v_display_name text := convert_from(decode('$(hex "$display_name")','hex'),'UTF8');
  v_password text := convert_from(decode('$(hex "$password_hash")','hex'),'UTF8');
  v_essential_id text := convert_from(decode('$(hex "$essential_id")','hex'),'UTF8');
  v_groups jsonb := convert_from(decode('$(hex "$groups_json")','hex'),'UTF8')::jsonb;
  v_tenant_id text := convert_from(decode('$(hex "$tenant_id")','hex'),'UTF8');
  v_project_scopes jsonb := convert_from(decode('$(hex "$project_scopes_json")','hex'),'UTF8')::jsonb;
  v_data_scope text := convert_from(decode('$(hex "$data_scope")','hex'),'UTF8');
  v_enabled char(1) := '$enabled';
  v_author_code text;
  v_assignment_id bigint;
  v_actor_codes jsonb;
  policy record;
  project_scope text;
BEGIN
  SELECT role.author_code
    INTO v_author_code
    FROM framework_identity_group_role_policy role
   WHERE role.active_yn='Y'
     AND v_groups ? role.group_name
   ORDER BY role.role_priority DESC, role.group_name
   LIMIT 1;

  UPDATE comvnusermaster
     SET user_nm=v_display_name,
         user_email=v_email,
         password=CASE WHEN v_username=convert_from(decode('$(hex "$integrated_username")','hex'),'UTF8')
                       THEN v_password ELSE password END
   WHERE lower(trim(user_id))=lower(v_username);
  IF NOT FOUND THEN
    INSERT INTO comvnusermaster(
      esntl_id,user_id,password,user_nm,user_email,group_id,user_se,orgnzt_id
    ) VALUES(
      v_essential_id,v_username,v_password,v_display_name,v_email,
      'GROUP_KEYCLOAK','USR','ORGNZT_KEYCLOAK'
    );
  END IF;
  SELECT account.esntl_id
    INTO v_essential_id
    FROM comvnusermaster account
   WHERE lower(trim(account.user_id))=lower(v_username)
   ORDER BY account.esntl_id
   LIMIT 1;

  UPDATE comtnemplyrinfo
     SET user_nm=v_display_name,
         email_adres=v_email,
         password=CASE WHEN v_username=convert_from(decode('$(hex "$integrated_username")','hex'),'UTF8')
                       THEN v_password ELSE password END,
         emplyr_sttus_code=CASE WHEN v_enabled='Y' THEN 'P' ELSE 'D' END,
         group_id='GROUP_KEYCLOAK',
         orgnzt_id='ORGNZT_KEYCLOAK'
   WHERE lower(trim(emplyr_id))=lower(v_username);
  IF NOT FOUND THEN
    INSERT INTO comtnemplyrinfo(
      esntl_id,emplyr_id,user_nm,password,password_hint,password_cnsr,
      ihidnum,sexdstn_code,zip,house_adres,area_no,emplyr_sttus_code,
      detail_adres,house_end_telno,mbtlnum,group_id,fxnum,email_adres,
      house_middle_telno,sbscrb_de,chg_pwd_last_pnttm,orgnzt_id,ofcps_nm,
      offm_telno,empl_no,lock_at,lock_cnt
    ) VALUES(
      v_essential_id,v_username,v_display_name,v_password,'KEYCLOAK','OIDC managed account',
      '','','','','',
      CASE WHEN v_enabled='Y' THEN 'P' ELSE 'D' END,
      '','','',
      'GROUP_KEYCLOAK','',v_email,'',
      CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,'ORGNZT_KEYCLOAK','','','',
      'N',0
    );
  END IF;
  SELECT employee.esntl_id
    INTO v_essential_id
    FROM comtnemplyrinfo employee
   WHERE lower(trim(employee.emplyr_id))=lower(v_username)
   ORDER BY employee.esntl_id
   LIMIT 1;

  DELETE FROM comtnemplyrscrtyestbs
   WHERE scrty_dtrmn_trget_id=v_essential_id
     AND (v_enabled='N' OR v_author_code IS NULL);
  IF v_enabled='Y' AND v_author_code IS NOT NULL THEN
    INSERT INTO comtnemplyrscrtyestbs(
      scrty_dtrmn_trget_id,mber_ty_code,author_code
    ) VALUES(v_essential_id,'USR',v_author_code)
    ON CONFLICT(scrty_dtrmn_trget_id) DO UPDATE
      SET mber_ty_code=excluded.mber_ty_code,
          author_code=excluded.author_code;
  END IF;

  UPDATE framework_account_actor_assignment assignment
     SET assignment_status='SUSPENDED'
   WHERE lower(assignment.account_id)=lower(v_username)
     AND assignment.tenant_id=v_tenant_id
     AND assignment.actor_code IN (
       SELECT actor_policy.actor_code
         FROM framework_identity_group_actor_policy actor_policy
        WHERE actor_policy.active_yn='Y'
          AND v_groups ? actor_policy.group_name
     )
     AND NOT (v_project_scopes ? assignment.project_id);
  UPDATE framework_identity_actor_assignment_link link
     SET active_yn='N',updated_at=current_timestamp
   WHERE lower(link.account_id)=lower(v_username)
     AND NOT EXISTS (
       SELECT 1
         FROM framework_identity_group_actor_policy actor_policy
        WHERE actor_policy.active_yn='Y'
          AND v_groups ? actor_policy.group_name
          AND actor_policy.group_name=link.group_name
          AND actor_policy.actor_code=link.actor_code
          AND link.tenant_id=v_tenant_id
          AND v_project_scopes ? link.project_id
     );

  IF v_enabled='Y' THEN
    FOR policy IN
      SELECT actor_policy.*
        FROM framework_identity_group_actor_policy actor_policy
       WHERE actor_policy.active_yn='Y'
         AND v_groups ? actor_policy.group_name
       ORDER BY actor_policy.group_name,actor_policy.actor_code
    LOOP
      FOR project_scope IN
        SELECT jsonb_array_elements_text(v_project_scopes)
      LOOP
        INSERT INTO framework_account_actor_assignment(
          account_id,tenant_id,project_id,actor_code,data_scope,
          valid_from,valid_until,assignment_status,created_at
        ) VALUES(
          v_username,v_tenant_id,project_scope,policy.actor_code,
          v_data_scope,current_date,NULL,'ACTIVE',current_timestamp
        )
        ON CONFLICT(account_id,tenant_id,project_id,actor_code) DO UPDATE
          SET data_scope=excluded.data_scope,
              valid_from=least(framework_account_actor_assignment.valid_from,current_date),
              valid_until=NULL,
              assignment_status='ACTIVE'
        RETURNING assignment_id INTO v_assignment_id;

        INSERT INTO framework_identity_actor_assignment_link(
          account_id,group_name,actor_code,tenant_id,project_id,
          assignment_id,active_yn,updated_at
        ) VALUES(
          v_username,policy.group_name,policy.actor_code,v_tenant_id,
          project_scope,v_assignment_id,'Y',current_timestamp
        )
        ON CONFLICT(account_id,group_name,actor_code,tenant_id,project_id) DO UPDATE
          SET assignment_id=excluded.assignment_id,
              active_yn='Y',
              updated_at=current_timestamp;
      END LOOP;
    END LOOP;
  ELSE
    UPDATE framework_account_actor_assignment assignment
       SET assignment_status='SUSPENDED'
     WHERE assignment.assignment_id IN (
       SELECT link.assignment_id
         FROM framework_identity_actor_assignment_link link
        WHERE lower(link.account_id)=lower(v_username)
     );
    UPDATE framework_identity_actor_assignment_link
       SET active_yn='N',updated_at=current_timestamp
     WHERE lower(account_id)=lower(v_username);
  END IF;

  SELECT coalesce(jsonb_agg(DISTINCT actor_policy.actor_code),'[]'::jsonb)
    INTO v_actor_codes
    FROM framework_identity_group_actor_policy actor_policy
   WHERE actor_policy.active_yn='Y'
     AND v_groups ? actor_policy.group_name;

  IF NOT EXISTS (
    SELECT 1
      FROM (
        SELECT audit.*
          FROM framework_identity_sync_audit audit
         WHERE lower(audit.account_id)=lower(v_username)
         ORDER BY audit.sync_id DESC
         LIMIT 1
      ) previous
     WHERE previous.identity_subject=v_subject
       AND previous.enabled_yn=v_enabled
       AND previous.author_code IS NOT DISTINCT FROM v_author_code
       AND previous.group_names=v_groups
       AND previous.actor_codes=v_actor_codes
       AND previous.detail_json->>'tenantId'=v_tenant_id
       AND previous.detail_json->'projectScopes'=v_project_scopes
       AND previous.detail_json->>'dataScope'=v_data_scope
       AND previous.result_code='SYNCHRONIZED'
     ORDER BY previous.sync_id DESC
     LIMIT 1
  ) THEN
    INSERT INTO framework_identity_sync_audit(
      account_id,identity_provider,identity_subject,enabled_yn,author_code,
      group_names,actor_codes,result_code,detail_json,synced_at
    ) VALUES(
      v_username,'KEYCLOAK',v_subject,v_enabled,v_author_code,
      v_groups,v_actor_codes,'SYNCHRONIZED',
      jsonb_build_object(
        'tenantId',v_tenant_id,
        'projectScopes',v_project_scopes,
        'dataScope',v_data_scope
      ),current_timestamp
    );
  END IF;
END
\$sync\$;
COMMIT;
SQL
  )"
  kubectl -n carbonet-prod exec "$leader" -c patroni -- \
    psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d carbonet \
    -c "$sql" >/dev/null
  synced=$((synced + 1))
done < <(jq -c '.[]' <<<"$users_json")

integrated_hash=
echo "[identity-sync] PASS users=$synced source=Keycloak target=Carbonet"
