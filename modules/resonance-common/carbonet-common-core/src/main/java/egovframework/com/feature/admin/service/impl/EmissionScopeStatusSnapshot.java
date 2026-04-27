package egovframework.com.feature.admin.service.impl;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

final class EmissionScopeStatusSnapshot {
    String categoryCode = "";
    int tier;
    String scope = "";
    String draftId = "";
    String publishedVersionId = "";
    String lifecycleStatus = "";
    String promotionStatus = "";
    String runtimeMode = "";
    boolean published;
    boolean materialized;
    boolean materializable;
    boolean runtimeSupported;
    boolean primaryActive;
    String displayStatusLabel = "";
    String displayStatusDescription = "";
    String lastPublishedAt = "";
    String lastMaterializedAt = "";
    String lastMaterializedBy = "";
    String lastVerifiedAt = "";
    String lastRuntimeTransitionAt = "";
    String lastRuntimeTransitionBy = "";
    String lastRuntimePromotionStatus = "";
    String lastRuntimePromotionMessage = "";
    String lastRuntimeMode = "";
    final List<Map<String, Object>> activityFeed = new ArrayList<>();
    final List<EmissionScopeBlockingReason> blockingReasons = new ArrayList<>();
    final List<String> warnings = new ArrayList<>();
}
