package egovframework.com.feature.admin.service.impl;

import egovframework.com.feature.admin.mapper.AdminEmissionManagementMapper;
import egovframework.com.feature.admin.model.vo.EmissionCategoryVO;
import egovframework.com.feature.admin.service.AdminEmissionDefinitionStudioService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
class EmissionDefinitionMaterializationService {

    private final AdminEmissionManagementMapper adminEmissionManagementMapper;
    private final AdminEmissionDefinitionStudioService definitionStudioService;
    private final EmissionMaterializationHistoryService materializationHistoryService;

    EmissionDefinitionMaterializationService(AdminEmissionManagementMapper adminEmissionManagementMapper,
                                             AdminEmissionDefinitionStudioService definitionStudioService,
                                             EmissionMaterializationHistoryService materializationHistoryService) {
        this.adminEmissionManagementMapper = adminEmissionManagementMapper;
        this.definitionStudioService = definitionStudioService;
        this.materializationHistoryService = materializationHistoryService;
    }

    Map<String, Object> materialize(String draftId, String actorId, boolean isEn) {
        Map<String, Object> draft = definitionStudioService.findPublishedDefinitionByDraftIdRaw(draftId);
        if (draft.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Published definition draft not found." : "publish 된 정의 초안을 찾을 수 없습니다.");
        }

        String categoryCode = safe(draft.get("categoryCode")).toUpperCase(Locale.ROOT);
        String categoryName = safe(draft.get("categoryName"));
        int tier = parseTier(draft.get("tierLabel"));
        List<Map<String, Object>> variableDefinitions = asMapList(draft.get("variableDefinitions"));

        if (categoryCode.isEmpty() || tier <= 0) {
            throw new IllegalArgumentException(isEn ? "Published definition scope is incomplete." : "publish 정의 범위 정보가 불완전합니다.");
        }
        if (variableDefinitions.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Published definition has no variable definitions to materialize." : "publish 정의에 materialize 할 변수 정의가 없습니다.");
        }

        EmissionCategoryVO category = adminEmissionManagementMapper.selectEmissionCategoryBySubCode(categoryCode);
        boolean createdCategory = false;
        if (category == null) {
            Map<String, Object> categoryParams = new LinkedHashMap<>();
            categoryParams.put("majorCode", "STUDIO");
            categoryParams.put("majorName", isEn ? "Definition Studio" : "정의 스튜디오");
            categoryParams.put("subCode", categoryCode);
            categoryParams.put("subName", categoryName.isEmpty() ? categoryCode : categoryName);
            categoryParams.put("useYn", "Y");
            adminEmissionManagementMapper.insertEmissionCategory(categoryParams);
            category = adminEmissionManagementMapper.selectEmissionCategory(longValue(categoryParams.get("categoryId")));
            createdCategory = true;
        }
        if (category == null || category.getCategoryId() == null) {
            throw new IllegalStateException(isEn ? "Failed to resolve the materialized category." : "materialize 된 카테고리를 확인하지 못했습니다.");
        }

        int insertedVariableCount = 0;
        int updatedVariableCount = 0;
        List<String> skippedFields = new ArrayList<>();
        skippedFields.add("commonCodeId");
        skippedFields.add("options");
        skippedFields.add("visibleWhen");
        skippedFields.add("disabledWhen");
        skippedFields.add("sectionPreviewType");
        skippedFields.add("sectionRelatedFactorCodes");

        for (int index = 0; index < variableDefinitions.size(); index += 1) {
            Map<String, Object> variable = variableDefinitions.get(index);
            String varCode = safe(variable.get("varCode")).toUpperCase(Locale.ROOT);
            if (varCode.isEmpty()) {
                continue;
            }
            Map<String, Object> params = new LinkedHashMap<>();
            params.put("categoryId", category.getCategoryId());
            params.put("tier", tier);
            params.put("varCode", varCode);
            params.put("varName", firstNonBlank(safe(variable.get("varName")), varCode));
            params.put("varDesc", nullable(variable.get("varDesc")));
            params.put("unit", nullable(variable.get("unit")));
            params.put("inputType", firstNonBlank(safe(variable.get("inputType")).toUpperCase(Locale.ROOT), "TEXT"));
            params.put("sourceType", firstNonBlank(safe(variable.get("sourceType")).toUpperCase(Locale.ROOT), "USER"));
            params.put("repeatable", yesNo(variable.get("isRepeatable"), "N"));
            params.put("required", yesNo(variable.get("isRequired"), "N"));
            params.put("sortOrder", intValue(variable.get("sortOrder"), (index + 1) * 10));
            params.put("displayName", nullable(variable.get("displayName")));
            params.put("displayCode", nullable(variable.get("displayCode")));
            params.put("uiHint", nullable(variable.get("uiHint")));
            params.put("derivedYn", yesNo(variable.get("derivedYn"), "N"));
            params.put("supplementalYn", yesNo(variable.get("supplementalYn"), "N"));
            params.put("repeatGroupKey", nullable(variable.get("repeatGroupKey")));
            params.put("sectionId", nullable(variable.get("sectionId")));
            params.put("sectionTitle", nullable(variable.get("sectionTitle")));
            params.put("sectionDescription", nullable(variable.get("sectionDescription")));
            params.put("sectionFormula", nullable(variable.get("sectionFormula")));
            params.put("useYn", "Y");

            Map<String, Object> existing = adminEmissionManagementMapper.selectEmissionVariableDefinition(params);
            if (existing == null || existing.isEmpty()) {
                adminEmissionManagementMapper.insertEmissionVariableDefinition(params);
                insertedVariableCount += 1;
            } else {
                adminEmissionManagementMapper.updateEmissionVariableDefinition(params);
                updatedVariableCount += 1;
            }
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("draftId", draftId);
        response.put("categoryId", category.getCategoryId());
        response.put("categoryCode", categoryCode);
        response.put("tier", tier);
        response.put("createdCategory", createdCategory);
        response.put("insertedVariableCount", insertedVariableCount);
        response.put("updatedVariableCount", updatedVariableCount);
        response.put("skippedFields", skippedFields);
        response.put("actorId", safe(actorId));
        materializationHistoryService.record(
                categoryCode,
                tier,
                draftId,
                safe(draft.get("publishedVersionId")),
                safe(actorId),
                createdCategory,
                insertedVariableCount,
                updatedVariableCount
        );
        response.put("message", isEn
                ? "Published definition metadata was materialized into emission management."
                : "publish 정의 메타데이터를 emission management DB에 반영했습니다.");
        return response;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> asMapList(Object value) {
        if (!(value instanceof List<?>)) {
            return new ArrayList<>();
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Object item : (List<Object>) value) {
            if (item instanceof Map<?, ?>) {
                rows.add(new LinkedHashMap<>((Map<String, Object>) item));
            }
        }
        return rows;
    }

    private int parseTier(Object tierLabel) {
        String digits = safe(tierLabel).replaceAll("[^0-9]", "");
        if (digits.isEmpty()) {
            return 0;
        }
        try {
            return Integer.parseInt(digits);
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private int intValue(Object value, int fallback) {
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        try {
            return Integer.parseInt(safe(value));
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private Long longValue(Object value) {
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        try {
            return Long.parseLong(safe(value));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private String yesNo(Object value, String fallback) {
        String normalized = safe(value).toUpperCase(Locale.ROOT);
        if ("Y".equals(normalized) || "N".equals(normalized)) {
            return normalized;
        }
        return fallback;
    }

    private String firstNonBlank(String left, String right) {
        return safe(left).isEmpty() ? safe(right) : safe(left);
    }

    private String nullable(Object value) {
        String normalized = safe(value);
        return normalized.isEmpty() ? null : normalized;
    }

    private String safe(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}
