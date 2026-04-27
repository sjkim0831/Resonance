package egovframework.com.platform.bootstrap.service;

import egovframework.com.feature.admin.model.vo.EmissionResultSummaryView;
import egovframework.com.feature.admin.model.vo.SecurityAuditSnapshot;
import egovframework.com.platform.read.AdminSummaryReadPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminHomeBootstrapReadService {

    private final AdminSummaryReadPort adminSummaryReadPort;

    public Map<String, Object> buildAdminHomePageData(
            boolean isEn,
            List<EmissionResultSummaryView> emissionItems,
            SecurityAuditSnapshot auditSnapshot) {
        return Map.of(
                "isEn", isEn,
                "summaryCards", buildAdminHomeSummaryCards(isEn),
                "reviewQueueRows", buildAdminHomeReviewQueueRows(emissionItems, isEn),
                "reviewProgressRows", buildAdminHomeReviewProgressRows(emissionItems, isEn),
                "operationalStatusRows", buildAdminHomeOperationalStatusRows(isEn),
                "systemLogs", buildAdminHomeSystemLogs(auditSnapshot, isEn)
        );
    }

    private List<Map<String, String>> buildAdminHomeSummaryCards(boolean isEn) {
        List<Map<String, String>> monitoringCards = adminSummaryReadPort.getSecurityMonitoringCards(isEn);
        List<Map<String, String>> schedulerCards = adminSummaryReadPort.getSchedulerSummary(isEn);
        List<Map<String, String>> blocklistCards = adminSummaryReadPort.getBlocklistSummary(isEn);
        return List.of(
                homeSummaryCard(
                        safeCardValue(monitoringCards, 0, "title", isEn ? "Current RPS" : "현재 RPS"),
                        safeCardValue(monitoringCards, 0, "value", "0"),
                        safeCardValue(monitoringCards, 0, "description", ""),
                        "monitoring",
                        "text-[var(--kr-gov-green)]",
                        "border-l-[var(--kr-gov-green)]"),
                homeSummaryCard(
                        safeCardValue(schedulerCards, 2, "title", isEn ? "Failed Today" : "오늘 실패"),
                        safeCardValue(schedulerCards, 2, "value", "0"),
                        safeCardValue(schedulerCards, 2, "description", ""),
                        "schedule",
                        "text-orange-400",
                        "border-l-orange-400"),
                homeSummaryCard(
                        safeCardValue(blocklistCards, 0, "title", isEn ? "Active Blocks" : "활성 차단"),
                        safeCardValue(blocklistCards, 0, "value", "0"),
                        safeCardValue(blocklistCards, 0, "description", ""),
                        "gpp_bad",
                        "text-[var(--kr-gov-blue)]",
                        "border-l-[var(--kr-gov-blue)]"));
    }

    private List<Map<String, String>> buildAdminHomeReviewQueueRows(List<EmissionResultSummaryView> items, boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        if (items != null) {
            for (EmissionResultSummaryView item : items) {
                if (item == null) {
                    continue;
                }
                if (!"REVIEW".equals(safeString(item.getResultStatusCode()))) {
                    continue;
                }
                rows.add(mapOf(
                        "title", safeString(item.getProjectName()),
                        "type", safeString(item.getCompanyName()),
                        "appliedOn", safeString(item.getCalculatedAt()),
                        "detailUrl", safeString(item.getDetailUrl()),
                        "statusLabel", safeString(item.getVerificationStatusLabel())));
                if (rows.size() >= 3) {
                    break;
                }
            }
        }
        if (!rows.isEmpty()) {
            return rows;
        }
        return List.of(
                mapOf(
                        "title", isEn ? "Blue Hydrogen Process Review" : "블루수소 공정 검토",
                        "type", isEn ? "Hanbit Energy" : "한빛에너지",
                        "appliedOn", "2026-03-03",
                        "detailUrl", buildAdminPath(isEn, "/emission/result_list?resultStatus=REVIEW"),
                        "statusLabel", isEn ? "Pending" : "검증 대기"),
                mapOf(
                        "title", isEn ? "Methanol Conversion Project" : "메탄올 전환 프로젝트",
                        "type", isEn ? "Daehan Synthesis" : "대한신소재",
                        "appliedOn", "2026-02-24",
                        "detailUrl", buildAdminPath(isEn, "/emission/result_list?resultStatus=REVIEW"),
                        "statusLabel", isEn ? "Pending" : "검증 대기"));
    }

    private List<Map<String, String>> buildAdminHomeReviewProgressRows(List<EmissionResultSummaryView> items, boolean isEn) {
        int draftCount = 0;
        int reviewCount = 0;
        int completedCount = 0;
        int verifiedCount = 0;
        int totalCount = 0;
        if (items != null) {
            for (EmissionResultSummaryView item : items) {
                if (item == null) {
                    continue;
                }
                totalCount++;
                String resultStatus = safeString(item.getResultStatusCode());
                String verificationStatus = safeString(item.getVerificationStatusCode());
                if ("DRAFT".equals(resultStatus)) {
                    draftCount++;
                }
                if ("REVIEW".equals(resultStatus)) {
                    reviewCount++;
                }
                if ("COMPLETED".equals(resultStatus)) {
                    completedCount++;
                }
                if ("VERIFIED".equals(verificationStatus)) {
                    verifiedCount++;
                }
            }
        }
        int normalizedTotal = Math.max(totalCount, 1);
        return List.of(
                homeProgressRow(isEn ? "Draft" : "임시 저장", draftCount, normalizedTotal, "bg-slate-400"),
                homeProgressRow(isEn ? "Under Review" : "검토 중", reviewCount, normalizedTotal, "bg-blue-500"),
                homeProgressRow(isEn ? "Completed" : "산정 완료", completedCount, normalizedTotal, "bg-emerald-500"),
                homeProgressRow(isEn ? "Verified" : "검증 완료", verifiedCount, normalizedTotal, "bg-[var(--kr-gov-green)]"));
    }

    private List<Map<String, String>> buildAdminHomeOperationalStatusRows(boolean isEn) {
        List<Map<String, String>> policyCards = adminSummaryReadPort.getSecurityPolicySummary(isEn);
        List<Map<String, String>> whitelistCards = adminSummaryReadPort.getIpWhitelistSummary(isEn);
        List<Map<String, String>> blocklistCards = adminSummaryReadPort.getBlocklistSummary(isEn);
        return List.of(
                homeOperationalStatusRow("policy", isEn ? "Security Policy Engine" : "보안 정책 엔진",
                        safeCardValue(policyCards, 0, "value", "0") + " " + safeCardValue(policyCards, 0, "title", ""), "HEALTHY"),
                homeOperationalStatusRow("verified_user", isEn ? "IP Allowlist Guard" : "IP 허용목록 가드",
                        safeCardValue(whitelistCards, 0, "value", "0") + " " + safeCardValue(whitelistCards, 0, "title", ""), "HEALTHY"),
                homeOperationalStatusRow("shield_locked", isEn ? "Threat Block Queue" : "위협 차단 큐",
                        safeCardValue(blocklistCards, 0, "value", "0") + " " + safeCardValue(blocklistCards, 0, "title", ""), "WARNING"));
    }

    private List<Map<String, String>> buildAdminHomeSystemLogs(SecurityAuditSnapshot auditSnapshot, boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        if (auditSnapshot != null && auditSnapshot.getAuditLogs() != null) {
            adminSummaryReadPort.buildSecurityAuditRows(auditSnapshot.getAuditLogs(), isEn).stream()
                    .limit(3)
                    .forEach(item -> rows.add(mapOf(
                            "level", safeString(item.get("action")).contains(isEn ? "Blocked" : "차단") ? "WARNING" : "INFO",
                            "message", safeString(item.get("detail")),
                            "timestamp", safeString(item.get("auditAt")))));
        }
        if (!rows.isEmpty()) {
            return rows;
        }
        return List.of(
                mapOf("level", "INFO", "message", isEn ? "Admin home summary snapshot loaded successfully." : "관리자 홈 요약 스냅샷을 정상적으로 불러왔습니다.", "timestamp", "2026-03-18 09:00"),
                mapOf("level", "WARNING", "message", isEn ? "No recent security audit events were found." : "최근 보안 감사 이벤트가 없어 기본 로그를 사용 중입니다.", "timestamp", "2026-03-18 08:58"));
    }

    private Map<String, String> homeSummaryCard(
            String title,
            String value,
            String description,
            String icon,
            String iconClass,
            String borderClass) {
        return mapOf(
                "title", title,
                "value", value,
                "description", description,
                "icon", icon,
                "iconClass", iconClass,
                "borderClass", borderClass);
    }

    private Map<String, String> homeProgressRow(String label, int value, int total, String barClass) {
        int width = Math.max(8, (int) Math.round((value * 100.0d) / Math.max(total, 1)));
        return mapOf(
                "label", label,
                "value", String.valueOf(value),
                "width", width + "%",
                "barClass", barClass);
    }

    private Map<String, String> homeOperationalStatusRow(String icon, String label, String meta, String status) {
        return mapOf(
                "icon", icon,
                "label", label,
                "meta", meta,
                "status", status);
    }

    private String safeCardValue(List<Map<String, String>> cards, int index, String key, String defaultValue) {
        if (cards == null || index < 0 || index >= cards.size() || cards.get(index) == null) {
            return defaultValue;
        }
        return safeString(cards.get(index).get(key)).isEmpty() ? defaultValue : safeString(cards.get(index).get(key));
    }

    private String buildAdminPath(boolean isEn, String path) {
        return isEn ? "/en/admin" + path : "/admin" + path;
    }

    private Map<String, String> mapOf(String... values) {
        java.util.Map<String, String> row = new java.util.LinkedHashMap<>();
        for (int index = 0; index + 1 < values.length; index += 2) {
            row.put(values[index], values[index + 1]);
        }
        return row;
    }

    private String safeString(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}
