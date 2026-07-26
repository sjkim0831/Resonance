package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C478_추가인증마스킹해제통제사용자업무화면Controller {

    private final C478_추가인증마스킹해제통제사용자업무화면Service service;

    // prd_access - GET /api/work/privacy-retention-destruction/prd_access
    @GetMapping("/api/work/privacy-retention-destruction/prd_access")
    public ResponseEntity<?> api_work_privacy_retention_destruction_prd_access() {
        log.info("Contract #{}: {}", 478, "prd_access");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 개인정보 분류·처리목적·보존기간·법적 보류 정책이 승인되어 있다. 현재 상태는 READY이며 서버가 테넌트
        return ResponseEntity.ok().build();
    }
}
