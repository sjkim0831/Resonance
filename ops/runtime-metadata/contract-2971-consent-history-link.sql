\set ON_ERROR_STOP on

begin;

update framework_page_design
   set actual_route_path = '/admin/system/consent-history',
       route_status = 'IMPLEMENTED',
       design_status = 'DESIGN_COMPLETE',
       design_version = design_version + 1,
       updated_by = 'KILO_M27_CONTRACT_2971',
       updated_at = current_timestamp
 where process_code = 'TERMS_CONSENT'
   and audience = 'ADMIN'
   and step_code in (
     'TERMS_CONSENT_S1',
     'TERMS_CONSENT_S2',
     'TERMS_CONSENT_S3',
     'TERMS_CONSENT_S4'
   );

do $$
begin
  if (select count(*) from framework_page_design
       where process_code = 'TERMS_CONSENT'
         and audience = 'ADMIN'
         and actual_route_path = '/admin/system/consent-history'
         and route_status = 'IMPLEMENTED') <> 4 then
    raise exception 'TERMS_CONSENT admin design linkage is incomplete';
  end if;
end $$;

select framework_generate_professional_design_graph(
  'TERMS_CONSENT',
  'KILO_M27_CONTRACT_2971'
);

update framework_screen_resource
   set screen_name = '약관·동의 이력 관리',
       screen_type = 'ADMIN',
       implementation_status = 'VERIFIED',
       source_kind = 'REACT_SOURCE',
       source_ref = 'features/consent-history/ConsentHistoryMigrationPage.tsx',
       responsive_contract = jsonb_build_object(
         'mobile', '360px single-column summary, filters, and consent cards',
         'tablet', '768px two-column summary and locally scrolling evidence table',
         'desktop', '1280px four-column summary and full evidence table',
         'overflow', 'table scroll remains inside the component'
       ),
       accessibility_contract = jsonb_build_object(
         'standard', 'WCAG 2.1 AA',
         'labels', true,
         'keyboard', true,
         'statusAnnouncements', true,
         'tableHeaders', true,
         'focusVisible', true
       ),
       security_contract = jsonb_build_object(
         'authentication', 'ADMIN',
         'serverAuthorization', true,
         'actorCodes', jsonb_build_array('PUBLIC_APPLICANT', 'VERIFIER', 'APPROVER'),
         'audit', true
       ),
       updated_at = current_timestamp
 where route_key = '/admin/system/consent-history';

update framework_screen_blueprint
   set generated_source_path = 'features/consent-history/ConsentHistoryMigrationPage.tsx',
       transition_status = 'IMPLEMENTED',
       updated_at = current_timestamp
 where blueprint_id = 497
   and route_path = '/admin/system/consent-history';

do $$
begin
  if not exists (
    select 1
      from framework_screen_resource
     where route_key = '/admin/system/consent-history'
       and implementation_status = 'VERIFIED'
       and source_ref = 'features/consent-history/ConsentHistoryMigrationPage.tsx'
  ) then
    raise exception 'verified consent-history screen resource was not generated';
  end if;

  if (select count(*)
        from framework_process_step_screen_binding b
        join framework_screen_resource r using (screen_resource_id)
       where r.route_key = '/admin/system/consent-history'
         and b.process_code = 'TERMS_CONSENT'
         and b.binding_status = 'ACTIVE') <> 4 then
    raise exception 'expected four active TERMS_CONSENT step bindings';
  end if;
end $$;

commit;
