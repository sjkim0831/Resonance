package egovframework.com.feature.admin.service.impl;

import egovframework.com.feature.admin.mapper.AdminEmissionManagementMapper;
import egovframework.com.feature.admin.model.vo.EmissionCategoryVO;
import egovframework.com.feature.admin.service.AdminEmissionDefinitionStudioService;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.ArrayList;
import java.util.Comparator;

@Service
class EmissionScopeStatusService {

    private final AdminEmissionManagementMapper adminEmissionManagementMapper;
    private final AdminEmissionDefinitionStudioService definitionStudioService;
    private final EmissionManagementValidationSupport validationSupport;
    private final EmissionCalculationResultTransformer resultTransformer;
    private final EmissionMaterializationHistoryService materializationHistoryService;
    private final EmissionRuntimeTransitionHistoryService runtimeTransitionHistoryService;

    EmissionScopeStatusService(AdminEmissionManagementMapper adminEmissionManagementMapper,
                               AdminEmissionDefinitionStudioService definitionStudioService,
                               EmissionManagementValidationSupport validationSupport,
                               EmissionCalculationResultTransformer resultTransformer,
                               EmissionMaterializationHistoryService materializationHistoryService,
                               EmissionRuntimeTransitionHistoryService runtimeTransitionHistoryService) {
        this.adminEmissionManagementMapper = adminEmissionManagementMapper;
        this.definitionStudioService = definitionStudioService;
        this.validationSupport = validationSupport;
        this.resultTransformer = resultTransformer;
        this.materializationHistoryService = materializationHistoryService;
        this.runtimeTransitionHistoryService = runtimeTransitionHistoryService;
    }

    EmissionScopeStatusSnapshot getScopeStatus(String categoryCode, int tier, boolean isEn) {
        String normalizedCode = safe(categoryCode).toUpperCase(Locale.ROOT);
        EmissionScopeStatusSnapshot snapshot = new EmissionScopeStatusSnapshot();
        snapshot.categoryCode = normalizedCode;
        snapshot.tier = tier;
        snapshot.scope = normalizedCode + ":" + tier;
        applyMaterializationHistory(snapshot, normalizedCode, tier);
        applyRuntimeTransitionHistory(snapshot, normalizedCode, tier);

        Map<String, Object> published = definitionStudioService.findPublishedDefinitionRaw(normalizedCode, tier);
        snapshot.published = !published.isEmpty();
        snapshot.draftId = safe(published.get("draftId"));
        snapshot.publishedVersionId = safe(published.get("publishedVersionId"));
        snapshot.lastPublishedAt = safe(published.get("publishedSavedAt"));
        snapshot.runtimeMode = safe(published.get("runtimeMode"));
        if (snapshot.runtimeMode.isEmpty()) {
            snapshot.runtimeMode = "AUTO";
        }

        EmissionCategoryVO category = adminEmissionManagementMapper.selectEmissionCategoryBySubCode(normalizedCode);
        boolean categoryPresent = category != null && category.getCategoryId() != null;
        boolean tierPresent = categoryPresent
                && adminEmissionManagementMapper.selectEmissionTierList(category.getCategoryId()).contains(tier);

        Integer variableCount = null;
        if (categoryPresent && tierPresent) {
            Map<String, Object> params = new LinkedHashMap<>();
            params.put("categoryId", category.getCategoryId());
            params.put("tier", tier);
            variableCount = adminEmissionManagementMapper.selectEmissionVariableDefinitionCount(params);
            snapshot.lastMaterializedAt = safe(adminEmissionManagementMapper.selectEmissionVariableDefinitionLastUpdatedAt(params));
        }
        boolean variablePresent = variableCount != null && variableCount > 0;

        snapshot.materialized = categoryPresent && tierPresent && variablePresent;
        snapshot.materializable = snapshot.published;

        if (!snapshot.published) {
            if (snapshot.materialized) {
                snapshot.runtimeSupported = validationSupport.hasRuntimeSupport(category, tier);
                if (!snapshot.runtimeSupported) {
                    snapshot.lifecycleStatus = "RUNTIME_BLOCKED";
                    snapshot.blockingReasons.add(reason("MISSING_RUNTIME_SUPPORT", isEn ? "Runtime calculation support is missing." : "런타임 계산 지원이 없습니다.", true));
                    snapshot.warnings.add(isEn ? "No published definition snapshot exists for this scope yet." : "이 scope에는 아직 publish 된 정의 스냅샷이 없습니다.");
                    applyDisplay(snapshot, isEn ? "Runtime blocked" : "실행 불가");
                    return snapshot;
                }

                snapshot.lifecycleStatus = "MATERIALIZED";
                applyLatestVerification(snapshot, normalizedCode, tier);
                snapshot.primaryActive = "PRIMARY_READY".equals(snapshot.promotionStatus);
                snapshot.warnings.add(isEn ? "Running on management metadata without a published definition snapshot." : "publish 된 정의 스냅샷 없이 management 메타데이터 기준으로 동작 중입니다.");
                applyDisplay(snapshot, displayLabel(snapshot.promotionStatus, isEn));
                return snapshot;
            }

            snapshot.lifecycleStatus = "DRAFT";
            applyDisplay(snapshot, isEn ? "Draft only" : "정의 작성 중");
            return snapshot;
        }

        if (!categoryPresent) {
            snapshot.lifecycleStatus = "MATERIALIZE_BLOCKED";
            snapshot.materializable = false;
            snapshot.blockingReasons.add(reason("MISSING_CATEGORY", isEn ? "Management category does not exist." : "management 카테고리가 없습니다.", true));
            applyDisplay(snapshot, isEn ? "Published only" : "정의 확정");
            return snapshot;
        }

        if (!tierPresent) {
            snapshot.lifecycleStatus = "MATERIALIZE_BLOCKED";
            snapshot.materializable = false;
            snapshot.blockingReasons.add(reason("MISSING_TIER", isEn ? "Management tier does not exist." : "management Tier가 없습니다.", true));
            applyDisplay(snapshot, isEn ? "Published only" : "정의 확정");
            return snapshot;
        }

        if (!variablePresent) {
            snapshot.lifecycleStatus = "MATERIALIZE_BLOCKED";
            snapshot.materializable = false;
            snapshot.blockingReasons.add(reason("MISSING_VARIABLES", isEn ? "Variable metadata is missing." : "변수 메타데이터가 없습니다.", true));
            applyDisplay(snapshot, isEn ? "Materialization blocked" : "메타 반영 불가");
            return snapshot;
        }

        snapshot.runtimeSupported = validationSupport.hasRuntimeSupport(category, tier);
        if (!snapshot.runtimeSupported) {
            snapshot.lifecycleStatus = "RUNTIME_BLOCKED";
            snapshot.blockingReasons.add(reason("MISSING_RUNTIME_SUPPORT", isEn ? "Runtime calculation support is missing." : "런타임 계산 지원이 없습니다.", true));
            applyDisplay(snapshot, isEn ? "Runtime blocked" : "실행 불가");
            return snapshot;
        }

        snapshot.lifecycleStatus = "MATERIALIZED";
        applyLatestVerification(snapshot, normalizedCode, tier);
        snapshot.primaryActive = "PRIMARY_READY".equals(snapshot.promotionStatus);
        buildActivityFeed(snapshot);
        applyDisplay(snapshot, displayLabel(snapshot.promotionStatus, isEn));
        return snapshot;
    }

