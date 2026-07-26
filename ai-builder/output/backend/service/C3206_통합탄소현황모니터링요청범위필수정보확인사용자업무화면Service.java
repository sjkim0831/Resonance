package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class C3206_통합탄소현황모니터링요청범위필수정보확인사용자업무화면Service {
    // SCREEN_CONTRACT
    public Object process_executions_screen_contract() {
        log.info("Contract #{}: {}", 3206, "SCREEN_CONTRACT");
        return null;
    }

    // LOAD_EXECUTION
    public Object process_executions() {
        log.info("Contract #{}: {}", 3206, "LOAD_EXECUTION");
        return null;
    }

    // INTEGRATED_MONITORING_REQUEST
    public Object process_executions_executionId_commands(Long executionId) {
        log.info("Contract #{}: {}", 3206, "INTEGRATED_MONITORING_REQUEST");
        return null;
    }

    // LOAD_DRAFT
    public Object process_executions_draft() {
        log.info("Contract #{}: {}", 3206, "LOAD_DRAFT");
        return null;
    }

    // SAVE_DRAFT
    public Object process_executions_draft() {
        log.info("Contract #{}: {}", 3206, "SAVE_DRAFT");
        return null;
    }
}
