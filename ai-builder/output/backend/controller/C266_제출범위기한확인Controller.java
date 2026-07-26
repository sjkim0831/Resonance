package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C266_제출범위기한확인Controller {

    private final C266_제출범위기한확인Service service;

    // regulatory-submissions - GET /home/api/emission-projects/{projectId}/regulatory-submissions
    @GetMapping("/home/api/emission-projects/{projectId}/regulatory-submissions")
    public ResponseEntity<?> emission_projects_projectId_regulatory_submissions(@PathVariable Long projectId) {
        log.info("Contract #{}: {}", 266, "regulatory-submissions");
        // Entry: 인증 계정이 프로젝트에 배정되어 있고 역할에 맞는 명령 권한과 FINALIZED 보고서가 존재한다.
        return ResponseEntity.ok().build();
    }

    // regulatory-submissions - POST /home/api/emission-projects/{projectId}/regulatory-submissions
    @PostMapping("/home/api/emission-projects/{projectId}/regulatory-submissions")
    public ResponseEntity<?> emission_projects_projectId_regulatory_submissions(@PathVariable Long projectId) {
        log.info("Contract #{}: {}", 266, "regulatory-submissions");
        // Entry: 인증 계정이 프로젝트에 배정되어 있고 역할에 맞는 명령 권한과 FINALIZED 보고서가 존재한다.
        return ResponseEntity.ok().build();
    }

    // transition - POST /home/api/emission-projects/{projectId}/regulatory-submissions/{submissionId}/transition
    @PostMapping("/home/api/emission-projects/{projectId}/regulatory-submissions/{submissionId}/transition")
    public ResponseEntity<?> emission_projects_projectId_regulatory_submissions_submissionId_transition(@PathVariable Long projectId, @PathVariable Long submissionId) {
        log.info("Contract #{}: {}", 266, "transition");
        // Entry: 인증 계정이 프로젝트에 배정되어 있고 역할에 맞는 명령 권한과 FINALIZED 보고서가 존재한다.
        return ResponseEntity.ok().build();
    }
}
