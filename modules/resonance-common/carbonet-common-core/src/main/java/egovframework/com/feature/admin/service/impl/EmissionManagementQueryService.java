package egovframework.com.feature.admin.service.impl;

import egovframework.com.feature.admin.mapper.AdminEmissionManagementMapper;
import egovframework.com.feature.admin.model.vo.EmissionCategoryVO;
import egovframework.com.feature.admin.model.vo.EmissionFactorVO;
import egovframework.com.feature.admin.model.vo.EmissionVariableDefinitionVO;
import egovframework.com.feature.admin.service.AdminEmissionDefinitionStudioService;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import static egovframework.com.feature.admin.service.impl.EmissionManagementValueSupport.buildTierItems;
import static egovframework.com.feature.admin.service.impl.EmissionManagementValueSupport.buildUnsupportedTierItems;
import static egovframework.com.feature.admin.service.impl.EmissionManagementValueSupport.safe;

final class EmissionManagementQueryService {
    private final AdminEmissionManagementMapper adminEmissionManagementMapper;
    private final EmissionCalculationDefinitionRegistry calculationDefinitionRegistry;
    private final EmissionVariableDefinitionAssembler variableDefinitionAssembler;
    private final EmissionManagementValidationSupport validationSupport;
    private final EmissionCalculationResultTransformer resultTransformer;
    private final EmissionCategoryTierDataProvider categoryTierDataProvider;
    private final EmissionCategoryMetadataProvider categoryMetadataProvider;
    private final AdminEmissionDefinitionStudioService definitionStudioService;

    EmissionManagementQueryService(AdminEmissionManagementMapper adminEmissionManagementMapper,
                                   EmissionCalculationDefinitionRegistry calculationDefinitionRegistry,
                                   EmissionVariableDefinitionAssembler variableDefinitionAssembler,
                                   EmissionManagementValidationSupport validationSupport,
                                   EmissionCalculationResultTransformer resultTransformer,
                                   EmissionCategoryTierDataProvider categoryTierDataProvider,
                                   EmissionCategoryMetadataProvider categoryMetadataProvider,
                                   AdminEmissionDefinitionStudioService definitionStudioService) {
        this.adminEmissionManagementMapper = adminEmissionManagementMapper;
        this.calculationDefinitionRegistry = calculationDefinitionRegistry;
        this.variableDefinitionAssembler = variableDefinitionAssembler;
        this.validationSupport = validationSupport;
        this.resultTransformer = resultTransformer;
        this.categoryTierDataProvider = categoryTierDataProvider;
        this.categoryMetadataProvider = categoryMetadataProvider;
        this.definitionStudioService = definitionStudioService;
    }

    List<EmissionCategoryVO> getCategoryList(String searchKeyword) {
        return adminEmissionManagementMapper.selectEmissionCategories(safe(searchKeyword));
    }

    EmissionTierListExecution getTierList(Long categoryId) {
        EmissionCategoryVO category = validationSupport.requireCategory(categoryId);
        List<Integer> supportedTiers = new ArrayList<>();
        List<Integer> unsupportedTiers = new ArrayList<>();
        for (Integer tier : adminEmissionManagementMapper.selectEmissionTierList(categoryId)) {
            if (validationSupport.hasRuntimeSupport(category, tier)) {
                supportedTiers.add(tier);
            } else {
                unsupportedTiers.add(tier);
            }
        }
        return new EmissionTierListExecution(
                category,
                buildTierItems(supportedTiers),
                buildUnsupportedTierItems(unsupportedTiers, "Missing calculation definition")
        );
    }

