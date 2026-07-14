package egovframework.com.feature.home.service;

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
import java.io.InputStream;

@Service
public class EmissionProjectRegistryService {
    private final JdbcTemplate jdbc;
    public EmissionProjectRegistryService(DataSource dataSource) { this.jdbc = new JdbcTemplate(dataSource); }

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

    public boolean nameAvailable(String tenantId,String name) {
        Integer count = jdbc.queryForObject("SELECT count(*) FROM emission_project_registry WHERE tenant_id=? AND lower(trim(project_name))=lower(trim(?))", Integer.class, requiredValue(tenantId,"tenantId"),name == null ? "" : name);
        return count == null || count == 0;
    }

    public Map<String, Object> options(String tenantId,String keyword) {
        String tenant=requiredValue(tenantId,"tenantId");
        String term = keyword == null ? "" : keyword.trim(), like = "%" + term + "%";
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sites", jdbc.queryForList("SELECT DISTINCT site_name FROM emission_project_registry WHERE tenant_id=? AND (?='' OR site_name ILIKE ?) ORDER BY site_name LIMIT 20", String.class,tenant,term,like));
        result.put("owners", jdbc.queryForList("SELECT DISTINCT owner_name FROM emission_project_registry WHERE tenant_id=? AND (?='' OR owner_name ILIKE ?) ORDER BY owner_name LIMIT 20", String.class,tenant,term,like));
        return result;
    }

