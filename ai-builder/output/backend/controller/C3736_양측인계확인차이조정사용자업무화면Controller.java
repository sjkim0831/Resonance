package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C3736_양측인계확인차이조정사용자업무화면Controller {

    private final C3736_양측인계확인차이조정사용자업무화면Service service;

    // SCREEN_CONTRACT - GET /home/api/process-executions/screen-contract
    @GetMapping("/home/api/process-executions/screen-contract")
    public ResponseEntity<?> process_executions_screen_contract() {
        log.info("Contract #{}: {}", 3736, "SCREEN_CONTRACT");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 거점, 운송수단, 인계 당사자와 계량 규칙이 등록되어 있다. 현재 상태는 STEP_2_COMPLETED이며
        return ResponseEntity.ok().build();
    }

    // LOAD_EXECUTION - GET /home/api/process-executions
    @GetMapping("/home/api/process-executions")
    public ResponseEntity<?> process_executions() {
        log.info("Contract #{}: {}", 3736, "LOAD_EXECUTION");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 거점, 운송수단, 인계 당사자와 계량 규칙이 등록되어 있다. 현재 상태는 STEP_2_COMPLETED이며
        return ResponseEntity.ok().build();
    }

    // CHAIN_OF_CUSTODY_EXECUTE_3 - POST /home/api/process-executions/{executionId}/commands
    @PostMapping("/home/api/process-executions/{executionId}/commands")
    public ResponseEntity<?> process_executions_executionId_commands(@PathVariable Long executionId) {
        log.info("Contract #{}: {}", 3736, "CHAIN_OF_CUSTODY_EXECUTE_3");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 거점, 운송수단, 인계 당사자와 계량 규칙이 등록되어 있다. 현재 상태는 STEP_2_COMPLETED이며
        return ResponseEntity.ok().build();
    }

    // LOAD_DRAFT - GET /home/api/process-executions/draft
    @GetMapping("/home/api/process-executions/draft")
    public ResponseEntity<?> process_executions_draft() {
        log.info("Contract #{}: {}", 3736, "LOAD_DRAFT");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 거점, 운송수단, 인계 당사자와 계량 규칙이 등록되어 있다. 현재 상태는 STEP_2_COMPLETED이며
        return ResponseEntity.ok().build();
    }

    // SAVE_DRAFT - PUT /home/api/process-executions/draft
    @PutMapping("/home/api/process-executions/draft")
    public ResponseEntity<?> process_executions_draft() {
        log.info("Contract #{}: {}", 3736, "SAVE_DRAFT");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 거점, 운송수단, 인계 당사자와 계량 규칙이 등록되어 있다. 현재 상태는 STEP_2_COMPLETED이며
        return ResponseEntity.ok().build();
    }
}
