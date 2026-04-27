package egovframework.com.platform.runtimecontrol.service;

import egovframework.com.platform.runtimecontrol.service.port.RuntimeActorContextPort;
import egovframework.com.platform.runtimecontrol.service.port.RuntimeAuditPort;
import egovframework.com.platform.runtimecontrol.service.IpWhitelistFirewallService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminIpWhitelistCommandService {

    private static final DateTimeFormatter IP_WHITELIST_TIMESTAMP_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final AdminIpWhitelistSupportService adminIpWhitelistSupportService;
    private final RuntimeAuditPort runtimeAuditPort;
    private final RuntimeActorContextPort runtimeActorContextPort;
    private final ObjectProvider<IpWhitelistFirewallService> ipWhitelistFirewallServiceProvider;

    public ResponseEntity<Map<String, Object>> createRequest(
            Map<String, Object> payload,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = isEnglishRequest(request, locale);
        String applicationName = normalizeIpWhitelistApplicationName(safeString(payload == null ? null : payload.get("applicationName")));
        String ipAddress = safeString(payload == null ? null : payload.get("ipAddress"));
        String port = safeString(payload == null ? null : payload.get("port"));
        String firewallAction = normalizeIpWhitelistFirewallAction(safeString(payload == null ? null : payload.get("openFirewall")));
        String accessScope = normalizeIpWhitelistScope(safeString(payload == null ? null : payload.get("accessScope")));
        String reason = safeString(payload == null ? null : payload.get("reason"));
        String requester = safeString(payload == null ? null : payload.get("requester"));
        String expiresAt = safeString(payload == null ? null : payload.get("expiresAt"));
        String memo = safeString(payload == null ? null : payload.get("memo"));
        Map<String, Object> response = new LinkedHashMap<>();

        if (ipAddress.isEmpty() || port.isEmpty() || reason.isEmpty() || requester.isEmpty()) {
            response.put("success", false);
            response.put("message", isEn
                    ? "Enter app, IP, port, reason, and requester before submitting."
                    : "앱, IP, 포트, 요청 사유, 요청자를 입력한 뒤 등록하세요.");
            return ResponseEntity.badRequest().body(response);
        }

        String requestId = "REQ-" + System.currentTimeMillis();
        String ruleId = "WL-DRAFT-" + String.valueOf(System.currentTimeMillis()).substring(7);
        String nowLabel = formatIpWhitelistTimestamp(LocalDateTime.now());
        String actorId = resolveActorId(request);
        String requestReason = buildIpWhitelistExecutionReason(applicationName, port, firewallAction, reason, isEn);
        String executionMemo = buildIpWhitelistExecutionMemo(applicationName, port, firewallAction, memo, expiresAt, isEn);
        String executionFeedback = buildIpWhitelistExecutionFeedback(applicationName, ipAddress, port, firewallAction, false, isEn);

        Map<String, String> requestRow = ipWhitelistRequestRow(
                requestId,
                ipAddress,
                accessScope,
                requestReason,
                "검토중",
                nowLabel,
                requester,
                buildIpWhitelistExecutionReason(applicationName, port, firewallAction, reason, true),
                "Pending Approval",
                requester);
        requestRow.put("ruleId", ruleId);
        requestRow.put("expiresAt", expiresAt);
        requestRow.put("memo", executionMemo);
        requestRow.put("memoEn", buildIpWhitelistExecutionMemo(applicationName, port, firewallAction, memo, expiresAt, true));
        requestRow.put("reviewNote", "");
        requestRow.put("reviewedAt", "");
        requestRow.put("reviewedBy", "");
        requestRow.put("reviewedByEn", "");
        adminIpWhitelistSupportService.saveIpWhitelistRequestRow(requestRow);

        Map<String, String> ruleRow = ipWhitelistRow(
                ruleId,
                ipAddress,
                accessScope,
                requestReason,
                requester,
                "PENDING",
                nowLabel,
                executionMemo,
                buildIpWhitelistExecutionReason(applicationName, port, firewallAction, reason, true),
                requester,
                buildIpWhitelistExecutionMemo(applicationName, port, firewallAction, memo, expiresAt, true));
        ruleRow.put("requestId", requestId);
        ruleRow.put("expiresAt", expiresAt);
        adminIpWhitelistSupportService.saveIpWhitelistRuleRow(ruleRow);

        runtimeAuditPort.record(
                actorId,
                resolveActorRole(request),
                "ip-whitelist",
                "admin-system",
                "IP_WHITELIST_REQUEST_CREATE",
                "IP_WHITELIST_REQUEST",
                requestId,
                "SUCCESS",
                "IP whitelist request created",
                "",
                safeJson(String.valueOf(requestRow)),
                resolveRequestIp(request),
                request == null ? "" : safeString(request.getHeader("User-Agent"))
        );

        response.put("success", true);
        response.put("message", isEn
                ? "Temporary allowlist request has been queued for review."
                : "임시 허용 요청을 검토 대기열에 등록했습니다.");
        response.put("requestId", requestId);
        response.put("ruleId", ruleId);
        response.put("executionFeedback", executionFeedback);
        return ResponseEntity.ok(response);
    }

    public ResponseEntity<Map<String, Object>> decideRequest(
            Map<String, Object> payload,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = isEnglishRequest(request, locale);
        String requestId = safeString(payload == null ? null : payload.get("requestId"));
        String decision = safeString(payload == null ? null : payload.get("decision")).toUpperCase(Locale.ROOT);
        String reviewNote = safeString(payload == null ? null : payload.get("reviewNote"));
        Map<String, Object> response = new LinkedHashMap<>();

        if (requestId.isEmpty() || (!"APPROVE".equals(decision) && !"REJECT".equals(decision))) {
            response.put("success", false);
            response.put("message", isEn ? "Select a valid request and decision." : "유효한 요청과 처리 결과를 선택하세요.");
            return ResponseEntity.badRequest().body(response);
        }

        Map<String, String> existingRequest = adminIpWhitelistSupportService.findIpWhitelistRequestById(requestId);
        if (existingRequest == null) {
            response.put("success", false);
            response.put("message", isEn ? "Request was not found." : "승인 요청을 찾지 못했습니다.");
            return ResponseEntity.badRequest().body(response);
        }

        Map<String, String> updatedRequest = new LinkedHashMap<>(existingRequest);
        String reviewedAt = formatIpWhitelistTimestamp(LocalDateTime.now());
        String reviewedBy = resolveActorId(request).isEmpty()
                ? (isEn ? "Security Operator" : "보안 운영자")
                : resolveActorId(request);
        String applicationName = extractIpWhitelistApplicationName(updatedRequest);
        String port = extractIpWhitelistPort(updatedRequest);
        String firewallAction = extractIpWhitelistFirewallAction(updatedRequest);
        String firewallFeedback = "";
        updatedRequest.put("approvalStatus", "APPROVE".equals(decision) ? "승인완료" : "반려");
        updatedRequest.put("approvalStatusEn", "APPROVE".equals(decision) ? "Approved" : "Rejected");
        updatedRequest.put("reviewNote", reviewNote);
        updatedRequest.put("reviewedAt", reviewedAt);
        updatedRequest.put("reviewedBy", reviewedBy);
        updatedRequest.put("reviewedByEn", reviewedBy);
        adminIpWhitelistSupportService.saveIpWhitelistRequestRow(updatedRequest);

        String ruleId = safeString(updatedRequest.get("ruleId"));
        Map<String, String> currentRule = adminIpWhitelistSupportService.findIpWhitelistRuleById(ruleId);
        if (currentRule == null && "APPROVE".equals(decision)) {
            currentRule = ipWhitelistRow(
                    ruleId.isEmpty() ? "WL-" + requestId.replaceAll("[^0-9A-Z]", "") : ruleId,
                    safeString(updatedRequest.get("ipAddress")),
                    safeString(updatedRequest.get("accessScope")),
                    safeString(updatedRequest.get("reason")),
                    reviewedBy,
                    "ACTIVE",
                    reviewedAt,
                    reviewNote.isEmpty() ? "승인 처리 후 반영" : reviewNote,
                    safeString(updatedRequest.get("reasonEn")),
                    reviewedBy,
                    reviewNote.isEmpty() ? "Applied after approval" : reviewNote);
        }
        if (currentRule != null) {
            Map<String, String> updatedRule = new LinkedHashMap<>(currentRule);
            updatedRule.put("status", "APPROVE".equals(decision) ? "ACTIVE" : "INACTIVE");
            updatedRule.put("updatedAt", reviewedAt);
            updatedRule.put("owner", reviewedBy);
            updatedRule.put("ownerEn", reviewedBy);
            if ("APPROVE".equals(decision) && "OPEN".equals(firewallAction)) {
                firewallFeedback = executeIpWhitelistFirewall(applicationName, safeString(updatedRequest.get("ipAddress")), port, isEn);
            } else if ("APPROVE".equals(decision)) {
                firewallFeedback = isEn
                        ? "Firewall action skipped: request was approved with keep-closed option."
                        : "방화벽 처리 생략: 방화벽 미개방 옵션으로 승인되었습니다.";
            } else {
                firewallFeedback = isEn
                        ? "Firewall action skipped: request was rejected."
                        : "방화벽 처리 생략: 요청이 반려되었습니다.";
            }
            if (!reviewNote.isEmpty()) {
                updatedRule.put("memo", reviewNote + " | " + firewallFeedback);
                updatedRule.put("memoEn", reviewNote + " | " + firewallFeedback);
            } else if (!firewallFeedback.isEmpty()) {
                String existingMemo = safeString(updatedRule.get("memo"));
                String existingMemoEn = safeString(updatedRule.get("memoEn"));
                updatedRule.put("memo", existingMemo + (existingMemo.isEmpty() ? "" : " | ") + firewallFeedback);
                updatedRule.put("memoEn", existingMemoEn + (existingMemoEn.isEmpty() ? "" : " | ") + firewallFeedback);
            }
            updatedRule.put("requestId", requestId);
            adminIpWhitelistSupportService.saveIpWhitelistRuleRow(updatedRule);
        }

        runtimeAuditPort.record(
                resolveActorId(request),
                resolveActorRole(request),
                "ip-whitelist",
                "admin-system",
                "IP_WHITELIST_REQUEST_DECISION",
                "IP_WHITELIST_REQUEST",
                requestId,
                "SUCCESS",
                "IP whitelist request " + decision,
                safeJson(String.valueOf(existingRequest)),
                safeJson(String.valueOf(updatedRequest)),
                resolveRequestIp(request),
                request == null ? "" : safeString(request.getHeader("User-Agent"))
        );

        response.put("success", true);
        response.put("message", "APPROVE".equals(decision)
                ? (isEn ? "The request was approved and the allowlist was updated." : "요청을 승인하고 화이트리스트에 반영했습니다.")
                : (isEn ? "The request was rejected and the review history was saved." : "요청을 반려했고 검토 이력을 저장했습니다."));
        response.put("requestId", requestId);
        response.put("executionFeedback", buildIpWhitelistDecisionFeedback(updatedRequest, decision, reviewNote, firewallFeedback, isEn));
        return ResponseEntity.ok(response);
    }

    private String normalizeIpWhitelistScope(String value) {
        String normalized = safeString(value).toUpperCase(Locale.ROOT);
        if (normalized.isEmpty()) {
            return "ADMIN";
        }
        return Set.of("ADMIN", "BATCH", "INTERNAL", "API").contains(normalized) ? normalized : "ADMIN";
    }

    private String normalizeIpWhitelistApplicationName(String value) {
        String normalized = safeString(value).toUpperCase(Locale.ROOT);
        if (normalized.isEmpty()) {
            return "ADMIN_WEB";
        }
        return Set.of("ADMIN_WEB", "API_GATEWAY", "BATCH_AGENT", "INTERNAL_TOOL", "DB_ADMIN", "CUSTOM").contains(normalized)
                ? normalized
                : "CUSTOM";
    }

    private String normalizeIpWhitelistFirewallAction(String value) {
        String normalized = safeString(value).toUpperCase(Locale.ROOT);
        return "OPEN".equals(normalized) ? "OPEN" : "KEEP_CLOSED";
    }

    private String resolveIpWhitelistApplicationLabel(String applicationName, boolean isEn) {
        switch (normalizeIpWhitelistApplicationName(applicationName)) {
            case "API_GATEWAY":
                return isEn ? "API Gateway" : "API 게이트웨이";
            case "BATCH_AGENT":
                return isEn ? "Batch Agent" : "배치 에이전트";
            case "INTERNAL_TOOL":
                return isEn ? "Internal Tool" : "내부 운영 도구";
            case "DB_ADMIN":
                return isEn ? "DB Admin" : "DB 관리";
            case "CUSTOM":
                return isEn ? "Custom" : "직접 입력";
            case "ADMIN_WEB":
            default:
                return isEn ? "Admin Web" : "관리자 웹";
        }
    }

    private String resolveIpWhitelistFirewallLabel(String firewallAction, boolean isEn) {
        return "OPEN".equals(normalizeIpWhitelistFirewallAction(firewallAction))
                ? (isEn ? "Open Firewall" : "방화벽 열기")
                : (isEn ? "Keep Closed" : "방화벽 열지 않기");
    }

    private String buildIpWhitelistExecutionReason(String applicationName, String port, String firewallAction, String reason, boolean isEn) {
        String appLabel = resolveIpWhitelistApplicationLabel(applicationName, isEn);
        String firewallLabel = resolveIpWhitelistFirewallLabel(firewallAction, isEn);
        return safeString(reason)
                + (isEn ? " | App " : " | 앱 ")
                + appLabel
                + (isEn ? " | Port " : " | 포트 ")
                + safeString(port)
                + (isEn ? " | Firewall " : " | 방화벽 ")
                + firewallLabel;
    }

    private String buildIpWhitelistExecutionMemo(String applicationName, String port, String firewallAction, String memo, String expiresAt, boolean isEn) {
        String appLabel = resolveIpWhitelistApplicationLabel(applicationName, isEn);
        String firewallLabel = resolveIpWhitelistFirewallLabel(firewallAction, isEn);
        String baseMemo = safeString(memo);
        StringBuilder builder = new StringBuilder();
        builder.append(isEn ? "Execution plan: " : "실행 계획: ");
        builder.append(appLabel)
                .append(isEn ? ", port " : ", 포트 ")
                .append(safeString(port))
                .append(isEn ? ", firewall " : ", 방화벽 ")
                .append(firewallLabel);
        if (!safeString(expiresAt).isEmpty()) {
            builder.append(isEn ? ", expires " : ", 만료 ").append(safeString(expiresAt));
        }
        if (!baseMemo.isEmpty()) {
            builder.append(isEn ? " | Memo: " : " | 메모: ").append(baseMemo);
        }
        return builder.toString();
    }

    private String buildIpWhitelistExecutionFeedback(String applicationName, String ipAddress, String port, String firewallAction, boolean approved, boolean isEn) {
        String appLabel = resolveIpWhitelistApplicationLabel(applicationName, isEn);
        String firewallLabel = resolveIpWhitelistFirewallLabel(firewallAction, isEn);
        if (approved) {
            return isEn
                    ? "Execution result: " + appLabel + " allowlist was approved for " + safeString(ipAddress) + ":" + safeString(port) + ". Firewall action: " + firewallLabel + "."
                    : "실행 결과: " + appLabel + " 허용 요청이 " + safeString(ipAddress) + ":" + safeString(port) + " 기준으로 승인되었습니다. 방화벽 처리: " + firewallLabel + ".";
        }
        return isEn
                ? "Execution queued: " + appLabel + " request for " + safeString(ipAddress) + ":" + safeString(port) + " is waiting for review. Firewall action: " + firewallLabel + "."
                : "실행 접수: " + appLabel + " 요청이 " + safeString(ipAddress) + ":" + safeString(port) + " 기준으로 검토 대기열에 등록되었습니다. 방화벽 처리: " + firewallLabel + ".";
    }

    private String buildIpWhitelistDecisionFeedback(Map<String, String> updatedRequest, String decision, String reviewNote, String firewallFeedback, boolean isEn) {
        String detail = safeString(updatedRequest == null ? null : updatedRequest.get(isEn ? "reasonEn" : "reason"));
        String note = safeString(reviewNote);
        String firewall = safeString(firewallFeedback);
        if ("APPROVE".equalsIgnoreCase(decision)) {
            return (isEn ? "Approval feedback: " : "승인 피드백: ")
                    + detail
                    + (note.isEmpty() ? "" : (isEn ? " | Note: " : " | 메모: ") + note)
                    + (firewall.isEmpty() ? "" : (isEn ? " | Firewall: " : " | 방화벽: ") + firewall);
        }
        return (isEn ? "Rejection feedback: " : "반려 피드백: ")
                + detail
                + (note.isEmpty() ? "" : (isEn ? " | Note: " : " | 메모: ") + note)
                + (firewall.isEmpty() ? "" : (isEn ? " | Firewall: " : " | 방화벽: ") + firewall);
    }

    private String executeIpWhitelistFirewall(String applicationName, String ipAddress, String port, boolean isEn) {
        IpWhitelistFirewallService firewallService = ipWhitelistFirewallServiceProvider.getIfAvailable();
        if (firewallService == null) {
            return isEn ? "Firewall service is unavailable." : "방화벽 서비스가 비활성화되어 있습니다.";
        }
        IpWhitelistFirewallService.FirewallExecutionResult result = firewallService.openPortForIp(applicationName, ipAddress, port);
        if (result == null) {
            return isEn ? "Firewall execution returned no result." : "방화벽 실행 결과가 반환되지 않았습니다.";
        }
        return safeString(result.getMessage());
    }

    private String extractIpWhitelistApplicationName(Map<String, String> row) {
        return normalizeIpWhitelistApplicationName(extractExecutionSegment(row, "앱 ", "App "));
    }

    private String extractIpWhitelistPort(Map<String, String> row) {
        return safeString(extractExecutionSegment(row, "포트 ", "Port "));
    }

    private String extractIpWhitelistFirewallAction(Map<String, String> row) {
        String value = extractExecutionSegment(row, "방화벽 ", "Firewall ");
        return value.contains("Open Firewall") || value.contains("방화벽 열기") ? "OPEN" : "KEEP_CLOSED";
    }

    private String extractExecutionSegment(Map<String, String> row, String koPrefix, String enPrefix) {
        String reason = safeString(row == null ? null : row.get("reason"));
        String reasonEn = safeString(row == null ? null : row.get("reasonEn"));
        for (String token : reason.split("\\|")) {
            String trimmed = safeString(token);
            if (trimmed.startsWith(koPrefix)) {
                return safeString(trimmed.substring(koPrefix.length()));
            }
        }
        for (String token : reasonEn.split("\\|")) {
            String trimmed = safeString(token);
            if (trimmed.startsWith(enPrefix)) {
                return safeString(trimmed.substring(enPrefix.length()));
            }
        }
        return "";
    }

    private String formatIpWhitelistTimestamp(LocalDateTime value) {
        return value == null ? "" : IP_WHITELIST_TIMESTAMP_FORMAT.format(value);
    }

    private Map<String, String> ipWhitelistRow(String ruleId, String ipAddress, String accessScope, String description, String owner, String status,
                                               String updatedAt, String memo, String descriptionEn, String ownerEn, String memoEn) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("ruleId", ruleId);
        row.put("ipAddress", ipAddress);
        row.put("accessScope", accessScope);
        row.put("description", description);
        row.put("descriptionEn", descriptionEn);
        row.put("owner", owner);
        row.put("ownerEn", ownerEn);
        row.put("status", status);
        row.put("updatedAt", updatedAt);
        row.put("memo", memo);
        row.put("memoEn", memoEn);
        return row;
    }

    private Map<String, String> ipWhitelistRequestRow(String requestId, String ipAddress, String accessScope, String reason, String approvalStatus,
                                                      String requestedAt, String requester, String reasonEn, String approvalStatusEn, String requesterEn) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("requestId", requestId);
        row.put("ipAddress", ipAddress);
        row.put("accessScope", accessScope);
        row.put("reason", reason);
        row.put("reasonEn", reasonEn);
        row.put("approvalStatus", approvalStatus);
        row.put("approvalStatusEn", approvalStatusEn);
        row.put("requestedAt", requestedAt);
        row.put("requester", requester);
        row.put("requesterEn", requesterEn);
        return row;
    }

    private boolean isEnglishRequest(HttpServletRequest request, Locale locale) {
        if (request != null) {
            String path = request.getRequestURI();
            if (path != null && path.startsWith("/en/")) {
                return true;
            }
            String param = request.getParameter("language");
            if ("en".equalsIgnoreCase(param)) {
                return true;
            }
        }
        return locale != null && locale.getLanguage().toLowerCase(Locale.ROOT).startsWith("en");
    }

    private String resolveActorId(HttpServletRequest request) {
        if (request == null) {
            return "";
        }
        HttpSession session = request.getSession(false);
        if (session != null) {
            Object loginVO = session.getAttribute("LoginVO");
            if (loginVO != null) {
                try {
                    Object value = loginVO.getClass().getMethod("getId").invoke(loginVO);
                    String actorId = value == null ? "" : value.toString();
                    if (!actorId.isEmpty()) {
                        return actorId;
                    }
                } catch (Exception ignored) {
                }
            }
        }
        return safeString(runtimeActorContextPort.resolve(request).userId());
    }

    private String resolveActorRole(HttpServletRequest request) {
        if (request == null) {
            return "";
        }
        HttpSession session = request.getSession(false);
        if (session != null) {
            Object loginVO = session.getAttribute("LoginVO");
            if (loginVO != null) {
                try {
                    Object value = loginVO.getClass().getMethod("getAuthorCode").invoke(loginVO);
                    String actorRole = value == null ? "" : value.toString();
                    if (!actorRole.isEmpty()) {
                        return actorRole;
                    }
                } catch (Exception ignored) {
                }
            }
        }
        return safeString(runtimeActorContextPort.resolve(request).authorCode());
    }

    private String resolveRequestIp(HttpServletRequest request) {
        if (request == null) {
            return "";
        }
        String forwarded = safeString(request.getHeader("X-Forwarded-For"));
        if (!forwarded.isEmpty()) {
            return forwarded.split(",")[0].trim();
        }
        return safeString(request.getRemoteAddr());
    }

    private String safeJson(String value) {
        return safeString(value).replace("\"", "'");
    }

    private String safeString(Object value) {
        return value == null ? "" : value.toString().trim();
    }
}
