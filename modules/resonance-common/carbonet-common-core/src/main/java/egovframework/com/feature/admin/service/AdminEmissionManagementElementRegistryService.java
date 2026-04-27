package egovframework.com.feature.admin.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.feature.admin.dto.request.EmissionManagementElementSaveRequest;
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
public class AdminEmissionManagementElementRegistryService {

    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final ObjectMapper objectMapper;
    private final Path registryPath = Paths.get("data", "admin", "emission-management", "elements.json");

    public AdminEmissionManagementElementRegistryService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public synchronized Map<String, Object> buildRegistryPayload(boolean isEn) {
        Map<String, Map<String, Object>> entries = mergeSeedEntries(loadAll());
        List<Map<String, Object>> rows = buildRegistryRows(entries, isEn);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("elementRegistrySummary", buildSummary(rows.size(), isEn));
        payload.put("elementRegistryRows", rows);
        payload.put("selectedElementDefinition", rows.isEmpty() ? defaultEntry() : new LinkedHashMap<>(rows.get(0)));
        payload.put("elementTypeOptions", buildCodeOptions(isEn,
                option("section", "화면 섹션", "Screen section"),
                option("control", "입력/제어", "Control"),
                option("summary", "요약/카드", "Summary/Card"),
                option("workspace", "작업공간", "Workspace"),
                option("result", "결과/로그", "Result/Log"),
                option("notice", "안내/경고", "Notice/Warning")));
        payload.put("layoutZoneOptions", buildCodeOptions(isEn,
                option("header", "헤더", "Header"),
                option("scope", "범위 선택", "Scope"),
                option("guide", "안내", "Guide"),
                option("catalog", "카탈로그", "Catalog"),
                option("workspace", "입력 작업공간", "Workspace"),
                option("result", "결과", "Result"),
                option("action", "액션", "Action")));
        payload.put("componentTypeOptions", buildCodeOptions(isEn,
                option("SummaryMetricCard", "요약 카드", "SummaryMetricCard"),
                option("CollectionResultPanel", "수집 결과 패널", "CollectionResultPanel"),
                option("DiagnosticCard", "진단 카드", "DiagnosticCard"),
                option("AdminInput", "입력 필드", "AdminInput"),
                option("AdminSelect", "선택 필드", "AdminSelect"),
                option("MemberButton", "버튼", "MemberButton"),
                option("PageStatusNotice", "상태 안내", "PageStatusNotice"),
                option("FormulaNotation", "수식 표시", "FormulaNotation")));
        payload.put("formulaReference", buildFormulaReferencePayload(isEn));
        return payload;
    }

