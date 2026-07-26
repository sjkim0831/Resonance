package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C130_보고서작성확정Controller {

    private final C130_보고서작성확정Service service;

    // reports - POST /home/api/emission-projects/{id}/reports
    @PostMapping("/home/api/emission-projects/{id}/reports")
    public ResponseEntity<?> emission_projects_id_reports(@PathVariable Long id) {
        log.info("Contract #{}: {}", 130, "reports");
        // Entry: 프로젝트가 APPROVED이며 확정 산정 버전, 보고서 양식, 제출처와 공개·보안 정책이 지정되어 있다.
        return ResponseEntity.ok().build();
    }

    // finalize - POST /home/api/emission-projects/{id}/reports/{reportId}/finalize
    @PostMapping("/home/api/emission-projects/{id}/reports/{reportId}/finalize")
    public ResponseEntity<?> emission_projects_id_reports_reportId_finalize(@PathVariable Long id, @PathVariable Long reportId) {
        log.info("Contract #{}: {}", 130, "finalize");
        // Entry: 프로젝트가 APPROVED이며 확정 산정 버전, 보고서 양식, 제출처와 공개·보안 정책이 지정되어 있다.
        return ResponseEntity.ok().build();
    }
}
