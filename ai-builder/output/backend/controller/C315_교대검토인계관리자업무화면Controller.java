package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C315_교대검토인계관리자업무화면Controller {

    private final C315_교대검토인계관리자업무화면Service service;

    // fom_handover - GET /api/ccus/facility/facility-operation-monitoring/fom_handover
    @GetMapping("/api/ccus/facility/facility-operation-monitoring/fom_handover")
    public ResponseEntity<?> api_ccus_facility_facility_operation_monitoring_fom_handover() {
        log.info("Contract #{}: {}", 315, "fom_handover");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 운영 가능한 설비와 유효한 계측기가 등록되어 있다. 현재 상태는 REVIEWED이며 서버가 테넌트·프로젝트
        return ResponseEntity.ok().build();
    }
}
