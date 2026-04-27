package egovframework.com.feature.admin.service.impl;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

final class EmissionCalculationSupport {
    static final FactorNotePolicy GENERIC_FACTOR_POLICY = new FactorNotePolicy("직접 입력값 사용", "유형 매핑값 사용", "저장 계수 사용", "계수 기본값 사용", "산식으로 계산", "조건식으로 계산");
    static final FactorNotePolicy CARBONATE_FACTOR_POLICY = new FactorNotePolicy("직접 입력값 사용", "탄산염 유형 매핑값 사용", "저장 계수 사용", "탄산염 기본값 사용", "산식으로 계산", "조건식으로 계산");
    static final FactorNotePolicy LIME_FACTOR_POLICY = new FactorNotePolicy("직접 입력값 사용", "석회 유형 매핑값 사용", "저장 계수 사용", "석회 기본값 사용", "산식으로 계산", "조건식으로 계산");
    static final FactorNotePolicy LIME_TIER2_FACTOR_POLICY = new FactorNotePolicy("배출계수 직접 입력값 사용", "석회 유형 매핑값 사용", "저장 배출계수 사용", "문서 기본 배출계수 사용", "함량 산식으로 계산", "수화 여부 산식으로 계산");
    static final FactorNotePolicy LIME_TIER2_CFKLD_POLICY = new FactorNotePolicy("보정계수 직접 입력값 사용", "유형 매핑값 사용", "저장 보정계수 사용", "Md/Cd/Fd 입력이 없어 기본값 1.02를 사용했습니다.", "Md/Cd/Fd 산식으로 계산", "Md/Cd/Fd 산식으로 계산");
    static final FactorNotePolicy LIME_TIER2_HYDRATION_POLICY = new FactorNotePolicy("보정계수 직접 입력값 사용", "유형 매핑값 사용", "저장 보정계수 사용", "수화석회 입력 x, y가 없어 기본 보정값을 사용했습니다.", "x, y 산식으로 계산", "수화 생산 조건으로 계산");

    private final CarbonateFactorStrategy carbonateFactorStrategy;
    private final LimeFactorStrategy limeFactorStrategy;
    private final CorrectionFactorStrategy correctionFactorStrategy;

    EmissionCalculationSupport(CarbonateFactorStrategy carbonateFactorStrategy,
                               LimeFactorStrategy limeFactorStrategy,
                               CorrectionFactorStrategy correctionFactorStrategy) {
        this.carbonateFactorStrategy = carbonateFactorStrategy;
        this.limeFactorStrategy = limeFactorStrategy;
        this.correctionFactorStrategy = correctionFactorStrategy;
    }

    AppliedFactor applyResolvedFactor(CalculationTrace trace,
                                      String factorCode,
                                      ResolvedFactor factor,
                                      String detail,
                                      FactorNotePolicy policy) {
        trace.addResolvedFactor(factorCode, factor);
        return new AppliedFactor(factor, factorNote(factor, detail, policy));
    }

    AppliedFactor applyScalarFactor(CalculationTrace trace,
                                    String factorCode,
                                    ResolvedFactor factor,
                                    String detail,
                                    FactorNotePolicy policy) {
        return applyResolvedFactor(trace, factorCode, factor, detail, policy);
    }

    String factorNote(ResolvedFactor factor, String detail, FactorNotePolicy policy) {
        return joinNoteParts(factorSourceNote(factor, policy), detail);
    }

    String factorSourceNote(ResolvedFactor factor, FactorNotePolicy policy) {
        if (factor == null) {
            return "";
        }
        switch (factor.source) {
            case MANUAL:
                return policy.manualMessage;
            case MAPPED:
                return policy.mappedMessage;
            case STORED:
                return policy.storedMessage;
            case FALLBACK:
                return policy.fallbackMessage;
            case DERIVED:
                return policy.derivedMessage;
            case CALCULATED:
                return policy.calculatedMessage;
            default:
                return "";
        }
    }

    String joinNoteParts(String... parts) {
        List<String> normalized = new ArrayList<>();
        for (String part : parts) {
            String value = safe(part);
            if (!value.isEmpty()) {
                normalized.add(value);
            }
        }
        return normalized.isEmpty() ? null : String.join(", ", normalized);
    }

    ResolvedFactor resolveCarbonateLineFactor(Map<String, Map<Integer, Double>> lineValues,
                                              Map<String, Map<Integer, String>> lineTextValues,
                                              Map<String, Double> factorValues,
                                              String numericCode,
                                              String textCode,
                                              Integer lineNo,
                                              String context) {
        return carbonateFactorStrategy.resolveLineFactor(lineValues, lineTextValues, factorValues, numericCode, textCode, lineNo, context);
    }

