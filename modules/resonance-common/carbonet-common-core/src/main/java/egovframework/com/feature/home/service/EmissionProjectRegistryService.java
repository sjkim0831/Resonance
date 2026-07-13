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
import java.io.InputStream;

@Service
public class EmissionProjectRegistryService {
    private final JdbcTemplate jdbc;
    public EmissionProjectRegistryService(DataSource dataSource) { this.jdbc = new JdbcTemplate(dataSource); }

    public Map<String, Object> list(String keyword, String status, String site, int page) {
        String term = keyword == null ? "" : keyword.trim(), state = status == null ? "" : status.trim(), siteName = site == null ? "" : site.trim();
        int pageIndex = Math.max(1, page), size = 10;
        String where = " WHERE (? = '' OR lower(project_id || ' ' || project_name || ' ' || site_name || ' ' || owner_name) LIKE lower(?)) AND (? = '' OR project_status = ?) AND (? = '' OR site_name = ?)";
        String like = "%" + term + "%";
        Integer total = jdbc.queryForObject("SELECT count(*) FROM emission_project_registry" + where, Integer.class, term, like, state, state, siteName, siteName);
        List<Map<String, Object>> items = jdbc.queryForList("SELECT project_id AS \"id\", project_name AS \"name\", site_name AS \"site\", calculation_period AS \"period\", scope_name AS \"scope\", owner_name AS \"owner\", progress_percent AS \"progress\", current_step AS \"step\", due_date AS \"dueDate\", project_status AS \"status\" FROM emission_project_registry" + where + " ORDER BY CASE WHEN project_status='완료' THEN 1 ELSE 0 END, due_date NULLS LAST, created_at DESC LIMIT 10 OFFSET ?", term, like, state, state, siteName, siteName, (pageIndex - 1) * size);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", items); result.put("total", total == null ? 0 : total); result.put("page", pageIndex); result.put("size", size);
        result.put("summary", jdbc.queryForList("SELECT project_status AS status, count(*) AS count FROM emission_project_registry GROUP BY project_status"));
        result.put("sites", jdbc.queryForList("SELECT DISTINCT site_name FROM emission_project_registry ORDER BY site_name", String.class));
        return result;
    }

    public boolean nameAvailable(String name) {
        Integer count = jdbc.queryForObject("SELECT count(*) FROM emission_project_registry WHERE lower(trim(project_name))=lower(trim(?))", Integer.class, name == null ? "" : name);
        return count == null || count == 0;
    }

    public Map<String, Object> options(String keyword) {
        String term = keyword == null ? "" : keyword.trim(), like = "%" + term + "%";
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sites", jdbc.queryForList("SELECT DISTINCT site_name FROM emission_project_registry WHERE (?='' OR site_name ILIKE ?) ORDER BY site_name LIMIT 20", String.class, term, like));
        result.put("owners", jdbc.queryForList("SELECT DISTINCT owner_name FROM emission_project_registry WHERE (?='' OR owner_name ILIKE ?) ORDER BY owner_name LIMIT 20", String.class, term, like));
        return result;
    }

    public Map<String, Object> detail(String id) {
        List<Map<String, Object>> projects = jdbc.queryForList("SELECT project_id AS \"id\",project_name AS \"name\",site_name AS \"site\",calculation_period AS \"period\",scope_name AS \"scope\",owner_name AS \"owner\",progress_percent AS \"progress\",current_step AS \"step\",due_date AS \"dueDate\",project_status AS \"status\",reporting_year AS \"reportingYear\",period_start AS \"periodStart\",period_end AS \"periodEnd\" FROM emission_project_registry WHERE project_id=?", id);
        if (projects.isEmpty()) throw new IllegalArgumentException("프로젝트를 찾을 수 없습니다.");
        Map<String, Object> result = new LinkedHashMap<>(projects.get(0));
        result.put("tasks", jdbc.queryForList("SELECT task_code AS \"code\",task_name AS \"name\",step_order AS \"order\",task_status AS \"status\",progress_weight AS \"weight\",due_date AS \"dueDate\" FROM emission_project_task WHERE project_id=? ORDER BY step_order", id));
        result.put("members", jdbc.queryForList("SELECT member_name AS \"name\",role_code AS \"role\" FROM emission_project_member WHERE project_id=? ORDER BY created_at", id));
        result.put("history", jdbc.queryForList("SELECT event_type AS \"type\",event_description AS \"description\",actor_name AS \"actor\",created_at AS \"createdAt\" FROM emission_project_history WHERE project_id=? ORDER BY created_at DESC LIMIT 30", id));
        return result;
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
        jdbc.update("UPDATE emission_project_task SET task_status=CASE WHEN task_code IN ('BASIC_INFO','ACTIVITY_DATA') THEN 'DONE' WHEN task_code='CALCULATION' THEN 'IN_PROGRESS' ELSE task_status END WHERE project_id=?",projectId);
        jdbc.update("INSERT INTO emission_project_history(project_id,event_type,event_description,actor_name) SELECT ?,'CALCULATED','산정 버전 '||?||'이 생성되었습니다.',owner_name FROM emission_project_registry WHERE project_id=?",projectId,String.valueOf(version),projectId);
        return id==null?0:id;
    }

