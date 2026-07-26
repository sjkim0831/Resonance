package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C2814_보고서확정발급준비관리자업무화면Controller {

    private final C2814_보고서확정발급준비관리자업무화면Service service;

    // SCREEN_CONTRACT - GET /home/api/process-executions/screen-contract
    @GetMapping("/home/api/process-executions/screen-contract")
    public ResponseEntity<?> process_executions_screen_contract() {
        log.info("Contract #{}: {}", 2814, "SCREEN_CONTRACT");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 승인된 산출 결과 존재. 현재 상태는 APPROVED이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에
        return ResponseEntity.ok().build();
    }

    // LOAD_EXECUTION - GET /home/api/process-executions
    @GetMapping("/home/api/process-executions")
    public ResponseEntity<?> process_executions() {
        log.info("Contract #{}: {}", 2814, "LOAD_EXECUTION");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 승인된 산출 결과 존재. 현재 상태는 APPROVED이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에
        return ResponseEntity.ok().build();
    }

    // FINALIZE_REPORT - POST /home/api/process-executions/{executionId}/commands
    @PostMapping("/home/api/process-executions/{executionId}/commands")
    public ResponseEntity<?> process_executions_executionId_commands(@PathVariable Long executionId) {
        log.info("Contract #{}: {}", 2814, "FINALIZE_REPORT");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 승인된 산출 결과 존재. 현재 상태는 APPROVED이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에
        return ResponseEntity.ok().build();
    }

    // LOAD_DRAFT - GET /home/api/process-executions/draft
    @GetMapping("/home/api/process-executions/draft")
    public ResponseEntity<?> process_executions_draft() {
        log.info("Contract #{}: {}", 2814, "LOAD_DRAFT");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 승인된 산출 결과 존재. 현재 상태는 APPROVED이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에
        return ResponseEntity.ok().build();
    }

    // SAVE_DRAFT - PUT /home/api/process-executions/draft
    @PutMapping("/home/api/process-executions/draft")
    public ResponseEntity<?> process_executions_draft() {
        log.info("Contract #{}: {}", 2814, "SAVE_DRAFT");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 승인된 산출 결과 존재. 현재 상태는 APPROVED이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에
        return ResponseEntity.ok().build();
    }
}
