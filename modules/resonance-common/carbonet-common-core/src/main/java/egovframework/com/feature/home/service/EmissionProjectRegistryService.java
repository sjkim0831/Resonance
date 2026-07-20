package egovframework.com.feature.home.service;

import egovframework.com.platform.governance.service.ActorProcessGovernanceService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import javax.sql.DataSource;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.ArrayList;
import java.util.Set;
import java.util.HashSet;
import java.io.InputStream;

@Service
public class EmissionProjectRegistryService {
    private final JdbcTemplate jdbc;
    private final ActorProcessGovernanceService processGovernanceService;
    public EmissionProjectRegistryService(DataSource dataSource,ActorProcessGovernanceService processGovernanceService) { this.jdbc = new JdbcTemplate(dataSource);this.processGovernanceService=processGovernanceService; }

    public Map<String, Object> list(String tenantId, String keyword, String status, String site, int page) {
        String tenant = requiredValue(tenantId, "tenantId");
        String term = keyword == null ? "" : keyword.trim(), state = status == null ? "" : status.trim(), siteName = site == null ? "" : site.trim();
        int pageIndex = Math.max(1, page), size = 10;
        String where = " WHERE tenant_id=? AND (? = '' OR lower(project_id || ' ' || project_name || ' ' || site_name || ' ' || owner_name) LIKE lower(?)) AND (? = '' OR project_status = ?) AND (? = '' OR site_name = ?)";
        String like = "%" + term + "%";
        Integer total = jdbc.queryForObject("SELECT count(*) FROM emission_project_registry" + where, Integer.class, tenant, term, like, state, state, siteName, siteName);
        List<Map<String, Object>> items = jdbc.queryForList("SELECT project_id AS \"id\", project_name AS \"name\", site_name AS \"site\", calculation_period AS \"period\", scope_name AS \"scope\", owner_name AS \"owner\", progress_percent AS \"progress\", current_step AS \"step\", due_date AS \"dueDate\", project_status AS \"status\" FROM emission_project_registry" + where + " ORDER BY CASE WHEN project_status='완료' THEN 1 ELSE 0 END, due_date NULLS LAST, created_at DESC LIMIT 10 OFFSET ?", tenant, term, like, state, state, siteName, siteName, (pageIndex - 1) * size);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", items); result.put("total", total == null ? 0 : total); result.put("page", pageIndex); result.put("size", size);
        result.put("summary", jdbc.queryForList("SELECT project_status AS status, count(*) AS count FROM emission_project_registry WHERE tenant_id=? GROUP BY project_status", tenant));
        result.put("sites", jdbc.queryForList("SELECT DISTINCT site_name FROM emission_project_registry WHERE tenant_id=? ORDER BY site_name", String.class, tenant));
        return result;
    }

    public Map<String,Object> listForActor(String tenantId,String actor,boolean override,String keyword,String status,String site,int page) {
        String tenant=requiredValue(tenantId,"tenantId"),user=requiredValue(actor,"actor");
        String term=keyword==null?"":keyword.trim(),state=status==null?"":status.trim(),siteName=site==null?"":site.trim(),like="%"+term+"%";
        int pageIndex=Math.max(1,page),size=10;
        String access="p.tenant_id=? AND (? OR EXISTS (SELECT 1 FROM framework_project_actor_assignment a WHERE a.project_id=p.project_id AND lower(a.user_id)=lower(?) AND a.active_yn='Y'))";
        String filters=" AND (?='' OR lower(p.project_id||' '||p.project_name||' '||p.site_name||' '||p.owner_name) LIKE lower(?)) AND (?='' OR p.project_status=?) AND (?='' OR p.site_name=?)";
        Object[] args={tenant,override,user,term,like,state,state,siteName,siteName};
        Integer total=jdbc.queryForObject("SELECT count(*) FROM emission_project_registry p WHERE "+access+filters,Integer.class,args);
        List<Object> itemArgs=new ArrayList<>(List.of(args)); itemArgs.add((pageIndex-1)*size);
        List<Map<String,Object>> items=jdbc.queryForList("SELECT p.project_id AS \"id\",p.project_name AS \"name\",p.site_name AS \"site\",p.calculation_period AS \"period\",p.scope_name AS \"scope\",p.owner_name AS \"owner\",p.progress_percent AS \"progress\",p.current_step AS \"step\",p.due_date AS \"dueDate\",p.project_status AS \"status\" FROM emission_project_registry p WHERE "+access+filters+" ORDER BY p.due_date NULLS LAST,p.created_at DESC LIMIT 10 OFFSET ?",itemArgs.toArray());
        Map<String,Object> result=new LinkedHashMap<>(); result.put("items",items);result.put("total",total==null?0:total);result.put("page",pageIndex);result.put("size",size);
        result.put("summary",jdbc.queryForList("SELECT p.project_status AS status,count(*) AS count FROM emission_project_registry p WHERE "+access+" GROUP BY p.project_status",tenant,override,user));
        result.put("sites",jdbc.queryForList("SELECT DISTINCT p.site_name FROM emission_project_registry p WHERE "+access+" ORDER BY p.site_name",String.class,tenant,override,user));
        return result;
    }

    public boolean nameAvailable(String tenantId,String name) {
        Integer count = jdbc.queryForObject("SELECT count(*) FROM emission_project_registry WHERE tenant_id=? AND lower(trim(project_name))=lower(trim(?))", Integer.class, requiredValue(tenantId,"tenantId"),name == null ? "" : name);
        return count == null || count == 0;
    }

    public Map<String, Object> options(String tenantId,String actor,String keyword) {
        String tenant=requiredValue(tenantId,"tenantId");
        String term = keyword == null ? "" : keyword.trim(), like = "%" + term + "%";
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sites", jdbc.queryForList("SELECT site_name FROM emission_site_registry WHERE tenant_id=? AND site_status='ACTIVE' AND (effective_until IS NULL OR effective_until>=current_date) AND (?='' OR site_name ILIKE ?) ORDER BY site_name LIMIT 50", String.class,tenant,term,like));
        result.put("owners", jdbc.queryForList("SELECT DISTINCT owner_name FROM emission_project_registry WHERE tenant_id=? AND (?='' OR owner_name ILIKE ?) ORDER BY owner_name LIMIT 20", String.class,tenant,term,like));
        result.put("accounts", jdbc.queryForList("SELECT account_id AS \"id\",string_agg(DISTINCT actor_code,', ' ORDER BY actor_code) AS \"actors\" FROM framework_account_actor_assignment WHERE tenant_id=? AND assignment_status='ACTIVE' AND (valid_until IS NULL OR valid_until>=current_date) AND (?='' OR account_id ILIKE ?) GROUP BY account_id ORDER BY account_id LIMIT 100",tenant,term,like));
        result.put("readiness", onboardingReadiness(tenant));
        result.put("currentUser",requiredValue(actor,"actor"));
        return result;
    }

    public Map<String,Object> onboardingReadiness(String tenantId) {
        String tenant=requiredValue(tenantId,"tenantId");
        boolean sandbox="DEFAULT".equals(tenant);
        Integer companyCount=sandbox?1:jdbc.queryForObject("SELECT count(*) FROM comtninsttinfo WHERE trim(instt_id)=? AND upper(trim(instt_sttus)) IN ('P','A','APPROVED','ACTIVE','Y')",Integer.class,tenant);
        Integer siteCount=jdbc.queryForObject("SELECT count(*) FROM emission_site_registry WHERE tenant_id=? AND site_status='ACTIVE' AND (effective_until IS NULL OR effective_until>=current_date)",Integer.class,tenant);
        List<String> requiredActors=List.of("COMPANY_MANAGER","SITE_DATA_OWNER","CALCULATOR","VERIFIER","APPROVER");
        List<Map<String,Object>> actorRows=jdbc.queryForList("SELECT actor_code AS actor,count(DISTINCT account_id) AS count FROM framework_account_actor_assignment WHERE tenant_id=? AND assignment_status='ACTIVE' AND (valid_until IS NULL OR valid_until>=current_date) AND actor_code IN ('COMPANY_MANAGER','SITE_DATA_OWNER','CALCULATOR','VERIFIER','APPROVER') GROUP BY actor_code",tenant);
        Map<String,Integer> coverage=new LinkedHashMap<>();
        for(String code:requiredActors)coverage.put(code,0);
        for(Map<String,Object> row:actorRows)coverage.put(String.valueOf(row.get("actor")),((Number)row.get("count")).intValue());
        List<String> missing=new ArrayList<>();
        if(companyCount==null||companyCount==0)missing.add("COMPANY_NOT_APPROVED");
        if(siteCount==null||siteCount==0)missing.add("ACTIVE_SITE_REQUIRED");
        for(String code:requiredActors)if(coverage.getOrDefault(code,0)==0)missing.add("REQUIRED_ACTOR_MISSING:"+code);
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("ready",missing.isEmpty());result.put("sandbox",sandbox);result.put("companyApproved",companyCount!=null&&companyCount>0);
        result.put("activeSiteCount",siteCount==null?0:siteCount);result.put("actorCoverage",coverage);result.put("missing",missing);
        result.put("siteManagementUrl","/admin/emission/site-management");result.put("actorManagementUrl","/admin/system/actor-process");
        return result;
    }

    public Map<String, Object> detail(String id) {
        List<Map<String, Object>> projects = jdbc.queryForList("SELECT project_id AS \"id\",project_name AS \"name\",site_name AS \"site\",calculation_period AS \"period\",scope_name AS \"scope\",owner_name AS \"owner\",progress_percent AS \"progress\",current_step AS \"step\",due_date AS \"dueDate\",project_status AS \"status\",reporting_year AS \"reportingYear\",period_start AS \"periodStart\",period_end AS \"periodEnd\",organization_boundary AS \"organizationBoundary\",emission_standard AS \"emissionStandard\",methodology_version AS \"methodologyVersion\",verification_level AS \"verificationLevel\",collection_cycle AS \"collectionCycle\",materiality_threshold AS \"materialityThreshold\",settings_snapshot AS \"settingsSnapshot\" FROM emission_project_registry WHERE project_id=?", id);
        if (projects.isEmpty()) throw new IllegalArgumentException("프로젝트를 찾을 수 없습니다.");
        Map<String, Object> result = new LinkedHashMap<>(projects.get(0));
        result.put("tasks", jdbc.queryForList("SELECT task_code AS \"code\",task_name AS \"name\",step_order AS \"order\",task_status AS \"status\",progress_weight AS \"weight\",due_date AS \"dueDate\",target_url AS \"targetUrl\",process_code AS \"processCode\",process_step_code AS \"processStepCode\",actor_code AS \"actorCode\",predecessor_codes AS \"predecessorCodes\",completion_rule AS \"completionRule\",blocked_reason AS \"blockedReason\",started_at AS \"startedAt\",completed_at AS \"completedAt\",completed_by AS \"completedBy\" FROM emission_project_task WHERE project_id=? ORDER BY step_order", id));
        result.put("members", jdbc.queryForList("SELECT member_name AS \"name\",role_code AS \"role\" FROM emission_project_member WHERE project_id=? ORDER BY created_at", id));
        result.put("history", jdbc.queryForList("SELECT event_type AS \"type\",event_description AS \"description\",actor_name AS \"actor\",created_at AS \"createdAt\" FROM emission_project_history WHERE project_id=? ORDER BY created_at DESC LIMIT 30", id));
        return result;
    }

    public void assertTenantAccess(String projectId,String tenantId) {
        Integer count=jdbc.queryForObject("SELECT count(*) FROM emission_project_registry WHERE project_id=? AND tenant_id=?",Integer.class,projectId,requiredValue(tenantId,"tenantId"));
        if(count==null||count==0) throw new SecurityException("PROJECT_TENANT_SCOPE_DENIED");
    }

    public void assertProjectParticipant(String projectId,String tenantId,String actor,boolean override) {
        String tenant=requiredValue(tenantId,"tenantId"),user=requiredValue(actor,"actor");
        assertTenantAccess(projectId,tenant);
        if(override) return;
        Integer count=jdbc.queryForObject("SELECT count(*) FROM framework_project_actor_assignment WHERE project_id=? AND lower(user_id)=lower(?) AND active_yn='Y'",Integer.class,projectId,user);
        if(count==null||count==0) throw new SecurityException("PROJECT_ACTOR_SCOPE_DENIED");
    }

    public Map<String,Object> activities(String projectId,String keyword) {
        detail(projectId);
        String term=keyword==null?"":keyword.trim(), like="%"+term+"%";
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("project", detail(projectId));
        result.put("items",jdbc.queryForList("SELECT a.activity_id AS \"id\",a.activity_name AS \"name\",a.category,a.activity_period AS \"period\",a.quantity,a.unit,a.evidence_note AS \"note\",a.factor_id AS \"factorId\",f.factor_name AS \"factorName\",f.factor_value AS \"factorValue\",a.mapping_status AS \"mappingStatus\" FROM emission_activity_data a LEFT JOIN emission_factor_reference f ON f.factor_id=a.factor_id WHERE a.project_id=? AND (?='' OR a.activity_name ILIKE ? OR a.category ILIKE ?) ORDER BY a.activity_period DESC,a.activity_id DESC",projectId,term,like,like));
        result.put("factors",jdbc.queryForList("SELECT factor_id AS \"id\",factor_name AS \"name\",category,unit,factor_value AS \"value\",source_name AS \"source\" FROM emission_factor_reference ORDER BY category,factor_name"));
        result.put("collectionHealth",jdbc.queryForMap("SELECT collection_health AS \"status\",activity_count AS \"activityCount\",missing_evidence_count AS \"missingEvidenceCount\",invalid_value_count AS \"invalidValueCount\",submitted_version_count AS \"submittedVersionCount\",unsealed_submission_count AS \"unsealedSubmissionCount\" FROM emission_activity_collection_health WHERE project_id=?",projectId));
        return result;
    }

    @Transactional
    public long saveActivity(String projectId,String tenantId,String actor,boolean override,Map<String,Object> body) {
        requireProjectActor(projectId,requiredValue(tenantId,"tenantId"),requiredValue(actor,"actor"),"SITE_DATA_OWNER",override);
        String name=required(body,"name"),category=required(body,"category"),period=required(body,"period"),unit=required(body,"unit");
        double quantity=Double.parseDouble(required(body,"quantity")); if(quantity<0) throw new IllegalArgumentException("활동량은 0보다 작을 수 없습니다.");
        String note=required(body,"note"); if(note.length()>500) throw new IllegalArgumentException("ACTIVITY_EVIDENCE_TOO_LONG");
        Long id=jdbc.queryForObject("INSERT INTO emission_activity_data(project_id,activity_name,category,activity_period,quantity,unit,evidence_note) VALUES (?,?,?,?,?,?,?) RETURNING activity_id",Long.class,projectId,name,category,period,quantity,unit,note);
        jdbc.update("INSERT INTO emission_project_history(project_id,event_type,event_description,actor_name) SELECT ?,'ACTIVITY_ADDED',?||' 활동자료가 등록되었습니다.',owner_name FROM emission_project_registry WHERE project_id=?",projectId,name,projectId);
        return id==null?0:id;
    }

    @Transactional
    public int mapFactor(String projectId,long activityId,String tenantId,String actor,boolean override,Map<String,Object> body) {
        String tenant=requiredValue(tenantId,"tenantId"),user=requiredValue(actor,"actor"),factorId=required(body,"factorId"),reason=text(body.get("reason"));
        requireProjectActor(projectId,tenant,user,"CALCULATOR",override); requireAcceptedActivityData(projectId);
        Integer eligible=jdbc.queryForObject("SELECT count(*) FROM emission_activity_request r JOIN emission_activity_submission_item i ON i.submission_id=r.last_submission_id WHERE r.project_id=? AND r.tenant_id=? AND r.request_status='ACCEPTED' AND i.activity_id=?",Integer.class,projectId,tenant,activityId);
        if(eligible==null||eligible==0) throw new IllegalStateException("FACTOR_MAPPING_REQUIRES_ACCEPTED_ACTIVITY");
        List<Map<String,Object>> factors=jdbc.queryForList("SELECT unit FROM emission_factor_reference WHERE factor_id=?",factorId); if(factors.isEmpty())throw new IllegalArgumentException("FACTOR_NOT_FOUND");
        Boolean unitMatch=jdbc.queryForObject("SELECT unit=? FROM emission_activity_data WHERE project_id=? AND activity_id=?",Boolean.class,text(factors.get(0).get("unit")),projectId,activityId);
        jdbc.update("UPDATE emission_factor_mapping_decision SET active_yn='N' WHERE project_id=? AND activity_id=? AND active_yn='Y'",projectId,activityId);
        int changed=jdbc.update("UPDATE emission_activity_data SET factor_id=?,mapping_status='MAPPED',updated_at=current_timestamp WHERE project_id=? AND activity_id=?",factorId,projectId,activityId);
        if(changed==0) throw new IllegalArgumentException("활동자료를 찾을 수 없습니다.");
        jdbc.update("INSERT INTO emission_factor_mapping_decision(tenant_id,project_id,activity_id,factor_id,mapping_method,confidence_score,unit_match,decision_reason,decided_by) VALUES (?,?,?,?,'MANUAL',1,?,?,?)",tenant,projectId,activityId,factorId,Boolean.TRUE.equals(unitMatch),reason.isBlank()?"산정 담당자 직접 선택":reason,user);
        return changed;
    }

