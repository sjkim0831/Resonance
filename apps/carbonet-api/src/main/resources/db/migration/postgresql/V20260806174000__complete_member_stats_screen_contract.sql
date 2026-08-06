UPDATE framework_step_execution_spec
SET screen_contract = jsonb_build_array(jsonb_build_object(
        'pageCode', 'MEMBER_STATS_ADMIN',
        'title', '회원 통계 현황',
        'audience', 'ADMIN',
        'screenType', 'DASHBOARD',
        'actualRoute', '/admin/member/stats',
        'routeStatus', 'IMPLEMENTED',
        'primaryEntity', 'COMTNEMPLYRINFO',
        'sections', jsonb_build_array(
            jsonb_build_object('code', 'SUMMARY', 'fields', jsonb_build_array('totalMembers', 'memberTypeStats')),
            jsonb_build_object('code', 'MONTHLY_SIGNUP_TREND', 'fields', jsonb_build_array('monthlySignupStats')),
            jsonb_build_object('code', 'REGIONAL_DISTRIBUTION', 'fields', jsonb_build_array('regionalDistribution'))
        ),
        'responsive', jsonb_build_object('desktop', 'three-column summary and trend', 'mobile', 'single-column cards', 'overflow', 'local-only'),
        'accessibility', jsonb_build_object('standard', 'WCAG 2.1 AA', 'labels', true, 'keyboard', true),
        'security', jsonb_build_object('serverAuthorization', true, 'anonymousFailClosed', true, 'auditRequired', true)
    )),
    updated_at = CURRENT_TIMESTAMP
WHERE process_code = 'MEMBER_LIFECYCLE'
  AND step_code = 'MEMBER_LIFECYCLE_02_WORK'
  AND screen_contract IN ('[]'::jsonb, '{}'::jsonb, 'null'::jsonb);

UPDATE framework_professional_screen_contract
SET data_contract = jsonb_build_object(
        'primaryEntity', 'COMTNEMPLYRINFO',
        'readModel', 'MemberStatsPagePayload',
        'fields', jsonb_build_array('totalMembers', 'memberTypeStats', 'monthlySignupStats', 'regionalDistribution'),
        'tenantScope', 'ADMIN_AUTHORITY_SCOPE',
        'sourceOfTruth', 'member repository aggregate'
    )::text,
    updated_by = 'V20260806174000',
    updated_at = CURRENT_TIMESTAMP
WHERE process_code = 'MEMBER_LIFECYCLE'
  AND step_code = 'MEMBER_LIFECYCLE_02_WORK'
  AND audience = 'ADMIN'
  AND route_path = '/admin/member/stats';
