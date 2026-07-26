package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C336_통제대피법정보고사용자업무화면Controller {

    private final C336_통제대피법정보고사용자업무화면Service service;

    // fer_control - GET /api/ccus/facility/facility-emergency-response/fer_control
    @GetMapping("/api/ccus/facility/facility-emergency-response/fer_control")
    public ResponseEntity<?> api_ccus_facility_facility_emergency_response_fer_control() {
        log.info("Contract #{}: {}", 336, "fer_control");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 비상대응 조직·연락망·대응계획과 훈련 이력이 유효하다. 현재 상태는 PLANNED이며 서버가 테넌트·프로젝
        return ResponseEntity.ok().build();
    }
}
