package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C311_운전계획허용범위설정관리자업무화면Controller {

    private final C311_운전계획허용범위설정관리자업무화면Service service;

    // fom_plan - GET /api/ccus/facility/facility-operation-monitoring/fom_plan
    @GetMapping("/api/ccus/facility/facility-operation-monitoring/fom_plan")
    public ResponseEntity<?> api_ccus_facility_facility_operation_monitoring_fom_plan() {
        log.info("Contract #{}: {}", 311, "fom_plan");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 운영 가능한 설비와 유효한 계측기가 등록되어 있다. 현재 상태는 READY이며 서버가 테넌트·프로젝트·액터
        return ResponseEntity.ok().build();
    }
}
