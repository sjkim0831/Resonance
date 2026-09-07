package egovframework.com.web;

import egovframework.com.feature.auth.util.JwtTokenProvider;
import egovframework.com.service.CustomerTraceApprovalLedgerService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/api/admin/process-preview-recorder-audit", "/en/api/admin/process-preview-recorder-audit"})
public class ProcessPreviewRecorderAuditController {
    private final JdbcTemplate jdbc;
    private final JwtTokenProvider jwt;
    private final CustomerTraceApprovalLedgerService authority;

    public ProcessPreviewRecorderAuditController(
            JdbcTemplate jdbc, JwtTokenProvider jwt,
            CustomerTraceApprovalLedgerService authority) {
        this.jdbc = jdbc;
        this.jwt = jwt;
        this.authority = authority;
    }

    @GetMapping
    public Map<String, Object> list(Principal principal, HttpServletRequest request) {
        requireAdmin(principal, request);
        List<Map<String, Object>> entries = jdbc.queryForList("""
            select id,source_code as "sourceCode",event_type as "eventType",status,alert,coalesce(reason,'') as reason,
                   coalesce(process_code,'') as "processCode",
                   consecutive_failures as "consecutiveFailures",duration_ms as "durationMs",
                   severity,coalesce(assigned_actor,'') as "assignedActor",
                   workflow_status as "workflowStatus",due_at as "dueAt",
                   escalation_level as "escalationLevel",escalated_at as "escalatedAt",
                   coalesce((select string_agg(d.channel||':'||d.delivery_status||'('||d.attempt_no||')', ', ' order by d.channel)
                       from process_preview_runtime_alert_delivery d
                       join (select channel,max(attempt_no) attempt_no from process_preview_runtime_alert_delivery
                              where audit_id=process_preview_recording_audit.id group by channel) latest
                         on latest.channel=d.channel and latest.attempt_no=d.attempt_no
                      where d.audit_id=process_preview_recording_audit.id),'') as "deliverySummary",
                   (select count(*)::integer from process_preview_runtime_alert_delivery d
                      where d.audit_id=process_preview_recording_audit.id) as "deliveryAttemptCount",
                   acknowledgement_status as "acknowledgementStatus",
                   acknowledged_by as "acknowledgedBy",acknowledged_at as "acknowledgedAt",
                   occurred_at as "occurredAt"
              from process_preview_recording_audit
             order by occurred_at desc,id desc limit 500
            """);
        Integer unacknowledged = jdbc.queryForObject("""
            select count(*)::integer from process_preview_recording_audit
             where event_type='FAILURE' and acknowledgement_status='UNACKNOWLEDGED'
            """, Integer.class);
        return Map.of("success", true, "entries", entries,
                "unacknowledgedCount", unacknowledged == null ? 0 : unacknowledged);
    }

    @GetMapping("/{id}/transitions")
    public Map<String, Object> transitions(@PathVariable long id, Principal principal,
            HttpServletRequest request) {
        requireAdmin(principal, request);
        List<Map<String, Object>> items = jdbc.queryForList("""
            select id,coalesce(from_status,'') as "fromStatus",to_status as "toStatus",
                   actor,coalesce(detail,'') as detail,occurred_at as "occurredAt"
              from process_preview_recording_audit_transition
             where audit_id=? order by occurred_at,id
            """, id);
        return Map.of("success", true, "auditId", id, "transitions", items);
    }

    @PostMapping("/{id}/resolve")
    public ResponseEntity<?> resolve(@PathVariable long id, Principal principal,
            HttpServletRequest request) {
        String account = requireAdmin(principal, request);
        List<String> states = jdbc.query("""
            select workflow_status from process_preview_recording_audit
             where id=? and event_type='FAILURE'
            """, (rs, rowNum) -> rs.getString(1), id);
        if (states.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("success", false, "message", "조치할 장애 이력이 없습니다."));
        if (!"ASSIGNED".equals(states.get(0))) return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("success", false, "message", "배정 상태의 장애만 조치 완료할 수 있습니다.",
                        "workflowStatus", states.get(0)));
        int changed = jdbc.update("""
            update process_preview_recording_audit
               set workflow_status='RESOLVED',resolved_at=current_timestamp,
                   resolved_by=?,resolution_note='관리자 알림센터 조치 완료'
             where id=? and event_type='FAILURE' and workflow_status='ASSIGNED'
            """, account, id);
        if (changed == 1) jdbc.update("""
            insert into process_preview_recording_audit_transition
                (audit_id,from_status,to_status,actor,detail)
            values (?,'ASSIGNED','RESOLVED',?,'관리자 알림센터 조치 완료')
            """, id, account);
        return ResponseEntity.ok(Map.of("success", true, "changed", changed == 1,
                "id", id, "resolvedBy", account, "workflowStatus", "RESOLVED"));
    }

    @PostMapping("/{id}/acknowledge")
    public ResponseEntity<?> acknowledge(@PathVariable long id, Principal principal,
            HttpServletRequest request) {
        String account = requireAdmin(principal, request);
        int exists = jdbc.queryForObject("""
            select count(*) from process_preview_recording_audit
             where id=? and event_type='FAILURE'
            """, Integer.class, id);
        if (exists != 1) return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("success", false, "message", "확인할 장애 이력이 없습니다."));
        String workflowStatus = jdbc.queryForObject("""
            select workflow_status from process_preview_recording_audit where id=?
            """, String.class, id);
        if (!"RESOLVED".equals(workflowStatus)) return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("success", false, "message", "조치 완료 상태의 장애만 종료할 수 있습니다.",
                        "workflowStatus", workflowStatus == null ? "" : workflowStatus));
        int changed = jdbc.update("""
            update process_preview_recording_audit
               set acknowledgement_status='ACKNOWLEDGED',acknowledged_at=current_timestamp,
                   acknowledged_by=?,workflow_status='CLOSED'
             where id=? and event_type='FAILURE'
               and acknowledgement_status='UNACKNOWLEDGED' and workflow_status='RESOLVED'
            """, account, id);
        if (changed == 1) jdbc.update("""
            insert into process_preview_recording_audit_transition
                (audit_id,from_status,to_status,actor,detail)
            values (?,'RESOLVED','CLOSED',?,'관리자 확인 및 종료')
            """, id, account);
        return ResponseEntity.ok(Map.of("success", true, "changed", changed == 1,
                "id", id, "acknowledgedBy", account));
    }

    private String requireAdmin(Principal principal, HttpServletRequest request) {
        String userId = principal == null ? "" : safe(principal.getName());
        if (userId.isEmpty()) {
            String token = jwt.getCookie(request, "accessToken");
            if (!token.isEmpty() && jwt.accessValidateToken(token) == 200) {
                Object encrypted = jwt.accessExtractClaims(token).get("userId");
                userId = encrypted == null ? "" : safe(jwt.decrypt(encrypted.toString()));
            }
        }
        if (userId.isEmpty()) throw new AuditAccessException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
        if (!authority.isCustomerTraceAdmin(userId))
            throw new AuditAccessException(HttpStatus.FORBIDDEN, "관리자 권한이 필요합니다.");
        return userId;
    }

    private static String safe(String value) { return value == null ? "" : value.trim(); }

    @ExceptionHandler(AuditAccessException.class)
    public ResponseEntity<Map<String, Object>> access(AuditAccessException error) {
        return ResponseEntity.status(error.status).body(Map.of("success", false, "message", error.getMessage()));
    }

    private static final class AuditAccessException extends RuntimeException {
        private final HttpStatus status;
        private AuditAccessException(HttpStatus status, String message) { super(message); this.status = status; }
    }
}