    private void applyMaterializationHistory(EmissionScopeStatusSnapshot snapshot, String categoryCode, int tier) {
        Map<String, Object> history = materializationHistoryService.findLatest(categoryCode, tier);
        if (history.isEmpty()) {
            return;
        }
        snapshot.lastMaterializedAt = firstNonBlank(safe(history.get("materializedAt")), snapshot.lastMaterializedAt);
        snapshot.lastMaterializedBy = safe(history.get("materializedBy"));
    }

    private void applyRuntimeTransitionHistory(EmissionScopeStatusSnapshot snapshot, String categoryCode, int tier) {
        Map<String, Object> history = runtimeTransitionHistoryService.findLatest(categoryCode, tier);
        if (history.isEmpty()) {
            return;
        }
        snapshot.lastRuntimeTransitionAt = safe(history.get("transitionedAt"));
        snapshot.lastRuntimeTransitionBy = safe(history.get("transitionedBy"));
        snapshot.lastRuntimePromotionStatus = safe(history.get("promotionStatus"));
        snapshot.lastRuntimePromotionMessage = safe(history.get("promotionMessage"));
        snapshot.lastRuntimeMode = safe(history.get("runtimeMode"));
    }

    private void buildActivityFeed(EmissionScopeStatusSnapshot snapshot) {
        snapshot.activityFeed.clear();
        if (!snapshot.lastPublishedAt.isEmpty()) {
            snapshot.activityFeed.add(activityItem(
                    "published",
                    snapshot.lastPublishedAt,
                    "PUBLISHED",
                    snapshot.publishedVersionId,
                    "Published definition snapshot recorded."
            ));
        }
        for (Map<String, Object> item : materializationHistoryService.findRecent(snapshot.categoryCode, snapshot.tier, 5)) {
            snapshot.activityFeed.add(activityItem(
                    "materialized",
                    safe(item.get("materializedAt")),
                    "MATERIALIZED",
                    safe(item.get("materializedBy")),
                    "Metadata materialization recorded."
            ));
        }
        for (Map<String, Object> item : runtimeTransitionHistoryService.findRecent(snapshot.categoryCode, snapshot.tier, 5)) {
            snapshot.activityFeed.add(activityItem(
                    "runtime-transition",
                    safe(item.get("transitionedAt")),
                    safe(item.get("promotionStatus")),
                    safe(item.get("transitionedBy")),
                    firstNonBlank(safe(item.get("promotionMessage")), "Runtime transition snapshot recorded.")
            ));
        }
        if (!snapshot.lastVerifiedAt.isEmpty()) {
            snapshot.activityFeed.add(activityItem(
                    "verified",
                    snapshot.lastVerifiedAt,
                    firstNonBlank(snapshot.promotionStatus, "VERIFIED"),
                    "",
                    "Latest calculation verification recorded."
            ));
        }
        snapshot.activityFeed.sort(Comparator.comparing((Map<String, Object> item) -> safe(item.get("at"))).reversed());
        if (snapshot.activityFeed.size() > 8) {
            List<Map<String, Object>> limited = new ArrayList<>(snapshot.activityFeed.subList(0, 8));
            snapshot.activityFeed.clear();
            snapshot.activityFeed.addAll(limited);
        }
    }

