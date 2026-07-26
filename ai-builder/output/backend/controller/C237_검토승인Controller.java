package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C237_검토승인Controller {

    private final C237_검토승인Service service;

    // review-workflow - GET /home/api/emission-projects/{id}/review-workflow
    @GetMapping("/home/api/emission-projects/{id}/review-workflow")
    public ResponseEntity<?> emission_projects_id_review_workflow(@PathVariable Long id) {
        log.info("Contract #{}: {}", 237, "review-workflow");
        // Entry: 프로젝트가 VERIFIED이고 승인선, 승인권자, 검토 대상 버전과 검증 증적이 존재한다.
        return ResponseEntity.ok().build();
    }

    // decision - POST /home/api/emission-projects/{id}/submissions/{submissionId}/approval/decision
    @PostMapping("/home/api/emission-projects/{id}/submissions/{submissionId}/approval/decision")
    public ResponseEntity<?> emission_projects_id_submissions_submissionId_approval_decision(@PathVariable Long id, @PathVariable Long submissionId) {
        log.info("Contract #{}: {}", 237, "decision");
        // Entry: 프로젝트가 VERIFIED이고 승인선, 승인권자, 검토 대상 버전과 검증 증적이 존재한다.
        return ResponseEntity.ok().build();
    }
}
