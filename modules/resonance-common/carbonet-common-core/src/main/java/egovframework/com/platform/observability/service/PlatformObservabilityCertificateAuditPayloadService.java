package egovframework.com.platform.observability.service;

import egovframework.com.common.audit.AuditEventRecordVO;
import egovframework.com.common.audit.AuditEventSearchVO;
import egovframework.com.feature.admin.web.AdminCertificateApprovalService;
import egovframework.com.platform.service.observability.CertificateAuditLogPageDataPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class PlatformObservabilityCertificateAuditPayloadService implements CertificateAuditLogPageDataPort {

    private static final int CERTIFICATE_AUDIT_LOG_PAGE_SIZE = 10;
    private static final int CERTIFICATE_AUDIT_LOG_FETCH_SIZE = 200;

    private final AdminCertificateApprovalService adminCertificateApprovalService;
    private final ObservabilityQueryService observabilityQueryService;

    public Map<String, Object> buildCertificateAuditLogPagePayload(
            String pageIndexParam,
            String searchKeyword,
            String auditType,
            String status,
            String certificateType,
            String startDate,
            String endDate,
            boolean isEn) {
        Map<String, Object> payload = new LinkedHashMap<>();
        int pageIndex = parsePageIndex(pageIndexParam);
        String normalizedKeyword = safeString(searchKeyword);
        String normalizedAuditType = normalizeCertificateAuditType(auditType);
        String normalizedStatus = normalizeCertificateAuditStatus(status);
        String normalizedCertificateType = normalizeCertificateAuditCertificateType(certificateType);
        String normalizedStartDate = normalizeDate(startDate);
        String normalizedEndDate = normalizeDate(endDate);

        Map<String, Map<String, Object>> approvalSnapshotById = adminCertificateApprovalService.buildAuditSnapshotRows().stream()
                .collect(Collectors.toMap(
                        row -> safeString(row.get("certificateNo")),
                        row -> row,
                        (left, right) -> left,
                        LinkedHashMap::new));

        List<Map<String, String>> mergedRows = new ArrayList<>();
        for (Map<String, Object> row : approvalSnapshotById.values()) {
            String rowStatus = safeString(row.get("status")).toUpperCase(Locale.ROOT);
            if ("PENDING".equals(rowStatus) || "HOLD".equals(rowStatus)) {
                mergedRows.add(buildPendingCertificateAuditRow(row, isEn));
            }
        }

        AuditEventSearchVO searchVO = new AuditEventSearchVO();
        searchVO.setFirstIndex(0);
        searchVO.setRecordCountPerPage(CERTIFICATE_AUDIT_LOG_FETCH_SIZE);
        searchVO.setMenuCode("AMENU_CERTIFICATE_APPROVE");
        searchVO.setPageId("certificate-approve");
        searchVO.setResultStatus("SUCCESS");

        for (AuditEventRecordVO item : observabilityQueryService.selectAuditEventList(searchVO)) {
            if (!safeString(item.getActionCode()).startsWith("CERTIFICATE_APPROVAL_")) {
                continue;
            }
            for (String certificateId : extractCertificateAuditEntityIds(item)) {
                Map<String, Object> snapshot = approvalSnapshotById.getOrDefault(certificateId, Collections.emptyMap());
                mergedRows.add(buildPersistedCertificateAuditRow(item, certificateId, snapshot, isEn));
            }
        }

        List<Map<String, String>> filteredRows = filterCertificateAuditRows(
                mergedRows,
                normalizedKeyword,
                normalizedAuditType,
                normalizedStatus,
                normalizedCertificateType,
                normalizedStartDate,
                normalizedEndDate);

        int totalCount = filteredRows.size();
        int totalPages = totalCount == 0 ? 1 : (int) Math.ceil(totalCount / (double) CERTIFICATE_AUDIT_LOG_PAGE_SIZE);
        int currentPage = Math.max(1, Math.min(pageIndex, totalPages));
        int startIndex = Math.max(currentPage - 1, 0) * CERTIFICATE_AUDIT_LOG_PAGE_SIZE;
        int endIndex = Math.min(startIndex + CERTIFICATE_AUDIT_LOG_PAGE_SIZE, filteredRows.size());
        List<Map<String, String>> pagedRows = startIndex >= endIndex
                ? Collections.emptyList()
                : new ArrayList<>(filteredRows.subList(startIndex, endIndex));

        long pendingCount = filteredRows.stream().filter(row -> "PENDING".equals(safeString(row.get("statusCode")))).count();
        long rejectedCount = filteredRows.stream().filter(row -> "REJECTED".equals(safeString(row.get("statusCode")))).count();
        long reissuedCount = filteredRows.stream().filter(row -> "REISSUE".equals(safeString(row.get("auditTypeCode")))).count();
        long highRiskCount = filteredRows.stream().filter(row -> "HIGH".equals(safeString(row.get("riskLevelCode")))).count();

        payload.put("isEn", isEn);
        payload.put("pageIndex", currentPage);
        payload.put("pageSize", CERTIFICATE_AUDIT_LOG_PAGE_SIZE);
        payload.put("totalCount", totalCount);
        payload.put("totalPages", totalPages);
        payload.put("searchKeyword", normalizedKeyword);
        payload.put("auditType", normalizedAuditType);
        payload.put("status", normalizedStatus);
        payload.put("certificateType", normalizedCertificateType);
        payload.put("startDate", normalizedStartDate);
        payload.put("endDate", normalizedEndDate);
        payload.put("lastUpdated", filteredRows.isEmpty() ? "" : safeString(filteredRows.get(0).get("auditAt")));
        payload.put("certificateAuditSummary", List.of(
                metricRow(isEn ? "Pending Reviews" : "검토 대기", String.valueOf(pendingCount),
                        isEn ? "Requests still waiting for certificate approval or supplement review." : "승인 또는 보완 검토가 남아 있는 요청입니다."),
                metricRow(isEn ? "Rejected" : "반려", String.valueOf(rejectedCount),
                        isEn ? "Requests returned with a rejection reason." : "반려 사유와 함께 반환된 요청입니다."),
                metricRow(isEn ? "Reissues" : "재발급", String.valueOf(reissuedCount),
                        isEn ? "Reissue-related decisions within the current filter." : "현재 조건에서 재발급 관련 처리 건수입니다."),
                metricRow(isEn ? "High Risk" : "고위험", String.valueOf(highRiskCount),
                        isEn ? "Rows flagged for duplicate or urgent handling." : "중복·긴급 처리로 분류된 건수입니다.")));
        payload.put("certificateAuditAlerts", buildCertificateAuditAlerts(filteredRows, isEn));
        payload.put("certificateAuditRows", pagedRows);
        return payload;
    }

    @Override
    public Map<String, Object> buildCertificateAuditLogPageData(String pageIndexParam, String searchKeyword, String auditType,
                                                                String status, String certificateType, String startDate,
                                                                String endDate, boolean isEn) {
        return buildCertificateAuditLogPagePayload(
                pageIndexParam,
                searchKeyword,
                auditType,
                status,
                certificateType,
                startDate,
                endDate,
                isEn);
    }

    private Map<String, String> metricRow(String label, String value, String description) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("label", label);
        row.put("value", value);
        row.put("description", description);
        return row;
    }

    private String normalizeCertificateAuditType(String auditType) {
        String normalized = safeString(auditType).toUpperCase(Locale.ROOT);
        if ("ISSUE".equals(normalized) || "REISSUE".equals(normalized) || "RENEW".equals(normalized) || "REVOKE".equals(normalized)) {
            return normalized;
        }
        return "ALL";
    }

    private String normalizeCertificateAuditStatus(String status) {
        String normalized = safeString(status).toUpperCase(Locale.ROOT);
        if ("PENDING".equals(normalized) || "APPROVED".equals(normalized) || "REJECTED".equals(normalized)) {
            return normalized;
        }
        return "ALL";
    }

    private String normalizeCertificateAuditCertificateType(String certificateType) {
        String normalized = safeString(certificateType).toUpperCase(Locale.ROOT);
        if ("EMISSION".equals(normalized) || "JOINT".equals(normalized) || "CLOUD".equals(normalized)) {
            return normalized;
        }
        return "ALL";
    }

    private Map<String, String> buildPendingCertificateAuditRow(Map<String, Object> row, boolean isEn) {
        String requestTypeCode = safeString(row.get("requestType")).toUpperCase(Locale.ROOT);
        String statusCode = safeString(row.get("status")).toUpperCase(Locale.ROOT);
        String certificateTypeCode = safeString(row.get("certificateTypeCode")).toUpperCase(Locale.ROOT);
        Map<String, String> auditRow = new LinkedHashMap<>();
        auditRow.put("auditAt", safeString(row.get("requestedAt")));
        auditRow.put("requestId", safeString(row.get("requestId")));
        auditRow.put("certificateNo", safeString(row.get("certificateNo")));
        auditRow.put("companyName", safeString(row.get("companyName")));
        auditRow.put("companyId", safeString(row.get("companyId")));
        auditRow.put("applicantName", safeString(row.get("applicantName")));
        auditRow.put("applicantId", safeString(row.get("applicantName")));
        auditRow.put("approverName", isEn ? "Pending assignment" : "담당자 배정 대기");
        auditRow.put("auditTypeCode", requestTypeCode);
        auditRow.put("auditType", resolveCertificateAuditTypeLabel(requestTypeCode, isEn));
        auditRow.put("certificateTypeCode", certificateTypeCode);
        auditRow.put("certificateType", resolveCertificateAuditCertificateTypeLabel(certificateTypeCode, isEn));
        auditRow.put("statusCode", normalizePendingCertificateAuditStatus(statusCode));
        auditRow.put("status", resolveCertificateAuditStatusLabel(normalizePendingCertificateAuditStatus(statusCode), isEn));
        auditRow.put("riskLevelCode", resolveCertificateAuditRiskLevelCode(requestTypeCode, statusCode, safeString(row.get("recCheckStatus"))));
        auditRow.put("riskLevel", resolveCertificateAuditRiskLevelLabel(auditRow.get("riskLevelCode"), isEn));
        auditRow.put("reason", firstNonBlank(safeString(row.get("reason")), safeString(row.get("reviewerMemo")), safeString(row.get("gridCheckSummary"))));
        return auditRow;
    }

    private Map<String, String> buildPersistedCertificateAuditRow(AuditEventRecordVO item, String certificateId, Map<String, Object> snapshot, boolean isEn) {
        String actionCode = safeString(item.getActionCode()).toUpperCase(Locale.ROOT);
        String statusCode = "SUCCESS".equalsIgnoreCase(safeString(item.getResultStatus())) ? "APPROVED" : "REJECTED";
        String auditTypeCode = resolveCertificateAuditTypeCodeFromAction(actionCode, snapshot);
        String certificateTypeCode = safeString(snapshot.get("certificateTypeCode")).toUpperCase(Locale.ROOT);
        Map<String, String> row = new LinkedHashMap<>();
        row.put("auditAt", safeString(item.getCreatedAt()));
        row.put("requestId", firstNonBlank(safeString(snapshot.get("requestId")), certificateId));
        row.put("certificateNo", firstNonBlank(certificateId, safeString(snapshot.get("certificateNo"))));
        row.put("companyName", safeString(snapshot.get("companyName")));
        row.put("companyId", safeString(snapshot.get("companyId")));
        row.put("applicantName", safeString(snapshot.get("applicantName")));
        row.put("applicantId", safeString(snapshot.get("applicantName")));
        row.put("approverName", firstNonBlank(safeString(item.getActorId()), isEn ? "System" : "시스템"));
        row.put("auditTypeCode", auditTypeCode);
        row.put("auditType", resolveCertificateAuditTypeLabel(auditTypeCode, isEn));
        row.put("certificateTypeCode", certificateTypeCode);
        row.put("certificateType", resolveCertificateAuditCertificateTypeLabel(certificateTypeCode, isEn));
        row.put("statusCode", statusCode);
        row.put("status", resolveCertificateAuditStatusLabel(statusCode, isEn));
        row.put("riskLevelCode", resolveCertificateAuditRiskLevelCode(auditTypeCode, statusCode, safeString(snapshot.get("recCheckStatus"))));
        row.put("riskLevel", resolveCertificateAuditRiskLevelLabel(row.get("riskLevelCode"), isEn));
        row.put("reason", firstNonBlank(safeString(item.getReasonSummary()), safeString(snapshot.get("reason")), safeString(snapshot.get("reviewerMemo"))));
        return row;
    }

    private List<String> extractCertificateAuditEntityIds(AuditEventRecordVO item) {
        String entityId = safeString(item == null ? null : item.getEntityId());
        if (entityId.isEmpty()) {
            return Collections.emptyList();
        }
        List<String> ids = Stream.of(entityId.split("[,|]"))
                .map(this::safeString)
                .filter(value -> !value.isEmpty())
                .distinct()
                .collect(Collectors.toList());
        return ids.isEmpty() ? Collections.singletonList(entityId) : ids;
    }

    private List<Map<String, String>> filterCertificateAuditRows(List<Map<String, String>> rows, String searchKeyword, String auditType, String status, String certificateType, String startDate, String endDate) {
        String normalizedKeyword = safeString(searchKeyword).toLowerCase(Locale.ROOT);
        List<Map<String, String>> filtered = new ArrayList<>();
        for (Map<String, String> row : rows) {
            if (!"ALL".equals(auditType) && !auditType.equals(safeString(row.get("auditTypeCode")))) {
                continue;
            }
            if (!"ALL".equals(status) && !status.equals(safeString(row.get("statusCode")))) {
                continue;
            }
            if (!"ALL".equals(certificateType) && !certificateType.equals(safeString(row.get("certificateTypeCode")))) {
                continue;
            }
            String auditDate = safeString(row.get("auditAt"));
            String auditDateOnly = auditDate.length() >= 10 ? auditDate.substring(0, 10) : auditDate;
            if (!startDate.isEmpty() && auditDateOnly.compareTo(startDate) < 0) {
                continue;
            }
            if (!endDate.isEmpty() && auditDateOnly.compareTo(endDate) > 0) {
                continue;
            }
            if (!normalizedKeyword.isEmpty()
                    && !safeString(row.get("requestId")).toLowerCase(Locale.ROOT).contains(normalizedKeyword)
                    && !safeString(row.get("certificateNo")).toLowerCase(Locale.ROOT).contains(normalizedKeyword)
                    && !safeString(row.get("companyName")).toLowerCase(Locale.ROOT).contains(normalizedKeyword)
                    && !safeString(row.get("companyId")).toLowerCase(Locale.ROOT).contains(normalizedKeyword)
                    && !safeString(row.get("applicantName")).toLowerCase(Locale.ROOT).contains(normalizedKeyword)
                    && !safeString(row.get("approverName")).toLowerCase(Locale.ROOT).contains(normalizedKeyword)
                    && !safeString(row.get("reason")).toLowerCase(Locale.ROOT).contains(normalizedKeyword)) {
                continue;
            }
            filtered.add(new LinkedHashMap<>(row));
        }
        filtered.sort(Comparator.<Map<String, String>, String>comparing(row -> safeString(row.get("auditAt"))).reversed());
        return filtered;
    }

    private List<Map<String, String>> buildCertificateAuditAlerts(List<Map<String, String>> rows, boolean isEn) {
        List<Map<String, String>> alerts = new ArrayList<>();
        long pendingHighRiskCount = rows.stream()
                .filter(row -> "PENDING".equals(safeString(row.get("statusCode"))))
                .filter(row -> "HIGH".equals(safeString(row.get("riskLevelCode"))))
                .count();
        if (pendingHighRiskCount > 0) {
            alerts.add(mapOf(
                    "title", isEn ? "High-risk requests still pending" : "고위험 요청이 아직 대기 중입니다",
                    "body", isEn ? "High-risk reissue or revocation requests should be closed with dual review before shift handoff."
                            : "고위험 재발급/폐기 요청은 근무 교대 전 이중 검토로 종결해야 합니다.",
                    "tone", "danger"));
        }
        long rejectedCount = rows.stream().filter(row -> "REJECTED".equals(safeString(row.get("statusCode")))).count();
        if (rejectedCount > 0) {
            alerts.add(mapOf(
                    "title", isEn ? "Rejected requests need follow-up" : "반려 건에 대한 후속 조치가 필요합니다",
                    "body", isEn ? "Check that the rejection reason was sent back to the applicant and the evidence gap is documented."
                            : "반려 사유가 신청자에게 전달되었는지, 증빙 보완 항목이 기록되었는지 확인하세요.",
                    "tone", "warning"));
        }
        if (alerts.isEmpty()) {
            alerts.add(mapOf(
                    "title", isEn ? "No immediate escalation" : "즉시 에스컬레이션 대상 없음",
                    "body", isEn ? "Current certificate audit events are within the standard review window."
                            : "현재 인증서 감사 이벤트는 표준 검토 시간 안에서 처리되고 있습니다.",
                    "tone", "neutral"));
        }
        return alerts;
    }

    private String normalizePendingCertificateAuditStatus(String statusCode) {
        if ("HOLD".equals(statusCode)) {
            return "PENDING";
        }
        if ("APPROVED".equals(statusCode) || "REJECTED".equals(statusCode) || "PENDING".equals(statusCode)) {
            return statusCode;
        }
        return "PENDING";
    }

    private String resolveCertificateAuditTypeCodeFromAction(String actionCode, Map<String, Object> snapshot) {
        if (actionCode.contains("REISSUE")) {
            return "REISSUE";
        }
        if (actionCode.contains("RENEW")) {
            return "RENEW";
        }
        if (actionCode.contains("REVOKE")) {
            return "REVOKE";
        }
        String snapshotType = safeString(snapshot.get("requestType")).toUpperCase(Locale.ROOT);
        return snapshotType.isEmpty() ? "ISSUE" : snapshotType;
    }

    private String resolveCertificateAuditTypeLabel(String code, boolean isEn) {
        switch (safeString(code).toUpperCase(Locale.ROOT)) {
            case "REISSUE":
                return isEn ? "Reissue" : "재발급";
            case "RENEW":
                return isEn ? "Renewal" : "갱신";
            case "REVOKE":
                return isEn ? "Revocation" : "폐기";
            default:
                return isEn ? "Issue" : "발급";
        }
    }

    private String resolveCertificateAuditCertificateTypeLabel(String code, boolean isEn) {
        switch (safeString(code).toUpperCase(Locale.ROOT)) {
            case "JOINT":
                return isEn ? "Joint Certificate" : "공동인증서";
            case "CLOUD":
                return isEn ? "Cloud Certificate" : "클라우드 인증서";
            default:
                return isEn ? "Emission Certificate" : "배출 인증서";
        }
    }

    private String resolveCertificateAuditStatusLabel(String code, boolean isEn) {
        switch (safeString(code).toUpperCase(Locale.ROOT)) {
            case "APPROVED":
                return isEn ? "Approved" : "승인";
            case "REJECTED":
                return isEn ? "Rejected" : "반려";
            default:
                return isEn ? "Pending" : "대기";
        }
    }

    private String resolveCertificateAuditRiskLevelCode(String auditTypeCode, String statusCode, String recCheckStatus) {
        String normalizedType = safeString(auditTypeCode).toUpperCase(Locale.ROOT);
        String normalizedStatus = safeString(statusCode).toUpperCase(Locale.ROOT);
        String normalizedRec = safeString(recCheckStatus).toUpperCase(Locale.ROOT);
        if ("REVOKE".equals(normalizedType) || "REISSUE".equals(normalizedType) && "PENDING".equals(normalizedStatus) || normalizedRec.contains("중복")) {
            return "HIGH";
        }
        if ("REJECTED".equals(normalizedStatus) || "RENEW".equals(normalizedType)) {
            return "MEDIUM";
        }
        return "LOW";
    }

    private String resolveCertificateAuditRiskLevelLabel(String code, boolean isEn) {
        switch (safeString(code).toUpperCase(Locale.ROOT)) {
            case "HIGH":
                return isEn ? "High" : "높음";
            case "MEDIUM":
                return isEn ? "Medium" : "중간";
            default:
                return isEn ? "Low" : "낮음";
        }
    }

    private Map<String, String> mapOf(String key1, String value1, String key2, String value2, String key3, String value3) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put(key1, value1);
        row.put(key2, value2);
        row.put(key3, value3);
        return row;
    }

    private String normalizeDate(String value) {
        LocalDate parsed = parseDate(value);
        return parsed == null ? "" : parsed.toString();
    }

    private LocalDate parseDate(String value) {
        String normalized = safeString(value);
        if (normalized.isEmpty()) {
            return null;
        }
        try {
            return LocalDate.parse(normalized);
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }

    private int parsePageIndex(String pageIndexParam) {
        if (pageIndexParam != null && !pageIndexParam.trim().isEmpty()) {
            try {
                return Integer.parseInt(pageIndexParam.trim());
            } catch (NumberFormatException ignored) {
                return 1;
            }
        }
        return 1;
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String value : values) {
            String normalized = safeString(value);
            if (!normalized.isEmpty()) {
                return normalized;
            }
        }
        return "";
    }

    private String safeString(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}
