package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C242_활동자료수집제출Controller {

    private final C242_활동자료수집제출Service service;

    // activities - GET /home/api/emission-projects/{id}/activities
    @GetMapping("/home/api/emission-projects/{id}/activities")
    public ResponseEntity<?> emission_projects_id_activities(@PathVariable Long id) {
        log.info("Contract #{}: {}", 242, "activities");
        // Entry: 프로젝트가 PLANNED이며 수집 항목, 제출 책임자와 마감이 배정되어 있다.
        return ResponseEntity.ok().build();
    }

    // activities - POST /home/api/emission-projects/{id}/activities
    @PostMapping("/home/api/emission-projects/{id}/activities")
    public ResponseEntity<?> emission_projects_id_activities(@PathVariable Long id) {
        log.info("Contract #{}: {}", 242, "activities");
        // Entry: 프로젝트가 PLANNED이며 수집 항목, 제출 책임자와 마감이 배정되어 있다.
        return ResponseEntity.ok().build();
    }

    // submissions - GET /home/api/emission-projects/{id}/submissions
    @GetMapping("/home/api/emission-projects/{id}/submissions")
    public ResponseEntity<?> emission_projects_id_submissions(@PathVariable Long id) {
        log.info("Contract #{}: {}", 242, "submissions");
        // Entry: 프로젝트가 PLANNED이며 수집 항목, 제출 책임자와 마감이 배정되어 있다.
        return ResponseEntity.ok().build();
    }

    // submissions - POST /home/api/emission-projects/{id}/submissions
    @PostMapping("/home/api/emission-projects/{id}/submissions")
    public ResponseEntity<?> emission_projects_id_submissions(@PathVariable Long id) {
        log.info("Contract #{}: {}", 242, "submissions");
        // Entry: 프로젝트가 PLANNED이며 수집 항목, 제출 책임자와 마감이 배정되어 있다.
        return ResponseEntity.ok().build();
    }
}
