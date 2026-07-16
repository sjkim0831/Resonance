WITH latest_pass AS (
 SELECT DISTINCT ON(process_code,case_type)
        process_code,case_type,evidence_json,evidence_hash,source_commit,executed_at
 FROM framework_backend_contract_test_run
 WHERE test_status='PASSED'
 ORDER BY process_code,case_type,executed_at DESC,run_id DESC
)
UPDATE framework_simulation_case c
SET case_status='APPROVED',
    required_evidence=CASE WHEN c.required_evidence='' THEN 'SQL_ASSERTION,CONSTRAINT_METADATA,EVIDENCE_HASH' ELSE c.required_evidence END,
    automated=true,
    updated_at=current_timestamp
FROM latest_pass p
WHERE p.process_code=c.process_code AND p.case_type=c.case_type
  AND c.case_type IN ('HAPPY_PATH','EXCEPTION','AUTHORITY','ISOLATION','RECOVERY');

WITH latest_pass AS (
 SELECT DISTINCT ON(process_code,case_type)
        process_code,case_type,evidence_json,evidence_hash,source_commit,executed_at
 FROM framework_backend_contract_test_run
 WHERE test_status='PASSED'
 ORDER BY process_code,case_type,executed_at DESC,run_id DESC
)
INSERT INTO framework_simulation_run
(case_code,process_version,result,failure_reason,evidence_json,executed_by,executed_at,source_commit,execution_environment,evidence_hash)
SELECT c.case_code,p.process_version,'PASSED',null,lp.evidence_json,'BACKEND_CONTRACT_ENGINE',lp.executed_at,
       lp.source_commit,'POSTGRES_CONTRACT_TEST',lp.evidence_hash
FROM framework_simulation_case c
JOIN latest_pass lp ON lp.process_code=c.process_code AND lp.case_type=c.case_type
JOIN framework_process_definition p ON p.process_code=c.process_code
WHERE c.case_type IN ('HAPPY_PATH','EXCEPTION','AUTHORITY','ISOLATION','RECOVERY')
  AND NOT EXISTS(SELECT 1 FROM framework_simulation_run r WHERE r.case_code=c.case_code AND r.result='PASSED' AND r.evidence_hash=lp.evidence_hash);