    public Map<String,Object> myTasks(String actorId,boolean showAll,String status,String period) {
        String state=status==null?"":status.trim(),range=period==null?"":period.trim();
        String actor=actorId==null?"":actorId.trim();
        String where=" WHERE (? OR lower(coalesce(t.assignee_id,''))=lower(?)) AND (?='' OR t.task_status=?) AND (?='' OR (?='TODAY' AND t.due_date=current_date) OR (?='WEEK' AND t.due_date BETWEEN current_date AND current_date+7) OR (?='OVERDUE' AND t.due_date<current_date AND t.task_status<>'DONE'))";
        Object[] args={showAll,actor,state,state,range,range,range,range};
        List<Map<String,Object>> items=jdbc.queryForList("SELECT t.task_id AS \"id\",t.project_id AS \"projectId\",p.project_name AS \"projectName\",p.site_name AS \"site\",t.task_name AS \"name\",t.task_type AS \"type\",t.task_status AS \"status\",t.priority,t.assignee_id AS \"assignee\",t.due_date AS \"dueDate\",t.target_url AS \"targetUrl\" FROM emission_project_task t JOIN emission_project_registry p ON p.project_id=t.project_id"+where+" ORDER BY CASE WHEN t.task_status='DONE' THEN 1 ELSE 0 END,CASE t.priority WHEN 'URGENT' THEN 0 WHEN 'HIGH' THEN 1 ELSE 2 END,t.due_date,t.step_order",args);
        Map<String,Object> result=new LinkedHashMap<>(); result.put("items",items);result.put("actorId",actor);result.put("allVisible",showAll);
        result.put("summary",jdbc.queryForMap("SELECT count(*) AS total,count(*) FILTER(WHERE t.task_status='DONE') AS completed,count(*) FILTER(WHERE t.due_date=current_date AND t.task_status<>'DONE') AS today,count(*) FILTER(WHERE t.due_date<current_date AND t.task_status<>'DONE') AS overdue,count(*) FILTER(WHERE t.task_code='APPROVAL' AND t.task_status<>'DONE') AS approval FROM emission_project_task t"+(showAll?"":" WHERE lower(coalesce(t.assignee_id,''))=lower('"+actor.replace("'","''")+"')")));
        return result;
    }

    @Transactional public int updateTask(long taskId,String status) { if(!List.of("WAITING","IN_PROGRESS","DONE").contains(status))throw new IllegalArgumentException("올바른 상태가 아닙니다.");return jdbc.update("UPDATE emission_project_task SET task_status=?,updated_at=current_timestamp WHERE task_id=?",status,taskId); }

    @Transactional
    public String copy(String sourceId) {
        Map<String, Object> source = detail(sourceId);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", source.get("name") + " - 복사본"); body.put("site", source.get("site")); body.put("owner", source.get("owner"));
        body.put("reportingYear", source.get("reportingYear")); body.put("periodStart", source.get("periodStart")); body.put("periodEnd", source.get("periodEnd")); body.put("dueDate", source.get("dueDate"));
        body.put("scopes", List.of(String.valueOf(source.get("scope")).split("·")));
        return create(body);
    }

    @Transactional
    public String create(Map<String, Object> body) {
        String name = required(body, "name"), site = required(body, "site"), owner = required(body, "owner");
        LocalDate start = LocalDate.parse(required(body, "periodStart")), end = LocalDate.parse(required(body, "periodEnd")), due = LocalDate.parse(required(body, "dueDate"));
        int year = Integer.parseInt(required(body, "reportingYear"));
        if (end.isBefore(start)) throw new IllegalArgumentException("산정 종료일은 시작일보다 빠를 수 없습니다.");
        if (due.isBefore(start)) throw new IllegalArgumentException("마감일은 산정 시작일보다 빠를 수 없습니다.");
        if (!nameAvailable(name)) throw new IllegalArgumentException("이미 등록된 프로젝트명입니다.");
        Object raw = body.get("scopes");
        if (!(raw instanceof List<?> values) || values.isEmpty()) throw new IllegalArgumentException("산정 Scope를 하나 이상 선택해 주세요.");
        String scope = values.stream().map(String::valueOf).filter(v -> v.matches("Scope [123]")).distinct().sorted().reduce((a,b) -> a + "·" + b).orElseThrow(() -> new IllegalArgumentException("유효한 Scope를 선택해 주세요."));
        String id = "PRJ-" + LocalDate.now().getYear() + "-" + UUID.randomUUID().toString().substring(0,6).toUpperCase();
        jdbc.update("INSERT INTO emission_project_registry(project_id,project_name,site_name,calculation_period,scope_name,owner_name,progress_percent,current_step,due_date,project_status,reporting_year,period_start,period_end) VALUES (?,?,?,?,?,?,0,'프로젝트 생성',?,'진행',?,?,?)", id,name,site,start+" ~ "+end,scope,owner,due,year,start,end);
        jdbc.update("INSERT INTO emission_project_member(project_id,member_name,role_code) VALUES (?,?,'OWNER')", id, owner);
        String[][] tasks = {{"BASIC_INFO","기본정보 확인"},{"ACTIVITY_DATA","활동자료 수집"},{"CALCULATION","배출량 산정"},{"VERIFICATION","데이터 검증"},{"APPROVAL","검토·승인"},{"REPORT","확정·보고"}};
        for (int i=0;i<tasks.length;i++) jdbc.update("INSERT INTO emission_project_task(project_id,task_code,task_name,step_order,task_status,progress_weight,due_date) VALUES (?,?,?,?,?,?,?)",id,tasks[i][0],tasks[i][1],i+1,i==0?"IN_PROGRESS":"WAITING",i==0?10:18,due);
        jdbc.update("INSERT INTO emission_project_history(project_id,event_type,event_description,actor_name) VALUES (?,'CREATED','배출량 프로젝트가 생성되었습니다.',?)", id, owner);
        return id;
    }

    @Transactional public int delete(String id) { return jdbc.update("DELETE FROM emission_project_registry WHERE project_id=?", id); }
    private String required(Map<String,Object> body,String key) { String value=String.valueOf(body.getOrDefault(key,"")).trim(); if(value.isEmpty()) throw new IllegalArgumentException(key+" is required"); return value; }
}
