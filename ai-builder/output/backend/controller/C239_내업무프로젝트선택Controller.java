package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C239_내업무프로젝트선택Controller {

    private final C239_내업무프로젝트선택Service service;

    // emission-tasks - GET /home/api/emission-tasks
    @GetMapping("/home/api/emission-tasks")
    public ResponseEntity<?> emission_tasks() {
        log.info("Contract #{}: {}", 239, "emission-tasks");
        // Entry: 기업책임자가 대상 기업과 프로젝트 생성 권한을 보유하고 기준정보가 활성 상태이다.
        return ResponseEntity.ok().build();
    }

    // completion - GET /home/api/emission-projects/{id}/completion
    @GetMapping("/home/api/emission-projects/{id}/completion")
    public ResponseEntity<?> emission_projects_id_completion(@PathVariable Long id) {
        log.info("Contract #{}: {}", 239, "completion");
        // Entry: 기업책임자가 대상 기업과 프로젝트 생성 권한을 보유하고 기준정보가 활성 상태이다.
        return ResponseEntity.ok().build();
    }
}
