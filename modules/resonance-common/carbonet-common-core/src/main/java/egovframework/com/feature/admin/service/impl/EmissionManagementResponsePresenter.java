package egovframework.com.feature.admin.service.impl;

import egovframework.com.feature.admin.model.vo.EmissionCategoryVO;
import egovframework.com.feature.admin.model.vo.EmissionFactorVO;
import egovframework.com.feature.admin.model.vo.EmissionVariableDefinitionVO;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

final class EmissionManagementResponsePresenter {
    Map<String, Object> categoryList(List<EmissionCategoryVO> items) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("items", items);
        return response;
    }

    Map<String, Object> tierList(EmissionCategoryVO category,
                                 List<Map<String, Object>> tiers,
                                 List<Map<String, Object>> unsupportedTiers) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("category", category);
        response.put("tiers", tiers);
        response.put("unsupportedTiers", unsupportedTiers);
        if (unsupportedTiers != null && !unsupportedTiers.isEmpty()) {
            response.put("warning", "Some metadata tiers were excluded because neither a built-in calculator nor a published definition runtime is available yet.");
        }
        return response;
    }

    Map<String, Object> variableDefinitions(EmissionCategoryVO category,
                                            int tier,
                                            List<EmissionVariableDefinitionVO> variables,
                                            List<EmissionFactorVO> factors,
                                            CalculationDefinition definition,
                                            Map<String, Object> publishedDefinition) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("category", category);
        response.put("tier", tier);
        response.put("variables", variables);
        response.put("factors", factors);
        String publishedFormula = EmissionManagementValueSupport.safe(EmissionManagementValueSupport.stringValue(publishedDefinition == null ? null : publishedDefinition.get("formula")));
        boolean builtInRuntime = definition != null
                && !EmissionManagementValueSupport.safe(definition.formulaDisplay).equals(publishedFormula);
        response.put("formulaSummary", builtInRuntime || publishedFormula.isEmpty() ? definition.formulaSummary : publishedFormula);
        response.put("formulaDisplay", builtInRuntime || publishedFormula.isEmpty() ? definition.formulaDisplay : publishedFormula);
        response.put("publishedDefinition", publishedDefinition == null ? new LinkedHashMap<>() : publishedDefinition);
        response.put("publishedDefinitionApplied", !publishedFormula.isEmpty());
        return response;
    }

    Map<String, Object> saveInputSession(boolean success,
                                         Long sessionId,
                                         EmissionCategoryVO category,
                                         int tier,
                                         int savedCount) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", success);
        response.put("sessionId", sessionId);
        response.put("category", category);
        response.put("tier", tier);
        response.put("savedCount", savedCount);
        return response;
    }

    Map<String, Object> inputSession(Map<String, Object> session,
                                     List<Map<String, Object>> values,
                                     Map<String, Object> result) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("session", session);
        response.put("values", values);
        response.put("result", result);
        return response;
    }

    Map<String, Object> calculationResult(Long sessionId,
                                          EmissionCategoryVO category,
                                          Integer tier,
                                          CalculationResult result,
                                          Long resultId) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("sessionId", sessionId);
        response.put("category", category);
        response.put("tier", tier);
        response.put("co2Total", result.total);
        response.put("unit", "tCO2");
        response.put("formulaSummary", result.formulaSummary);
        response.put("formulaDisplay", result.formulaDisplay);
        response.put("substitutedFormula", result.substitutedFormula);
        response.put("appliedFactors", result.appliedFactors);
        response.put("calculationLogs", result.calculationLogs);
        response.put("defaultApplied", result.defaultApplied);
        response.put("definitionFormulaPreview", result.definitionFormulaPreview);
        response.put("definitionFormulaComparison", result.definitionFormulaComparison);
        response.put("definitionFormulaAdopted", result.definitionFormulaAdopted);
        response.put("calculationSource", result.calculationSource);
        response.put("legacyFormulaDisplay", result.legacyFormulaDisplay);
        response.put("legacySubstitutedFormula", result.legacySubstitutedFormula);
        response.put("legacyCalculationLogs", result.legacyCalculationLogs);
        response.put("resultId", resultId);
        return response;
    }

    Map<String, Object> rolloutStatusSummary(List<Map<String, Object>> rows) {
        int readyCount = 0;
        int blockedCount = 0;
        int shadowCount = 0;
        int legacyOnlyCount = 0;
        for (Map<String, Object> row : rows) {
            String status = EmissionManagementValueSupport.safe(row == null ? null : String.valueOf(row.get("promotionStatus")));
            if ("READY".equals(status) || "PRIMARY_READY".equals(status)) {
                readyCount += 1;
            } else if ("BLOCKED".equals(status)) {
                blockedCount += 1;
            } else if ("SHADOW_ONLY".equals(status) || "PRIMARY_WITH_DRIFT".equals(status)) {
                shadowCount += 1;
            } else {
                legacyOnlyCount += 1;
            }
        }
        List<Map<String, String>> summaryCards = new java.util.ArrayList<>();
        summaryCards.add(summaryCard("Ready", String.valueOf(readyCount), "Legacy and definition totals match, so runtime can adopt the definition result."));
        summaryCards.add(summaryCard("Blocked", String.valueOf(blockedCount), "Definition preview still has unresolved tokens or invalid arithmetic."));
        summaryCards.add(summaryCard("Shadow", String.valueOf(shadowCount), "Definition formula evaluates, but the result still differs from the legacy calculator."));
        summaryCards.add(summaryCard("Legacy only", String.valueOf(legacyOnlyCount), "No server-side comparison result has been recorded yet for this scope."));
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("rolloutSummaryCards", summaryCards);
        response.put("rolloutStatusRows", rows);
        return response;
    }

    Map<String, Object> definitionScopeSummary(List<Map<String, Object>> rows) {
        int readyCount = 0;
        int studioOnlyCount = 0;
        int missingCalculationCount = 0;
        for (Map<String, Object> row : rows) {
            String status = EmissionManagementValueSupport.safe(row == null ? null : String.valueOf(row.get("status")));
            if ("READY".equals(status)) {
                readyCount += 1;
            } else if ("MISSING_CALCULATION".equals(status)) {
                missingCalculationCount += 1;
            } else {
                studioOnlyCount += 1;
            }
        }
        List<Map<String, String>> summaryCards = new java.util.ArrayList<>();
        summaryCards.add(summaryCard("Runtime ready", String.valueOf(readyCount), "Published scopes already backed by DB metadata and either built-in or definition-backed runtime support."));
        summaryCards.add(summaryCard("Studio only", String.valueOf(studioOnlyCount), "Published scopes still missing either a management category or a tier row."));
        summaryCards.add(summaryCard("Calc missing", String.valueOf(missingCalculationCount), "Metadata exists, but neither a built-in calculator nor a published definition runtime is available yet."));
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("definitionScopeSummaryCards", summaryCards);
        response.put("definitionScopeRows", rows);
        return response;
    }

    Map<String, Object> scopeStatus(EmissionScopeStatusSnapshot snapshot) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("scope", snapshot.scope);
        response.put("categoryCode", snapshot.categoryCode);
        response.put("tier", snapshot.tier);
        response.put("draftId", snapshot.draftId);
        response.put("publishedVersionId", snapshot.publishedVersionId);
        response.put("lifecycleStatus", snapshot.lifecycleStatus);
        response.put("promotionStatus", snapshot.promotionStatus);
        response.put("runtimeMode", snapshot.runtimeMode);
        response.put("published", snapshot.published);
        response.put("materialized", snapshot.materialized);
        response.put("materializable", snapshot.materializable);
        response.put("runtimeSupported", snapshot.runtimeSupported);
        response.put("primaryActive", snapshot.primaryActive);
        response.put("displayStatusLabel", snapshot.displayStatusLabel);
        response.put("displayStatusDescription", snapshot.displayStatusDescription);
        response.put("blockingReasons", snapshot.blockingReasons.stream()
                .map(this::blockingReason)
                .collect(Collectors.toList()));
        response.put("warnings", snapshot.warnings);
        response.put("lastPublishedAt", snapshot.lastPublishedAt);
        response.put("lastMaterializedAt", snapshot.lastMaterializedAt);
        response.put("lastMaterializedBy", snapshot.lastMaterializedBy);
        response.put("lastVerifiedAt", snapshot.lastVerifiedAt);
        response.put("lastRuntimeTransitionAt", snapshot.lastRuntimeTransitionAt);
        response.put("lastRuntimeTransitionBy", snapshot.lastRuntimeTransitionBy);
        response.put("lastRuntimePromotionStatus", snapshot.lastRuntimePromotionStatus);
        response.put("lastRuntimePromotionMessage", snapshot.lastRuntimePromotionMessage);
        response.put("lastRuntimeMode", snapshot.lastRuntimeMode);
        response.put("activityFeed", snapshot.activityFeed);
        return response;
    }

    private Map<String, Object> blockingReason(EmissionScopeBlockingReason reason) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("code", reason.code);
        item.put("message", reason.message);
        item.put("blocking", reason.blocking);
        return item;
    }

    private Map<String, String> summaryCard(String title, String value, String description) {
        Map<String, String> card = new LinkedHashMap<>();
        card.put("title", title);
        card.put("value", value);
        card.put("description", description);
        return card;
    }
}
