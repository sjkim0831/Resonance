package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C65_검토승인확정관리자업무화면Controller {

    private final C65_검토승인확정관리자업무화면Service service;

    // APPROVAL_DECISION - POST /home/api/emission-projects/{id}/submissions/{submissionId}/approval/decision
    @PostMapping("/home/api/emission-projects/{id}/submissions/{submissionId}/approval/decision")
    public ResponseEntity<?> emission_projects_id_submissions_submissionId_approval_decision(@PathVariable Long id, @PathVariable Long submissionId) {
        log.info("Contract #{}: {}", 65, "APPROVAL_DECISION");
        // Entry: 프로젝트가 VERIFIED이고 승인선, 승인권자, 검토 대상 버전과 검증 증적이 존재한다.
        return ResponseEntity.ok().build();
    }
}
