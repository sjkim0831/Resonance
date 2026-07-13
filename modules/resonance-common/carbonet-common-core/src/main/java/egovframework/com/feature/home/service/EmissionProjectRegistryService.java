package egovframework.com.feature.home.service;

import lombok.RequiredArgsConstructor;
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

    public EmissionProjectRegistryService(DataSource dataSource) {
        this.jdbc = new JdbcTemplate(dataSource);
    }

    public Map<String, Object> list(String keyword, String status, String site, int page) {
        String term = keyword == null ? "" : keyword.trim();
        String state = status == null ? "" : status.trim();
        String siteName = site == null ? "" : site.trim();
        int pageIndex = Math.max(1, page);
        int size = 10;
        String where = " WHERE (? = '' OR lower(project_id || ' ' || project_name || ' ' || site_name || ' ' || owner_name) LIKE lower(?))"
                + " AND (? = '' OR project_status = ?) AND (? = '' OR site_name = ?)";
        String like = "%" + term + "%";
        Object[] args = {term, like, state, state, siteName, siteName};
        Integer total = jdbc.queryForObject("SELECT count(*) FROM emission_project_registry" + where, Integer.class, args);
        List<Map<String, Object>> items = jdbc.queryForList("SELECT project_id AS \"id\", project_name AS \"name\", site_name AS \"site\", calculation_period AS \"period\", scope_name AS \"scope\", owner_name AS \"owner\", progress_percent AS \"progress\", current_step AS \"step\", due_date AS \"dueDate\", project_status AS \"status\" FROM emission_project_registry" + where + " ORDER BY CASE WHEN project_status='완료' THEN 1 ELSE 0 END, due_date NULLS LAST, created_at DESC LIMIT 10 OFFSET ?", term, like, state, state, siteName, siteName, (pageIndex - 1) * size);
        List<Map<String, Object>> summary = jdbc.queryForList("SELECT project_status AS status, count(*) AS count FROM emission_project_registry GROUP BY project_status");
        List<String> sites = jdbc.queryForList("SELECT DISTINCT site_name FROM emission_project_registry ORDER BY site_name", String.class);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", items); result.put("total", total == null ? 0 : total); result.put("page", pageIndex); result.put("size", size);
        result.put("summary", summary); result.put("sites", sites);
        return result;
    }

    @Transactional
    public String create(Map<String, Object> body) {
        String id = "PRJ-" + LocalDate.now().getYear() + "-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        jdbc.update("INSERT INTO emission_project_registry(project_id,project_name,site_name,calculation_period,scope_name,owner_name,progress_percent,current_step,due_date,project_status) VALUES (?,?,?,?,?,?,0,'프로젝트 생성',?,'진행')",
                id, required(body, "name"), required(body, "site"), required(body, "period"), required(body, "scope"), required(body, "owner"), LocalDate.parse(required(body, "dueDate")));
        return id;
    }

    @Transactional
    public int delete(String id) {
        return jdbc.update("DELETE FROM emission_project_registry WHERE project_id = ?", id);
    }

    private String required(Map<String, Object> body, String key) {
        String value = String.valueOf(body.getOrDefault(key, "")).trim();
        if (value.isEmpty()) throw new IllegalArgumentException(key + " is required");
        return value;
    }
}
