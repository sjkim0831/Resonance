package egovframework.com.platform.governance.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class ActorProcessGovernanceService {
    private final JdbcTemplate jdbc;
    private final ScreenDevelopmentNoteService screenDevelopmentNoteService;

    public Map<String,Object> dashboard() {
        Map<String,Object> out=new LinkedHashMap<>();
        out.put("actors",jdbc.queryForList("select actor_code as \"actorCode\",actor_name as \"actorName\",actor_name_en as \"actorNameEn\",actor_type as \"actorType\",purpose,capability_codes as \"capabilityCodes\",responsibility_text as responsibility,accountability_text as accountability,competency_requirements as competency,conflict_actor_codes as \"conflictActorCodes\",max_concurrent_assignments as \"maxConcurrentAssignments\",review_cycle_days as \"reviewCycleDays\",delegation_allowed as \"delegationAllowed\",use_at as \"useAt\" from framework_actor_definition order by actor_type,actor_code"));
        out.put("assignments",jdbc.queryForList("select assignment_id as \"assignmentId\",account_id as \"accountId\",tenant_id as \"tenantId\",project_id as \"projectId\",actor_code as \"actorCode\",data_scope as \"dataScope\",valid_from as \"validFrom\",valid_until as \"validUntil\",assignment_status as \"status\" from framework_account_actor_assignment order by assignment_id desc limit 200"));
        out.put("processes",jdbc.queryForList("select p.process_code as \"processCode\",p.process_name as \"processName\",p.domain_code as \"domainCode\",p.process_version as \"version\",p.parent_process_code as \"parentProcessCode\",p.process_level as \"processLevel\",p.automation_mode as \"automationMode\",p.development_order as \"developmentOrder\",p.prerequisite_codes as \"prerequisiteCodes\",p.goal,p.start_condition as \"startCondition\",p.completion_condition as \"completionCondition\",p.process_status as \"status\",count(distinct s.step_id) as \"stepCount\",count(distinct c.case_code) as \"caseCount\",count(distinct c.case_code) filter(where c.case_status='APPROVED') as \"approvedCaseCount\",count(distinct r.run_id) filter(where r.result='PASSED') as \"passedRuns\",(select count(*) from framework_process_artifact a where a.process_code=p.process_code and a.required) as \"artifactCount\",(select count(*) from framework_process_artifact a where a.process_code=p.process_code and a.required and a.delivery_status='VERIFIED') as \"verifiedArtifactCount\" from framework_process_definition p left join framework_process_step s on s.process_code=p.process_code left join framework_simulation_case c on c.process_code=p.process_code left join framework_simulation_run r on r.case_code=c.case_code group by p.process_code order by p.development_order,p.process_code"));
        out.put("steps",jdbc.queryForList("select step_id as \"stepId\",process_code as \"processCode\",step_order as \"stepOrder\",step_code as \"stepCode\",step_name as \"stepName\",parent_step_code as \"parentStepCode\",step_type as \"stepType\",actor_code as \"actorCode\",from_state as \"fromState\",command_code as \"commandCode\",to_state as \"toState\",completion_rule as \"completionRule\",requirement_text as \"requirementText\",input_contract as \"inputContract\",output_contract as \"outputContract\",requires_user_page as \"requiresUserPage\",requires_admin_page as \"requiresAdminPage\",requires_api as \"requiresApi\",requires_database as \"requiresDatabase\",requires_notification as \"requiresNotification\",automation_status as \"automationStatus\",user_path as \"userPath\",admin_path as \"adminPath\",api_contract as \"apiContract\" from framework_process_step order by process_code,step_order"));
        out.put("cases",jdbc.queryForList("select case_code as \"caseCode\",process_code as \"processCode\",case_name as \"caseName\",case_type as \"caseType\",preconditions,steps_json as \"stepsJson\",assertions_json as \"assertionsJson\",case_status as \"status\" from framework_simulation_case order by process_code,case_code"));
        out.put("runs",jdbc.queryForList("select run_id as \"runId\",case_code as \"caseCode\",process_version as \"processVersion\",result,failure_reason as \"failureReason\",executed_by as \"executedBy\",executed_at as \"executedAt\" from framework_simulation_run order by run_id desc limit 100"));
        out.put("artifacts",jdbc.queryForList("select artifact_id as \"artifactId\",process_code as \"processCode\",step_code as \"stepCode\",artifact_code as \"artifactCode\",artifact_type as \"artifactType\",artifact_name as \"artifactName\",target_path as \"targetPath\",contract_ref as \"contractRef\",required,delivery_status as \"status\",owner_actor_code as \"ownerActorCode\",acceptance_criteria as \"acceptanceCriteria\",evidence_ref as \"evidenceRef\",notes from framework_process_artifact order by process_code,artifact_type,artifact_code"));
        out.put("developmentRules",jdbc.queryForList("select rule_code as \"ruleCode\",rule_group as \"ruleGroup\",rule_name as \"ruleName\",rule_description as \"ruleDescription\",verification_method as \"verificationMethod\",source_ref as \"sourceRef\",mandatory from framework_development_rule where use_at='Y' order by rule_group,rule_code"));
        out.put("developmentJobs",jdbc.queryForList("select job_id as \"jobId\",process_code as \"processCode\",step_code as \"stepCode\",job_type as \"jobType\",job_name as \"jobName\",target_path as \"targetPath\",job_status as \"jobStatus\",approval_status as \"approvalStatus\",execution_mode as \"executionMode\",job_group_code as \"jobGroupCode\",required,progress_weight as \"progressWeight\",max_attempts as \"maxAttempts\",quality_status as \"qualityStatus\",quality_report as \"qualityReport\",search_context_ref as \"searchContextRef\",worker_id as \"workerId\",lease_until as \"leaseUntil\",attempt_count as \"attemptCount\",evidence_ref as \"evidenceRef\",rollback_ref as \"rollbackRef\",last_error as \"lastError\",created_at as \"createdAt\" from framework_development_job order by process_code,step_code,job_id"));
        out.put("jobDependencies",jdbc.queryForList("select d.job_id as \"jobId\",d.depends_on_job_id as \"dependsOnJobId\",d.dependency_type as \"dependencyType\",j.job_name as \"jobName\",p.job_name as \"dependsOnJobName\",p.job_status as \"dependsOnStatus\" from framework_development_job_dependency d join framework_development_job j on j.job_id=d.job_id join framework_development_job p on p.job_id=d.depends_on_job_id order by d.job_id,d.depends_on_job_id"));
        out.put("qualityGates",jdbc.queryForList("select gate_code as \"gateCode\",gate_name as \"gateName\",gate_group as \"gateScope\",mandatory,verification_command as \"verificationCommand\" from framework_quality_gate where use_at='Y' order by gate_group,gate_code"));
        out.put("qualityGateResults",jdbc.queryForList("select result_id as \"resultId\",job_id as \"jobId\",gate_code as \"gateCode\",result,summary,evidence_ref as \"evidenceRef\",checked_at as \"executedAt\" from framework_development_job_gate_result order by result_id desc limit 300"));
        out.put("processDevelopmentProgress",jdbc.queryForList("select process_code as \"processCode\",required_jobs as \"requiredJobs\",verified_jobs as \"verifiedJobs\",failed_jobs as \"failedJobs\",parallel_jobs as \"parallelJobs\",completion_percent as \"completionPercent\" from framework_process_development_progress order by process_code"));
        out.put("developmentEvents",jdbc.queryForList("select e.event_id as \"eventId\",e.job_id as \"jobId\",e.event_type as \"eventType\",e.from_status as \"fromStatus\",e.to_status as \"toStatus\",e.worker_id as \"workerId\",e.created_at as \"createdAt\" from framework_development_job_event e order by e.event_id desc limit 200"));
        out.put("screenDevelopmentGates",jdbc.queryForList("select gate_run_id as \"gateRunId\",process_code as \"processCode\",step_code as \"stepCode\",route_path as \"routePath\",page_id as \"pageId\",gate_status as \"gateStatus\",readiness_score as \"readinessScore\",design_note_passed as \"designNotePassed\",selected_mockup_passed as \"selectedMockupPassed\",actor_contract_passed as \"actorContractPassed\",safety_tests_passed as \"safetyTestsPassed\",design_asset_checked as \"designAssetChecked\",failure_summary as \"failureSummary\",executed_by as \"executedBy\",executed_at as \"executedAt\" from framework_screen_development_gate_run order by gate_run_id desc limit 300"));
        out.put("processExecutions",jdbc.queryForList("select execution_id as \"executionId\",tenant_id as \"tenantId\",project_id as \"projectId\",process_code as \"processCode\",current_step_code as \"currentStepCode\",execution_status as \"executionStatus\",current_state as \"currentState\",initiated_by_actor as \"initiatedByActor\",initiated_by as \"initiatedBy\",started_at as \"startedAt\",completed_at as \"completedAt\" from framework_process_execution order by started_at desc limit 100"));
        out.put("processExecutionEvents",jdbc.queryForList("select event_id as \"eventId\",execution_id as \"executionId\",step_code as \"stepCode\",actor_code as \"actorCode\",command_code as \"commandCode\",from_state as \"fromState\",to_state as \"toState\",idempotency_key as \"idempotencyKey\",executed_by as \"executedBy\",executed_at as \"executedAt\" from framework_process_execution_event order by event_id desc limit 300"));
        out.put("screenTypes",jdbc.queryForList("select screen_type as \"screenType\",screen_type_name as \"screenTypeName\",required_sections as \"requiredSections\",default_test_expectations as \"testExpectations\",development_weight as \"developmentWeight\" from framework_screen_type where use_at='Y' order by screen_type"));
        out.put("referenceSummary",jdbc.queryForMap("select count(*) as \"assetCount\",count(distinct process_code) as \"mappedProcesses\",count(*) filter(where analysis_status='ANALYZED') as \"analyzedCount\",coalesce(round(avg(confidence),1),0) as \"averageConfidence\" from framework_reference_asset"));
        out.put("referenceAssets",jdbc.queryForList("select reference_id as \"referenceId\",source_name as \"sourceName\",source_type as \"sourceType\",domain_code as \"domainCode\",screen_type as \"screenType\",process_code as \"processCode\",analysis_status as \"analysisStatus\",confidence from framework_reference_asset order by reference_id desc limit 300"));
        out.put("automationMetrics",jdbc.queryForList("select metric_type as \"metricType\",metric_value as \"metricValue\",sample_count as \"sampleCount\",measured_at as \"measuredAt\" from framework_automation_metric order by metric_id desc limit 50"));
        out.put("screenBlueprints",jdbc.queryForList("select blueprint_id as \"blueprintId\",blueprint_code as \"blueprintCode\",process_code as \"processCode\",step_code as \"stepCode\",actor_code as \"actorCode\",audience,page_id as \"pageId\",page_name as \"pageName\",route_path as \"routePath\",screen_type as \"screenType\",template_code as \"templateCode\",implementation_strategy as \"implementationStrategy\",transition_status as \"transitionStatus\",validation_status as \"validationStatus\",validation_message as \"validationMessage\" from framework_screen_blueprint order by blueprint_id desc limit 1000"));
        out.put("generationBatches",jdbc.queryForList("select batch_id as \"batchId\",batch_code as \"batchCode\",batch_name as \"batchName\",process_code as \"processCode\",requested_count as \"requestedCount\",compiled_count as \"compiledCount\",valid_count as \"validCount\",invalid_count as \"invalidCount\",queued_count as \"queuedCount\",batch_status as \"batchStatus\",dry_run as \"dryRun\",requested_by as \"requestedBy\",created_at as \"createdAt\",completed_at as \"completedAt\" from framework_screen_generation_batch order by batch_id desc limit 30"));
        out.put("professionalReadiness",jdbc.queryForList("select process_code as \"processCode\",process_name as \"processName\",lifecycle_status as \"lifecycleStatus\",risk_level as \"riskLevel\",readiness_score as \"readinessScore\",readiness_gaps as \"readinessGaps\",step_count as \"stepCount\",scenario_type_count as \"scenarioTypeCount\",approved_case_count as \"approvedCaseCount\",case_count as \"caseCount\" from framework_process_professional_readiness order by readiness_score,process_code"));
        out.put("professionalSummary",jdbc.queryForMap("select count(*) as \"totalProcesses\",count(*) filter(where readiness_score=100) as \"expertReadyProcesses\",count(*) filter(where readiness_score<80) as \"highRiskProcesses\",coalesce(round(avg(readiness_score),1),0) as \"averageScore\" from framework_process_professional_readiness"));
        out.put("professionalScreenContracts",jdbc.queryForList("select contract_id as \"contractId\",process_code as \"processCode\",step_code as \"stepCode\",audience,route_path as \"routePath\",screen_name as \"screenName\",actor_code as \"actorCode\",business_purpose as \"businessPurpose\",entry_condition as \"entryCondition\",exit_condition as \"exitCondition\",kpi_contract as \"kpiContract\",section_contract as \"sectionContract\",field_contract as \"fieldContract\",command_contract as \"commandContract\",state_contract as \"stateContract\",api_contract as \"apiContract\",data_contract as \"dataContract\",evidence_contract as \"evidenceContract\",api_verified as \"apiVerified\",database_verified as \"databaseVerified\",authority_verified as \"authorityVerified\",responsive_verified as \"responsiveVerified\",accessibility_verified as \"accessibilityVerified\",exception_states_verified as \"exceptionStatesVerified\",audit_evidence_ref as \"auditEvidenceRef\",contract_status as \"contractStatus\",readiness_score as \"readinessScore\",readiness_gaps as \"readinessGaps\" from framework_professional_screen_readiness order by process_code,step_code,audience"));
        out.put("professionalScreenSummary",jdbc.queryForMap("select count(*) as \"totalScreens\",count(*) filter(where readiness_score=100) as \"completeScreens\",count(*) filter(where readiness_score<100) as \"blockedScreens\",coalesce(round(avg(readiness_score),1),0) as \"averageScore\" from framework_professional_screen_readiness"));
        out.put("summary",jdbc.queryForMap("select count(*) as \"processCount\",count(*) filter(where process_status='DEVELOPMENT_READY') as \"readyCount\",count(*) filter(where process_status<>'DEVELOPMENT_READY') as \"draftCount\",coalesce(round(100.0*count(*) filter(where process_status='DEVELOPMENT_READY')/nullif(count(*),0)),0) as \"readinessPercent\" from framework_process_definition"));
        return out;
    }

    @Transactional public Map<String,Object> saveProfessionalScreenContract(Map<String,Object>b,String actor){
        long id=Long.parseLong(req(b,"contractId"));
        int updated=jdbc.update("update framework_professional_screen_contract set business_purpose=?,entry_condition=?,exit_condition=?,kpi_contract=?,section_contract=?,field_contract=?,command_contract=?,state_contract=?,api_contract=?,data_contract=?,evidence_contract=?,responsive_contract=?,accessibility_contract=?,security_contract=?,api_verified=?,database_verified=?,authority_verified=?,responsive_verified=?,accessibility_verified=?,exception_states_verified=?,audit_evidence_ref=?,contract_status=?,updated_by=?,updated_at=current_timestamp where contract_id=?",
            req(b,"businessPurpose"),req(b,"entryCondition"),req(b,"exitCondition"),def(b,"kpiContract","[]"),def(b,"sectionContract","[]"),def(b,"fieldContract","[]"),def(b,"commandContract","[]"),def(b,"stateContract","[\"LOADING\",\"EMPTY\",\"ERROR\",\"FORBIDDEN\",\"READY\"]"),def(b,"apiContract","[]"),def(b,"dataContract","[]"),def(b,"evidenceContract","[]"),def(b,"responsiveContract","360px, 768px, 1280px 검증"),def(b,"accessibilityContract","KRDS 및 WCAG 2.1 AA"),def(b,"securityContract","테넌트·프로젝트·액터 권한 서버 검증"),bool(b,"apiVerified"),bool(b,"databaseVerified"),bool(b,"authorityVerified"),bool(b,"responsiveVerified"),bool(b,"accessibilityVerified"),bool(b,"exceptionStatesVerified"),str(b,"auditEvidenceRef"),def(b,"contractStatus","REVIEW_REQUIRED"),actor,id);
        if(updated==0)throw new IllegalArgumentException("화면 완성 계약을 찾을 수 없습니다: "+id);
        Map<String,Object> readiness=jdbc.queryForMap("select contract_id as \"contractId\",readiness_score as \"readinessScore\",readiness_gaps as \"readinessGaps\" from framework_professional_screen_readiness where contract_id=?",id);
        if(((Number)readiness.get("readinessScore")).intValue()==100){jdbc.update("update framework_professional_screen_contract set contract_status='VERIFIED',updated_at=current_timestamp where contract_id=?",id);}
        return Map.of("success",true,"contract",readiness);
    }

    public Map<String,Object> designAssetInventory(){
        Map<String,Object> out=new LinkedHashMap<>();
        out.put("counts",jdbc.queryForMap("select (select count(*) from comtnthemedefinition where use_at='Y') as \"themes\",(select count(*) from comtnthemeclassset where use_at='Y') as \"classSets\",(select count(*) from ui_section_registry where active_yn='Y') as \"sections\",(select count(*) from ui_component_registry where active_yn='Y') as \"components\",(select count(*) from ui_page_manifest where active_yn='Y') as \"pages\",(select count(*) from ui_page_component_map) as \"mappings\""));
        out.put("themes",jdbc.queryForList("select theme_id as \"themeId\",theme_nm as \"themeName\",theme_type as \"themeType\",is_default as \"isDefault\",is_active as \"isActive\" from comtnthemedefinition where use_at='Y' order by sort_order,theme_id"));
        out.put("sections",jdbc.queryForList("select section_id as \"sectionId\",section_name as \"sectionName\",section_type as \"sectionType\",layout_contract as \"layoutContract\",responsive_contract as \"responsiveContract\",accessibility_contract as \"accessibilityContract\",design_reference as \"designReference\" from ui_section_registry where active_yn='Y' order by section_type,section_id"));
        out.put("components",jdbc.queryForList("select component_id as \"componentId\",component_name as \"componentName\",component_type as \"componentType\",owner_domain as \"ownerDomain\",design_reference as \"designReference\",asset_fingerprint as \"fingerprint\" from ui_component_registry where active_yn='Y' order by component_type,component_name limit 500"));
        out.put("duplicates",jdbc.queryForList("select asset_fingerprint as fingerprint,count(*) as count,string_agg(component_id,', ' order by component_id) as \"componentIds\" from ui_component_registry where active_yn='Y' and asset_fingerprint is not null group by asset_fingerprint having count(*)>1 order by count(*) desc"));
        out.put("recentPreflights",jdbc.queryForList("select preflight_id as \"preflightId\",page_id as \"pageId\",route_path as \"routePath\",theme_id as \"themeId\",section_id as \"sectionId\",component_id as \"componentId\",decision,executed_by as \"executedBy\",executed_at as \"executedAt\" from framework_design_preflight order by preflight_id desc limit 50"));
        return out;
    }

    @Transactional public Map<String,Object> runDesignPreflight(Map<String,Object>b,String actor){
        String pageId=req(b,"pageId"),route=req(b,"routePath"),pageName=req(b,"pageName"),domain=def(b,"domainCode","COMMON");
        String themeId=def(b,"themeId","KRDS_GOV_DEFAULT"),sectionId=req(b,"sectionId"),componentName=req(b,"componentName"),componentType=req(b,"componentType");
        Integer themeCount=jdbc.queryForObject("select count(*) from comtnthemedefinition where theme_id=? and use_at='Y' and is_active='Y'",Integer.class,themeId);
        if(themeCount==null||themeCount==0)throw new IllegalArgumentException("활성 테마가 존재하지 않습니다: "+themeId);
        Integer sectionCount=jdbc.queryForObject("select count(*) from ui_section_registry where section_id=? and active_yn='Y'",Integer.class,sectionId);
        if(sectionCount==null||sectionCount==0)throw new IllegalArgumentException("등록된 섹션을 먼저 선택해야 합니다: "+sectionId);
        String props=def(b,"propsSchema","{}"),designRef=def(b,"designReference",themeId);
        String fingerprint=jdbc.queryForObject("select md5(lower(trim(?))||'|'||lower(trim(?))||'|'||?||'|'||?)",String.class,componentType,componentName,props,designRef);
        jdbc.query("select pg_advisory_xact_lock(hashtext(?))",rs->{},fingerprint);
        List<Map<String,Object>> matches=jdbc.queryForList("select component_id as \"componentId\" from ui_component_registry where active_yn='Y' and asset_fingerprint=? order by component_id limit 1",fingerprint);
        String componentId,decision;
        if(matches.isEmpty()){
            componentId="CMP_"+fingerprint.substring(0,12).toUpperCase(); decision="CREATED";
            jdbc.update("insert into ui_component_registry(component_id,component_name,component_type,owner_domain,props_schema_json,design_reference,active_yn,category,default_props,asset_fingerprint,created_at,updated_at) values(?,?,?,?,?,?,'Y',?,?,?,current_timestamp,current_timestamp)",componentId,componentName,componentType,domain,props,designRef,def(b,"category","COMMON"),props,fingerprint);
        }else{componentId=String.valueOf(matches.get(0).get("componentId"));decision="REUSED";}
        jdbc.update("insert into ui_page_manifest(page_id,page_name,route_path,domain_code,layout_version,design_token_version,active_yn,created_at,updated_at,page_title,page_url,version_status) values(?,?,?,?,'1.0.0',?,'Y',current_timestamp,current_timestamp,?,?, 'DRAFT') on conflict(page_id) do update set page_name=excluded.page_name,route_path=excluded.route_path,domain_code=excluded.domain_code,design_token_version=excluded.design_token_version,active_yn='Y',updated_at=current_timestamp",pageId,pageName,route,domain,themeId,pageName,route);
        Integer mappingCount=jdbc.queryForObject("select count(*) from ui_page_component_map where page_id=? and component_id=? and layout_zone=?",Integer.class,pageId,componentId,sectionId);
        if(mappingCount==null||mappingCount==0) jdbc.update("insert into ui_page_component_map(map_id,page_id,layout_zone,component_id,instance_key,display_order,conditional_rule_summary,created_at,updated_at) values(?,?,?,?,?,coalesce((select max(display_order)+1 from ui_page_component_map where page_id=?),1),?,current_timestamp,current_timestamp)","MAP_"+pageId.replaceAll("[^A-Za-z0-9]","")+"_"+componentId,pageId,sectionId,componentId,pageId+"_"+componentId,pageId,"design-preflight");
        jdbc.update("insert into framework_design_preflight(page_id,route_path,theme_id,section_id,component_id,decision,asset_fingerprint,evidence_json,executed_by) values(?,?,?,?,?,?,?,?,?)",pageId,route,themeId,sectionId,componentId,decision,fingerprint,"{\"themeVerified\":true,\"sectionVerified\":true,\"componentMatched\":true}",actor);
        return Map.of("success",true,"decision",decision,"componentId",componentId,"fingerprint",fingerprint,"pageId",pageId,"sectionId",sectionId,"themeId",themeId);
    }

    @Transactional public void createActor(Map<String,Object>b){
        jdbc.update("insert into framework_actor_definition(actor_code,actor_name,actor_name_en,actor_type,purpose,capability_codes,delegation_allowed) values(?,?,?,?,?,?,?) on conflict(actor_code) do update set actor_name=excluded.actor_name,actor_name_en=excluded.actor_name_en,actor_type=excluded.actor_type,purpose=excluded.purpose,capability_codes=excluded.capability_codes,delegation_allowed=excluded.delegation_allowed,updated_at=current_timestamp",req(b,"actorCode"),req(b,"actorName"),str(b,"actorNameEn"),def(b,"actorType","BUSINESS"),req(b,"purpose"),str(b,"capabilityCodes"),bool(b,"delegationAllowed"));
    }
    @Transactional public void assignActor(Map<String,Object>b){
        jdbc.update("insert into framework_account_actor_assignment(account_id,tenant_id,project_id,actor_code,data_scope,valid_until) values(?,?,?,?,?,nullif(?,'')::date) on conflict(account_id,tenant_id,project_id,actor_code) do update set data_scope=excluded.data_scope,valid_until=excluded.valid_until,assignment_status='ACTIVE'",req(b,"accountId"),def(b,"tenantId","DEFAULT"),def(b,"projectId","*"),req(b,"actorCode"),def(b,"dataScope","*"),str(b,"validUntil"));
    }
    @Transactional public void createProcess(Map<String,Object>b){
        jdbc.update("insert into framework_process_definition(process_code,process_name,domain_code,process_version,goal,start_condition,completion_condition,parent_process_code,process_level,automation_mode) values(?,?,?,?,?,?,?,nullif(?,''),?,?) on conflict(process_code) do update set process_name=excluded.process_name,domain_code=excluded.domain_code,process_version=excluded.process_version,goal=excluded.goal,start_condition=excluded.start_condition,completion_condition=excluded.completion_condition,parent_process_code=excluded.parent_process_code,process_level=excluded.process_level,automation_mode=excluded.automation_mode,updated_at=current_timestamp",req(b,"processCode"),req(b,"processName"),req(b,"domainCode"),def(b,"version","1.0.0"),req(b,"goal"),req(b,"startCondition"),req(b,"completionCondition"),str(b,"parentProcessCode"),integerOr(b,"processLevel",str(b,"parentProcessCode").isEmpty()?1:2),def(b,"automationMode","ASSISTED"));
    }
    @Transactional public Map<String,Object> addStep(Map<String,Object>b,String actor){
        String process=req(b,"processCode"),step=req(b,"stepCode"); int order=integer(b,"stepOrder");
        Integer exists=jdbc.queryForObject("select count(*) from framework_process_step where process_code=? and step_code=?",Integer.class,process,step);
        if(exists==null||exists==0){
            jdbc.update("update framework_process_step set step_order=step_order+10000 where process_code=? and step_order>=?",process,order);
            jdbc.update("update framework_process_step set step_order=step_order-9999 where process_code=? and step_order>=?",process,order+10000);
        }
        jdbc.update("insert into framework_process_step(process_code,step_order,step_code,step_name,parent_step_code,step_type,actor_code,from_state,command_code,to_state,completion_rule,requirement_text,input_contract,output_contract,requires_user_page,requires_admin_page,requires_api,requires_database,requires_notification,user_path,admin_path,api_contract,automation_status) values(?,?,?,?,nullif(?,''),?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'PLANNED') on conflict(process_code,step_code) do update set step_name=excluded.step_name,parent_step_code=excluded.parent_step_code,step_type=excluded.step_type,actor_code=excluded.actor_code,from_state=excluded.from_state,command_code=excluded.command_code,to_state=excluded.to_state,completion_rule=excluded.completion_rule,requirement_text=excluded.requirement_text,input_contract=excluded.input_contract,output_contract=excluded.output_contract,requires_user_page=excluded.requires_user_page,requires_admin_page=excluded.requires_admin_page,requires_api=excluded.requires_api,requires_database=excluded.requires_database,requires_notification=excluded.requires_notification,user_path=excluded.user_path,admin_path=excluded.admin_path,api_contract=excluded.api_contract,automation_status='PLANNED'",process,order,step,req(b,"stepName"),str(b,"parentStepCode"),def(b,"stepType","TASK"),req(b,"actorCode"),req(b,"fromState"),req(b,"commandCode"),req(b,"toState"),req(b,"completionRule"),def(b,"requirementText",req(b,"completionRule")),def(b,"inputContract","{}"),def(b,"outputContract","{}"),bool(b,"requiresUserPage"),bool(b,"requiresAdminPage"),bool(b,"requiresApi"),bool(b,"requiresDatabase"),bool(b,"requiresNotification"),str(b,"userPath"),str(b,"adminPath"),str(b,"apiContract"));
        Map<String,Object> plan=generateDevelopmentPlan(process,step,actor);
        return Map.of("success",true,"processCode",process,"stepCode",step,"generatedJobs",plan.get("generatedJobs"));
    }

    @Transactional public Map<String,Object> generateDevelopmentPlan(String process,String step,String actor){
        Map<String,Object>s=jdbc.queryForMap("select * from framework_process_step where process_code=? and step_code=?",process,step);
        String base=process+"_"+step, requirement=String.valueOf(s.get("requirement_text")); int created=0;
        if(Boolean.TRUE.equals(s.get("requires_database"))) created+=queueJob(process,step,"DATABASE","DB 스키마·Flyway 마이그레이션", "db/migration/"+base.toLowerCase(),requirement,actor);
        if(Boolean.TRUE.equals(s.get("requires_api"))) { created+=queueJob(process,step,"API","API 계약·컨트롤러",String.valueOf(s.get("api_contract")),requirement,actor); created+=queueJob(process,step,"BACKEND","트랜잭션·권한·감사 서비스", "backend/"+base.toLowerCase(),requirement,actor); }
        if(Boolean.TRUE.equals(s.get("requires_user_page"))) created+=queueJob(process,step,"FRONTEND_USER","사용자 업무 화면",String.valueOf(s.get("user_path")),requirement,actor);
        if(Boolean.TRUE.equals(s.get("requires_admin_page"))) created+=queueJob(process,step,"FRONTEND_ADMIN","대응 관리자 화면",String.valueOf(s.get("admin_path")),requirement,actor);
        if(Boolean.TRUE.equals(s.get("requires_notification"))) created+=queueJob(process,step,"NOTIFICATION","알림·마감 정책", "notification/"+base.toLowerCase(),requirement,actor);
        created+=queueJob(process,step,"TEST","정상·예외·권한·격리·복구 테스트", "test/"+base.toLowerCase(),requirement,actor);
        created+=queueJob(process,step,"INTEGRATION","메뉴·권한·다국어·배포 통합", "integration/"+base.toLowerCase(),requirement,actor);
        jdbc.update("update framework_process_step set automation_status='PLANNED' where process_code=? and step_code=?",process,step);
        return Map.of("success",true,"generatedJobs",created,"processCode",process,"stepCode",step);
    }

    /**
     * Makes one process development-ready in a single transaction: safety scenarios,
     * implementation jobs, approvals, and screen blueprints are kept in sync.
     */
    @Transactional public Map<String,Object> bootstrapProcessDevelopment(Map<String,Object>b,String actor){
        String process=req(b,"processCode");
        boolean approve=!"false".equalsIgnoreCase(str(b,"approveJobs"));
        boolean queue=!"false".equalsIgnoreCase(str(b,"queueScreens"));
        Integer processCount=jdbc.queryForObject("select count(*) from framework_process_definition where process_code=?",Integer.class,process);
        if(processCount==null||processCount==0)throw new IllegalArgumentException("프로세스를 찾을 수 없습니다: "+process);

        String[][] scenarios={
            {"HAPPY","정상 업무 완료","HAPPY_PATH","담당 액터와 프로젝트 데이터가 준비됨","[\"순서대로 업무 수행\",\"완료 조건 검증\",\"다음 업무 개방\"]","[\"최종 상태가 완료됨\",\"필수 산출물과 감사 이력이 존재함\"]"},
            {"AUTH","권한 없는 작업 차단","AUTHORITY","서로 다른 역할의 계정이 준비됨","[\"권한 없는 액션 시도\",\"담당 액터의 정상 액션 수행\"]","[\"비인가 액션은 차단됨\",\"거부 시도가 감사 기록에 남음\"]"},
            {"ISOLATION","테넌트·프로젝트 데이터 격리","ISOLATION","서로 다른 테넌트와 프로젝트가 준비됨","[\"교차 조회와 수정을 시도\",\"자기 프로젝트를 조회\"]","[\"교차 접근은 403 또는 404\",\"자기 프로젝트 데이터만 반환됨\"]"},
            {"EXCEPTION","필수 데이터 누락과 보완","EXCEPTION","필수 입력이 누락된 업무가 준비됨","[\"불완전 데이터 제출\",\"보완 요청\",\"재제출\"]","[\"불완전 제출은 확정되지 않음\",\"보완 후 다음 단계가 개방됨\"]"},
            {"RECOVERY","실패 후 안전한 재처리","RECOVERY","중간 단계 실패를 재현할 수 있음","[\"처리 실패\",\"동일 요청 재시도\",\"복구 결과 확인\"]","[\"중복 데이터가 생성되지 않음\",\"실패 원인과 복구 이력이 보존됨\"]"}
        };
        for(String[]s:scenarios){
            jdbc.update("insert into framework_simulation_case(case_code,process_code,case_name,case_type,preconditions,steps_json,assertions_json,case_status) values(?,?,?,?,?,?,?,'READY') on conflict(case_code) do update set case_name=excluded.case_name,case_type=excluded.case_type,preconditions=excluded.preconditions,steps_json=excluded.steps_json,assertions_json=excluded.assertions_json,case_status=case when framework_simulation_case.case_status='APPROVED' then 'APPROVED' else 'READY' end,updated_at=current_timestamp",process+"_"+s[0],process,s[1],s[2],s[3],s[4],s[5]);
        }

        List<Map<String,Object>> steps=jdbc.queryForList("select step_code from framework_process_step where process_code=? order by step_order",process);
        if(steps.isEmpty())throw new IllegalStateException("프로세스 단계가 정의되지 않았습니다: "+process);
        int generated=0,approved=0;
        for(Map<String,Object>row:steps){
            String step=String.valueOf(row.get("step_code"));
            generated+=((Number)generateDevelopmentPlan(process,step,actor).get("generatedJobs")).intValue();
        }
        Map<String,Object> compiled=compileScreenBlueprints(Map.of("processCode",process,"maxScreens",200,"dryRun",false),actor);
        long batchId=((Number)compiled.get("batchId")).longValue();
        int queued=0;
        if(queue&&((Number)compiled.get("valid")).intValue()>0){
            queued=((Number)queueScreenGeneration(batchId,actor).get("queued")).intValue();
        }
        List<Map<String,Object>> blockedSteps=new java.util.ArrayList<>();
        if(approve){
            for(Map<String,Object>row:steps){
                String step=String.valueOf(row.get("step_code"));
                Map<String,Object> preflight=runScreenDevelopmentPreflight(process,step,actor);
                if(Boolean.TRUE.equals(preflight.get("passed"))){
                    int count=jdbc.update("update framework_development_job set approval_status='APPROVED',updated_at=current_timestamp where process_code=? and step_code=? and job_status='PLANNED'",process,step);
                    jdbc.update("update framework_process_step set automation_status='APPROVED' where process_code=? and step_code=?",process,step);
                    approved+=count;
                }else{
                    Map<String,Object> blocked=new LinkedHashMap<>();
                    blocked.put("stepCode",step);
                    blocked.put("failureSummary",preflight.get("failureSummary"));
                    blocked.put("checkedRoutes",preflight.get("checkedRoutes"));
                    blockedSteps.add(blocked);
                    jdbc.update("update framework_process_step set automation_status='PLANNED' where process_code=? and step_code=?",process,step);
                }
            }
        }
        jdbc.update("update framework_process_definition set process_status='IN_DEVELOPMENT',automation_mode='AUTOMATIC',updated_at=current_timestamp where process_code=? and process_status<>'DEVELOPMENT_READY'",process);
        Integer totalJobs=jdbc.queryForObject("select count(*) from framework_development_job where process_code=?",Integer.class,process);
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("success",true);result.put("processCode",process);result.put("stepCount",steps.size());
        result.put("scenarioCount",scenarios.length);result.put("generatedJobs",generated);result.put("approvedJobs",approved);
        result.put("totalJobs",totalJobs==null?0:totalJobs);result.put("batchId",batchId);
        result.put("compiledScreens",compiled.get("compiled"));result.put("validScreens",compiled.get("valid"));
        result.put("queuedScreens",queued);result.put("blockedStepCount",blockedSteps.size());result.put("blockedSteps",blockedSteps);
        result.put("factoryStatus",blockedSteps.isEmpty()?"READY_TO_EXECUTE":"DESIGN_REQUIRED");
        result.put("nextAction",blockedSteps.isEmpty()?"승인된 개발 작업을 실행기에 배정하십시오.":"차단 단계의 화면 설계·선택 HTML 시안을 보강한 뒤 자동 준비를 다시 실행하십시오.");
        return result;
    }

    @Transactional public Map<String,Object> approveDevelopmentPlan(String process,String step,String actor){
        Map<String,Object> preflight=runScreenDevelopmentPreflight(process,step,actor);
        if(!Boolean.TRUE.equals(preflight.get("passed")))throw new IllegalStateException("화면 개발 사전검사를 통과해야 승인할 수 있습니다: "+preflight.get("failureSummary"));
        int count=jdbc.update("update framework_development_job set approval_status='APPROVED',updated_at=current_timestamp where process_code=? and step_code=? and job_status='PLANNED'",process,step);
        jdbc.update("update framework_process_step set automation_status='APPROVED' where process_code=? and step_code=?",process,step);
        return Map.of("success",true,"approvedJobs",count,"approvedBy",actor);
    }

    @Transactional public Map<String,Object> runScreenDevelopmentPreflight(String process,String step,String actor){
        Integer stepCount=jdbc.queryForObject("select count(*) from framework_process_step where process_code=? and step_code=?",Integer.class,process,step);
        if(stepCount==null||stepCount==0)throw new IllegalArgumentException("프로세스에 해당 절차가 존재하지 않습니다: "+process+" / "+step);
        List<Map<String,Object>> jobs=jdbc.queryForList("select min(job_id) as job_id,min(job_type) as job_type,min(target_path) as target_path from framework_development_job where process_code=? and step_code=? and job_type in ('FRONTEND_USER','FRONTEND_ADMIN') and target_path like '/%' group by lower(split_part(target_path,'?',1)) order by min(job_id)",process,step);
        if(jobs.isEmpty()){
            jobs=jdbc.queryForList("select distinct 0 as job_id,'FRONTEND_USER' as job_type,unnest(array_remove(array[user_path,admin_path],null)) as target_path from framework_process_step where process_code=? and step_code=?",process,step);
        }
        if(jobs.isEmpty())return Map.of("success",true,"passed",true,"checkedRoutes",0,"failureSummary","화면 개발 대상 없음");
        Integer actorCount=jdbc.queryForObject("select count(*) from framework_process_step s join framework_actor_definition a on a.actor_code=s.actor_code and a.use_at='Y' where s.process_code=? and s.step_code=?",Integer.class,process,step);
        Integer safetyTypes=jdbc.queryForObject("select count(distinct case_type) from framework_simulation_case where process_code=? and case_type in ('HAPPY_PATH','EXCEPTION','AUTHORITY','ISOLATION','RECOVERY') and case_status in ('READY','APPROVED')",Integer.class,process);
        boolean actorPassed=actorCount!=null&&actorCount>0,safetyPassed=safetyTypes!=null&&safetyTypes>=5;
        int passedRoutes=0;List<String> failures=new java.util.ArrayList<>();
        for(Map<String,Object> job:jobs){
            String route=String.valueOf(job.get("target_path"));
            Map<String,Object> readiness=screenDevelopmentNoteService.developmentReadiness(route);
            boolean notePassed=Boolean.TRUE.equals(readiness.get("designNotePassed"));
            boolean mockupPassed=Boolean.TRUE.equals(readiness.get("selectedMockupPassed"));
            Integer designAssetCount=jdbc.queryForObject("select count(*) from framework_design_preflight where lower(route_path)=lower(?)",Integer.class,ScreenDevelopmentNoteService.cleanRoute(route));
            boolean designChecked=designAssetCount!=null&&designAssetCount>0;
            Integer professionalScore=jdbc.queryForObject("select coalesce(max(readiness_score),0) from framework_professional_screen_readiness where process_code=? and step_code=? and lower(split_part(route_path,'?',1))=lower(?)",Integer.class,process,step,ScreenDevelopmentNoteService.cleanRoute(route));
            boolean professionalPassed=professionalScore!=null&&professionalScore==100;
            int score=(notePassed?20:0)+(mockupPassed?20:0)+(actorPassed?15:0)+(safetyPassed?15:0)+(professionalPassed?30:0);
            boolean passed=notePassed&&mockupPassed&&actorPassed&&safetyPassed&&professionalPassed;
            List<String> gaps=new java.util.ArrayList<>();
            if(!notePassed)gaps.add("설계·기능·완료 기준");if(!mockupPassed)gaps.add("선택 HTML 시안");if(!actorPassed)gaps.add("액터 계약");if(!safetyPassed)gaps.add("5대 안전 테스트");
            if(!professionalPassed)gaps.add("전문 화면 완성 계약 100점("+(professionalScore==null?0:professionalScore)+"점)");
            String summary=String.join(", ",gaps);
            String detail="{\"designNote\":"+notePassed+",\"selectedMockup\":"+mockupPassed+",\"actorContract\":"+actorPassed+",\"safetyScenarioTypes\":"+(safetyTypes==null?0:safetyTypes)+",\"professionalContractScore\":"+(professionalScore==null?0:professionalScore)+",\"designAssetChecked\":"+designChecked+"}";
            jdbc.update("insert into framework_screen_development_gate_run(process_code,step_code,route_path,page_id,gate_status,readiness_score,design_note_passed,selected_mockup_passed,actor_contract_passed,safety_tests_passed,design_asset_checked,check_result_json,failure_summary,executed_by) values(?,?,?,?,?,?,?,?,?,?,?,?,nullif(?,''),?)",process,step,ScreenDevelopmentNoteService.cleanRoute(route),"",passed?"PASSED":"FAILED",score,notePassed,mockupPassed,actorPassed,safetyPassed,designChecked,detail,summary,actor);
            if(passed)passedRoutes++;else failures.add(ScreenDevelopmentNoteService.cleanRoute(route)+" ["+summary+"]");
        }
        return Map.of("success",true,"passed",passedRoutes==jobs.size(),"checkedRoutes",jobs.size(),"passedRoutes",passedRoutes,"failureSummary",String.join("; ",failures));
    }

    @Transactional public Map<String,Object> startProcessExecution(Map<String,Object>b,String user){
        String tenant=req(b,"tenantId"),project=req(b,"projectId"),process=req(b,"processCode"),actor=req(b,"actorCode");
        List<Map<String,Object>> steps=jdbc.queryForList("select step_code,actor_code,from_state from framework_process_step where process_code=? order by step_order limit 1",process);
        if(steps.isEmpty())throw new IllegalArgumentException("프로세스 단계가 없습니다: "+process);
        Map<String,Object> first=steps.get(0);String requiredActor=String.valueOf(first.get("actor_code"));
        if(!requiredActor.equals(actor))throw new IllegalArgumentException("첫 단계 수행 액터는 "+requiredActor+"입니다.");
        requireActorAssignment(tenant,project,actor);
        List<Map<String,Object>> running=jdbc.queryForList("select execution_id as \"executionId\",current_step_code as \"currentStepCode\",current_state as \"currentState\" from framework_process_execution where tenant_id=? and project_id=? and process_code=? and execution_status='RUNNING'",tenant,project,process);
        if(!running.isEmpty())return Map.of("success",true,"created",false,"execution",running.get(0));
        UUID id=UUID.randomUUID();String step=String.valueOf(first.get("step_code")),state=String.valueOf(first.get("from_state"));
        jdbc.update("insert into framework_process_execution(execution_id,tenant_id,project_id,process_code,current_step_code,current_state,initiated_by_actor,initiated_by) values(?,?,?,?,?,?,?,?)",id,tenant,project,process,step,state,actor,user);
        return Map.of("success",true,"created",true,"executionId",id,"processCode",process,"currentStepCode",step,"currentState",state,"actorCode",actor);
    }

    @Transactional public Map<String,Object> executeProcessCommand(UUID executionId,Map<String,Object>b,String user){
        String tenant=req(b,"tenantId"),project=req(b,"projectId"),process=req(b,"processCode"),step=req(b,"stepCode"),actor=req(b,"actorCode"),command=req(b,"commandCode"),key=req(b,"idempotencyKey");
        List<Map<String,Object>> existing=jdbc.queryForList("select event_id as \"eventId\",to_state as \"toState\" from framework_process_execution_event where execution_id=? and idempotency_key=?",executionId,key);
        if(!existing.isEmpty())return Map.of("success",true,"idempotent",true,"event",existing.get(0));
        List<Map<String,Object>> executions=jdbc.queryForList("select * from framework_process_execution where execution_id=? for update",executionId);
        if(executions.isEmpty())throw new IllegalArgumentException("프로세스 실행 건이 없습니다.");
        Map<String,Object> execution=executions.get(0);
        if(!"RUNNING".equals(String.valueOf(execution.get("execution_status"))))throw new IllegalStateException("실행 중인 프로세스가 아닙니다.");
        if(!tenant.equals(String.valueOf(execution.get("tenant_id")))||!project.equals(String.valueOf(execution.get("project_id")))||!process.equals(String.valueOf(execution.get("process_code"))))throw new IllegalArgumentException("테넌트·프로젝트·프로세스 실행 문맥이 일치하지 않습니다.");
        if(!step.equals(String.valueOf(execution.get("current_step_code"))))throw new IllegalStateException("현재 실행 단계는 "+execution.get("current_step_code")+"입니다.");
        List<Map<String,Object>> contracts=jdbc.queryForList("select step_order,actor_code,command_code,from_state,to_state from framework_process_step where process_code=? and step_code=?",process,step);
        if(contracts.isEmpty())throw new IllegalArgumentException("단계 계약이 없습니다.");
        Map<String,Object> contract=contracts.get(0);String requiredActor=String.valueOf(contract.get("actor_code")),requiredCommand=String.valueOf(contract.get("command_code")),from=String.valueOf(contract.get("from_state")),to=String.valueOf(contract.get("to_state"));
        String requestedToState=str(b,"requestedToState");
        if(!requestedToState.isBlank()){
            boolean correctionDecision=("EMISSION_PROJECT_VALIDATE".equals(step)||"EMISSION_PROJECT_APPROVE".equals(step))&&"CORRECTION_REQUIRED".equals(requestedToState);
            if(!correctionDecision)throw new IllegalArgumentException("허용되지 않은 결과 상태입니다: "+requestedToState);
            to=requestedToState;
        }
        if(!requiredActor.equals(actor))throw new IllegalArgumentException("이 단계의 수행 액터는 "+requiredActor+"입니다.");
        if(!requiredCommand.equals(command))throw new IllegalArgumentException("이 단계의 명령은 "+requiredCommand+"입니다.");
        if(!from.equals(String.valueOf(execution.get("current_state"))))throw new IllegalStateException("현재 상태가 단계 시작 조건과 다릅니다.");
        requireActorAssignment(tenant,project,actor);
        Long eventId=jdbc.queryForObject("insert into framework_process_execution_event(execution_id,step_code,actor_code,command_code,from_state,to_state,idempotency_key,request_json,result_json,executed_by) values(?,?,?,?,?,?,?,?,?,?) returning event_id",Long.class,executionId,step,actor,command,from,to,key,def(b,"requestJson","{}"),def(b,"resultJson","{}"),user);
        int order=((Number)contract.get("step_order")).intValue();
        List<Map<String,Object>> next=jdbc.queryForList("select step_code,actor_code from framework_process_step where process_code=? and step_code<>? and from_state=? order by case when step_order>? then 0 else 1 end,step_order limit 1",process,step,to,order);
        if(next.isEmpty())jdbc.update("update framework_process_execution set current_state=?,execution_status='COMPLETED',completed_at=current_timestamp,updated_at=current_timestamp where execution_id=?",to,executionId);
        else jdbc.update("update framework_process_execution set current_step_code=?,current_state=?,updated_at=current_timestamp where execution_id=?",String.valueOf(next.get(0).get("step_code")),to,executionId);
        return Map.of("success",true,"idempotent",false,"eventId",eventId,"fromState",from,"toState",to,"executionStatus",next.isEmpty()?"COMPLETED":"RUNNING","nextStepCode",next.isEmpty()?"":String.valueOf(next.get(0).get("step_code")),"nextActorCode",next.isEmpty()?"":String.valueOf(next.get(0).get("actor_code")));
    }

    private void requireActorAssignment(String tenant,String project,String actor){
        Integer count=jdbc.queryForObject("select count(*) from framework_account_actor_assignment where tenant_id=? and project_id=? and actor_code=? and assignment_status='ACTIVE' and (valid_from is null or valid_from<=current_date) and (valid_until is null or valid_until>=current_date)",Integer.class,tenant,project,actor);
        if(count==null||count==0)throw new IllegalArgumentException("프로젝트에 활성 액터 배정이 없습니다: "+actor);
    }

    public Map<String,Object> findProcessExecution(String tenant,String project,String process){
        List<Map<String,Object>> rows=jdbc.queryForList("select execution_id as \"executionId\",tenant_id as \"tenantId\",project_id as \"projectId\",process_code as \"processCode\",current_step_code as \"currentStepCode\",execution_status as \"executionStatus\",current_state as \"currentState\",initiated_by_actor as \"initiatedByActor\",started_at as \"startedAt\",completed_at as \"completedAt\" from framework_process_execution where tenant_id=? and project_id=? and process_code=? order by started_at desc limit 1",tenant,project,process);
        if(rows.isEmpty())return Map.of("found",false);
        Map<String,Object> out=new LinkedHashMap<>(rows.get(0));
        out.put("found",true);
        out.put("events",jdbc.queryForList("select event_id as \"eventId\",step_code as \"stepCode\",actor_code as \"actorCode\",command_code as \"commandCode\",from_state as \"fromState\",to_state as \"toState\",executed_at as \"executedAt\" from framework_process_execution_event where execution_id=? order by event_id",rows.get(0).get("executionId")));
        return out;
    }

    @Transactional public Map<String,Object> claimDevelopmentJob(String worker){
        String order="case job_type when 'DATABASE' then 10 when 'API' then 20 when 'BACKEND' then 30 when 'FRONTEND_USER' then 40 when 'FRONTEND_ADMIN' then 50 when 'NOTIFICATION' then 60 when 'TEST' then 70 when 'INTEGRATION' then 80 else 90 end";
        List<Map<String,Object>> rows=jdbc.queryForList("select * from framework_development_job j where approval_status='APPROVED' and (job_status in ('PLANNED','RETRY') or (job_status='RUNNING' and lease_until<current_timestamp)) and not exists(select 1 from framework_development_job p where p.process_code=j.process_code and p.step_code=j.step_code and ("+order.replace("job_type","p.job_type")+")<("+order.replace("job_type","j.job_type")+") and p.job_status<>'VERIFIED') order by process_code,step_code,"+order+",job_id for update skip locked limit 1");
        if(rows.isEmpty())return Map.of("success",true,"available",false);
        Map<String,Object> job=rows.get(0); long id=((Number)job.get("job_id")).longValue(); String from=String.valueOf(job.get("job_status")),token=UUID.randomUUID().toString();
        jdbc.update("update framework_development_job set job_status='RUNNING',worker_id=?,lease_token=?,lease_until=current_timestamp+interval '10 minutes',attempt_count=attempt_count+1,started_at=coalesce(started_at,current_timestamp),last_error=null,updated_at=current_timestamp where job_id=?",worker,token,id);
        event(id,"CLAIMED",from,"RUNNING",worker,"{}");
        Map<String,Object> out=new LinkedHashMap<>(job);out.put("jobId",id);out.put("leaseToken",token);out.put("available",true);out.put("success",true);return out;
    }

    @Transactional public Map<String,Object> heartbeatDevelopmentJob(long jobId,String token,String worker){
        int changed=jdbc.update("update framework_development_job set lease_until=current_timestamp+interval '10 minutes',updated_at=current_timestamp where job_id=? and lease_token=? and worker_id=? and job_status='RUNNING'",jobId,token,worker);
        if(changed==0)throw new IllegalArgumentException("실행 임대가 만료되었거나 다른 실행기가 소유한 작업입니다.");
        return Map.of("success",true,"jobId",jobId);
    }

    @Transactional public Map<String,Object> completeDevelopmentJob(Map<String,Object>b,String worker){
        long id=Long.parseLong(req(b,"jobId"));String token=req(b,"leaseToken"),result=def(b,"result","VERIFIED");
        if(!List.of("VERIFIED","FAILED").contains(result))throw new IllegalArgumentException("result must be VERIFIED or FAILED");
        List<Map<String,Object>> rows=jdbc.queryForList("select * from framework_development_job where job_id=? and lease_token=? and worker_id=? and job_status='RUNNING' for update",id,token,worker);
        if(rows.isEmpty())throw new IllegalArgumentException("실행 임대가 만료되었거나 다른 실행기가 소유한 작업입니다.");
        Map<String,Object>j=rows.get(0);String process=String.valueOf(j.get("process_code")),step=String.valueOf(j.get("step_code")),type=String.valueOf(j.get("job_type"));
        jdbc.update("update framework_development_job set job_status=?,result_json=?,evidence_ref=nullif(?,''),rollback_ref=nullif(?,''),last_error=nullif(?,''),completed_at=case when ?='VERIFIED' then current_timestamp else null end,lease_token=null,lease_until=null,updated_at=current_timestamp where job_id=?",result,def(b,"resultJson","{}"),str(b,"evidenceRef"),str(b,"rollbackRef"),str(b,"error"),result,id);
        event(id,result,"RUNNING",result,worker,def(b,"resultJson","{}"));
        jdbc.update("update framework_process_artifact set delivery_status=?,evidence_ref=coalesce(nullif(?,''),evidence_ref),updated_at=current_timestamp where process_code=? and step_code=? and contract_ref=?",result,str(b,"evidenceRef"),process,step,"AUTO:"+type);
        Integer pending=jdbc.queryForObject("select count(*) from framework_development_job where process_code=? and step_code=? and job_status<>'VERIFIED'",Integer.class,process,step);
        jdbc.update("update framework_process_step set automation_status=? where process_code=? and step_code=?",pending!=null&&pending==0?"VERIFIED":("FAILED".equals(result)?"BLOCKED":"GENERATED"),process,step);
        return Map.of("success",true,"jobId",id,"status",result,"stepComplete",pending!=null&&pending==0);
    }

    @Transactional public Map<String,Object> retryDevelopmentJob(long jobId,String actor){
        List<Map<String,Object>> rows=jdbc.queryForList("select job_status from framework_development_job where job_id=? for update",jobId);if(rows.isEmpty())throw new IllegalArgumentException("작업이 존재하지 않습니다.");
        String from=String.valueOf(rows.get(0).get("job_status"));if(!"FAILED".equals(from))throw new IllegalArgumentException("실패 작업만 재시도할 수 있습니다.");
        jdbc.update("update framework_development_job set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,updated_at=current_timestamp where job_id=?",jobId);event(jobId,"RETRY_REQUESTED",from,"RETRY",actor,"{}");return Map.of("success",true,"jobId",jobId);
    }

    @Transactional public Map<String,Object> scanReferences(String root,String actor){
        Path base=Path.of(root).normalize();if(!Files.isDirectory(base))throw new IllegalArgumentException("레퍼런스 경로를 읽을 수 없습니다: "+root);
        ensureReferenceProcesses();int files=0,expectations=0,cases=0,jobs=0;
        try(Stream<Path> paths=Files.walk(base)){
            for(Path path:paths.filter(Files::isRegularFile).filter(p->!p.getFileName().toString().endsWith(":Zone.Identifier")).limit(20000).toList()){
                String name=path.getFileName().toString(),lower=name.toLowerCase(Locale.ROOT),type=extension(lower),screen=classifyScreen(lower),domain=classifyDomain(lower),process=processForDomain(domain);
                long size=Files.size(path),modified=Files.getLastModifiedTime(path).toMillis();String relative=base.relativize(path).toString().replace('\\','/'),fingerprint=jdbc.queryForObject("select md5(?)",String.class,relative+"|"+size+"|"+modified);
                Long id=jdbc.queryForObject("insert into framework_reference_asset(source_path,source_name,source_type,content_fingerprint,file_size,domain_code,screen_type,process_code,analysis_status,confidence,analyzed_at) values(?,?,?,?,?,?,?,?, 'ANALYZED',?,current_timestamp) on conflict(source_path) do update set content_fingerprint=excluded.content_fingerprint,file_size=excluded.file_size,domain_code=excluded.domain_code,screen_type=excluded.screen_type,process_code=excluded.process_code,analysis_status='ANALYZED',confidence=excluded.confidence,analyzed_at=current_timestamp returning reference_id",Long.class,relative,name,type,fingerprint,size,domain,screen,process,confidenceFor(type,screen));
                files++;
                String tests=jdbc.queryForObject("select default_test_expectations from framework_screen_type where screen_type=?",String.class,screen);
                for(String expectation:tests.split(";")){jdbc.update("insert into framework_reference_expectation(reference_id,process_code,expectation_type,expectation_text) values(?,?,?,?) on conflict(reference_id,process_code,expectation_type) do update set expectation_text=excluded.expectation_text",id,process,screen+"_"+Math.abs(expectation.hashCode()),expectation);expectations++;}
                String caseCode=(process+"_REFERENCE_"+screen).replaceAll("[^A-Za-z0-9_]","_");
                int changed=jdbc.update("insert into framework_simulation_case(case_code,process_code,case_name,case_type,preconditions,steps_json,assertions_json) values(?,?,?,?,?,?,?) on conflict(case_code) do update set assertions_json=excluded.assertions_json,updated_at=current_timestamp",caseCode,process,screen+" 화면 레퍼런스 기대값","REFERENCE","분류된 레퍼런스가 존재하고 대응 화면 또는 개발 작업이 연결됨","[]","[\""+jsonEscape(tests.replace(';',','))+"\"]");if(changed>0)cases++;
            }
        }catch(Exception e){throw new IllegalStateException("레퍼런스 자동 분석 실패: "+e.getMessage(),e);}
        for(Map<String,Object> row:jdbc.queryForList("select distinct process_code from framework_reference_asset where process_code is not null")){
            String process=String.valueOf(row.get("process_code"));List<Map<String,Object>> steps=jdbc.queryForList("select step_code from framework_process_step where process_code=? order by step_order limit 1",process);if(steps.isEmpty())continue;String step=String.valueOf(steps.get(0).get("step_code"));
            jobs+=queueJob(process,step,"REFERENCE_ANALYSIS","레퍼런스·기존 구현 차이 분석","reference/"+process.toLowerCase(),"레퍼런스 기대값과 현재 페이지·API·DB 구현을 비교하고 누락 작업을 생성",actor);
            jdbc.update("update framework_development_job set approval_status='APPROVED' where process_code=? and step_code=? and job_type='REFERENCE_ANALYSIS'",process,step);
        }
        jdbc.update("insert into framework_automation_metric(metric_type,metric_value,sample_count,detail_json) values('REFERENCE_SCAN',?,?,?)",files,files,"{\"root\":\""+jsonEscape(root)+"\"}");
        Integer totalCases=jdbc.queryForObject("select count(*) from framework_simulation_case where case_type='REFERENCE'",Integer.class);
        return Map.of("success",true,"assets",files,"expectations",expectations,"simulationCases",totalCases==null?0:totalCases,"queuedProcesses",jobs);
    }

    @Transactional public Map<String,Object> compileScreenBlueprints(Map<String,Object>b,String actor){
        String process=str(b,"processCode");int limit=Math.min(1000,Math.max(1,integerOr(b,"maxScreens",1000)));boolean dryRun=!"false".equalsIgnoreCase(str(b,"dryRun"));
        String batchCode="SCREEN_"+System.currentTimeMillis();
        Long batchId=jdbc.queryForObject("insert into framework_screen_generation_batch(batch_code,batch_name,process_code,requested_count,dry_run,requested_by) values(?,?,?,?,?,?) returning batch_id",Long.class,batchCode,process.isBlank()?"전체 프로세스 화면 컴파일":process+" 화면 컴파일",process.isBlank()?null:process,limit,dryRun,actor);
        String filter=process.isBlank()?"":" and s.process_code=?";
        Object[] args=process.isBlank()?new Object[]{limit}:new Object[]{process,limit};
        List<Map<String,Object>> steps=jdbc.queryForList("select s.process_code,s.step_code,s.step_name,s.actor_code,s.user_path,s.admin_path,s.requires_user_page,s.requires_admin_page,p.domain_code from framework_process_step s join framework_process_definition p on p.process_code=s.process_code where (s.requires_user_page or s.requires_admin_page)"+filter+" order by p.development_order,s.process_code,s.step_order limit ?",args);
        int compiled=0,valid=0,invalid=0,order=0;
        for(Map<String,Object>s:steps){
            for(String audience:List.of("USER","ADMIN")){
                boolean required=Boolean.TRUE.equals(s.get("USER".equals(audience)?"requires_user_page":"requires_admin_page"));if(!required||compiled>=limit)continue;
                String processCode=String.valueOf(s.get("process_code")),stepCode=String.valueOf(s.get("step_code")),actorCode=String.valueOf(s.get("actor_code")),stepName=String.valueOf(s.get("step_name"));
                Object rawPath=s.get("USER".equals(audience)?"user_path":"admin_path");String route=rawPath==null?"":String.valueOf(rawPath).trim();
                String screenType=inferScreenType(stepName,route,audience);String pageId=(processCode+"_"+stepCode+"_"+audience).replaceAll("[^A-Za-z0-9_]","_");String code="BP_"+pageId;
                int caseTypes=jdbc.queryForObject("select count(distinct case_type) from framework_simulation_case where process_code=? and case_type in ('HAPPY_PATH','AUTHORITY','ISOLATION','EXCEPTION','RECOVERY')",Integer.class,processCode);
                String validation=route.isBlank()?"화면 경로 누락":caseTypes<5?"필수 5종 테스트 시나리오 누락":"";String status=validation.isBlank()?"VALID":"INVALID";
                String safeRoute=route.isBlank()?("ADMIN".equals(audience)?"/admin/generated/":"/generated/")+processCode.toLowerCase(Locale.ROOT)+"/"+stepCode.toLowerCase(Locale.ROOT):route;
                String spec="{\"domain\":\""+jsonEscape(String.valueOf(s.get("domain_code")))+"\",\"actor\":\""+jsonEscape(actorCode)+"\",\"process\":\""+jsonEscape(processCode)+"\",\"step\":\""+jsonEscape(stepCode)+"\",\"screenType\":\""+screenType+"\",\"designSystem\":\"KRDS_GOV\"}";
                String trace="{\"requiredScenarioTypes\":[\"HAPPY_PATH\",\"AUTHORITY\",\"ISOLATION\",\"EXCEPTION\",\"RECOVERY\"],\"caseTypeCount\":"+caseTypes+"}";
                Long blueprintId=jdbc.queryForObject("insert into framework_screen_blueprint(blueprint_code,process_code,step_code,actor_code,audience,page_id,page_name,route_path,screen_type,template_code,specification_json,traceability_json,validation_status,validation_message,created_by) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) on conflict(audience,route_path) do update set process_code=excluded.process_code,step_code=excluded.step_code,actor_code=excluded.actor_code,page_id=excluded.page_id,page_name=excluded.page_name,screen_type=excluded.screen_type,template_code=excluded.template_code,specification_json=excluded.specification_json,traceability_json=excluded.traceability_json,validation_status=excluded.validation_status,validation_message=excluded.validation_message,updated_at=current_timestamp returning blueprint_id",Long.class,code,processCode,stepCode,actorCode,audience,pageId,stepName+("USER".equals(audience)?"":" 관리"),safeRoute,screenType,"KRDS_"+screenType,spec,trace,status,validation,actor);
                jdbc.update("insert into framework_screen_generation_batch_item(batch_id,blueprint_id,item_order,item_status,validation_message) values(?,?,?,?,?) on conflict(batch_id,blueprint_id) do nothing",batchId,blueprintId,++order,status,validation);
                compiled++;if("VALID".equals(status))valid++;else invalid++;
            }
        }
        String batchStatus=invalid==0?"COMPILED":"REVIEW_REQUIRED";
        jdbc.update("update framework_screen_generation_batch set compiled_count=?,valid_count=?,invalid_count=?,batch_status=?,summary_json=?,completed_at=current_timestamp where batch_id=?",compiled,valid,invalid,batchStatus,"{\"coverage\":"+(compiled==0?0:Math.round(valid*100.0/compiled))+"}",batchId);
        return Map.of("success",true,"batchId",batchId,"batchCode",batchCode,"compiled",compiled,"valid",valid,"invalid",invalid,"status",batchStatus,"dryRun",dryRun);
    }

    @Transactional public Map<String,Object> adoptExistingScreens(Map<String,Object>b,String actor){
        ensureReferenceProcesses();
        int limit=Math.min(1000,Math.max(1,integerOr(b,"maxScreens",1000)));
        String batchCode="ADOPT_"+System.currentTimeMillis();
        List<Map<String,Object>> routes=jdbc.queryForList("select distinct on (menu_url) menu_code,menu_nm,menu_url from comtnmenuinfo where use_at='Y' and menu_url is not null and trim(menu_url)<>'' and menu_url<>'#' and menu_url like '/%' and menu_url not like '/admin/api/%' order by menu_url,length(menu_code) desc limit ?",limit);
        int requested=Math.max(1,routes.size());
        Long batchId=jdbc.queryForObject("insert into framework_screen_generation_batch(batch_code,batch_name,requested_count,dry_run,requested_by) values(?,?,?,true,?) returning batch_id",Long.class,batchCode,"기존 전체 화면 표준 계약 전환",requested,actor);
        int order=0,valid=0;
        for(Map<String,Object> row:routes){
            String route=String.valueOf(row.get("menu_url")),name=String.valueOf(row.get("menu_nm")),menuCode=String.valueOf(row.get("menu_code"));
            String audience=route.startsWith("/admin")?"ADMIN":"USER";
            String domain=classifyDomain((name+" "+route).toLowerCase(Locale.ROOT)),process=processForDomain(domain);
            List<Map<String,Object>> steps=jdbc.queryForList("select step_code,actor_code from framework_process_step where process_code=? order by step_order limit 1",process);
            if(steps.isEmpty())continue;
            String step=String.valueOf(steps.get(0).get("step_code")),actorCode=String.valueOf(steps.get(0).get("actor_code"));
            String pageId="ADOPT_"+UUID.nameUUIDFromBytes((audience+":"+route).getBytes()).toString().replace("-","").substring(0,20).toUpperCase(Locale.ROOT);
            String screenType=inferScreenType(name,route,audience);
            int caseTypes=jdbc.queryForObject("select count(distinct case_type) from framework_simulation_case where process_code=? and case_type in ('HAPPY_PATH','AUTHORITY','ISOLATION','EXCEPTION','RECOVERY')",Integer.class,process);
            String validation=caseTypes<5?"필수 5종 테스트 시나리오 보완 필요":"",status=validation.isBlank()?"VALID":"INVALID";
            String spec="{\"domain\":\""+jsonEscape(domain)+"\",\"designSystem\":\"KRDS_GOV\",\"preserveExistingImplementation\":true}";
            String trace="{\"menuCode\":\""+jsonEscape(menuCode)+"\",\"requiredScenarioTypes\":[\"HAPPY_PATH\",\"AUTHORITY\",\"ISOLATION\",\"EXCEPTION\",\"RECOVERY\"],\"caseTypeCount\":"+caseTypes+"}";
            Long blueprintId=jdbc.queryForObject("insert into framework_screen_blueprint(blueprint_code,process_code,step_code,actor_code,audience,page_id,page_name,route_path,screen_type,template_code,specification_json,traceability_json,validation_status,validation_message,implementation_strategy,source_reference,transition_status,created_by) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) on conflict(audience,route_path) do update set page_name=excluded.page_name,process_code=excluded.process_code,step_code=excluded.step_code,actor_code=excluded.actor_code,screen_type=excluded.screen_type,template_code=excluded.template_code,specification_json=excluded.specification_json,traceability_json=excluded.traceability_json,validation_status=excluded.validation_status,validation_message=excluded.validation_message,implementation_strategy='ADOPT_EXISTING',source_reference=excluded.source_reference,transition_status='CONTRACT_LINKED',updated_at=current_timestamp returning blueprint_id",Long.class,"BP_"+pageId,process,step,actorCode,audience,pageId,name,route,screenType,"KRDS_"+screenType,spec,trace,status,validation,"ADOPT_EXISTING","COMTNMENUINFO:"+menuCode,"CONTRACT_LINKED",actor);
            jdbc.update("insert into ui_page_manifest(page_id,page_name,route_path,domain_code,layout_version,design_token_version,active_yn,created_at,updated_at,page_title,page_url,version_status) values(?,?,?,?,'1.0.0','KRDS_GOV_DEFAULT','Y',current_timestamp,current_timestamp,?,?, 'DRAFT') on conflict(page_id) do update set page_name=excluded.page_name,route_path=excluded.route_path,domain_code=excluded.domain_code,design_token_version='KRDS_GOV_DEFAULT',active_yn='Y',updated_at=current_timestamp",pageId,name,route,domain,name,route);
            jdbc.update("insert into framework_screen_generation_batch_item(batch_id,blueprint_id,item_order,item_status,validation_message) values(?,?,?,?,?)",batchId,blueprintId,++order,status,validation);
            if("VALID".equals(status))valid++;
        }
        int invalid=order-valid;String batchStatus=invalid==0?"COMPILED":"REVIEW_REQUIRED";
        jdbc.update("update framework_screen_generation_batch set requested_count=?,compiled_count=?,valid_count=?,invalid_count=?,batch_status=?,summary_json=?,completed_at=current_timestamp where batch_id=?",requested,order,valid,invalid,batchStatus,"{\"strategy\":\"ADOPT_EXISTING\",\"preservedImplementations\":"+order+"}",batchId);
        return Map.of("success",true,"batchId",batchId,"batchCode",batchCode,"discovered",routes.size(),"adopted",order,"valid",valid,"reviewRequired",invalid,"status",batchStatus);
    }

    @Transactional public Map<String,Object> queueScreenGeneration(long batchId,String actor){
        List<Map<String,Object>> items=jdbc.queryForList("select i.blueprint_id,b.process_code,b.step_code,b.audience,b.page_name,b.route_path from framework_screen_generation_batch_item i join framework_screen_blueprint b on b.blueprint_id=i.blueprint_id where i.batch_id=? and b.validation_status='VALID' and i.development_job_id is null order by i.item_order for update",batchId);
        int queued=0;
        for(Map<String,Object>item:items){String process=String.valueOf(item.get("process_code")),step=String.valueOf(item.get("step_code")),audience=String.valueOf(item.get("audience")),route=String.valueOf(item.get("route_path"));queueJob(process,step,"USER".equals(audience)?"FRONTEND_USER":"FRONTEND_ADMIN",String.valueOf(item.get("page_name")),route,"컴파일된 화면 설계·KRDS 디자인·액터 테스트 계약 구현",actor);Long jobId=jdbc.queryForObject("select job_id from framework_development_job where process_code=? and step_code=? and job_type=? and target_path=?",Long.class,process,step,"USER".equals(audience)?"FRONTEND_USER":"FRONTEND_ADMIN",route);jdbc.update("update framework_screen_generation_batch_item set item_status='QUEUED',development_job_id=? where batch_id=? and blueprint_id=?",jobId,batchId,item.get("blueprint_id"));queued++;}
        jdbc.update("update framework_screen_generation_batch set queued_count=queued_count+?,batch_status='QUEUED',completed_at=current_timestamp where batch_id=?",queued,batchId);
        return Map.of("success",true,"batchId",batchId,"queued",queued);
    }

    public Map<String,Object> exportScreenGeneration(long batchId){
        List<Map<String,Object>> batches=jdbc.queryForList("select batch_id as \"batchId\",batch_code as \"batchCode\",batch_name as \"batchName\",batch_status as \"batchStatus\",compiled_count as \"compiledCount\",valid_count as \"validCount\",invalid_count as \"invalidCount\" from framework_screen_generation_batch where batch_id=?",batchId);
        if(batches.isEmpty())throw new IllegalArgumentException("생성 배치가 존재하지 않습니다.");
        List<Map<String,Object>> blueprints=jdbc.queryForList("select b.blueprint_id as \"blueprintId\",b.blueprint_code as \"blueprintCode\",b.process_code as \"processCode\",b.step_code as \"stepCode\",b.actor_code as \"actorCode\",b.audience,b.page_id as \"pageId\",b.page_name as \"pageName\",b.route_path as \"routePath\",b.screen_type as \"screenType\",b.template_code as \"templateCode\",b.specification_json as \"specificationJson\",b.traceability_json as \"traceabilityJson\",b.validation_status as \"validationStatus\",b.validation_message as \"validationMessage\",i.item_order as \"itemOrder\" from framework_screen_generation_batch_item i join framework_screen_blueprint b on b.blueprint_id=i.blueprint_id where i.batch_id=? order by i.item_order",batchId);
        return Map.of("schemaVersion","1.0.0","generator","carbonet-actor-process-screen-compiler","batch",batches.get(0),"blueprints",blueprints);
    }

    private static String inferScreenType(String name,String route,String audience){String n=(name+" "+route).toLowerCase(Locale.ROOT);if("ADMIN".equals(audience))return "ADMIN";return classifyScreen(n);}

    private void ensureReferenceProcesses(){
        Object[][] rows={{"MEMBER_LIFECYCLE","회원·기업 생애주기","MEMBER","회원 가입부터 승인·권한·휴면·탈퇴까지 관리","회원 업무 요구가 존재","계정 상태와 감사 이력이 일치"},{"CERTIFICATE_ISSUANCE","인증서 신청·발급·검증","CERTIFICATE","신청부터 발급·진위 확인까지 연결","승인된 산출 결과 존재","인증서와 검증 정보가 공개"},{"PAYMENT_SETTLEMENT","수수료·결제·정산","PAYMENT","수수료 결제와 환불·정산을 추적","결제 대상 업무 존재","결제·환불·정산 상태 일치"},{"CONTENT_OPERATION","콘텐츠·교육·지원 운영","CONTENT","콘텐츠와 교육·지원을 게시·운영","게시 요청 존재","공개 상태와 권한 일치"},{"TRADE_EXECUTION","탄소·자원 거래","TRADE","공급·수요부터 계약·정산·추적까지 관리","거래 참여자와 대상 존재","거래 및 MRV 이력 확정"}};
        for(Object[]r:rows){jdbc.update("insert into framework_process_definition(process_code,process_name,domain_code,goal,start_condition,completion_condition,automation_mode) values(?,?,?,?,?,?,'AUTOMATIC') on conflict(process_code) do nothing",r);String code=String.valueOf(r[0]);Integer count=jdbc.queryForObject("select count(*) from framework_process_step where process_code=?",Integer.class,code);if(count!=null&&count==0){seedSteps(code);seedCases(code);}}
    }
    private static String extension(String name){int i=name.lastIndexOf('.');return i<0?"FILE":name.substring(i+1).toUpperCase(Locale.ROOT);}
    private static String classifyScreen(String n){if(n.contains("보고서")||n.contains("인증서")||n.contains("명세서")||n.contains("report"))return "REPORT";if(n.contains("로그인")||n.contains("본인인증")||n.contains("법인인증")||n.contains("비밀번호")||n.contains("login"))return "AUTH";if(n.contains("업로드")||n.contains("입력")||n.contains("upload"))return "UPLOAD";if(n.contains("검색")||n.contains("search"))return "SEARCH";if(n.contains("승인")||n.contains("신청")||n.contains("검증")||n.contains("이의"))return "WORKFLOW";if(n.contains("통계")||n.contains("모니터")||n.contains("시각화")||n.contains("dashboard"))return "DASHBOARD";if(n.contains("등록")||n.contains("작성")||n.contains("설정"))return "FORM";if(n.contains("상세")||n.contains("확인")||n.contains("detail"))return "DETAIL";if(n.contains("목록")||n.contains("내역")||n.contains("현황")||n.contains("list"))return "LIST";if(n.contains("관리")||n.contains("admin"))return "ADMIN";if(n.contains("메인")||n.contains("home"))return "HOME";return "CONTENT";}
    private static String classifyDomain(String n){if(n.contains("lca")||n.contains("lci")||n.contains("탄소발자국"))return "LCA";if(n.contains("배출")||n.contains("온실가스")||n.contains("ccus"))return "CARBON_EMISSION";if(n.contains("인증서"))return "CERTIFICATE";if(n.contains("회원")||n.contains("계정")||n.contains("로그인")||n.contains("본인인증")||n.contains("법인인증"))return "MEMBER";if(n.contains("결제")||n.contains("수수료")||n.contains("환불")||n.contains("세금"))return "PAYMENT";if(n.contains("거래")||n.contains("공급")||n.contains("수요"))return "TRADE";if(n.contains("공지")||n.contains("게시")||n.contains("교육")||n.contains("faq"))return "CONTENT";return "GOVERNANCE";}
    private static String processForDomain(String d){return switch(d){case "LCA"->"LCA_EXECUTION";case "CARBON_EMISSION"->"EMISSION_PROJECT";case "MEMBER"->"MEMBER_LIFECYCLE";case "PAYMENT"->"PAYMENT_SETTLEMENT";case "CERTIFICATE"->"CERTIFICATE_ISSUANCE";case "TRADE"->"TRADE_EXECUTION";case "CONTENT"->"CONTENT_OPERATION";default->"GOVERNANCE_CHANGE";};}
    private static double confidenceFor(String type,String screen){double v=List.of("HTML","HTM","TXT","MD").contains(type)?95:80;return "CONTENT".equals(screen)?v-15:v;}

    private void event(long id,String type,String from,String to,String worker,String detail){jdbc.update("insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json) values(?,?,?,?,?,?)",id,type,from,to,worker,detail);}

    private int queueJob(String process,String step,String type,String name,String path,String requirement,String actor){
        String safePath=(path==null||"null".equals(path)||path.isBlank())?type.toLowerCase()+"/"+process.toLowerCase()+"/"+step.toLowerCase():path;
        String designBasis=type.startsWith("FRONTEND")?screenDevelopmentNoteService.developmentBasis(safePath):"화면 작업이 아닌 개발 작업";
        String specification="{\"requirement\":\""+jsonEscape(requirement)+"\",\"screenDevelopmentBasis\":\""+jsonEscape(designBasis)+"\",\"noteRequiredBeforeImplementation\":"+type.startsWith("FRONTEND")+"}";
        int changed=jdbc.update("insert into framework_development_job(process_code,step_code,job_type,job_name,target_path,specification_json,created_by) values(?,?,?,?,?,?,?) on conflict(process_code,step_code,job_type,target_path) do update set job_name=excluded.job_name,specification_json=excluded.specification_json,updated_at=current_timestamp",process,step,type,name,safePath,specification,actor);
        String artifactType=switch(type){case "DATABASE"->"DATA";case "FRONTEND_USER","FRONTEND_ADMIN"->"PAGE";case "INTEGRATION"->"OPERATION";default->type;};
        jdbc.update("insert into framework_process_artifact(process_code,step_code,artifact_code,artifact_type,artifact_name,target_path,contract_ref,required,delivery_status,owner_actor_code,acceptance_criteria,notes) values(?,?,?,?,?,?,?,true,'PLANNED',(select actor_code from framework_process_step where process_code=? and step_code=?),?,?) on conflict(process_code,artifact_code) do update set artifact_name=excluded.artifact_name,target_path=excluded.target_path,acceptance_criteria=excluded.acceptance_criteria,updated_at=current_timestamp",process,step,(process+"_"+step+"_"+type).replaceAll("[^A-Za-z0-9_]","_"),artifactType,name,safePath,"AUTO:"+type,process,step,requirement+" 구현 및 자동 테스트 통과","프로세스 단계에서 자동 도출");
        return changed>0?1:0;
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
    private static int integerOr(Map<String,Object>b,String k,int d){String v=str(b,k);if(v.isEmpty())return d;try{return Integer.parseInt(v);}catch(Exception e){throw new IllegalArgumentException(k+" must be a number");}}
    private static String jsonEscape(String value){return value==null?"":value.replace("\\","\\\\").replace("\"","\\\"").replace("\r","\\r").replace("\n","\\n");}
}
