package egovframework.com.platform.governance.service;

import egovframework.com.platform.codex.model.CodexProvisionResponse;
import egovframework.com.platform.codex.service.CodexProvisioningService;
import egovframework.com.platform.request.codex.CodexProvisionRequest;
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
    private final CodexProvisioningService codexProvisioningService;

    public Map<String,Object> dashboard() {
        Map<String,Object> out=new LinkedHashMap<>();
        out.put("actors",jdbc.queryForList("select actor_code as \"actorCode\",actor_name as \"actorName\",actor_name_en as \"actorNameEn\",actor_type as \"actorType\",purpose,capability_codes as \"capabilityCodes\",responsibility_text as responsibility,accountability_text as accountability,competency_requirements as competency,conflict_actor_codes as \"conflictActorCodes\",max_concurrent_assignments as \"maxConcurrentAssignments\",review_cycle_days as \"reviewCycleDays\",delegation_allowed as \"delegationAllowed\",use_at as \"useAt\" from framework_actor_definition order by actor_type,actor_code"));
        out.put("workTypes",jdbc.queryForList("select w.work_type_code as \"workTypeCode\",w.work_type_name as \"workTypeName\",w.work_type_name_en as \"workTypeNameEn\",w.description,w.sort_order as \"sortOrder\",w.use_at as \"useAt\",count(p.process_code) as \"processCount\",count(p.process_code) filter(where p.process_status='DEVELOPMENT_READY') as \"readyCount\",count(p.process_code) filter(where p.process_status='IN_DEVELOPMENT') as \"inDevelopmentCount\",count(p.process_code) filter(where p.process_status='DRAFT') as \"draftCount\" from framework_business_work_type w left join framework_process_definition p on upper(p.domain_code)=w.work_type_code group by w.work_type_code,w.work_type_name,w.work_type_name_en,w.description,w.sort_order,w.use_at order by w.sort_order,w.work_type_code"));
        out.put("assignments",jdbc.queryForList("select assignment_id as \"assignmentId\",account_id as \"accountId\",tenant_id as \"tenantId\",project_id as \"projectId\",actor_code as \"actorCode\",data_scope as \"dataScope\",valid_from as \"validFrom\",valid_until as \"validUntil\",assignment_status as \"status\" from framework_account_actor_assignment order by assignment_id desc limit 200"));
        out.put("actorAccountReadiness",jdbc.queryForList("select assignment.account_id as \"accountId\",assignment.actor_code as \"actorCode\",assignment.tenant_id as \"tenantId\",assignment.project_id as \"projectId\",case when employee.emplyr_id is not null then 'EMPLOYEE' when member.entrprs_mber_id is not null then 'ENTERPRISE' else 'MISSING' end as \"accountType\",coalesce(security.author_code,'') as \"authorityCode\",case when assignment.project_id='*' then 'GLOBAL' when project_assignment.assignment_id is not null then 'READY' else 'DRIFT' end as \"workflowBinding\",case when coalesce(employee.emplyr_sttus_code,member.entrprs_mber_sttus,'') in ('P','A') and security.author_code is not null and (assignment.project_id='*' or project_assignment.assignment_id is not null) then 'READY' else 'CHECK_REQUIRED' end as \"readiness\" from framework_account_actor_assignment assignment left join comtnemplyrinfo employee on lower(employee.emplyr_id)=lower(assignment.account_id) left join comtnentrprsmber member on lower(member.entrprs_mber_id)=lower(assignment.account_id) left join comtnemplyrscrtyestbs security on security.scrty_dtrmn_trget_id=coalesce(employee.esntl_id,member.esntl_id) left join framework_project_actor_assignment project_assignment on project_assignment.project_id=assignment.project_id and project_assignment.actor_code=assignment.actor_code and lower(project_assignment.user_id)=lower(assignment.account_id) and project_assignment.active_yn='Y' where assignment.assignment_status='ACTIVE' order by case when assignment.project_id='*' then 1 else 0 end,assignment.project_id,assignment.actor_code,assignment.account_id limit 300"));
        out.put("processes",jdbc.queryForList("select p.process_code as \"processCode\",p.process_name as \"processName\",p.domain_code as \"domainCode\",p.process_version as \"version\",p.parent_process_code as \"parentProcessCode\",p.process_level as \"processLevel\",p.automation_mode as \"automationMode\",p.development_order as \"developmentOrder\",p.prerequisite_codes as \"prerequisiteCodes\",p.goal,p.start_condition as \"startCondition\",p.completion_condition as \"completionCondition\",p.process_status as \"status\",count(distinct s.step_id) as \"stepCount\",count(distinct c.case_code) as \"caseCount\",count(distinct c.case_code) filter(where c.case_status='APPROVED') as \"approvedCaseCount\",count(distinct r.run_id) filter(where r.result='PASSED') as \"passedRuns\",(select count(*) from framework_process_artifact a where a.process_code=p.process_code and a.required) as \"artifactCount\",(select count(*) from framework_process_artifact a where a.process_code=p.process_code and a.required and a.delivery_status='VERIFIED') as \"verifiedArtifactCount\" from framework_process_definition p left join framework_process_step s on s.process_code=p.process_code left join framework_simulation_case c on c.process_code=p.process_code left join framework_simulation_run r on r.case_code=c.case_code group by p.process_code order by p.development_order,p.process_code"));
        out.put("steps",jdbc.queryForList("select step_id as \"stepId\",process_code as \"processCode\",step_order as \"stepOrder\",step_code as \"stepCode\",step_name as \"stepName\",parent_step_code as \"parentStepCode\",step_type as \"stepType\",actor_code as \"actorCode\",from_state as \"fromState\",command_code as \"commandCode\",to_state as \"toState\",completion_rule as \"completionRule\",requirement_text as \"requirementText\",input_contract as \"inputContract\",output_contract as \"outputContract\",requires_user_page as \"requiresUserPage\",requires_admin_page as \"requiresAdminPage\",requires_api as \"requiresApi\",requires_database as \"requiresDatabase\",requires_notification as \"requiresNotification\",automation_status as \"automationStatus\",user_path as \"userPath\",admin_path as \"adminPath\",api_contract as \"apiContract\" from framework_process_step order by process_code,step_order"));
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
        out.put("screenDevelopmentGates",jdbc.queryForList("select gate_run_id as \"gateRunId\",process_code as \"processCode\",step_code as \"stepCode\",route_path as \"routePath\",page_id as \"pageId\",gate_status as \"gateStatus\",readiness_score as \"readinessScore\",design_note_passed as \"designNotePassed\",selected_mockup_passed as \"selectedMockupPassed\",actor_contract_passed as \"actorContractPassed\",safety_tests_passed as \"safetyTestsPassed\",design_asset_checked as \"designAssetChecked\",failure_summary as \"failureSummary\",executed_by as \"executedBy\",executed_at as \"executedAt\" from framework_screen_development_gate_run order by gate_run_id desc limit 300"));
        out.put("commonFeaturePackages",jdbc.queryForList("select feature_code as \"featureCode\",feature_name as \"featureName\",feature_version as \"featureVersion\",feature_category as \"featureCategory\",description,api_contract as \"apiContract\",data_contract as \"dataContract\",ui_contract as \"uiContract\",event_contract as \"eventContract\",permission_contract as \"permissionContract\",test_contract as \"testContract\",install_strategy as \"installStrategy\" from framework_common_feature_package where active_yn='Y' order by feature_category,feature_code"));
        out.put("screenFeatureBindings",jdbc.queryForList("select process_code as \"processCode\",step_code as \"stepCode\",audience,route_path as \"routePath\",feature_code as \"featureCode\",binding_options as \"bindingOptions\",required_yn as \"requiredYn\" from framework_screen_feature_binding order by process_code,step_code,audience,route_path,feature_code"));
        out.put("featureInstallations",jdbc.queryForList("select project_scope as \"projectScope\",feature_code as \"featureCode\",installed_version as \"installedVersion\",installation_status as \"installationStatus\",configuration,evidence_ref as \"evidenceRef\",installed_by as \"installedBy\",installed_at as \"installedAt\" from framework_feature_installation order by project_scope,feature_code"));
        out.put("designValidationRuns",jdbc.queryForList("select validation_run_id as \"validationRunId\",process_code as \"processCode\",validation_status as \"validationStatus\",blocker_count as \"blockerCount\",warning_count as \"warningCount\",result_json as \"resultJson\",source_fingerprint as \"sourceFingerprint\",executed_by as \"executedBy\",executed_at as \"executedAt\" from framework_process_design_validation_run order by validation_run_id desc limit 100"));
        out.put("designAssurance",jdbc.queryForList("select process_code as \"processCode\",process_name as \"processName\",domain_code as \"domainCode\",assurance_status as \"assuranceStatus\",design_accuracy_score as \"designAccuracyScore\",design_blocker_count as \"designBlockerCount\",step_count as \"stepCount\",missing_actor_binding_count+unknown_actor_count as \"actorContractGaps\",incomplete_transition_count+unreachable_next_state_count as \"stateFlowGaps\",incomplete_business_rule_count as \"businessRuleGaps\",incomplete_data_contract_count as \"dataContractGaps\",missing_user_route_count+missing_admin_route_count as \"routeGaps\",missing_user_screen_contract_count+missing_admin_screen_contract_count as \"screenContractGaps\",missing_api_contract_count as \"apiContractGaps\",safety_test_type_count as \"safetyTestTypeCount\",approved_safety_test_type_count as \"approvedSafetyTestTypeCount\",required_job_count as \"requiredJobCount\",verified_job_count as \"verifiedJobCount\",blocked_job_count as \"blockedJobCount\",next_action as \"nextAction\" from framework_process_design_assurance_matrix order by design_blocker_count desc,design_accuracy_score,process_code"));
        out.put("designAssuranceSummary",jdbc.queryForMap("select count(*) as \"processCount\",count(*) filter(where assurance_status='IMPLEMENTATION_VERIFIED') as \"verifiedCount\",count(*) filter(where assurance_status='DESIGN_BLOCKED') as \"blockedCount\",count(*) filter(where assurance_status in ('IMPLEMENTATION_PENDING','REVIEW_REQUIRED')) as \"pendingCount\",coalesce(round(avg(design_accuracy_score),1),0) as \"averageAccuracyScore\" from framework_process_design_assurance_matrix"));
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
        out.put("professionalScreenContracts",jdbc.queryForList("select contract_id as \"contractId\",process_code as \"processCode\",step_code as \"stepCode\",audience,route_path as \"routePath\",screen_name as \"screenName\",actor_code as \"actorCode\",business_purpose as \"businessPurpose\",entry_condition as \"entryCondition\",exit_condition as \"exitCondition\",kpi_contract as \"kpiContract\",section_contract as \"sectionContract\",field_contract as \"fieldContract\",command_contract as \"commandContract\",state_contract as \"stateContract\",api_contract as \"apiContract\",data_contract as \"dataContract\",evidence_contract as \"evidenceContract\",api_verified as \"apiVerified\",database_verified as \"databaseVerified\",authority_verified as \"authorityVerified\",responsive_verified as \"responsiveVerified\",accessibility_verified as \"accessibilityVerified\",exception_states_verified as \"exceptionStatesVerified\",audit_evidence_ref as \"auditEvidenceRef\",contract_status as \"contractStatus\",readiness_score as \"readinessScore\",readiness_gaps as \"readinessGaps\" from framework_professional_screen_readiness order by process_code,step_code,audience"));
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
        out.put("backendProcessReadiness",jdbc.queryForList("select process_code as \"processCode\",process_name as \"processName\",domain_code as \"domainCode\",owner_actor_code as \"ownerActorCode\",step_count as \"stepCount\",contracted_steps as \"contractedSteps\",passed_backend_tests as \"passedBackendTests\",backend_test_count as \"backendTestCount\",backend_readiness_score as \"backendReadinessScore\",backend_gaps as \"backendGaps\" from framework_backend_process_readiness order by backend_readiness_score,process_code"));
        out.put("backendProcessSummary",jdbc.queryForMap("select count(*) as \"processCount\",count(*) filter(where backend_readiness_score=100) as \"completeCount\",count(*) filter(where backend_readiness_score<100) as \"incompleteCount\",coalesce(round(avg(backend_readiness_score),1),0) as \"averageScore\" from framework_backend_process_readiness"));
        out.put("deliveryQueue",jdbc.queryForList("select process_code as \"processCode\",process_name as \"processName\",domain_code as \"domainCode\",development_order as \"developmentOrder\",process_status as \"processStatus\",step_count as \"stepCount\",actor_bound_steps as \"actorBoundSteps\",test_count as \"testCount\",test_type_count as \"testTypeCount\",passed_tests as \"passedTests\",required_tasks as \"requiredTasks\",completed_tasks as \"completedTasks\",blocked_tasks as \"blockedTasks\",required_artifacts as \"requiredArtifacts\",verified_artifacts as \"verifiedArtifacts\",screen_contracts as \"screenContracts\",ready_screens as \"readyScreens\",completion_score as \"completionScore\",next_action as \"nextAction\",delivery_priority as priority from framework_process_delivery_priority_queue order by case delivery_priority when 'BLOCKER' then 0 when 'HIGH' then 1 when 'MEDIUM' then 2 when 'LOW' then 3 else 4 end,development_order,process_code"));
        out.put("deliverySummary",jdbc.queryForMap("select count(*) as \"totalProcesses\",count(*) filter(where next_action='COMPLETE') as \"completeProcesses\",count(*) filter(where delivery_priority='BLOCKER') as blockers,count(*) filter(where delivery_priority='HIGH') as \"highPriority\",coalesce(round(avg(completion_score),1),0) as \"averageScore\" from framework_process_delivery_priority_queue"));
        out.put("summary",jdbc.queryForMap("select count(*) as \"processCount\",count(*) filter(where process_status='DEVELOPMENT_READY') as \"readyCount\",count(*) filter(where process_status<>'DEVELOPMENT_READY') as \"draftCount\",coalesce(round(100.0*count(*) filter(where process_status='DEVELOPMENT_READY')/nullif(count(*),0)),0) as \"readinessPercent\" from framework_process_definition"));
        return out;
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
     * Saves a route design and recompiles every bound process in one
     * transaction. Renderable blueprint contracts are returned immediately so
     * metadata-driven pages do not require a frontend rebuild.
     */
    @Transactional public Map<String,Object> saveDesignAndGenerate(Map<String,Object> body,String actor){
        Map<String,Object> note=screenDevelopmentNoteService.save(body,actor);
        String route=ScreenDevelopmentNoteService.cleanRoute(req(body,"routePath"));
        List<String> processes=jdbc.queryForList(
            "select distinct process_code from ("+
            "select process_code from framework_professional_screen_contract where lower(split_part(route_path,'?',1))=lower(?) "+
            "union all select process_code from framework_screen_blueprint where lower(split_part(route_path,'?',1))=lower(?)"+
            ") p where process_code is not null and trim(process_code)<>'' order by process_code",
            String.class,route,route);
        List<Map<String,Object>> deliveries=new java.util.ArrayList<>();
        for(String process:processes){
            deliveries.add(autoImplementCompletedDesign(process,actor));
        }
        List<Map<String,Object>> outputs=jdbc.queryForList(
            "select blueprint_id as \"blueprintId\",blueprint_code as \"blueprintCode\",process_code as \"processCode\",step_code as \"stepCode\",audience,page_id as \"pageId\",route_path as \"routePath\",screen_type as \"screenType\",template_code as \"templateCode\",specification_json as \"specificationJson\",traceability_json as \"traceabilityJson\",validation_status as \"validationStatus\",validation_message as \"validationMessage\" from framework_screen_blueprint where lower(split_part(route_path,'?',1))=lower(?) order by audience,blueprint_id",
            route);
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("success",true);result.put("note",note);result.put("routePath",route);
        result.put("processCodes",processes);result.put("deliveries",deliveries);result.put("codeOutputs",outputs);
        result.put("generationStatus",processes.isEmpty()?"PROCESS_BINDING_REQUIRED":deliveries.stream().anyMatch(row->"DESIGN_INCOMPLETE".equals(row.get("status")))?"DESIGN_INCOMPLETE":"GENERATED");
        result.put("buildRequired",false);
        return result;
    }

    @Transactional public Map<String,Object> saveProfessionalScreenContract(Map<String,Object>b,String actor){
        long id=Long.parseLong(req(b,"contractId"));
        int updated=jdbc.update("update framework_professional_screen_contract set business_purpose=?,entry_condition=?,exit_condition=?,kpi_contract=?,section_contract=?,field_contract=?,command_contract=?,state_contract=?,api_contract=?,data_contract=?,evidence_contract=?,responsive_contract=?,accessibility_contract=?,security_contract=?,api_verified=?,database_verified=?,authority_verified=?,responsive_verified=?,accessibility_verified=?,exception_states_verified=?,audit_evidence_ref=?,contract_status=?,updated_by=?,updated_at=current_timestamp where contract_id=?",
            req(b,"businessPurpose"),req(b,"entryCondition"),req(b,"exitCondition"),def(b,"kpiContract","[]"),def(b,"sectionContract","[]"),def(b,"fieldContract","[]"),def(b,"commandContract","[]"),def(b,"stateContract","[\"LOADING\",\"EMPTY\",\"ERROR\",\"FORBIDDEN\",\"READY\"]"),def(b,"apiContract","[]"),def(b,"dataContract","[]"),def(b,"evidenceContract","[]"),def(b,"responsiveContract","360px, 768px, 1280px 검증"),def(b,"accessibilityContract","KRDS 및 WCAG 2.1 AA"),def(b,"securityContract","테넌트·프로젝트·액터 권한 서버 검증"),bool(b,"apiVerified"),bool(b,"databaseVerified"),bool(b,"authorityVerified"),bool(b,"responsiveVerified"),bool(b,"accessibilityVerified"),bool(b,"exceptionStatesVerified"),str(b,"auditEvidenceRef"),def(b,"contractStatus","REVIEW_REQUIRED"),actor,id);
        if(updated==0)throw new IllegalArgumentException("화면 완성 계약을 찾을 수 없습니다: "+id);
        Map<String,Object> readiness=jdbc.queryForMap("select contract_id as \"contractId\",readiness_score as \"readinessScore\",readiness_gaps as \"readinessGaps\" from framework_professional_screen_readiness where contract_id=?",id);
        if(((Number)readiness.get("readinessScore")).intValue()==100){jdbc.update("update framework_professional_screen_contract set contract_status='VERIFIED',updated_at=current_timestamp where contract_id=?",id);}
        String process=jdbc.queryForObject("select process_code from framework_professional_screen_contract where contract_id=?",String.class,id);
        Map<String,Object> automation=autoImplementCompletedDesign(process,actor);
        return Map.of("success",true,"contract",readiness,"autoImplementation",automation);
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
        jdbc.update("insert into framework_professional_screen_contract(process_code,step_code,audience,route_path,screen_name,actor_code,business_purpose,entry_condition,exit_condition,kpi_contract,section_contract,field_contract,command_contract,api_contract,data_contract,evidence_contract,updated_by) select s.process_code,s.step_code,x.audience,x.route_path,s.step_name||case x.audience when 'ADMIN' then ' 관리자 업무 화면' else ' 사용자 업무 화면' end,s.actor_code,coalesce(nullif(s.requirement_text,''),s.step_name||' 업무를 완료한다.'),s.from_state||' 상태이며 해당 액터가 프로젝트에 배정되어 있다.',coalesce(nullif(s.completion_rule,''),s.to_state||' 상태로 전이된다.'),'[\"진행률\",\"마감·지연\",\"차단 오류\",\"담당자\"]','[\"업무 문맥·진행 상태\",\"검색·필터\",\"핵심 데이터 작업공간\",\"증적·이력\",\"다음 업무\"]','[\"업무 식별자\",\"상태\",\"담당자\",\"버전\",\"변경 일시\"]',json_build_array(s.command_code,'임시저장','증적첨부','다음 업무 이동')::text,coalesce(nullif(s.api_contract,''),'[\"업무 조회\",\"검증\",\"저장·명령\",\"이력 조회\"]'),'[\"tenantId\",\"projectId\",\"processCode\",\"stepCode\",\"actorCode\",\"version\",\"audit fields\"]','[\"요청·응답 증적\",\"상태 전이\",\"권한 판정\",\"감사 이벤트\",\"화면 E2E\"]',? from framework_process_step s cross join lateral(values('USER',nullif(s.user_path,'')),('ADMIN',nullif(s.admin_path,''))) x(audience,route_path) where s.process_code=? and x.route_path is not null on conflict(process_code,step_code,audience,route_path) do update set actor_code=excluded.actor_code,business_purpose=excluded.business_purpose,entry_condition=excluded.entry_condition,exit_condition=excluded.exit_condition,updated_by=excluded.updated_by,updated_at=current_timestamp",user,process);
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
        if(mappingCount==null||mappingCount==0) jdbc.update("insert into ui_page_component_map(map_id,page_id,layout_zone,component_id,instance_key,display_order,conditional_rule_summary,created_at,updated_at) values(?,?,?,?,?,coalesce((select max(display_order)+1 from ui_page_component_map where page_id=?),1),?,current_timestamp,current_timestamp)","MAP_"+pageId.replaceAll("[^A-Za-z0-9]","")+"_"+componentId,pageId,sectionId,componentId,pageId+"_"+componentId,pageId,"design-preflight");
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

    @Transactional public void createActor(Map<String,Object>b){
        jdbc.update("insert into framework_actor_definition(actor_code,actor_name,actor_name_en,actor_type,purpose,capability_codes,delegation_allowed) values(?,?,?,?,?,?,?) on conflict(actor_code) do update set actor_name=excluded.actor_name,actor_name_en=excluded.actor_name_en,actor_type=excluded.actor_type,purpose=excluded.purpose,capability_codes=excluded.capability_codes,delegation_allowed=excluded.delegation_allowed,updated_at=current_timestamp",req(b,"actorCode"),req(b,"actorName"),str(b,"actorNameEn"),def(b,"actorType","BUSINESS"),req(b,"purpose"),str(b,"capabilityCodes"),bool(b,"delegationAllowed"));
    }
    @Transactional public void saveWorkType(Map<String,Object>b){
        String code=req(b,"workTypeCode").trim().toUpperCase(Locale.ROOT);
        if(!code.matches("^[A-Z][A-Z0-9_]{1,59}$"))throw new IllegalArgumentException("workTypeCode must use uppercase letters, numbers, and underscores");
        jdbc.update("insert into framework_business_work_type(work_type_code,work_type_name,work_type_name_en,description,sort_order,use_at) values(?,?,?,?,?,?) on conflict(work_type_code) do update set work_type_name=excluded.work_type_name,work_type_name_en=excluded.work_type_name_en,description=excluded.description,sort_order=excluded.sort_order,use_at=excluded.use_at,updated_at=current_timestamp",code,req(b,"workTypeName"),str(b,"workTypeNameEn"),str(b,"description"),integerOr(b,"sortOrder",100),def(b,"useAt","Y"));
    }
    @Transactional public void assignActor(Map<String,Object>b){
        String accountId=req(b,"accountId"), tenantId=def(b,"tenantId","DEFAULT"), projectId=def(b,"projectId","*"), actorCode=req(b,"actorCode");
        jdbc.update("insert into framework_account_actor_assignment(account_id,tenant_id,project_id,actor_code,data_scope,valid_until) values(?,?,?,?,?,nullif(?,'')::date) on conflict(account_id,tenant_id,project_id,actor_code) do update set data_scope=excluded.data_scope,valid_until=excluded.valid_until,assignment_status='ACTIVE'",accountId,tenantId,projectId,actorCode,def(b,"dataScope","*"),str(b,"validUntil"));
        if(!"*".equals(projectId)){
            Integer projectCount=jdbc.queryForObject("select count(*) from emission_project_registry where project_id=? and tenant_id=?",Integer.class,projectId,tenantId);
            if(projectCount==null||projectCount==0)throw new IllegalArgumentException("PROJECT_TENANT_SCOPE_NOT_FOUND");
            jdbc.update("insert into framework_project_actor_assignment(project_id,actor_code,user_id,active_yn) values(?,?,?,'Y') on conflict(project_id,actor_code,user_id) do update set active_yn='Y',assigned_at=current_timestamp",projectId,actorCode,accountId);
            jdbc.update("update emission_project_task set assignee_id=?,updated_at=current_timestamp where project_id=? and actor_code=?",accountId,projectId,actorCode);
            jdbc.update("insert into emission_project_history(project_id,event_type,event_description,actor_name) values (?,'ACTOR_ASSIGNED',?||' 역할의 주 담당자가 '||?||'(으)로 배정되었습니다.',?)",projectId,actorCode,accountId,accountId);
        }
    }
    @Transactional public void createProcess(Map<String,Object>b){
        String domainCode=req(b,"domainCode").trim().toUpperCase(Locale.ROOT);
        Integer enabled=jdbc.queryForObject("select count(*) from framework_business_work_type where work_type_code=? and use_at='Y'",Integer.class,domainCode);
        if(enabled==null||enabled==0)throw new IllegalArgumentException("ACTIVE_WORK_TYPE_NOT_FOUND: "+domainCode);
        jdbc.update("insert into framework_process_definition(process_code,process_name,domain_code,process_version,goal,start_condition,completion_condition,parent_process_code,process_level,automation_mode) values(?,?,?,?,?,?,?,nullif(?,''),?,?) on conflict(process_code) do update set process_name=excluded.process_name,domain_code=excluded.domain_code,process_version=excluded.process_version,goal=excluded.goal,start_condition=excluded.start_condition,completion_condition=excluded.completion_condition,parent_process_code=excluded.parent_process_code,process_level=excluded.process_level,automation_mode=excluded.automation_mode,updated_at=current_timestamp",req(b,"processCode"),req(b,"processName"),domainCode,def(b,"version","1.0.0"),req(b,"goal"),req(b,"startCondition"),req(b,"completionCondition"),str(b,"parentProcessCode"),integerOr(b,"processLevel",str(b,"parentProcessCode").isEmpty()?1:2),def(b,"automationMode","ASSISTED"));
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
        List<Map<String,Object>> steps=jdbc.queryForList("select step_code,actor_code,from_state from framework_process_step where process_code=? order by step_order limit 1",process);
        if(steps.isEmpty())throw new IllegalArgumentException("프로세스 단계가 없습니다: "+process);
        Map<String,Object> first=steps.get(0);String requiredActor=String.valueOf(first.get("actor_code"));
        if(!requiredActor.equals(actor))throw new IllegalArgumentException("첫 단계 수행 액터는 "+requiredActor+"입니다.");
        requireActorAssignment(tenant,project,actor,user);
        List<Map<String,Object>> running=jdbc.queryForList("select execution_id as \"executionId\",current_step_code as \"currentStepCode\",current_state as \"currentState\" from framework_process_execution where tenant_id=? and project_id=? and process_code=? and execution_status='RUNNING'",tenant,project,process);
        if(!running.isEmpty())return Map.of("success",true,"created",false,"execution",running.get(0));
        UUID id=UUID.randomUUID();String step=String.valueOf(first.get("step_code")),state=String.valueOf(first.get("from_state"));
        jdbc.update("insert into framework_process_execution(execution_id,tenant_id,project_id,process_code,current_step_code,current_state,initiated_by_actor,initiated_by) values(?,?,?,?,?,?,?,?)",id,tenant,project,process,step,state,actor,user);
        return Map.of("success",true,"created",true,"executionId",id,"processCode",process,"currentStepCode",step,"currentState",state,"actorCode",actor);
    }

    @Transactional public Map<String,Object> verifyBackendProcessContracts(String sourceCommit,String user){
        List<Map<String,Object>> rows=jdbc.queryForList("select process_code as \"processCode\",case_type as \"caseType\",test_status as \"testStatus\",evidence_hash as \"evidenceHash\" from run_framework_backend_contract_tests(?)",sourceCommit==null?"":sourceCommit);
        long passed=rows.stream().filter(row->"PASSED".equals(String.valueOf(row.get("testStatus")))).count();
        jdbc.update("insert into framework_backend_verification_audit(source_commit,passed_count,total_count,verification_status,executed_by) values(?,?,?,?,?)",sourceCommit==null?"":sourceCommit,passed,rows.size(),passed==rows.size()?"VERIFIED":"FAILED",user);
        return Map.of("success",passed==rows.size(),"passed",passed,"total",rows.size(),"results",rows);
    }

    @Transactional public Map<String,Object> executeProcessCommand(UUID executionId,Map<String,Object>b,String user){
        String tenant=req(b,"tenantId"),project=req(b,"projectId"),process=req(b,"processCode"),step=req(b,"stepCode"),actor=req(b,"actorCode"),command=req(b,"commandCode"),key=req(b,"idempotencyKey");
        List<Map<String,Object>> executions=jdbc.queryForList("select * from framework_process_execution where execution_id=? for update",executionId);
        if(executions.isEmpty())throw new IllegalArgumentException("프로세스 실행 건이 없습니다.");
        Map<String,Object> execution=executions.get(0);
        if(!"RUNNING".equals(String.valueOf(execution.get("execution_status"))))throw new IllegalStateException("실행 중인 프로세스가 아닙니다.");
        if(!tenant.equals(String.valueOf(execution.get("tenant_id")))||!project.equals(String.valueOf(execution.get("project_id")))||!process.equals(String.valueOf(execution.get("process_code"))))throw new IllegalArgumentException("테넌트·프로젝트·프로세스 실행 문맥이 일치하지 않습니다.");
        requireActorAssignment(tenant,project,actor,user);
        List<Map<String,Object>> existing=jdbc.queryForList("select event_id as \"eventId\",to_state as \"toState\" from framework_process_execution_event where execution_id=? and idempotency_key=?",executionId,key);
        if(!existing.isEmpty())return Map.of("success",true,"idempotent",true,"event",existing.get(0));
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
        Long eventId=jdbc.queryForObject("insert into framework_process_execution_event(execution_id,step_code,actor_code,command_code,from_state,to_state,idempotency_key,request_json,result_json,executed_by) values(?,?,?,?,?,?,?,?,?,?) returning event_id",Long.class,executionId,step,actor,command,from,to,key,def(b,"requestJson","{}"),def(b,"resultJson","{}"),user);
        int order=((Number)contract.get("step_order")).intValue();
        List<Map<String,Object>> next=jdbc.queryForList("select step_code,actor_code from framework_process_step where process_code=? and step_code<>? and from_state=? order by case when step_order>? then 0 else 1 end,step_order limit 1",process,step,to,order);
        if(next.isEmpty())jdbc.update("update framework_process_execution set current_state=?,execution_status='COMPLETED',completed_at=current_timestamp,updated_at=current_timestamp where execution_id=?",to,executionId);
        else jdbc.update("update framework_process_execution set current_step_code=?,current_state=?,updated_at=current_timestamp where execution_id=?",String.valueOf(next.get(0).get("step_code")),to,executionId);
        return Map.of("success",true,"idempotent",false,"eventId",eventId,"fromState",from,"toState",to,"executionStatus",next.isEmpty()?"COMPLETED":"RUNNING","nextStepCode",next.isEmpty()?"":String.valueOf(next.get(0).get("step_code")),"nextActorCode",next.isEmpty()?"":String.valueOf(next.get(0).get("actor_code")));
    }

    private void requireActorAssignment(String tenant,String project,String actor,String user){
        Integer count=jdbc.queryForObject("select count(*) from framework_account_actor_assignment where tenant_id=? and project_id=? and actor_code=? and lower(account_id)=lower(?) and assignment_status='ACTIVE' and (valid_from is null or valid_from<=current_date) and (valid_until is null or valid_until>=current_date)",Integer.class,tenant,project,actor,user);
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
        List<Map<String,Object>> rows=jdbc.queryForList("select j.* from framework_development_job j left join framework_development_phase phase on phase.job_type=j.job_type and phase.active_yn='Y' where j.approval_status='APPROVED' and (j.job_status in ('PLANNED','RETRY') or (j.job_status='RUNNING' and j.lease_until<current_timestamp)) and j.attempt_count<j.max_attempts and not exists(select 1 from framework_development_job_dependency d join framework_development_job required_job on required_job.job_id=d.depends_on_job_id where d.job_id=j.job_id and d.dependency_type='REQUIRED' and required_job.job_status not in ('VERIFIED','COMPLETED')) order by coalesce(phase.phase_order,1000),j.process_code,j.step_code,j.job_id for update of j skip locked limit 1");
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
        if(!isProcessDefinitionLocked(process))jdbc.update("update framework_process_step set automation_status=? where process_code=? and step_code=?",pending!=null&&pending==0?"VERIFIED":("FAILED".equals(result)?"BLOCKED":"GENERATED"),process,step);
        return Map.of("success",true,"jobId",id,"status",result,"stepComplete",pending!=null&&pending==0);
    }

    @Transactional public Map<String,Object> retryDevelopmentJob(long jobId,String actor){
        List<Map<String,Object>> rows=jdbc.queryForList("select job_status from framework_development_job where job_id=? for update",jobId);if(rows.isEmpty())throw new IllegalArgumentException("작업이 존재하지 않습니다.");
        String from=String.valueOf(rows.get(0).get("job_status"));if(!"FAILED".equals(from))throw new IllegalArgumentException("실패 작업만 재시도할 수 있습니다.");
        jdbc.update("update framework_development_job set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,updated_at=current_timestamp where job_id=?",jobId);event(jobId,"RETRY_REQUESTED",from,"RETRY",actor,"{}");return Map.of("success",true,"jobId",jobId);
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
        int compiled=0,valid=0,invalid=0,order=0;
        for(Map<String,Object>s:steps){
            for(String audience:List.of("USER","ADMIN")){
                boolean required=Boolean.TRUE.equals(s.get("USER".equals(audience)?"requires_user_page":"requires_admin_page"));if(!required||compiled>=limit)continue;
                String processCode=String.valueOf(s.get("process_code")),stepCode=String.valueOf(s.get("step_code")),actorCode=String.valueOf(s.get("actor_code")),stepName=String.valueOf(s.get("step_name"));
                Object rawPath=s.get("USER".equals(audience)?"user_path":"admin_path");String route=rawPath==null?"":String.valueOf(rawPath).trim();
                String screenType=inferScreenType(stepName,route,audience);String pageId=(processCode+"_"+stepCode+"_"+audience).replaceAll("[^A-Za-z0-9_]","_");String code="BP_"+pageId;
                int caseTypes=jdbc.queryForObject("select count(distinct case_type) from framework_simulation_case where process_code=? and case_type in ('HAPPY_PATH','AUTHORITY','ISOLATION','EXCEPTION','RECOVERY')",Integer.class,processCode);
                String safeRoute=route.isBlank()?("ADMIN".equals(audience)?"/admin/generated/":"/generated/")+processCode.toLowerCase(Locale.ROOT)+"/"+stepCode.toLowerCase(Locale.ROOT):route;
                List<Map<String,Object>> designRows=jdbc.queryForList("select business_purpose,entry_condition,exit_condition,kpi_contract,section_contract,field_contract,command_contract,state_contract,api_contract,data_contract,evidence_contract,responsive_contract,accessibility_contract,security_contract,design_readiness_score from framework_professional_screen_design_readiness where process_code=? and step_code=? and audience=? and lower(split_part(route_path,'?',1))=lower(?) order by contract_id limit 1",processCode,stepCode,audience,ScreenDevelopmentNoteService.cleanRoute(safeRoute));
                Map<String,Object> design=designRows.isEmpty()?Map.of():designRows.get(0);
                int designScore=designRows.isEmpty()?0:((Number)design.get("design_readiness_score")).intValue();
                String validation=route.isBlank()?"화면 경로 누락":caseTypes<5?"필수 5종 테스트 시나리오 누락":(!designRows.isEmpty()&&designScore<100)?"전문 화면 설계 계약 미완료":"";String status=validation.isBlank()?"VALID":"INVALID";
                String spec="{\"domain\":\""+jsonEscape(String.valueOf(s.get("domain_code")))+"\",\"actor\":\""+jsonEscape(actorCode)+"\",\"process\":\""+jsonEscape(processCode)+"\",\"step\":\""+jsonEscape(stepCode)+"\",\"commandCode\":\""+jsonEscape(String.valueOf(s.get("command_code")))+"\",\"fromState\":\""+jsonEscape(String.valueOf(s.get("from_state")))+"\",\"toState\":\""+jsonEscape(String.valueOf(s.get("to_state")))+"\",\"completionRule\":\""+jsonEscape(String.valueOf(s.get("completion_rule")))+"\",\"screenType\":\""+screenType+"\",\"designSystem\":\"KRDS_GOV\",\"businessPurpose\":\""+jsonEscape(String.valueOf(design.getOrDefault("business_purpose",stepName)))+"\",\"entryCondition\":\""+jsonEscape(String.valueOf(design.getOrDefault("entry_condition","")))+"\",\"exitCondition\":\""+jsonEscape(String.valueOf(design.getOrDefault("exit_condition","")))+"\",\"kpis\":"+String.valueOf(design.getOrDefault("kpi_contract","[]"))+",\"sections\":"+String.valueOf(design.getOrDefault("section_contract","[]"))+",\"fields\":"+String.valueOf(design.getOrDefault("field_contract","[]"))+",\"commands\":"+String.valueOf(design.getOrDefault("command_contract","[]"))+",\"states\":"+String.valueOf(design.getOrDefault("state_contract","[]"))+",\"apiContracts\":"+String.valueOf(design.getOrDefault("api_contract","[]"))+",\"dataContracts\":"+String.valueOf(design.getOrDefault("data_contract","[]"))+",\"responsive\":\""+jsonEscape(String.valueOf(design.getOrDefault("responsive_contract","")))+"\",\"accessibility\":\""+jsonEscape(String.valueOf(design.getOrDefault("accessibility_contract","")))+"\"}";
                String trace="{\"requiredScenarioTypes\":[\"HAPPY_PATH\",\"AUTHORITY\",\"ISOLATION\",\"EXCEPTION\",\"RECOVERY\"],\"caseTypeCount\":"+caseTypes+",\"designReadinessScore\":"+designScore+",\"evidenceContract\":"+String.valueOf(design.getOrDefault("evidence_contract","[]"))+"}";
                String strategy="VALID".equals(status)?"GENERATED_RUNTIME":"DESIGN_REQUIRED",transition="VALID".equals(status)?"RUNTIME_ACTIVE":"DESIGN_BLOCKED";
                Long blueprintId=jdbc.queryForObject("insert into framework_screen_blueprint(blueprint_code,process_code,step_code,actor_code,audience,page_id,page_name,route_path,screen_type,template_code,specification_json,traceability_json,validation_status,validation_message,implementation_strategy,transition_status,created_by) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) on conflict(audience,route_path) do update set process_code=excluded.process_code,step_code=excluded.step_code,actor_code=excluded.actor_code,page_id=excluded.page_id,page_name=excluded.page_name,screen_type=excluded.screen_type,template_code=excluded.template_code,specification_json=excluded.specification_json,traceability_json=excluded.traceability_json,validation_status=excluded.validation_status,validation_message=excluded.validation_message,implementation_strategy=excluded.implementation_strategy,transition_status=excluded.transition_status,updated_at=current_timestamp returning blueprint_id",Long.class,code,processCode,stepCode,actorCode,audience,pageId,stepName+("USER".equals(audience)?"":" 관리"),safeRoute,screenType,"KRDS_"+screenType,spec,trace,status,validation,strategy,transition,actor);
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

    public Map<String,Object> resolveGeneratedScreen(String routePath){
        String route=ScreenDevelopmentNoteService.cleanRoute(routePath);List<Map<String,Object>> rows=jdbc.queryForList("select blueprint_code as \"blueprintCode\",process_code as \"processCode\",step_code as \"stepCode\",actor_code as \"actorCode\",audience,page_id as \"pageId\",page_name as \"pageName\",route_path as \"routePath\",screen_type as \"screenType\",template_code as \"templateCode\",specification_json as \"specificationJson\",traceability_json as \"traceabilityJson\",validation_status as \"validationStatus\",implementation_strategy as \"implementationStrategy\",updated_at as \"updatedAt\" from framework_screen_blueprint where lower(split_part(route_path,'?',1))=lower(?) and validation_status='VALID' and implementation_strategy='GENERATED_RUNTIME' order by updated_at desc limit 1",route);
        if(rows.isEmpty())return Map.of("enabled",false,"routePath",route);Map<String,Object> result=new LinkedHashMap<>(rows.get(0));result.put("enabled",true);return result;
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
        for(String[] c:cases){String code=process+"_"+c[0];jdbc.update("insert into framework_simulation_case(case_code,process_code,case_name,case_type,preconditions,steps_json,assertions_json) values(?,?,?,?,?,?,?) on conflict(case_code) do update set case_name=excluded.case_name,case_type=excluded.case_type,preconditions=excluded.preconditions,steps_json=excluded.steps_json,assertions_json=excluded.assertions_json,updated_at=current_timestamp",code,process,c[1],c[2],"테스트용 테넌트·프로젝트·액터 계정이 준비되어야 함","[]","[\"권한·상태·데이터격리·감사로그 검증\"]");}
    }
    private static String str(Map<String,Object>b,String k){return b.get(k)==null?"":String.valueOf(b.get(k)).trim();}
    private static String req(Map<String,Object>b,String k){String v=str(b,k);if(v.isEmpty())throw new IllegalArgumentException(k+" is required");return v;}
    private static String def(Map<String,Object>b,String k,String d){String v=str(b,k);return v.isEmpty()?d:v;}
    private static boolean bool(Map<String,Object>b,String k){return Boolean.parseBoolean(str(b,k));}
    private static int integer(Map<String,Object>b,String k){try{return Integer.parseInt(req(b,k));}catch(Exception e){throw new IllegalArgumentException(k+" must be a number");}}
    private static int integerOr(Map<String,Object>b,String k,int d){String v=str(b,k);if(v.isEmpty())return d;try{return Integer.parseInt(v);}catch(Exception e){throw new IllegalArgumentException(k+" must be a number");}}
    private static String toJson(Object value){try{return new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(value==null?Map.of():value);}catch(Exception e){throw new IllegalArgumentException("configuration must be JSON serializable",e);}}
    private static String jsonEscape(String value){return value==null?"":value.replace("\\","\\\\").replace("\"","\\\"").replace("\r","\\r").replace("\n","\\n");}
}
