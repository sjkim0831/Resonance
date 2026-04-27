package egovframework.com.feature.admin.web;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class AdminCertificateApprovalService {

    private static final int PAGE_SIZE = 10;

    private final AdminPayloadSelectionSupport adminPayloadSelectionSupport;
    private final Map<String, CertificateApprovalRecord> recordStore = new ConcurrentHashMap<>();

    AdminCertificateApprovalService(AdminPayloadSelectionSupport adminPayloadSelectionSupport) {
        this.adminPayloadSelectionSupport = adminPayloadSelectionSupport;
        register(seed(
                "CERT-2026-0008", "CA-2026-0008", "에코카본테크", "123-81-45210", "김지운",
                "2025년 4분기 순감축량 산정보고서", "2025.10 - 2025.12", "신규 발급", "ISSUE",
                "EMISSION", "배출 인증서",
                "2026-03-28 14:20", "128.43 tCO2eq", "승인 대기", "PENDING", "bg-amber-100 text-amber-700",
                "REC 중복 없음", "bg-emerald-100 text-emerald-700", "전력거래소 회신 완료", "첨부 3건 모두 확인 완료",
                "", Arrays.asList(file("산정보고서.pdf", "2.4 MB"), file("법인인증서검증서.pdf", "840 KB"), file("재생에너지사용확인서.xlsx", "540 KB"))));
        register(seed(
                "CERT-2026-0007", "CA-2026-0007", "그린포워드", "214-86-11452", "이하나",
                "2025년 4분기 인증서 재발급 신청", "2025.10 - 2025.12", "재발급", "REISSUE",
                "JOINT", "공동인증서",
                "2026-03-27 09:10", "84.10 tCO2eq", "보완 요청", "HOLD", "bg-sky-100 text-sky-700",
                "REC 중복 검토중", "bg-amber-100 text-amber-700", "재생에너지 사용량 재확인 필요", "전력 사용내역 보완 제출 요청",
                "전력거래소 확인서 최신본을 다시 제출해 주세요.", Arrays.asList(file("재발급사유서.hwp", "120 KB"), file("전력사용내역.pdf", "1.1 MB"))));
        register(seed(
                "CERT-2026-0006", "CA-2026-0006", "블루수소랩", "605-88-90112", "박민수",
                "2025년 3분기 인증서 정정 발급", "2025.07 - 2025.09", "정정 발급", "CORRECTION",
                "CLOUD", "클라우드 인증서",
                "2026-03-24 16:40", "43.25 tCO2eq", "반려", "REJECTED", "bg-rose-100 text-rose-700",
                "REC 중복 의심", "bg-rose-100 text-rose-700", "중복 수혜 가능성 있어 추가 소명 필요", "첨부 증빙 간 배출량 수치 불일치",
                "첨부 서류의 감축량 수치가 상이하여 반려되었습니다.", Arrays.asList(file("정정신청서.pdf", "300 KB"), file("REC확인자료.pdf", "650 KB"))));
        register(seed(
                "CERT-2026-0005", "CA-2026-0005", "넥스트에너지", "110-81-77111", "정세라",
                "2025년 3분기 인증서 발급 신청", "2025.07 - 2025.09", "신규 발급", "ISSUE",
                "EMISSION", "배출 인증서",
                "2026-03-20 11:05", "212.00 tCO2eq", "승인 완료", "APPROVED", "bg-emerald-100 text-emerald-700",
                "REC 중복 없음", "bg-emerald-100 text-emerald-700", "발급 승인 완료", "승인 후 발급 큐 전송 완료",
                "", Arrays.asList(file("발급신청서.pdf", "440 KB"), file("감축실적명세서.xlsx", "1.8 MB"))));
    }

    public Map<String, Object> buildPagePayload(
            String pageIndexParam,
            String searchKeyword,
            String requestType,
            String status,
            String result,
            boolean isEn) {
        String normalizedKeyword = safeLower(searchKeyword);
        String normalizedRequestType = normalizeCode(requestType);
        String normalizedStatus = normalizeCode(status);
        int requestedPageIndex = parsePageIndex(pageIndexParam);

        List<Map<String, Object>> rows = recordStore.values().stream()
                .sorted(Comparator.comparing(CertificateApprovalRecord::getRequestedAt).reversed())
                .filter(row -> matches(row, normalizedKeyword, normalizedRequestType, normalizedStatus))
                .map(CertificateApprovalRecord::toMap)
                .collect(Collectors.toList());

        int totalCount = rows.size();
        int totalPages = Math.max(1, (int) Math.ceil(totalCount / (double) PAGE_SIZE));
        int pageIndex = Math.min(requestedPageIndex, totalPages);
        int fromIndex = Math.max(0, (pageIndex - 1) * PAGE_SIZE);
        int toIndex = Math.min(totalCount, fromIndex + PAGE_SIZE);
        List<Map<String, Object>> pagedRows = fromIndex >= toIndex ? new ArrayList<>() : rows.subList(fromIndex, toIndex);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("approvalRows", pagedRows);
        response.put("certificateApprovalTotalCount", totalCount);
        response.put("pageIndex", pageIndex);
        response.put("totalPages", totalPages);
        response.put("searchKeyword", safeTrim(searchKeyword));
        response.put("requestType", normalizedRequestType);
        response.put("status", normalizedStatus.isEmpty() ? "PENDING" : normalizedStatus);
        response.put("certificateApprovalResultMessage", resolveResultMessage(result, isEn));
        return response;
    }

    AdminApprovalActionService.ActionResult submitApproval(
            Object action,
            Object certificateId,
            Object selectedIds,
            Object rejectReason,
            boolean isEn,
            boolean hasAccess) {
        AdminApprovalActionService.ActionResult result = AdminApprovalActionService.ActionResult.certificate(
                normalizeAction(action),
                adminPayloadSelectionSupport.extractPayloadIds(selectedIds, stringValue(certificateId)),
                trimToLen(safeTrim(stringValue(rejectReason)), 1000));
        if (!hasAccess) {
            return result.forbidden(isEn
                    ? "Only master administrators can approve certificates."
                    : "인증서 승인 처리는 마스터 관리자만 수행할 수 있습니다.");
        }
        if (result.getSelectedIds().isEmpty()) {
            return result.badRequest(isEn
                    ? "No certificate request was selected."
                    : "처리할 인증서 신청을 선택해 주세요.");
        }
        if (result.getTargetStatus().isEmpty()) {
            return result.badRequest(isEn
                    ? "The requested action is not valid."
                    : "요청한 처리 작업이 올바르지 않습니다.");
        }
        if ("R".equals(result.getTargetStatus()) && safeTrim(result.getRejectReason()).isEmpty()) {
            return result.badRequest(isEn
                    ? "A rejection reason is required."
                    : "반려 사유를 입력해 주세요.");
        }
        for (String id : result.getSelectedIds()) {
            CertificateApprovalRecord record = recordStore.get(id);
            if (record == null) {
                return result.badRequest(isEn
                        ? "The certificate request could not be found."
                        : "대상 인증서 신청 내역을 찾을 수 없습니다.");
            }
            if (!record.isActionable()) {
                return result.badRequest(isEn
                        ? "Only pending or on-hold certificate requests can be processed."
                        : "승인 대기 또는 보완 요청 상태의 인증서만 처리할 수 있습니다.");
            }
            record.applyStatus(result.getTargetStatus(), result.getRejectReason());
        }
        return result.success();
    }

    private boolean matches(CertificateApprovalRecord row, String keyword, String requestType, String status) {
        if (!requestType.isEmpty() && !requestType.equals(row.requestType)) {
            return false;
        }
        String targetStatus = status.isEmpty() ? "PENDING" : status;
        if (!targetStatus.equals(row.status)) {
            return false;
        }
        if (keyword.isEmpty()) {
            return true;
        }
        String haystack = String.join(" ",
                row.requestNumber,
                row.companyName,
                row.businessNumber,
                row.requesterName,
                row.reportTitle).toLowerCase(Locale.ROOT);
        return haystack.contains(keyword);
    }

    private void register(CertificateApprovalRecord record) {
        recordStore.put(record.certificateId, record);
    }

    private CertificateApprovalRecord seed(
            String certificateId,
            String requestNumber,
            String companyName,
            String businessNumber,
            String requesterName,
            String reportTitle,
            String reportingPeriod,
            String requestTypeLabel,
            String requestType,
            String certificateTypeCode,
            String certificateTypeLabel,
            String requestedAt,
            String estimatedVolumeLabel,
            String statusLabel,
            String status,
            String statusBadgeClass,
            String recCheckStatus,
            String recCheckBadgeClass,
            String gridCheckSummary,
            String reviewerMemo,
            String rejectReason,
            List<Map<String, Object>> attachmentFiles) {
        return new CertificateApprovalRecord(
                certificateId, requestNumber, companyName, businessNumber, requesterName, reportTitle,
                reportingPeriod, requestTypeLabel, requestType, certificateTypeCode, certificateTypeLabel, requestedAt, estimatedVolumeLabel,
                statusLabel, status, statusBadgeClass, recCheckStatus, recCheckBadgeClass,
                gridCheckSummary, reviewerMemo, rejectReason, attachmentFiles);
    }

    public List<Map<String, Object>> buildAuditSnapshotRows() {
        return recordStore.values().stream()
                .sorted(Comparator.comparing(CertificateApprovalRecord::getRequestedAt).reversed())
                .map(CertificateApprovalRecord::toAuditSnapshotMap)
                .collect(Collectors.toList());
    }

    private static Map<String, Object> file(String fileName, String fileSizeLabel) {
        Map<String, Object> file = new LinkedHashMap<>();
        file.put("fileName", fileName);
        file.put("fileSizeLabel", fileSizeLabel);
        file.put("downloadUrl", "#");
        return file;
    }

    private int parsePageIndex(String value) {
        try {
            int parsed = Integer.parseInt(safeTrim(value));
            return parsed > 0 ? parsed : 1;
        } catch (NumberFormatException ex) {
            return 1;
        }
    }

    private String resolveResultMessage(String result, boolean isEn) {
        String normalized = safeLower(result);
        if (normalized.isEmpty()) {
            return "";
        }
        if ("approved".equals(normalized) || "batchapproved".equals(normalized)) {
            return isEn ? "The certificate approval has been completed." : "인증서 승인 처리가 완료되었습니다.";
        }
        if ("rejected".equals(normalized) || "batchrejected".equals(normalized)) {
            return isEn ? "The certificate request has been rejected." : "인증서 반려 처리가 완료되었습니다.";
        }
        return "";
    }

    private String trimToLen(String value, int maxLen) {
        String normalized = safeTrim(value);
        if (normalized.length() <= maxLen) {
            return normalized;
        }
        return normalized.substring(0, maxLen);
    }

    private String normalizeCode(Object value) {
        return safeTrim(stringValue(value)).replace(' ', '_').toUpperCase(Locale.ROOT);
    }

    private String normalizeAction(Object value) {
        return safeTrim(stringValue(value)).toLowerCase(Locale.ROOT);
    }

    private String safeLower(Object value) {
        return safeTrim(stringValue(value)).toLowerCase(Locale.ROOT);
    }

    private String safeTrim(String value) {
        return value == null ? "" : value.trim();
    }

    private String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private static final class CertificateApprovalRecord {
        private final String certificateId;
        private final String requestNumber;
        private final String companyName;
        private final String businessNumber;
        private final String requesterName;
        private final String reportTitle;
        private final String reportingPeriod;
        private final String requestTypeLabel;
        private final String requestType;
        private final String certificateTypeCode;
        private final String certificateTypeLabel;
        private final String requestedAt;
        private final String estimatedVolumeLabel;
        private volatile String statusLabel;
        private volatile String status;
        private volatile String statusBadgeClass;
        private final String recCheckStatus;
        private final String recCheckBadgeClass;
        private final String gridCheckSummary;
        private final String reviewerMemo;
        private volatile String rejectReason;
        private final List<Map<String, Object>> attachmentFiles;

        private CertificateApprovalRecord(
                String certificateId,
                String requestNumber,
                String companyName,
                String businessNumber,
                String requesterName,
                String reportTitle,
                String reportingPeriod,
                String requestTypeLabel,
                String requestType,
                String certificateTypeCode,
                String certificateTypeLabel,
                String requestedAt,
                String estimatedVolumeLabel,
                String statusLabel,
                String status,
                String statusBadgeClass,
                String recCheckStatus,
                String recCheckBadgeClass,
                String gridCheckSummary,
                String reviewerMemo,
                String rejectReason,
                List<Map<String, Object>> attachmentFiles) {
            this.certificateId = certificateId;
            this.requestNumber = requestNumber;
            this.companyName = companyName;
            this.businessNumber = businessNumber;
            this.requesterName = requesterName;
            this.reportTitle = reportTitle;
            this.reportingPeriod = reportingPeriod;
            this.requestTypeLabel = requestTypeLabel;
            this.requestType = requestType;
            this.certificateTypeCode = certificateTypeCode;
            this.certificateTypeLabel = certificateTypeLabel;
            this.requestedAt = requestedAt;
            this.estimatedVolumeLabel = estimatedVolumeLabel;
            this.statusLabel = statusLabel;
            this.status = status;
            this.statusBadgeClass = statusBadgeClass;
            this.recCheckStatus = recCheckStatus;
            this.recCheckBadgeClass = recCheckBadgeClass;
            this.gridCheckSummary = gridCheckSummary;
            this.reviewerMemo = reviewerMemo;
            this.rejectReason = rejectReason;
            this.attachmentFiles = attachmentFiles;
        }

        private String getRequestedAt() {
            return requestedAt;
        }

        private boolean isActionable() {
            return "PENDING".equals(status) || "HOLD".equals(status);
        }

        private void applyStatus(String targetStatus, String rejectReason) {
            if ("P".equals(targetStatus)) {
                this.status = "APPROVED";
                this.statusLabel = "승인 완료";
                this.statusBadgeClass = "bg-emerald-100 text-emerald-700";
                this.rejectReason = "";
                return;
            }
            if ("R".equals(targetStatus)) {
                this.status = "REJECTED";
                this.statusLabel = "반려";
                this.statusBadgeClass = "bg-rose-100 text-rose-700";
                this.rejectReason = rejectReason == null ? "" : rejectReason;
            }
        }

        private Map<String, Object> toMap() {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("certificateId", certificateId);
            row.put("requestNumber", requestNumber);
            row.put("companyName", companyName);
            row.put("businessNumber", businessNumber);
            row.put("requesterName", requesterName);
            row.put("reportTitle", reportTitle);
            row.put("reportingPeriod", reportingPeriod);
            row.put("requestTypeLabel", requestTypeLabel);
            row.put("requestType", requestType);
            row.put("certificateTypeCode", certificateTypeCode);
            row.put("certificateTypeLabel", certificateTypeLabel);
            row.put("requestedAt", requestedAt);
            row.put("estimatedVolumeLabel", estimatedVolumeLabel);
            row.put("statusLabel", statusLabel);
            row.put("status", status);
            row.put("statusBadgeClass", statusBadgeClass);
            row.put("recCheckStatus", recCheckStatus);
            row.put("recCheckBadgeClass", recCheckBadgeClass);
            row.put("gridCheckSummary", gridCheckSummary);
            row.put("reviewerMemo", reviewerMemo);
            row.put("rejectReason", rejectReason);
            row.put("attachmentFiles", attachmentFiles);
            return row;
        }

        private Map<String, Object> toAuditSnapshotMap() {
            Map<String, Object> row = new LinkedHashMap<>(toMap());
            row.put("certificateNo", certificateId);
            row.put("requestId", requestNumber);
            row.put("companyId", businessNumber);
            row.put("applicantName", requesterName);
            row.put("reason", rejectReason.isEmpty() ? reviewerMemo : rejectReason);
            return row;
        }
    }
}
