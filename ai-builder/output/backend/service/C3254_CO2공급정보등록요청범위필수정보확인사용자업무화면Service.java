package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class C3254_CO2공급정보등록요청범위필수정보확인사용자업무화면Service {
    // SCREEN_CONTRACT
    public Object process_executions_screen_contract() {
        log.info("Contract #{}: {}", 3254, "SCREEN_CONTRACT");
        return null;
    }

    // LOAD_EXECUTION
    public Object process_executions() {
        log.info("Contract #{}: {}", 3254, "LOAD_EXECUTION");
        return null;
    }

    // CO2_SUPPLY_REGISTRATION_REQUEST
    public Object process_executions_executionId_commands(Long executionId) {
        log.info("Contract #{}: {}", 3254, "CO2_SUPPLY_REGISTRATION_REQUEST");
        return null;
    }

    // LOAD_DRAFT
    public Object process_executions_draft() {
        log.info("Contract #{}: {}", 3254, "LOAD_DRAFT");
        return null;
    }

    // SAVE_DRAFT
    public Object process_executions_draft() {
        log.info("Contract #{}: {}", 3254, "SAVE_DRAFT");
        return null;
    }
}
