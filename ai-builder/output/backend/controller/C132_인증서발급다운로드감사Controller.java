package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C132_인증서발급다운로드감사Controller {

    private final C132_인증서발급다운로드감사Service service;

    // issue - POST /home/api/emission-projects/{id}/reports/{reportId}/issue
    @PostMapping("/home/api/emission-projects/{id}/reports/{reportId}/issue")
    public ResponseEntity<?> emission_projects_id_reports_reportId_issue(@PathVariable Long id, @PathVariable Long reportId) {
        log.info("Contract #{}: {}", 132, "issue");
        // Entry: 프로젝트가 APPROVED이며 확정 산정 버전, 보고서 양식, 제출처와 공개·보안 정책이 지정되어 있다.
        return ResponseEntity.ok().build();
    }

    // download - POST /home/api/emission-projects/{id}/reports/{reportId}/download
    @PostMapping("/home/api/emission-projects/{id}/reports/{reportId}/download")
    public ResponseEntity<?> emission_projects_id_reports_reportId_download(@PathVariable Long id, @PathVariable Long reportId) {
        log.info("Contract #{}: {}", 132, "download");
        // Entry: 프로젝트가 APPROVED이며 확정 산정 버전, 보고서 양식, 제출처와 공개·보안 정책이 지정되어 있다.
        return ResponseEntity.ok().build();
    }

    // report-access-history - GET /home/api/report-access-history
    @GetMapping("/home/api/report-access-history")
    public ResponseEntity<?> report_access_history() {
        log.info("Contract #{}: {}", 132, "report-access-history");
        // Entry: 프로젝트가 APPROVED이며 확정 산정 버전, 보고서 양식, 제출처와 공개·보안 정책이 지정되어 있다.
        return ResponseEntity.ok().build();
    }
}
