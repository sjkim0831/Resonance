package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C2964_약관개인정보GWP고지동의사용자업무화면Controller {

    private final C2964_약관개인정보GWP고지동의사용자업무화면Service service;

    // SCREEN_CONTRACT - GET /home/api/process-executions/screen-contract
    @GetMapping("/home/api/process-executions/screen-contract")
    public ResponseEntity<?> process_executions_screen_contract() {
        log.info("Contract #{}: {}", 2964, "SCREEN_CONTRACT");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 비로그인 사용자가 홈 또는 로그인 화면에서 회원가입을 선택한다. 현재 상태는 MEMBER_TYPE_SELE
        return ResponseEntity.ok().build();
    }

    // LOAD_EXECUTION - GET /home/api/process-executions
    @GetMapping("/home/api/process-executions")
    public ResponseEntity<?> process_executions() {
        log.info("Contract #{}: {}", 2964, "LOAD_EXECUTION");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 비로그인 사용자가 홈 또는 로그인 화면에서 회원가입을 선택한다. 현재 상태는 MEMBER_TYPE_SELE
        return ResponseEntity.ok().build();
    }

    // ACCEPT_REQUIRED_CONSENTS - POST /home/api/process-executions/{executionId}/commands
    @PostMapping("/home/api/process-executions/{executionId}/commands")
    public ResponseEntity<?> process_executions_executionId_commands(@PathVariable Long executionId) {
        log.info("Contract #{}: {}", 2964, "ACCEPT_REQUIRED_CONSENTS");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 비로그인 사용자가 홈 또는 로그인 화면에서 회원가입을 선택한다. 현재 상태는 MEMBER_TYPE_SELE
        return ResponseEntity.ok().build();
    }

    // LOAD_DRAFT - GET /home/api/process-executions/draft
    @GetMapping("/home/api/process-executions/draft")
    public ResponseEntity<?> process_executions_draft() {
        log.info("Contract #{}: {}", 2964, "LOAD_DRAFT");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 비로그인 사용자가 홈 또는 로그인 화면에서 회원가입을 선택한다. 현재 상태는 MEMBER_TYPE_SELE
        return ResponseEntity.ok().build();
    }

    // SAVE_DRAFT - PUT /home/api/process-executions/draft
    @PutMapping("/home/api/process-executions/draft")
    public ResponseEntity<?> process_executions_draft() {
        log.info("Contract #{}: {}", 2964, "SAVE_DRAFT");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 비로그인 사용자가 홈 또는 로그인 화면에서 회원가입을 선택한다. 현재 상태는 MEMBER_TYPE_SELE
        return ResponseEntity.ok().build();
    }
}
