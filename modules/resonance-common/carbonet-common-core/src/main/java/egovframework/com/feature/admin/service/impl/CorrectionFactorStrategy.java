package egovframework.com.feature.admin.service.impl;

import java.util.Locale;
import java.util.Map;

final class CorrectionFactorStrategy {
    private final double limeCfLkdDefault;
    private final double hydratedLimeCorrectionDefault;

    CorrectionFactorStrategy(double limeCfLkdDefault,
                             double hydratedLimeCorrectionDefault) {
        this.limeCfLkdDefault = limeCfLkdDefault;
        this.hydratedLimeCorrectionDefault = hydratedLimeCorrectionDefault;
    }

    ResolvedFactor resolveLimeTier2CkdFactor(double md,
                                             double cd,
                                             double fd,
                                             double mass,
                                             Map<String, Double> factorValues) {
        if (md > 0d && cd > 0d && fd > 0d && mass > 0d) {
            return ResolvedFactor.derived(1d + (md / mass) * cd * fd);
        }
        if (factorValues.containsKey("CF_LKD")) {
            return ResolvedFactor.combined(factorValues.get("CF_LKD"), true, FactorSource.STORED);
        }
        return ResolvedFactor.combined(limeCfLkdDefault, true, FactorSource.FALLBACK);
    }

    ResolvedFactor resolveLimeTier2HydrationCorrection(String hydratedProductionRaw,
                                                       double hydrateRatio,
                                                       double moistureContent,
                                                       Map<String, Double> factorValues) {
        String hydratedProduction = safe(hydratedProductionRaw).toUpperCase(Locale.ROOT);
        if ("N".equals(hydratedProduction)) {
            return ResolvedFactor.calculated(1d);
        }
        if ("Y".equals(hydratedProduction)) {
            if (hydrateRatio > 0d && moistureContent > 0d) {
                return ResolvedFactor.calculated(1d - (hydrateRatio * moistureContent));
            }
            if (factorValues.containsKey("HYDRATED_LIME_CORRECTION_DEFAULT")) {
                return ResolvedFactor.combined(factorValues.get("HYDRATED_LIME_CORRECTION_DEFAULT"), true, FactorSource.STORED);
            }
            return ResolvedFactor.combined(hydratedLimeCorrectionDefault, true, FactorSource.FALLBACK);
        }
        if (hydrateRatio > 0d && moistureContent > 0d) {
            return ResolvedFactor.calculated(1d - (hydrateRatio * moistureContent));
        }
        return ResolvedFactor.calculated(1d);
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