    ResolvedFactor resolveCarbonateScalarFactor(Map<String, Double> scalarValues,
                                                Map<String, String> scalarTexts,
                                                Map<String, Double> factorValues,
                                                String numericCode,
                                                String textCode,
                                                double defaultValue) {
        return carbonateFactorStrategy.resolveScalarFactor(scalarValues, scalarTexts, factorValues, numericCode, textCode, defaultValue);
    }

    ResolvedFactor resolveScalarFactor(Map<String, Double> scalarValues,
                                       Map<String, Double> factorValues,
                                       String factorCode,
                                       double defaultValue) {
        if (scalarValues.containsKey(factorCode) && scalarValues.get(factorCode) != null) {
            return ResolvedFactor.manual(scalarValues.get(factorCode));
        }
        if (factorValues.containsKey(factorCode)) {
            return ResolvedFactor.stored(factorValues.get(factorCode));
        }
        return ResolvedFactor.fallback(defaultValue);
    }

    ResolvedFactor resolveLimeTier1Factor(String limeTypeRaw, Map<String, Double> factorValues, Integer lineNo) {
        return limeFactorStrategy.resolveTier1Factor(limeTypeRaw, factorValues, lineNo);
    }

    ResolvedFactor resolveLimeTier2Factor(String limeTypeRaw,
                                          double caoContent,
                                          double caoMgoContent,
                                          Map<String, Double> factorValues,
                                          Integer lineNo) {
        return limeFactorStrategy.resolveTier2Factor(limeTypeRaw, caoContent, caoMgoContent, factorValues, lineNo);
    }

    ResolvedFactor resolveLimeTier2CkdFactor(double md, double cd, double fd, double mass, Map<String, Double> factorValues) {
        return correctionFactorStrategy.resolveLimeTier2CkdFactor(md, cd, fd, mass, factorValues);
    }

    ResolvedFactor resolveLimeTier2HydrationCorrection(String hydratedProductionRaw,
                                                       double hydrateRatio,
                                                       double moistureContent,
                                                       Map<String, Double> factorValues) {
        return correctionFactorStrategy.resolveLimeTier2HydrationCorrection(hydratedProductionRaw, hydrateRatio, moistureContent, factorValues);
    }

    LimeType resolveLimeType(String rawValue) {
        return limeFactorStrategy.resolveLimeType(rawValue);
    }

    Set<Integer> lineIndexes(Map<String, Map<Integer, Double>> lineValues, String... keys) {
        Set<Integer> indexes = new LinkedHashSet<>();
        for (String key : keys) {
            Map<Integer, Double> values = lineValues.get(key);
            if (values != null) {
                indexes.addAll(values.keySet());
            }
        }
        return indexes;
    }

    void requireMatchingLineSet(Map<String, Map<Integer, Double>> lineValues,
                                String context,
                                String leftKey,
                                String rightKey) {
        Set<Integer> leftLines = new LinkedHashSet<>();
        Set<Integer> rightLines = new LinkedHashSet<>();
        Map<Integer, Double> leftValues = lineValues.get(leftKey);
        Map<Integer, Double> rightValues = lineValues.get(rightKey);
        if (leftValues != null) {
            leftLines.addAll(leftValues.keySet());
        }
        if (rightValues != null) {
            rightLines.addAll(rightValues.keySet());
        }
        if (!leftLines.equals(rightLines)) {
            throw new IllegalArgumentException(context + " requires matching line numbers for " + leftKey + " and " + rightKey + ".");
        }
    }

    double lineNumber(Map<String, Map<Integer, Double>> lineValues, String key, Integer lineNo) {
        Map<Integer, Double> values = lineValues.get(key);
        if (values == null || values.get(lineNo) == null) {
            return 0d;
        }
        return values.get(lineNo);
    }

    String lineText(Map<String, Map<Integer, String>> lineTextValues, String key, Integer lineNo) {
        Map<Integer, String> values = lineTextValues.get(key);
        if (values == null || values.get(lineNo) == null) {
            return "";
        }
        return safe(values.get(lineNo));
    }

    double number(Map<String, Double> values, String key) {
        if (values == null || values.get(key) == null) {
            return 0d;
        }
        return values.get(key);
    }

    double ratio(double value) {
        if (value >= 1d && value <= 100d) {
            return value / 100d;
        }
        return value;
    }

    String format(String pattern, Object... args) {
        return String.format(Locale.ROOT, pattern, args);
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
