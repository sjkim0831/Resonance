package egovframework.com.platform.governance.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ActorProcessGovernanceService {
    private final JdbcTemplate jdbc;

    public Map<String,Object> dashboard() {
        Map<String,Object> out=new LinkedHashMap<>();
        out.put("actors",jdbc.queryForList("select actor_code as \"actorCode\",actor_name as \"actorName\",actor_name_en as \"actorNameEn\",actor_type as \"actorType\",purpose,capability_codes as \"capabilityCodes\",delegation_allowed as \"delegationAllowed\",use_at as \"useAt\" from framework_actor_definition order by actor_type,actor_code"));
        out.put("assignments",jdbc.queryForList("select assignment_id as \"assignmentId\",account_id as \"accountId\",tenant_id as \"tenantId\",project_id as \"projectId\",actor_code as \"actorCode\",data_scope as \"dataScope\",valid_from as \"validFrom\",valid_until as \"validUntil\",assignment_status as \"status\" from framework_account_actor_assignment order by assignment_id desc limit 200"));
        out.put("processes",jdbc.queryForList("select p.process_code as \"processCode\",p.process_name as \"processName\",p.domain_code as \"domainCode\",p.process_version as \"version\",p.parent_process_code as \"parentProcessCode\",p.process_level as \"processLevel\",p.automation_mode as \"automationMode\",p.development_order as \"developmentOrder\",p.prerequisite_codes as \"prerequisiteCodes\",p.goal,p.start_condition as \"startCondition\",p.completion_condition as \"completionCondition\",p.process_status as \"status\",count(distinct s.step_id) as \"stepCount\",count(distinct c.case_code) as \"caseCount\",count(distinct c.case_code) filter(where c.case_status='APPROVED') as \"approvedCaseCount\",count(distinct r.run_id) filter(where r.result='PASSED') as \"passedRuns\",(select count(*) from framework_process_artifact a where a.process_code=p.process_code and a.required) as \"artifactCount\",(select count(*) from framework_process_artifact a where a.process_code=p.process_code and a.required and a.delivery_status='VERIFIED') as \"verifiedArtifactCount\" from framework_process_definition p left join framework_process_step s on s.process_code=p.process_code left join framework_simulation_case c on c.process_code=p.process_code left join framework_simulation_run r on r.case_code=c.case_code group by p.process_code order by p.development_order,p.process_code"));
        out.put("steps",jdbc.queryForList("select step_id as \"stepId\",process_code as \"processCode\",step_order as \"stepOrder\",step_code as \"stepCode\",step_name as \"stepName\",parent_step_code as \"parentStepCode\",step_type as \"stepType\",actor_code as \"actorCode\",from_state as \"fromState\",command_code as \"commandCode\",to_state as \"toState\",completion_rule as \"completionRule\",requirement_text as \"requirementText\",input_contract as \"inputContract\",output_contract as \"outputContract\",requires_user_page as \"requiresUserPage\",requires_admin_page as \"requiresAdminPage\",requires_api as \"requiresApi\",requires_database as \"requiresDatabase\",requires_notification as \"requiresNotification\",automation_status as \"automationStatus\",user_path as \"userPath\",admin_path as \"adminPath\",api_contract as \"apiContract\" from framework_process_step order by process_code,step_order"));
        out.put("cases",jdbc.queryForList("select case_code as \"caseCode\",process_code as \"processCode\",case_name as \"caseName\",case_type as \"caseType\",preconditions,steps_json as \"stepsJson\",assertions_json as \"assertionsJson\",case_status as \"status\" from framework_simulation_case order by process_code,case_code"));
        out.put("runs",jdbc.queryForList("select run_id as \"runId\",case_code as \"caseCode\",process_version as \"processVersion\",result,failure_reason as \"failureReason\",executed_by as \"executedBy\",executed_at as \"executedAt\" from framework_simulation_run order by run_id desc limit 100"));
        out.put("artifacts",jdbc.queryForList("select artifact_id as \"artifactId\",process_code as \"processCode\",step_code as \"stepCode\",artifact_code as \"artifactCode\",artifact_type as \"artifactType\",artifact_name as \"artifactName\",target_path as \"targetPath\",contract_ref as \"contractRef\",required,delivery_status as \"status\",owner_actor_code as \"ownerActorCode\",acceptance_criteria as \"acceptanceCriteria\",evidence_ref as \"evidenceRef\",notes from framework_process_artifact order by process_code,artifact_type,artifact_code"));
        out.put("developmentRules",jdbc.queryForList("select rule_code as \"ruleCode\",rule_group as \"ruleGroup\",rule_name as \"ruleName\",rule_description as \"ruleDescription\",verification_method as \"verificationMethod\",source_ref as \"sourceRef\",mandatory from framework_development_rule where use_at='Y' order by rule_group,rule_code"));
        out.put("developmentJobs",jdbc.queryForList("select job_id as \"jobId\",process_code as \"processCode\",step_code as \"stepCode\",job_type as \"jobType\",job_name as \"jobName\",target_path as \"targetPath\",job_status as \"jobStatus\",approval_status as \"approvalStatus\",worker_id as \"workerId\",lease_until as \"leaseUntil\",attempt_count as \"attemptCount\",evidence_ref as \"evidenceRef\",rollback_ref as \"rollbackRef\",last_error as \"lastError\",created_at as \"createdAt\" from framework_development_job order by process_code,step_code,job_id"));
        out.put("developmentEvents",jdbc.queryForList("select e.event_id as \"eventId\",e.job_id as \"jobId\",e.event_type as \"eventType\",e.from_status as \"fromStatus\",e.to_status as \"toStatus\",e.worker_id as \"workerId\",e.created_at as \"createdAt\" from framework_development_job_event e order by e.event_id desc limit 200"));
        out.put("summary",jdbc.queryForMap("select count(*) as \"processCount\",count(*) filter(where process_status='DEVELOPMENT_READY') as \"readyCount\",count(*) filter(where process_status<>'DEVELOPMENT_READY') as \"draftCount\",coalesce(round(100.0*count(*) filter(where process_status='DEVELOPMENT_READY')/nullif(count(*),0)),0) as \"readinessPercent\" from framework_process_definition"));
        return out;
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

    @Transactional public Map<String,Object> approveDevelopmentPlan(String process,String step,String actor){
        int count=jdbc.update("update framework_development_job set approval_status='APPROVED',updated_at=current_timestamp where process_code=? and step_code=? and job_status='PLANNED'",process,step);
        jdbc.update("update framework_process_step set automation_status='APPROVED' where process_code=? and step_code=?",process,step);
        return Map.of("success",true,"approvedJobs",count,"approvedBy",actor);
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

    private void event(long id,String type,String from,String to,String worker,String detail){jdbc.update("insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json) values(?,?,?,?,?,?)",id,type,from,to,worker,detail);}

    private int queueJob(String process,String step,String type,String name,String path,String requirement,String actor){
        String safePath=(path==null||"null".equals(path)||path.isBlank())?type.toLowerCase()+"/"+process.toLowerCase()+"/"+step.toLowerCase():path;
        int changed=jdbc.update("insert into framework_development_job(process_code,step_code,job_type,job_name,target_path,specification_json,created_by) values(?,?,?,?,?,?,?) on conflict(process_code,step_code,job_type,target_path) do update set job_name=excluded.job_name,specification_json=excluded.specification_json,updated_at=current_timestamp",process,step,type,name,safePath,"{\"requirement\":\""+jsonEscape(requirement)+"\"}",actor);
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
