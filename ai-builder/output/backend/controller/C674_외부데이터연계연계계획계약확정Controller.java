package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C674_외부데이터연계연계계획계약확정Controller {

    private final C674_외부데이터연계연계계획계약확정Service service;

    // process-executions - GET /home/api/process-executions
    @GetMapping("/home/api/process-executions")
    public ResponseEntity<?> process_executions() {
        log.info("Contract #{}: {}", 674, "process-executions");
        // Entry: DRAFT
        return ResponseEntity.ok().build();
    }

    // screen-contract - GET /home/api/process-executions/screen-contract
    @GetMapping("/home/api/process-executions/screen-contract")
    public ResponseEntity<?> process_executions_screen_contract() {
        log.info("Contract #{}: {}", 674, "screen-contract");
        // Entry: DRAFT
        return ResponseEntity.ok().build();
    }

    // start - POST /home/api/process-executions/start
    @PostMapping("/home/api/process-executions/start")
    public ResponseEntity<?> process_executions_start() {
        log.info("Contract #{}: {}", 674, "start");
        // Entry: DRAFT
        return ResponseEntity.ok().build();
    }

    // commands - POST /home/api/process-executions/{executionId}/commands
    @PostMapping("/home/api/process-executions/{executionId}/commands")
    public ResponseEntity<?> process_executions_executionId_commands(@PathVariable Long executionId) {
        log.info("Contract #{}: {}", 674, "commands");
        // Entry: DRAFT
        return ResponseEntity.ok().build();
    }

    // draft - GET /home/api/process-executions/draft
    @GetMapping("/home/api/process-executions/draft")
    public ResponseEntity<?> process_executions_draft() {
        log.info("Contract #{}: {}", 674, "draft");
        // Entry: DRAFT
        return ResponseEntity.ok().build();
    }

    // draft - PUT /home/api/process-executions/draft
    @PutMapping("/home/api/process-executions/draft")
    public ResponseEntity<?> process_executions_draft() {
        log.info("Contract #{}: {}", 674, "draft");
        // Entry: DRAFT
        return ResponseEntity.ok().build();
    }
}
