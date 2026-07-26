package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C8_배출계수매핑배출량산정관리자업무화면Controller {

    private final C8_배출계수매핑배출량산정관리자업무화면Service service;

    // calculation - GET /home/api/emission-projects/{id}/calculation
    @GetMapping("/home/api/emission-projects/{id}/calculation")
    public ResponseEntity<?> emission_projects_id_calculation(@PathVariable Long id) {
        log.info("Contract #{}: {}", 8, "calculation");
        // Entry: 활동자료 제출 스냅샷이 존재하며 적용할 계수·GWP·단위 정책 버전이 확정되어 있다.
        return ResponseEntity.ok().build();
    }

    // factor - POST /home/api/emission-projects/{id}/activities/{activityId}/factor
    @PostMapping("/home/api/emission-projects/{id}/activities/{activityId}/factor")
    public ResponseEntity<?> emission_projects_id_activities_activityId_factor(@PathVariable Long id, @PathVariable Long activityId) {
        log.info("Contract #{}: {}", 8, "factor");
        // Entry: 활동자료 제출 스냅샷이 존재하며 적용할 계수·GWP·단위 정책 버전이 확정되어 있다.
        return ResponseEntity.ok().build();
    }

    // auto-map - POST /home/api/emission-projects/{id}/activities/auto-map
    @PostMapping("/home/api/emission-projects/{id}/activities/auto-map")
    public ResponseEntity<?> emission_projects_id_activities_auto_map(@PathVariable Long id) {
        log.info("Contract #{}: {}", 8, "auto-map");
        // Entry: 활동자료 제출 스냅샷이 존재하며 적용할 계수·GWP·단위 정책 버전이 확정되어 있다.
        return ResponseEntity.ok().build();
    }

    // calculation - POST /home/api/emission-projects/{id}/calculation
    @PostMapping("/home/api/emission-projects/{id}/calculation")
    public ResponseEntity<?> emission_projects_id_calculation(@PathVariable Long id) {
        log.info("Contract #{}: {}", 8, "calculation");
        // Entry: 활동자료 제출 스냅샷이 존재하며 적용할 계수·GWP·단위 정책 버전이 확정되어 있다.
        return ResponseEntity.ok().build();
    }
}
