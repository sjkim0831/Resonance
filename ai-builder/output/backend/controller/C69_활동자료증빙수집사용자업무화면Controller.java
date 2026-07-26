package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C69_활동자료증빙수집사용자업무화면Controller {

    private final C69_활동자료증빙수집사용자업무화면Service service;

    // LOAD_ACTIVITIES - GET /home/api/emission-projects/{id}/activities
    @GetMapping("/home/api/emission-projects/{id}/activities")
    public ResponseEntity<?> emission_projects_id_activities(@PathVariable Long id) {
        log.info("Contract #{}: {}", 69, "LOAD_ACTIVITIES");
        // Entry: 프로젝트가 PLANNED이며 수집 항목, 제출 책임자와 마감이 배정되어 있다.
        return ResponseEntity.ok().build();
    }

    // CREATE_ACTIVITY - POST /home/api/emission-projects/{id}/activities
    @PostMapping("/home/api/emission-projects/{id}/activities")
    public ResponseEntity<?> emission_projects_id_activities(@PathVariable Long id) {
        log.info("Contract #{}: {}", 69, "CREATE_ACTIVITY");
        // Entry: 프로젝트가 PLANNED이며 수집 항목, 제출 책임자와 마감이 배정되어 있다.
        return ResponseEntity.ok().build();
    }

    // LOAD_ACTIVITY - GET /home/api/emission-projects/{id}/activities/{activityId}
    @GetMapping("/home/api/emission-projects/{id}/activities/{activityId}")
    public ResponseEntity<?> emission_projects_id_activities_activityId(@PathVariable Long id, @PathVariable Long activityId) {
        log.info("Contract #{}: {}", 69, "LOAD_ACTIVITY");
        // Entry: 프로젝트가 PLANNED이며 수집 항목, 제출 책임자와 마감이 배정되어 있다.
        return ResponseEntity.ok().build();
    }

    // UPDATE_ACTIVITY - POST /home/api/emission-projects/{id}/activities/{activityId}
    @PostMapping("/home/api/emission-projects/{id}/activities/{activityId}")
    public ResponseEntity<?> emission_projects_id_activities_activityId(@PathVariable Long id, @PathVariable Long activityId) {
        log.info("Contract #{}: {}", 69, "UPDATE_ACTIVITY");
        // Entry: 프로젝트가 PLANNED이며 수집 항목, 제출 책임자와 마감이 배정되어 있다.
        return ResponseEntity.ok().build();
    }

    // DELETE_ACTIVITY - DELETE /home/api/emission-projects/{id}/activities/{activityId}
    @DeleteMapping("/home/api/emission-projects/{id}/activities/{activityId}")
    public ResponseEntity<?> emission_projects_id_activities_activityId(@PathVariable Long id, @PathVariable Long activityId) {
        log.info("Contract #{}: {}", 69, "DELETE_ACTIVITY");
        // Entry: 프로젝트가 PLANNED이며 수집 항목, 제출 책임자와 마감이 배정되어 있다.
        return ResponseEntity.ok().build();
    }

    // LOAD_EVIDENCE - GET /home/api/emission-projects/{id}/activities/{activityId}/evidence
    @GetMapping("/home/api/emission-projects/{id}/activities/{activityId}/evidence")
    public ResponseEntity<?> emission_projects_id_activities_activityId_evidence(@PathVariable Long id, @PathVariable Long activityId) {
        log.info("Contract #{}: {}", 69, "LOAD_EVIDENCE");
        // Entry: 프로젝트가 PLANNED이며 수집 항목, 제출 책임자와 마감이 배정되어 있다.
        return ResponseEntity.ok().build();
    }

    // UPLOAD_EVIDENCE - POST /home/api/emission-projects/{id}/activities/{activityId}/evidence
    @PostMapping("/home/api/emission-projects/{id}/activities/{activityId}/evidence")
    public ResponseEntity<?> emission_projects_id_activities_activityId_evidence(@PathVariable Long id, @PathVariable Long activityId) {
        log.info("Contract #{}: {}", 69, "UPLOAD_EVIDENCE");
        // Entry: 프로젝트가 PLANNED이며 수집 항목, 제출 책임자와 마감이 배정되어 있다.
        return ResponseEntity.ok().build();
    }

    // DELETE_EVIDENCE - DELETE /home/api/emission-projects/{id}/activities/{activityId}/evidence/{evidenceId}
    @DeleteMapping("/home/api/emission-projects/{id}/activities/{activityId}/evidence/{evidenceId}")
    public ResponseEntity<?> emission_projects_id_activities_activityId_evidence_evidenceId(@PathVariable Long id, @PathVariable Long activityId, @PathVariable Long evidenceId) {
        log.info("Contract #{}: {}", 69, "DELETE_EVIDENCE");
        // Entry: 프로젝트가 PLANNED이며 수집 항목, 제출 책임자와 마감이 배정되어 있다.
        return ResponseEntity.ok().build();
    }
}
