package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C125_산정결과검증보완Controller {

    private final C125_산정결과검증보완Service service;

    // quality - GET /home/api/emission-projects/{id}/quality
    @GetMapping("/home/api/emission-projects/{id}/quality")
    public ResponseEntity<?> emission_projects_id_quality(@PathVariable Long id) {
        log.info("Contract #{}: {}", 125, "quality");
        // Entry: CALCULATED 버전이 잠겨 있고 검증자에게 프로젝트 범위 권한과 적용 규칙세트가 배정되어 있다.
        return ResponseEntity.ok().build();
    }

    // quality - POST /home/api/emission-projects/{id}/quality
    @PostMapping("/home/api/emission-projects/{id}/quality")
    public ResponseEntity<?> emission_projects_id_quality(@PathVariable Long id) {
        log.info("Contract #{}: {}", 125, "quality");
        // Entry: CALCULATED 버전이 잠겨 있고 검증자에게 프로젝트 범위 권한과 적용 규칙세트가 배정되어 있다.
        return ResponseEntity.ok().build();
    }

    // review-workflow - GET /home/api/emission-projects/{id}/review-workflow
    @GetMapping("/home/api/emission-projects/{id}/review-workflow")
    public ResponseEntity<?> emission_projects_id_review_workflow(@PathVariable Long id) {
        log.info("Contract #{}: {}", 125, "review-workflow");
        // Entry: CALCULATED 버전이 잠겨 있고 검증자에게 프로젝트 범위 권한과 적용 규칙세트가 배정되어 있다.
        return ResponseEntity.ok().build();
    }

    // start - POST /home/api/emission-projects/{id}/submissions/{submissionId}/verification/start
    @PostMapping("/home/api/emission-projects/{id}/submissions/{submissionId}/verification/start")
    public ResponseEntity<?> emission_projects_id_submissions_submissionId_verification_start(@PathVariable Long id, @PathVariable Long submissionId) {
        log.info("Contract #{}: {}", 125, "start");
        // Entry: CALCULATED 버전이 잠겨 있고 검증자에게 프로젝트 범위 권한과 적용 규칙세트가 배정되어 있다.
        return ResponseEntity.ok().build();
    }

    // decision - POST /home/api/emission-projects/{id}/submissions/{submissionId}/verification/decision
    @PostMapping("/home/api/emission-projects/{id}/submissions/{submissionId}/verification/decision")
    public ResponseEntity<?> emission_projects_id_submissions_submissionId_verification_decision(@PathVariable Long id, @PathVariable Long submissionId) {
        log.info("Contract #{}: {}", 125, "decision");
        // Entry: CALCULATED 버전이 잠겨 있고 검증자에게 프로젝트 범위 권한과 적용 규칙세트가 배정되어 있다.
        return ResponseEntity.ok().build();
    }
}
