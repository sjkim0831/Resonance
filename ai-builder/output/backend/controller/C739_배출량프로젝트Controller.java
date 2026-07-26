package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C739_배출량프로젝트Controller {

    private final C739_배출량프로젝트Service service;

    // emission-projects - GET /home/api/emission-projects
    @GetMapping("/home/api/emission-projects")
    public ResponseEntity<?> emission_projects() {
        log.info("Contract #{}: {}", 739, "emission-projects");
        // Entry: 인증 계정, 테넌트, 활성 프로젝트 액터 배정 또는 명시적 webmaster 운영 범위가 확인된다.
        return ResponseEntity.ok().build();
    }

    // {id} - GET /home/api/emission-projects/{id}
    @GetMapping("/home/api/emission-projects/{id}")
    public ResponseEntity<?> emission_projects_id(@PathVariable Long id) {
        log.info("Contract #{}: {}", 739, "{id}");
        // Entry: 인증 계정, 테넌트, 활성 프로젝트 액터 배정 또는 명시적 webmaster 운영 범위가 확인된다.
        return ResponseEntity.ok().build();
    }

    // {id} - DELETE /home/api/emission-projects/{id}
    @DeleteMapping("/home/api/emission-projects/{id}")
    public ResponseEntity<?> emission_projects_id(@PathVariable Long id) {
        log.info("Contract #{}: {}", 739, "{id}");
        // Entry: 인증 계정, 테넌트, 활성 프로젝트 액터 배정 또는 명시적 webmaster 운영 범위가 확인된다.
        return ResponseEntity.ok().build();
    }
}
