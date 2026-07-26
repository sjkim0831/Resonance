package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C124_배출계수매핑배출량산정Controller {

    private final C124_배출계수매핑배출량산정Service service;

    // calculation - GET /home/api/emission-projects/{id}/calculation
    @GetMapping("/home/api/emission-projects/{id}/calculation")
    public ResponseEntity<?> emission_projects_id_calculation(@PathVariable Long id) {
        log.info("Contract #{}: {}", 124, "calculation");
        // Entry: 기업 담당자가 활동자료 요청을 접수 완료했고 산정 담당자에게 CALCULATION 태스크가 배정되어 있다.
        return ResponseEntity.ok().build();
    }

    // factor - POST /home/api/emission-projects/{id}/activities/{activityId}/factor
    @PostMapping("/home/api/emission-projects/{id}/activities/{activityId}/factor")
    public ResponseEntity<?> emission_projects_id_activities_activityId_factor(@PathVariable Long id, @PathVariable Long activityId) {
        log.info("Contract #{}: {}", 124, "factor");
        // Entry: 기업 담당자가 활동자료 요청을 접수 완료했고 산정 담당자에게 CALCULATION 태스크가 배정되어 있다.
        return ResponseEntity.ok().build();
    }

    // auto-map - POST /home/api/emission-projects/{id}/activities/auto-map
    @PostMapping("/home/api/emission-projects/{id}/activities/auto-map")
    public ResponseEntity<?> emission_projects_id_activities_auto_map(@PathVariable Long id) {
        log.info("Contract #{}: {}", 124, "auto-map");
        // Entry: 기업 담당자가 활동자료 요청을 접수 완료했고 산정 담당자에게 CALCULATION 태스크가 배정되어 있다.
        return ResponseEntity.ok().build();
    }

    // calculation - POST /home/api/emission-projects/{id}/calculation
    @PostMapping("/home/api/emission-projects/{id}/calculation")
    public ResponseEntity<?> emission_projects_id_calculation(@PathVariable Long id) {
        log.info("Contract #{}: {}", 124, "calculation");
        // Entry: 기업 담당자가 활동자료 요청을 접수 완료했고 산정 담당자에게 CALCULATION 태스크가 배정되어 있다.
        return ResponseEntity.ok().build();
    }
}
