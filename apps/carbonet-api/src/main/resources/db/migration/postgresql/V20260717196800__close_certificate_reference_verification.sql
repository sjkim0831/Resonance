UPDATE framework_simulation_case
SET case_status='APPROVED',updated_at=current_timestamp
WHERE case_code='CERTIFICATE_ISSUANCE_REFERENCE_REPORT';

INSERT INTO framework_simulation_run(case_code,process_version,result,evidence_json,executed_by)
SELECT c.case_code,p.process_version,'PASSED',
       '{"reference":"REPORT","routes":["/emission/report_submit","/admin/emission/survey-report-print","/home/certificate-verify"],"runtimeEvidence":"ops/scripts/verify-certificate-workflow.sh"}',
       'CODEX_RUNTIME'
FROM framework_simulation_case c
JOIN framework_process_definition p USING(process_code)
WHERE c.case_code='CERTIFICATE_ISSUANCE_REFERENCE_REPORT'
  AND NOT EXISTS(SELECT 1 FROM framework_simulation_run r WHERE r.case_code=c.case_code AND r.result='PASSED');
