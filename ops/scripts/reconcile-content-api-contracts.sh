#!/usr/bin/env bash
set -Eeuo pipefail
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
LOCK="${CONTENT_API_RECONCILE_LOCK:-/tmp/resonance-content-api-reconcile.lock}"
exec 9>"$LOCK"; flock -n 9 || { echo '{"status":"ALREADY_RUNNING"}'; exit 0; }
leader=""
while IFS= read -r pod; do
  [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == f ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#pod/##')
[[ -n "$leader" ]] || { echo 'writable PostgreSQL leader not found' >&2; exit 1; }

kubectl -n "$NAMESPACE" exec -i "$leader" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -qAt -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
CREATE TEMP TABLE content_api_map(
 contract_id bigint NOT NULL,description text NOT NULL,old_method text NOT NULL,old_path text NOT NULL,
 new_method text NOT NULL,new_path text NOT NULL,PRIMARY KEY(contract_id,description)
) ON COMMIT DROP;
INSERT INTO content_api_map VALUES
 (26253,'배너 상세','GET','/api/content/banners/{id}','GET','/admin/api/admin/content/banner/detail'),
 (26253,'배너 수정','PUT','/api/content/banners/{id}','POST','/admin/api/admin/content/banner/save'),
 (26253,'배너 생성','POST','/api/content/banners','POST','/admin/api/admin/content/banner/save'),
 (26254,'배너 목록 조회','GET','/api/content/banners','GET','/admin/api/admin/content/banner'),
 (26255,'게시글 생성','POST','/api/content/boards','POST','/admin/api/admin/content/board/save'),
 (26256,'게시판 목록 조회','GET','/api/content/boards','GET','/admin/api/admin/content/board/list'),
 (26257,'FAQ 목록 조회','GET','/api/content/faqs','GET','/admin/api/admin/content/faq'),
 (26260,'팝업 상세','GET','/api/content/popups/{id}','GET','/admin/api/admin/content/popup/detail'),
 (26260,'팝업 수정','PUT','/api/content/popups/{id}','POST','/admin/api/admin/content/popup/save'),
 (26261,'팝업 목록 조회','GET','/api/content/popups','GET','/admin/api/admin/content/popup'),
 (26263,'답변 등록','POST','/api/content/qnas/{id}/answer','POST','/admin/api/admin/content/qna/save'),
 (26263,'문의 목록','GET','/api/content/qnas','GET','/admin/api/admin/content/qna'),
 (26264,'사이트맵 조회','GET','/api/content/sitemap','GET','/admin/api/admin/content/sitemap');

DO $$ DECLARE expected int; source_count int; target_count int; BEGIN
 SELECT count(*) INTO expected FROM content_api_map;
 SELECT count(*) INTO source_count FROM content_api_map m
 JOIN framework_professional_screen_contract c USING(contract_id)
 CROSS JOIN LATERAL jsonb_array_elements(c.api_contract::jsonb) api
 WHERE api->>'desc'=m.description AND api->>'method'=m.old_method AND api->>'path'=m.old_path;
 SELECT count(*) INTO target_count FROM content_api_map m
 JOIN framework_professional_screen_contract c USING(contract_id)
 CROSS JOIN LATERAL jsonb_array_elements(c.api_contract::jsonb) api
 WHERE api->>'desc'=m.description AND api->>'method'=m.new_method AND api->>'path'=m.new_path;
 IF source_count+target_count<>expected THEN
  RAISE EXCEPTION 'content API idempotency guard failed expected=% source=% target=%',expected,source_count,target_count;
 END IF;
END $$;

WITH rebuilt AS (
 SELECT c.contract_id,jsonb_agg(CASE WHEN m.contract_id IS NULL THEN api
   ELSE jsonb_set(jsonb_set(api,'{method}',to_jsonb(m.new_method),false),'{path}',to_jsonb(m.new_path),false)
 END ORDER BY ord) corrected
 FROM framework_professional_screen_contract c
 CROSS JOIN LATERAL jsonb_array_elements(c.api_contract::jsonb) WITH ORDINALITY e(api,ord)
 LEFT JOIN content_api_map m ON m.contract_id=c.contract_id AND api->>'desc'=m.description
  AND api->>'method'=m.old_method AND api->>'path'=m.old_path
 WHERE c.contract_id IN (SELECT contract_id FROM content_api_map)
 GROUP BY c.contract_id
)
UPDATE framework_professional_screen_contract c
SET api_contract=r.corrected::text,contract_revision=c.contract_revision+1,
 updated_by='CONTENT_API_RECONCILER',updated_at=current_timestamp
FROM rebuilt r WHERE r.contract_id=c.contract_id AND c.api_contract::jsonb IS DISTINCT FROM r.corrected;

DO $$ DECLARE expected int; good int; old_left int; BEGIN
 SELECT count(*) INTO expected FROM content_api_map;
 SELECT count(*) INTO good FROM content_api_map m
 JOIN framework_professional_screen_contract c USING(contract_id)
 CROSS JOIN LATERAL jsonb_array_elements(c.api_contract::jsonb) api
 WHERE api->>'desc'=m.description AND api->>'method'=m.new_method AND api->>'path'=m.new_path;
 SELECT count(*) INTO old_left FROM content_api_map m
 JOIN framework_professional_screen_contract c USING(contract_id)
 CROSS JOIN LATERAL jsonb_array_elements(c.api_contract::jsonb) api
 WHERE api->>'desc'=m.description AND api->>'method'=m.old_method AND api->>'path'=m.old_path
   AND (m.old_method,m.old_path) IS DISTINCT FROM (m.new_method,m.new_path);
 IF good<>expected OR old_left<>0 THEN RAISE EXCEPTION 'content API target guard failed expected=% good=% old=%',expected,good,old_left; END IF;
END $$;
COMMIT;
SQL
printf '{"status":"RECONCILED","contracts":9,"apiUsages":13}\n'
