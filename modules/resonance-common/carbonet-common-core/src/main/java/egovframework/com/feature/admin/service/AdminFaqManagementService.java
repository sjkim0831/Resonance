package egovframework.com.feature.admin.service;

import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AdminFaqManagementService {

    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private final Map<String, FaqItem> faqStore = new ConcurrentHashMap<>();
    private final AdminPagePayloadFactory adminPagePayloadFactory;

    public AdminFaqManagementService(AdminPagePayloadFactory adminPagePayloadFactory) {
        this.adminPagePayloadFactory = adminPagePayloadFactory;
        seed(new FaqItem("FAQ_001", "ACCOUNT", "회원사 계정 잠금은 어떻게 해제하나요?", "How do I unlock a company account?", "로그인 실패 누적, 관리자 잠금 해제 절차", "Repeated login failures and admin unlock procedure", "PUBLIC", "PUBLISHED", 1, "회원운영팀", "Member Ops", "2026-03-29 10:20", "member_admin"));
        seed(new FaqItem("FAQ_002", "APPLICATION", "가입 반려 후 재신청은 어디에서 하나요?", "Where do I re-apply after registration rejection?", "가입현황 조회, 반려 사유, 재신청 링크", "Join-status search, rejection reason, and re-apply link", "PUBLIC", "PUBLISHED", 2, "가입심사팀", "Registration Review", "2026-03-28 14:05", "join_reviewer"));
        seed(new FaqItem("FAQ_003", "DATA", "배출량 업로드 오류는 어디서 확인하나요?", "Where can I review emission upload errors?", "업로드 결과, 형식 오류, 재제출 경로", "Upload result, format errors, and resubmission path", "PUBLIC", "REVIEW", 3, "배출량운영팀", "Emission Ops", "2026-03-27 09:40", "emission_mgr"));
        seed(new FaqItem("FAQ_004", "POLICY", "정책 변경 공지는 언제 FAQ에 반영되나요?", "When are policy changes reflected in FAQ?", "정책 공지, 운영 검토, 공개 반영 일정", "Policy notice, operations review, and publication timing", "PRIVATE", "DRAFT", 4, "정책지원팀", "Policy Support", "2026-03-26 17:15", "policy_owner"));
        seed(new FaqItem("FAQ_005", "ACCOUNT", "비밀번호 초기화 링크가 만료되면 어떻게 하나요?", "What should I do if the password reset link expires?", "재발송 조건, 인증 절차, 고객지원 연결", "Reissue criteria, identity verification, and support contact", "PUBLIC", "PUBLISHED", 5, "회원운영팀", "Member Ops", "2026-03-24 11:00", "member_admin"));
        seed(new FaqItem("FAQ_006", "DATA", "검증 반려 사유는 어디서 다시 확인하나요?", "Where can I review the validation rejection reason again?", "검증 결과 이력, 반려 사유, 후속 조치", "Validation history, rejection reason, and follow-up action", "PRIVATE", "REVIEW", 6, "검증지원팀", "Validation Support", "2026-03-23 16:35", "validator01"));
        seed(new FaqItem("FAQ_007", "APPLICATION", "승인 대기 중 제출 서류를 수정할 수 있나요?", "Can I update submitted files while approval is pending?", "승인 대기 상태, 수정 가능 조건, 담당자 승인", "Pending state, edit conditions, and approver confirmation", "PUBLIC", "PUBLISHED", 7, "가입심사팀", "Registration Review", "2026-03-22 13:10", "join_reviewer"));
        seed(new FaqItem("FAQ_008", "POLICY", "운영자 전용 FAQ는 누구에게 노출되나요?", "Who can view operator-only FAQ entries?", "관리자 권한 범위, 비공개 노출 규칙", "Admin authority scope and private exposure rules", "PRIVATE", "DRAFT", 8, "정책지원팀", "Policy Support", "2026-03-20 08:55", "policy_owner"));
    }

    public synchronized Map<String, Object> buildPagePayload(String searchKeyword,
                                                             String status,
                                                             String exposure,
                                                             String category,
                                                             String faqId,
                                                             boolean isEn) {
        String keyword = safe(searchKeyword).toLowerCase(Locale.ROOT);
        String normalizedStatus = safe(status).toUpperCase(Locale.ROOT);
        String normalizedExposure = safe(exposure).toUpperCase(Locale.ROOT);
        String normalizedCategory = safe(category).toUpperCase(Locale.ROOT);

        List<Map<String, String>> catalog = baseCatalog(isEn);
        List<Map<String, String>> filtered = new ArrayList<>();
        for (Map<String, String> row : catalog) {
            if (!matchesKeyword(row, keyword)) {
                continue;
            }
            if (!normalizedStatus.isEmpty() && !"ALL".equals(normalizedStatus)
                    && !normalizedStatus.equalsIgnoreCase(safe(row.get("status")))) {
                continue;
            }
            if (!normalizedExposure.isEmpty() && !"ALL".equals(normalizedExposure)
                    && !normalizedExposure.equalsIgnoreCase(safe(row.get("exposure")))) {
                continue;
            }
            if (!normalizedCategory.isEmpty() && !"ALL".equals(normalizedCategory)
                    && !normalizedCategory.equalsIgnoreCase(safe(row.get("category")))) {
                continue;
            }
            filtered.add(row);
        }

        Map<String, String> selected = selectRow(filtered, catalog, safe(faqId));

        Map<String, Object> payload = adminPagePayloadFactory.create(isEn, "A0040301");
        payload.put("searchKeyword", safe(searchKeyword));
        payload.put("status", safe(status));
        payload.put("exposure", safe(exposure));
        payload.put("category", safe(category));
        payload.put("selectedFaqId", safe(selected.get("id")));
        payload.put("summaryCards", buildSummaryCards(catalog, filtered.size(), isEn));
        payload.put("faqRows", filtered);
        payload.put("selectedFaq", selected);
        payload.put("governanceNotes", buildGovernanceNotes(isEn));
        return payload;
    }

    public synchronized Map<String, Object> saveFaq(String faqId,
                                                    String category,
                                                    String question,
                                                    String answerScope,
                                                    String exposure,
                                                    String status,
                                                    String displayOrder,
                                                    boolean isEn) {
        FaqItem item = resolveFaq(faqId);
        if (!safe(category).isEmpty()) {
            item.category = safe(category).toUpperCase(Locale.ROOT);
        }
        if (!safe(question).isEmpty()) {
            if (isEn) {
                item.questionEn = safe(question);
            } else {
                item.questionKo = safe(question);
            }
        }
        if (!safe(answerScope).isEmpty()) {
            if (isEn) {
                item.answerScopeEn = safe(answerScope);
            } else {
                item.answerScopeKo = safe(answerScope);
            }
        }
        if (!safe(exposure).isEmpty()) {
            item.exposure = safe(exposure).toUpperCase(Locale.ROOT);
        }
        if (!safe(status).isEmpty()) {
            item.status = safe(status).toUpperCase(Locale.ROOT);
        }
        if (!safe(displayOrder).isEmpty()) {
            try {
                item.displayOrder = Integer.parseInt(safe(displayOrder));
            } catch (NumberFormatException ignored) {
                // keep previous sort order
            }
        }
        item.lastChangedAt = LocalDateTime.now().format(DATE_TIME_FORMATTER);
        item.lastChangedBy = "codex-admin";

        Map<String, Object> response = adminPagePayloadFactory.createStatusResponse(
                "saved",
                true,
                "faqId",
                item.id,
                isEn ? "FAQ draft saved." : "FAQ 초안을 저장했습니다.");
        response.put("faq", toRow(item, isEn));
        return response;
    }

    private boolean matchesKeyword(Map<String, String> row, String keyword) {
        if (keyword.isEmpty()) {
            return true;
        }
        return safe(row.get("id")).toLowerCase(Locale.ROOT).contains(keyword)
                || safe(row.get("question")).toLowerCase(Locale.ROOT).contains(keyword)
                || safe(row.get("answerScope")).toLowerCase(Locale.ROOT).contains(keyword)
                || safe(row.get("owner")).toLowerCase(Locale.ROOT).contains(keyword);
    }

    private Map<String, String> selectRow(List<Map<String, String>> filtered, List<Map<String, String>> catalog, String faqId) {
        if (!faqId.isEmpty()) {
            for (Map<String, String> row : filtered) {
                if (faqId.equals(safe(row.get("id")))) {
                    return row;
                }
            }
            for (Map<String, String> row : catalog) {
                if (faqId.equals(safe(row.get("id")))) {
                    return row;
                }
            }
        }
        return filtered.isEmpty() ? (catalog.isEmpty() ? new LinkedHashMap<>() : catalog.get(0)) : filtered.get(0);
    }

    private List<Map<String, String>> baseCatalog(boolean isEn) {
        List<FaqItem> items = new ArrayList<>(faqStore.values());
        items.sort(Comparator.comparingInt((FaqItem item) -> item.displayOrder).thenComparing(item -> item.id));
        List<Map<String, String>> rows = new ArrayList<>();
        for (FaqItem item : items) {
            rows.add(toRow(item, isEn));
        }
        return rows;
    }

    private List<Map<String, String>> buildSummaryCards(List<Map<String, String>> catalog, int filteredCount, boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(summaryCard(isEn ? "Visible FAQ" : "조회 FAQ", String.valueOf(filteredCount), isEn ? "Rows matching the current filter." : "현재 조건에 맞는 FAQ 수입니다."));
        rows.add(summaryCard(isEn ? "Published" : "게시", String.valueOf(countByValue(catalog, "status", "PUBLISHED")), isEn ? "Currently exposed FAQ entries." : "현재 게시 상태인 FAQ입니다."));
        rows.add(summaryCard(isEn ? "Review" : "검토", String.valueOf(countByValue(catalog, "status", "REVIEW")), isEn ? "FAQ items waiting for review." : "운영 검토가 필요한 FAQ입니다."));
        rows.add(summaryCard(isEn ? "Public" : "공개", String.valueOf(countByValue(catalog, "exposure", "PUBLIC")), isEn ? "Entries visible to portal users." : "포털 사용자에게 노출되는 FAQ입니다."));
        return rows;
    }

    private List<Map<String, String>> buildGovernanceNotes(boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(noteRow(isEn ? "Review visibility before publishing." : "게시 전 노출 범위 확인", isEn ? "Confirm whether an answer belongs to public FAQ or operator-only guidance before publishing." : "답변이 공개 FAQ인지 운영자 전용 가이드인지 먼저 확정한 뒤 게시해야 합니다."));
        rows.add(noteRow(isEn ? "Keep question and answer scope aligned." : "질문과 답변 범위 정합성 유지", isEn ? "The answer-scope note should remain short and map directly to the operator workflow or user action." : "답변 범위 메모는 운영 절차나 사용자 행동과 직접 연결되도록 짧고 명확하게 유지합니다."));
        rows.add(noteRow(isEn ? "Do not reshuffle display order without context." : "정렬 순서는 맥락 없이 변경하지 않음", isEn ? "Display order affects quick-filter and help-link surfaces, so reorder only with a content review." : "정렬 순서는 빠른 필터와 도움말 링크 노출에 영향을 주므로 콘텐츠 검토와 함께 조정해야 합니다."));
        return rows;
    }

    private int countByValue(List<Map<String, String>> rows, String key, String expectedValue) {
        int count = 0;
        for (Map<String, String> row : rows) {
            if (expectedValue.equalsIgnoreCase(safe(row.get(key)))) {
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

    private Map<String, String> toRow(FaqItem item, boolean isEn) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("id", item.id);
        row.put("category", item.category);
        row.put("categoryLabel", categoryLabel(item.category, isEn));
        row.put("question", isEn ? item.questionEn : item.questionKo);
        row.put("answerScope", isEn ? item.answerScopeEn : item.answerScopeKo);
        row.put("exposure", item.exposure);
        row.put("exposureLabel", exposureLabel(item.exposure, isEn));
        row.put("status", item.status);
        row.put("statusLabel", statusLabel(item.status, isEn));
        row.put("displayOrder", String.valueOf(item.displayOrder));
        row.put("owner", isEn ? item.ownerEn : item.ownerKo);
        row.put("lastChangedAt", item.lastChangedAt);
        row.put("lastChangedBy", item.lastChangedBy);
        return row;
    }

    private String categoryLabel(String category, boolean isEn) {
        if ("ACCOUNT".equalsIgnoreCase(category)) {
            return isEn ? "Account" : "계정";
        }
        if ("APPLICATION".equalsIgnoreCase(category)) {
            return isEn ? "Application" : "가입/신청";
        }
        if ("DATA".equalsIgnoreCase(category)) {
            return isEn ? "Data" : "데이터";
        }
        return isEn ? "Policy" : "정책";
    }

    private String exposureLabel(String exposure, boolean isEn) {
        return "PUBLIC".equalsIgnoreCase(exposure) ? (isEn ? "Public" : "공개") : (isEn ? "Private" : "비공개");
    }

    private String statusLabel(String status, boolean isEn) {
        if ("PUBLISHED".equalsIgnoreCase(status)) {
            return isEn ? "Published" : "게시";
        }
        if ("REVIEW".equalsIgnoreCase(status)) {
            return isEn ? "Review" : "검토";
        }
        return isEn ? "Draft" : "초안";
    }

    private Map<String, String> noteRow(String title, String body) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("title", title);
        row.put("body", body);
        return row;
    }

    private void seed(FaqItem item) {
        faqStore.put(item.id, item);
    }

    private FaqItem resolveFaq(String faqId) {
        if (faqId != null && faqStore.containsKey(faqId)) {
            return faqStore.get(faqId);
        }
        return faqStore.values().stream()
                .sorted(Comparator.comparingInt((FaqItem item) -> item.displayOrder).thenComparing(item -> item.id))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("No FAQ seed data available."));
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private static final class FaqItem {
        private final String id;
        private String category;
        private String questionKo;
        private String questionEn;
        private String answerScopeKo;
        private String answerScopeEn;
        private String exposure;
        private String status;
        private int displayOrder;
        private final String ownerKo;
        private final String ownerEn;
        private String lastChangedAt;
        private String lastChangedBy;

        private FaqItem(String id, String category, String questionKo, String questionEn, String answerScopeKo, String answerScopeEn, String exposure, String status, int displayOrder, String ownerKo, String ownerEn, String lastChangedAt, String lastChangedBy) {
            this.id = id;
            this.category = category;
            this.questionKo = questionKo;
            this.questionEn = questionEn;
            this.answerScopeKo = answerScopeKo;
            this.answerScopeEn = answerScopeEn;
            this.exposure = exposure;
            this.status = status;
            this.displayOrder = displayOrder;
            this.ownerKo = ownerKo;
            this.ownerEn = ownerEn;
            this.lastChangedAt = lastChangedAt;
            this.lastChangedBy = lastChangedBy;
        }
    }
}