    @Transactional
    public int autoMap(String projectId,String tenantId,String actor,boolean override) {
        String tenant=requiredValue(tenantId,"tenantId"),user=requiredValue(actor,"actor"); requireProjectActor(projectId,tenant,user,"CALCULATOR",override); requireAcceptedActivityData(projectId);
        int changed=jdbc.update("UPDATE emission_activity_data a SET factor_id=(SELECT r.factor_id FROM emission_factor_reference r WHERE lower(r.factor_name) LIKE '%'||lower(a.activity_name)||'%' OR lower(a.activity_name) LIKE '%'||lower(trim(split_part(r.factor_name,'(',1)))||'%' OR r.category=a.category ORDER BY CASE WHEN r.unit=a.unit THEN 0 ELSE 1 END,CASE WHEN lower(r.factor_name)=lower(a.activity_name) THEN 0 ELSE 1 END,r.factor_id LIMIT 1),mapping_status='MAPPED',updated_at=current_timestamp WHERE a.project_id=? AND a.factor_id IS NULL AND EXISTS (SELECT 1 FROM emission_activity_request q JOIN emission_activity_submission_item i ON i.submission_id=q.last_submission_id WHERE q.project_id=a.project_id AND q.tenant_id=? AND q.request_status='ACCEPTED' AND i.activity_id=a.activity_id) AND EXISTS (SELECT 1 FROM emission_factor_reference r WHERE lower(r.factor_name) LIKE '%'||lower(a.activity_name)||'%' OR lower(a.activity_name) LIKE '%'||lower(trim(split_part(r.factor_name,'(',1)))||'%' OR r.category=a.category)",projectId,tenant);
        jdbc.update("INSERT INTO emission_factor_mapping_decision(tenant_id,project_id,activity_id,factor_id,mapping_method,confidence_score,unit_match,decision_reason,decided_by) SELECT ?,a.project_id,a.activity_id,a.factor_id,'AUTO',CASE WHEN lower(f.factor_name)=lower(a.activity_name) AND f.unit=a.unit THEN 1 WHEN f.unit=a.unit THEN .85 ELSE .55 END,f.unit=a.unit,'명칭·구분·단위 결정 규칙 자동 추천',? FROM emission_activity_data a JOIN emission_factor_reference f ON f.factor_id=a.factor_id JOIN emission_activity_request q ON q.project_id=a.project_id AND q.tenant_id=? AND q.request_status='ACCEPTED' JOIN emission_activity_submission_item i ON i.submission_id=q.last_submission_id AND i.activity_id=a.activity_id WHERE a.project_id=? AND NOT EXISTS (SELECT 1 FROM emission_factor_mapping_decision d WHERE d.project_id=a.project_id AND d.activity_id=a.activity_id AND d.active_yn='Y') ON CONFLICT DO NOTHING",tenant,user,tenant,projectId);
        jdbc.update("INSERT INTO emission_project_history(project_id,event_type,event_description,actor_name) SELECT ?,'FACTOR_MAPPING',?||'건의 배출계수가 자동 매핑되었습니다.',owner_name FROM emission_project_registry WHERE project_id=?",projectId,String.valueOf(changed),projectId);
        return changed;
    }

    @Transactional
    public int uploadActivities(String projectId,String tenantId,String actor,boolean override,MultipartFile file) throws Exception {
        requireProjectActor(projectId,requiredValue(tenantId,"tenantId"),requiredValue(actor,"actor"),"SITE_DATA_OWNER",override);
        if(file==null||file.isEmpty()) throw new IllegalArgumentException("엑셀 파일을 선택해 주세요.");
        int count=0; DataFormatter formatter=new DataFormatter();
        try(InputStream in=file.getInputStream(); XSSFWorkbook workbook=new XSSFWorkbook(in)) {
            Sheet sheet=workbook.getSheetAt(0);
            for(int index=1;index<=sheet.getLastRowNum();index++) { Row row=sheet.getRow(index); if(row==null) continue;
                String name=formatter.formatCellValue(row.getCell(0)).trim(); if(name.isEmpty()) continue;
                String category=formatter.formatCellValue(row.getCell(1)).trim(), period=formatter.formatCellValue(row.getCell(2)).trim(), quantityText=formatter.formatCellValue(row.getCell(3)).replace(",","").trim(), unit=formatter.formatCellValue(row.getCell(4)).trim(), note=formatter.formatCellValue(row.getCell(5)).trim();
                if(category.isEmpty()||period.isEmpty()||quantityText.isEmpty()||unit.isEmpty()||note.isEmpty()) throw new IllegalArgumentException((index+1)+"행의 필수값과 증빙 비고를 확인해 주세요.");
                double quantity=Double.parseDouble(quantityText);
                jdbc.update("INSERT INTO emission_activity_data(project_id,activity_name,category,activity_period,quantity,unit,evidence_note) VALUES (?,?,?,?,?,?,?)",projectId,name,category,period,quantity,unit,note); count++;
            }
        }
        jdbc.update("INSERT INTO emission_project_history(project_id,event_type,event_description,actor_name) SELECT ?,'EXCEL_UPLOADED',?||'건의 활동자료를 엑셀로 등록했습니다.',owner_name FROM emission_project_registry WHERE project_id=?",projectId,String.valueOf(count),projectId);
        return count;
    }

    public Map<String,Object> calculationResult(String projectId,String tenantId,String actor,boolean override) {
        String tenant=requiredValue(tenantId,"tenantId"); assertTenantAccess(projectId,tenant);
        Map<String,Object> result=new LinkedHashMap<>(); result.put("project",detail(projectId));
        List<Map<String,Object>> runs=jdbc.queryForList("SELECT calculation_id AS \"id\",version_no AS \"version\",calculation_status AS \"status\",total_emission AS \"totalEmission\",result_unit AS \"resultUnit\",accepted_submission_ids AS \"submissionIds\",input_snapshot_hash AS \"snapshotHash\",methodology_code AS methodology,calculated_by AS \"calculatedBy\",calculated_at AS \"calculatedAt\" FROM emission_calculation_run WHERE project_id=? ORDER BY version_no DESC",projectId);
        result.put("runs",runs);
        if(!runs.isEmpty()) { long id=((Number)runs.get(0).get("id")).longValue(); result.put("items",jdbc.queryForList("SELECT activity_name AS name,category,activity_period AS period,quantity,activity_unit AS unit,factor_id AS \"factorId\",factor_name AS \"factorName\",factor_unit AS \"factorUnit\",factor_source AS \"factorSource\",factor_value AS \"factorValue\",emission_value AS \"emissionValue\",formula_text AS formula FROM emission_calculation_item WHERE calculation_id=? ORDER BY emission_value DESC",id)); }
        else result.put("items",List.of());
        String accepted="WITH accepted AS (SELECT DISTINCT ON (i.activity_id) i.activity_id,i.activity_name,i.category,i.activity_period,i.quantity,i.unit,i.evidence_note,r.last_submission_id FROM emission_activity_request r JOIN emission_activity_submission_item i ON i.submission_id=r.last_submission_id WHERE r.project_id=? AND r.tenant_id=? AND r.request_status='ACCEPTED' ORDER BY i.activity_id,r.accepted_at DESC) ";
        List<Map<String,Object>> source=jdbc.queryForList(accepted+"SELECT a.activity_id AS id,a.activity_name AS name,a.category,a.activity_period AS period,a.quantity,a.unit,a.evidence_note AS note,a.last_submission_id AS \"submissionId\",d.factor_id AS \"factorId\",f.factor_name AS \"factorName\",f.factor_value AS \"factorValue\",f.unit AS \"factorUnit\",f.source_name AS \"factorSource\",d.mapping_method AS \"mappingMethod\",d.confidence_score AS confidence,d.unit_match AS \"unitMatch\",d.decision_reason AS \"decisionReason\",d.decided_by AS \"decidedBy\",d.decided_at AS \"decidedAt\" FROM accepted a LEFT JOIN emission_factor_mapping_decision d ON d.project_id=? AND d.activity_id=a.activity_id AND d.active_yn='Y' LEFT JOIN emission_factor_reference f ON f.factor_id=d.factor_id ORDER BY a.activity_period,a.activity_id",projectId,tenant,projectId);
        result.put("sourceItems",source); result.put("activityCount",source.size()); result.put("unmappedCount",source.stream().filter(row->row.get("factorId")==null).count());
        result.put("incompatibleUnitCount",source.stream().filter(row->row.get("factorId")!=null&&!Boolean.TRUE.equals(row.get("unitMatch"))).count());
        result.put("acceptedSubmissionCount",jdbc.queryForObject("SELECT count(DISTINCT last_submission_id) FROM emission_activity_request WHERE project_id=? AND tenant_id=? AND request_status='ACCEPTED'",Integer.class,projectId,tenant));
        result.put("factors",jdbc.queryForList("SELECT factor_id AS id,factor_name AS name,category,unit,factor_value AS value,source_name AS source FROM emission_factor_reference ORDER BY category,factor_name"));
        result.put("actorRoles",override?List.of("CALCULATOR"):jdbc.queryForList("SELECT actor_code FROM framework_project_actor_assignment WHERE project_id=? AND lower(user_id)=lower(?) AND active_yn='Y' ORDER BY actor_code",projectId,requiredValue(actor,"actor")).stream().map(row->text(row.get("actor_code"))).toList());
        return result;
    }

