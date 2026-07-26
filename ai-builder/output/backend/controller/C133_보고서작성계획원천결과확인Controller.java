package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C133_보고서작성계획원천결과확인Controller {

    private final C133_보고서작성계획원천결과확인Service service;

    // reports - GET /home/api/emission-projects/{id}/reports
    @GetMapping("/home/api/emission-projects/{id}/reports")
    public ResponseEntity<?> emission_projects_id_reports(@PathVariable Long id) {
        log.info("Contract #{}: {}", 133, "reports");
        // Entry: 프로젝트가 APPROVED이며 확정 산정 버전, 보고서 양식, 제출처와 공개·보안 정책이 지정되어 있다.
        return ResponseEntity.ok().build();
    }
}
