-- Business execution order is independent from development priority.
CREATE TABLE IF NOT EXISTS framework_business_process_sequence (
    work_type_code varchar(40) NOT NULL REFERENCES framework_business_work_type(work_type_code),
    process_code varchar(80) PRIMARY KEY REFERENCES framework_process_definition(process_code) ON DELETE CASCADE,
    workflow_order integer NOT NULL,
    workflow_phase varchar(80) NOT NULL,
    process_role varchar(20) NOT NULL DEFAULT 'CORE',
    prerequisite_process_codes text NOT NULL DEFAULT '',
    next_process_code varchar(80),
    sequence_status varchar(20) NOT NULL DEFAULT 'ACTIVE',
    created_at timestamp NOT NULL DEFAULT current_timestamp,
    updated_at timestamp NOT NULL DEFAULT current_timestamp,
    CONSTRAINT uq_business_process_sequence_order UNIQUE(work_type_code,workflow_order),
    CONSTRAINT ck_business_process_sequence_role CHECK(process_role IN ('ENTRY','CORE','BRANCH','SUPPORT','EXIT')),
    CONSTRAINT ck_business_process_sequence_status CHECK(sequence_status IN ('ACTIVE','DRAFT','RETIRED'))
);

CREATE INDEX IF NOT EXISTS idx_business_process_sequence_order
  ON framework_business_process_sequence(work_type_code,workflow_order,process_code);

