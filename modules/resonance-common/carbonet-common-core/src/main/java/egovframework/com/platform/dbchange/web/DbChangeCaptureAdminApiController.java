package egovframework.com.platform.dbchange.web;

import egovframework.com.platform.dbchange.mapper.DbChangeCaptureMapper;
import egovframework.com.platform.dbchange.service.DbChangeQueueService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping({
        "/api/platform/db-change",
        "/en/api/platform/db-change",
        "/admin/api/platform/db-change",
        "/en/admin/api/platform/db-change"
})
public class DbChangeCaptureAdminApiController {

    private final DbChangeCaptureMapper dbChangeCaptureMapper;
    private final DbChangeQueueService dbChangeQueueService;

    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getSummary(
            @RequestParam(value = "projectId", required = false) String projectId) {
        String normalizedProjectId = safe(projectId);
        if (normalizedProjectId.isEmpty()) {
            Map<String, Object> empty = new LinkedHashMap<String, Object>();
            empty.put("projectId", "");
            empty.put("totalChangeCount", 0);
            empty.put("autoQueuedChangeCount", 0);
            empty.put("approvalRequiredChangeCount", 0);
            empty.put("blockedChangeCount", 0);
            empty.put("pendingQueueCount", 0);
            empty.put("pendingApprovalQueueCount", 0);
            return ResponseEntity.ok(empty);
        }
        Map<String, Object> summary = dbChangeCaptureMapper.selectChangeCaptureSummary(normalizedProjectId);
        if (summary == null) {
            summary = new LinkedHashMap<String, Object>();
            summary.put("projectId", normalizedProjectId);
            summary.put("totalChangeCount", 0);
            summary.put("autoQueuedChangeCount", 0);
            summary.put("approvalRequiredChangeCount", 0);
            summary.put("blockedChangeCount", 0);
            summary.put("pendingQueueCount", 0);
            summary.put("pendingApprovalQueueCount", 0);
        }
        return ResponseEntity.ok(summary);
    }

    @GetMapping("/changes")
    public ResponseEntity<List<Map<String, Object>>> getChanges(
            @RequestParam(value = "projectId", required = false) String projectId,
            @RequestParam(value = "limit", required = false, defaultValue = "20") int limit) {
        return ResponseEntity.ok(dbChangeQueueService.getRecentBusinessChangeLogs(projectId, limit));
    }

    @GetMapping("/queue")
    public ResponseEntity<List<Map<String, Object>>> getQueue(
            @RequestParam(value = "projectId", required = false) String projectId,
            @RequestParam(value = "limit", required = false, defaultValue = "20") int limit) {
        return ResponseEntity.ok(dbChangeQueueService.getDeployableQueueList(projectId, limit));
    }

    @GetMapping("/results")
    public ResponseEntity<List<Map<String, Object>>> getResults(
            @RequestParam(value = "projectId", required = false) String projectId,
            @RequestParam(value = "limit", required = false, defaultValue = "20") int limit) {
        return ResponseEntity.ok(dbChangeQueueService.getDeployableResultList(projectId, limit));
    }

    @PostMapping("/changes/{changeLogId}/queue")
    public ResponseEntity<Map<String, Object>> queueChangeLog(
            HttpServletRequest request,
            @PathVariable("changeLogId") String changeLogId,
            @RequestBody(required = false) Map<String, Object> payload) {
        try {
            return ResponseEntity.ok(dbChangeQueueService.queueChangeLog(changeLogId, resolveActorId(request), payload));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(errorBody(e.getMessage()));
        }
    }

    @PostMapping("/queue/{queueId}/approve")
    public ResponseEntity<Map<String, Object>> approveQueue(
            HttpServletRequest request,
            @PathVariable("queueId") String queueId) {
        try {
            return ResponseEntity.ok(dbChangeQueueService.approveQueue(queueId, resolveActorId(request)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(errorBody(e.getMessage()));
        }
    }

    @PostMapping("/queue/{queueId}/reject")
    public ResponseEntity<Map<String, Object>> rejectQueue(
            HttpServletRequest request,
            @PathVariable("queueId") String queueId,
            @RequestBody(required = false) Map<String, Object> payload) {
        try {
            Object reasonValue = payload == null ? null : payload.get("reason");
            String reason = reasonValue == null ? "" : safe(String.valueOf(reasonValue));
            return ResponseEntity.ok(dbChangeQueueService.rejectQueue(queueId, resolveActorId(request), reason));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(errorBody(e.getMessage()));
        }
    }

    @PostMapping("/queue/{queueId}/execute")
    public ResponseEntity<Map<String, Object>> executeQueue(
            HttpServletRequest request,
            @PathVariable("queueId") String queueId,
            @RequestBody(required = false) Map<String, Object> payload) {
        try {
            return ResponseEntity.ok(dbChangeQueueService.executeQueue(queueId, resolveActorId(request), payload));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(errorBody(e.getMessage()));
        }
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String resolveActorId(HttpServletRequest request) {
        if (request == null) {
            return "system";
        }
        Object loginId = request.getSession(false) == null ? null : request.getSession(false).getAttribute("loginId");
        if (loginId != null && !String.valueOf(loginId).trim().isEmpty()) {
            return String.valueOf(loginId).trim();
        }
        Object userId = request.getSession(false) == null ? null : request.getSession(false).getAttribute("uniqId");
        if (userId != null && !String.valueOf(userId).trim().isEmpty()) {
            return String.valueOf(userId).trim();
        }
        return "system";
    }

    private Map<String, Object> errorBody(String message) {
        Map<String, Object> body = new LinkedHashMap<String, Object>();
        body.put("success", false);
        body.put("message", message);
        return body;
    }
}
