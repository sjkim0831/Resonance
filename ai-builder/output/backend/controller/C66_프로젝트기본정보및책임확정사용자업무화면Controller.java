package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C66_프로젝트기본정보및책임확정사용자업무화면Controller {

    private final C66_프로젝트기본정보및책임확정사용자업무화면Service service;

    // LOAD_PROJECT_DETAIL - GET /home/api/emission-projects/{id}
    @GetMapping("/home/api/emission-projects/{id}")
    public ResponseEntity<?> emission_projects_id(@PathVariable Long id) {
        log.info("Contract #{}: {}", 66, "LOAD_PROJECT_DETAIL");
        // Entry: 기업책임자가 대상 기업과 프로젝트 생성 권한을 보유하고 기준정보가 활성 상태이다.
        return ResponseEntity.ok().build();
    }

    // UPDATE_PROJECT - POST /home/api/emission-projects/{id}
    @PostMapping("/home/api/emission-projects/{id}")
    public ResponseEntity<?> emission_projects_id(@PathVariable Long id) {
        log.info("Contract #{}: {}", 66, "UPDATE_PROJECT");
        // Entry: 기업책임자가 대상 기업과 프로젝트 생성 권한을 보유하고 기준정보가 활성 상태이다.
        return ResponseEntity.ok().build();
    }

    // LOAD_ACTIVITY_REQUESTS - GET /home/api/emission-projects/{id}/activity-requests
    @GetMapping("/home/api/emission-projects/{id}/activity-requests")
    public ResponseEntity<?> emission_projects_id_activity_requests(@PathVariable Long id) {
        log.info("Contract #{}: {}", 66, "LOAD_ACTIVITY_REQUESTS");
        // Entry: 기업책임자가 대상 기업과 프로젝트 생성 권한을 보유하고 기준정보가 활성 상태이다.
        return ResponseEntity.ok().build();
    }

    // CREATE_ACTIVITY_REQUEST - POST /home/api/emission-projects/{id}/activity-requests
    @PostMapping("/home/api/emission-projects/{id}/activity-requests")
    public ResponseEntity<?> emission_projects_id_activity_requests(@PathVariable Long id) {
        log.info("Contract #{}: {}", 66, "CREATE_ACTIVITY_REQUEST");
        // Entry: 기업책임자가 대상 기업과 프로젝트 생성 권한을 보유하고 기준정보가 활성 상태이다.
        return ResponseEntity.ok().build();
    }

    // START_ACTIVITY - POST /home/api/emission-projects/{id}/activity-requests/{requestId}/start
    @PostMapping("/home/api/emission-projects/{id}/activity-requests/{requestId}/start")
    public ResponseEntity<?> emission_projects_id_activity_requests_requestId_start(@PathVariable Long id, @PathVariable Long requestId) {
        log.info("Contract #{}: {}", 66, "START_ACTIVITY");
        // Entry: 기업책임자가 대상 기업과 프로젝트 생성 권한을 보유하고 기준정보가 활성 상태이다.
        return ResponseEntity.ok().build();
    }
}