    @Transactional
    public long calculate(String projectId,String tenantId,String actor,boolean override) {
        String tenant=requiredValue(tenantId,"tenantId"),user=requiredValue(actor,"actor");
        requireProjectActor(projectId,tenant,user,"CALCULATOR",override);
        requireAcceptedActivityData(projectId);
        jdbc.query("SELECT pg_advisory_xact_lock(hashtext(?))",rs->{},tenant+":"+projectId+":CALCULATION");
        String accepted="WITH accepted AS (SELECT DISTINCT ON (i.activity_id) i.activity_id,i.activity_name,i.category,i.activity_period,i.quantity,i.unit,r.last_submission_id FROM emission_activity_request r JOIN emission_activity_submission_item i ON i.submission_id=r.last_submission_id WHERE r.project_id=? AND r.tenant_id=? AND r.request_status='ACCEPTED' ORDER BY i.activity_id,r.accepted_at DESC) ";
        Integer total=jdbc.queryForObject(accepted+"SELECT count(*) FROM accepted",Integer.class,projectId,tenant);
        Integer unmapped=jdbc.queryForObject(accepted+"SELECT count(*) FROM accepted a LEFT JOIN emission_factor_mapping_decision d ON d.project_id=? AND d.activity_id=a.activity_id AND d.active_yn='Y' WHERE d.factor_id IS NULL",Integer.class,projectId,tenant,projectId);
        Integer incompatible=jdbc.queryForObject(accepted+"SELECT count(*) FROM accepted a JOIN emission_factor_mapping_decision d ON d.project_id=? AND d.activity_id=a.activity_id AND d.active_yn='Y' WHERE d.unit_match=false",Integer.class,projectId,tenant,projectId);
        if(total==null||total==0) throw new IllegalArgumentException("산정할 활동자료가 없습니다.");
        if(unmapped!=null&&unmapped>0) throw new IllegalArgumentException("미매핑 활동자료 "+unmapped+"건을 먼저 처리해 주세요.");
        if(incompatible!=null&&incompatible>0) throw new IllegalStateException("UNIT_CONVERSION_REQUIRED:"+incompatible);
        Integer version=jdbc.queryForObject("SELECT coalesce(max(version_no),0)+1 FROM emission_calculation_run WHERE project_id=?",Integer.class,projectId);
        Double sum=jdbc.queryForObject(accepted+"SELECT coalesce(sum(a.quantity*f.factor_value),0) FROM accepted a JOIN emission_factor_mapping_decision d ON d.project_id=? AND d.activity_id=a.activity_id AND d.active_yn='Y' JOIN emission_factor_reference f ON f.factor_id=d.factor_id",Double.class,projectId,tenant,projectId);
        String submissionIds=jdbc.queryForObject("SELECT string_agg(DISTINCT last_submission_id::text,',' ORDER BY last_submission_id::text) FROM emission_activity_request WHERE project_id=? AND tenant_id=? AND request_status='ACCEPTED'",String.class,projectId,tenant);
        String canonical=jdbc.queryForObject(accepted+"SELECT string_agg(concat_ws('|',a.last_submission_id,a.activity_id,a.activity_name,a.category,a.activity_period,a.quantity,a.unit,d.factor_id,f.factor_value,a.quantity*f.factor_value),'~' ORDER BY a.activity_id) FROM accepted a JOIN emission_factor_mapping_decision d ON d.project_id=? AND d.activity_id=a.activity_id AND d.active_yn='Y' JOIN emission_factor_reference f ON f.factor_id=d.factor_id",String.class,projectId,tenant,projectId);
        String hash; try{hash=java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(text(canonical).getBytes(java.nio.charset.StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException("CALCULATION_SNAPSHOT_HASH_FAILED",e);}
        Long id=jdbc.queryForObject("INSERT INTO emission_calculation_run(project_id,version_no,total_emission,tenant_id,accepted_submission_ids,input_snapshot_hash,calculated_by) VALUES (?,?,?,?,?,?,?) RETURNING calculation_id",Long.class,projectId,version,sum,tenant,submissionIds,hash,user);
        jdbc.update(accepted+"INSERT INTO emission_calculation_item(calculation_id,activity_id,quantity,factor_value,emission_value,activity_name,category,activity_period,activity_unit,factor_id,factor_name,factor_unit,factor_source,formula_text) SELECT ?,a.activity_id,a.quantity,f.factor_value,a.quantity*f.factor_value,a.activity_name,a.category,a.activity_period,a.unit,f.factor_id,f.factor_name,f.unit,f.source_name,a.quantity||' '||a.unit||' × '||f.factor_value||' ('||f.source_name||')' FROM accepted a JOIN emission_factor_mapping_decision d ON d.project_id=? AND d.activity_id=a.activity_id AND d.active_yn='Y' JOIN emission_factor_reference f ON f.factor_id=d.factor_id",projectId,tenant,id,projectId);
        jdbc.update("UPDATE emission_project_registry SET progress_percent=50,current_step='배출량 산정',project_status='진행',updated_at=current_timestamp WHERE project_id=?",projectId);
        completeWorkflowTask(projectId,"CALCULATION",user);
        jdbc.update("INSERT INTO emission_project_history(project_id,event_type,event_description,actor_name) SELECT ?,'CALCULATED','산정 버전 '||?||'이 생성되었습니다.',owner_name FROM emission_project_registry WHERE project_id=?",projectId,String.valueOf(version),projectId);
        return id==null?0:id;
    }

    private void requireSubmittedActivityData(String projectId) {
        Integer count=jdbc.queryForObject("SELECT count(*) FROM emission_activity_submission WHERE project_id=? AND submission_state IN ('SUBMITTED','IN_VERIFICATION','VERIFIED','APPROVED')",Integer.class,projectId);
        if(count==null||count==0) throw new IllegalStateException("CALCULATION_REQUIRES_SUBMITTED_ACTIVITY_DATA");
    }

    private void requireAcceptedActivityData(String projectId) {
        Integer count=jdbc.queryForObject("SELECT count(*) FROM emission_activity_request WHERE project_id=? AND request_status='ACCEPTED' AND last_submission_id IS NOT NULL",Integer.class,projectId);
        if(count==null||count==0) throw new IllegalStateException("CALCULATION_REQUIRES_ACCEPTED_ACTIVITY_DATA");
    }

    public Map<String,Object> myTasks(String tenantId,String actorId,boolean showAll,String status,String period) {
        String tenant=requiredValue(tenantId,"tenantId");
        String state=status==null?"":status.trim(),range=period==null?"":period.trim();
        String actor=actorId==null?"":actorId.trim();
        String where=" WHERE p.tenant_id=? AND (? OR lower(coalesce(t.assignee_id,''))=lower(?)) AND (?='' OR t.task_status=?) AND (?='' OR (?='TODAY' AND t.due_date=current_date) OR (?='WEEK' AND t.due_date BETWEEN current_date AND current_date+7) OR (?='OVERDUE' AND t.due_date<current_date AND t.task_status<>'DONE'))";
        Object[] args={tenant,showAll,actor,state,state,range,range,range,range};
        String taskProjection="SELECT t.task_id AS \"id\",t.task_code AS \"taskCode\",t.step_order AS \"stepOrder\",t.project_id AS \"projectId\",p.project_name AS \"projectName\",p.site_name AS \"site\",t.task_name AS \"name\",t.task_type AS \"type\",t.task_status AS \"status\",t.priority,t.assignee_id AS \"assignee\",t.due_date AS \"dueDate\",t.target_url AS \"targetUrl\",t.process_code AS \"processCode\",coalesce(pd.process_name,t.process_code) AS \"processName\",coalesce(pd.domain_code,'EMISSION') AS \"domainCode\",t.process_step_code AS \"processStepCode\",t.actor_code AS \"actorCode\",t.completion_rule AS \"completionRule\",t.blocked_reason AS \"blockedReason\",s.from_state AS \"entryState\",s.requirement_text AS \"workPurpose\",s.input_contract AS \"requiredInputs\",s.output_contract AS \"expectedOutput\",s.command_code AS \"commandCode\",n.task_name AS \"nextTaskName\",n.actor_code AS \"nextActorCode\",n.target_url AS \"nextTaskUrl\",(t.task_status IN ('READY','IN_PROGRESS')) AS \"actionable\",coalesce((SELECT string_agg(p2.task_name,', ' ORDER BY p2.step_order) FROM emission_project_task p2 WHERE p2.project_id=t.project_id AND p2.task_code=ANY(string_to_array(nullif(t.predecessor_codes,''),',')) AND p2.task_status<>'DONE'),'') AS \"pendingPredecessors\" FROM emission_project_task t JOIN emission_project_registry p ON p.project_id=t.project_id LEFT JOIN framework_process_step s ON s.process_code=t.process_code AND s.step_code=t.process_step_code LEFT JOIN framework_process_definition pd ON pd.process_code=t.process_code LEFT JOIN LATERAL (SELECT nt.task_name,nt.actor_code,nt.target_url FROM emission_project_task nt WHERE nt.project_id=t.project_id AND nt.step_order>t.step_order ORDER BY nt.step_order LIMIT 1) n ON true";
        List<Map<String,Object>> items=jdbc.queryForList(taskProjection+where+" ORDER BY CASE t.task_status WHEN 'READY' THEN 0 WHEN 'IN_PROGRESS' THEN 1 WHEN 'BLOCKED' THEN 2 WHEN 'WAITING' THEN 3 ELSE 4 END,CASE t.priority WHEN 'URGENT' THEN 0 WHEN 'HIGH' THEN 1 ELSE 2 END,t.due_date,t.step_order",args);
        items.forEach(this::enrichCompletionReadiness);
        Map<String,Object> result=new LinkedHashMap<>(); result.put("items",items);result.put("actorId",actor);result.put("allVisible",showAll);
        result.put("workTypes",jdbc.queryForList("select work_type_code as \"workTypeCode\",work_type_name as \"workTypeName\",work_type_name_en as \"workTypeNameEn\",description,sort_order as \"sortOrder\" from framework_business_work_type where use_at='Y' order by sort_order,work_type_code"));
        String workflowScope=showAll?" WHERE p.tenant_id=?":" WHERE p.tenant_id=? AND EXISTS (SELECT 1 FROM framework_project_actor_assignment a WHERE a.project_id=t.project_id AND a.active_yn='Y' AND lower(a.user_id)=lower(?))";
        List<Map<String,Object>> workflows=jdbc.queryForList(taskProjection+workflowScope+" ORDER BY p.due_date NULLS LAST,p.project_id,t.step_order",showAll?new Object[]{tenant}:new Object[]{tenant,actor});
        workflows.forEach(this::enrichCompletionReadiness);
        applyWorkflowActorAccess(workflows,tenant,actor,showAll);
        result.put("workflows",workflows);
        result.put("summary",jdbc.queryForMap("SELECT count(*) AS total,count(*) FILTER(WHERE t.task_status='DONE') AS completed,count(*) FILTER(WHERE t.due_date=current_date AND t.task_status<>'DONE') AS today,count(*) FILTER(WHERE t.due_date<current_date AND t.task_status<>'DONE') AS overdue,count(*) FILTER(WHERE t.task_code='APPROVAL' AND t.task_status<>'DONE') AS approval FROM emission_project_task t JOIN emission_project_registry p ON p.project_id=t.project_id WHERE p.tenant_id=?"+(showAll?"":" AND lower(coalesce(t.assignee_id,''))=lower(?)"),showAll?new Object[]{tenant}:new Object[]{tenant,actor}));
        result.put("notifications",jdbc.queryForList("SELECT notification_id AS \"id\",project_id AS \"projectId\",task_id AS \"taskId\",event_type AS \"eventType\",title,message_text AS \"message\",target_url AS \"targetUrl\",read_at AS \"readAt\",created_at AS \"createdAt\" FROM emission_workflow_notification WHERE tenant_id=? AND (? OR lower(recipient_id)=lower(?)) ORDER BY (read_at IS NULL) DESC,created_at DESC LIMIT 20",tenant,showAll,actor));
        result.put("unreadNotificationCount",jdbc.queryForObject("SELECT count(*) FROM emission_workflow_notification WHERE tenant_id=? AND read_at IS NULL AND (? OR lower(recipient_id)=lower(?))",Integer.class,tenant,showAll,actor));
        return result;
    }

    private void applyWorkflowActorAccess(List<Map<String,Object>> workflows,String tenant,String account,boolean showAll) {
        if(showAll) {
            workflows.forEach(task -> task.put("actorActionable",true));
            return;
        }
        Set<String> allowed=new HashSet<>();
        jdbc.queryForList("SELECT a.project_id,a.actor_code FROM framework_project_actor_assignment a JOIN emission_project_registry p ON p.project_id=a.project_id WHERE p.tenant_id=? AND a.active_yn='Y' AND lower(a.user_id)=lower(?)",tenant,account)
                .forEach(row -> allowed.add(text(row.get("project_id"))+"|"+text(row.get("actor_code"))));
        workflows.forEach(task -> {
            boolean actorActionable=allowed.contains(text(task.get("projectId"))+"|"+text(task.get("actorCode")));
            task.put("actorActionable",actorActionable);
            task.put("actionable",Boolean.TRUE.equals(task.get("actionable"))&&actorActionable);
            if(!actorActionable&&text(task.get("blockedReason")).isBlank()) task.put("blockedReason","다른 액터에게 배정된 단계입니다.");
        });
    }

    private void enrichCompletionReadiness(Map<String,Object> task) {
        String projectId=text(task.get("projectId"));
        String code=jdbc.queryForObject("SELECT task_code FROM emission_project_task WHERE task_id=?",String.class,task.get("id"));
        boolean satisfied=switch(code) {
            case "BASIC_INFO" -> Boolean.TRUE.equals(jdbc.queryForObject("SELECT project_name<>'' AND site_name<>'' AND period_start IS NOT NULL AND period_end IS NOT NULL FROM emission_project_registry WHERE project_id=?",Boolean.class,projectId));
            case "ACTIVITY_DATA" -> count("SELECT count(*) FROM emission_activity_submission WHERE project_id=? AND submission_state IN ('SUBMITTED','IN_VERIFICATION','VERIFIED','APPROVED')",projectId)>0;
            case "CALCULATION" -> count("SELECT count(*) FROM emission_calculation_run WHERE project_id=?",projectId)>0;
            case "VERIFICATION" -> count("SELECT count(*) FROM emission_submission_review WHERE project_id=? AND review_stage='VERIFICATION' AND decision='PASSED'",projectId)>0;
            case "APPROVAL" -> count("SELECT count(*) FROM emission_submission_review WHERE project_id=? AND review_stage='APPROVAL' AND decision='APPROVED'",projectId)>0;
            case "REPORT" -> count("SELECT count(*) FROM emission_project_report WHERE project_id=? AND report_status='FINALIZED'",projectId)>0;
            case "REGULATORY_SUBMISSION" -> count("SELECT count(*) FROM emission_regulatory_submission WHERE project_id=? AND status='ACCEPTED' AND external_receipt_no IS NOT NULL",projectId)>0;
            default -> false;
        };
        task.put("completionSatisfied",satisfied);
        task.put("completionEvidence",completionEvidence(code,satisfied));
    }

    private int count(String sql,String projectId) { Integer value=jdbc.queryForObject(sql,Integer.class,projectId);return value==null?0:value; }
    private String completionEvidence(String code,boolean satisfied) {
        if(satisfied) return "완료 조건을 충족한 업무 증적이 저장되어 있습니다.";
        return switch(code) {
            case "ACTIVITY_DATA" -> "제출 상태의 활동자료가 필요합니다.";
            case "CALCULATION" -> "배출량 산정 버전 생성이 필요합니다.";
            case "VERIFICATION" -> "검증 통과 이력이 필요합니다.";
            case "APPROVAL" -> "승인 완료 이력이 필요합니다.";
            case "REPORT" -> "확정 보고서 발행이 필요합니다.";
            case "REGULATORY_SUBMISSION" -> "기관 접수번호와 최종 수리 이력이 필요합니다.";
            default -> "업무 화면에서 완료 조건과 증적을 확정해야 합니다.";
        };
    }

    @Transactional public int readWorkflowNotification(long notificationId,String tenantId,String actor,boolean override) {
        return jdbc.update("UPDATE emission_workflow_notification SET read_at=coalesce(read_at,current_timestamp) WHERE notification_id=? AND tenant_id=? AND (? OR lower(recipient_id)=lower(?))",notificationId,requiredValue(tenantId,"tenantId"),override,requiredValue(actor,"actor"));
    }

    @Transactional public int updateTask(long taskId,String tenantId,String status,String actor,boolean override) {
        if(!List.of("READY","IN_PROGRESS").contains(status)) throw new IllegalArgumentException("업무 완료는 실제 업무 처리 결과로만 변경할 수 있습니다.");
        List<Map<String,Object>> rows=jdbc.queryForList("SELECT t.project_id,t.assignee_id,t.predecessor_codes FROM emission_project_task t JOIN emission_project_registry p ON p.project_id=t.project_id WHERE t.task_id=? AND p.tenant_id=? FOR UPDATE OF t",taskId,requiredValue(tenantId,"tenantId"));
        if(rows.isEmpty()) throw new IllegalArgumentException("업무를 찾을 수 없습니다.");
        Map<String,Object> task=rows.get(0);String projectId=text(task.get("project_id"));
        if(!override&&!text(task.get("assignee_id")).equalsIgnoreCase(actor)) throw new SecurityException("TASK_ACTOR_NOT_ASSIGNED");
        Integer pending=jdbc.queryForObject("SELECT count(*) FROM emission_project_task WHERE project_id=? AND task_code=ANY(string_to_array(nullif(?,''),',')) AND task_status<>'DONE'",Integer.class,projectId,text(task.get("predecessor_codes")));
        if(pending!=null&&pending>0) throw new IllegalStateException("TASK_PREDECESSOR_INCOMPLETE");
        return jdbc.update("UPDATE emission_project_task SET task_status=?,started_at=coalesce(started_at,current_timestamp),blocked_reason=null,updated_at=current_timestamp WHERE task_id=?",status,taskId);
    }

    private void completeWorkflowTask(String projectId,String taskCode,String actor) {
        jdbc.update("UPDATE emission_project_task SET task_status='DONE',completed_at=current_timestamp,completed_by=?,blocked_reason=null,updated_at=current_timestamp WHERE project_id=? AND task_code=? AND task_status<>'DONE'",actor,projectId,taskCode);
        jdbc.update("UPDATE emission_project_task n SET task_status='READY',blocked_reason=null,updated_at=current_timestamp WHERE n.project_id=? AND n.task_status IN ('WAITING','BLOCKED') AND NOT EXISTS (SELECT 1 FROM emission_project_task p WHERE p.project_id=n.project_id AND p.task_code=ANY(string_to_array(nullif(n.predecessor_codes,''),',')) AND p.task_status<>'DONE')",projectId);
        jdbc.update("UPDATE emission_project_task n SET task_status='BLOCKED',blocked_reason='선행 업무가 완료되지 않았습니다.',updated_at=current_timestamp WHERE n.project_id=? AND n.task_status='WAITING' AND EXISTS (SELECT 1 FROM emission_project_task p WHERE p.project_id=n.project_id AND p.task_code=ANY(string_to_array(nullif(n.predecessor_codes,''),',')) AND p.task_status<>'DONE')",projectId);
        jdbc.update("UPDATE emission_project_registry p SET progress_percent=coalesce((SELECT sum(progress_weight) FROM emission_project_task t WHERE t.project_id=p.project_id AND t.task_status='DONE'),0),current_step=coalesce((SELECT task_name FROM emission_project_task t WHERE t.project_id=p.project_id AND t.task_status IN ('READY','IN_PROGRESS') ORDER BY step_order LIMIT 1),'완료'),updated_at=current_timestamp WHERE p.project_id=?",projectId);
        jdbc.update("INSERT INTO emission_project_history(project_id,event_type,event_description,actor_name) VALUES (?,'WORKFLOW_TRANSITION',?||' 업무 완료로 다음 단계가 개방되었습니다.',?)",projectId,taskCode,actor);
        jdbc.update("INSERT INTO emission_workflow_notification(tenant_id,project_id,task_id,event_type,recipient_id,actor_code,title,message_text,target_url) SELECT p.tenant_id,n.project_id,n.task_id,'HANDOFF',n.assignee_id,n.actor_code,'다음 업무가 배정되었습니다',p.project_name||' 프로젝트의 '||n.task_name||' 업무를 진행해 주세요.',n.target_url FROM emission_project_task done JOIN emission_project_task n ON n.project_id=done.project_id AND n.step_order>done.step_order JOIN emission_project_registry p ON p.project_id=n.project_id WHERE done.project_id=? AND done.task_code=? AND n.task_status='READY' AND coalesce(n.assignee_id,'')<>'' ORDER BY n.step_order LIMIT 1 ON CONFLICT DO NOTHING",projectId,taskCode);
        synchronizeProcessExecution(projectId,taskCode,actor,"");
    }

    private void synchronizeProcessExecution(String projectId,String taskCode,String user,String requestedToState){
        String tenant=jdbc.queryForObject("select tenant_id from emission_project_registry where project_id=?",String.class,projectId);
        Map<String,String> stepMap=Map.ofEntries(Map.entry("BASIC_INFO","EMISSION_PROJECT_SETUP"),Map.entry("ACTIVITY_DATA","EMISSION_PROJECT_COLLECT"),Map.entry("CALCULATION","EMISSION_PROJECT_CALCULATE"),Map.entry("VERIFICATION","EMISSION_PROJECT_VALIDATE"),Map.entry("APPROVAL","EMISSION_PROJECT_APPROVE"),Map.entry("REPORT","EMISSION_PROJECT_REPORT"),Map.entry("REGULATORY_SUBMISSION","EMISSION_PROJECT_REGULATORY_SUBMISSION"));
        Map<String,String> actorMap=Map.ofEntries(Map.entry("BASIC_INFO","COMPANY_MANAGER"),Map.entry("ACTIVITY_DATA","SITE_DATA_OWNER"),Map.entry("CALCULATION","CALCULATOR"),Map.entry("VERIFICATION","VERIFIER"),Map.entry("APPROVAL","APPROVER"),Map.entry("REPORT","COMPANY_MANAGER"),Map.entry("REGULATORY_SUBMISSION","COMPANY_MANAGER"));
        Map<String,String> commandMap=Map.ofEntries(Map.entry("BASIC_INFO","CONFIRM_SCOPE"),Map.entry("ACTIVITY_DATA","SUBMIT_ACTIVITY_DATA"),Map.entry("CALCULATION","CALCULATE"),Map.entry("VERIFICATION","VALIDATE"),Map.entry("APPROVAL","APPROVE"),Map.entry("REPORT","PUBLISH_REPORT"),Map.entry("REGULATORY_SUBMISSION","ACCEPT_SUBMISSION"));
        String step=stepMap.get(taskCode);if(step==null)return;
        Map<String,Object> found=processGovernanceService.findProcessExecution(tenant,projectId,"EMISSION_PROJECT");
        if(!Boolean.TRUE.equals(found.get("found"))){
            Map<String,Object> started=processGovernanceService.startProcessExecution(Map.of("tenantId",tenant,"projectId",projectId,"processCode","EMISSION_PROJECT","actorCode","COMPANY_MANAGER"),user);
            Object id=started.get("executionId");if(id==null&&started.get("execution") instanceof Map<?,?> execution)id=execution.get("executionId");
            found=new LinkedHashMap<>();found.put("executionId",id);
            List<Map<String,Object>> completed=jdbc.queryForList("select task_code from emission_project_task where project_id=? and task_status='DONE' order by step_order",projectId);
            for(Map<String,Object> completedTask:completed)synchronizeProcessExecution(projectId,String.valueOf(completedTask.get("task_code")),user,"");
            return;
        }
        if("ACTIVITY_DATA".equals(taskCode)&&"EMISSION_PROJECT_CORRECT".equals(String.valueOf(found.get("currentStepCode")))){
            step="EMISSION_PROJECT_CORRECT";
            actorMap=new LinkedHashMap<>(actorMap);actorMap.put("ACTIVITY_DATA","SITE_DATA_OWNER");
            commandMap=new LinkedHashMap<>(commandMap);commandMap.put("ACTIVITY_DATA","RESUBMIT");
        }
        if(!step.equals(String.valueOf(found.get("currentStepCode")))&&found.containsKey("currentStepCode"))return;
        Integer sequence=jdbc.queryForObject("select count(*)+1 from framework_process_execution_event where execution_id=? and step_code=?",Integer.class,UUID.fromString(String.valueOf(found.get("executionId"))),step);
        Map<String,Object> body=new LinkedHashMap<>();body.put("tenantId",tenant);body.put("projectId",projectId);body.put("processCode","EMISSION_PROJECT");body.put("stepCode",step);body.put("actorCode",actorMap.get(taskCode));body.put("commandCode",commandMap.get(taskCode));body.put("idempotencyKey","TASK-"+projectId+"-"+taskCode+"-"+sequence);body.put("requestJson","{\"source\":\"emission-project-service\"}");
        if(!requestedToState.isBlank())body.put("requestedToState",requestedToState);
        processGovernanceService.executeProcessCommand(UUID.fromString(String.valueOf(found.get("executionId"))),body,user);
    }

    public Map<String,Object> submissions(String projectId,String tenantId) {
        detail(projectId);
        String tenant=requiredValue(tenantId,"tenantId");
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("items",jdbc.queryForList("SELECT submission_id AS \"id\",version_no AS \"version\",submission_state AS \"state\",idempotency_key AS \"idempotencyKey\",deadline_date AS \"deadlineDate\",submitted_actor AS \"submittedActor\",submitted_at AS \"submittedAt\",created_at AS \"createdAt\" FROM emission_activity_submission WHERE project_id=? AND tenant_id=? ORDER BY version_no DESC",projectId,tenant));
        result.put("events",jdbc.queryForList("SELECT e.event_id AS \"id\",e.submission_id AS \"submissionId\",e.event_type AS \"type\",e.event_actor AS \"actor\",e.event_time AS \"at\",e.previous_state AS \"previousState\",e.new_state AS \"newState\",e.event_note AS \"note\" FROM emission_activity_submission_event e JOIN emission_activity_submission s ON s.submission_id=e.submission_id WHERE s.project_id=? AND s.tenant_id=? ORDER BY e.event_time DESC LIMIT 100",projectId,tenant));
        return result;
    }

    public Map<String,Object> latestQuality(String projectId,String tenantId) {
        detail(projectId);
        String tenant=requiredValue(tenantId,"tenantId");
        List<Map<String,Object>> runs=jdbc.queryForList("SELECT run_id AS \"runId\",total_count AS \"totalCount\",blocking_count AS \"blockingCount\",warning_count AS \"warningCount\",quality_score AS \"score\",submit_ready AS \"submitReady\",executed_actor AS \"executedActor\",executed_at AS \"executedAt\" FROM emission_activity_quality_run WHERE tenant_id=? AND project_id=? ORDER BY executed_at DESC,run_id DESC LIMIT 1",tenant,projectId);
        if(runs.isEmpty()) return Map.of("checked",false,"issues",List.of());
        Map<String,Object> result=new LinkedHashMap<>(runs.get(0));
        result.put("checked",true);
        result.put("issues",qualityIssues(((Number)runs.get(0).get("runId")).longValue()));
        return result;
    }

    @Transactional
    public Map<String,Object> runQuality(String projectId,String tenantId,String actor,boolean override) {
        Map<String,Object> project=detail(projectId);
        String tenant=requiredValue(tenantId,"tenantId"),user=requiredValue(actor,"actor");
        requireProjectActor(projectId,tenant,user,"SITE_DATA_OWNER",override);
        List<Map<String,Object>> activities=jdbc.queryForList("SELECT a.activity_id AS id,a.activity_name AS name,a.category,a.activity_period AS period,a.quantity,a.unit,a.evidence_note AS note,a.factor_id AS factorId,f.unit AS factorUnit FROM emission_activity_data a LEFT JOIN emission_factor_reference f ON f.factor_id=a.factor_id WHERE a.project_id=? ORDER BY a.activity_id",projectId);
        List<QualityIssue> issues=new ArrayList<>();
        Set<String> allowedUnits=Set.of("L","Nm3","kWh","ton","kg","km","m3","GJ","MJ");
        String start=text(project.get("periodStart")),end=text(project.get("periodEnd"));
        for(Map<String,Object> row:activities) {
            long id=((Number)row.get("id")).longValue();
            String name=text(row.get("name")),category=text(row.get("category")),period=text(row.get("period")),unit=text(row.get("unit")),note=text(row.get("note"));
            if(name.isBlank()) issues.add(issue(id,"REQUIRED_NAME","BLOCKING","name","활동자료명이 없습니다.","원본 행에서 활동자료명을 입력하세요."));
            if(category.isBlank()) issues.add(issue(id,"REQUIRED_CATEGORY","BLOCKING","category","구분이 없습니다.","원본 행에서 활동자료 구분을 선택하세요."));
            if(row.get("quantity")==null) issues.add(issue(id,"REQUIRED_QUANTITY","BLOCKING","quantity","활동량이 없습니다.","0 이상의 활동량을 입력하세요."));
            else if(((Number)row.get("quantity")).doubleValue()==0) issues.add(issue(id,"ZERO_QUANTITY","WARNING","quantity","활동량이 0입니다.","실제 활동이 없었는지 확인하고 근거를 비고에 남기세요."));
            if(unit.isBlank()||!allowedUnits.contains(unit)) issues.add(issue(id,"INVALID_UNIT","BLOCKING","unit","지원하지 않는 단위입니다: "+(unit.isBlank()?"(없음)":unit),"L, Nm3, kWh, ton, kg, km, m3, GJ, MJ 중 올바른 단위를 선택하세요."));
            if(row.get("factorId")==null) issues.add(issue(id,"UNMAPPED_FACTOR","WARNING","factorId","배출계수가 아직 매핑되지 않았습니다.","제출 후 산정 담당자가 배출계수를 매핑합니다."));
            else if(row.get("factorUnit")!=null&&!unit.equals(text(row.get("factorUnit")))) issues.add(issue(id,"FACTOR_UNIT_MISMATCH","WARNING","factorId","활동자료 단위와 배출계수 단위가 다릅니다.","산정 담당자가 단위를 확인하고 적합한 배출계수를 선택합니다."));
            if(note.isBlank()) issues.add(issue(id,"MISSING_EVIDENCE","BLOCKING","note","증빙 또는 산정 근거가 없습니다.","증빙자료 설명이나 원본 문서 식별 정보를 입력하세요."));
            if(!period.matches("\\d{4}-(0[1-9]|1[0-2])")) issues.add(issue(id,"INVALID_PERIOD","BLOCKING","period","기간 형식이 올바르지 않습니다.","YYYY-MM 형식의 기간을 입력하세요."));
            else if((!start.isBlank()&&period.compareTo(start.substring(0,Math.min(7,start.length())))<0)||(!end.isBlank()&&period.compareTo(end.substring(0,Math.min(7,end.length())))>0)) issues.add(issue(id,"PERIOD_OUT_OF_RANGE","BLOCKING","period","프로젝트 산정기간을 벗어났습니다.","프로젝트 산정기간 안의 월로 정정하세요."));
        }
        List<Map<String,Object>> duplicates=jdbc.queryForList("SELECT min(activity_id) AS id,count(*) AS duplicate_count FROM emission_activity_data WHERE project_id=? GROUP BY lower(trim(activity_name)),category,activity_period,unit HAVING count(*)>1",projectId);
        for(Map<String,Object> duplicate:duplicates) issues.add(issue(((Number)duplicate.get("id")).longValue(),"POSSIBLE_DUPLICATE","BLOCKING","name","동일한 명칭·구분·기간·단위의 자료가 "+duplicate.get("duplicate_count")+"건 있습니다.","원본 행을 비교하여 중복이면 삭제하고, 별도 자료라면 명칭 또는 구분을 명확히 수정하세요."));
        if(activities.isEmpty()) issues.add(issue(null,"NO_ACTIVITY_DATA","BLOCKING",null,"검사할 활동자료가 없습니다.","활동자료를 직접 입력하거나 엑셀로 업로드하세요."));
        int blocking=(int)issues.stream().filter(i->"BLOCKING".equals(i.severity())).count(),warning=issues.size()-blocking;
        int score=Math.max(0,100-(blocking*15)-(warning*5)); boolean ready=blocking==0&&!activities.isEmpty();
        Long runId=jdbc.queryForObject("INSERT INTO emission_activity_quality_run(tenant_id,project_id,executed_actor,total_count,blocking_count,warning_count,quality_score,submit_ready) VALUES (?,?,?,?,?,?,?,?) RETURNING run_id",Long.class,tenant,projectId,user,activities.size(),blocking,warning,score,ready);
        for(QualityIssue i:issues) jdbc.update("INSERT INTO emission_activity_quality_issue(run_id,activity_id,rule_code,severity,field_name,issue_message,remediation_message) VALUES (?,?,?,?,?,?,?)",runId,i.activityId(),i.ruleCode(),i.severity(),i.fieldName(),i.message(),i.remediation());
        Map<String,Object> result=new LinkedHashMap<>(); result.put("checked",true);result.put("runId",runId);result.put("totalCount",activities.size());result.put("blockingCount",blocking);result.put("warningCount",warning);result.put("score",score);result.put("submitReady",ready);result.put("executedActor",user);result.put("executedAt",java.time.LocalDateTime.now());result.put("issues",qualityIssues(runId==null?0:runId));return result;
    }

    private List<Map<String,Object>> qualityIssues(long runId) { return jdbc.queryForList("SELECT issue_id AS \"issueId\",activity_id AS \"activityId\",rule_code AS \"ruleCode\",severity,field_name AS \"fieldName\",issue_message AS message,remediation_message AS remediation FROM emission_activity_quality_issue WHERE run_id=? ORDER BY CASE severity WHEN 'BLOCKING' THEN 0 ELSE 1 END,activity_id NULLS FIRST,issue_id",runId); }
    private QualityIssue issue(Long activityId,String ruleCode,String severity,String fieldName,String message,String remediation) { return new QualityIssue(activityId,ruleCode,severity,fieldName,message,remediation); }
    private String text(Object value) { return value==null?"":String.valueOf(value).trim(); }
    private record QualityIssue(Long activityId,String ruleCode,String severity,String fieldName,String message,String remediation) {}

    @Transactional
    public Map<String,Object> saveSubmission(String projectId,String tenantId,String actor,boolean override,Map<String,Object> body) {
        Map<String,Object> project=detail(projectId);
        String tenant=requiredValue(tenantId,"tenantId"),user=requiredValue(actor,"actor"),key=required(body,"idempotencyKey");
        requireProjectActor(projectId,tenant,user,"SITE_DATA_OWNER",override);
        List<Map<String,Object>> existing=jdbc.queryForList("SELECT submission_id AS id,submission_state AS state,version_no AS version FROM emission_activity_submission WHERE project_id=? AND tenant_id=? AND idempotency_key=?",projectId,tenant,key);
        if(!existing.isEmpty()) return new LinkedHashMap<>(existing.get(0));
        LocalDate deadline=project.get("dueDate")==null?null:LocalDate.parse(String.valueOf(project.get("dueDate")));
        Integer version=jdbc.queryForObject("SELECT coalesce(max(version_no),0)+1 FROM emission_activity_submission WHERE project_id=? AND tenant_id=?",Integer.class,projectId,tenant);
        Long id=jdbc.queryForObject("INSERT INTO emission_activity_submission(project_id,tenant_id,site_name,version_no,idempotency_key,deadline_date) VALUES (?,?,?,?,?,?) RETURNING submission_id",Long.class,projectId,tenant,String.valueOf(project.get("site")),version,key,deadline);
        jdbc.update("INSERT INTO emission_activity_submission_event(submission_id,event_type,event_actor,previous_state,new_state,event_note) VALUES (?,'CREATED',?,null,'DRAFT','활동자료 제출 초안 생성')",id,user);
        return Map.of("id",id==null?0:id,"state","DRAFT","version",version==null?1:version,"created",true);
    }

    @Transactional
    public Map<String,Object> submitActivities(String projectId,long submissionId,String tenantId,String actor,boolean override,Map<String,Object> body) {
        String tenant=requiredValue(tenantId,"tenantId"),user=requiredValue(actor,"actor");
        requireProjectActor(projectId,tenant,user,"SITE_DATA_OWNER",override);
        List<Map<String,Object>> rows=jdbc.queryForList("SELECT submission_state AS state,deadline_date AS deadline FROM emission_activity_submission WHERE submission_id=? AND project_id=? AND tenant_id=? FOR UPDATE",submissionId,projectId,tenant);
        if(rows.isEmpty()) throw new SecurityException("SUBMISSION_SCOPE_DENIED");
        String state=String.valueOf(rows.get(0).get("state"));
        if("SUBMITTED".equals(state)) return Map.of("id",submissionId,"state",state,"duplicate",true);
        Object deadlineValue=rows.get(0).get("deadline");
        if(deadlineValue!=null&&LocalDate.parse(String.valueOf(deadlineValue)).isBefore(LocalDate.now())&&!Boolean.TRUE.equals(body.get("deadlineExtended"))) throw new IllegalStateException("SUBMISSION_DEADLINE_EXPIRED");
        Object raw=body.get("activityIds");
        if(!(raw instanceof List<?> ids)||ids.isEmpty()) throw new IllegalArgumentException("ACTIVITY_REQUIRED_FIELDS_MISSING");
        Map<String,Object> quality=runQuality(projectId,tenant,user,override);
        if(!Boolean.TRUE.equals(quality.get("submitReady"))) throw new IllegalStateException("QUALITY_CHECK_BLOCKED:"+quality.get("blockingCount"));
        for(Object item:ids) {
            long activityId=Long.parseLong(String.valueOf(item));
            Integer count=jdbc.queryForObject("SELECT count(*) FROM emission_activity_data WHERE activity_id=? AND project_id=? AND quantity>=0 AND unit<>''",Integer.class,activityId,projectId);
            if(count==null||count==0) throw new IllegalArgumentException("ACTIVITY_REQUIRED_FIELDS_MISSING");
            jdbc.update("INSERT INTO emission_activity_submission_item(submission_id,activity_id,activity_name,category,activity_period,quantity,unit,evidence_note,source_hash) SELECT ?,activity_id,activity_name,category,activity_period,quantity,unit,evidence_note,md5(concat_ws('|',activity_name,category,activity_period,quantity,unit,evidence_note)) FROM emission_activity_data WHERE activity_id=? AND project_id=? ON CONFLICT(submission_id,activity_id) DO NOTHING",submissionId,activityId,projectId);
            jdbc.update("INSERT INTO emission_activity_submission_evidence(submission_id,activity_id,evidence_type,evidence_name,uploaded_actor) SELECT ?,activity_id,'ACTIVITY_DATA',left(evidence_note,200),? FROM emission_activity_data WHERE activity_id=? AND project_id=? ON CONFLICT(submission_id,activity_id,evidence_type) DO NOTHING",submissionId,user,activityId,projectId);
        }
        jdbc.update("UPDATE emission_activity_submission SET submission_state='SUBMITTED',submitted_actor=?,submitted_at=current_timestamp,quality_run_id=?,submitted_item_count=(SELECT count(*) FROM emission_activity_submission_item WHERE submission_id=?),snapshot_hash=(SELECT md5(coalesce(string_agg(source_hash,'|' ORDER BY activity_id),'')) FROM emission_activity_submission_item WHERE submission_id=?),updated_at=current_timestamp WHERE submission_id=?",user,quality.get("runId"),submissionId,submissionId,submissionId);
        jdbc.update("INSERT INTO emission_activity_submission_event(submission_id,event_type,event_actor,previous_state,new_state,event_note) VALUES (?,'SUBMITTED',?,'DRAFT','SUBMITTED','활동자료 제출 완료')",submissionId,user);
        jdbc.update("UPDATE emission_project_registry SET current_step='활동자료 제출',progress_percent=greatest(progress_percent,30),updated_at=current_timestamp WHERE project_id=?",projectId);
        Object requestedId=body.get("requestId");
        List<Map<String,Object>> requests=requestedId==null
            ? jdbc.queryForList("SELECT request_id AS id,request_status AS status FROM emission_activity_request WHERE project_id=? AND tenant_id=? AND lower(assignee_id)=lower(?) AND request_status IN ('REQUESTED','IN_PROGRESS','CORRECTION_REQUIRED') ORDER BY created_at DESC",projectId,tenant,user)
            : jdbc.queryForList("SELECT request_id AS id,request_status AS status FROM emission_activity_request WHERE request_id=? AND project_id=? AND tenant_id=? AND lower(assignee_id)=lower(?) AND request_status IN ('REQUESTED','IN_PROGRESS','CORRECTION_REQUIRED')",Long.parseLong(String.valueOf(requestedId)),projectId,tenant,user);
        for(Map<String,Object> request:requests) {
            long requestId=((Number)request.get("id")).longValue(); String previous=text(request.get("status"));
            jdbc.update("UPDATE emission_activity_request SET request_status='SUBMITTED',last_submission_id=?,submitted_by=?,submitted_at=current_timestamp,updated_at=current_timestamp WHERE request_id=?",submissionId,user,requestId);
            jdbc.update("INSERT INTO emission_activity_request_event(request_id,event_code,previous_status,new_status,actor_id,event_note,submission_id) VALUES (?,'SUBMITTED',?,'SUBMITTED',?,'활동자료 품질검사 통과 및 제출',?)",requestId,previous,user,submissionId);
        }
        jdbc.update("UPDATE emission_project_task SET task_status='IN_PROGRESS',started_at=coalesce(started_at,current_timestamp),updated_at=current_timestamp WHERE project_id=? AND task_code='ACTIVITY_DATA' AND task_status<>'DONE'",projectId);
        jdbc.update("INSERT INTO emission_workflow_notification(tenant_id,project_id,task_id,event_type,recipient_id,actor_code,title,message_text,target_url) SELECT p.tenant_id,t.project_id,t.task_id,'DATA_SUBMITTED',r.requester_id,'COMPANY_MANAGER','활동자료가 제출되었습니다',r.request_title||' 요청의 제출 자료를 검토하고 접수 또는 보완 요청을 결정해 주세요.','/emission/data-request?projectId='||r.project_id FROM emission_activity_request r JOIN emission_project_registry p ON p.project_id=r.project_id JOIN emission_project_task t ON t.project_id=r.project_id AND t.task_code='ACTIVITY_DATA' WHERE r.project_id=? AND r.tenant_id=? AND r.last_submission_id=?",projectId,tenant,submissionId);
        return Map.of("id",submissionId,"state","SUBMITTED","duplicate",false,"requestCount",requests.size(),"nextAction","MANAGER_ACCEPTANCE");
    }

    public Map<String,Object> activityRequests(String projectId,String tenantId,String actor,boolean override) {
        String tenant=requiredValue(tenantId,"tenantId"),user=requiredValue(actor,"actor");
        assertTenantAccess(projectId,tenant);
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("project",detail(projectId));
        result.put("items",jdbc.queryForList("SELECT request_id AS \"id\",request_title AS \"title\",request_detail AS \"detail\",requested_items AS \"requestedItems\",requester_id AS \"requester\",assignee_id AS \"assignee\",due_date AS \"dueDate\",request_status AS \"status\",last_submission_id AS \"submissionId\",submitted_by AS \"submittedBy\",submitted_at AS \"submittedAt\",correction_reason AS \"correctionReason\",correction_due_date AS \"correctionDueDate\",correction_count AS \"correctionCount\",accepted_by AS \"acceptedBy\",accepted_at AS \"acceptedAt\",created_at AS \"createdAt\" FROM emission_activity_request WHERE tenant_id=? AND project_id=? AND (? OR lower(requester_id)=lower(?) OR lower(assignee_id)=lower(?)) ORDER BY created_at DESC",tenant,projectId,override,user,user));
        result.put("dataOwners",jdbc.queryForList("SELECT user_id AS \"id\" FROM framework_project_actor_assignment WHERE project_id=? AND actor_code='SITE_DATA_OWNER' AND active_yn='Y' ORDER BY user_id",projectId));
        result.put("actorRoles",jdbc.queryForList("SELECT actor_code FROM framework_project_actor_assignment WHERE project_id=? AND lower(user_id)=lower(?) AND active_yn='Y' ORDER BY actor_code",projectId,user).stream().map(row->text(row.get("actor_code"))).toList());
        result.put("events",jdbc.queryForList("SELECT e.event_id AS \"id\",e.request_id AS \"requestId\",e.event_code AS code,e.previous_status AS \"previousStatus\",e.new_status AS \"newStatus\",e.actor_id AS actor,e.event_note AS note,e.submission_id AS \"submissionId\",e.created_at AS \"createdAt\" FROM emission_activity_request_event e JOIN emission_activity_request r ON r.request_id=e.request_id WHERE r.tenant_id=? AND r.project_id=? AND (? OR lower(r.requester_id)=lower(?) OR lower(r.assignee_id)=lower(?)) ORDER BY e.created_at DESC,e.event_id DESC",tenant,projectId,override,user,user));
        return result;
    }

    @Transactional
    public Map<String,Object> createActivityRequest(String projectId,String tenantId,String actor,boolean override,Map<String,Object> body) {
        String tenant=requiredValue(tenantId,"tenantId"),user=requiredValue(actor,"actor");
        requireProjectActor(projectId,tenant,user,"COMPANY_MANAGER",override);
        String title=required(body,"title"),requestDetail=required(body,"detail"),items=required(body,"requestedItems"),assignee=required(body,"assignee");
        LocalDate due=LocalDate.parse(required(body,"dueDate"));
        Integer assigned=jdbc.queryForObject("SELECT count(*) FROM framework_project_actor_assignment WHERE project_id=? AND actor_code='SITE_DATA_OWNER' AND lower(user_id)=lower(?) AND active_yn='Y'",Integer.class,projectId,assignee);
        if(!override&&(assigned==null||assigned==0)) throw new IllegalArgumentException("PROJECT_DATA_OWNER_REQUIRED");
        Long id=jdbc.queryForObject("INSERT INTO emission_activity_request(tenant_id,project_id,request_title,request_detail,requested_items,requester_id,assignee_id,due_date) VALUES (?,?,?,?,?,?,?,?) RETURNING request_id",Long.class,tenant,projectId,title,requestDetail,items,user,assignee,due);
        jdbc.update("UPDATE emission_project_task SET assignee_id=?,due_date=?,task_status='READY',updated_at=current_timestamp WHERE project_id=? AND task_code='ACTIVITY_DATA' AND task_status<>'DONE'",assignee,due,projectId);
        jdbc.update("INSERT INTO emission_project_history(project_id,event_type,event_description,actor_name) VALUES (?,'DATA_REQUESTED',?,?)",projectId,title,user);
        jdbc.update("INSERT INTO emission_activity_request_event(request_id,event_code,new_status,actor_id,event_note) VALUES (?,'REQUESTED','REQUESTED',?,?)",id,user,requestDetail);
        jdbc.update("INSERT INTO emission_workflow_notification(tenant_id,project_id,task_id,event_type,recipient_id,actor_code,title,message_text,target_url) SELECT p.tenant_id,t.project_id,t.task_id,'DATA_REQUEST',?,'SITE_DATA_OWNER','활동자료 제출 요청이 도착했습니다',?||' (마감: '||?||')','/emission/data-request?projectId='||p.project_id FROM emission_project_registry p JOIN emission_project_task t ON t.project_id=p.project_id AND t.task_code='ACTIVITY_DATA' WHERE p.project_id=?",assignee,title,due,projectId);
        return Map.of("id",id==null?0:id,"status","REQUESTED");
    }

    @Transactional
    public Map<String,Object> startActivityRequest(String projectId,long requestId,String tenantId,String actor,boolean override) {
        String tenant=requiredValue(tenantId,"tenantId"),user=requiredValue(actor,"actor");
        requireProjectActor(projectId,tenant,user,"SITE_DATA_OWNER",override);
        List<Map<String,Object>> rows=jdbc.queryForList("SELECT request_status AS status FROM emission_activity_request WHERE request_id=? AND project_id=? AND tenant_id=? AND (? OR lower(assignee_id)=lower(?)) AND request_status IN ('REQUESTED','CORRECTION_REQUIRED') FOR UPDATE",requestId,projectId,tenant,override,user);
        if(rows.isEmpty()) throw new IllegalStateException("ACTIVITY_REQUEST_NOT_STARTABLE");
        String previous=text(rows.get(0).get("status"));
        int changed=jdbc.update("UPDATE emission_activity_request SET request_status='IN_PROGRESS',updated_at=current_timestamp WHERE request_id=?",requestId);
        if(changed==0) throw new IllegalStateException("ACTIVITY_REQUEST_NOT_STARTABLE");
        jdbc.update("UPDATE emission_project_task SET task_status='IN_PROGRESS',started_at=coalesce(started_at,current_timestamp),updated_at=current_timestamp WHERE project_id=? AND task_code='ACTIVITY_DATA'",projectId);
        jdbc.update("INSERT INTO emission_activity_request_event(request_id,event_code,previous_status,new_status,actor_id,event_note) VALUES (?,'STARTED',?,'IN_PROGRESS',?,'활동자료 수집 업무 시작')",requestId,previous,user);
        return Map.of("id",requestId,"status","IN_PROGRESS");
    }

    @Transactional
    public Map<String,Object> decideActivityRequest(String projectId,long requestId,String tenantId,String actor,boolean override,Map<String,Object> body) {
        String tenant=requiredValue(tenantId,"tenantId"),user=requiredValue(actor,"actor"),decision=required(body,"decision").toUpperCase();
        requireProjectActor(projectId,tenant,user,"COMPANY_MANAGER",override);
        List<Map<String,Object>> rows=jdbc.queryForList("SELECT request_status AS status,request_title AS title,assignee_id AS assignee,last_submission_id AS submission FROM emission_activity_request WHERE request_id=? AND project_id=? AND tenant_id=? FOR UPDATE",requestId,projectId,tenant);
        if(rows.isEmpty()) throw new IllegalArgumentException("ACTIVITY_REQUEST_NOT_FOUND");
        Map<String,Object> row=rows.get(0); if(!"SUBMITTED".equals(text(row.get("status")))) throw new IllegalStateException("ACTIVITY_REQUEST_DECISION_REQUIRES_SUBMITTED");
        if("REQUEST_CORRECTION".equals(decision)) {
            String reason=required(body,"reason"); LocalDate due=LocalDate.parse(required(body,"dueDate"));
            if(due.isBefore(LocalDate.now())) throw new IllegalArgumentException("CORRECTION_DUE_DATE_PASSED");
            jdbc.update("UPDATE emission_activity_request SET request_status='CORRECTION_REQUIRED',correction_reason=?,correction_due_date=?,correction_count=correction_count+1,updated_at=current_timestamp WHERE request_id=?",reason,due,requestId);
            jdbc.update("UPDATE emission_project_task SET task_status='IN_PROGRESS',assignee_id=?,due_date=?,updated_at=current_timestamp WHERE project_id=? AND task_code='ACTIVITY_DATA'",row.get("assignee"),due,projectId);
            jdbc.update("INSERT INTO emission_activity_request_event(request_id,event_code,previous_status,new_status,actor_id,event_note,submission_id) VALUES (?,'CORRECTION_REQUESTED','SUBMITTED','CORRECTION_REQUIRED',?,?,?)",requestId,user,reason,row.get("submission"));
            jdbc.update("INSERT INTO emission_workflow_notification(tenant_id,project_id,task_id,event_type,recipient_id,actor_code,title,message_text,target_url) SELECT p.tenant_id,t.project_id,t.task_id,'DATA_CORRECTION',?,'SITE_DATA_OWNER','활동자료 보완이 요청되었습니다',?,'/emission/data-request?projectId='||p.project_id FROM emission_project_registry p JOIN emission_project_task t ON t.project_id=p.project_id AND t.task_code='ACTIVITY_DATA' WHERE p.project_id=?",row.get("assignee"),reason,projectId);
            return Map.of("id",requestId,"status","CORRECTION_REQUIRED","calculationOpened",false);
        }
        if(!"ACCEPT".equals(decision)) throw new IllegalArgumentException("ACTIVITY_REQUEST_DECISION_INVALID");
        jdbc.update("UPDATE emission_activity_request SET request_status='ACCEPTED',accepted_by=?,accepted_at=current_timestamp,correction_reason=null,correction_due_date=null,updated_at=current_timestamp WHERE request_id=?",user,requestId);
        jdbc.update("INSERT INTO emission_activity_request_event(request_id,event_code,previous_status,new_status,actor_id,event_note,submission_id) VALUES (?,'ACCEPTED','SUBMITTED','ACCEPTED',?,'관리자 활동자료 접수 완료',?)",requestId,user,row.get("submission"));
        Integer remaining=jdbc.queryForObject("SELECT count(*) FROM emission_activity_request WHERE project_id=? AND tenant_id=? AND request_status IN ('REQUESTED','IN_PROGRESS','SUBMITTED','CORRECTION_REQUIRED')",Integer.class,projectId,tenant);
        boolean opened=remaining!=null&&remaining==0;
        if(opened) completeWorkflowTask(projectId,"ACTIVITY_DATA",user);
        return Map.of("id",requestId,"status","ACCEPTED","calculationOpened",opened,"remainingRequests",remaining==null?0:remaining);
    }

    public Map<String,Object> reviewWorkflow(String projectId,String tenantId) {
        String tenant=requiredValue(tenantId,"tenantId");
        assertTenantAccess(projectId,tenant);
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("project",detail(projectId));
        result.put("submissions",jdbc.queryForList("SELECT submission_id AS \"id\",version_no AS \"version\",submission_state AS \"state\",submitted_actor AS \"submittedActor\",submitted_at AS \"submittedAt\" FROM emission_activity_submission WHERE tenant_id=? AND project_id=? ORDER BY version_no DESC",tenant,projectId));
        result.put("reviews",jdbc.queryForList("SELECT review_id AS \"id\",submission_id AS \"submissionId\",review_stage AS \"stage\",decision,reviewer_id AS \"reviewer\",comment_text AS comment,issue_count AS \"issueCount\",calculation_id AS \"calculationId\",created_at AS \"createdAt\" FROM emission_submission_review WHERE tenant_id=? AND project_id=? ORDER BY created_at DESC,review_id DESC",tenant,projectId));
        result.put("actors",jdbc.queryForList("SELECT actor_code AS \"actorCode\",user_id AS \"userId\" FROM framework_project_actor_assignment WHERE project_id=? AND active_yn='Y' ORDER BY actor_code,user_id",projectId));
        return result;
    }

    public Map<String,Object> reportWorkflow(String projectId,String tenantId) {
        String tenant=requiredValue(tenantId,"tenantId"); assertTenantAccess(projectId,tenant);
        Map<String,Object> result=new LinkedHashMap<>(); result.put("project",detail(projectId));
        List<Map<String,Object>> approved=jdbc.queryForList("SELECT s.submission_id AS \"submissionId\",s.version_no AS \"submissionVersion\",s.submission_state AS \"submissionState\",c.calculation_id AS \"calculationId\",c.version_no AS \"calculationVersion\",c.total_emission AS \"totalEmission\",c.locked_at AS \"lockedAt\",c.locked_by AS \"lockedBy\" FROM emission_activity_submission s JOIN emission_submission_review r ON r.submission_id=s.submission_id AND r.review_stage='APPROVAL' AND r.decision='APPROVED' JOIN emission_calculation_run c ON c.calculation_id=r.calculation_id WHERE s.tenant_id=? AND s.project_id=? ORDER BY r.created_at DESC LIMIT 1",tenant,projectId);
        result.put("approved",approved.isEmpty()?null:approved.get(0));
        result.put("reports",jdbc.queryForList("SELECT report_id AS \"id\",version_no AS \"version\",report_title AS \"title\",report_language AS language,report_status AS status,summary_text AS summary,created_by AS \"createdBy\",created_at AS \"createdAt\",finalized_by AS \"finalizedBy\",finalized_at AS \"finalizedAt\",certificate_id AS \"certificateId\",integrity_hash AS \"integrityHash\",issued_by AS \"issuedBy\",issued_at AS \"issuedAt\",download_count AS \"downloadCount\" FROM emission_project_report WHERE tenant_id=? AND project_id=? ORDER BY version_no DESC",tenant,projectId));
        return result;
    }

    public Map<String,Object> regulatorySubmissionWorkflow(String projectId,String tenantId) {
        String tenant=requiredValue(tenantId,"tenantId"); assertTenantAccess(projectId,tenant);
        Map<String,Object> result=new LinkedHashMap<>(); result.put("project",detail(projectId));
        result.put("eligibleReports",jdbc.queryForList("SELECT report_id AS \"id\",version_no AS version,report_title AS title,report_language AS language,report_status AS status,certificate_id AS \"certificateId\",integrity_hash AS \"integrityHash\",finalized_at AS \"finalizedAt\" FROM emission_project_report WHERE tenant_id=? AND project_id=? AND report_status='FINALIZED' ORDER BY version_no DESC",tenant,projectId));
        result.put("items",jdbc.queryForList("SELECT regulatory_submission_id AS \"id\",report_id AS \"reportId\",submission_version AS version,authority_code AS \"authorityCode\",authority_name AS \"authorityName\",reporting_program AS \"reportingProgram\",reporting_period AS \"reportingPeriod\",legal_basis AS \"legalBasis\",submission_channel AS channel,submission_deadline AS deadline,status,package_hash AS \"packageHash\",external_receipt_no AS \"receiptNo\",correction_reason AS \"correctionReason\",correction_due_date AS \"correctionDueDate\",submitted_by AS \"submittedBy\",submitted_at AS \"submittedAt\",received_at AS \"receivedAt\",accepted_at AS \"acceptedAt\",note_text AS note,created_by AS \"createdBy\",created_at AS \"createdAt\",updated_at AS \"updatedAt\" FROM emission_regulatory_submission WHERE tenant_id=? AND project_id=? ORDER BY submission_version DESC",tenant,projectId));
        result.put("events",jdbc.queryForList("SELECT e.event_id AS \"id\",e.regulatory_submission_id AS \"submissionId\",e.event_code AS code,e.previous_status AS \"previousStatus\",e.new_status AS \"newStatus\",e.actor_id AS actor,e.event_note AS note,e.created_at AS \"createdAt\" FROM emission_regulatory_submission_event e JOIN emission_regulatory_submission s ON s.regulatory_submission_id=e.regulatory_submission_id WHERE s.tenant_id=? AND s.project_id=? ORDER BY e.event_id DESC",tenant,projectId));
        return result;
    }

    @Transactional public Map<String,Object> createRegulatorySubmission(String projectId,String tenantId,String actor,boolean override,Map<String,Object> body) {
        String tenant=requiredValue(tenantId,"tenantId"),user=requiredValue(actor,"actor"); requireProjectActor(projectId,tenant,user,"COMPANY_MANAGER",override);
        long reportId=Long.parseLong(required(body,"reportId")); String requestId=required(body,"clientRequestId");
        if(requestId.length()>100)throw new IllegalArgumentException("CLIENT_REQUEST_ID_TOO_LONG");
        jdbc.query("SELECT pg_advisory_xact_lock(hashtext(?))",rs->{},tenant+":"+projectId+":"+requestId);
        List<Map<String,Object>> existing=jdbc.queryForList("SELECT regulatory_submission_id AS id,submission_version AS version,status,package_hash AS \"packageHash\" FROM emission_regulatory_submission WHERE tenant_id=? AND project_id=? AND client_request_id=?",tenant,projectId,requestId);
        if(!existing.isEmpty())return existing.get(0);
        List<Map<String,Object>> reports=jdbc.queryForList("SELECT report_id,version_no,report_title,coalesce(integrity_hash,'') AS integrity_hash FROM emission_project_report WHERE report_id=? AND tenant_id=? AND project_id=? AND report_status='FINALIZED'",reportId,tenant,projectId);
        if(reports.isEmpty())throw new IllegalStateException("REGULATORY_SUBMISSION_REQUIRES_FINALIZED_REPORT");
        String authorityCode=required(body,"authorityCode"),authorityName=required(body,"authorityName"),program=required(body,"reportingProgram"),period=required(body,"reportingPeriod"),legalBasis=required(body,"legalBasis"),channel=required(body,"channel").toUpperCase(),deadline=required(body,"deadline"),note=text(body.get("note"));
        if(!List.of("SYSTEM","PORTAL","EMAIL","OFFLINE","API").contains(channel))throw new IllegalArgumentException("SUBMISSION_CHANNEL_INVALID");
        java.time.LocalDate due=java.time.LocalDate.parse(deadline); if(due.isBefore(java.time.LocalDate.now()))throw new IllegalArgumentException("SUBMISSION_DEADLINE_PASSED");
        int version=jdbc.queryForObject("SELECT coalesce(max(submission_version),0)+1 FROM emission_regulatory_submission WHERE tenant_id=? AND project_id=?",Integer.class,tenant,projectId);
        Map<String,Object> report=reports.get(0); String canonical=tenant+"|"+projectId+"|"+reportId+"|"+report.get("version_no")+"|"+report.get("report_title")+"|"+report.get("integrity_hash")+"|"+authorityCode+"|"+program+"|"+period+"|"+deadline;
        String hash; try{hash=java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(canonical.getBytes(java.nio.charset.StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException("REGULATORY_PACKAGE_HASH_FAILED",e);}
        Long id=jdbc.queryForObject("INSERT INTO emission_regulatory_submission(tenant_id,project_id,report_id,submission_version,authority_code,authority_name,reporting_program,reporting_period,legal_basis,submission_channel,submission_deadline,status,package_hash,note_text,client_request_id,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,'PACKAGED',?,?,?,?) RETURNING regulatory_submission_id",Long.class,tenant,projectId,reportId,version,authorityCode,authorityName,program,period,legalBasis,channel,due,hash,note,requestId,user);
        jdbc.update("INSERT INTO emission_regulatory_submission_event(regulatory_submission_id,event_code,new_status,actor_id,event_note,evidence_json) VALUES (?,'PACKAGE_CREATED','PACKAGED',?,?,jsonb_build_object('packageHash',?,'reportId',?)::text)",id,user,note,hash,reportId);
        jdbc.update("UPDATE emission_project_task SET task_status='IN_PROGRESS',started_at=coalesce(started_at,current_timestamp),assignee_id=coalesce(assignee_id,?),updated_at=current_timestamp WHERE project_id=? AND task_code='REGULATORY_SUBMISSION'",user,projectId);
        return Map.of("id",id==null?0:id,"version",version,"status","PACKAGED","packageHash",hash);
    }

    @Transactional public Map<String,Object> transitionRegulatorySubmission(String projectId,long submissionId,String tenantId,String actor,boolean override,Map<String,Object> body) {
        String tenant=requiredValue(tenantId,"tenantId"),user=requiredValue(actor,"actor"),action=required(body,"action").toUpperCase(),note=text(body.get("note"));
        String requiredActor=List.of("REQUEST_CORRECTION","ACCEPT").contains(action)?"VERIFIER":"COMPANY_MANAGER"; requireProjectActor(projectId,tenant,user,requiredActor,override);
        List<Map<String,Object>> rows=jdbc.queryForList("SELECT status,package_hash,external_receipt_no FROM emission_regulatory_submission WHERE regulatory_submission_id=? AND tenant_id=? AND project_id=? FOR UPDATE",submissionId,tenant,projectId);
        if(rows.isEmpty())throw new SecurityException("REGULATORY_SUBMISSION_SCOPE_DENIED"); String previous=text(rows.get(0).get("status")),next;
        switch(action){
            case "SUBMIT" -> {if(!"PACKAGED".equals(previous))throw new IllegalStateException("SUBMISSION_REQUIRES_PACKAGED");next="SUBMITTED";}
            case "RECORD_RECEIPT" -> {if(!List.of("SUBMITTED","RESUBMITTED").contains(previous))throw new IllegalStateException("RECEIPT_REQUIRES_SUBMITTED");if(required(body,"receiptNo").length()>120)throw new IllegalArgumentException("RECEIPT_NO_TOO_LONG");next="RECEIVED";}
            case "REQUEST_CORRECTION" -> {if(!"RECEIVED".equals(previous))throw new IllegalStateException("CORRECTION_REQUIRES_RECEIVED");if(note.isBlank())throw new IllegalArgumentException("CORRECTION_REASON_REQUIRED");required(body,"correctionDueDate");next="CORRECTION_REQUIRED";}
            case "RESUBMIT" -> {if(!"CORRECTION_REQUIRED".equals(previous))throw new IllegalStateException("RESUBMIT_REQUIRES_CORRECTION");if(note.isBlank())throw new IllegalArgumentException("CORRECTION_RESPONSE_REQUIRED");next="RESUBMITTED";}
            case "ACCEPT" -> {if(!"RECEIVED".equals(previous))throw new IllegalStateException("ACCEPT_REQUIRES_RECEIVED");if(text(rows.get(0).get("external_receipt_no")).isBlank())throw new IllegalStateException("ACCEPT_REQUIRES_RECEIPT_NO");next="ACCEPTED";}
            case "CANCEL" -> {if(!"PACKAGED".equals(previous))throw new IllegalStateException("CANCEL_REQUIRES_PACKAGED");if(note.isBlank())throw new IllegalArgumentException("CANCEL_REASON_REQUIRED");next="CANCELLED";}
            default -> throw new IllegalArgumentException("REGULATORY_ACTION_INVALID");
        }
        String receipt="RECORD_RECEIPT".equals(action)?required(body,"receiptNo"):"",correctionDue="REQUEST_CORRECTION".equals(action)?required(body,"correctionDueDate"):"";
        jdbc.update("UPDATE emission_regulatory_submission SET status=?,note_text=CASE WHEN length(?)>0 THEN ? ELSE note_text END,updated_at=current_timestamp WHERE regulatory_submission_id=?",next,note,note,submissionId);
        switch(action){
            case "SUBMIT","RESUBMIT" -> jdbc.update("UPDATE emission_regulatory_submission SET submitted_by=?,submitted_at=current_timestamp,correction_due_date=CASE WHEN ?='RESUBMIT' THEN null ELSE correction_due_date END WHERE regulatory_submission_id=?",user,action,submissionId);
            case "RECORD_RECEIPT" -> jdbc.update("UPDATE emission_regulatory_submission SET external_receipt_no=?,received_at=current_timestamp WHERE regulatory_submission_id=?",receipt,submissionId);
            case "REQUEST_CORRECTION" -> jdbc.update("UPDATE emission_regulatory_submission SET correction_reason=?,correction_due_date=cast(? as date) WHERE regulatory_submission_id=?",note,correctionDue,submissionId);
            case "ACCEPT" -> jdbc.update("UPDATE emission_regulatory_submission SET accepted_at=current_timestamp WHERE regulatory_submission_id=?",submissionId);
            default -> { }
        }
        jdbc.update("INSERT INTO emission_regulatory_submission_event(regulatory_submission_id,event_code,previous_status,new_status,actor_id,event_note,evidence_json) VALUES (?,?,?,?,?,?,jsonb_build_object('receiptNo',?,'correctionDueDate',?)::text)",submissionId,action,previous,next,user,note,receipt,correctionDue);
        if("ACCEPTED".equals(next)){completeWorkflowTask(projectId,"REGULATORY_SUBMISSION",user);jdbc.update("UPDATE emission_project_registry SET progress_percent=100,current_step='규제기관 제출 수리',project_status='완료',updated_at=current_timestamp WHERE project_id=?",projectId);}
        return Map.of("id",submissionId,"previousStatus",previous,"status",next);
    }

    @Transactional public Map<String,Object> createReport(String projectId,String tenantId,String actor,boolean override,Map<String,Object> body) {
        String tenant=requiredValue(tenantId,"tenantId"),user=requiredValue(actor,"actor"); requireProjectActor(projectId,tenant,user,"COMPANY_MANAGER",override);
        List<Map<String,Object>> source=jdbc.queryForList("SELECT s.submission_id AS submission_id,c.calculation_id AS calculation_id FROM emission_activity_submission s JOIN emission_submission_review r ON r.submission_id=s.submission_id AND r.review_stage='APPROVAL' AND r.decision='APPROVED' JOIN emission_calculation_run c ON c.calculation_id=r.calculation_id WHERE s.tenant_id=? AND s.project_id=? AND s.submission_state='APPROVED' AND c.locked_at IS NOT NULL ORDER BY r.created_at DESC LIMIT 1",tenant,projectId);
        if(source.isEmpty()) throw new IllegalStateException("REPORT_REQUIRES_APPROVED_LOCKED_CALCULATION");
        Map<String,Object> project=detail(projectId),row=source.get(0); String language=text(body.get("language")); if(!List.of("ko","en").contains(language))language="ko";
        String title=text(body.get("title")); if(title.isBlank())title=String.valueOf(project.get("name"))+("en".equals(language)?" Emission Report":" 배출량 보고서");
        String summary=text(body.get("summary")); Integer version=jdbc.queryForObject("SELECT coalesce(max(version_no),0)+1 FROM emission_project_report WHERE tenant_id=? AND project_id=?",Integer.class,tenant,projectId);
        Long id=jdbc.queryForObject("INSERT INTO emission_project_report(tenant_id,project_id,submission_id,calculation_id,version_no,report_title,report_language,summary_text,created_by) VALUES (?,?,?,?,?,?,?,?,?) RETURNING report_id",Long.class,tenant,projectId,row.get("submission_id"),row.get("calculation_id"),version,title,language,summary,user);
        jdbc.update("INSERT INTO emission_project_history(project_id,event_type,event_description,actor_name) VALUES (?,'REPORT_DRAFT_CREATED',?,?)",projectId,"보고서 V"+version+" 초안 생성",user);
        return Map.of("id",id==null?0:id,"version",version,"status","DRAFT");
    }

    @Transactional public Map<String,Object> finalizeReport(String projectId,long reportId,String tenantId,String actor,boolean override) {
        String tenant=requiredValue(tenantId,"tenantId"),user=requiredValue(actor,"actor"); requireProjectActor(projectId,tenant,user,"COMPANY_MANAGER",override);
        int changed=jdbc.update("UPDATE emission_project_report SET report_status='FINALIZED',finalized_by=?,finalized_at=current_timestamp,updated_at=current_timestamp WHERE report_id=? AND project_id=? AND tenant_id=? AND report_status='DRAFT'",user,reportId,projectId,tenant);
        if(changed==0) { Integer exists=jdbc.queryForObject("SELECT count(*) FROM emission_project_report WHERE report_id=? AND project_id=? AND tenant_id=? AND report_status='FINALIZED'",Integer.class,reportId,projectId,tenant); if(exists==null||exists==0)throw new IllegalStateException("REPORT_FINALIZE_STATE_INVALID"); }
        completeWorkflowTask(projectId,"REPORT",user);
        jdbc.update("UPDATE emission_project_registry SET progress_percent=85,current_step='규제기관 제출 준비',project_status='진행',updated_at=current_timestamp WHERE project_id=?",projectId);
        jdbc.update("INSERT INTO emission_project_history(project_id,event_type,event_description,actor_name) VALUES (?,'REPORT_FINALIZED','최종 배출량 보고서가 확정되었습니다.',?)",projectId,user);
        return Map.of("id",reportId,"status","FINALIZED");
    }

    @Transactional public Map<String,Object> issueReportCertificate(String projectId,long reportId,String tenantId,String actor,boolean override) {
        String tenant=requiredValue(tenantId,"tenantId"),user=requiredValue(actor,"actor"); requireProjectActor(projectId,tenant,user,"COMPANY_MANAGER",override);
        List<Map<String,Object>> rows=jdbc.queryForList("SELECT report_id,version_no,report_title,report_status,certificate_id,integrity_hash FROM emission_project_report WHERE report_id=? AND project_id=? AND tenant_id=? FOR UPDATE",reportId,projectId,tenant);
        if(rows.isEmpty())throw new SecurityException("REPORT_SCOPE_DENIED"); Map<String,Object> row=rows.get(0);
        if(!"FINALIZED".equals(text(row.get("report_status"))))throw new IllegalStateException("CERTIFICATE_REQUIRES_FINALIZED_REPORT");
        String certificate=text(row.get("certificate_id")),hash=text(row.get("integrity_hash"));
        if(certificate.isBlank()) {
            certificate="CER-"+java.time.LocalDate.now().getYear()+"-"+java.util.UUID.randomUUID().toString().substring(0,12).toUpperCase();
            String canonical=tenant+"|"+projectId+"|"+reportId+"|"+row.get("version_no")+"|"+row.get("report_title");
            try { hash=java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(canonical.getBytes(java.nio.charset.StandardCharsets.UTF_8))); } catch(Exception e){throw new IllegalStateException("INTEGRITY_HASH_FAILED",e);}
            jdbc.update("UPDATE emission_project_report SET certificate_id=?,integrity_hash=?,issued_by=?,issued_at=current_timestamp,updated_at=current_timestamp WHERE report_id=?",certificate,hash,user,reportId);
            jdbc.update("INSERT INTO emission_report_certificate_audit(report_id,certificate_id,action_code,actor_id,action_reason) VALUES (?,?,'ISSUED',?,'최종 확정 보고서 인증서 발급')",reportId,certificate,user);
            jdbc.update("INSERT INTO emission_project_history(project_id,event_type,event_description,actor_name) VALUES (?,'REPORT_CERTIFICATE_ISSUED',?,?)",projectId,"보고서 인증번호 "+certificate+" 발급",user);
        }
        return Map.of("reportId",reportId,"certificateId",certificate,"integrityHash",hash,"status","ISSUED");
    }

    @Transactional public void recordReportDownload(String projectId,long reportId,String tenantId,String actor,String ip,String userAgent) {
        String tenant=requiredValue(tenantId,"tenantId"); assertTenantAccess(projectId,tenant);
        int changed=jdbc.update("UPDATE emission_project_report SET download_count=download_count+1,last_downloaded_at=current_timestamp WHERE report_id=? AND project_id=? AND tenant_id=? AND report_status='FINALIZED' AND certificate_id IS NOT NULL AND certificate_status='ACTIVE'",reportId,projectId,tenant);
        if(changed==0)throw new IllegalStateException("ACTIVE_CERTIFICATE_REQUIRED");
        jdbc.update("INSERT INTO emission_report_access_ledger(tenant_id,project_id,report_id,certificate_id,action_code,actor_id,client_ip,user_agent) SELECT tenant_id,project_id,report_id,certificate_id,'DOWNLOAD',?,?,? FROM emission_project_report WHERE report_id=?",actor,ip,userAgent,reportId);
    }

    public Map<String,Object> reportAccessHistory(String tenantId,String actor,boolean all) { String tenant=requiredValue(tenantId,"tenantId"); String sql="SELECT l.access_id AS \"id\",l.project_id AS \"projectId\",p.project_name AS \"projectName\",r.report_title AS \"reportTitle\",r.version_no AS version,l.certificate_id AS \"certificateId\",l.action_code AS action,l.actor_id AS actor,l.client_ip AS ip,l.share_expires_at AS \"expiresAt\",l.share_revoked_at AS \"revokedAt\",l.created_at AS \"createdAt\" FROM emission_report_access_ledger l JOIN emission_project_report r ON r.report_id=l.report_id JOIN emission_project_registry p ON p.project_id=l.project_id WHERE l.tenant_id=?"+(all?"":" AND lower(coalesce(l.actor_id,''))=lower(?)")+" ORDER BY l.created_at DESC LIMIT 500"; Map<String,Object>x=new LinkedHashMap<>();x.put("items",jdbc.queryForList(sql,all?new Object[]{tenant}:new Object[]{tenant,actor}));return x; }

    public Map<String,Object> projectCompletion(String projectId,String tenantId) {
        String tenant=requiredValue(tenantId,"tenantId"); assertTenantAccess(projectId,tenant); Map<String,Object> result=new LinkedHashMap<>(); result.put("project",detail(projectId));
        result.put("metrics",jdbc.queryForMap("SELECT (SELECT count(*) FROM emission_activity_data WHERE project_id=?) AS \"activityCount\",(SELECT count(*) FROM emission_activity_quality_run WHERE project_id=? AND submit_ready=true) AS \"qualityPassCount\",(SELECT count(*) FROM emission_activity_submission WHERE project_id=? AND tenant_id=? AND submission_state='APPROVED') AS \"approvedSubmissions\",(SELECT coalesce(max(total_emission),0) FROM emission_calculation_run WHERE project_id=?) AS \"totalEmission\",(SELECT count(*) FROM emission_project_report WHERE project_id=? AND tenant_id=? AND report_status='FINALIZED') AS \"finalizedReports\",(SELECT count(*) FROM emission_project_report WHERE project_id=? AND tenant_id=? AND certificate_id IS NOT NULL AND certificate_status='ACTIVE') AS \"activeCertificates\",(SELECT count(*) FROM emission_report_access_ledger WHERE project_id=? AND tenant_id=?) AS \"accessCount\"",projectId,projectId,projectId,tenant,projectId,projectId,tenant,projectId,tenant,projectId,tenant));
        result.put("actors",jdbc.queryForList("SELECT actor_code AS \"actorCode\",user_id AS \"userId\",active_yn AS \"active\" FROM framework_project_actor_assignment WHERE project_id=? ORDER BY actor_code,user_id",projectId));
        result.put("reports",jdbc.queryForList("SELECT report_id AS \"id\",version_no AS version,report_title AS title,report_status AS status,certificate_id AS \"certificateId\",certificate_status AS \"certificateStatus\",issued_at AS \"issuedAt\",download_count AS \"downloadCount\" FROM emission_project_report WHERE project_id=? AND tenant_id=? ORDER BY version_no DESC",projectId,tenant));
        List<Map<String,Object>> checklist=jdbc.queryForList("SELECT task_id AS \"taskId\",task_code AS code,task_name AS name,task_status AS status,completion_rule AS rule,completed_at AS \"completedAt\",completed_by AS \"completedBy\",target_url AS \"targetUrl\",due_date AS \"dueDate\",actor_code AS \"actorCode\" FROM emission_project_task WHERE project_id=? ORDER BY step_order",projectId);
        result.put("checklist",checklist);
        long completed=checklist.stream().filter(item->"DONE".equals(String.valueOf(item.get("status")))).count();
        Map<String,Object> next=checklist.stream().filter(item->List.of("READY","IN_PROGRESS").contains(String.valueOf(item.get("status")))).findFirst().orElse(Map.of());
        Map<String,Object> health=jdbc.queryForMap("SELECT workflow_health AS \"status\",task_count AS \"taskCount\",actor_assignment_count AS \"actorAssignmentCount\",missing_actor_count AS \"missingActorCount\",missing_route_count AS \"missingRouteCount\",missing_rule_count AS \"missingRuleCount\",missing_predecessor_count AS \"missingPredecessorCount\",deadlines_valid AS \"deadlinesValid\" FROM emission_project_workflow_health WHERE project_id=?",projectId);
        result.put("workflowHealth",health);result.put("nextTask",next);result.put("completedTaskCount",completed);
        result.put("completionPercent",checklist.isEmpty()?0:Math.round(completed*100.0/checklist.size()));
        result.put("complete",!checklist.isEmpty()&&completed==checklist.size()&&"READY".equals(health.get("status")));
        return result;
    }

    public Map<String,Object> verifyReportCertificate(String certificateId) {
        List<Map<String,Object>> rows=jdbc.queryForList("SELECT r.certificate_id AS \"certificateId\",r.integrity_hash AS \"integrityHash\",r.report_title AS title,r.version_no AS version,r.report_language AS language,r.report_status AS status,r.certificate_status AS \"certificateStatus\",r.revoked_at AS \"revokedAt\",r.revocation_reason AS \"revocationReason\",r.issued_at AS \"issuedAt\",p.project_name AS \"projectName\",p.site_name AS site,c.total_emission AS \"totalEmission\" FROM emission_project_report r JOIN emission_project_registry p ON p.project_id=r.project_id JOIN emission_calculation_run c ON c.calculation_id=r.calculation_id WHERE r.certificate_id=? OR r.previous_certificate_id=? ORDER BY CASE WHEN r.certificate_id=? THEN 0 ELSE 1 END LIMIT 1",certificateId,certificateId,certificateId);
        if(rows.isEmpty())return Map.of("valid",false,"certificateId",certificateId); Map<String,Object> result=new LinkedHashMap<>(rows.get(0)); result.put("valid","FINALIZED".equals(result.get("status"))&&"ACTIVE".equals(result.get("certificateStatus"))&&certificateId.equals(result.get("certificateId"))); return result;
    }

    public Map<String,Object> adminCertificates() { Map<String,Object> r=new LinkedHashMap<>(); r.put("items",jdbc.queryForList("SELECT r.report_id AS \"reportId\",r.project_id AS \"projectId\",p.project_name AS \"projectName\",r.version_no AS version,r.report_title AS title,r.certificate_id AS \"certificateId\",r.certificate_status AS status,r.issued_by AS \"issuedBy\",r.issued_at AS \"issuedAt\",r.revoked_by AS \"revokedBy\",r.revoked_at AS \"revokedAt\",r.revocation_reason AS \"revocationReason\",r.download_count AS \"downloadCount\" FROM emission_project_report r JOIN emission_project_registry p ON p.project_id=r.project_id WHERE r.certificate_id IS NOT NULL ORDER BY r.issued_at DESC")); return r; }

    @Transactional public Map<String,Object> revokeCertificate(long reportId,String actor,String reason) { String why=requiredValue(reason,"reason"),user=requiredValue(actor,"actor"); int n=jdbc.update("UPDATE emission_project_report SET certificate_status='REVOKED',revoked_by=?,revoked_at=current_timestamp,revocation_reason=?,updated_at=current_timestamp WHERE report_id=? AND certificate_id IS NOT NULL AND certificate_status='ACTIVE'",user,why,reportId); if(n==0)throw new IllegalStateException("ACTIVE_CERTIFICATE_REQUIRED"); jdbc.update("INSERT INTO emission_report_certificate_audit(report_id,certificate_id,action_code,actor_id,action_reason) SELECT report_id,certificate_id,'REVOKED',?,? FROM emission_project_report WHERE report_id=?",user,why,reportId); return Map.of("reportId",reportId,"status","REVOKED"); }

    @Transactional public Map<String,Object> reissueCertificate(long reportId,String actor,String reason) { String why=requiredValue(reason,"reason"),user=requiredValue(actor,"actor"); List<Map<String,Object>> rows=jdbc.queryForList("SELECT project_id,tenant_id,certificate_id FROM emission_project_report WHERE report_id=? AND certificate_status='REVOKED' FOR UPDATE",reportId); if(rows.isEmpty())throw new IllegalStateException("REVOKED_CERTIFICATE_REQUIRED"); Map<String,Object> row=rows.get(0); String old=text(row.get("certificate_id")); jdbc.update("UPDATE emission_project_report SET previous_certificate_id=?,certificate_id=null,integrity_hash=null,certificate_status='ACTIVE',revoked_by=null,revoked_at=null,revocation_reason=null WHERE report_id=?",old,reportId); Map<String,Object> issued=issueReportCertificate(text(row.get("project_id")),reportId,text(row.get("tenant_id")),user,true); jdbc.update("INSERT INTO emission_report_certificate_audit(report_id,certificate_id,action_code,actor_id,action_reason) VALUES (?,?,'REISSUED',?,?)",reportId,issued.get("certificateId"),user,why); return issued; }

    @Transactional
    public Map<String,Object> startVerification(String projectId,long submissionId,String tenantId,String actor,boolean override) {
        String tenant=requiredValue(tenantId,"tenantId"),user=requiredValue(actor,"actor");
        requireProjectActor(projectId,tenant,user,"VERIFIER",override);
        List<Map<String,Object>> rows=jdbc.queryForList("SELECT submission_state AS state FROM emission_activity_submission WHERE submission_id=? AND project_id=? AND tenant_id=? FOR UPDATE",submissionId,projectId,tenant);
        if(rows.isEmpty()) throw new SecurityException("SUBMISSION_SCOPE_DENIED");
        String state=text(rows.get(0).get("state"));
        if(!List.of("SUBMITTED","IN_VERIFICATION").contains(state)) throw new IllegalStateException("VERIFICATION_STATE_INVALID:"+state);
        if("SUBMITTED".equals(state)) {
            Integer calculations=jdbc.queryForObject("SELECT count(*) FROM emission_calculation_run WHERE project_id=?",Integer.class,projectId);
            if(calculations==null||calculations==0) throw new IllegalStateException("VERIFICATION_REQUIRES_CALCULATION");
            jdbc.update("UPDATE emission_activity_submission SET submission_state='IN_VERIFICATION',updated_at=current_timestamp WHERE submission_id=?",submissionId);
            jdbc.update("INSERT INTO emission_submission_review(tenant_id,project_id,submission_id,review_stage,decision,reviewer_id) VALUES (?,?,?,'VERIFICATION','STARTED',?)",tenant,projectId,submissionId,user);
            jdbc.update("INSERT INTO emission_activity_submission_event(submission_id,event_type,event_actor,previous_state,new_state,event_note) VALUES (?,'VERIFICATION_STARTED',?,'SUBMITTED','IN_VERIFICATION','검증이 시작되었습니다.')",submissionId,user);
        }
        return Map.of("id",submissionId,"state","IN_VERIFICATION");
    }

    @Transactional
    public Map<String,Object> decideVerification(String projectId,long submissionId,String tenantId,String actor,boolean override,Map<String,Object> body) {
        String tenant=requiredValue(tenantId,"tenantId"),user=requiredValue(actor,"actor"),decision=required(body,"decision").toUpperCase();
        requireProjectActor(projectId,tenant,user,"VERIFIER",override);
        if(!List.of("PASSED","CORRECTION_REQUESTED").contains(decision)) throw new IllegalArgumentException("VERIFICATION_DECISION_INVALID");
        String comment=text(body.get("comment")); int issues=Integer.parseInt(String.valueOf(body.getOrDefault("issueCount",0)));
        if("CORRECTION_REQUESTED".equals(decision)&&comment.isBlank()) throw new IllegalArgumentException("CORRECTION_REASON_REQUIRED");
        List<Map<String,Object>> rows=jdbc.queryForList("SELECT submission_state AS state FROM emission_activity_submission WHERE submission_id=? AND project_id=? AND tenant_id=? FOR UPDATE",submissionId,projectId,tenant);
        if(rows.isEmpty()) throw new SecurityException("SUBMISSION_SCOPE_DENIED");
        String previous=text(rows.get(0).get("state")); if(!"IN_VERIFICATION".equals(previous)) throw new IllegalStateException("VERIFICATION_STATE_INVALID:"+previous);
        String next="PASSED".equals(decision)?"VERIFIED":"CORRECTION_REQUIRED";
        jdbc.update("UPDATE emission_activity_submission SET submission_state=?,updated_at=current_timestamp WHERE submission_id=?",next,submissionId);
        jdbc.update("INSERT INTO emission_submission_review(tenant_id,project_id,submission_id,review_stage,decision,reviewer_id,comment_text,issue_count) VALUES (?,?,?,'VERIFICATION',?,?,?,?)",tenant,projectId,submissionId,decision,user,comment,issues);
        jdbc.update("INSERT INTO emission_activity_submission_event(submission_id,event_type,event_actor,previous_state,new_state,event_note) VALUES (?,?,?,?,?,?)",submissionId,"PASSED".equals(decision)?"VERIFIED":"CORRECTION_REQUESTED",user,previous,next,comment);
        if("PASSED".equals(decision)) completeWorkflowTask(projectId,"VERIFICATION",user); else reopenForCorrection(projectId,user,comment);
        return Map.of("id",submissionId,"state",next);
    }

    @Transactional
    public Map<String,Object> decideApproval(String projectId,long submissionId,String tenantId,String actor,boolean override,Map<String,Object> body) {
        String tenant=requiredValue(tenantId,"tenantId"),user=requiredValue(actor,"actor"),decision=required(body,"decision").toUpperCase(),comment=text(body.get("comment"));
        requireProjectActor(projectId,tenant,user,"APPROVER",override);
        if(!List.of("APPROVED","REJECTED").contains(decision)) throw new IllegalArgumentException("APPROVAL_DECISION_INVALID");
        if("REJECTED".equals(decision)&&comment.isBlank()) throw new IllegalArgumentException("REJECTION_REASON_REQUIRED");
        List<Map<String,Object>> rows=jdbc.queryForList("SELECT submission_state AS state FROM emission_activity_submission WHERE submission_id=? AND project_id=? AND tenant_id=? FOR UPDATE",submissionId,projectId,tenant);
        if(rows.isEmpty()) throw new SecurityException("SUBMISSION_SCOPE_DENIED");
        String previous=text(rows.get(0).get("state")); if(!"VERIFIED".equals(previous)) throw new IllegalStateException("APPROVAL_REQUIRES_VERIFIED");
        Long calculationId=jdbc.query("SELECT calculation_id FROM emission_calculation_run WHERE project_id=? ORDER BY version_no DESC LIMIT 1",rs->rs.next()?rs.getLong(1):null,projectId);
        if(calculationId==null) throw new IllegalStateException("APPROVAL_REQUIRES_CALCULATION");
        String next="APPROVED".equals(decision)?"APPROVED":"CORRECTION_REQUIRED";
        jdbc.update("UPDATE emission_activity_submission SET submission_state=?,updated_at=current_timestamp WHERE submission_id=?",next,submissionId);
        jdbc.update("INSERT INTO emission_submission_review(tenant_id,project_id,submission_id,review_stage,decision,reviewer_id,comment_text,calculation_id) VALUES (?,?,?,'APPROVAL',?,?,?,?)",tenant,projectId,submissionId,decision,user,comment,calculationId);
        jdbc.update("INSERT INTO emission_activity_submission_event(submission_id,event_type,event_actor,previous_state,new_state,event_note) VALUES (?,?,?,?,?,?)",submissionId,"APPROVED".equals(decision)?"APPROVED":"REJECTED",user,previous,next,comment);
        if("APPROVED".equals(decision)) { jdbc.update("UPDATE emission_calculation_run SET locked_at=current_timestamp,locked_by=? WHERE calculation_id=? AND locked_at IS NULL",user,calculationId); completeWorkflowTask(projectId,"APPROVAL",user); }
        else reopenForCorrection(projectId,user,comment);
        return Map.of("id",submissionId,"state",next,"calculationId",calculationId);
    }

    private void requireProjectActor(String projectId,String tenant,String user,String actorCode,boolean override) {
        assertTenantAccess(projectId,tenant); if(override)return;
        Integer count=jdbc.queryForObject("SELECT count(*) FROM framework_project_actor_assignment a JOIN emission_project_registry p ON p.project_id=a.project_id WHERE a.project_id=? AND p.tenant_id=? AND lower(a.user_id)=lower(?) AND a.actor_code=? AND a.active_yn='Y'",Integer.class,projectId,tenant,user,actorCode);
        if(count==null||count==0) throw new SecurityException("ACTOR_NOT_AUTHORIZED:"+actorCode);
    }

    private void reopenForCorrection(String projectId,String actor,String reason) {
        jdbc.update("UPDATE emission_project_task SET task_status=CASE WHEN task_code='ACTIVITY_DATA' THEN 'READY' ELSE 'BLOCKED' END,blocked_reason=CASE WHEN task_code='ACTIVITY_DATA' THEN null ELSE '보완 자료 재제출이 필요합니다.' END,completed_at=null,completed_by=null,updated_at=current_timestamp WHERE project_id=? AND task_code IN ('ACTIVITY_DATA','CALCULATION','VERIFICATION','APPROVAL','REPORT')",projectId);
        jdbc.update("UPDATE emission_project_registry SET current_step='보완·재제출',project_status='보완 필요',updated_at=current_timestamp WHERE project_id=?",projectId);
        jdbc.update("INSERT INTO emission_project_history(project_id,event_type,event_description,actor_name) VALUES (?,'CORRECTION_REQUESTED',?,?)",projectId,reason,actor);
        jdbc.update("INSERT INTO emission_workflow_notification(tenant_id,project_id,task_id,event_type,recipient_id,actor_code,title,message_text,target_url) SELECT p.tenant_id,t.project_id,t.task_id,'CORRECTION',t.assignee_id,t.actor_code,'활동자료 보완이 요청되었습니다',?,t.target_url FROM emission_project_task t JOIN emission_project_registry p ON p.project_id=t.project_id WHERE t.project_id=? AND t.task_code='ACTIVITY_DATA' AND coalesce(t.assignee_id,'')<>'' ON CONFLICT DO NOTHING",reason,projectId);
        String tenant=jdbc.queryForObject("select tenant_id from emission_project_registry where project_id=?",String.class,projectId);
        Map<String,Object> execution=processGovernanceService.findProcessExecution(tenant,projectId,"EMISSION_PROJECT");
        String current=String.valueOf(execution.get("currentStepCode"));
        if("EMISSION_PROJECT_VALIDATE".equals(current))synchronizeProcessExecution(projectId,"VERIFICATION",actor,"CORRECTION_REQUIRED");
        else if("EMISSION_PROJECT_APPROVE".equals(current))synchronizeProcessExecution(projectId,"APPROVAL",actor,"CORRECTION_REQUIRED");
    }

    @Transactional
    public String copy(String sourceId,String tenantId,String actor,boolean override) {
        String tenant=requiredValue(tenantId,"tenantId");
        requireProjectActor(sourceId,tenant,requiredValue(actor,"actor"),"COMPANY_MANAGER",override);
        Map<String, Object> source = detail(sourceId);
        Map<String,String> actors=new LinkedHashMap<>();
        jdbc.queryForList("SELECT actor_code,user_id FROM framework_project_actor_assignment WHERE project_id=? AND active_yn='Y'",sourceId)
            .forEach(row->actors.put(String.valueOf(row.get("actor_code")),String.valueOf(row.get("user_id"))));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", source.get("name") + " - 복사본"); body.put("site", source.get("site")); body.put("owner", source.get("owner"));
        body.put("dataOwner",requiredValue(actors.get("SITE_DATA_OWNER"),"dataOwner"));
        body.put("calculator",requiredValue(actors.get("CALCULATOR"),"calculator"));
        body.put("verifier",requiredValue(actors.get("VERIFIER"),"verifier"));
        body.put("approver",requiredValue(actors.get("APPROVER"),"approver"));
        body.put("reportingYear", source.get("reportingYear")); body.put("periodStart", source.get("periodStart")); body.put("periodEnd", source.get("periodEnd")); body.put("dueDate", source.get("dueDate"));
        body.put("scopes", List.of(String.valueOf(source.get("scope")).split("·")));
        body.put("organizationBoundary", source.get("organizationBoundary") == null ? "OPERATIONAL_CONTROL" : source.get("organizationBoundary"));
        body.put("emissionStandard", source.get("emissionStandard") == null ? "ISO_14064_1" : source.get("emissionStandard"));
        body.put("methodologyVersion", source.get("methodologyVersion") == null ? "2018" : source.get("methodologyVersion"));
        body.put("verificationLevel", source.get("verificationLevel") == null ? "LIMITED" : source.get("verificationLevel"));
        body.put("collectionCycle", source.get("collectionCycle") == null ? "MONTHLY" : source.get("collectionCycle"));
        body.put("materialityThreshold", source.get("materialityThreshold") == null ? 5 : source.get("materialityThreshold"));
        return create(tenant,body);
    }

    @Transactional
    public String create(String tenantId,Map<String, Object> body) {
        String tenant=requiredValue(tenantId,"tenantId");
        EmissionProjectCreationPolicy.Contract contract=EmissionProjectCreationPolicy.validate(body);
        Map<String,Object> readiness=onboardingReadiness(tenant);
        if(!Boolean.TRUE.equals(readiness.get("ready"))) throw new IllegalArgumentException("PROJECT_ONBOARDING_INCOMPLETE:"+readiness.get("missing"));
        String requestId=requiredValue(String.valueOf(body.getOrDefault("clientRequestId",UUID.randomUUID().toString())),"clientRequestId");
        if(requestId.length()>100) throw new IllegalArgumentException("PROJECT_CLIENT_REQUEST_ID_TOO_LONG");
        jdbc.query("SELECT pg_advisory_xact_lock(hashtext(?))",rs->{},tenant+":"+requestId);
        List<String> existing=jdbc.queryForList("SELECT project_id FROM emission_project_registry WHERE tenant_id=? AND creation_request_id=?",String.class,tenant,requestId);
        if(!existing.isEmpty()) return existing.get(0);
        String name=contract.name(),site=contract.site(),owner=contract.owner(),dataOwner=contract.dataOwner(),calculator=contract.calculator(),verifier=contract.verifier(),approver=contract.approver();
        assertActiveSite(tenant,site);
        assertActorEligible(tenant,owner,"COMPANY_MANAGER");
        assertActorEligible(tenant,dataOwner,"SITE_DATA_OWNER");
        assertActorEligible(tenant,calculator,"CALCULATOR");
        assertActorEligible(tenant,verifier,"VERIFIER");
        assertActorEligible(tenant,approver,"APPROVER");
        LocalDate start=contract.periodStart(),end=contract.periodEnd(),due=contract.dueDate();int year=contract.reportingYear();
        if (!nameAvailable(tenant,name)) throw new IllegalArgumentException("이미 등록된 프로젝트명입니다.");
        String scope=contract.scopes().stream().sorted().reduce((a,b)->a+"·"+b).orElseThrow();
        String id = "PRJ-" + LocalDate.now().getYear() + "-" + UUID.randomUUID().toString().substring(0,6).toUpperCase();
        jdbc.update("INSERT INTO emission_project_registry(project_id,tenant_id,project_name,site_name,calculation_period,scope_name,owner_name,progress_percent,current_step,due_date,project_status,reporting_year,period_start,period_end,organization_boundary,emission_standard,methodology_version,verification_level,collection_cycle,materiality_threshold,settings_snapshot) VALUES (?,?,?,?,?,?,?,0,'프로젝트 생성',?,'진행',?,?,?,?,?,?,?,?,?,jsonb_build_object('organizationBoundary',?,'emissionStandard',?,'methodologyVersion',?,'verificationLevel',?,'collectionCycle',?,'materialityThreshold',?,'scopes',?))", id,tenant,name,site,start+" ~ "+end,scope,owner,due,year,start,end,contract.organizationBoundary(),contract.emissionStandard(),contract.methodologyVersion(),contract.verificationLevel(),contract.collectionCycle(),contract.materialityThreshold(),contract.organizationBoundary(),contract.emissionStandard(),contract.methodologyVersion(),contract.verificationLevel(),contract.collectionCycle(),contract.materialityThreshold(),scope);
        jdbc.update("UPDATE emission_project_registry SET creation_request_id=?,workflow_initialized_at=current_timestamp WHERE project_id=?",requestId,id);
        jdbc.update("INSERT INTO emission_project_member(project_id,member_name,role_code) VALUES (?,?,'OWNER')", id, owner);
        String[][] tasks = {{"BASIC_INFO","기본정보 확인"},{"ACTIVITY_DATA","활동자료 수집"},{"CALCULATION","배출량 산정"},{"VERIFICATION","데이터 검증"},{"APPROVAL","검토·승인"},{"REPORT","확정·보고"},{"REGULATORY_SUBMISSION","규제기관 제출·접수"}};
        for (int i=0;i<tasks.length;i++) jdbc.update("INSERT INTO emission_project_task(project_id,task_code,task_name,step_order,task_status,progress_weight,due_date) VALUES (?,?,?,?,?,?,?)",id,tasks[i][0],tasks[i][1],i+1,i==0?"IN_PROGRESS":"WAITING",i==0?10:15,due);
        jdbc.update("UPDATE emission_project_task SET process_code=CASE WHEN task_code='REGULATORY_SUBMISSION' THEN 'REGULATORY_SUBMISSION' ELSE 'EMISSION_PROJECT' END,process_step_code=CASE task_code WHEN 'BASIC_INFO' THEN 'EMISSION_PROJECT_SETUP' WHEN 'ACTIVITY_DATA' THEN 'EMISSION_PROJECT_COLLECT' WHEN 'CALCULATION' THEN 'EMISSION_PROJECT_CALCULATE' WHEN 'VERIFICATION' THEN 'EMISSION_PROJECT_VALIDATE' WHEN 'APPROVAL' THEN 'EMISSION_PROJECT_APPROVE' WHEN 'REPORT' THEN 'EMISSION_PROJECT_REPORT' WHEN 'REGULATORY_SUBMISSION' THEN 'REGULATORY_SUBMISSION_S1' END,actor_code=CASE task_code WHEN 'BASIC_INFO' THEN 'COMPANY_MANAGER' WHEN 'ACTIVITY_DATA' THEN 'SITE_DATA_OWNER' WHEN 'CALCULATION' THEN 'CALCULATOR' WHEN 'VERIFICATION' THEN 'VERIFIER' WHEN 'APPROVAL' THEN 'APPROVER' WHEN 'REPORT' THEN 'COMPANY_MANAGER' WHEN 'REGULATORY_SUBMISSION' THEN 'COMPANY_MANAGER' END,predecessor_codes=CASE task_code WHEN 'ACTIVITY_DATA' THEN 'BASIC_INFO' WHEN 'CALCULATION' THEN 'ACTIVITY_DATA' WHEN 'VERIFICATION' THEN 'CALCULATION' WHEN 'APPROVAL' THEN 'VERIFICATION' WHEN 'REPORT' THEN 'APPROVAL' WHEN 'REGULATORY_SUBMISSION' THEN 'REPORT' ELSE '' END,completion_rule=CASE task_code WHEN 'BASIC_INFO' THEN '프로젝트 기본정보와 산정기간이 확정됨' WHEN 'ACTIVITY_DATA' THEN '품질검사를 통과한 활동자료가 제출됨' WHEN 'CALCULATION' THEN '배출량 산정 버전이 생성됨' WHEN 'VERIFICATION' THEN '검증 오류가 없고 검증 이력이 생성됨' WHEN 'APPROVAL' THEN '권한 있는 승인자가 결과를 승인함' WHEN 'REPORT' THEN '확정 결과 보고서가 발행됨' WHEN 'REGULATORY_SUBMISSION' THEN '제출 패키지와 접수번호가 보존되고 규제기관 수리가 완료됨' END WHERE project_id=?",id);
        jdbc.update("UPDATE emission_project_task SET target_url=CASE task_code WHEN 'BASIC_INFO' THEN '/emission/project/detail?id='||project_id WHEN 'ACTIVITY_DATA' THEN '/emission/activity-data?projectId='||project_id WHEN 'CALCULATION' THEN '/emission/calculation?projectId='||project_id WHEN 'VERIFICATION' THEN '/emission/validate?projectId='||project_id WHEN 'APPROVAL' THEN '/emission/validate?tab=approval&projectId='||project_id WHEN 'REPORT' THEN '/emission/report_submit?projectId='||project_id WHEN 'REGULATORY_SUBMISSION' THEN '/emission/report-submission?projectId='||project_id END WHERE project_id=?",id);
        jdbc.update("INSERT INTO framework_project_actor_assignment(project_id,actor_code,user_id) VALUES (?,'COMPANY_MANAGER',?),(?,'SITE_DATA_OWNER',?),(?,'CALCULATOR',?),(?,'VERIFIER',?),(?,'APPROVER',?) ON CONFLICT DO NOTHING",id,owner,id,dataOwner,id,calculator,id,verifier,id,approver);
        jdbc.update("INSERT INTO framework_account_actor_assignment(account_id,tenant_id,project_id,actor_code,data_scope,assignment_status) VALUES (?,?,?,'COMPANY_MANAGER',?,'ACTIVE'),(?,?,?,'SITE_DATA_OWNER',?,'ACTIVE'),(?,?,?,'CALCULATOR',?,'ACTIVE'),(?,?,?,'VERIFIER',?,'ACTIVE'),(?,?,?,'APPROVER',?,'ACTIVE') ON CONFLICT(account_id,tenant_id,project_id,actor_code) DO UPDATE SET data_scope=excluded.data_scope,assignment_status='ACTIVE'",owner,tenant,id,id,dataOwner,tenant,id,id,calculator,tenant,id,id,verifier,tenant,id,id,approver,tenant,id,id);
        jdbc.update("UPDATE emission_project_task SET assignee_id=CASE actor_code WHEN 'COMPANY_MANAGER' THEN ? WHEN 'SITE_DATA_OWNER' THEN ? WHEN 'CALCULATOR' THEN ? WHEN 'VERIFIER' THEN ? WHEN 'APPROVER' THEN ? END WHERE project_id=?",owner,dataOwner,calculator,verifier,approver,id);
        jdbc.update("INSERT INTO emission_project_activity_request(project_id,tenant_id,site_name,assignee_id,collection_cycle,period_start,period_end,due_date) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(project_id,site_name,assignee_id) DO NOTHING",id,tenant,site,dataOwner,contract.collectionCycle(),start,end,due);
        completeWorkflowTask(id,"BASIC_INFO",owner);
        jdbc.update("UPDATE emission_project_task task SET due_date=CASE task.step_order WHEN 1 THEN least(?,current_date) WHEN 6 THEN ? ELSE least(?,current_date+greatest(1,ceil((?-current_date)*task.step_order/6.0)::integer)) END,updated_at=current_timestamp WHERE task.project_id=?",due,due,due,due,id);
        jdbc.update("INSERT INTO emission_project_history(project_id,event_type,event_description,actor_name) VALUES (?,'CREATED','배출량 프로젝트가 생성되었습니다.',?)", id, owner);
        return id;
    }

    public Map<String,Object> creationResult(String projectId,String tenantId) {
        Map<String,Object> completion=projectCompletion(projectId,tenantId);
        Map<String,Object> result=new LinkedHashMap<>();result.put("success",true);result.put("id",projectId);
        result.put("nextTask",completion.get("nextTask"));result.put("workflowHealth",completion.get("workflowHealth"));
        result.put("completionPercent",completion.get("completionPercent"));return result;
    }

    @Transactional
    public int delete(String id,String tenantId,String actor,boolean override) {
        String tenant=requiredValue(tenantId,"tenantId");
        requireProjectActor(id,tenant,requiredValue(actor,"actor"),"COMPANY_MANAGER",override);
        jdbc.update("DELETE FROM emission_project_report WHERE project_id=? AND tenant_id=?",id,tenant);
        jdbc.update("DELETE FROM emission_submission_review WHERE project_id=? AND tenant_id=?",id,tenant);
        jdbc.update("DELETE FROM emission_activity_submission WHERE project_id=? AND tenant_id=?",id,tenant);
        jdbc.update("DELETE FROM emission_activity_quality_run WHERE project_id=? AND tenant_id=?",id,tenant);
        jdbc.update("DELETE FROM emission_calculation_run WHERE project_id=?",id);
        jdbc.update("DELETE FROM framework_account_actor_assignment WHERE project_id=? AND tenant_id=?",id,tenant);
        return jdbc.update("DELETE FROM emission_project_registry WHERE project_id=? AND tenant_id=?",id,tenant);
    }
    private String required(Map<String,Object> body,String key) { String value=String.valueOf(body.getOrDefault(key,"")).trim(); if(value.isEmpty()) throw new IllegalArgumentException(key+" is required"); return value; }
    private void assertActiveSite(String tenant,String site) { Integer count=jdbc.queryForObject("SELECT count(*) FROM emission_site_registry WHERE tenant_id=? AND lower(trim(site_name))=lower(trim(?)) AND site_status='ACTIVE' AND (effective_until IS NULL OR effective_until>=current_date)",Integer.class,tenant,site);if(count==null||count==0)throw new IllegalArgumentException("PROJECT_SITE_NOT_REGISTERED"); }
    private void assertActorEligible(String tenant,String account,String actorCode) { Integer count=jdbc.queryForObject("SELECT count(*) FROM framework_account_actor_assignment WHERE tenant_id=? AND lower(account_id)=lower(?) AND actor_code=? AND assignment_status='ACTIVE' AND (valid_until IS NULL OR valid_until>=current_date)",Integer.class,tenant,account,actorCode);if(count==null||count==0)throw new IllegalArgumentException("PROJECT_ACTOR_NOT_ELIGIBLE:"+actorCode+":"+account); }
    private String requiredValue(String value,String key) { String normalized=value==null?"":value.trim(); if(normalized.isEmpty()) throw new IllegalArgumentException(key+" is required"); return normalized; }
}
