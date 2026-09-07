package egovframework.com.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.feature.auth.util.JwtTokenProvider;
import egovframework.com.service.CustomerTraceApprovalLedgerService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/legacy-section-review")
public class LegacyFrontendSectionReviewController {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final JwtTokenProvider jwt;
    private final CustomerTraceApprovalLedgerService authority;

    public LegacyFrontendSectionReviewController(
            JdbcTemplate jdbc, ObjectMapper mapper, JwtTokenProvider jwt,
            CustomerTraceApprovalLedgerService authority) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.jwt = jwt;
        this.authority = authority;
    }

    @PostMapping("/{referenceId}/{sectionId}")
    public JsonNode review(
            @PathVariable String referenceId,
            @PathVariable String sectionId,
            @RequestBody ReviewRequest body,
            Principal principal,
            HttpServletRequest request) throws Exception {
        String reviewer = requireAdmin(principal, request);
        String action = safe(body.action()).toUpperCase();
        String reason = safe(body.reason());
        if (reason.length() < 5) throw new ReviewAccessException(
                HttpStatus.BAD_REQUEST, "검토 사유를 5자 이상 입력하세요.");
        String json = jdbc.queryForObject(
                "select framework_review_legacy_section_candidate(?,?,?,?,?,?)::text",
                String.class, referenceId, sectionId, action, reviewer, reason,
                body.screenResourceId());
        return mapper.readTree(json);
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
        if (userId.isEmpty()) throw new ReviewAccessException(
                HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
        if (!authority.isCustomerTraceAdmin(userId)) throw new ReviewAccessException(
                HttpStatus.FORBIDDEN, "관리자 권한이 필요합니다.");
        return userId;
    }

    private String safe(String value) { return value == null ? "" : value.trim(); }
    public record ReviewRequest(String action, String reason, Long screenResourceId) {}

    @ExceptionHandler(ReviewAccessException.class)
    public ResponseEntity<Map<String,Object>> access(ReviewAccessException error) {
        return ResponseEntity.status(error.status)
                .body(Map.of("message", error.getMessage()));
    }
    private static final class ReviewAccessException extends RuntimeException {
        private final HttpStatus status;
        private ReviewAccessException(HttpStatus status, String message) {
            super(message); this.status = status;
        }
    }
}
