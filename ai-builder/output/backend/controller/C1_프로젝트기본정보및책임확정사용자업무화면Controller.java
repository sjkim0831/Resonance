package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C1_프로젝트기본정보및책임확정사용자업무화면Controller {

    private final C1_프로젝트기본정보및책임확정사용자업무화면Service service;

    // {id} - GET /home/api/emission-projects/{id}
    @GetMapping("/home/api/emission-projects/{id}")
    public ResponseEntity<?> emission_projects_id(@PathVariable Long id) {
        log.info("Contract #{}: {}", 1, "{id}");
        // Entry: 기업책임자가 대상 기업과 프로젝트 생성 권한을 보유하고 기준정보가 활성 상태이다.
        return ResponseEntity.ok().build();
    }

    // emission-projects - POST /home/api/emission-projects
    @PostMapping("/home/api/emission-projects")
    public ResponseEntity<?> emission_projects() {
        log.info("Contract #{}: {}", 1, "emission-projects");
        // Entry: 기업책임자가 대상 기업과 프로젝트 생성 권한을 보유하고 기준정보가 활성 상태이다.
        return ResponseEntity.ok().build();
    }
}
