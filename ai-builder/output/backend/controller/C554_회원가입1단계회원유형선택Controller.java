package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C554_회원가입1단계회원유형선택Controller {

    private final C554_회원가입1단계회원유형선택Service service;

    // session - GET /join/api/session
    @GetMapping("/join/api/session")
    public ResponseEntity<?> join_api_session() {
        log.info("Contract #{}: {}", 554, "session");
        // Entry: 비로그인 사용자가 신규 가입을 시작했고 서버 가입 세션이 생성 또는 복구 가능한 상태이다.
        return ResponseEntity.ok().build();
    }

    // step1 - POST /join/api/step1
    @PostMapping("/join/api/step1")
    public ResponseEntity<?> join_api_step1() {
        log.info("Contract #{}: {}", 554, "step1");
        // Entry: 비로그인 사용자가 신규 가입을 시작했고 서버 가입 세션이 생성 또는 복구 가능한 상태이다.
        return ResponseEntity.ok().build();
    }

    // reset - POST /join/api/reset
    @PostMapping("/join/api/reset")
    public ResponseEntity<?> join_api_reset() {
        log.info("Contract #{}: {}", 554, "reset");
        // Entry: 비로그인 사용자가 신규 가입을 시작했고 서버 가입 세션이 생성 또는 복구 가능한 상태이다.
        return ResponseEntity.ok().build();
    }
}
