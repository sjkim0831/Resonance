package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C305_설비태그위치등록관리자업무화면Controller {

    private final C305_설비태그위치등록관리자업무화면Service service;

    // far_register - GET /api/ccus/facility/facility-asset-registry/far_register
    @GetMapping("/api/ccus/facility/facility-asset-registry/far_register")
    public ResponseEntity<?> api_ccus_facility_facility_asset_registry_far_register() {
        log.info("Contract #{}: {}", 305, "far_register");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 승인된 사업장과 설비 도입 근거가 존재한다. 현재 상태는 READY이며 서버가 테넌트·프로젝트·액터 권한을
        return ResponseEntity.ok().build();
    }
}
