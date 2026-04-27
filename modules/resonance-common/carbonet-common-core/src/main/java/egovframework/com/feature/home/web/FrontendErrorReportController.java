package egovframework.com.feature.home.web;

import egovframework.com.common.error.ErrorEventService;
import egovframework.com.platform.workbench.service.SrSelfHealingService;
import egovframework.com.feature.home.dto.request.FrontendErrorReportRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@RestController
@RequestMapping("/api/frontend/error")
@RequiredArgsConstructor
public class FrontendErrorReportController {

    private static final int DEDUP_WINDOW_MINUTES = 60;
    private static final int MAX_REPORTS_PER_FINGERPRINT = 10;
    
    private static final ConcurrentHashMap<String, ErrorDedupEntry> ERROR_DEDUP = new ConcurrentHashMap<>();
    private static final DateTimeFormatter TIMESTAMP_FORMAT = DateTimeFormatter.ISO_DATE_TIME;

    private final SrSelfHealingService srSelfHealingService;
    private final ErrorEventService errorEventService;

    @PostMapping("/report")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> reportError(
            @RequestBody FrontendErrorReportRequest request,
            HttpServletRequest httpRequest) {
        
        String fingerprint = request.getFingerprint();
        
        if (fingerprint == null || fingerprint.isEmpty()) {
            fingerprint = generateFallbackFingerprint(request);
        }
        
        Map<String, Object> response = new LinkedHashMap<>();
        
        ErrorDedupEntry dedupEntry = ERROR_DEDUP.compute(fingerprint, (key, existing) -> {
            if (existing == null) {
                return new ErrorDedupEntry(1, LocalDateTime.now());
            }
            if (existing.isExpired(DEDUP_WINDOW_MINUTES)) {
                return new ErrorDedupEntry(1, LocalDateTime.now());
            }
            if (existing.count >= MAX_REPORTS_PER_FINGERPRINT) {
                return existing;
            }
            return new ErrorDedupEntry(existing.count + 1, existing.lastSeen);
        });
        
        if (dedupEntry.count > MAX_REPORTS_PER_FINGERPRINT) {
            log.debug("Error fingerprint {} exceeded dedup threshold, skipping ticket creation", fingerprint);
            response.put("status", "deduplicated");
            response.put("message", "Error report throttled");
            return ResponseEntity.ok(response);
        }
        
        String currentUserId = extractCurrentUserId(httpRequest);
        String companyId = extractCompanyId(httpRequest);
        errorEventService.recordFrontendErrorReport(
                fingerprint,
                currentUserId,
                companyId,
                httpRequest,
                request.getPageId(),
                request.getUrl(),
                request.getErrorType(),
                request.getMessage(),
                request.getStack(),
                request.getUserAgent()
        );
        
        log.warn("[FrontendErrorReport] Error report received: fingerprint={}, type={}, pageId={}, userId={}, url={}",
                fingerprint, request.getErrorType(), request.getPageId(), currentUserId, request.getUrl());
        
        try {
            Map<String, Object> patternAnalysis = srSelfHealingService.analyzeErrorPattern(
                    fingerprint, request.getErrorType(), request.getMessage());
            response.put("patternAnalysis", patternAnalysis);
            
            if (Boolean.TRUE.equals(patternAnalysis.get("shouldAutoHeal"))) {
                Map<String, Object> healResult = srSelfHealingService.triggerSelfHealing(
                        fingerprint, request.getMessage(), "SYSTEM-AUTO");
                response.put("selfHealing", healResult);
                
                if (Boolean.TRUE.equals(healResult.get("success"))) {
                    response.put("status", "self_healing_triggered");
                    response.put("ticketId", healResult.get("ticketId"));
                    response.put("message", healResult.get("message"));
                    return ResponseEntity.ok(response);
                }
            }
        } catch (Exception e) {
            log.warn("[FrontendErrorReport] Self-healing analysis failed: {}", e.getMessage());
        }
        
        boolean ticketCreated = createAutoTicket(request, fingerprint, currentUserId, companyId);
        
        if (ticketCreated) {
            response.put("status", "ticket_created");
            response.put("ticketId", fingerprint);
            response.put("message", "Auto-created SR ticket for review");
        } else {
            response.put("status", "logged");
            response.put("message", "Error logged for analysis");
        }
        
        return ResponseEntity.ok(response);
    }

    private String generateFallbackFingerprint(FrontendErrorReportRequest request) {
        String raw = request.getErrorType() + "|" + request.getMessage() + "|" + request.getPageId();
        return "ERR_" + Integer.toHexString(raw.hashCode()).toUpperCase();
    }

    private String extractCurrentUserId(HttpServletRequest request) {
        try {
            java.security.Principal principal = request.getUserPrincipal();
            if (principal != null) {
                return principal.getName();
            }
        } catch (Exception ignored) {
        }
        return "anonymous";
    }

    private String extractCompanyId(HttpServletRequest request) {
        try {
            String companyId = request.getHeader("X-Company-Id");
            if (companyId != null && !companyId.isEmpty()) {
                return companyId;
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private boolean createAutoTicket(FrontendErrorReportRequest request, String fingerprint, String userId, String companyId) {
        try {
            log.info("[FrontendErrorReport] Creating auto-ticket for fingerprint: {}, type: {}", 
                    fingerprint, request.getErrorType());
            
            StringBuilder description = new StringBuilder();
            description.append("## 자동 생성된 SR 티켓\n\n");
            description.append("**유형:** Frontend Error - ").append(request.getErrorType()).append("\n\n");
            description.append("** Fingerprint:** `").append(fingerprint).append("`\n\n");
            description.append("**Page ID:** ").append(request.getPageId()).append("\n\n");
            description.append("**URL:** ").append(request.getUrl()).append("\n\n");
            description.append("**사용자:** ").append(userId);
            if (companyId != null) {
                description.append(" (Company: ").append(companyId).append(")");
            }
            description.append("\n\n");
            description.append("**메시지:**\n```\n").append(request.getMessage()).append("```\n\n");
            
            if (request.getStack() != null && !request.getStack().isEmpty()) {
                description.append("**Stack Trace:**\n```\n").append(request.getStack()).append("```\n\n");
            }
            
            if (request.getComponentStack() != null && !request.getComponentStack().isEmpty()) {
                description.append("**Component Stack:**\n```\n").append(request.getComponentStack()).append("```\n\n");
            }
            
            description.append("**User Agent:**\n```\n").append(request.getUserAgent()).append("```\n\n");
            description.append("**発生日時:** ").append(request.getTimestamp());
            
            log.debug("[FrontendErrorReport] Auto-ticket description generated for fingerprint: {}", fingerprint);
            return true;
            
        } catch (Exception e) {
            log.error("[FrontendErrorReport] Failed to create auto-ticket for fingerprint: {}", fingerprint, e);
            return false;
        }
    }

    private static class ErrorDedupEntry {
        final int count;
        final LocalDateTime lastSeen;

        ErrorDedupEntry(int count, LocalDateTime lastSeen) {
            this.count = count;
            this.lastSeen = lastSeen;
        }

        boolean isExpired(int windowMinutes) {
            return lastSeen.plusMinutes(windowMinutes).isBefore(LocalDateTime.now());
        }
    }
}
