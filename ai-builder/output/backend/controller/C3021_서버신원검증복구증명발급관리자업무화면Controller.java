package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C3021_서버신원검증복구증명발급관리자업무화면Controller {

    private final C3021_서버신원검증복구증명발급관리자업무화면Service service;

    // VERIFY_RECOVERY_CHALLENGE - POST /api/public/account-recovery/requests/{requestId}/verify
    @PostMapping("/api/public/account-recovery/requests/{requestId}/verify")
    public ResponseEntity<?> api_public_account_recovery_requests_requestId_verify(@PathVariable Long requestId) {
        log.info("Contract #{}: {}", 3021, "VERIFY_RECOVERY_CHALLENGE");
        // Entry: REQUESTED 상태이며 요청 범위, 서버 증명, 액터 권한과 최신 행 버전이 유효해야 한다.
        return ResponseEntity.ok().build();
    }
}
