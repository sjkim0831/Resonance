package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C3018_복구요청접수범위확인사용자업무화면Controller {

    private final C3018_복구요청접수범위확인사용자업무화면Service service;

    // REQUEST_RECOVERY - POST /api/public/account-recovery/requests
    @PostMapping("/api/public/account-recovery/requests")
    public ResponseEntity<?> api_public_account_recovery_requests() {
        log.info("Contract #{}: {}", 3018, "REQUEST_RECOVERY");
        // Entry: READY 상태이며 요청 범위, 서버 증명, 액터 권한과 최신 행 버전이 유효해야 한다.
        return ResponseEntity.ok().build();
    }
}
