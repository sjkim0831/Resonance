package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class C3023_잠금원인위험독립검토관리자업무화면Service {
    // LOAD_RECOVERY_REVIEW
    public Object admin_api_member_recovery_requestId(Long requestId) {
        log.info("Contract #{}: {}", 3023, "LOAD_RECOVERY_REVIEW");
        return null;
    }

    // REVIEW_ACCOUNT_RECOVERY
    public Object admin_api_member_recovery_requestId_review(Long requestId) {
        log.info("Contract #{}: {}", 3023, "REVIEW_ACCOUNT_RECOVERY");
        return null;
    }
}
