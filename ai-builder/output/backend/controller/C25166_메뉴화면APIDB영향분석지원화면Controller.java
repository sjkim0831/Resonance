package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C25166_메뉴화면APIDB영향분석지원화면Controller {

    private final C25166_메뉴화면APIDB영향분석지원화면Service service;

    // actor-process - GET /admin/api/system/actor-process
    @GetMapping("/admin/api/system/actor-process")
    public ResponseEntity<?> admin_api_system_actor_process() {
        log.info("Contract #{}: {}", 25166, "actor-process");
        // Entry: 로그인 계정이 대상 프로젝트와 단계 수행 액터에 배정되고 이전 단계 완료 조건을 충족해야 진입한다.
        return ResponseEntity.ok().build();
    }

    // cases - GET /admin/api/system/actor-process/cases
    @GetMapping("/admin/api/system/actor-process/cases")
    public ResponseEntity<?> admin_api_system_actor_process_cases() {
        log.info("Contract #{}: {}", 25166, "cases");
        // Entry: 로그인 계정이 대상 프로젝트와 단계 수행 액터에 배정되고 이전 단계 완료 조건을 충족해야 진입한다.
        return ResponseEntity.ok().build();
    }
}
