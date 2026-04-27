package egovframework.com.feature.admin.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.feature.admin.dto.request.AdminEmissionLciClassificationSaveRequestDTO;
import egovframework.com.platform.governance.model.vo.DetailCodeVO;
import egovframework.com.platform.governance.service.AdminCodeManageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminEmissionLciClassificationService {

    private static final String CODE_ID = "EMLCI";
    private static final String MENU_CODE = "A0020111";

    private final AdminCodeManageService adminCodeManageService;
    private final EmissionClassificationCatalogService emissionClassificationCatalogService;
    private final ObjectMapper objectMapper;

    public Map<String, Object> buildPagePayload(String searchKeyword, String level, String useAt, String selectedCode, boolean isEn) {
        Map<String, Object> catalogPayload = new LinkedHashMap<>(emissionClassificationCatalogService.buildPayload(isEn));
        List<Map<String, Object>> catalogRows = castRows(catalogPayload.get("rows"));
        List<Map<String, Object>> filteredRows = new ArrayList<>();
        String normalizedKeyword = safe(searchKeyword).toLowerCase(Locale.ROOT);
        String normalizedLevel = safe(level).toUpperCase(Locale.ROOT);
        String normalizedUseAt = normalizeUseAt(useAt);

        for (Map<String, Object> row : catalogRows) {
            if (!matchesLevel(row, normalizedLevel) || !matchesUseAt(row, normalizedUseAt) || !matchesKeyword(row, normalizedKeyword)) {
                continue;
            }
            filteredRows.add(new LinkedHashMap<>(row));
        }

        Map<String, Object> selectedRow = findSelectedRow(catalogRows, safe(selectedCode));
        if (selectedRow == null && !filteredRows.isEmpty()) {
            selectedRow = new LinkedHashMap<>(filteredRows.get(0));
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("isEn", isEn);
        payload.put("menuCode", MENU_CODE);
        payload.put("searchKeyword", safe(searchKeyword));
        payload.put("level", normalizedLevel);
        payload.put("useAt", normalizedUseAt);
        payload.put("selectedCode", selectedRow == null ? "" : safe(stringValue(selectedRow.get("code"))));
        payload.put("catalogSource", catalogPayload.get("catalogSource"));
        payload.put("catalogSourceLabel", catalogPayload.get("catalogSourceLabel"));
        payload.put("summaryCards", buildSummaryCards(catalogRows, isEn));
        payload.put("levelOptions", buildLevelOptions(isEn));
        payload.put("classificationRows", filteredRows);
        payload.put("selectedClassification", selectedRow);
        payload.put("tree", catalogPayload.get("tree"));
        payload.put("governanceNotes", buildGovernanceNotes(isEn));
        return payload;
    }

    @Transactional
    public Map<String, Object> save(AdminEmissionLciClassificationSaveRequestDTO request, String actorId, boolean isEn) throws Exception {
        String originalCode = safe(request == null ? null : request.getOriginalCode());
        String code = normalizeCode(request == null ? null : request.getCode());
        String label = safe(request == null ? null : request.getLabel());
        String tierLabel = safe(request == null ? null : request.getTierLabel());
        String aliasesRaw = safe(request == null ? null : request.getAliases());
        String useAt = normalizeStoredUseAt(request == null ? null : request.getUseAt());
        validateCode(code, isEn);
        if (label.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Enter the classification label." : "분류명을 입력하세요.");
        }

        Map<String, DetailCodeVO> detailCodeMap = loadDetailCodeMap();
        DetailCodeVO existing = originalCode.isEmpty() ? detailCodeMap.get(code) : detailCodeMap.get(originalCode);
        boolean createMode = originalCode.isEmpty();
        boolean rename = !createMode && !code.equals(originalCode);

        if (createMode && existing != null) {
            throw new IllegalArgumentException(isEn ? "The same classification code already exists." : "같은 분류 코드가 이미 존재합니다.");
        }
        if (!createMode && existing == null) {
            throw new IllegalArgumentException(isEn ? "The classification to update was not found." : "수정할 분류 코드를 찾을 수 없습니다.");
        }
        if (rename && detailCodeMap.containsKey(code)) {
            throw new IllegalArgumentException(isEn ? "The target classification code already exists." : "변경 대상 분류 코드가 이미 존재합니다.");
        }

        assertParentExists(code, detailCodeMap, isEn);
        if (rename && hasChildren(originalCode, detailCodeMap)) {
            throw new IllegalArgumentException(isEn
                    ? "Change the child classifications first before renaming this code."
                    : "하위 분류가 있어 코드 변경을 할 수 없습니다. 먼저 하위 분류를 정리하세요.");
        }

        String metadataJson = buildMetadataJson(code, label, tierLabel, aliasesRaw, detailCodeMap, isEn);
        String effectiveActorId = actorId == null || actorId.trim().isEmpty() ? "SYSTEM" : actorId.trim();
        if (createMode) {
            adminCodeManageService.insertDetailCode(CODE_ID, code, label, metadataJson, useAt, effectiveActorId);
        } else if (rename) {
            adminCodeManageService.deleteDetailCode(CODE_ID, originalCode);
            adminCodeManageService.insertDetailCode(CODE_ID, code, label, metadataJson, useAt, effectiveActorId);
        } else {
            adminCodeManageService.updateDetailCode(CODE_ID, code, label, metadataJson, useAt, effectiveActorId);
        }

        Map<String, DetailCodeVO> refreshedMap = loadDetailCodeMap();
        cascadeChildren(code, refreshedMap, effectiveActorId, isEn);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("message", isEn ? "LCI classification saved." : "LCI 분류를 저장했습니다.");
        response.put("code", code);
        response.put("row", findSelectedRow(castRows(emissionClassificationCatalogService.buildPayload(isEn).get("rows")), code));
        return response;
    }

    @Transactional
    public Map<String, Object> delete(String code, boolean isEn) throws Exception {
        String normalizedCode = normalizeCode(code);
        if (normalizedCode.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Select a classification to delete." : "삭제할 분류를 선택하세요.");
        }
        Map<String, DetailCodeVO> detailCodeMap = loadDetailCodeMap();
        if (!detailCodeMap.containsKey(normalizedCode)) {
            throw new IllegalArgumentException(isEn ? "The classification was not found." : "삭제할 분류를 찾을 수 없습니다.");
        }
        if (hasChildren(normalizedCode, detailCodeMap)) {
            throw new IllegalArgumentException(isEn
                    ? "Delete child classifications first."
                    : "하위 분류가 있어 삭제할 수 없습니다. 먼저 하위 분류를 삭제하세요.");
        }
        adminCodeManageService.deleteDetailCode(CODE_ID, normalizedCode);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("message", isEn ? "LCI classification deleted." : "LCI 분류를 삭제했습니다.");
        response.put("code", normalizedCode);
        return response;
    }

    private void cascadeChildren(String code, Map<String, DetailCodeVO> detailCodeMap, String actorId, boolean isEn) throws Exception {
        if (code.length() >= 6) {
            return;
        }
        for (DetailCodeVO detailCode : detailCodeMap.values()) {
            String childCode = safe(detailCode.getCode());
            if (childCode.equals(code) || !childCode.startsWith(code)) {
                continue;
            }
            Map<String, Object> metadata = parseMetadata(detailCode.getCodeDc());
            String tierLabel = safe(stringValue(metadata.get("tierLabel")));
            String aliases = String.join(", ", normalizeAliases(metadata.get("aliases")));
            String nextMetadata = buildMetadataJson(childCode, safe(detailCode.getCodeNm()), tierLabel, aliases, detailCodeMap, isEn);
            adminCodeManageService.updateDetailCode(CODE_ID, childCode, safe(detailCode.getCodeNm()), nextMetadata, normalizeStoredUseAt(detailCode.getUseAt()), actorId);
        }
    }

    private String buildMetadataJson(String code,
                                     String label,
                                     String tierLabel,
                                     String aliasesRaw,
                                     Map<String, DetailCodeVO> detailCodeMap,
                                     boolean isEn) {
        String normalizedCode = normalizeCode(code);
        String level = inferLevel(normalizedCode);
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("level", level);
        metadata.put("majorCode", normalizedCode.length() >= 2 ? normalizedCode.substring(0, 2) : "");
        metadata.put("middleCode", normalizedCode.length() >= 4 ? normalizedCode.substring(0, 4) : "");
        metadata.put("smallCode", normalizedCode.length() >= 6 ? normalizedCode.substring(0, 6) : "");
        if ("MAJOR".equals(level)) {
            metadata.put("majorName", label);
            metadata.put("middleName", "");
            metadata.put("smallName", "");
        } else if ("MIDDLE".equals(level)) {
            DetailCodeVO major = detailCodeMap.get(normalizedCode.substring(0, 2));
            if (major == null) {
                throw new IllegalArgumentException(isEn ? "Create the parent major classification first." : "상위 대분류를 먼저 등록하세요.");
            }
            metadata.put("majorName", safe(major.getCodeNm()));
            metadata.put("middleName", label);
            metadata.put("smallName", "");
        } else {
            DetailCodeVO major = detailCodeMap.get(normalizedCode.substring(0, 2));
            DetailCodeVO middle = detailCodeMap.get(normalizedCode.substring(0, 4));
            if (major == null || middle == null) {
                throw new IllegalArgumentException(isEn ? "Create the parent major and middle classifications first." : "상위 대분류와 중분류를 먼저 등록하세요.");
            }
            metadata.put("majorName", safe(major.getCodeNm()));
            metadata.put("middleName", safe(middle.getCodeNm()));
            metadata.put("smallName", label);
        }
        metadata.put("tierLabel", safe(tierLabel));
        metadata.put("aliases", normalizeAliases(aliasesRaw));
        try {
            return objectMapper.writeValueAsString(metadata);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize LCI classification metadata. code={}", normalizedCode, e);
            throw new IllegalArgumentException(isEn ? "Failed to serialize the classification metadata." : "분류 메타데이터를 저장 형식으로 변환하지 못했습니다.");
        }
    }

    private Map<String, Object> parseMetadata(String json) {
        String normalized = safe(json);
        if (!normalized.startsWith("{")) {
            return new LinkedHashMap<>();
        }
        try {
            return objectMapper.readValue(normalized, new TypeReference<Map<String, Object>>() { });
        } catch (Exception e) {
            log.warn("Failed to parse LCI classification metadata. json={}", normalized, e);
            return new LinkedHashMap<>();
        }
    }

    private Map<String, DetailCodeVO> loadDetailCodeMap() throws Exception {
        Map<String, DetailCodeVO> rows = new LinkedHashMap<>();
        for (DetailCodeVO detailCode : adminCodeManageService.selectDetailCodeList(CODE_ID)) {
            rows.put(safe(detailCode == null ? null : detailCode.getCode()), detailCode);
        }
        return rows;
    }

    private void validateCode(String code, boolean isEn) {
        if (!code.matches("\\d{2}|\\d{4}|\\d{6}")) {
            throw new IllegalArgumentException(isEn
                    ? "Use a 2, 4, or 6 digit numeric code for the classification."
                    : "분류 코드는 숫자 2자리, 4자리, 6자리 형식만 사용할 수 있습니다.");
        }
    }

    private void assertParentExists(String code, Map<String, DetailCodeVO> detailCodeMap, boolean isEn) {
        if (code.length() >= 4 && !detailCodeMap.containsKey(code.substring(0, 2))) {
            throw new IllegalArgumentException(isEn ? "Create the parent major classification first." : "상위 대분류를 먼저 등록하세요.");
        }
        if (code.length() >= 6 && !detailCodeMap.containsKey(code.substring(0, 4))) {
            throw new IllegalArgumentException(isEn ? "Create the parent middle classification first." : "상위 중분류를 먼저 등록하세요.");
        }
    }

    private boolean hasChildren(String code, Map<String, DetailCodeVO> detailCodeMap) {
        for (String targetCode : detailCodeMap.keySet()) {
            if (!targetCode.equals(code) && targetCode.startsWith(code)) {
                return true;
            }
        }
        return false;
    }

    private List<Map<String, String>> buildSummaryCards(List<Map<String, Object>> rows, boolean isEn) {
        int activeCount = 0;
        int hiddenCount = 0;
        for (Map<String, Object> row : rows) {
            if ("N".equalsIgnoreCase(safe(stringValue(row.get("useAt"))))) {
                hiddenCount += 1;
            } else {
                activeCount += 1;
            }
        }
        List<Map<String, String>> cards = new ArrayList<>();
        cards.add(summaryCard(isEn ? "Rows" : "분류 수", String.valueOf(rows.size()), isEn ? "Stored under the EMLCI common-code group" : "EMLCI 공통코드 그룹 저장 건수"));
        cards.add(summaryCard(isEn ? "Active" : "운영중", String.valueOf(activeCount), isEn ? "Classifications exposed to linked pages" : "연계 화면에서 사용할 수 있는 분류"));
        cards.add(summaryCard(isEn ? "Hidden" : "숨김", String.valueOf(hiddenCount), isEn ? "Disabled but retained classifications" : "비활성화했지만 보존된 분류"));
        cards.add(summaryCard(isEn ? "Code Group" : "공통코드", CODE_ID, isEn ? "Shared source for all emission LCI routes" : "배출 LCI 관련 화면 공통 소스"));
        return cards;
    }

    private List<Map<String, String>> buildLevelOptions(boolean isEn) {
        List<Map<String, String>> options = new ArrayList<>();
        options.add(option("", isEn ? "All Levels" : "전체 단계"));
        options.add(option("MAJOR", isEn ? "Major" : "대분류"));
        options.add(option("MIDDLE", isEn ? "Middle" : "중분류"));
        options.add(option("SMALL", isEn ? "Small" : "소분류"));
        return options;
    }

    private List<Map<String, String>> buildGovernanceNotes(boolean isEn) {
        List<Map<String, String>> notes = new ArrayList<>();
        notes.add(note(isEn ? "Hierarchy rule" : "계층 규칙",
                isEn ? "Use 2 digits for major, 4 digits for middle, and 6 digits for small classifications." : "대분류는 2자리, 중분류는 4자리, 소분류는 6자리 코드를 사용합니다."));
        notes.add(note(isEn ? "Parent dependency" : "상위 분류 의존성",
                isEn ? "Middle and small rows can be saved only when the parent prefix already exists." : "중분류와 소분류는 상위 prefix 코드가 먼저 등록되어 있어야 저장됩니다."));
        notes.add(note(isEn ? "Shared source" : "공유 소스",
                isEn ? "This screen writes to the EMLCI common-code group used by emission management, definition studio, GWP values, and survey admin." : "이 화면은 배출 변수 관리, 정의 관리, GWP 값 관리, 설문 관리가 함께 읽는 EMLCI 공통코드 그룹을 수정합니다."));
        return notes;
    }

    private Map<String, String> option(String value, String label) {
        Map<String, String> option = new LinkedHashMap<>();
        option.put("value", value);
        option.put("label", label);
        return option;
    }

    private Map<String, String> note(String title, String description) {
        Map<String, String> note = new LinkedHashMap<>();
        note.put("title", title);
        note.put("description", description);
        return note;
    }

    private Map<String, String> summaryCard(String title, String value, String description) {
        Map<String, String> card = new LinkedHashMap<>();
        card.put("title", title);
        card.put("value", value);
        card.put("description", description);
        return card;
    }

    private boolean matchesLevel(Map<String, Object> row, String level) {
        return level.isEmpty() || level.equalsIgnoreCase(safe(stringValue(row.get("level"))));
    }

    private boolean matchesUseAt(Map<String, Object> row, String useAt) {
        return useAt.isEmpty() || useAt.equalsIgnoreCase(safe(stringValue(row.get("useAt"))));
    }

    private boolean matchesKeyword(Map<String, Object> row, String keyword) {
        if (keyword.isEmpty()) {
            return true;
        }
        String haystack = String.join(" ",
                safe(stringValue(row.get("code"))),
                safe(stringValue(row.get("label"))),
                safe(stringValue(row.get("pathLabel"))),
                safe(stringValue(row.get("tierLabel"))),
                String.join(" ", normalizeAliases(row.get("aliases"))))
                .toLowerCase(Locale.ROOT);
        return haystack.contains(keyword);
    }

    private Map<String, Object> findSelectedRow(List<Map<String, Object>> rows, String code) {
        String normalizedCode = safe(code);
        if (normalizedCode.isEmpty()) {
            return null;
        }
        for (Map<String, Object> row : rows) {
            if (normalizedCode.equals(safe(stringValue(row.get("code"))))) {
                return new LinkedHashMap<>(row);
            }
        }
        return null;
    }

    private String inferLevel(String code) {
        if (code.length() >= 6) {
            return "SMALL";
        }
        if (code.length() >= 4) {
            return "MIDDLE";
        }
        return "MAJOR";
    }

    private List<Map<String, Object>> castRows(Object value) {
        List<Map<String, Object>> rows = new ArrayList<>();
        if (!(value instanceof List<?>)) {
            return rows;
        }
        for (Object item : (List<?>) value) {
            if (item instanceof Map<?, ?>) {
                @SuppressWarnings("unchecked")
                Map<String, Object> row = (Map<String, Object>) item;
                rows.add(new LinkedHashMap<>(row));
            }
        }
        return rows;
    }

    private List<String> normalizeAliases(Object value) {
        Set<String> aliases = new LinkedHashSet<>();
        if (value instanceof List<?>) {
            for (Object item : (List<?>) value) {
                String alias = safe(stringValue(item)).toUpperCase(Locale.ROOT);
                if (!alias.isEmpty()) {
                    aliases.add(alias);
                }
            }
            return new ArrayList<>(aliases);
        }
        for (String token : safe(stringValue(value)).split(",")) {
            String alias = safe(token).toUpperCase(Locale.ROOT);
            if (!alias.isEmpty()) {
                aliases.add(alias);
            }
        }
        return new ArrayList<>(aliases);
    }

    private String normalizeCode(String value) {
        return safe(value).replaceAll("\\D", "");
    }

    private String normalizeUseAt(String value) {
        return "N".equalsIgnoreCase(safe(value)) ? "N" : safe(value).isEmpty() ? "" : "Y";
    }

    private String normalizeStoredUseAt(String value) {
        return "N".equalsIgnoreCase(safe(value)) ? "N" : "Y";
    }

    private String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