    public synchronized Map<String, Object> saveElementDefinition(EmissionManagementElementSaveRequest request, String actorId, boolean isEn) {
        if (request == null) {
            throw new IllegalArgumentException(isEn ? "Request is required." : "요청값이 필요합니다.");
        }
        String elementKey = normalizeCode(request.getElementKey());
        String elementName = safe(request.getElementName());
        String elementType = safe(request.getElementType()).toLowerCase(Locale.ROOT);
        String layoutZone = safe(request.getLayoutZone()).toLowerCase(Locale.ROOT);
        String componentType = safe(request.getComponentType());

        if (elementKey.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Element key is required." : "요소 키는 필수입니다.");
        }
        if (elementName.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Element name is required." : "요소 이름은 필수입니다.");
        }
        if (elementType.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Element type is required." : "요소 유형은 필수입니다.");
        }
        if (layoutZone.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Layout zone is required." : "배치 영역은 필수입니다.");
        }

        Map<String, Map<String, Object>> entries = mergeSeedEntries(loadAll());
        String definitionId = safe(request.getDefinitionId());
        if (definitionId.isEmpty()) {
            definitionId = "EMISSION_ELEM_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase(Locale.ROOT);
        }

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("definitionId", definitionId);
        row.put("elementKey", elementKey);
        row.put("elementName", elementName);
        row.put("elementType", elementType);
        row.put("layoutZone", layoutZone);
        row.put("componentType", componentType);
        row.put("bindingTarget", safe(request.getBindingTarget()));
        row.put("defaultLabel", safe(request.getDefaultLabel()));
        row.put("defaultLabelEn", safe(request.getDefaultLabelEn()));
        row.put("description", safe(request.getDescription()));
        row.put("variableScope", safe(request.getVariableScope()));
        row.put("policyNote", safe(request.getPolicyNote()));
        row.put("directRequiredCodes", normalizeTags(request.getDirectRequiredCodes()));
        row.put("fallbackCodes", normalizeTags(request.getFallbackCodes()));
        row.put("autoCalculatedCodes", normalizeTags(request.getAutoCalculatedCodes()));
        row.put("useYn", "N".equalsIgnoreCase(safe(request.getUseYn())) ? "N" : "Y");
        row.put("tags", normalizeTags(request.getTags()));
        row.put("lastSavedAt", LocalDateTime.now().format(DATE_TIME_FORMATTER));
        row.put("lastSavedBy", firstNonBlank(actorId, "system"));
        row.put("status", "REGISTERED");

        entries.put(definitionId, row);
        saveAll(entries);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("saved", true);
        response.put("definitionId", definitionId);
        response.put("message", isEn ? "Emission management element registered." : "배출 변수 관리 요소를 등록했습니다.");
        response.put("elementRegistryRows", buildRegistryRows(mergeSeedEntries(loadAll()), isEn));
        response.put("selectedElementDefinition", localizeRow(row, isEn));
        return response;
    }

    private List<Map<String, String>> buildSummary(int count, boolean isEn) {
        return Arrays.asList(
                summaryCard(isEn ? "Registered elements" : "등록 요소 수", String.valueOf(count), isEn ? "Screen elements tracked in the registry." : "registry에 추적 중인 화면 요소 수입니다."),
                summaryCard(isEn ? "Layout zones" : "배치 영역", "7", isEn ? "header/scope/guide/catalog/workspace/result/action" : "header/scope/guide/catalog/workspace/result/action"),
                summaryCard(isEn ? "Component groups" : "컴포넌트 그룹", "8", isEn ? "Major reusable UI primitives linked to the page." : "페이지에 연결된 주요 재사용 UI primitive 수입니다.")
        );
    }