    EmissionVariableDefinitionsExecution getVariableDefinitions(Long categoryId, Integer tier) {
        EmissionCategoryVO category = validationSupport.requireCategory(categoryId);
        int normalizedTier = validationSupport.requireTier(category, tier);
        Map<String, Object> publishedDefinition = definitionStudioService.findPublishedDefinitionRaw(category.getSubCode(), normalizedTier);
        CalculationDefinition definition = resolveCalculationDefinition(category, normalizedTier, publishedDefinition);
        List<EmissionVariableDefinitionVO> variables = variableDefinitionAssembler.enrich(
                category,
                normalizedTier,
                categoryTierDataProvider.loadVariableDefinitions(categoryId, normalizedTier),
                definition
        );
        variables = variableDefinitionAssembler.applyDefinitionOverrides(variables, publishedDefinition, categoryId, normalizedTier);
        List<EmissionFactorVO> factors = categoryTierDataProvider.loadFactors(categoryId, normalizedTier);
        return new EmissionVariableDefinitionsExecution(category, normalizedTier, variables, factors, definition, publishedDefinition);
    }

    EmissionInputSessionExecution getInputSession(Long sessionId) {
        Map<String, Object> session = validationSupport.requireSession(sessionId);
        return new EmissionInputSessionExecution(
                session,
                adminEmissionManagementMapper.selectEmissionInputValues(sessionId),
                resultTransformer.enrichStoredResult(adminEmissionManagementMapper.selectLatestEmissionCalcResult(sessionId))
        );
    }

    Map<String, Object> getLimeDefaultFactor() {
        return categoryMetadataProvider.limeDefaultFactor();
    }

