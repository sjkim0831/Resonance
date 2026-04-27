package egovframework.com.feature.admin.service.impl;

import egovframework.com.feature.admin.model.vo.EmissionCategoryVO;

final class EmissionInputSaveExecution {
    final Long sessionId;
    final EmissionCategoryVO category;
    final int tier;
    final int savedCount;

    EmissionInputSaveExecution(Long sessionId,
                               EmissionCategoryVO category,
                               int tier,
                               int savedCount) {
        this.sessionId = sessionId;
        this.category = category;
        this.tier = tier;
        this.savedCount = savedCount;
    }
}
