#!/usr/bin/env bash
set -Eeuo pipefail
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
leader=""
while IFS= read -r pod; do [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == f ]] && { leader="$pod"; break; }; done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#pod/##')
[[ -n "$leader" ]] || exit 1
kubectl -n "$NAMESPACE" exec -i "$leader" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -qAt -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
UPDATE framework_professional_screen_contract c SET
 api_contract=(SELECT coalesce(jsonb_agg(a ORDER BY ord),'[]'::jsonb)::text FROM jsonb_array_elements(c.api_contract::jsonb) WITH ORDINALITY x(a,ord) WHERE NOT (upper(a->>'method')='POST' AND a->>'path'='/home/api/emission-projects/{id}')),
 command_contract='["요청 담당자·마감일 입력","제출 요청 저장","담당자 알림","제출 시작","접수 또는 보완 결정","산정 단계 개방"]',
 contract_revision=contract_revision+1,updated_by='ACTIVITY_SIMULATION_CONTRACT_CLOSER',updated_at=current_timestamp
WHERE contract_id=66 AND api_contract::jsonb @> '[{"method":"POST","path":"/home/api/emission-projects/{id}"}]';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM framework_professional_screen_contract WHERE contract_id=66 AND api_contract::jsonb @> '[{"method":"POST","path":"/home/api/emission-projects/{id}"}]') THEN RAISE EXCEPTION 'obsolete activity project update remains'; END IF;
 IF (SELECT count(*) FROM framework_professional_screen_contract c CROSS JOIN LATERAL jsonb_array_elements(c.api_contract::jsonb) a WHERE c.contract_id=251 AND (a->>'method',a->>'path') IN (('GET','/home/api/emission-projects/{id}/simulation-workflow'),('POST','/home/api/emission-projects/{id}/simulate')))<>2 THEN RAISE EXCEPTION 'simulation contract cardinality mismatch'; END IF;
END $$;
COMMIT;
SQL
echo '{"status":"RECONCILED","obsoleteActivityApis":0,"simulationApis":2}'
