package egovframework.com.feature.admin.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.feature.admin.dto.request.AdminQnaCategorySaveRequestDTO;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class AdminQnaCategoryService {

    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final ObjectMapper objectMapper;
    private final Path registryPath = Paths.get("data", "admin", "qna-category", "categories.json");

    public AdminQnaCategoryService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public Map<String, Object> buildPagePayload(String searchKeyword, String useAt, String channel, String categoryId, boolean isEn) {
        String keyword = safe(searchKeyword).toLowerCase(Locale.ROOT);
        String normalizedUseAt = safe(useAt).toUpperCase(Locale.ROOT);
        String normalizedChannel = safe(channel).toUpperCase(Locale.ROOT);
        String normalizedCategoryId = safe(categoryId);

        List<Map<String, String>> catalog = localizedCatalog(mergeCatalog(loadAll()), isEn);
        List<Map<String, String>> filtered = new ArrayList<>();
        for (Map<String, String> row : catalog) {
            if (!matchesKeyword(row, keyword)) {
                continue;
            }
            if (!normalizedUseAt.isEmpty() && !"ALL".equals(normalizedUseAt)
                    && !normalizedUseAt.equalsIgnoreCase(safe(row.get("useAt")))) {
                continue;
            }
            if (!normalizedChannel.isEmpty() && !"ALL".equals(normalizedChannel)
                    && !normalizedChannel.equalsIgnoreCase(safe(row.get("channel")))) {
                continue;
            }
            filtered.add(row);
        }

        Map<String, String> selected = selectRow(filtered, catalog, normalizedCategoryId);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("isEn", isEn);
        payload.put("menuCode", "A0040302");
        payload.put("searchKeyword", safe(searchKeyword));
        payload.put("useAt", safe(useAt));
        payload.put("channel", safe(channel));
        payload.put("selectedCategoryId", safe(selected.get("id")));
        payload.put("summaryCards", buildSummaryCards(catalog, isEn));
        payload.put("categoryRows", filtered);
        payload.put("selectedCategory", selected);
        payload.put("governanceNotes", buildGovernanceNotes(isEn));
        payload.put("integrationNotes", buildIntegrationNotes(catalog, isEn));
        return payload;
    }

    public synchronized Map<String, Object> saveCategory(AdminQnaCategorySaveRequestDTO request, String actorId, boolean isEn) {
        String categoryId = safe(request == null ? null : request.getCategoryId());
        String code = safe(request == null ? null : request.getCode()).toUpperCase(Locale.ROOT);
        String nameKo = safe(request == null ? null : request.getNameKo());
        String nameEn = safe(request == null ? null : request.getNameEn());
        String descriptionKo = safe(request == null ? null : request.getDescriptionKo());
        String descriptionEn = safe(request == null ? null : request.getDescriptionEn());
        String channel = normalizeChannel(request == null ? null : request.getChannel());
        String useAt = normalizeUseAt(request == null ? null : request.getUseAt());
        int sortOrder = request != null && request.getSortOrder() != null ? request.getSortOrder() : 0;
        String ownerKo = safe(request == null ? null : request.getOwnerKo());
        String ownerEn = safe(request == null ? null : request.getOwnerEn());

        if (code.isEmpty()) {
            throw new IllegalArgumentException("category code is required.");
        }
        if (nameKo.isEmpty() || nameEn.isEmpty()) {
            throw new IllegalArgumentException("both Korean and English names are required.");
        }
        if (descriptionKo.isEmpty() || descriptionEn.isEmpty()) {
            throw new IllegalArgumentException("both Korean and English descriptions are required.");
        }
        if (ownerKo.isEmpty() || ownerEn.isEmpty()) {
            throw new IllegalArgumentException("both Korean and English owners are required.");
        }
        if (sortOrder < 0) {
            throw new IllegalArgumentException("sortOrder must be zero or greater.");
        }

        Map<String, Map<String, String>> entries = loadAll();
        String resolvedCategoryId = categoryId.isEmpty() ? nextCategoryId(entries) : categoryId;
        ensureUniqueCode(entries, resolvedCategoryId, code);

        Map<String, String> existing = mergeCatalog(entries).getOrDefault(resolvedCategoryId, new LinkedHashMap<>());
        Map<String, String> row = new LinkedHashMap<>(existing);
        row.put("id", resolvedCategoryId);
        row.put("code", code);
        row.put("nameKo", nameKo);
        row.put("nameEn", nameEn);
        row.put("descriptionKo", descriptionKo);
        row.put("descriptionEn", descriptionEn);
        row.put("channel", channel);
        row.put("useAt", useAt);
        row.put("sortOrder", String.valueOf(sortOrder));
        row.put("ownerKo", ownerKo);
        row.put("ownerEn", ownerEn);
        row.put("qnaCount", firstNonBlank(row.get("qnaCount"), "0"));
        row.put("pendingCount", firstNonBlank(row.get("pendingCount"), "0"));
        row.put("lastChangedAt", LocalDateTime.now().format(DATE_TIME_FORMATTER));
        row.put("lastChangedBy", firstNonBlank(actorId, "system"));

        entries.put(resolvedCategoryId, row);
        saveAll(entries);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("categoryId", resolvedCategoryId);
        response.put("message", isEn ? "Q&A category saved." : "Q&A 분류를 저장했습니다.");
        response.put("category", localizeRow(row, isEn));
        return response;
    }

    public synchronized Map<String, Object> deleteCategory(String categoryId, boolean isEn) {
        String normalizedCategoryId = safe(categoryId);
        if (normalizedCategoryId.isEmpty()) {
            throw new IllegalArgumentException("categoryId is required.");
        }

        Map<String, Map<String, String>> entries = loadAll();
        Map<String, Map<String, String>> merged = mergeCatalog(entries);
        Map<String, String> existing = merged.get(normalizedCategoryId);
        if (existing == null) {
            throw new IllegalArgumentException("category not found.");
        }
        if (baseCatalog().containsKey(normalizedCategoryId)) {
            throw new IllegalArgumentException(isEn
                    ? "Seed categories cannot be hard-deleted. Use hide instead."
                    : "기본 분류는 하드 삭제할 수 없습니다. 숨김 처리를 사용하세요.");
        }
        if (safeInt(existing.get("qnaCount")) > 0 || safeInt(existing.get("pendingCount")) > 0) {
            throw new IllegalArgumentException(isEn
                    ? "Categories with historical or pending questions cannot be deleted."
                    : "기존 문의 이력이나 미처리 건수가 있는 분류는 삭제할 수 없습니다.");
        }

        entries.remove(normalizedCategoryId);
        saveAll(entries);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("categoryId", normalizedCategoryId);
        response.put("message", isEn ? "Q&A category deleted." : "Q&A 분류를 삭제했습니다.");
        return response;
    }

    private boolean matchesKeyword(Map<String, String> row, String keyword) {
        if (keyword.isEmpty()) {
            return true;
        }
        return safe(row.get("code")).toLowerCase(Locale.ROOT).contains(keyword)
                || safe(row.get("name")).toLowerCase(Locale.ROOT).contains(keyword)
                || safe(row.get("description")).toLowerCase(Locale.ROOT).contains(keyword)
                || safe(row.get("owner")).toLowerCase(Locale.ROOT).contains(keyword);
    }

    private Map<String, String> selectRow(List<Map<String, String>> filtered, List<Map<String, String>> catalog, String categoryId) {
        if (!categoryId.isEmpty()) {
            for (Map<String, String> row : filtered) {
                if (categoryId.equals(safe(row.get("id")))) {
                    return row;
                }
            }
            for (Map<String, String> row : catalog) {
                if (categoryId.equals(safe(row.get("id")))) {
                    return row;
                }
            }
        }
        return filtered.isEmpty() ? (catalog.isEmpty() ? new LinkedHashMap<>() : catalog.get(0)) : filtered.get(0);
    }

    private List<Map<String, String>> localizedCatalog(Map<String, Map<String, String>> mergedCatalog, boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        for (Map<String, String> row : mergedCatalog.values()) {
            rows.add(localizeRow(row, isEn));
        }
        rows.sort(Comparator
                .comparingInt((Map<String, String> row) -> safeInt(row.get("sortOrder")))
                .thenComparing(row -> safe(row.get("code"))));
        return rows;
    }

    private Map<String, Map<String, String>> mergeCatalog(Map<String, Map<String, String>> overrides) {
        Map<String, Map<String, String>> rows = baseCatalog();
        for (Map.Entry<String, Map<String, String>> entry : overrides.entrySet()) {
            Map<String, String> merged = new LinkedHashMap<>(rows.getOrDefault(entry.getKey(), new LinkedHashMap<>()));
            merged.putAll(entry.getValue());
            merged.put("id", entry.getKey());
            rows.put(entry.getKey(), merged);
        }
        return rows;
    }

    private Map<String, String> localizeRow(Map<String, String> source, boolean isEn) {
        Map<String, String> row = new LinkedHashMap<>(source);
        row.put("name", isEn ? safe(source.get("nameEn")) : safe(source.get("nameKo")));
        row.put("description", isEn ? safe(source.get("descriptionEn")) : safe(source.get("descriptionKo")));
        row.put("owner", isEn ? safe(source.get("ownerEn")) : safe(source.get("ownerKo")));
        row.put("channelLabel", resolveChannelLabel(safe(source.get("channel")), isEn));
        row.put("useAtLabel", "Y".equalsIgnoreCase(safe(source.get("useAt")))
                ? (isEn ? "Active" : "운영중")
                : (isEn ? "Hidden" : "숨김"));
        return row;
    }

    private Map<String, Map<String, String>> baseCatalog() {
        Map<String, Map<String, String>> rows = new LinkedHashMap<>();
        rows.put("QNA_CAT_001", categoryRow("QNA_CAT_001", "GEN",
                "일반 문의", "General Inquiry",
                "회원가입, 계정, 기본 이용 절차 문의를 처리하는 기본 분류입니다.",
                "Default category for account, onboarding, and general service questions.",
                "BOTH", "Y", "1", "182", "7",
                "고객지원 운영", "Support Operations",
                "2026-03-28 14:20", "ops_admin"));
        rows.put("QNA_CAT_002", categoryRow("QNA_CAT_002", "PAY",
                "결제 및 환불", "Payments & Refunds",
                "결제 오류, 환불 상태, 정산 일정 문의를 분리합니다.",
                "Tracks payment failures, refund progress, and settlement questions.",
                "PORTAL", "Y", "2", "94", "4",
                "정산 운영", "Settlement Operations",
                "2026-03-24 09:10", "settlement_mgr"));
        rows.put("QNA_CAT_003", categoryRow("QNA_CAT_003", "CERT",
                "인증 및 배출", "Certification & Emissions",
                "인증서 발급, 배출량 검증, 이의신청 연계 문의를 관리합니다.",
                "Handles certificate issuance, emission validation, and objection-related questions.",
                "BOTH", "Y", "3", "126", "11",
                "인증 심사팀", "Certification Review Team",
                "2026-03-29 17:45", "cert_lead"));
        rows.put("QNA_CAT_004", categoryRow("QNA_CAT_004", "API",
                "외부연계 문의", "External Integration",
                "API 키, 스키마, 웹훅, 연계 장애 대응 문의 전용 분류입니다.",
                "Used for API keys, schema mapping, webhooks, and integration incidents.",
                "PARTNER", "Y", "4", "41", "6",
                "플랫폼 연계팀", "Platform Integration Team",
                "2026-03-27 11:05", "integration_ops"));
        rows.put("QNA_CAT_005", categoryRow("QNA_CAT_005", "LEGACY",
                "레거시 이전 문의", "Legacy Migration",
                "이전 운영 시기 문의 분류로 현재는 숨김 상태입니다.",
                "Legacy support category kept hidden after migration cutover.",
                "PORTAL", "N", "99", "8", "0",
                "서비스 기획", "Service Planning",
                "2026-03-18 08:30", "planner01"));
        return rows;
    }

    private List<Map<String, String>> buildSummaryCards(List<Map<String, String>> catalog, boolean isEn) {
        int activeCount = countByValue(catalog, "useAt", "Y");
        int hiddenCount = countByValue(catalog, "useAt", "N");
        int pendingCount = sumByKey(catalog, "pendingCount");
        int totalQuestions = sumByKey(catalog, "qnaCount");

        List<Map<String, String>> cards = new ArrayList<>();
        cards.add(summaryCard(isEn ? "Categories" : "분류 수", String.valueOf(catalog.size()),
                isEn ? "Configured category buckets." : "현재 등록된 전체 분류 수"));
        cards.add(summaryCard(isEn ? "Active" : "운영중", String.valueOf(activeCount),
                isEn ? "Currently exposed categories." : "현재 노출 중인 분류"));
        cards.add(summaryCard(isEn ? "Pending" : "미처리 문의", String.valueOf(pendingCount),
                isEn ? "Questions awaiting assignment." : "담당 배정 또는 답변 대기 건수"));
        cards.add(summaryCard(isEn ? "Questions" : "누적 문의", String.valueOf(totalQuestions),
                isEn ? "Historical volume mapped into categories." : "현재 분류 체계에 매핑된 누적 문의"));
        cards.add(summaryCard(isEn ? "Hidden" : "숨김", String.valueOf(hiddenCount),
                isEn ? "Categories retained but not exposed." : "보존 중이지만 노출하지 않는 분류"));
        return cards;
    }

    private List<Map<String, String>> buildGovernanceNotes(boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(noteRow(
                isEn ? "Keep bilingual labels aligned." : "국문/영문 분류명을 함께 유지",
                isEn ? "When a category is exposed to both locales, keep the name and description aligned in Korean and English."
                        : "양국어 노출 메뉴이므로 분류명과 설명은 국문/영문을 함께 유지합니다."));
        rows.add(noteRow(
                isEn ? "Hide before delete." : "삭제 대신 숨김 우선",
                isEn ? "If historical questions remain mapped to the category, hide it first instead of deleting the definition."
                        : "기존 문의가 남아 있으면 삭제 대신 숨김 처리로 이력을 보존합니다."));
        rows.add(noteRow(
                isEn ? "Check pending volume before re-routing." : "라우팅 변경 전 미처리 건수 확인",
                isEn ? "Review pending volume before changing SLA routing or answer ownership."
                        : "SLA 라우팅 또는 담당 조직 변경 전에는 미처리 건수를 함께 검토합니다."));
        return rows;
    }

    private List<Map<String, String>> buildIntegrationNotes(List<Map<String, String>> catalog, boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(noteRow(
                isEn ? "Save API contract" : "저장 API 계약",
                isEn ? "Persist code, bilingual labels, exposure channel, sort order, and owner metadata together."
                        : "코드, 국영문 분류명, 노출 채널, 정렬 순서, 운영 담당 메타데이터를 함께 저장해야 합니다."));
        rows.add(noteRow(
                isEn ? "Delete blocking rule" : "삭제 차단 규칙",
                isEn ? "Keep delete blocked while hidden categories still carry historical question counts."
                        : "숨김 분류라도 기존 문의 이력이 남아 있으면 삭제 차단 규칙을 유지해야 합니다."));
        rows.add(noteRow(
                isEn ? "Current hidden categories" : "현재 숨김 분류 수",
                String.valueOf(countByValue(catalog, "useAt", "N"))));
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

    private int sumByKey(List<Map<String, String>> rows, String key) {
        int sum = 0;
        for (Map<String, String> row : rows) {
            sum += safeInt(row.get(key));
        }
        return sum;
    }

    private Map<String, String> summaryCard(String title, String value, String description) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("title", title);
        row.put("value", value);
        row.put("description", description);
        return row;
    }

    private Map<String, String> categoryRow(
            String id,
            String code,
            String nameKo,
            String nameEn,
            String descriptionKo,
            String descriptionEn,
            String channel,
            String useAt,
            String sortOrder,
            String qnaCount,
            String pendingCount,
            String ownerKo,
            String ownerEn,
            String lastChangedAt,
            String lastChangedBy) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("id", id);
        row.put("code", code);
        row.put("nameKo", nameKo);
        row.put("nameEn", nameEn);
        row.put("descriptionKo", descriptionKo);
        row.put("descriptionEn", descriptionEn);
        row.put("channel", channel);
        row.put("useAt", useAt);
        row.put("sortOrder", sortOrder);
        row.put("qnaCount", qnaCount);
        row.put("pendingCount", pendingCount);
        row.put("ownerKo", ownerKo);
        row.put("ownerEn", ownerEn);
        row.put("lastChangedAt", lastChangedAt);
        row.put("lastChangedBy", lastChangedBy);
        return row;
    }

    private Map<String, String> noteRow(String title, String body) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("title", title);
        row.put("body", body);
        return row;
    }

    private void ensureUniqueCode(Map<String, Map<String, String>> entries, String categoryId, String code) {
        Map<String, Map<String, String>> merged = mergeCatalog(entries);
        for (Map<String, String> row : merged.values()) {
            if (categoryId.equals(safe(row.get("id")))) {
                continue;
            }
            if (code.equalsIgnoreCase(safe(row.get("code")))) {
                throw new IllegalArgumentException("category code already exists.");
            }
        }
    }

    private String nextCategoryId(Map<String, Map<String, String>> entries) {
        int max = 0;
        Map<String, Map<String, String>> merged = mergeCatalog(entries);
        for (String key : merged.keySet()) {
            if (key.startsWith("QNA_CAT_")) {
                try {
                    max = Math.max(max, Integer.parseInt(key.substring("QNA_CAT_".length())));
                } catch (NumberFormatException ignored) {
                    // ignore malformed ids
                }
            }
        }
        return String.format(Locale.ROOT, "QNA_CAT_%03d", max + 1);
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
            return new LinkedHashMap<>();
        }
    }

    private void saveAll(Map<String, Map<String, String>> entries) {
        try {
            Files.createDirectories(registryPath.getParent());
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(registryPath.toFile(), entries);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to save Q&A categories.", e);
        }
    }

    private String normalizeChannel(String value) {
        String normalized = safe(value).toUpperCase(Locale.ROOT);
        if ("PORTAL".equals(normalized) || "PARTNER".equals(normalized) || "BOTH".equals(normalized)) {
            return normalized;
        }
        return "BOTH";
    }

    private String normalizeUseAt(String value) {
        return "N".equalsIgnoreCase(safe(value)) ? "N" : "Y";
    }

    private String resolveChannelLabel(String channel, boolean isEn) {
        if ("PARTNER".equalsIgnoreCase(channel)) {
            return isEn ? "Partner Center" : "파트너 센터";
        }
        if ("PORTAL".equalsIgnoreCase(channel)) {
            return isEn ? "Public Portal" : "공개 포털";
        }
        return isEn ? "Portal + Partner" : "포털 + 파트너";
    }

    private int safeInt(String value) {
        try {
            return Integer.parseInt(safe(value));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private String firstNonBlank(String first, String second) {
        return safe(first).isEmpty() ? safe(second) : safe(first);
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