    List<Map<String, Object>> getLatestCalculationRolloutRows() {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map<String, Object> stored : adminEmissionManagementMapper.selectLatestEmissionCalcResultsByScope()) {
            Map<String, Object> enriched = resultTransformer.enrichStoredResult(new LinkedHashMap<>(stored));
            Map<String, Object> comparison = asMap(enriched.get("definitionFormulaComparison"));
            Map<String, Object> preview = asMap(enriched.get("definitionFormulaPreview"));
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("categoryId", enriched.get("categoryId"));
            row.put("categoryCode", enriched.get("categoryCode"));
            row.put("categoryName", enriched.get("categoryName"));
            row.put("tier", enriched.get("tier"));
            row.put("tierLabel", "Tier " + EmissionManagementValueSupport.intValue(enriched.get("tier")));
            row.put("resultId", enriched.get("resultId"));
            row.put("sessionId", enriched.get("sessionId"));
            row.put("createdAt", enriched.get("createdAt"));
            row.put("co2Total", enriched.get("co2Total"));
            row.put("formulaSummary", enriched.get("formulaSummary"));
            row.put("definitionFormulaAdopted", enriched.get("definitionFormulaAdopted"));
            row.put("draftId", preview.get("draftId"));
            row.put("unresolvedCount", preview.getOrDefault("unresolvedCount", 0));
            row.put("traceCount", preview.getOrDefault("traceCount", 0));
            row.put("promotionStatus", comparison.isEmpty() ? "LEGACY_ONLY" : comparison.get("promotionStatus"));
            row.put("promotionMessage", comparison.isEmpty()
                    ? "No definition formula comparison has been calculated for this scope yet."
                    : comparison.get("promotionMessage"));
            row.put("matched", comparison.getOrDefault("matched", false));
            row.put("legacyTotal", comparison.getOrDefault("legacyTotal", enriched.get("co2Total")));
            row.put("definitionTotal", comparison.get("definitionTotal"));
            row.put("delta", comparison.getOrDefault("delta", 0));
            rows.add(row);
        }
        return rows;
    }

    List<Map<String, Object>> getPublishedDefinitionScopeRows() {
        List<Map<String, Object>> rows = new ArrayList<>();
        Map<String, EmissionCategoryVO> categoryByCode = new LinkedHashMap<>();
        for (EmissionCategoryVO category : adminEmissionManagementMapper.selectEmissionCategories("")) {
            String categoryCode = safe(category == null ? null : category.getSubCode()).toUpperCase(Locale.ROOT);
            if (!categoryCode.isEmpty()) {
                categoryByCode.put(categoryCode, category);
            }
        }

        Set<String> seenScopes = new LinkedHashSet<>();
        for (Map<String, Object> definition : definitionStudioService.buildPublishedDefinitionRows(false)) {
            String categoryCode = safe(definition == null ? null : String.valueOf(definition.get("categoryCode"))).toUpperCase(Locale.ROOT);
            int tier = parseTierLabel(definition == null ? null : definition.get("tierLabel"));
            if (categoryCode.isEmpty() || tier <= 0) {
                continue;
            }
            String scopeKey = categoryCode + ":" + tier;
            if (!seenScopes.add(scopeKey)) {
                continue;
            }

            EmissionCategoryVO category = categoryByCode.get(categoryCode);
            boolean dbCategoryPresent = category != null;
            boolean dbTierPresent = dbCategoryPresent
                    && adminEmissionManagementMapper.selectEmissionTierList(category.getCategoryId()).contains(tier);
            boolean runtimeSupported = dbTierPresent && validationSupport.hasRuntimeSupport(category, tier);

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("draftId", definition.get("draftId"));
            row.put("publishedVersionId", definition.get("publishedVersionId"));
            row.put("publishedSavedAt", definition.get("publishedSavedAt"));
            row.put("categoryId", category == null ? null : category.getCategoryId());
            row.put("categoryCode", categoryCode);
            row.put("categoryName", firstNonBlank(
                    category == null ? null : category.getSubName(),
                    definition == null ? null : String.valueOf(definition.get("categoryName"))));
            row.put("tier", tier);
            row.put("tierLabel", "Tier " + tier);
            row.put("runtimeMode", definition == null ? null : definition.get("runtimeMode"));
            row.put("dbCategoryPresent", dbCategoryPresent);
            row.put("dbTierPresent", dbTierPresent);
            row.put("runtimeSupported", runtimeSupported);

            String status;
            String statusMessage;
            if (runtimeSupported) {
                status = "READY";
                statusMessage = calculationDefinitionRegistry.supports(category, tier)
                        ? "Published definition can already be inspected from emission management."
                        : "Published definition is ready for definition-backed runtime calculation.";
            } else if (!dbCategoryPresent) {
                status = "STUDIO_ONLY_CATEGORY";
                statusMessage = "Definition is published in studio, but the management category does not exist in DB metadata yet.";
            } else if (!dbTierPresent) {
                status = "STUDIO_ONLY_TIER";
                statusMessage = "Definition is published in studio, but the management tier does not exist in DB metadata yet.";
            } else {
                status = "MISSING_CALCULATION";
                statusMessage = "DB metadata exists, but no runtime calculation definition is registered for this scope yet.";
            }
            row.put("status", status);
            row.put("statusMessage", statusMessage);
            rows.add(row);
        }
        return rows;
    }

    private CalculationDefinition resolveCalculationDefinition(EmissionCategoryVO category,
                                                               int tier,
                                                               Map<String, Object> publishedDefinition) {
        if (calculationDefinitionRegistry.supports(category, tier)) {
            return calculationDefinitionRegistry.require(category, tier);
        }
        return definitionBackedDefinition(category, tier, publishedDefinition);
    }

    private CalculationDefinition definitionBackedDefinition(EmissionCategoryVO category,
                                                             int tier,
                                                             Map<String, Object> publishedDefinition) {
        String formula = safe(publishedDefinition == null ? null : String.valueOf(publishedDefinition.get("formula")));
        return new CalculationDefinition(
                safe(category == null ? null : category.getSubCode()),
                tier,
                formula,
                formula,
                VariableUiDefinition.empty(),
                context -> {
                    throw new IllegalStateException("Definition-backed scope does not use a built-in executor.");
                }
        );
    }

    private int parseTierLabel(Object tierLabel) {
        String raw = safe(tierLabel == null ? null : String.valueOf(tierLabel)).toUpperCase(Locale.ROOT);
        if (raw.isEmpty()) {
            return 0;
        }
        String digits = raw.replaceAll("[^0-9]", "");
        if (digits.isEmpty()) {
            return 0;
        }
        try {
            return Integer.parseInt(digits);
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private String firstNonBlank(String left, String right) {
        return safe(left).isEmpty() ? safe(right) : safe(left);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object value) {
        if (value instanceof Map<?, ?>) {
            return new LinkedHashMap<>((Map<String, Object>) value);
        }
        return new LinkedHashMap<>();
    }
}
