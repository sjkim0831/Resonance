INSERT INTO emission_project_member(project_id,member_name,role_code)
SELECT project_id,owner_name,'OWNER' FROM emission_project_registry
ON CONFLICT DO NOTHING;

INSERT INTO emission_project_task(project_id,task_code,task_name,step_order,task_status,progress_weight,due_date)
SELECT p.project_id,t.code,t.name,t.ord,
       CASE WHEN t.ord < CASE WHEN p.progress_percent >= 90 THEN 6 WHEN p.progress_percent >= 70 THEN 5 WHEN p.progress_percent >= 50 THEN 4 WHEN p.progress_percent >= 30 THEN 3 WHEN p.progress_percent >= 10 THEN 2 ELSE 1 END THEN 'DONE'
            WHEN t.ord = CASE WHEN p.progress_percent >= 90 THEN 6 WHEN p.progress_percent >= 70 THEN 5 WHEN p.progress_percent >= 50 THEN 4 WHEN p.progress_percent >= 30 THEN 3 WHEN p.progress_percent >= 10 THEN 2 ELSE 1 END THEN 'IN_PROGRESS' ELSE 'WAITING' END,
       CASE WHEN t.ord=1 THEN 10 ELSE 18 END,p.due_date
FROM emission_project_registry p
CROSS JOIN (VALUES ('BASIC_INFO','기본정보 확인',1),('ACTIVITY_DATA','활동자료 수집',2),('CALCULATION','배출량 산정',3),('VERIFICATION','데이터 검증',4),('APPROVAL','검토·승인',5),('REPORT','확정·보고',6)) t(code,name,ord)
ON CONFLICT DO NOTHING;

INSERT INTO emission_project_history(project_id,event_type,event_description,actor_name)
SELECT p.project_id,'CREATED','기존 배출량 프로젝트가 업무 흐름에 연결되었습니다.',p.owner_name
FROM emission_project_registry p
WHERE NOT EXISTS (SELECT 1 FROM emission_project_history h WHERE h.project_id=p.project_id);

INSERT INTO comtnmenuinfo(menu_code,menu_nm,menu_nm_en,menu_url,menu_icon,use_at,frst_regist_pnttm,last_updt_pnttm,expsr_at)
VALUES ('H102010202','배출량 프로젝트 상세','Emission Project Detail','/emission/project/detail','description','Y',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,'N')
ON CONFLICT(menu_code) DO UPDATE SET menu_nm=EXCLUDED.menu_nm,menu_nm_en=EXCLUDED.menu_nm_en,menu_url=EXCLUDED.menu_url,menu_icon=EXCLUDED.menu_icon,use_at='Y',expsr_at='N',last_updt_pnttm=CURRENT_TIMESTAMP;

INSERT INTO comtnmenuorder(menu_code,sort_ordr,frst_regist_pnttm,last_updt_pnttm)
VALUES ('H102010202',10210202,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT(menu_code) DO UPDATE SET sort_ordr=EXCLUDED.sort_ordr,last_updt_pnttm=CURRENT_TIMESTAMP;

INSERT INTO comtccmmndetailcode(code_id,code,code_nm,code_dc,use_at,frst_regist_pnttm,last_updt_pnttm,last_updusr_id)
VALUES ('HMENU1','H102010202','배출량 프로젝트 상세','/emission/project/detail','Y',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,'PROJECT_SCREEN')
ON CONFLICT(code_id,code) DO UPDATE SET code_nm=EXCLUDED.code_nm,code_dc=EXCLUDED.code_dc,use_at='Y',last_updt_pnttm=CURRENT_TIMESTAMP,last_updusr_id='PROJECT_SCREEN';
