package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C306_책임허가정비기준연결사용자업무화면Controller {

    private final C306_책임허가정비기준연결사용자업무화면Service service;

    // far_assign - GET /api/ccus/facility/facility-asset-registry/far_assign
    @GetMapping("/api/ccus/facility/facility-asset-registry/far_assign")
    public ResponseEntity<?> api_ccus_facility_facility_asset_registry_far_assign() {
        log.info("Contract #{}: {}", 306, "far_assign");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 승인된 사업장과 설비 도입 근거가 존재한다. 현재 상태는 PLANNED이며 서버가 테넌트·프로젝트·액터 권
        return ResponseEntity.ok().build();
    }
}
