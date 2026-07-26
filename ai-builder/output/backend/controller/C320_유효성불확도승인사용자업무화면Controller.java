package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C320_유효성불확도승인사용자업무화면Controller {

    private final C320_유효성불확도승인사용자업무화면Service service;

    // mcm_approve - GET /api/ccus/facility/meter-calibration-management/mcm_approve
    @GetMapping("/api/ccus/facility/meter-calibration-management/mcm_approve")
    public ResponseEntity<?> api_ccus_facility_meter_calibration_management_mcm_approve() {
        log.info("Contract #{}: {}", 320, "mcm_approve");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 계측기와 측정 지점 및 허용오차가 등록되어 있다. 현재 상태는 REVIEWED이며 서버가 테넌트·프로젝트·
        return ResponseEntity.ok().build();
    }
}
