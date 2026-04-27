package egovframework.com.feature.admin.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.feature.admin.dto.request.EmissionDefinitionDraftSaveRequest;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class AdminEmissionDefinitionStudioService {

    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final String MENU_CODE = "A0020108";

    private final ObjectMapper objectMapper;
    private final Path registryPath = Paths.get("data", "admin", "emission-definition-studio", "definitions.json");

    public AdminEmissionDefinitionStudioService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public synchronized Map<String, Object> buildPagePayload(boolean isEn) {
        Map<String, Map<String, Object>> entries = loadAll();
        List<Map<String, Object>> definitionRows = buildDefinitionRows(entries, isEn);
        Map<String, Object> selectedDefinition = definitionRows.isEmpty() ? defaultDraft() : new LinkedHashMap<>(definitionRows.get(0));

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("isEn", isEn);
        payload.put("menuCode", MENU_CODE);
        payload.put("menuUrl", isEn ? "/en/admin/emission/definition-studio" : "/admin/emission/definition-studio");
        payload.put("pageTitle", "배출 정의 관리");
        payload.put("pageTitleEn", "Emission Definition Studio");
        payload.put("pageDescription", "분류, Tier, 변수, 수식, validation/resolution 규칙을 저장 가능한 정의 단위로 설계합니다.");
        payload.put("pageDescriptionEn", "Design category, tier, variable, formula, and validation/resolution rules as persistable definitions.");
        payload.put("summaryCards", buildSummaryCards(entries.size(), isEn));
        payload.put("quickLinks", buildQuickLinks(isEn));
        payload.put("seedCategories", buildSeedCategories(isEn));
        payload.put("seedTiers", buildSeedTiers(isEn));
        payload.put("policyOptions", buildPolicyOptions(isEn));
        payload.put("saveChecklist", buildSaveChecklist(isEn));
        payload.put("governanceNotes", buildGovernanceNotes(isEn));
        payload.put("definitionRows", definitionRows);
        payload.put("selectedDefinition", selectedDefinition);
        return payload;
    }

    public synchronized List<Map<String, Object>> buildPublishedDefinitionRows(boolean isEn) {
        return buildDefinitionRows(filterPublishedEntries(loadAll()), isEn);
    }

    public synchronized Map<String, Object> findPublishedDefinition(String categoryCode, Integer tier, boolean isEn) {
        Map<String, Object> matched = findPublishedDefinitionRaw(categoryCode, tier);
        return matched.isEmpty() ? new LinkedHashMap<>() : localizeDraft(matched, isEn);
    }

    public synchronized Map<String, Object> findLatestPublishedDefinition(boolean isEn) {
        List<Map<String, Object>> rows = buildPublishedDefinitionRows(isEn);
        return rows.isEmpty() ? new LinkedHashMap<>() : new LinkedHashMap<>(rows.get(0));
    }

    public synchronized Map<String, Object> findPublishedDefinitionRaw(String categoryCode, Integer tier) {
        return new LinkedHashMap<>(findLatestMatchingDefinition(filterPublishedEntries(loadAll()), categoryCode, tier));
    }

    public synchronized Map<String, Object> findPublishedDefinitionByDraftIdRaw(String draftId) {
        String normalizedDraftId = safe(draftId);
        if (normalizedDraftId.isEmpty()) {
            return new LinkedHashMap<>();
        }
        Map<String, Object> matched = filterPublishedEntries(loadAll()).get(normalizedDraftId);
        return matched == null ? new LinkedHashMap<>() : new LinkedHashMap<>(matched);
    }

    public synchronized Map<String, Object> saveDraft(EmissionDefinitionDraftSaveRequest request, String actorId, boolean isEn) {
        if (request == null) {
            throw new IllegalArgumentException(isEn ? "Request is required." : "요청값이 필요합니다.");
        }
        String categoryCode = normalizeCode(request.getCategoryCode());
        String categoryName = safe(request.getCategoryName());
        String tierLabel = safe(request.getTierLabel());
        String formula = safe(request.getFormula());
        List<Map<String, Object>> formulaTree = normalizeFormulaTree(request.getFormulaTree());
        String inputMode = normalizeInputMode(request.getInputMode());
        List<String> policies = normalizePolicies(request.getPolicies());
        List<String> directRequiredCodes = normalizeCodes(request.getDirectRequiredCodes());
        List<String> fallbackCodes = normalizeCodes(request.getFallbackCodes());
        List<String> autoCalculatedCodes = normalizeCodes(request.getAutoCalculatedCodes());
        List<String> supplementalCodes = normalizeCodes(request.getSupplementalCodes());
        List<Map<String, Object>> sections = normalizeSections(request.getSections(), request.getVariableDefinitions());
        List<Map<String, Object>> variableDefinitions = normalizeVariableDefinitions(request.getVariableDefinitions());
        String runtimeMode = normalizeRuntimeMode(request.getRuntimeMode());
        String note = safe(request.getNote());

        if (categoryCode.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Category code is required." : "분류 코드는 필수입니다.");
        }
        if (categoryName.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Category name is required." : "분류명은 필수입니다.");
        }
        if (tierLabel.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Tier label is required." : "Tier는 필수입니다.");
        }
        if (formula.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Formula is required." : "수식은 필수입니다.");
        }

        Map<String, Map<String, Object>> entries = loadAll();
        String draftId = safe(request.getDraftId());
        if (draftId.isEmpty()) {
            draftId = "EMISSION_DEF_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase(Locale.ROOT);
        }
        Map<String, Object> existing = entries.get(draftId);

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("draftId", draftId);
        row.put("categoryCode", categoryCode);
        row.put("categoryName", categoryName);
        row.put("tierLabel", tierLabel);
        row.put("formula", formula);
        row.put("formulaTree", formulaTree);
        row.put("inputMode", inputMode);
        row.put("policies", policies);
        row.put("directRequiredCodes", directRequiredCodes);
        row.put("fallbackCodes", fallbackCodes);
        row.put("autoCalculatedCodes", autoCalculatedCodes);
        row.put("supplementalCodes", supplementalCodes);
        row.put("sections", sections);
        row.put("variableDefinitions", variableDefinitions);
        row.put("runtimeMode", runtimeMode);
        row.put("note", note);
        row.put("lastSavedAt", LocalDateTime.now().format(DATE_TIME_FORMATTER));
        row.put("lastSavedBy", firstNonBlank(actorId, "system"));
        row.put("status", "DRAFT");
        row.put("publishedVersionId", safe(existing == null ? null : existing.get("publishedVersionId")));
        row.put("publishedSavedAt", safe(existing == null ? null : existing.get("publishedSavedAt")));
        row.put("lastPublishedBy", safe(existing == null ? null : existing.get("lastPublishedBy")));

        entries.put(draftId, row);
        saveAll(entries);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("saved", true);
        response.put("draftId", draftId);
        response.put("message", isEn ? "Emission definition draft saved." : "배출 정의 초안을 저장했습니다.");
        response.put("draftDetail", localizeDraft(row, isEn));
        response.put("definitionRows", buildDefinitionRows(entries, isEn));
        return response;
    }

    public synchronized Map<String, Object> publishDraft(String draftId, String actorId, boolean isEn) {
        String normalizedDraftId = safe(draftId);
        if (normalizedDraftId.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Draft id is required." : "초안 ID는 필수입니다.");
        }

        Map<String, Map<String, Object>> entries = loadAll();
        Map<String, Object> existing = entries.get(normalizedDraftId);
        if (existing == null || existing.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Draft not found." : "초안을 찾을 수 없습니다.");
        }

        Map<String, Object> row = new LinkedHashMap<>(existing);
        row.put("status", "PUBLISHED");
        row.put("publishedVersionId", buildPublishedVersionId(normalizedDraftId));
        row.put("publishedSavedAt", LocalDateTime.now().format(DATE_TIME_FORMATTER));
        row.put("lastPublishedBy", firstNonBlank(actorId, "system"));
        row.put("runtimeMode", normalizeRuntimeMode(safe(existing.get("runtimeMode"))));
        entries.put(normalizedDraftId, row);
        saveAll(entries);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("published", true);
        response.put("draftId", normalizedDraftId);
        response.put("message", isEn ? "Emission definition snapshot published." : "배출 정의 스냅샷을 publish 했습니다.");
        response.put("draftDetail", localizeDraft(row, isEn));
        response.put("definitionRows", buildDefinitionRows(entries, isEn));
        return response;
    }

    private List<Map<String, String>> buildSummaryCards(int draftCount, boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(summaryCard(isEn ? "Seed Categories" : "시드 분류", "2", isEn ? "Categories already running in the calculator" : "현재 계산기가 이미 운영 중인 카테고리 수"));
        rows.add(summaryCard(isEn ? "Live Tiers" : "기존 Tier", "6", isEn ? "Total live tiers across cement and lime" : "시멘트/석회 전체 Tier 수"));
        rows.add(summaryCard(isEn ? "Policy Axes" : "정책 축", "5", "required/default/stored/mapping/derived"));
        rows.add(summaryCard(isEn ? "Saved Drafts" : "저장 초안", String.valueOf(draftCount), isEn ? "Persisted definition drafts available for reuse." : "다시 불러올 수 있는 저장 초안 수입니다."));
        return rows;
    }

    private List<Map<String, String>> buildQuickLinks(boolean isEn) {
        return Arrays.asList(
                quickLink(isEn ? "Emission Variable Management" : "배출 변수 관리", isEn ? "/en/admin/emission/management" : "/admin/emission/management", "tune"),
                quickLink(isEn ? "Function Management" : "기능 관리", isEn ? "/en/admin/system/feature-management?menuType=ADMIN&searchKeyword=" + MENU_CODE : "/admin/system/feature-management?menuType=ADMIN&searchKeyword=" + MENU_CODE, "rule_settings"),
                quickLink(isEn ? "Menu Management" : "메뉴 관리", isEn ? "/en/admin/system/menu?menuType=ADMIN&searchKeyword=" + MENU_CODE : "/admin/system/menu?menuType=ADMIN&searchKeyword=" + MENU_CODE, "menu_book"),
                quickLink(isEn ? "Emission Validation" : "검증 관리", isEn ? "/en/admin/emission/validate" : "/admin/emission/validate", "fact_check"));
    }

    private List<Map<String, String>> buildSeedCategories(boolean isEn) {
        return Arrays.asList(
                seedCategory("CEMENT", isEn ? "Cement production" : "시멘트 생산", "Tier 1, 2, 3", isEn ? "Hard-coded calculator + partial UI metadata" : "계산기 하드코딩 + 부분 UI 메타"),
                seedCategory("LIME", isEn ? "Lime production" : "석회 생산", "Tier 1, 2, 3", isEn ? "Hard-coded calculator + partial fallback rules" : "계산기 하드코딩 + 부분 fallback 규칙"));
    }

    private List<Map<String, String>> buildSeedTiers(boolean isEn) {
        return Arrays.asList(
                seedTier("Tier 1", isEn ? "Stored/default factor focused" : "저장값/기본계수 중심", "required + default"),
                seedTier("Tier 2", isEn ? "Derived + fallback mix" : "유도식 + 대체값 혼합", "required + default + stored + derived"),
                seedTier("Tier 3", isEn ? "Mapping + fallback mix" : "유형 매핑 + 대체값 혼합", "required + mapping + stored + default"));
    }

    private List<Map<String, String>> buildPolicyOptions(boolean isEn) {
        return Arrays.asList(
                policyOption("input_required_yn", isEn ? "Required input" : "직접 입력 필요", isEn ? "Blocks save/calculate when no resolved value exists." : "해석된 값이 없으면 저장/계산을 막습니다."),
                policyOption("default_capable_yn", isEn ? "Default-capable" : "기본 계수 사용 가능", isEn ? "Allows document default fallback when live input is empty." : "실입력이 비면 문서 기본값으로 대체합니다."),
                policyOption("stored_factor_capable_yn", isEn ? "Stored-factor capable" : "저장 계수 사용 가능", isEn ? "Reads the latest saved factor row before default fallback." : "기본값 전에 저장 계수를 먼저 읽습니다."),
                policyOption("mapping_capable_yn", isEn ? "Type mapping capable" : "유형 매핑 가능", isEn ? "Resolves a factor from a selected type/code." : "선택한 유형/코드에서 계수를 결정합니다."),
                policyOption("derived_capable_yn", isEn ? "Derived formula capable" : "유도식 계산 가능", isEn ? "Computes the factor from sibling inputs before fallback." : "다른 입력값으로 먼저 유도 계산합니다."));
    }

    private List<Map<String, String>> buildSaveChecklist(boolean isEn) {
        return Arrays.asList(
                checklist(isEn ? "Category row and tier row exist together." : "분류 행과 Tier 행을 함께 등록한다."),
                checklist(isEn ? "Formula and variable codes are stored in one versioned payload." : "수식과 변수 코드를 하나의 버전 payload로 저장한다."),
                checklist(isEn ? "Validation policy and resolution policy are stored separately." : "validation 정책과 resolution 정책을 분리 저장한다."),
                checklist(isEn ? "VIEW/menu/feature chain is fixed before mutation API opens." : "저장 API 개방 전 VIEW/menu/feature 체인을 확정한다."));
    }

    private List<Map<String, String>> buildGovernanceNotes(boolean isEn) {
        return Arrays.asList(
                note(isEn ? "Current emission management UI still contains hard-coded fallback interpretation." : "현재 배출 변수 관리 UI에는 하드코딩된 fallback 해석이 일부 남아 있습니다."),
                note(isEn ? "Phase 1 should normalize the saved definition payload before replacing the live calculator." : "1단계에서는 실계산기를 교체하기 전에 저장 정의 payload를 먼저 정규화해야 합니다."),
                note(isEn ? "Blank repeat-group validation must stay strict even after metadata storage is introduced." : "메타 저장 구조로 바뀐 뒤에도 반복 그룹 공백 검증은 엄격하게 유지해야 합니다."));
    }

    private List<Map<String, Object>> buildDefinitionRows(Map<String, Map<String, Object>> entries, boolean isEn) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map<String, Object> value : entries.values()) {
            rows.add(localizeDraft(value, isEn));
        }
        rows.sort((left, right) -> safe(right.get("lastSavedAt")).compareTo(safe(left.get("lastSavedAt"))));
        return rows;
    }

    private Map<String, Object> localizeDraft(Map<String, Object> source, boolean isEn) {
        Map<String, Object> row = new LinkedHashMap<>(source == null ? defaultDraft() : source);
        row.put("policyLabels", normalizePolicies(asStringList(row.get("policies"))));
        row.put("directRequiredCount", asStringList(row.get("directRequiredCodes")).size());
        row.put("fallbackCount", asStringList(row.get("fallbackCodes")).size());
        row.put("autoCalculatedCount", asStringList(row.get("autoCalculatedCodes")).size());
        row.put("supplementalCount", asStringList(row.get("supplementalCodes")).size());
        row.put("sectionCount", asMapList(row.get("sections")).size());
        row.put("variableDefinitionCount", asMapList(row.get("variableDefinitions")).size());
        String status = safe(row.get("status")).toUpperCase(Locale.ROOT);
        if ("PUBLISHED".equals(status)) {
            row.put("statusLabel", isEn ? "Published" : "배포됨");
        } else {
            row.put("statusLabel", isEn ? "Draft" : "초안");
        }
        String runtimeMode = normalizeRuntimeMode(safe(row.get("runtimeMode")));
        row.put("runtimeMode", runtimeMode);
        if ("PRIMARY".equals(runtimeMode)) {
            row.put("runtimeModeLabel", isEn ? "Primary runtime" : "실행 우선");
        } else if ("SHADOW".equals(runtimeMode)) {
            row.put("runtimeModeLabel", isEn ? "Shadow only" : "비교 전용");
        } else {
            row.put("runtimeModeLabel", isEn ? "Auto adopt on match" : "일치 시 자동 채택");
        }
        return row;
    }

    private Map<String, Object> defaultDraft() {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("draftId", "");
        row.put("categoryCode", "CEMENT");
        row.put("categoryName", "시멘트 생산 확장");
        row.put("tierLabel", "Tier 4");
        row.put("formula", "SUM(activity × factor) - correction");
        row.put("formulaTree", new ArrayList<Map<String, Object>>());
        row.put("inputMode", "NUMBER");
        row.put("policies", new ArrayList<>(Arrays.asList("input_required_yn", "default_capable_yn", "stored_factor_capable_yn")));
        row.put("directRequiredCodes", new ArrayList<>(Arrays.asList("MCI", "CCLI", "MCL", "MLI")));
        row.put("fallbackCodes", new ArrayList<>(Arrays.asList("EFCLC", "EFC", "EFCL")));
        row.put("autoCalculatedCodes", new ArrayList<>(Collections.singletonList("CFCKD")));
        row.put("supplementalCodes", new ArrayList<String>());
        row.put("sections", new ArrayList<Map<String, Object>>());
        row.put("variableDefinitions", new ArrayList<Map<String, Object>>());
        row.put("runtimeMode", "AUTO");
        row.put("note", "저장 API 개방 전 validation 정책과 resolution 정책을 분리합니다.");
        row.put("lastSavedAt", "");
        row.put("lastSavedBy", "");
        row.put("status", "DRAFT");
        row.put("publishedVersionId", "");
        row.put("publishedSavedAt", "");
        row.put("lastPublishedBy", "");
        return row;
    }

    private String buildPublishedVersionId(String draftId) {
        return "published-" + safe(draftId).toLowerCase(Locale.ROOT) + "-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    }

    private Map<String, Map<String, Object>> filterPublishedEntries(Map<String, Map<String, Object>> entries) {
        Map<String, Map<String, Object>> filtered = new LinkedHashMap<>();
        for (Map.Entry<String, Map<String, Object>> entry : entries.entrySet()) {
            Map<String, Object> value = entry.getValue();
            if ("PUBLISHED".equalsIgnoreCase(safe(value == null ? null : value.get("status")))) {
                filtered.put(entry.getKey(), value == null ? new LinkedHashMap<>() : new LinkedHashMap<>(value));
            }
        }
        return filtered;
    }

    private Map<String, Object> findLatestMatchingDefinition(Map<String, Map<String, Object>> entries, String categoryCode, Integer tier) {
        String normalizedCategoryCode = normalizeCode(categoryCode);
        String tierLabel = "TIER " + (tier == null ? 0 : tier);
        Map<String, Object> matched = new LinkedHashMap<>();
        String bestSavedAt = "";
        for (Map<String, Object> draft : entries.values()) {
            if (!normalizedCategoryCode.equals(normalizeCode(safe(draft.get("categoryCode"))))) {
                continue;
            }
            if (!tierLabel.equals(normalizeTierLabel(safe(draft.get("tierLabel"))))) {
                continue;
            }
            String publishedSavedAt = safe(draft.get("publishedSavedAt"));
            String lastSavedAt = safe(draft.get("lastSavedAt"));
            String candidateTimestamp = firstNonBlank(publishedSavedAt, lastSavedAt);
            if (matched.isEmpty() || candidateTimestamp.compareTo(bestSavedAt) >= 0) {
                matched = new LinkedHashMap<>(draft);
                bestSavedAt = candidateTimestamp;
            }
        }
        return matched;
    }

    private Map<String, Map<String, Object>> loadAll() {
        if (!Files.exists(registryPath)) {
            return new LinkedHashMap<>();
        }
        try (InputStream inputStream = Files.newInputStream(registryPath)) {
            Map<String, Map<String, Object>> result = objectMapper.readValue(inputStream, new TypeReference<LinkedHashMap<String, Map<String, Object>>>() {});
            return result == null ? new LinkedHashMap<>() : new LinkedHashMap<>(result);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read emission definition registry.", e);
        }
    }

    private void saveAll(Map<String, Map<String, Object>> entries) {
        try {
            Files.createDirectories(registryPath.getParent());
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(registryPath.toFile(), entries == null ? Collections.emptyMap() : entries);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to write emission definition registry.", e);
        }
    }

    private String normalizeCode(String value) {
        return safe(value).replace(' ', '_').toUpperCase(Locale.ROOT);
    }

    private String normalizeInputMode(String value) {
        String normalized = safe(value).toUpperCase(Locale.ROOT);
        if ("TEXT".equals(normalized) || "SELECT".equals(normalized)) {
            return normalized;
        }
        return "NUMBER";
    }

    private String normalizeRuntimeMode(String value) {
        String normalized = safe(value).toUpperCase(Locale.ROOT);
        if ("SHADOW".equals(normalized) || "PRIMARY".equals(normalized)) {
            return normalized;
        }
        return "AUTO";
    }

    private String normalizeTierLabel(String value) {
        return safe(value).replaceAll("\\s+", " ").trim().toUpperCase(Locale.ROOT);
    }

    private List<String> normalizePolicies(List<String> values) {
        List<String> result = new ArrayList<>();
        for (String value : values == null ? Collections.<String>emptyList() : values) {
            String normalized = safe(value);
            if (!normalized.isEmpty() && !result.contains(normalized)) {
                result.add(normalized);
            }
        }
        return result;
    }

    private List<String> normalizeCodes(List<String> values) {
        List<String> result = new ArrayList<>();
        for (String value : values == null ? Collections.<String>emptyList() : values) {
            String normalized = safe(value).replace(' ', '_').toUpperCase(Locale.ROOT);
            if (!normalized.isEmpty() && !result.contains(normalized)) {
                result.add(normalized);
            }
        }
        return result;
    }

    private List<Map<String, Object>> normalizeFormulaTree(List<Map<String, Object>> values) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> value : values == null ? Collections.<Map<String, Object>>emptyList() : values) {
            String kind = safe(value == null ? null : value.get("kind"));
            if (kind.isEmpty()) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("kind", kind);
            copyIfPresent(row, "joiner", value);
            copyIfPresent(row, "token", value);
            copyIfPresent(row, "iterator", value);
            List<Map<String, Object>> items = normalizeFormulaTree(asMapList(value == null ? null : value.get("items")));
            List<Map<String, Object>> numerator = normalizeFormulaTree(asMapList(value == null ? null : value.get("numerator")));
            List<Map<String, Object>> denominator = normalizeFormulaTree(asMapList(value == null ? null : value.get("denominator")));
            if (!items.isEmpty()) {
                row.put("items", items);
            }
            if (!numerator.isEmpty()) {
                row.put("numerator", numerator);
            }
            if (!denominator.isEmpty()) {
                row.put("denominator", denominator);
            }
            result.add(row);
        }
        return result;
    }

    private List<Map<String, Object>> normalizeVariableDefinitions(List<Map<String, Object>> values) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> value : values == null ? Collections.<Map<String, Object>>emptyList() : values) {
            String varCode = normalizeCode(safe(value == null ? null : value.get("varCode")));
            if (varCode.isEmpty()) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("varCode", varCode);
            copyIfPresent(row, "varName", value);
            copyIfPresent(row, "varDesc", value);
            copyIfPresent(row, "displayName", value);
            copyIfPresent(row, "displayCode", value);
            copyIfPresent(row, "unit", value);
            copyIfPresent(row, "inputType", value);
            copyIfPresent(row, "sourceType", value);
            copyIfPresent(row, "commonCodeId", value);
            copyIfPresent(row, "uiHint", value);
            copyIfPresent(row, "derivedYn", value);
            copyIfPresent(row, "supplementalYn", value);
            copyIfPresent(row, "isRepeatable", value);
            copyIfPresent(row, "isRequired", value);
            copyIfPresent(row, "repeatGroupKey", value);
            copyIfPresent(row, "sectionId", value);
            copyIfPresent(row, "sectionTitle", value);
            copyIfPresent(row, "sectionDescription", value);
            copyIfPresent(row, "sectionFormula", value);
            copyIfPresent(row, "sectionPreviewType", value);
            copyIfPresent(row, "sectionRelatedFactorCodes", value);
            copyIfPresent(row, "visibleWhen", value);
            copyIfPresent(row, "disabledWhen", value);
            if (value != null && value.get("sortOrder") instanceof Number) {
                row.put("sortOrder", ((Number) value.get("sortOrder")).intValue());
            }
            if (value != null && value.get("sectionOrder") instanceof Number) {
                row.put("sectionOrder", ((Number) value.get("sectionOrder")).intValue());
            }
            Object options = value == null ? null : value.get("options");
            if (options instanceof List<?>) {
                row.put("options", options);
            }
            result.add(row);
        }
        return result;
    }

    private List<Map<String, Object>> normalizeSections(List<Map<String, Object>> values, List<Map<String, Object>> variableDefinitions) {
        List<Map<String, Object>> source = values;
        if (source == null || source.isEmpty()) {
          source = extractSectionsFromVariables(variableDefinitions);
        }
        List<Map<String, Object>> result = new ArrayList<>();
        int index = 0;
        for (Map<String, Object> value : source == null ? Collections.<Map<String, Object>>emptyList() : source) {
            String rawSectionId = normalizeCode(safe(value == null ? null : value.get("sectionId")));
            String sectionTitle = safe(value == null ? null : value.get("sectionTitle"));
            String sectionDescription = safe(value == null ? null : value.get("sectionDescription"));
            String sectionFormula = safe(value == null ? null : value.get("sectionFormula"));
            String sectionPreviewType = safe(value == null ? null : value.get("sectionPreviewType"));
            String sectionRelatedFactorCodes = normalizeCsvCodes(value == null ? null : value.get("sectionRelatedFactorCodes"));
            String uiHint = safe(value == null ? null : value.get("uiHint"));
            boolean hasMetadata = !sectionTitle.isEmpty()
                    || !sectionDescription.isEmpty()
                    || !sectionFormula.isEmpty()
                    || !sectionPreviewType.isEmpty()
                    || !sectionRelatedFactorCodes.isEmpty()
                    || !uiHint.isEmpty();
            if (rawSectionId.isEmpty() && !hasMetadata) {
                continue;
            }
            index += 1;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("sectionId", rawSectionId.isEmpty() ? "SECTION_" + index : rawSectionId);
            if (!sectionTitle.isEmpty()) {
                row.put("sectionTitle", sectionTitle);
            }
            if (!sectionDescription.isEmpty()) {
                row.put("sectionDescription", sectionDescription);
            }
            if (!sectionFormula.isEmpty()) {
                row.put("sectionFormula", sectionFormula);
            }
            if (!sectionPreviewType.isEmpty()) {
                row.put("sectionPreviewType", sectionPreviewType);
            }
            if (!sectionRelatedFactorCodes.isEmpty()) {
                row.put("sectionRelatedFactorCodes", sectionRelatedFactorCodes);
            }
            if (!uiHint.isEmpty()) {
                row.put("uiHint", uiHint);
            }
            Object sectionOrder = value == null ? null : value.get("sectionOrder");
            if (sectionOrder instanceof Number) {
                row.put("sectionOrder", ((Number) sectionOrder).intValue());
            } else {
                row.put("sectionOrder", index * 10);
            }
            result.add(row);
        }
        return result;
    }

    private List<Map<String, Object>> extractSectionsFromVariables(List<Map<String, Object>> variableDefinitions) {
        List<Map<String, Object>> result = new ArrayList<>();
        List<Map<String, Object>> rows = variableDefinitions == null ? Collections.<Map<String, Object>>emptyList() : variableDefinitions;
        for (int index = 0; index < rows.size(); index += 1) {
            Map<String, Object> value = rows.get(index);
            String sectionId = normalizeCode(safe(value == null ? null : value.get("sectionId")));
            String sectionTitle = safe(value == null ? null : value.get("sectionTitle"));
            String sectionDescription = safe(value == null ? null : value.get("sectionDescription"));
            String sectionFormula = safe(value == null ? null : value.get("sectionFormula"));
            String sectionPreviewType = safe(value == null ? null : value.get("sectionPreviewType"));
            String sectionRelatedFactorCodes = normalizeCsvCodes(value == null ? null : value.get("sectionRelatedFactorCodes"));
            String uiHint = safe(value == null ? null : value.get("uiHint"));
            boolean hasMetadata = !sectionId.isEmpty()
                    || !sectionTitle.isEmpty()
                    || !sectionDescription.isEmpty()
                    || !sectionFormula.isEmpty()
                    || !sectionPreviewType.isEmpty()
                    || !sectionRelatedFactorCodes.isEmpty();
            if (!hasMetadata) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("sectionId", sectionId.isEmpty() ? "SECTION_" + (index + 1) : sectionId);
            if (!sectionTitle.isEmpty()) {
                row.put("sectionTitle", sectionTitle);
            }
            if (!sectionDescription.isEmpty()) {
                row.put("sectionDescription", sectionDescription);
            }
            if (!sectionFormula.isEmpty()) {
                row.put("sectionFormula", sectionFormula);
            }
            if (!sectionPreviewType.isEmpty()) {
                row.put("sectionPreviewType", sectionPreviewType);
            }
            if (!sectionRelatedFactorCodes.isEmpty()) {
                row.put("sectionRelatedFactorCodes", sectionRelatedFactorCodes);
            }
            if (!uiHint.isEmpty()) {
                row.put("uiHint", uiHint);
            }
            Object sectionOrder = value == null ? null : value.get("sectionOrder");
            if (sectionOrder instanceof Number) {
                row.put("sectionOrder", ((Number) sectionOrder).intValue());
            } else {
                row.put("sectionOrder", (index + 1) * 10);
            }
            if (!containsSection(result, safe(row.get("sectionId")))) {
                result.add(row);
            }
        }
        return result;
    }

    private boolean containsSection(List<Map<String, Object>> rows, String sectionId) {
        for (Map<String, Object> row : rows) {
            if (safe(row == null ? null : row.get("sectionId")).equalsIgnoreCase(sectionId)) {
                return true;
            }
        }
        return false;
    }

    private String normalizeCsvCodes(Object value) {
        List<String> tokens = normalizeCodes(Arrays.asList(safe(value).split(",")));
        return String.join(",", tokens);
    }

    @SuppressWarnings("unchecked")
    private List<String> asStringList(Object value) {
        if (value instanceof List<?>) {
            List<String> rows = new ArrayList<>();
            for (Object item : (List<Object>) value) {
                String normalized = safe(item);
                if (!normalized.isEmpty()) {
                    rows.add(normalized);
                }
            }
            return rows;
        }
        return Collections.emptyList();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> asMapList(Object value) {
        if (value instanceof List<?>) {
            List<Map<String, Object>> rows = new ArrayList<>();
            for (Object item : (List<Object>) value) {
                if (item instanceof Map<?, ?>) {
                    rows.add(new LinkedHashMap<>((Map<String, Object>) item));
                }
            }
            return rows;
        }
        return Collections.emptyList();
    }

    private void copyIfPresent(Map<String, Object> target, String key, Map<String, Object> source) {
        String value = safe(source == null ? null : source.get(key));
        if (!value.isEmpty()) {
            target.put(key, value);
        }
    }

    private String firstNonBlank(String first, String fallback) {
        return safe(first).isEmpty() ? safe(fallback) : safe(first);
    }

    private String safe(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private Map<String, String> summaryCard(String title, String value, String description) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("title", title);
        row.put("value", value);
        row.put("description", description);
        return row;
    }

    private Map<String, String> quickLink(String label, String url, String icon) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("label", label);
        row.put("url", url);
        row.put("icon", icon);
        return row;
    }

    private Map<String, String> seedCategory(String code, String label, String tiers, String status) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("code", code);
        row.put("label", label);
        row.put("tiers", tiers);
        row.put("status", status);
        return row;
    }

    private Map<String, String> seedTier(String tier, String summary, String policies) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("tier", tier);
        row.put("summary", summary);
        row.put("policies", policies);
        return row;
    }

    private Map<String, String> policyOption(String code, String label, String description) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("code", code);
        row.put("label", label);
        row.put("description", description);
        return row;
    }

    private Map<String, String> checklist(String text) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("text", text);
        return row;
    }

    private Map<String, String> note(String text) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("text", text);
        return row;
    }
}
