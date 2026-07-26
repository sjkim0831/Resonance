package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C6_활동자료증빙수집관리자업무화면Controller {

    private final C6_활동자료증빙수집관리자업무화면Service service;

    // activities - GET /home/api/emission-projects/{id}/activities
    @GetMapping("/home/api/emission-projects/{id}/activities")
    public ResponseEntity<?> emission_projects_id_activities(@PathVariable Long id) {
        log.info("Contract #{}: {}", 6, "activities");
        // Entry: 프로젝트가 PLANNED이며 수집 항목, 제출 책임자와 마감이 배정되어 있다.
        return ResponseEntity.ok().build();
    }

    // activities - POST /home/api/emission-projects/{id}/activities
    @PostMapping("/home/api/emission-projects/{id}/activities")
    public ResponseEntity<?> emission_projects_id_activities(@PathVariable Long id) {
        log.info("Contract #{}: {}", 6, "activities");
        // Entry: 프로젝트가 PLANNED이며 수집 항목, 제출 책임자와 마감이 배정되어 있다.
        return ResponseEntity.ok().build();
    }

    // upload - POST /home/api/emission-projects/{id}/activities/upload
    @PostMapping("/home/api/emission-projects/{id}/activities/upload")
    public ResponseEntity<?> emission_projects_id_activities_upload(@PathVariable Long id) {
        log.info("Contract #{}: {}", 6, "upload");
        // Entry: 프로젝트가 PLANNED이며 수집 항목, 제출 책임자와 마감이 배정되어 있다.
        return ResponseEntity.ok().build();
    }

    // quality - GET /home/api/emission-projects/{id}/quality
    @GetMapping("/home/api/emission-projects/{id}/quality")
    public ResponseEntity<?> emission_projects_id_quality(@PathVariable Long id) {
        log.info("Contract #{}: {}", 6, "quality");
        // Entry: 프로젝트가 PLANNED이며 수집 항목, 제출 책임자와 마감이 배정되어 있다.
        return ResponseEntity.ok().build();
    }

    // quality - POST /home/api/emission-projects/{id}/quality
    @PostMapping("/home/api/emission-projects/{id}/quality")
    public ResponseEntity<?> emission_projects_id_quality(@PathVariable Long id) {
        log.info("Contract #{}: {}", 6, "quality");
        // Entry: 프로젝트가 PLANNED이며 수집 항목, 제출 책임자와 마감이 배정되어 있다.
        return ResponseEntity.ok().build();
    }

    // submissions - GET /home/api/emission-projects/{id}/submissions
    @GetMapping("/home/api/emission-projects/{id}/submissions")
    public ResponseEntity<?> emission_projects_id_submissions(@PathVariable Long id) {
        log.info("Contract #{}: {}", 6, "submissions");
        // Entry: 프로젝트가 PLANNED이며 수집 항목, 제출 책임자와 마감이 배정되어 있다.
        return ResponseEntity.ok().build();
    }

    // submissions - POST /home/api/emission-projects/{id}/submissions
    @PostMapping("/home/api/emission-projects/{id}/submissions")
    public ResponseEntity<?> emission_projects_id_submissions(@PathVariable Long id) {
        log.info("Contract #{}: {}", 6, "submissions");
        // Entry: 프로젝트가 PLANNED이며 수집 항목, 제출 책임자와 마감이 배정되어 있다.
        return ResponseEntity.ok().build();
    }

    // submit - POST /home/api/emission-projects/{id}/submissions/{submissionId}/submit
    @PostMapping("/home/api/emission-projects/{id}/submissions/{submissionId}/submit")
    public ResponseEntity<?> emission_projects_id_submissions_submissionId_submit(@PathVariable Long id, @PathVariable Long submissionId) {
        log.info("Contract #{}: {}", 6, "submit");
        // Entry: 프로젝트가 PLANNED이며 수집 항목, 제출 책임자와 마감이 배정되어 있다.
        return ResponseEntity.ok().build();
    }
}
