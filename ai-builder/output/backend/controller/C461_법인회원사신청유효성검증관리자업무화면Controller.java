package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C461_법인회원사신청유효성검증관리자업무화면Controller {

    private final C461_법인회원사신청유효성검증관리자업무화면Service service;

    // cec_validate_company - GET /api/work/certification-eligibility-check/cec_validate_company
    @GetMapping("/api/work/certification-eligibility-check/cec_validate_company")
    public ResponseEntity<?> api_work_certification_eligibility_check_cec_validate_company() {
        log.info("Contract #{}: {}", 461, "cec_validate_company");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 검토 가능한 인증 신청과 잠긴 산정·보고서 데이터셋이 존재한다. 현재 상태는 READY이며 서버가 테넌트·
        return ResponseEntity.ok().build();
    }
}
