package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C70_데이터산정결과검증관리자업무화면Controller {

    private final C70_데이터산정결과검증관리자업무화면Service service;

    // LOAD_REVIEW_WORKFLOW - GET /home/api/emission-projects/{id}/review-workflow
    @GetMapping("/home/api/emission-projects/{id}/review-workflow")
    public ResponseEntity<?> emission_projects_id_review_workflow(@PathVariable Long id) {
        log.info("Contract #{}: {}", 70, "LOAD_REVIEW_WORKFLOW");
        // Entry: CALCULATED 버전이 잠겨 있고 검증자에게 프로젝트 범위 권한과 적용 규칙세트가 배정되어 있다.
        return ResponseEntity.ok().build();
    }

    // START_VERIFICATION - POST /home/api/emission-projects/{id}/submissions/{submissionId}/verification/start
    @PostMapping("/home/api/emission-projects/{id}/submissions/{submissionId}/verification/start")
    public ResponseEntity<?> emission_projects_id_submissions_submissionId_verification_start(@PathVariable Long id, @PathVariable Long submissionId) {
        log.info("Contract #{}: {}", 70, "START_VERIFICATION");
        // Entry: CALCULATED 버전이 잠겨 있고 검증자에게 프로젝트 범위 권한과 적용 규칙세트가 배정되어 있다.
        return ResponseEntity.ok().build();
    }

    // DECIDE_VERIFICATION - POST /home/api/emission-projects/{id}/submissions/{submissionId}/verification/decision
    @PostMapping("/home/api/emission-projects/{id}/submissions/{submissionId}/verification/decision")
    public ResponseEntity<?> emission_projects_id_submissions_submissionId_verification_decision(@PathVariable Long id, @PathVariable Long submissionId) {
        log.info("Contract #{}: {}", 70, "DECIDE_VERIFICATION");
        // Entry: CALCULATED 버전이 잠겨 있고 검증자에게 프로젝트 범위 권한과 적용 규칙세트가 배정되어 있다.
        return ResponseEntity.ok().build();
    }
}
