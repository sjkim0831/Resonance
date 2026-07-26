package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C3025_복구승인원자적적용통지관리자업무화면Controller {

    private final C3025_복구승인원자적적용통지관리자업무화면Service service;

    // COMPLETE_ACCOUNT_RECOVERY - POST /admin/api/member-recovery/{requestId}/complete
    @PostMapping("/admin/api/member-recovery/{requestId}/complete")
    public ResponseEntity<?> admin_api_member_recovery_requestId_complete(@PathVariable Long requestId) {
        log.info("Contract #{}: {}", 3025, "COMPLETE_ACCOUNT_RECOVERY");
        // Entry: REVIEW_APPROVED 상태이며 요청 범위, 서버 증명, 액터 권한과 최신 행 버전이 유효해야 한다.
        return ResponseEntity.ok().build();
    }
}
