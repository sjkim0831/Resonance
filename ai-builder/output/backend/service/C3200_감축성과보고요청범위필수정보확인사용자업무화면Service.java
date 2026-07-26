package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class C3200_감축성과보고요청범위필수정보확인사용자업무화면Service {
    // SCREEN_CONTRACT
    public Object process_executions_screen_contract() {
        log.info("Contract #{}: {}", 3200, "SCREEN_CONTRACT");
        return null;
    }

    // LOAD_EXECUTION
    public Object process_executions() {
        log.info("Contract #{}: {}", 3200, "LOAD_EXECUTION");
        return null;
    }

    // REDUCTION_REPORTING_REQUEST
    public Object process_executions_executionId_commands(Long executionId) {
        log.info("Contract #{}: {}", 3200, "REDUCTION_REPORTING_REQUEST");
        return null;
    }

    // LOAD_DRAFT
    public Object process_executions_draft() {
        log.info("Contract #{}: {}", 3200, "LOAD_DRAFT");
        return null;
    }

    // SAVE_DRAFT
    public Object process_executions_draft() {
        log.info("Contract #{}: {}", 3200, "SAVE_DRAFT");
        return null;
    }
}
