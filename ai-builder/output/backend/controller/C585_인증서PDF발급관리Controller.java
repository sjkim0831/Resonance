package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C585_인증서PDF발급관리Controller {

    private final C585_인증서PDF발급관리Service service;

    // proofread - POST /admin/api/admin/emission-survey-report/proofread
    @PostMapping("/admin/api/admin/emission-survey-report/proofread")
    public ResponseEntity<?> admin_api_admin_emission_survey_report_proofread() {
        log.info("Contract #{}: {}", 585, "proofread");
        // Entry: APPROVER가 확정된 산정 세션과 제품·부산물 질량, 배출계수 및 섹션별 결과를 보유하고 인증서 발급 권한으로 진입한다.
        return ResponseEntity.ok().build();
    }

    // issue-pdf - POST /admin/api/admin/emission-survey-report/issue-pdf
    @PostMapping("/admin/api/admin/emission-survey-report/issue-pdf")
    public ResponseEntity<?> admin_api_admin_emission_survey_report_issue_pdf() {
        log.info("Contract #{}: {}", 585, "issue-pdf");
        // Entry: APPROVER가 확정된 산정 세션과 제품·부산물 질량, 배출계수 및 섹션별 결과를 보유하고 인증서 발급 권한으로 진입한다.
        return ResponseEntity.ok().build();
    }

    // verify - POST /admin/api/admin/emission-survey-report/verify
    @PostMapping("/admin/api/admin/emission-survey-report/verify")
    public ResponseEntity<?> admin_api_admin_emission_survey_report_verify() {
        log.info("Contract #{}: {}", 585, "verify");
        // Entry: APPROVER가 확정된 산정 세션과 제품·부산물 질량, 배출계수 및 섹션별 결과를 보유하고 인증서 발급 권한으로 진입한다.
        return ResponseEntity.ok().build();
    }

    // verify-ocr - POST /admin/api/admin/emission-survey-report/verify-ocr
    @PostMapping("/admin/api/admin/emission-survey-report/verify-ocr")
    public ResponseEntity<?> admin_api_admin_emission_survey_report_verify_ocr() {
        log.info("Contract #{}: {}", 585, "verify-ocr");
        // Entry: APPROVER가 확정된 산정 세션과 제품·부산물 질량, 배출계수 및 섹션별 결과를 보유하고 인증서 발급 권한으로 진입한다.
        return ResponseEntity.ok().build();
    }
}
