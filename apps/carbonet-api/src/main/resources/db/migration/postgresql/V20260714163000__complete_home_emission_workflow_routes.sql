-- Give every user-facing carbon-emission task one stable, executable route.
CREATE TEMP TABLE emission_home_route(
  code varchar(32) PRIMARY KEY,
  name_ko varchar(200) NOT NULL,
  name_en varchar(200) NOT NULL,
  route varchar(500) NOT NULL,
  icon varchar(100) NOT NULL
) ON COMMIT DROP;

INSERT INTO emission_home_route VALUES
('H1020101','배출량 현황','Emission Status','/emission/index','monitoring'),
('H1020102','배출량 프로젝트','Emission Projects','/emission/project_list','account_tree'),
('H1020103','내 업무','My Tasks','/emission/my-tasks','assignment_ind'),
('H1020104','마감·지연 현황','Deadline & Delay Status','/emission/deadline-status','event_busy'),
('H1020201','활동자료 관리','Activity Data','/emission/activity-data','dataset'),
('H1020202','자료 제출 요청','Data Requests','/emission/data-request','forward_to_inbox'),
('H1020203','엑셀 업로드','Excel Upload','/emission/excel-upload','upload_file'),
('H1020204','증빙자료','Evidence','/emission/evidence','attach_file'),
('H1020205','외부 데이터 연계','External Data Integration','/emission/external-data','hub'),
('H1020301','배출량 산정','Emission Calculation','/emission/calculation','calculate'),
('H1020302','산정 결과','Calculation Results','/emission/calculation-results','analytics'),
('H1020303','데이터 검증','Data Validation','/emission/data-validation','fact_check'),
('H1020304','보완·재산정','Correction & Recalculation','/emission/correction','published_with_changes'),
('H1020401','검토·승인','Review & Approval','/emission/review-approval','approval'),
('H1020402','배출량 확정','Emission Finalization','/emission/finalization','lock'),
('H1020403','보고서 작성','Report Writing','/emission/report-write','edit_document'),
('H1020404','보고서 제출','Report Submission','/emission/report-submission','outbox'),
('H1020405','인증서·보고서 다운로드','Certificate & Report Download','/emission/report-download','download');

UPDATE comtnmenuinfo m
SET menu_nm=r.name_ko, menu_nm_en=r.name_en, menu_url=r.route, menu_icon=r.icon,
    use_at='Y', expsr_at='Y', last_updt_pnttm=current_timestamp
FROM emission_home_route r
WHERE m.menu_code=r.code;

UPDATE comtccmmndetailcode c
SET code_nm=r.name_ko, code_dc=r.route, use_at='Y',
    last_updt_pnttm=current_timestamp, last_updusr_id='EMISSION_WORKFLOW'
FROM emission_home_route r
WHERE c.code_id='HMENU1' AND c.code=r.code;

-- These are page-internal tabs, not GNB leaves.
UPDATE comtnmenuinfo
SET expsr_at='N', last_updt_pnttm=current_timestamp
WHERE menu_code IN ('H1020406','H1020407','H1020408','H1020409','H1020410','H1020411','H1020412');