WITH flow(work_type_code,codes) AS (VALUES
 ('MEMBER',ARRAY['MEMBER_LIFECYCLE','TERMS_CONSENT','MEMBER_REGISTRATION','IDENTITY_VERIFICATION','MEMBER_APPROVAL','COMPANY_ONBOARDING','COMPANY_REGISTRATION_APPROVAL','ORGANIZATION_DEPARTMENT','BUSINESS_SITE_ADMINISTRATION','LOGIN_AUTHENTICATION','MFA_MANAGEMENT','PROFILE_MANAGEMENT','MEMBER_ADMINISTRATION','PASSWORD_RECOVERY','ACCOUNT_LOCK_RECOVERY','ACCOUNT_WITHDRAWAL']::text[]),
 ('EMISSION',ARRAY['EMISSION_PROJECT','ORGANIZATIONAL_BOUNDARY','ACTIVITY_DATA','MEASUREMENT_DATA_QUALITY','EMISSION_CALCULATION','EXTERNAL_VERIFICATION_ENGAGEMENT','REGULATORY_SUBMISSION','DISCLOSURE_CORRECTION','CCUS_LIFECYCLE_MRV','MRV_TRACEABILITY','CHAIN_OF_CUSTODY','LEAKAGE_INCIDENT_RESPONSE','PROJECT_LIFECYCLE_CONTROL']::text[]),
 ('LCA',ARRAY['LCA_EXECUTION','LCA_DATA_QUALITY_UNCERTAINTY','BACKGROUND_DB_VERSION_IMPACT','LCA_ALLOCATION_SENSITIVITY','PCR_EPD_VERIFICATION','COMPARATIVE_ASSERTION_REVIEW']::text[]),
 ('REDUCTION',ARRAY['REDUCTION_TARGET_PLANNING','REDUCTION_ROADMAP','REDUCTION_PROJECT_REGISTRATION','REDUCTION_PROJECT_APPROVAL','REDUCTION_EXECUTION','REDUCTION_SCENARIO','MACC_PORTFOLIO','REDUCTION_PERFORMANCE','REDUCTION_REPORTING']::text[]),
 ('MONITORING',ARRAY['MONITORING_ANALYSIS','INTEGRATED_MONITORING','DATA_QUALITY_MONITORING','ANOMALY_ALERT_MANAGEMENT','REGULATORY_STATUS_MONITORING','ANALYSIS_EXPORT','STAKEHOLDER_SHARING']::text[]),
 ('TRADE',ARRAY['TRADE_EXECUTION','CO2_SUPPLY_REGISTRATION','CO2_DEMAND_REGISTRATION','SUPPLY_DEMAND_MATCHING','TRADE_PROPOSAL','TRADE_CONTRACT','TRADE_EXECUTION_TRACKING','PAYMENT_SETTLEMENT','TRADE_SETTLEMENT','REFUND_MANAGEMENT']::text[]),
 ('CERTIFICATE',ARRAY['REPORT_CERTIFICATION','REPORT_TEMPLATE_MANAGEMENT','REPORT_GENERATION','REPORT_SUBMISSION','DOUBLE_USE_PREVENTION','CERTIFICATE_REVIEW_ISSUANCE','CARBON_CREDIT_MANAGEMENT','CERTIFICATE_VERIFICATION','CERTIFICATE_OBJECTION','CERTIFICATE_ISSUANCE']::text[]),
 ('EDUCATION',ARRAY['CONTENT_OPERATION','NOTICE_PUBLICATION','RESOURCE_PUBLICATION','FAQ_MANAGEMENT','NEWSLETTER_OPERATION','COURSE_MANAGEMENT','EDUCATION_SCHEDULE','EDUCATION_APPLICATION','ATTENDANCE_PROGRESS','EDUCATION_ASSESSMENT','TRAINING_CERTIFICATE','CUSTOMER_INQUIRY']::text[]),
 ('SYSTEM',ARRAY['GOVERNANCE_CHANGE','ROLE_AUTHORITY_MANAGEMENT','USER_AUTHORITY_ASSIGNMENT','MENU_ACCESS_CONTROL','DATA_SCOPE_AUTHORITY','APPROVAL_AUTHORITY','VALIDATION_RULE_MANAGEMENT','OUTLIER_RULE_MANAGEMENT','QUALITY_SCORING_POLICY','APPROVAL_LINE_MANAGEMENT','APPROVAL_WORKFLOW_MANAGEMENT','TASK_TEMPLATE_MANAGEMENT','PROCESS_COMPLETION_POLICY','DEADLINE_NOTIFICATION_POLICY','AUTOMATION_RULE_MANAGEMENT','DATA_INTEGRATION','EXTERNAL_SYSTEM_REGISTRY','API_CONNECTION_MANAGEMENT','API_KEY_LIFECYCLE','DATA_SCHEMA_CONTRACT','WEBHOOK_MANAGEMENT','SYNC_EXECUTION','INTEGRATION_FAILURE_RETRY','API_USAGE_MONITORING','INTEGRATION_LOG_AUDIT','PLATFORM_OPERATION','MENU_SCREEN_GOVERNANCE','DESIGN_ASSET_GOVERNANCE','BUILDER_GENERATOR_OPERATION','FEATURE_API_GOVERNANCE','SECURITY_POLICY_OPERATION','AUDIT_LOG_OPERATION','SYSTEM_MONITORING_RECOVERY','BATCH_SCHEDULE_OPERATION','GIT_BUILD_DEPLOYMENT','VERSION_BACKUP_RECOVERY','EXTERNAL_SERVICE_STATUS','NOTIFICATION_CENTER_OPERATION','INCIDENT_IMPROVEMENT_REQUEST','APPEAL_DISPUTE_AUDIT']::text[]),
 ('COMMON',ARRAY['CUSTOMER_WORK_COORDINATION']::text[])
), expanded AS (
 SELECT f.work_type_code,u.process_code,u.ordinality::integer AS ordinal,cardinality(f.codes) AS total
 FROM flow f CROSS JOIN LATERAL unnest(f.codes) WITH ORDINALITY u(process_code,ordinality)
), source AS (
 SELECT e.*,coalesce(p.prerequisite_codes,'') AS prerequisites
 FROM expanded e JOIN framework_process_definition p ON p.process_code=e.process_code
)
INSERT INTO framework_business_process_sequence(
 work_type_code,process_code,workflow_order,workflow_phase,process_role,
 prerequisite_process_codes,next_process_code,sequence_status
)
SELECT s.work_type_code,s.process_code,s.ordinal*10,
       CASE
        WHEN s.work_type_code='MEMBER' AND s.ordinal<=5 THEN 'REGISTRATION_AUTH'
        WHEN s.work_type_code='MEMBER' AND s.ordinal<=9 THEN 'COMPANY_ONBOARDING'
        WHEN s.work_type_code='MEMBER' THEN 'ACCOUNT_OPERATION'
        WHEN s.work_type_code='EMISSION' AND s.ordinal<=5 THEN 'PROJECT_DATA_CALCULATION'
        WHEN s.work_type_code='EMISSION' AND s.ordinal<=8 THEN 'VERIFICATION_SUBMISSION'
        WHEN s.work_type_code='EMISSION' THEN 'MRV_TRACE_CLOSE'
        WHEN s.work_type_code='LCA' THEN 'LCA_CALCULATION_REVIEW'
        WHEN s.work_type_code='REDUCTION' AND s.ordinal<=5 THEN 'TARGET_PROJECT'
        WHEN s.work_type_code='REDUCTION' THEN 'ANALYSIS_PERFORMANCE'
        WHEN s.work_type_code='MONITORING' THEN 'MONITORING_ANALYSIS'
        WHEN s.work_type_code='TRADE' AND s.ordinal<=7 THEN 'SUPPLY_DEMAND_TRADE'
        WHEN s.work_type_code='TRADE' THEN 'PAYMENT_SETTLEMENT'
        WHEN s.work_type_code='CERTIFICATE' AND s.ordinal<=4 THEN 'REPORT'
        WHEN s.work_type_code='CERTIFICATE' THEN 'CERTIFICATE_VERIFICATION'
        WHEN s.work_type_code='EDUCATION' AND s.ordinal<=5 THEN 'CONTENT_SUPPORT'
        WHEN s.work_type_code='EDUCATION' THEN 'EDUCATION_OPERATION'
        WHEN s.work_type_code='SYSTEM' AND s.ordinal<=15 THEN 'AUTH_WORKFLOW'
        WHEN s.work_type_code='SYSTEM' AND s.ordinal<=25 THEN 'EXTERNAL_INTEGRATION'
        WHEN s.work_type_code='SYSTEM' THEN 'PLATFORM_OPERATION'
        ELSE 'COMMON_WORK' END,
       CASE WHEN s.ordinal=1 THEN 'ENTRY'
            WHEN s.ordinal=s.total THEN 'EXIT'
            WHEN s.process_code IN ('PASSWORD_RECOVERY','ACCOUNT_LOCK_RECOVERY','DISCLOSURE_CORRECTION','LEAKAGE_INCIDENT_RESPONSE','REFUND_MANAGEMENT','CERTIFICATE_OBJECTION','CUSTOMER_INQUIRY','INCIDENT_IMPROVEMENT_REQUEST','APPEAL_DISPUTE_AUDIT') THEN 'BRANCH'
            WHEN s.process_code IN ('NOTICE_PUBLICATION','RESOURCE_PUBLICATION','FAQ_MANAGEMENT','NEWSLETTER_OPERATION','REPORT_TEMPLATE_MANAGEMENT','API_USAGE_MONITORING','INTEGRATION_LOG_AUDIT') THEN 'SUPPORT'
            ELSE 'CORE' END,
       s.prerequisites,
       lead(s.process_code) OVER(PARTITION BY s.work_type_code ORDER BY s.ordinal),
       'ACTIVE'
