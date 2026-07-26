package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C327_기능시험재가동승인관리자업무화면Controller {

    private final C327_기능시험재가동승인관리자업무화면Service service;

    // pm_return_service - GET /api/ccus/facility/preventive-maintenance/pm_return_service
    @GetMapping("/api/ccus/facility/preventive-maintenance/pm_return_service")
    public ResponseEntity<?> api_ccus_facility_preventive_maintenance_pm_return_service() {
        log.info("Contract #{}: {}", 327, "pm_return_service");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 설비 자산과 정비주기 및 위험등급이 확정되어 있다. 현재 상태는 REVIEWED이며 서버가 테넌트·프로젝트
        return ResponseEntity.ok().build();
    }
}
