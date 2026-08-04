-- Separate test-only account for project assignment and reassignment.
-- It shares COMPANY_MANAGER's PROJECT_ASSIGN capability, but is deliberately
-- not assigned to an execution step in the canonical seven-step journey.
INSERT INTO comtnemplyrinfo(
  emplyr_id,orgnzt_id,user_nm,password,empl_no,ihidnum,sexdstn_code,brthdy,
  fxnum,house_adres,password_hint,password_cnsr,house_end_telno,area_no,
  detail_adres,zip,offm_telno,mbtlnum,email_adres,ofcps_nm,
  house_middle_telno,group_id,pstinst_code,emplyr_sttus_code,esntl_id,
  crtfc_dn_value,sbscrb_de,lock_at,lock_cnt,lock_last_pnttm,
  chg_pwd_last_pnttm,auth_ty,auth_dn,auth_ci,auth_di,auth_email,
  marketing_yn,instt_id
)
SELECT
  'qaassign26',orgnzt_id,'테스트 업무 배정 관리자',password,empl_no,ihidnum,
  sexdstn_code,brthdy,fxnum,house_adres,password_hint,password_cnsr,
  house_end_telno,area_no,detail_adres,zip,offm_telno,mbtlnum,
  'qaassign26@resonance.test','업무 배정 관리자',house_middle_telno,group_id,
  pstinst_code,emplyr_sttus_code,'USR_QAASSIGN26',crtfc_dn_value,
  current_timestamp,lock_at,0,null,current_timestamp,auth_ty,auth_dn,
  auth_ci,auth_di,auth_email,'N',instt_id
FROM comtnemplyrinfo
WHERE lower(emplyr_id)='qaowner26'
  AND NOT EXISTS (SELECT 1 FROM comtnemplyrinfo WHERE lower(emplyr_id)='qaassign26');

INSERT INTO framework_account_actor_assignment(
  account_id,tenant_id,project_id,actor_code,data_scope,assignment_status
)
VALUES ('qaassign26','TEST_COMPANY_001','*','COMPANY_MANAGER','TEST_COMPANY_001','ACTIVE')
ON CONFLICT(account_id,tenant_id,project_id,actor_code) DO UPDATE SET
  data_scope=excluded.data_scope,
  assignment_status='ACTIVE',
  valid_until=null;
