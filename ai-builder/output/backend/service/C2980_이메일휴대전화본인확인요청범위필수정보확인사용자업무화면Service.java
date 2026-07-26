package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class C2980_이메일휴대전화본인확인요청범위필수정보확인사용자업무화면Service {
    // SCREEN_CONTRACT
    public Object process_executions_screen_contract() {
        log.info("Contract #{}: {}", 2980, "SCREEN_CONTRACT");
        return null;
    }

    // LOAD_EXECUTION
    public Object process_executions() {
        log.info("Contract #{}: {}", 2980, "LOAD_EXECUTION");
        return null;
    }

    // IDENTITY_VERIFICATION_REQUEST
    public Object process_executions_executionId_commands(Long executionId) {
        log.info("Contract #{}: {}", 2980, "IDENTITY_VERIFICATION_REQUEST");
        return null;
    }

    // LOAD_DRAFT
    public Object process_executions_draft() {
        log.info("Contract #{}: {}", 2980, "LOAD_DRAFT");
        return null;
    }

    // SAVE_DRAFT
    public Object process_executions_draft() {
        log.info("Contract #{}: {}", 2980, "SAVE_DRAFT");
        return null;
    }
}
