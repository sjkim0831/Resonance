package egovframework.com.platform.observability.service;

import egovframework.com.common.error.ErrorEventRecordVO;
import egovframework.com.common.error.ErrorEventSearchVO;
import egovframework.com.common.help.HelpContentService;
import egovframework.com.common.logging.AccessEventRecordVO;
import egovframework.com.common.logging.AccessEventSearchVO;
import egovframework.com.common.logging.RequestExecutionLogVO;
import egovframework.com.common.menu.model.SiteMapNode;
import egovframework.com.common.trace.TraceEventRecordVO;
import egovframework.com.common.trace.TraceEventSearchVO;
import egovframework.com.platform.observability.model.EmissionResultFilterSnapshot;
import egovframework.com.platform.observability.model.EmissionResultSummaryView;
import egovframework.com.platform.service.observability.AdminApprovalPagePayloadPort;
import egovframework.com.platform.service.observability.AdminMemberPagePayloadPort;
import egovframework.com.platform.service.observability.AdminSiteMapPort;
import egovframework.com.platform.service.observability.NotificationHistoryQueryPort;
import egovframework.com.platform.service.observability.PlatformObservabilitySummaryReadPort;
import egovframework.com.platform.service.observability.RequestExecutionLogQueryPort;
import egovframework.com.platform.service.observability.SrWorkbenchPagePort;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PlatformObservabilityPagePayloadService {

    private static final Logger log = LoggerFactory.getLogger(PlatformObservabilityPagePayloadService.class);
    private static final int NOTIFICATION_HISTORY_PAGE_SIZE = 10;
    private static final int PERFORMANCE_REQUEST_SAMPLE_SIZE = 200;
    private static final int PERFORMANCE_HOTSPOT_LIMIT = 8;
    private static final int PERFORMANCE_SLOW_REQUEST_LIMIT = 12;
    private static final long PERFORMANCE_SLOW_THRESHOLD_MS = 1000L;

    private final PlatformObservabilitySecurityPolicyPayloadService securityPolicyPayloadService;
    private final PlatformObservabilitySchedulerPayloadService schedulerPayloadService;
    private final PlatformObservabilityErrorLogPayloadService errorLogPayloadService;
    private final PlatformObservabilitySecurityAuditPayloadService securityAuditPayloadService;
    private final NotificationHistoryQueryPort notificationHistoryQueryPort;
    private final RequestExecutionLogQueryPort requestExecutionLogQueryPort;
    private final PlatformObservabilitySummaryReadPort summaryReadPort;
    private final AdminApprovalPagePayloadPort adminApprovalPagePayloadPort;
    private final AdminMemberPagePayloadPort adminMemberPagePayloadPort;
    private final SrWorkbenchPagePort srWorkbenchPagePort;
    private final HelpContentService helpContentService;
    private final AdminSiteMapPort adminSiteMapPort;
    private final ObservabilityQueryService observabilityQueryService;

    public Map<String, Object> buildNotificationPagePayload(
            boolean isEn,
            String deliveryChannel,
            String deliveryStatus,
            String deliveryKeyword,
            String deliveryPage,
            String activityAction,
            String activityKeyword,
            String activityPage) {
        Map<String, Object> payload = securityPolicyPayloadService.buildSecurityPolicyPagePayload(isEn);
        Map<String, Object> diagnostics = new LinkedHashMap<>(castObjectMap(payload.get("menuPermissionDiagnostics")));
        Map<String, String> notificationConfig = castStringMap(diagnostics.get("securityInsightNotificationConfig"));
        List<Map<String, String>> snapshotDeliveryRows = castStringRowList(diagnostics.get("securityInsightDeliveryRows"));
        List<Map<String, String>> snapshotActivityRows = castStringRowList(diagnostics.get("securityInsightActivityRows"));
        List<Map<String, String>> insightItems = castStringRowList(diagnostics.get("securityInsightItems"));
        Map<String, Object> deliveryHistoryData = loadNotificationDeliveryHistory(
                snapshotDeliveryRows,
                deliveryChannel,
                deliveryStatus,
                deliveryKeyword,
                deliveryPage);
        Map<String, Object> activityHistoryData = loadNotificationActivityHistory(
                snapshotActivityRows,
                activityAction,
                activityKeyword,
                activityPage);
        List<Map<String, String>> deliveryRows = castStringRowList(deliveryHistoryData.get("allRows"));
        List<Map<String, String>> activityRows = castStringRowList(activityHistoryData.get("allRows"));
        List<Map<String, String>> filteredDeliveryRows = castStringRowList(deliveryHistoryData.get("filteredRows"));
        List<Map<String, String>> filteredActivityRows = castStringRowList(activityHistoryData.get("filteredRows"));
        List<Map<String, String>> pagedDeliveryRows = castStringRowList(deliveryHistoryData.get("pagedRows"));
        List<Map<String, String>> pagedActivityRows = castStringRowList(activityHistoryData.get("pagedRows"));
        int filteredDeliveryCount = parsePositiveInt(stringValue(deliveryHistoryData.get("filteredCount")), filteredDeliveryRows.size());
        int filteredActivityCount = parsePositiveInt(stringValue(activityHistoryData.get("filteredCount")), filteredActivityRows.size());
        int totalDeliveryCount = parsePositiveInt(stringValue(deliveryHistoryData.get("totalCount")), deliveryRows.size());
        int totalActivityCount = parsePositiveInt(stringValue(activityHistoryData.get("totalCount")), activityRows.size());
        int deliveryCurrentPage = parsePositiveInt(stringValue(deliveryHistoryData.get("page")), 1);
        int deliveryTotalPages = parsePositiveInt(stringValue(deliveryHistoryData.get("totalPages")), 1);
        int activityCurrentPage = parsePositiveInt(stringValue(activityHistoryData.get("page")), 1);
        int activityTotalPages = parsePositiveInt(stringValue(activityHistoryData.get("totalPages")), 1);

        diagnostics.putAll(orderedMap(
                "securityInsightDeliveryRows", pagedDeliveryRows,
                "securityInsightActivityRows", pagedActivityRows));
        payload.put("menuPermissionDiagnostics", diagnostics);

        int enabledChannelCount = 0;
        if ("Y".equalsIgnoreCase(safeString(notificationConfig.get("slackEnabled")))) {
            enabledChannelCount++;
        }
        if ("Y".equalsIgnoreCase(safeString(notificationConfig.get("mailEnabled")))) {
            enabledChannelCount++;
        }
        if ("Y".equalsIgnoreCase(safeString(notificationConfig.get("webhookEnabled")))) {
            enabledChannelCount++;
        }

        int routingIssueCount = 0;
        if ("Y".equalsIgnoreCase(safeString(notificationConfig.get("slackEnabled")))
                && safeString(notificationConfig.get("slackChannel")).isEmpty()) {
            routingIssueCount++;
        }
        if ("Y".equalsIgnoreCase(safeString(notificationConfig.get("mailEnabled")))
                && safeString(notificationConfig.get("mailRecipients")).isEmpty()) {
            routingIssueCount++;
        }
        if ("Y".equalsIgnoreCase(safeString(notificationConfig.get("webhookEnabled")))
                && safeString(notificationConfig.get("webhookUrl")).isEmpty()) {
            routingIssueCount++;
        }

        int deliveryFailureCount = (int) filteredDeliveryRows.stream()
                .filter(row -> {
                    String status = safeString(row.get("deliveryStatus"));
                    if (status.isEmpty()) {
                        status = safeString(row.get("status"));
                    }
                    String upper = status.toUpperCase(Locale.ROOT);
                    return upper.contains("FAIL") || upper.contains("ERROR") || upper.contains("BLOCK");
                })
                .count();

        int pendingCriticalFindings = (int) insightItems.stream()
                .filter(row -> "CRITICAL".equalsIgnoreCase(safeString(row.get("severity"))))
                .count();

        payload.putAll(orderedMap(
                "notificationCenterSummary", List.of(
                summaryMetricRow(
                        isEn ? "Enabled Channels" : "활성 채널",
                        enabledChannelCount + "/3",
                        isEn ? "Slack, mail, webhook active count" : "Slack, 메일, Webhook 활성 수",
                        "neutral"),
                summaryMetricRow(
                        isEn ? "Delivery Failures" : "발송 실패",
                        String.valueOf(deliveryFailureCount),
                        isEn ? "Recent blocked or failed deliveries" : "최근 차단 또는 실패 건수",
                        deliveryFailureCount > 0 ? "danger" : "neutral"),
                summaryMetricRow(
                        isEn ? "Routing Issues" : "라우팅 점검",
                        String.valueOf(routingIssueCount),
                        isEn ? "Missing channel destination or webhook target" : "채널 목적지 또는 Webhook 대상 누락",
                        routingIssueCount > 0 ? "warning" : "neutral"),
                summaryMetricRow(
                        isEn ? "Critical Findings" : "Critical 탐지",
                        String.valueOf(pendingCriticalFindings),
                        isEn ? "Potential urgent alerts from policy diagnostics" : "정책 진단 기준 긴급 발송 후보",
                        pendingCriticalFindings > 0 ? "danger" : "neutral")),
                "notificationCenterQuickLinks", List.of(
                quickLinkRow(isEn ? "Security Policy" : "보안 정책", localizedAdminPath("/system/security-policy", isEn)),
                quickLinkRow(isEn ? "Security Monitoring" : "보안 모니터링", localizedAdminPath("/system/security-monitoring", isEn)),
                quickLinkRow(isEn ? "Unified Log" : "통합 로그", localizedAdminPath("/system/unified_log", isEn))),
                "notificationCenterFilterOptions", orderedMap(
                "deliveryChannels", uniqueNotificationValues(snapshotDeliveryRows.isEmpty() ? deliveryRows : snapshotDeliveryRows, "channel", "deliveryType", "mode"),
                "deliveryStatuses", uniqueNotificationValues(snapshotDeliveryRows.isEmpty() ? deliveryRows : snapshotDeliveryRows, "deliveryStatus", "status"),
                "activityActions", uniqueNotificationValues(snapshotActivityRows.isEmpty() ? activityRows : snapshotActivityRows, "actionCode", "action")),
                "notificationCenterGuidance", List.of(
                guidanceRow(
                        isEn ? "Critical" : "Critical",
                        isEn ? "Use immediate Slack or mail delivery for urgent security and runtime failures." : "긴급 보안 이슈와 런타임 장애는 Slack 또는 메일 즉시 발송으로 운영합니다.",
                        "danger"),
                guidanceRow(
                        isEn ? "High" : "High",
                        isEn ? "Keep daily digest on and require owner acknowledgement for recurring alerts." : "반복 알림은 일일 요약을 유지하고 담당자 확인 흐름과 같이 관리합니다.",
                        "warning"),
                guidanceRow(
                        isEn ? "Check Logs" : "로그 확인",
                        isEn ? "If routing looks healthy but delivery still fails, inspect the unified log and monitoring pages." : "라우팅은 정상인데 발송이 실패하면 통합 로그와 보안 모니터링 화면에서 상세 원인을 확인합니다.",
                        "neutral"))));
        Map<String, Object> notificationCenterMeta = orderedMap(
                "enabledChannelCount", enabledChannelCount,
                "deliveryFailureCount", deliveryFailureCount,
                "routingIssueCount", routingIssueCount,
                "pendingCriticalFindings", pendingCriticalFindings,
                "deliveryCount", pagedDeliveryRows.size(),
                "activityCount", pagedActivityRows.size(),
                "filteredDeliveryCount", filteredDeliveryCount,
                "filteredActivityCount", filteredActivityCount,
                "totalDeliveryCount", totalDeliveryCount,
                "totalActivityCount", totalActivityCount,
                "deliveryChannel", safeString(deliveryChannel),
                "deliveryStatus", safeString(deliveryStatus),
                "deliveryKeyword", safeString(deliveryKeyword),
                "deliveryPage", deliveryCurrentPage,
                "deliveryPageSize", NOTIFICATION_HISTORY_PAGE_SIZE,
                "deliveryTotalPages", deliveryTotalPages,
                "deliveryHistoryRetentionLimit", 500,
                "activityAction", safeString(activityAction),
                "activityKeyword", safeString(activityKeyword),
                "activityPage", activityCurrentPage,
                "activityPageSize", NOTIFICATION_HISTORY_PAGE_SIZE,
                "activityTotalPages", activityTotalPages,
                "activityHistoryRetentionLimit", 500);
        payload.put("notificationCenterMeta", notificationCenterMeta);
        return payload;
    }

    public Map<String, Object> buildPerformancePagePayload(HttpServletRequest request, boolean isEn) {
        Runtime runtime = Runtime.getRuntime();
        long maxMemory = runtime.maxMemory();
        long totalMemory = runtime.totalMemory();
        long freeMemory = runtime.freeMemory();
        long usedMemory = Math.max(0L, totalMemory - freeMemory);
        long availableMemory = Math.max(0L, maxMemory - usedMemory);
        int processors = runtime.availableProcessors();

        List<RequestExecutionLogVO> logs = requestExecutionLogQueryPort
                .searchRecent(this::isPerformanceLogCandidate, 1, PERFORMANCE_REQUEST_SAMPLE_SIZE)
                .getItems();
        List<RequestExecutionLogVO> meaningfulLogs = logs.stream()
                .filter(this::isMeaningfulPerformanceLog)
                .collect(Collectors.toList());
        List<Long> durations = meaningfulLogs.stream()
                .map(RequestExecutionLogVO::getDurationMs)
                .filter(duration -> duration > 0L)
                .sorted()
                .collect(Collectors.toList());
        long requestCount = meaningfulLogs.size();
        long slowCount = meaningfulLogs.stream().filter(this::isSlowPerformanceLog).count();
        long errorCount = meaningfulLogs.stream().filter(this::isErrorPerformanceLog).count();
        long averageDurationMs = durations.isEmpty()
                ? 0L
                : Math.round(durations.stream().mapToLong(Long::longValue).average().orElse(0D));
        long p95DurationMs = durations.isEmpty() ? 0L : durations.get((int) Math.min(durations.size() - 1, Math.ceil(durations.size() * 0.95D) - 1));
        long maxDurationMs = durations.isEmpty() ? 0L : durations.get(durations.size() - 1);
        int heapUsagePercent = maxMemory <= 0L ? 0 : (int) Math.round((usedMemory * 100D) / maxMemory);
        int slowRatePercent = requestCount == 0L ? 0 : (int) Math.round((slowCount * 100D) / requestCount);
        int errorRatePercent = requestCount == 0L ? 0 : (int) Math.round((errorCount * 100D) / requestCount);
        String refreshedAt = LocalDateTime.now().toString().replace('T', ' ');

        return orderedMap(
                "isEn", isEn,
                "overallStatus", resolvePerformanceStatus(heapUsagePercent, slowRatePercent, errorRatePercent),
                "refreshedAt", refreshedAt,
                "slowThresholdMs", PERFORMANCE_SLOW_THRESHOLD_MS,
                "requestWindowSize", PERFORMANCE_REQUEST_SAMPLE_SIZE,
                "runtimeSummary", List.of(
                summaryMetricRow(
                        isEn ? "Heap Usage" : "힙 사용률",
                        heapUsagePercent + "%",
                        isEn ? formatBytes(usedMemory) + " used of " + formatBytes(maxMemory) : formatBytes(maxMemory) + " 중 " + formatBytes(usedMemory) + " 사용",
                        heapUsagePercent >= 85 ? "danger" : heapUsagePercent >= 70 ? "warning" : "neutral"),
                summaryMetricRow(
                        isEn ? "Heap Headroom" : "가용 메모리",
                        formatBytes(availableMemory),
                        isEn ? "Remaining memory before max heap" : "최대 힙 대비 남은 메모리",
                        availableMemory <= 256L * 1024L * 1024L ? "warning" : "neutral"),
                summaryMetricRow(
                        isEn ? "vCPU Threads" : "가용 프로세서",
                        String.valueOf(processors),
                        isEn ? "Runtime available processors" : "런타임이 인식한 프로세서 수",
                        "neutral"),
                summaryMetricRow(
                        isEn ? "Observed Requests" : "관측 요청 수",
                        String.valueOf(requestCount),
                        isEn ? "Recent request executions in the current sample" : "현재 샘플에서 최근 요청 실행 수",
                        requestCount == 0L ? "warning" : "neutral")),
                "requestSummary", List.of(
                summaryMetricRow(
                        isEn ? "Average Duration" : "평균 응답시간",
                        formatDurationMs(averageDurationMs),
                        isEn ? "Average across recent non-static requests" : "최근 비정적 요청 기준 평균",
                        averageDurationMs >= PERFORMANCE_SLOW_THRESHOLD_MS ? "warning" : "neutral"),
                summaryMetricRow(
                        isEn ? "p95 Duration" : "p95 응답시간",
                        formatDurationMs(p95DurationMs),
                        isEn ? "95th percentile from the current sample" : "현재 샘플 기준 95퍼센타일",
                        p95DurationMs >= PERFORMANCE_SLOW_THRESHOLD_MS ? "danger" : "neutral"),
                summaryMetricRow(
                        isEn ? "Slow Request Rate" : "지연 요청 비율",
                        slowRatePercent + "%",
                        isEn ? slowCount + " requests exceeded " + PERFORMANCE_SLOW_THRESHOLD_MS + "ms" : PERFORMANCE_SLOW_THRESHOLD_MS + "ms 초과 " + slowCount + "건",
                        slowRatePercent >= 20 ? "danger" : slowRatePercent >= 10 ? "warning" : "neutral"),
                summaryMetricRow(
                        isEn ? "Error Rate" : "오류 비율",
                        errorRatePercent + "%",
                        isEn ? errorCount + " requests returned error responses" : "오류 응답 " + errorCount + "건",
                        errorRatePercent >= 10 ? "danger" : errorRatePercent > 0 ? "warning" : "neutral")),
                "hotspotRoutes", buildPerformanceHotspotRoutes(meaningfulLogs, isEn),
                "recentSlowRequests", buildRecentSlowPerformanceRows(meaningfulLogs, isEn),
                "responseStatusSummary", buildPerformanceResponseStatusSummary(meaningfulLogs, maxDurationMs, isEn),
                "quickLinks", List.of(
                quickLinkRow(isEn ? "Unified Log" : "통합 로그", localizedAdminPath("/system/unified_log", isEn)),
                quickLinkRow(isEn ? "Observability" : "추적 조회", localizedAdminPath("/system/observability", isEn)),
                quickLinkRow(isEn ? "Error Log" : "에러 로그", localizedAdminPath("/system/error-log", isEn)),
                quickLinkRow(isEn ? "Operations Center" : "운영센터", localizedAdminPath("/monitoring/center", isEn))),
                "guidance", List.of(
                guidanceRow(
                        isEn ? "Interpretation" : "해석 기준",
                        isEn ? "This screen uses the latest request execution sample, not a long-term APM time series." : "이 화면은 장기 APM 시계열이 아니라 최근 요청 실행 샘플을 기준으로 합니다.",
                        "neutral"),
                guidanceRow(
                        isEn ? "When p95 spikes" : "p95 급증 시",
                        isEn ? "Open observability or unified log with the same route to compare trace, status, and actor context." : "같은 경로를 추적 조회 또는 통합 로그에서 열어 trace, 상태, 사용자 맥락을 함께 확인합니다.",
                        "warning"),
                guidanceRow(
                        isEn ? "When heap rises" : "메모리 상승 시",
                        isEn ? "If heap usage stays high after traffic calms down, inspect scheduler, cache, or repeated admin batch execution." : "트래픽이 잦아든 뒤에도 힙 사용률이 높으면 스케줄러, 캐시, 반복 배치 실행을 점검합니다.",
                        "danger")));
    }

    public Map<String, Object> buildSecurityMonitoringPagePayload(boolean isEn) {
        return orderedMap(
                "securityMonitoringCards", summaryReadPort.getSecurityMonitoringCards(isEn),
                "securityMonitoringTargets", summaryReadPort.getSecurityMonitoringTargets(isEn),
                "securityMonitoringIps", summaryReadPort.getSecurityMonitoringIps(isEn),
                "securityMonitoringEvents", summaryReadPort.mergeSecurityMonitoringEventState(summaryReadPort.getSecurityMonitoringEvents(isEn), isEn),
                "securityMonitoringActivityRows", summaryReadPort.getSecurityMonitoringActivityRows(isEn),
                "securityMonitoringBlockCandidates", summaryReadPort.getSecurityMonitoringBlockCandidateRows(isEn),
                "isEn", isEn);
    }

    public Map<String, Object> buildOperationsCenterPagePayload(HttpServletRequest request, boolean isEn) {
        Locale locale = request != null && request.getLocale() != null
                ? request.getLocale()
                : (isEn ? Locale.ENGLISH : Locale.KOREAN);
        Map<String, Object> monitoringPayload = buildSecurityMonitoringPagePayload(isEn);
        Map<String, Object> schedulerPayload = schedulerPayloadService.buildSchedulerPagePayload("", "", isEn);
        Map<String, Object> errorPayload = errorLogPayloadService.buildErrorLogPagePayload("1", "", "", "", "", request, isEn);
        Map<String, Object> auditPayload = securityAuditPayloadService.buildSecurityAuditPagePayload("1", "", "", "", "", "", "AUDIT_AT", "DESC", isEn);
        Map<String, Object> memberApprovePayload = adminApprovalPagePayloadPort.buildMemberApprovePagePayload("1", "", "", "A", "", request, locale);
        Map<String, Object> companyApprovePayload = adminApprovalPagePayloadPort.buildCompanyApprovePagePayload("1", "", "A", "", request, locale);
        Map<String, Object> memberListPayload = adminMemberPagePayloadPort.buildMemberListPagePayload("1", "", "", "", request, locale);
        Map<String, Object> companyListPayload = adminMemberPagePayloadPort.buildCompanyListPagePayload("1", "", "", request, locale);
        Map<String, Object> withdrawnMemberPayload = adminMemberPagePayloadPort.buildMemberListPagePayload("1", "", "", "D", request, locale);
        Map<String, Object> dormantMemberPayload = adminMemberPagePayloadPort.buildMemberListPagePayload("1", "", "", "X", request, locale);
        Map<String, Object> blockedCompanyPayload = adminMemberPagePayloadPort.buildCompanyListPagePayload("1", "", "X", request, locale);
        Map<String, Object> srWorkbenchPayload = loadSrWorkbenchPayload();
        Map<String, Object> operationsCenterHelpPayload = helpContentService.getPageHelpForAdmin("operations-center");
        EmissionResultFilterSnapshot emissionSnapshot = summaryReadPort.buildEmissionResultFilterSnapshot(isEn, "", "", "");

        List<Map<String, String>> monitoringCards = castStringRowList(monitoringPayload.get("securityMonitoringCards"));
        List<Map<String, String>> monitoringEvents = castStringRowList(monitoringPayload.get("securityMonitoringEvents"));
        List<Map<String, String>> schedulerSummary = castStringRowList(schedulerPayload.get("schedulerSummary"));
        List<Map<String, String>> schedulerExecutions = castStringRowList(schedulerPayload.get("schedulerExecutionRows"));
        List<Map<String, String>> errorRows = castStringRowList(errorPayload.get("errorLogList"));
        List<Map<String, String>> securityAuditRows = castStringRowList(auditPayload.get("securityAuditRows"));
        List<Map<String, String>> memberApprovalRows = castStringRowList(memberApprovePayload.get("approvalRows"));
        List<Map<String, String>> companyApprovalRows = castStringRowList(companyApprovePayload.get("approvalRows"));
        int memberApprovalCount = parseCount(memberApprovePayload.get("memberApprovalTotalCount"));
        int companyApprovalCount = parseCount(companyApprovePayload.get("memberApprovalTotalCount"));
        int memberCount = parseCount(memberListPayload.get("totalCount"));
        int companyCount = parseCount(companyListPayload.get("totalCount"));
        int withdrawnMemberCount = parseCount(withdrawnMemberPayload.get("totalCount"));
        int dormantMemberCount = parseCount(dormantMemberPayload.get("totalCount"));
        int blockedCompanyCount = parseCount(blockedCompanyPayload.get("totalCount"));
        List<Map<String, String>> srTicketRows = castStringRowList(srWorkbenchPayload.get("tickets"));
        int srTicketCount = parseCount(srWorkbenchPayload.get("ticketCount"));
        int srStackCount = parseCount(srWorkbenchPayload.get("stackCount"));
        boolean codexEnabled = Boolean.parseBoolean(stringValue(srWorkbenchPayload.get("codexEnabled")));
        int operationsCenterHelpStepCount = countListEntries(operationsCenterHelpPayload.get("items"));
        boolean operationsCenterHelpActive = !"N".equalsIgnoreCase(stringValue(operationsCenterHelpPayload.get("activeYn")));
        List<?> adminSitemapSections = loadAdminSitemapSections(request);
        int adminSitemapSectionCount = countListEntries(adminSitemapSections);
        Map<String, String> integrationSignals = buildIntegrationSignals();
        Map<String, String> contentSignals = buildContentSignals(adminSitemapSections, operationsCenterHelpPayload, isEn);
        Map<String, String> operationsToolSignals = buildOperationsToolSignals(srTicketRows, codexEnabled, isEn);
        Map<String, String> memberSignals = buildMemberSignals(
                memberApprovalCount,
                companyApprovalCount,
                withdrawnMemberCount,
                dormantMemberCount,
                blockedCompanyCount,
                memberCount,
                companyCount,
                isEn);
        String refreshedAt = LocalDateTime.now().toString().replace('T', ' ');

        return orderedMap(
                "isEn", isEn,
                "overallStatus", resolveOperationsCenterOverallStatus(
                        monitoringEvents,
                        errorRows,
                        schedulerExecutions,
                        memberApprovalCount,
                        companyApprovalCount,
                        emissionSnapshot),
                "refreshedAt", refreshedAt,
                "summaryCards", buildOperationsCenterSummaryCards(
                memberApprovalCount,
                companyApprovalCount,
                memberCount,
                companyCount,
                srTicketCount,
                memberSignals,
                integrationSignals,
                contentSignals,
                operationsToolSignals,
                emissionSnapshot,
                monitoringEvents,
                errorRows,
                schedulerSummary,
                isEn),
                "priorityItems", buildOperationsCenterPriorityItems(
                memberApprovalRows,
                companyApprovalRows,
                emissionSnapshot.getItems(),
                srTicketRows,
                buildIntegrationPriorityItems(isEn),
                buildContentPriorityItems(adminSitemapSections, operationsCenterHelpPayload, contentSignals, isEn),
                monitoringEvents,
                errorRows,
                schedulerExecutions,
                isEn),
                "widgetGroups", buildOperationsCenterWidgetGroups(
                memberApprovalCount,
                companyApprovalCount,
                memberCount,
                companyCount,
                emissionSnapshot,
                srTicketCount,
                srStackCount,
                codexEnabled,
                integrationSignals,
                adminSitemapSectionCount,
                operationsCenterHelpStepCount,
                operationsCenterHelpActive,
                monitoringCards,
                errorRows,
                schedulerSummary,
                securityAuditRows,
                isEn),
                "navigationSections", buildOperationsCenterNavigationSections(isEn),
                "recentActions", buildOperationsCenterRecentActions(securityAuditRows, isEn),
                "playbooks", buildOperationsCenterPlaybooks(isEn));
    }

    public Map<String, Object> buildSensorListPagePayload(boolean isEn) {
        Map<String, Object> monitoringPayload = buildSecurityMonitoringPagePayload(isEn);
        List<Map<String, String>> monitoringEvents = castStringRowList(monitoringPayload.get("securityMonitoringEvents"));
        List<Map<String, String>> activityRows = castStringRowList(monitoringPayload.get("securityMonitoringActivityRows"));
        List<Map<String, String>> blockCandidateRows = castStringRowList(monitoringPayload.get("securityMonitoringBlockCandidates"));
        List<Map<String, String>> sensorRows = buildSensorListRows(monitoringEvents, blockCandidateRows, isEn);

        return orderedMap(
                "isEn", isEn,
                "refreshedAt", LocalDateTime.now().toString().replace('T', ' '),
                "totalCount", sensorRows.size(),
                "sensorSummary", buildSensorListSummary(sensorRows, blockCandidateRows, isEn),
                "sensorRows", sensorRows,
                "sensorActivityRows", activityRows);
    }

    private Map<String, Object> castObjectMap(Object value) {
        if (!(value instanceof Map<?, ?>)) {
            return Collections.emptyMap();
        }
        Map<?, ?> map = (Map<?, ?>) value;
        Map<String, Object> normalized = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : map.entrySet()) {
            normalized.put(safeString(entry.getKey()), entry.getValue());
        }
        return normalized;
    }

    private Map<String, String> castStringMap(Object value) {
        if (!(value instanceof Map<?, ?>)) {
            return Collections.emptyMap();
        }
        Map<?, ?> map = (Map<?, ?>) value;
        Map<String, String> normalized = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : map.entrySet()) {
            normalized.put(safeString(entry.getKey()), safeString(entry.getValue()));
        }
        return normalized;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, String>> castStringRowList(Object value) {
        if (!(value instanceof List<?>)) {
            return Collections.emptyList();
        }
        List<?> items = (List<?>) value;
        List<Map<String, String>> rows = new ArrayList<>();
        for (Object item : items) {
            if (!(item instanceof Map<?, ?>)) {
                continue;
            }
            Map<String, String> row = new LinkedHashMap<>();
            ((Map<?, ?>) item).forEach((key, rawValue) -> row.put(safeString(key), safeString(rawValue)));
            rows.add(row);
        }
        return rows;
    }

    private Map<String, String> summaryMetricRow(String title, String value, String description, String tone) {
        return stringRow(
                "title", title,
                "value", value,
                "description", description,
                "tone", tone);
    }

    private Map<String, String> quickLinkRow(String label, String targetRoute) {
        return stringRow(
                "label", label,
                "targetRoute", targetRoute);
    }

    private Map<String, String> guidanceRow(String title, String body, String tone) {
        return stringRow(
                "title", title,
                "body", body,
                "tone", tone);
    }

    private List<Map<String, String>> filterNotificationDeliveryRows(List<Map<String, String>> rows,
                                                                     String deliveryChannel,
                                                                     String deliveryStatus,
                                                                     String deliveryKeyword) {
        String normalizedChannel = safeString(deliveryChannel);
        String normalizedStatus = safeString(deliveryStatus);
        String normalizedKeyword = safeString(deliveryKeyword).toLowerCase(Locale.ROOT);
        return rows.stream()
                .filter(row -> normalizedChannel.isEmpty()
                        || normalizedChannel.equals(safeString(row.get("channel")))
                        || normalizedChannel.equals(safeString(row.get("deliveryType"))))
                .filter(row -> normalizedStatus.isEmpty()
                        || normalizedStatus.equals(safeString(row.get("deliveryStatus")))
                        || normalizedStatus.equals(safeString(row.get("status"))))
                .filter(row -> normalizedKeyword.isEmpty()
                        || String.join(" ",
                                safeString(row.get("title")),
                                safeString(row.get("subject")),
                                safeString(row.get("message")),
                                safeString(row.get("description")),
                                safeString(row.get("target")))
                        .toLowerCase(Locale.ROOT)
                        .contains(normalizedKeyword))
                .collect(Collectors.toList());
    }

    private List<Map<String, String>> filterNotificationActivityRows(List<Map<String, String>> rows,
                                                                     String activityAction,
                                                                     String activityKeyword) {
        String normalizedAction = safeString(activityAction);
        String normalizedKeyword = safeString(activityKeyword).toLowerCase(Locale.ROOT);
        return rows.stream()
                .filter(row -> normalizedAction.isEmpty()
                        || normalizedAction.equals(safeString(row.get("actionCode")))
                        || normalizedAction.equals(safeString(row.get("action"))))
                .filter(row -> normalizedKeyword.isEmpty()
                        || String.join(" ",
                                safeString(row.get("actionCode")),
                                safeString(row.get("action")),
                                safeString(row.get("summary")),
                                safeString(row.get("message")),
                                safeString(row.get("category")),
                                safeString(row.get("actorId")),
                                safeString(row.get("owner")))
                        .toLowerCase(Locale.ROOT)
                        .contains(normalizedKeyword))
                .collect(Collectors.toList());
    }

    private List<String> uniqueNotificationValues(List<Map<String, String>> rows, String... keys) {
        LinkedHashSet<String> values = new LinkedHashSet<>();
        for (Map<String, String> row : rows) {
            for (String key : keys) {
                String value = safeString(row.get(key));
                if (!value.isEmpty()) {
                    values.add(value);
                    break;
                }
            }
        }
        return new ArrayList<>(values);
    }

    private Map<String, Object> loadNotificationDeliveryHistory(List<Map<String, String>> snapshotRows,
                                                                String deliveryChannel,
                                                                String deliveryStatus,
                                                                String deliveryKeyword,
                                                                String deliveryPageParam) {
        Map<String, Object> params = buildNotificationHistoryParams(deliveryPageParam);
        params.put("deliveryChannel", safeString(deliveryChannel));
        params.put("deliveryStatus", safeString(deliveryStatus));
        params.put("deliveryKeyword", safeString(deliveryKeyword));
        try {
            int totalCount = notificationHistoryQueryPort.countDeliveryHistory(params);
            List<Map<String, String>> pagedRows = notificationHistoryQueryPort.selectDeliveryHistory(params);
            if (totalCount > 0 || !pagedRows.isEmpty()) {
                List<Map<String, String>> allRows = normalizeNotificationDeliveryRows(pagedRows);
                int totalPages = Math.max(1, (int) Math.ceil(totalCount / (double) NOTIFICATION_HISTORY_PAGE_SIZE));
                return orderedMap(
                        "allRows", allRows,
                        "filteredRows", allRows,
                        "pagedRows", allRows,
                        "filteredCount", totalCount,
                        "totalCount", totalCount,
                        "page", parsePositiveInt(stringValue(params.get("page")), 1),
                        "totalPages", totalPages);
            }
        } catch (Exception e) {
            log.debug("Notification delivery history table lookup failed. Falling back to snapshot rows.", e);
        }
        List<Map<String, String>> filteredRows = filterNotificationDeliveryRows(snapshotRows, deliveryChannel, deliveryStatus, deliveryKeyword);
        Map<String, Object> pagination = paginateNotificationRows(filteredRows, deliveryPageParam);
        return orderedMap(
                "allRows", snapshotRows,
                "filteredRows", filteredRows,
                "pagedRows", castStringRowList(pagination.get("rows")),
                "filteredCount", filteredRows.size(),
                "totalCount", snapshotRows.size(),
                "page", pagination.get("page"),
                "totalPages", pagination.get("totalPages"));
    }

    private Map<String, Object> loadNotificationActivityHistory(List<Map<String, String>> snapshotRows,
                                                                String activityAction,
                                                                String activityKeyword,
                                                                String activityPageParam) {
        Map<String, Object> params = buildNotificationHistoryParams(activityPageParam);
        params.put("activityAction", safeString(activityAction));
        params.put("activityKeyword", safeString(activityKeyword));
        try {
            int totalCount = notificationHistoryQueryPort.countActivityHistory(params);
            List<Map<String, String>> pagedRows = notificationHistoryQueryPort.selectActivityHistory(params);
            if (totalCount > 0 || !pagedRows.isEmpty()) {
                List<Map<String, String>> allRows = normalizeNotificationActivityRows(pagedRows);
                int totalPages = Math.max(1, (int) Math.ceil(totalCount / (double) NOTIFICATION_HISTORY_PAGE_SIZE));
                return orderedMap(
                        "allRows", allRows,
                        "filteredRows", allRows,
                        "pagedRows", allRows,
                        "filteredCount", totalCount,
                        "totalCount", totalCount,
                        "page", parsePositiveInt(stringValue(params.get("page")), 1),
                        "totalPages", totalPages);
            }
        } catch (Exception e) {
            log.debug("Notification activity history table lookup failed. Falling back to snapshot rows.", e);
        }
        List<Map<String, String>> filteredRows = filterNotificationActivityRows(snapshotRows, activityAction, activityKeyword);
        Map<String, Object> pagination = paginateNotificationRows(filteredRows, activityPageParam);
        return orderedMap(
                "allRows", snapshotRows,
                "filteredRows", filteredRows,
                "pagedRows", castStringRowList(pagination.get("rows")),
                "filteredCount", filteredRows.size(),
                "totalCount", snapshotRows.size(),
                "page", pagination.get("page"),
                "totalPages", pagination.get("totalPages"));
    }

    private Map<String, Object> buildNotificationHistoryParams(String pageParam) {
        int page = parsePageIndex(pageParam);
        int offset = Math.max(0, (page - 1) * NOTIFICATION_HISTORY_PAGE_SIZE);
        return orderedMap(
                "page", page,
                "pageSize", NOTIFICATION_HISTORY_PAGE_SIZE,
                "offset", offset);
    }

    private List<Map<String, String>> normalizeNotificationDeliveryRows(List<Map<String, String>> rows) {
        return rows == null ? Collections.emptyList() : rows.stream()
                .map(row -> {
                    Map<String, String> normalized = new LinkedHashMap<>(row);
                    normalized.put("channel", firstNonBlank(safeString(row.get("deliveryType")), safeString(row.get("channel"))));
                    normalized.put("status", firstNonBlank(safeString(row.get("deliveryStatus")), safeString(row.get("status"))));
                    normalized.put("message", firstNonBlank(safeString(row.get("message")), safeString(row.get("deliveryDetail"))));
                    return normalized;
                })
                .collect(Collectors.toList());
    }

    private List<Map<String, String>> normalizeNotificationActivityRows(List<Map<String, String>> rows) {
        return rows == null ? Collections.emptyList() : rows.stream()
                .map(row -> {
                    Map<String, String> normalized = new LinkedHashMap<>(row);
                    normalized.put("action", firstNonBlank(safeString(row.get("actionCode")), safeString(row.get("action"))));
                    normalized.put("owner", firstNonBlank(safeString(row.get("actorId")), safeString(row.get("owner"))));
                    return normalized;
                })
                .collect(Collectors.toList());
    }

    private Map<String, Object> paginateNotificationRows(List<Map<String, String>> rows, String pageParam) {
        List<Map<String, String>> safeRows = rows == null ? Collections.emptyList() : rows;
        int totalCount = safeRows.size();
        int totalPages = Math.max(1, (int) Math.ceil(totalCount / (double) NOTIFICATION_HISTORY_PAGE_SIZE));
        int requestedPage = parsePageIndex(pageParam);
        int currentPage = Math.max(1, Math.min(requestedPage, totalPages));
        int fromIndex = Math.min((currentPage - 1) * NOTIFICATION_HISTORY_PAGE_SIZE, totalCount);
        int toIndex = Math.min(fromIndex + NOTIFICATION_HISTORY_PAGE_SIZE, totalCount);

        return orderedMap(
                "rows", totalCount == 0
                        ? Collections.<Map<String, String>>emptyList()
                        : new ArrayList<>(safeRows.subList(fromIndex, toIndex)),
                "page", currentPage,
                "pageSize", NOTIFICATION_HISTORY_PAGE_SIZE,
                "totalPages", totalPages,
                "totalCount", totalCount);
    }

    private boolean isPerformanceLogCandidate(RequestExecutionLogVO item) {
        String requestUri = normalizePerformanceUri(item == null ? "" : item.getRequestUri());
        if (requestUri.isEmpty()) {
            return false;
        }
        return !requestUri.startsWith("/react-app/")
                && !requestUri.startsWith("/assets/")
                && !requestUri.startsWith("/css/")
                && !requestUri.startsWith("/js/")
                && !requestUri.startsWith("/images/")
                && !requestUri.contains("/health")
                && !requestUri.contains("/codex-verify-18000-freshness");
    }

    private boolean isMeaningfulPerformanceLog(RequestExecutionLogVO item) {
        String requestUri = normalizePerformanceUri(item == null ? "" : item.getRequestUri());
        return !requestUri.isEmpty() && !"/".equals(requestUri);
    }

    private boolean isSlowPerformanceLog(RequestExecutionLogVO item) {
        return item != null && item.getDurationMs() >= PERFORMANCE_SLOW_THRESHOLD_MS;
    }

    private boolean isErrorPerformanceLog(RequestExecutionLogVO item) {
        return item != null && (item.getResponseStatus() >= 400 || !safeString(item.getErrorMessage()).isEmpty());
    }

    private List<Map<String, String>> buildPerformanceHotspotRoutes(List<RequestExecutionLogVO> logs, boolean isEn) {
        return logs.stream()
                .collect(Collectors.groupingBy(
                        item -> normalizePerformanceUri(item.getRequestUri()),
                        LinkedHashMap::new,
                        Collectors.toList()))
                .entrySet()
                .stream()
                .filter(entry -> !safeString(entry.getKey()).isEmpty())
                .map(entry -> {
                    List<RequestExecutionLogVO> routeLogs = entry.getValue();
                    long hits = routeLogs.size();
                    long errors = routeLogs.stream().filter(this::isErrorPerformanceLog).count();
                    long slows = routeLogs.stream().filter(this::isSlowPerformanceLog).count();
                    long avgDuration = Math.round(routeLogs.stream().mapToLong(RequestExecutionLogVO::getDurationMs).average().orElse(0D));
                    long maxDuration = routeLogs.stream().mapToLong(RequestExecutionLogVO::getDurationMs).max().orElse(0L);
                    return stringRow(
                            "requestUri", entry.getKey(),
                            "httpMethod", routeLogs.stream().map(RequestExecutionLogVO::getHttpMethod).map(this::safeString).filter(value -> !value.isEmpty()).findFirst().orElse("GET"),
                            "hits", String.valueOf(hits),
                            "avgDurationMs", String.valueOf(avgDuration),
                            "maxDurationMs", String.valueOf(maxDuration),
                            "slowCount", String.valueOf(slows),
                            "errorCount", String.valueOf(errors),
                            "lastExecutedAt", routeLogs.stream().map(RequestExecutionLogVO::getExecutedAt).map(this::safeString).filter(value -> !value.isEmpty()).findFirst().orElse(""),
                            "targetRoute", appendQuery(localizedAdminPath("/system/unified_log", isEn), "searchKeyword", entry.getKey()));
                })
                .sorted(Comparator
                        .comparingLong((Map<String, String> row) -> parsePositiveLong(row.get("avgDurationMs"), 0L)).reversed()
                        .thenComparingLong(row -> parsePositiveLong(row.get("maxDurationMs"), 0L)).reversed()
                        .thenComparingLong(row -> parsePositiveLong(row.get("errorCount"), 0L)).reversed()
                        .thenComparingLong(row -> parsePositiveLong(row.get("hits"), 0L)).reversed())
                .limit(PERFORMANCE_HOTSPOT_LIMIT)
                .collect(Collectors.toList());
    }

    private List<Map<String, String>> buildRecentSlowPerformanceRows(List<RequestExecutionLogVO> logs, boolean isEn) {
        return logs.stream()
                .filter(item -> isSlowPerformanceLog(item) || isErrorPerformanceLog(item))
                .sorted(Comparator.comparing(RequestExecutionLogVO::getExecutedAt, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)).reversed())
                .limit(PERFORMANCE_SLOW_REQUEST_LIMIT)
                .map(item -> stringRow(
                        "executedAt", safeString(item.getExecutedAt()),
                        "httpMethod", safeString(item.getHttpMethod()),
                        "requestUri", normalizePerformanceUri(item.getRequestUri()),
                        "durationMs", String.valueOf(item.getDurationMs()),
                        "responseStatus", String.valueOf(item.getResponseStatus()),
                        "actorUserId", safeString(item.getActorUserId()),
                        "traceId", safeString(item.getTraceId()),
                        "errorMessage", safeString(item.getErrorMessage()),
                        "targetRoute", appendQuery(localizedAdminPath("/system/unified_log", isEn), "traceId", safeString(item.getTraceId()))))
                .collect(Collectors.toList());
    }

    private List<Map<String, String>> buildPerformanceResponseStatusSummary(List<RequestExecutionLogVO> logs, long maxDurationMs, boolean isEn) {
        long successCount = logs.stream().filter(item -> item.getResponseStatus() > 0 && item.getResponseStatus() < 400).count();
        long clientErrorCount = logs.stream().filter(item -> item.getResponseStatus() >= 400 && item.getResponseStatus() < 500).count();
        long serverErrorCount = logs.stream().filter(item -> item.getResponseStatus() >= 500).count();
        long slowCount = logs.stream().filter(this::isSlowPerformanceLog).count();
        return List.of(
                summaryMetricRow(
                        isEn ? "2xx/3xx" : "2xx/3xx",
                        String.valueOf(successCount),
                        isEn ? "Successful or redirected responses" : "성공 및 리다이렉트 응답",
                        "neutral"),
                summaryMetricRow(
                        isEn ? "4xx" : "4xx",
                        String.valueOf(clientErrorCount),
                        isEn ? "Client-side or validation failures" : "클라이언트 또는 검증 오류",
                        clientErrorCount > 0 ? "warning" : "neutral"),
                summaryMetricRow(
                        isEn ? "5xx" : "5xx",
                        String.valueOf(serverErrorCount),
                        isEn ? "Server-side failures" : "서버 오류 응답",
                        serverErrorCount > 0 ? "danger" : "neutral"),
                summaryMetricRow(
                        isEn ? "Max Duration" : "최대 응답시간",
                        formatDurationMs(maxDurationMs),
                        isEn ? slowCount + " requests exceeded slow threshold" : "지연 임계치 초과 " + slowCount + "건",
                        maxDurationMs >= PERFORMANCE_SLOW_THRESHOLD_MS ? "warning" : "neutral"));
    }

    private Map<String, String> buildMemberSignals(int memberApprovalCount,
                                                   int companyApprovalCount,
                                                   int withdrawnMemberCount,
                                                   int dormantMemberCount,
                                                   int blockedCompanyCount,
                                                   int memberCount,
                                                   int companyCount,
                                                   boolean isEn) {
        int issueCount = memberApprovalCount + companyApprovalCount + withdrawnMemberCount + dormantMemberCount + blockedCompanyCount;
        String targetRoute = localizedAdminPath("/member/list", isEn);
        if (memberApprovalCount + companyApprovalCount > 0) {
            targetRoute = localizedAdminPath("/member/approve", isEn);
        } else if (dormantMemberCount > 0) {
            targetRoute = localizedAdminPath("/member/activate", isEn);
        } else if (withdrawnMemberCount > 0) {
            targetRoute = localizedAdminPath("/member/withdrawn", isEn);
        } else if (blockedCompanyCount > 0) {
            targetRoute = appendQuery(localizedAdminPath("/member/company_list", isEn), "sbscrbSttus", "X");
        }
        return stringRow(
                "issueCount", String.valueOf(issueCount),
                "memberApprovalCount", String.valueOf(memberApprovalCount),
                "companyApprovalCount", String.valueOf(companyApprovalCount),
                "withdrawnMemberCount", String.valueOf(withdrawnMemberCount),
                "dormantMemberCount", String.valueOf(dormantMemberCount),
                "blockedCompanyCount", String.valueOf(blockedCompanyCount),
                "memberCount", String.valueOf(memberCount),
                "companyCount", String.valueOf(companyCount),
                "targetRoute", targetRoute);
    }

    private Map<String, String> buildOperationsToolSignals(List<Map<String, String>> srTicketRows,
                                                           boolean codexEnabled,
                                                           boolean isEn) {
        int blockedCount = 0;
        int failedCount = 0;
        int readyCount = 0;
        for (Map<String, String> row : srTicketRows) {
            String executionStatus = safeString(row.get("executionStatus")).toUpperCase(Locale.ROOT);
            if (executionStatus.contains("BLOCKED")) {
                blockedCount++;
            }
            if (executionStatus.contains("FAILED")) {
                failedCount++;
            }
            if (executionStatus.contains("READY")
                    || executionStatus.contains("PLAN_COMPLETED")
                    || executionStatus.contains("APPROVED")) {
                readyCount++;
            }
        }
        int attentionCount = blockedCount + failedCount + readyCount + (codexEnabled ? 0 : 1);
        return stringRow(
                "blockedCount", String.valueOf(blockedCount),
                "failedCount", String.valueOf(failedCount),
                "readyCount", String.valueOf(readyCount),
                "attentionCount", String.valueOf(attentionCount),
                "codexReadyLabel", codexEnabled ? (isEn ? "Ready" : "사용 가능") : (isEn ? "Disabled" : "비활성"));
    }

    private List<Map<String, String>> buildContentPriorityItems(List<?> adminSitemapSections,
                                                                Map<String, Object> operationsCenterHelpPayload,
                                                                Map<String, String> contentSignals,
                                                                boolean isEn) {
        List<Map<String, String>> items = new ArrayList<>();
        boolean helpActive = !"N".equalsIgnoreCase(stringValue(operationsCenterHelpPayload.get("activeYn")));
        int helpStepCount = countListEntries(operationsCenterHelpPayload.get("items"));
        if (!helpActive) {
            items.add(priorityItem(
                    "operations-center-help-inactive", "CONTENT", "HELP_CONTENT", "WARNING",
                    isEn ? "Operations center help is inactive" : "운영센터 도움말이 비활성 상태입니다",
                    isEn ? "Operators cannot open overlay guidance for this hub page." : "운영센터 화면에서 overlay 도움말을 열 수 없는 상태입니다.",
                    LocalDateTime.now().toString().replace('T', ' '),
                    appendQuery(localizedAdminPath("/system/help-management", isEn), "pageId", "operations-center")));
        }
        if (items.size() < 2 && helpStepCount == 0) {
            items.add(priorityItem(
                    "operations-center-help-empty", "CONTENT", "HELP_CONTENT", "WARNING",
                    isEn ? "Operations center help steps are empty" : "운영센터 도움말 단계가 비어 있습니다",
                    isEn ? "The page is active but no guided help steps are registered." : "도움말은 활성일 수 있지만 안내 단계가 등록되지 않았습니다.",
                    LocalDateTime.now().toString().replace('T', ' '),
                    appendQuery(localizedAdminPath("/system/help-management", isEn), "pageId", "operations-center")));
        }
        if (items.size() < 2) {
            for (Object section : adminSitemapSections) {
                if (!(section instanceof SiteMapNode)) {
                    continue;
                }
                SiteMapNode node = (SiteMapNode) section;
                if (node.getChildren() != null && !node.getChildren().isEmpty()) {
                    continue;
                }
                items.add(priorityItem(
                        firstNonBlank(safeString(node.getCode()), safeString(node.getLabel()), "empty-sitemap-section"),
                        "CONTENT", "SITEMAP", "INFO",
                        firstNonBlank(safeString(node.getLabel()), isEn ? "Empty sitemap section" : "빈 사이트맵 섹션"),
                        isEn ? "This admin sitemap section has no visible child pages." : "이 관리자 사이트맵 섹션에는 노출되는 하위 페이지가 없습니다.",
                        LocalDateTime.now().toString().replace('T', ' '),
                        localizedAdminPath("/content/sitemap", isEn)));
                if (items.size() >= 2) {
                    break;
                }
            }
        }
        return items;
    }

    private Map<String, String> buildContentSignals(List<?> adminSitemapSections,
                                                    Map<String, Object> operationsCenterHelpPayload,
                                                    boolean isEn) {
        boolean helpActive = !"N".equalsIgnoreCase(stringValue(operationsCenterHelpPayload.get("activeYn")));
        int helpStepCount = countListEntries(operationsCenterHelpPayload.get("items"));
        int emptySectionCount = 0;
        for (Object section : adminSitemapSections) {
            if (!(section instanceof SiteMapNode)) {
                continue;
            }
            SiteMapNode node = (SiteMapNode) section;
            if (node.getChildren() == null || node.getChildren().isEmpty()) {
                emptySectionCount++;
            }
        }
        int issueCount = (helpActive ? 0 : 1) + (helpStepCount == 0 ? 1 : 0) + emptySectionCount;
        return stringRow(
                "contentIssueCount", String.valueOf(issueCount),
                "emptySectionCount", String.valueOf(emptySectionCount),
                "helpActiveLabel", helpActive ? (isEn ? "Active" : "활성") : (isEn ? "Inactive" : "비활성"),
                "helpStepCount", String.valueOf(helpStepCount));
    }

    private List<Map<String, String>> buildIntegrationPriorityItems(boolean isEn) {
        List<Map<String, String>> items = new ArrayList<>();
        try {
            ErrorEventSearchVO apiErrorSearch = new ErrorEventSearchVO();
            apiErrorSearch.setFirstIndex(0);
            apiErrorSearch.setRecordCountPerPage(20);
            List<ErrorEventRecordVO> recentApiErrors = observabilityQueryService.selectErrorEventList(apiErrorSearch);
            for (ErrorEventRecordVO item : recentApiErrors) {
                if (item == null || safeString(item.getApiId()).isEmpty()) {
                    continue;
                }
                items.add(priorityItem(
                        firstNonBlank(safeString(item.getErrorId()), safeString(item.getTraceId()), safeString(item.getApiId())),
                        "INTEGRATION", "API_ERROR", resolveIntegrationSeverityFromResult(item.getResultStatus()),
                        firstNonBlank(safeString(item.getApiId()), isEn ? "API error" : "API 오류"),
                        firstNonBlank(safeString(item.getMessage()), safeString(item.getRequestUri()), safeString(item.getErrorType())),
                        safeString(item.getCreatedAt()),
                        appendQuery(localizedAdminPath("/system/unified_log", isEn), "apiId", safeString(item.getApiId()))));
                if (items.size() >= 2) {
                    return items;
                }
            }

            AccessEventSearchVO accessSearch = new AccessEventSearchVO();
            accessSearch.setFirstIndex(0);
            accessSearch.setRecordCountPerPage(30);
            List<AccessEventRecordVO> recentAccessEvents = observabilityQueryService.selectAccessEventList(accessSearch);
            for (AccessEventRecordVO item : recentAccessEvents) {
                Integer responseStatus = item == null ? null : item.getResponseStatus();
                if (item == null || safeString(item.getApiId()).isEmpty() || responseStatus == null || responseStatus < 400) {
                    continue;
                }
                items.add(priorityItem(
                        firstNonBlank(safeString(item.getEventId()), safeString(item.getTraceId()), safeString(item.getApiId())),
                        "INTEGRATION", "API_RESPONSE", responseStatus >= 500 ? "CRITICAL" : "WARNING",
                        firstNonBlank(safeString(item.getApiId()), isEn ? "API response issue" : "API 응답 이상"),
                        firstNonBlank(safeString(item.getRequestUri()), safeString(item.getErrorMessage()), safeString(item.getFeatureType())),
                        safeString(item.getCreatedAt()),
                        appendQuery(localizedAdminPath("/system/observability", isEn), "apiId", safeString(item.getApiId()))));
                if (items.size() >= 2) {
                    break;
                }
            }
        } catch (Exception e) {
            log.warn("Failed to build integration priority items for operations center.", e);
        }
        return items;
    }

    private Map<String, String> buildIntegrationSignals() {
        Map<String, String> signals = stringRow(
                "apiRequestTraceCount", "0",
                "apiResponseTraceCount", "0",
                "recentApiErrorCount", "0",
                "observedApiCount", "0");
        try {
            TraceEventSearchVO requestTraceSearch = new TraceEventSearchVO();
            requestTraceSearch.setFirstIndex(0);
            requestTraceSearch.setRecordCountPerPage(1);
            requestTraceSearch.setEventType("API_REQUEST");
            signals.put("apiRequestTraceCount", String.valueOf(observabilityQueryService.selectTraceEventCount(requestTraceSearch)));

            TraceEventSearchVO responseTraceSearch = new TraceEventSearchVO();
            responseTraceSearch.setFirstIndex(0);
            responseTraceSearch.setRecordCountPerPage(1);
            responseTraceSearch.setEventType("API_RESPONSE");
            signals.put("apiResponseTraceCount", String.valueOf(observabilityQueryService.selectTraceEventCount(responseTraceSearch)));

            TraceEventSearchVO requestTraceWindow = new TraceEventSearchVO();
            requestTraceWindow.setFirstIndex(0);
            requestTraceWindow.setRecordCountPerPage(100);
            requestTraceWindow.setEventType("API_REQUEST");
            TraceEventSearchVO responseTraceWindow = new TraceEventSearchVO();
            responseTraceWindow.setFirstIndex(0);
            responseTraceWindow.setRecordCountPerPage(100);
            responseTraceWindow.setEventType("API_RESPONSE");

            List<TraceEventRecordVO> recentApiTraces = new ArrayList<>();
            recentApiTraces.addAll(observabilityQueryService.selectTraceEventList(requestTraceWindow));
            recentApiTraces.addAll(observabilityQueryService.selectTraceEventList(responseTraceWindow));
            long observedApiCount = recentApiTraces.stream()
                    .map(item -> safeString(item == null ? null : item.getApiId()))
                    .filter(value -> !value.isEmpty())
                    .distinct()
                    .count();
            signals.put("observedApiCount", String.valueOf(observedApiCount));

            ErrorEventSearchVO apiErrorSearch = new ErrorEventSearchVO();
            apiErrorSearch.setFirstIndex(0);
            apiErrorSearch.setRecordCountPerPage(100);
            List<ErrorEventRecordVO> recentApiErrors = observabilityQueryService.selectErrorEventList(apiErrorSearch).stream()
                    .filter(item -> item != null && !safeString(item.getApiId()).isEmpty())
                    .collect(Collectors.toList());
            signals.put("recentApiErrorCount", String.valueOf(recentApiErrors.size()));
        } catch (Exception e) {
            log.warn("Failed to build integration signals for operations center.", e);
        }
        return signals;
    }

    private String resolveIntegrationSeverityFromResult(String resultStatus) {
        String normalized = safeString(resultStatus).toUpperCase(Locale.ROOT);
        if (normalized.contains("FAIL") || normalized.contains("ERROR") || normalized.contains("500")) {
            return "CRITICAL";
        }
        if (normalized.contains("WARN") || normalized.contains("400") || normalized.contains("403") || normalized.contains("404")) {
            return "WARNING";
        }
        return "INFO";
    }

    private List<Map<String, String>> buildOperationsCenterRecentActions(List<Map<String, String>> securityAuditRows, boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        int limit = Math.min(5, securityAuditRows.size());
        for (int index = 0; index < limit; index++) {
            Map<String, String> row = securityAuditRows.get(index);
            rows.add(stringRow(
                    "actionId", safeString(row.get("traceId")) + "-" + index,
                    "actedAt", firstNonBlank(safeString(row.get("auditAt")), safeString(row.get("createdAt"))),
                    "actorId", extractSecurityAuditActorId(safeString(row.get("actor"))),
                    "actionType", safeString(row.get("action")),
                    "targetLabel", safeString(row.get("target")),
                    "resultStatus", deriveAuditResultStatus(row, isEn),
                    "targetRoute", appendQuery(localizedAdminPath("/system/security-audit", isEn), "searchKeyword", safeString(row.get("target")))));
        }
        return rows;
    }

    private List<Map<String, Object>> buildOperationsCenterNavigationSections(boolean isEn) {
        List<Map<String, Object>> sections = new ArrayList<>();
        sections.add(navigationSection("member", isEn ? "Member / Company" : "회원/회원사",
                isEn ? "Move into approval, member, and company operations." : "승인, 회원, 회원사 운영 화면으로 이동합니다.",
                List.of(
                        navigationLink(isEn ? "Member approvals" : "회원 승인", localizedAdminPath("/member/approve", isEn)),
                        navigationLink(isEn ? "Company approvals" : "회원사 승인", localizedAdminPath("/member/company-approve", isEn)),
                        navigationLink(isEn ? "Member list" : "회원 목록", localizedAdminPath("/member/list", isEn)),
                        navigationLink(isEn ? "Company list" : "회원사 목록", localizedAdminPath("/member/company_list", isEn)))));
        sections.add(navigationSection("emission", isEn ? "Emission / Business" : "배출/업무",
                isEn ? "Review emission results and site management." : "배출 결과와 배출지 운영 화면으로 이동합니다.",
                List.of(
                        navigationLink(isEn ? "Emission results" : "배출 결과 목록", localizedAdminPath("/emission/result_list", isEn)),
                        navigationLink(isEn ? "Review queue" : "검토 대기", appendQuery(localizedAdminPath("/emission/result_list", isEn), "resultStatus", "REVIEW")),
                        navigationLink(isEn ? "Emission sites" : "배출지 관리", localizedAdminPath("/emission/site-management", isEn)))));
        sections.add(navigationSection("security-system", isEn ? "Security / System" : "보안/시스템",
                isEn ? "Continue detailed analysis in observability and system diagnostics." : "상세 분석은 로그/추적/시스템 진단 화면으로 이동합니다.",
                List.of(
                        navigationLink(isEn ? "Sensor list" : "센서 목록", localizedAdminPath("/monitoring/sensor_list", isEn)),
                        navigationLink(isEn ? "Security monitoring" : "보안 모니터링", localizedAdminPath("/system/security-monitoring", isEn)),
                        navigationLink(isEn ? "Unified log" : "통합 로그", localizedAdminPath("/system/unified_log", isEn)),
                        navigationLink(isEn ? "Observability" : "추적 조회", localizedAdminPath("/system/observability", isEn)),
                        navigationLink(isEn ? "Error log" : "에러 로그", localizedAdminPath("/system/error-log", isEn)),
                        navigationLink(isEn ? "Scheduler" : "스케줄러", localizedAdminPath("/system/scheduler", isEn)))));
        sections.add(navigationSection("integration", isEn ? "External Integration" : "외부연계",
                isEn ? "Move into API governance and trace consoles for integration troubleshooting." : "외부연계 장애나 계약 점검은 API 거버넌스와 추적 콘솔로 이동합니다.",
                List.of(
                        navigationLink(isEn ? "API management" : "API 관리", localizedAdminPath("/system/api-management-console", isEn)),
                        navigationLink(isEn ? "Unified log" : "통합 로그", localizedAdminPath("/system/unified_log", isEn)),
                        navigationLink(isEn ? "Observability" : "추적 조회", localizedAdminPath("/system/observability", isEn)),
                        navigationLink(isEn ? "Full-stack management" : "풀스택 관리", localizedAdminPath("/system/full-stack-management", isEn)),
                        navigationLink(isEn ? "Error log" : "에러 로그", localizedAdminPath("/system/error-log", isEn)))));
        sections.add(navigationSection("content", isEn ? "Content" : "콘텐츠",
                isEn ? "Move into content governance and menu exposure validation." : "콘텐츠 거버넌스와 메뉴 노출 검증 화면으로 이동합니다.",
                List.of(
                        navigationLink(isEn ? "Admin sitemap" : "관리자 사이트맵", localizedAdminPath("/content/sitemap", isEn)),
                        navigationLink(isEn ? "Help management" : "도움말 운영", localizedAdminPath("/system/help-management", isEn)))));
        sections.add(navigationSection("ops-tools", isEn ? "Operations Tools" : "운영도구",
                isEn ? "Move into execution tooling that supports operations." : "운영을 지원하는 실행 도구 화면으로 이동합니다.",
                List.of(
                        navigationLink(isEn ? "SR workbench" : "SR 워크벤치", localizedAdminPath("/system/sr-workbench", isEn)),
                        navigationLink(isEn ? "Codex console" : "Codex 실행 콘솔", localizedAdminPath("/system/codex-request", isEn)))));
        return sections;
    }

    private List<Map<String, String>> buildOperationsCenterPlaybooks(boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(playbook("info", isEn ? "Approval evidence" : "승인 근거 확인",
                isEn ? "Open member or company detail first and verify evidence files before approval or rejection." : "회원 또는 회원사 상세로 들어가 증빙 파일을 확인한 뒤 승인 또는 반려합니다."));
        rows.add(playbook("info", isEn ? "Emission review" : "배출 결과 검토",
                isEn ? "Review pending emission results with project and company context before marking them verified." : "배출 결과는 프로젝트와 회원사 맥락을 확인한 뒤 검토 완료 처리합니다."));
        rows.add(playbook("warning", isEn ? "Whitelist requests" : "화이트리스트 요청",
                isEn ? "Use the whitelist approval flow before opening external access." : "외부 허용은 반드시 화이트리스트 승인 흐름을 거친 뒤 반영합니다."));
        rows.add(playbook("warning", isEn ? "Scheduler reruns" : "스케줄러 재실행",
                isEn ? "Review execution history before rerunning jobs in REVIEW or FAIL state." : "REVIEW 또는 FAIL 상태 작업은 최근 실행 이력을 먼저 확인한 뒤 재실행합니다."));
        rows.add(playbook("info", isEn ? "Trace-first analysis" : "trace 기준 분석",
                isEn ? "For repeated errors, move into unified log or observability with trace-linked queries." : "반복 오류는 trace 기준으로 통합 로그나 추적 조회 화면에서 원인을 확인합니다."));
        rows.add(playbook("info", isEn ? "SR/Codex execution" : "SR/Codex 실행",
                isEn ? "Use SR Workbench for approval and execution state tracking before opening Codex execution console." : "Codex 실행 콘솔로 이동하기 전에 SR 워크벤치에서 승인과 실행 상태를 먼저 확인합니다."));
        return rows;
    }

    private Map<String, Object> loadSrWorkbenchPayload() {
        try {
            return srWorkbenchPagePort.getPage("");
        } catch (Exception e) {
            log.warn("Failed to load SR workbench payload for operations center.", e);
            return Collections.emptyMap();
        }
    }

    private List<?> loadAdminSitemapSections(HttpServletRequest request) {
        try {
            return adminSiteMapPort.getAdminSiteMap(false, request);
        } catch (Exception e) {
            log.warn("Failed to load admin sitemap sections for operations center.", e);
            return Collections.emptyList();
        }
    }

    private String resolveOperationsCenterOverallStatus(List<Map<String, String>> monitoringEvents,
                                                        List<Map<String, String>> errorRows,
                                                        List<Map<String, String>> schedulerExecutions,
                                                        int memberApprovalCount,
                                                        int companyApprovalCount,
                                                        EmissionResultFilterSnapshot emissionSnapshot) {
        boolean hasCriticalEvent = monitoringEvents.stream().anyMatch(row -> safeString(row.get("severity")).toUpperCase(Locale.ROOT).contains("CRITICAL"));
        boolean hasSchedulerFailure = schedulerExecutions.stream().anyMatch(row -> {
            String result = safeString(row.get("result")).toUpperCase(Locale.ROOT);
            return result.contains("FAIL") || result.contains("ERROR");
        });
        if (hasCriticalEvent || hasSchedulerFailure) {
            return "CRITICAL";
        }
        if (!monitoringEvents.isEmpty() || !errorRows.isEmpty() || memberApprovalCount > 0 || companyApprovalCount > 0 || emissionSnapshot.getReviewCount() > 0) {
            return "WARNING";
        }
        return "HEALTHY";
    }

    private List<Map<String, String>> buildOperationsCenterSummaryCards(int memberApprovalCount,
                                                                        int companyApprovalCount,
                                                                        int memberCount,
                                                                        int companyCount,
                                                                        int srTicketCount,
                                                                        Map<String, String> memberSignals,
                                                                        Map<String, String> integrationSignals,
                                                                        Map<String, String> contentSignals,
                                                                        Map<String, String> operationsToolSignals,
                                                                        EmissionResultFilterSnapshot emissionSnapshot,
                                                                        List<Map<String, String>> monitoringEvents,
                                                                        List<Map<String, String>> errorRows,
                                                                        List<Map<String, String>> schedulerSummary,
                                                                        boolean isEn) {
        List<Map<String, String>> cards = new ArrayList<>();
        cards.add(summaryCard(
                "approval",
                "MEMBER",
                isEn ? "Approval Queue" : "승인 대기",
                String.valueOf(memberApprovalCount + companyApprovalCount),
                isEn ? "Pending member and company approvals." : "회원 및 회원사 승인 대기 건수입니다.",
                localizedAdminPath("/member/approve", isEn)));
        cards.add(summaryCard(
                "member-base",
                "MEMBER",
                isEn ? "Member / Company Issues" : "회원/회원사 점검",
                safeString(memberSignals.get("issueCount")),
                isEn ? "Pending approvals plus dormant, withdrawn, or blocked membership issues."
                        : "승인 대기와 휴면, 탈퇴, 차단 회원사 이슈를 합산한 건수입니다.",
                safeString(memberSignals.get("targetRoute"))));
        cards.add(summaryCard(
                "emission",
                "EMISSION",
                isEn ? "Emission Review Queue" : "배출 검토 대기",
                String.valueOf(emissionSnapshot.getReviewCount()),
                isEn ? "Emission results waiting for review." : "검토가 필요한 배출 결과 건수입니다.",
                appendQuery(localizedAdminPath("/emission/result_list", isEn), "resultStatus", "REVIEW")));
        cards.add(summaryCard(
                "ops-tools",
                "OPERATIONS_TOOLS",
                isEn ? "Operations Tool Alerts" : "운영도구 경고",
                safeString(operationsToolSignals.get("attentionCount")),
                isEn ? "SR execution tickets that are blocked, failed, or ready for action."
                        : "차단, 실패, 또는 즉시 실행 준비가 필요한 SR 작업 건수입니다.",
                "0".equals(safeString(operationsToolSignals.get("attentionCount")))
                        ? localizedAdminPath("/system/sr-workbench", isEn)
                        : localizedAdminPath("/system/codex-request", isEn)));
        cards.add(summaryCard(
                "integration",
                "INTEGRATION",
                isEn ? "Integration Alerts" : "외부연계 경고",
                safeString(integrationSignals.get("recentApiErrorCount")),
                isEn ? "Recent API-linked errors detected from trace and log signals." : "trace 및 로그 기준 최근 API 연계 오류 건수입니다.",
                localizedAdminPath("/system/unified_log", isEn)));
        cards.add(summaryCard(
                "content",
                "CONTENT",
                isEn ? "Content Issues" : "콘텐츠 점검",
                safeString(contentSignals.get("contentIssueCount")),
                isEn ? "Pending help or sitemap content checks in admin operations." : "관리자 운영에서 점검이 필요한 도움말/사이트맵 이슈 건수입니다.",
                "0".equals(safeString(contentSignals.get("contentIssueCount")))
                        ? localizedAdminPath("/content/sitemap", isEn)
                        : appendQuery(localizedAdminPath("/system/help-management", isEn), "pageId", "operations-center")));
        cards.add(summaryCard(
                "system-alerts",
                "SECURITY_SYSTEM",
                isEn ? "Security / System Alerts" : "보안/시스템 경고",
                String.valueOf(monitoringEvents.size() + errorRows.size() + parsePositiveInt(resolveSchedulerAlertCount(schedulerSummary), 0)),
                isEn ? "Critical monitoring, error, and scheduler items." : "보안 탐지, 오류, 스케줄러 경고를 합산합니다.",
                localizedAdminPath("/system/security-monitoring", isEn)));
        return cards;
    }

    private List<Map<String, String>> buildOperationsCenterPriorityItems(List<Map<String, String>> memberApprovalRows,
                                                                         List<Map<String, String>> companyApprovalRows,
                                                                         List<EmissionResultSummaryView> emissionItems,
                                                                         List<Map<String, String>> srTicketRows,
                                                                         List<Map<String, String>> integrationPriorityItems,
                                                                         List<Map<String, String>> contentPriorityItems,
                                                                         List<Map<String, String>> monitoringEvents,
                                                                         List<Map<String, String>> errorRows,
                                                                         List<Map<String, String>> schedulerExecutions,
                                                                         boolean isEn) {
        List<Map<String, String>> items = new ArrayList<>();
        int memberLimit = Math.min(2, memberApprovalRows.size());
        for (int index = 0; index < memberLimit; index++) {
            Map<String, String> row = memberApprovalRows.get(index);
            items.add(priorityItem(
                    safeString(row.get("memberId")),
                    "MEMBER",
                    "APPROVAL",
                    "WARNING",
                    firstNonBlank(safeString(row.get("memberName")), safeString(row.get("memberId")), isEn ? "Pending member approval" : "회원 승인 대기"),
                    firstNonBlank(safeString(row.get("companyName")), safeString(row.get("departmentName")), safeString(row.get("membershipTypeLabel"))),
                    safeString(row.get("joinDate")),
                    firstNonBlank(safeString(row.get("detailUrl")), localizedAdminPath("/member/approve", isEn))));
        }
        if (items.size() < 4) {
            int companyLimit = Math.min(2, companyApprovalRows.size());
            for (int index = 0; index < companyLimit; index++) {
                Map<String, String> row = companyApprovalRows.get(index);
                items.add(priorityItem(
                        safeString(row.get("insttId")),
                        "MEMBER",
                        "COMPANY_APPROVAL",
                        "WARNING",
                        firstNonBlank(safeString(row.get("companyName")), isEn ? "Pending company approval" : "회원사 승인 대기"),
                        firstNonBlank(safeString(row.get("representativeName")), safeString(row.get("businessNumber")), safeString(row.get("membershipTypeLabel"))),
                        safeString(row.get("statusLabel")),
                        firstNonBlank(safeString(row.get("detailUrl")), localizedAdminPath("/member/company-approve", isEn))));
                if (items.size() >= 4) {
                    break;
                }
            }
        }
        if (items.size() < 6) {
            for (EmissionResultSummaryView item : emissionItems) {
                if (!isEmissionReviewCandidate(item)) {
                    continue;
                }
                items.add(priorityItem(
                        item.getResultId(),
                        "EMISSION",
                        "RESULT_REVIEW",
                        "WARNING",
                        firstNonBlank(item.getProjectName(), isEn ? "Emission review pending" : "배출 결과 검토 대기"),
                        firstNonBlank(item.getCompanyName(), item.getVerificationStatusLabel(), item.getResultStatusLabel()),
                        firstNonBlank(item.getCalculatedAt(), item.getVerificationStatusLabel()),
                        firstNonBlank(item.getDetailUrl(), appendQuery(localizedAdminPath("/emission/result_list", isEn), "resultStatus", "REVIEW"))));
                if (items.size() >= 6) {
                    break;
                }
            }
        }
        if (items.size() < 8) {
            for (Map<String, String> row : srTicketRows) {
                String executionStatus = safeString(row.get("executionStatus")).toUpperCase(Locale.ROOT);
                if (!(executionStatus.contains("READY")
                        || executionStatus.contains("RUNNING")
                        || executionStatus.contains("FAILED")
                        || executionStatus.contains("BLOCKED")
                        || executionStatus.contains("PLAN_COMPLETED"))) {
                    continue;
                }
                items.add(priorityItem(
                        safeString(row.get("ticketId")),
                        "OPERATIONS_TOOLS",
                        "SR_WORKBENCH",
                        resolveSrTicketSeverity(executionStatus),
                        firstNonBlank(safeString(row.get("summary")), safeString(row.get("pageLabel")), isEn ? "SR workbench ticket" : "SR 워크벤치 티켓"),
                        firstNonBlank(safeString(row.get("executionComment")), safeString(row.get("executionStatus")), safeString(row.get("status"))),
                        firstNonBlank(safeString(row.get("queueSubmittedAt")), safeString(row.get("createdAt"))),
                        localizedAdminPath("/system/sr-workbench", isEn)));
                if (items.size() >= 8) {
                    break;
                }
            }
        }
        if (items.size() < 8) {
            for (Map<String, String> row : integrationPriorityItems) {
                items.add(new LinkedHashMap<>(row));
                if (items.size() >= 8) {
                    break;
                }
            }
        }
        if (items.size() < 8) {
            for (Map<String, String> row : contentPriorityItems) {
                items.add(new LinkedHashMap<>(row));
                if (items.size() >= 8) {
                    break;
                }
            }
        }
        for (Map<String, String> event : monitoringEvents) {
            if (items.size() >= 8) {
                break;
            }
            String severity = safeString(event.get("severity"));
            if (!severity.toUpperCase(Locale.ROOT).contains("CRITICAL")
                    && !severity.toUpperCase(Locale.ROOT).contains("HIGH")) {
                continue;
            }
            items.add(priorityItem(
                    safeString(event.get("fingerprint")),
                    "SECURITY_SYSTEM",
                    "SECURITY",
                    severity,
                    safeString(event.get("title")),
                    firstNonBlank(safeString(event.get("detail")), safeString(event.get("stateNote"))),
                    safeString(event.get("detectedAt")),
                    appendQuery(localizedAdminPath("/system/security-monitoring", isEn), "fingerprint", safeString(event.get("fingerprint")))));
        }
        if (items.size() < 6) {
            for (Map<String, String> row : errorRows) {
                items.add(priorityItem(
                        safeString(row.get("logId")),
                        "SECURITY_SYSTEM",
                        "ERROR",
                        "WARNING",
                        firstNonBlank(safeString(row.get("errorType")), isEn ? "Error log" : "에러 로그"),
                        firstNonBlank(safeString(row.get("errorMessage")), safeString(row.get("searchableText")), safeString(row.get("requestUri"))),
                        firstNonBlank(safeString(row.get("createdAt")), safeString(row.get("errorAt"))),
                        appendQuery(localizedAdminPath("/system/error-log", isEn), "searchKeyword", safeString(row.get("requestUri")))));
                if (items.size() >= 6) {
                    break;
                }
            }
        }
        if (items.size() < 8) {
            for (Map<String, String> row : schedulerExecutions) {
                String result = safeString(row.get("result")).toUpperCase(Locale.ROOT);
                if (!(result.contains("FAIL") || result.contains("REVIEW") || result.contains("ERROR"))) {
                    continue;
                }
                items.add(priorityItem(
                        safeString(row.get("jobId")) + "-" + safeString(row.get("executedAt")),
                        "SECURITY_SYSTEM",
                        "SCHEDULER",
                        result.contains("FAIL") ? "CRITICAL" : "WARNING",
                        firstNonBlank(safeString(row.get("jobId")), isEn ? "Scheduler execution" : "스케줄러 실행"),
                        safeString(row.get("message")),
                        safeString(row.get("executedAt")),
                        appendQuery(localizedAdminPath("/system/scheduler", isEn), "jobStatus", "REVIEW")));
                if (items.size() >= 8) {
                    break;
                }
            }
        }
        return items;
    }

    private List<Map<String, Object>> buildOperationsCenterWidgetGroups(int memberApprovalCount,
                                                                        int companyApprovalCount,
                                                                        int memberCount,
                                                                        int companyCount,
                                                                        EmissionResultFilterSnapshot emissionSnapshot,
                                                                        int srTicketCount,
                                                                        int srStackCount,
                                                                        boolean codexEnabled,
                                                                        Map<String, String> integrationSignals,
                                                                        int adminSitemapSectionCount,
                                                                        int operationsCenterHelpStepCount,
                                                                        boolean operationsCenterHelpActive,
                                                                        List<Map<String, String>> monitoringCards,
                                                                        List<Map<String, String>> errorRows,
                                                                        List<Map<String, String>> schedulerSummary,
                                                                        List<Map<String, String>> securityAuditRows,
                                                                        boolean isEn) {
        List<Map<String, Object>> groups = new ArrayList<>();
        groups.add(widgetGroup(
                "member-operations",
                "MEMBER",
                isEn ? "Member / Company Operations" : "회원/회원사 운영",
                isEn ? "Review approval backlogs and current managed member scope." : "승인 대기와 현재 운영 대상 회원 규모를 함께 확인합니다.",
                localizedAdminPath("/member/approve", isEn),
                List.of(
                        metricRow(isEn ? "Member approvals" : "회원 승인 대기", String.valueOf(memberApprovalCount)),
                        metricRow(isEn ? "Company approvals" : "회원사 승인 대기", String.valueOf(companyApprovalCount)),
                        metricRow(isEn ? "Members" : "회원 수", String.valueOf(memberCount)),
                        metricRow(isEn ? "Companies" : "회원사 수", String.valueOf(companyCount))),
                List.of(
                        navigationLink(isEn ? "Open approvals" : "승인 보기", localizedAdminPath("/member/approve", isEn)),
                        navigationLink(isEn ? "Company approvals" : "회원사 승인", localizedAdminPath("/member/company-approve", isEn)),
                        navigationLink(isEn ? "Member list" : "회원 목록", localizedAdminPath("/member/list", isEn)))));
        groups.add(widgetGroup(
                "emission-operations",
                "EMISSION",
                isEn ? "Emission / Business Operations" : "배출/업무 운영",
                isEn ? "Track review backlog and verification progress for emission results." : "배출 결과 검토 대기와 검증 진행 상태를 확인합니다.",
                appendQuery(localizedAdminPath("/emission/result_list", isEn), "resultStatus", "REVIEW"),
                List.of(
                        metricRow(isEn ? "Total results" : "전체 결과", String.valueOf(emissionSnapshot.getTotalCount())),
                        metricRow(isEn ? "Under review" : "검토 대기", String.valueOf(emissionSnapshot.getReviewCount())),
                        metricRow(isEn ? "Verified" : "검증 완료", String.valueOf(emissionSnapshot.getVerifiedCount())),
                        metricRow(isEn ? "Latest result" : "최신 결과", emissionSnapshot.getItems().isEmpty()
                                ? "-"
                                : firstNonBlank(emissionSnapshot.getItems().get(0).getCalculatedAt(), emissionSnapshot.getItems().get(0).getProjectName()))),
                List.of(
                        navigationLink(isEn ? "Review queue" : "검토 대기", appendQuery(localizedAdminPath("/emission/result_list", isEn), "resultStatus", "REVIEW")),
                        navigationLink(isEn ? "Result list" : "결과 목록", localizedAdminPath("/emission/result_list", isEn)),
                        navigationLink(isEn ? "Emission sites" : "배출지 관리", localizedAdminPath("/emission/site-management", isEn)))));
        groups.add(widgetGroup(
                "security",
                "SECURITY_SYSTEM",
                isEn ? "Security Monitoring" : "보안 모니터링",
                isEn ? "Track active detections and escalation candidates." : "현재 탐지와 조치 후보를 확인합니다.",
                localizedAdminPath("/system/security-monitoring", isEn),
                toMetricRowsFromSummary(monitoringCards, 4),
                List.of(
                        navigationLink(isEn ? "Monitoring" : "모니터링", localizedAdminPath("/system/security-monitoring", isEn)),
                        navigationLink(isEn ? "Sensor list" : "센서 목록", localizedAdminPath("/monitoring/sensor_list", isEn)),
                        navigationLink(isEn ? "Unified log" : "통합 로그", localizedAdminPath("/system/unified_log", isEn)),
                        navigationLink(isEn ? "Audit" : "감사 이력", localizedAdminPath("/system/security-audit", isEn)))));
        groups.add(widgetGroup(
                "system-operations",
                "SECURITY_SYSTEM",
                isEn ? "System Operations" : "시스템 운영",
                isEn ? "Review error logs, scheduler alerts, and recent operator actions together." : "에러 로그, 스케줄러 경고, 최근 운영 조치를 함께 점검합니다.",
                localizedAdminPath("/system/error-log", isEn),
                List.of(
                        metricRow(isEn ? "Error rows" : "에러 건수", String.valueOf(errorRows.size())),
                        metricRow(isEn ? "Scheduler alerts" : "스케줄러 경고", resolveSchedulerAlertCount(schedulerSummary)),
                        metricRow(isEn ? "Recent actions" : "최근 조치", String.valueOf(securityAuditRows.size())),
                        metricRow(isEn ? "Latest actor" : "최근 수행자", valueFromFirst(securityAuditRows, "actor"))),
                List.of(
                        navigationLink(isEn ? "Error log" : "에러 로그", localizedAdminPath("/system/error-log", isEn)),
                        navigationLink(isEn ? "Scheduler" : "스케줄러", localizedAdminPath("/system/scheduler", isEn)),
                        navigationLink(isEn ? "Observability" : "추적 조회", localizedAdminPath("/system/observability", isEn)))));
        groups.add(widgetGroup(
                "integration-operations",
                "INTEGRATION",
                isEn ? "External Integration" : "외부연계",
                isEn ? "Track real API request/response traces and recent integration-side errors."
                        : "실제 API 요청/응답 trace와 최근 연계 오류를 기준으로 외부연계 상태를 점검합니다.",
                localizedAdminPath("/system/api-management-console", isEn),
                List.of(
                        metricRow(isEn ? "API request traces" : "API 요청 trace", safeString(integrationSignals.get("apiRequestTraceCount"))),
                        metricRow(isEn ? "API response traces" : "API 응답 trace", safeString(integrationSignals.get("apiResponseTraceCount"))),
                        metricRow(isEn ? "Recent API errors" : "최근 API 오류", safeString(integrationSignals.get("recentApiErrorCount"))),
                        metricRow(isEn ? "Observed APIs" : "관측된 API 수", safeString(integrationSignals.get("observedApiCount")))),
                List.of(
                        navigationLink(isEn ? "API management" : "API 관리", localizedAdminPath("/system/api-management-console", isEn)),
                        navigationLink(isEn ? "Unified log" : "통합 로그", localizedAdminPath("/system/unified_log", isEn)),
                        navigationLink(isEn ? "Observability" : "추적 조회", localizedAdminPath("/system/observability", isEn)))));
        groups.add(widgetGroup(
                "content-operations",
                "CONTENT",
                isEn ? "Content Operations" : "콘텐츠 운영",
                isEn ? "Track sitemap exposure and help content readiness." : "사이트맵 노출 구조와 도움말 운영 상태를 확인합니다.",
                localizedAdminPath("/content/sitemap", isEn),
                List.of(
                        metricRow(isEn ? "Sitemap sections" : "사이트맵 섹션", String.valueOf(adminSitemapSectionCount)),
                        metricRow(isEn ? "Center help steps" : "운영센터 도움말 단계", String.valueOf(operationsCenterHelpStepCount)),
                        metricRow(isEn ? "Center help active" : "운영센터 도움말 활성", operationsCenterHelpActive ? (isEn ? "Yes" : "예") : (isEn ? "No" : "아니오")),
                        metricRow(isEn ? "Content screens" : "콘텐츠 화면", "2")),
                List.of(
                        navigationLink(isEn ? "Admin sitemap" : "관리자 사이트맵", localizedAdminPath("/content/sitemap", isEn)),
                        navigationLink(isEn ? "Help management" : "도움말 운영", localizedAdminPath("/system/help-management", isEn)))));
        groups.add(widgetGroup(
                "ops-tooling",
                "OPERATIONS_TOOLS",
                isEn ? "Operations Tooling" : "운영도구",
                isEn ? "Track SR execution backlog, Codex readiness, and operations-center help content." : "SR 실행 대기, Codex 사용 가능 여부, 운영센터 도움말 상태를 함께 확인합니다.",
                localizedAdminPath("/system/sr-workbench", isEn),
                List.of(
                        metricRow(isEn ? "SR tickets" : "SR 티켓", String.valueOf(srTicketCount)),
                        metricRow(isEn ? "Stack items" : "스택 항목", String.valueOf(srStackCount)),
                        metricRow(isEn ? "Codex ready" : "Codex 사용 가능", codexEnabled ? (isEn ? "Yes" : "예") : (isEn ? "No" : "아니오")),
                        metricRow(isEn ? "Execution lane" : "실행 흐름", isEn ? "SR -> Plan -> Codex" : "SR -> 계획 -> Codex")),
                List.of(
                        navigationLink(isEn ? "SR workbench" : "SR 워크벤치", localizedAdminPath("/system/sr-workbench", isEn)),
                        navigationLink(isEn ? "Codex console" : "Codex 실행 콘솔", localizedAdminPath("/system/codex-request", isEn)))));
        return groups;
    }

    private Map<String, String> priorityItem(String itemId,
                                             String domainType,
                                             String sourceType,
                                             String severity,
                                             String title,
                                             String description,
                                             String occurredAt,
                                             String targetRoute) {
        return stringRow(
                "itemId", itemId,
                "domainType", domainType,
                "sourceType", sourceType,
                "severity", severity,
                "title", title,
                "description", description,
                "occurredAt", occurredAt,
                "targetRoute", targetRoute);
    }

    private Map<String, String> playbook(String tone, String title, String body) {
        return stringRow(
                "tone", tone,
                "title", title,
                "body", body);
    }

    private Map<String, Object> navigationSection(String key, String title, String description, List<Map<String, String>> links) {
        return orderedMap(
                "key", key,
                "title", title,
                "description", description,
                "links", links);
    }

    private Map<String, String> navigationLink(String label, String href) {
        return stringRow(
                "label", label,
                "href", href);
    }

    private String resolveSchedulerAlertCount(List<Map<String, String>> schedulerSummary) {
        for (Map<String, String> row : schedulerSummary) {
            String title = safeString(row.get("title")).toUpperCase(Locale.ROOT);
            if (title.contains("REVIEW") || title.contains("실패") || title.contains("FAIL")) {
                return safeString(row.get("value"));
            }
        }
        return schedulerSummary.isEmpty() ? "0" : safeString(schedulerSummary.get(0).get("value"));
    }

    private List<Map<String, String>> toMetricRowsFromSummary(List<Map<String, String>> rows, int limit) {
        List<Map<String, String>> metrics = new ArrayList<>();
        int max = Math.min(limit, rows.size());
        for (int index = 0; index < max; index++) {
            Map<String, String> row = rows.get(index);
            metrics.add(metricRow(firstNonBlank(safeString(row.get("title")), safeString(row.get("label"))), safeString(row.get("value"))));
        }
        return metrics;
    }

    private Map<String, String> summaryCard(String key, String domainType, String title, String value, String description, String targetRoute) {
        return stringRow(
                "key", key,
                "domainType", domainType,
                "title", title,
                "value", value,
                "description", description,
                "targetRoute", targetRoute);
    }

    private Map<String, Object> widgetGroup(String widgetId,
                                            String domainType,
                                            String title,
                                            String description,
                                            String targetRoute,
                                            List<Map<String, String>> metricRows,
                                            List<Map<String, String>> quickLinks) {
        return orderedMap(
                "widgetId", widgetId,
                "domainType", domainType,
                "title", title,
                "description", description,
                "targetRoute", targetRoute,
                "metricRows", metricRows,
                "quickLinks", quickLinks);
    }

    private Map<String, String> metricRow(String label, String value) {
        return stringRow(
                "label", label,
                "value", value);
    }

    private boolean isEmissionReviewCandidate(EmissionResultSummaryView item) {
        return item != null && ("REVIEW".equalsIgnoreCase(safeString(item.getResultStatusCode()))
                || "REVIEW".equalsIgnoreCase(safeString(item.getVerificationStatusCode())));
    }

    private String resolveSrTicketSeverity(String executionStatus) {
        if (executionStatus.contains("FAILED") || executionStatus.contains("BLOCKED")) {
            return "CRITICAL";
        }
        if (executionStatus.contains("RUNNING") || executionStatus.contains("READY") || executionStatus.contains("PLAN_COMPLETED")) {
            return "WARNING";
        }
        return "INFO";
    }

    private int parseCount(Object value) {
        return parsePositiveInt(stringValue(value), 0);
    }

    private String valueFromFirst(List<Map<String, String>> rows, String key) {
        return rows.isEmpty() ? "" : safeString(rows.get(0).get(key));
    }

    private int countListEntries(Object value) {
        return value instanceof List<?> ? ((List<?>) value).size() : 0;
    }

    private String deriveAuditResultStatus(Map<String, String> row, boolean isEn) {
        int responseStatus = parsePositiveInt(safeString(row.get("responseStatus")), 0);
        if (responseStatus >= 500) {
            return isEn ? "Failed" : "실패";
        }
        if (responseStatus >= 400 || !safeString(row.get("errorMessage")).isEmpty()) {
            return isEn ? "Warning" : "경고";
        }
        return isEn ? "Success" : "성공";
    }

    private String extractSecurityAuditActorId(String actor) {
        String normalized = safeString(actor);
        int start = normalized.indexOf('(');
        int end = normalized.indexOf(')');
        if (start >= 0 && end > start) {
            return safeString(normalized.substring(start + 1, end));
        }
        return normalized;
    }

    private List<Map<String, String>> buildSensorListRows(List<Map<String, String>> monitoringEvents,
                                                          List<Map<String, String>> blockCandidateRows,
                                                          boolean isEn) {
        Map<String, Map<String, String>> blockCandidatesByFingerprint = indexBlockCandidatesByFingerprint(blockCandidateRows);
        Map<String, Integer> groupedSignalCount = countGroupedSensorSignals(monitoringEvents);

        List<Map<String, String>> rows = new ArrayList<>();
        int index = 1;
        for (Map<String, String> event : monitoringEvents) {
            String fingerprint = safeString(event.get("fingerprint"));
            Map<String, String> blockCandidate = blockCandidatesByFingerprint.getOrDefault(fingerprint, Collections.emptyMap());
            String typeCode = resolveSensorTypeCode(event);
            String targetUrl = extractMonitoringTargetUrl(safeString(event.get("detail")));
            String sourceIp = extractMonitoringSourceIp(safeString(event.get("detail")));
            String groupKey = firstNonBlank(targetUrl, sourceIp, typeCode);
            String statusCode = resolveSensorStatusCode(event, blockCandidate);
            rows.add(sensorRow(
                    index++,
                    fingerprint,
                    event,
                    blockCandidate,
                    typeCode,
                    statusCode,
                    groupKey,
                    sourceIp,
                    targetUrl,
                    groupedSignalCount.getOrDefault(groupKey, 1),
                    isEn));
        }
        return rows;
    }

    private Map<String, Map<String, String>> indexBlockCandidatesByFingerprint(List<Map<String, String>> blockCandidateRows) {
        Map<String, Map<String, String>> candidatesByFingerprint = new LinkedHashMap<>();
        for (Map<String, String> candidate : blockCandidateRows) {
            String fingerprint = safeString(candidate.get("sourceFingerprint"));
            if (!fingerprint.isEmpty()) {
                candidatesByFingerprint.put(fingerprint, candidate);
            }
        }
        return candidatesByFingerprint;
    }

    private Map<String, Integer> countGroupedSensorSignals(List<Map<String, String>> monitoringEvents) {
        Map<String, Integer> groupedSignalCount = new LinkedHashMap<>();
        for (Map<String, String> event : monitoringEvents) {
            groupedSignalCount.merge(resolveSensorGroupKey(event), 1, Integer::sum);
        }
        return groupedSignalCount;
    }

    private String resolveSensorGroupKey(Map<String, String> event) {
        String detail = safeString(event.get("detail"));
        return firstNonBlank(
                extractMonitoringTargetUrl(detail),
                extractMonitoringSourceIp(detail),
                resolveSensorTypeCode(event));
    }

    private Map<String, String> sensorRow(int index,
                                          String fingerprint,
                                          Map<String, String> event,
                                          Map<String, String> blockCandidate,
                                          String typeCode,
                                          String statusCode,
                                          String groupKey,
                                          String sourceIp,
                                          String targetUrl,
                                          int eventCount,
                                          boolean isEn) {
        return stringRow(
                "sensorId", String.format(Locale.ROOT, "SNS-%03d", index),
                "fingerprint", fingerprint,
                "sensorName", firstNonBlank(safeString(event.get("title")), isEn ? "Monitoring sensor" : "모니터링 센서"),
                "sensorType", typeCode,
                "sensorTypeLabel", resolveSensorTypeLabel(typeCode, isEn),
                "severity", safeString(event.get("severity")),
                "status", statusCode,
                "statusLabel", resolveSensorStatusLabel(statusCode, isEn),
                "eventCount", String.valueOf(eventCount),
                "detectedAt", safeString(event.get("detectedAt")),
                "sourceIp", sourceIp,
                "targetUrl", targetUrl,
                "owner", firstNonBlank(safeString(event.get("stateOwner")), safeString(blockCandidate.get("owner"))),
                "note", firstNonBlank(safeString(event.get("stateNote")), safeString(blockCandidate.get("reason"))),
                "blockStatus", safeString(blockCandidate.get("status")),
                "blockStatusLabel", resolveBlockStatusLabel(safeString(blockCandidate.get("status")), isEn),
                "blockId", safeString(blockCandidate.get("blockId")),
                "detail", safeString(event.get("detail")),
                "targetRoute", appendQuery(localizedAdminPath("/system/security-monitoring", isEn), "fingerprint", fingerprint),
                "sensorKey", groupKey);
    }

    private List<Map<String, String>> buildSensorListSummary(List<Map<String, String>> sensorRows,
                                                             List<Map<String, String>> blockCandidateRows,
                                                             boolean isEn) {
        long alertCount = sensorRows.stream()
                .filter(row -> "ALERT".equalsIgnoreCase(safeString(row.get("status")))
                        || "BLOCKED".equalsIgnoreCase(safeString(row.get("status"))))
                .count();
        long reviewCount = sensorRows.stream()
                .filter(row -> "REVIEW".equalsIgnoreCase(safeString(row.get("status"))))
                .count();
        long activeBlockCount = blockCandidateRows.stream()
                .filter(row -> "ACTIVE".equalsIgnoreCase(safeString(row.get("status"))))
                .count();
        long stableCount = sensorRows.stream()
                .filter(row -> "STABLE".equalsIgnoreCase(safeString(row.get("status"))))
                .count();

        List<Map<String, String>> summary = new ArrayList<>();
        summary.add(platformSummaryCard(
                "sensor-total",
                "SECURITY_SYSTEM",
                isEn ? "Registered Sensors" : "등록 센서",
                String.valueOf(sensorRows.size()),
                isEn ? "Current monitoring-derived sensor rows available in this list." : "현재 목록에 노출되는 모니터링 기반 센서 행 수",
                localizedAdminPath("/monitoring/sensor_list", isEn)));
        summary.add(platformSummaryCard(
                "sensor-alert",
                "SECURITY_SYSTEM",
                isEn ? "Alert Sensors" : "경보 센서",
                String.valueOf(alertCount),
                isEn ? "Critical or blocked sensors that need immediate handling." : "즉시 확인이 필요한 위험 또는 차단 상태 센서 수",
                localizedAdminPath("/monitoring/sensor_list", isEn)));
        summary.add(platformSummaryCard(
                "sensor-review",
                "SECURITY_SYSTEM",
                isEn ? "Review Queue" : "검토 대기",
                String.valueOf(reviewCount),
                isEn ? "Sensors with operator review or note follow-up still pending." : "운영자 검토 또는 메모 후속 조치가 남아 있는 센서 수",
                localizedAdminPath("/monitoring/sensor_list", isEn)));
        summary.add(platformSummaryCard(
                "sensor-stable",
                "SECURITY_SYSTEM",
                isEn ? "Stable Sensors" : "안정 센서",
                String.valueOf(stableCount),
                isEn ? "Sensors without active escalation or block actions." : "활성 승격이나 차단 조치 없이 유지 중인 센서 수",
                localizedAdminPath("/monitoring/sensor_list", isEn)));
        summary.add(platformSummaryCard(
                "sensor-block",
                "SECURITY_SYSTEM",
                isEn ? "Active Blocks" : "활성 차단",
                String.valueOf(activeBlockCount),
                isEn ? "Block candidates already promoted to active control." : "차단 후보 중 실제 활성 제어로 승격된 건수",
                localizedAdminPath("/system/blocklist", isEn)));
        return summary;
    }

    private String resolveSensorTypeCode(Map<String, String> event) {
        String title = safeString(event.get("title")).toLowerCase(Locale.ROOT);
        String detail = safeString(event.get("detail")).toLowerCase(Locale.ROOT);
        if (title.contains("login") || detail.contains("login")) {
            return "AUTH";
        }
        if (detail.contains("/admin") || title.contains("admin")) {
            return "ADMIN";
        }
        if (detail.contains("/api")) {
            return "API";
        }
        if (detail.contains("/system") || title.contains("scheduler") || title.contains("error")) {
            return "OPS";
        }
        return "WEB";
    }

    private String resolveSensorTypeLabel(String typeCode, boolean isEn) {
        switch (safeString(typeCode).toUpperCase(Locale.ROOT)) {
            case "AUTH":
                return isEn ? "Authentication" : "인증";
            case "ADMIN":
                return isEn ? "Admin Access" : "관리자 접근";
            case "API":
                return isEn ? "API Traffic" : "API 트래픽";
            case "OPS":
                return isEn ? "Operations" : "운영";
            default:
                return isEn ? "Web Access" : "웹 접근";
        }
    }

    private String resolveSensorStatusCode(Map<String, String> event, Map<String, String> blockCandidate) {
        String blockStatus = safeString(blockCandidate.get("status")).toUpperCase(Locale.ROOT);
        if ("ACTIVE".equals(blockStatus)) {
            return "BLOCKED";
        }
        if ("REVIEW".equals(blockStatus)) {
            return "REVIEW";
        }
        String stateStatus = safeString(event.get("stateStatus")).toUpperCase(Locale.ROOT);
        if ("IN_PROGRESS".equals(stateStatus) || "REVIEW".equals(stateStatus)) {
            return "REVIEW";
        }
        String severity = safeString(event.get("severity")).toUpperCase(Locale.ROOT);
        if (severity.contains("CRITICAL") || severity.contains("HIGH")) {
            return "ALERT";
        }
        return "STABLE";
    }

    private String resolveSensorStatusLabel(String statusCode, boolean isEn) {
        switch (safeString(statusCode).toUpperCase(Locale.ROOT)) {
            case "BLOCKED":
                return isEn ? "Blocked" : "차단";
            case "REVIEW":
                return isEn ? "Review" : "검토";
            case "ALERT":
                return isEn ? "Alert" : "경보";
            default:
                return isEn ? "Stable" : "안정";
        }
    }

    private String resolveBlockStatusLabel(String statusCode, boolean isEn) {
        switch (safeString(statusCode).toUpperCase(Locale.ROOT)) {
            case "ACTIVE":
                return isEn ? "Active Block" : "활성 차단";
            case "REVIEW":
                return isEn ? "Review Candidate" : "검토 후보";
            case "RELEASED":
                return isEn ? "Released" : "해제";
            default:
                return "";
        }
    }

    private String extractMonitoringSourceIp(String detail) {
        String normalized = safeString(detail);
        java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("(?:remote|ip)\\s*[:=]\\s*([^\\s,]+)", java.util.regex.Pattern.CASE_INSENSITIVE)
                .matcher(normalized);
        if (matcher.find()) {
            return safeString(matcher.group(1));
        }
        return "";
    }

    private String extractMonitoringTargetUrl(String detail) {
        String normalized = safeString(detail);
        java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("(\\/[-A-Za-z0-9_./?=&%]+)")
                .matcher(normalized);
        while (matcher.find()) {
            String candidate = safeString(matcher.group(1));
            if (candidate.startsWith("/")) {
                return candidate;
            }
        }
        return "";
    }

    private Map<String, String> platformSummaryCard(String key, String domainType, String title, String value, String description, String targetRoute) {
        return stringRow(
                "key", key,
                "domainType", domainType,
                "title", title,
                "value", value,
                "description", description,
                "targetRoute", targetRoute);
    }

    private String normalizePerformanceUri(String value) {
        String normalized = safeString(value);
        if (normalized.startsWith("/en/")) {
            normalized = normalized.substring(3);
            if (!normalized.startsWith("/")) {
                normalized = "/" + normalized;
            }
        }
        int queryIndex = normalized.indexOf('?');
        if (queryIndex >= 0) {
            normalized = normalized.substring(0, queryIndex);
        }
        return normalized;
    }

    private String localizedAdminPath(String path, boolean isEn) {
        return isEn ? "/en/admin" + path : "/admin" + path;
    }

    private String appendQuery(String path, String key, String value) {
        String normalizedValue = safeString(value);
        if (normalizedValue.isEmpty()) {
            return path;
        }
        return path + (path.contains("?") ? "&" : "?") + key + "=" + normalizedValue;
    }

    private String resolvePerformanceStatus(int heapUsagePercent, int slowRatePercent, int errorRatePercent) {
        if (heapUsagePercent >= 85 || slowRatePercent >= 20 || errorRatePercent >= 10) {
            return "DANGER";
        }
        if (heapUsagePercent >= 70 || slowRatePercent >= 10 || errorRatePercent > 0) {
            return "WARNING";
        }
        return "HEALTHY";
    }

    private String formatBytes(long value) {
        if (value <= 0L) {
            return "0 B";
        }
        String[] units = {"B", "KB", "MB", "GB", "TB"};
        double size = value;
        int unitIndex = 0;
        while (size >= 1024D && unitIndex < units.length - 1) {
            size /= 1024D;
            unitIndex++;
        }
        return String.format(Locale.ROOT, unitIndex == 0 ? "%.0f %s" : "%.1f %s", size, units[unitIndex]);
    }

    private String formatDurationMs(long value) {
        if (value < 1000L) {
            return value + " ms";
        }
        return String.format(Locale.ROOT, "%.2f s", value / 1000D);
    }

    private int parsePageIndex(String value) {
        return Math.max(1, parsePositiveInt(value, 1));
    }

    private int parsePositiveInt(String value, int defaultValue) {
        try {
            return Integer.parseInt(safeString(value));
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    private long parsePositiveLong(String value, long defaultValue) {
        try {
            return Long.parseLong(safeString(value));
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    private Map<String, Object> orderedMap(Object... fields) {
        Map<String, Object> values = new LinkedHashMap<>();
        if (fields == null) {
            return values;
        }
        for (int index = 0; index + 1 < fields.length; index += 2) {
            values.put(String.valueOf(fields[index]), fields[index + 1]);
        }
        return values;
    }

    private Map<String, String> stringRow(String... fields) {
        Map<String, String> row = new LinkedHashMap<>();
        if (fields == null) {
            return row;
        }
        for (int index = 0; index + 1 < fields.length; index += 2) {
            row.put(safeString(fields[index]), safeString(fields[index + 1]));
        }
        return row;
    }

    private String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }

    private String safeString(Object value) {
        return value == null ? "" : safeString(String.valueOf(value));
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String value : values) {
            if (!safeString(value).isEmpty()) {
                return safeString(value);
            }
        }
        return "";
    }
}
