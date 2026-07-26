package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C319_교정오차보정관리관리자업무화면Controller {

    private final C319_교정오차보정관리관리자업무화면Service service;

    // mcm_calibrate - GET /api/ccus/facility/meter-calibration-management/mcm_calibrate
    @GetMapping("/api/ccus/facility/meter-calibration-management/mcm_calibrate")
    public ResponseEntity<?> api_ccus_facility_meter_calibration_management_mcm_calibrate() {
        log.info("Contract #{}: {}", 319, "mcm_calibrate");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 계측기와 측정 지점 및 허용오차가 등록되어 있다. 현재 상태는 PLANNED이며 서버가 테넌트·프로젝트·액
        return ResponseEntity.ok().build();
    }
}
