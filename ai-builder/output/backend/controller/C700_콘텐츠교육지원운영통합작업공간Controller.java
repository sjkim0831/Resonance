package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C700_콘텐츠교육지원운영통합작업공간Controller {

    private final C700_콘텐츠교육지원운영통합작업공간Service service;

    // actor-process - GET /admin/api/system/actor-process
    @GetMapping("/admin/api/system/actor-process")
    public ResponseEntity<?> admin_api_system_actor_process() {
        log.info("Contract #{}: {}", 700, "actor-process");
        // Entry: 관리자 인증과 프로세스 조회 권한이 있고 process 파라미터가 유효한 활성 프로세스를 가리킨다.
        return ResponseEntity.ok().build();
    }
}
