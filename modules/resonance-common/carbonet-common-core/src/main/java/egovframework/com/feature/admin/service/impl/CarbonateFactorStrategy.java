package egovframework.com.feature.admin.service.impl;

import java.util.Locale;
import java.util.Map;

final class CarbonateFactorStrategy {
    private final double caco3Factor;
    private final double mgco3Factor;
    private final double camgco32Factor;
    private final double feco3Factor;
    private final double cafeMgMnCo32Factor;
    private final double mnco3Factor;
    private final double na2co3Factor;

    CarbonateFactorStrategy(double caco3Factor,
                            double mgco3Factor,
                            double camgco32Factor,
                            double feco3Factor,
                            double cafeMgMnCo32Factor,
                            double mnco3Factor,
                            double na2co3Factor) {
        this.caco3Factor = caco3Factor;
        this.mgco3Factor = mgco3Factor;
        this.camgco32Factor = camgco32Factor;
        this.feco3Factor = feco3Factor;
        this.cafeMgMnCo32Factor = cafeMgMnCo32Factor;
        this.mnco3Factor = mnco3Factor;
        this.na2co3Factor = na2co3Factor;
    }

    ResolvedFactor resolveLineFactor(Map<String, Map<Integer, Double>> lineValues,
                                     Map<String, Map<Integer, String>> lineTextValues,
                                     Map<String, Double> factorValues,
                                     String numericCode,
                                     String textCode,
                                     Integer lineNo,
                                     String context) {
        Double directValue = lineValue(lineValues, numericCode, lineNo);
        Double mappedValue = resolveCarbonateFactorOrNull(lineText(lineTextValues, textCode, lineNo));
        ResolvedFactor resolved = resolveNumberFactor(directValue, mappedValue, factorValues, numericCode, 0d, true);
        if (resolved.source != FactorSource.FALLBACK) {
            return resolved;
        }
        throw new IllegalArgumentException("Missing carbonate factor mapping for " + context + ".");
    }

    ResolvedFactor resolveScalarFactor(Map<String, Double> scalarValues,
                                       Map<String, String> scalarTexts,
                                       Map<String, Double> factorValues,
                                       String numericCode,
                                       String textCode,
                                       double defaultValue) {
        return resolveNumberFactor(
                scalarValues.containsKey(numericCode) ? scalarValues.get(numericCode) : null,
                resolveCarbonateFactorOrNull(scalarTexts.get(textCode)),
                factorValues,
                numericCode,
                defaultValue,
                true
        );
    }

    Double resolveCarbonateFactorOrNull(String rawValue) {
        String normalized = normalizeToken(rawValue);
        if (normalized.isEmpty()) {
            return null;
        }
        if (normalized.contains("CACO3") || normalized.contains("방해석") || normalized.contains("아라고나이트") || normalized.contains("CALCITE") || normalized.contains("ARAGONITE")) {
            return caco3Factor;
        }
        if (normalized.contains("MGCO3") || normalized.contains("마그네사이트") || normalized.contains("MAGNESITE")) {
            return mgco3Factor;
        }
        if (normalized.contains("CAMG(CO3)2") || normalized.contains("백운석") || normalized.contains("DOLOMITE")) {
            return camgco32Factor;
        }
        if (normalized.contains("FECO3") || normalized.contains("능철광") || normalized.contains("SIDERITE")) {
            return feco3Factor;
        }
        if (normalized.contains("CA(FE,MG,MN)(CO3)2") || normalized.contains("CAFEMGMNCO32") || normalized.contains("철백운석") || normalized.contains("ANKERITE")) {
            return cafeMgMnCo32Factor;
        }
        if (normalized.contains("MNCO3") || normalized.contains("망간광")) {
            return mnco3Factor;
        }
        if (normalized.contains("NA2CO3") || normalized.contains("탄산나트륨") || normalized.contains("소다회") || normalized.contains("SODAASH")) {
            return na2co3Factor;
        }
        throw new IllegalArgumentException("Unsupported carbonate type: " + rawValue);
    }

    private ResolvedFactor resolveNumberFactor(Double directValue,
                                               Double mappedValue,
                                               Map<String, Double> factorValues,
                                               String factorCode,
                                               double defaultValue,
                                               boolean useMappedBeforeStoredFactor) {
        if (directValue != null) {
            return ResolvedFactor.manual(directValue);
        }
        if (useMappedBeforeStoredFactor && mappedValue != null) {
            return ResolvedFactor.mapped(mappedValue);
        }
        if (factorValues.containsKey(factorCode)) {
            return ResolvedFactor.stored(factorValues.get(factorCode));
        }
        if (!useMappedBeforeStoredFactor && mappedValue != null) {
            return ResolvedFactor.mapped(mappedValue);
        }
        return ResolvedFactor.fallback(defaultValue);
    }

    private Double lineValue(Map<String, Map<Integer, Double>> lineValues, String key, Integer lineNo) {
        Map<Integer, Double> values = lineValues.get(key);
        if (values == null) {
            return null;
        }
        return values.get(lineNo);
    }

    private String lineText(Map<String, Map<Integer, String>> lineTextValues, String key, Integer lineNo) {
        Map<Integer, String> values = lineTextValues.get(key);
        if (values == null || values.get(lineNo) == null) {
            return "";
        }
        return safe(values.get(lineNo));
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
