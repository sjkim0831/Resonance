package egovframework.com.feature.admin.service.impl;

import egovframework.com.feature.admin.model.vo.EmissionCategoryVO;

final class EmissionCalculationExecution {
    final EmissionCategoryVO category;
    final Integer tier;
    final CalculationResult result;
    final Long resultId;

    EmissionCalculationExecution(EmissionCategoryVO category,
                                 Integer tier,
                                 CalculationResult result,
                                 Long resultId) {
        this.category = category;
        this.tier = tier;
        this.result = result;
        this.resultId = resultId;
    }
}
