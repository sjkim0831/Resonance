package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C325_작업허가정비수행관리자업무화면Controller {

    private final C325_작업허가정비수행관리자업무화면Service service;

    // pm_execute - GET /api/ccus/facility/preventive-maintenance/pm_execute
    @GetMapping("/api/ccus/facility/preventive-maintenance/pm_execute")
    public ResponseEntity<?> api_ccus_facility_preventive_maintenance_pm_execute() {
        log.info("Contract #{}: {}", 325, "pm_execute");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 설비 자산과 정비주기 및 위험등급이 확정되어 있다. 현재 상태는 PLANNED이며 서버가 테넌트·프로젝트·
        return ResponseEntity.ok().build();
    }
}
