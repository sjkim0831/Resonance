package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C244_배출계수매핑배출량산정Controller {

    private final C244_배출계수매핑배출량산정Service service;

    // calculation - GET /home/api/emission-projects/{id}/calculation
    @GetMapping("/home/api/emission-projects/{id}/calculation")
    public ResponseEntity<?> emission_projects_id_calculation(@PathVariable Long id) {
        log.info("Contract #{}: {}", 244, "calculation");
        // Entry: 활동자료 제출 스냅샷이 존재하며 적용할 계수·GWP·단위 정책 버전이 확정되어 있다.
        return ResponseEntity.ok().build();
    }

    // calculation - POST /home/api/emission-projects/{id}/calculation
    @PostMapping("/home/api/emission-projects/{id}/calculation")
    public ResponseEntity<?> emission_projects_id_calculation(@PathVariable Long id) {
        log.info("Contract #{}: {}", 244, "calculation");
        // Entry: 활동자료 제출 스냅샷이 존재하며 적용할 계수·GWP·단위 정책 버전이 확정되어 있다.
        return ResponseEntity.ok().build();
    }
}
