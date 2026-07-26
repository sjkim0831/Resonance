package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C553_RegistrationStep1MembershipTypeController {

    private final C553_RegistrationStep1MembershipTypeService service;

    // session - GET /join/api/session
    @GetMapping("/join/api/session")
    public ResponseEntity<?> join_api_session() {
        log.info("Contract #{}: {}", 553, "session");
        // Entry: 비로그인 사용자가 신규 가입을 시작했고 서버 가입 세션이 생성 또는 복구 가능한 상태이다.
        return ResponseEntity.ok().build();
    }

    // step1 - POST /join/api/step1
    @PostMapping("/join/api/step1")
    public ResponseEntity<?> join_api_step1() {
        log.info("Contract #{}: {}", 553, "step1");
        // Entry: 비로그인 사용자가 신규 가입을 시작했고 서버 가입 세션이 생성 또는 복구 가능한 상태이다.
        return ResponseEntity.ok().build();
    }

    // reset - POST /join/api/reset
    @PostMapping("/join/api/reset")
    public ResponseEntity<?> join_api_reset() {
        log.info("Contract #{}: {}", 553, "reset");
        // Entry: 비로그인 사용자가 신규 가입을 시작했고 서버 가입 세션이 생성 또는 복구 가능한 상태이다.
        return ResponseEntity.ok().build();
    }
}
