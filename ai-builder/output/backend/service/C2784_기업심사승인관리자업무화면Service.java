package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class C2784_기업심사승인관리자업무화면Service {
    // SCREEN_CONTRACT
    public Object process_executions_screen_contract() {
        log.info("Contract #{}: {}", 2784, "SCREEN_CONTRACT");
        return null;
    }

    // LOAD_EXECUTION
    public Object process_executions() {
        log.info("Contract #{}: {}", 2784, "LOAD_EXECUTION");
        return null;
    }

    // APPROVE_COMPANY
    public Object process_executions_executionId_commands(Long executionId) {
        log.info("Contract #{}: {}", 2784, "APPROVE_COMPANY");
        return null;
    }

    // LOAD_DRAFT
    public Object process_executions_draft() {
        log.info("Contract #{}: {}", 2784, "LOAD_DRAFT");
        return null;
    }

    // SAVE_DRAFT
    public Object process_executions_draft() {
        log.info("Contract #{}: {}", 2784, "SAVE_DRAFT");
        return null;
    }
}
