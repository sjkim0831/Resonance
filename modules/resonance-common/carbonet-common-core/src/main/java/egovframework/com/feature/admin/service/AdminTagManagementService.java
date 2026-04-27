package egovframework.com.feature.admin.service;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class AdminTagManagementService {

    private final AdminPagePayloadFactory adminPagePayloadFactory;

    public AdminTagManagementService(AdminPagePayloadFactory adminPagePayloadFactory) {
        this.adminPagePayloadFactory = adminPagePayloadFactory;
    }

    public Map<String, Object> buildPagePayload(String searchKeyword, String status, boolean isEn) {
        String keyword = safe(searchKeyword).toLowerCase(Locale.ROOT);
        String normalizedStatus = safe(status).toUpperCase(Locale.ROOT);

        List<Map<String, String>> catalog = baseCatalog(isEn);
        List<Map<String, String>> filtered = new ArrayList<>();
        for (Map<String, String> row : catalog) {
            if (!matchesKeyword(row, keyword)) {
                continue;
            }
            if (!normalizedStatus.isEmpty() && !normalizedStatus.equalsIgnoreCase(safe(row.get("status")))) {
                continue;
            }
            filtered.add(row);
        }

        Map<String, Object> payload = adminPagePayloadFactory.create(isEn, "A0040303");
        payload.put("searchKeyword", safe(searchKeyword));
        payload.put("status", safe(status));
        payload.put("summaryCards", buildSummaryCards(catalog, filtered, isEn));
        payload.put("tagRows", filtered);
        payload.put("usageRows", buildUsageRows(isEn));
        payload.put("governanceNotes", buildGovernanceNotes(isEn));
        return payload;
    }

    private boolean matchesKeyword(Map<String, String> row, String keyword) {
        if (keyword.isEmpty()) {
            return true;
        }
        return safe(row.get("tagCode")).toLowerCase(Locale.ROOT).contains(keyword)
                || safe(row.get("tagName")).toLowerCase(Locale.ROOT).contains(keyword)
                || safe(row.get("alias")).toLowerCase(Locale.ROOT).contains(keyword)
                || safe(row.get("linkedCategory")).toLowerCase(Locale.ROOT).contains(keyword);
    }

    private List<Map<String, String>> baseCatalog(boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(tagRow("TAG-FAQ-001", isEn ? "Emission calculation" : "배출량 산정", isEn ? "calculator" : "산정기", "ACTIVE",
                isEn ? "Active" : "운영중", "18", isEn ? "FAQ / Service guide" : "FAQ / 서비스 안내", "2026-03-30 16:10", "carbon-admin"));
        rows.add(tagRow("TAG-FAQ-002", isEn ? "Certificate issuance" : "인증서 발급", isEn ? "certificate" : "인증", "ACTIVE",
                isEn ? "Active" : "운영중", "11", isEn ? "FAQ / Application" : "FAQ / 신청 안내", "2026-03-29 10:05", "ops-content"));
        rows.add(tagRow("TAG-QNA-010", isEn ? "Trading settlement" : "거래 정산", isEn ? "settlement" : "정산", "REVIEW",
                isEn ? "Review" : "검토필요", "4", isEn ? "Q&A classification" : "Q&A 분류", "2026-03-28 18:40", "trade-ops"));
        rows.add(tagRow("TAG-QNA-011", isEn ? "Refund status" : "환불 진행", isEn ? "refund" : "환불", "ACTIVE",
                isEn ? "Active" : "운영중", "7", isEn ? "Q&A classification" : "Q&A 분류", "2026-03-27 09:20", "trade-ops"));
        rows.add(tagRow("TAG-CMS-021", isEn ? "External integration" : "외부 연계", isEn ? "integration" : "연계", "REVIEW",
                isEn ? "Review" : "검토필요", "3", isEn ? "Search recommendation" : "검색 추천", "2026-03-26 13:15", "integration-admin"));
        rows.add(tagRow("TAG-CMS-022", isEn ? "Monitoring alert" : "모니터링 알림", isEn ? "alert" : "알림", "ACTIVE",
                isEn ? "Active" : "운영중", "6", isEn ? "Search recommendation" : "검색 추천", "2026-03-25 11:55", "ops-monitor"));
        rows.add(tagRow("TAG-ARC-031", isEn ? "Legacy classification" : "구 분류", isEn ? "legacy" : "구분류", "ARCHIVED",
                isEn ? "Archived" : "보관", "0", isEn ? "Archived" : "보관", "2026-03-20 17:00", "content-migration"));
        return rows;
    }

    private List<Map<String, String>> buildSummaryCards(List<Map<String, String>> catalog, List<Map<String, String>> filtered, boolean isEn) {
        int activeCount = countByStatus(catalog, "ACTIVE");
        int reviewCount = countByStatus(catalog, "REVIEW");
        int archivedCount = countByStatus(catalog, "ARCHIVED");
        List<Map<String, String>> cards = new ArrayList<>();
        cards.add(summaryCard(isEn ? "Visible tags" : "운영 태그", String.valueOf(filtered.size()),
                isEn ? "Rows matching the current filter." : "현재 조회 조건에 맞는 태그 수입니다."));
        cards.add(summaryCard(isEn ? "Active" : "운영중", String.valueOf(activeCount),
                isEn ? "Tags currently exposed in FAQ, Q&A, or recommendations." : "FAQ, Q&A, 추천 영역에 실제 노출 중인 태그입니다."));
        cards.add(summaryCard(isEn ? "Review needed" : "검토필요", String.valueOf(reviewCount),
                isEn ? "Alias or linkage should be reviewed before more content is added." : "별칭 또는 연결 분류를 재검토해야 하는 태그입니다."));
        cards.add(summaryCard(isEn ? "Archived" : "보관", String.valueOf(archivedCount),
                isEn ? "Inactive tags retained for audit or migration history." : "감사 이력 및 이전 작업 추적용으로 보관된 태그입니다."));
        return cards;
    }

    private List<Map<String, String>> buildUsageRows(boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(usageRow("TAG-FAQ-001", isEn ? "Emission calculation" : "배출량 산정",
                isEn ? "/admin/content/faq_list" : "/admin/content/faq_list",
                isEn ? "FAQ quick filter and landing FAQ cards" : "FAQ 빠른 필터 및 랜딩 FAQ 카드",
                isEn ? "FAQ management linkage" : "FAQ 관리 연계"));
        rows.add(usageRow("TAG-QNA-010", isEn ? "Trading settlement" : "거래 정산",
                isEn ? "/admin/content/qna" : "/admin/content/qna",
                isEn ? "Q&A classification for inquiry routing" : "문의 라우팅용 Q&A 분류",
                isEn ? "Q&A category operation" : "Q&A 분류 운영"));
        rows.add(usageRow("TAG-CMS-021", isEn ? "External integration" : "외부 연계",
                isEn ? "/admin/system/help-management?pageId=external-sync" : "/admin/system/help-management?pageId=external-sync",
                isEn ? "Search recommendation and help overlay keyword" : "검색 추천 및 도움말 overlay 키워드",
                isEn ? "Help content / search recommendation" : "도움말 / 검색 추천"));
        return rows;
    }

    private List<Map<String, String>> buildGovernanceNotes(boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(noteRow(
                isEn ? "Do not archive tags with active content." : "운영 콘텐츠 연결 태그는 바로 보관하지 않음",
                isEn ? "Before archiving a tag, remove or replace linked FAQ/Q&A exposure so search and quick-filter behavior does not break."
                        : "태그를 보관 처리하기 전에 연결된 FAQ/Q&A 노출처를 먼저 정리해야 검색 추천과 빠른 필터 동작이 깨지지 않습니다."));
        rows.add(noteRow(
                isEn ? "Keep aliases aligned with search keywords." : "별칭은 실제 검색어와 정렬",
                isEn ? "Alias fields should follow the keywords users type most often, not only the internal admin terminology."
                        : "별칭은 내부 운영 용어보다 실제 사용자가 입력하는 검색어를 우선해 유지합니다."));
        rows.add(noteRow(
                isEn ? "Review tag-category duplication weekly." : "주 1회 중복 분류 점검",
                isEn ? "When a FAQ tag and a Q&A category converge on the same term, keep one operating term and consolidate the other."
                        : "FAQ 태그와 Q&A 분류가 같은 용어로 수렴하면 하나의 운영 용어로 통합하고 나머지는 정리합니다."));
        return rows;
    }

    private int countByStatus(List<Map<String, String>> rows, String status) {
        int count = 0;
        for (Map<String, String> row : rows) {
            if (status.equalsIgnoreCase(safe(row.get("status")))) {
                count++;
            }
        }
        return count;
    }

    private Map<String, String> summaryCard(String title, String value, String description) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("title", title);
        row.put("value", value);
        row.put("description", description);
        return row;
    }

    private Map<String, String> tagRow(
            String tagCode,
            String tagName,
            String alias,
            String status,
            String statusLabel,
            String usageCount,
            String linkedCategory,
            String updatedAt,
            String owner) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("tagCode", tagCode);
        row.put("tagName", tagName);
        row.put("alias", alias);
        row.put("status", status);
        row.put("statusLabel", statusLabel);
        row.put("usageCount", usageCount);
        row.put("linkedCategory", linkedCategory);
        row.put("updatedAt", updatedAt);
        row.put("owner", owner);
        return row;
    }

    private Map<String, String> usageRow(String tagCode, String tagName, String surface, String purpose, String managedBy) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("tagCode", tagCode);
        row.put("tagName", tagName);
        row.put("surface", surface);
        row.put("purpose", purpose);
        row.put("managedBy", managedBy);
        return row;
    }

    private Map<String, String> noteRow(String title, String body) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("title", title);
        row.put("body", body);
        return row;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
