-- Search paths used by approval queues and certificate audit detail screens.
-- Keep these as dedicated indexes: the existing review scope index starts
-- with tenant_id, so it cannot efficiently serve project-only joins.
CREATE INDEX IF NOT EXISTS idx_emission_submission_review_project_id
  ON emission_submission_review (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_emission_report_certificate_audit_report_id
  ON emission_report_certificate_audit (report_id, created_at DESC);

-- The professional design gate discovered two operational routes that were
-- added after the original design-note compilation. Generate governance
-- records from the current reviewed contract so later route additions cannot
-- remain detached from the builder/design workflow.
INSERT INTO framework_screen_development_note
  (route_key,route_path,page_id,page_title,design_note,function_note,
   acceptance_note,development_status,updated_by)
SELECT DISTINCT ON (lower(split_part(contract.route_path,'?',1)))
  lower(split_part(contract.route_path,'?',1)),
  split_part(contract.route_path,'?',1),
  'PG_'||upper(substr(md5(lower(split_part(contract.route_path,'?',1))),1,16)),
  contract.screen_name,
  'KRDS responsive work screen with task summary, filters, evidence, history and next-task navigation.',
  contract.business_purpose||' Command='||contract.command_contract||' API='||contract.api_contract,
  contract.exit_condition||' Normal, validation, authority, isolation and recovery scenarios must pass.',
  'READY','SYSTEM_DESIGN_RECONCILER'
FROM framework_professional_screen_contract contract
WHERE contract.process_code='EMISSION_PROJECT'
ORDER BY lower(split_part(contract.route_path,'?',1)),contract.audience
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
  'Render the reviewed actor task as a responsive KRDS work screen with explicit entry and completion conditions.',
  format('<main class="krds-page" data-route="%s"><header class="krds-page-header"><h1>%s</h1></header><section class="krds-task-summary"></section><section class="krds-filter"></section><div class="krds-workspace"><section class="krds-list"></section><section class="krds-detail"></section></div><section class="krds-evidence"></section><nav class="krds-next-task"></nav></main>',note.route_path,note.page_title),
  'SELECTED',true,'SYSTEM_DESIGN_RECONCILER'
FROM framework_screen_development_note note
WHERE note.route_key IN (
  SELECT lower(split_part(route_path,'?',1))
  FROM framework_professional_screen_contract
  WHERE process_code='EMISSION_PROJECT'
)
ON CONFLICT(route_key,slot_no) DO UPDATE SET
  route_path=excluded.route_path,page_id=excluded.page_id,
  mockup_title=excluded.mockup_title,prompt_text=excluded.prompt_text,
  html_content=excluded.html_content,mockup_status='SELECTED',selected=true,
  mockup_version=framework_screen_html_mockup.mockup_version+1,
  updated_by=excluded.updated_by,updated_at=current_timestamp;
