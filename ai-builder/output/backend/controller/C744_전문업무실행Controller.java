package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C744_전문업무실행Controller {

    private final C744_전문업무실행Service service;

    // draft - GET /home/api/process-executions/draft
    @GetMapping("/home/api/process-executions/draft")
    public ResponseEntity<?> process_executions_draft() {
        log.info("Contract #{}: {}", 744, "draft");
        // Entry: 인증된 계정에 테넌트와 프로젝트의 유효한 액터 배정이 있고 선택 단계가 서버의 현재 실행 단계와 일치해야 한다.
        return ResponseEntity.ok().build();
    }

    // draft - PUT /home/api/process-executions/draft
    @PutMapping("/home/api/process-executions/draft")
    public ResponseEntity<?> process_executions_draft() {
        log.info("Contract #{}: {}", 744, "draft");
        // Entry: 인증된 계정에 테넌트와 프로젝트의 유효한 액터 배정이 있고 선택 단계가 서버의 현재 실행 단계와 일치해야 한다.
        return ResponseEntity.ok().build();
    }

    // process-executions - GET /home/api/process-executions
    @GetMapping("/home/api/process-executions")
    public ResponseEntity<?> process_executions() {
        log.info("Contract #{}: {}", 744, "process-executions");
        // Entry: 인증된 계정에 테넌트와 프로젝트의 유효한 액터 배정이 있고 선택 단계가 서버의 현재 실행 단계와 일치해야 한다.
        return ResponseEntity.ok().build();
    }

    // start - POST /home/api/process-executions/start
    @PostMapping("/home/api/process-executions/start")
    public ResponseEntity<?> process_executions_start() {
        log.info("Contract #{}: {}", 744, "start");
        // Entry: 인증된 계정에 테넌트와 프로젝트의 유효한 액터 배정이 있고 선택 단계가 서버의 현재 실행 단계와 일치해야 한다.
        return ResponseEntity.ok().build();
    }

    // commands - POST /home/api/process-executions/{executionId}/commands
    @PostMapping("/home/api/process-executions/{executionId}/commands")
    public ResponseEntity<?> process_executions_executionId_commands(@PathVariable Long executionId) {
        log.info("Contract #{}: {}", 744, "commands");
        // Entry: 인증된 계정에 테넌트와 프로젝트의 유효한 액터 배정이 있고 선택 단계가 서버의 현재 실행 단계와 일치해야 한다.
        return ResponseEntity.ok().build();
    }
}
