-- The collection contract predated the executable design validator and used
-- a human-readable pipe/semicolon notation. Store the same implemented
-- endpoints as a JSON array so the validator and generator can consume it
-- deterministically.
UPDATE framework_professional_screen_contract
SET api_contract='["GET /home/api/emission-projects/{id}/activities","POST /home/api/emission-projects/{id}/activities","POST /home/api/emission-projects/{id}/activities/upload","GET /home/api/emission-projects/{id}/quality","POST /home/api/emission-projects/{id}/quality","GET /home/api/emission-projects/{id}/submissions","POST /home/api/emission-projects/{id}/submissions","POST /home/api/emission-projects/{id}/submissions/{submissionId}/submit"]',
    updated_at=current_timestamp
WHERE process_code='EMISSION_PROJECT'
  AND step_code='EMISSION_PROJECT_COLLECT'
  AND NOT pg_input_is_valid(api_contract,'jsonb');

-- The admin contract was accidentally pointed at the user workbench. Align it
-- with the immutable process step's actual admin path.
UPDATE framework_professional_screen_contract
SET route_path='/admin/emission/survey-admin-data',updated_at=current_timestamp
WHERE process_code='EMISSION_PROJECT'
  AND step_code='EMISSION_PROJECT_COLLECT'
  AND audience='ADMIN'
  AND lower(split_part(route_path,'?',1))<>'/admin/emission/survey-admin-data';

INSERT INTO framework_screen_development_note
  (route_key,route_path,page_id,page_title,design_note,function_note,
   acceptance_note,development_status,updated_by)
SELECT lower(split_part(route_path,'?',1)),split_part(route_path,'?',1),
  'PG_'||upper(substr(md5(lower(split_part(route_path,'?',1))),1,16)),screen_name,
  'KRDS responsive administrator collection workbench with dataset status, mapping, evidence and audit history.',
  business_purpose||' Command='||command_contract||' API='||api_contract,
  exit_condition||' Authority, isolation, validation and recovery evidence is required.',
  'READY','SYSTEM_DESIGN_RECONCILER'
FROM framework_professional_screen_contract
WHERE process_code='EMISSION_PROJECT' AND step_code='EMISSION_PROJECT_COLLECT' AND audience='ADMIN'
ON CONFLICT(route_key) DO UPDATE SET
  route_path=excluded.route_path,page_title=excluded.page_title,
  design_note=excluded.design_note,function_note=excluded.function_note,
  acceptance_note=excluded.acceptance_note,development_status='READY',
  note_version=framework_screen_development_note.note_version+1,
  updated_by=excluded.updated_by,updated_at=current_timestamp;

INSERT INTO framework_screen_html_mockup
  (route_key,route_path,page_id,slot_no,mockup_title,prompt_text,html_content,
   mockup_status,selected,updated_by)
SELECT note.route_key,note.route_path,note.page_id,1,note.page_title||' governed workflow',
  'Render the administrator collection contract as a responsive KRDS dataset workbench.',
  format('<main class="krds-page" data-route="%s"><header><h1>%s</h1></header><section class="krds-summary"></section><section class="krds-filter"></section><div class="krds-workspace"><section class="krds-list"></section><section class="krds-detail"></section></div><section class="krds-evidence"></section><nav class="krds-next-task"></nav></main>',note.route_path,note.page_title),
  'SELECTED',true,'SYSTEM_DESIGN_RECONCILER'
FROM framework_screen_development_note note
WHERE note.route_key='/admin/emission/survey-admin-data'
ON CONFLICT(route_key,slot_no) DO UPDATE SET
  route_path=excluded.route_path,page_id=excluded.page_id,
  mockup_title=excluded.mockup_title,prompt_text=excluded.prompt_text,
  html_content=excluded.html_content,mockup_status='SELECTED',selected=true,
  mockup_version=framework_screen_html_mockup.mockup_version+1,
  updated_by=excluded.updated_by,updated_at=current_timestamp;