    public Map<String, Object> detail(String id) {
        List<Map<String, Object>> projects = jdbc.queryForList("SELECT project_id AS \"id\",project_name AS \"name\",site_name AS \"site\",calculation_period AS \"period\",scope_name AS \"scope\",owner_name AS \"owner\",progress_percent AS \"progress\",current_step AS \"step\",due_date AS \"dueDate\",project_status AS \"status\",reporting_year AS \"reportingYear\",period_start AS \"periodStart\",period_end AS \"periodEnd\" FROM emission_project_registry WHERE project_id=?", id);
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

    public Map<String,Object> activities(String projectId,String keyword) {
        detail(projectId);
        String term=keyword==null?"":keyword.trim(), like="%"+term+"%";
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("project", detail(projectId));
        result.put("items",jdbc.queryForList("SELECT a.activity_id AS \"id\",a.activity_name AS \"name\",a.category,a.activity_period AS \"period\",a.quantity,a.unit,a.evidence_note AS \"note\",a.factor_id AS \"factorId\",f.factor_name AS \"factorName\",f.factor_value AS \"factorValue\",a.mapping_status AS \"mappingStatus\" FROM emission_activity_data a LEFT JOIN emission_factor_reference f ON f.factor_id=a.factor_id WHERE a.project_id=? AND (?='' OR a.activity_name ILIKE ? OR a.category ILIKE ?) ORDER BY a.activity_period DESC,a.activity_id DESC",projectId,term,like,like));
        result.put("factors",jdbc.queryForList("SELECT factor_id AS \"id\",factor_name AS \"name\",category,unit,factor_value AS \"value\",source_name AS \"source\" FROM emission_factor_reference ORDER BY category,factor_name"));
        return result;
    }

    @Transactional
    public long saveActivity(String projectId,Map<String,Object> body) {
        detail(projectId);
        String name=required(body,"name"),category=required(body,"category"),period=required(body,"period"),unit=required(body,"unit");
        double quantity=Double.parseDouble(required(body,"quantity")); if(quantity<0) throw new IllegalArgumentException("활동량은 0보다 작을 수 없습니다.");
        String note=String.valueOf(body.getOrDefault("note","")).trim();
        Long id=jdbc.queryForObject("INSERT INTO emission_activity_data(project_id,activity_name,category,activity_period,quantity,unit,evidence_note) VALUES (?,?,?,?,?,?,?) RETURNING activity_id",Long.class,projectId,name,category,period,quantity,unit,note);
        jdbc.update("INSERT INTO emission_project_history(project_id,event_type,event_description,actor_name) SELECT ?,'ACTIVITY_ADDED',?||' 활동자료가 등록되었습니다.',owner_name FROM emission_project_registry WHERE project_id=?",projectId,name,projectId);
        return id==null?0:id;
    }

    @Transactional
    public int mapFactor(String projectId,long activityId,String factorId) {
        int changed=jdbc.update("UPDATE emission_activity_data SET factor_id=?,mapping_status='MAPPED',updated_at=current_timestamp WHERE project_id=? AND activity_id=?",factorId,projectId,activityId);
        if(changed==0) throw new IllegalArgumentException("활동자료를 찾을 수 없습니다.");
        return changed;
    }

    @Transactional
    public int autoMap(String projectId) {
        int changed=jdbc.update("UPDATE emission_activity_data a SET factor_id=(SELECT r.factor_id FROM emission_factor_reference r WHERE lower(r.factor_name) LIKE '%'||lower(a.activity_name)||'%' OR lower(a.activity_name) LIKE '%'||lower(trim(split_part(r.factor_name,'(',1)))||'%' OR r.category=a.category ORDER BY CASE WHEN r.unit=a.unit THEN 0 ELSE 1 END,r.factor_id LIMIT 1),mapping_status='MAPPED',updated_at=current_timestamp WHERE a.project_id=? AND a.factor_id IS NULL AND EXISTS (SELECT 1 FROM emission_factor_reference r WHERE lower(r.factor_name) LIKE '%'||lower(a.activity_name)||'%' OR lower(a.activity_name) LIKE '%'||lower(trim(split_part(r.factor_name,'(',1)))||'%' OR r.category=a.category)",projectId);
        jdbc.update("INSERT INTO emission_project_history(project_id,event_type,event_description,actor_name) SELECT ?,'FACTOR_MAPPING',?||'건의 배출계수가 자동 매핑되었습니다.',owner_name FROM emission_project_registry WHERE project_id=?",projectId,String.valueOf(changed),projectId);
        return changed;
    }

    @Transactional
    public int uploadActivities(String projectId,MultipartFile file) throws Exception {
        detail(projectId); if(file==null||file.isEmpty()) throw new IllegalArgumentException("엑셀 파일을 선택해 주세요.");
        int count=0; DataFormatter formatter=new DataFormatter();
        try(InputStream in=file.getInputStream(); XSSFWorkbook workbook=new XSSFWorkbook(in)) {
            Sheet sheet=workbook.getSheetAt(0);
            for(int index=1;index<=sheet.getLastRowNum();index++) { Row row=sheet.getRow(index); if(row==null) continue;
                String name=formatter.formatCellValue(row.getCell(0)).trim(); if(name.isEmpty()) continue;
                String category=formatter.formatCellValue(row.getCell(1)).trim(), period=formatter.formatCellValue(row.getCell(2)).trim(), quantityText=formatter.formatCellValue(row.getCell(3)).replace(",","").trim(), unit=formatter.formatCellValue(row.getCell(4)).trim(), note=formatter.formatCellValue(row.getCell(5)).trim();
                if(category.isEmpty()||period.isEmpty()||quantityText.isEmpty()||unit.isEmpty()) throw new IllegalArgumentException((index+1)+"행의 필수값을 확인해 주세요.");
                double quantity=Double.parseDouble(quantityText);
                jdbc.update("INSERT INTO emission_activity_data(project_id,activity_name,category,activity_period,quantity,unit,evidence_note) VALUES (?,?,?,?,?,?,?)",projectId,name,category,period,quantity,unit,note); count++;
            }
        }
        jdbc.update("INSERT INTO emission_project_history(project_id,event_type,event_description,actor_name) SELECT ?,'EXCEL_UPLOADED',?||'건의 활동자료를 엑셀로 등록했습니다.',owner_name FROM emission_project_registry WHERE project_id=?",projectId,String.valueOf(count),projectId);
        return count;
    }

    public Map<String,Object> calculationResult(String projectId) {
        Map<String,Object> result=new LinkedHashMap<>(); result.put("project",detail(projectId));
        List<Map<String,Object>> runs=jdbc.queryForList("SELECT calculation_id AS \"id\",version_no AS \"version\",calculation_status AS \"status\",total_emission AS \"totalEmission\",calculated_at AS \"calculatedAt\" FROM emission_calculation_run WHERE project_id=? ORDER BY version_no DESC",projectId);
        result.put("runs",runs);
        if(!runs.isEmpty()) { long id=((Number)runs.get(0).get("id")).longValue(); result.put("items",jdbc.queryForList("SELECT a.activity_name AS \"name\",a.category,a.activity_period AS \"period\",i.quantity,a.unit,f.factor_name AS \"factorName\",i.factor_value AS \"factorValue\",i.emission_value AS \"emissionValue\" FROM emission_calculation_item i JOIN emission_activity_data a ON a.activity_id=i.activity_id JOIN emission_factor_reference f ON f.factor_id=a.factor_id WHERE i.calculation_id=? ORDER BY i.emission_value DESC",id)); }
        else result.put("items",List.of());
        Integer unmapped=jdbc.queryForObject("SELECT count(*) FROM emission_activity_data WHERE project_id=? AND factor_id IS NULL",Integer.class,projectId);
        Integer total=jdbc.queryForObject("SELECT count(*) FROM emission_activity_data WHERE project_id=?",Integer.class,projectId);
        result.put("activityCount",total==null?0:total); result.put("unmappedCount",unmapped==null?0:unmapped);
        return result;
    }

    @Transactional
    public long calculate(String projectId) {
        detail(projectId);
        Integer total=jdbc.queryForObject("SELECT count(*) FROM emission_activity_data WHERE project_id=?",Integer.class,projectId);
        Integer unmapped=jdbc.queryForObject("SELECT count(*) FROM emission_activity_data WHERE project_id=? AND factor_id IS NULL",Integer.class,projectId);
        if(total==null||total==0) throw new IllegalArgumentException("산정할 활동자료가 없습니다.");
        if(unmapped!=null&&unmapped>0) throw new IllegalArgumentException("미매핑 활동자료 "+unmapped+"건을 먼저 처리해 주세요.");
        Integer version=jdbc.queryForObject("SELECT coalesce(max(version_no),0)+1 FROM emission_calculation_run WHERE project_id=?",Integer.class,projectId);
        Double sum=jdbc.queryForObject("SELECT coalesce(sum(a.quantity*f.factor_value),0) FROM emission_activity_data a JOIN emission_factor_reference f ON f.factor_id=a.factor_id WHERE a.project_id=?",Double.class,projectId);
        Long id=jdbc.queryForObject("INSERT INTO emission_calculation_run(project_id,version_no,total_emission) VALUES (?,?,?) RETURNING calculation_id",Long.class,projectId,version,sum);
        jdbc.update("INSERT INTO emission_calculation_item(calculation_id,activity_id,quantity,factor_value,emission_value) SELECT ?,a.activity_id,a.quantity,f.factor_value,a.quantity*f.factor_value FROM emission_activity_data a JOIN emission_factor_reference f ON f.factor_id=a.factor_id WHERE a.project_id=?",id,projectId);
        jdbc.update("UPDATE emission_project_registry SET progress_percent=50,current_step='배출량 산정',project_status='진행',updated_at=current_timestamp WHERE project_id=?",projectId);
        completeWorkflowTask(projectId,"CALCULATION","SYSTEM");
        jdbc.update("INSERT INTO emission_project_history(project_id,event_type,event_description,actor_name) SELECT ?,'CALCULATED','산정 버전 '||?||'이 생성되었습니다.',owner_name FROM emission_project_registry WHERE project_id=?",projectId,String.valueOf(version),projectId);
        return id==null?0:id;
    }

    public Map<String,Object> myTasks(String tenantId,String actorId,boolean showAll,String status,String period) {
        String tenant=requiredValue(tenantId,"tenantId");
        String state=status==null?"":status.trim(),range=period==null?"":period.trim();
        String actor=actorId==null?"":actorId.trim();
        String where=" WHERE p.tenant_id=? AND (? OR lower(coalesce(t.assignee_id,''))=lower(?)) AND (?='' OR t.task_status=?) AND (?='' OR (?='TODAY' AND t.due_date=current_date) OR (?='WEEK' AND t.due_date BETWEEN current_date AND current_date+7) OR (?='OVERDUE' AND t.due_date<current_date AND t.task_status<>'DONE'))";
        Object[] args={tenant,showAll,actor,state,state,range,range,range,range};
        List<Map<String,Object>> items=jdbc.queryForList("SELECT t.task_id AS \"id\",t.project_id AS \"projectId\",p.project_name AS \"projectName\",p.site_name AS \"site\",t.task_name AS \"name\",t.task_type AS \"type\",t.task_status AS \"status\",t.priority,t.assignee_id AS \"assignee\",t.due_date AS \"dueDate\",t.target_url AS \"targetUrl\",t.process_code AS \"processCode\",t.process_step_code AS \"processStepCode\",t.actor_code AS \"actorCode\",t.completion_rule AS \"completionRule\",t.blocked_reason AS \"blockedReason\",(t.task_status IN ('READY','IN_PROGRESS')) AS \"actionable\",coalesce((SELECT string_agg(p2.task_name,', ' ORDER BY p2.step_order) FROM emission_project_task p2 WHERE p2.project_id=t.project_id AND p2.task_code=ANY(string_to_array(nullif(t.predecessor_codes,''),',')) AND p2.task_status<>'DONE'),'') AS \"pendingPredecessors\" FROM emission_project_task t JOIN emission_project_registry p ON p.project_id=t.project_id"+where+" ORDER BY CASE t.task_status WHEN 'READY' THEN 0 WHEN 'IN_PROGRESS' THEN 1 WHEN 'BLOCKED' THEN 2 WHEN 'WAITING' THEN 3 ELSE 4 END,CASE t.priority WHEN 'URGENT' THEN 0 WHEN 'HIGH' THEN 1 ELSE 2 END,t.due_date,t.step_order",args);
        Map<String,Object> result=new LinkedHashMap<>(); result.put("items",items);result.put("actorId",actor);result.put("allVisible",showAll);
        result.put("summary",jdbc.queryForMap("SELECT count(*) AS total,count(*) FILTER(WHERE t.task_status='DONE') AS completed,count(*) FILTER(WHERE t.due_date=current_date AND t.task_status<>'DONE') AS today,count(*) FILTER(WHERE t.due_date<current_date AND t.task_status<>'DONE') AS overdue,count(*) FILTER(WHERE t.task_code='APPROVAL' AND t.task_status<>'DONE') AS approval FROM emission_project_task t JOIN emission_project_registry p ON p.project_id=t.project_id WHERE p.tenant_id=?"+(showAll?"":" AND lower(coalesce(t.assignee_id,''))=lower(?)"),showAll?new Object[]{tenant}:new Object[]{tenant,actor}));
        return result;
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
    public Map<String,Object> runQuality(String projectId,String tenantId,String actor) {
        Map<String,Object> project=detail(projectId);
        String tenant=requiredValue(tenantId,"tenantId"),user=requiredValue(actor,"actor");
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
            if(row.get("factorId")==null) issues.add(issue(id,"UNMAPPED_FACTOR","BLOCKING","factorId","배출계수가 매핑되지 않았습니다.","배출계수 매핑 탭에서 적합한 계수를 선택하세요."));
            else if(row.get("factorUnit")!=null&&!unit.equals(text(row.get("factorUnit")))) issues.add(issue(id,"FACTOR_UNIT_MISMATCH","BLOCKING","factorId","활동자료 단위와 배출계수 단위가 다릅니다.","단위를 정정하거나 동일 단위의 배출계수를 다시 매핑하세요."));
            if(note.isBlank()) issues.add(issue(id,"MISSING_EVIDENCE","WARNING","note","증빙 또는 산정 근거가 없습니다.","증빙자료 설명이나 원본 문서 식별 정보를 입력하세요."));
            if(!period.matches("\\d{4}-(0[1-9]|1[0-2])")) issues.add(issue(id,"INVALID_PERIOD","BLOCKING","period","기간 형식이 올바르지 않습니다.","YYYY-MM 형식의 기간을 입력하세요."));
            else if((!start.isBlank()&&period.compareTo(start.substring(0,Math.min(7,start.length())))<0)||(!end.isBlank()&&period.compareTo(end.substring(0,Math.min(7,end.length())))>0)) issues.add(issue(id,"PERIOD_OUT_OF_RANGE","BLOCKING","period","프로젝트 산정기간을 벗어났습니다.","프로젝트 산정기간 안의 월로 정정하세요."));
        }
        List<Map<String,Object>> duplicates=jdbc.queryForList("SELECT min(activity_id) AS id,count(*) AS duplicate_count FROM emission_activity_data WHERE project_id=? GROUP BY lower(trim(activity_name)),category,activity_period,unit HAVING count(*)>1",projectId);
        for(Map<String,Object> duplicate:duplicates) issues.add(issue(((Number)duplicate.get("id")).longValue(),"POSSIBLE_DUPLICATE","WARNING","name","동일한 명칭·구분·기간·단위의 자료가 "+duplicate.get("duplicate_count")+"건 있습니다.","원본 행을 비교하여 중복이면 삭제하고, 별도 자료라면 구분 근거를 비고에 입력하세요."));
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
    public Map<String,Object> saveSubmission(String projectId,String tenantId,String actor,Map<String,Object> body) {
        Map<String,Object> project=detail(projectId);
        String tenant=requiredValue(tenantId,"tenantId"),user=requiredValue(actor,"actor"),key=required(body,"idempotencyKey");
        List<Map<String,Object>> existing=jdbc.queryForList("SELECT submission_id AS id,submission_state AS state,version_no AS version FROM emission_activity_submission WHERE project_id=? AND tenant_id=? AND idempotency_key=?",projectId,tenant,key);
        if(!existing.isEmpty()) return new LinkedHashMap<>(existing.get(0));
        LocalDate deadline=project.get("dueDate")==null?null:LocalDate.parse(String.valueOf(project.get("dueDate")));
        Integer version=jdbc.queryForObject("SELECT coalesce(max(version_no),0)+1 FROM emission_activity_submission WHERE project_id=? AND tenant_id=?",Integer.class,projectId,tenant);
        Long id=jdbc.queryForObject("INSERT INTO emission_activity_submission(project_id,tenant_id,site_name,version_no,idempotency_key,deadline_date) VALUES (?,?,?,?,?,?) RETURNING submission_id",Long.class,projectId,tenant,String.valueOf(project.get("site")),version,key,deadline);
        jdbc.update("INSERT INTO emission_activity_submission_event(submission_id,event_type,event_actor,previous_state,new_state,event_note) VALUES (?,'CREATED',?,null,'DRAFT','활동자료 제출 초안 생성')",id,user);
        return Map.of("id",id==null?0:id,"state","DRAFT","version",version==null?1:version,"created",true);
    }

    @Transactional
    public Map<String,Object> submitActivities(String projectId,long submissionId,String tenantId,String actor,Map<String,Object> body) {
        String tenant=requiredValue(tenantId,"tenantId"),user=requiredValue(actor,"actor");
        List<Map<String,Object>> rows=jdbc.queryForList("SELECT submission_state AS state,deadline_date AS deadline FROM emission_activity_submission WHERE submission_id=? AND project_id=? AND tenant_id=? FOR UPDATE",submissionId,projectId,tenant);
        if(rows.isEmpty()) throw new SecurityException("SUBMISSION_SCOPE_DENIED");
        String state=String.valueOf(rows.get(0).get("state"));
        if("SUBMITTED".equals(state)) return Map.of("id",submissionId,"state",state,"duplicate",true);
        Object deadlineValue=rows.get(0).get("deadline");
        if(deadlineValue!=null&&LocalDate.parse(String.valueOf(deadlineValue)).isBefore(LocalDate.now())&&!Boolean.TRUE.equals(body.get("deadlineExtended"))) throw new IllegalStateException("SUBMISSION_DEADLINE_EXPIRED");
        Object raw=body.get("activityIds");
        if(!(raw instanceof List<?> ids)||ids.isEmpty()) throw new IllegalArgumentException("ACTIVITY_REQUIRED_FIELDS_MISSING");
        Map<String,Object> quality=runQuality(projectId,tenant,user);
        if(!Boolean.TRUE.equals(quality.get("submitReady"))) throw new IllegalStateException("QUALITY_CHECK_BLOCKED:"+quality.get("blockingCount"));
        for(Object item:ids) {
            long activityId=Long.parseLong(String.valueOf(item));
            Integer count=jdbc.queryForObject("SELECT count(*) FROM emission_activity_data WHERE activity_id=? AND project_id=? AND quantity>=0 AND unit<>''",Integer.class,activityId,projectId);
            if(count==null||count==0) throw new IllegalArgumentException("ACTIVITY_REQUIRED_FIELDS_MISSING");
            jdbc.update("INSERT INTO emission_activity_submission_evidence(submission_id,activity_id,evidence_type,evidence_name,uploaded_actor) VALUES (?,?,'ACTIVITY_DATA','등록 활동자료',?) ON CONFLICT(submission_id,activity_id,evidence_type) DO NOTHING",submissionId,activityId,user);
        }
        jdbc.update("UPDATE emission_activity_submission SET submission_state='SUBMITTED',submitted_actor=?,submitted_at=current_timestamp,updated_at=current_timestamp WHERE submission_id=?",user,submissionId);
        jdbc.update("INSERT INTO emission_activity_submission_event(submission_id,event_type,event_actor,previous_state,new_state,event_note) VALUES (?,'SUBMITTED',?,'DRAFT','SUBMITTED','활동자료 제출 완료')",submissionId,user);
        jdbc.update("UPDATE emission_project_registry SET current_step='활동자료 제출',progress_percent=greatest(progress_percent,30),updated_at=current_timestamp WHERE project_id=?",projectId);
        completeWorkflowTask(projectId,"ACTIVITY_DATA",user);
        return Map.of("id",submissionId,"state","SUBMITTED","duplicate",false);
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

    @Transactional
    public Map<String,Object> startVerification(String projectId,long submissionId,String tenantId,String actor,boolean override) {
        String tenant=requiredValue(tenantId,"tenantId"),user=requiredValue(actor,"actor");
        requireProjectActor(projectId,tenant,user,"VERIFIER",override);
        List<Map<String,Object>> rows=jdbc.queryForList("SELECT submission_state AS state FROM emission_activity_submission WHERE submission_id=? AND project_id=? AND tenant_id=? FOR UPDATE",submissionId,projectId,tenant);
        if(rows.isEmpty()) throw new SecurityException("SUBMISSION_SCOPE_DENIED");
        String state=text(rows.get(0).get("state"));
        if(!List.of("SUBMITTED","IN_VERIFICATION").contains(state)) throw new IllegalStateException("VERIFICATION_STATE_INVALID:"+state);
        if("SUBMITTED".equals(state)) {
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
    }

    @Transactional
    public String copy(String sourceId,String tenantId) {
        assertTenantAccess(sourceId,tenantId);
        Map<String, Object> source = detail(sourceId);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", source.get("name") + " - 복사본"); body.put("site", source.get("site")); body.put("owner", source.get("owner"));
        body.put("reportingYear", source.get("reportingYear")); body.put("periodStart", source.get("periodStart")); body.put("periodEnd", source.get("periodEnd")); body.put("dueDate", source.get("dueDate"));
        body.put("scopes", List.of(String.valueOf(source.get("scope")).split("·")));
        return create(tenantId,body);
    }

    @Transactional
    public String create(String tenantId,Map<String, Object> body) {
        String tenant=requiredValue(tenantId,"tenantId");
        String name = required(body, "name"), site = required(body, "site"), owner = required(body, "owner");
        LocalDate start = LocalDate.parse(required(body, "periodStart")), end = LocalDate.parse(required(body, "periodEnd")), due = LocalDate.parse(required(body, "dueDate"));
        int year = Integer.parseInt(required(body, "reportingYear"));
        if (end.isBefore(start)) throw new IllegalArgumentException("산정 종료일은 시작일보다 빠를 수 없습니다.");
        if (due.isBefore(start)) throw new IllegalArgumentException("마감일은 산정 시작일보다 빠를 수 없습니다.");
        if (!nameAvailable(tenant,name)) throw new IllegalArgumentException("이미 등록된 프로젝트명입니다.");
        Object raw = body.get("scopes");
        if (!(raw instanceof List<?> values) || values.isEmpty()) throw new IllegalArgumentException("산정 Scope를 하나 이상 선택해 주세요.");
        String scope = values.stream().map(String::valueOf).filter(v -> v.matches("Scope [123]")).distinct().sorted().reduce((a,b) -> a + "·" + b).orElseThrow(() -> new IllegalArgumentException("유효한 Scope를 선택해 주세요."));
        String id = "PRJ-" + LocalDate.now().getYear() + "-" + UUID.randomUUID().toString().substring(0,6).toUpperCase();
        jdbc.update("INSERT INTO emission_project_registry(project_id,tenant_id,project_name,site_name,calculation_period,scope_name,owner_name,progress_percent,current_step,due_date,project_status,reporting_year,period_start,period_end) VALUES (?,?,?,?,?,?,?,0,'프로젝트 생성',?,'진행',?,?,?)", id,tenant,name,site,start+" ~ "+end,scope,owner,due,year,start,end);
        jdbc.update("INSERT INTO emission_project_member(project_id,member_name,role_code) VALUES (?,?,'OWNER')", id, owner);
        String[][] tasks = {{"BASIC_INFO","기본정보 확인"},{"ACTIVITY_DATA","활동자료 수집"},{"CALCULATION","배출량 산정"},{"VERIFICATION","데이터 검증"},{"APPROVAL","검토·승인"},{"REPORT","확정·보고"}};
        for (int i=0;i<tasks.length;i++) jdbc.update("INSERT INTO emission_project_task(project_id,task_code,task_name,step_order,task_status,progress_weight,due_date) VALUES (?,?,?,?,?,?,?)",id,tasks[i][0],tasks[i][1],i+1,i==0?"IN_PROGRESS":"WAITING",i==0?10:18,due);
        jdbc.update("UPDATE emission_project_task SET process_code='EMISSION_PROJECT',process_step_code=CASE task_code WHEN 'BASIC_INFO' THEN 'EMISSION_PROJECT_SETUP' WHEN 'ACTIVITY_DATA' THEN 'EMISSION_PROJECT_COLLECT' WHEN 'CALCULATION' THEN 'EMISSION_PROJECT_CALCULATE' WHEN 'VERIFICATION' THEN 'EMISSION_PROJECT_VALIDATE' WHEN 'APPROVAL' THEN 'EMISSION_PROJECT_APPROVE' WHEN 'REPORT' THEN 'EMISSION_PROJECT_REPORT' END,actor_code=CASE task_code WHEN 'BASIC_INFO' THEN 'COMPANY_MANAGER' WHEN 'ACTIVITY_DATA' THEN 'SITE_DATA_OWNER' WHEN 'CALCULATION' THEN 'CALCULATOR' WHEN 'VERIFICATION' THEN 'VERIFIER' WHEN 'APPROVAL' THEN 'APPROVER' WHEN 'REPORT' THEN 'COMPANY_MANAGER' END,predecessor_codes=CASE task_code WHEN 'ACTIVITY_DATA' THEN 'BASIC_INFO' WHEN 'CALCULATION' THEN 'ACTIVITY_DATA' WHEN 'VERIFICATION' THEN 'CALCULATION' WHEN 'APPROVAL' THEN 'VERIFICATION' WHEN 'REPORT' THEN 'APPROVAL' ELSE '' END,completion_rule=CASE task_code WHEN 'BASIC_INFO' THEN '프로젝트 기본정보와 산정기간이 확정됨' WHEN 'ACTIVITY_DATA' THEN '품질검사를 통과한 활동자료가 제출됨' WHEN 'CALCULATION' THEN '배출량 산정 버전이 생성됨' WHEN 'VERIFICATION' THEN '검증 오류가 없고 검증 이력이 생성됨' WHEN 'APPROVAL' THEN '권한 있는 승인자가 결과를 승인함' WHEN 'REPORT' THEN '확정 결과 보고서가 발행됨' END WHERE project_id=?",id);
        jdbc.update("UPDATE emission_project_task SET target_url=CASE task_code WHEN 'BASIC_INFO' THEN '/emission/project/detail?id='||project_id WHEN 'ACTIVITY_DATA' THEN '/emission/data_input?projectId='||project_id WHEN 'CALCULATION' THEN '/emission/simulate?projectId='||project_id WHEN 'VERIFICATION' THEN '/emission/validate?projectId='||project_id WHEN 'APPROVAL' THEN '/emission/validate?projectId='||project_id WHEN 'REPORT' THEN '/emission/report_submit?projectId='||project_id END WHERE project_id=?",id);
        completeWorkflowTask(id,"BASIC_INFO",owner);
        jdbc.update("INSERT INTO framework_project_actor_assignment(project_id,actor_code,user_id) VALUES (?,'COMPANY_MANAGER',?),(?,'SITE_DATA_OWNER',?),(?,'CALCULATOR',?) ON CONFLICT DO NOTHING",id,owner,id,owner,id,owner);
        jdbc.update("INSERT INTO emission_project_history(project_id,event_type,event_description,actor_name) VALUES (?,'CREATED','배출량 프로젝트가 생성되었습니다.',?)", id, owner);
        return id;
    }

    @Transactional public int delete(String id,String tenantId) { return jdbc.update("DELETE FROM emission_project_registry WHERE project_id=? AND tenant_id=?",id,requiredValue(tenantId,"tenantId")); }
    private String required(Map<String,Object> body,String key) { String value=String.valueOf(body.getOrDefault(key,"")).trim(); if(value.isEmpty()) throw new IllegalArgumentException(key+" is required"); return value; }
    private String requiredValue(String value,String key) { String normalized=value==null?"":value.trim(); if(normalized.isEmpty()) throw new IllegalArgumentException(key+" is required"); return normalized; }
}
