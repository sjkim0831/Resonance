package egovframework.com.feature.admin.service.impl;

import egovframework.com.feature.admin.model.vo.EmissionCategoryVO;

import java.util.List;
import java.util.Map;

final class EmissionTierListExecution {
    final EmissionCategoryVO category;
    final List<Map<String, Object>> tiers;
    final List<Map<String, Object>> unsupportedTiers;

    EmissionTierListExecution(EmissionCategoryVO category,
                              List<Map<String, Object>> tiers,
                              List<Map<String, Object>> unsupportedTiers) {
        this.category = category;
        this.tiers = tiers;
        this.unsupportedTiers = unsupportedTiers;
    }
}
