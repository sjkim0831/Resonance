package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C514_내부거래제거통합계산관리자업무화면Controller {

    private final C514_내부거래제거통합계산관리자업무화면Service service;

    // consolidate - POST /home/api/emission-projects/{id}/organizational-boundary/consolidate
    @PostMapping("/home/api/emission-projects/{id}/organizational-boundary/consolidate")
    public ResponseEntity<?> emission_projects_id_organizational_boundary_consolidate(@PathVariable Long id) {
        log.info("Contract #{}: {}", 514, "consolidate");
        // Entry: STEP_2_COMPLETED
        return ResponseEntity.ok().build();
    }
}
