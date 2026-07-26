package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C496_통지사건템플릿대상확정사용자업무화면Controller {

    private final C496_통지사건템플릿대상확정사용자업무화면Service service;

    // lnd_compose - GET /api/work/legal-notification-delivery/lnd_compose
    @GetMapping("/api/work/legal-notification-delivery/lnd_compose")
    public ResponseEntity<?> api_work_legal_notification_delivery_lnd_compose() {
        log.info("Contract #{}: {}", 496, "lnd_compose");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 통지 사건·대상자·동의·템플릿·우선 채널·대체 채널 정책이 존재한다. 현재 상태는 READY이며 서버가 테
        return ResponseEntity.ok().build();
    }
}
