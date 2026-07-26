package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C312_운전알람조치기록사용자업무화면Controller {

    private final C312_운전알람조치기록사용자업무화면Service service;

    // fom_operate - GET /api/ccus/facility/facility-operation-monitoring/fom_operate
    @GetMapping("/api/ccus/facility/facility-operation-monitoring/fom_operate")
    public ResponseEntity<?> api_ccus_facility_facility_operation_monitoring_fom_operate() {
        log.info("Contract #{}: {}", 312, "fom_operate");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 운영 가능한 설비와 유효한 계측기가 등록되어 있다. 현재 상태는 PLANNED이며 서버가 테넌트·프로젝트·
        return ResponseEntity.ok().build();
    }
}