FROM source s
ON CONFLICT(process_code) DO UPDATE SET
 work_type_code=excluded.work_type_code,workflow_order=excluded.workflow_order,
 workflow_phase=excluded.workflow_phase,process_role=excluded.process_role,
 prerequisite_process_codes=excluded.prerequisite_process_codes,
 next_process_code=excluded.next_process_code,sequence_status='ACTIVE',updated_at=current_timestamp;

CREATE OR REPLACE FUNCTION framework_sync_business_process_sequences()
RETURNS TABLE(inserted_count integer,total_count integer,missing_count integer)
LANGUAGE plpgsql AS $$
DECLARE added integer;
BEGIN
  WITH missing AS (
    SELECT upper(p.domain_code) AS work_type_code,p.process_code,
           coalesce(p.prerequisite_codes,'') AS prerequisites,
           row_number() OVER(PARTITION BY upper(p.domain_code) ORDER BY p.development_order,p.process_code) AS ordinal
    FROM framework_process_definition p
    JOIN framework_business_work_type w ON w.work_type_code=upper(p.domain_code) AND w.use_at='Y'
    WHERE NOT EXISTS(SELECT 1 FROM framework_business_process_sequence s WHERE s.process_code=p.process_code)
  )
  INSERT INTO framework_business_process_sequence(
    work_type_code,process_code,workflow_order,workflow_phase,process_role,
    prerequisite_process_codes,sequence_status
  )
  SELECT m.work_type_code,m.process_code,
         coalesce((SELECT max(s.workflow_order) FROM framework_business_process_sequence s WHERE s.work_type_code=m.work_type_code),0) + m.ordinal*10,
         'NEW_WORK','CORE',m.prerequisites,'DRAFT'
  FROM missing m ORDER BY m.work_type_code,m.ordinal;
  GET DIAGNOSTICS added = ROW_COUNT;
  RETURN QUERY SELECT added,
    (SELECT count(*)::integer FROM framework_business_process_sequence),
    (SELECT count(*)::integer FROM framework_process_definition p
      JOIN framework_business_work_type w ON w.work_type_code=upper(p.domain_code) AND w.use_at='Y'
      WHERE NOT EXISTS(SELECT 1 FROM framework_business_process_sequence s WHERE s.process_code=p.process_code));
END $$;

SELECT * FROM framework_sync_business_process_sequences();

CREATE OR REPLACE VIEW framework_business_process_sequence_audit AS
SELECT w.work_type_code,w.work_type_name,
       count(p.process_code) AS process_count,count(s.process_code) AS sequenced_count,
       count(p.process_code) FILTER(WHERE s.process_code IS NULL) AS missing_sequence_count,
       count(s.process_code) FILTER(WHERE s.next_process_code IS NOT NULL AND n.process_code IS NULL) AS invalid_next_count
FROM framework_business_work_type w
LEFT JOIN framework_process_definition p ON upper(p.domain_code)=w.work_type_code
LEFT JOIN framework_business_process_sequence s ON s.process_code=p.process_code
LEFT JOIN framework_process_definition n ON n.process_code=s.next_process_code
WHERE w.use_at='Y'
GROUP BY w.work_type_code,w.work_type_name,w.sort_order
ORDER BY w.sort_order;
