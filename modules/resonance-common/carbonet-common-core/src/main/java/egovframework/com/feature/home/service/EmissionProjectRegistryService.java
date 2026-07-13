package egovframework.com.feature.home.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import javax.sql.DataSource;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

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
