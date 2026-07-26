package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C251_감축전략시나리오Controller {

    private final C251_감축전략시나리오Service service;

    // LOAD_SIMULATION_WORKFLOW - GET /home/api/emission-projects/{id}/simulation-workflow
    @GetMapping("/home/api/emission-projects/{id}/simulation-workflow")
    public ResponseEntity<?> emission_projects_id_simulation_workflow(@PathVariable Long id) {
        log.info("Contract #{}: {}", 251, "LOAD_SIMULATION_WORKFLOW");
        // Entry: 감축 기준연도와 목표 및 비교 가능한 배출량 기준선이 존재한다.
        return ResponseEntity.ok().build();
    }

    // EXECUTE_SIMULATION - POST /home/api/emission-projects/{id}/simulate
    @PostMapping("/home/api/emission-projects/{id}/simulate")
    public ResponseEntity<?> emission_projects_id_simulate(@PathVariable Long id) {
        log.info("Contract #{}: {}", 251, "EXECUTE_SIMULATION");
        // Entry: 감축 기준연도와 목표 및 비교 가능한 배출량 기준선이 존재한다.
        return ResponseEntity.ok().build();
    }
}
