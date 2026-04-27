package egovframework.com.feature.admin.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class AdminPostManagementService {

    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final ObjectMapper objectMapper;
    private final Path registryPath = Paths.get("data", "admin", "post-list", "posts.json");
    private final AdminPagePayloadFactory adminPagePayloadFactory;

    public AdminPostManagementService(ObjectMapper objectMapper, AdminPagePayloadFactory adminPagePayloadFactory) {
        this.objectMapper = objectMapper;
        this.adminPagePayloadFactory = adminPagePayloadFactory;
    }

    public Map<String, Object> buildPagePayload(String searchKeyword,
                                                String status,
                                                String category,
                                                String selectedPostId,
                                                boolean isEn) {
        String keyword = safe(searchKeyword).toLowerCase(Locale.ROOT);
        String normalizedStatus = safe(status).toUpperCase(Locale.ROOT);
        String normalizedCategory = safe(category).toUpperCase(Locale.ROOT);

        List<Map<String, String>> catalog = baseCatalog(isEn);
        catalog.addAll(loadManagedCatalog(isEn));
        List<Map<String, String>> filtered = new ArrayList<>();
        for (Map<String, String> row : catalog) {
            if (!matchesKeyword(row, keyword)) {
                continue;
            }
            if (!normalizedStatus.isEmpty() && !normalizedStatus.equalsIgnoreCase(safe(row.get("status")))) {
                continue;
            }
            if (!normalizedCategory.isEmpty() && !normalizedCategory.equalsIgnoreCase(safe(row.get("category")))) {
                continue;
            }
            filtered.add(row);
        }

        Map<String, String> selectedPost = selectPost(filtered, catalog, safe(selectedPostId));

        Map<String, Object> payload = adminPagePayloadFactory.create(isEn, "A0040102");
        payload.put("searchKeyword", safe(searchKeyword));
        payload.put("status", safe(status));
        payload.put("category", safe(category));
        payload.put("summaryCards", buildSummaryCards(catalog, filtered, isEn));
        payload.put("categoryOptions", categoryOptions(isEn));
        payload.put("postRows", filtered);
        payload.put("selectedPost", selectedPost);
        payload.put("governanceNotes", buildGovernanceNotes(isEn));
        return payload;
    }

    public synchronized void upsertManagedNoticeFromBoardDraft(Map<String, Object> draft, String actorId) {
        Map<String, Map<String, String>> entries = loadAll();
        String postId = firstNonBlank(safe(draft.get("linkedPostId")), "POST_BOARD_ADD_001");
        Map<String, String> row = new LinkedHashMap<>(entries.getOrDefault(postId, new LinkedHashMap<String, String>()));
        row.put("id", postId);
        row.put("category", normalizeCategory(safe(draft.get("boardType"))));
        row.put("status", "REVIEW");
        row.put("pinned", parseBoolean(draft.get("pinned")) ? "Y" : "N");
        row.put("viewCount", firstNonBlank(safe(row.get("viewCount")), "0"));
        row.put("updatedAt", LocalDateTime.now().format(DATE_TIME_FORMATTER));
        row.put("authorKo", "공지 배포");
        row.put("authorEn", "Notice Distribution");
        row.put("titleKo", safe(draft.get("titleKo")));
        row.put("titleEn", firstNonBlank(safe(draft.get("titleEn")), safe(draft.get("titleKo"))));
        row.put("summaryKo", safe(draft.get("summaryKo")));
        row.put("summaryEn", firstNonBlank(safe(draft.get("summaryEn")), safe(draft.get("summaryKo"))));
        row.put("lastChangedBy", firstNonBlank(actorId, "system"));
        entries.put(postId, row);
        saveAll(entries);
    }

    private boolean matchesKeyword(Map<String, String> row, String keyword) {
        if (keyword.isEmpty()) {
            return true;
        }
        return safe(row.get("id")).toLowerCase(Locale.ROOT).contains(keyword)
                || safe(row.get("title")).toLowerCase(Locale.ROOT).contains(keyword)
                || safe(row.get("author")).toLowerCase(Locale.ROOT).contains(keyword)
                || safe(row.get("categoryLabel")).toLowerCase(Locale.ROOT).contains(keyword);
    }

    private Map<String, String> selectPost(List<Map<String, String>> filtered,
                                           List<Map<String, String>> catalog,
                                           String selectedPostId) {
        if (!selectedPostId.isEmpty()) {
            for (Map<String, String> row : filtered) {
                if (selectedPostId.equals(safe(row.get("id")))) {
                    return row;
                }
            }
            for (Map<String, String> row : catalog) {
                if (selectedPostId.equals(safe(row.get("id")))) {
                    return row;
                }
            }
        }
        return filtered.isEmpty() ? (catalog.isEmpty() ? new LinkedHashMap<>() : catalog.get(0)) : filtered.get(0);
    }

    private List<Map<String, String>> baseCatalog(boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(postRow("POST_001", "NOTICE", isEn ? "System maintenance notice for April" : "4월 시스템 점검 공지",
                "PUBLISHED", isEn ? "Published" : "게시", "Y", isEn ? "Pinned" : "고정", "1824", "2026-03-31 09:10",
                isEn ? "Platform Operations" : "플랫폼운영팀",
                isEn ? "Main page and admin login notice banner are linked to this post." : "메인 페이지와 관리자 로그인 공지 영역에 연결된 게시글입니다.", isEn));
        rows.add(postRow("POST_002", "GUIDE", isEn ? "Emission data upload guide revision" : "배출량 업로드 가이드 개정",
                "REVIEW", isEn ? "Review" : "검토", "N", isEn ? "Normal" : "일반", "943", "2026-03-30 14:25",
                isEn ? "Emission Operations" : "배출량운영팀",
                isEn ? "Draft awaiting review before exposing the updated upload format guide." : "업로드 양식 개정 안내를 노출하기 전 검토 중인 초안입니다.", isEn));
        rows.add(postRow("POST_003", "POLICY", isEn ? "Operator policy FAQ transition schedule" : "운영정책 FAQ 전환 일정",
                "SCHEDULED", isEn ? "Scheduled" : "예약", "N", isEn ? "Normal" : "일반", "511", "2026-03-29 17:40",
                isEn ? "Policy Support" : "정책지원팀",
                isEn ? "Scheduled post aligned with FAQ and help-content migration timing." : "FAQ 및 도움말 이관 일정과 함께 게시될 예정인 예약 글입니다.", isEn));
        rows.add(postRow("POST_004", "NOTICE", isEn ? "Partner API outage notice archive" : "외부연계 장애 공지 보관본",
                "ARCHIVED", isEn ? "Archived" : "보관", "N", isEn ? "Normal" : "일반", "227", "2026-03-25 08:55",
                isEn ? "Integration Operations" : "연계운영팀",
                isEn ? "Historical notice retained for audit and incident review." : "감사 및 장애 회고용으로 보관 중인 이력 게시글입니다.", isEn));
        rows.add(postRow("POST_005", "GUIDE", isEn ? "Admin account approval flow guide" : "관리자 계정 승인 절차 안내",
                "PUBLISHED", isEn ? "Published" : "게시", "Y", isEn ? "Pinned" : "고정", "1307", "2026-03-28 11:05",
                isEn ? "Admin Governance" : "관리자거버넌스팀",
                isEn ? "Pinned guide referenced from admin-account and authority onboarding flows." : "관리자 등록 및 권한 온보딩 화면에서 참조하는 고정 안내 글입니다.", isEn));
        rows.add(postRow("POST_006", "EVENT", isEn ? "Quarterly carbon campaign announcement" : "분기 탄소절감 캠페인 안내",
                "DRAFT", isEn ? "Draft" : "초안", "N", isEn ? "Normal" : "일반", "118", "2026-03-27 16:32",
                isEn ? "Content Planning" : "콘텐츠기획팀",
                isEn ? "Content draft prepared before banner and popup assets are finalized." : "배너와 팝업 확정 전에 먼저 작성한 콘텐츠 초안입니다.", isEn));
        return rows;
    }

    private List<Map<String, String>> buildSummaryCards(List<Map<String, String>> catalog,
                                                        List<Map<String, String>> filtered,
                                                        boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(summaryCard(isEn ? "Visible posts" : "조회 게시글", String.valueOf(filtered.size()),
                isEn ? "Rows matching the current filters." : "현재 조건에 맞는 게시글 수입니다."));
        rows.add(summaryCard(isEn ? "Published" : "게시", String.valueOf(countByValue(catalog, "status", "PUBLISHED")),
                isEn ? "Posts already exposed to operators or portal users." : "운영자 또는 사용자에게 이미 노출 중인 게시글입니다."));
        rows.add(summaryCard(isEn ? "Pinned" : "고정", String.valueOf(countByValue(catalog, "pinned", "Y")),
                isEn ? "Posts pinned to top surfaces or notice slots." : "상단 고정 또는 공지 슬롯에 연결된 게시글입니다."));
        rows.add(summaryCard(isEn ? "Review queue" : "검토 대기", String.valueOf(countReviewQueue(catalog)),
                isEn ? "Draft and review-stage posts awaiting publication." : "게시 전 검토가 필요한 초안/검토 상태 게시글입니다."));
        return rows;
    }

    private List<Map<String, String>> categoryOptions(boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(option("", isEn ? "All" : "전체"));
        rows.add(option("NOTICE", isEn ? "Notice" : "공지"));
        rows.add(option("GUIDE", isEn ? "Guide" : "가이드"));
        rows.add(option("POLICY", isEn ? "Policy" : "정책"));
        rows.add(option("EVENT", isEn ? "Event" : "이벤트"));
        return rows;
    }

    private List<Map<String, String>> buildGovernanceNotes(boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(noteRow(
                isEn ? "Pin only posts tied to a real surface." : "실제 노출면과 연결된 글만 고정",
                isEn ? "Pinned posts should point to a current banner, popup, or notice surface so the top slot remains meaningful."
                        : "고정 글은 실제 배너, 팝업, 공지 영역과 연결된 경우에만 사용해 상단 슬롯 의미를 유지해야 합니다."));
        rows.add(noteRow(
                isEn ? "Keep publication and archive history explicit." : "게시/보관 이력은 명시적으로 관리",
                isEn ? "Do not overwrite archived notices when publishing a new one. Keep a traceable timeline for audit and operator review."
                        : "새 공지를 올릴 때 이전 보관 글을 덮어쓰지 말고, 감사와 운영 검토가 가능하도록 이력을 남겨야 합니다."));
        rows.add(noteRow(
                isEn ? "Align category with downstream surfaces." : "하위 노출면과 분류를 맞춤",
                isEn ? "Category drives linkage with FAQ, help, banner, and popup flows, so use a stable operating label."
                        : "분류는 FAQ, 도움말, 배너, 팝업 연계에 영향을 주므로 운영 기준에 맞는 안정된 라벨을 사용해야 합니다."));
        return rows;
    }

    private List<Map<String, String>> loadManagedCatalog(boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        for (Map<String, String> source : loadAll().values()) {
            rows.add(localizeManagedRow(source, isEn));
        }
        return rows;
    }

    private Map<String, String> localizeManagedRow(Map<String, String> source, boolean isEn) {
        Map<String, String> row = new LinkedHashMap<>();
        String category = normalizeCategory(safe(source.get("category")));
        String status = safe(source.get("status")).toUpperCase(Locale.ROOT);
        String pinned = "Y".equalsIgnoreCase(safe(source.get("pinned"))) ? "Y" : "N";
        row.put("id", safe(source.get("id")));
        row.put("category", category);
        row.put("categoryLabel", categoryLabel(category, isEn));
        row.put("title", isEn ? firstNonBlank(safe(source.get("titleEn")), safe(source.get("titleKo"))) : firstNonBlank(safe(source.get("titleKo")), safe(source.get("titleEn"))));
        row.put("status", status);
        row.put("statusLabel", statusLabel(status, isEn));
        row.put("pinned", pinned);
        row.put("pinnedLabel", "Y".equalsIgnoreCase(pinned) ? (isEn ? "Pinned" : "고정") : (isEn ? "Normal" : "일반"));
        row.put("viewCount", firstNonBlank(safe(source.get("viewCount")), "0"));
        row.put("updatedAt", safe(source.get("updatedAt")));
        row.put("author", isEn ? firstNonBlank(safe(source.get("authorEn")), safe(source.get("authorKo"))) : firstNonBlank(safe(source.get("authorKo")), safe(source.get("authorEn"))));
        row.put("summary", isEn ? firstNonBlank(safe(source.get("summaryEn")), safe(source.get("summaryKo"))) : firstNonBlank(safe(source.get("summaryKo")), safe(source.get("summaryEn"))));
        return row;
    }

    private String statusLabel(String status, boolean isEn) {
        if ("PUBLISHED".equalsIgnoreCase(status)) {
            return isEn ? "Published" : "게시";
        }
        if ("SCHEDULED".equalsIgnoreCase(status)) {
            return isEn ? "Scheduled" : "예약";
        }
        if ("REVIEW".equalsIgnoreCase(status)) {
            return isEn ? "Review" : "검토";
        }
        if ("ARCHIVED".equalsIgnoreCase(status)) {
            return isEn ? "Archived" : "보관";
        }
        return isEn ? "Draft" : "초안";
    }

    private String normalizeCategory(String category) {
        String normalized = safe(category).toUpperCase(Locale.ROOT);
        if ("POLICY".equals(normalized) || "EVENT".equals(normalized) || "GUIDE".equals(normalized)) {
            return normalized;
        }
        if ("MAINTENANCE".equals(normalized)) {
            return "NOTICE";
        }
        return "NOTICE";
    }

    private Map<String, Map<String, String>> loadAll() {
        if (!Files.exists(registryPath)) {
            return new LinkedHashMap<>();
        }
        try (InputStream inputStream = Files.newInputStream(registryPath)) {
            Map<String, Map<String, String>> data = objectMapper.readValue(inputStream, new TypeReference<Map<String, Map<String, String>>>() {
            });
            return data == null ? new LinkedHashMap<>() : new LinkedHashMap<>(data);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read post registry", e);
        }
    }

    private void saveAll(Map<String, Map<String, String>> entries) {
        try {
            Files.createDirectories(registryPath.getParent());
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(registryPath.toFile(), entries);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to write post registry", e);
        }
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

    private int countReviewQueue(List<Map<String, String>> rows) {
        int count = 0;
        for (Map<String, String> row : rows) {
            String status = safe(row.get("status"));
            if ("REVIEW".equalsIgnoreCase(status) || "DRAFT".equalsIgnoreCase(status) || "SCHEDULED".equalsIgnoreCase(status)) {
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

    private Map<String, String> option(String value, String label) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("value", value);
        row.put("label", label);
        return row;
    }

    private Map<String, String> postRow(String id,
                                        String category,
                                        String title,
                                        String status,
                                        String statusLabel,
                                        String pinned,
                                        String pinnedLabel,
                                        String viewCount,
                                        String updatedAt,
                                        String author,
                                        String summary,
                                        boolean isEn) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("id", id);
        row.put("category", category);
        row.put("categoryLabel", categoryLabel(category, isEn));
        row.put("title", title);
        row.put("status", status);
        row.put("statusLabel", statusLabel);
        row.put("pinned", pinned);
        row.put("pinnedLabel", pinnedLabel);
        row.put("viewCount", viewCount);
        row.put("updatedAt", updatedAt);
        row.put("author", author);
        row.put("summary", summary);
        return row;
    }

    private String categoryLabel(String category, boolean isEn) {
        String normalized = safe(category).toUpperCase(Locale.ROOT);
        if ("NOTICE".equals(normalized)) {
            return isEn ? "Notice" : "공지";
        }
        if ("GUIDE".equals(normalized)) {
            return isEn ? "Guide" : "가이드";
        }
        if ("POLICY".equals(normalized)) {
            return isEn ? "Policy" : "정책";
        }
        if ("EVENT".equals(normalized)) {
            return isEn ? "Event" : "이벤트";
        }
        return normalized;
    }

    private Map<String, String> noteRow(String title, String body) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("title", title);
        row.put("body", body);
        return row;
    }

    private boolean parseBoolean(Object value) {
        return "true".equalsIgnoreCase(String.valueOf(value));
    }

    private String firstNonBlank(String primary, String fallback) {
        return safe(primary).isEmpty() ? safe(fallback) : safe(primary);
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String safe(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}
