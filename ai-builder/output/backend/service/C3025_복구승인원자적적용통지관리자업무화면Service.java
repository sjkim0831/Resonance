package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class C3025_복구승인원자적적용통지관리자업무화면Service {
    // COMPLETE_ACCOUNT_RECOVERY
    public Object admin_api_member_recovery_requestId_complete(Long requestId) {
        log.info("Contract #{}: {}", 3025, "COMPLETE_ACCOUNT_RECOVERY");
        return null;
    }
}
