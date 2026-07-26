package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C512_경계기준포함여부판정관리자업무화면Controller {

    private final C512_경계기준포함여부판정관리자업무화면Service service;

    // organizational-boundary - PUT /home/api/emission-projects/{id}/organizational-boundary
    @PutMapping("/home/api/emission-projects/{id}/organizational-boundary")
    public ResponseEntity<?> emission_projects_id_organizational_boundary(@PathVariable Long id) {
        log.info("Contract #{}: {}", 512, "organizational-boundary");
        // Entry: STEP_1_COMPLETED
        return ResponseEntity.ok().build();
    }

    // review-ready - POST /home/api/emission-projects/{id}/organizational-boundary/review-ready
    @PostMapping("/home/api/emission-projects/{id}/organizational-boundary/review-ready")
    public ResponseEntity<?> emission_projects_id_organizational_boundary_review_ready(@PathVariable Long id) {
        log.info("Contract #{}: {}", 512, "review-ready");
        // Entry: STEP_1_COMPLETED
        return ResponseEntity.ok().build();
    }
}
