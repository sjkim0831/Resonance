#!/usr/bin/env python3
import json, pathlib, sys

root = pathlib.Path(__file__).resolve().parent
ledger_path = root / "emission-work-master-ledger.v1.json"
out_path = root / "emission-function-traceability.v1.json"
ledger = json.loads(ledger_path.read_text(encoding="utf-8"))

def c(method, endpoint, permission, reads, writes=(), status="IMPLEMENTED", note=""):
    return {"method":method,"endpoint":endpoint,"permission":permission,"reads":list(reads),"writes":list(writes),"implementationStatus":status,"note":note}

R="emission_project_registry"
T="emission_project_task"
A="framework_project_actor_assignment"
B="emission_organizational_boundary"
D="emission_activity_data"
E="emission_activity_evidence"
Q="emission_activity_quality_run"
S="emission_activity_submission"
C="emission_calculation_run"
CI="emission_calculation_item"
V="emission_submission_review"
P="emission_project_report"
H="emission_project_history"

contracts = {
"TASK_SEARCH":c("GET","/home/api/emission-projects","EMISSION_TASK_READ",(R,T,A)),
"TASK_OPEN":c("GET","/home/api/emission-projects/{id}","EMISSION_TASK_READ",(R,T,A,H)),
"TASK_FILTER_STATUS":c("GET","/home/api/emission-projects?status={status}","EMISSION_TASK_READ",(R,T,A)),
"TASK_VIEW_HANDOFF":c("GET","/home/api/emission-projects/{id}/completion","EMISSION_TASK_READ",(R,T,A,"framework_process_execution_event")),
"PROJECT_SEARCH":c("GET","/home/api/emission-projects","EMISSION_PROJECT_READ",(R,T,A)),
"PROJECT_CREATE":c("POST","/home/api/emission-projects","EMISSION_PROJECT_CREATE",(R,), (R,T,A,H)),
"PROJECT_ASSIGN":c("POST","/home/api/work-assignments","EMISSION_PROJECT_ASSIGN",(R,A,"framework_process_step"), (A,"framework_account_actor_assignment","framework_project_process_step_assignment","framework_work_assignment_audit",T)),
"PROJECT_OPEN":c("GET","/home/api/emission-projects/{id}","EMISSION_PROJECT_READ",(R,T,A,H)),
"BOUNDARY_LOAD":c("GET","/home/api/emission-projects/{id}/organizational-boundary","EMISSION_BOUNDARY_READ",(B,"emission_organizational_boundary_member")),
"BOUNDARY_EDIT":c("PUT","/home/api/emission-projects/{id}/organizational-boundary","EMISSION_BOUNDARY_WRITE",(B,), (B,"emission_organizational_boundary_member",H)),
"BOUNDARY_VALIDATE":c("POST","/home/api/emission-projects/{id}/organizational-boundary/review-ready","EMISSION_BOUNDARY_WRITE",(B,"emission_organizational_boundary_member"),(H,)),
"BOUNDARY_LOCK":c("POST","/home/api/emission-projects/{id}/organizational-boundary/decision","EMISSION_BOUNDARY_LOCK",(B,), (B,T,H)),
"ACTIVITY_LOAD":c("GET","/home/api/emission-projects/{id}/activities","EMISSION_ACTIVITY_READ",(D,E)),
"ACTIVITY_EDIT":c("POST","/home/api/emission-projects/{id}/activities/{activityId}","EMISSION_ACTIVITY_WRITE",(D,), (D,H)),
"EVIDENCE_ATTACH":c("POST","/home/api/emission-projects/{id}/activities/{activityId}/evidence","EMISSION_ACTIVITY_WRITE",(D,), (E,H)),
"QUALITY_CHECK":c("POST","/home/api/emission-projects/{id}/quality","EMISSION_ACTIVITY_WRITE",(D,E), (Q,"emission_activity_quality_issue")),
"ACTIVITY_SUBMIT":c("POST","/home/api/emission-projects/{id}/submissions/{submissionId}/submit","EMISSION_ACTIVITY_SUBMIT",(D,E,Q,S), (S,"emission_activity_submission_item","emission_activity_submission_evidence",T,H)),
"FACTOR_MAP":c("POST","/home/api/emission-projects/{id}/activities/{activityId}/factor","EMISSION_CALC_EXECUTE",(D,"emission_factor_reference"), ("emission_factor_mapping_decision",D)),
"CALC_EXECUTE":c("POST","/home/api/emission-projects/{id}/calculation","EMISSION_CALC_EXECUTE",(S,D,"emission_factor_reference"), (C,CI,T,H)),
"CALC_RECONCILE":c("GET","/home/api/emission-projects/{id}/calculation","EMISSION_CALC_READ",(C,CI,S)),
"CALC_SUBMIT":c("POST","/home/api/emission-projects/{id}/calculations/{calculationId}/submit","EMISSION_CALC_SUBMIT",(C,S), ("emission_calculation_submission",C,T,H),"IMPLEMENTED","산정 버전과 활동자료 제출본을 멱등키로 결합하여 검증 단계로 제출"),
"VERIFY_SAMPLE":c("GET","/home/api/emission-projects/{id}/review-workflow","EMISSION_VERIFY_READ",(S,C,V,E)),
"VERIFY_REPLAY":c("POST","/home/api/emission-projects/{id}/quality","EMISSION_VERIFY_READ",(S,C,CI,E), (Q,)),
"VERIFY_PASS":c("POST","/home/api/emission-projects/{id}/submissions/{submissionId}/verification/decision","EMISSION_VERIFY_DECIDE",(S,C,Q), (V,S,T,H)),
"VERIFY_RETURN":c("POST","/home/api/emission-projects/{id}/submissions/{submissionId}/verification/decision","EMISSION_VERIFY_DECIDE",(S,C,Q), (V,S,T,H,"emission_workflow_notification")),
"FINDING_LOAD":c("GET","/home/api/emission-projects/{id}/review-workflow","EMISSION_CORRECTION_READ",(V,S,C)),
"FINDING_RESOLVE":c("POST","/home/api/emission-projects/{id}/submissions/{submissionId}/verification/decision","EMISSION_CORRECTION_WRITE",("emission_activity_request",V), ("emission_verification_finding","emission_activity_request","emission_activity_request_event",H),"IMPLEMENTED","reviewId·submissionId·requestId·findingCode를 명시적으로 연결"),
"CORRECTION_RECALCULATE":c("POST","/home/api/emission-projects/{id}/calculation","EMISSION_CORRECTION_WRITE",(S,D,V), (C,CI,H)),
"CORRECTION_RESUBMIT":c("POST","/home/api/emission-projects/{id}/submissions/{submissionId}/submit","EMISSION_CORRECTION_RESUBMIT",(S,V,C), (S,T,H)),
"APPROVAL_REVIEW":c("GET","/home/api/emission-projects/{id}/review-workflow","EMISSION_APPROVAL_READ",(S,C,V)),
"APPROVAL_DECIDE":c("POST","/home/api/emission-projects/{id}/submissions/{submissionId}/approval/decision","EMISSION_APPROVAL_DECIDE",(S,C,V), (V,S,C,T,H)),
"RESULT_LOCK_LOAD":c("GET","/home/api/emission-projects/{id}/result-lock","EMISSION_RESULT_LOCK",(S,C,V,"emission_result_lock"),(),"IMPLEMENTED","승인 대상과 현재 불변 잠금 상태를 단일 계약으로 조회"),
"RESULT_LOCK":c("POST","/home/api/emission-projects/{id}/result-lock","EMISSION_RESULT_LOCK",(S,C,V), ("emission_result_lock",C,T,H),"IMPLEMENTED","승인 후 SHA-256 스냅샷을 독립 멱등 잠금하고 중복 재시도 시 기존 결과 반환"),
"RESULT_LOCK_AUDIT":c("GET","/home/api/emission-projects/{id}/result-lock/audit","EMISSION_RESULT_LOCK",("emission_result_lock",C),(),"IMPLEMENTED","저장 해시를 현재 잠금 스냅샷으로 재계산하여 VERIFIED 또는 TAMPERED 판정"),
"REPORT_PREVIEW":c("GET","/home/api/emission-projects/{id}/reports","EMISSION_REPORT_READ",(P,C,V,"emission_result_lock"),(),"IMPLEMENTED","VERIFIED 결과 잠금과 연결된 보고서 버전만 조회"),
"REPORT_ISSUE":c("POST","/home/api/emission-projects/{id}/reports/{reportId}/issue","EMISSION_REPORT_ISSUE",(P,C,V,"emission_result_lock"), (P,"emission_report_certificate_audit",T,H),"IMPLEMENTED","잠금 해시 재검증 후 인증서 발급·REPORT 완료·프로젝트 100% 전이"),
"REPORT_DOWNLOAD":c("POST","/home/api/emission-projects/{id}/reports/{reportId}/download","EMISSION_REPORT_DOWNLOAD",(P,), ("emission_report_access_ledger",)),
"ISSUE_HISTORY":c("GET","/home/api/emission-projects/{id}/reports","EMISSION_REPORT_READ",(P,"emission_report_certificate_audit","emission_report_access_ledger")),
"ACCOUNT_SEARCH":c("GET","/home/api/emission-projects/options","EMISSION_ACTOR_ASSIGN_ADMIN",("comtnemplyrinfo","comtnentrprsmber","framework_account_actor_assignment")),
"ACTOR_ASSIGN":c("POST","/home/api/work-assignments","EMISSION_ACTOR_ASSIGN_ADMIN",("framework_actor_definition",A,"framework_process_step"), (A,"framework_account_actor_assignment","framework_project_process_step_assignment","framework_work_assignment_audit",T)),
"SOD_VALIDATE":c("GET|POST","/home/api/work-assignments","EMISSION_ACTOR_ASSIGN_ADMIN",("framework_actor_definition",A),(),"IMPLEMENTED","조회 응답은 충돌 목록을 제공하고 저장 요청은 충돌 배정을 거부함"),
"PERMISSION_PREVIEW":c("GET","/home/api/work-assignments","EMISSION_ACTOR_ASSIGN_ADMIN",("framework_permission_requirement_v1","framework_process_step",A))
}

entries=[]
for page in ledger["pages"]:
    for fn in page["functions"]:
        if fn not in contracts:
            raise SystemExit(f"missing contract for {page['code']}:{fn}")
        entries.append({"traceId":f"EMISSION:{page['code']}:{fn}","page":page["code"],"function":fn,"actors":page["actors"],**contracts[fn],"testId":f"T-FN-{fn}"})

statuses={}
for entry in entries: statuses[entry["implementationStatus"]]=statuses.get(entry["implementationStatus"],0)+1
out={"schema":"carbonet.function-traceability/v1","ledgerCode":ledger["ledgerCode"],"ledgerVersion":ledger["version"],"sourceController":"modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/home/web/EmissionProjectRegistryController.java","sourceService":"modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/home/service/EmissionProjectRegistryService.java","entryCount":len(entries),"statusSummary":statuses,"entries":entries}
out_path.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"output":str(out_path),"entryCount":len(entries),"statusSummary":statuses},ensure_ascii=False))
