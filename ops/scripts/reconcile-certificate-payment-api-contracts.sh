#!/usr/bin/env bash
set -Eeuo pipefail
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
LOCK="${CERT_PAYMENT_API_RECONCILE_LOCK:-/tmp/resonance-cert-payment-api-reconcile.lock}"
exec 9>"$LOCK"; flock -n 9 || { echo '{"status":"ALREADY_RUNNING"}'; exit 0; }
leader=""
while IFS= read -r pod; do
  [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == f ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#pod/##')
[[ -n "$leader" ]] || { echo 'writable PostgreSQL leader not found' >&2; exit 1; }

kubectl -n "$NAMESPACE" exec -i "$leader" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -qAt -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
CREATE TEMP TABLE cert_payment_api_map(
 contract_id bigint NOT NULL,description text NOT NULL,old_method text NOT NULL,old_path text NOT NULL,
 new_method text NOT NULL,new_path text NOT NULL,PRIMARY KEY(contract_id,description)
) ON COMMIT DROP;
INSERT INTO cert_payment_api_map VALUES
 (26244,'인증서 승인 처리','POST','/api/certificates/{id}/approve','POST','/admin/api/admin/certificate/approve/action'),
 (26244,'인증서 반려 처리','POST','/api/certificates/{id}/reject','POST','/admin/api/admin/certificate/approve/action'),
 (26244,'대기 중인 인증서 목록 조회','GET','/api/certificates/pending','GET','/admin/certificate/pending_list/page-data'),
 (26245,'인증서 상세 조회','GET','/api/certificates/{id}','GET','/admin/api/admin/certificate/approve/page'),
 (26246,'감사 로그 조회','GET','/api/certificates/audit-log','GET','/admin/certificate/audit-log/page-data'),
 (26249,'이의신청 목록','GET','/api/certificates/objections','GET','/admin/certificate/objection_list/page-data'),
 (26251,'검토 목록','GET','/api/certificates/review','GET','/admin/certificate/review/page-data'),
 (26252,'인증서 통계 조회','GET','/api/certificates/statistics','GET','/admin/certificate/statistics/page-data'),
 (26298,'환불 목록 조회','GET','/api/payment/refunds','GET','/admin/payment/refund_list/page-data'),
 (26299,'환불 상세','GET','/api/payment/refunds/{id}','GET','/admin/payment/refund_process/page-data'),
 (26300,'정산 목록','GET','/api/payment/settlements','GET','/admin/payment/settlement/page-data'),
 (26301,'가상계좌 상세','GET','/api/payment/virtual-accounts/{id}','GET','/admin/payment/virtual_issue/page-data');

DO $$ DECLARE expected int; source_count int; target_count int; BEGIN
 SELECT count(*) INTO expected FROM cert_payment_api_map;
 SELECT count(*) INTO source_count FROM cert_payment_api_map m
 JOIN framework_professional_screen_contract c USING(contract_id)
 CROSS JOIN LATERAL jsonb_array_elements(c.api_contract::jsonb) api
 WHERE api->>'desc'=m.description AND api->>'method'=m.old_method AND api->>'path'=m.old_path;
 SELECT count(*) INTO target_count FROM cert_payment_api_map m
 JOIN framework_professional_screen_contract c USING(contract_id)
 CROSS JOIN LATERAL jsonb_array_elements(c.api_contract::jsonb) api
 WHERE api->>'desc'=m.description AND api->>'method'=m.new_method AND api->>'path'=m.new_path;
 IF source_count+target_count<>expected THEN
  RAISE EXCEPTION 'certificate/payment API idempotency guard failed expected=% source=% target=%',expected,source_count,target_count;
 END IF;
END $$;

WITH rebuilt AS (
 SELECT c.contract_id,jsonb_agg(CASE WHEN m.contract_id IS NULL THEN api
   ELSE jsonb_set(jsonb_set(api,'{method}',to_jsonb(m.new_method),false),'{path}',to_jsonb(m.new_path),false)
 END ORDER BY ord) corrected
 FROM framework_professional_screen_contract c
 CROSS JOIN LATERAL jsonb_array_elements(c.api_contract::jsonb) WITH ORDINALITY e(api,ord)
 LEFT JOIN cert_payment_api_map m ON m.contract_id=c.contract_id AND api->>'desc'=m.description
  AND api->>'method'=m.old_method AND api->>'path'=m.old_path
 WHERE c.contract_id IN (SELECT contract_id FROM cert_payment_api_map)
 GROUP BY c.contract_id
)
UPDATE framework_professional_screen_contract c
SET api_contract=r.corrected::text,contract_revision=c.contract_revision+1,
 updated_by='CERT_PAYMENT_API_RECONCILER',updated_at=current_timestamp
FROM rebuilt r WHERE r.contract_id=c.contract_id AND c.api_contract::jsonb IS DISTINCT FROM r.corrected;

DO $$ DECLARE expected int; good int; old_left int; BEGIN
 SELECT count(*) INTO expected FROM cert_payment_api_map;
 SELECT count(*) INTO good FROM cert_payment_api_map m
 JOIN framework_professional_screen_contract c USING(contract_id)
 CROSS JOIN LATERAL jsonb_array_elements(c.api_contract::jsonb) api
 WHERE api->>'desc'=m.description AND api->>'method'=m.new_method AND api->>'path'=m.new_path;
 SELECT count(*) INTO old_left FROM cert_payment_api_map m
 JOIN framework_professional_screen_contract c USING(contract_id)
 CROSS JOIN LATERAL jsonb_array_elements(c.api_contract::jsonb) api
 WHERE api->>'desc'=m.description AND api->>'method'=m.old_method AND api->>'path'=m.old_path
   AND (m.old_method,m.old_path) IS DISTINCT FROM (m.new_method,m.new_path);
 IF good<>expected OR old_left<>0 THEN RAISE EXCEPTION 'certificate/payment API target guard failed expected=% good=% old=%',expected,good,old_left; END IF;
END $$;
COMMIT;
SQL
printf '{"status":"RECONCILED","contracts":10,"apiUsages":12}\n'
