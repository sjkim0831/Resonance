package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C3079_의견서승인발급관리자업무화면Controller {

    private final C3079_의견서승인발급관리자업무화면Service service;

    // SCREEN_CONTRACT - GET /home/api/process-executions/screen-contract
    @GetMapping("/home/api/process-executions/screen-contract")
    public ResponseEntity<?> process_executions_screen_contract() {
        log.info("Contract #{}: {}", 3079, "SCREEN_CONTRACT");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 검증 범위와 후보 기관, 이해상충 정보가 준비되어 있다. 현재 상태는 STEP_3_COMPLETED이며 서
        return ResponseEntity.ok().build();
    }

    // LOAD_EXECUTION - GET /home/api/process-executions
    @GetMapping("/home/api/process-executions")
    public ResponseEntity<?> process_executions() {
        log.info("Contract #{}: {}", 3079, "LOAD_EXECUTION");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 검증 범위와 후보 기관, 이해상충 정보가 준비되어 있다. 현재 상태는 STEP_3_COMPLETED이며 서
        return ResponseEntity.ok().build();
    }

    // EXTERNAL_VERIFICATION_ENGAGEMENT_EXECUTE_4 - POST /home/api/process-executions/{executionId}/commands
    @PostMapping("/home/api/process-executions/{executionId}/commands")
    public ResponseEntity<?> process_executions_executionId_commands(@PathVariable Long executionId) {
        log.info("Contract #{}: {}", 3079, "EXTERNAL_VERIFICATION_ENGAGEMENT_EXECUTE_4");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 검증 범위와 후보 기관, 이해상충 정보가 준비되어 있다. 현재 상태는 STEP_3_COMPLETED이며 서
        return ResponseEntity.ok().build();
    }

    // LOAD_DRAFT - GET /home/api/process-executions/draft
    @GetMapping("/home/api/process-executions/draft")
    public ResponseEntity<?> process_executions_draft() {
        log.info("Contract #{}: {}", 3079, "LOAD_DRAFT");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 검증 범위와 후보 기관, 이해상충 정보가 준비되어 있다. 현재 상태는 STEP_3_COMPLETED이며 서
        return ResponseEntity.ok().build();
    }

    // SAVE_DRAFT - PUT /home/api/process-executions/draft
    @PutMapping("/home/api/process-executions/draft")
    public ResponseEntity<?> process_executions_draft() {
        log.info("Contract #{}: {}", 3079, "SAVE_DRAFT");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 검증 범위와 후보 기관, 이해상충 정보가 준비되어 있다. 현재 상태는 STEP_3_COMPLETED이며 서
        return ResponseEntity.ok().build();
    }
}
