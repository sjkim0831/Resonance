package egovframework.com.feature.admin.service.impl;

import java.util.Map;

enum LimeType {
    BLANK(0d, false, null),
    HIGH_CALCIUM(0.75d, false, "HIGH_CALCIUM_CONTENT_DEFAULT"),
    DOLOMITIC(0d, true, null),
    DOLOMITIC_HIGH(0.86d, true, "DOLOMITIC_HIGH_CONTENT_DEFAULT"),
    DOLOMITIC_LOW(0.77d, true, "DOLOMITIC_LOW_CONTENT_DEFAULT"),
    HYDRAULIC(0.59d, false, "HYDRAULIC_CONTENT_DEFAULT");

    final double tier1Factor;
    final boolean usesCaoMgoContent;
    final String defaultContentCode;

    LimeType(double tier1Factor, boolean usesCaoMgoContent, String defaultContentCode) {
        this.tier1Factor = tier1Factor;
        this.usesCaoMgoContent = usesCaoMgoContent;
        this.defaultContentCode = defaultContentCode;
    }

    double defaultContent(Map<String, Double> factorValues) {
        if ("HIGH_CALCIUM_CONTENT_DEFAULT".equals(defaultContentCode)) {
            return factorValues.getOrDefault(defaultContentCode, EmissionCalculationConstants.HIGH_CALCIUM_CONTENT_DEFAULT);
        }
        if ("DOLOMITIC_HIGH_CONTENT_DEFAULT".equals(defaultContentCode)) {
            return factorValues.getOrDefault(defaultContentCode, EmissionCalculationConstants.DOLOMITIC_HIGH_CONTENT_DEFAULT);
        }
        if ("DOLOMITIC_LOW_CONTENT_DEFAULT".equals(defaultContentCode)) {
            return factorValues.getOrDefault(defaultContentCode, EmissionCalculationConstants.DOLOMITIC_LOW_CONTENT_DEFAULT);
        }
        if ("HYDRAULIC_CONTENT_DEFAULT".equals(defaultContentCode)) {
            return factorValues.getOrDefault(defaultContentCode, EmissionCalculationConstants.HYDRAULIC_CONTENT_DEFAULT);
        }
        return 0d;
    }
}
