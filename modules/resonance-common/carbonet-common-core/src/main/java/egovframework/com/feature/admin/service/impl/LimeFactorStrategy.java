package egovframework.com.feature.admin.service.impl;

import java.util.Locale;
import java.util.Map;

final class LimeFactorStrategy {
    private final double limeDefaultFactor;
    private final double srCaoDefault;
    private final double srCaoMgoDefault;

    LimeFactorStrategy(double limeDefaultFactor,
                       double srCaoDefault,
                       double srCaoMgoDefault) {
        this.limeDefaultFactor = limeDefaultFactor;
        this.srCaoDefault = srCaoDefault;
        this.srCaoMgoDefault = srCaoMgoDefault;
    }

    ResolvedFactor resolveTier1Factor(String limeTypeRaw,
                                      Map<String, Double> factorValues,
                                      Integer lineNo) {
        LimeType limeType = resolveLimeType(limeTypeRaw);
        if (limeType == LimeType.BLANK) {
            return resolveStoredOrDefaultFactor(factorValues, "EF_LIME", limeDefaultFactor, true);
        }
        if (limeType == LimeType.DOLOMITIC) {
            throw new IllegalArgumentException("고토석회는 선진국(0.86) 또는 개도국(0.77) 구분이 필요합니다. lineNo=" + lineNo);
        }
        return ResolvedFactor.manual(limeType.tier1Factor);
    }

    ResolvedFactor resolveTier2Factor(String limeTypeRaw,
                                      double caoContent,
                                      double caoMgoContent,
                                      Map<String, Double> factorValues,
                                      Integer lineNo) {
        LimeType limeType = resolveLimeType(limeTypeRaw);
        if (limeType == LimeType.BLANK) {
            return resolveStoredOrDefaultFactor(factorValues, "EF_LIME", limeDefaultFactor, true);
        }
        if (limeType.usesCaoMgoContent) {
            double content = caoMgoContent > 0d ? caoMgoContent : limeType.defaultContent(factorValues);
            boolean defaultApplied = caoMgoContent <= 0d;
            ResolvedFactor srCaoMgo = resolveStoredOrDefaultFactor(factorValues, "SR_CAO_MGO", srCaoMgoDefault, false);
            return ResolvedFactor.combined(srCaoMgo.value * content, defaultApplied || srCaoMgo.defaultApplied, srCaoMgo.source);
        }
        double content = caoContent > 0d ? caoContent : limeType.defaultContent(factorValues);
        boolean defaultApplied = caoContent <= 0d;
        ResolvedFactor srCao = resolveStoredOrDefaultFactor(factorValues, "SR_CAO", srCaoDefault, false);
        return ResolvedFactor.combined(srCao.value * content, defaultApplied || srCao.defaultApplied, srCao.source);
    }

    LimeType resolveLimeType(String rawValue) {
        String normalized = normalizeToken(rawValue);
        if (normalized.isEmpty()) {
            return LimeType.BLANK;
        }
        if (normalized.equals("A") || normalized.contains("고칼슘") || normalized.contains("HIGHCALCIUM")) {
            return LimeType.HIGH_CALCIUM;
        }
        if (normalized.equals("C") || normalized.contains("수경성") || normalized.contains("HYDRAULIC")) {
            return LimeType.HYDRAULIC;
        }
        if (normalized.contains("개도국") || normalized.contains("LOW") || normalized.contains("0.77")) {
            return LimeType.DOLOMITIC_LOW;
        }
        if (normalized.contains("선진국") || normalized.contains("HIGH") || normalized.contains("0.86")) {
            return LimeType.DOLOMITIC_HIGH;
        }
        if (normalized.equals("B") || normalized.contains("고토") || normalized.contains("DOLOMITIC")) {
            return LimeType.DOLOMITIC;
        }
        throw new IllegalArgumentException("Unsupported lime type: " + rawValue);
    }

    private ResolvedFactor resolveStoredOrDefaultFactor(Map<String, Double> factorValues,
                                                        String factorCode,
                                                        double defaultValue,
                                                        boolean supplemented) {
        if (factorValues.containsKey(factorCode)) {
            return ResolvedFactor.combined(factorValues.get(factorCode), supplemented, FactorSource.STORED);
        }
        return ResolvedFactor.combined(defaultValue, true, FactorSource.FALLBACK);
    }

    private String normalizeToken(String value) {
        return safe(value)
                .toUpperCase(Locale.ROOT)
                .replace(" ", "")
                .replace("_", "")
                .replace("-", "")
                .replace("·", "")
                .replace(".", "")
                .replace("내지", "")
                .replace("(", "(")
                .replace(")", ")");
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
