package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C333_건전성검토MRV인계관리자업무화면Controller {

    private final C333_건전성검토MRV인계관리자업무화면Service service;

    // ciso_review - GET /api/ccus/facility/co2-injection-storage-operation/ciso_review
    @GetMapping("/api/ccus/facility/co2-injection-storage-operation/ciso_review")
    public ResponseEntity<?> api_ccus_facility_co2_injection_storage_operation_ciso_review() {
        log.info("Contract #{}: {}", 333, "ciso_review");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 승인된 저장소·주입정·운영계획과 유효 계측기가 존재한다. 현재 상태는 REVIEWED이며 서버가 테넌트·프
        return ResponseEntity.ok().build();
    }
}
