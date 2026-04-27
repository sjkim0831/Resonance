package egovframework.com.feature.admin.service.impl;

import java.util.LinkedHashMap;
import java.util.Map;

final class EmissionCategoryMetadataProvider {
    Map<String, Object> limeDefaultFactor() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("factorValue", EmissionCalculationConstants.LIME_DEFAULT_FACTOR);
        response.put("unit", "tCO2/t-lime");
        response.put("rule", "85% 고칼슘석회 + 15% 고토석회 + 0% 수화석회");
        return response;
    }
}
