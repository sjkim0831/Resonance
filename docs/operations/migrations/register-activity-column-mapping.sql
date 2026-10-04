BEGIN;
UPDATE framework_process_step_screen_binding b SET
initial_view='upload',
guide_contract=jsonb_build_object('purpose','사업장 선택 → xlsx 첫 시트 미리보기 → 6개 원본 열 연결 → 검사 후 전체 저장','limits','5MB, 2000행, 첫 행 제목','verificationStatus','COMPONENT_TESTED_AUTHENTICATED_E2E_PENDING'),
input_contract=jsonb_build_object('projectId','required','siteId','required for multi-site','file','xlsx','mapping','six distinct zero-based column indexes'),
output_contract=jsonb_build_object('activities','site-linked rows','originalFile','preserved','columnMapping','preserved'),
api_contract=jsonb_build_object('preview','POST /home/api/emission-projects/{id}/activities/upload-preview','save','POST /home/api/emission-projects/{id}/activities/upload'),
test_contract=jsonb_build_object('component','PASS','authenticatedE2E','NOT_RUN','requiredTests',jsonb_build_array('권한 없는 사업장 거절','오류 행 전체 취소','같은 파일 매핑 재시도 중복 거절','저장 후 사업장별 재조회')),
updated_at=current_timestamp
FROM framework_screen_resource r WHERE b.screen_resource_id=r.screen_resource_id AND r.route_key='/emission/excel-upload' AND b.process_code='EMISSION_PROJECT' AND b.step_code='EMISSION_PROJECT_COLLECT';
COMMIT;
