package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C13_보완재산정사용자업무화면Controller {

    private final C13_보완재산정사용자업무화면Service service;

    // activities - GET /home/api/emission-projects/{id}/activities
    @GetMapping("/home/api/emission-projects/{id}/activities")
    public ResponseEntity<?> emission_projects_id_activities(@PathVariable Long id) {
        log.info("Contract #{}: {}", 13, "activities");
        // Entry: 프로젝트가 CORRECTION_REQUIRED이며 미종결 보완 요청과 수정 권한을 가진 담당자가 존재한다.
        return ResponseEntity.ok().build();
    }

    // activities - POST /home/api/emission-projects/{id}/activities
    @PostMapping("/home/api/emission-projects/{id}/activities")
    public ResponseEntity<?> emission_projects_id_activities(@PathVariable Long id) {
        log.info("Contract #{}: {}", 13, "activities");
        // Entry: 프로젝트가 CORRECTION_REQUIRED이며 미종결 보완 요청과 수정 권한을 가진 담당자가 존재한다.
        return ResponseEntity.ok().build();
    }

    // quality - GET /home/api/emission-projects/{id}/quality
    @GetMapping("/home/api/emission-projects/{id}/quality")
    public ResponseEntity<?> emission_projects_id_quality(@PathVariable Long id) {
        log.info("Contract #{}: {}", 13, "quality");
        // Entry: 프로젝트가 CORRECTION_REQUIRED이며 미종결 보완 요청과 수정 권한을 가진 담당자가 존재한다.
        return ResponseEntity.ok().build();
    }

    // calculation - POST /home/api/emission-projects/{id}/calculation
    @PostMapping("/home/api/emission-projects/{id}/calculation")
    public ResponseEntity<?> emission_projects_id_calculation(@PathVariable Long id) {
        log.info("Contract #{}: {}", 13, "calculation");
        // Entry: 프로젝트가 CORRECTION_REQUIRED이며 미종결 보완 요청과 수정 권한을 가진 담당자가 존재한다.
        return ResponseEntity.ok().build();
    }

    // submit - POST /home/api/emission-projects/{id}/submissions/{submissionId}/submit
    @PostMapping("/home/api/emission-projects/{id}/submissions/{submissionId}/submit")
    public ResponseEntity<?> emission_projects_id_submissions_submissionId_submit(@PathVariable Long id, @PathVariable Long submissionId) {
        log.info("Contract #{}: {}", 13, "submit");
        // Entry: 프로젝트가 CORRECTION_REQUIRED이며 미종결 보완 요청과 수정 권한을 가진 담당자가 존재한다.
        return ResponseEntity.ok().build();
    }
}
