package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C510_법인사업장소유구조수집관리자업무화면Controller {

    private final C510_법인사업장소유구조수집관리자업무화면Service service;

    // organizational-boundary - GET /home/api/emission-projects/{id}/organizational-boundary
    @GetMapping("/home/api/emission-projects/{id}/organizational-boundary")
    public ResponseEntity<?> emission_projects_id_organizational_boundary(@PathVariable Long id) {
        log.info("Contract #{}: {}", 510, "organizational-boundary");
        // Entry: READY 상태이며 회사 담당자가 해당 테넌트와 프로젝트에 배정되어 있다.
        return ResponseEntity.ok().build();
    }

    // organizational-boundary - PUT /home/api/emission-projects/{id}/organizational-boundary
    @PutMapping("/home/api/emission-projects/{id}/organizational-boundary")
    public ResponseEntity<?> emission_projects_id_organizational_boundary(@PathVariable Long id) {
        log.info("Contract #{}: {}", 510, "organizational-boundary");
        // Entry: READY 상태이며 회사 담당자가 해당 테넌트와 프로젝트에 배정되어 있다.
        return ResponseEntity.ok().build();
    }
}
