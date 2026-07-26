package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C516_경계승인버전확정관리자업무화면Controller {

    private final C516_경계승인버전확정관리자업무화면Service service;

    // decision - POST /home/api/emission-projects/{id}/organizational-boundary/decision
    @PostMapping("/home/api/emission-projects/{id}/organizational-boundary/decision")
    public ResponseEntity<?> emission_projects_id_organizational_boundary_decision(@PathVariable Long id) {
        log.info("Contract #{}: {}", 516, "decision");
        // Entry: STEP_3_COMPLETED
        return ResponseEntity.ok().build();
    }
}
