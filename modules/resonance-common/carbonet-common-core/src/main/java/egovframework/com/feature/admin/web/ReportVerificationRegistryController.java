package egovframework.com.feature.admin.web;

import egovframework.com.feature.admin.service.ReportVerificationRegistryService;
import egovframework.com.feature.auth.service.CurrentUserContextService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class ReportVerificationRegistryController {

    private final ReportVerificationRegistryService reportVerificationRegistryService;
    private final CurrentUserContextService currentUserContextService;

    @PostMapping({
            "/api/admin/emission-survey-report/issue",
            "/admin/api/admin/emission-survey-report/issue",
            "/en/admin/api/admin/emission-survey-report/issue"
    })
    public ResponseEntity<Map<String, Object>> issue(@RequestBody Map<String, Object> payload,
                                                      HttpServletRequest request) {
        return ResponseEntity.ok(reportVerificationRegistryService.issue(payload, resolveActorId(request)));
    }

    @PostMapping({
            "/api/admin/emission-survey-report/verify",
            "/admin/api/admin/emission-survey-report/verify",
            "/en/admin/api/admin/emission-survey-report/verify"
    })
    public ResponseEntity<Map<String, Object>> verify(@RequestBody Map<String, Object> payload) {
        return ResponseEntity.ok(reportVerificationRegistryService.verify(payload));
    }

    private String resolveActorId(HttpServletRequest request) {
        try {
            String userId = currentUserContextService.resolve(request).getUserId();
            return userId == null || userId.isBlank() ? "anonymous" : userId.trim();
        } catch (Exception exception) {
            return "anonymous";
        }
    }
}
