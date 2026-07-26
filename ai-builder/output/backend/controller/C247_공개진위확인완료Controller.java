package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C247_공개진위확인완료Controller {

    private final C247_공개진위확인완료Service service;

    // {certificateId} - GET /api/public/report-certificates/{certificateId}
    @GetMapping("/api/public/report-certificates/{certificateId}")
    public ResponseEntity<?> api_public_report_certificates_certificateId(@PathVariable Long certificateId) {
        log.info("Contract #{}: {}", 247, "{certificateId}");
        // Entry: 프로젝트가 APPROVED이며 확정 산정 버전, 보고서 양식, 제출처와 공개·보안 정책이 지정되어 있다.
        return ResponseEntity.ok().build();
    }

    // verify - POST /api/home/certificate-verify/verify
    @PostMapping("/api/home/certificate-verify/verify")
    public ResponseEntity<?> api_home_certificate_verify_verify() {
        log.info("Contract #{}: {}", 247, "verify");
        // Entry: 프로젝트가 APPROVED이며 확정 산정 버전, 보고서 양식, 제출처와 공개·보안 정책이 지정되어 있다.
        return ResponseEntity.ok().build();
    }

    // verify-ocr - POST /api/home/certificate-verify/verify-ocr
    @PostMapping("/api/home/certificate-verify/verify-ocr")
    public ResponseEntity<?> api_home_certificate_verify_verify_ocr() {
        log.info("Contract #{}: {}", 247, "verify-ocr");
        // Entry: 프로젝트가 APPROVED이며 확정 산정 버전, 보고서 양식, 제출처와 공개·보안 정책이 지정되어 있다.
        return ResponseEntity.ok().build();
    }
}
