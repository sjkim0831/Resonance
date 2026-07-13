package egovframework.com.platform.governance.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ActorProcessGovernanceService {
    private final JdbcTemplate jdbc;

    public Map<String,Object> dashboard() {
        Map<String,Object> out=new LinkedHashMap<>();
        out.put("actors",jdbc.queryForList("select actor_code as \"actorCode\",actor_name as \"actorName\",actor_name_en as \"actorNameEn\",actor_type as \"actorType\",purpose,capability_codes as \"capabilityCodes\",delegation_allowed as \"delegationAllowed\",use_at as \"useAt\" from framework_actor_definition order by actor_type,actor_code"));
        out.put("assignments",jdbc.queryForList("select assignment_id as \"assignmentId\",account_id as \"accountId\",tenant_id as \"tenantId\",project_id as \"projectId\",actor_code as \"actorCode\",data_scope as \"dataScope\",valid_from as \"validFrom\",valid_until as \"validUntil\",assignment_status as \"status\" from framework_account_actor_assignment order by assignment_id desc limit 200"));
        out.put("processes",jdbc.queryForList("select p.process_code as \"processCode\",p.process_name as \"processName\",p.domain_code as \"domainCode\",p.process_version as \"version\",p.development_order as \"developmentOrder\",p.prerequisite_codes as \"prerequisiteCodes\",p.goal,p.start_condition as \"startCondition\",p.completion_condition as \"completionCondition\",p.process_status as \"status\",count(distinct s.step_id) as \"stepCount\",count(distinct c.case_code) as \"caseCount\",count(distinct r.run_id) filter(where r.result='PASSED') as \"passedRuns\" from framework_process_definition p left join framework_process_step s on s.process_code=p.process_code left join framework_simulation_case c on c.process_code=p.process_code left join framework_simulation_run r on r.case_code=c.case_code group by p.process_code order by p.development_order,p.process_code"));
        out.put("steps",jdbc.queryForList("select step_id as \"stepId\",process_code as \"processCode\",step_order as \"stepOrder\",step_code as \"stepCode\",step_name as \"stepName\",actor_code as \"actorCode\",from_state as \"fromState\",command_code as \"commandCode\",to_state as \"toState\",completion_rule as \"completionRule\",user_path as \"userPath\",admin_path as \"adminPath\",api_contract as \"apiContract\" from framework_process_step order by process_code,step_order"));
        out.put("cases",jdbc.queryForList("select case_code as \"caseCode\",process_code as \"processCode\",case_name as \"caseName\",case_type as \"caseType\",preconditions,steps_json as \"stepsJson\",assertions_json as \"assertionsJson\",case_status as \"status\" from framework_simulation_case order by process_code,case_code"));
        out.put("runs",jdbc.queryForList("select run_id as \"runId\",case_code as \"caseCode\",process_version as \"processVersion\",result,failure_reason as \"failureReason\",executed_by as \"executedBy\",executed_at as \"executedAt\" from framework_simulation_run order by run_id desc limit 100"));
        out.put("artifacts",jdbc.queryForList("select artifact_id as \"artifactId\",process_code as \"processCode\",step_code as \"stepCode\",artifact_code as \"artifactCode\",artifact_type as \"artifactType\",artifact_name as \"artifactName\",target_path as \"targetPath\",contract_ref as \"contractRef\",required,delivery_status as \"status\",owner_actor_code as \"ownerActorCode\",acceptance_criteria as \"acceptanceCriteria\",evidence_ref as \"evidenceRef\",notes from framework_process_artifact order by process_code,artifact_type,artifact_code"));
        out.put("developmentRules",jdbc.queryForList("select rule_code as \"ruleCode\",rule_group as \"ruleGroup\",rule_name as \"ruleName\",rule_description as \"ruleDescription\",verification_method as \"verificationMethod\",source_ref as \"sourceRef\",mandatory from framework_development_rule where use_at='Y' order by rule_group,rule_code"));
        out.put("summary",jdbc.queryForMap("select count(*) as \"processCount\",count(*) filter(where process_status='DEVELOPMENT_READY') as \"readyCount\",count(*) filter(where process_status<>'DEVELOPMENT_READY') as \"draftCount\",coalesce(round(100.0*count(*) filter(where process_status='DEVELOPMENT_READY')/nullif(count(*),0)),0) as \"readinessPercent\" from framework_process_definition"));
        return out;
    }

    @Transactional public void createActor(Map<String,Object>b){
        jdbc.update("insert into framework_actor_definition(actor_code,actor_name,actor_name_en,actor_type,purpose,capability_codes,delegation_allowed) values(?,?,?,?,?,?,?) on conflict(actor_code) do update set actor_name=excluded.actor_name,actor_name_en=excluded.actor_name_en,actor_type=excluded.actor_type,purpose=excluded.purpose,capability_codes=excluded.capability_codes,delegation_allowed=excluded.delegation_allowed,updated_at=current_timestamp",req(b,"actorCode"),req(b,"actorName"),str(b,"actorNameEn"),def(b,"actorType","BUSINESS"),req(b,"purpose"),str(b,"capabilityCodes"),bool(b,"delegationAllowed"));
    }
    @Transactional public void assignActor(Map<String,Object>b){
        jdbc.update("insert into framework_account_actor_assignment(account_id,tenant_id,project_id,actor_code,data_scope,valid_until) values(?,?,?,?,?,nullif(?,'')::date) on conflict(account_id,tenant_id,project_id,actor_code) do update set data_scope=excluded.data_scope,valid_until=excluded.valid_until,assignment_status='ACTIVE'",req(b,"accountId"),def(b,"tenantId","DEFAULT"),def(b,"projectId","*"),req(b,"actorCode"),def(b,"dataScope","*"),str(b,"validUntil"));
    }
    @Transactional public void createProcess(Map<String,Object>b){
        jdbc.update("insert into framework_process_definition(process_code,process_name,domain_code,process_version,goal,start_condition,completion_condition) values(?,?,?,?,?,?,?) on conflict(process_code) do update set process_name=excluded.process_name,domain_code=excluded.domain_code,process_version=excluded.process_version,goal=excluded.goal,start_condition=excluded.start_condition,completion_condition=excluded.completion_condition,updated_at=current_timestamp",req(b,"processCode"),req(b,"processName"),req(b,"domainCode"),def(b,"version","1.0.0"),req(b,"goal"),req(b,"startCondition"),req(b,"completionCondition"));
    }
    @Transactional public void addStep(Map<String,Object>b){
        jdbc.update("insert into framework_process_step(process_code,step_order,step_code,step_name,actor_code,from_state,command_code,to_state,completion_rule,user_path,admin_path,api_contract) values(?,?,?,?,?,?,?,?,?,?,?,?) on conflict(process_code,step_code) do update set step_order=excluded.step_order,step_name=excluded.step_name,actor_code=excluded.actor_code,from_state=excluded.from_state,command_code=excluded.command_code,to_state=excluded.to_state,completion_rule=excluded.completion_rule,user_path=excluded.user_path,admin_path=excluded.admin_path,api_contract=excluded.api_contract",req(b,"processCode"),integer(b,"stepOrder"),req(b,"stepCode"),req(b,"stepName"),req(b,"actorCode"),req(b,"fromState"),req(b,"commandCode"),req(b,"toState"),req(b,"completionRule"),str(b,"userPath"),str(b,"adminPath"),str(b,"apiContract"));
    }
    @Transactional public void createCase(Map<String,Object>b){
        jdbc.update("insert into framework_simulation_case(case_code,process_code,case_name,case_type,preconditions,steps_json,assertions_json) values(?,?,?,?,?,?,?) on conflict(case_code) do update set case_name=excluded.case_name,case_type=excluded.case_type,preconditions=excluded.preconditions,steps_json=excluded.steps_json,assertions_json=excluded.assertions_json,updated_at=current_timestamp",req(b,"caseCode"),req(b,"processCode"),req(b,"caseName"),def(b,"caseType","HAPPY_PATH"),req(b,"preconditions"),req(b,"stepsJson"),req(b,"assertionsJson"));
    }
    @Transactional public void saveArtifact(Map<String,Object>b){
        jdbc.update("insert into framework_process_artifact(process_code,step_code,artifact_code,artifact_type,artifact_name,target_path,contract_ref,required,delivery_status,owner_actor_code,acceptance_criteria,evidence_ref,notes) values(?,?,?,?,?,?,?,?,?,?,?,nullif(?,''),nullif(?,'')) on conflict(process_code,artifact_code) do update set step_code=excluded.step_code,artifact_type=excluded.artifact_type,artifact_name=excluded.artifact_name,target_path=excluded.target_path,contract_ref=excluded.contract_ref,required=excluded.required,delivery_status=excluded.delivery_status,owner_actor_code=excluded.owner_actor_code,acceptance_criteria=excluded.acceptance_criteria,evidence_ref=excluded.evidence_ref,notes=excluded.notes,updated_at=current_timestamp",req(b,"processCode"),str(b,"stepCode"),req(b,"artifactCode"),req(b,"artifactType"),req(b,"artifactName"),str(b,"targetPath"),str(b,"contractRef"),!"false".equalsIgnoreCase(str(b,"required")),def(b,"status","PLANNED"),req(b,"ownerActorCode"),req(b,"acceptanceCriteria"),str(b,"evidenceRef"),str(b,"notes"));
    }
    @Transactional public void recordRun(Map<String,Object>b,String actor){
        String caseCode=req(b,"caseCode"),result=req(b,"result");
        String version=jdbc.queryForObject("select p.process_version from framework_process_definition p join framework_simulation_case c on c.process_code=p.process_code where c.case_code=?",String.class,caseCode);
        jdbc.update("insert into framework_simulation_run(case_code,process_version,result,failure_reason,evidence_json,executed_by) values(?,?,?,?,?,?)",caseCode,version,result,str(b,"failureReason"),def(b,"evidenceJson","{}"),actor);
        jdbc.update("update framework_simulation_case set case_status=?,updated_at=current_timestamp where case_code=?","PASSED".equals(result)?"APPROVED":"REVIEW_REQUIRED",caseCode);
        if("PASSED".equals(result)) jdbc.update("update framework_process_definition p set process_status='DEVELOPMENT_READY',updated_at=current_timestamp where p.process_code=(select process_code from framework_simulation_case where case_code=?) and exists(select 1 from framework_process_step s where s.process_code=p.process_code) and not exists(select 1 from framework_simulation_case c where c.process_code=p.process_code and c.case_status<>'APPROVED') and not exists(select 1 from framework_process_artifact a where a.process_code=p.process_code and a.required and a.delivery_status<>'VERIFIED')",caseCode);
    }

    /** Idempotent starter pack: safe to run repeatedly and never removes operator data. */
    @Transactional public Map<String,Object> installStandardPack(){
        Object[][] actors={
            {"COMPANY_MANAGER","기업 책임자","BUSINESS","프로젝트를 개설하고 최종 결과와 보고 책임을 관리한다.","PROJECT_CREATE,PROJECT_ASSIGN,REPORT_FINALIZE"},
            {"SITE_DATA_OWNER","사업장 자료 담당자","BUSINESS","사업장 활동자료와 증빙을 정확하게 제출하고 보완한다.","DATA_VIEW,DATA_EDIT,EVIDENCE_UPLOAD,SUBMIT"},
            {"CALCULATOR","산정 담당자","BUSINESS","단위와 배출계수를 검토하고 배출량을 산정한다.","FACTOR_MAP,CALCULATE,RECALCULATE"},
            {"VERIFIER","검증 담당자","REVIEW","입력·산정 결과와 증빙을 검증하고 보완을 요청한다.","VALIDATE,CORRECTION_REQUEST,VALIDATION_PASS"},
            {"APPROVER","승인권자","APPROVAL","검증 완료 결과를 승인·반려하고 확정한다.","APPROVE,REJECT,REOPEN"},
            {"PLATFORM_OPERATOR","플랫폼 운영자","OPERATION","프로세스와 프로젝트 운영 상태를 관리한다.","PROCESS_MANAGE,ASSIGNMENT_MANAGE,OVERRIDE"},
            {"AUDITOR","감사 담당자","AUDIT","감사 증적과 변경 이력을 독립적으로 확인한다.","AUDIT_VIEW,EVIDENCE_EXPORT"},
            {"LCA_PRACTITIONER","LCA 실무자","BUSINESS","제품 전과정 인벤토리와 영향평가를 수행한다.","LCA_EDIT,LCI_MAP,LCIA_CALCULATE"},
            {"REDUCTION_MANAGER","감축 과제 담당자","BUSINESS","감축 목표와 과제 및 실적을 관리한다.","TARGET_EDIT,REDUCTION_EDIT,PERFORMANCE_SUBMIT"},
            {"SYSTEM_INTEGRATOR","외부 연계 담당자","OPERATION","외부 데이터 연계와 재처리를 운영한다.","INTEGRATION_RUN,RETRY,SCHEMA_MAP"}
        };
        for(Object[] a:actors) jdbc.update("insert into framework_actor_definition(actor_code,actor_name,actor_type,purpose,capability_codes) values(?,?,?,?,?) on conflict(actor_code) do update set actor_name=excluded.actor_name,actor_type=excluded.actor_type,purpose=excluded.purpose,capability_codes=excluded.capability_codes,updated_at=current_timestamp",a);
        Object[][] processes={
            {"EMISSION_PROJECT","배출량 프로젝트 수행","CARBON_EMISSION","프로젝트 생성부터 보고서 확정까지 완결한다.","프로젝트가 승인되어 시작됨","승인된 보고서와 감사 증적이 존재함"},
            {"ACTIVITY_DATA","활동자료 수집·보완","CARBON_EMISSION","활동자료와 증빙을 수집하고 오류를 보완한다.","자료 제출 요청이 발행됨","모든 필수 자료가 검증 통과함"},
            {"EMISSION_CALCULATION","배출량 산정·검증","CARBON_EMISSION","배출계수를 매핑하고 배출량을 검증한다.","검증 가능한 활동자료가 존재함","산정 결과가 승인됨"},
            {"LCA_EXECUTION","제품 LCA 수행","LCA","인벤토리 수집부터 영향평가와 보고까지 수행한다.","LCA 프로젝트와 시스템 경계가 확정됨","LCA 결과가 검토·확정됨"},
            {"REDUCTION_EXECUTION","감축 과제 수행","REDUCTION","감축 목표를 과제로 실행하고 실적을 검증한다.","감축 목표와 기준연도가 승인됨","감축 실적이 승인되어 보고됨"},
            {"REPORT_CERTIFICATION","보고서·인증서 발급","REPORTING","확정 결과로 보고서와 검증 가능한 인증서를 발급한다.","승인된 산정 결과가 존재함","발급물과 진위 검증 정보가 공개됨"},
            {"DATA_INTEGRATION","외부 데이터 연계","INTEGRATION","외부 자료를 안전하게 수집·검증·재처리한다.","연계 스키마와 권한이 승인됨","수집 데이터 품질 검증이 완료됨"},
            {"GOVERNANCE_CHANGE","기준·워크플로 변경","GOVERNANCE","기준정보 변경을 검토·승인·배포하고 추적한다.","변경 요청과 영향 분석이 등록됨","승인 버전이 적용되고 감사 기록이 남음"}
        };
        for(Object[] p:processes){
            String code=(String)p[0];
            jdbc.update("insert into framework_process_definition(process_code,process_name,domain_code,goal,start_condition,completion_condition) values(?,?,?,?,?,?) on conflict(process_code) do update set process_name=excluded.process_name,domain_code=excluded.domain_code,goal=excluded.goal,start_condition=excluded.start_condition,completion_condition=excluded.completion_condition,updated_at=current_timestamp",p);
            // EMISSION_PROJECT has a reference-backed seven-stage contract installed by Flyway.
            if(!"EMISSION_PROJECT".equals(code)) { seedSteps(code); seedCases(code); }
        }
        return Map.of("success",true,"actors",jdbc.queryForObject("select count(*) from framework_actor_definition",Integer.class),"processes",processes.length,"steps",processes.length*4,"cases",processes.length*5);
    }

    private void seedSteps(String process){
        String[][] template={
            {"01_PLAN","계획·범위 확정","COMPANY_MANAGER","DRAFT","PLAN","PLANNED","책임자·기간·범위가 지정됨"},
            {"02_WORK","자료 입력·업무 수행","SITE_DATA_OWNER","PLANNED","WORK","SUBMITTED","필수 입력과 증빙이 제출됨"},
            {"03_VERIFY","검증·보완","VERIFIER","SUBMITTED","VERIFY","VERIFIED","오류가 없고 검증 근거가 남음"},
            {"04_APPROVE","승인·확정","APPROVER","VERIFIED","APPROVE","COMPLETED","승인 이력과 최종 결과가 확정됨"}
        };
        for(int i=0;i<template.length;i++){String[] s=template[i];jdbc.update("insert into framework_process_step(process_code,step_order,step_code,step_name,actor_code,from_state,command_code,to_state,completion_rule) values(?,?,?,?,?,?,?,?,?) on conflict(process_code,step_code) do update set step_order=excluded.step_order,step_name=excluded.step_name,actor_code=excluded.actor_code,from_state=excluded.from_state,command_code=excluded.command_code,to_state=excluded.to_state,completion_rule=excluded.completion_rule",process,i+1,process+"_"+s[0],s[1],s[2],s[3],s[4],s[5],s[6]);}
    }
    private void seedCases(String process){
        String[][] cases={{"HAPPY","정상 완료","HAPPY_PATH"},{"AUTH","권한 없는 액션 차단","AUTHORITY"},{"ISOLATION","테넌트·프로젝트 데이터 격리","ISOLATION"},{"EXCEPTION","필수 데이터 누락과 보완","EXCEPTION"},{"RECOVERY","실패 후 재처리·복구","RECOVERY"}};
        for(String[] c:cases){String code=process+"_"+c[0];jdbc.update("insert into framework_simulation_case(case_code,process_code,case_name,case_type,preconditions,steps_json,assertions_json) values(?,?,?,?,?,?,?) on conflict(case_code) do update set case_name=excluded.case_name,case_type=excluded.case_type,preconditions=excluded.preconditions,steps_json=excluded.steps_json,assertions_json=excluded.assertions_json,updated_at=current_timestamp",code,process,c[1],c[2],"테스트용 테넌트·프로젝트·액터 계정이 준비되어야 함","[]","[\"권한·상태·데이터격리·감사로그 검증\"]");}
    }
    private static String str(Map<String,Object>b,String k){return b.get(k)==null?"":String.valueOf(b.get(k)).trim();}
    private static String req(Map<String,Object>b,String k){String v=str(b,k);if(v.isEmpty())throw new IllegalArgumentException(k+" is required");return v;}
    private static String def(Map<String,Object>b,String k,String d){String v=str(b,k);return v.isEmpty()?d:v;}
    private static boolean bool(Map<String,Object>b,String k){return Boolean.parseBoolean(str(b,k));}
    private static int integer(Map<String,Object>b,String k){try{return Integer.parseInt(req(b,k));}catch(Exception e){throw new IllegalArgumentException(k+" must be a number");}}
}
