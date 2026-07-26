package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C331_주입실적저장거동기록관리자업무화면Controller {

    private final C331_주입실적저장거동기록관리자업무화면Service service;

    // ciso_operate - GET /api/ccus/facility/co2-injection-storage-operation/ciso_operate
    @GetMapping("/api/ccus/facility/co2-injection-storage-operation/ciso_operate")
    public ResponseEntity<?> api_ccus_facility_co2_injection_storage_operation_ciso_operate() {
        log.info("Contract #{}: {}", 331, "ciso_operate");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 승인된 저장소·주입정·운영계획과 유효 계측기가 존재한다. 현재 상태는 PLANNED이며 서버가 테넌트·프로
        return ResponseEntity.ok().build();
    }
}