    private List<Map<String, Object>> buildRegistryRows(Map<String, Map<String, Object>> entries, boolean isEn) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map<String, Object> row : entries.values()) {
            rows.add(localizeRow(row, isEn));
        }
        rows.sort((left, right) -> safe(right.get("elementKey")).compareTo(safe(left.get("elementKey"))));
        attachPolicyMetadata(rows);
        return rows;
    }

    private Map<String, Object> localizeRow(Map<String, Object> source, boolean isEn) {
        Map<String, Object> row = new LinkedHashMap<>(source);
        row.put("statusLabel", "REGISTERED".equals(safe(row.get("status")))
                ? (isEn ? "Registered" : "등록됨")
                : (isEn ? "Seed" : "기본값"));
        row.put("useLabel", "Y".equalsIgnoreCase(safe(row.get("useYn")))
                ? (isEn ? "Use" : "사용")
                : (isEn ? "Disabled" : "미사용"));
        row.put("directRequiredCount", countList(row.get("directRequiredCodes")));
        row.put("fallbackCount", countList(row.get("fallbackCodes")));
        row.put("autoCalculatedCount", countList(row.get("autoCalculatedCodes")));
        return row;
    }

    private Map<String, Map<String, Object>> mergeSeedEntries(Map<String, Map<String, Object>> loaded) {
        Map<String, Map<String, Object>> merged = new LinkedHashMap<>();
        for (Map<String, Object> seed : seedEntries()) {
            merged.put(safe(seed.get("definitionId")), new LinkedHashMap<>(seed));
        }
        if (loaded != null) {
            for (Map.Entry<String, Map<String, Object>> entry : loaded.entrySet()) {
                if (entry.getValue() != null) {
                    merged.put(entry.getKey(), new LinkedHashMap<>(entry.getValue()));
                }
            }
        }
        return merged;
    }

    private List<Map<String, Object>> seedEntries() {
        List<Map<String, Object>> rows = new ArrayList<>();
        rows.add(seed("EMISSION_MGMT_SUMMARY", "EMISSION_SUMMARY_METRICS", "상단 요약 카드", "summary", "header", "SummaryMetricCard", "selectedMajor/selectedCategory/selectedTier/wizardStep", "현재 범위 요약", "Current scope summary", "대분류, 중분류, Tier, 단계 요약 카드를 정의합니다."));
        rows.add(seed("EMISSION_MGMT_DEFINITION_LINK", "EMISSION_DEFINITION_LINK", "정의 관리 링크", "section", "header", "MemberButton", "definitionStudioLink", "배출 정의 관리 이동", "Open definition studio", "별도 정의 관리 화면으로 이동하는 링크 블록입니다."));
        rows.add(seed("EMISSION_MGMT_SCOPE_SELECTION", "EMISSION_SCOPE_SELECTION", "범위 및 Tier 선택 패널", "section", "scope", "CollectionResultPanel", "selectedMajorKey/selectedCategoryId/selectedTier", "범위 및 Tier 선택", "Scope and tier selection", "대분류, 중분류, Tier를 결정하는 1단계 패널입니다."));
        rows.add(seed("EMISSION_MGMT_MAJOR_FILTER", "EMISSION_MAJOR_FILTER", "대분류 검색/선택", "control", "scope", "AdminSelect", "majorSearchKeyword/selectedMajorKey", "대분류 선택", "Major category select", "대분류 검색과 선택 입력 요소를 정의합니다."));
        rows.add(seed("EMISSION_MGMT_SUBCATEGORY_TIER", "EMISSION_SUBCATEGORY_TIER", "중분류 및 Tier 선택", "control", "scope", "AdminSelect", "subCategorySearchKeyword/selectedCategoryId/selectedTier", "중분류 및 Tier 선택", "Subcategory and tier", "중분류 검색, 중분류 선택, Tier 선택 요소를 정의합니다."));
        rows.add(seed("EMISSION_MGMT_TIER_GUIDE", "EMISSION_TIER_GUIDE", "Tier별 입력값 안내", "section", "guide", "CollectionResultPanel", "tierGuideMap/tiers", "Tier별 입력값 안내", "Tier input guide", "Tier별 수식/입력값 안내 영역입니다."));
        rows.add(seed("EMISSION_MGMT_VARIABLE_CATALOG", "EMISSION_VARIABLE_CATALOG", "변수 정의 카탈로그", "section", "catalog", "DiagnosticCard", "visibleVariables", "변수 정의 카탈로그", "Variable definition catalog", "선택된 Tier의 변수 메타데이터 카드 목록입니다."));
        rows.add(seed("EMISSION_MGMT_FACTOR_REFERENCE", "EMISSION_FACTOR_REFERENCE", "계수 참조", "section", "catalog", "DiagnosticCard", "factors/limeDefaultFactor", "계수 참조", "Factor references", "현재 범위에 적용 가능한 계수 행과 기본값을 보여줍니다."));
        rows.add(seed("EMISSION_MGMT_INPUT_WORKSPACE", "EMISSION_INPUT_WORKSPACE", "입력 작업공간", "workspace", "workspace", "DiagnosticCard", "inputs/sessionId", "입력 작업공간", "Input workspace", "실제 변수값을 입력하고 저장/계산하는 메인 작업영역입니다."));
        rows.add(seed("EMISSION_MGMT_FORMULA_FLOW", "EMISSION_FORMULA_FLOW", "수식 진행 워크플로우", "section", "workspace", "FormulaNotation", "formulaSummary/variableSections", "수식 진행 워크플로우", "Formula workflow", "활성 수식 블록과 토큰 매핑을 보여주는 흐름 섹션입니다."));
        rows.add(seed("EMISSION_MGMT_ACTION_BAR", "EMISSION_ACTION_BAR", "저장/계산 액션", "control", "action", "MemberButton", "handleSave/handleCalculate", "저장/계산 액션", "Save/calculate actions", "세션 저장과 계산 실행 버튼 그룹입니다."));
        rows.add(seed("EMISSION_MGMT_RESULT_PANEL", "EMISSION_RESULT_PANEL", "계산 결과 패널", "result", "result", "DiagnosticCard", "calculationResult", "계산 결과", "Calculation result", "계산된 배출량 결과와 결과 요약을 보여주는 패널입니다."));
        rows.add(seed("EMISSION_MGMT_CALC_LOG", "EMISSION_CALC_LOG", "계산 로그", "result", "result", "DiagnosticCard", "calculationResult.logs", "계산 로그", "Calculation logs", "계산식 적용 로그와 해석 결과를 보여줍니다."));
        rows.add(seed("EMISSION_MGMT_APPLIED_FACTORS", "EMISSION_APPLIED_FACTORS", "적용 계수 목록", "result", "result", "DiagnosticCard", "calculationResult.appliedFactors", "적용 계수 목록", "Applied factors", "기본값/저장값/유도값으로 적용된 계수를 추적합니다."));
        rows.add(seed("EMISSION_MGMT_VALIDATION_NOTICE", "EMISSION_VALIDATION_NOTICE", "검증/경고 안내", "notice", "action", "PageStatusNotice", "warning/validationIssues", "검증 및 경고 안내", "Validation notice", "필수 입력 누락 및 정렬 경고를 표시하는 알림 영역입니다."));
        return rows;
    }

    private Map<String, Object> seed(String definitionId, String elementKey, String elementName, String elementType, String layoutZone,
                                     String componentType, String bindingTarget, String defaultLabel, String defaultLabelEn, String description) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("definitionId", definitionId);
        row.put("elementKey", elementKey);
        row.put("elementName", elementName);
        row.put("elementType", elementType);
        row.put("layoutZone", layoutZone);
        row.put("componentType", componentType);
        row.put("bindingTarget", bindingTarget);
        row.put("defaultLabel", defaultLabel);
        row.put("defaultLabelEn", defaultLabelEn);
        row.put("description", description);
        row.put("variableScope", "");
        row.put("policyNote", "");
        row.put("directRequiredCodes", new ArrayList<String>());
        row.put("fallbackCodes", new ArrayList<String>());
        row.put("autoCalculatedCodes", new ArrayList<String>());
        row.put("useYn", "Y");
        row.put("tags", new ArrayList<>(Arrays.asList("emission-management", layoutZone, elementType)));
        row.put("lastSavedAt", "");
        row.put("lastSavedBy", "seed");
        row.put("status", "SEED");
        return row;
    }

    private Map<String, Object> defaultEntry() {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("definitionId", "");
        row.put("elementKey", "EMISSION_NEW_ELEMENT");
        row.put("elementName", "신규 요소");
        row.put("elementType", "section");
        row.put("layoutZone", "workspace");
        row.put("componentType", "DiagnosticCard");
        row.put("bindingTarget", "");
        row.put("defaultLabel", "신규 요소");
        row.put("defaultLabelEn", "New element");
        row.put("description", "배출 변수 관리 화면의 새 구성 요소를 등록합니다.");
        row.put("variableScope", "");
        row.put("policyNote", "");
        row.put("directRequiredCodes", new ArrayList<String>());
        row.put("fallbackCodes", new ArrayList<String>());
        row.put("autoCalculatedCodes", new ArrayList<String>());
        row.put("useYn", "Y");
        row.put("tags", new ArrayList<>(Collections.singletonList("emission-management")));
        row.put("status", "DRAFT");
        return row;
    }

    private List<Map<String, String>> buildCodeOptions(boolean isEn, Map<String, String>... items) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.addAll(Arrays.asList(items));
        for (Map<String, String> row : rows) {
            row.put("label", isEn ? row.get("labelEn") : row.get("label"));
        }
        return rows;
    }

    private Map<String, String> option(String code, String label, String labelEn) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("code", code);
        row.put("label", label);
        row.put("labelEn", labelEn);
        return row;
    }

    private Map<String, String> summaryCard(String title, String value, String description) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("title", title);
        row.put("value", value);
        row.put("description", description);
        return row;
    }

    private Map<String, Object> buildFormulaReferencePayload(boolean isEn) {
        Path referencePath = Paths.get("docs", "reference", "emission-management", "ktl-cement-lime-formula-reference-20260401.md");
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("available", Files.exists(referencePath));
        payload.put("sourcePath", "/opt/reference/수식 설계/KTL_시멘트_석회_변수 정리_v2 (1).hwpx");
        payload.put("extractedPath", referencePath.toString().replace('\\', '/'));
        payload.put("title", isEn ? "Built-in formula reference text" : "내장 수식 레퍼런스 텍스트");
        payload.put("description", isEn
                ? "Human-reviewed text extracted from the HWPX body and image tables."
                : "HWPX 본문과 이미지 표를 사람이 판독해 정리한 텍스트입니다.");
        payload.put("text", Files.exists(referencePath) ? safeReadText(referencePath) : "");
        return payload;
    }

    private Map<String, Map<String, Object>> loadAll() {
        if (!Files.exists(registryPath)) {
            return new LinkedHashMap<>();
        }
        try (InputStream inputStream = Files.newInputStream(registryPath)) {
            Map<String, Map<String, Object>> result = objectMapper.readValue(inputStream, new TypeReference<LinkedHashMap<String, Map<String, Object>>>() {});
            return result == null ? new LinkedHashMap<>() : new LinkedHashMap<>(result);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read emission management element registry.", e);
        }
    }

    private void saveAll(Map<String, Map<String, Object>> entries) {
        try {
            Files.createDirectories(registryPath.getParent());
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(registryPath.toFile(), entries == null ? Collections.emptyMap() : entries);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to write emission management element registry.", e);
        }
    }

    private String normalizeCode(String value) {
        return safe(value).replace(' ', '_').toUpperCase(Locale.ROOT);
    }

    private String safeReadText(Path path) {
        try {
            return Files.readString(path);
        } catch (IOException e) {
            return "";
        }
    }

    private List<String> normalizeTags(List<String> values) {
        List<String> rows = new ArrayList<>();
        for (String value : values == null ? Collections.<String>emptyList() : values) {
            String normalized = safe(value);
            if (!normalized.isEmpty() && !rows.contains(normalized)) {
                rows.add(normalized);
            }
        }
        return rows;
    }

    private void attachPolicyMetadata(List<Map<String, Object>> rows) {
        for (Map<String, Object> row : rows) {
            String definitionId = safe(row.get("definitionId"));
            if ("EMISSION_MGMT_TIER_GUIDE".equals(definitionId)) {
                row.put("variableScope", "tier guide / per-tier variable overview");
                row.put("policyNote", "Tier별로 어떤 값이 직접 입력 필수인지, 어떤 값이 대체 허용인지 요약합니다.");
                row.put("directRequiredCodes", normalizeTags(Arrays.asList("MCI", "CCLI", "MCL", "MLI", "MI", "FI")));
                row.put("fallbackCodes", normalizeTags(Arrays.asList("EFCLC", "EFC", "EFCL", "CFCKD", "EFD", "LIME_TYPE")));
                row.put("autoCalculatedCodes", normalizeTags(Arrays.asList("EFI", "EFK")));
            } else if ("EMISSION_MGMT_VARIABLE_CATALOG".equals(definitionId)) {
                row.put("variableScope", "visibleVariables / selected tier variable policies");
                row.put("policyNote", "변수별 직접 입력 필수, 대체값 정의, 자동 계산 정책을 읽는 카탈로그입니다.");
                row.put("directRequiredCodes", normalizeTags(Arrays.asList("MCI", "CCLI", "IM", "EX", "MCL", "MLI", "MI", "FI", "MD", "CD", "FD", "MK", "XK")));
                row.put("fallbackCodes", normalizeTags(Arrays.asList("EFCLC", "EFC", "EFCL", "CFCKD", "EFD", "LIME_TYPE", "CAO_CONTENT", "CAO_MGO_CONTENT", "HYDRATED_LIME_PRODUCTION_YN", "X", "Y")));
                row.put("autoCalculatedCodes", normalizeTags(Arrays.asList("EFI", "EFK")));
            } else if ("EMISSION_MGMT_FACTOR_REFERENCE".equals(definitionId)) {
                row.put("variableScope", "stored coefficients / documented defaults");
                row.put("policyNote", "저장 계수와 문서 기본값 후보를 확인하는 참조 요소입니다.");
                row.put("fallbackCodes", normalizeTags(Arrays.asList("EFCLC", "EFC", "EFCL", "CFCKD", "EF_LIME", "SR_CAO", "SR_CAO_MGO", "CF_LKD", "HYDRATED_LIME_CORRECTION_DEFAULT", "EFD")));
            } else if ("EMISSION_MGMT_INPUT_WORKSPACE".equals(definitionId)) {
                row.put("variableScope", "all editable variables in current session");
                row.put("policyNote", "직접 입력 필수값은 반드시 채우고, 대체값 정의 항목은 비워둘 수 있습니다.");
                row.put("directRequiredCodes", normalizeTags(Arrays.asList("MCI", "CCLI", "IM", "EX", "MCL", "MLI", "MI", "FI", "MD", "CD", "FD", "MK", "XK")));
                row.put("fallbackCodes", normalizeTags(Arrays.asList("EFCLC", "EFC", "EFCL", "CFCKD", "EFD", "LIME_TYPE", "CAO_CONTENT", "CAO_MGO_CONTENT", "HYDRATED_LIME_PRODUCTION_YN", "X", "Y")));
                row.put("autoCalculatedCodes", normalizeTags(Arrays.asList("EFI", "EFK")));
            } else if ("EMISSION_MGMT_FORMULA_FLOW".equals(definitionId)) {
                row.put("variableScope", "formula tokens / section mapping");
                row.put("policyNote", "자동 계산 항과 직접 입력 항의 연결 구조를 보여줍니다.");
                row.put("fallbackCodes", normalizeTags(Arrays.asList("EFD")));
                row.put("autoCalculatedCodes", normalizeTags(Arrays.asList("EFI", "EFK")));
            } else if ("EMISSION_MGMT_ACTION_BAR".equals(definitionId)) {
                row.put("variableScope", "save / calculate action guard");
                row.put("policyNote", "직접 입력 필수값 누락 시 저장과 계산을 차단합니다.");
                row.put("directRequiredCodes", normalizeTags(Arrays.asList("validationIssues")));
            } else if ("EMISSION_MGMT_CALC_LOG".equals(definitionId) || "EMISSION_MGMT_APPLIED_FACTORS".equals(definitionId)) {
                row.put("variableScope", "resolved factors / calculation trace");
                row.put("policyNote", "fallback, 저장계수, 유도식 적용 여부를 결과에서 추적합니다.");
                row.put("fallbackCodes", normalizeTags(Arrays.asList("EFCLC", "EFC", "EFCL", "CFCKD", "EFD", "EF_LIME", "SR_CAO", "SR_CAO_MGO", "CF_LKD")));
                row.put("autoCalculatedCodes", normalizeTags(Arrays.asList("EFI", "EFK")));
            } else if ("EMISSION_MGMT_VALIDATION_NOTICE".equals(definitionId)) {
                row.put("variableScope", "validation issues");
                row.put("policyNote", "직접 입력 필수값 누락과 반복행 정렬 오류를 안내합니다.");
                row.put("directRequiredCodes", normalizeTags(Arrays.asList("validationIssues")));
            }
        }
    }

    private int countList(Object value) {
        if (!(value instanceof List)) {
            return 0;
        }
        return ((List<?>) value).size();
    }

    private String firstNonBlank(String first, String fallback) {
        return safe(first).isEmpty() ? safe(fallback) : safe(first);
    }

    private String safe(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}
