package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C9_데이터산정결과검증사용자업무화면Controller {

    private final C9_데이터산정결과검증사용자업무화면Service service;

    // review-workflow - GET /home/api/emission-projects/{projectId}/review-workflow
    @GetMapping("/home/api/emission-projects/{projectId}/review-workflow")
    public ResponseEntity<?> emission_projects_projectId_review_workflow(@PathVariable Long projectId) {
        log.info("Contract #{}: {}", 9, "review-workflow");
        // Entry: 제출본이 SUBMITTED 또는 IN_VERIFICATION 상태이고 프로젝트 VERIFIER 배정과 산정 결과가 존재한다.
        return ResponseEntity.ok().build();
    }

    // start - POST /home/api/emission-projects/{projectId}/submissions/{submissionId}/verification/start
    @PostMapping("/home/api/emission-projects/{projectId}/submissions/{submissionId}/verification/start")
    public ResponseEntity<?> emission_projects_projectId_submissions_submissionId_verification_start(@PathVariable Long projectId, @PathVariable Long submissionId) {
        log.info("Contract #{}: {}", 9, "start");
        // Entry: 제출본이 SUBMITTED 또는 IN_VERIFICATION 상태이고 프로젝트 VERIFIER 배정과 산정 결과가 존재한다.
        return ResponseEntity.ok().build();
    }

    // decision - POST /home/api/emission-projects/{projectId}/submissions/{submissionId}/verification/decision
    @PostMapping("/home/api/emission-projects/{projectId}/submissions/{submissionId}/verification/decision")
    public ResponseEntity<?> emission_projects_projectId_submissions_submissionId_verification_decision(@PathVariable Long projectId, @PathVariable Long submissionId) {
        log.info("Contract #{}: {}", 9, "decision");
        // Entry: 제출본이 SUBMITTED 또는 IN_VERIFICATION 상태이고 프로젝트 VERIFIER 배정과 산정 결과가 존재한다.
        return ResponseEntity.ok().build();
    }

    // decision - POST /home/api/emission-projects/{projectId}/submissions/{submissionId}/approval/decision
    @PostMapping("/home/api/emission-projects/{projectId}/submissions/{submissionId}/approval/decision")
    public ResponseEntity<?> emission_projects_projectId_submissions_submissionId_approval_decision(@PathVariable Long projectId, @PathVariable Long submissionId) {
        log.info("Contract #{}: {}", 9, "decision");
        // Entry: 제출본이 SUBMITTED 또는 IN_VERIFICATION 상태이고 프로젝트 VERIFIER 배정과 산정 결과가 존재한다.
        return ResponseEntity.ok().build();
    }
}
