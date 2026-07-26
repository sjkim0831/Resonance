package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class C3750_할당회피규칙선택사용자업무화면Service {
    // SCREEN_CONTRACT
    public Object process_executions_screen_contract() {
        log.info("Contract #{}: {}", 3750, "SCREEN_CONTRACT");
        return null;
    }

    // LOAD_EXECUTION
    public Object process_executions() {
        log.info("Contract #{}: {}", 3750, "LOAD_EXECUTION");
        return null;
    }

    // LCA_ALLOCATION_SENSITIVITY_EXECUTE_2
    public Object process_executions_executionId_commands(Long executionId) {
        log.info("Contract #{}: {}", 3750, "LCA_ALLOCATION_SENSITIVITY_EXECUTE_2");
        return null;
    }

    // LOAD_DRAFT
    public Object process_executions_draft() {
        log.info("Contract #{}: {}", 3750, "LOAD_DRAFT");
        return null;
    }

    // SAVE_DRAFT
    public Object process_executions_draft() {
        log.info("Contract #{}: {}", 3750, "SAVE_DRAFT");
        return null;
    }
}
