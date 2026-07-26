package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class C3108_감축로드맵수립승인확정통지후속업무연결사용자업무화면Service {
    // SCREEN_CONTRACT
    public Object process_executions_screen_contract() {
        log.info("Contract #{}: {}", 3108, "SCREEN_CONTRACT");
        return null;
    }

    // LOAD_EXECUTION
    public Object process_executions() {
        log.info("Contract #{}: {}", 3108, "LOAD_EXECUTION");
        return null;
    }

    // REDUCTION_ROADMAP_COMPLETE
    public Object process_executions_executionId_commands(Long executionId) {
        log.info("Contract #{}: {}", 3108, "REDUCTION_ROADMAP_COMPLETE");
        return null;
    }

    // LOAD_DRAFT
    public Object process_executions_draft() {
        log.info("Contract #{}: {}", 3108, "LOAD_DRAFT");
        return null;
    }

    // SAVE_DRAFT
    public Object process_executions_draft() {
        log.info("Contract #{}: {}", 3108, "SAVE_DRAFT");
        return null;
    }
}
