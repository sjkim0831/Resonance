package egovframework.com.feature.home.web;

import egovframework.com.feature.auth.service.CurrentUserContextService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/** Account-scoped inbox for non-emission process executions. Emission tasks have their own API and page. */
@RestController
public class GeneralMyWorkController {
    private final JdbcTemplate jdbc;
    private final CurrentUserContextService users;

    public GeneralMyWorkController(JdbcTemplate jdbc, CurrentUserContextService users) {
        this.jdbc = jdbc;
        this.users = users;
    }

    @GetMapping({"/home/api/my-work-items", "/en/home/api/my-work-items"})
    public ResponseEntity<?> items(HttpServletRequest request) {
        var user = users.resolve(request);
        if (!user.isAuthenticated()) return ResponseEntity.status(401).body(Map.of("success", false, "message", "AUTHENTICATION_REQUIRED"));
        String tenant = user.isWebmaster() || user.getInsttId() == null || user.getInsttId().isBlank() ? "DEFAULT" : user.getInsttId();
        try {
            var items = jdbc.queryForList("""
                select e.execution_id::text as "executionId", e.tenant_id as "tenantId", e.project_id as "projectId",
                       e.process_code as "processCode", coalesce(p.process_name,e.process_code) as "processName",
                       e.current_step_code as "currentStepCode", coalesce(s.step_name,e.current_step_code) as "stepName",
                       e.current_state as "currentState", s.actor_code as "actorCode", s.user_path as "targetUrl",
                       e.started_at as "startedAt"
                  from framework_process_execution e
                  join framework_process_definition p on p.process_code=e.process_code
                  join framework_process_step s on s.process_code=e.process_code and s.step_code=e.current_step_code
                 where e.tenant_id=? and e.execution_status='RUNNING'
                   and upper(coalesce(p.domain_code,'')) not in ('EMISSION','CARBON_EMISSION','CCUS_MRV','GHG','GREENHOUSE_GAS')
                   and exists (select 1 from framework_account_actor_assignment a
                                where a.tenant_id=e.tenant_id and lower(a.account_id)=lower(?)
                                  and a.actor_code=s.actor_code and a.assignment_status='ACTIVE'
                                  and (a.valid_from is null or a.valid_from<=current_date)
                                  and (a.valid_until is null or a.valid_until>=current_date)
                                  and a.project_id in ('*',e.project_id)
                                  and (a.data_scope='*' or e.project_id=any(string_to_array(replace(a.data_scope,' ',''),','))))
                 order by e.started_at desc nulls last, e.project_id, e.process_code
                """, tenant, user.getUserId());
            Map<String,Object> result = new LinkedHashMap<>();
            result.put("items", items);
            result.put("summary", Map.of("total", items.size(), "active", items.size()));
            result.put("scope", Map.of("tenantId", tenant, "accountId", user.getUserId(), "domainExclusion", "EMISSION", "assignmentChecked", true));
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("success", false, "message", "MY_WORK_UNAVAILABLE"));
        }
    }
}
