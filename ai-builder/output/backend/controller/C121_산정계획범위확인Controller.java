package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C121_산정계획범위확인Controller {

    private final C121_산정계획범위확인Service service;

    // {id} - GET /home/api/emission-projects/{id}
    @GetMapping("/home/api/emission-projects/{id}")
    public ResponseEntity<?> emission_projects_id(@PathVariable Long id) {
        log.info("Contract #{}: {}", 121, "{id}");
        // Entry: 기업책임자가 대상 기업과 프로젝트 생성 권한을 보유하고 기준정보가 활성 상태이다.
        return ResponseEntity.ok().build();
    }

    // emission-projects - POST /home/api/emission-projects
    @PostMapping("/home/api/emission-projects")
    public ResponseEntity<?> emission_projects() {
        log.info("Contract #{}: {}", 121, "emission-projects");
        // Entry: 기업책임자가 대상 기업과 프로젝트 생성 권한을 보유하고 기준정보가 활성 상태이다.
        return ResponseEntity.ok().build();
    }
}
