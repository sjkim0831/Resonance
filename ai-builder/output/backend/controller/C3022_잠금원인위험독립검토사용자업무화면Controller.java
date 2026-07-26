package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C3022_잠금원인위험독립검토사용자업무화면Controller {

    private final C3022_잠금원인위험독립검토사용자업무화면Service service;

    // LOAD_RECOVERY_REVIEW - GET /admin/api/member-recovery/{requestId}
    @GetMapping("/admin/api/member-recovery/{requestId}")
    public ResponseEntity<?> admin_api_member_recovery_requestId(@PathVariable Long requestId) {
        log.info("Contract #{}: {}", 3022, "LOAD_RECOVERY_REVIEW");
        // Entry: IDENTITY_VERIFIED 상태이며 요청 범위, 서버 증명, 액터 권한과 최신 행 버전이 유효해야 한다.
        return ResponseEntity.ok().build();
    }

    // REVIEW_ACCOUNT_RECOVERY - POST /admin/api/member-recovery/{requestId}/review
    @PostMapping("/admin/api/member-recovery/{requestId}/review")
    public ResponseEntity<?> admin_api_member_recovery_requestId_review(@PathVariable Long requestId) {
        log.info("Contract #{}: {}", 3022, "REVIEW_ACCOUNT_RECOVERY");
        // Entry: IDENTITY_VERIFIED 상태이며 요청 범위, 서버 증명, 액터 권한과 최신 행 버전이 유효해야 한다.
        return ResponseEntity.ok().build();
    }
}
