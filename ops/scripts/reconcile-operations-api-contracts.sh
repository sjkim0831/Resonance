#!/usr/bin/env bash
set -Eeuo pipefail
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
LOCK="${OPERATIONS_API_RECONCILE_LOCK:-/tmp/resonance-operations-api-reconcile.lock}"
exec 9>"$LOCK"; flock -n 9 || { echo '{"status":"ALREADY_RUNNING"}'; exit 0; }
leader=""
while IFS= read -r pod; do
  [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == f ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#pod/##')
[[ -n "$leader" ]] || { echo 'writable PostgreSQL leader not found' >&2; exit 1; }

kubectl -n "$NAMESPACE" exec -i "$leader" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -qAt -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
CREATE TEMP TABLE operations_api_map(
 contract_id bigint NOT NULL,description text NOT NULL,old_method text NOT NULL,old_path text NOT NULL,
 new_method text NOT NULL,new_path text NOT NULL,PRIMARY KEY(contract_id,description)
) ON COMMIT DROP;
INSERT INTO operations_api_map VALUES
 (26267,'데이터 변경 이력 조회','GET','/api/emission/data-history','GET','/admin/emission/data_history/page-data'),
 (26268,'LCA 정의 목록','GET','/api/emission/lca/definitions','GET','/admin/emission/definition-studio/page-data'),
 (26272,'GWP 값 목록','GET','/api/emission/gwp-values','GET','/admin/emission/gwp-values/page-data'),
 (26272,'GWP 값 수정','PUT','/api/emission/gwp-values/{id}','POST','/admin/emission/api/gwp-values/save'),
 (26274,'LCI 분류 목록','GET','/api/emission/lci-classifications','GET','/admin/emission/lci-classification/page-data'),
 (26274,'LCI 분류 생성','POST','/api/emission/lci-classifications','POST','/admin/emission/api/lci-classification/save'),
 (26275,'배출 관리 설정 조회','GET','/api/emission/management','GET','/admin/emission/management/page-data'),
 (26277,'조사 목록','GET','/api/emission/surveys','GET','/admin/emission/survey-admin/page-data'),
 (26302,'접근 이력 조회','GET','/api/system/access-history','GET','/admin/system/access_history/page-data'),
 (26307,'백업 목록','GET','/api/system/backups','GET','/admin/system/backup/page-data'),
 (26307,'백업 실행','POST','/api/system/backups','POST','/admin/system/backup/run'),
 (26308,'백업 설정 조회','GET','/api/system/backup-config','GET','/admin/system/backup_config/page-data'),
 (26308,'백업 설정 수정','PUT','/api/system/backup-config','POST','/admin/system/backup_config/save'),
 (26309,'배치 작업 목록','GET','/api/system/batch-jobs','GET','/admin/system/batch/page-data'),
 (26311,'차단 목록 조회','GET','/api/system/blocklist','GET','/admin/system/blocklist/page-data'),
 (26313,'코드 목록','GET','/api/system/codes','GET','/admin/system/code/page-data'),
 (26314,'프로비저닝 목록','GET','/api/system/codex-provisions','GET','/admin/system/codex-provision/page-data'),
 (26314,'프로비저닝 생성','POST','/api/system/codex-provisions','POST','/admin/system/codex-provision/execute'),
 (26280,'연결 목록 조회','GET','/api/external/connections','GET','/admin/external/connection_list/page-data'),
 (26281,'API 키 목록','GET','/api/external/keys','GET','/admin/external/keys/page-data'),
 (26282,'외부 로그 조회','GET','/api/external/logs','GET','/admin/external/logs/page-data'),
 (26283,'유지보수 일정 조회','GET','/api/external/maintenance','GET','/admin/external/maintenance/page-data'),
 (26284,'모니터링 데이터 조회','GET','/api/external/monitoring','GET','/admin/external/monitoring/page-data'),
 (26285,'재시도 목록','GET','/api/external/retry-queue','GET','/admin/external/retry/page-data'),
 (26286,'스키마 목록','GET','/api/external/schemas','GET','/admin/external/schema/page-data'),
 (26287,'동기화 작업 목록','GET','/api/external/sync-jobs','GET','/admin/external/sync/page-data'),
 (26288,'사용량 통계 조회','GET','/api/external/usage','GET','/admin/external/usage/page-data'),
 (26289,'웹훅 목록','GET','/api/external/webhooks','GET','/admin/external/webhooks/page-data');

DO $$ DECLARE expected int; source_count int; target_count int; BEGIN
 SELECT count(*) INTO expected FROM operations_api_map;
 SELECT count(*) INTO source_count FROM operations_api_map m
 JOIN framework_professional_screen_contract c USING(contract_id)
 CROSS JOIN LATERAL jsonb_array_elements(c.api_contract::jsonb) api
 WHERE api->>'desc'=m.description AND api->>'method'=m.old_method AND api->>'path'=m.old_path;
 SELECT count(*) INTO target_count FROM operations_api_map m
 JOIN framework_professional_screen_contract c USING(contract_id)
 CROSS JOIN LATERAL jsonb_array_elements(c.api_contract::jsonb) api
 WHERE api->>'desc'=m.description AND api->>'method'=m.new_method AND api->>'path'=m.new_path;
 IF source_count+target_count<>expected THEN
  RAISE EXCEPTION 'operations API idempotency guard failed expected=% source=% target=%',expected,source_count,target_count;
 END IF;
END $$;

WITH rebuilt AS (
 SELECT c.contract_id,jsonb_agg(CASE WHEN m.contract_id IS NULL THEN api
   ELSE jsonb_set(jsonb_set(api,'{method}',to_jsonb(m.new_method),false),'{path}',to_jsonb(m.new_path),false)
 END ORDER BY ord) corrected
 FROM framework_professional_screen_contract c
 CROSS JOIN LATERAL jsonb_array_elements(c.api_contract::jsonb) WITH ORDINALITY e(api,ord)
 LEFT JOIN operations_api_map m ON m.contract_id=c.contract_id AND api->>'desc'=m.description
  AND api->>'method'=m.old_method AND api->>'path'=m.old_path
 WHERE c.contract_id IN (SELECT contract_id FROM operations_api_map)
 GROUP BY c.contract_id
)
UPDATE framework_professional_screen_contract c
SET api_contract=r.corrected::text,contract_revision=c.contract_revision+1,
 updated_by='OPERATIONS_API_RECONCILER',updated_at=current_timestamp
FROM rebuilt r WHERE r.contract_id=c.contract_id AND c.api_contract::jsonb IS DISTINCT FROM r.corrected;

DO $$ DECLARE expected int; good int; old_left int; BEGIN
 SELECT count(*) INTO expected FROM operations_api_map;
 SELECT count(*) INTO good FROM operations_api_map m
 JOIN framework_professional_screen_contract c USING(contract_id)
 CROSS JOIN LATERAL jsonb_array_elements(c.api_contract::jsonb) api
 WHERE api->>'desc'=m.description AND api->>'method'=m.new_method AND api->>'path'=m.new_path;
 SELECT count(*) INTO old_left FROM operations_api_map m
 JOIN framework_professional_screen_contract c USING(contract_id)
 CROSS JOIN LATERAL jsonb_array_elements(c.api_contract::jsonb) api
 WHERE api->>'desc'=m.description AND api->>'method'=m.old_method AND api->>'path'=m.old_path
  AND (m.old_method,m.old_path) IS DISTINCT FROM (m.new_method,m.new_path);
 IF good<>expected OR old_left<>0 THEN RAISE EXCEPTION 'operations API target guard failed expected=% good=% old=%',expected,good,old_left; END IF;
END $$;
COMMIT;
SQL
printf '{"status":"RECONCILED","contracts":23,"apiUsages":28}\n'