    private Map<String, Object> activityItem(String type, String at, String status, String actor, String message) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("type", type);
        item.put("at", at);
        item.put("status", status);
        item.put("actor", actor);
        item.put("message", message);
        return item;
    }

    EmissionScopeStatusSnapshot precheckPublishedDefinitionScope(String draftId, boolean isEn) {
        Map<String, Object> draft = definitionStudioService.findPublishedDefinitionByDraftIdRaw(draftId);
        if (draft.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Published definition draft not found." : "publish 된 정의 초안을 찾을 수 없습니다.");
        }
        EmissionScopeStatusSnapshot snapshot = getScopeStatus(
                safe(draft.get("categoryCode")),
                parseTier(draft.get("tierLabel")),
                isEn
        );
        Object formulaTree = draft.get("formulaTree");
        if (!(formulaTree instanceof List<?>) || ((List<?>) formulaTree).isEmpty()) {
            snapshot.blockingReasons.add(reason("EMPTY_FORMULA_TREE", isEn ? "Formula tree is empty." : "formulaTree가 비어 있습니다.", true));
            snapshot.materializable = false;
            snapshot.displayStatusDescription = isEn ? "Formula tree is empty." : "formulaTree가 비어 있습니다.";
        }
        return snapshot;
    }

    private void applyLatestVerification(EmissionScopeStatusSnapshot snapshot, String categoryCode, int tier) {
        Map<String, Object> latest = resolveLatestStoredResult(categoryCode, tier);
        if (latest.isEmpty()) {
            snapshot.promotionStatus = "LEGACY_ONLY";
            snapshot.lastVerifiedAt = "";
            return;
        }
        Map<String, Object> enriched = resultTransformer.enrichStoredResult(new LinkedHashMap<>(latest));
        Map<String, Object> comparison = asMap(enriched.get("definitionFormulaComparison"));
        snapshot.promotionStatus = safe(comparison.get("promotionStatus"));
        if (snapshot.promotionStatus.isEmpty()) {
            snapshot.promotionStatus = safe(latest.get("promotionStatus"));
        }
        if (snapshot.promotionStatus.isEmpty()) {
            snapshot.promotionStatus = "LEGACY_ONLY";
        }
        snapshot.lastVerifiedAt = safe(enriched.get("createdAt"));
        if (snapshot.lastVerifiedAt.isEmpty()) {
            snapshot.lastVerifiedAt = safe(latest.get("createdAt"));
        }
    }

    private Map<String, Object> resolveLatestStoredResult(String categoryCode, int tier) {
        String scope = categoryCode + ":" + tier;
        for (Map<String, Object> row : adminEmissionManagementMapper.selectLatestEmissionCalcResultsByScope()) {
            if (safe(row.get("scope")).equalsIgnoreCase(scope)) {
                return row;
            }
            if (safe(row.get("categoryCode")).equalsIgnoreCase(categoryCode)
                    && tier == parseTier(row.get("tier"))) {
                return row;
            }
        }
        return java.util.Collections.emptyMap();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object value) {
        if (value instanceof Map<?, ?>) {
            return (Map<String, Object>) value;
        }
        return java.util.Collections.emptyMap();
    }

    private void applyDisplay(EmissionScopeStatusSnapshot snapshot, String label) {
        snapshot.displayStatusLabel = label;
        snapshot.displayStatusDescription = snapshot.blockingReasons.isEmpty()
                ? label
                : snapshot.blockingReasons.get(0).message;
    }

    private String displayLabel(String promotionStatus, boolean isEn) {
        String normalized = safe(promotionStatus).toUpperCase(Locale.ROOT);
        if ("PRIMARY_READY".equals(normalized)) {
            return isEn ? "Primary active" : "운영 적용 중";
        }
        if ("READY".equals(normalized)) {
            return isEn ? "Ready to switch" : "전환 가능";
        }
        if ("SHADOW_ONLY".equals(normalized)) {
            return isEn ? "Shadow compare" : "비교 검증 중";
        }
        if ("BLOCKED".equals(normalized)) {
            return isEn ? "Blocked" : "실행 불가";
        }
        return isEn ? "Materialized" : "메타 반영 완료";
    }

    private EmissionScopeBlockingReason reason(String code, String message, boolean blocking) {
        return new EmissionScopeBlockingReason(code, message, blocking);
    }

    private String firstNonBlank(String left, String right) {
        return safe(left).isEmpty() ? safe(right) : safe(left);
    }

    private int parseTier(Object value) {
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        String digits = safe(value).replaceAll("[^0-9]", "");
        if (digits.isEmpty()) {
            return 0;
        }
        try {
            return Integer.parseInt(digits);
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private String safe(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}
