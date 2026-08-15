package egovframework.com.platform.governance.service;

import egovframework.com.platform.codex.model.CodexProvisionResponse;
import egovframework.com.platform.codex.service.CodexProvisioningService;
import egovframework.com.platform.request.codex.CodexProvisionRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;

import java.util.LinkedHashMap;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.math.BigDecimal;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class ActorProcessGovernanceService {
    static final int SYSTEM_TEST_REPORT_COMPACT_JSON_LIMIT_BYTES = 2048;
    private static final Set<String> SYSTEM_TEST_REPORT_LARGE_JSON_FIELDS = Set.of(
        "latestPreInputJson", "latestEvidenceJson", "latestInput", "latestOutput", "evidenceJson",
        "actualInput", "actualOutput", "actualEvidenceJson",
        "simulationEvidenceJson", "fixtureSuiteCasesJson", "businessEvidenceJson", "screenFunctionInventoryJson",
        "scopedReviewInventoryJson", "reviewScopesJson", "nextDestinationsJson"
    );
    private static final Set<String> PROFESSIONAL_CONTRACT_STATUSES = Set.of(
        "DRAFT", "REVIEW_REQUIRED", "DESIGN_COMPLETE", "APPROVED", "VERIFIED"
    );
    private static final String DESIGN_AUTOMATION_NAMESPACE =
        "CARBONET_DESIGN_AUTOMATION_V1";
    private final JdbcTemplate jdbc;
    private final ScreenDevelopmentNoteService screenDevelopmentNoteService;
    private final CodexProvisioningService codexProvisioningService;
    private final ScreenContractRuntimeService screenContractRuntimeService;

    public List<Map<String, Object>> dashboardDataset(String dataset) {
        if ("processExecutions".equals(dataset)) {
            return jdbc.queryForList("""
                select execution.*,step.actor_code as current_actor_code,
                       case
                         when execution.process_code<>'EMISSION_PROJECT' then false
                         when project.project_id is null then true
                         else false
                       end as domain_orphaned
                  from framework_process_execution execution
                  left join emission_project_registry project
                    on project.project_id=execution.project_id
                   and project.tenant_id=execution.tenant_id
                  left join framework_process_step step
                    on step.process_code=execution.process_code
                   and step.step_code=execution.current_step_code
                 order by execution.updated_at desc
                 limit 1000
                """).stream().map(this::camelCaseColumns).toList();
        }
        if ("emissionProjectTasks".equals(dataset)) {
            return jdbc.queryForList("""
                select task.task_id as "taskId",
                       task.project_id as "projectId",
                       project.tenant_id as "tenantId",
                       project.project_name as "projectName",
                       task.task_code as "taskCode",
                       task.task_name as "taskName",
                       task.step_order as "stepOrder",
                       task.task_status as "taskStatus",
                       task.process_code as "processCode",
                       task.process_step_code as "processStepCode",
                       task.actor_code as "actorCode",
                       task.assignee_id as "assigneeId",
                       task.priority,
                       task.due_date as "dueDate",
                       task.predecessor_codes as "predecessorCodes",
                       task.completion_rule as "completionRule",
                       task.blocked_reason as "blockedReason",
                       task.target_url as "targetUrl",
                       task.started_at as "startedAt",
                       task.completed_at as "completedAt",
                       task.completed_by as "completedBy",
                       (task.task_status='DONE') as "completionSatisfied",
                       case
                         when task.task_status='DONE' then
                           concat('완료',case when task.completed_by is not null
                             then concat(' · ',task.completed_by) else '' end)
                         when coalesce(task.blocked_reason,'')<>'' then task.blocked_reason
                         else coalesce(task.completion_rule,'완료 조건 확인 필요')
                       end as "completionEvidence",
                       next_task.task_name as "nextTaskName",
                       next_task.actor_code as "nextActorCode",
                       next_task.target_url as "nextTaskUrl"
                  from emission_project_task task
                  join emission_project_registry project
                    on project.project_id=task.project_id
                  left join lateral (
                    select following.task_name,following.actor_code,following.target_url
                      from emission_project_task following
                     where following.project_id=task.project_id
                       and following.step_order>task.step_order
                     order by following.step_order
                     limit 1
                  ) next_task on true
                 order by project.project_id,task.step_order,task.task_id
                 limit 2000
                """);
        }
        String relation = switch (dataset) {
            case "actors" -> "framework_actor_definition";
            case "workTypes" -> "framework_business_work_type";
            case "processes" -> "framework_process_definition";
            case "steps" -> "framework_process_step";
            case "screenBlueprints" -> "framework_screen_blueprint";
            case "screenArchetypeBindings" -> "framework_screen_process_archetype_binding";
            case "professionalScreenContracts" -> "framework_professional_screen_readiness";
            case "cases" -> "framework_simulation_case";
            case "referenceAssets" -> "framework_reference_asset";
            case "designValidationRuns" -> "framework_process_design_validation_run";
            case "processDevelopmentProgress" -> "framework_process_development_progress";
            case "developmentJobs" -> "framework_development_job";
            case "screenDevelopmentGates" -> "framework_screen_development_gate_run";
            case "backendProcessReadiness" -> "framework_process_design_assurance_matrix";
            case "pageDesigns" -> "framework_page_design_readiness";
            case "qualityGateResults" -> "framework_development_job_gate_result";
            case "artifacts" -> "framework_process_artifact";
            case "deliveryQueue" -> "framework_design_delivery_revision";
            case "processExecutionEvents" -> "framework_process_execution_event";
            case "assignments" -> "framework_account_actor_assignment";
            case "projectCompletionRuns" -> "framework_project_completion_run";
            case "automationMetrics" -> "framework_automation_metric";
            case "customerJourneyGaps" -> "framework_customer_journey_gap";
            case "developmentEvents" -> "framework_development_job_event";
            case "rollbackRequests" -> "framework_development_rollback_request";
            default -> "";
        };
        if (relation.isBlank()) {
            return List.of();
        }
        return jdbc.queryForList("select * from " + relation + " limit 1000")
                .stream()
                .map(this::camelCaseColumns)
                .toList();
    }

    public List<Map<String,Object>> dashboardDataset(String dataset,String accountId) {
        String account=accountId==null?"":accountId.trim();
        if(account.isBlank())throw new SecurityException("Authenticated control-plane account is required.");
        List<Map<String,Object>> rows=dashboardDataset(dataset);
        if(isControlPlaneAdministrator(account))return rows;
        List<Map<String,Object>> assignments=jdbc.queryForList("""
            select assignment.actor_code as "actorCode",assignment.project_id as "projectId"
              from framework_account_actor_assignment assignment
              join framework_actor_definition actor
                on actor.actor_code=assignment.actor_code and actor.use_at='Y'
             where lower(assignment.account_id)=lower(?) and assignment.assignment_status='ACTIVE'
               and (assignment.valid_from is null or assignment.valid_from<=current_date)
               and (assignment.valid_until is null or assignment.valid_until>=current_date)
            """,account);
        Set<String> actors=assignments.stream()
                .map(row->String.valueOf(row.get("actorCode"))).collect(java.util.stream.Collectors.toSet());
        Set<String> projects=assignments.stream()
                .map(row->String.valueOf(row.get("projectId"))).collect(java.util.stream.Collectors.toSet());
        Set<String> processes=dashboardDataset("steps").stream()
                .filter(row->actors.contains(String.valueOf(row.get("actorCode"))))
                .map(row->String.valueOf(row.get("processCode")))
                .collect(java.util.stream.Collectors.toSet());
        Set<String> executionIds=new HashSet<>();
        if(!projects.isEmpty()){
            dashboardDataset("processExecutions").stream()
                    .filter(row->projects.contains("*")||projects.contains(String.valueOf(row.get("projectId"))))
                    .filter(row->actors.contains(String.valueOf(row.get("currentActorCode"))))
                    .map(row->String.valueOf(row.get("executionId"))).forEach(executionIds::add);
        }
        return rows.stream().filter(row->switch(dataset){
            case "actors" -> actors.contains(String.valueOf(row.get("actorCode")));
            case "assignments" -> account.equalsIgnoreCase(String.valueOf(row.get("accountId")));
            case "processes","cases","artifacts","developmentJobs" ->
                    processes.contains(String.valueOf(row.get("processCode")));
            case "steps" -> actors.contains(String.valueOf(row.get("actorCode")))
                    && processes.contains(String.valueOf(row.get("processCode")));
            case "processExecutions" -> (projects.contains("*")
                    ||projects.contains(String.valueOf(row.get("projectId"))))
                    && actors.contains(String.valueOf(row.get("currentActorCode")))
                    && !Boolean.TRUE.equals(row.get("domainOrphaned"));
            case "processExecutionEvents" -> executionIds.contains(String.valueOf(row.get("executionId")));
            case "emissionProjectTasks" -> (projects.contains("*")
                    || projects.contains(String.valueOf(row.get("projectId"))));
            case "workTypes" -> true;
            default -> false;
        }).toList();
    }

    public boolean isControlPlaneAdministrator(String accountId) {
        Integer count=jdbc.queryForObject("""
            select count(*)
              from comtnemplyrscrtyestbs security
              left join comtnemplyrinfo employee
                on employee.esntl_id=security.scrty_dtrmn_trget_id
              left join comtnentrprsmber member
                on member.esntl_id=security.scrty_dtrmn_trget_id
             where lower(coalesce(employee.emplyr_id,member.entrprs_mber_id,''))=lower(?)
               and security.author_code='ROLE_SYSTEM_MASTER'
            """,Integer.class,accountId);
        return count!=null&&count>0;
    }

    private Map<String, Object> camelCaseColumns(Map<String, Object> row) {
        Map<String, Object> converted = new LinkedHashMap<>();
        row.forEach((key, value) -> {
            StringBuilder name = new StringBuilder();
            boolean upper = false;
            for (char character : key.toCharArray()) {
                if (character == '_') {
                    upper = true;
                } else {
                    name.append(upper ? Character.toUpperCase(character) : character);
                    upper = false;
                }
            }
            converted.put(name.toString(), value);
        });
        return converted;
    }

    public Map<String,Object> dashboard() {
        Map<String,Object> out=new LinkedHashMap<>();
        out.put("actors",jdbc.queryForList("select actor_code as \"actorCode\",actor_name as \"actorName\",actor_name_en as \"actorNameEn\",actor_type as \"actorType\",purpose,capability_codes as \"capabilityCodes\",responsibility_text as responsibility,accountability_text as accountability,competency_requirements as competency,conflict_actor_codes as \"conflictActorCodes\",max_concurrent_assignments as \"maxConcurrentAssignments\",review_cycle_days as \"reviewCycleDays\",delegation_allowed as \"delegationAllowed\",use_at as \"useAt\" from framework_actor_definition order by actor_type,actor_code"));
        out.put("workTypes",jdbc.queryForList("select w.work_type_code as \"workTypeCode\",w.work_type_name as \"workTypeName\",w.work_type_name_en as \"workTypeNameEn\",w.description,w.sort_order as \"sortOrder\",w.use_at as \"useAt\",count(p.process_code) as \"processCount\",count(p.process_code) filter(where p.process_status='DEVELOPMENT_READY') as \"readyCount\",count(p.process_code) filter(where p.process_status='IN_DEVELOPMENT') as \"inDevelopmentCount\",count(p.process_code) filter(where p.process_status='DRAFT') as \"draftCount\" from framework_business_work_type w left join framework_process_definition p on upper(p.domain_code)=w.work_type_code group by w.work_type_code,w.work_type_name,w.work_type_name_en,w.description,w.sort_order,w.use_at order by w.sort_order,w.work_type_code"));
        out.put("assignments",jdbc.queryForList("select assignment_id as \"assignmentId\",account_id as \"accountId\",tenant_id as \"tenantId\",project_id as \"projectId\",actor_code as \"actorCode\",data_scope as \"dataScope\",valid_from as \"validFrom\",valid_until as \"validUntil\",assignment_status as \"status\" from framework_account_actor_assignment order by assignment_id desc limit 200"));
        out.put("deliveryBlueprints",jdbc.queryForList("select blueprint_code as \"blueprintCode\",blueprint_name as \"blueprintName\",blueprint_version as \"blueprintVersion\",domain_code as \"domainCode\",blueprint_status as \"blueprintStatus\",specification_hash as \"specificationHash\",specification::text as specification,approved_by as \"approvedBy\",approved_at as \"approvedAt\",updated_at as \"updatedAt\" from framework_project_delivery_blueprint order by updated_at desc"));
        out.put("deliveryReleases",jdbc.queryForList("select release_id as \"releaseId\",release_code as \"releaseCode\",blueprint_code as \"blueprintCode\",blueprint_version as \"blueprintVersion\",tenant_id as \"tenantId\",project_id as \"projectId\",release_status as \"releaseStatus\",validation_result::text as \"validationResult\",generation_result::text as \"generationResult\",requested_by as \"requestedBy\",created_at as \"createdAt\",promoted_at as \"promotedAt\" from framework_project_delivery_release order by created_at desc limit 100"));
        out.put("deliveryProjects",jdbc.queryForList("select project_id as \"projectId\",tenant_id as \"tenantId\",project_name as \"projectName\",project_status as \"projectStatus\" from emission_project_registry where project_status<>'DELETED' order by created_at desc limit 200"));
        out.put("designSelfHealingRuns",jdbc.queryForList("select run_id as \"runId\",route_key as \"routePath\",affected_process_codes as \"affectedProcessCodes\",run_status as \"runStatus\",regenerated_process_count as \"regeneratedProcessCount\",generated_screen_count as \"generatedScreenCount\",invalid_screen_count as \"invalidScreenCount\",build_required as \"buildRequired\",rollback_policy as \"rollbackPolicy\",executed_by as \"executedBy\",started_at as \"startedAt\",completed_at as \"completedAt\" from framework_design_self_healing_run order by started_at desc limit 20"));
        out.put("actorAccountReadiness",jdbc.queryForList("select assignment.account_id as \"accountId\",assignment.actor_code as \"actorCode\",assignment.tenant_id as \"tenantId\",assignment.project_id as \"projectId\",case when employee.emplyr_id is not null then 'EMPLOYEE' when member.entrprs_mber_id is not null then 'ENTERPRISE' else 'MISSING' end as \"accountType\",coalesce(security.author_code,'') as \"authorityCode\",case when assignment.project_id='*' then 'GLOBAL' when project_assignment.assignment_id is not null then 'READY' else 'DRIFT' end as \"workflowBinding\",case when coalesce(employee.emplyr_sttus_code,member.entrprs_mber_sttus,'') in ('P','A') and security.author_code is not null and (assignment.project_id='*' or project_assignment.assignment_id is not null) then 'READY' else 'CHECK_REQUIRED' end as \"readiness\" from framework_account_actor_assignment assignment left join comtnemplyrinfo employee on lower(employee.emplyr_id)=lower(assignment.account_id) left join comtnentrprsmber member on lower(member.entrprs_mber_id)=lower(assignment.account_id) left join comtnemplyrscrtyestbs security on security.scrty_dtrmn_trget_id=coalesce(employee.esntl_id,member.esntl_id) left join framework_project_actor_assignment project_assignment on project_assignment.project_id=assignment.project_id and project_assignment.actor_code=assignment.actor_code and lower(project_assignment.user_id)=lower(assignment.account_id) and project_assignment.active_yn='Y' where assignment.assignment_status='ACTIVE' order by case when assignment.project_id='*' then 1 else 0 end,assignment.project_id,assignment.actor_code,assignment.account_id limit 300"));
        out.put("processes",jdbc.queryForList("select p.process_code as \"processCode\",p.process_name as \"processName\",p.domain_code as \"domainCode\",p.process_version as \"version\",p.parent_process_code as \"parentProcessCode\",p.process_level as \"processLevel\",p.automation_mode as \"automationMode\",p.development_order as \"developmentOrder\",p.prerequisite_codes as \"prerequisiteCodes\",p.goal,p.start_condition as \"startCondition\",p.completion_condition as \"completionCondition\",p.process_status as \"status\",p.owner_actor_code as \"ownerActorCode\",p.risk_level as \"riskLevel\",p.sla_hours as \"slaHours\",p.review_cycle_days as \"reviewCycleDays\",p.regulation_refs as \"regulationRefs\",p.lifecycle_status as \"lifecycleStatus\",p.effective_from as \"effectiveFrom\",p.effective_until as \"effectiveUntil\",count(distinct s.step_id) as \"stepCount\",count(distinct c.case_code) as \"caseCount\",count(distinct c.case_code) filter(where c.case_status='APPROVED') as \"approvedCaseCount\",count(distinct r.run_id) filter(where r.result='PASSED') as \"passedRuns\",(select count(*) from framework_process_artifact a where a.process_code=p.process_code and a.required) as \"artifactCount\",(select count(*) from framework_process_artifact a where a.process_code=p.process_code and a.required and a.delivery_status='VERIFIED') as \"verifiedArtifactCount\" from framework_process_definition p left join framework_process_step s on s.process_code=p.process_code left join framework_simulation_case c on c.process_code=p.process_code left join framework_simulation_run r on r.case_code=c.case_code group by p.process_code order by p.development_order,p.process_code"));
        out.put("steps",jdbc.queryForList("select step_id as \"stepId\",process_code as \"processCode\",step_order as \"stepOrder\",step_code as \"stepCode\",step_name as \"stepName\",parent_step_code as \"parentStepCode\",step_type as \"stepType\",actor_code as \"actorCode\",from_state as \"fromState\",command_code as \"commandCode\",to_state as \"toState\",completion_rule as \"completionRule\",requirement_text as \"requirementText\",input_contract as \"inputContract\",output_contract as \"outputContract\",requires_user_page as \"requiresUserPage\",requires_admin_page as \"requiresAdminPage\",requires_api as \"requiresApi\",requires_database as \"requiresDatabase\",requires_notification as \"requiresNotification\",automation_status as \"automationStatus\",user_path as \"userPath\",admin_path as \"adminPath\",api_contract as \"apiContract\",sla_hours as \"slaHours\",escalation_actor_code as \"escalationActorCode\",evidence_required as \"evidenceRequired\",evidence_types as \"evidenceTypes\",segregation_actor_codes as \"segregationActorCodes\",rollback_command_code as \"rollbackCommandCode\",decision_rule as \"decisionRule\" from framework_process_step order by process_code,step_order"));
        out.put("stepExecutionSpecs",jdbc.queryForList("select process_code as \"processCode\",step_code as \"stepCode\",spec_version as \"specVersion\",field_contract::text as \"fieldContract\",command_contract::text as \"commandContract\",test_contract::text as \"testContract\",guide_contract::text as \"guideContract\",design_status as \"designStatus\",approval_status as \"approvalStatus\",generation_status as \"generationStatus\" from framework_step_execution_spec order by process_code,step_code"));
        out.put("cases",jdbc.queryForList("select case_code as \"caseCode\",process_code as \"processCode\",case_name as \"caseName\",case_type as \"caseType\",preconditions,steps_json as \"stepsJson\",assertions_json as \"assertionsJson\",case_status as \"status\" from framework_simulation_case order by process_code,case_code"));
        out.put("runs",jdbc.queryForList("select run_id as \"runId\",case_code as \"caseCode\",process_version as \"processVersion\",result,failure_reason as \"failureReason\",executed_by as \"executedBy\",executed_at as \"executedAt\" from framework_simulation_run order by run_id desc limit 100"));
        out.put("artifacts",jdbc.queryForList("select artifact_id as \"artifactId\",process_code as \"processCode\",step_code as \"stepCode\",artifact_code as \"artifactCode\",artifact_type as \"artifactType\",artifact_name as \"artifactName\",target_path as \"targetPath\",contract_ref as \"contractRef\",required,delivery_status as \"status\",owner_actor_code as \"ownerActorCode\",acceptance_criteria as \"acceptanceCriteria\",evidence_ref as \"evidenceRef\",notes from framework_process_artifact order by process_code,artifact_type,artifact_code"));
        out.put("developmentRules",jdbc.queryForList("select rule_code as \"ruleCode\",rule_group as \"ruleGroup\",rule_name as \"ruleName\",rule_description as \"ruleDescription\",verification_method as \"verificationMethod\",source_ref as \"sourceRef\",mandatory from framework_development_rule where use_at='Y' order by rule_group,rule_code"));
        out.put("developmentJobs",jdbc.queryForList("select job_id as \"jobId\",process_code as \"processCode\",step_code as \"stepCode\",job_type as \"jobType\",job_name as \"jobName\",target_path as \"targetPath\",job_status as \"jobStatus\",approval_status as \"approvalStatus\",execution_mode as \"executionMode\",job_group_code as \"jobGroupCode\",work_type_code as \"workTypeCode\",template_task_code as \"templateTaskCode\",required,progress_weight as \"progressWeight\",max_attempts as \"maxAttempts\",quality_status as \"qualityStatus\",quality_report as \"qualityReport\",search_context_ref as \"searchContextRef\",worker_id as \"workerId\",lease_until as \"leaseUntil\",attempt_count as \"attemptCount\",evidence_ref as \"evidenceRef\",rollback_ref as \"rollbackRef\",last_error as \"lastError\",created_at as \"createdAt\" from framework_development_job order by process_code,step_code,job_id"));
        out.put("developmentWorkTypes",jdbc.queryForList("select work_type_code as \"workTypeCode\",work_type_name as \"workTypeName\",description,execution_order as \"executionOrder\" from framework_development_work_type where active_yn='Y' order by execution_order,work_type_code"));
        out.put("developmentWorkTemplates",jdbc.queryForList("select work_type_code as \"workTypeCode\",task_code as \"taskCode\",task_name as \"taskName\",job_type as \"jobType\",trigger_scope as \"triggerScope\",task_order as \"taskOrder\",requirement_template as \"requirementTemplate\",required,auto_queue as \"autoQueue\" from framework_development_work_template where active_yn='Y' order by task_order,work_type_code,task_code"));
        out.put("assetCatalogSummary",jdbc.queryForList("select asset_type as \"assetType\",count(*) as count from framework_unified_asset where active_yn='Y' group by asset_type order by asset_type"));
        out.put("assetCatalogSyncRuns",jdbc.queryForList("select sync_run_id as \"syncRunId\",sync_scope as \"syncScope\",discovered_count as \"discoveredCount\",relation_count as \"relationCount\",changed_count as \"changedCount\",duration_ms as \"durationMs\",result,executed_by as \"executedBy\",executed_at as \"executedAt\" from framework_asset_catalog_sync_run order by sync_run_id desc limit 20"));
        out.put("jobDependencies",jdbc.queryForList("select d.job_id as \"jobId\",d.depends_on_job_id as \"dependsOnJobId\",d.dependency_type as \"dependencyType\",j.job_name as \"jobName\",p.job_name as \"dependsOnJobName\",p.job_status as \"dependsOnStatus\" from framework_development_job_dependency d join framework_development_job j on j.job_id=d.job_id join framework_development_job p on p.job_id=d.depends_on_job_id order by d.job_id,d.depends_on_job_id"));
        out.put("qualityGates",jdbc.queryForList("select gate_code as \"gateCode\",gate_name as \"gateName\",gate_group as \"gateScope\",mandatory,verification_command as \"verificationCommand\" from framework_quality_gate where use_at='Y' order by gate_group,gate_code"));
        out.put("qualityGateResults",jdbc.queryForList("select result_id as \"resultId\",job_id as \"jobId\",gate_code as \"gateCode\",result,summary,evidence_ref as \"evidenceRef\",checked_at as \"executedAt\" from framework_development_job_gate_result order by result_id desc limit 300"));
        out.put("processDevelopmentProgress",jdbc.queryForList("select process_code as \"processCode\",required_jobs as \"requiredJobs\",verified_jobs as \"verifiedJobs\",failed_jobs as \"failedJobs\",parallel_jobs as \"parallelJobs\",completion_percent as \"completionPercent\" from framework_process_development_progress order by process_code"));
        out.put("developmentEvents",jdbc.queryForList("select e.event_id as \"eventId\",e.job_id as \"jobId\",e.event_type as \"eventType\",e.from_status as \"fromStatus\",e.to_status as \"toStatus\",e.worker_id as \"workerId\",e.created_at as \"createdAt\" from framework_development_job_event e order by e.event_id desc limit 200"));
        out.put("rollbackRequests",jdbc.queryForList("select rollback_request_id as \"rollbackRequestId\",source_job_id as \"sourceJobId\",rollback_job_id as \"rollbackJobId\",rollback_ref as \"rollbackRef\",request_reason as \"requestReason\",request_status as \"requestStatus\",preflight_status as \"preflightStatus\",preflight_summary as \"preflightSummary\",requested_by as \"requestedBy\",requested_at as \"requestedAt\",approved_by as \"approvedBy\",approved_at as \"approvedAt\",completed_at as \"completedAt\" from framework_development_rollback_request order by rollback_request_id desc limit 200"));
        out.put("screenDevelopmentGates",jdbc.queryForList("select gate_run_id as \"gateRunId\",process_code as \"processCode\",step_code as \"stepCode\",route_path as \"routePath\",page_id as \"pageId\",gate_status as \"gateStatus\",readiness_score as \"readinessScore\",design_note_passed as \"designNotePassed\",selected_mockup_passed as \"selectedMockupPassed\",actor_contract_passed as \"actorContractPassed\",safety_tests_passed as \"safetyTestsPassed\",design_asset_checked as \"designAssetChecked\",failure_summary as \"failureSummary\",executed_by as \"executedBy\",executed_at as \"executedAt\" from framework_screen_development_gate_run order by gate_run_id desc limit 300"));
        out.put("commonFeaturePackages",jdbc.queryForList("select feature_code as \"featureCode\",feature_name as \"featureName\",feature_version as \"featureVersion\",feature_category as \"featureCategory\",description,api_contract as \"apiContract\",data_contract as \"dataContract\",ui_contract as \"uiContract\",event_contract as \"eventContract\",permission_contract as \"permissionContract\",test_contract as \"testContract\",install_strategy as \"installStrategy\" from framework_common_feature_package where active_yn='Y' order by feature_category,feature_code"));
        out.put("screenFeatureBindings",jdbc.queryForList("select process_code as \"processCode\",step_code as \"stepCode\",audience,route_path as \"routePath\",feature_code as \"featureCode\",binding_options as \"bindingOptions\",required_yn as \"requiredYn\" from framework_screen_feature_binding order by process_code,step_code,audience,route_path,feature_code"));
        out.put("featureInstallations",jdbc.queryForList("select project_scope as \"projectScope\",feature_code as \"featureCode\",installed_version as \"installedVersion\",installation_status as \"installationStatus\",configuration,evidence_ref as \"evidenceRef\",installed_by as \"installedBy\",installed_at as \"installedAt\" from framework_feature_installation order by project_scope,feature_code"));
        out.put("designValidationRuns",jdbc.queryForList("select validation_run_id as \"validationRunId\",process_code as \"processCode\",validation_status as \"validationStatus\",blocker_count as \"blockerCount\",warning_count as \"warningCount\",result_json as \"resultJson\",source_fingerprint as \"sourceFingerprint\",executed_by as \"executedBy\",executed_at as \"executedAt\" from framework_process_design_validation_run order by validation_run_id desc limit 100"));
        out.put("designAssurance",jdbc.queryForList("select process_code as \"processCode\",process_name as \"processName\",domain_code as \"domainCode\",assurance_status as \"assuranceStatus\",design_accuracy_score as \"designAccuracyScore\",design_blocker_count as \"designBlockerCount\",step_count as \"stepCount\",missing_actor_binding_count+unknown_actor_count as \"actorContractGaps\",incomplete_transition_count+unreachable_next_state_count as \"stateFlowGaps\",incomplete_business_rule_count as \"businessRuleGaps\",incomplete_data_contract_count as \"dataContractGaps\",missing_user_route_count+missing_admin_route_count as \"routeGaps\",missing_user_screen_contract_count+missing_admin_screen_contract_count as \"screenContractGaps\",missing_api_contract_count as \"apiContractGaps\",safety_test_type_count as \"safetyTestTypeCount\",approved_safety_test_type_count as \"approvedSafetyTestTypeCount\",required_job_count as \"requiredJobCount\",verified_job_count as \"verifiedJobCount\",blocked_job_count as \"blockedJobCount\",next_action as \"nextAction\" from framework_process_design_assurance_matrix order by design_blocker_count desc,design_accuracy_score,process_code"));
        out.put("designAssuranceSummary",jdbc.queryForMap("select count(*) as \"processCount\",count(*) filter(where assurance_status='IMPLEMENTATION_VERIFIED') as \"verifiedCount\",count(*) filter(where assurance_status='DESIGN_BLOCKED') as \"blockedCount\",count(*) filter(where assurance_status in ('IMPLEMENTATION_PENDING','REVIEW_REQUIRED')) as \"pendingCount\",coalesce(round(avg(design_accuracy_score),1),0) as \"averageAccuracyScore\" from framework_process_design_assurance_matrix"));
        out.put("executableScreenSummary",jdbc.queryForMap("select count(*) as \"screenCount\",count(*) filter(where design_ready) as \"designReadyCount\",count(*) filter(where executable_status='IMPLEMENTATION_PENDING') as \"implementationPendingCount\",count(*) filter(where executable_status='VERIFIED') as \"verifiedCount\",count(*) filter(where executable_status='DESIGN_BLOCKED') as \"blockedCount\" from framework_executable_screen_design_gate"));
        out.put("professionalDesignGraphSummary",jdbc.queryForMap("select process_count as \"processCount\",step_count as \"stepCount\",ready_step_count as \"readyStepCount\",blocked_step_count as \"blockedStepCount\",screen_binding_count as \"screenBindingCount\",capability_binding_count as \"capabilityBindingCount\",test_binding_count as \"testBindingCount\" from framework_professional_design_graph_summary"));
        out.put("professionalDesignGraphBlockers",jdbc.queryForList("select q.process_code as \"processCode\",p.process_name as \"processName\",q.step_code as \"stepCode\",s.step_name as \"stepName\",array_to_string(q.blocker_codes, ', ') as \"blockerCodes\",q.screen_binding_count as \"screenBindingCount\",q.capability_count as \"capabilityCount\",q.input_count as \"inputCount\",q.output_count as \"outputCount\",q.test_family_count as \"testFamilyCount\" from framework_professional_design_graph_quality q join framework_process_definition p using(process_code) join framework_process_step s using(process_code,step_code) where q.design_status='BLOCKED' order by p.development_order,s.step_order"));
        out.put("sharedProfessionalScreens",jdbc.queryForList("select r.screen_resource_id as \"screenResourceId\",r.route_key as \"routePath\",r.screen_name as \"screenName\",r.implementation_status as \"implementationStatus\",count(distinct b.process_code) as \"processCount\",count(distinct (b.process_code,b.step_code)) as \"stepCount\" from framework_screen_resource r join framework_process_step_screen_binding b using(screen_resource_id) where b.binding_status='ACTIVE' group by r.screen_resource_id having count(distinct (b.process_code,b.step_code))>1 order by count(distinct (b.process_code,b.step_code)) desc,r.route_key limit 100"));
        out.put("professionalDesignGenerationRuns",jdbc.queryForList("select run_id as \"runId\",requested_process_code as \"requestedProcessCode\",run_status as \"runStatus\",generated_process_count as \"generatedProcessCount\",generated_step_count as \"generatedStepCount\",generated_screen_count as \"generatedScreenCount\",blocker_count as \"blockerCount\",duration_ms as \"durationMs\",requested_by as \"requestedBy\",started_at as \"startedAt\",completed_at as \"completedAt\" from framework_design_generation_run order by run_id desc limit 20"));
        out.put("projectProcessDeliveryPlan",jdbc.queryForList("select delivery_order as \"deliveryOrder\",process_code as \"processCode\",process_name as \"processName\",domain_code as \"domainCode\",step_count as \"stepCount\",project_count as \"projectCount\",assurance_status as \"assuranceStatus\",design_accuracy_score as \"designAccuracyScore\",next_action as \"nextAction\",selection_status as \"selectionStatus\" from framework_project_process_sequential_delivery order by delivery_order"));
        out.put("processExecutions",jdbc.queryForList("select execution_id as \"executionId\",tenant_id as \"tenantId\",project_id as \"projectId\",process_code as \"processCode\",current_step_code as \"currentStepCode\",execution_status as \"executionStatus\",current_state as \"currentState\",initiated_by_actor as \"initiatedByActor\",initiated_by as \"initiatedBy\",started_at as \"startedAt\",completed_at as \"completedAt\" from framework_process_execution order by started_at desc limit 100"));
        out.put("processExecutionEvents",jdbc.queryForList("select event_id as \"eventId\",execution_id as \"executionId\",step_code as \"stepCode\",actor_code as \"actorCode\",command_code as \"commandCode\",from_state as \"fromState\",to_state as \"toState\",idempotency_key as \"idempotencyKey\",executed_by as \"executedBy\",executed_at as \"executedAt\" from framework_process_execution_event order by event_id desc limit 300"));
        out.put("screenTypes",jdbc.queryForList("select screen_type as \"screenType\",screen_type_name as \"screenTypeName\",required_sections as \"requiredSections\",default_test_expectations as \"testExpectations\",development_weight as \"developmentWeight\" from framework_screen_type where use_at='Y' order by screen_type"));
        out.put("referenceSummary",jdbc.queryForMap("select count(*) as \"assetCount\",count(distinct process_code) as \"mappedProcesses\",count(*) filter(where analysis_status='ANALYZED') as \"analyzedCount\",coalesce(round(avg(confidence),1),0) as \"averageConfidence\" from framework_reference_asset"));
        out.put("referenceAssets",jdbc.queryForList("select reference_id as \"referenceId\",source_name as \"sourceName\",source_type as \"sourceType\",domain_code as \"domainCode\",screen_type as \"screenType\",process_code as \"processCode\",analysis_status as \"analysisStatus\",confidence from framework_reference_asset order by reference_id desc limit 300"));
        out.put("automationMetrics",jdbc.queryForList("select metric_type as \"metricType\",metric_value as \"metricValue\",sample_count as \"sampleCount\",measured_at as \"measuredAt\" from framework_automation_metric order by metric_id desc limit 50"));
        out.put("screenBlueprints",jdbc.queryForList("select blueprint_id as \"blueprintId\",blueprint_code as \"blueprintCode\",process_code as \"processCode\",step_code as \"stepCode\",actor_code as \"actorCode\",audience,page_id as \"pageId\",page_name as \"pageName\",route_path as \"routePath\",screen_type as \"screenType\",template_code as \"templateCode\",implementation_strategy as \"implementationStrategy\",transition_status as \"transitionStatus\",validation_status as \"validationStatus\",validation_message as \"validationMessage\" from framework_screen_blueprint order by blueprint_id desc limit 1000"));
        out.put("reverseDesignCoverage",jdbc.queryForList("select page_id as \"pageId\",page_name as \"pageName\",route_path as \"routePath\",domain_code as \"domainCode\",blueprint_code as \"blueprintCode\",process_code as \"processCode\",step_code as \"stepCode\",actor_code as \"actorCode\",audience,validation_status as \"validationStatus\",implementation_strategy as \"implementationStrategy\",design_readiness_score as \"designReadinessScore\",source_path as \"sourcePath\",reverse_registration_status as status from framework_existing_screen_reverse_design_coverage order by case reverse_registration_status when 'GENERATOR_READY' then 4 when 'SOURCE_ASSET_MISSING' then 3 when 'DETAIL_DESIGN_INCOMPLETE' then 2 when 'PROFESSIONAL_CONTRACT_MISSING' then 1 else 0 end,route_path limit 1000"));
        out.put("reverseDesignSummary",jdbc.queryForMap("select count(*) as total,count(*) filter(where reverse_registration_status='GENERATOR_READY') as \"generatorReady\",count(*) filter(where reverse_registration_status='BLUEPRINT_MISSING') as \"blueprintMissing\",count(*) filter(where reverse_registration_status='PROFESSIONAL_CONTRACT_MISSING') as \"contractMissing\",count(*) filter(where reverse_registration_status='DETAIL_DESIGN_INCOMPLETE') as \"designIncomplete\",count(*) filter(where reverse_registration_status='SOURCE_ASSET_MISSING') as \"sourceMissing\" from framework_existing_screen_reverse_design_coverage"));
        out.put("generationBatches",jdbc.queryForList("select batch_id as \"batchId\",batch_code as \"batchCode\",batch_name as \"batchName\",process_code as \"processCode\",requested_count as \"requestedCount\",compiled_count as \"compiledCount\",valid_count as \"validCount\",invalid_count as \"invalidCount\",queued_count as \"queuedCount\",batch_status as \"batchStatus\",dry_run as \"dryRun\",requested_by as \"requestedBy\",created_at as \"createdAt\",completed_at as \"completedAt\" from framework_screen_generation_batch order by batch_id desc limit 30"));
        out.put("professionalReadiness",jdbc.queryForList("select process_code as \"processCode\",process_name as \"processName\",lifecycle_status as \"lifecycleStatus\",risk_level as \"riskLevel\",readiness_score as \"readinessScore\",readiness_gaps as \"readinessGaps\",step_count as \"stepCount\",scenario_type_count as \"scenarioTypeCount\",approved_case_count as \"approvedCaseCount\",case_count as \"caseCount\" from framework_process_professional_readiness order by readiness_score,process_code"));
        out.put("professionalSummary",jdbc.queryForMap("select count(*) as \"totalProcesses\",count(*) filter(where readiness_score=100) as \"expertReadyProcesses\",count(*) filter(where readiness_score<80) as \"highRiskProcesses\",coalesce(round(avg(readiness_score),1),0) as \"averageScore\" from framework_process_professional_readiness"));
        out.put("professionalScreenContracts",jdbc.queryForList("select contract_id as \"contractId\",process_code as \"processCode\",step_code as \"stepCode\",audience,route_path as \"routePath\",screen_name as \"screenName\",actor_code as \"actorCode\",business_purpose as \"businessPurpose\",entry_condition as \"entryCondition\",exit_condition as \"exitCondition\",kpi_contract as \"kpiContract\",section_contract as \"sectionContract\",field_contract as \"fieldContract\",command_contract as \"commandContract\",state_contract as \"stateContract\",api_contract as \"apiContract\",data_contract as \"dataContract\",evidence_contract as \"evidenceContract\",responsive_contract as \"responsiveContract\",accessibility_contract as \"accessibilityContract\",security_contract as \"securityContract\",api_verified as \"apiVerified\",database_verified as \"databaseVerified\",authority_verified as \"authorityVerified\",responsive_verified as \"responsiveVerified\",accessibility_verified as \"accessibilityVerified\",exception_states_verified as \"exceptionStatesVerified\",audit_evidence_ref as \"auditEvidenceRef\",contract_status as \"contractStatus\",readiness_score as \"readinessScore\",readiness_gaps as \"readinessGaps\" from framework_professional_screen_readiness order by process_code,step_code,audience"));
        out.put("professionalScreenSummary",jdbc.queryForMap("select count(*) as \"totalScreens\",count(*) filter(where readiness_score=100) as \"completeScreens\",count(*) filter(where readiness_score<100) as \"blockedScreens\",coalesce(round(avg(readiness_score),1),0) as \"averageScore\" from framework_professional_screen_readiness"));
        out.put("pageDesigns",jdbc.queryForList("select page_design_id as \"pageDesignId\",process_code as \"processCode\",step_code as \"stepCode\",audience,page_code as \"pageCode\",page_title as \"pageTitle\",page_purpose as \"pagePurpose\",screen_type as \"screenType\",planned_route_path as \"plannedRoutePath\",coalesce(actual_route_path,'') as \"actualRoutePath\",route_status as \"routeStatus\",primary_entity as \"primaryEntity\",actor_code as \"actorCode\",coalesce(upstream_step_code,'') as \"upstreamStepCode\",coalesce(downstream_step_code,'') as \"downstreamStepCode\",field_count as \"fieldCount\",required_field_count as \"requiredFieldCount\",list_field_count as \"listFieldCount\",search_field_count as \"searchFieldCount\",db_resolved_field_count as \"dbResolvedFieldCount\",implementation_field_count as \"implementationFieldCount\",evidence_field_count as \"evidenceFieldCount\",field_summary as \"fieldSummary\",readiness_status as \"readinessStatus\" from framework_page_design_readiness order by process_code,step_code,audience limit 2000"));
        out.put("pageDesignSummary",jdbc.queryForMap("select page_count as \"pageCount\",implemented_page_count as \"implementedPageCount\",design_only_page_count as \"designOnlyPageCount\",field_count as \"fieldCount\",required_field_count as \"requiredFieldCount\",db_resolved_field_count as \"dbResolvedFieldCount\",implementation_field_count as \"implementationFieldCount\",incomplete_page_count as \"incompletePageCount\",handoff_count as \"handoffCount\" from framework_page_design_summary"));
        out.put("processPageDesignCoverage",jdbc.queryForList("select process_code as \"processCode\",page_design_count as \"pageDesignCount\",user_page_count as \"userPageCount\",admin_page_count as \"adminPageCount\",field_count as \"fieldCount\",required_field_count as \"requiredFieldCount\",db_resolved_field_count as \"dbResolvedFieldCount\",implementation_field_count as \"implementationFieldCount\",field_contract_gap_count as \"fieldContractGapCount\",implementation_pending_page_count as \"implementationPendingPageCount\",handoff_count as \"handoffCount\",page_design_status as \"pageDesignStatus\" from framework_process_page_design_assurance order by process_code"));
        out.put("professionalFactoryRuns",jdbc.queryForList("select run_id as \"runId\",process_code as \"processCode\",requested_actor_code as \"requestedActorCode\",run_status as \"runStatus\",menu_count as \"menuCount\",screen_count as \"screenCount\",scenario_count as \"scenarioCount\",development_job_count as \"developmentJobCount\",blocked_step_count as \"blockedStepCount\",requested_by as \"requestedBy\",started_at as \"startedAt\",completed_at as \"completedAt\" from framework_professional_factory_run order by started_at desc limit 50"));
        out.put("designDeliveryRevisions",jdbc.queryForList("select process_code as \"processCode\",design_hash as \"designHash\",delivery_status as \"deliveryStatus\",step_count as \"stepCount\",development_job_count as \"developmentJobCount\",generation_batch_id as \"generationBatchId\",executed_by as \"executedBy\",executed_at as \"executedAt\" from framework_design_delivery_revision order by executed_at desc"));
        out.put("projectCompletionRuns",jdbc.queryForList("select run_id as \"runId\",run_status as \"runStatus\",selected_process_count as \"selectedProcessCount\",executable_job_count as \"executableJobCount\",retried_job_count as \"retriedJobCount\",completed_process_count as \"completedProcessCount\",blocked_process_count as \"blockedProcessCount\",started_at as \"startedAt\",completed_at as \"completedAt\" from framework_project_completion_run order by started_at desc limit 50"));
        out.put("screenAssetAssemblies",jdbc.queryForList("select contract_id as \"contractId\",process_code as \"processCode\",step_code as \"stepCode\",audience,route_path as \"routePath\",screen_name as \"screenName\",asset_count as \"assetCount\",ready_asset_count as \"readyAssetCount\",gap_asset_count as \"gapAssetCount\",assembly_score as \"assemblyScore\",assembly_status as \"assemblyStatus\" from framework_screen_asset_assembly_summary order by process_code,step_code,audience"));
        out.put("projectRegistrationCoverage",jdbc.queryForList("select requirement_code as \"requirementCode\",requirement_group as \"requirementGroup\",requirement_name as \"requirementName\",mandatory,lifecycle_phase as \"lifecyclePhase\",implementation_status as \"implementationStatus\",target_route as \"targetRoute\",management_route as \"managementRoute\",data_owner as \"dataOwner\",common_code_group as \"commonCodeGroup\",actor_codes as \"actorCodes\",acceptance_criteria as \"acceptanceCriteria\",implementation_note as \"implementationNote\",coverage_score as \"coverageScore\",recommended_action as \"recommendedAction\" from framework_project_registration_coverage order by sort_order"));
        out.put("projectRegistrationSummary",jdbc.queryForMap("select count(*) as \"total\",count(*) filter(where implementation_status='SUPPORTED') as \"supported\",count(*) filter(where implementation_status='PARTIAL') as \"partial\",count(*) filter(where implementation_status='MISSING') as \"missing\",coalesce(round(avg(coverage_score),1),0) as \"averageScore\" from framework_project_registration_coverage"));
        out.put("customerJourneyGaps",jdbc.queryForList("select gap_type as \"gapType\",object_code as \"objectCode\",object_name as \"objectName\",target_url as \"targetUrl\",severity,reason,remediation from framework_customer_journey_gap order by case severity when 'BLOCKER' then 0 else 1 end,gap_type,object_code"));
        out.put("customerJourneySummary",jdbc.queryForMap("select total_gaps as \"totalGaps\",blocker_gaps as \"blockerGaps\",warning_gaps as \"warningGaps\",dead_menu_gaps as \"deadMenuGaps\",task_route_gaps as \"taskRouteGaps\",registration_gaps as \"registrationGaps\" from framework_customer_journey_quality_summary"));
        out.put("actorProcessMenus",jdbc.queryForList("select menu_code as \"menuCode\",menu_nm as \"menuName\",menu_url as \"menuUrl\",audience,process_code as \"processCode\",step_code as \"stepCode\",actor_code as \"actorCode\",binding_status as \"bindingStatus\" from framework_actor_process_menu_coverage order by audience,menu_code"));
        out.put("actorProcessMenuSummary",jdbc.queryForMap("select navigable_menu_count as \"navigableMenuCount\",bound_menu_count as \"boundMenuCount\",missing_menu_count as \"missingMenuCount\",connected_process_count as \"connectedProcessCount\",connected_actor_count as \"connectedActorCount\" from framework_actor_process_menu_summary"));
        out.put("processArchetypes",jdbc.queryForList("select a.archetype_code as \"archetypeCode\",a.archetype_name as \"archetypeName\",a.category_code as \"categoryCode\",a.purpose,a.input_contract::text as \"inputContract\",a.output_contract::text as \"outputContract\",a.command_contract::text as \"commandContract\",a.state_contract::text as \"stateContract\",a.exception_contract::text as \"exceptionContract\",a.test_contract::text as \"testContract\",array_to_string(a.recommended_screen_types,', ') as \"recommendedScreenTypes\",c.screen_count as \"screenCount\",c.process_count as \"processCount\",c.actor_count as \"actorCount\",c.primary_binding_count as \"primaryBindingCount\" from framework_process_archetype a join framework_process_archetype_coverage c using(archetype_code) where a.active_yn='Y' order by a.sort_order,a.archetype_code"));
        out.put("screenArchetypeBindings",jdbc.queryForList("select binding_id as \"bindingId\",route_path as \"routePath\",archetype_code as \"archetypeCode\",binding_role as \"bindingRole\",process_code as \"processCode\",step_code as \"stepCode\",actor_code as \"actorCode\",entry_condition as \"entryCondition\",completion_condition as \"completionCondition\",binding_options::text as \"bindingOptions\",sort_order as \"sortOrder\",created_by as \"createdBy\",updated_at as \"updatedAt\" from framework_screen_process_archetype_binding where active_yn='Y' order by route_path,case binding_role when 'PRIMARY' then 0 else 1 end,sort_order,binding_id"));
        out.put("backendProcessReadiness",jdbc.queryForList("select process_code as \"processCode\",process_name as \"processName\",domain_code as \"domainCode\",owner_actor_code as \"ownerActorCode\",step_count as \"stepCount\",contracted_steps as \"contractedSteps\",passed_backend_tests as \"passedBackendTests\",backend_test_count as \"backendTestCount\",backend_readiness_score as \"backendReadinessScore\",backend_gaps as \"backendGaps\" from framework_backend_process_readiness order by backend_readiness_score,process_code"));
        out.put("backendProcessSummary",jdbc.queryForMap("select count(*) as \"processCount\",count(*) filter(where backend_readiness_score=100) as \"completeCount\",count(*) filter(where backend_readiness_score<100) as \"incompleteCount\",coalesce(round(avg(backend_readiness_score),1),0) as \"averageScore\" from framework_backend_process_readiness"));
        out.put("deliveryQueue",jdbc.queryForList("select process_code as \"processCode\",process_name as \"processName\",domain_code as \"domainCode\",development_order as \"developmentOrder\",process_status as \"processStatus\",step_count as \"stepCount\",actor_bound_steps as \"actorBoundSteps\",test_count as \"testCount\",test_type_count as \"testTypeCount\",passed_tests as \"passedTests\",required_tasks as \"requiredTasks\",completed_tasks as \"completedTasks\",blocked_tasks as \"blockedTasks\",required_artifacts as \"requiredArtifacts\",verified_artifacts as \"verifiedArtifacts\",screen_contracts as \"screenContracts\",ready_screens as \"readyScreens\",completion_score as \"completionScore\",next_action as \"nextAction\",delivery_priority as priority from framework_process_delivery_priority_queue order by case delivery_priority when 'BLOCKER' then 0 when 'HIGH' then 1 when 'MEDIUM' then 2 when 'LOW' then 3 else 4 end,development_order,process_code"));
        out.put("deliverySummary",jdbc.queryForMap("select count(*) as \"totalProcesses\",count(*) filter(where next_action='COMPLETE') as \"completeProcesses\",count(*) filter(where delivery_priority='BLOCKER') as blockers,count(*) filter(where delivery_priority='HIGH') as \"highPriority\",coalesce(round(avg(completion_score),1),0) as \"averageScore\" from framework_process_delivery_priority_queue"));
        out.put("summary",jdbc.queryForMap("select count(*) as \"processCount\",count(*) filter(where process_status='DEVELOPMENT_READY') as \"readyCount\",count(*) filter(where process_status<>'DEVELOPMENT_READY') as \"draftCount\",coalesce(round(100.0*count(*) filter(where process_status='DEVELOPMENT_READY')/nullif(count(*),0)),0) as \"readinessPercent\" from framework_process_definition"));
        return out;
    }

    /**
     * Small, bounded bootstrap payload for the interactive control plane.
     * The complete dashboard contains large design and evidence datasets and can
     * exceed the browser/gateway response deadline.  Keep the first paint and
     * project-delivery transaction independent from those optional datasets.
     */
    public Map<String,Object> dashboardCore() {
        Map<String,Object> out=new LinkedHashMap<>();
        out.put("actors", dashboardDataset("actors"));
        out.put("workTypes", dashboardDataset("workTypes"));
        out.put("assignments", dashboardDataset("assignments"));
        out.put("processes", dashboardDataset("processes"));
        out.put("steps", dashboardDataset("steps"));
        out.put("cases", dashboardDataset("cases"));
        out.put("artifacts", dashboardDataset("artifacts"));
        out.put("developmentJobs", dashboardDataset("developmentJobs"));
        out.put("processExecutions", dashboardDataset("processExecutions"));
        out.put("processClosing", processClosingStatus());
        out.put("deliveryBlueprints",jdbc.queryForList("select blueprint_code as \"blueprintCode\",blueprint_name as \"blueprintName\",blueprint_version as \"blueprintVersion\",domain_code as \"domainCode\",blueprint_status as \"blueprintStatus\",specification_hash as \"specificationHash\",specification::text as specification,approved_by as \"approvedBy\",approved_at as \"approvedAt\",updated_at as \"updatedAt\" from framework_project_delivery_blueprint order by updated_at desc"));
        out.put("deliveryReleases",jdbc.queryForList("select release_id as \"releaseId\",release_code as \"releaseCode\",blueprint_code as \"blueprintCode\",blueprint_version as \"blueprintVersion\",tenant_id as \"tenantId\",project_id as \"projectId\",release_status as \"releaseStatus\",validation_result::text as \"validationResult\",generation_result::text as \"generationResult\",requested_by as \"requestedBy\",created_at as \"createdAt\",promoted_at as \"promotedAt\" from framework_project_delivery_release order by created_at desc limit 100"));
        out.put("deliveryProjects",jdbc.queryForList("select project_id as \"projectId\",tenant_id as \"tenantId\",project_name as \"projectName\",project_status as \"projectStatus\" from emission_project_registry where project_status<>'DELETED' order by created_at desc limit 200"));
        out.put("summary",Map.of(
                "readyCount",jdbc.queryForObject("select count(*) from framework_process_definition where process_status='DEVELOPMENT_READY'",Long.class),
                "readinessPercent",jdbc.queryForObject("select case when count(*)=0 then 0 else round(100.0*count(*) filter(where process_status='DEVELOPMENT_READY')/count(*),1) end from framework_process_definition",BigDecimal.class)));
        return out;
    }

    /**
     * Separates process-design closure from implementation completion.
     * A process is design-closed only when its actor, state, business rule,
     * input/output, route, API, evidence, sequence and five safety-test
     * contracts have no blocker. Implementation evidence is reported as a
     * separate downstream gate and can never make an incomplete design look
     * closed.
     */
    public Map<String,Object> processClosingStatus() {
        List<Map<String,Object>> rows=jdbc.queryForList("""
            select process_code as "processCode",process_name as "processName",
                   domain_code as "domainCode",step_count as "stepCount",
                   design_blocker_count as "designBlockerCount",
                   approved_safety_test_type_count as "approvedSafetyTestTypeCount",
                   missing_actor_binding_count+unknown_actor_count as "actorGaps",
                   incomplete_transition_count+unreachable_next_state_count as "stateGaps",
                   incomplete_business_rule_count as "businessRuleGaps",
                   incomplete_data_contract_count as "dataContractGaps",
                   missing_user_route_count+missing_admin_route_count as "routeGaps",
                   missing_user_screen_contract_count+missing_admin_screen_contract_count as "screenContractGaps",
                   missing_api_contract_count as "apiContractGaps",
                   missing_evidence_contract_count as "evidenceGaps",
                   missing_sequence_count as "sequenceGaps",
                   required_job_count as "requiredJobs",verified_job_count as "verifiedJobs",
                   definition_locked as "implementationSourceLocked",
                   case
                     when design_blocker_count=0 and approved_safety_test_type_count=5 then 'PROCESS_DESIGN_CLOSED'
                     when design_blocker_count=0 then 'SAFETY_REVIEW_REQUIRED'
                     else 'PROCESS_DESIGN_BLOCKED'
                   end as "closingStatus",
                   case
                     when design_blocker_count=0 and approved_safety_test_type_count=5 then 'SCREEN_DESIGN_CLOSING'
                     else coalesce(nullif(next_action,''),'PROCESS_DESIGN_REPAIR')
                   end as "nextAction"
              from framework_process_design_assurance_matrix
             order by case when design_blocker_count=0 and approved_safety_test_type_count=5 then 1 else 0 end,
                      design_blocker_count desc,process_code
            """);
        Map<String,Object> summary=jdbc.queryForMap("""
            select count(*) as "totalProcesses",coalesce(sum(step_count),0) as "totalSteps",
                   count(*) filter(where design_blocker_count=0 and approved_safety_test_type_count=5) as "closedProcesses",
                   count(*) filter(where design_blocker_count=0 and approved_safety_test_type_count<5) as "reviewRequiredProcesses",
                   count(*) filter(where design_blocker_count>0) as "blockedProcesses",
                   coalesce(sum(design_blocker_count),0) as "structuralBlockers",
                   coalesce(sum(missing_user_route_count+missing_admin_route_count),0) as "missingRoutes",
                   count(*) filter(where assurance_status='IMPLEMENTATION_VERIFIED') as "implementationClosedProcesses"
              from framework_process_design_assurance_matrix
            """);
        return Map.of("summary",summary,"rows",rows,"evaluatedAt",java.time.Instant.now().toString());
    }

    @Transactional
    public Map<String,Object> auditProcessClosing(String actor) {
        jdbc.queryForMap("select * from framework_audit_all_process_designs(?)",actor);
        Map<String,Object> result=new LinkedHashMap<>(processClosingStatus());
        result.put("success",true);
        result.put("auditedBy",actor);
        return result;
    }

    @Transactional
    public Map<String,Object> bindScreenProcessArchetype(Map<String,Object> body,String actor){
        String route=ScreenDevelopmentNoteService.cleanRoute(req(body,"routePath"));
        String archetype=req(body,"archetypeCode").trim().toUpperCase(Locale.ROOT);
        String role=def(body,"bindingRole","PRIMARY").trim().toUpperCase(Locale.ROOT);
        String process=req(body,"processCode").trim().toUpperCase(Locale.ROOT);
        String step=req(body,"stepCode").trim().toUpperCase(Locale.ROOT);
        String actorCode=req(body,"actorCode").trim().toUpperCase(Locale.ROOT);
        String entryCondition=req(body,"entryCondition").trim();
        String completionCondition=req(body,"completionCondition").trim();
        String bindingOptions=def(body,"bindingOptions","{}");
        if(!Set.of("PRIMARY","SUBPROCESS","EXCEPTION","COMMON").contains(role))throw new IllegalArgumentException("Unsupported bindingRole: "+role);
        validateJsonObject(bindingOptions,"bindingOptions");
        Integer archetypeCount=jdbc.queryForObject("select count(*) from framework_process_archetype where archetype_code=? and active_yn='Y'",Integer.class,archetype);
        if(archetypeCount==null||archetypeCount==0)throw new IllegalArgumentException("ACTIVE_ARCHETYPE_NOT_FOUND: "+archetype);
        Integer screenCount=jdbc.queryForObject("select count(*) from framework_screen_resource where route_key=lower(split_part(?,'?',1))",Integer.class,route);
        if(screenCount==null||screenCount==0)throw new IllegalArgumentException("REGISTERED_SCREEN_NOT_FOUND: "+route);
        Integer stepCount=jdbc.queryForObject("select count(*) from framework_process_step where process_code=? and step_code=?",Integer.class,process,step);
        if(stepCount==null||stepCount==0)throw new IllegalArgumentException("REGISTERED_PROCESS_STEP_NOT_FOUND: "+process+" / "+step);
        Integer actorCount=jdbc.queryForObject("select count(*) from framework_actor_definition where actor_code=? and use_at='Y'",Integer.class,actorCode);
        if(actorCount==null||actorCount==0)throw new IllegalArgumentException("ACTIVE_ACTOR_NOT_FOUND: "+actorCode);
        if("PRIMARY".equals(role))jdbc.update("update framework_screen_process_archetype_binding set active_yn='N',updated_at=current_timestamp where route_path=? and binding_role='PRIMARY' and active_yn='Y'",route);
        jdbc.update("delete from framework_screen_process_archetype_binding where route_path=? and archetype_code=? and coalesce(process_code,'')=? and coalesce(step_code,'')=?",
            route,archetype,process,step);
        jdbc.update("insert into framework_screen_process_archetype_binding(route_path,archetype_code,binding_role,process_code,step_code,actor_code,entry_condition,completion_condition,binding_options,sort_order,created_by) values(?,?,?,nullif(?,''),nullif(?,''),nullif(?,''),nullif(?,''),nullif(?,''),?::jsonb,?,?)",
            route,archetype,role,process,step,actorCode,entryCondition,completionCondition,bindingOptions,integerOr(body,"sortOrder",1),actor);
        Map<String,Object> coverage=jdbc.queryForMap("select count(*) as \"bindingCount\",count(*) filter(where binding_role='PRIMARY') as \"primaryCount\",count(distinct archetype_code) as \"archetypeCount\" from framework_screen_process_archetype_binding where route_path=? and active_yn='Y'",route);
        return Map.of("success",true,"routePath",route,"archetypeCode",archetype,"bindingRole",role,"coverage",coverage);
    }

    public Map<String,Object> executableScreens(String requestedStatus,int requestedPage,int requestedSize) {
        String status=requestedStatus==null?"":requestedStatus.trim().toUpperCase(Locale.ROOT);
        int page=Math.max(0,requestedPage);
        int size=Math.max(1,Math.min(requestedSize,200));
        int offset=page*size;
        Map<String,Object> out=new LinkedHashMap<>();
        out.put("summary",jdbc.queryForMap("select count(*) as \"screenCount\",count(*) filter(where design_ready) as \"designReadyCount\",count(*) filter(where executable_status='IMPLEMENTATION_PENDING') as \"implementationPendingCount\",count(*) filter(where executable_status='VERIFIED') as \"verifiedCount\",count(*) filter(where executable_status='DESIGN_BLOCKED') as \"blockedCount\" from framework_executable_screen_design_gate"));
        out.put("page",page);
        out.put("size",size);
        out.put("total",jdbc.queryForObject("select count(*) from framework_vertical_screen_design_map where (?='' or executable_status=?)",Long.class,status,status));
        out.put("items",jdbc.queryForList("select global_sequence as \"globalSequence\",page_design_id as \"pageDesignId\",page_code as \"pageCode\",page_title as \"pageTitle\",process_code as \"processCode\",process_name as \"processName\",step_order as \"stepOrder\",step_code as \"stepCode\",step_name as \"stepName\",audience,actor_code as \"actorCode\",route_key as \"routeKey\",executable_status as \"executableStatus\",array_to_string(blocker_codes, ', ') as \"blockerCodes\",next_action as \"nextAction\",previous_page_design_id as \"previousPageDesignId\",next_page_design_id as \"nextPageDesignId\" from framework_vertical_screen_design_map where (?='' or executable_status=?) order by global_sequence limit ? offset ?",status,status,size,offset));
        return out;
    }

    public Map<String,Object> simulationCases(String requestedProcess) {
        String process=req(Map.of("processCode",requestedProcess),"processCode");
        List<Map<String,Object>> cases=jdbc.queryForList(
            "select case_code as \"caseCode\",process_code as \"processCode\",case_name as \"caseName\",case_type as \"caseType\",case_status as \"status\" " +
            "from framework_simulation_case where process_code=? order by case_type,case_code",
            process
        );
        return Map.of("success",true,"processCode",process,"count",cases.size(),"cases",cases);
    }

    /**
     * Compact, process-scoped design projection for runtime gates and focused
     * clients. The full governance dashboard is intentionally broad and can be
     * tens of megabytes; validators must not depend on that aggregate payload.
     */
    public Map<String,Object> processDesign(String requestedProcess) {
        String process=req(Map.of("processCode",requestedProcess),"processCode");
        List<Map<String,Object>> definitions=jdbc.queryForList(
            "select process_code as \"processCode\",process_name as \"processName\",domain_code as \"domainCode\",goal,start_condition as \"startCondition\",completion_condition as \"completionCondition\",owner_actor_code as \"ownerActorCode\",process_status as \"processStatus\",risk_level as \"riskLevel\",sla_hours as \"slaHours\",review_cycle_days as \"reviewCycleDays\" " +
            "from framework_process_definition where process_code=?",
            process
        );
        if(definitions.isEmpty())throw new IllegalArgumentException("프로세스가 존재하지 않습니다: "+process);
        List<Map<String,Object>> steps=jdbc.queryForList(
            "select process_code as \"processCode\",step_code as \"stepCode\",step_name as \"stepName\",step_order as \"stepOrder\",actor_code as \"actorCode\",from_state as \"fromState\",command_code as \"commandCode\",to_state as \"toState\",requirement_text as \"requirementText\",completion_rule as \"completionRule\",input_contract as \"inputContract\",output_contract as \"outputContract\",user_path as \"userPath\",admin_path as \"adminPath\",api_contract as \"apiContract\" " +
            "from framework_process_step where process_code=? order by step_order",
            process
        );
        List<Map<String,Object>> specs=jdbc.queryForList(
            "select step_code as \"stepCode\",field_contract::text as \"fieldContract\",business_contract::text as \"businessContract\",guide_contract::text as \"guideContract\",design_status as \"designStatus\",approval_status as \"approvalStatus\",generation_status as \"generationStatus\" " +
            "from framework_step_execution_spec where process_code=? order by step_code",
            process
        );
        List<Map<String,Object>> screens=jdbc.queryForList(
            "select step_code as \"stepCode\",audience,route_path as \"routePath\",design_readiness_score as \"designReadinessScore\" " +
            "from framework_professional_screen_design_readiness where process_code=? order by step_code,audience,route_path",
            process
        );
        List<Map<String,Object>> cases=jdbc.queryForList(
            "select case_code as \"caseCode\",process_code as \"processCode\",case_name as \"caseName\",case_type as \"caseType\",case_status as \"status\" from framework_simulation_case where process_code=? order by case_code",
            process
        );
        List<Map<String,Object>> jobs=jdbc.queryForList(
            "select job_id as \"jobId\",process_code as \"processCode\",step_code as \"stepCode\",job_type as \"jobType\",job_name as \"jobName\",target_path as \"targetPath\",job_status as \"jobStatus\" from framework_development_job where process_code=? order by step_code,job_id limit 100",
            process
        );
        List<Map<String,Object>> progress=jdbc.queryForList(
            "select process_code as \"processCode\",required_jobs as \"requiredJobs\",verified_jobs as \"verifiedJobs\",failed_jobs as \"failedJobs\",completion_percent as \"completionPercent\" from framework_process_development_progress where process_code=?",
            process
        );
        List<Map<String,Object>> assurance=jdbc.queryForList(
            "select process_code as \"processCode\",assurance_status as \"assuranceStatus\",design_accuracy_score as \"designAccuracyScore\",design_blocker_count as \"designBlockerCount\" from framework_process_design_assurance_matrix where process_code=?",
            process
        );
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("success",true);
        result.put("process",definitions.get(0));
        result.put("processes",definitions);
        result.put("stepCount",steps.size());
        result.put("steps",steps);
        result.put("stepExecutionSpecs",specs);
        result.put("professionalScreens",screens);
        result.put("cases",cases);
        result.put("developmentJobs",jobs);
        result.put("processDevelopmentProgress",progress);
        result.put("designAssurance",assurance);
        return result;
    }

    @Transactional
    public Map<String,Object> generateProfessionalDesignGraph(String processCode,String actor){
        String process=processCode==null||processCode.isBlank()?null:processCode.trim();
        Map<String,Object> generated=jdbc.queryForMap("select framework_generate_professional_design_graph(?,?) as result",process,actor);
        Object flow=jdbc.queryForObject("select framework_refresh_process_flow_edges(?)::text",String.class,process);
        Object raw=generated.get("result");
        Map<String,Object> summary=jdbc.queryForMap("select process_count as \"processCount\",step_count as \"stepCount\",ready_step_count as \"readyStepCount\",blocked_step_count as \"blockedStepCount\",screen_binding_count as \"screenBindingCount\",capability_binding_count as \"capabilityBindingCount\",test_binding_count as \"testBindingCount\" from framework_professional_design_graph_summary");
        return Map.of("success",true,"result",raw==null?"{}":raw,"flow",flow==null?"{}":flow,"summary",summary);
    }

    public Map<String,Object> professionalDesignGraph(String workTypeCode,String processCode){
        String work=workTypeCode==null?"":workTypeCode.trim().toUpperCase(Locale.ROOT);
        String process=processCode==null?"":processCode.trim().toUpperCase(Locale.ROOT);
        List<Map<String,Object>> rows=jdbc.queryForList("select graph.work_type_code as \"workTypeCode\",graph.workflow_order as \"workflowOrder\",graph.workflow_phase as \"workflowPhase\",graph.process_code as \"processCode\",graph.process_name as \"processName\",graph.step_code as \"stepCode\",graph.step_name as \"stepName\",graph.step_order as \"stepOrder\",graph.actor_code as \"actorCode\",graph.from_state as \"fromState\",graph.command_code as \"commandCode\",graph.to_state as \"toState\",graph.binding_id as \"bindingId\",graph.audience,graph.entry_mode as \"entryMode\",graph.screen_resource_id as \"screenResourceId\",graph.route_key as \"routePath\",graph.screen_name as \"screenName\",graph.screen_type as \"screenType\",graph.implementation_status as \"implementationStatus\",graph.context_contract as \"contextContract\",graph.visibility_contract as \"visibilityContract\",graph.completion_contract as \"completionContract\",graph.guide_contract as \"guideContract\",graph.capabilities,graph.data_elements as \"dataElements\",graph.tests,graph.actual_project_tasks as \"actualProjectTasks\",quality.structure_score as \"structureScore\",quality.data_score as \"dataScore\",quality.implementation_score as \"implementationScore\",quality.workflow_score as \"workflowScore\",quality.test_score as \"testScore\",quality.professional_score as \"professionalScore\",quality.customer_readiness as \"customerReadiness\",quality.gap_codes as \"gapCodes\" from framework_professional_design_graph graph left join framework_screen_professional_quality quality using(screen_resource_id) where (?='' or graph.work_type_code=?) and (?='' or graph.process_code=?) order by graph.work_type_code,graph.workflow_order,graph.process_code,graph.step_order,graph.audience,graph.binding_id",work,work,process,process);
        rows.forEach(row->{
            Object gaps=row.get("gapCodes");
            if(gaps instanceof java.sql.Array sqlArray){
                try{ row.put("gapCodes",String.join(", ",(String[])sqlArray.getArray())); }
                catch(Exception ignored){ row.put("gapCodes",""); }
            }
        });
        List<Map<String,Object>> edges=jdbc.queryForList("select edge_id as \"edgeId\",work_type_code as \"workTypeCode\",process_code as \"processCode\",from_step_code as \"fromStepCode\",from_step_name as \"fromStepName\",from_step_order as \"fromStepOrder\",to_step_code as \"toStepCode\",to_step_name as \"toStepName\",to_step_order as \"toStepOrder\",edge_type as \"edgeType\",condition_code as \"conditionCode\",condition_contract as \"conditionContract\",actor_code as \"actorCode\",source_kind as \"sourceKind\",review_status as \"reviewStatus\" from framework_professional_process_flow where (?='' or work_type_code=?) and (?='' or process_code=?) order by work_type_code,workflow_order,process_code,from_step_order,to_step_order,edge_id",work,work,process,process);
        Map<String,Object> summary=jdbc.queryForMap("select count(distinct process_code) as \"processCount\",count(distinct (process_code,step_code)) as \"stepCount\",count(distinct screen_resource_id) as \"screenCount\",count(*) as \"bindingCount\",count(*) filter(where implementation_status='VERIFIED') as \"verifiedScreenBindings\",count(*) filter(where implementation_status='IMPLEMENTED') as \"implementedScreenBindings\",count(*) filter(where implementation_status='DESIGN_ONLY') as \"designOnlyBindings\" from framework_professional_design_graph where (?='' or work_type_code=?) and (?='' or process_code=?)",work,work,process,process);
        Map<String,Object> qualitySummary=jdbc.queryForMap("select screen_count as \"screenCount\",customer_ready_count as \"customerReadyCount\",contract_repair_count as \"contractRepairCount\",implementation_required_count as \"implementationRequiredCount\",average_score as \"averageScore\",data_lineage_gap_count as \"dataLineageGapCount\",test_gap_count as \"testGapCount\" from framework_screen_professional_quality_summary");
        return Map.of("success",true,"summary",summary,"qualitySummary",qualitySummary,"items",rows,"edges",edges);
    }

    public Map<String,Object> pageDevelopmentMaster(String query,String processCode,String status){
        String keyword=query==null?"":query.trim().toLowerCase(Locale.ROOT);
        String process=processCode==null?"":processCode.trim().toUpperCase(Locale.ROOT);
        String state=status==null?"":status.trim().toUpperCase(Locale.ROOT);
        List<Map<String,Object>> items=jdbc.queryForList("select item_id as \"itemId\",sequence_no as \"sequenceNo\",priority_score as \"priorityScore\",screen_resource_id as \"screenResourceId\",route_key as \"routePath\",screen_name as \"screenName\",screen_type as \"screenType\",implementation_status as \"implementationStatus\",design_status as \"designStatus\",design_gate_status as \"designGateStatus\",design_gate_score as \"designGateScore\",design_gate_issues as \"designGateIssues\",frontend_status as \"frontendStatus\",backend_status as \"backendStatus\",test_status as \"testStatus\",deployment_status as \"deploymentStatus\",menu_code as \"menuCode\",menu_name as \"menuName\",menu_status as \"menuStatus\",permission_code as \"permissionCode\",permission_name as \"permissionName\",permission_status as \"permissionStatus\",actor_codes as \"actorCodes\",process_codes as \"processCodes\",process_step_count as \"processStepCount\",capability_count as \"capabilityCount\",field_count as \"fieldCount\",quality_score as \"qualityScore\",customer_readiness as \"customerReadiness\",blocker_reason as \"blockerReason\",next_action as \"nextAction\" from framework_page_development_master where (?='' or lower(route_key||' '||screen_name||' '||actor_codes||' '||process_codes) like '%'||?||'%') and (?='' or position(? in process_codes)>0) and (?='' or design_status=? or design_gate_status=? or frontend_status=? or backend_status=? or test_status=? or customer_readiness=?) order by sequence_no",keyword,keyword,process,process,state,state,state,state,state,state,state);
        items.forEach(row->row.put("designGateIssues",sqlArrayText(row.get("designGateIssues"))));
        Map<String,Object> summary=jdbc.queryForMap("select count(*) as \"total\",count(*) filter(where customer_readiness='CUSTOMER_READY') as \"customerReady\",count(*) filter(where design_gate_status='PASSED') as \"designGatePassed\",count(*) filter(where design_gate_status='FAILED') as \"designGateFailed\",count(*) filter(where design_status='REVIEW_REQUIRED') as \"designRequired\",count(*) filter(where frontend_status not in('VERIFIED','IMPLEMENTED')) as \"frontendRequired\",count(*) filter(where backend_status not in('VERIFIED','IMPLEMENTED')) as \"backendRequired\",count(*) filter(where test_status<>'VERIFIED') as \"testRequired\",count(*) filter(where menu_status='CONNECTED') as \"menuConnected\",count(*) filter(where permission_status='DEFINED') as \"permissionDefined\" from framework_page_development_master");
        List<Map<String,Object>> processes=jdbc.queryForList("select process_code as \"processCode\",process_name as \"processName\",development_order as \"developmentOrder\" from framework_process_definition order by development_order,process_code");
        List<Map<String,Object>> templateStandards=jdbc.queryForList("select screen_type as \"screenType\",standard_name as \"standardName\",page_count as \"pageCount\",implemented_count as \"implementedCount\",gate_passed_count as \"gatePassedCount\",average_gate_score as \"averageGateScore\",coalesce(representative_route,'') as \"representativeRoute\",representative_screen_name as \"representativeScreenName\",standard_status as \"standardStatus\",representative_gate_score as \"representativeGateScore\",representative_gate_status as \"representativeGateStatus\",representative_gate_issues as \"representativeGateIssues\",standard_version as \"standardVersion\" from framework_screen_template_coverage order by case standard_status when 'APPROVED' then 0 else 1 end,page_count desc,screen_type");
        templateStandards.forEach(row->row.put("representativeGateIssues",sqlArrayText(row.get("representativeGateIssues"))));
        return Map.of("success",true,"summary",summary,"processes",processes,"items",items,"templateStandards",templateStandards);
    }

    public Map<String,Object> pageDevelopmentMasterDetail(long itemId){
        Map<String,Object> item=jdbc.queryForMap("select * from framework_page_development_master where item_id=?",itemId);
        item.put("design_gate_issues",sqlArrayText(item.get("design_gate_issues")));
        long screenId=((Number)item.get("screen_resource_id")).longValue();
        List<Map<String,Object>> bindings=jdbc.queryForList("select b.binding_id as \"bindingId\",b.process_code as \"processCode\",p.process_name as \"processName\",b.step_code as \"stepCode\",s.step_name as \"stepName\",s.step_order as \"stepOrder\",s.command_code as \"commandCode\",b.actor_code as \"actorCode\",a.actor_name as \"actorName\",b.audience,b.entry_mode as \"entryMode\",b.context_contract as \"contextContract\",b.visibility_contract as \"visibilityContract\",b.completion_contract as \"completionContract\",b.guide_contract as \"guideContract\" from framework_process_step_screen_binding b join framework_process_definition p using(process_code) join framework_process_step s using(process_code,step_code) left join framework_actor_definition a on a.actor_code=b.actor_code where b.screen_resource_id=? and b.binding_status='ACTIVE' order by p.development_order,s.step_order,b.audience",screenId);
        List<Map<String,Object>> capabilities=jdbc.queryForList("select capability_code as \"capabilityCode\",capability_name as \"capabilityName\",capability_type as \"capabilityType\",command_contract as \"commandContract\",error_contract as \"errorContract\",evidence_contract as \"evidenceContract\",implementation_status as \"implementationStatus\" from framework_screen_capability where screen_resource_id=? order by capability_code",screenId);
        List<Map<String,Object>> fields=jdbc.queryForList("select data_element_code as \"dataElementCode\",field_code as \"fieldCode\",field_name as \"fieldName\",control_type as \"controlType\",api_property as \"apiProperty\",source_table as \"sourceTable\",source_column as \"sourceColumn\",required as \"required\",lineage_status as \"lineageStatus\" from framework_screen_data_binding where screen_resource_id=? order by data_element_code,field_code",screenId);
        List<Map<String,Object>> stepFields=jdbc.queryForList("select spec.process_code as \"processCode\",spec.step_code as \"stepCode\",field->>'fieldCode' as \"fieldCode\",field->>'fieldName' as \"fieldName\",field->>'fieldGroup' as \"fieldGroup\",coalesce((field->>'fieldOrder')::int,0) as \"fieldOrder\",field->>'controlType' as \"controlType\",field->>'apiProperty' as \"apiProperty\",field->>'sourceTable' as \"sourceTable\",field->>'sourceColumn' as \"sourceColumn\",coalesce((field->>'required')::boolean,false) as \"required\",field->>'mappingStatus' as \"lineageStatus\",field->>'dataType' as \"dataType\",field->'validation' as \"validation\" from framework_step_execution_spec spec cross join lateral jsonb_array_elements(coalesce(spec.field_contract->'fields','[]'::jsonb)) field where exists(select 1 from framework_process_step_screen_binding b where b.screen_resource_id=? and b.process_code=spec.process_code and b.step_code=spec.step_code and b.binding_status='ACTIVE') and lower(split_part(field->>'route','?',1))=(select route_key from framework_screen_resource where screen_resource_id=?) order by spec.process_code,spec.step_code,coalesce((field->>'fieldOrder')::int,0),field->>'fieldCode'",screenId,screenId);
        List<Map<String,Object>> tests=jdbc.queryForList("select distinct b.process_code as \"processCode\",b.step_code as \"stepCode\",t.case_code as \"caseCode\",t.case_name as \"caseName\",t.case_type as \"caseType\",t.case_status as \"caseStatus\" from framework_process_step_screen_binding b join framework_step_test_binding x on x.process_code=b.process_code and x.step_code=b.step_code join framework_simulation_case t on t.case_code=x.case_code where b.screen_resource_id=? and b.binding_status='ACTIVE' order by b.process_code,b.step_code,t.case_type,t.case_code",screenId);
        List<Map<String,Object>> contracts=jdbc.queryForList("select contract_id as \"contractId\",process_code as \"processCode\",step_code as \"stepCode\",audience,route_path as \"routePath\",screen_name as \"screenName\",actor_code as \"actorCode\",permission_codes::text as \"permissionCodes\",business_purpose as \"businessPurpose\",entry_condition as \"entryCondition\",exit_condition as \"exitCondition\",kpi_contract as \"kpiContract\",section_contract as \"sectionContract\",field_contract as \"fieldContract\",command_contract as \"commandContract\",state_contract as \"stateContract\",api_contract as \"apiContract\",data_contract as \"dataContract\",evidence_contract as \"evidenceContract\",responsive_contract as \"responsiveContract\",accessibility_contract as \"accessibilityContract\",security_contract as \"securityContract\",api_verified as \"apiVerified\",database_verified as \"databaseVerified\",authority_verified as \"authorityVerified\",responsive_verified as \"responsiveVerified\",accessibility_verified as \"accessibilityVerified\",exception_states_verified as \"exceptionStatesVerified\",audit_evidence_ref as \"auditEvidenceRef\",contract_status as \"contractStatus\" from framework_professional_screen_contract where lower(split_part(route_path,'?',1))=(select route_key from framework_screen_resource where screen_resource_id=?) order by process_code,step_code,audience,contract_id",screenId);
        List<Map<String,Object>> assets=jdbc.queryForList("select a.asset_layer as \"assetLayer\",a.asset_ref as \"assetRef\",a.management_route as \"managementRoute\",a.decision,a.evidence_ref as \"evidenceRef\",a.protected as \"protected\" from framework_screen_asset_assembly a join framework_professional_screen_contract c using(contract_id) where lower(split_part(c.route_path,'?',1))=(select route_key from framework_screen_resource where screen_resource_id=?) order by a.asset_layer,a.asset_ref",screenId);
        List<Map<String,Object>> blueprints=jdbc.queryForList("""
            with candidates as materialized (
              select b.blueprint_id,c.contract_id,
                     (b.transition_status='CONTRACT_LINKED' and lower(b.source_reference) in(
                       'framework_professional_screen_contract:'||c.contract_id,
                       'professional_screen_contract:'||c.contract_id)) explicit_link,
                     count(*) over(partition by c.contract_id) candidate_count,
                     count(*) filter(where b.transition_status='CONTRACT_LINKED'
                       and lower(b.source_reference) in(
                         'framework_professional_screen_contract:'||c.contract_id,
                         'professional_screen_contract:'||c.contract_id))
                       over(partition by c.contract_id) explicit_count
                from framework_professional_screen_contract c
                join framework_screen_blueprint b
                  on b.process_code=c.process_code and b.step_code=c.step_code
                 and upper(b.audience)=upper(c.audience)
                 and lower(split_part(b.route_path,'?',1))=lower(split_part(c.route_path,'?',1))
               where b.validation_status='VALID'
                 and lower(split_part(b.route_path,'?',1))=
                   (select route_key from framework_screen_resource where screen_resource_id=?)
            ), authority as materialized (
              select blueprint_id,contract_id from candidates
               where (explicit_count=1 and explicit_link)
                  or (explicit_count=0 and candidate_count=1)
            )
            select b.blueprint_id as "blueprintId",b.blueprint_code as "blueprintCode",
                   c.contract_id as "contractId",b.process_code as "processCode",
                   b.step_code as "stepCode",b.audience,b.screen_type as "screenType",
                   b.template_code as "templateCode",b.specification_json as "specificationJson",
                   coalesce(nullif(framework_try_jsonb(b.specification_json)->>'layout',''),
                     (select min(r.layout_type) from framework_screen_resource r
                       where r.route_key=lower(split_part(b.route_path,'?',1)) having count(*)=1)) as "layout",
                   coalesce(nullif(framework_try_jsonb(b.specification_json)->>'theme',''),
                     'KRDS_GOV_DEFAULT') as "theme",
                   b.validation_status as "validationStatus",b.validation_message as "validationMessage"
              from authority selected
              join framework_screen_blueprint b using(blueprint_id)
              join framework_professional_screen_contract c using(contract_id)
             order by b.process_code,b.step_code,b.audience,b.blueprint_id
            """,screenId);
        List<Map<String,Object>> registeredLayouts=jdbc.queryForList(
            "select distinct layout_type as code from framework_screen_resource where nullif(btrim(layout_type),'') is not null order by layout_type");
        List<Map<String,Object>> registeredThemes=jdbc.queryForList(
            "select theme_id as code from comtnthemedefinition where use_at='Y' and is_active='Y' order by theme_id");
        Map<String,Object> designGate=jdbc.queryForMap("select design_gate_status as \"status\",design_gate_score as \"score\",design_gate_issues as \"issues\",actor_passed as \"actorPassed\",process_passed as \"processPassed\",contract_passed as \"contractPassed\",lineage_passed as \"lineagePassed\",transition_passed as \"transitionPassed\",authority_passed as \"authorityPassed\",version_passed as \"versionPassed\",exception_passed as \"exceptionPassed\",admin_counterpart_passed as \"adminCounterpartPassed\",test_passed as \"testPassed\" from framework_page_design_assurance where screen_resource_id=?",screenId);
        designGate.put("issues",sqlArrayText(designGate.get("issues")));
        Map<String,Object> detail=new LinkedHashMap<>();
        detail.put("success",true);detail.put("item",item);detail.put("designGate",designGate);detail.put("bindings",bindings);detail.put("contracts",contracts);detail.put("capabilities",capabilities);detail.put("fields",fields);detail.put("stepFields",stepFields);detail.put("tests",tests);detail.put("assets",assets);detail.put("blueprints",blueprints);detail.put("registeredLayouts",registeredLayouts);detail.put("registeredThemes",registeredThemes);
        return detail;
    }

    /**
     * System-wide, read-only projection of the executable process contracts.
     *
     * The report deliberately distinguishes a deterministic contract audit
     * from execution of the business command shown in {@code commandCode}.
     * The latest result is evidence from framework_screen_workflow_test_run;
     * when no evidence exists the truthful state is NOT_RUN.
     */
    public Map<String,Object> systemProcessTestReport(String domainCode,String processCode,String requestedResult){
        return systemProcessTestReport(domainCode,processCode,requestedResult,false,0,2000);
    }

    public Map<String,Object> systemProcessTestReport(String domainCode,String processCode,String requestedResult,boolean compact){
        return systemProcessTestReport(domainCode,processCode,requestedResult,compact,0,2000);
    }

    /**
     * Loads exactly one complete step row for human screen/function review.
     *
     * Compact catalogue rows intentionally omit large inventories and therefore
     * are never review-authoritative.  This endpoint reuses the same redacted
     * report projection with a one-row structural page so the caller receives
     * the complete screen/function and scoped-review inventories without
     * materialising every process step.
     */
    public Map<String,Object> systemProcessTestReportStepDetail(String processCode,String stepCode){
        String process=processCode==null?"":processCode.trim().toUpperCase(Locale.ROOT);
        String step=stepCode==null?"":stepCode.trim().toUpperCase(Locale.ROOT);
        if(process.isBlank()||step.isBlank())
            throw new IllegalArgumentException("processCode and stepCode are required");

        List<Map<String,Object>> positions=jdbc.queryForList("""
            select ordinal
              from (
                select s.step_code,row_number() over(order by s.step_order,s.step_code)::integer ordinal
                  from framework_process_step s
                 where s.process_code=?
              ) ranked
             where step_code=?
            """,process,step);
        if(positions.size()!=1)throw new java.util.NoSuchElementException("SYSTEM_TEST_REPORT_STEP_NOT_FOUND");
        int ordinal=((Number)positions.get(0).get("ordinal")).intValue();
        if(ordinal<1)throw new java.util.NoSuchElementException("SYSTEM_TEST_REPORT_STEP_NOT_FOUND");

        Map<String,Object> report=systemProcessTestReport("",process,"",false,ordinal-1,1);
        Object rawItems=report.get("items");
        if(!(rawItems instanceof List<?> rows)||rows.size()!=1||!(rows.get(0) instanceof Map<?,?> rawRow))
            throw new java.util.NoSuchElementException("SYSTEM_TEST_REPORT_STEP_NOT_FOUND");
        Map<String,Object> item=new LinkedHashMap<>();
        rawRow.forEach((key,value)->item.put(String.valueOf(key),value));
        if(!step.equalsIgnoreCase(String.valueOf(item.getOrDefault("stepCode",""))))
            throw new java.util.NoSuchElementException("SYSTEM_TEST_REPORT_STEP_NOT_FOUND");
        boolean complete=SYSTEM_TEST_REPORT_LARGE_JSON_FIELDS.stream()
                .map(item::get).filter(java.util.Objects::nonNull).map(String::valueOf)
                .noneMatch(value->value.contains("\"omitted\":true"));
        if(!complete)throw new IllegalStateException("SYSTEM_TEST_REPORT_STEP_DETAIL_INCOMPLETE");
        item.put("reviewCriticalFieldsComplete",true);
        item.put("reviewAllowed",true);

        Map<String,Object> detail=new LinkedHashMap<>();
        detail.put("success",true);
        detail.put("detailMode","SELECTED_STEP_FULL");
        detail.put("reviewCriticalFieldsComplete",true);
        detail.put("item",item);
        return detail;
    }

    public Map<String,Object> systemProcessTestReport(String domainCode,String processCode,String requestedResult,boolean compact,int requestedPage,int requestedSize){
        String domain=domainCode==null?"":domainCode.trim().toUpperCase(Locale.ROOT);
        String process=processCode==null?"":processCode.trim().toUpperCase(Locale.ROOT);
        String result=normalizeSystemTestResult(requestedResult);
        int page=Math.max(0,requestedPage),size=Math.max(1,Math.min(requestedSize,200)),offset=page*size;
        Integer structuralTotal=jdbc.queryForObject("""
            select count(*) from framework_process_definition p join framework_process_step s using(process_code)
             where (?='' or upper(p.domain_code)=?) and (?='' or p.process_code=?)
            """,Integer.class,domain,domain,process,process);
        int totalStepCount=structuralTotal==null?0:structuralTotal;

        List<Map<String,Object>> items=jdbc.queryForList("""
            with report_options as (select ?::boolean compact,?::int compact_limit_bytes), runtime_release as materialized (
              select source_commit from framework_runtime_release_state
               where release_key='CARBONET_RUNTIME' and health_status='UP'
            ), scoped_step_inventory as materialized (
              select p.domain_code,p.process_name,p.process_status,p.process_version,p.development_order,
                     coalesce(sequence.workflow_order,p.development_order) workflow_order,
                     coalesce(sequence.workflow_phase,'UNSEQUENCED') workflow_phase,
                     coalesce(sequence.process_role,'CORE') process_role,sequence.next_process_code,
                     s.*,coalesce(a.actor_name,s.actor_code) actor_name,coalesce(w.work_type_name,p.domain_code) domain_name,
                     coalesce(a.capability_codes,'') actor_capability_codes,
                     coalesce(w.sort_order,9999) domain_order,to_jsonb(s)::text step_contract_json
                from framework_process_definition p
                join framework_process_step s using(process_code)
                left join framework_actor_definition a on a.actor_code=s.actor_code
                left join framework_business_work_type w on w.work_type_code=upper(p.domain_code)
                left join framework_business_process_sequence sequence on sequence.process_code=p.process_code
               where (?='' or upper(p.domain_code)=?) and (?='' or p.process_code=?)
            ), scoped_steps as materialized (
              select * from scoped_step_inventory
               order by domain_order,workflow_order,process_code,step_order,step_code
               limit ? offset ?
            ), scoped_screen_ids as materialized (
              select distinct b.screen_resource_id
                from scoped_steps scoped
                join framework_process_step_screen_binding b
                  on b.process_code=scoped.process_code and b.step_code=scoped.step_code
                 and b.binding_status='ACTIVE'
               where b.screen_resource_id is not null
            ), scoped_routes as materialized (
              select distinct screen.route_key
                from scoped_screen_ids scoped join framework_screen_resource screen using(screen_resource_id)
            ), screen_data_hash as (
              select d.screen_resource_id,md5(coalesce(string_agg(to_jsonb(d)::text,'|' order by d.data_element_code,d.field_code),'')) data_hash,
                     count(*)::integer data_field_count
                from scoped_screen_ids scoped join framework_screen_data_binding d using(screen_resource_id)
               group by d.screen_resource_id
            ), screen_capability_hash as (
              select c.screen_resource_id,md5(coalesce(string_agg(to_jsonb(c)::text,'|' order by c.capability_code),'')) capability_hash,
                     count(*) capability_count,string_agg(distinct c.capability_name,', ' order by c.capability_name) capability_names,
                     string_agg(distinct c.capability_code,', ' order by c.capability_code) capability_codes
                from scoped_screen_ids scoped join framework_screen_capability c using(screen_resource_id)
               group by c.screen_resource_id
            ), step_test_hash as (
              select b.process_code,b.step_code,
                     md5(coalesce(string_agg(to_jsonb(b)::text||'~'||to_jsonb(c)::text,'|' order by b.case_code),'')) test_hash,
                     count(*) scenario_count,
                     count(*) filter(where c.case_status in('APPROVED','VERIFIED')) approved_scenario_count
                from scoped_steps scoped join framework_step_test_binding b using(process_code,step_code)
                join framework_simulation_case c using(case_code)
               group by b.process_code,b.step_code
            ), step_spec_hash as (
              select e.process_code,e.step_code,md5(to_jsonb(e)::text) spec_hash
                from scoped_steps scoped join framework_step_execution_spec e using(process_code,step_code)
            ), professional_contract_hash as (
              select lower(split_part(c.route_path,'?',1)) route_key,
                     md5(coalesce(string_agg(to_jsonb(c)::text,'|' order by c.process_code,c.step_code,c.audience,c.contract_id),'')) contract_hash
                from scoped_routes scoped join framework_professional_screen_contract c
                  on lower(split_part(c.route_path,'?',1))=scoped.route_key
               group by lower(split_part(c.route_path,'?',1))
            ), fixture_hash as (
              select t.screen_resource_id,t.process_code,t.step_code,t.capability_code,
                     md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by t.test_case_id),'')) fixture_hash
                from scoped_screen_ids scoped join framework_screen_workflow_test_case t using(screen_resource_id)
                join scoped_steps step_scope using(process_code,step_code)
               where t.active=true
               group by t.screen_resource_id,t.process_code,t.step_code,t.capability_code
            ), binding_targets as (
              select ss.*,b.binding_id,b.audience,b.entry_mode,to_jsonb(b)::text binding_contract_json,
                      r.screen_resource_id,r.route_key,r.screen_name,r.screen_type,r.implementation_status,to_jsonb(r)::text screen_contract_json,
                      c.capability_id,coalesce(c.capability_code,'ALL') capability_code,c.capability_name,c.capability_type,
                      coalesce(c.command_contract,'{}'::jsonb) capability_command_contract,
                      coalesce(dh.data_hash,'') data_hash,coalesce(dh.data_field_count,0) data_field_count,coalesce(ch.capability_hash,'') capability_hash,
                     coalesce(th.test_hash,'') test_hash,coalesce(th.scenario_count,0) scenario_count,
                     coalesce(th.approved_scenario_count,0) approved_scenario_count,coalesce(sh.spec_hash,'') spec_hash,
                     coalesce(ph.contract_hash,'') professional_hash,
                      coalesce(fh.fixture_hash,all_fixture.fixture_hash,'') fixture_hash
                from scoped_steps ss
                left join framework_process_step_screen_binding b
                  on b.process_code=ss.process_code and b.step_code=ss.step_code and b.binding_status='ACTIVE'
                left join framework_screen_resource r using(screen_resource_id)
                left join framework_screen_capability c using(screen_resource_id)
                left join screen_data_hash dh using(screen_resource_id)
                left join screen_capability_hash ch using(screen_resource_id)
                left join step_test_hash th on th.process_code=ss.process_code and th.step_code=ss.step_code
                left join step_spec_hash sh on sh.process_code=ss.process_code and sh.step_code=ss.step_code
                left join professional_contract_hash ph on ph.route_key=r.route_key
                left join fixture_hash fh on fh.screen_resource_id=r.screen_resource_id and fh.process_code=ss.process_code
                 and fh.step_code=ss.step_code and fh.capability_code=coalesce(c.capability_code,'ALL')
                left join fixture_hash all_fixture on all_fixture.screen_resource_id=r.screen_resource_id and all_fixture.process_code=ss.process_code
                 and all_fixture.step_code=ss.step_code and all_fixture.capability_code='ALL'
            ), target_fingerprints as (
              select bt.*,md5(concat_ws('|',bt.process_version,bt.step_contract_json,coalesce(bt.binding_contract_json,''),
                       coalesce(bt.screen_contract_json,''),bt.audience,bt.capability_code,bt.data_hash,bt.capability_hash,
                       bt.test_hash,bt.spec_hash,bt.professional_hash,bt.fixture_hash)) contract_fingerprint
                from binding_targets bt
            ), screen_scope_fingerprints as (
              select process_code,step_code,screen_resource_id,
                     md5(coalesce(string_agg(contract_fingerprint,'|' order by audience,capability_code),'')) screen_contract_fingerprint
                from target_fingerprints
               where binding_id is not null
               group by process_code,step_code,screen_resource_id
            ), capability_scope_fingerprints as (
              select process_code,step_code,screen_resource_id,capability_code,
                     md5(coalesce(string_agg(contract_fingerprint,'|' order by audience),'')) capability_contract_fingerprint
                from target_fingerprints
               where binding_id is not null
               group by process_code,step_code,screen_resource_id,capability_code
            ), target_latest as (
              select target.*,run.run_id,run.result,run.passed_check_count,run.total_check_count,
                     array_to_string(run.blocker_codes,', ') blocker_codes,
                     coalesce(run.evidence_json->>'preInputJson','{}') pre_input_json,
                     run.evidence_json::text evidence_json,run.executed_by,run.executed_at
                from target_fingerprints target
                left join lateral (
                  select candidate.*
                    from (
                      (select evidence.run_id,evidence.result,evidence.passed_check_count,evidence.total_check_count,
                              evidence.blocker_codes,evidence.evidence_json,evidence.executed_by,evidence.executed_at
                         from framework_screen_workflow_test_run evidence
                        where evidence.audit_batch_id is null
                          and evidence.screen_resource_id=target.screen_resource_id
                          and evidence.process_code=target.process_code and evidence.step_code=target.step_code
                          and evidence.capability_code=target.capability_code
                          and coalesce(evidence.evidence_json->>'audience','')=coalesce(target.audience,'')
                          and evidence.evidence_json ?? 'contractFingerprint'
                          and evidence.evidence_json->>'contractFingerprint'=target.contract_fingerprint
                          and not exists (
                            select 1 from framework_screen_workflow_audit_incident_run incident_run
                             where incident_run.run_id=evidence.run_id
                          )
                        order by evidence.executed_at desc,evidence.run_id desc limit 1)
                      union all
                      (select evidence.run_id,evidence.result,evidence.passed_check_count,evidence.total_check_count,
                              evidence.blocker_codes,evidence.evidence_json,evidence.executed_by,evidence.executed_at
                         from framework_screen_workflow_test_run evidence
                         join framework_screen_workflow_audit_batch audit_batch
                           on audit_batch.audit_batch_id=evidence.audit_batch_id
                          and audit_batch.batch_status='COMPLETE'
                        where evidence.audit_batch_id is not null
                          and evidence.screen_resource_id=target.screen_resource_id
                          and evidence.process_code=target.process_code and evidence.step_code=target.step_code
                          and evidence.capability_code=target.capability_code
                          and coalesce(evidence.evidence_json->>'audience','')=coalesce(target.audience,'')
                          and evidence.evidence_json ?? 'contractFingerprint'
                          and evidence.evidence_json->>'contractFingerprint'=target.contract_fingerprint
                        order by evidence.executed_at desc,evidence.run_id desc limit 1)
                    ) candidate
                   order by candidate.executed_at desc,candidate.run_id desc limit 1
                ) run on true
            ), step_rollup as (
              select process_code,step_code,
                     md5(coalesce(string_agg(contract_fingerprint,'|' order by screen_resource_id,audience,capability_code),'')) operational_target_fingerprint,
                     count(distinct screen_resource_id) filter(where binding_id is not null) screen_count,
                     count(*) filter(where binding_id is not null) target_count,
                     count(*) filter(where binding_id is not null and run_id is not null) tested_target_count,
                     count(distinct capability_id) capability_count,
                     string_agg(distinct route_key,', ' order by route_key) filter(where route_key is not null) screen_routes,
                     string_agg(distinct implementation_status,', ' order by implementation_status) filter(where implementation_status is not null) implementation_statuses,
                     string_agg(distinct capability_name,', ' order by capability_name) filter(where capability_name is not null) capability_names,
                     string_agg(distinct capability_code,', ' order by capability_code) filter(where capability_code is not null) capability_codes,
                     coalesce(jsonb_agg(jsonb_build_object(
                       'screenResourceId',screen_resource_id,'screenName',screen_name,'routePath',route_key,
                       'audience',audience,'entryMode',entry_mode,'capabilityCode',capability_code,
                       'capabilityName',coalesce(capability_name,capability_code),'capabilityType',coalesce(capability_type,'UNREGISTERED'),
                       'commandContract',capability_command_contract,'dataFieldCount',data_field_count)
                       order by case entry_mode when 'PRIMARY' then 0 else 1 end,
                                case audience when 'USER' then 0 when 'ADMIN' then 1 when 'PUBLIC' then 2 else 3 end,
                                route_key,capability_code) filter(where binding_id is not null),'[]'::jsonb)::text screen_function_inventory_json,
                     max(scenario_count) scenario_count,max(approved_scenario_count) approved_scenario_count,
                     count(*) filter(where binding_id is not null and implementation_status not in('IMPLEMENTED','VERIFIED')) unready_screen_target_count,
                     case when count(*) filter(where binding_id is not null)=0 then 'NOT_RUN'
                          when count(*) filter(where binding_id is not null and result='BLOCKED')>0 then 'BLOCKED'
                          when count(*) filter(where binding_id is not null and run_id is null)>0 then 'NOT_RUN'
                          when count(*) filter(where binding_id is not null and result='PASSED')=count(*) filter(where binding_id is not null) then 'PASSED'
                          else 'NOT_RUN' end test_state
                from target_latest group by process_code,step_code
            ), primary_screen as (
              select distinct on (process_code,step_code) process_code,step_code,audience,entry_mode,screen_resource_id,route_key,screen_name,screen_type,implementation_status
                from target_fingerprints where binding_id is not null
               order by process_code,step_code,case entry_mode when 'PRIMARY' then 0 else 1 end,
                        case audience when 'USER' then 0 when 'ADMIN' then 1 when 'PUBLIC' then 2 else 3 end,route_key
            ), latest_step_run as (
              select distinct on (process_code,step_code) process_code,step_code,run_id,coalesce(result,'NOT_RUN') result,passed_check_count,total_check_count,
                     blocker_codes,pre_input_json,evidence_json,executed_by,executed_at,screen_resource_id,route_key,audience,capability_code
                from target_latest
               order by process_code,step_code,
                        case coalesce(result,'NOT_RUN') when 'ERROR' then 0 when 'BLOCKED' then 1 when 'NOT_RUN' then 2 else 3 end,
                        executed_at desc nulls last,run_id desc nulls last,route_key,capability_code
            ), latest_simulation as (
              select distinct on (b.process_code,b.step_code) b.process_code,b.step_code,b.trace_scope,run.run_id,run.result,
                     run.process_version,sim.case_code,sim.case_type,coalesce(run.evidence_json,'{}') evidence_json,
                     run.executed_by,run.executed_at
                from framework_step_test_binding b
                join scoped_steps scoped on scoped.process_code=b.process_code and scoped.step_code=b.step_code
                join framework_simulation_case sim using(case_code)
                 join framework_simulation_run run using(case_code)
                order by b.process_code,b.step_code,run.executed_at desc,run.run_id desc
            ), current_business_e2e as materialized (
              select evidence.*
                from framework_current_business_e2e_evidence evidence
                join scoped_steps scoped using(process_code,step_code)
            ), fixture_suite_cases as (
              select b.process_code,b.step_code,sim.case_code,sim.case_name,sim.case_type,sim.case_status,b.trace_scope,
                     scoped.process_version as current_process_version,run.run_id,run.result,run.process_version as run_process_version,
                     run.executed_by,run.executed_at
                from framework_step_test_binding b
                join scoped_steps scoped on scoped.process_code=b.process_code and scoped.step_code=b.step_code
                join framework_simulation_case sim using(case_code)
                left join lateral (
                  select r.run_id,r.result,r.process_version,r.executed_by,r.executed_at
                    from framework_simulation_run r where r.case_code=sim.case_code
                   order by r.executed_at desc,r.run_id desc limit 1
                ) run on true
               where sim.case_type in('HAPPY_PATH','AUTHORITY','ISOLATION','EXCEPTION','RECOVERY')
                 and sim.case_status not in('RETIRED','INACTIVE','DISABLED')
            ), fixture_suite_rollup as (
              select process_code,step_code,count(*) fixture_suite_case_count,count(distinct case_type) fixture_suite_covered_type_count,
                     count(*) filter(where case_status in('APPROVED','VERIFIED')) fixture_suite_approved_case_count,
                     count(*) filter(where run_id is not null and run_process_version=current_process_version) fixture_suite_current_run_count,
                     count(*) filter(where run_id is not null and run_process_version<>current_process_version) fixture_suite_stale_run_count,
                     count(*) filter(where run_id is null) fixture_suite_not_run_count,
                     count(*) filter(where run_id is not null and run_process_version=current_process_version and result in('PASSED','PASS','SUCCESS','VERIFIED','COMPLETED')) fixture_suite_passed_run_count,
                     count(*) filter(where run_id is not null and run_process_version=current_process_version and result not in('PASSED','PASS','SUCCESS','VERIFIED','COMPLETED')) fixture_suite_blocked_run_count,
                     string_agg(distinct case_type,', ' order by case_type) fixture_suite_covered_types,
                     concat_ws(', ',
                       case when count(*) filter(where case_type='HAPPY_PATH')=0 then 'HAPPY_PATH' end,
                       case when count(*) filter(where case_type='AUTHORITY')=0 then 'AUTHORITY' end,
                       case when count(*) filter(where case_type='ISOLATION')=0 then 'ISOLATION' end,
                       case when count(*) filter(where case_type='EXCEPTION')=0 then 'EXCEPTION' end,
                       case when count(*) filter(where case_type='RECOVERY')=0 then 'RECOVERY' end) fixture_suite_missing_types,
                     jsonb_agg(jsonb_build_object('caseCode',case_code,'caseName',case_name,'caseType',case_type,'caseStatus',case_status,
                       'traceScope',trace_scope,'latestRunId',run_id,'latestResult',coalesce(result,'NOT_RUN'),
                       'currentVersion',run_id is not null and run_process_version=current_process_version,
                       'executedBy',coalesce(executed_by,''),'executedAt',executed_at) order by case_type,case_code)::text fixture_suite_cases_json
                from fixture_suite_cases group by process_code,step_code
            ), filtered_steps as (
              select scoped.*,rollup.screen_count,rollup.target_count,rollup.tested_target_count,rollup.capability_count,
                     rollup.screen_routes,rollup.implementation_statuses,rollup.capability_names,rollup.capability_codes,rollup.scenario_count,
                     rollup.operational_target_fingerprint,rollup.screen_function_inventory_json,
                     rollup.approved_scenario_count,rollup.unready_screen_target_count,rollup.test_state
                from scoped_steps scoped join step_rollup rollup using(process_code,step_code)
               where (?='' or rollup.test_state=?)
            ), scope_metrics as materialized (
              select count(distinct target.screen_resource_id) filter(where target.binding_id is not null) scope_screen_count,
                     count(distinct target.route_key) filter(where target.binding_id is not null) scope_route_count,
                     count(distinct target.capability_id) scope_capability_count,
                     count(distinct (target.process_code,target.step_code,target.binding_id,target.capability_code)) filter(where target.binding_id is not null) scope_target_count
                from target_fingerprints target join filtered_steps filtered using(process_code,step_code)
            )
            select p.domain_code as "domainCode",coalesce(w.work_type_name,p.domain_code) as "domainName",p.domain_order as "domainOrder",
                   p.process_code as "processCode",p.process_name as "processName",p.process_status as "processStatus",p.process_version as "processVersion",
                   p.workflow_order as "processOrder",p.workflow_order as "workflowOrder",p.development_order as "developmentOrder",
                   p.workflow_phase as "workflowPhase",p.process_role as "processRole",p.step_order as "stepOrder",p.step_code as "stepCode",
                   p.step_name as "stepName",coalesce(p.parent_step_code,'') as "parentStepCode",p.step_type as "stepType",
                   p.actor_code as "actorCode",p.actor_name as "actorName",p.actor_capability_codes as "actorCapabilityCodes",
                   coalesce(accounts.assigned_account_count,0) as "assignedAccountCount",coalesce(accounts.assigned_account_ids,'') as "assignedAccountIds",
                   'GLOBAL_ACTIVE_ACTOR_CANDIDATES' as "assignmentScope",
                   p.from_state as "fromState",p.command_code as "commandCode",p.step_name as "commandName",p.to_state as "toState",
                   p.requirement_text as "requirementText",p.completion_rule as "completionRule",
                   coalesce(p.input_contract,'{}') as "inputContract",coalesce(p.output_contract,'{}') as "outputContract",
                   p.requires_user_page as "requiresUserPage",p.requires_admin_page as "requiresAdminPage",p.requires_api as "requiresApi",
                   p.requires_database as "requiresDatabase",p.requires_notification as "requiresNotification",coalesce(p.user_path,'') as "userPath",
                   coalesce(p.admin_path,'') as "adminPath",coalesce(p.api_contract,'') as "apiContract",
                   coalesce(screen.audience,'UNBOUND') as audience,coalesce(screen.entry_mode,'UNBOUND') as "entryMode",
                   screen.screen_resource_id as "screenResourceId",coalesce(
                     case
                       when lower(split_part(coalesce(p.user_path,''),'?',1))=screen.route_key then split_part(p.user_path,'?',1)
                       when lower(split_part(coalesce(p.admin_path,''),'?',1))=screen.route_key then split_part(p.admin_path,'?',1)
                       else null
                     end,screen.route_key,'') as "routePath",
                   coalesce(screen.screen_name,p.step_name) as "screenName",coalesce(screen.screen_type,'UNREGISTERED') as "screenType",
                   coalesce(screen.implementation_status,'DESIGN_ONLY') as "implementationStatus",
                   p.screen_count as "screenCount",coalesce(p.screen_routes,'') as "screenRoutes",
                   coalesce(p.implementation_statuses,'') as "implementationStatuses",p.capability_count as "capabilityCount",
                   coalesce(p.capability_names,'') as "capabilityNames",coalesce(p.capability_codes,'') as "functionCodes",p.target_count as "auditTargetCount",
                   case when options.compact and octet_length(coalesce(p.screen_function_inventory_json,'[]'))>options.compact_limit_bytes
                        then jsonb_build_object('compact',true,'omitted',true,'byteLength',octet_length(coalesce(p.screen_function_inventory_json,'[]')))::text
                        else coalesce(p.screen_function_inventory_json,'[]') end as "screenFunctionInventoryJson",
                   p.tested_target_count as "auditedTargetCount",p.scenario_count as "scenarioCount",p.approved_scenario_count as "approvedScenarioCount",
                   latest.run_id as "latestRunId",latest.result as "latestResult",
                   latest.passed_check_count as "latestPassedCheckCount",latest.total_check_count as "latestTotalCheckCount",
                   coalesce(latest.blocker_codes,'') as "latestBlockerCodes",
                   case when options.compact and octet_length(coalesce(latest.pre_input_json,'{}'))>options.compact_limit_bytes
                        then jsonb_build_object('compact',true,'omitted',true,'byteLength',octet_length(coalesce(latest.pre_input_json,'{}')))::text
                        else coalesce(latest.pre_input_json,'{}') end as "latestPreInputJson",
                   case when options.compact and octet_length(coalesce(latest.evidence_json,'{}'))>options.compact_limit_bytes
                        then jsonb_build_object('compact',true,'omitted',true,'byteLength',octet_length(coalesce(latest.evidence_json,'{}')))::text
                        else coalesce(latest.evidence_json,'{}') end as "latestEvidenceJson",coalesce(latest.executed_by,'') as "latestExecutedBy",
                   latest.executed_at as "latestExecutedAt",
                   case when options.compact and octet_length(coalesce(latest.pre_input_json,'{}'))>options.compact_limit_bytes
                        then jsonb_build_object('compact',true,'omitted',true,'byteLength',octet_length(coalesce(latest.pre_input_json,'{}')))::text
                        else coalesce(latest.pre_input_json,'{}') end as "latestInput",
                   case when options.compact and octet_length(coalesce(latest.evidence_json,'{}'))>options.compact_limit_bytes
                        then jsonb_build_object('compact',true,'omitted',true,'byteLength',octet_length(coalesce(latest.evidence_json,'{}')))::text
                        else coalesce(latest.evidence_json,'{}') end as "latestOutput",
                   case when options.compact and octet_length(coalesce(latest.evidence_json,'{}'))>options.compact_limit_bytes
                        then jsonb_build_object('compact',true,'omitted',true,'byteLength',octet_length(coalesce(latest.evidence_json,'{}')))::text
                        else coalesce(latest.evidence_json,'{}') end as "evidenceJson",
                   coalesce(latest.executed_by,'') as "executedBy",latest.executed_at as "executedAt",
                   coalesce(sim.run_id,0) as "latestSimulationRunId",coalesce(sim.result,'NOT_RUN') as "simulationTestResult",
                   coalesce(sim.case_code,'') as "simulationCaseCode",coalesce(sim.case_type,'') as "simulationCaseType",
                   coalesce(sim.trace_scope,'') as "simulationTraceScope",coalesce(sim.process_version,'') as "simulationProcessVersion",
                   (sim.run_id is not null and sim.process_version=p.process_version) as "simulationCurrentVersion",
                   case when options.compact and octet_length(coalesce(sim.evidence_json,'{}')::text)>options.compact_limit_bytes
                        then jsonb_build_object('compact',true,'omitted',true,'byteLength',octet_length(coalesce(sim.evidence_json,'{}')::text))::text
                        else coalesce(sim.evidence_json,'{}')::text end as "simulationEvidenceJson",coalesce(sim.executed_by,'') as "simulationExecutedBy",
                   sim.executed_at as "simulationExecutedAt",
                   5 as "fixtureSuiteRequiredTypeCount",coalesce(suite.fixture_suite_covered_type_count,0) as "fixtureSuiteCoveredTypeCount",
                   coalesce(suite.fixture_suite_case_count,0) as "fixtureSuiteCaseCount",coalesce(suite.fixture_suite_case_count,0) as "fixtureSuiteActiveCaseCount",coalesce(suite.fixture_suite_approved_case_count,0) as "fixtureSuiteApprovedCaseCount",
                   coalesce(suite.fixture_suite_current_run_count,0) as "fixtureSuiteCurrentRunCount",coalesce(suite.fixture_suite_stale_run_count,0) as "fixtureSuiteStaleRunCount",
                   coalesce(suite.fixture_suite_not_run_count,0) as "fixtureSuiteNotRunCount",coalesce(suite.fixture_suite_passed_run_count,0) as "fixtureSuitePassedRunCount",
                   coalesce(suite.fixture_suite_blocked_run_count,0) as "fixtureSuiteBlockedRunCount",
                   coalesce(suite.fixture_suite_covered_types,'') as "fixtureSuiteCoveredTypes",coalesce(suite.fixture_suite_missing_types,'HAPPY_PATH, AUTHORITY, ISOLATION, EXCEPTION, RECOVERY') as "fixtureSuiteMissingTypes",
                   case when options.compact and octet_length(coalesce(suite.fixture_suite_cases_json,'[]'))>options.compact_limit_bytes
                        then jsonb_build_object('compact',true,'omitted',true,'byteLength',octet_length(coalesce(suite.fixture_suite_cases_json,'[]')))::text
                        else coalesce(suite.fixture_suite_cases_json,'[]') end as "fixtureSuiteCasesJson",
                   case when coalesce(suite.fixture_suite_covered_type_count,0)=5 then 'COMPLETE' when coalesce(suite.fixture_suite_covered_type_count,0)>0 then 'PARTIAL' else 'MISSING' end as "fixtureSuiteCoverageState",
                   case when coalesce(suite.fixture_suite_case_count,0)=0 then 'NOT_RUN'
                        when coalesce(suite.fixture_suite_blocked_run_count,0)>0 then 'BLOCKED'
                        when coalesce(suite.fixture_suite_current_run_count,0)=coalesce(suite.fixture_suite_case_count,0)
                         and coalesce(suite.fixture_suite_passed_run_count,0)=coalesce(suite.fixture_suite_case_count,0) then 'PASSED'
                        else 'NOT_RUN' end as "fixtureSuiteExecutionState",
                    coalesce(business.business_test_result,'NOT_RUN') as "businessTestResult",
                    coalesce(business.business_evidence_status,'RUNTIME_COMMIT_UNAVAILABLE') as "businessEvidenceStatus",
                    coalesce(business.qa_run_id::text,'') as "businessCaseCode",
                    case when options.compact and octet_length(coalesce(business.evidence_json,'{}')::text)>options.compact_limit_bytes
                         then jsonb_build_object('compact',true,'omitted',true,'byteLength',octet_length(coalesce(business.evidence_json,'{}')::text))::text
                         else coalesce(business.evidence_json,'{}')::text end as "businessEvidenceJson",
                    coalesce(business.executed_by,'') as "businessExecutedBy",business.executed_at as "businessExecutedAt",
                    coalesce(business.evidence_process_version,'') as "businessProcessVersion",
                    coalesce(business.source_commit,'') as "businessSourceCommit",
                    coalesce(business.contract_fingerprint,'') as "businessContractFingerprint",
                    coalesce(business.current_contract_fingerprint,'') as "currentBusinessContractFingerprint",
                    coalesce(business.current_runtime_source_commit,'') as "currentRuntimeSourceCommit",
                    coalesce(business.execution_environment,'') as "businessExecutionEnvironment",
                    coalesce(business.evidence_uri,'') as "businessEvidenceUri",
                    coalesce(business.evidence_hash,'') as "businessEvidenceHash",
                    coalesce(business.current_version,false) as "businessCurrentVersion",
                   case
                     when coalesce(business.business_test_result,'NOT_RUN') in('PASSED','BLOCKED') then 'BUSINESS_E2E'
                     when latest.run_id is not null or (sim.run_id is not null and sim.process_version=p.process_version) then 'CONTRACT_SIMULATION'
                     else 'DESIGN' end as "evidenceTier",
                   case
                     when coalesce(business.business_test_result,'NOT_RUN') in('PASSED','BLOCKED') then business.business_test_result
                     when coalesce(latest.result,'NOT_RUN') in('PASSED','BLOCKED') then latest.result
                     when sim.process_version=p.process_version and coalesce(sim.result,'NOT_RUN') in('PASSED','BLOCKED') then sim.result
                     else 'NOT_RUN' end as "actualResult",
                   case when coalesce(business.business_test_result,'NOT_RUN') in('PASSED','BLOCKED')
                        then coalesce(business.evidence_json->'input','{}'::jsonb)::text else coalesce(latest.pre_input_json,'{}') end as "actualInput",
                   case when coalesce(business.business_test_result,'NOT_RUN') in('PASSED','BLOCKED')
                        then coalesce(business.evidence_json->'output',business.evidence_json,'{}'::jsonb)::text
                        when latest.run_id is not null then coalesce(latest.evidence_json,'{}')
                        when sim.process_version=p.process_version then coalesce(sim.evidence_json,'{}')::text
                        else '{}' end as "actualOutput",
                   case when coalesce(business.business_test_result,'NOT_RUN') in('PASSED','BLOCKED') then coalesce(business.evidence_json,'{}')::text
                        when latest.run_id is not null then coalesce(latest.evidence_json,'{}')
                        when sim.process_version=p.process_version then coalesce(sim.evidence_json,'{}')::text
                        else '{}' end as "actualEvidenceJson",
                   next_work.next_process_code as "nextProcessCode",coalesce(next_work.next_process_name,'') as "nextProcessName",
                   next_work.next_step_code as "nextStepCode",coalesce(next_work.next_step_name,'') as "nextStepName",
                   coalesce(next_screen.route_path,'') as "nextRoutePath",coalesce(next_work.transition_source,'WORKFLOW_COMPLETE') as "nextTransitionSource",
                   coalesce(next_work.transition_authoritative,false) as "nextTransitionAuthoritative",
                   case when coalesce(next_work.transition_authoritative,false) then 'AUTHORITATIVE_EDGE' else 'GUIDE_ONLY' end as "nextTransitionMode",
                   coalesce(destinations.destination_count,0) as "nextDestinationCount",
                   coalesce(destinations.destination_count,0)>1 as "nextHasBranching",
                   coalesce(destinations.destinations_json,'[]') as "nextDestinationsJson",
                   operational.contract_fingerprint as "contractFingerprint",
                   review.review_id as "reviewId",coalesce(review.review_status,'PENDING') as "reviewStatus",
                   coalesce(review.review_note,'') as "reviewNote",coalesce(review.reviewed_by,'') as "reviewedBy",
                   review.reviewed_at as "reviewedAt",coalesce(review.source_commit,'') as "reviewSourceCommit",
                   review.linked_job_id as "reviewLinkedJobId",review.screen_resource_id as "reviewScreenResourceId",
                   coalesce(review.capability_code,'ALL') as "reviewCapabilityCode",
                   (review.review_id is not null
                    and review.contract_fingerprint=operational.contract_fingerprint
                    and review.source_commit=coalesce(runtime.source_commit,'')) as "reviewCurrentVersion",
                   'HUMAN_REVIEW_ONLY' as "reviewEvidenceScope",
                   case when options.compact and octet_length(coalesce(scoped_reviews.inventory_json,'[]'))>options.compact_limit_bytes
                        then jsonb_build_object('compact',true,'omitted',true,'byteLength',octet_length(coalesce(scoped_reviews.inventory_json,'[]')))::text
                        else coalesce(scoped_reviews.inventory_json,'[]') end as "scopedReviewInventoryJson",
                   case when options.compact and octet_length(coalesce(scoped_reviews.inventory_json,'[]'))>options.compact_limit_bytes
                        then jsonb_build_object('compact',true,'omitted',true,'byteLength',octet_length(coalesce(scoped_reviews.inventory_json,'[]')))::text
                        else coalesce(scoped_reviews.inventory_json,'[]') end as "reviewScopesJson",
                   p.test_state as "testState",latest.screen_resource_id as "latestAuditScreenResourceId",
                   coalesce(latest.route_key,'') as "latestAuditRoutePath",coalesce(latest.audience,'') as "latestAuditAudience",
                   coalesce(latest.capability_code,'') as "latestAuditCapabilityCode",
                   metrics.scope_screen_count as "scopeScreenCount",metrics.scope_route_count as "scopeRouteCount",
                   metrics.scope_capability_count as "scopeCapabilityCount",metrics.scope_target_count as "scopeTargetCount"
              from filtered_steps p
              left join framework_business_work_type w on w.work_type_code=upper(p.domain_code)
              left join primary_screen screen using(process_code,step_code)
              left join latest_step_run latest using(process_code,step_code)
               left join latest_simulation sim using(process_code,step_code)
              left join current_business_e2e business using(process_code,step_code)
              left join fixture_suite_rollup suite using(process_code,step_code)
              left join lateral (
                select count(distinct assignment.account_id)::integer assigned_account_count,
                       string_agg(distinct assignment.account_id,', ' order by assignment.account_id) assigned_account_ids,
                       md5(coalesce(string_agg(to_jsonb(assignment)::text,'|' order by assignment.account_id,assignment.tenant_id,assignment.project_id,assignment.assignment_id),'')) assignment_fingerprint
                  from framework_account_actor_assignment assignment
                  join framework_actor_definition assigned_actor
                    on assigned_actor.actor_code=assignment.actor_code and assigned_actor.use_at='Y'
                 where assignment.actor_code=p.actor_code and assignment.assignment_status='ACTIVE'
                   and (assignment.valid_from is null or assignment.valid_from<=current_date)
                   and (assignment.valid_until is null or assignment.valid_until>=current_date)
              ) accounts on true
              left join lateral (
                select candidate.next_process_code,candidate.next_process_name,candidate.next_step_code,candidate.next_step_name,
                       candidate.transition_source,candidate.transition_authoritative
                  from (
                    (select p.process_code next_process_code,p.process_name next_process_name,target.step_code next_step_code,
                           target.step_name next_step_name,'PROCESS_FLOW_EDGE' transition_source,true transition_authoritative,0 priority,target.step_order
                      from framework_process_flow_edge edge
                      join framework_process_step target on target.process_code=edge.process_code and target.step_code=edge.to_step_code
                     where edge.process_code=p.process_code and edge.from_step_code=p.step_code and edge.use_at='Y'
                       and edge.review_status='VERIFIED'
                     order by case edge.edge_type when 'NEXT' then 0 when 'PARALLEL' then 1 else 2 end,target.step_order,edge.edge_id
                     limit 1)
                    union all
                    (select p.process_code,p.process_name,target.step_code,target.step_name,'STEP_ORDER',false,1,target.step_order
                      from framework_process_step target
                     where target.process_code=p.process_code and target.step_order>p.step_order
                     order by target.step_order limit 1)
                    union all
                    (select next_process.process_code,next_process.process_name,target.step_code,target.step_name,'PROCESS_SEQUENCE',false,2,target.step_order
                      from framework_process_definition next_process
                      join framework_process_step target on target.process_code=next_process.process_code
                     where next_process.process_code=p.next_process_code
                     order by target.step_order limit 1)
                  ) candidate
                 order by candidate.priority,candidate.step_order limit 1
              ) next_work on true
              left join lateral (
                select coalesce(case when binding.audience='ADMIN' then target.admin_path else target.user_path end,
                                target.user_path,target.admin_path,screen.route_key,'') route_path
                  from framework_process_step target
                  left join framework_process_step_screen_binding binding on binding.process_code=target.process_code
                    and binding.step_code=target.step_code and binding.binding_status='ACTIVE'
                  left join framework_screen_resource screen using(screen_resource_id)
                 where target.process_code=next_work.next_process_code and target.step_code=next_work.next_step_code
                 order by case binding.entry_mode when 'PRIMARY' then 0 else 1 end,
                          case binding.audience when 'USER' then 0 when 'ADMIN' then 1 when 'PUBLIC' then 2 else 3 end
                 limit 1
              ) next_screen on true
              left join lateral (
                select count(*)::integer destination_count,
                       jsonb_agg(jsonb_build_object(
                         'edgeId',edge.edge_id,'edgeType',edge.edge_type,'conditionCode',edge.condition_code,
                         'conditionContract',edge.condition_contract,'edgeActorCode',edge.actor_code,
                         'targetActorCode',target.actor_code,'sourceKind',edge.source_kind,
                         'nextProcessCode',edge.process_code,'nextStepCode',target.step_code,'nextStepName',target.step_name,
                         'userRoutePath',coalesce(target.user_path,''),'adminRoutePath',coalesce(target.admin_path,''),
                         'routePath',case
                           when nullif(btrim(coalesce(target.user_path,'')),'') is null
                            and nullif(btrim(coalesce(target.admin_path,'')),'') is null then null
                           when nullif(btrim(coalesce(target.user_path,'')),'') is null then target.admin_path
                           when nullif(btrim(coalesce(target.admin_path,'')),'') is null then target.user_path
                           when btrim(target.user_path)=btrim(target.admin_path) then target.user_path
                           else null end,
                         'routeResolution',case
                           when nullif(btrim(coalesce(target.user_path,'')),'') is null
                            and nullif(btrim(coalesce(target.admin_path,'')),'') is null then 'MISSING'
                           when nullif(btrim(coalesce(target.user_path,'')),'') is not null
                            and nullif(btrim(coalesce(target.admin_path,'')),'') is not null
                            and btrim(target.user_path)<>btrim(target.admin_path) then 'MULTIPLE_CANDIDATES'
                           else 'SINGLE' end,
                         'screenRouteInventory',coalesce(screen_routes.route_inventory,'[]'::jsonb),'authoritative',true)
                         order by case edge.edge_type when 'NEXT' then 0 when 'PARALLEL' then 1 else 2 end,
                                  target.step_order,edge.edge_id)::text destinations_json
                  from framework_process_flow_edge edge
                  join framework_process_step target on target.process_code=edge.process_code and target.step_code=edge.to_step_code
                  left join lateral (
                    select coalesce(jsonb_agg(jsonb_build_object(
                             'audience',inventory.audience,'entryMode',inventory.entry_mode,
                             'screenResourceId',inventory.screen_resource_id,'routePath',inventory.route_key)
                             order by case inventory.entry_mode when 'PRIMARY' then 0 else 1 end,
                                      case inventory.audience when 'USER' then 0 when 'ADMIN' then 1 when 'PUBLIC' then 2 else 3 end,
                                      inventory.route_key),'[]'::jsonb) route_inventory
                      from (
                        select distinct binding.audience,binding.entry_mode,screen.screen_resource_id,screen.route_key
                          from framework_process_step_screen_binding binding
                          join framework_screen_resource screen using(screen_resource_id)
                         where binding.process_code=target.process_code and binding.step_code=target.step_code
                           and binding.binding_status='ACTIVE'
                      ) inventory
                  ) screen_routes on true
                 where edge.process_code=p.process_code and edge.from_step_code=p.step_code
                   and edge.use_at='Y' and edge.review_status='VERIFIED'
              ) destinations on true
              cross join lateral (
                select md5(concat_ws('|',p.domain_code,p.domain_name,p.domain_order,p.process_code,p.process_name,
                       p.workflow_order,p.workflow_phase,p.process_role,p.process_version,p.step_contract_json,p.operational_target_fingerprint,
                       p.actor_code,p.actor_capability_codes,coalesce(accounts.assignment_fingerprint,''),
                       coalesce(next_work.next_process_code,''),coalesce(next_work.next_step_code,''),
                       coalesce(next_work.transition_source,'WORKFLOW_COMPLETE'),coalesce(next_work.transition_authoritative,false)::text,
                       coalesce(next_screen.route_path,''),coalesce(destinations.destinations_json,'[]'))) contract_fingerprint
              ) operational
              left join lateral (
                select usage.review_id,usage.review_status,usage.review_note,usage.contract_fingerprint,usage.source_commit,
                       usage.linked_job_id,usage.screen_resource_id,usage.capability_code,usage.reviewed_by,usage.reviewed_at
                  from framework_system_usage_review usage
                 where usage.process_code=p.process_code and usage.step_code=p.step_code
                   and usage.screen_resource_id is null and usage.capability_code='ALL'
                 order by usage.reviewed_at desc,usage.review_id desc limit 1
              ) review on true
              left join lateral (
                select coalesce(jsonb_agg(jsonb_build_object(
                         'reviewId',scoped.review_id,'screenResourceId',scoped.screen_resource_id,
                         'capabilityCode',scoped.capability_code,'reviewStatus',scoped.review_status,
                         'reviewNote',scoped.review_note,'reviewedBy',scoped.reviewed_by,'reviewedAt',scoped.reviewed_at,
                         'reviewSourceCommit',scoped.source_commit,'linkedJobId',scoped.linked_job_id,
                         'scopeType',case when scoped.screen_resource_id is null then 'STEP'
                                          when scoped.capability_code='ALL' then 'SCREEN' else 'FUNCTION' end,
                         'currentVersion',scoped.current_version)
                         order by scoped.screen_resource_id nulls first,scoped.capability_code),'[]'::jsonb)::text inventory_json
                  from (
                    select distinct on (usage.screen_resource_id,usage.capability_code) usage.*,
                           (usage.source_commit=coalesce((select source_commit from runtime_release),'') and
                            case when usage.screen_resource_id is null
                                 then usage.contract_fingerprint=operational.contract_fingerprint
                                 when usage.capability_code<>'ALL' then exists(
                                   select 1 from capability_scope_fingerprints capability_scope
                                    where capability_scope.process_code=usage.process_code and capability_scope.step_code=usage.step_code
                                      and capability_scope.screen_resource_id=usage.screen_resource_id
                                      and capability_scope.capability_code=usage.capability_code
                                      and capability_scope.capability_contract_fingerprint=usage.contract_fingerprint)
                                 else exists(
                                   select 1 from screen_scope_fingerprints screen_scope
                                    where screen_scope.process_code=usage.process_code and screen_scope.step_code=usage.step_code
                                      and screen_scope.screen_resource_id=usage.screen_resource_id
                                      and screen_scope.screen_contract_fingerprint=usage.contract_fingerprint)
                                 end) current_version
                      from framework_system_usage_review usage
                     where usage.process_code=p.process_code and usage.step_code=p.step_code
                     order by usage.screen_resource_id nulls first,usage.capability_code,usage.reviewed_at desc,usage.review_id desc
                  ) scoped
              ) scoped_reviews on true
              left join runtime_release runtime on true
              cross join scope_metrics metrics
              cross join report_options options
             order by p.domain_order,p.workflow_order,p.process_code,p.step_order,p.step_code
            """,compact,SYSTEM_TEST_REPORT_COMPACT_JSON_LIMIT_BYTES,domain,domain,process,process,size,offset,result,result);

        Map<String,Map<String,Object>> processIndex=new LinkedHashMap<>(),workTypeIndex=new LinkedHashMap<>();
        Set<String> reportedProcesses=new HashSet<>();
        int routed=0,passedItems=0,blockedItems=0,notRunItems=0,verifiedContracts=0;
        long auditedContractTargets=0;
        int fixtureSuiteBindingCount=0,fixtureSuiteCompleteStepCount=0,fixtureSuiteIncompleteStepCount=0,fixtureSuiteCurrentRunCount=0;
        int businessPassedSteps=0,businessBlockedSteps=0,businessNotRunSteps=0,businessFingerprintUnavailableSteps=0,businessRuntimeCommitUnavailableSteps=0;
        Map<String,List<String>> businessStatesByProcess=new LinkedHashMap<>();
        for(Map<String,Object> item:items){
            String processKey=String.valueOf(item.get("processCode")),workTypeKey=String.valueOf(item.get("domainCode"));
            reportedProcesses.add(processKey);
            int screenCount=((Number)item.getOrDefault("screenCount",0)).intValue();
            if(screenCount>0)routed++;
            String state=String.valueOf(item.getOrDefault("testState","NOT_RUN"));
            if("PASSED".equals(state))passedItems++;else if("BLOCKED".equals(state))blockedItems++;else notRunItems++;
            boolean allScreensReady=screenCount>0&&!String.valueOf(item.getOrDefault("implementationStatuses","")).matches(".*(DESIGN_ONLY|DESIGNED|PLANNED|BLOCKED).*" );
            if(allScreensReady&&meaningfulSystemContract(item.get("inputContract"))&&meaningfulSystemContract(item.get("outputContract"))
                &&(!Boolean.TRUE.equals(item.get("requiresApi"))||meaningfulSystemContract(item.get("apiContract"))))verifiedContracts++;
            fixtureSuiteBindingCount+=((Number)item.getOrDefault("fixtureSuiteCaseCount",0)).intValue();
            fixtureSuiteCurrentRunCount+=((Number)item.getOrDefault("fixtureSuiteCurrentRunCount",0)).intValue();
            auditedContractTargets+=((Number)item.getOrDefault("auditedTargetCount",0)).longValue();
            if("COMPLETE".equals(item.get("fixtureSuiteCoverageState")))fixtureSuiteCompleteStepCount++;else fixtureSuiteIncompleteStepCount++;
            String businessState=String.valueOf(item.getOrDefault("businessTestResult","NOT_RUN"));
            if("PASSED".equals(businessState))businessPassedSteps++;
            else if("BLOCKED".equals(businessState))businessBlockedSteps++;
            else{businessState="NOT_RUN";businessNotRunSteps++;}
            if("CONTRACT_FINGERPRINT_UNAVAILABLE".equals(item.get("businessEvidenceStatus")))businessFingerprintUnavailableSteps++;
            if("RUNTIME_COMMIT_UNAVAILABLE".equals(item.get("businessEvidenceStatus")))businessRuntimeCommitUnavailableSteps++;
            businessStatesByProcess.computeIfAbsent(processKey,key->new ArrayList<>()).add(businessState);
            Map<String,Object> processRow=processIndex.computeIfAbsent(processKey,key->newSystemAggregate(item,"PROCESS"));
            processRow.put("scenarioCount",Math.max(((Number)processRow.get("scenarioCount")).intValue(),((Number)item.getOrDefault("scenarioCount",0)).intValue()));
            incrementSystemAggregate(processRow,state);
            Map<String,Object> workTypeRow=workTypeIndex.computeIfAbsent(workTypeKey,key->newSystemAggregate(item,"WORK_TYPE"));
            incrementSystemAggregate(workTypeRow,state);
            @SuppressWarnings("unchecked") Set<String> processCodes=(Set<String>)workTypeRow.computeIfAbsent("_processCodes",key->new HashSet<String>());
            processCodes.add(processKey);workTypeRow.put("processCount",processCodes.size());
        }
        List<Map<String,Object>> processes=new ArrayList<>(processIndex.values());
        List<Map<String,Object>> workTypes=new ArrayList<>(workTypeIndex.values());
        workTypes.forEach(row->row.remove("_processCodes"));
        int e2eCoveredProcesses=0,e2ePassedProcesses=0,e2eBlockedProcesses=0;
        for(List<String> states:businessStatesByProcess.values()){
            boolean allCurrent=!states.isEmpty()&&states.stream().noneMatch("NOT_RUN"::equals);
            boolean allPassed=!states.isEmpty()&&states.stream().allMatch("PASSED"::equals);
            boolean anyBlocked=states.stream().anyMatch("BLOCKED"::equals);
            if(allCurrent)e2eCoveredProcesses++;
            if(allPassed)e2ePassedProcesses++;
            if(anyBlocked)e2eBlockedProcesses++;
        }
        Map<String,Object> summary=new LinkedHashMap<>();
        summary.put("workTypeCount",workTypes.size());summary.put("processCount",reportedProcesses.size());summary.put("stepCount",items.size());
        summary.put("totalStepCount",totalStepCount);summary.put("pageReturnedStepCount",items.size());
        summary.put("screenCount",items.isEmpty()?0:items.get(0).get("scopeScreenCount"));
        summary.put("routeCount",items.isEmpty()?0:items.get(0).get("scopeRouteCount"));
        summary.put("capabilityCount",items.isEmpty()?0:items.get(0).get("scopeCapabilityCount"));
        summary.put("auditTargetCount",items.isEmpty()?0:items.get(0).get("scopeTargetCount"));
        long requiredContractTargets=items.isEmpty()?0:((Number)items.get(0).getOrDefault("scopeTargetCount",0)).longValue();
        summary.put("requiredAuditTargetCount",requiredContractTargets);summary.put("auditedCapabilityTargetCount",auditedContractTargets);
        summary.put("auditCoveragePercent",requiredContractTargets==0?100.0:Math.round(auditedContractTargets*10000.0/requiredContractTargets)/100.0);
        summary.put("auditCoverageState",requiredContractTargets==0||auditedContractTargets>=requiredContractTargets?"COMPLETE":auditedContractTargets==0?"NOT_RUN":"PARTIAL");
        summary.put("routedStepCount",routed);summary.put("passedCount",passedItems);summary.put("blockedCount",blockedItems);summary.put("notRunCount",notRunItems);
        summary.put("verifiedContractCount",verifiedContracts);summary.put("totalContractCount",items.size());summary.put("matchedItemCount",items.size());
        summary.put("e2eCoveredProcessCount",e2eCoveredProcesses);summary.put("e2eUncoveredProcessCount",reportedProcesses.size()-e2eCoveredProcesses);
        summary.put("e2ePassedProcessCount",e2ePassedProcesses);summary.put("e2eBlockedProcessCount",e2eBlockedProcesses);
        summary.put("e2eCurrentEvidenceStepCount",businessPassedSteps+businessBlockedSteps);
        summary.put("e2ePassedStepCount",businessPassedSteps);summary.put("e2eBlockedStepCount",businessBlockedSteps);summary.put("e2eNotRunStepCount",businessNotRunSteps);
        summary.put("e2eContractFingerprintUnavailableStepCount",businessFingerprintUnavailableSteps);
        summary.put("e2eRuntimeCommitUnavailableStepCount",businessRuntimeCommitUnavailableSteps);
        summary.put("businessEvidenceStatus",businessRuntimeCommitUnavailableSteps>0?"RUNTIME_COMMIT_UNAVAILABLE":businessFingerprintUnavailableSteps>0?"CONTRACT_FINGERPRINT_UNAVAILABLE":businessBlockedSteps>0?"CURRENT_VERSION_FAILED":businessPassedSteps==items.size()&&!items.isEmpty()?"CURRENT_VERSION_PASS":businessPassedSteps>0?"PARTIAL_CURRENT_VERSION_EVIDENCE":"NO_CURRENT_VERSION_EVIDENCE");
        summary.put("fixtureSuiteRequiredTypeCount",5);summary.put("fixtureSuiteBindingCount",fixtureSuiteBindingCount);
        summary.put("fixtureSuiteCompleteStepCount",fixtureSuiteCompleteStepCount);summary.put("fixtureSuiteIncompleteStepCount",fixtureSuiteIncompleteStepCount);
        summary.put("fixtureSuiteCurrentRunCount",fixtureSuiteCurrentRunCount);summary.put("fixtureSuiteMode","INVENTORY_AND_SIMULATION_EVIDENCE_ONLY");
        summary.put("auditTargetMode","ACTIVE_BINDING_CAPABILITY");
        summary.put("summaryScope","PAGE");summary.put("resultFilterMode","WITHIN_STRUCTURAL_PAGE");
        Map<String,Object> filters=new LinkedHashMap<>();filters.put("domainCode",domain);filters.put("processCode",process);filters.put("result",result);
        List<Map<String,Object>> sanitizedItems=items.stream().map(ActorProcessGovernanceService::redactSystemTestItem).toList();
        List<Map<String,Object>> responseItems=compact?sanitizedItems.stream().map(ActorProcessGovernanceService::compactSystemTestItem).toList():sanitizedItems;
        Map<String,Object> report=new LinkedHashMap<>();report.put("success",true);report.put("generatedAt",java.time.Instant.now().toString());
        report.put("compact",compact);
        report.put("pagination",Map.of(
            "page",page,"size",size,"returnedItemCount",items.size(),"totalStepCount",totalStepCount,
            "hasNext",offset+size<totalStepCount,"mode","STRUCTURAL_SCOPE"
        ));
        report.put("orderContract",Map.of(
            "scope","WORK_TYPE_PROCESS_STEP",
            "fields",List.of("domainOrder","workflowOrder","processCode","stepOrder","stepCode"),
            "direction","ASC"
        ));
        report.put("auditMode","CONTRACT_ONLY");report.put("businessFunctionsExecuted",false);report.put("filters",filters);report.put("summary",summary);
        report.put("workTypes",workTypes);report.put("processes",processes);report.put("items",responseItems);
        return report;
    }

    static Map<String,Object> compactSystemTestItem(Map<String,Object> source){
        Map<String,Object> compacted=new LinkedHashMap<>(source);
        for(String field:SYSTEM_TEST_REPORT_LARGE_JSON_FIELDS){
            Object value=compacted.get(field);
            if(value==null)continue;
            String raw=value instanceof String text?text:toJson(value);
            int byteLength=raw.getBytes(java.nio.charset.StandardCharsets.UTF_8).length;
            if(byteLength<=SYSTEM_TEST_REPORT_COMPACT_JSON_LIMIT_BYTES)continue;
            compacted.put(field,toJson(Map.of(
                "compact",true,"omitted",true,"byteLength",byteLength,"sha256",sha256Hex(raw)
            )));
        }
        // A compact catalogue row is navigation/summary data, not enough
        // evidence to approve or reject a concrete screen/function scope.
        compacted.put("reviewCriticalFieldsComplete",false);
        compacted.put("reviewAllowed",false);
        return compacted;
    }

    private static final Set<String> SYSTEM_REPORT_SECRET_KEY_FRAGMENTS=Set.of(
        "password","passwd","pwd","accesstoken","refreshtoken","token","authorization","cookie",
        "secret","otp","proof","developmentcode","verificationcode","apikey","privatekey","credential",
        "sessionid","csrf","jwt"
    );
    private static final Set<String> SYSTEM_REPORT_EVIDENCE_FIELDS=Set.of(
        "actualInput","actualOutput","actualEvidenceJson","latestPreInputJson","latestEvidenceJson",
        "latestInput","latestOutput","evidenceJson","simulationEvidenceJson","businessEvidenceJson",
        "fixtureSuiteCasesJson","screenFunctionInventoryJson","scopedReviewInventoryJson","reviewScopesJson","nextDestinationsJson"
    );

    static Map<String,Object> redactSystemTestItem(Map<String,Object> source){
        Map<String,Object> redacted=new LinkedHashMap<>(source);
        for(String field:SYSTEM_REPORT_EVIDENCE_FIELDS){
            Object value=redacted.get(field);
            if(value==null)continue;
            redacted.put(field,redactSystemReportEvidence(value));
        }
        return redacted;
    }

    private static String redactSystemReportEvidence(Object value){
        String raw=value instanceof String text?text:toJson(value);
        try{
            com.fasterxml.jackson.databind.ObjectMapper mapper=new com.fasterxml.jackson.databind.ObjectMapper();
            com.fasterxml.jackson.databind.JsonNode parsed=mapper.readTree(raw);
            if(parsed==null)return "{}";
            redactSystemReportNode(parsed);
            return mapper.writeValueAsString(parsed);
        }catch(Exception ignored){
            return "{\"redacted\":true,\"reason\":\"UNPARSEABLE_EVIDENCE\"}";
        }
    }

    private static void redactSystemReportNode(com.fasterxml.jackson.databind.JsonNode node){
        if(node instanceof com.fasterxml.jackson.databind.node.ObjectNode object){
            List<String> fields=new ArrayList<>();object.fieldNames().forEachRemaining(fields::add);
            for(String field:fields){
                String normalized=field.replaceAll("[^A-Za-z0-9]","").toLowerCase(Locale.ROOT);
                boolean secret=SYSTEM_REPORT_SECRET_KEY_FRAGMENTS.stream().anyMatch(normalized::contains);
                if(secret)object.put(field,"[REDACTED]");else redactSystemReportNode(object.get(field));
            }
        }else if(node instanceof com.fasterxml.jackson.databind.node.ArrayNode array){
            array.forEach(ActorProcessGovernanceService::redactSystemReportNode);
        }
    }

    /**
     * Runs deterministic metadata/contract checks and records only immutable
     * test evidence. It does not invoke commandCode, business APIs, or state
     * transitions, and therefore must never be presented as business E2E.
     */
    @Transactional
    public Map<String,Object> startSystemProcessContractAuditBatch(Map<String,Object> body,String requestedBy){
        int pageSize=Math.max(1,Math.min(integerOr(body,"pageSize",250),500));
        Map<String,Object> batch=jsonMap(jdbc.queryForObject(
                "select framework_start_screen_workflow_audit_batch(?,?)::text",String.class,requestedBy,pageSize));
        batch.put("batchStatus",batch.get("status"));
        return Map.of("success",true,"batch",batch);
    }

    @Transactional
    public Map<String,Object> completeSystemProcessContractAuditBatch(UUID auditBatchId,String requestedBy){
        Map<String,Object> batch=jsonMap(jdbc.queryForObject(
                "select framework_complete_screen_workflow_audit_batch(?,?)::text",String.class,auditBatchId,requestedBy));
        batch.put("batchStatus",batch.get("status"));
        batch.put("stagedPageCount",batch.get("pageCount"));
        batch.put("stagedTargetCount",batch.get("targetCount"));
        return Map.of("success",true,"batch",batch);
    }

    @Transactional
    public Map<String,Object> failSystemProcessContractAuditBatch(UUID auditBatchId,Map<String,Object> body,String requestedBy){
        String failureCode=def(body,"failureCode","AUDIT_EXECUTION_FAILED");
        String failureDetail=str(body,"failureDetail");
        Map<String,Object> batch=jsonMap(jdbc.queryForObject(
                "select framework_fail_screen_workflow_audit_batch(?,?,?,?)::text",String.class,
                auditBatchId,requestedBy,failureCode,failureDetail));
        batch.put("batchStatus",batch.get("status"));
        return Map.of("success",true,"batch",batch);
    }

    @Transactional
    public Map<String,Object> auditSystemProcessContracts(Map<String,Object> body,String executedBy){
        String domain=str(body,"domainCode").toUpperCase(Locale.ROOT);
        String process=str(body,"processCode").toUpperCase(Locale.ROOT);
        String step=str(body,"stepCode").toUpperCase(Locale.ROOT);
        boolean compactResponse=bool(body,"compact")||"SUMMARY".equalsIgnoreCase(str(body,"responseMode"));
        int maxSteps=Math.max(1,Math.min(integerOr(body,"maxSteps",1000),2000));
        int targetOffset=Math.max(0,integerOr(body,"targetOffset",0));
        int maxTargets=Math.max(1,Math.min(integerOr(body,"maxTargets",250),500));
        String auditBatchId=str(body,"auditBatchId").trim();
        Map<String,Object> auditBatch=null;
        int auditPageNumber=-1;
        if(!auditBatchId.isBlank()){
            UUID.fromString(auditBatchId);
            List<Map<String,Object>> batches=jdbc.queryForList("""
                select audit_batch_id::text as "auditBatchId",source_commit as "sourceCommit",
                       runtime_identity_hash as "runtimeIdentityHash",catalog_fingerprint as "catalogFingerprint",
                       target_inventory_fingerprint as "targetInventoryFingerprint",
                       expected_page_count as "expectedPageCount",expected_target_count as "expectedTargetCount",
                       page_size as "pageSize",batch_status as "batchStatus",requested_by as "requestedBy"
                  from framework_screen_workflow_audit_batch where audit_batch_id=cast(? as uuid)
                """,auditBatchId);
            if(batches.size()!=1)throw new IllegalArgumentException("SCREEN_WORKFLOW_AUDIT_BATCH_NOT_FOUND");
            auditBatch=batches.get(0);
            if(!"RUNNING".equals(auditBatch.get("batchStatus"))||!executedBy.equals(auditBatch.get("requestedBy")))
                throw new SecurityException("SCREEN_WORKFLOW_AUDIT_BATCH_OR_ACTOR_MISMATCH");
            if(!domain.isBlank()||!process.isBlank()||!step.isBlank()||body.containsKey("maxSteps"))
                throw new IllegalArgumentException("HOURLY_ALL_PROCESS_BATCH_REQUIRES_UNFILTERED_CANONICAL_SCOPE");
            if(((Number)auditBatch.get("pageSize")).intValue()!=maxTargets||targetOffset%maxTargets!=0)
                throw new IllegalArgumentException("SCREEN_WORKFLOW_AUDIT_PAGE_GEOMETRY_MISMATCH");
            domain="";process="";step="";maxSteps=Integer.MAX_VALUE;
            auditPageNumber=targetOffset/maxTargets;
        }
        List<Map<String,Object>> targets;
        if(auditBatch!=null){
            targets=jdbc.queryForList("""
                select m.item_id as "itemId",target.binding_id as "bindingId",target.audience,
                       case when target.binding_id is null then null else 'ACTIVE' end as "bindingStatus",
                       target.screen_resource_id as "screenResourceId",target.route_key as "routePath",
                       screen.screen_name as "screenName",screen.implementation_status as "implementationStatus",
                       target.process_code as "processCode",target.step_code as "stepCode",
                       target.capability_code as "capabilityCode",fixture.test_case_id as "testCaseId",
                       fixture.pre_input_json as "fixturePreInputJson",fixture.expected_result as "fixtureExpectedResult",
                       fixture.expected_state as "fixtureExpectedState",batch.expected_target_count as "totalEligibleTargetCount",
                       target.target_ordinal as "auditTargetOrdinal",target.target_key as "auditTargetKey"
                  from framework_screen_workflow_audit_batch_target target
                  join framework_screen_workflow_audit_batch batch using(audit_batch_id)
                  left join framework_screen_resource screen using(screen_resource_id)
                  left join lateral (
                     select master.item_id from framework_page_development_item master
                      where master.screen_resource_id=target.screen_resource_id
                      order by case master.design_status when 'VERIFIED' then 0 else 1 end,
                               master.sequence_no,master.item_id limit 1
                   ) m on true
                  left join lateral (
                     select test.test_case_id,test.pre_input_json::text pre_input_json,
                            test.expected_result,coalesce(test.expected_state,'') expected_state
                       from framework_screen_workflow_test_case test
                      where test.screen_resource_id=target.screen_resource_id
                        and test.process_code=target.process_code and test.step_code=target.step_code
                        and test.capability_code in(target.capability_code,'ALL')
                        and test.expected_result='PASSED' and test.active=true
                      order by case when test.capability_code=target.capability_code then 0 else 1 end,
                               test.updated_at desc,test.test_case_id desc limit 1
                   ) fixture on true
                 where target.audit_batch_id=cast(? as uuid) and target.target_ordinal>=?
                 order by target.target_ordinal limit ?
                """,auditBatchId,(long)targetOffset,maxTargets+1);
        }else{
            targets=jdbc.queryForList("""
            with scoped_steps as materialized (
              select p.development_order,s.process_code,s.step_code,s.step_order
                from framework_process_step s join framework_process_definition p on p.process_code=s.process_code
               where (?='' or upper(p.domain_code)=?) and (?='' or s.process_code=?) and (?='' or s.step_code=?)
               order by p.development_order,s.process_code,s.step_order,s.step_code limit ?
            )
            , eligible_targets as materialized (
              select scoped.development_order,scoped.step_order,scoped.process_code,scoped.step_code,
                     b.binding_id,b.audience,b.binding_status,b.entry_mode,
                     screen.screen_resource_id,screen.route_key,screen.screen_name,screen.implementation_status,
                     coalesce(capability.capability_code,'ALL') capability_code,
                     count(*) over() total_eligible_target_count
                from scoped_steps scoped
                left join framework_process_step_screen_binding b
                  on b.process_code=scoped.process_code and b.step_code=scoped.step_code
                 and b.binding_status='ACTIVE'
                left join framework_screen_resource screen using(screen_resource_id)
                left join framework_screen_capability capability using(screen_resource_id)
            ), paged_targets as materialized (
              select * from eligible_targets
               order by development_order,process_code,step_order,step_code,
                        case entry_mode when 'PRIMARY' then 0 else 1 end,
                        case audience when 'USER' then 0 when 'ADMIN' then 1 when 'PUBLIC' then 2 else 3 end,
                        route_key,binding_id,capability_code
               limit ? offset ?
            )
            select m.item_id as "itemId",target.binding_id as "bindingId",target.audience,
                   target.binding_status as "bindingStatus",target.screen_resource_id as "screenResourceId",
                   target.route_key as "routePath",target.screen_name as "screenName",
                   target.implementation_status as "implementationStatus",target.process_code as "processCode",
                   target.step_code as "stepCode",target.capability_code as "capabilityCode",
                   fixture.test_case_id as "testCaseId",fixture.pre_input_json as "fixturePreInputJson",
                   fixture.expected_result as "fixtureExpectedResult",fixture.expected_state as "fixtureExpectedState",
                   target.total_eligible_target_count as "totalEligibleTargetCount"
              from paged_targets target
              left join lateral (
                 select master.item_id from framework_page_development_item master
                 where master.screen_resource_id=target.screen_resource_id
                 order by case master.design_status when 'VERIFIED' then 0 else 1 end,master.sequence_no,master.item_id limit 1
               ) m on true
              left join lateral (
                 select test.test_case_id,test.pre_input_json::text pre_input_json,
                        test.expected_result,coalesce(test.expected_state,'') expected_state
                   from framework_screen_workflow_test_case test
                  where test.screen_resource_id=target.screen_resource_id
                    and test.process_code=target.process_code and test.step_code=target.step_code
                    and test.capability_code in(target.capability_code,'ALL')
                    and test.expected_result='PASSED' and test.active=true
                  order by case when test.capability_code=target.capability_code then 0 else 1 end,
                           test.updated_at desc,test.test_case_id desc limit 1
               ) fixture on true
             order by target.development_order,target.process_code,target.step_order,target.step_code,
                      case target.entry_mode when 'PRIMARY' then 0 else 1 end,
                      case target.audience when 'USER' then 0 when 'ADMIN' then 1 when 'PUBLIC' then 2 else 3 end,
                      target.route_key,target.binding_id,target.capability_code
            """,domain,domain,process,process,step,step,maxSteps,maxTargets+1,targetOffset);
        }
        boolean hasMore=targets.size()>maxTargets;
        long totalEligibleTargetCount=auditBatch==null
                ?(targets.isEmpty()?0L:targets.get(0).get("totalEligibleTargetCount") instanceof Number total?total.longValue():targetOffset+targets.size())
                :((Number)auditBatch.get("expectedTargetCount")).longValue();
        if(hasMore)targets=new ArrayList<>(targets.subList(0,maxTargets));
        List<Map<String,Object>> runs=new ArrayList<>();
        ContractAuditQueryCache auditCache=new ContractAuditQueryCache();
        int passed=0,blocked=0,errors=0;
        Set<String> auditedSteps=new HashSet<>(),auditedBindings=new HashSet<>();
        for(int targetIndex=0;targetIndex<targets.size();targetIndex++){
            Map<String,Object> target=targets.get(targetIndex);
            if(auditBatch!=null){
                long expectedOrdinal=(long)targetOffset+targetIndex;
                long snapshotOrdinal=((Number)target.get("auditTargetOrdinal")).longValue();
                String snapshotKey=String.valueOf(target.get("auditTargetKey"));
                String computedTargetKey=sha256Hex(String.join("\u001f",
                        auditTargetPart(target.get("screenResourceId")),auditTargetPart(target.get("processCode")),
                        auditTargetPart(target.get("stepCode")),auditTargetPart(target.get("bindingId")),
                        auditTargetPart(target.get("audience")),auditTargetPart(target.get("routePath")),
                        auditTargetPart(target.get("capabilityCode"))));
                if(snapshotOrdinal!=expectedOrdinal||!snapshotKey.equals(computedTargetKey))
                    throw new IllegalStateException("SCREEN_WORKFLOW_AUDIT_TARGET_SNAPSHOT_MISMATCH");
                target.put("_auditBatchId",auditBatchId);
                target.put("_auditSourceCommit",auditBatch.get("sourceCommit"));
                target.put("_auditRuntimeIdentityHash",auditBatch.get("runtimeIdentityHash"));
                target.put("_auditPageNumber",auditPageNumber);
                target.put("_auditTargetOrdinal",snapshotOrdinal);
                target.put("_auditTargetKey",snapshotKey);
            }
            auditedSteps.add(target.get("processCode")+"|"+target.get("stepCode"));
            if(target.get("bindingId")!=null)auditedBindings.add(String.valueOf(target.get("bindingId")));
            if(target.get("screenResourceId")==null||target.get("itemId")==null){
                errors++;Map<String,Object> failure=new LinkedHashMap<>(target);failure.put("result","ERROR");
                failure.put("message",target.get("screenResourceId")==null?"ACTIVE_SCREEN_BINDING_NOT_FOUND":"SCREEN_DEVELOPMENT_ITEM_NOT_FOUND");runs.add(failure);continue;
            }
            if("DRAFT".equals(target.get("bindingStatus"))){
                blocked++;Map<String,Object> pending=new LinkedHashMap<>(target);pending.put("result","BLOCKED");
                pending.put("message","WORKFLOW_EVIDENCE_PENDING");runs.add(pending);continue;
            }
            Map<String,Object> request=new LinkedHashMap<>();
            request.put("itemId",target.get("itemId"));request.put("processCode",target.get("processCode"));
            request.put("stepCode",target.get("stepCode"));request.put("capabilityCode",target.get("capabilityCode"));
            request.put("audience",target.get("audience"));
            if(target.get("testCaseId")==null)request.put("preInputJson","{}");else request.put("testCaseId",target.get("testCaseId"));
            try{
                Map<String,Object> run=runDeterministicScreenWorkflowTest(request,executedBy,target,auditCache);
                runs.add(run);if("PASSED".equals(run.get("result")))passed++;else blocked++;
            }catch(Exception e){
                errors++;Map<String,Object> failure=new LinkedHashMap<>(target);failure.put("result","ERROR");
                failure.put("message",e.getMessage()==null?"CONTRACT_AUDIT_FAILED":e.getMessage());runs.add(failure);
            }
        }
        Map<String,Object> filters=new LinkedHashMap<>();filters.put("domainCode",domain);filters.put("processCode",process);filters.put("stepCode",step);filters.put("maxSteps",maxSteps);
        filters.put("targetOffset",targetOffset);filters.put("maxTargets",maxTargets);
        String outcome=errors>0?"ERROR":blocked>0?"BLOCKED":targets.isEmpty()?"BLOCKED":"PASSED";
        Map<String,Object> response=new LinkedHashMap<>();response.put("success",true);response.put("outcome",outcome);response.put("result",outcome);response.put("auditMode","CONTRACT_ONLY");
        response.put("businessFunctionsExecuted",false);response.put("compact",compactResponse);response.put("filters",filters);response.put("targetCount",targets.size());
        response.put("auditTargetMode","ACTIVE_BINDING_CAPABILITY");
        response.put("targetOffset",targetOffset);response.put("maxTargets",maxTargets);response.put("hasMore",hasMore);
        response.put("totalEligibleTargetCount",totalEligibleTargetCount);
        response.put("coveredTargetCount",Math.min(totalEligibleTargetCount,(long)targetOffset+targets.size()));
        response.put("targetCoverageState",hasMore?"PARTIAL":"COMPLETE");
        response.put("nextTargetOffset",hasMore?targetOffset+targets.size():null);
        response.put("auditedStepCount",auditedSteps.size());response.put("auditedBindingCount",auditedBindings.size());
        response.put("auditedCapabilityTargetCount",targets.stream().filter(row->row.get("screenResourceId")!=null).count());
        response.put("passedCount",passed);response.put("blockedCount",blocked);response.put("errorCount",errors);
        if(auditBatch!=null){
            Map<String,Object> pageReceipt=jsonMap(jdbc.queryForObject(
                    "select framework_record_screen_workflow_audit_page(cast(? as uuid),?,?,?,?,?,?,?,?)::text",
                    String.class,auditBatchId,executedBy,auditPageNumber,targetOffset,totalEligibleTargetCount,
                    passed,blocked,errors,hasMore));
            response.put("auditBatchId",auditBatchId);response.put("auditPageNumber",auditPageNumber);
            response.put("auditSourceCommit",auditBatch.get("sourceCommit"));
            response.put("auditRuntimeIdentityHash",auditBatch.get("runtimeIdentityHash"));
            response.put("auditCatalogFingerprint",auditBatch.get("catalogFingerprint"));
            response.put("auditTargetInventoryFingerprint",auditBatch.get("targetInventoryFingerprint"));
            response.put("auditPageFingerprint",pageReceipt.get("pageFingerprint"));
        }
        if(compactResponse){
            Map<String,Object> diagnostics=compactContractAuditDiagnostics(runs);
            response.putAll(diagnostics);
            response.put("runs",diagnostics.get("failureSamples"));
        }else{
            response.put("runs",runs);
        }
        return response;
    }

    /**
     * Persists an append-only human design/usability decision for one report row.
     * This record is deliberately separate from immutable runtime evidence and
     * therefore cannot promote DESIGN or CONTRACT_SIMULATION to BUSINESS_E2E.
     */
    @Transactional
    public Map<String,Object> saveSystemUsageReview(Map<String,Object> body,String reviewedBy){
        String reviewer=reviewedBy==null?"":reviewedBy.trim();
        if(reviewer.isBlank())throw new SecurityException("AUTHENTICATED_REVIEWER_REQUIRED");
        String process=req(body,"processCode").trim().toUpperCase(Locale.ROOT);
        String step=req(body,"stepCode").trim().toUpperCase(Locale.ROOT);
        String status=req(body,"reviewStatus").trim().toUpperCase(Locale.ROOT);
        String note=str(body,"reviewNote").trim();
        Object rawScreen=body.get("screenResourceId");
        Long screenId=rawScreen==null||String.valueOf(rawScreen).isBlank()?null:Long.parseLong(String.valueOf(rawScreen));
        if(screenId!=null&&screenId<=0)throw new IllegalArgumentException("screenResourceId must be a positive number");
        String capability=def(body,"capabilityCode","ALL").trim().toUpperCase(Locale.ROOT);
        if(capability.isBlank())capability="ALL";
        if(!Set.of("APPROVED","CHANGE_REQUESTED").contains(status))
            throw new IllegalArgumentException("reviewStatus must be APPROVED or CHANGE_REQUESTED");
        if("CHANGE_REQUESTED".equals(status)&&note.isBlank())
            throw new IllegalArgumentException("reviewNote is required for CHANGE_REQUESTED");
        if(screenId==null&&!"ALL".equals(capability))
            throw new IllegalArgumentException("screenResourceId is required for a capability review");
        String scopeFingerprint="";
        if(screenId!=null){
            Integer bindingCount=jdbc.queryForObject("""
                select count(*) from framework_process_step_screen_binding
                 where process_code=? and step_code=? and screen_resource_id=? and binding_status='ACTIVE'
                """,Integer.class,process,step,screenId);
            if(bindingCount==null||bindingCount==0)
                throw new IllegalArgumentException("ACTIVE_SCREEN_BINDING_NOT_FOUND: "+process+" / "+step+" / "+screenId);
            if(!"ALL".equals(capability)){
                Integer capabilityCount=jdbc.queryForObject("select count(*) from framework_screen_capability where screen_resource_id=? and capability_code=?",
                        Integer.class,screenId,capability);
                if(capabilityCount==null||capabilityCount==0)
                    throw new IllegalArgumentException("SCREEN_CAPABILITY_NOT_FOUND: "+screenId+" / "+capability);
            }
            scopeFingerprint="ALL".equals(capability)
                    ?screenReviewFingerprint(screenId,process,step)
                    :capabilityReviewFingerprint(screenId,process,step,capability);
        }
        List<Map<String,Object>> contract=jdbc.queryForList("""
            select p.process_version as "processVersion",
                   (select runtime.source_commit from framework_runtime_release_state runtime
                     where runtime.release_key='CARBONET_RUNTIME' and runtime.health_status='UP') as "sourceCommit"
              from framework_process_definition p join framework_process_step s using(process_code)
             where p.process_code=? and s.step_code=?
            """,process,step);
        if(contract.size()!=1)throw new IllegalArgumentException("PROCESS_STEP_NOT_FOUND: "+process+" / "+step);
        String version=String.valueOf(contract.get(0).get("processVersion"));
        Object rawFingerprint;
        if(screenId==null){
            Map<String,Object> detail=systemProcessTestReportStepDetail(process,step);
            @SuppressWarnings("unchecked") Map<String,Object> detailItem=(Map<String,Object>)detail.get("item");
            rawFingerprint=detailItem==null?null:detailItem.get("contractFingerprint");
        }else rawFingerprint=scopeFingerprint;
        if(rawFingerprint==null||String.valueOf(rawFingerprint).isBlank())
            throw new IllegalStateException("Current operational contract fingerprint is unavailable; review was not recorded: "+process+" / "+step);
        Object rawSourceCommit=contract.get(0).get("sourceCommit");
        if(rawSourceCommit==null||!String.valueOf(rawSourceCommit).matches("[0-9a-f]{40}"))
            throw new IllegalStateException("Current healthy runtime commit is unavailable; review was not recorded");
        String idempotency=str(body,"idempotencyKey").trim();
        if(idempotency.isBlank())idempotency=sha256Hex(String.join("|",process,step,String.valueOf(screenId),capability,status,note,version,
                String.valueOf(rawFingerprint),String.valueOf(rawSourceCommit),reviewer));
        if(idempotency.length()>128)throw new IllegalArgumentException("idempotencyKey must be 128 characters or less");
        jdbc.queryForObject("select count(*) from (select pg_advisory_xact_lock(hashtextextended(?,0))) lock",
                Integer.class,idempotency);
        List<Map<String,Object>> existing=jdbc.queryForList("""
            select review_id as "reviewId",process_code as "processCode",step_code as "stepCode",
                   screen_resource_id as "screenResourceId",capability_code as "capabilityCode",
                   review_status as "reviewStatus",review_note as "reviewNote",process_version as "processVersion",
                   contract_fingerprint as "contractFingerprint",source_commit as "reviewSourceCommit",
                   linked_job_id as "linkedJobId",reviewed_by as "reviewedBy",reviewed_at as "reviewedAt"
              from framework_system_usage_review where idempotency_key=?
            """,idempotency);
        if(!existing.isEmpty()){
            Map<String,Object> prior=new LinkedHashMap<>(existing.get(0));
            long priorScreen=prior.get("screenResourceId") instanceof Number number?number.longValue():0L;
            long requestedScreen=screenId==null?0L:screenId;
            if(!process.equals(prior.get("processCode"))||!step.equals(prior.get("stepCode"))
                    ||requestedScreen!=priorScreen||!capability.equals(prior.get("capabilityCode"))
                    ||!status.equals(prior.get("reviewStatus"))||!note.equals(prior.get("reviewNote"))
                    ||!version.equals(prior.get("processVersion"))
                    ||!String.valueOf(rawFingerprint).equals(prior.get("contractFingerprint"))
                    ||!String.valueOf(rawSourceCommit).equals(prior.get("reviewSourceCommit"))
                    ||!reviewer.equals(prior.get("reviewedBy")))
                throw new IllegalArgumentException("IDEMPOTENCY_KEY_REUSE_MISMATCH");
            prior.put("reviewCurrentVersion",String.valueOf(rawFingerprint).equals(prior.get("contractFingerprint"))
                    &&String.valueOf(rawSourceCommit).equals(prior.get("reviewSourceCommit")));
            prior.put("reviewScreenResourceId",prior.remove("screenResourceId"));
            prior.put("reviewCapabilityCode",prior.remove("capabilityCode"));
            prior.put("reviewEvidenceScope","HUMAN_REVIEW_ONLY");prior.put("idempotent",true);
            prior.put("nextAction","CHANGE_REQUESTED".equals(prior.get("reviewStatus"))?"DEVELOPMENT_REVIEW_PENDING":"NONE");
            return Map.of("success",true,"review",prior);
        }
        Long reviewId=jdbc.queryForObject("""
            insert into framework_system_usage_review(process_code,step_code,screen_resource_id,capability_code,idempotency_key,review_status,review_note,
                   process_version,contract_fingerprint,source_commit,reviewed_by)
            values(?,?,?,?,?,?,?,?,?,?,?) returning review_id
            """,Long.class,process,step,screenId,capability,idempotency,status,note,version,String.valueOf(rawFingerprint),String.valueOf(rawSourceCommit),reviewer);
        Long linkedJobId=null;
        if("CHANGE_REQUESTED".equals(status)){
            String targetPath="design-review/"+process.toLowerCase(Locale.ROOT)+"/"+step.toLowerCase(Locale.ROOT)+"/"+idempotency;
            String specification=toJson(Map.of(
                    "reviewId",reviewId,"reviewNote",note,"processVersion",version,
                    "contractFingerprint",String.valueOf(rawFingerprint),"sourceCommit",String.valueOf(rawSourceCommit),
                    "screenResourceId",screenId==null?0L:screenId,"capabilityCode",capability,
                    "approvalPolicy","MANUAL_APPROVAL_REQUIRED","autoDeploy",false));
            linkedJobId=jdbc.queryForObject("""
                insert into framework_development_job(process_code,step_code,job_type,job_name,target_path,
                       specification_json,job_status,approval_status,created_by)
                values(?,?,'DESIGN_REVIEW','실사용 검수 변경 요청',?,?,'PLANNED','PENDING',?)
                on conflict(process_code,step_code,job_type,target_path) do update set
                  job_name=excluded.job_name,specification_json=excluded.specification_json,
                  job_status=case when framework_development_job.job_status in('VERIFIED','COMPLETED')
                                  then framework_development_job.job_status else 'PLANNED' end,
                  approval_status=case when framework_development_job.job_status in('VERIFIED','COMPLETED')
                                       then framework_development_job.approval_status else 'PENDING' end,
                  updated_at=current_timestamp
                returning job_id
                """,Long.class,process,step,targetPath,specification,reviewer);
            jdbc.update("update framework_system_usage_review set linked_job_id=? where review_id=?",linkedJobId,reviewId);
            event(linkedJobId,"REVIEW_CHANGE_REQUESTED",null,"PLANNED",reviewer,toJson(Map.of(
                    "reviewId",reviewId,"contractFingerprint",String.valueOf(rawFingerprint),
                    "sourceCommit",String.valueOf(rawSourceCommit),"approvalStatus","PENDING")));
        }
        Map<String,Object> review=new LinkedHashMap<>();
        review.put("reviewId",reviewId);review.put("processCode",process);review.put("stepCode",step);
        review.put("reviewStatus",status);review.put("reviewNote",note);review.put("processVersion",version);
        review.put("reviewScreenResourceId",screenId);review.put("reviewCapabilityCode",capability);
        review.put("reviewedBy",reviewer);review.put("reviewSourceCommit",String.valueOf(rawSourceCommit));review.put("reviewCurrentVersion",true);
        review.put("linkedJobId",linkedJobId);review.put("idempotent",false);
        review.put("nextAction","CHANGE_REQUESTED".equals(status)?"DEVELOPMENT_REVIEW_PENDING":"NONE");
        review.put("reviewEvidenceScope","HUMAN_REVIEW_ONLY");
        return Map.of("success",true,"review",review);
    }

    /**
     * Produces a bounded diagnostics envelope for the paged audit endpoint.
     * Full immutable evidence remains persisted in framework_screen_workflow_test_run;
     * this response intentionally carries only aggregate reasons and small failure
     * samples so an hourly auditor never transfers every per-check evidence payload.
     */
    static Map<String,Object> compactContractAuditDiagnostics(List<Map<String,Object>> runs){
        Map<String,Integer> resultCounts=new TreeMap<>();
        Map<String,Integer> reasons=new HashMap<>();
        List<Map<String,Object>> errorSamples=new ArrayList<>(),blockedSamples=new ArrayList<>();
        for(Map<String,Object> run:runs){
            String result=String.valueOf(run.getOrDefault("result","UNKNOWN")).trim().toUpperCase(Locale.ROOT);
            if(result.isBlank())result="UNKNOWN";
            resultCounts.merge(result,1,Integer::sum);
            if("ERROR".equals(result)){
                String reason=boundedAuditText(run.get("message"),256,"CONTRACT_AUDIT_FAILED");
                reasons.merge(reason,1,Integer::sum);
                if(errorSamples.size()<5)errorSamples.add(compactContractAuditFailure(run,reason));
            }else if("BLOCKED".equals(result)){
                List<String> blockerCodes=compactAuditBlockerCodes(run.get("blockerCodes"));
                if(blockerCodes.isEmpty())reasons.merge("CONTRACT_BLOCKED",1,Integer::sum);
                else blockerCodes.forEach(reason->reasons.merge(reason,1,Integer::sum));
                if(blockedSamples.size()<5)blockedSamples.add(compactContractAuditFailure(run,blockerCodes.isEmpty()?"CONTRACT_BLOCKED":String.join(",",blockerCodes)));
            }
        }
        Map<String,Integer> reasonCounts=new LinkedHashMap<>();
        reasons.entrySet().stream()
            .sorted((left,right)->{
                int byCount=Integer.compare(right.getValue(),left.getValue());
                return byCount!=0?byCount:left.getKey().compareTo(right.getKey());
            })
            .limit(20)
            .forEach(entry->reasonCounts.put(entry.getKey(),entry.getValue()));
        List<Map<String,Object>> failureSamples=new ArrayList<>(errorSamples);
        failureSamples.addAll(blockedSamples);
        Map<String,Object> diagnostics=new LinkedHashMap<>();
        diagnostics.put("runCount",runs.size());diagnostics.put("runResultCounts",resultCounts);
        diagnostics.put("reasonCounts",reasonCounts);diagnostics.put("errorSamples",errorSamples);
        diagnostics.put("blockedSamples",blockedSamples);diagnostics.put("failureSamples",failureSamples);
        diagnostics.put("runsOmittedCount",Math.max(0,runs.size()-failureSamples.size()));
        return diagnostics;
    }

    private static Map<String,Object> compactContractAuditFailure(Map<String,Object> run,String reason){
        Map<String,Object> sample=new LinkedHashMap<>();
        for(String field:List.of("runId","screenResourceId","processCode","stepCode","routePath","audience","capabilityCode","result")){
            Object value=run.get(field);
            if(value!=null)sample.put(field,value instanceof String?boundedAuditText(value,512,""):value);
        }
        sample.put("reason",boundedAuditText(reason,512,"CONTRACT_AUDIT_FAILED"));
        sample.put("message",boundedAuditText(run.get("message"),512,""));
        sample.put("blockerCodes",compactAuditBlockerCodes(run.get("blockerCodes")));
        return sample;
    }

    private static List<String> compactAuditBlockerCodes(Object value){
        if(value==null)return List.of();
        Collection<?> values=value instanceof Collection<?> collection?collection:List.of(String.valueOf(value).split(","));
        return values.stream().map(item->boundedAuditText(item,96,"")).filter(item->!item.isBlank()).distinct().limit(20).toList();
    }

    private static String boundedAuditText(Object value,int maxLength,String fallback){
        String text=value==null?"":String.valueOf(value).trim();
        if(text.isBlank())return fallback;
        return text.length()<=maxLength?text:text.substring(0,maxLength)+"...";
    }

    private static String normalizeSystemTestResult(String value){
        String result=value==null?"":value.trim().toUpperCase(Locale.ROOT);
        if(result.isEmpty()||"ALL".equals(result))return "";
        if(!Set.of("PASSED","BLOCKED","NOT_RUN").contains(result))throw new IllegalArgumentException("result must be PASSED, BLOCKED, NOT_RUN, or empty");
        return result;
    }

    private static boolean meaningfulSystemContract(Object value){
        if(value==null)return false;
        String contract=String.valueOf(value).trim();
        return !contract.isEmpty()&&!Set.of("{}","[]","null","undefined","-","n/a","todo","tbd").contains(contract.toLowerCase(Locale.ROOT));
    }

    private static Map<String,Object> newSystemAggregate(Map<String,Object> item,String type){
        Map<String,Object> row=new LinkedHashMap<>();
        if("WORK_TYPE".equals(type)){
            row.put("workTypeCode",item.get("domainCode"));row.put("domainCode",item.get("domainCode"));
            row.put("workTypeName",item.get("domainName"));row.put("domainName",item.get("domainName"));
            row.put("sortOrder",item.getOrDefault("domainOrder",9999));row.put("processCount",0);
        }else{
            row.put("domainCode",item.get("domainCode"));row.put("processCode",item.get("processCode"));
            row.put("processName",item.get("processName"));row.put("processStatus",item.get("processStatus"));
            row.put("developmentOrder",item.get("developmentOrder"));row.put("scenarioCount",0);
        }
        row.put("stepCount",0);row.put("testedStepCount",0);row.put("passedStepCount",0);
        row.put("blockedStepCount",0);row.put("untestedStepCount",0);
        return row;
    }

    private static void incrementSystemAggregate(Map<String,Object> row,String state){
        row.put("stepCount",((Number)row.get("stepCount")).intValue()+1);
        if(!"NOT_RUN".equals(state))row.put("testedStepCount",((Number)row.get("testedStepCount")).intValue()+1);
        if("PASSED".equals(state))row.put("passedStepCount",((Number)row.get("passedStepCount")).intValue()+1);
        else if("BLOCKED".equals(state))row.put("blockedStepCount",((Number)row.get("blockedStepCount")).intValue()+1);
        else row.put("untestedStepCount",((Number)row.get("untestedStepCount")).intValue()+1);
    }

    /** Request-local cache used only by the bounded bulk contract auditor. */
    private static final class ContractAuditQueryCache {
        final Map<String,Map<String,Object>> transitionByStep=new HashMap<>();
        final Map<Long,Map<String,Object>> gateByScreen=new HashMap<>();
        final Map<Long,Map<String,Object>> fieldSummaryByScreen=new HashMap<>();
        final Map<Long,Map<String,Object>> capabilitySummaryByScreen=new HashMap<>();
        final Map<String,Map<String,Object>> testSummaryByStep=new HashMap<>();
        final Map<String,Map<String,Object>> preInputSummary=new HashMap<>();
    }

    /**
     * Executes the screen closing gate without an AI call. The result is derived
     * only from versioned actor/process/screen/data/test contracts and is stored
     * as immutable evidence. Missing contracts always block the screen.
     */
    @Transactional
    public Map<String,Object> runDeterministicScreenWorkflowTest(Map<String,Object> body,String executedBy){
        return runDeterministicScreenWorkflowTest(body,executedBy,null,null);
    }

    private Map<String,Object> runDeterministicScreenWorkflowTest(Map<String,Object> body,String executedBy,
                                                                   Map<String,Object> trustedAuditTarget,
                                                                   ContractAuditQueryCache auditCache){
        long itemId=Long.parseLong(req(body,"itemId"));
        String process=req(body,"processCode").trim().toUpperCase(Locale.ROOT);
        String step=req(body,"stepCode").trim().toUpperCase(Locale.ROOT);
        String capability=def(body,"capabilityCode","ALL").trim().toUpperCase(Locale.ROOT);
        Map<String,Object> item=trustedAuditTarget==null
            ?jdbc.queryForMap("select screen_resource_id,route_key,screen_name,implementation_status from framework_page_development_master where item_id=?",itemId)
            :Map.of("screen_resource_id",trustedAuditTarget.get("screenResourceId"),
                    "route_key",trustedAuditTarget.get("routePath"),
                    "screen_name",trustedAuditTarget.get("screenName"),
                    "implementation_status",trustedAuditTarget.get("implementationStatus"));
        long screenId=((Number)item.get("screen_resource_id")).longValue();
        String route=String.valueOf(item.get("route_key"));
        String audience=def(body,"audience","").trim().toUpperCase(Locale.ROOT);
        if(audience.isBlank()&&trustedAuditTarget==null){
            List<String> audiences=jdbc.queryForList("select audience from framework_process_step_screen_binding where screen_resource_id=? and process_code=? and step_code=? and binding_status='ACTIVE' order by case entry_mode when 'PRIMARY' then 0 else 1 end,case audience when 'USER' then 0 when 'ADMIN' then 1 when 'PUBLIC' then 2 else 3 end limit 1",String.class,screenId,process,step);
            if(!audiences.isEmpty())audience=audiences.get(0);
        }
        Integer bindingCount=trustedAuditTarget==null
            ?jdbc.queryForObject("select count(*) from framework_process_step_screen_binding where screen_resource_id=? and process_code=? and step_code=? and audience=? and binding_status='ACTIVE'",Integer.class,screenId,process,step,audience)
            :1;
        if(bindingCount==null||bindingCount==0)throw new IllegalArgumentException("SCREEN_PROCESS_BINDING_NOT_FOUND: "+process+" / "+step+" / "+route);
        Integer selectedCapabilityCount=trustedAuditTarget==null
            ?("ALL".equals(capability)?1:jdbc.queryForObject("select count(*) from framework_screen_capability where screen_resource_id=? and capability_code=?",Integer.class,screenId,capability))
            :1;
        if(selectedCapabilityCount==null||selectedCapabilityCount==0)throw new IllegalArgumentException("SCREEN_CAPABILITY_NOT_FOUND: "+capability);
        String requestedCaseId=str(body,"testCaseId");
        Long testCaseId=requestedCaseId.isBlank()?null:Long.parseLong(requestedCaseId);
        String preInputJson=def(body,"preInputJson","{}");
        String expectedResult="",expectedState="";
        if(testCaseId!=null){
            Map<String,Object> fixture=trustedAuditTarget==null
                ?jdbc.queryForMap("select pre_input_json::text as pre_input_json,expected_result,coalesce(expected_state,'') expected_state from framework_screen_workflow_test_case where test_case_id=? and screen_resource_id=? and process_code=? and step_code=? and capability_code in (?, 'ALL') and active=true",testCaseId,screenId,process,step,capability)
                :Map.of("pre_input_json",trustedAuditTarget.getOrDefault("fixturePreInputJson","{}"),
                        "expected_result",trustedAuditTarget.getOrDefault("fixtureExpectedResult","PASSED"),
                        "expected_state",trustedAuditTarget.getOrDefault("fixtureExpectedState",""));
            if(!body.containsKey("preInputJson"))preInputJson=String.valueOf(fixture.get("pre_input_json"));
            expectedResult=String.valueOf(fixture.get("expected_result"));expectedState=String.valueOf(fixture.get("expected_state"));
        }
        validateJsonObject(preInputJson,"preInputJson");
        String stepKey=process+'|'+step;
        Map<String,Object> transition=auditCache==null
            ?jdbc.queryForMap("select from_state,to_state from framework_process_step where process_code=? and step_code=?",process,step)
            :auditCache.transitionByStep.computeIfAbsent(stepKey,key->jdbc.queryForMap("select from_state,to_state from framework_process_step where process_code=? and step_code=?",process,step));
        String contractFingerprint=screenContractFingerprint(screenId,process,step,audience,capability);
        String preferredAudience=preferredScreenContractAudience(audience);

        List<Map<String,Object>> checks=new ArrayList<>();
        addScreenCheck(checks,"ROUTE_REGISTERED","화면 경로 등록",true,route);
        String implementation=String.valueOf(item.get("implementation_status"));
        addScreenCheck(checks,"SCREEN_IMPLEMENTED","화면 구현",Set.of("IMPLEMENTED","VERIFIED").contains(implementation),implementation);
        addScreenCheck(checks,"CAPABILITY_SELECTED","선택 기능 계약",selectedCapabilityCount>0,capability);

        Map<String,Object> gate=auditCache==null
            ?jdbc.queryForMap("select design_gate_status,design_gate_score,design_gate_issues,actor_passed,process_passed,contract_passed,lineage_passed,transition_passed,authority_passed,version_passed,exception_passed,admin_counterpart_passed,test_passed from framework_page_design_assurance where screen_resource_id=?",screenId)
            :auditCache.gateByScreen.computeIfAbsent(screenId,key->jdbc.queryForMap("select design_gate_status,design_gate_score,design_gate_issues,actor_passed,process_passed,contract_passed,lineage_passed,transition_passed,authority_passed,version_passed,exception_passed,admin_counterpart_passed,test_passed from framework_page_design_assurance where screen_resource_id=?",screenId));
        addScreenCheck(checks,"ACTOR_CONTRACT","액터 계약",Boolean.TRUE.equals(gate.get("actor_passed")),"");
        addScreenCheck(checks,"PROCESS_CONTRACT","프로세스 계약",Boolean.TRUE.equals(gate.get("process_passed")),"");
        addScreenCheck(checks,"SCREEN_CONTRACT","화면 계약",Boolean.TRUE.equals(gate.get("contract_passed")),"");
        addScreenCheck(checks,"DATA_LINEAGE","필드·DB 계보",Boolean.TRUE.equals(gate.get("lineage_passed")),"");
        addScreenCheck(checks,"STATE_TRANSITION","상태 전이",Boolean.TRUE.equals(gate.get("transition_passed")),"");
        addScreenCheck(checks,"AUTHORITY","권한",Boolean.TRUE.equals(gate.get("authority_passed")),"");
        addScreenCheck(checks,"VERSION_AUDIT","버전·감사",Boolean.TRUE.equals(gate.get("version_passed")),"");
        addScreenCheck(checks,"EXCEPTION_RECOVERY","예외·복구",Boolean.TRUE.equals(gate.get("exception_passed")),"");
        addScreenCheck(checks,"ADMIN_COUNTERPART","사용자·관리자 대응",Boolean.TRUE.equals(gate.get("admin_counterpart_passed")),"");

        Map<String,Object> fieldSummary=auditCache==null
            ?jdbc.queryForMap("select count(*) as total,count(*) filter(where required) as required,count(*) filter(where required and (coalesce(source_table,'')='' or coalesce(source_column,'')='' or lineage_status not in('DB_RESOLVED','IMPLEMENTATION_VERIFIED'))) as unresolved_required,count(*) filter(where coalesce(api_property,'')='') as api_gaps from framework_screen_data_binding where screen_resource_id=?",screenId)
            :auditCache.fieldSummaryByScreen.computeIfAbsent(screenId,key->jdbc.queryForMap("select count(*) as total,count(*) filter(where required) as required,count(*) filter(where required and (coalesce(source_table,'')='' or coalesce(source_column,'')='' or lineage_status not in('DB_RESOLVED','IMPLEMENTATION_VERIFIED'))) as unresolved_required,count(*) filter(where coalesce(api_property,'')='') as api_gaps from framework_screen_data_binding where screen_resource_id=?",screenId));
        int fieldCount=((Number)fieldSummary.get("total")).intValue();
        int unresolvedRequired=((Number)fieldSummary.get("unresolved_required")).intValue();
        int apiGaps=((Number)fieldSummary.get("api_gaps")).intValue();
        addScreenCheck(checks,"FIELD_CONTRACT","필드 계약",fieldCount>0&&unresolvedRequired==0&&apiGaps==0,toJson(fieldSummary));

        final String auditPreInputJson=preInputJson;
        String preInputKey=stepKey+'|'+screenId+'|'+preferredAudience+'|'+auditPreInputJson;
        Map<String,Object> preInputSummary=auditCache==null?jdbc.queryForMap("""
            with required_fields as (
              select distinct field->>'fieldCode' field_code
                from framework_step_execution_spec spec
                cross join lateral jsonb_array_elements(framework_step_contract_fields(spec.field_contract,?)) field
               where spec.process_code=? and spec.step_code=?
                 and nullif(field->>'fieldCode','') is not null
                 and coalesce((field->>'required')::boolean,false)
                 and coalesce((field->>'editable')::boolean,false)
            )
            select (select count(*) from framework_step_execution_spec where process_code=? and step_code=?) spec_count,
                   count(*) required,
                   count(*) filter(where not jsonb_exists(?::jsonb,required.field_code)
                     or trim(coalesce(jsonb_extract_path_text(?::jsonb,required.field_code),''))='') missing_required,
                   count(*) filter(where binding.field_code is null) unmapped_required
              from required_fields required
              left join framework_screen_data_binding binding
                on binding.screen_resource_id=? and binding.field_code=required.field_code
            """,preferredAudience,process,step,process,step,preInputJson,preInputJson,screenId)
            :auditCache.preInputSummary.computeIfAbsent(preInputKey,key->jdbc.queryForMap("""
                with required_fields as (
                  select distinct field->>'fieldCode' field_code
                    from framework_step_execution_spec spec
                    cross join lateral jsonb_array_elements(framework_step_contract_fields(spec.field_contract,?)) field
                   where spec.process_code=? and spec.step_code=?
                     and nullif(field->>'fieldCode','') is not null
                     and coalesce((field->>'required')::boolean,false)
                     and coalesce((field->>'editable')::boolean,false)
                )
                select (select count(*) from framework_step_execution_spec where process_code=? and step_code=?) spec_count,
                       count(*) required,
                       count(*) filter(where not jsonb_exists(?::jsonb,required.field_code)
                         or trim(coalesce(jsonb_extract_path_text(?::jsonb,required.field_code),''))='') missing_required,
                       count(*) filter(where binding.field_code is null) unmapped_required
                  from required_fields required
                  left join framework_screen_data_binding binding
                    on binding.screen_resource_id=? and binding.field_code=required.field_code
                """,preferredAudience,process,step,process,step,auditPreInputJson,auditPreInputJson,screenId));
        int specCount=((Number)preInputSummary.get("spec_count")).intValue();
        int requiredInputs=((Number)preInputSummary.get("required")).intValue();
        int missingInputs=((Number)preInputSummary.get("missing_required")).intValue();
        int unmappedInputs=((Number)preInputSummary.get("unmapped_required")).intValue();
        addScreenCheck(checks,"STEP_EXECUTION_SPEC","단계 실행 명세",specCount==1,toJson(preInputSummary));
        addScreenCheck(checks,"PREINPUT_FIELD_SCOPE","필수 입력 필드 연결",unmappedInputs==0,toJson(preInputSummary));
        addScreenCheck(checks,"PREINPUT_REQUIRED","필수 선입력",missingInputs==0,toJson(preInputSummary));

        Map<String,Object> capabilitySummary=auditCache==null
            ?jdbc.queryForMap("select count(*) as total,count(*) filter(where implementation_status in('IMPLEMENTED','VERIFIED')) as implemented from framework_screen_capability where screen_resource_id=?",screenId)
            :auditCache.capabilitySummaryByScreen.computeIfAbsent(screenId,key->jdbc.queryForMap("select count(*) as total,count(*) filter(where implementation_status in('IMPLEMENTED','VERIFIED')) as implemented from framework_screen_capability where screen_resource_id=?",screenId));
        int capabilityCount=((Number)capabilitySummary.get("total")).intValue();
        int implementedCapabilities=((Number)capabilitySummary.get("implemented")).intValue();
        addScreenCheck(checks,"CAPABILITIES","화면 기능",capabilityCount>0&&capabilityCount==implementedCapabilities,toJson(capabilitySummary));

        Map<String,Object> testSummary=auditCache==null
            ?jdbc.queryForMap("select count(distinct c.case_type) filter(where c.case_type in('HAPPY_PATH','AUTHORITY','ISOLATION','EXCEPTION','RECOVERY')) as bound_types,count(distinct c.case_type) filter(where c.case_type in('HAPPY_PATH','AUTHORITY','ISOLATION','EXCEPTION','RECOVERY') and c.case_status in('APPROVED','VERIFIED')) as approved_types from framework_step_test_binding b join framework_simulation_case c on c.case_code=b.case_code where b.process_code=? and b.step_code=?",process,step)
            :auditCache.testSummaryByStep.computeIfAbsent(stepKey,key->jdbc.queryForMap("select count(distinct c.case_type) filter(where c.case_type in('HAPPY_PATH','AUTHORITY','ISOLATION','EXCEPTION','RECOVERY')) as bound_types,count(distinct c.case_type) filter(where c.case_type in('HAPPY_PATH','AUTHORITY','ISOLATION','EXCEPTION','RECOVERY') and c.case_status in('APPROVED','VERIFIED')) as approved_types from framework_step_test_binding b join framework_simulation_case c on c.case_code=b.case_code where b.process_code=? and b.step_code=?",process,step));
        int boundTypes=((Number)testSummary.get("bound_types")).intValue();
        int approvedTypes=((Number)testSummary.get("approved_types")).intValue();
        addScreenCheck(checks,"FIVE_SAFETY_TESTS","5종 안전 테스트",boundTypes==5&&approvedTypes==5,toJson(testSummary));

        List<String> observedBlockers=checks.stream().filter(row->!Boolean.TRUE.equals(row.get("passed"))).map(row->String.valueOf(row.get("code"))).toList();
        String observedResult=observedBlockers.isEmpty()?"PASSED":"BLOCKED";
        String observedState="PASSED".equals(observedResult)?String.valueOf(transition.get("to_state")):String.valueOf(transition.get("from_state"));
        boolean hasFixture=testCaseId!=null;
        boolean expectedResultMatches=!hasFixture||expectedResult.equals(observedResult);
        boolean expectedStateMatches=!hasFixture||expectedState.isBlank()||expectedState.equals(observedState);
        String fixtureAssertionResult=!hasFixture?"NOT_RUN":expectedResultMatches&&expectedStateMatches?"PASSED":"BLOCKED";
        if(hasFixture){
            addScreenCheck(checks,"EXPECTED_RESULT","기대 결과",expectedResultMatches,expectedResult+" / "+observedResult);
            addScreenCheck(checks,"EXPECTED_STATE","기대 상태",expectedStateMatches,expectedState+" / "+observedState);
        }
        List<String> blockers=new ArrayList<>(observedBlockers);
        if(hasFixture){
            if(!expectedResultMatches)blockers.add("EXPECTED_RESULT");
            if(!expectedStateMatches)blockers.add("EXPECTED_STATE");
        }
        String result="PASSED".equals(observedResult)&&(!hasFixture||"PASSED".equals(fixtureAssertionResult))?"PASSED":"BLOCKED";
        int passed=(int)checks.stream().filter(row->Boolean.TRUE.equals(row.get("passed"))).count();
        Map<String,Object> evidenceMap=new LinkedHashMap<>();evidenceMap.put("evidenceType","CONTRACT_SIMULATION");evidenceMap.put("businessFunctionsExecuted",false);evidenceMap.put("itemId",itemId);evidenceMap.put("screenResourceId",screenId);evidenceMap.put("processCode",process);evidenceMap.put("stepCode",step);evidenceMap.put("audience",audience);evidenceMap.put("capabilityCode",capability);evidenceMap.put("routePath",route);evidenceMap.put("contractFingerprint",contractFingerprint);evidenceMap.put("testCaseId",testCaseId);evidenceMap.put("preInputJson",preInputJson);evidenceMap.put("expectedResult",expectedResult);evidenceMap.put("expectedState",expectedState);evidenceMap.put("observedContractResult",observedResult);evidenceMap.put("observedState",observedState);evidenceMap.put("observedBlockerCodes",observedBlockers);evidenceMap.put("fixtureAssertionResult",fixtureAssertionResult);evidenceMap.put("checks",checks);
        Object rawAuditBatchId=trustedAuditTarget==null?null:trustedAuditTarget.get("_auditBatchId");
        if(rawAuditBatchId!=null){
            evidenceMap.put("auditBatchId",String.valueOf(rawAuditBatchId));
            evidenceMap.put("auditSourceCommit",String.valueOf(trustedAuditTarget.get("_auditSourceCommit")));
            evidenceMap.put("auditRuntimeIdentityHash",String.valueOf(trustedAuditTarget.get("_auditRuntimeIdentityHash")));
            evidenceMap.put("auditPageNumber",trustedAuditTarget.get("_auditPageNumber"));
            evidenceMap.put("auditTargetOrdinal",trustedAuditTarget.get("_auditTargetOrdinal"));
            evidenceMap.put("auditTargetKey",trustedAuditTarget.get("_auditTargetKey"));
            evidenceMap.put("auditBindingId",trustedAuditTarget.get("bindingId"));
        }
        String evidence=toJson(evidenceMap);
        Long runId;
        if(rawAuditBatchId==null){
            runId=jdbc.queryForObject("insert into framework_screen_workflow_test_run(screen_resource_id,process_code,step_code,capability_code,route_key,result,passed_check_count,total_check_count,blocker_codes,evidence_json,executed_by,test_case_id) values(?,?,?,?,?,?,?,?,case when ?='' then ARRAY[]::text[] else string_to_array(?,',') end,?::jsonb,?,?) returning run_id",Long.class,screenId,process,step,capability,route,result,passed,checks.size(),String.join(",",blockers),String.join(",",blockers),evidence,executedBy,testCaseId);
        }else{
            runId=jdbc.queryForObject("insert into framework_screen_workflow_test_run(screen_resource_id,process_code,step_code,capability_code,route_key,result,passed_check_count,total_check_count,blocker_codes,evidence_json,executed_by,test_case_id,audit_batch_id,audit_source_commit,audit_runtime_identity_hash,audit_page_number,audit_target_ordinal,audit_target_key) values(?,?,?,?,?,?,?,?,case when ?='' then ARRAY[]::text[] else string_to_array(?,',') end,?::jsonb,?,?,cast(? as uuid),?,?,?,?,?) returning run_id",Long.class,screenId,process,step,capability,route,result,passed,checks.size(),String.join(",",blockers),String.join(",",blockers),evidence,executedBy,testCaseId,String.valueOf(rawAuditBatchId),String.valueOf(trustedAuditTarget.get("_auditSourceCommit")),String.valueOf(trustedAuditTarget.get("_auditRuntimeIdentityHash")),trustedAuditTarget.get("_auditPageNumber"),trustedAuditTarget.get("_auditTargetOrdinal"),trustedAuditTarget.get("_auditTargetKey"));
        }
        Map<String,Object> response=new LinkedHashMap<>();
        response.put("success",true);response.put("runId",runId);response.put("result",result);
        response.put("passedCheckCount",passed);response.put("totalCheckCount",checks.size());
        response.put("blockerCodes",blockers);response.put("checks",checks);response.put("routePath",route);
        response.put("processCode",process);response.put("stepCode",step);response.put("audience",audience);response.put("capabilityCode",capability);
        response.put("contractFingerprint",contractFingerprint);response.put("expectedResult",expectedResult);response.put("expectedState",expectedState);
        response.put("observedContractResult",observedResult);response.put("observedState",observedState);response.put("fixtureAssertionResult",fixtureAssertionResult);response.put("executedBy",executedBy);
        if(rawAuditBatchId!=null){response.put("auditBatchId",rawAuditBatchId);response.put("auditPageNumber",trustedAuditTarget.get("_auditPageNumber"));response.put("auditTargetOrdinal",trustedAuditTarget.get("_auditTargetOrdinal"));}
        return response;
    }

    private String screenContractFingerprint(long screenId,String process,String step,String audience,String capability){
        List<String> fingerprints=jdbc.queryForList("""
            select md5(concat_ws('|',p.process_version,to_jsonb(s)::text,to_jsonb(binding)::text,to_jsonb(screen)::text,
                     binding.audience,?,
                     coalesce((select md5(string_agg(to_jsonb(data_binding)::text,'|' order by data_binding.data_element_code,data_binding.field_code))
                                 from framework_screen_data_binding data_binding where data_binding.screen_resource_id=?),''),
                     coalesce((select md5(string_agg(to_jsonb(screen_capability)::text,'|' order by screen_capability.capability_code))
                                 from framework_screen_capability screen_capability where screen_capability.screen_resource_id=?),''),
                     coalesce((select md5(string_agg(to_jsonb(test_binding)::text||'~'||to_jsonb(simulation_case)::text,'|' order by test_binding.case_code))
                                 from framework_step_test_binding test_binding join framework_simulation_case simulation_case using(case_code)
                                where test_binding.process_code=? and test_binding.step_code=?),''),
                     coalesce((select md5(to_jsonb(execution_spec)::text) from framework_step_execution_spec execution_spec
                                where execution_spec.process_code=? and execution_spec.step_code=?),''),
                     coalesce((select md5(string_agg(to_jsonb(professional_contract)::text,'|' order by professional_contract.process_code,
                                         professional_contract.step_code,professional_contract.audience,professional_contract.contract_id))
                                 from framework_professional_screen_contract professional_contract
                                where lower(split_part(professional_contract.route_path,'?',1))=screen.route_key),''),
                     coalesce((select md5(string_agg(to_jsonb(fixture)::text,'|' order by fixture.test_case_id))
                                 from framework_screen_workflow_test_case fixture
                                where fixture.screen_resource_id=? and fixture.process_code=? and fixture.step_code=?
                                  and fixture.capability_code=? and fixture.active=true),
                              (select md5(string_agg(to_jsonb(fixture)::text,'|' order by fixture.test_case_id))
                                 from framework_screen_workflow_test_case fixture
                                where fixture.screen_resource_id=? and fixture.process_code=? and fixture.step_code=?
                                  and fixture.capability_code='ALL' and fixture.active=true),'')
                   ))
              from framework_process_definition p
              join framework_process_step s on s.process_code=p.process_code
              join framework_process_step_screen_binding binding on binding.process_code=s.process_code and binding.step_code=s.step_code
              join framework_screen_resource screen using(screen_resource_id)
             where p.process_code=? and s.step_code=? and binding.screen_resource_id=? and binding.audience=?
               and binding.binding_status='ACTIVE'
            """,String.class,capability,screenId,screenId,process,step,process,step,
            screenId,process,step,capability,screenId,process,step,process,step,screenId,audience);
        if(fingerprints.size()!=1)throw new IllegalStateException(fingerprints.isEmpty()?"SCREEN_CONTRACT_FINGERPRINT_NOT_FOUND":"SCREEN_CONTRACT_FINGERPRINT_AMBIGUOUS");
        return fingerprints.get(0);
    }

    private String screenReviewFingerprint(long screenId,String process,String step){
        List<String> audiences=jdbc.queryForList("""
            select distinct audience from framework_process_step_screen_binding
             where process_code=? and step_code=? and screen_resource_id=? and binding_status='ACTIVE'
             order by audience
            """,String.class,process,step,screenId);
        if(audiences.isEmpty())throw new IllegalStateException("SCREEN_CONTRACT_FINGERPRINT_NOT_FOUND");
        List<String> capabilities=jdbc.queryForList("""
            select capability_code from framework_screen_capability
             where screen_resource_id=? order by capability_code
            """,String.class,screenId);
        if(capabilities.isEmpty())capabilities=List.of("ALL");
        List<String> fingerprints=new ArrayList<>();
        for(String audience:audiences)for(String capability:capabilities)
            fingerprints.add(screenContractFingerprint(screenId,process,step,audience,capability));
        return aggregateReviewFingerprints(fingerprints);
    }

    private String capabilityReviewFingerprint(long screenId,String process,String step,String capability){
        List<String> audiences=jdbc.queryForList("""
            select distinct audience from framework_process_step_screen_binding
             where process_code=? and step_code=? and screen_resource_id=? and binding_status='ACTIVE'
             order by audience
            """,String.class,process,step,screenId);
        if(audiences.isEmpty())throw new IllegalStateException("SCREEN_CONTRACT_FINGERPRINT_NOT_FOUND");
        List<String> fingerprints=new ArrayList<>();
        for(String audience:audiences)
            fingerprints.add(screenContractFingerprint(screenId,process,step,audience,capability));
        return aggregateReviewFingerprints(fingerprints);
    }

    static String aggregateReviewFingerprints(List<String> orderedFingerprints){
        if(orderedFingerprints==null||orderedFingerprints.isEmpty())
            throw new IllegalArgumentException("At least one review fingerprint is required");
        return md5Hex(String.join("|",orderedFingerprints));
    }

    static String preferredScreenContractAudience(String audience){
        String normalized=audience==null?"":audience.trim().toUpperCase(Locale.ROOT);
        return Set.of("USER","ADMIN","PUBLIC").contains(normalized)?normalized:"USER";
    }

    public Map<String,Object> screenWorkflowTestCases(long screenResourceId,String processCode,String stepCode,String capabilityCode){
        String process=req(Map.of("processCode",processCode),"processCode").trim().toUpperCase(Locale.ROOT);
        String step=req(Map.of("stepCode",stepCode),"stepCode").trim().toUpperCase(Locale.ROOT);
        String capability=capabilityCode==null||capabilityCode.isBlank()?"ALL":capabilityCode.trim().toUpperCase(Locale.ROOT);
        List<Map<String,Object>> rows=jdbc.queryForList("select test_case_id as \"testCaseId\",capability_code as \"capabilityCode\",case_type as \"caseType\",case_order as \"caseOrder\",case_name as \"caseName\",case_description as \"caseDescription\",pre_input_json::text as \"preInputJson\",expected_output_json::text as \"expectedOutputJson\",action_sequence_json::text as \"actionSequenceJson\",expected_result as \"expectedResult\",coalesce(expected_state,'') as \"expectedState\",updated_by as \"updatedBy\",updated_at as \"updatedAt\" from framework_screen_workflow_test_case where screen_resource_id=? and process_code=? and step_code=? and capability_code in (?, 'ALL') and active=true order by case when capability_code=? then 0 else 1 end,case_order,test_case_id",screenResourceId,process,step,capability,capability);
        return Map.of("success",true,"count",rows.size(),"items",rows);
    }

    public Map<String,Object> qaProcessCaseCatalog(String processCode,String stepCode){
        String process=req(Map.of("processCode",processCode),"processCode").trim().toUpperCase(Locale.ROOT);
        String step=stepCode==null?"":stepCode.trim().toUpperCase(Locale.ROOT);
        List<Map<String,Object>> rows=jdbc.queryForList("""
            select process_code as \"processCode\",step_code as \"stepCode\",step_order as \"stepOrder\",step_name as \"stepName\",
                   case_code as \"caseCode\",case_name as \"caseName\",case_type as \"caseType\",preconditions,
                   steps_json::text as \"actionSequenceJson\",assertions_json::text as \"assertionsJson\",case_status as \"caseStatus\",automated,
                   screen_resource_id as \"screenResourceId\",coalesce(route_key,'') as \"routePath\",coalesce(screen_name,'') as \"screenName\",
                   item_id as \"itemId\",test_case_id as \"testCaseId\",coalesce(capability_code,'ALL') as \"capabilityCode\",
                   coalesce(pre_input_json,'{}'::jsonb)::text as \"preInputJson\",coalesce(expected_result,case when case_type='HAPPY_PATH' then 'PASSED' else 'BLOCKED' end) as \"expectedResult\",
                   coalesce(expected_state,'') as \"expectedState\",coalesce(expected_output_json,'{}'::jsonb)::text as \"expectedOutputJson\",
                   coalesce(action_sequence_json,'[]'::jsonb)::text as \"actionSequenceJson\",coalesce(case_description,'') as \"caseDescription\",case_origin as \"caseOrigin\",reuse_count as \"reuseCount\"
              from framework_qa_process_case_catalog
             where process_code=? and (?='' or step_code=?)
             order by step_order,case case_type when 'HAPPY_PATH' then 1 when 'AUTHORITY' then 2 when 'ISOLATION' then 3 when 'EXCEPTION' then 4 else 5 end,case_code
            """,process,step,step);
        long configured=rows.stream().filter(row->row.get("testCaseId")!=null).count();
        return Map.of("success",true,"processCode",process,"count",rows.size(),"configuredCount",configured,"items",rows);
    }

    public Map<String,Object> qaProcessTestSession(String processCode,String projectId){
        String process=req(Map.of("processCode",processCode),"processCode").trim().toUpperCase(Locale.ROOT),project=projectId==null?"":projectId.trim();
        List<Map<String,Object>> rows=jdbc.queryForList("select session_id as \"sessionId\",project_id as \"projectId\",process_code as \"processCode\",session_status as \"sessionStatus\",coalesce(current_step_code,'') as \"currentStepCode\",coalesce(current_case_code,'') as \"currentCaseCode\",current_case_index as \"currentCaseIndex\",total_case_count as \"totalCaseCount\",completed_case_count as \"completedCaseCount\",working_input_json::text as \"workingInputJson\",result_history_json::text as \"resultHistoryJson\",updated_at as \"updatedAt\" from framework_qa_process_test_session where process_code=? and project_id=? order by updated_at desc limit 1",process,project);
        return rows.isEmpty()?Map.of("success",true,"exists",false):Map.of("success",true,"exists",true,"session",rows.get(0));
    }

    @Transactional
    public Map<String,Object> saveQaProcessTestSession(Map<String,Object> body,String actor){
        String process=req(body,"processCode").trim().toUpperCase(Locale.ROOT),project=str(body,"projectId").trim();
        String status=def(body,"sessionStatus","PAUSED").trim().toUpperCase(Locale.ROOT);
        if(!Set.of("READY","RUNNING","PAUSED","COMPLETED","FAILED","RESET").contains(status))throw new IllegalArgumentException("INVALID_QA_SESSION_STATUS");
        String input=def(body,"workingInputJson","{}"),history=def(body,"resultHistoryJson","[]");validateJsonObject(input,"workingInputJson");validateJsonArray(history,"resultHistoryJson");
        UUID sessionId=str(body,"sessionId").isBlank()?UUID.randomUUID():UUID.fromString(str(body,"sessionId"));
        String fingerprint=jdbc.queryForObject("select md5(coalesce(string_agg(concat_ws('|',step_code,case_code,case_status,automated::text),'|' order by step_order,case_code),'')) from framework_qa_process_case_catalog where process_code=?",String.class,process);
        jdbc.update("insert into framework_qa_process_test_session(session_id,project_id,process_code,session_status,current_step_code,current_case_code,current_case_index,total_case_count,completed_case_count,working_input_json,result_history_json,source_fingerprint,created_by,updated_by) values(?,?,?,?,nullif(?,''),nullif(?,''),?,?,?,?::jsonb,?::jsonb,?,?,?) on conflict(session_id) do update set session_status=excluded.session_status,current_step_code=excluded.current_step_code,current_case_code=excluded.current_case_code,current_case_index=excluded.current_case_index,total_case_count=excluded.total_case_count,completed_case_count=excluded.completed_case_count,working_input_json=excluded.working_input_json,result_history_json=excluded.result_history_json,source_fingerprint=excluded.source_fingerprint,updated_by=excluded.updated_by,updated_at=current_timestamp",sessionId,project,process,status,str(body,"currentStepCode"),str(body,"currentCaseCode"),integerOr(body,"currentCaseIndex",0),integerOr(body,"totalCaseCount",0),integerOr(body,"completedCaseCount",0),input,history,fingerprint,actor,actor);
        return Map.of("success",true,"sessionId",sessionId,"sessionStatus",status,"processCode",process,"projectId",project);
    }

    @Transactional
    public Map<String,Object> saveScreenWorkflowTestCase(Map<String,Object> body,String actor){
        long screenId=Long.parseLong(req(body,"screenResourceId"));
        String process=req(body,"processCode").trim().toUpperCase(Locale.ROOT),step=req(body,"stepCode").trim().toUpperCase(Locale.ROOT);
        String capability=def(body,"capabilityCode","ALL").trim().toUpperCase(Locale.ROOT);
        String name=req(body,"caseName").trim(),preInput=def(body,"preInputJson","{}"),expected=def(body,"expectedResult","PASSED").trim().toUpperCase(Locale.ROOT),expectedState=str(body,"expectedState");
        String caseType=def(body,"caseType","HAPPY_PATH").trim().toUpperCase(Locale.ROOT),description=str(body,"caseDescription");
        String expectedOutput=def(body,"expectedOutputJson","{}"),actionSequence=def(body,"actionSequenceJson","[]");
        validateJsonObject(preInput,"preInputJson");
        validateJsonObject(expectedOutput,"expectedOutputJson");validateJsonArray(actionSequence,"actionSequenceJson");
        if(!Set.of("PASSED","BLOCKED").contains(expected))throw new IllegalArgumentException("expectedResult must be PASSED or BLOCKED");
        if(!Set.of("HAPPY_PATH","AUTHORITY","ISOLATION","EXCEPTION","RECOVERY").contains(caseType))throw new IllegalArgumentException("INVALID_QA_CASE_TYPE");
        Integer bindingCount=jdbc.queryForObject("select count(*) from framework_process_step_screen_binding where screen_resource_id=? and process_code=? and step_code=? and binding_status='ACTIVE'",Integer.class,screenId,process,step);
        if(bindingCount==null||bindingCount==0)throw new IllegalArgumentException("SCREEN_PROCESS_BINDING_NOT_FOUND");
        Integer capabilityCount="ALL".equals(capability)?1:jdbc.queryForObject("select count(*) from framework_screen_capability where screen_resource_id=? and capability_code=?",Integer.class,screenId,capability);
        if(capabilityCount==null||capabilityCount==0)throw new IllegalArgumentException("SCREEN_CAPABILITY_NOT_FOUND");
        Long id=jdbc.queryForObject("insert into framework_screen_workflow_test_case(screen_resource_id,process_code,step_code,capability_code,case_type,case_order,case_name,case_description,pre_input_json,expected_output_json,action_sequence_json,expected_result,expected_state,created_by,updated_by) values(?,?,?,?,?,?,?,?,?::jsonb,?::jsonb,?::jsonb,?,nullif(?,''),?,?) on conflict(screen_resource_id,process_code,step_code,capability_code,case_name) do update set case_type=excluded.case_type,case_order=excluded.case_order,case_description=excluded.case_description,pre_input_json=excluded.pre_input_json,expected_output_json=excluded.expected_output_json,action_sequence_json=excluded.action_sequence_json,expected_result=excluded.expected_result,expected_state=excluded.expected_state,active=true,updated_by=excluded.updated_by,updated_at=current_timestamp returning test_case_id",Long.class,screenId,process,step,capability,caseType,integerOr(body,"caseOrder",1),name,description,preInput,expectedOutput,actionSequence,expected,expectedState,actor,actor);
        return Map.of("success",true,"testCaseId",id,"caseName",name,"processCode",process,"stepCode",step,"capabilityCode",capability,"screenResourceId",screenId);
    }

    private void addScreenCheck(List<Map<String,Object>> checks,String code,String name,boolean passed,String evidence){
        Map<String,Object> row=new LinkedHashMap<>();
        row.put("code",code);row.put("name",name);row.put("passed",passed);row.put("evidence",evidence==null?"":evidence);
        checks.add(row);
    }

    private String sqlArrayText(Object value){
        if(value instanceof java.sql.Array array){try{return String.join(", ",(String[])array.getArray());}catch(Exception ignored){return "";}}
        return value==null?"":String.valueOf(value);
    }

    @Transactional public Map<String,Object> validateProcessDesign(String process,String actor){
        Map<String,Object> summary=jdbc.queryForMap("select * from framework_validate_process_design(?,?)",process,actor);
        Map<String,Object> result=new LinkedHashMap<>(summary);
        result.put("success",true);
        result.put("processCode",process);
        result.put("issues",jdbc.queryForObject("select result_json::text from framework_process_design_validation_run where validation_run_id=?",String.class,summary.get("validation_run_id")));
        return result;
    }

    @Transactional public Map<String,Object> installCommonFeature(String featureCode,String projectScope,String actor,Map<String,Object> configuration){
        Map<String,Object> installed=jdbc.queryForMap("select * from framework_install_common_feature(?,?,?,?::jsonb)",featureCode,projectScope,actor,toJson(configuration));
        Map<String,Object> result=new LinkedHashMap<>(installed);result.put("success",true);result.put("projectScope",projectScope);return result;
    }

    /**
     * Converts one canonical process design into scenarios, governed screens and
     * approved development jobs in one transaction. A stable design fingerprint
     * makes repeated calls constant-time and reopens generated work only when the
     * executable design actually changed.
     */
    @Transactional public Map<String,Object> executeDesignDirectDevelopment(Map<String,Object>b,String actor){
        String process=req(b,"processCode");
        if(!str(b,"stepCode").isBlank())return enqueueCanonicalFullStackGeneration(b,actor);
        boolean force=bool(b,"force");
        String processHash=jdbc.queryForObject("select md5(concat_ws('|',p.process_code,p.process_version,p.domain_code,p.goal,p.start_condition,p.completion_condition,p.automation_mode,coalesce(string_agg(concat_ws('~',s.step_order,s.step_code,s.step_name,s.actor_code,s.from_state,s.command_code,s.to_state,s.completion_rule,s.requirement_text,s.input_contract,s.output_contract,s.requires_user_page,s.requires_admin_page,s.requires_api,s.requires_database,s.requires_notification,s.user_path,s.admin_path,s.api_contract),'|' order by s.step_order,s.step_code),''))) from framework_process_definition p left join framework_process_step s on s.process_code=p.process_code where p.process_code=? group by p.process_code,p.process_version,p.domain_code,p.goal,p.start_condition,p.completion_condition,p.automation_mode",String.class,process);
        if(processHash==null)throw new IllegalArgumentException("프로세스를 찾을 수 없습니다: "+process);
        String screenHash=jdbc.queryForObject("select md5(coalesce(string_agg(concat_ws('~',c.step_code,c.audience,c.route_path,c.business_purpose,c.entry_condition,c.exit_condition,c.kpi_contract,c.section_contract,c.field_contract,c.command_contract,c.state_contract,c.api_contract,c.data_contract,c.evidence_contract,c.responsive_contract,c.accessibility_contract,c.security_contract,n.note_version,m.mockup_version,md5(coalesce(m.html_content,''))),'|' order by c.step_code,c.audience,c.route_path),'')) from framework_professional_screen_contract c left join framework_screen_development_note n on n.route_key=lower(split_part(c.route_path,'?',1)) left join framework_screen_html_mockup m on m.route_key=lower(split_part(c.route_path,'?',1)) and m.selected=true where c.process_code=?",String.class,process);
        String designHash=jdbc.queryForObject("select md5(?||'|'||?)",String.class,processHash,screenHash==null?"":screenHash);
        List<Map<String,Object>> previous=jdbc.queryForList("select design_hash,delivery_status,step_count,development_job_count,generation_batch_id,executed_at from framework_design_delivery_revision where process_code=?",process);
        if(!force&&!previous.isEmpty()&&designHash.equals(String.valueOf(previous.get(0).get("design_hash")))&&"READY_TO_EXECUTE".equals(String.valueOf(previous.get(0).get("delivery_status")))){
            Map<String,Object> out=new LinkedHashMap<>();out.put("success",true);out.put("processCode",process);out.put("designHash",designHash);out.put("changed",false);out.put("status","UNCHANGED");out.put("revision",previous.get(0));out.put("nextAction","기존 승인 개발 작업을 즉시 실행합니다.");return out;
        }
        jdbc.update("update framework_development_job set job_status='PLANNED',approval_status='PENDING',quality_status='PENDING',worker_id=null,lease_token=null,lease_until=null,last_error=null,completed_at=null,updated_at=current_timestamp where process_code=? and job_status<>'RUNNING'",process);
        jdbc.update("update framework_process_artifact set delivery_status='PLANNED',evidence_ref=null,updated_at=current_timestamp where process_code=? and contract_ref like 'AUTO:%'",process);
        Map<String,Object> result=bootstrapProcessDevelopment(Map.of("processCode",process,"approveJobs",true,"queueScreens",true),actor);
        String status=String.valueOf(result.get("factoryStatus"));
        int steps=((Number)result.getOrDefault("stepCount",0)).intValue(),jobs=((Number)result.getOrDefault("totalJobs",0)).intValue();
        Number batch=(Number)result.get("batchId");
        String resultJson="{\"factoryStatus\":\""+status+"\",\"stepCount\":"+steps+",\"developmentJobCount\":"+jobs+",\"blockedStepCount\":"+result.getOrDefault("blockedStepCount",0)+"}";
        jdbc.update("insert into framework_design_delivery_revision(process_code,design_hash,delivery_status,step_count,development_job_count,generation_batch_id,result_json,executed_by) values(?,?,?,?,?,?,?,?) on conflict(process_code) do update set design_hash=excluded.design_hash,delivery_status=excluded.delivery_status,step_count=excluded.step_count,development_job_count=excluded.development_job_count,generation_batch_id=excluded.generation_batch_id,result_json=excluded.result_json,executed_by=excluded.executed_by,executed_at=current_timestamp",process,designHash,status,steps,jobs,batch==null?null:batch.longValue(),resultJson,actor);
        Map<String,Object> out=new LinkedHashMap<>();out.put("success",true);out.put("processCode",process);out.put("designHash",designHash);out.put("changed",true);out.put("status",status);out.put("bootstrap",result);out.put("nextAction","READY_TO_EXECUTE".equals(status)?"승인 개발 작업을 즉시 실행합니다.":"차단된 화면 설계 게이트를 보완한 뒤 동일 API를 다시 실행합니다.");return out;
    }

    /**
     * Reprojects the authoritative structured screen contract into the existing
     * step execution specification and queues the existing deterministic full
     * stack worker.  The queue identity contains both immutable design heads;
     * account assignments and permission grants remain runtime-only, while
     * permission requirements are copied into the generated authority contract.
     */
    private Map<String,Object> enqueueCanonicalFullStackGeneration(Map<String,Object> body,String actor){
        String process=req(body,"processCode");
        String step=req(body,"stepCode");
        String route=ScreenDevelopmentNoteService.cleanRoute(req(body,"routePath"));
        String audience=req(body,"audience").toUpperCase(Locale.ROOT);
        String designHash=req(body,"designHash").toLowerCase(Locale.ROOT);
        if(!Set.of("USER","ADMIN").contains(audience))
            throw new IllegalArgumentException("audience must be USER or ADMIN");
        if(!designHash.matches("[0-9a-f]{64}"))
            throw new IllegalArgumentException("designHash must be a SHA-256 value");

        Map<String,Object> trigger=new LinkedHashMap<>();
        trigger.put("triggerType","PROFESSIONAL_SCREEN_CONTRACT");
        trigger.put("stepCode",step);trigger.put("routePath",route);
        trigger.put("audience",audience);trigger.put("designHash",designHash);
        return refreshAndQueueCanonicalProcess(process,actor,trigger,()->{
          List<Map<String,Object>> refreshed=jdbc.queryForList("""
            with blueprint_candidates as materialized (
              select c.contract_id,c.process_code,c.step_code,upper(c.audience) audience,
                     lower(split_part(c.route_path,'?',1)) route_path,c.screen_name,
                     c.actor_code contract_actor,b.actor_code blueprint_actor,
                     c.business_purpose,c.entry_condition,c.exit_condition,
                     framework_strict_jsonb_array(c.section_contract) sections,
                     framework_strict_jsonb_array(c.field_contract) fields,
                     framework_strict_jsonb_array(c.command_contract) commands,
                     framework_strict_jsonb_array(c.state_contract) states,
                     framework_strict_jsonb_array(c.api_contract) apis,
                     framework_strict_jsonb_array(c.data_contract) data_contract,
                     framework_strict_jsonb_array(c.evidence_contract) evidence,
                     c.responsive_contract,c.accessibility_contract,c.security_contract,
                     b.page_id,b.page_name,b.screen_type,b.template_code,
                     framework_try_jsonb(b.specification_json) blueprint_spec,
                     (b.transition_status='CONTRACT_LINKED' and lower(b.source_reference) in(
                       'framework_professional_screen_contract:'||c.contract_id,
                       'professional_screen_contract:'||c.contract_id)) explicit_link,
                     count(*) over(partition by c.contract_id) candidate_count,
                     count(*) filter(where b.transition_status='CONTRACT_LINKED'
                       and lower(b.source_reference) in(
                         'framework_professional_screen_contract:'||c.contract_id,
                         'professional_screen_contract:'||c.contract_id))
                       over(partition by c.contract_id) explicit_count
                from framework_professional_screen_contract c
                join framework_screen_blueprint b
                  on b.process_code=c.process_code and b.step_code=c.step_code
                 and upper(b.audience)=upper(c.audience)
                 and lower(split_part(b.route_path,'?',1))=lower(split_part(c.route_path,'?',1))
                 and b.validation_status='VALID'
               where c.process_code=? and c.step_code=?
            ), contract_source as materialized (
              select candidate.*,
                     case
                       when nullif(btrim(blueprint_spec->>'layout'),'') is not null then
                         case when (select count(distinct resource.layout_type)
                             from framework_screen_resource resource
                             where resource.layout_type=blueprint_spec->>'layout')=1
                           then blueprint_spec->>'layout' end
                       else (select min(resource.layout_type)
                               from framework_screen_resource resource
                              where resource.route_key=route_path
                             having count(*)=1)
                     end layout_code,
                     case
                       when nullif(btrim(blueprint_spec->>'theme'),'') is not null then
                         case when (select count(*) from comtnthemedefinition theme
                             where theme.theme_id=blueprint_spec->>'theme'
                               and theme.use_at='Y' and theme.is_active='Y')=1
                           then blueprint_spec->>'theme' end
                       when (select count(*) from comtnthemedefinition theme
                         where theme.theme_id='KRDS_GOV_DEFAULT'
                           and theme.use_at='Y' and theme.is_active='Y')=1
                         then 'KRDS_GOV_DEFAULT'
                     end theme_code
                from blueprint_candidates candidate
               where jsonb_typeof(blueprint_spec)='object'
                 and ((explicit_count=1 and explicit_link)
                   or (explicit_count=0 and candidate_count=1))
            ), step_authority as materialized (
              select actor_code,command_code,from_state,to_state,requires_api,api_contract,
                     requires_user_page,requires_admin_page,
                     lower(split_part(coalesce(user_path,''),'?',1)) user_route,
                     lower(split_part(coalesce(admin_path,''),'?',1)) admin_route
                from framework_process_step
               where process_code=? and step_code=?
            ), exact_identity as (
              select (select count(*) from framework_professional_screen_contract c
                       where c.process_code=? and c.step_code=?) contract_count,
                     authority.requires_user_page,authority.requires_admin_page,
                     (select count(*) from contract_source) valid_identity_count,
                     (select count(*) from contract_source source
                       where source.contract_actor=authority.actor_code
                         and source.blueprint_actor=authority.actor_code
                         and ((source.audience='USER' and source.route_path=authority.user_route)
                           or (source.audience='ADMIN' and source.route_path=authority.admin_route))) coherent_count,
                     (select count(*) from contract_source source
                       where source.audience='USER' and source.route_path=authority.user_route
                         and source.contract_actor=authority.actor_code
                         and source.blueprint_actor=authority.actor_code) user_audience_count,
                     (select count(*) from contract_source source
                       where source.audience='ADMIN' and source.route_path=authority.admin_route
                         and source.contract_actor=authority.actor_code
                         and source.blueprint_actor=authority.actor_code) admin_audience_count,
                     (select count(*) from contract_source where jsonb_array_length(sections)>0
                       and jsonb_array_length(fields)>0 and jsonb_array_length(commands)>0
                       and jsonb_array_length(states)>0 and jsonb_array_length(apis)>0
                       and jsonb_array_length(data_contract)>0
                       and not exists(select 1 from jsonb_array_elements(sections) item
                         where jsonb_typeof(item)<>'object')
                       and not exists(select 1 from jsonb_array_elements(fields) item
                         where jsonb_typeof(item)<>'object')
                       and not exists(select 1 from jsonb_array_elements(commands) item
                         where jsonb_typeof(item)<>'object')
                       and not exists(select 1 from jsonb_array_elements(states) item
                         where jsonb_typeof(item)<>'object')
                       and not exists(select 1 from jsonb_array_elements(apis) item
                         where jsonb_typeof(item)<>'object')
                       and not exists(select 1 from jsonb_array_elements(data_contract) item
                         where jsonb_typeof(item)<>'object')
                       and layout_code~'^[A-Z][A-Z0-9_]{1,79}$'
                       and theme_code~'^[A-Z][A-Z0-9_]{1,79}$'
                       and template_code~'^[A-Z][A-Z0-9_:-]{1,119}$') complete_count
                from step_authority authority
            ), screens as (
              select jsonb_agg(jsonb_build_object(
                       'pageCode',coalesce(nullif(page_id,''),process_code||'_'||step_code||'_'||audience),
                       'plannedRoute',route_path,'actualRoute',route_path,'routeStatus','IMPLEMENTED',
                       'audience',audience,'screenType',coalesce(nullif(screen_type,''),'WORKSPACE'),
                       'templateCode',template_code,'layout',layout_code,'theme',theme_code,
                       'title',coalesce(nullif(page_name,''),screen_name),'purpose',business_purpose,
                       'entryCondition',entry_condition,'exitCondition',exit_condition,
                       'sections',sections,'fields',fields,
                       'commands',framework_merge_primary_contract_marker(
                         commands,'PRIMARY_STEP_COMMAND',jsonb_build_object(
                           'commandCode',authority.command_code,'actorCode',authority.actor_code,
                           'entryState',authority.from_state,'resultState',authority.to_state,
                           'serverAuthorization',true,'validationRequired',true,'auditRequired',true)),
                       'states',states,
                       'apis',framework_merge_primary_contract_marker(
                         apis,'PRIMARY_STEP_API',case when authority.requires_api
                           then jsonb_build_object('declaredContract',coalesce(
                             framework_try_jsonb(authority.api_contract),to_jsonb(authority.api_contract)),
                             'actorCode',authority.actor_code,'commandCode',authority.command_code,
                             'transactional',true,'tenantGuard',true,'projectGuard',true,
                             'actorGuard',true,'idempotencyKey',true,'rowVersion',true) end),
                       'data',data_contract,'evidence',evidence,
                       'responsiveContract',responsive_contract,
                       'accessibilityContract',accessibility_contract,
                       'securityContract',security_contract,'exceptions',states)
                     order by audience,route_path,contract_id) value
                from contract_source cross join step_authority authority
            ), fields as (
              select coalesce(jsonb_agg(field.value||jsonb_build_object(
                       'audience',source.audience,'route',source.route_path)
                     order by source.audience,source.route_path,source.contract_id,field.ordinality),'[]'::jsonb) value,
                     count(*) filter(where jsonb_typeof(field.value)<>'object') invalid_count
                from contract_source source
                cross join lateral jsonb_array_elements(source.fields)
                  with ordinality field(value,ordinality)
            ), commands as (
              select framework_merge_primary_contract_marker(
                       coalesce(jsonb_agg(command.value||jsonb_build_object(
                       'audience',source.audience,'routePath',source.route_path)
                     order by source.audience,source.route_path,source.contract_id,command.ordinality),'[]'::jsonb),
                       'PRIMARY_STEP_COMMAND',jsonb_build_object(
                         'commandCode',authority.command_code,'actorCode',authority.actor_code,
                         'entryState',authority.from_state,'resultState',authority.to_state,
                         'serverAuthorization',true,'validationRequired',true,
                         'auditRequired',true)) value,
                     count(*) filter(where jsonb_typeof(command.value)<>'object') invalid_count
                from contract_source source
                cross join step_authority authority
                cross join lateral jsonb_array_elements(source.commands)
                  with ordinality command(value,ordinality)
               group by authority.command_code,authority.actor_code,
                 authority.from_state,authority.to_state
            ), apis as (
              select framework_merge_primary_contract_marker(
                       coalesce(jsonb_agg(api.value||jsonb_build_object(
                       'audience',source.audience,'routePath',source.route_path)
                     order by source.audience,source.route_path,source.contract_id,api.ordinality),'[]'::jsonb),
                       'PRIMARY_STEP_API',case when authority.requires_api then jsonb_build_object(
                         'declaredContract',coalesce(framework_try_jsonb(authority.api_contract),
                           to_jsonb(authority.api_contract)),'actorCode',authority.actor_code,
                         'commandCode',authority.command_code,'transactional',true,
                         'tenantGuard',true,'projectGuard',true,'actorGuard',true,
                         'idempotencyKey',true,'rowVersion',true) end) value,
                     count(*) filter(where jsonb_typeof(api.value)<>'object') invalid_count
                from contract_source source
                cross join step_authority authority
                cross join lateral jsonb_array_elements(source.apis)
                  with ordinality api(value,ordinality)
               group by authority.requires_api,authority.api_contract,
                 authority.actor_code,authority.command_code
            ), permissions as (
              select framework_step_permission_requirements(?,?) value
            ), refreshed as (
               update framework_step_execution_spec spec
                  set spec_version=spec.spec_version+1,
                      screen_contract=screens.value,
                     field_contract=jsonb_build_object('schemaVersion',1,
                       'contractType','STEP_FIELDS','fields',fields.value),
                     command_contract=commands.value,api_contract=apis.value,
                      actor_contract=jsonb_set(spec.actor_contract,'{permissions}',permissions.value,true),
                      design_status=case when
                        (not coalesce(identity.requires_user_page,false)
                          or identity.user_audience_count>0)
                        and (not coalesce(identity.requires_admin_page,false)
                          or identity.admin_audience_count>0)
                        then 'DESIGN_COMPLETE' else 'DESIGN_BLOCKED' end,
                      approval_status=case when
                        (not coalesce(identity.requires_user_page,false)
                          or identity.user_audience_count>0)
                        and (not coalesce(identity.requires_admin_page,false)
                          or identity.admin_audience_count>0)
                        then 'APPROVED' else 'REVIEW_REQUIRED' end,
                      generation_status=case when
                        (not coalesce(identity.requires_user_page,false)
                          or identity.user_audience_count>0)
                        and (not coalesce(identity.requires_admin_page,false)
                          or identity.admin_audience_count>0)
                        then 'READY' else 'BLOCKED' end,
                      blocker_codes=case when
                        (not coalesce(identity.requires_user_page,false)
                          or identity.user_audience_count>0)
                        and (not coalesce(identity.requires_admin_page,false)
                          or identity.admin_audience_count>0)
                        then '[]'::jsonb else '["PAGE_DESIGN_MISSING"]'::jsonb end,
                      approved_by=case when
                        (not coalesce(identity.requires_user_page,false)
                          or identity.user_audience_count>0)
                        and (not coalesce(identity.requires_admin_page,false)
                          or identity.admin_audience_count>0)
                        then ? end,
                      approved_at=case when
                        (not coalesce(identity.requires_user_page,false)
                          or identity.user_audience_count>0)
                        and (not coalesce(identity.requires_admin_page,false)
                          or identity.admin_audience_count>0)
                        then current_timestamp end,updated_at=current_timestamp
                from screens,fields,commands,apis,permissions,exact_identity identity
               where spec.process_code=? and spec.step_code=?
                 and identity.contract_count>0
                 and identity.valid_identity_count=identity.contract_count
                 and identity.coherent_count=identity.contract_count
                 and identity.complete_count=identity.contract_count
                 and fields.invalid_count=0 and commands.invalid_count=0 and apis.invalid_count=0
                 and (spec.screen_contract is distinct from screens.value
                   or spec.field_contract is distinct from jsonb_build_object(
                     'schemaVersion',1,'contractType','STEP_FIELDS','fields',fields.value)
                   or spec.command_contract is distinct from commands.value
                   or spec.api_contract is distinct from apis.value
                    or spec.actor_contract->'permissions' is distinct from permissions.value
                    or spec.design_status is distinct from case when
                      (not coalesce(identity.requires_user_page,false)
                        or identity.user_audience_count>0)
                      and (not coalesce(identity.requires_admin_page,false)
                        or identity.admin_audience_count>0)
                      then 'DESIGN_COMPLETE' else 'DESIGN_BLOCKED' end
                    or spec.approval_status is distinct from case when
                      (not coalesce(identity.requires_user_page,false)
                        or identity.user_audience_count>0)
                      and (not coalesce(identity.requires_admin_page,false)
                        or identity.admin_audience_count>0)
                      then 'APPROVED' else 'REVIEW_REQUIRED' end)
              returning jsonb_array_length(spec.api_contract) endpoint_expected
            )
            select endpoint_expected as "endpointExpected" from refreshed
            union all
            select jsonb_array_length(spec.api_contract) as "endpointExpected"
              from framework_step_execution_spec spec,exact_identity identity,fields,commands,apis
             where spec.process_code=? and spec.step_code=?
               and identity.contract_count>0
               and identity.valid_identity_count=identity.contract_count
               and identity.coherent_count=identity.contract_count
               and identity.complete_count=identity.contract_count
               and fields.invalid_count=0 and commands.invalid_count=0 and apis.invalid_count=0
               and not exists(select 1 from refreshed)
            """,process,step,process,step,process,step,process,step,
            actor,process,step,process,step);
          if(refreshed.size()!=1)throw new IllegalStateException(
              "STRUCTURED_GENERATION_SPEC_NOT_EXACT: "+process+" / "+step);
          return new LinkedHashMap<>(refreshed.get(0));
        });
    }

    private void lockCanonicalProcessPublication(String process){
        jdbc.query("select pg_advisory_xact_lock(hashtextextended("+
            "'CANONICAL_PROCESS_PUBLICATION_V1:'||upper(btrim(?)),0))",rs->{},process);
    }

    private Map<String,Object> refreshProcessExecutionSpecs(String process,String actor){
        String refreshed=jdbc.queryForObject(
            "select framework_refresh_process_execution_specs(?,?)::text",
            String.class,process,actor);
        if(refreshed==null)throw new IllegalStateException("PROCESS_SPEC_REFRESH_RESULT_REQUIRED");
        return jsonMap(refreshed);
    }

    private Map<String,Object> beginProcessDesignRevision(String process,String actor){
        String revision=jdbc.queryForObject(
            "select framework_begin_process_design_revision(?,?)::text",
            String.class,process,actor);
        if(revision==null)throw new IllegalStateException("PROCESS_DESIGN_REVISION_REQUIRED");
        return jsonMap(revision);
    }

    private Map<String,Object> finalizeProcessDesignRevision(String process,String actor){
        String revision=jdbc.queryForObject(
            "select framework_finalize_process_design_revision(?,?)::text",
            String.class,process,actor);
        if(revision==null)throw new IllegalStateException("PROCESS_DESIGN_FINALIZATION_REQUIRED");
        return jsonMap(revision);
    }

    private void closeProcessDesignRevision(String process,String actor){
        jdbc.queryForObject("select framework_close_process_design_revision(?,?)",
            Boolean.class,process,actor);
    }

    private Map<String,Object> refreshAndQueueCanonicalProcess(
            String process,String actor,Map<String,Object> trigger,
            java.util.function.Supplier<Map<String,Object>> exactProjection){
        lockCanonicalProcessPublication(process);
        Boolean initiallyLocked=jdbc.queryForObject(
            "select definition_locked from framework_process_definition where process_code=?",
            Boolean.class,process);
        if(!Boolean.TRUE.equals(initiallyLocked))beginProcessDesignRevision(process,actor);
        String expectedDesignHash=str(trigger,"designHash");
        if(!expectedDesignHash.isBlank()){
            String currentDesignHash=jdbc.queryForObject(
                "select framework_canonical_screen_bundle(?,?,?,?)->>'designHash'",String.class,
                process,req(trigger,"stepCode"),req(trigger,"audience"),req(trigger,"routePath"));
            if(!expectedDesignHash.equals(currentDesignHash))
                throw new IllegalStateException("STALE_CANONICAL_DESIGN_HASH");
        }
        Map<String,Object> refresh=refreshProcessExecutionSpecs(process,actor);
        Map<String,Object> projection=exactProjection==null?Map.of():exactProjection.get();
        Map<String,Object> revision=Map.of();
        Map<String,Object> finalizationCoverage=jdbc.queryForMap("""
            select process.definition_locked as "definitionLocked",
                   (select count(*) from framework_process_step
                     where process_code=process.process_code)::integer as "definedStepCount",
                   (select count(*) from framework_step_execution_spec spec
                     where spec.process_code=process.process_code)::integer as "specStepCount",
                   (select count(*) from framework_step_execution_spec spec
                     where spec.process_code=process.process_code
                       and spec.design_status='DESIGN_COMPLETE'
                       and spec.blocker_codes='[]'::jsonb)::integer as "completeStepCount"
              from framework_process_definition process where process.process_code=?
            """,process);
        int defined=((Number)finalizationCoverage.getOrDefault("definedStepCount",0)).intValue();
        int specs=((Number)finalizationCoverage.getOrDefault("specStepCount",0)).intValue();
        int complete=((Number)finalizationCoverage.getOrDefault("completeStepCount",0)).intValue();
        boolean locked=Boolean.TRUE.equals(finalizationCoverage.get("definitionLocked"));
        if(!locked&&defined>0&&specs==defined&&complete==defined){
            revision=finalizeProcessDesignRevision(process,actor);
            refresh=refreshProcessExecutionSpecs(process,actor);
        }else if(!locked){
            closeProcessDesignRevision(process,actor);
        }
        Map<String,Object> effectiveTrigger=new LinkedHashMap<>(trigger);
        if(projection.containsKey("endpointExpected"))
            effectiveTrigger.put("triggerEndpointExpected",projection.get("endpointExpected"));
        Map<String,Object> result=queueCanonicalProcessGeneration(process,actor,effectiveTrigger);
        result.put("specRefresh",refresh);result.put("exactProjection",projection);
        result.put("designRevision",revision);
        return result;
    }

    private Map<String,Object> refreshAndQueueCanonicalProcess(
            String process,String actor,Map<String,Object> trigger){
        return refreshAndQueueCanonicalProcess(process,actor,trigger,null);
    }

    @Transactional public Map<String,Object> finalizeAndQueueProcessDesign(
            String process,String actor,String triggerType){
        if(actor==null||actor.isBlank()||!actor.equals(actor.trim())||actor.length()>100)
            throw new SecurityException("AUTHENTICATED_ACTOR_REQUIRED");
        String canonicalProcess=process==null?"":process.trim().toUpperCase(Locale.ROOT);
        if(!canonicalProcess.matches("^[A-Z][A-Z0-9_:-]{1,79}$"))
            throw new IllegalArgumentException("INVALID_PROCESS_CODE");
        lockCanonicalProcessPublication(canonicalProcess);
        beginProcessDesignRevision(canonicalProcess,actor);
        Map<String,Object> trigger=new LinkedHashMap<>();
        trigger.put("triggerType",triggerType==null||triggerType.isBlank()
            ?"PROCESS_DESIGN_FINALIZATION":triggerType);
        return refreshAndQueueCanonicalProcess(canonicalProcess,actor,trigger);
    }

    private Map<String,Object> queueCanonicalProcessGeneration(
            String process,String actor,Map<String,Object> trigger){
        Map<String,Object> coverage=jdbc.queryForMap("""
            select (select count(*) from framework_process_step where process_code=?)::integer
                     as "definedStepCount",
                   (select count(*) from framework_step_execution_spec where process_code=?)::integer
                     as "specStepCount",
                   (select count(*) from framework_step_execution_spec
                     where process_code=? and design_status='DESIGN_COMPLETE'
                       and approval_status='APPROVED'
                       and generation_status in('READY','GENERATED'))::integer
                     as "generationReadyStepCount",
                   (select count(*) from framework_development_job
                     where process_code=? and job_type='FULL_STACK_GENERATION'
                       and job_group_code=?||'_CANONICAL_PUBLICATION')::integer
                     as "canonicalJobCount"
            """,process,process,process,process,process);
        int definedStepCount=((Number)coverage.getOrDefault("definedStepCount",0)).intValue();
        int specStepCount=((Number)coverage.getOrDefault("specStepCount",0)).intValue();
        int readyStepCount=((Number)coverage.getOrDefault("generationReadyStepCount",0)).intValue();
        int existingJobCount=((Number)coverage.getOrDefault("canonicalJobCount",0)).intValue();
        if(definedStepCount==0||specStepCount!=definedStepCount||readyStepCount!=definedStepCount){
            List<String> blockers=new java.util.ArrayList<>();
            if(definedStepCount==0)blockers.add("PROCESS_STEP_MISSING");
            if(specStepCount!=definedStepCount)blockers.add("STEP_SPEC_COVERAGE_INCOMPLETE");
            if(readyStepCount!=definedStepCount)blockers.add("GENERATION_APPROVAL_INCOMPLETE");
            Map<String,Object> skipped=new LinkedHashMap<>();
            skipped.put("success",true);skipped.put("status","SKIPPED");
            skipped.put("generationQueued",false);skipped.put("jobCount",existingJobCount);
            skipped.put("processCode",process);skipped.put("stepCode",str(trigger,"stepCode"));
            skipped.put("processStepCount",definedStepCount);
            skipped.put("generationReadyStepCount",readyStepCount);
            skipped.put("skippedStepCount",Math.max(0,definedStepCount-readyStepCount));
            skipped.put("blockerCount",blockers.size());skipped.put("blockers",blockers);
            skipped.put("endpointExpected",0);skipped.put("publishCount",0);
            return skipped;
        }
        List<Map<String,Object>> headed=jdbc.queryForList("""
            with generation_head as materialized (
              select framework_process_generation_input(?::text) head
            ), updated as (
               update framework_step_execution_spec spec
                  set source_hash=head->>'processInputHash',
                      updated_at=current_timestamp
                from generation_head
               where spec.process_code=?
                 and spec.design_status='DESIGN_COMPLETE'
                 and spec.approval_status='APPROVED'
                 and spec.generation_status in('READY','GENERATED')
              returning spec.step_code
            )
            select head->>'processInputHash' as "sourceHash",
                   head->>'designSetHash' as "designSetHash",
                   head->>'designCatalogHash' as "designCatalogHash",
                   head->>'designCatalogTextHash' as "designCatalogTextHash",
                   head->>'endpointCatalogHash' as "endpointCatalogHash",
                   head->>'endpointCatalogTextHash' as "endpointCatalogTextHash",
                   head->>'coordinatorStep' as "coordinatorStep",
                   (head->>'processStepCount')::integer as "processStepCount",
                   (head->>'generationReadyStepCount')::integer as "generationReadyStepCount",
                   (head->>'processEndpointExpected')::integer as "processEndpointExpected",
                   (head->>'screenCount')::integer as "designCount",
                   (select count(*) from updated)::integer as "updatedCount"
              from generation_head
             where (head->>'generationReadyStepCount')::integer>0
               and (head->>'coordinatorStep') is not null
            """,process,process);
        if(headed.size()!=1)throw new IllegalStateException(
            "CANONICAL_PROCESS_GENERATION_HEAD_NOT_EXACT: "+process);
        String sourceHash=String.valueOf(headed.get(0).get("sourceHash"));
        String designSetHash=String.valueOf(headed.get(0).get("designSetHash"));
        String designCatalogHash=String.valueOf(headed.get(0).get("designCatalogHash"));
        String designCatalogTextHash=String.valueOf(headed.get(0).get("designCatalogTextHash"));
        String endpointCatalogHash=String.valueOf(headed.get(0).get("endpointCatalogHash"));
        String endpointCatalogTextHash=String.valueOf(headed.get(0).get("endpointCatalogTextHash"));
        String coordinatorStep=String.valueOf(headed.get(0).get("coordinatorStep"));
        int processStepCount=((Number)headed.get(0).getOrDefault("processStepCount",0)).intValue();
        int generationReadyStepCount=((Number)headed.get(0)
            .getOrDefault("generationReadyStepCount",0)).intValue();
        int processEndpointExpected=((Number)headed.get(0)
            .getOrDefault("processEndpointExpected",0)).intValue();
        int updatedCount=((Number)headed.get(0).getOrDefault("updatedCount",0)).intValue();
        if(!sourceHash.matches("[0-9a-f]{64}"))
            throw new IllegalStateException("CANONICAL_SOURCE_HASH_INVALID");
        if(!designSetHash.matches("[0-9a-f]{64}")
                ||!designCatalogHash.matches("[0-9a-f]{64}")
                ||!designCatalogTextHash.matches("[0-9a-f]{64}")
                ||!endpointCatalogHash.matches("[0-9a-f]{64}")
                ||!endpointCatalogTextHash.matches("[0-9a-f]{64}"))
            throw new IllegalStateException("CANONICAL_DESIGN_SET_HASH_INVALID");
        if(coordinatorStep.isBlank()||processStepCount<1
                ||generationReadyStepCount!=processStepCount
                ||updatedCount!=generationReadyStepCount)
            throw new IllegalStateException("CANONICAL_PROCESS_GENERATION_COVERAGE_NOT_EXACT");
        int triggerEndpointExpected=trigger.get("triggerEndpointExpected") instanceof Number value
            ?value.intValue():0;
        if("PROFESSIONAL_SCREEN_CONTRACT".equals(str(trigger,"triggerType"))
                &&triggerEndpointExpected<1)
            throw new IllegalStateException("CANONICAL_ENDPOINT_OUTPUT_REQUIRED");

        String target="canonical://"+process+"/"+sourceHash;
        Map<String,Object> generationSpec=new LinkedHashMap<>();
        generationSpec.put("algorithm","CANONICAL_PROCESS_PUBLICATION_V1");
        generationSpec.put("generatorRequired",true);generationSpec.put("reuseCommonAssets",true);
        generationSpec.put("processCode",process);generationSpec.put("stepCode",coordinatorStep);
        generationSpec.put("coordinatorStep",coordinatorStep);
        generationSpec.put("processInputHash",sourceHash);
        generationSpec.put("processStepCount",processStepCount);
        generationSpec.put("generationReadyStepCount",generationReadyStepCount);
        generationSpec.put("triggerType",def(trigger,"triggerType","PROCESS_DEFINITION"));
        if(!str(trigger,"stepCode").isBlank())
            generationSpec.put("triggerStep",str(trigger,"stepCode"));
        if(!str(trigger,"routePath").isBlank())
            generationSpec.put("routePath",str(trigger,"routePath"));
        if(!str(trigger,"audience").isBlank())
            generationSpec.put("audience",str(trigger,"audience"));
        if(!str(trigger,"designHash").isBlank())
            generationSpec.put("designHash",str(trigger,"designHash"));
        generationSpec.put("sourceHash",sourceHash);
        generationSpec.put("designSetHash",designSetHash);
        generationSpec.put("designCatalogHash",designCatalogHash);
        generationSpec.put("designCatalogTextHash",designCatalogTextHash);
        generationSpec.put("endpointCatalogHash",endpointCatalogHash);
        generationSpec.put("endpointCatalogTextHash",endpointCatalogTextHash);
        generationSpec.put("endpointExpected",processEndpointExpected);
        generationSpec.put("triggerEndpointExpected",triggerEndpointExpected);
        generationSpec.put("requiredGates",List.of(
            "DESIGN","FRONTEND","API","DATABASE","HELP","CARDS","BUILD","PUBLISH"));
        generationSpec.put("verifiedEvidenceRequired",true);generationSpec.put("autoDeploy",false);
        generationSpec.put("requirement","구조화 화면·기능·권한·엔드포인트 계약을 기존 결정적 제너레이터로 생성한다.");
        String specification=toJson(generationSpec);
        String canonicalGroup=process+"_CANONICAL_PUBLICATION";
        List<Map<String,Object>> existing=jdbc.queryForList(
            "select job_id as \"jobId\",job_status as \"jobStatus\",target_path as \"targetPath\" from framework_development_job where process_code=? and job_type='FULL_STACK_GENERATION' and job_group_code=? for update",
            process,canonicalGroup);
        long jobId;
        boolean queued;
        boolean resetArtifact;
        if(existing.isEmpty()){
            jobId=jdbc.queryForObject("""
                insert into framework_development_job(
                  process_code,step_code,job_type,job_name,target_path,specification_json,
                  job_status,approval_status,execution_mode,job_group_code,required,
                  progress_weight,max_attempts,quality_status,created_by)
                values(?,?,'FULL_STACK_GENERATION','구조화 설계 전체 스택 자동 생성',?, ?,
                  'PLANNED','APPROVED','SEQUENTIAL',?,true,10,3,'PENDING',?) returning job_id
                """,Long.class,process,coordinatorStep,target,specification,
                canonicalGroup,actor);
            queued=true;
            resetArtifact=true;
        }else{
            if(existing.size()!=1)throw new IllegalStateException("CANONICAL_GENERATION_JOB_NOT_EXACT");
            jobId=((Number)existing.get(0).get("jobId")).longValue();
            String status=String.valueOf(existing.get(0).get("jobStatus"));
            boolean sameHeads=target.equals(String.valueOf(existing.get(0).get("targetPath")));
            if(!sameHeads){
                queued=true;resetArtifact=true;
                int revisionReset=jdbc.update("""
                    update framework_development_job
                       set step_code=?,target_path=?,specification_json=?,job_status='PLANNED',
                           approval_status='APPROVED',quality_status='PENDING',quality_report='{}',
                           worker_id=null,lease_token=null,lease_until=null,attempt_count=0,
                           started_at=null,completed_at=null,result_json='{}',evidence_ref=null,
                           rollback_ref=null,last_error=null,updated_at=current_timestamp
                     where job_id=? and process_code=?
                       and job_type='FULL_STACK_GENERATION' and job_group_code=?
                    """,coordinatorStep,target,specification,jobId,process,canonicalGroup);
                if(revisionReset!=1)throw new IllegalStateException(
                    "CANONICAL_GENERATION_JOB_REVISION_RESET_FAILED");
                jdbc.update("delete from framework_development_job_gate_result where job_id=?",jobId);
            }else if(Set.of("VERIFIED","COMPLETED").contains(status)){
                queued=false;resetArtifact=false;
            }else if(Set.of("PLANNED","CLAIMED","RUNNING").contains(status)){
                queued=true;resetArtifact=false;
            }
            else if(Set.of("FAILED","BLOCKED").contains(status)){
                queued=true;resetArtifact=true;
                jdbc.update("""
                update framework_development_job
                   set step_code=?,specification_json=?,job_status='PLANNED',approval_status='APPROVED',
                       quality_status='PENDING',worker_id=null,lease_token=null,lease_until=null,
                       last_error=null,completed_at=null,updated_at=current_timestamp
                 where job_id=?
                """,coordinatorStep,specification,jobId);
            }else throw new IllegalStateException("CANONICAL_GENERATION_JOB_STATUS_INVALID: "+status);
        }
        Integer artifactCount=jdbc.queryForObject(
            "select count(*) from framework_process_artifact where process_code=? and contract_ref='AUTO:FULL_STACK_GENERATION'",
            Integer.class,process);
        if(artifactCount==null||artifactCount>1)
            throw new IllegalStateException("CANONICAL_GENERATION_ARTIFACT_NOT_EXACT");
        if(artifactCount==0)jdbc.update("""
            insert into framework_process_artifact(
              process_code,step_code,artifact_code,artifact_type,artifact_name,target_path,
              contract_ref,required,delivery_status,owner_actor_code,acceptance_criteria,notes)
            values(?,?,?,'FULL_STACK','구조화 설계 전체 스택 산출물',?,
              'AUTO:FULL_STACK_GENERATION',true,'PLANNED',
              (select actor_code from framework_process_step where process_code=? and step_code=?),
              '동일 designHash/sourceHash의 결정적 산출물과 자동 테스트가 통과해야 한다.',
              'save-and-generate direct path')
            """,process,coordinatorStep,(process+"_FULL_STACK_GENERATION").replaceAll("[^A-Za-z0-9_]","_"),
            target,process,coordinatorStep);
        else jdbc.update("""
            update framework_process_artifact
               set step_code=?,target_path=?,delivery_status=case when ? then 'PLANNED' else delivery_status end,
                   evidence_ref=case when ? then null else evidence_ref end,
                   updated_at=current_timestamp
             where process_code=? and contract_ref='AUTO:FULL_STACK_GENERATION'
            """,coordinatorStep,target,resetArtifact,resetArtifact,process);

        Integer canonicalJobCount=jdbc.queryForObject("""
            select count(*) from framework_development_job
             where process_code=? and job_type='FULL_STACK_GENERATION'
               and job_group_code=?
            """,Integer.class,process,canonicalGroup);
        if(canonicalJobCount==null||canonicalJobCount!=1)
            throw new IllegalStateException("CANONICAL_GENERATION_JOB_NOT_EXACT");

        Map<String,Object> result=new LinkedHashMap<>();
        result.put("success",true);result.put("status",queued?"QUEUED":"UNCHANGED");
        result.put("generationQueued",queued);result.put("jobCount",canonicalJobCount);result.put("jobId",jobId);
        result.put("processCode",process);
        result.put("stepCode",str(trigger,"stepCode").isBlank()
            ?coordinatorStep:str(trigger,"stepCode"));
        result.put("routePath",str(trigger,"routePath"));
        result.put("designHash",str(trigger,"designHash").isBlank()
            ?designSetHash:str(trigger,"designHash"));
        result.put("sourceHash",sourceHash);
        result.put("processInputHash",sourceHash);result.put("designSetHash",designSetHash);
        result.put("designCatalogHash",designCatalogHash);
        result.put("endpointCatalogHash",endpointCatalogHash);
        result.put("coordinatorStep",coordinatorStep);result.put("processStepCount",processStepCount);
        result.put("generationReadyStepCount",generationReadyStepCount);
        result.put("endpointExpected",processEndpointExpected);result.put("publishCount",0);
        return result;
    }

    /**
     * Runs the governed design-to-delivery handoff for one selected process
     * step. Preflight is fail-closed, so implementation cannot be reopened
     * before actor, screen, test and common-design contracts pass.
     */
    @Transactional public Map<String,Object> executeDevelopmentPipeline(Map<String,Object> body,String actor){
        String process=req(body,"processCode");
        String step=req(body,"stepCode");
        Map<String,Object> preflight=runScreenDevelopmentPreflight(process,step,actor);
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("success",true);
        result.put("processCode",process);
        result.put("stepCode",step);
        result.put("preflight",preflight);
        if(!Boolean.TRUE.equals(preflight.get("passed"))){
            result.put("status","DESIGN_REQUIRED");
            result.put("queued",false);
            result.put("nextAction",preflight.get("failureSummary"));
            return result;
        }
        Map<String,Object> delivery=executeDesignDirectDevelopment(
                Map.of("processCode",process,"force",Boolean.TRUE.equals(body.get("force"))),actor);
        result.put("status",delivery.get("status"));
        result.put("queued",Set.of("READY_TO_EXECUTE","UNCHANGED").contains(String.valueOf(delivery.get("status"))));
        result.put("delivery",delivery);
        result.put("pipeline",List.of("DESIGN_VALIDATED","SCREEN_PREFLIGHT_PASSED",
                "CODE_GENERATION_QUEUED","QUALITY_GATES_REQUIRED","DEPLOYMENT_GATE_REQUIRED"));
        result.put("nextAction",delivery.get("nextAction"));
        return result;
    }

    /**
     * Compiles one route note into the exact professional-contract/blueprint
     * identity in the same transaction.  The canonical database bundle is the
     * commit invariant: a changed source must change both hashes and expose the
     * typed note through the operator-support lanes.
     */
    @Transactional public Map<String,Object> saveDesignAndGenerate(Map<String,Object> body,String actor){
        String route=ScreenDevelopmentNoteService.cleanRoute(req(body,"routePath"));
        jdbc.query("select pg_advisory_xact_lock(hashtext(lower(?)))",rs->{},route);
        String designNote=req(body,"designNote");
        String functionNote=req(body,"functionNote");
        String acceptanceNote=req(body,"acceptanceNote");
        List<Map<String,Object>> identities=jdbc.queryForList("""
            with blueprint_candidates as materialized (
              select b.blueprint_id,c.contract_id,
                     (b.transition_status='CONTRACT_LINKED' and lower(b.source_reference) in(
                       'framework_professional_screen_contract:'||c.contract_id,
                       'professional_screen_contract:'||c.contract_id)) explicit_link,
                     count(*) over(partition by c.contract_id) candidate_count,
                     count(*) filter(where b.transition_status='CONTRACT_LINKED'
                       and lower(b.source_reference) in(
                         'framework_professional_screen_contract:'||c.contract_id,
                         'professional_screen_contract:'||c.contract_id))
                       over(partition by c.contract_id) explicit_count
                from framework_screen_blueprint b
                join framework_professional_screen_contract c
                  on c.process_code=b.process_code and c.step_code=b.step_code
                 and upper(c.audience)=upper(b.audience)
                 and lower(split_part(c.route_path,'?',1))=
                     lower(split_part(b.route_path,'?',1))
               where b.validation_status='VALID'
                 and lower(split_part(b.route_path,'?',1))=lower(?)
            ), authority as materialized (
              select blueprint_id,contract_id from blueprint_candidates
               where (explicit_count=1 and explicit_link)
                  or (explicit_count=0 and candidate_count=1)
            )
            select b.blueprint_id as "blueprintId",c.contract_id as "contractId",
                   b.process_code as "processCode",b.step_code as "stepCode",b.audience,
                   lower(split_part(b.route_path,'?',1)) as "routePath",
                   c.section_contract as "sectionContract",c.field_contract as "fieldContract",
                   c.command_contract as "commandContract",c.state_contract as "stateContract",
                   c.api_contract as "apiContract",c.data_contract as "dataContract",
                   c.evidence_contract as "evidenceContract",
                   b.specification_json as "specificationJson",
                   b.traceability_json as "traceabilityJson"
              from authority selected
              join framework_screen_blueprint b using(blueprint_id)
              join framework_professional_screen_contract c using(contract_id)
             order by b.blueprint_id,c.contract_id
             for update of b,c
            """,route);
        if(identities.size()!=1)throw new IllegalStateException(
            "CANONICAL_SCREEN_IDENTITY_NOT_EXACT: route="+route+", count="+identities.size());
        Map<String,Object> identity=new LinkedHashMap<>(identities.get(0));
        route=String.valueOf(identity.get("routePath"));
        validateDesignCompilationSource(identity);
        Map<String,Object> compiledNote=compileTypedDesignNote(
            route,body,designNote,functionNote,acceptanceNote);
        Map<String,Object> before=canonicalScreenBundle(identity);
        Map<String,Object> currentNote=screenDevelopmentNoteService.find(route);
        boolean canonicalNoteUnchanged=canonicalDesignNoteMatches(currentNote,designNote,functionNote,acceptanceNote);
        boolean noteUnchanged=designNoteMatches(
            currentNote,body,designNote,functionNote,acceptanceNote);
        boolean sourceAlreadyCompiled=sourceContainsCompiledNote(identity,compiledNote);
        List<String> processes=List.of(String.valueOf(identity.get("processCode")));
        if(noteUnchanged&&sourceAlreadyCompiled){
            requireCanonicalCompiledNote(before,compiledNote);
            List<Map<String,Object>> outputs=designCodeOutputs(route);
            String currentSourceHash=jdbc.queryForObject(
                "select source_hash from framework_step_execution_spec where process_code=? and step_code=?",
                String.class,identity.get("processCode"),identity.get("stepCode"));
            Map<String,Object> currentDesign=canonicalObject(before.get("canonicalDesign"),"canonicalDesign");
            Map<String,Object> currentLanes=canonicalObject(currentDesign.get("lanes"),"canonicalDesign.lanes");
            int endpointExpected=currentLanes.get("API") instanceof List<?> apis?apis.size():0;
            Map<String,Object> result=new LinkedHashMap<>();
            result.put("success",true);result.put("changed",false);result.put("note",currentNote);
            result.put("routePath",route);result.put("processCodes",processes);
            result.put("deliveries",List.of());result.put("codeOutputs",outputs);
            result.put("generationStatus","UNCHANGED");result.put("selfHealingRunId",null);
            result.put("generationQueued",false);result.put("jobCount",0);
            result.put("sourceHash",currentSourceHash==null?"":currentSourceHash);
            result.put("endpointExpected",endpointExpected);result.put("publishCount",0);
            result.put("designHash",canonicalHash(before,"designHash"));
            result.put("catalogHash",before.get("catalogHash"));
            result.put("support",canonicalSupport(before));
            result.put("hashTransition",hashTransition(before,before));
            Map<String,Object> unchangedPublication=new LinkedHashMap<>();
            unchangedPublication.put("reason","UNCHANGED");
            unchangedPublication.put("published",false);
            unchangedPublication.put("designHash",canonicalHash(before,"designHash"));
            unchangedPublication.put("catalogHash",before.get("catalogHash"));
            result.put("runtimePublication",unchangedPublication);
            result.put("rollbackPolicy","TRANSACTION_ROLLBACK");result.put("buildRequired",false);
            return result;
        }
        UUID recoveryRun=jdbc.queryForObject(
            "insert into framework_design_self_healing_run(route_key,affected_process_codes,executed_by) values(?,?,?) returning run_id",
            UUID.class,route,processes.toArray(String[]::new),actor);
        Map<String,Object> note=screenDevelopmentNoteService.save(body,actor);
        String compiledJson=toJson(compiledNote);
        long contractId=((Number)identity.get("contractId")).longValue();
        long blueprintId=((Number)identity.get("blueprintId")).longValue();
        int contractWrites=jdbc.update("""
            with next_contract as (
              select c.contract_id,
                     coalesce((
                       select jsonb_agg(e.value order by e.ordinality)
                         from jsonb_array_elements(c.evidence_contract::jsonb)
                              with ordinality e(value,ordinality)
                        where not (jsonb_typeof(e.value)='object'
                          and coalesce(e.value->>'namespace','')=? )
                     ),'[]'::jsonb)||jsonb_build_array(cast(? as jsonb)) as next_evidence
                from framework_professional_screen_contract c
               where c.contract_id=?
            )
            update framework_professional_screen_contract c
               set evidence_contract=next_contract.next_evidence::text,
                   updated_by=?,updated_at=current_timestamp
              from next_contract
             where c.contract_id=next_contract.contract_id
               and c.evidence_contract::jsonb is distinct from next_contract.next_evidence
            """,DESIGN_AUTOMATION_NAMESPACE,compiledJson,contractId,actor);
        int blueprintWrites=jdbc.update("""
            with next_blueprint as (
              select b.blueprint_id,
                     b.specification_json::jsonb||jsonb_build_object(
                       'extensions',coalesce(b.specification_json::jsonb->'extensions','{}'::jsonb)
                         ||jsonb_build_object('designAutomation',cast(? as jsonb))
                     ) as next_specification
                from framework_screen_blueprint b
               where b.blueprint_id=?
            )
            update framework_screen_blueprint b
               set specification_json=next_blueprint.next_specification::text,
                   updated_at=current_timestamp
              from next_blueprint
             where b.blueprint_id=next_blueprint.blueprint_id
               and b.specification_json::jsonb is distinct from next_blueprint.next_specification
            """,compiledJson,blueprintId);
        Map<String,Object> after=canonicalScreenBundle(identity);
        requireCanonicalCompiledNote(after,compiledNote);
        boolean canonicalContentChanged=!canonicalNoteUnchanged||contractWrites>0||blueprintWrites>0;
        boolean sourceChanged=!noteUnchanged||canonicalContentChanged;
        if(!sourceChanged)throw new IllegalStateException(
            "DESIGN_SOURCE_WRITE_INVARIANT: changed request produced no canonical source write");
        if(canonicalContentChanged&&canonicalHash(before,"designHash").equals(canonicalHash(after,"designHash")))
            throw new IllegalStateException("CANONICAL_DESIGN_HASH_INVARIANT: changed content retained designHash");
        List<Map<String,Object>> deliveries=new java.util.ArrayList<>();
        for(String process:processes){
            generateProfessionalDesignGraph(process,actor);
            deliveries.add(executeDesignDirectDevelopment(Map.of(
                "processCode",process,"stepCode",String.valueOf(identity.get("stepCode")),
                "routePath",route,"audience",String.valueOf(identity.get("audience")),
                "designHash",canonicalHash(after,"designHash")),actor));
        }
        Map<String,Object> runtimePublication=screenContractRuntimeService.publishProfessionalContract(contractId,actor);
        if(!canonicalHash(after,"designHash").equals(runtimePublication.get("designHash")))
            throw new IllegalStateException("RUNTIME_PUBLICATION_CANONICAL_HASH_MISMATCH");
        List<Map<String,Object>> outputs=designCodeOutputs(route);
        long invalidScreens=outputs.stream().filter(row->!"VALID".equals(String.valueOf(row.get("validationStatus")))).count();
        boolean generationQueued=deliveries.stream().anyMatch(row->Boolean.TRUE.equals(row.get("generationQueued")));
        int jobCount=deliveries.stream().mapToInt(row->((Number)row.getOrDefault("jobCount",0)).intValue()).sum();
        int endpointExpected=deliveries.stream().mapToInt(row->((Number)row.getOrDefault("endpointExpected",0)).intValue()).sum();
        String sourceHash=deliveries.isEmpty()?"":String.valueOf(deliveries.get(0).getOrDefault("sourceHash",""));
        String generationStatus=invalidScreens>0?"DESIGN_INCOMPLETE":generationQueued?"QUEUED":"UNCHANGED";
        Map<String,Object> recoveryResult=new LinkedHashMap<>();
        recoveryResult.put("routePath",route);recoveryResult.put("processCodes",processes);
        recoveryResult.put("deliveries",deliveries);recoveryResult.put("generatedScreens",outputs.size());
        recoveryResult.put("invalidScreens",invalidScreens);
        recoveryResult.put("designHash",canonicalHash(after,"designHash"));
        recoveryResult.put("sourceHash",sourceHash);recoveryResult.put("jobCount",jobCount);
        recoveryResult.put("endpointExpected",endpointExpected);recoveryResult.put("generationQueued",generationQueued);
        recoveryResult.put("catalogHash",after.get("catalogHash"));
        recoveryResult.put("buildRequired",false);
        jdbc.update("update framework_design_self_healing_run set run_status=?,regenerated_process_count=?,generated_screen_count=?,invalid_screen_count=?,result_json=cast(? as jsonb),completed_at=current_timestamp where run_id=?",
            generationStatus,processes.size(),outputs.size(),invalidScreens,toJson(recoveryResult),recoveryRun);
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("success",true);result.put("changed",true);result.put("note",note);result.put("routePath",route);
        result.put("processCodes",processes);result.put("deliveries",deliveries);result.put("codeOutputs",outputs);
        result.put("generationStatus",generationStatus);result.put("selfHealingRunId",recoveryRun);
        result.put("designHash",canonicalHash(after,"designHash"));
        result.put("sourceHash",sourceHash);result.put("jobCount",jobCount);
        result.put("endpointExpected",endpointExpected);result.put("generationQueued",generationQueued);
        result.put("catalogHash",after.get("catalogHash"));
        result.put("support",canonicalSupport(after));
        result.put("hashTransition",hashTransition(before,after));
        result.put("runtimePublication",runtimePublication);
        result.put("rollbackPolicy","TRANSACTION_ROLLBACK");result.put("buildRequired",false);
        return result;
    }

    private static Map<String,Object> compileTypedDesignNote(String route,Map<String,Object> request,String design,
            String functions,String acceptance){
        Map<String,Object> compiled=new LinkedHashMap<>();
        compiled.put("schema","carbonet.design-note/v1");
        compiled.put("namespace",DESIGN_AUTOMATION_NAMESPACE);
        compiled.put("routePath",route);
        compiled.put("design",typedNoteValue("DESIGN_REQUIREMENT",design));
        compiled.put("functions",typedNoteValue("FUNCTION_REQUIREMENT",functions));
        compiled.put("acceptance",typedNoteValue("ACCEPTANCE_RULE",acceptance));
        Map<String,Object> page=new LinkedHashMap<>();
        page.put("pageId",def(request,"pageId",""));
        page.put("pageTitle",def(request,"pageTitle",""));
        page.put("status",def(request,"status","READY"));
        compiled.put("page",page);
        compiled.put("noteHash",sha256Hex(toJson(compiled)));
        return compiled;
    }

    private static Map<String,Object> typedNoteValue(String type,String text){
        Map<String,Object> value=new LinkedHashMap<>();
        value.put("type",type);value.put("text",text);return value;
    }

    private static void validateDesignCompilationSource(Map<String,Object> source){
        for(String field:List.of("sectionContract","fieldContract","commandContract","stateContract",
                "apiContract","dataContract","evidenceContract"))
            validateJsonArray(String.valueOf(source.get(field)),field);
        validateJsonObject(String.valueOf(source.get("specificationJson")),"specificationJson");
        validateJsonObject(String.valueOf(source.get("traceabilityJson")),"traceabilityJson");
        try{
            com.fasterxml.jackson.databind.JsonNode specification=
                new com.fasterxml.jackson.databind.ObjectMapper().readTree(
                    String.valueOf(source.get("specificationJson")));
            if(specification.has("extensions")&&!specification.get("extensions").isObject())
                throw new IllegalArgumentException("specificationJson.extensions must be a JSON object");
        }catch(com.fasterxml.jackson.core.JsonProcessingException error){
            throw new IllegalArgumentException("specificationJson must be valid JSON",error);
        }
    }

    private static boolean designNoteMatches(Map<String,Object> current,Map<String,Object> requested,
            String design,String functions,String acceptance){
        String requestedStatus=def(requested,"status","READY");
        return design.equals(String.valueOf(current.getOrDefault("designNote","")))
            &&functions.equals(String.valueOf(current.getOrDefault("functionNote","")))
            &&acceptance.equals(String.valueOf(current.getOrDefault("acceptanceNote","")))
            &&def(requested,"pageId","").equals(String.valueOf(current.getOrDefault("pageId","")))
            &&def(requested,"pageTitle","").equals(String.valueOf(current.getOrDefault("pageTitle","")))
            &&requestedStatus.equals(String.valueOf(current.getOrDefault("status","DRAFT")));
    }

    private static boolean sourceContainsCompiledNote(Map<String,Object> source,Map<String,Object> compiled){
        try{
            com.fasterxml.jackson.databind.ObjectMapper mapper=new com.fasterxml.jackson.databind.ObjectMapper();
            com.fasterxml.jackson.databind.JsonNode expected=mapper.valueToTree(compiled);
            com.fasterxml.jackson.databind.JsonNode evidence=mapper.readTree(String.valueOf(source.get("evidenceContract")));
            boolean evidenceFound=false;
            for(com.fasterxml.jackson.databind.JsonNode item:evidence)if(expected.equals(item)){evidenceFound=true;break;}
            com.fasterxml.jackson.databind.JsonNode specification=mapper.readTree(String.valueOf(source.get("specificationJson")));
            return evidenceFound&&expected.equals(specification.path("extensions").path("designAutomation"));
        }catch(com.fasterxml.jackson.core.JsonProcessingException error){
            throw new IllegalArgumentException("design source JSON is invalid",error);
        }
    }

    private static boolean canonicalDesignNoteMatches(Map<String,Object> current,String design,
            String functions,String acceptance){
        return design.equals(String.valueOf(current.getOrDefault("designNote","")))
            &&functions.equals(String.valueOf(current.getOrDefault("functionNote","")))
            &&acceptance.equals(String.valueOf(current.getOrDefault("acceptanceNote","")));
    }

    private Map<String,Object> canonicalGenerationIdentity(long contractId){
        List<Map<String,Object>> rows=jdbc.queryForList("""
            with blueprint_candidates as materialized (
              select b.blueprint_id,c.contract_id,
                     (b.transition_status='CONTRACT_LINKED' and lower(b.source_reference) in(
                       'framework_professional_screen_contract:'||c.contract_id,
                       'professional_screen_contract:'||c.contract_id)) explicit_link,
                     count(*) over(partition by c.contract_id) candidate_count,
                     count(*) filter(where b.transition_status='CONTRACT_LINKED'
                       and lower(b.source_reference) in(
                         'framework_professional_screen_contract:'||c.contract_id,
                         'professional_screen_contract:'||c.contract_id))
                       over(partition by c.contract_id) explicit_count
                from framework_professional_screen_contract c
                join framework_screen_blueprint b
                  on b.process_code=c.process_code and b.step_code=c.step_code
                 and upper(b.audience)=upper(c.audience)
                 and lower(split_part(b.route_path,'?',1))=lower(split_part(c.route_path,'?',1))
               where c.contract_id=? and b.validation_status='VALID'
            ), authority as materialized (
              select blueprint_id,contract_id from blueprint_candidates
               where (explicit_count=1 and explicit_link)
                  or (explicit_count=0 and candidate_count=1)
            )
            select b.blueprint_id as "blueprintId",c.contract_id as "contractId",
                   b.process_code as "processCode",b.step_code as "stepCode",b.audience,
                   lower(split_part(b.route_path,'?',1)) as "routePath",
                   c.section_contract as "sectionContract",c.field_contract as "fieldContract",
                   c.command_contract as "commandContract",c.state_contract as "stateContract",
                   c.api_contract as "apiContract",c.data_contract as "dataContract",
                   c.evidence_contract as "evidenceContract",
                   b.specification_json as "specificationJson",b.traceability_json as "traceabilityJson"
              from authority selected
              join framework_professional_screen_contract c using(contract_id)
              join framework_screen_blueprint b using(blueprint_id)
             order by b.blueprint_id
             for update of b,c
            """,contractId);
        if(rows.size()!=1)throw new IllegalStateException(
            "CANONICAL_SCREEN_IDENTITY_NOT_EXACT: contractId="+contractId+", count="+rows.size());
        Map<String,Object> identity=new LinkedHashMap<>(rows.get(0));
        validateDesignCompilationSource(identity);
        return identity;
    }

    Map<String,Object> updateProfessionalBlueprintDesign(long contractId,Map<String,Object> body){
        if(!body.containsKey("layout")&&!body.containsKey("theme"))
            return Map.of("changed",false,"layout","","theme","");
        List<Map<String,Object>> rows=jdbc.queryForList("""
            with candidates as materialized (
              select b.blueprint_id,c.contract_id,
                     (b.transition_status='CONTRACT_LINKED' and lower(b.source_reference) in(
                       'framework_professional_screen_contract:'||c.contract_id,
                       'professional_screen_contract:'||c.contract_id)) explicit_link,
                     count(*) over(partition by c.contract_id) candidate_count,
                     count(*) filter(where b.transition_status='CONTRACT_LINKED'
                       and lower(b.source_reference) in(
                         'framework_professional_screen_contract:'||c.contract_id,
                         'professional_screen_contract:'||c.contract_id))
                       over(partition by c.contract_id) explicit_count
                from framework_professional_screen_contract c
                join framework_screen_blueprint b
                  on b.process_code=c.process_code and b.step_code=c.step_code
                 and upper(b.audience)=upper(c.audience)
                 and lower(split_part(b.route_path,'?',1))=lower(split_part(c.route_path,'?',1))
               where c.contract_id=? and b.validation_status='VALID'
            ), authority as materialized (
              select blueprint_id,contract_id from candidates
               where (explicit_count=1 and explicit_link)
                  or (explicit_count=0 and candidate_count=1)
            )
            select b.blueprint_id as "blueprintId",
                   lower(split_part(b.route_path,'?',1)) as "routePath",
                   b.specification_json as "specificationJson"
              from authority selected join framework_screen_blueprint b using(blueprint_id)
             order by b.blueprint_id for update of b
            """,contractId);
        if(rows.size()!=1)throw new IllegalStateException(
            "CANONICAL_SCREEN_IDENTITY_NOT_EXACT: contractId="+contractId+", count="+rows.size());
        Map<String,Object> authority=rows.get(0);
        String route=String.valueOf(authority.get("routePath"));
        String specification=String.valueOf(authority.get("specificationJson"));
        validateJsonObject(specification,"specificationJson");
        Map<String,Object> current=jsonMap(specification);

        String layout=(body.containsKey("layout")
            ?str(body,"layout"):String.valueOf(current.getOrDefault("layout",""))).trim();
        if(layout.isBlank()){
            List<String> defaults=jdbc.queryForList(
                "select distinct layout_type from framework_screen_resource where route_key=? and nullif(btrim(layout_type),'') is not null",
                String.class,route);
            if(defaults.size()!=1)throw new IllegalStateException(
                "REGISTERED_ROUTE_LAYOUT_NOT_EXACT: "+route+", count="+defaults.size());
            layout=defaults.get(0);
        }else{
            Integer registered=jdbc.queryForObject(
                "select count(distinct layout_type) from framework_screen_resource where layout_type=?",
                Integer.class,layout);
            if(registered==null||registered!=1)
                throw new IllegalArgumentException("REGISTERED_LAYOUT_REQUIRED: "+layout);
        }
        if(!layout.matches("[A-Z][A-Z0-9_]{1,79}"))
            throw new IllegalArgumentException("GOVERNED_LAYOUT_CODE_REQUIRED: "+layout);
        String theme=(body.containsKey("theme")
            ?str(body,"theme"):String.valueOf(current.getOrDefault("theme",""))).trim();
        if(theme.isBlank())theme="KRDS_GOV_DEFAULT";
        Integer registeredTheme=jdbc.queryForObject(
            "select count(*) from comtnthemedefinition where theme_id=? and use_at='Y' and is_active='Y'",
            Integer.class,theme);
        if(registeredTheme==null||registeredTheme!=1)
            throw new IllegalArgumentException("ACTIVE_REGISTERED_THEME_REQUIRED: "+theme);
        if(!theme.matches("[A-Z][A-Z0-9_]{1,79}"))
            throw new IllegalArgumentException("GOVERNED_THEME_CODE_REQUIRED: "+theme);

        boolean changed=!layout.equals(String.valueOf(current.getOrDefault("layout","")))
            ||!theme.equals(String.valueOf(current.getOrDefault("theme","")));
        if(changed){
            int updated=jdbc.update("""
                update framework_screen_blueprint
                   set specification_json=(framework_try_jsonb(specification_json)||
                         jsonb_build_object('layout',?,'theme',?))::text,
                       updated_at=current_timestamp
                 where blueprint_id=? and validation_status='VALID'
                   and jsonb_typeof(framework_try_jsonb(specification_json))='object'
                """,layout,theme,authority.get("blueprintId"));
            if(updated!=1)throw new IllegalStateException("CANONICAL_BLUEPRINT_DESIGN_WRITE_FAILED");
        }
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("changed",changed);result.put("blueprintId",authority.get("blueprintId"));
        result.put("layout",layout);result.put("theme",theme);return result;
    }

    private Map<String,Object> structuredGenerationReadiness(long contractId){
        return jdbc.queryForMap("""
            with target as (
              select contract.process_code,contract.step_code,step.actor_code,
                     step.requires_user_page,step.requires_admin_page,
                     lower(split_part(coalesce(step.user_path,''),'?',1)) user_route,
                     lower(split_part(coalesce(step.admin_path,''),'?',1)) admin_route
                from framework_professional_screen_contract contract
                join framework_process_step step using(process_code,step_code)
               where contract.contract_id=?
            ), blueprint_candidates as materialized (
              select c.contract_id,b.blueprint_id,
                     (b.transition_status='CONTRACT_LINKED' and lower(b.source_reference) in(
                       'framework_professional_screen_contract:'||c.contract_id,
                       'professional_screen_contract:'||c.contract_id)) explicit_link,
                     count(*) over(partition by c.contract_id) candidate_count,
                     count(*) filter(where b.transition_status='CONTRACT_LINKED'
                       and lower(b.source_reference) in(
                         'framework_professional_screen_contract:'||c.contract_id,
                         'professional_screen_contract:'||c.contract_id))
                       over(partition by c.contract_id) explicit_count
                from framework_professional_screen_contract c
                join target using(process_code,step_code)
                join framework_screen_blueprint b
                  on b.process_code=c.process_code and b.step_code=c.step_code
                 and upper(b.audience)=upper(c.audience)
                 and lower(split_part(b.route_path,'?',1))=lower(split_part(c.route_path,'?',1))
                 and b.validation_status='VALID'
            ), authority as materialized (
              select blueprint_id,contract_id from blueprint_candidates
               where (explicit_count=1 and explicit_link)
                  or (explicit_count=0 and candidate_count=1)
            ), contracts as (
              select c.*,
                     (select count(*) from authority selected
                       where selected.contract_id=c.contract_id) blueprint_count,
                     framework_try_jsonb(c.section_contract) sections,
                     framework_try_jsonb(c.field_contract) fields,
                     framework_try_jsonb(c.command_contract) commands,
                     framework_try_jsonb(c.state_contract) states,
                     framework_try_jsonb(c.api_contract) apis,
                     framework_try_jsonb(c.data_contract) data_contract
                from framework_professional_screen_contract c join target using(process_code,step_code)
            ), checked as (
              select contracts.*,blueprint_count=1
                     and contracts.actor_code=target.actor_code
                     and ((upper(contracts.audience)='USER'
                       and target.requires_user_page
                       and lower(split_part(contracts.route_path,'?',1))=target.user_route)
                      or (upper(contracts.audience)='ADMIN'
                       and target.requires_admin_page
                       and lower(split_part(contracts.route_path,'?',1))=target.admin_route))
                     and exists(select 1 from authority selected
                       join framework_screen_blueprint blueprint using(blueprint_id)
                       where selected.contract_id=contracts.contract_id
                         and blueprint.actor_code=target.actor_code)
                     and case when jsonb_typeof(sections)='array' then jsonb_array_length(sections)>0 else false end
                     and case when jsonb_typeof(fields)='array' then jsonb_array_length(fields)>0 else false end
                     and case when jsonb_typeof(commands)='array' then jsonb_array_length(commands)>0 else false end
                     and case when jsonb_typeof(states)='array' then jsonb_array_length(states)>0 else false end
                     and case when jsonb_typeof(apis)='array' then jsonb_array_length(apis)>0 else false end
                     and case when jsonb_typeof(data_contract)='array' then jsonb_array_length(data_contract)>0 else false end
                     and not exists(select 1 from jsonb_array_elements(
                       case when jsonb_typeof(sections)='array' then sections else '[]'::jsonb end) value
                       where jsonb_typeof(value)<>'object')
                     and not exists(select 1 from jsonb_array_elements(
                       case when jsonb_typeof(fields)='array' then fields else '[]'::jsonb end) value
                       where jsonb_typeof(value)<>'object')
                     and not exists(select 1 from jsonb_array_elements(
                       case when jsonb_typeof(commands)='array' then commands else '[]'::jsonb end) value
                       where jsonb_typeof(value)<>'object')
                     and not exists(select 1 from jsonb_array_elements(
                       case when jsonb_typeof(apis)='array' then apis else '[]'::jsonb end) value
                       where jsonb_typeof(value)<>'object')
                     and not exists(select 1 from jsonb_array_elements(
                       case when jsonb_typeof(states)='array' then states else '[]'::jsonb end) value
                       where jsonb_typeof(value)<>'object')
                     and not exists(select 1 from jsonb_array_elements(
                       case when jsonb_typeof(data_contract)='array' then data_contract else '[]'::jsonb end) value
                       where jsonb_typeof(value)<>'object') valid
                from contracts cross join target
            )
            select count(*) as "contractCount",count(*) filter(where valid) as "validContractCount",
                   count(*)-count(*) filter(where valid) as "blockerCount",
                   count(*)>0 and bool_and(valid)
                     and (not target.requires_user_page or
                       count(*) filter(where valid and upper(checked.audience)='USER')=1)
                     and (not target.requires_admin_page or
                       count(*) filter(where valid and upper(checked.audience)='ADMIN')=1)
                     as "generationEligible"
              from checked cross join target
             group by target.requires_user_page,target.requires_admin_page
            """,contractId);
    }

    private Map<String,Object> canonicalScreenBundle(Map<String,Object> identity){
        String raw=jdbc.queryForObject(
            "select framework_canonical_screen_bundle(?,?,?,?)::text",String.class,
            identity.get("processCode"),identity.get("stepCode"),identity.get("audience"),identity.get("routePath"));
        Map<String,Object> bundle=jsonMap(raw);
        if(!bundle.keySet().equals(Set.of("schema","catalogHash","designHash","canonicalText","canonicalDesign"))
                ||!"carbonet.canonical-design/v1".equals(bundle.get("schema")))
            throw new IllegalStateException("CANONICAL_BUNDLE_ENVELOPE_INVALID");
        String canonicalText=String.valueOf(bundle.getOrDefault("canonicalText",""));
        String designHash=canonicalHash(bundle,"designHash");
        Object rawCatalogHash=bundle.get("catalogHash");
        boolean catalogHashValid=rawCatalogHash==null
            ||rawCatalogHash instanceof String catalogHash
                &&(catalogHash.isBlank()||catalogHash.matches("[0-9a-f]{64}"));
        if(!designHash.matches("[0-9a-f]{64}")
                ||!catalogHashValid
                ||!designHash.equals(sha256Hex(canonicalText))
                ||!jsonMap(canonicalText).equals(canonicalObject(bundle.get("canonicalDesign"),"canonicalDesign")))
            throw new IllegalStateException("CANONICAL_BUNDLE_HASH_INVALID");
        Map<String,Object> canonicalDesign=canonicalObject(bundle.get("canonicalDesign"),"canonicalDesign");
        Map<String,Object> lanes=canonicalObject(canonicalDesign.get("lanes"),"canonicalDesign.lanes");
        if(!lanes.keySet().equals(Set.of("HELP","WORK_GUIDE","QA","DESIGN_CARD","FRONTEND","API","DATABASE"))
                ||!(lanes.get("HELP") instanceof Map<?,?>)||!(lanes.get("WORK_GUIDE") instanceof Map<?,?>)
                ||!(lanes.get("QA") instanceof Map<?,?>)||!(lanes.get("DESIGN_CARD") instanceof Map<?,?>)
                ||!(lanes.get("FRONTEND") instanceof Map<?,?>)||!(lanes.get("API") instanceof List<?>)
                ||!(lanes.get("DATABASE") instanceof List<?>))
            throw new IllegalStateException("CANONICAL_BUNDLE_LANES_INVALID");
        return bundle;
    }

    private static void requireCanonicalCompiledNote(Map<String,Object> bundle,Map<String,Object> compiled){
        Map<String,Object> design=canonicalObject(bundle.get("canonicalDesign"),"canonicalDesign");
        Map<String,Object> lanes=canonicalObject(design.get("lanes"),"canonicalDesign.lanes");
        Map<String,Object> help=canonicalObject(lanes.get("HELP"),"HELP");
        Map<String,Object> qa=canonicalObject(lanes.get("QA"),"QA");
        Map<String,Object> card=canonicalObject(lanes.get("DESIGN_CARD"),"DESIGN_CARD");
        Map<String,Object> specification=canonicalObject(card.get("specification"),"DESIGN_CARD.specification");
        Map<String,Object> extensions=canonicalObject(specification.get("extensions"),"DESIGN_CARD.specification.extensions");
        if(!jsonArrayContains(help.get("evidence"),compiled)
                ||!jsonArrayContains(qa.get("evidence"),compiled)
                ||!compiled.equals(extensions.get("designAutomation")))
            throw new IllegalStateException("CANONICAL_DESIGN_NOTE_NOT_PROPAGATED");
    }

    private static boolean jsonArrayContains(Object value,Map<String,Object> expected){
        if(!(value instanceof List<?> items))return false;
        return items.stream().anyMatch(expected::equals);
    }

    @SuppressWarnings("unchecked")
    private static Map<String,Object> canonicalObject(Object value,String field){
        if(!(value instanceof Map<?,?>))throw new IllegalStateException(field+" must be an object");
        return new LinkedHashMap<>((Map<String,Object>)value);
    }

    private static String canonicalHash(Map<String,Object> bundle,String field){
        Object value=bundle.get(field);return value==null?"":String.valueOf(value);
    }

    private static Map<String,Object> canonicalSupport(Map<String,Object> bundle){
        Map<String,Object> design=canonicalObject(bundle.get("canonicalDesign"),"canonicalDesign");
        Map<String,Object> lanes=canonicalObject(design.get("lanes"),"canonicalDesign.lanes");
        Map<String,Object> card=canonicalObject(lanes.get("DESIGN_CARD"),"DESIGN_CARD");
        Map<String,Object> support=new LinkedHashMap<>();
        support.put("schemaVersion","carbonet.executable-screen-support/v1");
        support.put("designHash",canonicalHash(bundle,"designHash"));
        support.put("catalogHash",bundle.get("catalogHash"));
        support.put("help",lanes.get("HELP"));support.put("workGuide",lanes.get("WORK_GUIDE"));
        support.put("qa",lanes.get("QA"));support.put("designCard",card);
        support.put("assetBindings",card.get("assetBindings"));support.put("lanes",lanes);
        return support;
    }

    private static Map<String,Object> hashTransition(Map<String,Object> before,Map<String,Object> after){
        Map<String,Object> transition=new LinkedHashMap<>();
        transition.put("beforeDesignHash",canonicalHash(before,"designHash"));
        transition.put("afterDesignHash",canonicalHash(after,"designHash"));
        transition.put("beforeCatalogHash",before.get("catalogHash"));
        transition.put("afterCatalogHash",after.get("catalogHash"));
        return transition;
    }

    private List<Map<String,Object>> designCodeOutputs(String route){
        return jdbc.queryForList(
            "select blueprint_id as \"blueprintId\",blueprint_code as \"blueprintCode\",process_code as \"processCode\",step_code as \"stepCode\",audience,page_id as \"pageId\",route_path as \"routePath\",screen_type as \"screenType\",template_code as \"templateCode\",specification_json as \"specificationJson\",traceability_json as \"traceabilityJson\",validation_status as \"validationStatus\",validation_message as \"validationMessage\" from framework_screen_blueprint where lower(split_part(route_path,'?',1))=lower(?) order by audience,blueprint_id",
            route);
    }

    @Transactional public Map<String,Object> saveProfessionalScreenContract(Map<String,Object>b,String actor){
        Map<String,Object> values=professionalScreenContractInput(b);
        long id=((Number)values.get("contractId")).longValue();
        Map<String,Object> readiness=professionalContractReadiness(id,values);
        Map<String,Object> gate=previewProfessionalScreenDesignGate(id,values);
        int updated=jdbc.update("update framework_professional_screen_contract set business_purpose=?,entry_condition=?,exit_condition=?,kpi_contract=?,section_contract=?,field_contract=?,command_contract=?,state_contract=?,api_contract=?,data_contract=?,evidence_contract=?,responsive_contract=?,accessibility_contract=?,security_contract=?,permission_codes=?::jsonb,api_verified=?,database_verified=?,authority_verified=?,responsive_verified=?,accessibility_verified=?,exception_states_verified=?,audit_evidence_ref=?,contract_status=?,updated_by=?,updated_at=current_timestamp where contract_id=?",
            values.get("businessPurpose"),values.get("entryCondition"),values.get("exitCondition"),
            values.get("kpiContract"),values.get("sectionContract"),values.get("fieldContract"),
            values.get("commandContract"),values.get("stateContract"),values.get("apiContract"),
            values.get("dataContract"),values.get("evidenceContract"),values.get("responsiveContract"),
            values.get("accessibilityContract"),values.get("securityContract"),values.get("permissionCodes"),values.get("apiVerified"),
            values.get("databaseVerified"),values.get("authorityVerified"),values.get("responsiveVerified"),
            values.get("accessibilityVerified"),values.get("exceptionStatesVerified"),values.get("auditEvidenceRef"),
            values.get("contractStatus"),actor,id);
        if(updated==0)throw new IllegalArgumentException("화면 완성 계약을 찾을 수 없습니다: "+id);
        if(((Number)readiness.get("readinessScore")).intValue()==100){jdbc.update("update framework_professional_screen_contract set contract_status='VERIFIED',updated_at=current_timestamp where contract_id=?",id);}
        Map<String,Object> blueprintDesign=updateProfessionalBlueprintDesign(id,b);
        String process=jdbc.queryForObject("select process_code from framework_professional_screen_contract where contract_id=?",String.class,id);
        generateProfessionalDesignGraph(process,actor);
        Map<String,Object> generationReadiness=structuredGenerationReadiness(id);
        boolean structuredApproved=Boolean.TRUE.equals(generationReadiness.get("generationEligible"));
        Map<String,Object> generation=new LinkedHashMap<>();
        if(structuredApproved){
            Map<String,Object> identity=canonicalGenerationIdentity(id);
            Map<String,Object> bundle=canonicalScreenBundle(identity);
            generation.putAll(executeDesignDirectDevelopment(Map.of(
                "processCode",process,"stepCode",String.valueOf(identity.get("stepCode")),
                "routePath",String.valueOf(identity.get("routePath")),
                "audience",String.valueOf(identity.get("audience")),
                "designHash",canonicalHash(bundle,"designHash")),actor));
        }else{
            generation.put("status","DESIGN_INCOMPLETE");generation.put("generationQueued",false);
            generation.put("jobCount",0);generation.put("endpointExpected",0);
            generation.put("designHash","");generation.put("sourceHash","");generation.put("publishCount",0);
        }
        Map<String,Object> runtimePublication=screenContractRuntimeService.publishProfessionalContract(id,actor);
        int blockerCount=((Number)generationReadiness.getOrDefault("blockerCount",1)).intValue();
        Map<String,Object> automation=new LinkedHashMap<>();
        automation.put("status",structuredApproved?generation.get("status"):"RUNTIME_DRAFT_APPLIED");
        automation.put("processCode",process);automation.put("buildRequired",false);
        automation.put("fullGenerationDeferred",!structuredApproved);
        automation.put("generationQueued",generation.get("generationQueued"));
        automation.put("jobCount",generation.get("jobCount"));
        automation.put("designHash",generation.get("designHash"));
        automation.put("sourceHash",generation.get("sourceHash"));
        automation.put("endpointExpected",generation.get("endpointExpected"));
        automation.put("blockerCount",blockerCount);
        jdbc.update("update framework_page_development_item i set design_status=case when g.design_gate_status='PASSED' then 'VERIFIED' else 'REVIEW_REQUIRED' end,blocker_reason=case when g.design_gate_status='PASSED' then null else array_to_string(g.design_gate_issues,', ') end,next_action=case when g.design_gate_status='PASSED' then 'Post-generation QA passed; publication validation may proceed.' else 'Resolve QA issues before publish or deploy: '||array_to_string(g.design_gate_issues,', ') end,updated_by=?,updated_at=current_timestamp from framework_page_design_assurance g join framework_screen_resource r using(screen_resource_id) join framework_professional_screen_contract c on lower(split_part(c.route_path,'?',1))=r.route_key where c.contract_id=? and i.screen_resource_id=g.screen_resource_id",actor,id);
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("success",true);result.put("contract",readiness);result.put("designGate",gate);
        result.put("blueprintDesign",blueprintDesign);
        result.put("generationReadiness",generationReadiness);
        result.put("autoImplementation",automation);result.put("runtimePublication",runtimePublication);
        result.put("generationQueued",generation.get("generationQueued"));
        result.put("jobCount",generation.get("jobCount"));result.put("designHash",generation.get("designHash"));
        result.put("sourceHash",generation.get("sourceHash"));
        result.put("endpointExpected",generation.get("endpointExpected"));result.put("blockerCount",blockerCount);
        result.put("publishCount",generation.get("publishCount"));result.put("status",automation.get("status"));
        return result;
    }

    /**
     * Validates the exact canonical save input and predicts readiness, design
     * gate, and runtime publication without executing the production mutation
     * path.  The read-only transaction is a second guard against accidental
     * INSERT, UPDATE, DELETE, or sequence allocation in candidate validation.
     */
    @Transactional(readOnly=true) public Map<String,Object> saveProfessionalScreenContractPreview(Map<String,Object>b,String actor){
        Map<String,Object> values=professionalScreenContractInput(b);
        long id=((Number)values.get("contractId")).longValue();
        Map<String,Object> readiness=professionalContractReadiness(id,values);
        Map<String,Object> gate=previewProfessionalScreenDesignGate(id,values);
        Map<String,Object> runtimeValues=new LinkedHashMap<>(values);
        runtimeValues.remove("contractId");
        runtimeValues.remove("kpiContract");
        if(((Number)readiness.get("readinessScore")).intValue()==100)runtimeValues.put("contractStatus","VERIFIED");
        Map<String,Object> runtimePublication=screenContractRuntimeService.predictProfessionalContract(id,runtimeValues);
        String process=jdbc.queryForObject("select process_code from framework_professional_screen_contract where contract_id=?",String.class,id);
        Map<String,Object> automation=Map.of(
            "status","RUNTIME_CONTRACT_PREDICTED",
            "processCode",process,
            "buildRequired",false,
            "fullGenerationDeferred",true,
            "fullGenerationEndpoint","/admin/api/system/actor-process/development/direct"
        );
        Map<String,Object> response=new LinkedHashMap<>();
        response.put("success",true);
        response.put("contract",readiness);
        response.put("designGate",gate);
        response.put("autoImplementation",automation);
        response.put("runtimePublication",runtimePublication);
        response.put("preview",true);
        response.put("rolledBack",true);
        response.put("committed",false);
        response.put("mutationScope","READ_ONLY_PREDICTION");
        response.put("rollbackMode","NO_MUTATION_REQUIRED");
        return response;
    }

    Map<String,Object> professionalScreenContractInput(Map<String,Object>b){
        Map<String,Object> values=new LinkedHashMap<>();
        long id;
        try{id=Long.parseLong(req(b,"contractId"));}
        catch(NumberFormatException e){throw new IllegalArgumentException("contractId must be a number",e);}
        values.put("contractId",id);
        values.put("businessPurpose",req(b,"businessPurpose"));
        values.put("entryCondition",req(b,"entryCondition"));
        values.put("exitCondition",req(b,"exitCondition"));
        Map<String,String> arrays=new LinkedHashMap<>();
        arrays.put("kpiContract",def(b,"kpiContract","[]"));
        arrays.put("sectionContract",def(b,"sectionContract","[]"));
        arrays.put("fieldContract",def(b,"fieldContract","[]"));
        arrays.put("commandContract",def(b,"commandContract","[]"));
        arrays.put("stateContract",def(b,"stateContract","[\"LOADING\",\"EMPTY\",\"ERROR\",\"FORBIDDEN\",\"READY\"]"));
        arrays.put("apiContract",def(b,"apiContract","[]"));
        arrays.put("dataContract",def(b,"dataContract","[]"));
        arrays.put("evidenceContract",def(b,"evidenceContract","[]"));
        arrays.forEach((field,value)->{validateJsonArray(value,field);values.put(field,value);});
        values.put("permissionCodes",normalizePermissionCodes(def(b,"permissionCodes","[]")));
        values.put("responsiveContract",def(b,"responsiveContract","360px, 768px, 1280px 검증"));
        values.put("accessibilityContract",def(b,"accessibilityContract","KRDS 및 WCAG 2.1 AA"));
        values.put("securityContract",def(b,"securityContract","테넌트·프로젝트·액터 권한 서버 검증"));
        values.put("apiVerified",bool(b,"apiVerified"));
        values.put("databaseVerified",bool(b,"databaseVerified"));
        values.put("authorityVerified",bool(b,"authorityVerified"));
        values.put("responsiveVerified",bool(b,"responsiveVerified"));
        values.put("accessibilityVerified",bool(b,"accessibilityVerified"));
        values.put("exceptionStatesVerified",bool(b,"exceptionStatesVerified"));
        values.put("auditEvidenceRef",str(b,"auditEvidenceRef"));
        String status=def(b,"contractStatus","REVIEW_REQUIRED").toUpperCase(Locale.ROOT);
        if(!isSupportedProfessionalContractStatus(status))throw new IllegalArgumentException("Unsupported contractStatus: "+status);
        values.put("contractStatus",status);
        return values;
    }

    Map<String,Object> professionalContractReadiness(long id,Map<String,Object> values){
        List<Map<String,Object>> source=jdbc.queryForList(
            "select menu_verified as \"menuVerified\" from framework_professional_screen_contract where contract_id=?",id);
        if(source.isEmpty())throw new IllegalArgumentException("화면 완성 계약을 찾을 수 없습니다: "+id);
        boolean menuVerified=flag(source.get(0).get("menuVerified"));
        int score=0;
        if(text(values,"businessPurpose").length()>=20)score+=5;
        if(text(values,"entryCondition").length()>=10&&text(values,"exitCondition").length()>=20)score+=5;
        if(!"[]".equals(text(values,"kpiContract")))score+=5;
        if(!"[]".equals(text(values,"sectionContract"))&&!"[]".equals(text(values,"fieldContract")))score+=10;
        if(!"[]".equals(text(values,"commandContract")))score+=5;
        String states=text(values,"stateContract");
        if(states.contains("LOADING")&&states.contains("EMPTY")&&states.contains("ERROR")&&states.contains("FORBIDDEN"))score+=10;
        if(!"[]".equals(text(values,"apiContract"))&&!"[]".equals(text(values,"dataContract")))score+=5;
        if(!"[]".equals(text(values,"evidenceContract")))score+=5;
        if(menuVerified)score+=5;
        if(flag(values.get("apiVerified")))score+=10;
        if(flag(values.get("databaseVerified")))score+=5;
        if(flag(values.get("authorityVerified")))score+=10;
        if(flag(values.get("responsiveVerified")))score+=5;
        if(flag(values.get("accessibilityVerified")))score+=5;
        if(flag(values.get("exceptionStatesVerified")))score+=5;
        if(!text(values,"auditEvidenceRef").isEmpty())score+=5;
        List<String> gaps=new ArrayList<>();
        if(!menuVerified)gaps.add("DB 메뉴·화면·권한 연결");
        if("[]".equals(text(values,"apiContract"))||!flag(values.get("apiVerified")))gaps.add("실 API 검증");
        if("[]".equals(text(values,"dataContract"))||!flag(values.get("databaseVerified")))gaps.add("DB 영속성 검증");
        if(!flag(values.get("authorityVerified")))gaps.add("액터·테넌트 권한 검증");
        if(!flag(values.get("responsiveVerified")))gaps.add("반응형 검증");
        if(!flag(values.get("accessibilityVerified")))gaps.add("접근성 검증");
        if(!flag(values.get("exceptionStatesVerified")))gaps.add("로딩·빈값·오류·권한없음 상태 검증");
        if(text(values,"auditEvidenceRef").isEmpty())gaps.add("브라우저 E2E 증적");
        Map<String,Object> readiness=new LinkedHashMap<>();
        readiness.put("contractId",id);readiness.put("readinessScore",score);
        readiness.put("readinessGaps",String.join(", ",gaps));
        return readiness;
    }

    Map<String,Object> previewProfessionalScreenDesignGate(long id,Map<String,Object> values){
        Map<String,Object> context=jdbc.queryForMap("""
            select lower(split_part(c.route_path,'?',1)) as "routePath",
                   g.actor_passed as "actorPassed",g.process_passed as "processPassed",
                   g.lineage_passed as "lineagePassed",g.transition_passed as "transitionPassed",
                   g.admin_counterpart_passed as "adminCounterpartPassed",g.test_passed as "testPassed",
                   (select count(*) from framework_process_step_screen_binding binding
                     where binding.screen_resource_id=r.screen_resource_id and binding.binding_status='ACTIVE') as "bindingCount"
              from framework_professional_screen_contract c
              join framework_screen_resource r on lower(split_part(c.route_path,'?',1))=r.route_key
              join framework_page_design_assurance g using(screen_resource_id)
             where c.contract_id=?
            """,id);
        List<Map<String,Object>> contracts=jdbc.queryForList("""
            select contract_id as "contractId",business_purpose as "businessPurpose",
                   entry_condition as "entryCondition",exit_condition as "exitCondition",
                   section_contract as "sectionContract",field_contract as "fieldContract",
                   command_contract as "commandContract",state_contract as "stateContract",
                   data_contract as "dataContract",evidence_contract as "evidenceContract",
                   authority_verified as "authorityVerified",exception_states_verified as "exceptionStatesVerified",
                   audit_evidence_ref as "auditEvidenceRef"
              from framework_professional_screen_contract
             where lower(split_part(route_path,'?',1))=?
             order by contract_id
            """,context.get("routePath"));
        List<Map<String,Object>> proposedContracts=new ArrayList<>();
        for(Map<String,Object> contract:contracts){
            Map<String,Object> proposed=new LinkedHashMap<>(contract);
            if(((Number)contract.get("contractId")).longValue()==id)proposed.putAll(values);
            proposedContracts.add(proposed);
        }
        int bindingCount=((Number)context.getOrDefault("bindingCount",0)).intValue();
        long semanticCount=proposedContracts.stream().filter(contract->
            text(contract,"businessPurpose").length()>=20&&text(contract,"entryCondition").length()>=10
            &&text(contract,"exitCondition").length()>=10&&!"[]".equals(text(contract,"sectionContract"))
            &&!"[]".equals(text(contract,"fieldContract"))&&!"[]".equals(text(contract,"commandContract"))).count();
        boolean contractPassed=proposedContracts.size()>=bindingCount&&semanticCount>=bindingCount;
        boolean authorityPassed=!proposedContracts.isEmpty()&&proposedContracts.stream().allMatch(contract->flag(contract.get("authorityVerified")));
        boolean versionPassed=!proposedContracts.isEmpty()&&proposedContracts.stream().allMatch(contract->
            !text(contract,"auditEvidenceRef").isEmpty()&&(text(contract,"dataContract").toLowerCase(Locale.ROOT).contains("version")
                ||text(contract,"evidenceContract").toLowerCase(Locale.ROOT).contains("version")));
        boolean exceptionPassed=!proposedContracts.isEmpty()&&proposedContracts.stream().allMatch(contract->
            flag(contract.get("exceptionStatesVerified"))&&text(contract,"stateContract").contains("ERROR")
                &&text(contract,"stateContract").contains("FORBIDDEN"));
        LinkedHashMap<String,Boolean> checks=new LinkedHashMap<>();
        checks.put("ACTOR_BINDING_MISSING",flag(context.get("actorPassed")));
        checks.put("PROCESS_STEP_MISSING",flag(context.get("processPassed")));
        checks.put("PROFESSIONAL_CONTRACT_INCOMPLETE",contractPassed);
        checks.put("INPUT_OUTPUT_LINEAGE_INCOMPLETE",flag(context.get("lineagePassed")));
        checks.put("STATE_TRANSITION_INCOMPLETE",flag(context.get("transitionPassed")));
        checks.put("AUTHORITY_NOT_VERIFIED",authorityPassed);
        checks.put("VERSION_AUDIT_CONTRACT_MISSING",versionPassed);
        checks.put("EXCEPTION_RECOVERY_NOT_VERIFIED",exceptionPassed);
        checks.put("ADMIN_COUNTERPART_MISSING",flag(context.get("adminCounterpartPassed")));
        checks.put("INDEPENDENT_TEST_COVERAGE_INCOMPLETE",flag(context.get("testPassed")));
        int score=(int)checks.values().stream().filter(Boolean::booleanValue).count()*10;
        String issues=String.join(", ",checks.entrySet().stream().filter(entry->!entry.getValue()).map(Map.Entry::getKey).toList());
        return Map.of("status",score==100?"PASSED":"FAILED","score",score,"issues",issues);
    }

    private static boolean flag(Object value){
        return value instanceof Boolean result?result:Boolean.parseBoolean(String.valueOf(value));
    }

    private static String text(Map<String,Object> values,String key){
        Object value=values.get(key);return value==null?"":String.valueOf(value).trim();
    }

    static boolean isSupportedProfessionalContractStatus(String status) {
        return status != null && PROFESSIONAL_CONTRACT_STATUSES.contains(status.trim().toUpperCase(Locale.ROOT));
    }

    @Transactional public Map<String,Object> executeProfessionalFactory(Map<String,Object>b,String user) throws Exception {
        String process=req(b,"processCode"), requestedActor=req(b,"actorCode");
        Integer actorSteps=jdbc.queryForObject("select count(*) from framework_process_step where process_code=? and actor_code=?",Integer.class,process,requestedActor);
        if(actorSteps==null||actorSteps==0)throw new IllegalArgumentException("선택한 액터가 이 프로세스에 참여하지 않습니다: "+requestedActor+" / "+process);
        Integer policyCount=jdbc.queryForObject("select count(*) from framework_process_menu_policy where process_code=?",Integer.class,process);
        if(policyCount==null||policyCount<2)throw new IllegalStateException("사용자·관리자 메뉴 정책이 모두 필요합니다: "+process);

        UUID runId=UUID.randomUUID();
        jdbc.update("insert into framework_professional_factory_run(run_id,process_code,requested_actor_code,requested_by) values(?,?,?,?)",runId,process,requestedActor,user);
        ensureProfessionalContracts(process,user);
        int menus=provisionProcessMenus(process,user);
        Map<String,Object> assembly=assembleScreenAssets(process,user);
        Map<String,Object> bootstrap=bootstrapProcessDevelopment(Map.of("processCode",process,"approveJobs",true,"queueScreens",true),user);
        int screens=jdbc.queryForObject("select count(*) from framework_professional_screen_contract where process_code=?",Integer.class,process);
        int scenarios=jdbc.queryForObject("select count(*) from framework_simulation_case where process_code=?",Integer.class,process);
        int jobs=jdbc.queryForObject("select count(*) from framework_development_job where process_code=?",Integer.class,process);
        int blocked=((Number)bootstrap.getOrDefault("blockedStepCount",0)).intValue();
        String status=blocked==0?"READY_TO_EXECUTE":"QUALITY_GATES_BLOCKED";
        String result="{\"factoryStatus\":\""+status+"\",\"menus\":"+menus+",\"screens\":"+screens+",\"scenarios\":"+scenarios+",\"jobs\":"+jobs+",\"blockedSteps\":"+blocked+"}";
        jdbc.update("update framework_professional_factory_run set run_status=?,menu_count=?,screen_count=?,scenario_count=?,development_job_count=?,blocked_step_count=?,result_json=?,completed_at=current_timestamp where run_id=?",status,menus,screens,scenarios,jobs,blocked,result,runId);
        Map<String,Object> out=new LinkedHashMap<>();
        out.put("success",true);out.put("runId",runId);out.put("processCode",process);out.put("actorCode",requestedActor);
        out.put("status",status);out.put("menuCount",menus);out.put("screenCount",screens);out.put("scenarioCount",scenarios);
        out.put("developmentJobCount",jobs);out.put("blockedStepCount",blocked);out.put("bootstrap",bootstrap);
        out.put("assetAssembly",assembly);
        out.put("nextAction",blocked==0?"승인된 개발 작업과 E2E 테스트를 실행합니다.":"차단된 화면 계약과 시안을 보완한 뒤 같은 요청을 재실행합니다.");
        return out;
    }

    @Transactional public Map<String,Object> assembleScreenAssets(String process,String user){
        List<Map<String,Object>> contracts=jdbc.queryForList("select contract_id,route_path,api_contract,data_contract from framework_professional_screen_contract where process_code=? order by contract_id",process);
        int ready=0,gaps=0;
        for(Map<String,Object> contract:contracts){
            long id=((Number)contract.get("contract_id")).longValue();String route=String.valueOf(contract.get("route_path"));
            boolean theme=Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from comtnthemedefinition where theme_id='KRDS_GOV_DEFAULT' and use_at='Y')",Boolean.class));
            boolean sections=Boolean.TRUE.equals(jdbc.queryForObject("select count(*)>=5 from ui_section_registry where active_yn='Y' and section_id in ('PAGE_HEADER','SUMMARY_METRICS','SEARCH_FILTER','WORK_TABLE','DETAIL_WORKSPACE')",Boolean.class));
            boolean components=Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from ui_component_registry where active_yn='Y')",Boolean.class));
            boolean design=Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from framework_screen_html_mockup where route_key=lower(?) and selected=true)",Boolean.class,route));
            boolean frontend=Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from framework_screen_blueprint where lower(split_part(route_path,'?',1))=lower(?) and validation_status='VALID')",Boolean.class,route));
            boolean api=!"[]".equals(String.valueOf(contract.get("api_contract")));
            boolean database=!"[]".equals(String.valueOf(contract.get("data_contract")));
            boolean tests=Boolean.TRUE.equals(jdbc.queryForObject("select count(distinct case_type)>=5 from framework_simulation_case where process_code=?",Boolean.class,process));
            String[][] assets={{"THEME","KRDS_GOV_DEFAULT","/admin/system/theme-management",theme?"REUSED":"MISSING"},{"SECTION","PAGE_HEADER,SUMMARY_METRICS,SEARCH_FILTER,WORK_TABLE,DETAIL_WORKSPACE","/admin/system/section-management",sections?"REUSED":"MISSING"},{"COMPONENT","ui_component_registry","/admin/system/component-management",components?"REUSED":"MISSING"},{"DESIGN",route+"#selected-mockup","/admin/system/design-management",design?"LINKED":"MISSING"},{"FRONTEND",route,"/admin/system/screen-management",frontend?"LINKED":"REPAIR_REQUIRED"},{"API",String.valueOf(contract.get("api_contract")),"/admin/system/api-management",api?"LINKED":"MISSING"},{"BACKEND",process+":"+route,"/admin/system/controller-management",api?"LINKED":"MISSING"},{"DATABASE",String.valueOf(contract.get("data_contract")),"/admin/system/db-table-management",database?"LINKED":"MISSING"},{"TEST",process+":5-safety-scenarios","/admin/system/verification-asset-management",tests?"LINKED":"MISSING"}};
            for(String[] asset:assets){jdbc.update("insert into framework_screen_asset_assembly(contract_id,asset_layer,asset_ref,management_route,decision,evidence_ref,protected,updated_by) values(?,?,?,?,?,?,?,?) on conflict(contract_id,asset_layer) do update set asset_ref=excluded.asset_ref,management_route=excluded.management_route,decision=excluded.decision,evidence_ref=excluded.evidence_ref,protected=excluded.protected,updated_by=excluded.updated_by,updated_at=current_timestamp",id,asset[0],asset[1],asset[2],asset[3],"factory:"+process+":"+route,"REUSED".equals(asset[3])||"LINKED".equals(asset[3]),user);if("MISSING".equals(asset[3])||"REPAIR_REQUIRED".equals(asset[3]))gaps++;else ready++;}
        }
        return Map.of("success",true,"processCode",process,"screenCount",contracts.size(),"readyAssets",ready,"gapAssets",gaps,"totalAssets",ready+gaps);
    }

    @Transactional public Map<String,Object> recordProfessionalEvidence(Map<String,Object>b,String user){
        String process=req(b,"processCode"),step=req(b,"stepCode"),route=ScreenDevelopmentNoteService.cleanRoute(req(b,"routePath")),evidence=req(b,"evidenceRef");
        int updated=jdbc.update("update framework_professional_screen_contract set api_verified=?,database_verified=?,authority_verified=?,responsive_verified=?,accessibility_verified=?,exception_states_verified=?,audit_evidence_ref=?,updated_by=?,updated_at=current_timestamp where process_code=? and step_code=? and lower(split_part(route_path,'?',1))=lower(?)",
            bool(b,"apiVerified"),bool(b,"databaseVerified"),bool(b,"authorityVerified"),bool(b,"responsiveVerified"),bool(b,"accessibilityVerified"),bool(b,"exceptionStatesVerified"),evidence,user,process,step,route);
        if(updated==0)throw new IllegalArgumentException("검증 증적을 연결할 화면 계약이 없습니다: "+route);
        List<Map<String,Object>> rows=jdbc.queryForList("select contract_id as \"contractId\",route_path as \"routePath\",readiness_score as \"readinessScore\",readiness_gaps as \"readinessGaps\" from framework_professional_screen_readiness where process_code=? and step_code=? and lower(split_part(route_path,'?',1))=lower(?)",process,step,route);
        for(Map<String,Object> row:rows)if(((Number)row.get("readinessScore")).intValue()==100)jdbc.update("update framework_professional_screen_contract set contract_status='VERIFIED',updated_at=current_timestamp where contract_id=?",row.get("contractId"));
        return Map.of("success",true,"updated",updated,"contracts",rows);
    }

    private void ensureProfessionalContracts(String process,String user){
        if(isRequirementAutomationActor(user)){
            reconcileRequirementOwnedProfessionalContracts(process,user);
            return;
        }
        jdbc.update("insert into framework_professional_screen_contract(process_code,step_code,audience,route_path,screen_name,actor_code,business_purpose,entry_condition,exit_condition,kpi_contract,section_contract,field_contract,command_contract,api_contract,data_contract,evidence_contract,updated_by) select s.process_code,s.step_code,x.audience,x.route_path,s.step_name||case x.audience when 'ADMIN' then ' 관리자 업무 화면' else ' 사용자 업무 화면' end,s.actor_code,coalesce(nullif(s.requirement_text,''),s.step_name||' 업무를 완료한다.'),s.from_state||' 상태이며 해당 액터가 프로젝트에 배정되어 있다.',coalesce(nullif(s.completion_rule,''),s.to_state||' 상태로 전이된다.'),'[\"진행률\",\"마감·지연\",\"차단 오류\",\"담당자\"]','[\"업무 문맥·진행 상태\",\"검색·필터\",\"핵심 데이터 작업공간\",\"증적·이력\",\"다음 업무\"]','[\"업무 식별자\",\"상태\",\"담당자\",\"버전\",\"변경 일시\"]',json_build_array(s.command_code,'임시저장','증적첨부','다음 업무 이동')::text,coalesce(nullif(s.api_contract,''),'[\"업무 조회\",\"검증\",\"저장·명령\",\"이력 조회\"]'),'[\"tenantId\",\"projectId\",\"processCode\",\"stepCode\",\"actorCode\",\"version\",\"audit fields\"]','[\"요청·응답 증적\",\"상태 전이\",\"권한 판정\",\"감사 이벤트\",\"화면 E2E\"]',? from framework_process_step s cross join lateral(values('USER',nullif(s.user_path,'')),('ADMIN',nullif(s.admin_path,''))) x(audience,route_path) where s.process_code=? and x.route_path is not null on conflict(process_code,step_code,audience,route_path) do update set actor_code=excluded.actor_code,business_purpose=excluded.business_purpose,entry_condition=excluded.entry_condition,exit_condition=excluded.exit_condition,updated_by=excluded.updated_by,updated_at=current_timestamp",user,process);
    }

    private static boolean isRequirementAutomationActor(String actor){
        return "BACKSTAGE_REQUIREMENT_AUTOMATION".equals(actor)
            ||"REQUIREMENT_SELF_HEALER".equals(actor);
    }

    /** Reconciles only rows that were created by the requirement automation. */
    private void reconcileRequirementOwnedProfessionalContracts(String process,String actor){
        Integer manualConflicts=jdbc.queryForObject("""
            select count(*)
              from framework_professional_screen_contract contract
              left join framework_process_step step
                on step.process_code=contract.process_code
               and step.step_code=contract.step_code
             where contract.process_code=?
               and contract.updated_by not in(
                 'BACKSTAGE_REQUIREMENT_AUTOMATION','REQUIREMENT_SELF_HEALER')
               and (step.step_code is null
                 or upper(contract.audience) not in('USER','ADMIN')
                 or (upper(contract.audience)='USER' and (
                   not step.requires_user_page
                   or lower(split_part(contract.route_path,'?',1))<>
                      lower(split_part(coalesce(step.user_path,''),'?',1))))
                 or (upper(contract.audience)='ADMIN' and (
                   not step.requires_admin_page
                   or lower(split_part(contract.route_path,'?',1))<>
                      lower(split_part(coalesce(step.admin_path,''),'?',1))))
                 or contract.actor_code<>step.actor_code)
            """,Integer.class,process);
        if(manualConflicts==null||manualConflicts>0)throw new IllegalStateException(
            "MANUAL_SCREEN_IDENTITY_REVISION_REQUIRED: "+process+" / "+manualConflicts);
        jdbc.update("""
            delete from framework_professional_screen_contract contract
             where contract.process_code=?
               and contract.updated_by in(
                 'BACKSTAGE_REQUIREMENT_AUTOMATION','REQUIREMENT_SELF_HEALER')
               and not exists(
                 select 1 from framework_process_step step
                  where step.process_code=contract.process_code
                    and step.step_code=contract.step_code
                    and ((upper(contract.audience)='USER' and step.requires_user_page
                      and lower(split_part(contract.route_path,'?',1))=
                          lower(split_part(step.user_path,'?',1)))
                     or (upper(contract.audience)='ADMIN' and step.requires_admin_page
                      and lower(split_part(contract.route_path,'?',1))=
                          lower(split_part(step.admin_path,'?',1)))))
            """,process);
        jdbc.update("""
            insert into framework_professional_screen_contract(
              process_code,step_code,audience,route_path,screen_name,actor_code,
              business_purpose,entry_condition,exit_condition,kpi_contract,
              section_contract,field_contract,command_contract,state_contract,
              api_contract,data_contract,evidence_contract,updated_by)
            select step.process_code,step.step_code,lane.audience,lane.route_path,
              step.step_name||case lane.audience when 'ADMIN'
                then ' 관리자 업무 화면' else ' 사용자 업무 화면' end,
              step.actor_code,coalesce(nullif(step.requirement_text,''),step.step_name),
              step.from_state||' 상태이며 해당 액터가 프로젝트에 배정되어 있다.',
              coalesce(nullif(step.completion_rule,''),step.to_state||' 상태 전이'),
              '[\"진행률\",\"마감·지연\",\"차단 오류\",\"담당자\"]',
              '[\"업무 문맥·진행 상태\",\"입력 및 검증\",\"증적·이력\",\"다음 업무\"]',
              '[\"업무 식별자\",\"상태\",\"담당자\",\"버전\",\"변경 일시\"]',
              framework_merge_primary_contract_marker(
                '[]'::jsonb,'PRIMARY_STEP_COMMAND',jsonb_build_object(
                  'commandCode',step.command_code,'actorCode',step.actor_code,
                  'entryState',step.from_state,'resultState',step.to_state,
                  'serverAuthorization',true,'validationRequired',true,
                  'auditRequired',true))::text,
              '[\"LOADING\",\"EMPTY\",\"ERROR\",\"FORBIDDEN\",\"READY\"]',
              framework_merge_primary_contract_marker(
                '[]'::jsonb,'PRIMARY_STEP_API',case when step.requires_api
                  then jsonb_build_object('declaredContract',coalesce(
                    framework_try_jsonb(step.api_contract),to_jsonb(step.api_contract)),
                    'actorCode',step.actor_code,'commandCode',step.command_code,
                    'transactional',true,'tenantGuard',true,'projectGuard',true,
                    'actorGuard',true,'idempotencyKey',true,'rowVersion',true) end)::text,
              jsonb_build_array(jsonb_build_object('input',
                framework_try_jsonb(step.input_contract),'output',
                framework_try_jsonb(step.output_contract)))::text,
              '[\"REQUEST\",\"RESPONSE\",\"DB_REREAD\",\"AUTHORITY\",\"ROLLBACK\"]',?
              from framework_process_step step
              cross join lateral(values
                ('USER'::text,case when step.requires_user_page then step.user_path end),
                ('ADMIN'::text,case when step.requires_admin_page then step.admin_path end)
              ) lane(audience,route_path)
             where step.process_code=? and nullif(btrim(lane.route_path),'') is not null
            on conflict(process_code,step_code,audience,route_path) do update set
              actor_code=case when framework_professional_screen_contract.updated_by in(
                'BACKSTAGE_REQUIREMENT_AUTOMATION','REQUIREMENT_SELF_HEALER')
                then excluded.actor_code else framework_professional_screen_contract.actor_code end,
              command_contract=case when framework_professional_screen_contract.updated_by in(
                'BACKSTAGE_REQUIREMENT_AUTOMATION','REQUIREMENT_SELF_HEALER')
                then framework_merge_primary_contract_marker(
                  framework_try_jsonb(framework_professional_screen_contract.command_contract),
                  'PRIMARY_STEP_COMMAND',excluded.command_contract::jsonb->0)::text
                else framework_professional_screen_contract.command_contract end,
              api_contract=case when framework_professional_screen_contract.updated_by in(
                'BACKSTAGE_REQUIREMENT_AUTOMATION','REQUIREMENT_SELF_HEALER')
                then framework_merge_primary_contract_marker(
                  framework_try_jsonb(framework_professional_screen_contract.api_contract),
                  'PRIMARY_STEP_API',excluded.api_contract::jsonb->0)::text
                else framework_professional_screen_contract.api_contract end,
              updated_by=case when framework_professional_screen_contract.updated_by in(
                'BACKSTAGE_REQUIREMENT_AUTOMATION','REQUIREMENT_SELF_HEALER')
                then excluded.updated_by else framework_professional_screen_contract.updated_by end,
              updated_at=current_timestamp
            """,actor,process);
        Integer exact=jdbc.queryForObject("""
            select count(*) from framework_process_step step
             where step.process_code=? and (
               (step.requires_user_page and not exists(
                 select 1 from framework_professional_screen_contract contract
                  where contract.process_code=step.process_code
                    and contract.step_code=step.step_code and contract.audience='USER'
                    and contract.actor_code=step.actor_code
                    and lower(split_part(contract.route_path,'?',1))=
                        lower(split_part(step.user_path,'?',1))))
               or (step.requires_admin_page and not exists(
                 select 1 from framework_professional_screen_contract contract
                  where contract.process_code=step.process_code
                    and contract.step_code=step.step_code and contract.audience='ADMIN'
                    and contract.actor_code=step.actor_code
                    and lower(split_part(contract.route_path,'?',1))=
                        lower(split_part(step.admin_path,'?',1)))))
            """,Integer.class,process);
        if(exact==null||exact>0)throw new IllegalStateException(
            "REQUIREMENT_SCREEN_IDENTITY_NOT_EXACT: "+process+" / "+exact);
    }

    private int provisionProcessMenus(String process,String user) throws Exception {
        List<Map<String,Object>> contracts=jdbc.queryForList("select c.contract_id,c.audience,c.route_path,c.screen_name,c.menu_visibility,p.domain_code,p.domain_name,p.domain_name_en,p.group_code,p.group_name,p.group_name_en,p.icon_name from framework_professional_screen_contract c join framework_process_menu_policy p on p.process_code=c.process_code and p.audience=c.audience where c.process_code=? order by c.audience,c.step_code,c.contract_id",process);
        int verified=0;
        for(Map<String,Object> contract:contracts){
            long contractId=((Number)contract.get("contract_id")).longValue();String route=String.valueOf(contract.get("route_path"));
            List<Map<String,Object>> existing=jdbc.queryForList("select menu_code from comtnmenuinfo where length(menu_code)=8 and lower(split_part(menu_url,'?',1))=lower(split_part(?,'?',1)) order by case when use_at='Y' then 0 else 1 end,menu_code limit 1",route);
            String menuCode;boolean created=existing.isEmpty();
            if(existing.isEmpty()){
                String group=String.valueOf(contract.get("group_code"));
                jdbc.queryForList("select pg_advisory_xact_lock(hashtext(?))","professional-menu:"+group);
                menuCode=jdbc.queryForObject("select ?||lpad(n::text,2,'0') from generate_series(1,99) n where not exists(select 1 from comtnmenuinfo where menu_code=?||lpad(n::text,2,'0')) order by n limit 1",String.class,group,group);
                if(menuCode==null)throw new IllegalStateException("메뉴 코드 공간이 부족합니다: "+group);
                CodexProvisionRequest request=professionalMenuRequest(contract,menuCode,route,user);
                CodexProvisionResponse response=codexProvisioningService.provision(request);
                if(!"success".equalsIgnoreCase(response.getStatus()))throw new IllegalStateException("메뉴 등록 실패: "+route);
            }else menuCode=String.valueOf(existing.get(0).get("menu_code"));
            boolean visible="VISIBLE".equals(String.valueOf(contract.get("menu_visibility")));
            if(created||visible)jdbc.update("update comtnmenuinfo set use_at='Y',expsr_at=?,last_updt_pnttm=current_timestamp where menu_code=?",visible?"Y":"N",menuCode);
            jdbc.update("update framework_professional_screen_contract set menu_code=?,menu_verified=true,updated_by=?,updated_at=current_timestamp where contract_id=?",menuCode,user,contractId);
            verified++;
        }
        return verified;
    }

    private CodexProvisionRequest professionalMenuRequest(Map<String,Object> row,String menuCode,String route,String user){
        CodexProvisionRequest.PageRequest page=new CodexProvisionRequest.PageRequest();
        page.setDomainCode(String.valueOf(row.get("domain_code")));page.setDomainName(String.valueOf(row.get("domain_name")));page.setDomainNameEn(String.valueOf(row.get("domain_name_en")));
        page.setGroupCode(String.valueOf(row.get("group_code")));page.setGroupName(String.valueOf(row.get("group_name")));page.setGroupNameEn(String.valueOf(row.get("group_name_en")));
        page.setCode(menuCode);page.setCodeNm(String.valueOf(row.get("screen_name")));page.setCodeDc(String.valueOf(row.get("screen_name")));page.setMenuUrl(route);page.setMenuIcon(String.valueOf(row.get("icon_name")));page.setUseAt("Y");
        CodexProvisionRequest.FeatureRequest feature=new CodexProvisionRequest.FeatureRequest();feature.setMenuCode(menuCode);feature.setFeatureCode(menuCode+"_VIEW");feature.setFeatureNm(page.getCodeNm()+" 조회");feature.setFeatureNmEn("View "+page.getCodeDc());feature.setFeatureDc("Actor-process governed screen access");feature.setUseAt("Y");
        CodexProvisionRequest.AuthorRequest author=new CodexProvisionRequest.AuthorRequest();String admin="ADMIN".equals(String.valueOf(row.get("audience")))?"ROLE_SYSTEM_ADMIN":"ROLE_USER";author.setAuthorCode(admin);author.setAuthorNm(admin);author.setAuthorDc("Professional factory default access");author.setFeatureCodes(List.of(feature.getFeatureCode()));
        CodexProvisionRequest request=new CodexProvisionRequest();request.setRequestId("PROFESSIONAL-FACTORY-"+menuCode);request.setActorId(user);request.setTargetApiPath(route);request.setMenuType("USER".equals(String.valueOf(row.get("audience")))?"USER":"ADMIN");request.setReloadSecurityMetadata(true);request.setPage(page);request.setFeatures(List.of(feature));request.setAuthors(List.of(author));return request;
    }

    public Map<String,Object> designAssetInventory(){
        Map<String,Object> out=new LinkedHashMap<>();
        out.put("counts",jdbc.queryForMap("select (select count(*) from comtnthemedefinition where use_at='Y') as \"themes\",(select count(*) from comtnthemeclassset where use_at='Y') as \"classSets\",(select count(*) from ui_section_registry where active_yn='Y') as \"sections\",(select count(*) from ui_component_registry where active_yn='Y') as \"components\",(select count(*) from ui_page_manifest where active_yn='Y') as \"pages\",(select count(*) from ui_page_component_map) as \"mappings\""));
        out.put("themes",jdbc.queryForList("select theme_id as \"themeId\",theme_nm as \"themeName\",theme_type as \"themeType\",is_default as \"isDefault\",is_active as \"isActive\" from comtnthemedefinition where use_at='Y' order by sort_order,theme_id"));
        out.put("classSets",jdbc.queryForList("select class_set_id as \"classSetId\",theme_id as \"themeId\",class_set_nm as \"classSetName\",target_component as \"targetComponent\",base_classes as \"baseClasses\",responsive_classes as \"responsiveClasses\" from comtnthemeclassset where use_at='Y' order by theme_id,sort_order,class_set_id"));
        out.put("sections",jdbc.queryForList("select section_id as \"sectionId\",section_name as \"sectionName\",section_type as \"sectionType\",layout_contract as \"layoutContract\",responsive_contract as \"responsiveContract\",accessibility_contract as \"accessibilityContract\",design_reference as \"designReference\" from ui_section_registry where active_yn='Y' order by section_type,section_id"));
        out.put("components",jdbc.queryForList("select component_id as \"componentId\",component_name as \"componentName\",component_type as \"componentType\",owner_domain as \"ownerDomain\",design_reference as \"designReference\",asset_fingerprint as \"fingerprint\" from ui_component_registry where active_yn='Y' order by component_type,component_name"));
        out.put("mappings",jdbc.queryForList("select m.map_id as \"mapId\",m.page_id as \"pageId\",p.route_path as \"routePath\",m.layout_zone as \"sectionId\",s.section_name as \"sectionName\",m.component_id as \"componentId\",c.component_name as \"componentName\",m.display_order as \"displayOrder\" from ui_page_component_map m join ui_page_manifest p on p.page_id=m.page_id and p.active_yn='Y' left join ui_section_registry s on s.section_id=m.layout_zone and s.active_yn='Y' left join ui_component_registry c on c.component_id=m.component_id and c.active_yn='Y' order by m.page_id,m.display_order,m.map_id"));
        out.put("designs",jdbc.queryForList("select design_asset_id as \"designAssetId\",page_id as \"pageId\",route_path as \"routePath\",menu_code as \"menuCode\",domain_code as \"domainCode\",layout_version as \"layoutVersion\",design_token_version as \"designTokenVersion\",source_path as \"sourcePath\",asset_fingerprint as \"fingerprint\" from framework_design_asset_registry where active_yn='Y' order by domain_code,route_path"));
        out.put("syncRuns",jdbc.queryForList("select sync_run_id as \"syncRunId\",asset_type as \"assetType\",source_path as \"sourcePath\",discovered_count as \"discoveredCount\",registered_count as \"registeredCount\",duplicate_count as \"duplicateCount\",sync_status as \"syncStatus\",executed_by as \"executedBy\",executed_at as \"executedAt\" from framework_asset_sync_run order by sync_run_id desc limit 20"));
        out.put("duplicates",jdbc.queryForList("select asset_fingerprint as fingerprint,count(*) as count,string_agg(component_id,', ' order by component_id) as \"componentIds\" from ui_component_registry where active_yn='Y' and asset_fingerprint is not null group by asset_fingerprint having count(*)>1 order by count(*) desc"));
        out.put("recentPreflights",jdbc.queryForList("select preflight_id as \"preflightId\",page_id as \"pageId\",route_path as \"routePath\",theme_id as \"themeId\",section_id as \"sectionId\",component_id as \"componentId\",class_set_id as \"classSetId\",reuse_policy as \"reusePolicy\",source_scope as \"sourceScope\",decision,executed_by as \"executedBy\",executed_at as \"executedAt\" from framework_design_preflight order by preflight_id desc limit 50"));
        return out;
    }

    public Map<String,Object> searchAssetCatalog(String query,String type,int requestedLimit){
        String keyword=query==null?"":query.trim();
        String assetType=type==null?"":type.trim().toUpperCase(Locale.ROOT);
        int limit=Math.max(1,Math.min(requestedLimit,100));
        List<Map<String,Object>> rows;
        if(keyword.isEmpty()){
            rows=jdbc.queryForList("select asset_id as \"assetId\",asset_type as \"assetType\",asset_code as \"assetCode\",asset_name as \"assetName\",asset_path as \"assetPath\",domain_code as \"domainCode\",description,metadata_json::text as metadata,selection_status as \"selectionStatus\",reference_count as \"referenceCount\",updated_at as \"updatedAt\" from framework_e4b_selectable_asset where (?='' or asset_type=?) order by updated_at desc,asset_type,asset_name limit ?",assetType,assetType,limit);
        }else{
            rows=jdbc.queryForList("select asset_id as \"assetId\",asset_type as \"assetType\",asset_code as \"assetCode\",asset_name as \"assetName\",asset_path as \"assetPath\",domain_code as \"domainCode\",description,metadata_json::text as metadata,selection_status as \"selectionStatus\",reference_count as \"referenceCount\",round((ts_rank(search_vector,websearch_to_tsquery('simple',?))+greatest(similarity(asset_name,?),similarity(coalesce(asset_path,''),?)))::numeric,4) as score from framework_e4b_selectable_asset where (?='' or asset_type=?) and (search_vector @@ websearch_to_tsquery('simple',?) or asset_name % ? or coalesce(asset_path,'') % ?) order by score desc,asset_type,asset_name limit ?",keyword,keyword,keyword,assetType,assetType,keyword,keyword,keyword,limit);
        }
        return Map.of("success",true,"query",keyword,"assetType",assetType,"count",rows.size(),"items",rows);
    }

    public Map<String,Object> assetImpact(String assetId,int requestedDepth){
        String id=assetId==null?"":assetId.trim();
        if(id.isEmpty())throw new IllegalArgumentException("assetId is required");
        int depth=Math.max(1,Math.min(requestedDepth,4));
        List<Map<String,Object>> roots=jdbc.queryForList("select asset_id as \"assetId\",asset_type as \"assetType\",asset_name as \"assetName\",asset_path as \"assetPath\" from framework_unified_asset where asset_id=? and active_yn='Y'",id);
        if(roots.isEmpty())throw new IllegalArgumentException("Asset not found: "+id);
        List<Map<String,Object>> relations=jdbc.queryForList("with recursive impact(asset_id,related_asset_id,relation_type,direction,depth,path) as ((select source_asset_id,target_asset_id,relation_type,'OUT',1,array[source_asset_id::text,target_asset_id::text] from framework_unified_asset_relation where source_asset_id=? and active_yn='Y' union all select target_asset_id,source_asset_id,relation_type,'IN',1,array[target_asset_id::text,source_asset_id::text] from framework_unified_asset_relation where target_asset_id=? and active_yn='Y') union all select i.related_asset_id,case when r.source_asset_id=i.related_asset_id then r.target_asset_id else r.source_asset_id end,r.relation_type,case when r.source_asset_id=i.related_asset_id then 'OUT' else 'IN' end,i.depth+1,i.path||case when r.source_asset_id=i.related_asset_id then r.target_asset_id::text else r.source_asset_id::text end from impact i join framework_unified_asset_relation r on (r.source_asset_id=i.related_asset_id or r.target_asset_id=i.related_asset_id) and r.active_yn='Y' where i.depth<? and not (case when r.source_asset_id=i.related_asset_id then r.target_asset_id else r.source_asset_id end=any(i.path))) select distinct i.asset_id as \"sourceAssetId\",i.related_asset_id as \"targetAssetId\",i.relation_type as \"relationType\",i.direction,i.depth,a.asset_type as \"targetType\",a.asset_name as \"targetName\",a.asset_path as \"targetPath\" from impact i join framework_unified_asset a on a.asset_id=i.related_asset_id order by i.depth,a.asset_type,a.asset_name",id,id,depth);
        return Map.of("success",true,"root",roots.get(0),"depth",depth,"count",relations.size(),"relations",relations);
    }

    @Transactional public Map<String,Object> refreshAssetCatalog(String actor){
        Map<String,Object> result=jdbc.queryForMap("select discovered_count as \"discoveredCount\",relation_count as \"relationCount\",changed_count as \"changedCount\" from framework_refresh_unified_asset_catalog(?)",actor);
        Map<String,Object> canonical=jdbc.queryForMap("select duplicate_groups as \"duplicateGroups\",merged_assets as \"mergedAssets\",selectable_assets as \"selectableAssets\" from framework_canonicalize_unified_assets(?)",actor);
        return Map.of("success",true,"result",result,"canonicalization",canonical);
    }

    @Transactional public Map<String,Object> runDesignPreflight(Map<String,Object>b,String actor){
        String pageId=req(b,"pageId"),route=req(b,"routePath"),pageName=req(b,"pageName"),domain=def(b,"domainCode","COMMON");
        String themeId=def(b,"themeId","KRDS_GOV_DEFAULT"),sectionId=req(b,"sectionId"),componentName=req(b,"componentName"),componentType=req(b,"componentType");
        Integer themeCount=jdbc.queryForObject("select count(*) from comtnthemedefinition where theme_id=? and use_at='Y' and is_active='Y'",Integer.class,themeId);
        if(themeCount==null||themeCount==0)throw new IllegalArgumentException("활성 테마가 존재하지 않습니다: "+themeId);
        Integer sectionCount=jdbc.queryForObject("select count(*) from ui_section_registry where section_id=? and active_yn='Y'",Integer.class,sectionId);
        if(sectionCount==null||sectionCount==0)throw new IllegalArgumentException("등록된 섹션을 먼저 선택해야 합니다: "+sectionId);
        String classSetId=def(b,"classSetId",defaultClassSet(componentType));
        Integer classSetCount=jdbc.queryForObject("select count(*) from comtnthemeclassset where class_set_id=? and theme_id=? and use_at='Y'",Integer.class,classSetId,themeId);
        if(classSetCount==null||classSetCount==0)throw new IllegalArgumentException("등록된 공통 CSS 클래스 세트를 먼저 선택해야 합니다: "+classSetId);
        String props=def(b,"propsSchema","{}"),designRef=def(b,"designReference",themeId);
        String fingerprint=jdbc.queryForObject("select md5(lower(trim(?))||'|'||lower(trim(?))||'|'||?||'|'||?)",String.class,componentType,componentName,props,designRef);
        jdbc.query("select pg_advisory_xact_lock(hashtext(?))",rs->{},fingerprint);
        List<Map<String,Object>> matches=jdbc.queryForList("select component_id as \"componentId\",asset_fingerprint as fingerprint from ui_component_registry where active_yn='Y' and category='COMMON' and (asset_fingerprint=? or (component_type=? and props_schema_json=? and design_reference=?)) order by case when asset_fingerprint=? then 0 else 1 end,component_id limit 1",fingerprint,componentType,props,designRef,fingerprint);
        String componentId,decision;
        if(matches.isEmpty()){
            componentId="CMP_"+fingerprint.substring(0,12).toUpperCase(); decision="CREATED";
            jdbc.update("insert into ui_component_registry(component_id,component_name,component_type,owner_domain,props_schema_json,design_reference,active_yn,category,default_props,asset_fingerprint,created_at,updated_at) values(?,?,?,?,?,?,'Y','COMMON',?,?,current_timestamp,current_timestamp)",componentId,componentName,componentType,domain,props,designRef,props,fingerprint);
        }else{componentId=String.valueOf(matches.get(0).get("componentId"));fingerprint=String.valueOf(matches.get(0).get("fingerprint"));decision="REUSED";}
        jdbc.update("insert into ui_page_manifest(page_id,page_name,route_path,domain_code,layout_version,design_token_version,active_yn,created_at,updated_at,page_title,page_url,version_status) values(?,?,?,?,'1.0.0',?,'Y',current_timestamp,current_timestamp,?,?, 'DRAFT') on conflict(page_id) do update set page_name=excluded.page_name,route_path=excluded.route_path,domain_code=excluded.domain_code,design_token_version=excluded.design_token_version,active_yn='Y',updated_at=current_timestamp",pageId,pageName,route,domain,themeId,pageName,route);
        Integer mappingCount=jdbc.queryForObject("select count(*) from ui_page_component_map where page_id=? and component_id=? and layout_zone=?",Integer.class,pageId,componentId,sectionId);
        if(mappingCount==null||mappingCount==0){
            String mapId=jdbc.queryForObject("select 'MAP_'||upper(md5(?))",String.class,pageId+"|"+componentId+"|"+sectionId);
            jdbc.update("insert into ui_page_component_map(map_id,page_id,layout_zone,component_id,instance_key,display_order,conditional_rule_summary,created_at,updated_at) values(?,?,?,?,?,coalesce((select max(display_order)+1 from ui_page_component_map where page_id=?),1),?,current_timestamp,current_timestamp)",mapId,pageId,sectionId,componentId,pageId+"_"+componentId,pageId,"design-preflight");
        }
        jdbc.update("insert into framework_design_preflight(page_id,route_path,theme_id,section_id,component_id,class_set_id,decision,asset_fingerprint,evidence_json,reuse_policy,source_scope,executed_by) values(?,?,?,?,?,?,?,?,?,'COMMON_ONLY','COMMON',?)",pageId,route,themeId,sectionId,componentId,classSetId,decision,fingerprint,"{\"themeVerified\":true,\"sectionVerified\":true,\"componentMatched\":true,\"classSetVerified\":true,\"commonOnly\":true}",actor);
        return Map.of("success",true,"decision",decision,"componentId",componentId,"fingerprint",fingerprint,"pageId",pageId,"sectionId",sectionId,"themeId",themeId,"classSetId",classSetId,"reusePolicy","COMMON_ONLY");
    }

    @Transactional public Map<String,Object> ensureCommonDesignAssets(String process,String step,String actor){
        List<Map<String,Object>> routes=jdbc.queryForList("select step_code as \"stepCode\",step_name as \"stepName\",unnest(array_remove(array[user_path,admin_path],null)) as route_path from framework_process_step where process_code=? and (?='' or step_code=?)",process,step,step);
        if(routes.isEmpty())return Map.of("success",true,"checkedRoutes",0,"bindings",List.of());
        Map<String,Object> common=jdbc.queryForMap("select component_name as \"componentName\",component_type as \"componentType\",props_schema_json as \"propsSchema\",design_reference as \"designReference\" from ui_component_registry where active_yn='Y' and category='COMMON' order by case when component_type in ('SECTION','FORM') then 0 else 1 end,component_id limit 1");
        List<Map<String,Object>> bindings=new java.util.ArrayList<>();
        for(Map<String,Object> row:routes){
            String route=ScreenDevelopmentNoteService.cleanRoute(String.valueOf(row.get("route_path")));
            if(route.isBlank())continue;
            Integer covered=jdbc.queryForObject("select count(*) from framework_common_design_asset_coverage where route_path=lower(?) and common_assets_ready",Integer.class,route);
            if(covered!=null&&covered>0)continue;
            String pageId=jdbc.queryForObject("select 'AUTO_'||upper(substr(md5(lower(?)),1,16))",String.class,route);
            Map<String,Object> request=new LinkedHashMap<>();
            request.put("pageId",pageId);request.put("pageName",String.valueOf(row.get("stepName")));request.put("routePath",route);
            request.put("domainCode",process);request.put("themeId","KRDS_GOV_DEFAULT");request.put("sectionId","DETAIL_WORKSPACE");
            request.put("componentName",common.get("componentName"));request.put("componentType",common.get("componentType"));
            request.put("propsSchema",common.get("propsSchema"));request.put("designReference",common.get("designReference"));
            request.put("classSetId",defaultClassSet(String.valueOf(common.get("componentType"))));
            bindings.add(runDesignPreflight(request,actor));
        }
        return Map.of("success",true,"checkedRoutes",bindings.size(),"bindings",bindings);
    }

    private String defaultClassSet(String componentType){
        if("BUTTON".equalsIgnoreCase(componentType))return "KRDS_BUTTON_PRIMARY";
        if("INPUT".equalsIgnoreCase(componentType)||"FORM".equalsIgnoreCase(componentType))return "KRDS_FORM_CONTROL";
        return "KRDS_CONTENT_CARD";
    }

    private java.util.SortedSet<String> canonicalCodeSet(
            String raw,String codePattern,String fieldName){
        java.util.SortedSet<String> values=new java.util.TreeSet<>();
        for(String value:raw.split(",")){
            String code=value.trim().toUpperCase(Locale.ROOT);
            if(code.isEmpty())continue;
            if(!code.matches(codePattern))
                throw new IllegalArgumentException("INVALID_"+fieldName+": "+code);
            values.add(code);
        }
        return values;
    }

    /**
     * Locks actor definitions in one deterministic order before a process or step
     * persists references to them.  Actor deactivation takes the same row lock, so
     * it must either observe the committed reference and refresh its process or
     * complete first and make the active-reference validation fail closed.
     */
    private Map<String,String> lockActorDefinitions(
            java.util.Collection<String> requestedCodes){
        java.util.SortedSet<String> codes=new java.util.TreeSet<>();
        for(String raw:requestedCodes){
            String code=raw==null?"":raw.trim().toUpperCase(Locale.ROOT);
            if(!code.isEmpty())codes.add(code);
        }
        if(codes.isEmpty())return Map.of();
        List<Map<String,Object>> rows=jdbc.queryForList("""
            select actor_code,use_at
              from framework_actor_definition
             where actor_code=any(string_to_array(?,','))
             order by actor_code collate "C"
             for update
            """,String.join(",",codes));
        Map<String,String> states=new LinkedHashMap<>();
        for(Map<String,Object> row:rows){
            states.put(String.valueOf(row.get("actor_code")),
                String.valueOf(row.get("use_at")));
        }
        return states;
    }

    private boolean isActiveActor(Map<String,String> actorStates,String actorCode){
        return "Y".equals(actorStates.get(actorCode));
    }

    @Transactional public Map<String,Object> createActor(Map<String,Object>b,String authenticatedActor){
        return createActorInternal(b,authenticatedActor,true);
    }

    @Transactional public Map<String,Object> createActorForRequirementImport(
            Map<String,Object>b,String authenticatedActor){
        return createActorInternal(b,authenticatedActor,false);
    }

    private Map<String,Object> createActorInternal(
            Map<String,Object>b,String authenticatedActor,boolean propagate){
        if(authenticatedActor==null||authenticatedActor.isBlank()
                ||!authenticatedActor.equals(authenticatedActor.trim())
                ||authenticatedActor.length()>100)
            throw new SecurityException("AUTHENTICATED_ACTOR_REQUIRED");
        String actorCode=req(b,"actorCode").trim().toUpperCase(Locale.ROOT);
        String purpose=req(b,"purpose");
        if(!actorCode.matches("^[A-Z][A-Z0-9_]{1,59}$"))throw new IllegalArgumentException("actorCode must use uppercase letters, numbers, and underscores");
        java.util.SortedSet<String> capabilities=canonicalCodeSet(
            str(b,"capabilityCodes"),"^[A-Z][A-Z0-9_:-]{0,79}$","CAPABILITY_CODE");
        java.util.SortedSet<String> conflicts=canonicalCodeSet(
            str(b,"conflictActorCodes"),"^[A-Z][A-Z0-9_]{1,59}$","CONFLICT_ACTOR_CODE");
        if(conflicts.contains(actorCode))
            throw new IllegalArgumentException("CONFLICT_ACTOR_MUST_DIFFER_FROM_SELF: "+actorCode);
        java.util.SortedSet<String> lockedActors=new java.util.TreeSet<>(conflicts);
        lockedActors.add(actorCode);
        Map<String,String> actorStates=lockActorDefinitions(lockedActors);
        if(!conflicts.isEmpty()){
            java.util.SortedSet<String> activeConflicts=new java.util.TreeSet<>();
            for(String conflict:conflicts){
                if(isActiveActor(actorStates,conflict))activeConflicts.add(conflict);
            }
            if(!activeConflicts.equals(conflicts)){
                java.util.SortedSet<String> missing=new java.util.TreeSet<>(conflicts);
                missing.removeAll(activeConflicts);
                throw new IllegalArgumentException("ACTIVE_CONFLICT_ACTOR_NOT_FOUND: "+missing);
            }
        }
        String useAt=def(b,"useAt","Y").trim().toUpperCase(Locale.ROOT);
        if(!useAt.matches("^[YN]$"))throw new IllegalArgumentException("useAt must be Y or N");
        if("N".equals(useAt)){
            Integer activeAssignments=jdbc.queryForObject("select count(*) from framework_account_actor_assignment where actor_code=? and assignment_status='ACTIVE' and (valid_until is null or valid_until>=current_date)",Integer.class,actorCode);
            if(activeAssignments!=null&&activeAssignments>0)throw new IllegalArgumentException("ACTIVE_ACTOR_ASSIGNMENTS_EXIST");
            List<String> activeConflictReferences=jdbc.queryForList("""
                select actor_code
                  from framework_actor_definition
                 where use_at='Y' and actor_code<>?
                   and ?=any(regexp_split_to_array(
                     coalesce(nullif(btrim(conflict_actor_codes),''),'__NONE__'),
                     '[[:space:]]*,[[:space:]]*'))
                 order by actor_code
                """,String.class,actorCode,actorCode);
            if(!activeConflictReferences.isEmpty()){
                throw new IllegalArgumentException(
                    "ACTIVE_ACTOR_CONFLICT_REFERENCES_EXIST: "+activeConflictReferences);
            }
        }
        jdbc.update("insert into framework_actor_definition(actor_code,actor_name,actor_name_en,actor_type,purpose,capability_codes,delegation_allowed,use_at,responsibility_text,accountability_text,competency_requirements,conflict_actor_codes,max_concurrent_assignments,review_cycle_days) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?) on conflict(actor_code) do update set actor_name=excluded.actor_name,actor_name_en=excluded.actor_name_en,actor_type=excluded.actor_type,purpose=excluded.purpose,capability_codes=excluded.capability_codes,delegation_allowed=excluded.delegation_allowed,use_at=excluded.use_at,responsibility_text=excluded.responsibility_text,accountability_text=excluded.accountability_text,competency_requirements=excluded.competency_requirements,conflict_actor_codes=excluded.conflict_actor_codes,max_concurrent_assignments=excluded.max_concurrent_assignments,review_cycle_days=excluded.review_cycle_days,updated_at=current_timestamp",actorCode,req(b,"actorName"),str(b,"actorNameEn"),def(b,"actorType","BUSINESS"),purpose,String.join(",",capabilities),bool(b,"delegationAllowed"),useAt,def(b,"responsibility",purpose),def(b,"accountability",purpose),def(b,"competency",purpose),String.join(",",conflicts),integerOr(b,"maxConcurrentAssignments",0),integerOr(b,"reviewCycleDays",365));
        List<String> affected=jdbc.queryForList("""
            select affected.process_code from (
              select step.process_code from framework_process_step step
               where step.actor_code=?
              union
              select process.process_code from framework_process_definition process
               where process.owner_actor_code=?
              union
              select step.process_code from framework_process_step step
               where step.escalation_actor_code=?
              union
               select step.process_code from framework_process_step step
                where ?=any(regexp_split_to_array(
                  coalesce(nullif(btrim(step.segregation_actor_codes),''),'__NONE__'),
                  '[[:space:]]*,[[:space:]]*'))
            ) affected order by affected.process_code collate "C"
            """,String.class,actorCode,actorCode,actorCode,actorCode);
        List<Map<String,Object>> processResults=new java.util.ArrayList<>();
        int queuedCount=0;
        for(String process:affected){
            if(!propagate)continue;
            Map<String,Object> trigger=new LinkedHashMap<>();
            trigger.put("triggerType","ACTOR_DEFINITION");trigger.put("actorCode",actorCode);
            Map<String,Object> result=refreshAndQueueCanonicalProcess(
                process,authenticatedActor,trigger);
            if(Boolean.TRUE.equals(result.get("generationQueued")))queuedCount++;
            processResults.add(result);
        }
        Map<String,Object> response=new LinkedHashMap<>();
        response.put("success",true);response.put("actorCode",actorCode);
        response.put("affectedProcessCount",affected.size());
        response.put("affectedProcessCodes",affected);
        response.put("propagationDeferred",!propagate);
        response.put("generationQueued",queuedCount>0);
        response.put("queuedProcessCount",queuedCount);response.put("processResults",processResults);
        return response;
    }
    @Transactional public void saveWorkType(Map<String,Object>b){
        String code=req(b,"workTypeCode").trim().toUpperCase(Locale.ROOT);
        if(!code.matches("^[A-Z][A-Z0-9_]{1,59}$"))throw new IllegalArgumentException("workTypeCode must use uppercase letters, numbers, and underscores");
        jdbc.update("insert into framework_business_work_type(work_type_code,work_type_name,work_type_name_en,description,sort_order,use_at) values(?,?,?,?,?,?) on conflict(work_type_code) do update set work_type_name=excluded.work_type_name,work_type_name_en=excluded.work_type_name_en,description=excluded.description,sort_order=excluded.sort_order,use_at=excluded.use_at,updated_at=current_timestamp",code,req(b,"workTypeName"),str(b,"workTypeNameEn"),str(b,"description"),integerOr(b,"sortOrder",100),def(b,"useAt","Y"));
    }
    @Transactional public void assignActor(Map<String,Object>b){
        String accountId=req(b,"accountId"), tenantId=def(b,"tenantId","DEFAULT"), projectId=def(b,"projectId","*");
        String actorCode=req(b,"actorCode").trim().toUpperCase(Locale.ROOT);
        if(!actorCode.matches("^[A-Z][A-Z0-9_]{1,59}$"))
            throw new SecurityException("ACTIVE_ACTOR_NOT_FOUND");
        List<String> activeActor=jdbc.queryForList("""
            select actor_code from framework_actor_definition
             where actor_code=? and use_at='Y'
             for update
            """,String.class,actorCode);
        if(activeActor.size()!=1)throw new SecurityException("ACTIVE_ACTOR_NOT_FOUND");
        jdbc.update("insert into framework_account_actor_assignment(account_id,tenant_id,project_id,actor_code,data_scope,valid_until) values(?,?,?,?,?,nullif(?,'')::date) on conflict(account_id,tenant_id,project_id,actor_code) do update set data_scope=excluded.data_scope,valid_until=excluded.valid_until,assignment_status='ACTIVE'",accountId,tenantId,projectId,actorCode,def(b,"dataScope","*"),str(b,"validUntil"));
        if(!"*".equals(projectId)){
            Integer projectCount=jdbc.queryForObject("select count(*) from emission_project_registry where project_id=? and tenant_id=?",Integer.class,projectId,tenantId);
            if(projectCount==null||projectCount==0)throw new IllegalArgumentException("PROJECT_TENANT_SCOPE_NOT_FOUND");
            jdbc.update("insert into framework_project_actor_assignment(project_id,actor_code,user_id,active_yn) values(?,?,?,'Y') on conflict(project_id,actor_code,user_id) do update set active_yn='Y',assigned_at=current_timestamp",projectId,actorCode,accountId);
            jdbc.update("update emission_project_task set assignee_id=?,updated_at=current_timestamp where project_id=? and actor_code=?",accountId,projectId,actorCode);
            jdbc.update("insert into emission_project_history(project_id,event_type,event_description,actor_name) values (?,'ACTOR_ASSIGNED',?||' 역할의 주 담당자가 '||?||'(으)로 배정되었습니다.',?)",projectId,actorCode,accountId,accountId);
        }
    }

    @Transactional public void assignActorAuthorized(Map<String,Object>b,String requesterAccountId,String requesterTenantId,String requesterAuthorCode,boolean platformAdministrator){
        String accountId=req(b,"accountId").trim();
        String tenantId=def(b,"tenantId","DEFAULT").trim();
        String projectId=def(b,"projectId","*").trim();
        String requester=requesterAccountId==null?"":requesterAccountId.trim();
        String requesterTenant=requesterTenantId==null?"":requesterTenantId.trim();
        String authority=requesterAuthorCode==null?"":requesterAuthorCode.trim().toUpperCase(Locale.ROOT);
        if(requester.isBlank())throw new SecurityException("AUTHENTICATION_REQUIRED");
        if(!platformAdministrator&&(requesterTenant.isBlank()||!tenantId.equals(requesterTenant)))throw new SecurityException("ACTOR_ASSIGNMENT_TENANT_FORBIDDEN");
        if(!"*".equals(projectId)){
            Integer projectCount=jdbc.queryForObject("select count(*) from emission_project_registry where project_id=? and tenant_id=?",Integer.class,projectId,tenantId);
            if(projectCount==null||projectCount==0)throw new SecurityException("ACTOR_ASSIGNMENT_PROJECT_TENANT_FORBIDDEN");
        }
        if(!platformAdministrator){
            // ROLE_ADMIN is the company's bootstrap administrator in the member model.
            // After onboarding, an active COMPANY_MANAGER actor binding grants the same
            // bounded capability without promoting that account to a platform role.
            boolean companyAdministrator="ROLE_ADMIN".equals(authority);
            if(!companyAdministrator){
                Integer managerCount=jdbc.queryForObject("select count(*) from framework_account_actor_assignment assignment join framework_actor_definition actor on actor.actor_code=assignment.actor_code and actor.use_at='Y' where assignment.tenant_id=? and lower(assignment.account_id)=lower(?) and assignment.actor_code='COMPANY_MANAGER' and assignment.assignment_status='ACTIVE' and (assignment.valid_from is null or assignment.valid_from<=current_date) and (assignment.valid_until is null or assignment.valid_until>=current_date) and (assignment.project_id='*' or assignment.project_id=?) and (assignment.data_scope='*' or ?=any(string_to_array(replace(assignment.data_scope,' ',''),',')))",Integer.class,tenantId,requester,projectId,projectId);
                if(managerCount==null||managerCount==0)throw new SecurityException("ACTOR_ASSIGNMENT_COMPANY_MANAGER_REQUIRED");
            }
            Integer targetCount=jdbc.queryForObject("select count(*) from (select emplyr_id as account_id from comtnemplyrinfo where lower(emplyr_id)=lower(?) and trim(instt_id)=trim(?) and emplyr_sttus_code in ('P','A') union all select entrprs_mber_id from comtnentrprsmber where lower(entrprs_mber_id)=lower(?) and trim(instt_id)=trim(?) and entrprs_mber_sttus in ('P','A')) tenant_account",Integer.class,accountId,tenantId,accountId,tenantId);
            if(targetCount==null||targetCount==0)throw new SecurityException("ACTOR_ASSIGNMENT_TARGET_TENANT_FORBIDDEN");
        }
        assignActor(b);
    }

    @Transactional public Map<String,Object> saveProjectDeliveryBlueprint(Map<String,Object>b,String actor){
        String code=req(b,"blueprintCode").trim().toUpperCase(Locale.ROOT);
        if(!code.matches("^[A-Z][A-Z0-9_]{2,99}$"))throw new IllegalArgumentException("blueprintCode must use uppercase letters, numbers, and underscores");
        Object actors=b.get("actors"),processes=b.get("processCodes");
        if(!(actors instanceof List<?> actorList)||actorList.isEmpty())throw new IllegalArgumentException("at least one actor binding is required");
        if(!(processes instanceof List<?> processList)||processList.isEmpty())throw new IllegalArgumentException("at least one process is required");
        Map<String,Object> specification=new LinkedHashMap<>();
        specification.put("schemaVersion","1.0.0");specification.put("actors",actors);specification.put("processCodes",processes);
        specification.put("qualityGate",List.of("ACTOR","PROCESS_STEP","VALID_SCREEN","HAPPY_PATH","AUTHORITY","ISOLATION","EXCEPTION","RECOVERY","ATOMIC_ROLLBACK"));
        boolean approve=bool(b,"approve");
        jdbc.update("insert into framework_project_delivery_blueprint(blueprint_code,blueprint_name,blueprint_version,domain_code,specification,blueprint_status,approved_by,approved_at) values(?,?,?,?,cast(? as jsonb),?,case when ? then ? else null end,case when ? then current_timestamp else null end) on conflict(blueprint_code) do update set blueprint_name=excluded.blueprint_name,blueprint_version=excluded.blueprint_version,domain_code=excluded.domain_code,specification=excluded.specification,blueprint_status=excluded.blueprint_status,approved_by=excluded.approved_by,approved_at=excluded.approved_at,updated_at=current_timestamp",code,req(b,"blueprintName"),def(b,"blueprintVersion","1.0.0"),req(b,"domainCode").toUpperCase(Locale.ROOT),toJson(specification),approve?"APPROVED":"DRAFT",approve,actor,approve);
        Map<String,Object> validation=jsonMap(jdbc.queryForObject("select framework_validate_project_delivery_blueprint(?)::text",String.class,code));
        if(!Boolean.TRUE.equals(validation.get("valid"))){
            jdbc.update("update framework_project_delivery_blueprint set blueprint_status='DRAFT',approved_by=null,approved_at=null,updated_at=current_timestamp where blueprint_code=?",code);
        }
        return Map.of("success",Boolean.TRUE.equals(validation.get("valid")),"blueprintCode",code,"status",approve&&Boolean.TRUE.equals(validation.get("valid"))?"APPROVED":"DRAFT","validation",validation);
    }

    public Map<String,Object> validateProjectDeliveryBlueprint(String code){
        return jsonMap(jdbc.queryForObject("select framework_validate_project_delivery_blueprint(?)::text",String.class,code));
    }

    @Transactional public Map<String,Object> applyProjectDeliveryBlueprint(Map<String,Object>b,String actor){
        String blueprintCode=req(b,"blueprintCode"),tenantId=def(b,"tenantId","DEFAULT"),projectId=req(b,"projectId");
        Map<String,Object> specification=jsonMap(jdbc.queryForObject("select specification::text from framework_project_delivery_blueprint where blueprint_code=? and blueprint_status='APPROVED'",String.class,blueprintCode));
        Set<String> requiredActors=new HashSet<>();
        Object rawActors=specification.get("actors");
        if(rawActors instanceof List<?> list)for(Object item:list)if(item instanceof Map<?,?> row)requiredActors.add(String.valueOf(row.get("actorCode")));
        Object rawBindings=b.get("actorBindings");
        if(!(rawBindings instanceof List<?> bindings)||bindings.isEmpty())throw new IllegalArgumentException("actorBindings are required");
        Set<String> boundActors=new HashSet<>();
        List<Map<String,Object>> normalizedBindings=new java.util.ArrayList<>();
        for(Object item:bindings){
            if(!(item instanceof Map<?,?> raw))continue;
            Map<String,Object> binding=new LinkedHashMap<>();raw.forEach((key,value)->binding.put(String.valueOf(key),value));
            boundActors.add(req(binding,"actorCode"));req(binding,"accountId");normalizedBindings.add(binding);
        }
        if(!boundActors.containsAll(requiredActors))throw new IllegalArgumentException("every blueprint actor requires a project account binding: "+requiredActors);
        for(Map<String,Object> binding:normalizedBindings){binding.put("tenantId",tenantId);binding.put("projectId",projectId);assignActor(binding);}
        Map<String,Object> result=jsonMap(jdbc.queryForObject("select framework_apply_project_delivery_blueprint(?,?,?,?)::text",String.class,blueprintCode,tenantId,projectId,actor));
        if(!Boolean.TRUE.equals(result.get("success")))throw new IllegalArgumentException("project delivery validation failed: "+result);
        return result;
    }

    /**
     * Executes the real project-delivery path inside a transaction that is
     * always rolled back.  It proves actor assignment, process/task sync,
     * generated-screen impact and release creation without leaving test data in
     * the customer database.
     */
    @Transactional public Map<String,Object> verifyProjectDeliveryBlueprintE2E(String actor){
        String suffix=UUID.randomUUID().toString().replace("-","").substring(0,12).toUpperCase(Locale.ROOT);
        String projectId="E2E-PDR-"+suffix;
        String blueprintCode="E2E_PDR_"+suffix;
        String tenantId="DEFAULT";
        Map<String,Object> process=jdbc.queryForMap("select p.process_code,a.actor_code from framework_process_definition p join lateral (select s.actor_code from framework_process_step s where s.process_code=p.process_code order by s.step_order limit 1) a on true where p.process_code='EMISSION_PROJECT' and exists(select 1 from framework_screen_blueprint b where b.process_code=p.process_code and b.validation_status='VALID') and exists(select 1 from framework_simulation_case c where c.process_code=p.process_code and c.case_type='HAPPY_PATH' and c.case_status in('READY','ACTIVE','APPROVED','VERIFIED'))");
        String processCode=String.valueOf(process.get("process_code"));
        String actorCode=String.valueOf(process.get("actor_code"));
        String accountId="e2e-project-delivery";
        jdbc.update("insert into emission_project_registry(project_id,project_name,site_name,calculation_period,scope_name,owner_name,progress_percent,current_step,due_date,project_status,tenant_id) values(?,?,?,?,?,?,0,?,current_date+7,'TEST',?)",projectId,"Project delivery transaction E2E","E2E SITE","2026","Scope 1·2",accountId,"SETUP",tenantId);
        Map<String,Object> saved=saveProjectDeliveryBlueprint(Map.of(
            "blueprintCode",blueprintCode,"blueprintName","Project delivery E2E","blueprintVersion","1.0.0",
            "domainCode","EMISSION","actors",List.of(Map.of("actorCode",actorCode)),
            "processCodes",List.of(processCode),"approve",true),actor);
        if(!Boolean.TRUE.equals(saved.get("success")))throw new IllegalStateException("E2E_BLUEPRINT_VALIDATION_FAILED: "+saved);
        Map<String,Object> applied=applyProjectDeliveryBlueprint(Map.of(
            "blueprintCode",blueprintCode,"tenantId",tenantId,"projectId",projectId,
            "actorBindings",List.of(Map.of("actorCode",actorCode,"accountId",accountId,"dataScope","*"))),actor);
        Map<String,Object> evidence=jdbc.queryForMap("select (select count(*) from framework_project_delivery_release where project_id=?) as release_count,(select count(*) from framework_account_actor_assignment where project_id=? and actor_code=? and assignment_status='ACTIVE') as actor_count,(select count(*) from emission_project_task where project_id=?) as task_count,(select count(*) from framework_project_process_applicability where project_id=? and applicability_status='APPLICABLE') as process_count",projectId,projectId,actorCode,projectId,projectId);
        if(((Number)evidence.get("release_count")).intValue()!=1||((Number)evidence.get("actor_count")).intValue()!=1||((Number)evidence.get("task_count")).intValue()<1||((Number)evidence.get("process_count")).intValue()<1){
            throw new IllegalStateException("E2E_PROJECT_DELIVERY_INCOMPLETE: "+evidence);
        }
        org.springframework.transaction.interceptor.TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
        return Map.of("success",true,"projectId",projectId,"blueprintCode",blueprintCode,
            "processCode",processCode,"actorCode",actorCode,"evidence",evidence,
            "releaseCode",String.valueOf(applied.get("releaseCode")),"rollbackScheduled",true);
    }
    @Transactional public Map<String,Object> deactivateActorAssignment(Map<String,Object>b){
        long assignmentId=Long.parseLong(req(b,"assignmentId"));
        List<Map<String,Object>> matches=jdbc.queryForList("select assignment_id,account_id,tenant_id,project_id,actor_code from framework_account_actor_assignment where assignment_id=? for update",assignmentId);
        if(matches.isEmpty())throw new IllegalArgumentException("ACTOR_ASSIGNMENT_NOT_FOUND");
        Map<String,Object> assignment=matches.get(0);
        String accountId=String.valueOf(assignment.get("account_id"));
        String projectId=String.valueOf(assignment.get("project_id"));
        String actorCode=String.valueOf(assignment.get("actor_code"));
        jdbc.update("update framework_account_actor_assignment set assignment_status='INACTIVE' where assignment_id=?",assignmentId);
        if(!"*".equals(projectId)){
            jdbc.update("update framework_project_actor_assignment set active_yn='N' where project_id=? and actor_code=? and user_id=?",projectId,actorCode,accountId);
            jdbc.update("update emission_project_task set assignee_id=null,updated_at=current_timestamp where project_id=? and actor_code=? and assignee_id=?",projectId,actorCode,accountId);
            jdbc.update("insert into emission_project_history(project_id,event_type,event_description,actor_name) values (?,'ACTOR_UNASSIGNED',?||' 액터에서 '||?||' 계정 배정을 해제했습니다.',?)",projectId,actorCode,accountId,accountId);
        }
        return Map.of("success",true,"assignmentId",assignmentId,"accountId",accountId,"projectId",projectId,"actorCode",actorCode,"status","INACTIVE");
    }
    @Transactional public Map<String,Object> createProcess(Map<String,Object>b,String authenticatedActor){
        return createProcessInternal(b,authenticatedActor,true);
    }

    @Transactional public Map<String,Object> createProcessForRequirementImport(
            Map<String,Object>b,String authenticatedActor){
        return createProcessInternal(b,authenticatedActor,false);
    }

    private Map<String,Object> createProcessInternal(
            Map<String,Object>b,String authenticatedActor,boolean propagate){
        if(authenticatedActor==null||authenticatedActor.isBlank()
                ||!authenticatedActor.equals(authenticatedActor.trim())
                ||authenticatedActor.length()>100)
            throw new SecurityException("AUTHENTICATED_ACTOR_REQUIRED");
        String processCode=req(b,"processCode").trim().toUpperCase(Locale.ROOT);
        if(!processCode.matches("[A-Z0-9_]{3,80}"))throw new IllegalArgumentException("INVALID_PROCESS_CODE");
        String domainCode=req(b,"domainCode").trim().toUpperCase(Locale.ROOT);
        Integer enabled=jdbc.queryForObject("select count(*) from framework_business_work_type where work_type_code=? and use_at='Y'",Integer.class,domainCode);
        if(enabled==null||enabled==0)throw new IllegalArgumentException("ACTIVE_WORK_TYPE_NOT_FOUND: "+domainCode);
        String ownerActorCode=req(b,"ownerActorCode").trim().toUpperCase(Locale.ROOT);
        Map<String,String> ownerActor=lockActorDefinitions(java.util.Set.of(ownerActorCode));
        if(!isActiveActor(ownerActor,ownerActorCode))
            throw new IllegalArgumentException("ACTIVE_OWNER_ACTOR_NOT_FOUND: "+ownerActorCode);
        String parentProcessCode=str(b,"parentProcessCode").trim().toUpperCase(Locale.ROOT);
        if(processCode.equals(parentProcessCode))throw new IllegalArgumentException("PROCESS_CANNOT_PARENT_ITSELF");
        if(!parentProcessCode.isEmpty()){
            Integer parentCount=jdbc.queryForObject("select count(*) from framework_process_definition where process_code=?",Integer.class,parentProcessCode);
            if(parentCount==null||parentCount==0)throw new IllegalArgumentException("PARENT_PROCESS_NOT_FOUND: "+parentProcessCode);
        }
        String processStatus=def(b,"processStatus","DRAFT").toUpperCase(Locale.ROOT);
        String automationMode=def(b,"automationMode","ASSISTED").toUpperCase(Locale.ROOT);
        String riskLevel=def(b,"riskLevel","MEDIUM").toUpperCase(Locale.ROOT);
        String lifecycleStatus=def(b,"lifecycleStatus","DRAFT").toUpperCase(Locale.ROOT);
        if(!Set.of("DRAFT","DEVELOPMENT_READY","IN_DEVELOPMENT","ACTIVE","SUSPENDED","RETIRED").contains(processStatus))throw new IllegalArgumentException("INVALID_PROCESS_STATUS");
        if(!Set.of("MANUAL","ASSISTED","AUTOMATED").contains(automationMode))throw new IllegalArgumentException("INVALID_AUTOMATION_MODE");
        if(!Set.of("LOW","MEDIUM","HIGH","CRITICAL").contains(riskLevel))throw new IllegalArgumentException("INVALID_RISK_LEVEL");
        if(!Set.of("DRAFT","DESIGN","VALIDATED","PROMOTED","ACTIVE","DEPRECATED","RETIRED").contains(lifecycleStatus))throw new IllegalArgumentException("INVALID_LIFECYCLE_STATUS");
        String effectiveFrom=str(b,"effectiveFrom"),effectiveUntil=str(b,"effectiveUntil");
        if(!effectiveFrom.isEmpty()&&!effectiveUntil.isEmpty()&&effectiveFrom.compareTo(effectiveUntil)>0)throw new IllegalArgumentException("INVALID_EFFECTIVE_DATE_RANGE");
        lockCanonicalProcessPublication(processCode);
        Map<String,Object> revision=beginProcessDesignRevision(processCode,authenticatedActor);
        String processVersion=Boolean.TRUE.equals(revision.get("exists"))
            ?String.valueOf(revision.get("processVersion")):def(b,"version","1.0.0");
        jdbc.update("""
            insert into framework_process_definition(
              process_code,process_name,domain_code,process_version,goal,start_condition,completion_condition,
              parent_process_code,process_level,automation_mode,development_order,prerequisite_codes,
              process_status,owner_actor_code,risk_level,sla_hours,review_cycle_days,regulation_refs,
              lifecycle_status,effective_from,effective_until)
            values(?,?,?,?,?,?,?,nullif(?,''),?,?,?,?,?,?,?,?,?,?,?,nullif(?,'')::date,nullif(?,'')::date)
            on conflict(process_code) do update set
              process_name=excluded.process_name,domain_code=excluded.domain_code,process_version=excluded.process_version,
              goal=excluded.goal,start_condition=excluded.start_condition,completion_condition=excluded.completion_condition,
              parent_process_code=excluded.parent_process_code,process_level=excluded.process_level,
              automation_mode=excluded.automation_mode,development_order=excluded.development_order,
              prerequisite_codes=excluded.prerequisite_codes,process_status=excluded.process_status,
              owner_actor_code=excluded.owner_actor_code,risk_level=excluded.risk_level,sla_hours=excluded.sla_hours,
              review_cycle_days=excluded.review_cycle_days,regulation_refs=excluded.regulation_refs,
              lifecycle_status=excluded.lifecycle_status,effective_from=excluded.effective_from,
              effective_until=excluded.effective_until,updated_at=current_timestamp
            """,processCode,req(b,"processName"),domainCode,processVersion,req(b,"goal"),
            req(b,"startCondition"),req(b,"completionCondition"),parentProcessCode,
            integerOr(b,"processLevel",parentProcessCode.isEmpty()?1:2),automationMode,
            integerOr(b,"developmentOrder",0),str(b,"prerequisiteCodes"),processStatus,ownerActorCode,riskLevel,
            integerOr(b,"slaHours",0),integerOr(b,"reviewCycleDays",365),str(b,"regulationRefs"),
            lifecycleStatus,effectiveFrom,effectiveUntil);
        Map<String,Object> trigger=new LinkedHashMap<>();
        trigger.put("triggerType","PROCESS_DEFINITION");
        Map<String,Object> result=propagate
            ?refreshAndQueueCanonicalProcess(processCode,authenticatedActor,trigger)
            :new LinkedHashMap<>(Map.of("success",true,"status","DEFERRED",
                "generationQueued",false,"jobCount",0,"propagationDeferred",true));
        result.put("processCode",processCode);
        return result;
    }
    @Transactional public Map<String,Object> addStep(Map<String,Object>b,String actor){
        return addStepInternal(b,actor,true);
    }

    @Transactional public Map<String,Object> addStepForRequirementImport(
            Map<String,Object>b,String actor){
        return addStepInternal(b,actor,false);
    }

    private Map<String,Object> addStepInternal(
            Map<String,Object>b,String actor,boolean propagate){
        if(actor==null||actor.isBlank()||!actor.equals(actor.trim())||actor.length()>100)
            throw new SecurityException("AUTHENTICATED_ACTOR_REQUIRED");
        String process=req(b,"processCode").trim().toUpperCase(Locale.ROOT),
            step=req(b,"stepCode").trim().toUpperCase(Locale.ROOT); int order=integer(b,"stepOrder");
        Integer processCount=jdbc.queryForObject("select count(*) from framework_process_definition where process_code=?",Integer.class,process);
        if(processCount==null||processCount==0)throw new IllegalArgumentException("PROCESS_NOT_FOUND: "+process);
        String actorCode=req(b,"actorCode").trim().toUpperCase(Locale.ROOT);
        String escalationActorCode=str(b,"escalationActorCode").trim().toUpperCase(Locale.ROOT);
        java.util.SortedSet<String> segregationActors=canonicalCodeSet(
            str(b,"segregationActorCodes"),"^[A-Z][A-Z0-9_]{1,59}$",
            "SEGREGATION_ACTOR_CODE");
        if(segregationActors.contains(actorCode))
            throw new IllegalArgumentException(
                "SEGREGATION_ACTOR_MUST_DIFFER_FROM_PRIMARY: "+actorCode);
        String segregationActorCodes=String.join(",",segregationActors);
        java.util.SortedSet<String> referencedActors=new java.util.TreeSet<>(segregationActors);
        referencedActors.add(actorCode);
        if(!escalationActorCode.isEmpty())referencedActors.add(escalationActorCode);
        Map<String,String> actorStates=lockActorDefinitions(referencedActors);
        if(!isActiveActor(actorStates,actorCode))
            throw new IllegalArgumentException("ACTIVE_ACTOR_NOT_FOUND: "+actorCode);
        if(!escalationActorCode.isEmpty()
                &&!isActiveActor(actorStates,escalationActorCode)){
            throw new IllegalArgumentException(
                "ACTIVE_ESCALATION_ACTOR_NOT_FOUND: "+escalationActorCode);
        }
        if(!segregationActors.isEmpty()){
            java.util.SortedSet<String> activeSegregationActors=new java.util.TreeSet<>();
            for(String segregationActor:segregationActors){
                if(isActiveActor(actorStates,segregationActor))
                    activeSegregationActors.add(segregationActor);
            }
            if(!activeSegregationActors.equals(segregationActors)){
                java.util.SortedSet<String> missing=new java.util.TreeSet<>(segregationActors);
                missing.removeAll(activeSegregationActors);
                throw new IllegalArgumentException("ACTIVE_SEGREGATION_ACTOR_NOT_FOUND: "+missing);
            }
        }
        validateJsonObject(def(b,"inputContract","{}"),"inputContract");
        validateJsonObject(def(b,"outputContract","{}"),"outputContract");
        lockCanonicalProcessPublication(process);
        beginProcessDesignRevision(process,actor);
        List<Map<String,Object>> currentSteps=jdbc.queryForList("select step_order from framework_process_step where process_code=? and step_code=? for update",process,step);
        if(currentSteps.isEmpty()){
            jdbc.update("update framework_process_step set step_order=step_order+10000 where process_code=? and step_order>=?",process,order);
            jdbc.update("update framework_process_step set step_order=step_order-9999 where process_code=? and step_order>=?",process,order+10000);
        }else{
            int currentOrder=((Number)currentSteps.get(0).get("step_order")).intValue();
            if(currentOrder!=order){
                jdbc.update("update framework_process_step set step_order=-1000000000 where process_code=? and step_code=?",process,step);
                if(order<currentOrder)jdbc.update("update framework_process_step set step_order=step_order+1 where process_code=? and step_order>=? and step_order<?",process,order,currentOrder);
                else jdbc.update("update framework_process_step set step_order=step_order-1 where process_code=? and step_order>? and step_order<=?",process,currentOrder,order);
            }
        }
        jdbc.update("insert into framework_process_step(process_code,step_order,step_code,step_name,parent_step_code,step_type,actor_code,from_state,command_code,to_state,completion_rule,requirement_text,input_contract,output_contract,requires_user_page,requires_admin_page,requires_api,requires_database,requires_notification,user_path,admin_path,api_contract,automation_status,sla_hours,escalation_actor_code,evidence_required,evidence_types,segregation_actor_codes,rollback_command_code,decision_rule) values(?,?,?,?,nullif(?,''),?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'PLANNED',?,nullif(?,''),?,?,?,?,?) on conflict(process_code,step_code) do update set step_order=excluded.step_order,step_name=excluded.step_name,parent_step_code=excluded.parent_step_code,step_type=excluded.step_type,actor_code=excluded.actor_code,from_state=excluded.from_state,command_code=excluded.command_code,to_state=excluded.to_state,completion_rule=excluded.completion_rule,requirement_text=excluded.requirement_text,input_contract=excluded.input_contract,output_contract=excluded.output_contract,requires_user_page=excluded.requires_user_page,requires_admin_page=excluded.requires_admin_page,requires_api=excluded.requires_api,requires_database=excluded.requires_database,requires_notification=excluded.requires_notification,user_path=excluded.user_path,admin_path=excluded.admin_path,api_contract=excluded.api_contract,automation_status='PLANNED',sla_hours=excluded.sla_hours,escalation_actor_code=excluded.escalation_actor_code,evidence_required=excluded.evidence_required,evidence_types=excluded.evidence_types,segregation_actor_codes=excluded.segregation_actor_codes,rollback_command_code=excluded.rollback_command_code,decision_rule=excluded.decision_rule",process,order,step,req(b,"stepName"),str(b,"parentStepCode"),def(b,"stepType","TASK"),actorCode,req(b,"fromState"),req(b,"commandCode"),req(b,"toState"),req(b,"completionRule"),def(b,"requirementText",req(b,"completionRule")),def(b,"inputContract","{}"),def(b,"outputContract","{}"),bool(b,"requiresUserPage"),bool(b,"requiresAdminPage"),bool(b,"requiresApi"),bool(b,"requiresDatabase"),bool(b,"requiresNotification"),str(b,"userPath"),str(b,"adminPath"),str(b,"apiContract"),integerOr(b,"slaHours",0),escalationActorCode,Boolean.parseBoolean(def(b,"evidenceRequired","true")),str(b,"evidenceTypes"),segregationActorCodes,str(b,"rollbackCommandCode"),str(b,"decisionRule"));
        Map<String,Object> trigger=new LinkedHashMap<>();
        trigger.put("triggerType","PROCESS_STEP");trigger.put("stepCode",step);
        Map<String,Object> result=propagate
            ?refreshAndQueueCanonicalProcess(process,actor,trigger)
            :new LinkedHashMap<>(Map.of("success",true,"status","DEFERRED",
                "generationQueued",false,"jobCount",0,"propagationDeferred",true));
        result.put("success",true);result.put("processCode",process);result.put("stepCode",step);
        result.put("generatedJobs",result.getOrDefault("jobCount",0));
        return result;
    }

    @Transactional public Map<String,Object> reconcileRequirementImportSteps(
            String processCode,java.util.Collection<String> requestedStepCodes,String actor){
        String process=req(Map.of("processCode",processCode),"processCode")
            .trim().toUpperCase(Locale.ROOT);
        if(actor==null||actor.isBlank()||!actor.equals(actor.trim())||actor.length()>100)
            throw new SecurityException("AUTHENTICATED_ACTOR_REQUIRED");
        if(requestedStepCodes==null||requestedStepCodes.isEmpty())
            throw new IllegalArgumentException("REQUIREMENT_STEP_SET_REQUIRED");
        java.util.SortedSet<String> requested=new java.util.TreeSet<>();
        for(String raw:requestedStepCodes){
            String step=raw==null?"":raw.trim().toUpperCase(Locale.ROOT);
            if(!step.matches("^[A-Z][A-Z0-9_]{1,79}$"))
                throw new IllegalArgumentException("INVALID_REQUIREMENT_STEP_CODE: "+step);
            if(!requested.add(step))
                throw new IllegalArgumentException("DUPLICATE_REQUIREMENT_STEP_CODE: "+step);
        }
        lockCanonicalProcessPublication(process);
        String exactSet=String.join(",",requested);
        List<Map<String,Object>> obsolete=jdbc.queryForList("""
            select step_code,coalesce(decision_rule,'') decision_rule
              from framework_process_step
             where process_code=?
               and not(step_code=any(string_to_array(?,',')))
             order by step_code
             for update
            """,process,exactSet);
        for(Map<String,Object> row:obsolete){
            String step=String.valueOf(row.get("step_code"));
            if(!"SOURCE:REQUIREMENT_DOCUMENT".equals(row.get("decision_rule")))
                throw new IllegalStateException(
                    "MANUAL_PROCESS_STEP_OMISSION_FORBIDDEN: "+process+" / "+step);
        }
        int removed=0;
        for(Map<String,Object> row:obsolete){
            removed+=jdbc.update("delete from framework_process_step "+
                "where process_code=? and step_code=? and decision_rule='SOURCE:REQUIREMENT_DOCUMENT'",
                process,row.get("step_code"));
        }
        return Map.of("success",true,"processCode",process,"removedStepCount",removed,
            "requestedStepCount",requested.size());
    }

    @Transactional public Map<String,Object> generateDevelopmentPlan(String process,String step,String actor){
        boolean locked=isProcessDefinitionLocked(process);
        Map<String,Object>s=jdbc.queryForMap("select * from framework_process_step where process_code=? and step_code=?",process,step);
        String base=process+"_"+step, requirement=String.valueOf(s.get("requirement_text")); int created=0;
        created+=queueJob(process,step,"DESIGN","액터·프로세스·화면·API·데이터·테스트 설계 정본", "design/"+base.toLowerCase(),requirement,actor);
        if(Boolean.TRUE.equals(s.get("requires_database"))) created+=queueJob(process,step,"DATABASE","DB 스키마·Flyway 마이그레이션", "db/migration/"+base.toLowerCase(),requirement,actor);
        if(Boolean.TRUE.equals(s.get("requires_api"))) { created+=queueJob(process,step,"API","API 계약·컨트롤러",String.valueOf(s.get("api_contract")),requirement,actor); created+=queueJob(process,step,"BACKEND","트랜잭션·권한·감사 서비스", "backend/"+base.toLowerCase(),requirement,actor); }
        if(Boolean.TRUE.equals(s.get("requires_user_page"))) created+=queueJob(process,step,"FRONTEND_USER","사용자 업무 화면",String.valueOf(s.get("user_path")),requirement,actor);
        if(Boolean.TRUE.equals(s.get("requires_admin_page"))) created+=queueJob(process,step,"FRONTEND_ADMIN","대응 관리자 화면",String.valueOf(s.get("admin_path")),requirement,actor);
        if(Boolean.TRUE.equals(s.get("requires_notification"))) created+=queueJob(process,step,"NOTIFICATION","알림·마감 정책", "notification/"+base.toLowerCase(),requirement,actor);
        created+=queueEfficiencyJobs(process,step,s,actor);
        created+=queueJob(process,step,"TEST","정상·예외·권한·격리·복구 테스트", "test/"+base.toLowerCase(),requirement,actor);
        created+=queueJob(process,step,"INTEGRATION","메뉴·권한·다국어·배포 통합", "integration/"+base.toLowerCase(),requirement,actor);
        if(!locked)jdbc.update("update framework_process_step set automation_status='PLANNED' where process_code=? and step_code=?",process,step);
        return Map.of("success",true,"generatedJobs",created,"processCode",process,"stepCode",step);
    }

    private boolean isProcessDefinitionLocked(String process){
        return Boolean.TRUE.equals(jdbc.queryForObject(
            "select coalesce(definition_locked,false) from framework_process_definition where process_code=?",
            Boolean.class,process));
    }

    private int queueEfficiencyJobs(String process,String step,Map<String,Object>s,String actor){
        boolean page=Boolean.TRUE.equals(s.get("requires_user_page"))||Boolean.TRUE.equals(s.get("requires_admin_page"));
        boolean api=Boolean.TRUE.equals(s.get("requires_api"));
        boolean database=Boolean.TRUE.equals(s.get("requires_database"));
        List<Map<String,Object>> templates=jdbc.queryForList("select work_type_code,task_code,task_name,job_type,trigger_scope,requirement_template,target_pattern from framework_development_work_template where active_yn='Y' and auto_queue=true order by task_order,work_type_code,task_code");
        int created=0;
        for(Map<String,Object>template:templates){
            String scope=String.valueOf(template.get("trigger_scope"));
            if(("PAGE".equals(scope)&&!page)||("API".equals(scope)&&!api)||("DATABASE".equals(scope)&&!database))continue;
            String workType=String.valueOf(template.get("work_type_code"));
            String taskCode=String.valueOf(template.get("task_code"));
            String jobType=String.valueOf(template.get("job_type"));
            String path=String.valueOf(template.get("target_pattern")).replace("{process}",process.toLowerCase()).replace("{step}",step.toLowerCase());
            created+=queueJob(process,step,jobType,String.valueOf(template.get("task_name")),path,String.valueOf(template.get("requirement_template")),actor);
            jdbc.update("update framework_development_job set work_type_code=?,template_task_code=?,updated_at=current_timestamp where process_code=? and step_code=? and job_type=? and target_path=?",workType,taskCode,process,step,jobType,path);
        }
        return created;
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
        boolean locked=isProcessDefinitionLocked(process);

        String[][] scenarios={
            {"HAPPY","정상 업무 완료","HAPPY_PATH","담당 액터와 프로젝트 데이터가 준비됨","[\"순서대로 업무 수행\",\"완료 조건 검증\",\"다음 업무 개방\"]","[\"최종 상태가 완료됨\",\"필수 산출물과 감사 이력이 존재함\"]"},
            {"AUTH","권한 없는 작업 차단","AUTHORITY","서로 다른 역할의 계정이 준비됨","[\"권한 없는 액션 시도\",\"담당 액터의 정상 액션 수행\"]","[\"비인가 액션은 차단됨\",\"거부 시도가 감사 기록에 남음\"]"},
            {"ISOLATION","테넌트·프로젝트 데이터 격리","ISOLATION","서로 다른 테넌트와 프로젝트가 준비됨","[\"교차 조회와 수정을 시도\",\"자기 프로젝트를 조회\"]","[\"교차 접근은 403 또는 404\",\"자기 프로젝트 데이터만 반환됨\"]"},
            {"EXCEPTION","필수 데이터 누락과 보완","EXCEPTION","필수 입력이 누락된 업무가 준비됨","[\"불완전 데이터 제출\",\"보완 요청\",\"재제출\"]","[\"불완전 제출은 확정되지 않음\",\"보완 후 다음 단계가 개방됨\"]"},
            {"RECOVERY","실패 후 안전한 재처리","RECOVERY","중간 단계 실패를 재현할 수 있음","[\"처리 실패\",\"동일 요청 재시도\",\"복구 결과 확인\"]","[\"중복 데이터가 생성되지 않음\",\"실패 원인과 복구 이력이 보존됨\"]"}
        };
        if(locked){
            Integer safetyTypes=jdbc.queryForObject("select count(distinct case_type) from framework_simulation_case where process_code=? and case_type in ('HAPPY_PATH','AUTHORITY','ISOLATION','EXCEPTION','RECOVERY')",Integer.class,process);
            if(safetyTypes==null||safetyTypes<5)throw new IllegalStateException("Locked process safety contract is incomplete: "+process+" ("+(safetyTypes==null?0:safetyTypes)+"/5)");
        }else for(String[]s:scenarios){
            jdbc.update("insert into framework_simulation_case(case_code,process_code,case_name,case_type,preconditions,steps_json,assertions_json,case_status) values(?,?,?,?,?,?,?,'READY') on conflict(case_code) do update set case_name=excluded.case_name,case_type=excluded.case_type,preconditions=excluded.preconditions,steps_json=excluded.steps_json,assertions_json=excluded.assertions_json,case_status=case when framework_simulation_case.case_status='APPROVED' then 'APPROVED' else 'READY' end,updated_at=current_timestamp",process+"_"+s[0],process,s[1],s[2],s[3],s[4],s[5]);
        }

        List<Map<String,Object>> steps=jdbc.queryForList("select step_code from framework_process_step where process_code=? order by step_order",process);
        if(steps.isEmpty())throw new IllegalStateException("프로세스 단계가 정의되지 않았습니다: "+process);
        int generated=0,approved=0;
        for(Map<String,Object>row:steps){
            String step=String.valueOf(row.get("step_code"));
            generated+=((Number)generateDevelopmentPlan(process,step,actor).get("generatedJobs")).intValue();
        }
        Map<String,Object> dependencySync=jdbc.queryForMap("select * from framework_sync_development_dependencies(?)",process);
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
                    jdbc.update("update framework_development_job set job_status='VERIFIED',quality_status='VERIFIED',evidence_ref='screen-development-gate:'||?,completed_at=coalesce(completed_at,current_timestamp),last_error=null,updated_at=current_timestamp where process_code=? and step_code=? and job_type='DESIGN_PREFLIGHT'",step,process,step);
                    if(!locked)jdbc.update("update framework_process_step set automation_status='APPROVED' where process_code=? and step_code=?",process,step);
                    approved+=count;
                }else{
                    Map<String,Object> blocked=new LinkedHashMap<>();
                    blocked.put("stepCode",step);
                    blocked.put("failureSummary",preflight.get("failureSummary"));
                    blocked.put("checkedRoutes",preflight.get("checkedRoutes"));
                    blockedSteps.add(blocked);
                    if(!locked)jdbc.update("update framework_process_step set automation_status='PLANNED' where process_code=? and step_code=?",process,step);
                }
            }
        }
        jdbc.update("update framework_process_definition set process_status='IN_DEVELOPMENT',automation_mode='AUTOMATIC',updated_at=current_timestamp where process_code=? and process_status<>'DEVELOPMENT_READY'",process);
        Integer totalJobs=jdbc.queryForObject("select count(*) from framework_development_job where process_code=?",Integer.class,process);
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("success",true);result.put("processCode",process);result.put("stepCount",steps.size());
        result.put("scenarioCount",scenarios.length);result.put("generatedJobs",generated);result.put("approvedJobs",approved);
        result.put("definitionLocked",locked);result.put("scenarioSource",locked?"CANONICAL_REUSED":"GENERATED");
        result.put("dependencySync",dependencySync);
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
        if(!isProcessDefinitionLocked(process))jdbc.update("update framework_process_step set automation_status='APPROVED' where process_code=? and step_code=?",process,step);
        return Map.of("success",true,"approvedJobs",count,"approvedBy",actor);
    }

    @Transactional public Map<String,Object> runScreenDevelopmentPreflight(String process,String step,String actor){
        Integer stepCount=jdbc.queryForObject("select count(*) from framework_process_step where process_code=? and step_code=?",Integer.class,process,step);
        Map<String,Object> designValidation=jdbc.queryForMap("select * from framework_validate_process_design(?,?)",process,actor);
        int designBlockers=((Number)designValidation.getOrDefault("blocker_count",0)).intValue();
        if(designBlockers>0)return Map.of("success",true,"passed",false,"checkedRoutes",0,"passedRoutes",0,
                "failureSummary","프로세스 설계 정합성 차단 항목 "+designBlockers+"건을 먼저 해결해야 합니다.",
                "designValidation",designValidation);
        if(stepCount==null||stepCount==0)throw new IllegalArgumentException("프로세스에 해당 절차가 존재하지 않습니다: "+process+" / "+step);
        List<Map<String,Object>> jobs=jdbc.queryForList("select min(j.job_id) as job_id,min(j.job_type) as job_type,min(j.target_path) as target_path from framework_development_job j join framework_process_step s on s.process_code=j.process_code and s.step_code=j.step_code where j.process_code=? and j.step_code=? and j.job_type in ('FRONTEND_USER','FRONTEND_ADMIN') and j.target_path like '/%' and lower(split_part(j.target_path,'?',1)) in (lower(split_part(coalesce(s.user_path,''),'?',1)),lower(split_part(coalesce(s.admin_path,''),'?',1))) group by lower(split_part(j.target_path,'?',1)) order by min(j.job_id)",process,step);
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
            Integer designAssetCount=jdbc.queryForObject("select count(*) from framework_common_design_asset_coverage where route_path=lower(?) and common_assets_ready",Integer.class,ScreenDevelopmentNoteService.cleanRoute(route));
            boolean designChecked=designAssetCount!=null&&designAssetCount>0;
            Integer professionalScore=jdbc.queryForObject("select coalesce(max(design_readiness_score),0) from framework_professional_screen_design_readiness where process_code=? and step_code=? and lower(split_part(route_path,'?',1))=lower(?)",Integer.class,process,step,ScreenDevelopmentNoteService.cleanRoute(route));
            boolean professionalPassed=professionalScore!=null&&professionalScore==100;
            int score=(notePassed?20:0)+(mockupPassed?20:0)+(actorPassed?15:0)+(safetyPassed?15:0)+(professionalPassed?30:0);
            boolean passed=notePassed&&mockupPassed&&actorPassed&&safetyPassed&&professionalPassed&&designChecked;
            List<String> gaps=new java.util.ArrayList<>();
            if(!notePassed)gaps.add("설계·기능·완료 기준");if(!mockupPassed)gaps.add("선택 HTML 시안");if(!actorPassed)gaps.add("액터 계약");if(!safetyPassed)gaps.add("5대 안전 테스트");
            if(!professionalPassed)gaps.add("전문 화면 설계 계약 100점("+(professionalScore==null?0:professionalScore)+"점)");
            if(!designChecked)gaps.add("공통 테마·섹션·컴포넌트·CSS 참조");
            String summary=String.join(", ",gaps);
            String detail="{\"designNote\":"+notePassed+",\"selectedMockup\":"+mockupPassed+",\"actorContract\":"+actorPassed+",\"safetyScenarioTypes\":"+(safetyTypes==null?0:safetyTypes)+",\"professionalContractScore\":"+(professionalScore==null?0:professionalScore)+",\"designAssetChecked\":"+designChecked+"}";
            jdbc.update("insert into framework_screen_development_gate_run(process_code,step_code,route_path,page_id,gate_status,readiness_score,design_note_passed,selected_mockup_passed,actor_contract_passed,safety_tests_passed,design_asset_checked,check_result_json,failure_summary,executed_by) values(?,?,?,?,?,?,?,?,?,?,?,?,nullif(?,''),?)",process,step,ScreenDevelopmentNoteService.cleanRoute(route),"",passed?"PASSED":"FAILED",score,notePassed,mockupPassed,actorPassed,safetyPassed,designChecked,detail,summary,actor);
            if(passed)passedRoutes++;else failures.add(ScreenDevelopmentNoteService.cleanRoute(route)+" ["+summary+"]");
        }
        return Map.of("success",true,"passed",passedRoutes==jobs.size(),"checkedRoutes",jobs.size(),"passedRoutes",passedRoutes,"failureSummary",String.join("; ",failures));
    }

    @Transactional public Map<String,Object> startProcessExecution(Map<String,Object>b,String user){
        String tenant=req(b,"tenantId"),project=req(b,"projectId"),process=req(b,"processCode"),actor=req(b,"actorCode");
        String cycleType=def(b,"cycleType","ONCE").toUpperCase(Locale.ROOT);
        String periodStart=str(b,"periodStart"),periodEnd=str(b,"periodEnd");
        String boundaryVersion=def(b,"boundaryVersion","CURRENT"),methodologyVersion=def(b,"methodologyVersion","CURRENT");
        String siteScopeJson=def(b,"siteScopeJson","[]"),dataCutoffAt=str(b,"dataCutoffAt");
        int executionVersion=integerOr(b,"executionVersion",1);
        Set<String> cycles=Set.of("ONCE","MONTHLY","QUARTERLY","HALF_YEARLY","ANNUAL","AD_HOC");
        if(!cycles.contains(cycleType))throw new IllegalArgumentException("지원하지 않는 실행 주기입니다: "+cycleType);
        if("ONCE".equals(cycleType)){periodStart="";periodEnd="";}
        else if(periodStart.isBlank()||periodEnd.isBlank())throw new IllegalArgumentException("반복 실행은 periodStart와 periodEnd가 필요합니다.");
        if(executionVersion<1)throw new IllegalArgumentException("executionVersion은 1 이상이어야 합니다.");
        List<Map<String,Object>> steps=jdbc.queryForList("select step_code,actor_code,from_state from framework_process_step where process_code=? order by step_order limit 1",process);
        if(steps.isEmpty())throw new IllegalArgumentException("프로세스 단계가 없습니다: "+process);
        Map<String,Object> first=steps.get(0);String requiredActor=String.valueOf(first.get("actor_code"));
        if(!requiredActor.equals(actor))throw new SecurityException("첫 단계 수행 액터는 "+requiredActor+"입니다.");
        String step=String.valueOf(first.get("step_code"));
        requireActorAssignment(tenant,project,actor,user);
        requireStepPermissionGrants(process,step,actor,str(b,"routePath"),str(b,"audience"));
        List<Map<String,Object>> running=jdbc.queryForList("select execution_id as \"executionId\",current_step_code as \"currentStepCode\",current_state as \"currentState\",cycle_type as \"cycleType\",period_start as \"periodStart\",period_end as \"periodEnd\",execution_version as \"executionVersion\",handoff_status as \"handoffStatus\" from framework_process_execution where tenant_id=? and project_id=? and process_code=? and cycle_type=? and period_start is not distinct from nullif(?,'')::date and period_end is not distinct from nullif(?,'')::date and boundary_version=? and methodology_version=? and execution_version=? and execution_status='RUNNING'",tenant,project,process,cycleType,periodStart,periodEnd,boundaryVersion,methodologyVersion,executionVersion);
        if(!running.isEmpty())return Map.of("success",true,"created",false,"execution",running.get(0));
        UUID id=UUID.randomUUID();String state=String.valueOf(first.get("from_state"));
        assertRelayPrerequisitesReady(tenant,project,process,step);
        jdbc.update("insert into framework_process_execution(execution_id,tenant_id,project_id,process_code,current_step_code,current_state,initiated_by_actor,initiated_by,cycle_type,period_start,period_end,site_scope,boundary_version,methodology_version,data_cutoff_at,execution_version) values(?,?,?,?,?,?,?,?,?,nullif(?,'')::date,nullif(?,'')::date,cast(? as jsonb),?,?,nullif(?,'')::timestamp,?)",id,tenant,project,process,step,state,actor,user,cycleType,periodStart,periodEnd,siteScopeJson,boundaryVersion,methodologyVersion,dataCutoffAt,executionVersion);
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("success",true);result.put("created",true);result.put("executionId",id);result.put("processCode",process);
        result.put("currentStepCode",step);result.put("currentState",state);result.put("actorCode",actor);result.put("cycleType",cycleType);
        result.put("periodStart",periodStart);result.put("periodEnd",periodEnd);result.put("executionVersion",executionVersion);result.put("handoffStatus","NOT_READY");
        return result;
    }

    @Transactional public Map<String,Object> verifyBackendProcessContracts(String sourceCommit,String user){
        List<Map<String,Object>> rows=jdbc.queryForList("select process_code as \"processCode\",case_type as \"caseType\",test_status as \"testStatus\",evidence_hash as \"evidenceHash\" from run_framework_backend_contract_tests(?)",sourceCommit==null?"":sourceCommit);
        long passed=rows.stream().filter(row->"PASSED".equals(String.valueOf(row.get("testStatus")))).count();
        jdbc.update("insert into framework_backend_verification_audit(source_commit,passed_count,total_count,verification_status,executed_by) values(?,?,?,?,?)",sourceCommit==null?"":sourceCommit,passed,rows.size(),passed==rows.size()?"VERIFIED":"FAILED",user);
        return Map.of("success",passed==rows.size(),"passed",passed,"total",rows.size(),"results",rows);
    }

    @Transactional public Map<String,Object> executeProcessCommand(UUID executionId,Map<String,Object>b,String user){
        Map<String,Object> preconditions=resolveProcessCommandPreconditions(executionId,b,user);
        if(preconditions.containsKey("replay"))return (Map<String,Object>)preconditions.get("replay");
        return commitProcessCommand(executionId,b,user,preconditions);
    }

    private Map<String,Object> resolveProcessCommandPreconditions(
            UUID executionId,Map<String,Object>b,String user){
        String tenant=req(b,"tenantId"),project=req(b,"projectId"),process=req(b,"processCode"),step=req(b,"stepCode"),actor=req(b,"actorCode"),command=req(b,"commandCode"),key=req(b,"idempotencyKey");
        List<Map<String,Object>> executions=jdbc.queryForList("select * from framework_process_execution where execution_id=? for update",executionId);
        if(executions.isEmpty())throw new IllegalArgumentException("프로세스 실행 건이 없습니다.");
        Map<String,Object> execution=executions.get(0);
        if(!tenant.equals(String.valueOf(execution.get("tenant_id")))||!project.equals(String.valueOf(execution.get("project_id")))||!process.equals(String.valueOf(execution.get("process_code"))))throw new SecurityException("테넌트·프로젝트·프로세스 실행 문맥이 일치하지 않습니다.");
        requireActorAssignment(tenant,project,actor,user);
        requireStepPermissionGrants(process,step,actor,str(b,"routePath"),str(b,"audience"));
        List<Map<String,Object>> existing=jdbc.queryForList("select event_id as \"eventId\",to_state as \"toState\" from framework_process_execution_event where execution_id=? and idempotency_key=?",executionId,key);
        if(!existing.isEmpty()){
            Map<String,Object> event=existing.get(0);
            Map<String,Object> replay=new LinkedHashMap<>();
            replay.put("success",true);replay.put("idempotent",true);
            replay.put("eventId",event.get("eventId"));replay.put("toState",event.get("toState"));
            return Map.of("replay",replay);
        }
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
        if(!requiredActor.equals(actor))throw new SecurityException("이 단계의 수행 액터는 "+requiredActor+"입니다.");
        if(!requiredCommand.equals(command))throw new IllegalArgumentException("이 단계의 명령은 "+requiredCommand+"입니다.");
        if(!"RUNNING".equals(String.valueOf(execution.get("execution_status"))))throw new IllegalStateException("실행 중인 프로세스가 아닙니다.");
        if(!from.equals(String.valueOf(execution.get("current_state"))))throw new IllegalStateException("현재 상태가 단계 시작 조건과 다릅니다.");
        if(Boolean.parseBoolean(def(b,"requireDraft","false"))){
            List<Map<String,Object>> drafts=jdbc.queryForList("select draft_status,payload_json from framework_process_work_draft where tenant_id=? and project_id=? and process_code=? and step_code=? and lower(account_id)=lower(?) for update",tenant,project,process,step,user);
            if(drafts.isEmpty())throw new IllegalStateException("Save the work data before completing this step.");
            Map<String,Object> draft=drafts.get(0);
            if(!"DRAFT".equals(String.valueOf(draft.get("draft_status"))))throw new IllegalStateException("Only a DRAFT work item can be completed.");
            Object payload=draft.get("payload_json");
            if(payload==null||"{}".equals(String.valueOf(payload)))throw new IllegalStateException("The work draft has no business data.");
            List<String> missingFields=jdbc.queryForList("""
                select field->>'fieldName'
                  from jsonb_array_elements(coalesce(
                    (select nullif(framework_step_contract_fields(execution_spec.field_contract,'USER'),'[]'::jsonb) from framework_step_execution_spec execution_spec where execution_spec.process_code=? and execution_spec.step_code=?),
                    (select framework_try_jsonb(screen_contract.field_contract) from framework_professional_screen_contract screen_contract where screen_contract.process_code=? and screen_contract.step_code=? order by case screen_contract.audience when 'USER' then 0 else 1 end limit 1),
                    '[]'::jsonb
                  )) field
                 where nullif(field->>'fieldCode','') is not null
                   and coalesce((field->>'required')::boolean,false)
                   and coalesce((field->>'editable')::boolean,false)
                   and coalesce(nullif(btrim((?::jsonb)->>(field->>'fieldCode')),''),'')=''
                 order by coalesce((field->>'fieldOrder')::integer,9999),field->>'fieldCode'
                """,String.class,process,step,process,step,String.valueOf(payload));
            if(!missingFields.isEmpty())throw new IllegalStateException("Required work fields are missing: "+String.join(", ",missingFields));
            assertRelayPrerequisitesReady(tenant,project,process,step);
        }
        int order=((Number)contract.get("step_order")).intValue();
        List<Map<String,Object>> next=jdbc.queryForList("select step_code,actor_code,user_path,admin_path from framework_process_step where process_code=? and step_code<>? and from_state=? order by case when step_order>? then 0 else 1 end,step_order limit 1",process,step,to,order);
        List<Map<String,Object>> policies=jdbc.queryForList("select completion_type,snapshot_required from framework_step_completion_policy where process_code=? and step_code=? and use_at='Y'",process,step);
        Map<String,Object> resolved=new LinkedHashMap<>();
        resolved.put("tenant",tenant);resolved.put("project",project);resolved.put("process",process);
        resolved.put("step",step);resolved.put("actor",actor);resolved.put("command",command);resolved.put("key",key);
        resolved.put("from",from);resolved.put("to",to);resolved.put("execution",execution);
        resolved.put("next",next);resolved.put("snapshotRequired",!policies.isEmpty()&&Boolean.TRUE.equals(policies.get(0).get("snapshot_required")));
        return resolved;
    }

    @SuppressWarnings("unchecked")
    private Map<String,Object> commitProcessCommand(
            UUID executionId,Map<String,Object>b,String user,Map<String,Object> preconditions){
        String tenant=String.valueOf(preconditions.get("tenant")),project=String.valueOf(preconditions.get("project"));
        String process=String.valueOf(preconditions.get("process")),step=String.valueOf(preconditions.get("step"));
        String actor=String.valueOf(preconditions.get("actor")),command=String.valueOf(preconditions.get("command"));
        String key=String.valueOf(preconditions.get("key")),from=String.valueOf(preconditions.get("from")),to=String.valueOf(preconditions.get("to"));
        Map<String,Object> execution=(Map<String,Object>)preconditions.get("execution");
        List<Map<String,Object>> next=(List<Map<String,Object>>)preconditions.get("next");
        Long eventId=jdbc.queryForObject("insert into framework_process_execution_event(execution_id,step_code,actor_code,command_code,from_state,to_state,idempotency_key,request_json,result_json,executed_by) values(?,?,?,?,?,?,?,?,?,?) returning event_id",Long.class,executionId,step,actor,command,from,to,key,def(b,"requestJson","{}"),def(b,"resultJson","{}"),user);
        String snapshotRef=def(b,"snapshotRef","");
        if(Boolean.TRUE.equals(preconditions.get("snapshotRequired"))&&snapshotRef.isBlank())
            snapshotRef=executionId+":"+step+":"+eventId;
        if(next.isEmpty())jdbc.update("update framework_process_execution set current_state=?,execution_status='COMPLETED',handoff_status='HANDED_OFF',snapshot_ref=nullif(?,''),completed_at=current_timestamp,updated_at=current_timestamp where execution_id=?",to,snapshotRef,executionId);
        else jdbc.update("update framework_process_execution set current_step_code=?,current_state=?,handoff_status='HANDED_OFF',snapshot_ref=nullif(?,''),updated_at=current_timestamp where execution_id=?",String.valueOf(next.get(0).get("step_code")),to,snapshotRef,executionId);
        jdbc.update("update framework_process_work_draft set draft_status='SUBMITTED',submitted_at=current_timestamp,updated_at=current_timestamp where tenant_id=? and project_id=? and process_code=? and step_code=? and lower(account_id)=lower(?) and draft_status='DRAFT'",tenant,project,process,step,user);
        Map<String,Object> nextProcess=next.isEmpty()?startChainedProcess(tenant,project,process,execution,user):Map.of();
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("success",true);result.put("idempotent",false);result.put("eventId",eventId);result.put("fromState",from);result.put("toState",to);
        result.put("executionStatus",next.isEmpty()?"COMPLETED":"RUNNING");result.put("nextStepCode",next.isEmpty()?"":String.valueOf(next.get(0).get("step_code")));
        result.put("nextActorCode",next.isEmpty()?"":String.valueOf(next.get(0).get("actor_code")));result.put("nextUserPath",next.isEmpty()?"":String.valueOf(next.get(0).get("user_path")));
        result.put("nextAdminPath",next.isEmpty()?"":String.valueOf(next.get(0).get("admin_path")));result.put("handoffStatus","HANDED_OFF");result.put("snapshotRef",snapshotRef);
        result.putAll(nextProcess);return result;
    }

    @SuppressWarnings("unchecked")
    private Map<String,Object> predictProcessCommandResult(
            UUID executionId,Map<String,Object>b,Map<String,Object> preconditions){
        List<Map<String,Object>> next=(List<Map<String,Object>>)preconditions.get("next");
        String step=String.valueOf(preconditions.get("step"));
        String snapshotRef=def(b,"snapshotRef","");
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("success",true);result.put("idempotent",false);
        result.put("fromState",preconditions.get("from"));result.put("toState",preconditions.get("to"));
        result.put("executionStatus",next.isEmpty()?"COMPLETED":"RUNNING");
        result.put("nextStepCode",next.isEmpty()?"":String.valueOf(next.get(0).get("step_code")));
        result.put("nextActorCode",next.isEmpty()?"":String.valueOf(next.get(0).get("actor_code")));
        result.put("nextUserPath",next.isEmpty()?"":String.valueOf(next.get(0).get("user_path")));
        result.put("nextAdminPath",next.isEmpty()?"":String.valueOf(next.get(0).get("admin_path")));
        result.put("handoffStatus","HANDED_OFF");result.put("snapshotRef",snapshotRef);
        result.put("snapshotRequired",preconditions.get("snapshotRequired"));
        result.put("predictedEventRef",executionId+":"+step+":<allocated-on-commit>");
        if(next.isEmpty())result.putAll(predictChainedProcess(preconditions));
        return result;
    }

    @SuppressWarnings("unchecked")
    private Map<String,Object> predictChainedProcess(Map<String,Object> preconditions){
        String tenant=String.valueOf(preconditions.get("tenant")),project=String.valueOf(preconditions.get("project"));
        String completedProcess=String.valueOf(preconditions.get("process"));
        Map<String,Object> completedExecution=(Map<String,Object>)preconditions.get("execution");
        List<Map<String,Object>> chain=jdbc.queryForList("select next_process_code from framework_process_chain where process_code=? and use_at='Y' and auto_start_yn='Y' and nullif(next_process_code,'') is not null order by process_order limit 1",completedProcess);
        if(chain.isEmpty())return Map.of("relayCompleted",true);
        String nextProcess=String.valueOf(chain.get(0).get("next_process_code"));
        List<Map<String,Object>> firstSteps=jdbc.queryForList("select step_code,actor_code,from_state,user_path,admin_path from framework_process_step where process_code=? order by step_order limit 1",nextProcess);
        if(firstSteps.isEmpty())throw new IllegalStateException("다음 프로세스 단계가 없습니다: "+nextProcess);
        int relayExecutionVersion=((Number)completedExecution.getOrDefault("execution_version",1)).intValue();
        List<Map<String,Object>> active=jdbc.queryForList("select execution_id,current_step_code from framework_process_execution where tenant_id=? and project_id=? and process_code=? and execution_version=? and execution_status='RUNNING' order by started_at desc limit 1",tenant,project,nextProcess,relayExecutionVersion);
        Map<String,Object> relayStep=firstSteps.get(0);
        Object nextExecutionId="";
        if(!active.isEmpty()){
            Map<String,Object> activeExecution=active.get(0);
            nextExecutionId=activeExecution.get("execution_id");
            String activeStepCode=String.valueOf(activeExecution.get("current_step_code"));
            relayStep=jdbc.queryForList("select step_code,actor_code,from_state,user_path,admin_path from framework_process_step where process_code=? and step_code=?",nextProcess,activeStepCode)
                    .stream().findFirst().orElseThrow(()->new IllegalStateException("활성 다음 프로세스의 현재 단계 계약이 없습니다: "+nextProcess+"/"+activeStepCode));
        }
        assertRelayPrerequisitesReady(tenant,project,nextProcess,String.valueOf(relayStep.get("step_code")));
        Map<String,Object> prediction=new LinkedHashMap<>();
        prediction.put("nextProcessCode",nextProcess);prediction.put("nextProcessExecutionId",nextExecutionId);
        prediction.put("nextProcessExecutionPending",active.isEmpty());
        prediction.put("nextProcessStepCode",String.valueOf(relayStep.get("step_code")));
        prediction.put("nextProcessActorCode",String.valueOf(relayStep.get("actor_code")));
        prediction.put("nextProcessUserPath",String.valueOf(relayStep.get("user_path")));
        prediction.put("nextProcessAdminPath",String.valueOf(relayStep.get("admin_path")));
        prediction.put("relayCompleted",false);
        return prediction;
    }
    private Map<String,Object> startChainedProcess(String tenant,String project,String completedProcess,Map<String,Object> completedExecution,String user){
        List<Map<String,Object>> chain=jdbc.queryForList("select next_process_code from framework_process_chain where process_code=? and use_at='Y' and auto_start_yn='Y' and nullif(next_process_code,'') is not null order by process_order limit 1",completedProcess);
        if(chain.isEmpty())return Map.of("relayCompleted",true);
        String nextProcess=String.valueOf(chain.get(0).get("next_process_code"));
        List<Map<String,Object>> firstSteps=jdbc.queryForList("select step_code,actor_code,from_state,user_path,admin_path from framework_process_step where process_code=? order by step_order limit 1",nextProcess);
        if(firstSteps.isEmpty())throw new IllegalStateException("다음 프로세스 단계가 없습니다: "+nextProcess);
        Map<String,Object> first=firstSteps.get(0);
        int relayExecutionVersion=((Number)completedExecution.getOrDefault("execution_version",1)).intValue();
        List<Map<String,Object>> active=jdbc.queryForList("select execution_id,current_step_code from framework_process_execution where tenant_id=? and project_id=? and process_code=? and execution_version=? and execution_status='RUNNING' order by started_at desc limit 1",tenant,project,nextProcess,relayExecutionVersion);
        UUID nextExecutionId;
        Map<String,Object> relayStep=first;
        if(active.isEmpty()){
            nextExecutionId=UUID.randomUUID();
            jdbc.update("insert into framework_process_execution(execution_id,tenant_id,project_id,process_code,current_step_code,current_state,initiated_by_actor,initiated_by,cycle_type,period_start,period_end,site_scope,boundary_version,methodology_version,execution_version,handoff_status) values(?,?,?,?,?,?,?,?,?,nullif(?,'')::date,nullif(?,'')::date,cast(? as jsonb),?,?,?,?)",
                nextExecutionId,tenant,project,nextProcess,String.valueOf(first.get("step_code")),String.valueOf(first.get("from_state")),String.valueOf(first.get("actor_code")),user,
                valueOr(completedExecution,"cycle_type","ONCE"),valueOr(completedExecution,"period_start",""),valueOr(completedExecution,"period_end",""),valueOr(completedExecution,"site_scope","[]"),
                valueOr(completedExecution,"boundary_version","CURRENT"),valueOr(completedExecution,"methodology_version","CURRENT"),
                relayExecutionVersion,"READY");
        }else{
            Map<String,Object> activeExecution=active.get(0);
            nextExecutionId=(UUID)activeExecution.get("execution_id");
            String activeStepCode=String.valueOf(activeExecution.get("current_step_code"));
            relayStep=jdbc.queryForList("select step_code,actor_code,from_state,user_path,admin_path from framework_process_step where process_code=? and step_code=?",nextProcess,activeStepCode)
                .stream().findFirst().orElseThrow(()->new IllegalStateException("활성 다음 프로세스의 현재 단계 계약이 없습니다: "+nextProcess+"/"+activeStepCode));
        }
        assertRelayPrerequisitesReady(tenant,project,nextProcess,String.valueOf(relayStep.get("step_code")));
        return Map.of(
            "nextProcessCode",nextProcess,
            "nextProcessExecutionId",nextExecutionId,
            "nextProcessStepCode",String.valueOf(relayStep.get("step_code")),
            "nextProcessActorCode",String.valueOf(relayStep.get("actor_code")),
            "nextProcessUserPath",String.valueOf(relayStep.get("user_path")),
            "nextProcessAdminPath",String.valueOf(relayStep.get("admin_path")),
            "relayCompleted",false
        );
    }



    /**
     * Runs the same command checks used by customer screens, but resolves the account
     * assigned to the current step instead of trusting a control-plane supplied
     * account id. Validation returns before event-id allocation or any DML; advancement
     * continues through the canonical committed command path.
     */
    @Transactional
    public Map<String,Object> validateProcessCommandFromControlPlane(
            UUID executionId, Map<String,Object> options, String operator) {
        Map<String,Object> context=controlPlaneExecutionCommand(executionId,options);
        Map<String,Object> request=(Map<String,Object>)context.get("request");
        Map<String,Object> preconditions=resolveProcessCommandPreconditions(
                executionId,request,String.valueOf(context.get("accountId")));
        Map<String,Object> result=preconditions.containsKey("replay")
                ? new LinkedHashMap<>((Map<String,Object>)preconditions.get("replay"))
                : predictProcessCommandResult(executionId,request,preconditions);
        Map<String,Object> response=new LinkedHashMap<>(result);
        response.put("success",true);
        response.put("validated",true);
        response.put("committed",false);
        response.put("operator",operator);
        response.put("accountId",context.get("accountId"));
        response.put("executionId",executionId);
        response.put("mutationScope","READ_ONLY_VALIDATION");
        response.put("databaseCurrentWrites",0);
        return response;
    }

    @Transactional
    public Map<String,Object> advanceProcessCommandFromControlPlane(
            UUID executionId, Map<String,Object> options, String operator) {
        Map<String,Object> context=controlPlaneExecutionCommand(executionId,options);
        Map<String,Object> result=executeProcessCommand(
                executionId,
                (Map<String,Object>)context.get("request"),
                String.valueOf(context.get("accountId")));
        Map<String,Object> response=new LinkedHashMap<>(result);
        response.put("committed",true);
        response.put("operator",operator);
        response.put("accountId",context.get("accountId"));
        response.put("executionId",executionId);
        return response;
    }

    private Map<String,Object> controlPlaneExecutionCommand(
            UUID executionId, Map<String,Object> options) {
        List<Map<String,Object>> rows=jdbc.queryForList("""
            select e.tenant_id as "tenantId",e.project_id as "projectId",
                   e.process_code as "processCode",e.current_step_code as "stepCode",
                   e.execution_status as "executionStatus",
                   s.actor_code as "actorCode",s.command_code as "commandCode"
              from framework_process_execution e
              join framework_process_step s
                on s.process_code=e.process_code and s.step_code=e.current_step_code
             where e.execution_id=?
            """,executionId);
        if(rows.isEmpty())throw new IllegalArgumentException("프로세스 실행 건이 없습니다.");
        Map<String,Object> execution=rows.get(0);
        if(!"RUNNING".equals(String.valueOf(execution.get("executionStatus")))){
            throw new IllegalStateException("실행 중인 프로세스가 아닙니다.");
        }
        String requestingAccount=String.valueOf(options.getOrDefault("requestingAccount","")).trim();
        if(requestingAccount.isBlank()){
            throw new SecurityException("Authenticated control-plane account is required.");
        }
        boolean administrator=isControlPlaneAdministrator(requestingAccount);
        List<Map<String,Object>> accounts=administrator
                ? jdbc.queryForList("""
                    select assignment.account_id as "accountId"
                      from framework_account_actor_assignment assignment
                      join framework_actor_definition actor
                        on actor.actor_code=assignment.actor_code and actor.use_at='Y'
                     where assignment.tenant_id=? and (assignment.project_id=? or assignment.project_id='*') and assignment.actor_code=?
                       and assignment.assignment_status='ACTIVE'
                       and (assignment.valid_from is null or assignment.valid_from<=current_date)
                       and (assignment.valid_until is null or assignment.valid_until>=current_date)
                     order by case when assignment.project_id=? then 0 else 1 end,assignment.account_id
                     limit 1
                    """,execution.get("tenantId"),execution.get("projectId"),execution.get("actorCode"),
                        execution.get("projectId"))
                : jdbc.queryForList("""
                    select assignment.account_id as "accountId"
                      from framework_account_actor_assignment assignment
                      join framework_actor_definition actor
                        on actor.actor_code=assignment.actor_code and actor.use_at='Y'
                     where assignment.tenant_id=? and (assignment.project_id=? or assignment.project_id='*') and assignment.actor_code=?
                       and lower(assignment.account_id)=lower(?)
                       and assignment.assignment_status='ACTIVE'
                       and (assignment.valid_from is null or assignment.valid_from<=current_date)
                       and (assignment.valid_until is null or assignment.valid_until>=current_date)
                     order by case when assignment.project_id=? then 0 else 1 end
                     limit 1
                    """,execution.get("tenantId"),execution.get("projectId"),execution.get("actorCode"),
                        requestingAccount,execution.get("projectId"));
        if(accounts.isEmpty()){
            throw new SecurityException(
                    "현재 단계 액터에 활성 계정이 배정되지 않았습니다: "+execution.get("actorCode"));
        }
        boolean domainCompletionVerified=verifyDomainCompletion(execution);
        Map<String,Object> request=new LinkedHashMap<>();
        request.put("tenantId",execution.get("tenantId"));
        request.put("projectId",execution.get("projectId"));
        request.put("processCode",execution.get("processCode"));
        request.put("stepCode",execution.get("stepCode"));
        request.put("actorCode",execution.get("actorCode"));
        request.put("commandCode",execution.get("commandCode"));
        request.put("idempotencyKey",String.valueOf(
                options.getOrDefault("idempotencyKey","backstage-"+UUID.randomUUID())));
        request.put("requestJson",String.valueOf(
                options.getOrDefault("requestJson","{\"source\":\"BACKSTAGE_CONTROL_PLANE\"}")));
        request.put("resultJson",String.valueOf(options.getOrDefault("resultJson","{}")));
        if(options.containsKey("requestedToState")){
            request.put("requestedToState",String.valueOf(options.get("requestedToState")));
        }
        request.put("requireDraft",String.valueOf(
                domainCompletionVerified ? false : options.getOrDefault("requireDraft","true")));
        return Map.of(
                "request",request,
                "accountId",String.valueOf(accounts.get(0).get("accountId")));
    }

    /**
     * Metadata-driven screens use framework_process_work_draft as their source
     * of truth. A domain workflow must instead be completed through its own
     * transactional API. This adapter prevents the control plane from advancing
     * a real emission project merely because a generic draft exists.
     */
    boolean verifyDomainCompletion(Map<String,Object> execution) {
        if(!"EMISSION_PROJECT".equals(String.valueOf(execution.get("processCode"))))return false;
        String taskCode=switch(String.valueOf(execution.get("stepCode"))){
            case "EMISSION_PROJECT_SETUP" -> "BASIC_INFO";
            case "EMISSION_PROJECT_COLLECT","EMISSION_PROJECT_CORRECT" -> "ACTIVITY_DATA";
            case "EMISSION_PROJECT_CALCULATE" -> "CALCULATION";
            case "EMISSION_PROJECT_VALIDATE" -> "VERIFICATION";
            case "EMISSION_PROJECT_APPROVE" -> "APPROVAL";
            case "EMISSION_PROJECT_REPORT" -> "REPORT";
            case "EMISSION_PROJECT_REGULATORY_SUBMISSION" -> "REGULATORY_SUBMISSION";
            default -> "";
        };
        if(taskCode.isBlank())return false;
        List<Map<String,Object>> tasks=jdbc.queryForList("""
            select t.task_status as "taskStatus",coalesce(t.blocked_reason,'') as "blockedReason",
                   t.target_url as "targetUrl"
              from emission_project_task t
              join emission_project_registry p on p.project_id=t.project_id
             where t.project_id=? and p.tenant_id=? and t.task_code=?
             limit 1
            """,execution.get("projectId"),execution.get("tenantId"),taskCode);
        if(tasks.isEmpty()){
            throw new IllegalStateException(String.format(
                    "Emission project workflow binding is missing or orphaned: tenant=%s, project=%s, step=%s.",
                    execution.get("tenantId"),execution.get("projectId"),execution.get("stepCode")));
        }
        Map<String,Object> task=tasks.get(0);
        if("DONE".equals(String.valueOf(task.get("taskStatus"))))return true;
        if("ACTIVITY_DATA".equals(taskCode)){
            Map<String,Object> readiness=jdbc.queryForMap("""
                select
                  (select count(*) from emission_activity_data
                    where project_id=? and tenant_id=?) as "activityCount",
                  coalesce((select submit_ready from emission_activity_quality_run
                    where project_id=? and tenant_id=?
                    order by executed_at desc,run_id desc limit 1),false) as "qualityReady",
                  (select count(*) from emission_activity_submission
                    where project_id=? and tenant_id=? and submission_state='SUBMITTED') as "submittedCount",
                  (select count(*) from emission_activity_request
                    where project_id=? and tenant_id=?
                      and request_status in ('REQUESTED','IN_PROGRESS','SUBMITTED','CORRECTION_REQUIRED')) as "openRequestCount"
                """,
                execution.get("projectId"),execution.get("tenantId"),
                execution.get("projectId"),execution.get("tenantId"),
                execution.get("projectId"),execution.get("tenantId"),
                execution.get("projectId"),execution.get("tenantId"));
            throw new IllegalStateException(String.format(
                    "Activity data is not complete: saved=%s, qualityReady=%s, submitted=%s, openRequests=%s. "
                            +"Complete collection, quality check, submission, and manager acceptance in %s.",
                    readiness.get("activityCount"),readiness.get("qualityReady"),
                    readiness.get("submittedCount"),readiness.get("openRequestCount"),
                    task.get("targetUrl")));
        }
        throw new IllegalStateException(String.format(
                "Domain task %s is %s. Complete it in %s%s.",
                taskCode,task.get("taskStatus"),task.get("targetUrl"),
                String.valueOf(task.get("blockedReason")).isBlank()
                        ? "" : " ("+task.get("blockedReason")+")"));
    }

    /**
     * Executes the real process runtime against an isolated transaction and always rolls it back.
     * This is intentionally database-driven: the fixture is selected from active actor assignments
     * and current process contracts, so new generated processes are covered without Java changes.
     */
    @Transactional public Map<String,Object> runProcessRuntimeSmoke(String requestedProcess,String executedBy){
        String processFilter=requestedProcess==null?"":requestedProcess.trim();
        List<Map<String,Object>> fixtures=jdbc.queryForList("select a.tenant_id as \"tenantId\",a.project_id as \"projectId\",a.account_id as \"accountId\",s.process_code as \"processCode\",s.step_code as \"stepCode\",s.actor_code as \"actorCode\",s.command_code as \"commandCode\",s.from_state as \"fromState\",s.to_state as \"toState\" from framework_account_actor_assignment a join framework_actor_definition actor on actor.actor_code=a.actor_code and actor.use_at='Y' join framework_process_step s on s.actor_code=a.actor_code and s.step_order=(select min(first_step.step_order) from framework_process_step first_step where first_step.process_code=s.process_code) where a.assignment_status='ACTIVE' and a.project_id<>'*' and (?='' or s.process_code=?) and not exists(select 1 from framework_process_execution e where e.tenant_id=a.tenant_id and e.project_id=a.project_id and e.process_code=s.process_code and e.execution_status='RUNNING') order by a.project_id,s.process_code limit 1",processFilter,processFilter);
        if(fixtures.isEmpty())throw new IllegalStateException("No isolated actor/process fixture is available for runtime smoke testing.");
        Map<String,Object> fixture=fixtures.get(0);
        String tenant=String.valueOf(fixture.get("tenantId")),project=String.valueOf(fixture.get("projectId"));
        String account=String.valueOf(fixture.get("accountId")),process=String.valueOf(fixture.get("processCode"));
        String step=String.valueOf(fixture.get("stepCode")),actor=String.valueOf(fixture.get("actorCode"));
        String command=String.valueOf(fixture.get("commandCode")),key="runtime-smoke-"+UUID.randomUUID();
        Map<String,Object> context=Map.of("tenantId",tenant,"projectId",project,"processCode",process,"actorCode",actor);
        Map<String,Object> started=startProcessExecution(context,account);
        UUID executionId=UUID.fromString(String.valueOf(started.get("executionId")));
        Map<String,Object> request=new LinkedHashMap<>(context);
        request.put("stepCode",step);request.put("commandCode",command);request.put("idempotencyKey",key);
        request.put("requestJson","{\"smoke\":true}");request.put("resultJson","{\"rolledBack\":true}");
        String smokePayload=jdbc.queryForObject("""
            select coalesce(jsonb_object_agg(
                     field->>'fieldCode',
                     case
                       when upper(coalesce(field->>'dataType','')) in ('INTEGER','DECIMAL','NUMBER') then '1'::jsonb
                       when upper(coalesce(field->>'dataType','')) in ('BOOLEAN','BOOL') then 'true'::jsonb
                       when upper(coalesce(field->>'controlType','')) = 'PROJECT_SELECT' then to_jsonb(?::text)
                       when upper(coalesce(field->>'controlType','')) = 'ACTOR_SELECT' then to_jsonb(?::text)
                       else to_jsonb('runtime-smoke'::text)
                     end
                   ),'{"runtimeSmoke":true}'::jsonb)::text
              from jsonb_array_elements(coalesce(
                (select nullif(framework_step_contract_fields(execution_spec.field_contract,'USER'),'[]'::jsonb) from framework_step_execution_spec execution_spec where execution_spec.process_code=? and execution_spec.step_code=?),
                (select framework_try_jsonb(screen_contract.field_contract) from framework_professional_screen_contract screen_contract where screen_contract.process_code=? and screen_contract.step_code=? order by case screen_contract.audience when 'USER' then 0 else 1 end limit 1),
                '[]'::jsonb
             )) field
             where nullif(field->>'fieldCode','') is not null
               and coalesce((field->>'editable')::boolean,false)
            """,String.class,project,actor,process,step,process,step);
        Integer editableFieldCount=jdbc.queryForObject("select count(*)::integer from jsonb_object_keys(?::jsonb)",Integer.class,smokePayload);
        Integer requiredFieldCount=jdbc.queryForObject("""
            select count(distinct field->>'fieldCode')
              from jsonb_array_elements(coalesce(
                (select nullif(framework_step_contract_fields(execution_spec.field_contract,'USER'),'[]'::jsonb) from framework_step_execution_spec execution_spec where execution_spec.process_code=? and execution_spec.step_code=?),
                (select framework_try_jsonb(screen_contract.field_contract) from framework_professional_screen_contract screen_contract where screen_contract.process_code=? and screen_contract.step_code=? order by case screen_contract.audience when 'USER' then 0 else 1 end limit 1),
                '[]'::jsonb
              )) field
             where nullif(field->>'fieldCode','') is not null
               and coalesce((field->>'required')::boolean,false)
               and coalesce((field->>'editable')::boolean,false)
            """,Integer.class,process,step,process,step);
        jdbc.update("delete from framework_process_work_draft where tenant_id=? and project_id=? and process_code=? and step_code=? and lower(account_id)=lower(?)",tenant,project,process,step,account);
        request.put("requireDraft",true);
        boolean requiredValidationRejected=false;
        int incompleteVersion=0;
        if(requiredFieldCount!=null&&requiredFieldCount>0){
            Map<String,Object> incompleteDraft=saveWorkDraft(Map.of(
                "tenantId",tenant,"projectId",project,"processCode",process,"stepCode",step,
                "actorCode",actor,"payloadJson","{\"runtimeMarker\":\"incomplete\"}","evidenceJson","{}","expectedVersion",0
            ),account);
            try{
                executeProcessCommand(executionId,request,account);
            }catch(IllegalStateException expected){requiredValidationRejected=expected.getMessage()!=null&&expected.getMessage().startsWith("Required work fields are missing:");}
            incompleteVersion=((Number)((Map<?,?>)incompleteDraft.get("draft")).get("draftVersion")).intValue();
        }
        boolean requiredValidationVerified=(requiredFieldCount==null||requiredFieldCount==0)||requiredValidationRejected;
        Map<String,Object> savedDraft=saveWorkDraft(Map.of(
            "tenantId",tenant,"projectId",project,"processCode",process,"stepCode",step,
            "actorCode",actor,"payloadJson",smokePayload,"evidenceJson","{\"runtimeSmoke\":true}","expectedVersion",incompleteVersion
        ),account);
        Map<String,Object> reloadedDraft=loadWorkDraft(tenant,project,process,step,account);
        Map<?,?> reloaded=(Map<?,?>)reloadedDraft.get("draft");
        int savedVersion=((Number)((Map<?,?>)savedDraft.get("draft")).get("draftVersion")).intValue();
        Integer reloadedFieldCount=jdbc.queryForObject("select count(*)::integer from jsonb_object_keys(?::jsonb)",Integer.class,String.valueOf(reloaded.get("payloadJson")));
        boolean draftRoundTripVerified=Boolean.TRUE.equals(reloadedDraft.get("found"))
            && savedVersion==incompleteVersion+1
            && savedVersion==((Number)reloaded.get("draftVersion")).intValue()
            && java.util.Objects.equals(editableFieldCount,reloadedFieldCount);
        boolean staleVersionRejected=false;
        try{
            saveWorkDraft(Map.of(
                "tenantId",tenant,"projectId",project,"processCode",process,"stepCode",step,
                "actorCode",actor,"payloadJson",smokePayload,"evidenceJson","{}","expectedVersion",incompleteVersion
            ),account);
        }catch(IllegalStateException expected){staleVersionRejected=true;}
        Map<String,Object> first=executeProcessCommand(executionId,request,account);
        String submittedDraftStatus=jdbc.queryForObject(
            "select draft_status from framework_process_work_draft where tenant_id=? and project_id=? and process_code=? and step_code=? and lower(account_id)=lower(?)",
            String.class,tenant,project,process,step,account);
        boolean draftSubmittedVerified="SUBMITTED".equals(submittedDraftStatus);
        Map<String,Object> duplicate=executeProcessCommand(executionId,request,account);
        boolean recoveryVerified=Boolean.TRUE.equals(duplicate.get("idempotent"));
        boolean isolationRejected=false;
        try{
            Map<String,Object> crossTenant=new LinkedHashMap<>(request);crossTenant.put("tenantId",tenant+"-CROSS-TENANT");crossTenant.put("idempotencyKey",key+"-isolation");
            executeProcessCommand(executionId,crossTenant,account);
        }catch(IllegalArgumentException|SecurityException expected){isolationRejected=true;}
        boolean authorityRejected=false;
        try{
            Map<String,Object> wrongActor=new LinkedHashMap<>(request);wrongActor.put("actorCode","UNAUTHORIZED_ACTOR");wrongActor.put("idempotencyKey",key+"-authority");
            executeProcessCommand(executionId,wrongActor,account);
        }catch(IllegalArgumentException|SecurityException expected){authorityRejected=true;}
        boolean exceptionRejected=false;
        try{
            String exceptionStep=String.valueOf(first.getOrDefault("nextStepCode",step));
            String exceptionActor=String.valueOf(first.getOrDefault("nextActorCode",actor));
            List<Map<String,Object>> exceptionAccounts=jdbc.queryForList("select assignment.account_id as \"accountId\" from framework_account_actor_assignment assignment join framework_actor_definition actor on actor.actor_code=assignment.actor_code and actor.use_at='Y' where assignment.tenant_id=? and assignment.project_id=? and assignment.actor_code=? and assignment.assignment_status='ACTIVE' order by assignment.account_id limit 1",tenant,project,exceptionActor);
            if(exceptionAccounts.isEmpty())throw new IllegalStateException("No active account is assigned for exception-path actor: "+exceptionActor);
            Map<String,Object> invalidCommand=new LinkedHashMap<>(request);invalidCommand.put("stepCode",exceptionStep);invalidCommand.put("actorCode",exceptionActor);invalidCommand.put("commandCode","INVALID_COMMAND");invalidCommand.put("idempotencyKey",key+"-exception");
            executeProcessCommand(executionId,invalidCommand,String.valueOf(exceptionAccounts.get(0).get("accountId")));
        }catch(IllegalArgumentException|IllegalStateException expected){exceptionRejected=true;}
        List<Map<String,Object>> transitions=new java.util.ArrayList<>();
        transitions.add(Map.of("stepCode",step,"actorCode",actor,"commandCode",command,"fromState",fixture.get("fromState"),"toState",fixture.get("toState"),"accountId",account));
        String executionStatus=String.valueOf(first.getOrDefault("executionStatus","RUNNING"));
        String nextStepCode=String.valueOf(first.getOrDefault("nextStepCode",""));
        int sequence=1;
        int workflowDraftStepCount=1,workflowDraftFieldCount=editableFieldCount==null?0:editableFieldCount;
        boolean workflowDraftsVerified=draftRoundTripVerified&&draftSubmittedVerified;
        java.util.Set<String> visitedSteps=new java.util.LinkedHashSet<>();visitedSteps.add(step);
        while(!nextStepCode.isBlank()&&sequence<100){
            if(!visitedSteps.add(nextStepCode))throw new IllegalStateException("Process runtime entered a cycle at step: "+nextStepCode);
            List<Map<String,Object>> nextSteps=jdbc.queryForList("select step_code as \"stepCode\",actor_code as \"actorCode\",command_code as \"commandCode\",from_state as \"fromState\",to_state as \"toState\" from framework_process_step where process_code=? and step_code=?",process,nextStepCode);
            if(nextSteps.isEmpty())throw new IllegalStateException("The next process step contract does not exist: "+nextStepCode);
            Map<String,Object> nextStep=nextSteps.get(0);
            String nextActor=String.valueOf(nextStep.get("actorCode"));
            List<Map<String,Object>> accounts=jdbc.queryForList("select assignment.account_id as \"accountId\" from framework_account_actor_assignment assignment join framework_actor_definition actor on actor.actor_code=assignment.actor_code and actor.use_at='Y' where assignment.tenant_id=? and assignment.project_id=? and assignment.actor_code=? and assignment.assignment_status='ACTIVE' and (assignment.valid_from is null or assignment.valid_from<=current_date) and (assignment.valid_until is null or assignment.valid_until>=current_date) order by assignment.account_id limit 1",tenant,project,nextActor);
            if(accounts.isEmpty())throw new IllegalStateException("No active account is assigned for process actor: "+nextActor);
            String nextAccount=String.valueOf(accounts.get(0).get("accountId")),nextKey=key+"-step-"+(++sequence);
            Map<String,Object> nextRequest=new LinkedHashMap<>();nextRequest.put("tenantId",tenant);nextRequest.put("projectId",project);nextRequest.put("processCode",process);nextRequest.put("stepCode",String.valueOf(nextStep.get("stepCode")));nextRequest.put("actorCode",nextActor);nextRequest.put("commandCode",String.valueOf(nextStep.get("commandCode")));nextRequest.put("idempotencyKey",nextKey);nextRequest.put("requestJson","{\"smoke\":true,\"sequence\":"+sequence+"}");nextRequest.put("resultJson","{\"rolledBack\":true}");
            String nextPayload=runtimeSmokePayload(process,String.valueOf(nextStep.get("stepCode")),project,nextActor);
            Integer nextFieldCount=jdbc.queryForObject("select count(*)::integer from jsonb_object_keys(?::jsonb)",Integer.class,nextPayload);
            if(nextFieldCount!=null&&nextFieldCount>0){
                jdbc.update("delete from framework_process_work_draft where tenant_id=? and project_id=? and process_code=? and step_code=? and lower(account_id)=lower(?)",tenant,project,process,nextStep.get("stepCode"),nextAccount);
                Map<String,Object> nextSaved=saveWorkDraft(Map.of(
                    "tenantId",tenant,"projectId",project,"processCode",process,"stepCode",String.valueOf(nextStep.get("stepCode")),
                    "actorCode",nextActor,"payloadJson",nextPayload,"evidenceJson","{\"runtimeSmoke\":true}","expectedVersion",0
                ),nextAccount);
                Map<?,?> nextDraft=(Map<?,?>)nextSaved.get("draft");
                Integer nextReloadedCount=jdbc.queryForObject("select count(*)::integer from jsonb_object_keys(?::jsonb)",Integer.class,String.valueOf(nextDraft.get("payloadJson")));
                workflowDraftsVerified=workflowDraftsVerified
                    && "DRAFT".equals(String.valueOf(nextDraft.get("draftStatus")))
                    && java.util.Objects.equals(nextFieldCount,nextReloadedCount);
                workflowDraftStepCount++;workflowDraftFieldCount+=nextFieldCount;
                nextRequest.put("requireDraft",true);
            }
            Map<String,Object> nextResult=executeProcessCommand(executionId,nextRequest,nextAccount);
            if(nextFieldCount!=null&&nextFieldCount>0){
                String nextDraftStatus=jdbc.queryForObject(
                    "select draft_status from framework_process_work_draft where tenant_id=? and project_id=? and process_code=? and step_code=? and lower(account_id)=lower(?)",
                    String.class,tenant,project,process,nextStep.get("stepCode"),nextAccount);
                workflowDraftsVerified=workflowDraftsVerified&&"SUBMITTED".equals(nextDraftStatus);
            }
            executionStatus=String.valueOf(nextResult.getOrDefault("executionStatus","RUNNING"));
            nextStepCode=String.valueOf(nextResult.getOrDefault("nextStepCode",""));
            transitions.add(Map.of("stepCode",nextStep.get("stepCode"),"actorCode",nextActor,"commandCode",nextStep.get("commandCode"),"fromState",nextStep.get("fromState"),"toState",nextStep.get("toState"),"accountId",nextAccount));
        }
        Integer eventCount=jdbc.queryForObject("select count(*) from framework_process_execution_event where execution_id=?",Integer.class,executionId);
        boolean workflowCompleted="COMPLETED".equals(executionStatus)&&eventCount!=null&&eventCount==transitions.size();
        boolean terminalWorkflow="COMPLETED".equals(executionStatus)&&nextStepCode.isBlank();
        boolean nextTaskLinkVerified=terminalWorkflow||(!String.valueOf(first.getOrDefault("nextStepCode","")).isBlank()
            && (!String.valueOf(first.getOrDefault("nextUserPath","")).isBlank()||!String.valueOf(first.getOrDefault("nextAdminPath","")).isBlank()));
        boolean passed=Boolean.TRUE.equals(first.get("success"))&&requiredValidationVerified&&draftRoundTripVerified&&staleVersionRejected
            &&draftSubmittedVerified&&recoveryVerified&&isolationRejected&&authorityRejected&&exceptionRejected&&workflowCompleted&&nextTaskLinkVerified;
        passed=passed&&workflowDraftsVerified;
        TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("success",passed);result.put("rolledBack",true);result.put("executedBy",executedBy);
        result.put("executionId",executionId);result.put("tenantId",tenant);result.put("projectId",project);result.put("processCode",process);result.put("stepCode",step);
        result.put("actorCode",actor);result.put("stateTransition",fixture.get("fromState")+" -> "+fixture.get("toState"));
        result.put("idempotencyVerified",recoveryVerified);result.put("recoveryVerified",recoveryVerified);
        result.put("requiredValidationVerified",requiredValidationVerified);result.put("requiredValidationRejected",requiredValidationRejected);
        result.put("draftRoundTripVerified",draftRoundTripVerified);
        result.put("staleVersionRejected",staleVersionRejected);result.put("editableFieldCount",editableFieldCount==null?0:editableFieldCount);
        result.put("requiredFieldCount",requiredFieldCount==null?0:requiredFieldCount);result.put("reloadedFieldCount",reloadedFieldCount==null?0:reloadedFieldCount);
        result.put("draftSubmittedVerified",draftSubmittedVerified);
        result.put("tenantIsolationVerified",isolationRejected);result.put("authorityVerified",authorityRejected);result.put("exceptionVerified",exceptionRejected);
        result.put("workflowCompleted",workflowCompleted);result.put("nextTaskLinkVerified",nextTaskLinkVerified);
        result.put("workflowDraftsVerified",workflowDraftsVerified);result.put("workflowDraftStepCount",workflowDraftStepCount);
        result.put("workflowDraftFieldCount",workflowDraftFieldCount);
        result.put("stepCount",transitions.size());result.put("transitions",transitions);result.put("nextStepCode",first.getOrDefault("nextStepCode",""));
        result.put("nextUserPath",first.getOrDefault("nextUserPath",""));result.put("nextAdminPath",first.getOrDefault("nextAdminPath",""));
        if(!passed)throw new IllegalStateException("Process runtime smoke assertions failed; transaction was rolled back. "
                +"required="+requiredValidationVerified+", draft="+draftRoundTripVerified+", stale="+staleVersionRejected
                +", submitted="+draftSubmittedVerified+", idempotency="+recoveryVerified+", isolation="+isolationRejected+", authority="+authorityRejected
                +", exception="+exceptionRejected+", workflow="+workflowCompleted+", status="+executionStatus
                +", events="+(eventCount==null?-1:eventCount)+", steps="+transitions.size()+", nextLink="+nextTaskLinkVerified
                +", workflowDrafts="+workflowDraftsVerified);
        return result;
    }

    private String runtimeSmokePayload(String process,String step,String project,String actor){
        return jdbc.queryForObject("""
            select coalesce(jsonb_object_agg(
                     field->>'fieldCode',
                     case
                       when upper(coalesce(field->>'dataType','')) in ('INTEGER','DECIMAL','NUMBER') then '1'::jsonb
                       when upper(coalesce(field->>'dataType','')) in ('BOOLEAN','BOOL') then 'true'::jsonb
                       when upper(coalesce(field->>'controlType','')) = 'PROJECT_SELECT' then to_jsonb(?::text)
                       when upper(coalesce(field->>'controlType','')) = 'ACTOR_SELECT' then to_jsonb(?::text)
                       else to_jsonb('runtime-smoke'::text)
                     end
                   ),'{}'::jsonb)::text
              from jsonb_array_elements(coalesce(
                (select nullif(framework_step_contract_fields(execution_spec.field_contract,'USER'),'[]'::jsonb) from framework_step_execution_spec execution_spec where execution_spec.process_code=? and execution_spec.step_code=?),
                (select framework_try_jsonb(screen_contract.field_contract) from framework_professional_screen_contract screen_contract where screen_contract.process_code=? and screen_contract.step_code=? order by case screen_contract.audience when 'USER' then 0 else 1 end limit 1),
                '[]'::jsonb
              )) field
             where nullif(field->>'fieldCode','') is not null
               and coalesce((field->>'editable')::boolean,false)
            """,String.class,project,actor,process,step,process,step);
    }

    public Map<String,Object> verifyProcessRuntimeSmokeRollback(UUID executionId){
        Integer executions=jdbc.queryForObject("select count(*) from framework_process_execution where execution_id=?",Integer.class,executionId);
        Integer events=jdbc.queryForObject("select count(*) from framework_process_execution_event where execution_id=?",Integer.class,executionId);
        boolean clean=executions!=null&&executions==0&&events!=null&&events==0;
        return Map.of("success",clean,"rolledBack",clean,"executionId",executionId,"executionRows",executions==null?-1:executions,"eventRows",events==null?-1:events);
    }

    @Transactional public void recordQaResult(String processCode,String stepCode,String result,Map<String,Object> evidence,String failureReason,String user){
        String evidenceJson;
        try{evidenceJson=new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(evidence==null?Map.of():evidence);}catch(Exception ignored){evidenceJson="{}";}
        String normalizedStep=stepCode==null?"":stepCode.trim();
        List<Map<String,Object>> contracts=jdbc.queryForList("""
            select p.process_version as "processVersion",
                   case when ?='' then framework_current_process_contract_fingerprint(p.process_code)
                        else framework_current_process_step_contract_fingerprint(p.process_code,?) end as "contractFingerprint"
              from framework_process_definition p where p.process_code=?
            """,normalizedStep,normalizedStep,processCode);
        Object rawFingerprint=contracts.size()==1?contracts.get(0).get("contractFingerprint"):null;
        if(rawFingerprint==null||rawFingerprint.toString().isBlank())
            throw new IllegalStateException("Current process contract fingerprint is unavailable; QA evidence was not recorded: "+processCode+" / "+normalizedStep);
        String processVersion=String.valueOf(contracts.get(0).get("processVersion"));
        String contractFingerprint=rawFingerprint.toString();
        Object rawSourceCommit=(evidence==null?Map.of():evidence).get("sourceCommit");
        Object rawEnvironment=(evidence==null?Map.of():evidence).get("executionEnvironment");
        String sourceCommit=rawSourceCommit==null||rawSourceCommit.toString().isBlank()?"UNAVAILABLE":rawSourceCommit.toString();
        String environment=rawEnvironment==null||rawEnvironment.toString().isBlank()?"APPLICATION_RUNTIME_SMOKE":rawEnvironment.toString();
        String evidenceHash=sha256Hex(evidenceJson);
        String evidenceUri="inline://qa-runtime/sha256/"+evidenceHash;
        jdbc.update("insert into framework_process_qa_run(process_code,step_code,result,failure_reason,evidence_json,executed_by,evidence_type,process_version,source_commit,contract_fingerprint,execution_environment,evidence_uri,evidence_hash) values(?,?,?,nullif(?,''),?::jsonb,?,'QA_RUNTIME',?,?,?,?,?,?)",processCode,normalizedStep,result,failureReason==null?"":failureReason,evidenceJson,user,processVersion,sourceCommit,contractFingerprint,environment,evidenceUri,evidenceHash);
    }

    public List<Map<String,Object>> qaResults(String processCode,String user){
        String filter=processCode==null?"":processCode.trim();
        return jdbc.queryForList("select qa_run_id as \"qaRunId\",process_code as \"processCode\",step_code as \"stepCode\",result,failure_reason as \"failureReason\",evidence_json::text as \"evidenceJson\",executed_by as \"executedBy\",executed_at as \"executedAt\",evidence_type as \"evidenceType\",process_version as \"processVersion\",source_commit as \"sourceCommit\",contract_fingerprint as \"contractFingerprint\",execution_environment as \"executionEnvironment\",evidence_uri as \"evidenceUri\",evidence_hash as \"evidenceHash\" from framework_process_qa_run where (?='' or process_code=?) order by qa_run_id desc limit 50",filter,filter);
    }

    private static String sha256Hex(String value){
        try{
            byte[] digest=java.security.MessageDigest.getInstance("SHA-256").digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        }catch(java.security.NoSuchAlgorithmException impossible){throw new IllegalStateException("SHA-256 is unavailable",impossible);}
    }

    private static String md5Hex(String value){
        try{
            byte[] digest=java.security.MessageDigest.getInstance("MD5").digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        }catch(java.security.NoSuchAlgorithmException e){throw new IllegalStateException(e);}
    }

    private void requireActorAssignment(String tenant,String project,String actor,String user){
        Integer count=jdbc.queryForObject("select count(*) from framework_account_actor_assignment assignment join framework_actor_definition actor_definition on actor_definition.actor_code=assignment.actor_code and actor_definition.use_at='Y' where assignment.tenant_id=? and (assignment.project_id=? or assignment.project_id='*') and assignment.actor_code=? and lower(assignment.account_id)=lower(?) and assignment.assignment_status='ACTIVE' and (assignment.valid_from is null or assignment.valid_from<=current_date) and (assignment.valid_until is null or assignment.valid_until>=current_date)",Integer.class,tenant,project,actor,user);
        if(count==null||count==0)throw new SecurityException("프로젝트에 활성 액터 배정이 없습니다: "+actor);
    }

    void requireStepPermissionGrants(String process,String step,String actor){
        requireStepPermissionGrants(process,step,actor,"","");
    }

    void requireStepPermissionGrants(
            String process,String step,String actor,String routePath,String audience){
        Boolean allowed=jdbc.queryForObject(
            "select framework_authorize_step_permissions(?,?,?,?,?)",Boolean.class,
            process,step,actor,routePath==null?"":routePath,audience==null?"":audience);
        if(!Boolean.TRUE.equals(allowed))throw new SecurityException(
            "STEP_PERMISSION_DENIED: "+process+" / "+step+" / "+actor+
                " / "+(routePath==null?"":routePath)+" / "+(audience==null?"":audience));
    }

    @Transactional public Map<String,Object> manageQaProcessExecution(Map<String,Object>b,String user){
        String normalizedUser=user==null?"":user.trim().toLowerCase(Locale.ROOT);
        if(!normalizedUser.startsWith("qa")&&!"webmaster".equals(normalizedUser))throw new SecurityException("QA 허용 계정만 인스턴스를 관리할 수 있습니다.");
        String action=req(b,"action").toUpperCase(Locale.ROOT),project=req(b,"projectId"),process=req(b,"processCode");
        if(!Set.of("CREATE","UPDATE","RESET","DELETE").contains(action))throw new IllegalArgumentException("지원하지 않는 QA 인스턴스 작업입니다: "+action);
        List<Map<String,Object>> projects=jdbc.queryForList("select tenant_id,project_name from emission_project_registry where project_id=?",project);
        if(projects.isEmpty())throw new IllegalArgumentException("프로젝트를 찾을 수 없습니다: "+project);
        String tenant=String.valueOf(projects.get(0).get("tenant_id"));
        Integer qaAssignment=jdbc.queryForObject("select count(*) from framework_account_actor_assignment assignment join framework_actor_definition actor on actor.actor_code=assignment.actor_code and actor.use_at='Y' where assignment.tenant_id=? and (assignment.project_id=? or assignment.project_id='*') and lower(assignment.account_id)=lower(?) and assignment.assignment_status='ACTIVE'",Integer.class,tenant,project,user);
        if((qaAssignment==null||qaAssignment==0)&&!"qaassign26".equals(normalizedUser)&&!"webmaster".equals(normalizedUser))throw new SecurityException("이 프로젝트의 QA 액터 배정이 없습니다.");
        List<Map<String,Object>> firstSteps=jdbc.queryForList("select step_code,from_state,actor_code from framework_process_step where process_code=? order by step_order limit 1",process);
        if(firstSteps.isEmpty())throw new IllegalArgumentException("프로세스 절차가 없습니다: "+process);
        if("CREATE".equals(action)){
            Map<String,Object> first=firstSteps.get(0),context=new LinkedHashMap<>();
            context.put("tenantId",tenant);context.put("projectId",project);context.put("processCode",process);
            context.put("actorCode",def(b,"actorCode",String.valueOf(first.get("actor_code"))));context.put("cycleType",def(b,"cycleType","ONCE"));
            context.put("periodStart",str(b,"periodStart"));context.put("periodEnd",str(b,"periodEnd"));
            Map<String,Object> created=new LinkedHashMap<>(startProcessExecution(context,user));created.put("action",action);return created;
        }
        List<Map<String,Object>> rows=jdbc.queryForList("select * from framework_process_execution where tenant_id=? and project_id=? and process_code=? order by started_at desc limit 1 for update",tenant,project,process);
        if(rows.isEmpty())throw new IllegalStateException("관리할 QA 인스턴스가 없습니다. 먼저 추가하세요.");
        Map<String,Object> execution=rows.get(0);UUID executionId=(UUID)execution.get("execution_id");
        if("DELETE".equals(action)){
            int drafts=jdbc.update("delete from framework_process_work_draft where tenant_id=? and project_id=? and process_code=?",tenant,project,process);
            int deleted=jdbc.update("delete from framework_process_execution where execution_id=?",executionId);
            return Map.of("success",true,"action",action,"projectId",project,"processCode",process,"deletedExecutions",deleted,"deletedDrafts",drafts);
        }
        if("RESET".equals(action)){
            int events=jdbc.update("delete from framework_process_execution_event where execution_id=?",executionId);
            int drafts=jdbc.update("delete from framework_process_work_draft where tenant_id=? and project_id=? and process_code=?",tenant,project,process);
            Map<String,Object> first=firstSteps.get(0);
            jdbc.update("update framework_process_execution set current_step_code=?,current_state=?,execution_status='RUNNING',handoff_status='NOT_READY',snapshot_ref=null,completed_at=null,started_at=current_timestamp,updated_at=current_timestamp where execution_id=?",first.get("step_code"),first.get("from_state"),executionId);
            return Map.of("success",true,"action",action,"executionId",executionId,"projectId",project,"processCode",process,"deletedEvents",events,"deletedDrafts",drafts,"currentStepCode",String.valueOf(first.get("step_code")));
        }
        String cycleType=def(b,"cycleType",String.valueOf(execution.getOrDefault("cycle_type","ONCE"))).toUpperCase(Locale.ROOT);
        if(!Set.of("ONCE","MONTHLY","QUARTERLY","HALF_YEARLY","ANNUAL","AD_HOC").contains(cycleType))throw new IllegalArgumentException("지원하지 않는 실행 주기입니다: "+cycleType);
        String periodStart="ONCE".equals(cycleType)?"":str(b,"periodStart"),periodEnd="ONCE".equals(cycleType)?"":str(b,"periodEnd");
        if(!"ONCE".equals(cycleType)&&(periodStart.isBlank()||periodEnd.isBlank()))throw new IllegalArgumentException("반복 실행은 시작일과 종료일이 필요합니다.");
        jdbc.update("update framework_process_execution set cycle_type=?,period_start=nullif(?,'')::date,period_end=nullif(?,'')::date,updated_at=current_timestamp where execution_id=?",cycleType,periodStart,periodEnd,executionId);
        Map<String,Object> result=new LinkedHashMap<>();result.put("success",true);result.put("action",action);result.put("executionId",executionId);result.put("projectId",project);result.put("processCode",process);result.put("cycleType",cycleType);result.put("periodStart",periodStart);result.put("periodEnd",periodEnd);return result;
    }

    public Map<String,Object> loadWorkDraft(String tenant,String project,String process,String step,String user){
        List<Map<String,Object>> contracts=jdbc.queryForList("select runtime_step.step_code as \"stepCode\",runtime_step.step_name as \"stepName\",runtime_step.actor_code as \"actorCode\",runtime_step.command_code as \"commandCode\",runtime_step.from_state as \"fromState\",runtime_step.to_state as \"toState\",runtime_step.requirement_text as \"requirementText\",runtime_step.completion_rule as \"completionRule\",runtime_step.input_contract as \"inputContract\",runtime_step.output_contract as \"outputContract\",runtime_step.api_contract as \"apiContract\",coalesce(nullif(framework_step_contract_fields(execution_spec.field_contract,'USER'),'[]'::jsonb),(select framework_try_jsonb(screen_contract.field_contract) from framework_professional_screen_contract screen_contract where screen_contract.process_code=runtime_step.process_code and screen_contract.step_code=runtime_step.step_code order by case screen_contract.audience when 'USER' then 0 else 1 end limit 1),'[]'::jsonb)::text as \"fieldContractJson\" from framework_process_step runtime_step left join framework_step_execution_spec execution_spec using(process_code,step_code) where runtime_step.process_code=? and runtime_step.step_code=?",process,step);
        if(contracts.isEmpty())throw new IllegalArgumentException("Work step contract does not exist: "+process+" / "+step);
        Map<String,Object> contract=contracts.get(0);
        requireActorAssignment(tenant,project,String.valueOf(contract.get("actorCode")),user);
        List<Map<String,Object>> drafts=jdbc.queryForList("select draft_id as \"draftId\",tenant_id as \"tenantId\",project_id as \"projectId\",process_code as \"processCode\",step_code as \"stepCode\",actor_code as \"actorCode\",payload_json::text as \"payloadJson\",evidence_json::text as \"evidenceJson\",evidence_count as \"evidenceCount\",draft_version as \"draftVersion\",draft_status as \"draftStatus\",saved_at as \"savedAt\",submitted_at as \"submittedAt\" from framework_process_work_draft where tenant_id=? and project_id=? and process_code=? and step_code=? and lower(account_id)=lower(?)",tenant,project,process,step,user);
        List<Map<String,Object>> handoffs=jdbc.queryForList("""
            with target as (
              select step_order from framework_process_step where process_code=? and step_code=?
            ), source_steps as (
              select 0 as source_priority,previous.process_code,previous.step_code
                from framework_process_step previous,target
               where previous.process_code=? and previous.step_order=target.step_order-1
              union all
              select 1,chain.process_code,previous.step_code
                from framework_process_chain chain
                join framework_process_step previous on previous.process_code=chain.process_code
               where chain.next_process_code=? and chain.use_at='Y'
                 and previous.step_order=(select max(last_step.step_order) from framework_process_step last_step where last_step.process_code=chain.process_code)
                 and (select step_order from target)=1
            )
            select source.process_code as "fromProcessCode",source.step_code as "fromStepCode",
                   draft.actor_code as "fromActorCode",draft.payload_json::text as "payloadJson",
                   draft.evidence_json::text as "evidenceJson",draft.submitted_at as "submittedAt",
                   coalesce(handoff.payload_contract,'{}'::jsonb)::text as "mappingContractJson",
                   coalesce(handoff.integrity_contract,'{}'::jsonb)::text as "integrityContractJson",
                   coalesce(mapped.payload,'{}'::jsonb)::text as "mappedPayloadJson"
              from source_steps source
              join framework_process_work_draft draft
                on draft.tenant_id=? and draft.project_id=? and draft.process_code=source.process_code
               and draft.step_code=source.step_code and draft.draft_status='SUBMITTED'
              left join framework_process_data_handoff handoff
                on handoff.process_code=source.process_code and handoff.from_step_code=source.step_code
               and handoff.to_process_code=? and handoff.to_step_code=?
              left join lateral (
                select jsonb_object_agg(
                         mapping->>'toField',
                         framework_apply_handoff_transform(
                           mapping->>'transform',
                           draft.payload_json->(mapping->>'fromField'),
                           draft.tenant_id
                         )
                       ) as payload
                  from jsonb_array_elements(coalesce(handoff.payload_contract->'fieldMappings','[]'::jsonb)) mapping
                 where jsonb_exists(draft.payload_json,mapping->>'fromField')
              ) mapped on true
             order by source.source_priority,draft.submitted_at desc
             limit 1
            """,process,step,process,process,tenant,project,process,step);
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("success",true);result.put("found",!drafts.isEmpty());result.put("contract",contract);
        result.put("draft",drafts.isEmpty()?Map.of("draftVersion",0,"draftStatus","NOT_SAVED","evidenceCount",0):drafts.get(0));
        result.put("handoff",handoffs.isEmpty()?Map.of():handoffs.get(0));
        result.put("prerequisiteReadiness",relayPrerequisiteReadiness(tenant,project,process,step));
        List<Map<String,Object>> executionContext=jdbc.queryForList("""
            select jsonb_strip_nulls(jsonb_build_object(
                     'tenantId',execution.tenant_id,'projectId',execution.project_id,'processCode',execution.process_code,
                     'stepCode',?::text,'actorCode',?::text,
                     'reportingYear',coalesce(project.reporting_year,extract(year from execution.period_start)::integer,extract(year from current_date)::integer),
                     'periodStart',to_char(coalesce(execution.period_start,project.period_start),'YYYY-MM-DD'),
                     'periodEnd',to_char(coalesce(execution.period_end,project.period_end),'YYYY-MM-DD')
                   ))::text as "defaultPayloadJson"
              from framework_process_execution execution
              left join emission_project_registry project
                on project.tenant_id=execution.tenant_id and project.project_id=execution.project_id
             where execution.tenant_id=? and execution.project_id=? and execution.process_code=?
             order by execution.started_at desc limit 1
            """,step,String.valueOf(contract.get("actorCode")),tenant,project,process);
        if(executionContext.isEmpty()){
            Map<String,Object> defaults=new LinkedHashMap<>();
            defaults.put("tenantId",tenant);defaults.put("projectId",project);
            defaults.put("processCode",process);defaults.put("stepCode",step);
            defaults.put("actorCode",String.valueOf(contract.get("actorCode")));
            result.put("defaultPayloadJson",defaults);
        }else result.put("defaultPayloadJson",String.valueOf(executionContext.get(0).get("defaultPayloadJson")));
        return result;
    }

    @Transactional public Map<String,Object> saveWorkDraft(Map<String,Object>b,String user){
        String tenant=req(b,"tenantId"),project=req(b,"projectId"),process=req(b,"processCode"),step=req(b,"stepCode"),actor=req(b,"actorCode");
        String payload=def(b,"payloadJson","{}"),evidence=def(b,"evidenceJson","{}");int expectedVersion=integerOr(b,"expectedVersion",0);
        List<Map<String,Object>> contracts=jdbc.queryForList("select actor_code from framework_process_step where process_code=? and step_code=?",process,step);
        if(contracts.isEmpty())throw new IllegalArgumentException("Work step contract does not exist: "+process+" / "+step);
        String requiredActor=String.valueOf(contracts.get(0).get("actor_code"));
        if(!requiredActor.equals(actor))throw new SecurityException("The required actor for this step is "+requiredActor+".");
        requireActorAssignment(tenant,project,actor,user);
        assertRelayPrerequisitesReady(tenant,project,process,step);
        List<Map<String,Object>> existing=jdbc.queryForList("select draft_id,draft_version,draft_status from framework_process_work_draft where tenant_id=? and project_id=? and process_code=? and step_code=? and lower(account_id)=lower(?) for update",tenant,project,process,step,user);
        if(existing.isEmpty()){
            if(expectedVersion!=0)throw new IllegalStateException("The draft version changed. Reload the latest work.");
            jdbc.update("insert into framework_process_work_draft(draft_id,tenant_id,project_id,process_code,step_code,account_id,actor_code,payload_json,evidence_json,draft_version,draft_status,saved_at) values(?,?,?,?,?,?,?,cast(? as jsonb),cast(? as jsonb),1,'DRAFT',current_timestamp)",UUID.randomUUID(),tenant,project,process,step,user,actor,payload,evidence);
        }else{
            Map<String,Object> current=existing.get(0);int currentVersion=((Number)current.get("draft_version")).intValue();
            if(currentVersion!=expectedVersion)throw new IllegalStateException("The draft version changed. Reload the latest work.");
            if("SUBMITTED".equals(String.valueOf(current.get("draft_status")))){
                Integer reentry=jdbc.queryForObject("select count(*) from framework_process_execution where tenant_id=? and project_id=? and process_code=? and current_step_code=? and execution_status='RUNNING'",Integer.class,tenant,project,process,step);
                if(reentry==null||reentry==0)throw new IllegalStateException("A submitted work item can only be reopened after an active process re-enters this step.");
            }
            jdbc.update("update framework_process_work_draft set actor_code=?,payload_json=cast(? as jsonb),evidence_json=cast(? as jsonb),draft_version=draft_version+1,draft_status='DRAFT',submitted_at=null,saved_at=current_timestamp,updated_at=current_timestamp where draft_id=?",actor,payload,evidence,current.get("draft_id"));
        }
        return loadWorkDraft(tenant,project,process,step,user);
    }

    public Map<String,Object> findProcessExecution(String tenant,String project,String process,String user){
        Integer assignmentCount=jdbc.queryForObject("select count(*) from framework_account_actor_assignment a join framework_actor_definition actor on actor.actor_code=a.actor_code and actor.use_at='Y' where a.tenant_id=? and a.project_id=? and lower(a.account_id)=lower(?) and a.assignment_status='ACTIVE' and (a.valid_from is null or a.valid_from<=current_date) and (a.valid_until is null or a.valid_until>=current_date) and exists(select 1 from framework_process_step s where s.process_code=? and s.actor_code=a.actor_code)",Integer.class,tenant,project,user,process);
        if(assignmentCount==null||assignmentCount==0)throw new SecurityException("No active actor assignment exists for this project process.");
        List<Map<String,Object>> rows=jdbc.queryForList("select execution_id as \"executionId\",tenant_id as \"tenantId\",project_id as \"projectId\",process_code as \"processCode\",current_step_code as \"currentStepCode\",execution_status as \"executionStatus\",current_state as \"currentState\",initiated_by_actor as \"initiatedByActor\",cycle_type as \"cycleType\",period_start as \"periodStart\",period_end as \"periodEnd\",site_scope as \"siteScope\",boundary_version as \"boundaryVersion\",methodology_version as \"methodologyVersion\",data_cutoff_at as \"dataCutoffAt\",execution_version as \"executionVersion\",handoff_status as \"handoffStatus\",snapshot_ref as \"snapshotRef\",started_at as \"startedAt\",completed_at as \"completedAt\" from framework_process_execution where tenant_id=? and project_id=? and process_code=? order by started_at desc limit 1",tenant,project,process);
        if(rows.isEmpty())return Map.of("found",false);
        Map<String,Object> out=new LinkedHashMap<>(rows.get(0));
        out.put("found",true);
        out.put("events",jdbc.queryForList("select event_id as \"eventId\",step_code as \"stepCode\",actor_code as \"actorCode\",command_code as \"commandCode\",from_state as \"fromState\",to_state as \"toState\",executed_at as \"executedAt\" from framework_process_execution_event where execution_id=? order by event_id",rows.get(0).get("executionId")));
        return out;
    }

    public Map<String,Object> generatedFieldOptions(String tenant,String project,String process,String step,String keyword,String user){
        String actor=jdbc.queryForObject("select actor_code from framework_process_step where process_code=? and step_code=?",String.class,process,step);
        requireActorAssignment(tenant,project,actor,user);
        String search=keyword==null?"":keyword.trim().toLowerCase(Locale.ROOT);
        String like="%"+search+"%";
        List<Map<String,Object>> fields=jdbc.queryForList("""
            select field->>'fieldCode' as "fieldCode",upper(coalesce(field->>'controlType','TEXT')) as "controlType"
              from jsonb_array_elements(coalesce(
                (select nullif(framework_step_contract_fields(execution_spec.field_contract,'USER'),'[]'::jsonb) from framework_step_execution_spec execution_spec where execution_spec.process_code=? and execution_spec.step_code=?),
                (select framework_try_jsonb(screen_contract.field_contract) from framework_professional_screen_contract screen_contract where screen_contract.process_code=? and screen_contract.step_code=? order by case screen_contract.audience when 'USER' then 0 else 1 end limit 1),
                '[]'::jsonb
              )) field
             where nullif(field->>'fieldCode','') is not null
               and coalesce((field->>'editable')::boolean,false)
            """,process,step,process,step);
        Map<String,Object> optionSets=new LinkedHashMap<>();
        for(Map<String,Object> field:fields){
            String fieldCode=String.valueOf(field.get("fieldCode")),control=String.valueOf(field.get("controlType"));
            List<Map<String,Object>> options;
            switch(control){
                case "PROJECT_SELECT" -> options=jdbc.queryForList("select project_id::text as value,project_name as label from emission_project_registry where project_id=? and tenant_id=? order by project_name limit 50",project,tenant);
                case "ACTOR_SELECT" -> options=jdbc.queryForList("select distinct assignment.actor_code as value,assignment.actor_code as label from framework_account_actor_assignment assignment join framework_actor_definition actor on actor.actor_code=assignment.actor_code and actor.use_at='Y' where assignment.tenant_id=? and assignment.project_id=? and assignment.assignment_status='ACTIVE' order by assignment.actor_code limit 50",tenant,project);
                case "ORGANIZATION_SELECT" -> options=jdbc.queryForList("select distinct coalesce(nullif(instt_id,''),entrprs_mber_id) as value,coalesce(nullif(cmpny_nm,''),entrprs_mber_id) as label from comtnentrprsmber where entrprs_mber_sttus in ('P','A') and (lower(coalesce(cmpny_nm,'')) like ? or lower(coalesce(instt_id,'')) like ?) order by label limit 50",like,like);
                case "SITE_SELECT" -> options=jdbc.queryForList("select site_code as value,site_name as label from emission_site_registry where tenant_id=? and site_status='ACTIVE' and (lower(site_name) like ? or lower(site_code) like ?) order by site_name limit 50",tenant,like,like);
                case "SCOPE_SELECT" -> options=List.of(option("SCOPE1","Scope 1"),option("SCOPE2","Scope 2"),option("SCOPE3","Scope 3"));
                case "UNIT_SELECT" -> options=jdbc.queryForList("select distinct unit as value,unit as label from emission_factor_reference where nullif(unit,'') is not null and lower(unit) like ? order by unit limit 50",like);
                case "FACTOR_SEARCH" -> options=jdbc.queryForList("select factor_id as value,factor_name||' · '||factor_value::text||' '||unit as label from emission_factor_reference where lower(factor_name) like ? or lower(factor_id) like ? order by factor_name limit 50",like,like);
                case "QUALITY_BADGE" -> options=List.of(option("READY","정상"),option("CHECK_REQUIRED","확인 필요"),option("BLOCKED","차단"));
                default -> options=new ArrayList<>();
            }
            if(!options.isEmpty())optionSets.put(fieldCode,options);
        }
        return Map.of("success",true,"tenantId",tenant,"projectId",project,"processCode",process,"stepCode",step,"optionSets",optionSets);
    }

    public Map<String,Object> relayPrerequisiteReadiness(String tenant,String project,String process,String step){
        String normalizedTenant=tenant==null?"":tenant.trim(),normalizedProject=project==null?"":project.trim();
        String normalizedProcess=process==null?"":process.trim(),normalizedStep=step==null?"":step.trim();
        if(normalizedTenant.isBlank()&&!normalizedProject.isBlank()){
            List<String> tenants=jdbc.queryForList("select tenant_id from emission_project_registry where project_id=? order by created_at desc limit 1",String.class,normalizedProject);
            if(!tenants.isEmpty())normalizedTenant=tenants.get(0);
        }
        final String resolvedTenant=normalizedTenant;
        List<Map<String,Object>> policies=jdbc.queryForList("""
            select handoff.to_process_code as "processCode",handoff.to_step_code as "stepCode",
                   policy->>'fieldCode' as "fieldCode",policy->>'fieldName' as "fieldName",
                   policy->>'prerequisiteType' as "prerequisiteType",
                   coalesce((policy->>'blocking')::boolean,false) as blocking
              from framework_process_data_handoff handoff
              cross join lateral jsonb_array_elements(coalesce(handoff.payload_contract->'unmappedFieldPolicies','[]'::jsonb)) policy
             where policy->>'prerequisiteType'<>'NONE'
               and (?='' or handoff.to_process_code=?)
               and (?='' or handoff.to_step_code=?)
             order by handoff.to_process_code,handoff.to_step_code,policy->>'fieldCode'
            """,normalizedProcess,normalizedProcess,normalizedStep,normalizedStep);
        Map<String,Integer> counts=new HashMap<>();List<Map<String,Object>> items=new ArrayList<>();int blockingMissing=0;
        for(Map<String,Object> policy:policies){
            String type=String.valueOf(policy.get("prerequisiteType"));
            int available=counts.computeIfAbsent(type,key->prerequisiteAvailability(key,resolvedTenant,normalizedProject));
            boolean blocking=Boolean.TRUE.equals(policy.get("blocking")),ready=available>0;
            if(blocking&&!ready)blockingMissing++;
            Map<String,Object> item=new LinkedHashMap<>(policy);item.put("availableCount",available);item.put("ready",ready);
            item.put("managementUrl",prerequisiteManagementUrl(type));item.put("resolution",prerequisiteResolution(type));items.add(item);
        }
        Map<String,Object> result=new LinkedHashMap<>();result.put("ready",blockingMissing==0);result.put("requirementCount",items.size());
        result.put("blockingCount",items.stream().filter(item->Boolean.TRUE.equals(item.get("blocking"))).count());
        result.put("blockingMissingCount",blockingMissing);result.put("items",items);return result;
    }

    private int prerequisiteAvailability(String type,String tenant,String project){
        Integer count=switch(type){
            case "ORGANIZATION_REGISTRY" -> jdbc.queryForObject("select count(*) from emission_project_registry where tenant_id=? and project_id=?",Integer.class,tenant,project);
            case "SITE_REGISTRY" -> jdbc.queryForObject("select count(*) from emission_site_registry where tenant_id=? and site_status='ACTIVE' and (effective_until is null or effective_until>=current_date)",Integer.class,tenant);
            case "ACTOR_ASSIGNMENT" -> jdbc.queryForObject("select count(*) from framework_account_actor_assignment assignment join framework_actor_definition actor on actor.actor_code=assignment.actor_code and actor.use_at='Y' where assignment.tenant_id=? and assignment.project_id=? and assignment.assignment_status='ACTIVE' and (assignment.valid_from is null or assignment.valid_from<=current_date) and (assignment.valid_until is null or assignment.valid_until>=current_date)",Integer.class,tenant,project);
            case "EMISSION_FACTOR_REFERENCE" -> jdbc.queryForObject("select count(*) from emission_factor_reference",Integer.class);
            case "UNIT_REFERENCE" -> jdbc.queryForObject("select count(distinct unit) from emission_factor_reference where nullif(trim(unit),'') is not null",Integer.class);
            case "REPORT_REGISTRY" -> jdbc.queryForObject("select count(*) from emission_project_report where project_id=? or exists(select 1 from framework_process_work_draft where tenant_id=? and project_id=? and process_code='EMISSION_CALCULATION' and draft_status='SUBMITTED')",Integer.class,project,tenant,project);
            case "FACILITY_REGISTRY" -> jdbc.queryForObject("select count(*) from framework_process_work_draft where tenant_id=? and project_id=? and nullif(trim(payload_json->>'facilityId'),'') is not null",Integer.class,tenant,project);
            case "DATA_SOURCE_REGISTRY" -> 1;
            default -> 0;
        };
        return count==null?0:count;
    }

    private static String prerequisiteManagementUrl(String type){
        return switch(type){
            case "ORGANIZATION_REGISTRY","SITE_REGISTRY","FACILITY_REGISTRY" -> "/admin/emission/site-management";
            case "ACTOR_ASSIGNMENT" -> "/emission/work-assignment";
            case "EMISSION_FACTOR_REFERENCE","UNIT_REFERENCE" -> "/admin/emission/factor-management";
            case "REPORT_REGISTRY" -> "/admin/emission/report-template";
            default -> "/admin/emission/project-prerequisites";
        };
    }

    private static String prerequisiteResolution(String type){
        return switch(type){
            case "ORGANIZATION_REGISTRY" -> "Register the project organization and boundary.";
            case "SITE_REGISTRY" -> "Register and activate at least one tenant-owned site.";
            case "ACTOR_ASSIGNMENT" -> "Assign an active account to the required project actor.";
            case "FACILITY_REGISTRY" -> "Register or select the project facility.";
            case "EMISSION_FACTOR_REFERENCE" -> "Approve at least one emission factor reference.";
            case "UNIT_REFERENCE" -> "Register a unit through the factor reference catalog.";
            case "REPORT_REGISTRY" -> "Create a report record or complete the calculation handoff.";
            case "DATA_SOURCE_REGISTRY" -> "Enter the governed source type and original reference in this step.";
            default -> "Complete the administrator prerequisite.";
        };
    }

    private void assertRelayPrerequisitesReady(String tenant,String project,String process,String step){
        Map<String,Object> readiness=relayPrerequisiteReadiness(tenant,project,process,step);
        if(((Number)readiness.get("blockingMissingCount")).intValue()>0)
            throw new IllegalStateException("PREREQUISITE_NOT_READY: complete the linked administrator prerequisites before saving or completing this step.");
    }

    private static Map<String,Object> option(String value,String label){return Map.of("value",value,"label",label);}

    @Transactional public Map<String,Object> claimDevelopmentJob(String worker){
        List<Map<String,Object>> rows=jdbc.queryForList("select j.* from framework_development_job j left join framework_development_phase phase on phase.job_type=j.job_type and phase.active_yn='Y' where j.approval_status='APPROVED' and (j.job_status in ('PLANNED','RETRY') or (j.job_status='RUNNING' and j.lease_until is not null and j.lease_until<=current_timestamp)) and j.attempt_count<j.max_attempts and not exists(select 1 from framework_development_job_dependency d join framework_development_job required_job on required_job.job_id=d.depends_on_job_id where d.job_id=j.job_id and d.dependency_type='REQUIRED' and required_job.job_status not in ('VERIFIED','COMPLETED')) order by coalesce(phase.phase_order,1000),j.process_code,j.step_code,j.job_id for update of j skip locked limit 1");
        if(rows.isEmpty())return Map.of("success",true,"available",false);
        Map<String,Object> job=rows.get(0); long id=((Number)job.get("job_id")).longValue(); String from=String.valueOf(job.get("job_status")),token=UUID.randomUUID().toString();
        jdbc.update("update framework_development_job set job_status='RUNNING',worker_id=?,lease_token=?,lease_until=current_timestamp+interval '10 minutes',attempt_count=attempt_count+1,started_at=coalesce(started_at,current_timestamp),last_error=null,updated_at=current_timestamp where job_id=?",worker,token,id);
        event(id,"CLAIMED",from,"RUNNING",worker,"{}");
        Map<String,Object> out=new LinkedHashMap<>(job);out.put("jobId",id);out.put("leaseToken",token);out.put("available",true);out.put("success",true);return out;
    }

    @Transactional public Map<String,Object> heartbeatDevelopmentJob(long jobId,String token,String worker){
        int changed=jdbc.update("update framework_development_job set lease_until=current_timestamp+interval '10 minutes',updated_at=current_timestamp where job_id=? and lease_token=? and worker_id=? and job_status='RUNNING' and lease_until is not null and lease_until>current_timestamp",jobId,token,worker);
        if(changed==0)throw new IllegalArgumentException("실행 임대가 만료되었거나 다른 실행기가 소유한 작업입니다.");
        return Map.of("success",true,"jobId",jobId);
    }

    @Transactional public Map<String,Object> completeDevelopmentJob(Map<String,Object>b,String worker){
        long id=Long.parseLong(req(b,"jobId"));String token=req(b,"leaseToken"),result=def(b,"result","VERIFIED");
        if(!List.of("VERIFIED","FAILED").contains(result))throw new IllegalArgumentException("result must be VERIFIED or FAILED");
        List<Map<String,Object>> rows=jdbc.queryForList("select * from framework_development_job where job_id=? and lease_token=? and worker_id=? and job_status='RUNNING' and lease_until is not null and lease_until>current_timestamp for update",id,token,worker);
        if(rows.isEmpty())throw new IllegalArgumentException("실행 임대가 만료되었거나 다른 실행기가 소유한 작업입니다.");
        Map<String,Object>j=rows.get(0);String process=String.valueOf(j.get("process_code")),step=String.valueOf(j.get("step_code")),type=String.valueOf(j.get("job_type"));
        jdbc.update("update framework_development_job set job_status=?,quality_status=case when ?='VERIFIED' then 'VERIFIED' else 'FAILED' end,result_json=?,evidence_ref=nullif(?,''),rollback_ref=nullif(?,''),last_error=nullif(?,''),completed_at=case when ?='VERIFIED' then current_timestamp else null end,lease_token=null,lease_until=null,updated_at=current_timestamp where job_id=?",result,result,def(b,"resultJson","{}"),str(b,"evidenceRef"),str(b,"rollbackRef"),str(b,"error"),result,id);
        event(id,result,"RUNNING",result,worker,def(b,"resultJson","{}"));
        jdbc.update("update framework_process_artifact set delivery_status=?,evidence_ref=coalesce(nullif(?,''),evidence_ref),updated_at=current_timestamp where process_code=? and step_code=? and contract_ref=?",result,str(b,"evidenceRef"),process,step,"AUTO:"+type);
        Integer pending=jdbc.queryForObject("select count(*) from framework_development_job where process_code=? and step_code=? and job_status<>'VERIFIED'",Integer.class,process,step);
        if(!isProcessDefinitionLocked(process))jdbc.update("update framework_process_step set automation_status=? where process_code=? and step_code=?",pending!=null&&pending==0?"VERIFIED":("FAILED".equals(result)?"BLOCKED":"GENERATED"),process,step);
        return Map.of("success",true,"jobId",id,"status",result,"stepComplete",pending!=null&&pending==0);
    }

    @Transactional public Map<String,Object> retryDevelopmentJob(long jobId,String actor){
        List<Map<String,Object>> rows=jdbc.queryForList("select job_status from framework_development_job where job_id=? for update",jobId);if(rows.isEmpty())throw new IllegalArgumentException("작업이 존재하지 않습니다.");
        String from=String.valueOf(rows.get(0).get("job_status"));if(!"FAILED".equals(from))throw new IllegalArgumentException("실패 작업만 재시도할 수 있습니다.");
        jdbc.update("update framework_development_job set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,updated_at=current_timestamp where job_id=?",jobId);event(jobId,"RETRY_REQUESTED",from,"RETRY",actor,"{}");return Map.of("success",true,"jobId",jobId);
    }

    @Transactional public Map<String,Object> requestDevelopmentRollback(long jobId,String reason,String actor){
        List<Map<String,Object>> rows=jdbc.queryForList("select job_id,process_code,step_code,job_type,target_path,job_status,quality_status,rollback_ref from framework_development_job where job_id=? for update",jobId);
        if(rows.isEmpty())throw new IllegalArgumentException("개발 작업이 존재하지 않습니다.");
        Map<String,Object> job=rows.get(0);
        String status=String.valueOf(job.get("job_status")),quality=String.valueOf(job.get("quality_status"));
        String rollbackRef=job.get("rollback_ref")==null?"":String.valueOf(job.get("rollback_ref")).trim();
        if(!List.of("VERIFIED","COMPLETED").contains(status)||!"VERIFIED".equals(quality))
            throw new IllegalStateException("검증 완료된 개발 작업만 롤백할 수 있습니다.");
        if(rollbackRef.isBlank())throw new IllegalStateException("불변 롤백 기준이 등록되지 않았습니다.");
        Integer failedGates=jdbc.queryForObject("select count(*) from framework_quality_gate gate where gate.mandatory=true and gate.use_at='Y' and not exists(select 1 from framework_development_job_gate_result result where result.job_id=? and result.gate_code=gate.gate_code and result.result='PASSED')",Integer.class,jobId);
        Integer runningTargets=jdbc.queryForObject("select count(*) from framework_development_job where coalesce(target_path,'')=coalesce(?, '') and job_status='RUNNING'",Integer.class,job.get("target_path"));
        String preflight=failedGates!=null&&failedGates>0?"FAILED":runningTargets!=null&&runningTargets>0?"FAILED":"PASSED";
        String summary="mandatoryGateFailures="+failedGates+", runningTargetJobs="+runningTargets;
        if(!"PASSED".equals(preflight))throw new IllegalStateException("롤백 사전 검증 실패: "+summary);
        Long requestId=jdbc.queryForObject("insert into framework_development_rollback_request(source_job_id,rollback_ref,request_reason,preflight_status,preflight_summary,requested_by) values(?,?,?,?,?,?) returning rollback_request_id",Long.class,jobId,rollbackRef,reason==null||reason.isBlank()?"운영 안정성 복구":reason.trim(),preflight,summary,actor);
        event(jobId,"ROLLBACK_REQUESTED",status,status,actor,"{\"rollbackRequestId\":"+requestId+"}");
        return Map.of("success",true,"rollbackRequestId",requestId,"sourceJobId",jobId,"status","PENDING","preflightStatus",preflight);
    }

    @Transactional public Map<String,Object> approveDevelopmentRollback(long requestId,String actor){
        List<Map<String,Object>> rows=jdbc.queryForList("select request.*,job.process_code,job.step_code,job.target_path,job.job_status,job.quality_status from framework_development_rollback_request request join framework_development_job job on job.job_id=request.source_job_id where request.rollback_request_id=? for update",requestId);
        if(rows.isEmpty())throw new IllegalArgumentException("롤백 요청이 존재하지 않습니다.");
        Map<String,Object> request=rows.get(0);
        if(!"PENDING".equals(String.valueOf(request.get("request_status"))))throw new IllegalStateException("승인 대기 중인 롤백 요청만 승인할 수 있습니다.");
        if(actor.equalsIgnoreCase(String.valueOf(request.get("requested_by"))))throw new SecurityException("요청자와 승인자는 서로 달라야 합니다.");
        if(!"PASSED".equals(String.valueOf(request.get("preflight_status"))))throw new IllegalStateException("사전 검증을 통과하지 못한 롤백 요청입니다.");
        if(!List.of("VERIFIED","COMPLETED").contains(String.valueOf(request.get("job_status")))||!"VERIFIED".equals(String.valueOf(request.get("quality_status"))))throw new IllegalStateException("승인 시점에 원본 작업의 검증 상태가 변경되어 현재 운영 버전을 유지합니다.");
        String process=String.valueOf(request.get("process_code")),step=String.valueOf(request.get("step_code")),target=String.valueOf(request.get("target_path"));
        Integer running=jdbc.queryForObject("select count(*) from framework_development_job where coalesce(target_path,'')=coalesce(?, '') and job_status='RUNNING'",Integer.class,target);
        if(running!=null&&running>0)throw new IllegalStateException("동일 대상의 실행 중 작업이 있어 현재 운영 버전을 유지합니다.");
        String rollbackTarget=target==null||"null".equals(target)?"":target;
        String specification="{\"sourceJobId\":"+request.get("source_job_id")+",\"rollbackRequestId\":"+requestId+",\"rollbackRef\":\""+jsonEscape(String.valueOf(request.get("rollback_ref")))+"\",\"failClosed\":true}";
        queueJob(process,step,"ROLLBACK","승인된 안전 롤백",rollbackTarget,specification,actor);
        Long rollbackJobId=jdbc.queryForObject("select job_id from framework_development_job where process_code=? and step_code=? and job_type='ROLLBACK' and target_path=?",Long.class,process,step,rollbackTarget);
        jdbc.update("update framework_development_job set approval_status='APPROVED',job_status='PLANNED',quality_status='PENDING',specification_json=?,rollback_ref=?,worker_id=null,lease_token=null,lease_until=null,last_error=null,updated_at=current_timestamp where job_id=?",specification,request.get("rollback_ref"),rollbackJobId);
        jdbc.update("update framework_development_rollback_request set rollback_job_id=?,request_status='QUEUED',approved_by=?,approved_at=current_timestamp,updated_at=current_timestamp where rollback_request_id=?",rollbackJobId,actor,requestId);
        event(((Number)request.get("source_job_id")).longValue(),"ROLLBACK_APPROVED",String.valueOf(request.get("job_status")),"QUEUED",actor,"{\"rollbackRequestId\":"+requestId+",\"rollbackJobId\":"+rollbackJobId+"}");
        return Map.of("success",true,"rollbackRequestId",requestId,"rollbackJobId",rollbackJobId,"status","QUEUED","failClosed",true);
    }

    @Transactional public Map<String,Object> requestDevelopmentJob(long jobId,String actor){
        List<Map<String,Object>> rows=jdbc.queryForList("select job_id,process_code,step_code,job_status,approval_status from framework_development_job where job_id=? for update",jobId);
        if(rows.isEmpty())throw new IllegalArgumentException("개발 작업이 존재하지 않습니다.");
        Map<String,Object> job=rows.get(0);
        String from=String.valueOf(job.get("job_status"));
        if("RUNNING".equals(from))throw new IllegalStateException("이미 실행 중인 개발 작업입니다.");
        if("VERIFIED".equals(from)||"COMPLETED".equals(from)){
            return Map.of("success",true,"jobId",jobId,"status",from,"changed",false,"message","이미 검증 완료된 작업입니다.");
        }
        String next="FAILED".equals(from)||"BLOCKED".equals(from)?"RETRY":"PLANNED";
        jdbc.update("update framework_development_job set approval_status='APPROVED',job_status=?,worker_id=null,lease_token=null,lease_until=null,last_error=null,updated_at=current_timestamp where job_id=?",next,jobId);
        event(jobId,"DEVELOPMENT_REQUESTED",from,next,actor,"{\"source\":\"ACTOR_PROCESS_DASHBOARD\"}");
        return Map.of("success",true,"jobId",jobId,"processCode",String.valueOf(job.get("process_code")),"stepCode",String.valueOf(job.get("step_code")),"status",next,"changed",true);
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
        List<Map<String,Object>> steps=jdbc.queryForList("select s.process_code,s.step_code,s.step_name,s.actor_code,s.command_code,s.from_state,s.to_state,s.completion_rule,s.user_path,s.admin_path,s.requires_user_page,s.requires_admin_page,p.domain_code from framework_process_step s join framework_process_definition p on p.process_code=s.process_code where (s.requires_user_page or s.requires_admin_page)"+filter+" order by p.development_order,s.process_code,s.step_order limit ?",args);
        Set<String> registeredSourceRoutes=new HashSet<>(jdbc.queryForList("select distinct lower(split_part(asset.route_path,'?',1)) from framework_design_asset_registry asset join ui_page_manifest page on lower(split_part(page.route_path,'?',1))=lower(split_part(asset.route_path,'?',1)) and page.active_yn='Y' where asset.active_yn='Y' and trim(asset.source_path)<>''",String.class));
        int compiled=0,valid=0,invalid=0,order=0;
        for(Map<String,Object>s:steps){
            for(String audience:List.of("USER","ADMIN")){
                boolean required=Boolean.TRUE.equals(s.get("USER".equals(audience)?"requires_user_page":"requires_admin_page"));if(!required||compiled>=limit)continue;
                String processCode=String.valueOf(s.get("process_code")),stepCode=String.valueOf(s.get("step_code")),actorCode=String.valueOf(s.get("actor_code")),stepName=String.valueOf(s.get("step_name"));
                Object rawPath=s.get("USER".equals(audience)?"user_path":"admin_path");String route=rawPath==null?"":String.valueOf(rawPath).trim();
                String screenType=inferScreenType(stepName,route,audience);String pageId=(processCode+"_"+stepCode+"_"+audience).replaceAll("[^A-Za-z0-9_]","_");String code="BP_"+pageId;
                int caseTypes=jdbc.queryForObject("select count(distinct case_type) from framework_simulation_case where process_code=? and case_type in ('HAPPY_PATH','AUTHORITY','ISOLATION','EXCEPTION','RECOVERY')",Integer.class,processCode);
                String safeRoute=route.isBlank()?("ADMIN".equals(audience)?"/admin/generated/":"/generated/")+processCode.toLowerCase(Locale.ROOT)+"/"+stepCode.toLowerCase(Locale.ROOT):route;
                List<Map<String,Object>> designRows=jdbc.queryForList("select business_purpose,entry_condition,exit_condition,kpi_contract,section_contract,field_contract,command_contract,state_contract,api_contract,data_contract,evidence_contract,responsive_contract,accessibility_contract,security_contract,design_readiness_score from framework_professional_screen_design_readiness where process_code=? and step_code=? and audience=? and lower(split_part(route_path,'?',1))=lower(?) order by design_readiness_score desc,contract_id desc limit 1",processCode,stepCode,audience,ScreenDevelopmentNoteService.cleanRoute(safeRoute));
                Map<String,Object> design=designRows.isEmpty()?Map.of():designRows.get(0);
                int designScore=designRows.isEmpty()?0:((Number)design.get("design_readiness_score")).intValue();
                String validation=route.isBlank()?"화면 경로 누락":caseTypes<5?"필수 5종 테스트 시나리오 누락":(!designRows.isEmpty()&&designScore<100)?"전문 화면 설계 계약 미완료":"";String status=validation.isBlank()?"VALID":"INVALID";
                String spec="{\"domain\":\""+jsonEscape(String.valueOf(s.get("domain_code")))+"\",\"actor\":\""+jsonEscape(actorCode)+"\",\"process\":\""+jsonEscape(processCode)+"\",\"step\":\""+jsonEscape(stepCode)+"\",\"commandCode\":\""+jsonEscape(String.valueOf(s.get("command_code")))+"\",\"fromState\":\""+jsonEscape(String.valueOf(s.get("from_state")))+"\",\"toState\":\""+jsonEscape(String.valueOf(s.get("to_state")))+"\",\"completionRule\":\""+jsonEscape(String.valueOf(s.get("completion_rule")))+"\",\"screenType\":\""+screenType+"\",\"designSystem\":\"KRDS_GOV\",\"businessPurpose\":\""+jsonEscape(String.valueOf(design.getOrDefault("business_purpose",stepName)))+"\",\"entryCondition\":\""+jsonEscape(String.valueOf(design.getOrDefault("entry_condition","")))+"\",\"exitCondition\":\""+jsonEscape(String.valueOf(design.getOrDefault("exit_condition","")))+"\",\"kpis\":"+String.valueOf(design.getOrDefault("kpi_contract","[]"))+",\"sections\":"+String.valueOf(design.getOrDefault("section_contract","[]"))+",\"fields\":"+String.valueOf(design.getOrDefault("field_contract","[]"))+",\"commands\":"+String.valueOf(design.getOrDefault("command_contract","[]"))+",\"states\":"+String.valueOf(design.getOrDefault("state_contract","[]"))+",\"apiContracts\":"+String.valueOf(design.getOrDefault("api_contract","[]"))+",\"dataContracts\":"+String.valueOf(design.getOrDefault("data_contract","[]"))+",\"responsive\":\""+jsonEscape(String.valueOf(design.getOrDefault("responsive_contract","")))+"\",\"accessibility\":\""+jsonEscape(String.valueOf(design.getOrDefault("accessibility_contract","")))+"\"}";
                String trace="{\"requiredScenarioTypes\":[\"HAPPY_PATH\",\"AUTHORITY\",\"ISOLATION\",\"EXCEPTION\",\"RECOVERY\"],\"caseTypeCount\":"+caseTypes+",\"designReadinessScore\":"+designScore+",\"evidenceContract\":"+String.valueOf(design.getOrDefault("evidence_contract","[]"))+"}";
                boolean registeredSource=registeredSourceRoutes.contains(ScreenDevelopmentNoteService.cleanRoute(safeRoute).toLowerCase(Locale.ROOT));
                String strategy=!"VALID".equals(status)?"DESIGN_REQUIRED":registeredSource?"ADOPT_EXISTING":"GENERATED_RUNTIME";
                String transition=!"VALID".equals(status)?"DESIGN_BLOCKED":registeredSource?"CONTRACT_LINKED":"RUNTIME_ACTIVE";
                Long blueprintId=jdbc.queryForObject("insert into framework_screen_blueprint(blueprint_code,process_code,step_code,actor_code,audience,page_id,page_name,route_path,screen_type,template_code,specification_json,traceability_json,validation_status,validation_message,implementation_strategy,transition_status,created_by) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) on conflict(audience,route_path) do update set process_code=excluded.process_code,step_code=excluded.step_code,actor_code=excluded.actor_code,page_id=excluded.page_id,page_name=excluded.page_name,screen_type=excluded.screen_type,template_code=excluded.template_code,specification_json=excluded.specification_json,traceability_json=excluded.traceability_json,validation_status=excluded.validation_status,validation_message=excluded.validation_message,implementation_strategy=case when framework_screen_blueprint.implementation_strategy='ADOPT_EXISTING' then 'ADOPT_EXISTING' else excluded.implementation_strategy end,transition_status=case when framework_screen_blueprint.implementation_strategy='ADOPT_EXISTING' then 'CONTRACT_LINKED' else excluded.transition_status end,updated_at=current_timestamp returning blueprint_id",Long.class,code,processCode,stepCode,actorCode,audience,pageId,stepName+("USER".equals(audience)?"":" 관리"),safeRoute,screenType,"KRDS_"+screenType,spec,trace,status,validation,strategy,transition,actor);
                jdbc.update("insert into framework_screen_generation_batch_item(batch_id,blueprint_id,item_order,item_status,validation_message) values(?,?,?,?,?) on conflict(batch_id,blueprint_id) do nothing",batchId,blueprintId,++order,status,validation);
                compiled++;if("VALID".equals(status))valid++;else invalid++;
            }
        }
        String batchStatus=invalid==0?"COMPILED":"REVIEW_REQUIRED";
        jdbc.update("update framework_screen_generation_batch set compiled_count=?,valid_count=?,invalid_count=?,batch_status=?,summary_json=?,completed_at=current_timestamp where batch_id=?",compiled,valid,invalid,batchStatus,"{\"coverage\":"+(compiled==0?0:Math.round(valid*100.0/compiled))+"}",batchId);
        return Map.of("success",true,"batchId",batchId,"batchCode",batchCode,"compiled",compiled,"valid",valid,"invalid",invalid,"status",batchStatus,"dryRun",dryRun);
    }

    @Transactional public Map<String,Object> compileAndQueueScreens(Map<String,Object>b,String actor){
        long started=System.nanoTime();Map<String,Object> request=new LinkedHashMap<>(b);request.put("dryRun",false);
        Map<String,Object> compiled=compileScreenBlueprints(request,actor);long batchId=((Number)compiled.get("batchId")).longValue();
        Map<String,Object> queued=queueScreenGeneration(batchId,actor);long elapsed=Math.max(1,(System.nanoTime()-started)/1_000_000);
        int count=((Number)compiled.getOrDefault("compiled",0)).intValue();Map<String,Object> result=new LinkedHashMap<>(compiled);
        result.put("queued",queued.get("queued"));result.put("elapsedMillis",elapsed);result.put("screensPerSecond",Math.round(count*1000.0/elapsed));result.put("runtime","COMMON_GENERATED_SCREEN");result.put("sourceFilesPerScreen",0);return result;
    }

    /**
     * Resolves one browser location into the canonical screen and executable
     * actor/process contract. A screen is N:M with process steps, therefore an
     * ambiguous route is never silently bound to the first row.
     */
    public Map<String,Object> screenContext(String routePath,String pageId,String projectId,String processCode,String stepCode,
                                            String actorCode,String audience,String capabilityCode,Set<String> allowedAudiences,
                                            String accountId,String tenantId,boolean unrestrictedActors){
        String requestedRoute=routePath==null?"":routePath.trim();
        String route=requestedRoute.isBlank()?"":canonicalScreenContextRoute(requestedRoute);
        String requestedPage=pageId==null?"":pageId.trim();
        String project=projectId==null?"":projectId.trim();
        String requestedProcess=processCode==null?"":processCode.trim().toUpperCase(Locale.ROOT);
        String requestedStep=stepCode==null?"":stepCode.trim().toUpperCase(Locale.ROOT);
        String requestedActor=actorCode==null?"":actorCode.trim().toUpperCase(Locale.ROOT);
        String requestedAudience=audience==null?"":audience.trim().toUpperCase(Locale.ROOT);
        // Capability selection is bounded by the screen + process + step mapping. It is metadata
        // resolution only; authorization remains the responsibility of the authenticated command.
        String requestedCapability=capabilityCode==null?"":capabilityCode.trim().toUpperCase(Locale.ROOT);
        Set<String> audienceScope=allowedAudiences==null?Set.of():allowedAudiences.stream()
            .filter(value->value!=null)
            .map(value->value.trim().toUpperCase(Locale.ROOT))
            .collect(java.util.stream.Collectors.toUnmodifiableSet());

        String account=accountId==null?"":accountId.trim();
        String tenant=tenantId==null?"":tenantId.trim();
        String assignmentProject="*".equals(project)?"":project;
        Set<String> actorScope=unrestrictedActors?Set.of():jdbc.queryForList("""
            select distinct upper(assignment.actor_code) as "actorCode"
              from framework_account_actor_assignment assignment
              join framework_actor_definition actor_definition
                on actor_definition.actor_code=assignment.actor_code
               and actor_definition.use_at='Y'
             where assignment.tenant_id=?
               and lower(assignment.account_id)=lower(?)
               and assignment.assignment_status='ACTIVE'
               and (assignment.valid_from is null or assignment.valid_from<=current_date)
               and (assignment.valid_until is null or assignment.valid_until>=current_date)
               and (assignment.project_id='*' or (?<>'' and assignment.project_id=?))
               and (coalesce(nullif(assignment.data_scope,''),'*')='*'
                    or (?<>'' and ?=any(string_to_array(replace(assignment.data_scope,' ',''),','))))
             order by upper(assignment.actor_code)
            """,tenant,account,assignmentProject,assignmentProject,assignmentProject,assignmentProject).stream()
            .map(row->String.valueOf(row.get("actorCode")).trim().toUpperCase(Locale.ROOT))
            .filter(value->!value.isBlank())
            .collect(java.util.stream.Collectors.toUnmodifiableSet());
        if(!unrestrictedActors&&!requestedActor.isBlank()&&!actorScope.contains(requestedActor)){
            throw new SecurityException("SCREEN_CONTEXT_ACTOR_FORBIDDEN");
        }

        List<Map<String,Object>> identities=jdbc.queryForList("""
            with requested(route_key,page_id) as (values (?::text,?::text))
            select coalesce(screen.route_key,
                            lower(split_part(manifest.route_path,'?',1)),
                            lower(split_part(blueprint.route_path,'?',1)),
                            requested.route_key,'') as "routeKey",
                   coalesce(screen.route_key,
                            lower(split_part(manifest.route_path,'?',1)),
                            lower(split_part(blueprint.route_path,'?',1)),
                            requested.route_key,'') as "canonicalRoutePath",
                   coalesce(manifest.page_id,blueprint.page_id,nullif(requested.page_id,''),'') as "pageId",
                   screen.screen_resource_id as "screenResourceId",
                   coalesce(screen.screen_name,manifest.page_name,blueprint.page_name,'') as "screenName",
                   coalesce(screen.screen_type,'') as "screenType",
                   coalesce(screen.implementation_status,'UNREGISTERED') as "implementationStatus"
              from requested
              left join lateral (
                   select resource.screen_resource_id,resource.route_key,resource.screen_name,
                          resource.screen_type,resource.implementation_status
                     from framework_screen_resource resource
                    where (requested.route_key<>'' and resource.route_key=requested.route_key)
                       or (requested.page_id<>'' and exists(
                              select 1 from ui_page_manifest page
                               where page.active_yn='Y'
                                 and lower(page.page_id)=lower(requested.page_id)
                                 and lower(split_part(page.route_path,'?',1))=resource.route_key))
                       or (requested.page_id<>'' and exists(
                              select 1 from framework_screen_blueprint candidate_blueprint
                               where lower(candidate_blueprint.page_id)=lower(requested.page_id)
                                 and lower(split_part(candidate_blueprint.route_path,'?',1))=resource.route_key))
                    order by case when requested.route_key<>'' and resource.route_key=requested.route_key then 0 else 1 end,
                             resource.updated_at desc,resource.screen_resource_id
                    limit 1
              ) screen on true
              left join lateral (
                   select page.page_id,page.page_name,page.route_path
                     from ui_page_manifest page
                    where page.active_yn='Y' and (
                          (requested.page_id<>'' and lower(page.page_id)=lower(requested.page_id))
                       or (screen.route_key is not null and lower(split_part(page.route_path,'?',1))=screen.route_key)
                       or (requested.route_key<>'' and lower(split_part(page.route_path,'?',1))=requested.route_key))
                    order by case when requested.page_id<>'' and lower(page.page_id)=lower(requested.page_id) then 0 else 1 end,
                             page.updated_at desc,page.page_id
                    limit 1
              ) manifest on true
              left join lateral (
                   select candidate_blueprint.page_id,candidate_blueprint.page_name,candidate_blueprint.route_path
                     from framework_screen_blueprint candidate_blueprint
                    where (requested.page_id<>'' and lower(candidate_blueprint.page_id)=lower(requested.page_id))
                       or (screen.route_key is not null and lower(split_part(candidate_blueprint.route_path,'?',1))=screen.route_key)
                       or (requested.route_key<>'' and lower(split_part(candidate_blueprint.route_path,'?',1))=requested.route_key)
                    order by case when requested.page_id<>'' and lower(candidate_blueprint.page_id)=lower(requested.page_id) then 0 else 1 end,
                             candidate_blueprint.updated_at desc,candidate_blueprint.blueprint_id
                    limit 1
              ) blueprint on true
            """,route,requestedPage);

        Map<String,Object> identity=new LinkedHashMap<>();
        if(!identities.isEmpty())identity.putAll(identities.get(0));
        identity.putIfAbsent("routeKey",route);
        identity.putIfAbsent("canonicalRoutePath",route);
        identity.putIfAbsent("pageId",requestedPage);
        identity.putIfAbsent("screenResourceId",null);
        identity.putIfAbsent("screenName","");
        identity.putIfAbsent("screenType","");
        identity.putIfAbsent("implementationStatus","UNREGISTERED");
        identity.put("requestedRoutePath",requestedRoute);
        identity.put("projectId",project);
        identity.put("requestedCapabilityCode",requestedCapability);

        String resolvedRoute=String.valueOf(identity.getOrDefault("routeKey","")).trim().toLowerCase(Locale.ROOT);
        Object rawScreenId=identity.get("screenResourceId");
        long screenId=rawScreenId instanceof Number number?number.longValue():-1L;
        List<Map<String,Object>> candidates=resolvedRoute.isBlank()?List.of():jdbc.queryForList("""
            with candidate_source as (
              select binding.process_code,binding.step_code,binding.audience,binding.entry_mode,
                     coalesce(nullif(binding.actor_code,''),binding_step.actor_code) as actor_code,
                     0 as source_rank,'SCREEN_BINDING'::varchar as resolution_source
                from framework_process_step_screen_binding binding
                join framework_process_step binding_step
                  on binding_step.process_code=binding.process_code and binding_step.step_code=binding.step_code
               where binding.screen_resource_id=? and binding.binding_status='ACTIVE'
              union all
              select step.process_code,step.step_code,
                     case when lower(split_part(coalesce(step.admin_path,''),'?',1))=?
                                and lower(split_part(coalesce(step.user_path,''),'?',1))<>?
                          then 'ADMIN' else 'USER' end as audience,
                     'PRIMARY' as entry_mode,step.actor_code,1 as source_rank,
                     'STEP_PATH'::varchar as resolution_source
                from framework_process_step step
               where lower(split_part(coalesce(step.user_path,''),'?',1))=?
                  or lower(split_part(coalesce(step.admin_path,''),'?',1))=?
              union all
              select step.process_code,step.step_code,menu.audience,'PRIMARY' as entry_mode,
                     step.actor_code,2 as source_rank,'MENU_SEMANTIC'::varchar as resolution_source
                from framework_process_menu_binding menu
                join framework_menu_route_semantic_audit semantic on semantic.menu_code=menu.menu_code
                join framework_process_step step on step.process_code=menu.process_code
                 and menu.step_code=step.step_code
               where menu.binding_status='ACTIVE'
                 and menu.verified_at is not null
                 and semantic.semantic_status in ('EXACT_STEP','SCREEN_CONTRACT')
                 and semantic.resolved_process_code=menu.process_code
                 and semantic.resolved_step_code=menu.step_code
                 and semantic.resolved_actor_code=menu.actor_code
                 and lower(split_part(coalesce(menu.menu_url,''),'?',1))=?
            ), candidates as (
              select distinct on (process_code,step_code,audience)
                     process_code,step_code,audience,entry_mode,actor_code,resolution_source
                from candidate_source
               order by process_code,step_code,audience,source_rank,
                        case entry_mode when 'PRIMARY' then 0 else 1 end,
                        case audience when 'USER' then 0 when 'ADMIN' then 1 else 2 end
            )
            select upper(process.domain_code) as "workTypeCode",
                   coalesce(work_type.work_type_name,process.domain_code) as "workTypeName",
                   step.process_code as "processCode",process.process_name as "processName",
                   step.step_code as "stepCode",step.step_name as "stepName",step.step_order as "stepOrder",
                   candidates.actor_code as "actorCode",
                   coalesce(actor.actor_name,candidates.actor_code) as "actorName",
                   step.requirement_text as "workPurpose",step.completion_rule as "completionRule",
                   step.input_contract as "inputContract",step.output_contract as "outputContract",
                   coalesce(nullif(step.user_path,''),(
                     select menu.menu_url from framework_process_menu_binding menu
                     join framework_menu_route_semantic_audit semantic on semantic.menu_code=menu.menu_code
                      where menu.process_code=step.process_code and menu.audience='USER'
                        and menu.binding_status='ACTIVE'
                        and menu.verified_at is not null
                        and menu.step_code=step.step_code
                        and semantic.semantic_status in ('EXACT_STEP','SCREEN_CONTRACT')
                        and semantic.resolved_process_code=menu.process_code
                        and semantic.resolved_step_code=menu.step_code
                        and semantic.resolved_actor_code=menu.actor_code
                      order by (menu.step_code=step.step_code) desc,menu.menu_code limit 1),'') as "userPath",
                   coalesce(nullif(step.admin_path,''),(
                     select menu.menu_url from framework_process_menu_binding menu
                     join framework_menu_route_semantic_audit semantic on semantic.menu_code=menu.menu_code
                      where menu.process_code=step.process_code and menu.audience='ADMIN'
                        and menu.binding_status='ACTIVE'
                        and menu.verified_at is not null
                        and menu.step_code=step.step_code
                        and semantic.semantic_status in ('EXACT_STEP','SCREEN_CONTRACT')
                        and semantic.resolved_process_code=menu.process_code
                        and semantic.resolved_step_code=menu.step_code
                        and semantic.resolved_actor_code=menu.actor_code
                      order by (menu.step_code=step.step_code) desc,menu.menu_code limit 1),'') as "adminPath",
                   step.automation_status as "automationStatus",
                   candidates.audience,candidates.entry_mode as "entryMode",
                   candidates.resolution_source as "resolutionSource"
              from candidates
              join framework_process_step step using(process_code,step_code)
              join framework_process_definition process using(process_code)
              left join framework_business_work_type work_type on work_type.work_type_code=upper(process.domain_code)
              left join framework_actor_definition actor on actor.actor_code=candidates.actor_code
             where (?='' or exists(
                    select 1
                      from framework_step_capability_binding step_capability
                      join framework_screen_capability capability
                        on capability.capability_id=step_capability.capability_id
                       and capability.screen_resource_id=?
                     where step_capability.process_code=candidates.process_code
                       and step_capability.step_code=candidates.step_code
                       and upper(capability.capability_code)=?
                   ))
             order by coalesce(work_type.sort_order,9999),process.development_order,step.process_code,
                      step.step_order,candidates.audience,candidates.actor_code
            """,screenId,resolvedRoute,resolvedRoute,resolvedRoute,resolvedRoute,resolvedRoute,
                requestedCapability,screenId,requestedCapability);

        List<Map<String,Object>> resolvedCandidates=candidates;
        List<Map<String,Object>> audienceCandidates=resolvedCandidates.stream()
            .map(candidate->{
                Map<String,Object> scoped=new LinkedHashMap<>(candidate);
                String candidateAudience=String.valueOf(scoped.get("audience")).toUpperCase(Locale.ROOT);
                if("ADMIN".equals(candidateAudience))scoped.put("userPath","");
                else scoped.put("adminPath","");
                return scoped;
            })
            .filter(candidate->audienceScope.contains(
                String.valueOf(candidate.get("audience")).toUpperCase(Locale.ROOT)))
            .toList();
        candidates=audienceCandidates.stream()
            .filter(candidate->unrestrictedActors||actorScope.contains(
                String.valueOf(candidate.get("actorCode")).toUpperCase(Locale.ROOT)))
            .toList();

        boolean accessRestricted=!unrestrictedActors&&!audienceCandidates.isEmpty()&&candidates.isEmpty();
        Map<String,Object> policy=loadScreenWorkflowPolicy(resolvedRoute);
        boolean policyDefined=!policy.isEmpty();
        boolean hasBinding=!resolvedCandidates.isEmpty();
        String classification=policyDefined
            ?String.valueOf(policy.getOrDefault("classification","REVIEW_REQUIRED")).trim().toUpperCase(Locale.ROOT)
            :(hasBinding?"EXECUTABLE":"REVIEW_REQUIRED");
        String reasonCode=policyDefined
            ?String.valueOf(policy.getOrDefault("reasonCode","")).trim()
            :(hasBinding?"BINDING_RESOLVED":"WORKFLOW_POLICY_UNDEFINED");
        String reasonText=policyDefined
            ?String.valueOf(policy.getOrDefault("reasonText","")).trim()
            :(hasBinding?"검증된 화면 업무 연결 후보가 존재합니다.":"화면 업무 정책과 실행 가능한 연결 후보가 없습니다.");
        String reviewStatus=policyDefined
            ?String.valueOf(policy.getOrDefault("reviewStatus","PENDING")).trim().toUpperCase(Locale.ROOT)
            :(hasBinding?"AUTO_APPROVED":"PENDING");
        if("EXECUTABLE".equals(classification)&&!hasBinding){
            classification="REVIEW_REQUIRED";
            reasonCode="EXECUTABLE_BINDING_MISSING";
            reasonText="실행 가능 화면 정책에 대응하는 검증된 프로세스·단계 연결이 없습니다.";
            reviewStatus="CONFLICT";
        }else if(Set.of("INFORMATIONAL","EXCLUDED").contains(classification)&&hasBinding){
            classification="REVIEW_REQUIRED";
            reasonCode="POLICY_BINDING_CONFLICT";
            reasonText="비실행 화면 정책과 실행 가능한 프로세스·단계 연결이 동시에 존재합니다.";
            reviewStatus="CONFLICT";
        }else if(accessRestricted&&"EXECUTABLE".equals(classification)){
            reasonCode="ACCESS_RESTRICTED";
            reasonText="화면 업무는 실행 가능하지만 현재 계정에 배정된 액터 범위에는 포함되지 않습니다.";
        }

        List<Map<String,Object>> matching=candidates.stream()
            .filter(candidate->requestedProcess.isBlank()||requestedProcess.equals(String.valueOf(candidate.get("processCode")).toUpperCase(Locale.ROOT)))
            .filter(candidate->requestedStep.isBlank()||requestedStep.equals(String.valueOf(candidate.get("stepCode")).toUpperCase(Locale.ROOT)))
            .filter(candidate->requestedActor.isBlank()||requestedActor.equals(String.valueOf(candidate.get("actorCode")).toUpperCase(Locale.ROOT)))
            .filter(candidate->requestedAudience.isBlank()||requestedAudience.equals(String.valueOf(candidate.get("audience")).toUpperCase(Locale.ROOT)))
            .toList();
        Map<String,Object> workflow="EXECUTABLE".equals(classification)&&matching.size()==1
            ?new LinkedHashMap<>(matching.get(0)):null;
        identity.put("audience",workflow!=null?workflow.getOrDefault("audience",""):requestedAudience);

        Map<String,Object> result=new LinkedHashMap<>();
        result.put("linked",workflow!=null);
        result.put("identity",identity);
        result.put("workflow",workflow);
        result.put("candidates",candidates);
        result.put("candidateCount",candidates.size());
        result.put("selectionRequired","EXECUTABLE".equals(classification)&&!accessRestricted
            &&workflow==null&&!candidates.isEmpty());
        result.put("classification",classification);
        result.put("reasonCode",reasonCode);
        result.put("reasonText",reasonText);
        result.put("reviewStatus",reviewStatus);
        result.put("accessRestricted",accessRestricted);
        return result;
    }

    private Map<String,Object> loadScreenWorkflowPolicy(String route){
        if(route==null||route.isBlank())return Map.of();
        Boolean available=jdbc.queryForObject(
            "select to_regclass('public.framework_screen_workflow_policy') is not null",Boolean.class);
        if(!Boolean.TRUE.equals(available))return Map.of();
        List<Map<String,Object>> policies=jdbc.queryForList("""
            select classification,reason_code as "reasonCode",reason_text as "reasonText",
                   source,review_status as "reviewStatus",reviewed_by as "reviewedBy",
                   reviewed_at as "reviewedAt",updated_at as "updatedAt"
              from framework_screen_workflow_policy
             where route_key=?
            """,route);
        return policies.isEmpty()?Map.of():new LinkedHashMap<>(policies.get(0));
    }

    static String canonicalScreenContextRoute(String value){
        String route=ScreenDevelopmentNoteService.cleanRoute(value);
        if("/en".equalsIgnoreCase(route))return "/";
        if(route.regionMatches(true,0,"/en/",0,4))route=route.substring(3);
        while(route.length()>1&&route.endsWith("/"))route=route.substring(0,route.length()-1);
        return route.toLowerCase(Locale.ROOT);
    }

    public Map<String,Object> resolveGeneratedScreen(String routePath){
        String route=ScreenDevelopmentNoteService.cleanRoute(routePath);
        Integer protectedExisting=jdbc.queryForObject("""
            select count(*)
              from framework_screen_blueprint
             where lower(split_part(route_path,'?',1))=lower(?)
               and validation_status='VALID'
               and implementation_strategy='ADOPT_EXISTING'
            """,Integer.class,route);
        if(protectedExisting!=null&&protectedExisting>0){
            return Map.of(
                "enabled",false,
                "routePath",route,
                "protectedExisting",true,
                "source","REGISTERED_IMPLEMENTATION"
            );
        }
        List<Map<String,Object>> screenSpace=jdbc.queryForList("""
            select 'SS_'||upper(substr(specification_hash,1,20)) as "blueprintCode",
                   process_code as "processCode",
                   step_code as "stepCode",
                   actor_code as "actorCode",
                   case when route_path like '/admin/%' then 'ADMIN' else 'USER' end as audience,
                   coalesce(nullif(screen_spec #>> '{dimensions,seedScreenId}',''),
                            'screen-space-'||substr(specification_hash,1,12)) as "pageId",
                   coalesce(nullif(initcap(replace(screen_spec #>> '{dimensions,seedScreenId}','-',' ')),''),
                            initcap(replace(step_code,'_',' '))) as "pageName",
                   route_path as "routePath",
                   archetype_code as "screenType",
                   'KRDS_'||archetype_code as "templateCode",
                   jsonb_build_object(
                     'domain',coalesce(screen_spec #>> '{dimensions,domainObject}',process_code),
                     'businessPurpose',coalesce(screen_spec #>> '{dimensions,seedScreenId}',step_code),
                     'commandCode',coalesce((
                       select runtime_step.command_code
                         from framework_process_step runtime_step
                        where runtime_step.process_code=framework_screen_space_spec.process_code
                          and runtime_step.step_code=framework_screen_space_spec.step_code
                     ),screen_spec #>> '{dimensions,action}','COMPLETE'),
                     'fromState',coalesce((
                       select runtime_step.from_state
                         from framework_process_step runtime_step
                        where runtime_step.process_code=framework_screen_space_spec.process_code
                          and runtime_step.step_code=framework_screen_space_spec.step_code
                     ),state_code),
                     'toState',coalesce((
                       select runtime_step.to_state
                         from framework_process_step runtime_step
                        where runtime_step.process_code=framework_screen_space_spec.process_code
                          and runtime_step.step_code=framework_screen_space_spec.step_code
                     ),state_code),
                     'completionRule',coalesce((
                       select runtime_step.completion_rule
                         from framework_process_step runtime_step
                        where runtime_step.process_code=framework_screen_space_spec.process_code
                          and runtime_step.step_code=framework_screen_space_spec.step_code
                     ),''),
                     'sections',coalesce(screen_spec #> '{composition,sections}','[]'::jsonb),
                     'fields',coalesce((
                       select jsonb_agg(jsonb_build_object(
                         'code',field->>'fieldCode',
                         'label',coalesce(field->>'fieldName',field->>'fieldCode'),
                         'dataType',coalesce(field->>'dataType','STRING'),
                         'control',coalesce(field->>'controlType','TEXT'),
                         'required',coalesce((field->>'required')::boolean,false),
                         'validation',coalesce(field->'validation','{}'::jsonb),
                         'group',coalesce(field->>'fieldGroup','WORK')
                       ) order by coalesce((field->>'fieldOrder')::integer,9999),field->>'fieldCode')
                         from jsonb_array_elements(coalesce(
                           (select nullif(framework_step_contract_fields(execution_spec.field_contract,'USER'),'[]'::jsonb) from framework_step_execution_spec execution_spec where execution_spec.process_code=framework_screen_space_spec.process_code and execution_spec.step_code=framework_screen_space_spec.step_code),
                           (select framework_try_jsonb(screen_contract.field_contract) from framework_professional_screen_contract screen_contract where screen_contract.process_code=framework_screen_space_spec.process_code and screen_contract.step_code=framework_screen_space_spec.step_code order by case screen_contract.audience when 'USER' then 0 else 1 end limit 1),
                           '[]'::jsonb
                         )) field
                        where nullif(field->>'fieldCode','') is not null
                          and coalesce((field->>'editable')::boolean,false)
                     ),(
                       select jsonb_agg(jsonb_build_object(
                         'code',field_name,
                         'label',initcap(replace(replace(field_name,'.',' '),'_',' ')),
                         'dataType','STRING',
                         'control','TEXT',
                         'required',field_name in ('tenantId','companyId','projectId')
                       ) order by ordinal)
                       from jsonb_array_elements_text(coalesce(screen_spec #> '{bindings,dataContracts}','[]'::jsonb))
                            with ordinality as contract_field(field_name,ordinal)
                       where field_name not like '%%.output'
                     ),'[]'::jsonb),
                     'commands',jsonb_build_array(jsonb_build_object(
                       'code',coalesce((
                         select runtime_step.command_code
                           from framework_process_step runtime_step
                          where runtime_step.process_code=framework_screen_space_spec.process_code
                            and runtime_step.step_code=framework_screen_space_spec.step_code
                       ),screen_spec #>> '{dimensions,action}','COMPLETE'),
                       'label',coalesce((
                         select runtime_step.step_name
                           from framework_process_step runtime_step
                          where runtime_step.process_code=framework_screen_space_spec.process_code
                            and runtime_step.step_code=framework_screen_space_spec.step_code
                       ),screen_spec #>> '{dimensions,action}','COMPLETE')
                     )),
                     'states',jsonb_build_array(state_code),
                     'responsive',coalesce(screen_spec #> '{composition,responsive}','[]'::jsonb),
                     'dataContracts',coalesce(screen_spec #> '{bindings,dataContracts}','[]'::jsonb),
                     'apiContracts',jsonb_build_array(
                       jsonb_build_object('code','LOAD_DRAFT','method','GET','path','/home/api/process-executions/draft'),
                       jsonb_build_object('code','LOAD_FIELD_OPTIONS','method','GET','path','/home/api/process-executions/field-options'),
                       jsonb_build_object('code','SAVE_DRAFT','method','PUT','path','/home/api/process-executions/draft'),
                       jsonb_build_object('code','EXECUTE_COMMAND','method','POST','path','/home/api/process-executions/{executionId}/commands')
                     ),
                     'permissions',jsonb_build_array(jsonb_build_object(
                       'code',actor_code,'scope','TENANT_PROJECT','serverAuthorization',true
                     )),
                     'validations',jsonb_build_array(
                       jsonb_build_object('code','REQUIRED_FIELDS','type','CONTRACT'),
                       jsonb_build_object('code','OPTIMISTIC_VERSION','type','CONCURRENCY')
                     ),
                     'screenSpace',screen_spec
                   )::text as "specificationJson",
                   jsonb_build_object(
                     'source','BACKSTAGE_SCREEN_SPACE',
                     'coordinate',coordinate_key,
                     'specSha256',specification_hash,
                     'validationStatus',validation_status,
                     'requiredScenarioTypes',jsonb_build_array('HAPPY_PATH','VALIDATION_ERROR','FORBIDDEN','CONFLICT','RECOVERY'),
                     'publishedAt',published_at
                   )::text as "traceabilityJson",
                   validation_status as "validationStatus",
                   'SCREEN_SPACE_RUNTIME' as "implementationStrategy",
                   100 as "designScore",
                   true as "designComplete",
                   updated_at as "updatedAt"
              from framework_screen_space_spec
             where lower(split_part(route_path,'?',1))=lower(?)
               and validation_status='VERIFIED'
             order by updated_at desc
             limit 1
            """,route);
        if(!screenSpace.isEmpty()){
            Map<String,Object> result=new LinkedHashMap<>(screenSpace.get(0));
            result.put("enabled",true);
            result.put("source","SCREEN_SPACE_RUNTIME");
            return result;
        }
        List<Map<String,Object>> rows=jdbc.queryForList(
            "select blueprint_code as \"blueprintCode\",process_code as \"processCode\",step_code as \"stepCode\",actor_code as \"actorCode\",audience,page_id as \"pageId\",page_name as \"pageName\",route_path as \"routePath\",screen_type as \"screenType\",template_code as \"templateCode\",specification_json as \"specificationJson\",traceability_json as \"traceabilityJson\",validation_status as \"validationStatus\",implementation_strategy as \"implementationStrategy\",updated_at as \"updatedAt\" from framework_screen_blueprint where lower(split_part(route_path,'?',1))=lower(?) and validation_status='VALID' and implementation_strategy='GENERATED_RUNTIME' order by updated_at desc limit 1",
            route
        );
        if(rows.isEmpty())return Map.of("enabled",false,"routePath",route);
        Map<String,Object> result=new LinkedHashMap<>(rows.get(0));
        result.put("enabled",true);
        result.put("source","LEGACY_GENERATED_RUNTIME");
        return result;
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

    @Transactional public Map<String,Object> queueSelectedBlueprint(long blueprintId,String actor){
        List<Map<String,Object>> rows=jdbc.queryForList(
            "select blueprint_id,blueprint_code,page_name,process_code,step_code,audience,route_path,validation_status " +
            "from framework_screen_blueprint where blueprint_id=? for update",blueprintId);
        if(rows.isEmpty())throw new IllegalArgumentException("사전 생성된 화면 후보가 존재하지 않습니다: "+blueprintId);
        Map<String,Object> blueprint=rows.get(0);
        if(!"VALID".equals(String.valueOf(blueprint.get("validation_status"))))
            throw new IllegalStateException("검증 완료된 화면 후보만 실행할 수 있습니다: "+blueprintId);
        String batchCode="E4B_SELECTED_"+System.currentTimeMillis();
        Long batchId=jdbc.queryForObject(
            "insert into framework_screen_generation_batch(batch_code,batch_name,process_code,requested_count,compiled_count,valid_count,invalid_count,dry_run,batch_status,requested_by) " +
            "values(?,?,?,?,1,1,0,false,'COMPILED',?) returning batch_id",
            Long.class,batchCode,String.valueOf(blueprint.get("page_name"))+" 선택 실행",
            String.valueOf(blueprint.get("process_code")),1,actor);
        jdbc.update(
            "insert into framework_screen_generation_batch_item(batch_id,blueprint_id,item_order,item_status) values(?,?,1,'VALID')",
            batchId,blueprintId);
        Map<String,Object> queued=queueScreenGeneration(batchId,actor);
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("success",true);result.put("batchId",batchId);result.put("batchCode",batchCode);
        result.put("blueprintId",blueprintId);result.put("blueprintCode",blueprint.get("blueprint_code"));
        result.put("routePath",blueprint.get("route_path"));result.put("queued",queued.get("queued"));
        result.put("source","PRECOMPILED_BLUEPRINT");
        return result;
    }

    public Map<String,Object> exportScreenGeneration(long batchId){
        List<Map<String,Object>> batches=jdbc.queryForList("select batch_id as \"batchId\",batch_code as \"batchCode\",batch_name as \"batchName\",batch_status as \"batchStatus\",compiled_count as \"compiledCount\",valid_count as \"validCount\",invalid_count as \"invalidCount\" from framework_screen_generation_batch where batch_id=?",batchId);
        if(batches.isEmpty())throw new IllegalArgumentException("생성 배치가 존재하지 않습니다.");
        List<Map<String,Object>> blueprints=jdbc.queryForList("select b.blueprint_id as \"blueprintId\",b.blueprint_code as \"blueprintCode\",b.process_code as \"processCode\",b.step_code as \"stepCode\",b.actor_code as \"actorCode\",b.audience,b.page_id as \"pageId\",b.page_name as \"pageName\",b.route_path as \"routePath\",b.screen_type as \"screenType\",b.template_code as \"templateCode\",b.specification_json as \"specificationJson\",b.traceability_json as \"traceabilityJson\",b.validation_status as \"validationStatus\",b.validation_message as \"validationMessage\",i.item_order as \"itemOrder\" from framework_screen_generation_batch_item i join framework_screen_blueprint b on b.blueprint_id=i.blueprint_id where i.batch_id=? order by i.item_order",batchId);
        return Map.of("schemaVersion","2.0.0","generator","carbonet-detailed-screen-design-compiler","batch",batches.get(0),"blueprints",blueprints);
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
        String designContracts="[]";
        if("DESIGN".equals(type)){
            designContracts=jdbc.queryForObject("select coalesce(json_agg(json_build_object('audience',audience,'routePath',route_path,'screenName',screen_name,'actorCode',actor_code,'businessPurpose',business_purpose,'entryCondition',entry_condition,'exitCondition',exit_condition,'kpis',kpi_contract,'sections',section_contract,'fields',field_contract,'commands',command_contract,'states',state_contract,'apis',api_contract,'data',data_contract,'evidence',evidence_contract,'responsive',responsive_contract,'accessibility',accessibility_contract,'security',security_contract) order by audience,route_path),'[]'::json)::text from framework_professional_screen_contract where process_code=? and step_code=?",String.class,process,step);
        }
        String specification="{\"requirement\":\""+jsonEscape(requirement)+"\",\"screenDevelopmentBasis\":\""+jsonEscape(designBasis)+"\",\"designContracts\":"+(designContracts==null?"[]":designContracts)+",\"noteRequiredBeforeImplementation\":"+type.startsWith("FRONTEND")+"}";
        int changed=jdbc.update("insert into framework_development_job(process_code,step_code,job_type,job_name,target_path,specification_json,created_by) values(?,?,?,?,?,?,?) on conflict(process_code,step_code,job_type,target_path) do update set job_name=excluded.job_name,specification_json=excluded.specification_json,updated_at=current_timestamp",process,step,type,name,safePath,specification,actor);
        String artifactType=switch(type){case "DATABASE"->"DATA";case "FRONTEND_USER","FRONTEND_ADMIN"->"PAGE";case "INTEGRATION"->"OPERATION";default->type;};
        jdbc.update("insert into framework_process_artifact(process_code,step_code,artifact_code,artifact_type,artifact_name,target_path,contract_ref,required,delivery_status,owner_actor_code,acceptance_criteria,notes) values(?,?,?,?,?,?,?,true,'PLANNED',(select actor_code from framework_process_step where process_code=? and step_code=?),?,?) on conflict(process_code,artifact_code) do update set artifact_name=excluded.artifact_name,target_path=excluded.target_path,acceptance_criteria=excluded.acceptance_criteria,updated_at=current_timestamp",process,step,(process+"_"+step+"_"+type).replaceAll("[^A-Za-z0-9_]","_"),artifactType,name,safePath,"AUTO:"+type,process,step,requirement+" 구현 및 자동 테스트 통과","프로세스 단계에서 자동 도출");
        return changed>0?1:0;
    }
    @Transactional public void createCase(Map<String,Object>b){
        jdbc.update("insert into framework_simulation_case(case_code,process_code,case_name,case_type,preconditions,steps_json,assertions_json) values(?,?,?,?,?,?,?) on conflict(case_code) do update set case_name=excluded.case_name,case_type=excluded.case_type,preconditions=excluded.preconditions,steps_json=excluded.steps_json,assertions_json=excluded.assertions_json,updated_at=current_timestamp",req(b,"caseCode"),req(b,"processCode"),req(b,"caseName"),def(b,"caseType","HAPPY_PATH"),req(b,"preconditions"),req(b,"stepsJson"),req(b,"assertionsJson"));
    }

    /** Installs the mandatory safety harness before a generated process is compiled. */
    @Transactional public int ensureGeneratedProcessSafetyCases(String processCode){
        String process=req(Map.of("processCode",processCode),"processCode");
        Integer processCount=jdbc.queryForObject(
            "select count(*) from framework_process_definition where process_code=?",Integer.class,process);
        if(processCount==null||processCount==0)throw new IllegalArgumentException("Process not found: "+process);
        seedCases(process);
        Integer caseTypes=jdbc.queryForObject(
            "select count(distinct case_type) from framework_simulation_case where process_code=? and case_type in ('HAPPY_PATH','AUTHORITY','ISOLATION','EXCEPTION','RECOVERY')",
            Integer.class,process);
        return caseTypes==null?0:caseTypes;
    }

    /** Materializes complete design contracts without claiming implementation verification. */
    @Transactional public int ensureGeneratedProcessDesignContracts(String processCode,String actor){
        String process=req(Map.of("processCode",processCode),"processCode");
        jdbc.update("""
            update framework_process_step
            set output_contract=jsonb_set(
                  coalesce(nullif(output_contract,''),'{}')::jsonb,
                  '{toState}',to_jsonb(to_state),true)::text
            where process_code=?
              and coalesce(output_contract,'{}')::jsonb->>'toState' is distinct from to_state
            """,process);
        ensureProfessionalContracts(process,actor);
        jdbc.update("""
            update framework_professional_screen_contract c set
              business_purpose=coalesce(nullif(s.requirement_text,''),s.step_name)||' 업무를 추적 가능한 방식으로 완료한다.',
              entry_condition=s.from_state||' 상태이며 '||s.actor_code||' 액터가 프로젝트에 배정되어 있다.',
              exit_condition=coalesce(nullif(s.completion_rule,''),s.to_state||' 상태 전이 조건')||' 완료 증적과 감사 이력이 저장된다.',
              kpi_contract='["처리 건수","완료율","기한 준수율","오류 건수"]',
              section_contract='["업무 요약","입력 및 검증","처리 결과","증적 및 이력","다음 업무"]',
              field_contract=json_build_array(json_build_object('input',coalesce(nullif(s.input_contract,''),'{}')::jsonb),json_build_object('output',coalesce(nullif(s.output_contract,''),'{}')::jsonb))::text,
              command_contract=framework_merge_primary_contract_marker(
                framework_try_jsonb(c.command_contract),'PRIMARY_STEP_COMMAND',
                jsonb_build_object('commandCode',s.command_code,'actorCode',s.actor_code,
                  'entryState',s.from_state,'resultState',s.to_state,
                  'serverAuthorization',true,'validationRequired',true,
                  'auditRequired',true))::text,
              state_contract='["LOADING","EMPTY","ERROR","FORBIDDEN","READY","PROCESSING","COMPLETED"]',
              api_contract=framework_merge_primary_contract_marker(
                framework_try_jsonb(c.api_contract),'PRIMARY_STEP_API',
                case when s.requires_api then jsonb_build_object(
                  'declaredContract',coalesce(framework_try_jsonb(s.api_contract),
                    to_jsonb(s.api_contract)),'actorCode',s.actor_code,
                  'commandCode',s.command_code,'transactional',true,
                  'tenantGuard',true,'projectGuard',true,'actorGuard',true,
                  'idempotencyKey',true,'rowVersion',true) end)::text,
              data_contract=json_build_array(
                json_build_object('entity','framework_process_execution'),
                json_build_object('entity','framework_process_execution_event'),
                json_build_object('contextFields',json_build_array('tenantId','projectId','processCode','stepCode','actorCode','statusCode','rowVersion','createdAt','updatedAt')),
                json_build_object('input',coalesce(nullif(s.input_contract,''),'{}')::jsonb),
                json_build_object('output',coalesce(nullif(s.output_contract,''),'{}')::jsonb))::text,
              evidence_contract='["REQUEST","RESPONSE","DB_REREAD","AUTHORITY","E2E","ROLLBACK"]',
              responsive_contract='KRDS responsive contract for mobile 360px, tablet 768px, and desktop 1280px.',
              accessibility_contract='KRDS and WCAG 2.1 AA keyboard, focus, label, contrast, and error-message contract.',
              security_contract='Server-enforced tenant, project, actor, command, optimistic-lock, and audit policy.',
              contract_status='REVIEW_REQUIRED',updated_by=?,updated_at=current_timestamp
            from framework_process_step s
            where c.process_code=s.process_code and c.step_code=s.step_code and c.process_code=?
              and c.updated_by in(
                'BACKSTAGE_REQUIREMENT_AUTOMATION','REQUIREMENT_SELF_HEALER')
            """,actor,process);
        Integer ready=jdbc.queryForObject("""
            select count(*) from framework_process_step step
             where step.process_code=?
               and (not step.requires_user_page or exists(
                 select 1 from framework_professional_screen_contract contract
                  where contract.process_code=step.process_code
                    and contract.step_code=step.step_code and contract.audience='USER'
                    and contract.actor_code=step.actor_code
                    and lower(split_part(contract.route_path,'?',1))=
                        lower(split_part(step.user_path,'?',1))))
               and (not step.requires_admin_page or exists(
                 select 1 from framework_professional_screen_contract contract
                  where contract.process_code=step.process_code
                    and contract.step_code=step.step_code and contract.audience='ADMIN'
                    and contract.actor_code=step.actor_code
                    and lower(split_part(contract.route_path,'?',1))=
                        lower(split_part(step.admin_path,'?',1))))
            """,Integer.class,process);
        return ready==null?0:ready;
    }

    /** Builds the page, field, and step-handoff design catalogs used by the unified work map. */
    private void reconcileRequirementOwnedPageDesigns(String process){
        Integer manualConflicts=jdbc.queryForObject("""
            select count(*) from framework_page_design page
              left join framework_process_step step
                on step.process_code=page.process_code and step.step_code=page.step_code
             where page.process_code=?
               and page.updated_by not in(
                 'BACKSTAGE_REQUIREMENT_AUTOMATION','REQUIREMENT_SELF_HEALER')
               and (step.step_code is null or page.actor_code<>step.actor_code
                 or (upper(page.audience)='USER' and (
                   not step.requires_user_page
                   or lower(split_part(page.planned_route_path,'?',1))<>
                      lower(split_part(coalesce(step.user_path,''),'?',1))))
                 or (upper(page.audience)='ADMIN' and (
                   not step.requires_admin_page
                   or lower(split_part(page.planned_route_path,'?',1))<>
                      lower(split_part(coalesce(step.admin_path,''),'?',1)))))
            """,Integer.class,process);
        if(manualConflicts==null||manualConflicts>0)throw new IllegalStateException(
            "MANUAL_PAGE_DESIGN_REVISION_REQUIRED: "+process+" / "+manualConflicts);
        jdbc.update("""
            delete from framework_page_design page
             where page.process_code=?
               and page.updated_by in(
                 'BACKSTAGE_REQUIREMENT_AUTOMATION','REQUIREMENT_SELF_HEALER')
               and not exists(
                 select 1 from framework_process_step step
                  where step.process_code=page.process_code
                    and step.step_code=page.step_code
                    and ((page.audience='USER' and step.requires_user_page)
                      or (page.audience='ADMIN' and step.requires_admin_page)))
            """,process);
    }

    private void reconcileRequirementOwnedBlueprints(String process,String actor){
        Integer manualConflicts=jdbc.queryForObject("""
            select count(*) from framework_screen_blueprint blueprint
              left join framework_process_step step
                on step.process_code=blueprint.process_code
               and step.step_code=blueprint.step_code
             where blueprint.process_code=?
               and (blueprint.implementation_strategy='ADOPT_EXISTING'
                 or blueprint.created_by not in(
                   'BACKSTAGE_REQUIREMENT_AUTOMATION','REQUIREMENT_SELF_HEALER'))
               and (step.step_code is null or blueprint.actor_code<>step.actor_code
                 or (blueprint.audience='USER' and (
                   not step.requires_user_page
                   or lower(split_part(blueprint.route_path,'?',1))<>
                      lower(split_part(coalesce(step.user_path,''),'?',1))))
                 or (blueprint.audience='ADMIN' and (
                   not step.requires_admin_page
                   or lower(split_part(blueprint.route_path,'?',1))<>
                      lower(split_part(coalesce(step.admin_path,''),'?',1)))))
            """,Integer.class,process);
        if(manualConflicts==null||manualConflicts>0)throw new IllegalStateException(
            "MANUAL_BLUEPRINT_IDENTITY_REVISION_REQUIRED: "+process+" / "+manualConflicts);
        Integer routeConflicts=jdbc.queryForObject("""
            with desired as (
              select step.process_code,step.step_code,step.actor_code,lane.audience,lane.route_path
                from framework_process_step step
                cross join lateral(values
                  ('USER'::text,case when step.requires_user_page then step.user_path end),
                  ('ADMIN'::text,case when step.requires_admin_page then step.admin_path end)
                ) lane(audience,route_path)
               where step.process_code=? and nullif(btrim(lane.route_path),'') is not null)
            select count(*) from desired
              join framework_screen_blueprint blueprint
                on blueprint.audience=desired.audience
               and lower(split_part(blueprint.route_path,'?',1))=
                   lower(split_part(desired.route_path,'?',1))
             where (blueprint.process_code,blueprint.step_code)<>
                   (desired.process_code,desired.step_code)
            """,Integer.class,process);
        if(routeConflicts==null||routeConflicts>0)throw new IllegalStateException(
            "SCREEN_ROUTE_AUTHORITY_CONFLICT: "+process+" / "+routeConflicts);
        jdbc.update("""
            update framework_screen_blueprint blueprint
               set validation_status='INVALID',transition_status='DESIGN_BLOCKED',
                   validation_message='Superseded requirement-owned screen identity',
                   updated_at=current_timestamp
             where blueprint.process_code=?
               and blueprint.implementation_strategy='GENERATED_RUNTIME'
               and blueprint.created_by in(
                 'BACKSTAGE_REQUIREMENT_AUTOMATION','REQUIREMENT_SELF_HEALER')
               and not exists(
                 select 1 from framework_process_step step
                  where step.process_code=blueprint.process_code
                    and step.step_code=blueprint.step_code
                    and ((blueprint.audience='USER' and step.requires_user_page
                      and lower(split_part(blueprint.route_path,'?',1))=
                          lower(split_part(step.user_path,'?',1)))
                     or (blueprint.audience='ADMIN' and step.requires_admin_page
                      and lower(split_part(blueprint.route_path,'?',1))=
                          lower(split_part(step.admin_path,'?',1)))))
            """,process);
        jdbc.update("""
            with desired as (
              select step.process_code,step.step_code,step.step_name,step.actor_code,
                     step.command_code,step.from_state,step.to_state,lane.audience,
                     lower(split_part(lane.route_path,'?',1)) route_path,
                     page.page_code,page.page_title,page.screen_type,
                     resource.layout_type,contract.contract_id,
                     (select theme_id from comtnthemedefinition
                       where theme_id='KRDS_GOV_DEFAULT' and use_at='Y' and is_active='Y') theme_id
                from framework_process_step step
                cross join lateral(values
                  ('USER'::text,case when step.requires_user_page then step.user_path end),
                  ('ADMIN'::text,case when step.requires_admin_page then step.admin_path end)
                ) lane(audience,route_path)
                join framework_page_design page
                  on page.process_code=step.process_code and page.step_code=step.step_code
                 and page.audience=lane.audience
                 and lower(split_part(page.planned_route_path,'?',1))=
                     lower(split_part(lane.route_path,'?',1))
                join framework_professional_screen_contract contract
                  on contract.process_code=step.process_code and contract.step_code=step.step_code
                 and contract.audience=lane.audience and contract.actor_code=step.actor_code
                 and lower(split_part(contract.route_path,'?',1))=
                     lower(split_part(lane.route_path,'?',1))
                join framework_screen_resource resource
                  on resource.route_key=lower(split_part(lane.route_path,'?',1))
               where step.process_code=? and nullif(btrim(lane.route_path),'') is not null
                 and resource.layout_type~'^[A-Z][A-Z0-9_]{1,79}$')
            insert into framework_screen_blueprint(
              blueprint_code,process_code,step_code,actor_code,audience,page_id,page_name,
              route_path,screen_type,template_code,specification_json,traceability_json,
              validation_status,validation_message,implementation_strategy,source_reference,
              transition_status,created_by)
            select 'REQ_BP_'||upper(substr(md5(process_code||':'||step_code||':'||audience),1,24)),
              process_code,step_code,actor_code,audience,page_code,page_title,route_path,
              screen_type,'KRDS_'||screen_type,jsonb_build_object(
                'schemaVersion',1,'source','REQUIREMENT_AUTOMATION','process',process_code,
                'step',step_code,'actor',actor_code,'actorCode',actor_code,
                'commandCode',command_code,'fromState',from_state,'toState',to_state,
                'layout',layout_type,'theme',theme_id)::text,
              jsonb_build_object('source','REQUIREMENT_DOCUMENT','contractId',contract_id)::text,
              'VALID',null,'GENERATED_RUNTIME',
              'FRAMEWORK_PROFESSIONAL_SCREEN_CONTRACT:'||contract_id,
              'CONTRACT_LINKED',?
              from desired where theme_id is not null
            on conflict(process_code,step_code,audience) do update set
              actor_code=excluded.actor_code,page_id=excluded.page_id,page_name=excluded.page_name,
              route_path=excluded.route_path,screen_type=excluded.screen_type,
              template_code=excluded.template_code,specification_json=excluded.specification_json,
              traceability_json=excluded.traceability_json,validation_status='VALID',
              validation_message=null,source_reference=excluded.source_reference,
              transition_status='CONTRACT_LINKED',updated_at=current_timestamp
              where framework_screen_blueprint.implementation_strategy='GENERATED_RUNTIME'
                and framework_screen_blueprint.created_by in(
                  'BACKSTAGE_REQUIREMENT_AUTOMATION','REQUIREMENT_SELF_HEALER')
            """,process,actor);
        Integer missing=jdbc.queryForObject("""
            select count(*) from framework_process_step step
             where step.process_code=? and (
               (step.requires_user_page and not exists(
                 select 1 from framework_screen_blueprint blueprint
                  where blueprint.process_code=step.process_code
                    and blueprint.step_code=step.step_code and blueprint.audience='USER'
                    and blueprint.actor_code=step.actor_code and blueprint.validation_status='VALID'
                    and lower(split_part(blueprint.route_path,'?',1))=
                        lower(split_part(step.user_path,'?',1))))
               or (step.requires_admin_page and not exists(
                 select 1 from framework_screen_blueprint blueprint
                  where blueprint.process_code=step.process_code
                    and blueprint.step_code=step.step_code and blueprint.audience='ADMIN'
                    and blueprint.actor_code=step.actor_code and blueprint.validation_status='VALID'
                    and lower(split_part(blueprint.route_path,'?',1))=
                        lower(split_part(step.admin_path,'?',1)))))
            """,Integer.class,process);
        if(missing==null||missing>0)throw new IllegalStateException(
            "REQUIREMENT_BLUEPRINT_IDENTITY_NOT_EXACT: "+process+" / "+missing);
        jdbc.update("""
            update framework_process_step_screen_binding binding
               set binding_status='INACTIVE',updated_at=current_timestamp
              from framework_screen_resource resource
             where binding.screen_resource_id=resource.screen_resource_id
               and binding.process_code=? and binding.binding_status='ACTIVE'
               and resource.source_kind='PAGE_DESIGN'
               and not exists(
                 select 1 from framework_process_step step
                  where step.process_code=binding.process_code
                    and step.step_code=binding.step_code
                    and binding.actor_code=step.actor_code
                    and ((binding.audience='USER' and step.requires_user_page
                      and resource.route_key=lower(split_part(step.user_path,'?',1)))
                     or (binding.audience='ADMIN' and step.requires_admin_page
                      and resource.route_key=lower(split_part(step.admin_path,'?',1)))))
            """,process);
    }

    @Transactional public int ensureGeneratedProcessPageDesigns(String processCode,String actor){
        String process=req(Map.of("processCode",processCode),"processCode");
        boolean requirementOwned=isRequirementAutomationActor(actor);
        if(requirementOwned)reconcileRequirementOwnedPageDesigns(process);
        jdbc.update("update framework_process_definition set domain_code='DATA_GOVERNANCE',updated_at=current_timestamp where process_code=?",process);
        jdbc.update("""
            with ordered as (
              select s.*,lag(s.step_code) over(order by s.step_order) upstream_step,
                lead(s.step_code) over(order by s.step_order) downstream_step
              from framework_process_step s where s.process_code=?
            ), pages as (
              select o.*,'USER'::varchar audience,o.user_path route_path from ordered o where o.requires_user_page
              union all
              select o.*,'ADMIN'::varchar audience,o.admin_path route_path from ordered o where o.requires_admin_page
            )
            insert into framework_page_design(process_code,step_code,audience,page_code,page_title,page_purpose,
              screen_type,planned_route_path,actual_route_path,route_status,primary_entity,upstream_step_code,
              downstream_step_code,actor_code,entry_condition,exit_condition,responsive_contract,
              accessibility_contract,security_contract,exception_contract,design_status,updated_by)
            select process_code,step_code,audience,process_code||'_'||step_code||'_'||audience,step_name,
              coalesce(nullif(requirement_text,''),step_name||' 업무를 완료한다.'),'WORKSPACE',route_path,null,
              'DESIGN_ONLY','framework_business_record',upstream_step,downstream_step,actor_code,
              from_state||' 상태와 액터·프로젝트 권한을 검증한다.',
              coalesce(nullif(completion_rule,''),to_state||' 상태 전이')||' 및 감사 증적을 저장한다.',
              '{"mobile":"single-column","tablet":"adaptive-two-column","desktop":"task-grid","overflow":"wrap-or-scroll"}'::jsonb,
              '{"standard":"WCAG 2.1 AA","keyboard":true,"labels":true,"focusManagement":true}'::jsonb,
              jsonb_build_object('actorCode',actor_code,'tenantIsolation',true,'projectIsolation',true,'auditRequired',true),
              '{"states":["loading","empty","validation-error","forbidden","conflict","server-error","recovery"],"retry":"idempotent-only"}'::jsonb,
              'DESIGN_COMPLETE',?
            from pages
            on conflict(process_code,step_code,audience) do update set page_title=excluded.page_title,
              page_purpose=excluded.page_purpose,planned_route_path=excluded.planned_route_path,
              actor_code=excluded.actor_code,entry_condition=excluded.entry_condition,exit_condition=excluded.exit_condition,
              design_status='DESIGN_COMPLETE',updated_by=excluded.updated_by,updated_at=current_timestamp
              where not ? or framework_page_design.updated_by in(
                'BACKSTAGE_REQUIREMENT_AUTOMATION','REQUIREMENT_SELF_HEALER')
            """,process,actor,requirementOwned);
        jdbc.update("""
            insert into framework_page_field_definition(page_design_id,field_order,field_group,field_code,field_name,
              data_type,control_type,required,editable,list_visible,search_enabled,api_property,mapping_status,
              validation_contract,privacy_class,permission_code,evidence_required,responsive_priority,help_text,design_source)
            select d.page_design_id,f.ord,'COMMON',f.code,f.name,f.dtype,f.control,f.required,f.editable,
              f.list_visible,f.search_enabled,f.code,f.mapping_status,'{}'::jsonb,'INTERNAL',d.actor_code||':'||d.audience,
              f.evidence_required,f.ord*10,f.help,'REQUIREMENT_AUTOMATION'
            from framework_page_design d cross join (values
              (1,'tenantId','테넌트','STRING','HIDDEN',true,false,false,false,'CONTEXT',false,'테넌트 격리 키'),
              (2,'projectId','프로젝트','STRING','PROJECT_SELECTOR',true,true,true,true,'CONTEXT',false,'프로젝트 선택'),
              (3,'processCode','프로세스','STRING','HIDDEN',true,false,false,false,'CONTEXT',false,'프로세스 식별자'),
              (4,'stepCode','업무 단계','STRING','HIDDEN',true,false,false,false,'CONTEXT',false,'단계 식별자'),
              (5,'actorCode','담당 액터','STRING','ACTOR_SELECTOR',true,true,true,true,'CONTEXT',false,'담당 액터'),
              (6,'statusCode','처리 상태','STRING','STATUS',false,false,true,true,'LOGICAL_CONTRACT',false,'현재 처리 상태'),
              (7,'rowVersion','데이터 버전','INTEGER','HIDDEN',false,false,false,false,'LOGICAL_CONTRACT',false,'동시 수정 방지'),
              (8,'businessData','업무 입력','JSON','DYNAMIC_FORM',false,true,false,false,'LOGICAL_CONTRACT',true,'요구사항 기반 입력'),
              (9,'evidenceFiles','증적 파일','FILE_LIST','FILE_UPLOAD',false,true,false,false,'LOGICAL_CONTRACT',true,'검증 증적'),
              (10,'auditHistory','변경 이력','JSON','AUDIT_TIMELINE',false,false,false,false,'LOGICAL_CONTRACT',true,'감사 이력')
            ) f(ord,code,name,dtype,control,required,editable,list_visible,search_enabled,mapping_status,evidence_required,help)
            where d.process_code=? and (not ? or d.updated_by in(
              'BACKSTAGE_REQUIREMENT_AUTOMATION','REQUIREMENT_SELF_HEALER'))
            on conflict(page_design_id,field_code) do update set field_order=excluded.field_order,
              field_name=excluded.field_name,control_type=excluded.control_type,required=excluded.required,
              editable=excluded.editable,list_visible=excluded.list_visible,search_enabled=excluded.search_enabled,
              permission_code=excluded.permission_code,evidence_required=excluded.evidence_required,
              help_text=excluded.help_text,updated_at=current_timestamp
            """,process,requirementOwned);
        jdbc.update("""
            with ordered as (
              select s.*,lead(s.step_code) over(order by s.step_order) next_step
              from framework_process_step s where s.process_code=?
            )
            insert into framework_process_data_handoff(process_code,from_step_code,to_process_code,to_step_code,
              handoff_type,context_keys,payload_contract,integrity_contract,authorization_contract,failure_contract)
            select process_code,step_code,process_code,next_step,'STEP',
              '["tenantId","projectId","processCode","stepCode","actorCode","rowVersion"]'::jsonb,
              jsonb_build_object('source',output_contract,'targetStep',next_step),
              '{"versionRequired":true,"checksumRequired":true,"auditRequired":true}'::jsonb,
              jsonb_build_object('fromActor',actor_code,'tenantIsolation',true,'projectIsolation',true),
              '{"onMissing":"BLOCK_AND_NOTIFY","onConflict":"RELOAD_AND_RETRY","onUnauthorized":"DENY_AND_AUDIT"}'::jsonb
            from ordered where next_step is not null
            on conflict(process_code,from_step_code,to_process_code,to_step_code,handoff_type) do update set
              context_keys=excluded.context_keys,payload_contract=excluded.payload_contract,
              integrity_contract=excluded.integrity_contract,authorization_contract=excluded.authorization_contract,
              failure_contract=excluded.failure_contract,updated_at=current_timestamp
            """,process);
        jdbc.update("""
            insert into framework_process_execution_topology(process_code,work_type_code,stage_code,execution_wave,
              lane_code,lane_order,execution_mode,join_strategy,predecessor_process_codes,successor_process_codes,
              shared_milestone_code,required_for_join,applicability_rule,topology_status)
            values(?,'DATA_GOVERNANCE','REQUIREMENT_DELIVERY',1,'PRIMARY',1,'SEQUENTIAL','ALL',
              '[]'::jsonb,'[]'::jsonb,?||'_REQUIREMENT_DELIVERY_W1',true,'ALWAYS','DESIGN_COMPLETE')
            on conflict(process_code) do update set work_type_code=excluded.work_type_code,
              stage_code=excluded.stage_code,execution_wave=excluded.execution_wave,lane_code=excluded.lane_code,
              lane_order=excluded.lane_order,execution_mode=excluded.execution_mode,join_strategy=excluded.join_strategy,
              predecessor_process_codes=excluded.predecessor_process_codes,
              successor_process_codes=excluded.successor_process_codes,
              shared_milestone_code=excluded.shared_milestone_code,required_for_join=excluded.required_for_join,
              applicability_rule=excluded.applicability_rule,topology_status=excluded.topology_status,
              updated_at=current_timestamp
            """,process,process);
        Integer workflowOrder=jdbc.queryForObject(
            "select framework_allocate_requirement_process_sequence(?)",Integer.class,process);
        if(workflowOrder==null||workflowOrder<1)
            throw new IllegalStateException("REQUIREMENT_PROCESS_SEQUENCE_ALLOCATION_FAILED: "+process);
        jdbc.update("""
            insert into framework_process_navigation_binding(process_code,menu_code,step_code,actor_code,audience,
              navigation_type,target_path,business_screen_implemented,binding_status,binding_source,verified_at)
            select s.process_code,'H108',s.step_code,s.actor_code,'USER','DESIGN_WORKSPACE',
              '/admin/system/actor-process?process='||s.process_code,false,'ACTIVE','REQUIREMENT_AUTOMATION',current_timestamp
            from framework_process_step s where s.process_code=? order by s.step_order limit 1
            on conflict(process_code) do update set step_code=excluded.step_code,actor_code=excluded.actor_code,
              target_path=excluded.target_path,binding_status='ACTIVE',binding_source=excluded.binding_source,
              verified_at=current_timestamp,updated_at=current_timestamp
            """,process);
        ensureGeneratedScreenDevelopmentAssets(process,actor);
        jdbc.queryForObject("select framework_generate_professional_design_graph(?,?)::text",String.class,process,actor);
        if(requirementOwned)reconcileRequirementOwnedBlueprints(process,actor);
        jdbc.queryForObject("select framework_compile_process_execution_specs(?)",Integer.class,process);
        jdbc.update("""
            update framework_step_execution_spec e set
              handoff_contract=jsonb_build_object('schemaVersion',1,'contractType','STEP_HANDOFF','policy','{}'::jsonb,
                'transitions',jsonb_build_array(jsonb_build_object('handoffType','TERMINAL','toState',s.to_state,
                  'contextKeys',jsonb_build_array('tenantId','projectId','processCode','stepCode','actorCode','rowVersion')))),
              source_hash=md5(e.actor_contract::text||e.business_contract::text||e.transition_contract::text||
                e.input_contract::text||e.output_contract::text||e.screen_contract::text||e.field_contract::text||
                e.command_contract::text||e.api_contract::text||e.persistence_contract::text||
                jsonb_build_object('schemaVersion',1,'contractType','STEP_HANDOFF','policy','{}'::jsonb,
                  'transitions',jsonb_build_array(jsonb_build_object('handoffType','TERMINAL','toState',s.to_state,
                    'contextKeys',jsonb_build_array('tenantId','projectId','processCode','stepCode','actorCode','rowVersion'))))::text||
                e.test_contract::text||e.guide_contract::text||e.nonfunctional_contract::text),
              updated_at=current_timestamp
            from framework_process_step s
            where e.process_code=s.process_code and e.step_code=s.step_code and e.process_code=?
              and coalesce(e.handoff_contract->'policy','{}'::jsonb)='{}'::jsonb
              and coalesce(e.handoff_contract->'transitions','[]'::jsonb)='[]'::jsonb
              and not exists(select 1 from framework_process_step n
                where n.process_code=s.process_code and n.step_order>s.step_order)
            """,process);
        Integer pages=jdbc.queryForObject("select count(*) from framework_page_design where process_code=?",Integer.class,process);
        return pages==null?0:pages;
    }

    /**
     * Materializes an editable design note, one selected HTML proposal, and the
     * canonical common-design binding for generated routes. Existing operator
     * notes and proposals are never overwritten. This satisfies design input
     * gates only; it deliberately does not claim frontend implementation.
     */
    private void ensureGeneratedScreenDevelopmentAssets(String process,String actor){
        List<Map<String,Object>> screens=jdbc.queryForList("""
            select s.step_code,s.step_name,s.actor_code,s.from_state,s.to_state,s.command_code,
                   coalesce(nullif(s.requirement_text,''),s.step_name) requirement_text,
                   coalesce(nullif(s.completion_rule,''),s.to_state||' state transition') completion_rule,
                   route.route_path
              from framework_process_step s
              cross join lateral unnest(array_remove(array[s.user_path,s.admin_path],null)) route(route_path)
             where s.process_code=? and nullif(trim(route.route_path),'') is not null
             order by s.step_order,route.route_path
            """,process);
        for(Map<String,Object> screen:screens){
            String route=ScreenDevelopmentNoteService.cleanRoute(String.valueOf(screen.get("route_path")));
            String routeKey=route.toLowerCase(Locale.ROOT);
            String step=String.valueOf(screen.get("step_code"));
            String title=String.valueOf(screen.get("step_name"));
            String pageId=jdbc.queryForObject("select 'AUTO_'||upper(substr(md5(lower(?)),1,16))",String.class,route);
            String design="KRDS responsive workspace for actor "+screen.get("actor_code")+
                "; state "+screen.get("from_state")+" -> "+screen.get("to_state")+
                "; sections: summary, input and validation, evidence, audit history, next task.";
            String function="Execute "+screen.get("command_code")+" for "+process+"/"+step+
                " with tenant, project, actor, row-version, validation, evidence, and idempotent retry contracts.";
            String acceptance=String.valueOf(screen.get("completion_rule"))+
                "; persist result, reread database state, record audit evidence, and enable only the valid next transition.";
            jdbc.update("""
                insert into framework_screen_development_note(route_key,route_path,page_id,page_title,design_note,
                  function_note,acceptance_note,development_status,updated_by)
                values(?,?,?,?,?,?,?,'READY',?) on conflict(route_key) do nothing
                """,routeKey,route,pageId,title,design,function,acceptance,actor);

            String prompt="Render the approved KRDS common workspace for "+process+"/"+step+
                ". Preserve actor authority, responsive layout, accessibility, validation, evidence, audit, and next-step contracts.";
            String html="<main class=\"krds-page generated-workspace\" data-process=\""+htmlEscape(process)+
                "\" data-step=\""+htmlEscape(step)+"\" data-actor=\""+htmlEscape(String.valueOf(screen.get("actor_code")))+
                "\"><header class=\"krds-page-header\"><p class=\"krds-breadcrumb\">"+htmlEscape(process)+
                "</p><h1>"+htmlEscape(title)+"</h1><p>"+htmlEscape(String.valueOf(screen.get("requirement_text")))+
                "</p></header><section class=\"krds-summary-metrics\" aria-label=\"Task status\" data-from-state=\""+
                htmlEscape(String.valueOf(screen.get("from_state")))+"\" data-to-state=\""+
                htmlEscape(String.valueOf(screen.get("to_state")))+"\"></section><section class=\"krds-work-grid\">"+
                "<div class=\"krds-card\" data-section=\"input-validation\"><h2>Input and validation</h2></div>"+
                "<div class=\"krds-card\" data-section=\"evidence-history\"><h2>Evidence and audit history</h2></div>"+
                "</section><footer class=\"krds-task-actions\" data-command=\""+
                htmlEscape(String.valueOf(screen.get("command_code")))+"\"><button type=\"button\">Save draft</button>"+
                "<button type=\"button\" class=\"krds-btn-primary\">Complete and continue</button></footer></main>";
            jdbc.update("""
                insert into framework_screen_html_mockup(route_key,route_path,page_id,slot_no,mockup_title,prompt_text,
                  html_content,mockup_status,selected,updated_by)
                values(?,?,?,1,?,?,?,'DRAFT',false,?) on conflict(route_key,slot_no) do nothing
                """,routeKey,route,pageId,title+" - KRDS workspace",prompt,html,actor);
            jdbc.update("""
                update framework_screen_html_mockup set selected=true,mockup_status='SELECTED',updated_by=?,updated_at=current_timestamp
                 where route_key=? and slot_no=1
                   and not exists(select 1 from framework_screen_html_mockup selected where selected.route_key=? and selected.selected=true)
                """,actor,routeKey,routeKey);
        }
        ensureCommonDesignAssets(process,"",actor);
    }

    private static String htmlEscape(String value){
        if(value==null)return "";
        return value.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
            .replace("\"","&quot;").replace("'","&#39;");
    }
    @Transactional public void saveArtifact(Map<String,Object>b){
        jdbc.update("insert into framework_process_artifact(process_code,step_code,artifact_code,artifact_type,artifact_name,target_path,contract_ref,required,delivery_status,owner_actor_code,acceptance_criteria,evidence_ref,notes) values(?,?,?,?,?,?,?,?,?,?,?,nullif(?,''),nullif(?,'')) on conflict(process_code,artifact_code) do update set step_code=excluded.step_code,artifact_type=excluded.artifact_type,artifact_name=excluded.artifact_name,target_path=excluded.target_path,contract_ref=excluded.contract_ref,required=excluded.required,delivery_status=excluded.delivery_status,owner_actor_code=excluded.owner_actor_code,acceptance_criteria=excluded.acceptance_criteria,evidence_ref=excluded.evidence_ref,notes=excluded.notes,updated_at=current_timestamp",req(b,"processCode"),str(b,"stepCode"),req(b,"artifactCode"),req(b,"artifactType"),req(b,"artifactName"),str(b,"targetPath"),str(b,"contractRef"),!"false".equalsIgnoreCase(str(b,"required")),def(b,"status","PLANNED"),req(b,"ownerActorCode"),req(b,"acceptanceCriteria"),str(b,"evidenceRef"),str(b,"notes"));
    }
    @Transactional public void recordRun(Map<String,Object>b,String actor){
        String caseCode=req(b,"caseCode"),result=req(b,"result");
        Map<String,Object> processRow=jdbc.queryForMap("select p.process_code,p.process_version from framework_process_definition p join framework_simulation_case c on c.process_code=p.process_code where c.case_code=?",caseCode);
        String process=String.valueOf(processRow.get("process_code")),version=String.valueOf(processRow.get("process_version"));
        jdbc.update("insert into framework_simulation_run(case_code,process_version,result,failure_reason,evidence_json,executed_by) values(?,?,?,?,?,?)",caseCode,version,result,str(b,"failureReason"),def(b,"evidenceJson","{}"),actor);
        jdbc.update("update framework_simulation_case set case_status=?,updated_at=current_timestamp where case_code=?","PASSED".equals(result)?"APPROVED":"REVIEW_REQUIRED",caseCode);
        if("PASSED".equals(result)) autoImplementCompletedDesign(process,actor);
    }

    /**
     * Queues implementation only after the complete actor/process design has
     * passed structural validation and every mandatory safety scenario has
     * been approved. Repeated calls reuse the design fingerprint and therefore
     * never duplicate implementation jobs.
     */
    private Map<String,Object> autoImplementCompletedDesign(String process,String actor){
        if(process==null||process.isBlank())return Map.of("status","PROCESS_BINDING_REQUIRED");
        Map<String,Object> design=jdbc.queryForMap("select count(*) as step_count,"+
            "count(*) filter(where trim(coalesce(step_code,''))='' or trim(coalesce(step_name,''))='' or trim(coalesce(actor_code,''))='' or trim(coalesce(from_state,''))='' or trim(coalesce(command_code,''))='' or trim(coalesce(to_state,''))='' or trim(coalesce(completion_rule,''))='' or trim(coalesce(requirement_text,''))='') as incomplete_step_count,"+
            "count(*) filter(where requires_user_page and (trim(coalesce(user_path,''))='' or not exists(select 1 from framework_professional_screen_contract c where c.process_code=framework_process_step.process_code and c.step_code=framework_process_step.step_code and c.audience='USER' and lower(split_part(c.route_path,'?',1))=lower(split_part(framework_process_step.user_path,'?',1))))) as missing_user_contract_count,"+
            "count(*) filter(where requires_admin_page and (trim(coalesce(admin_path,''))='' or not exists(select 1 from framework_professional_screen_contract c where c.process_code=framework_process_step.process_code and c.step_code=framework_process_step.step_code and c.audience='ADMIN' and lower(split_part(c.route_path,'?',1))=lower(split_part(framework_process_step.admin_path,'?',1))))) as missing_admin_contract_count "+
            "from framework_process_step where process_code=?",process);
        int stepCount=((Number)design.get("step_count")).intValue();
        int incompleteSteps=((Number)design.get("incomplete_step_count")).intValue();
        int missingUserContracts=((Number)design.get("missing_user_contract_count")).intValue();
        int missingAdminContracts=((Number)design.get("missing_admin_contract_count")).intValue();
        Integer pendingCases=jdbc.queryForObject("select count(*) from framework_simulation_case where process_code=? and case_status<>'APPROVED'",Integer.class,process);
        Integer safetyTypes=jdbc.queryForObject("select count(distinct case_type) from framework_simulation_case where process_code=? and case_status='APPROVED' and case_type in ('HAPPY_PATH','AUTHORITY','ISOLATION','EXCEPTION','RECOVERY')",Integer.class,process);
        if(stepCount==0||incompleteSteps>0||missingUserContracts>0||missingAdminContracts>0||(pendingCases!=null&&pendingCases>0)||safetyTypes==null||safetyTypes<5){
            Map<String,Object> result=new LinkedHashMap<>();result.put("status","DESIGN_INCOMPLETE");result.put("processCode",process);result.put("stepCount",stepCount);result.put("incompleteStepCount",incompleteSteps);result.put("missingUserContractCount",missingUserContracts);result.put("missingAdminContractCount",missingAdminContracts);result.put("pendingCaseCount",pendingCases==null?0:pendingCases);result.put("approvedSafetyTypes",safetyTypes==null?0:safetyTypes);return result;
        }
        jdbc.update("update framework_process_definition set automation_mode='AUTOMATIC',process_status=case when process_status='DEVELOPMENT_READY' then process_status else 'IN_DEVELOPMENT' end,updated_at=current_timestamp where process_code=?",process);
        Map<String,Object> delivery=executeDesignDirectDevelopment(Map.of("processCode",process,"force",false),actor);
        Map<String,Object> result=new LinkedHashMap<>();result.put("status","IMPLEMENTATION_QUEUED");result.put("processCode",process);result.put("delivery",delivery);return result;
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
        String steps=jdbc.queryForObject("""
            select coalesce(json_agg(json_build_object(
              'order',step_order,'stepCode',step_code,'command',command_code,
              'actorCode',actor_code,'fromState',from_state,'toState',to_state
            ) order by step_order),'[]'::json)::text
            from framework_process_step where process_code=?
            """,String.class,process);
        Map<String,String> assertions=Map.of(
            "HAPPY_PATH","[\"all ordered transitions are reachable\",\"every command has an actor\",\"terminal completion state exists\"]",
            "AUTHORITY","[\"every step actor exists\",\"unauthorized commands are denied\",\"denials are audit logged\"]",
            "ISOLATION","[\"tenant context is required\",\"project context is required\",\"cross-context access is denied\"]",
            "EXCEPTION","[\"required input contracts exist\",\"validation failure preserves prior state\",\"correction path retains evidence\"]",
            "RECOVERY","[\"every step has rollback semantics\",\"commands are idempotent\",\"retry preserves audit history\"]");
        String preconditions="A tenant, project, assigned actor, current process version, and isolated test data are available for deterministic contract validation.";
        for(String[] c:cases){
            String code=process+"_"+c[0];
            jdbc.update("""
                insert into framework_simulation_case(
                  case_code,process_code,case_name,case_type,preconditions,
                  steps_json,assertions_json,case_status,severity,
                  required_evidence,automated,expected_duration_minutes)
                values(?,?,?,?,?,?,?,'READY','CRITICAL',
                  'PROCESS_GRAPH,ACTOR_POLICY,STATE_CONTRACT,DATA_CONTRACT,AUDIT_LOG',true,5)
                on conflict(case_code) do update set
                  case_name=excluded.case_name,case_type=excluded.case_type,
                  preconditions=excluded.preconditions,steps_json=excluded.steps_json,
                  assertions_json=excluded.assertions_json,
                  case_status=case when framework_simulation_case.case_status='APPROVED'
                    then framework_simulation_case.case_status else 'READY' end,
                  severity=excluded.severity,required_evidence=excluded.required_evidence,
                  automated=true,expected_duration_minutes=excluded.expected_duration_minutes,
                  updated_at=current_timestamp
                """,code,process,c[1],c[2],preconditions,steps,assertions.get(c[2]));
        }
    }
    private static String str(Map<String,Object>b,String k){return b.get(k)==null?"":String.valueOf(b.get(k)).trim();}
    private static String req(Map<String,Object>b,String k){String v=str(b,k);if(v.isEmpty())throw new IllegalArgumentException(k+" is required");return v;}
    private static String def(Map<String,Object>b,String k,String d){String v=str(b,k);return v.isEmpty()?d:v;}
    private static String valueOr(Map<String,Object>b,String k,String d){Object raw=b.get(k);if(raw==null)return d;String v=String.valueOf(raw).trim();return v.isEmpty()||"null".equalsIgnoreCase(v)?d:v;}
    private static boolean bool(Map<String,Object>b,String k){return Boolean.parseBoolean(str(b,k));}
    private static int integer(Map<String,Object>b,String k){try{return Integer.parseInt(req(b,k));}catch(Exception e){throw new IllegalArgumentException(k+" must be a number");}}
    private static int integerOr(Map<String,Object>b,String k,int d){String v=str(b,k);if(v.isEmpty())return d;try{return Integer.parseInt(v);}catch(Exception e){throw new IllegalArgumentException(k+" must be a number");}}
    private static String auditTargetPart(Object value){return value==null?"#":String.valueOf(value);}
    private static String normalizePermissionCodes(String value){
        try{
            com.fasterxml.jackson.databind.JsonNode parsed=
                new com.fasterxml.jackson.databind.ObjectMapper().readTree(value);
            if(!parsed.isArray())throw new IllegalArgumentException(
                "permissionCodes must be a JSON array");
            java.util.SortedSet<String> codes=new java.util.TreeSet<>();
            for(com.fasterxml.jackson.databind.JsonNode item:parsed){
                if(!item.isTextual())throw new IllegalArgumentException(
                    "permissionCodes must contain strings only");
                String code=item.textValue();
                if(!code.matches("[A-Z][A-Z0-9_:-]{1,119}"))
                    throw new IllegalArgumentException("invalid permissionCode: "+code);
                if(!codes.add(code))throw new IllegalArgumentException(
                    "duplicate permissionCode: "+code);
            }
            return toJson(codes);
        }catch(com.fasterxml.jackson.core.JsonProcessingException e){
            throw new IllegalArgumentException("permissionCodes must be valid JSON",e);
        }
    }
    private static void validateJsonObject(String value,String field){try{if(!new com.fasterxml.jackson.databind.ObjectMapper().readTree(value).isObject())throw new IllegalArgumentException(field+" must be a JSON object");}catch(com.fasterxml.jackson.core.JsonProcessingException e){throw new IllegalArgumentException(field+" must be valid JSON",e);}}
    private static void validateJsonArray(String value,String field){try{if(!new com.fasterxml.jackson.databind.ObjectMapper().readTree(value).isArray())throw new IllegalArgumentException(field+" must be a JSON array");}catch(com.fasterxml.jackson.core.JsonProcessingException e){throw new IllegalArgumentException(field+" must be valid JSON",e);}}
    private static String toJson(Object value){try{return new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(value==null?Map.of():value);}catch(Exception e){throw new IllegalArgumentException("configuration must be JSON serializable",e);}}
    @SuppressWarnings("unchecked") private static Map<String,Object> jsonMap(String value){try{return new com.fasterxml.jackson.databind.ObjectMapper().readValue(value,LinkedHashMap.class);}catch(Exception e){throw new IllegalArgumentException("database returned invalid JSON",e);}}
    private static String jsonEscape(String value){return value==null?"":value.replace("\\","\\\\").replace("\"","\\\"").replace("\r","\\r").replace("\n","\\n");}
}
