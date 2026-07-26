package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C2834_자료입력업무수행관리자업무화면Controller {

    private final C2834_자료입력업무수행관리자업무화면Service service;

    // LOAD_SURVEY_ACTIVITIES - GET /home/api/emission-projects/{id}/activities
    @GetMapping("/home/api/emission-projects/{id}/activities")
    public ResponseEntity<?> emission_projects_id_activities(@PathVariable Long id) {
        log.info("Contract #{}: {}", 2834, "LOAD_SURVEY_ACTIVITIES");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 자료 제출 요청이 발행됨. 현재 상태는 PLANNED이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에
        return ResponseEntity.ok().build();
    }

    // CREATE_SURVEY_ACTIVITY - POST /home/api/emission-projects/{id}/activities
    @PostMapping("/home/api/emission-projects/{id}/activities")
    public ResponseEntity<?> emission_projects_id_activities(@PathVariable Long id) {
        log.info("Contract #{}: {}", 2834, "CREATE_SURVEY_ACTIVITY");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 자료 제출 요청이 발행됨. 현재 상태는 PLANNED이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에
        return ResponseEntity.ok().build();
    }

    // LOAD_SURVEY_ACTIVITY - GET /home/api/emission-projects/{id}/activities/{activityId}
    @GetMapping("/home/api/emission-projects/{id}/activities/{activityId}")
    public ResponseEntity<?> emission_projects_id_activities_activityId(@PathVariable Long id, @PathVariable Long activityId) {
        log.info("Contract #{}: {}", 2834, "LOAD_SURVEY_ACTIVITY");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 자료 제출 요청이 발행됨. 현재 상태는 PLANNED이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에
        return ResponseEntity.ok().build();
    }

    // UPDATE_SURVEY_ACTIVITY - POST /home/api/emission-projects/{id}/activities/{activityId}
    @PostMapping("/home/api/emission-projects/{id}/activities/{activityId}")
    public ResponseEntity<?> emission_projects_id_activities_activityId(@PathVariable Long id, @PathVariable Long activityId) {
        log.info("Contract #{}: {}", 2834, "UPDATE_SURVEY_ACTIVITY");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 자료 제출 요청이 발행됨. 현재 상태는 PLANNED이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에
        return ResponseEntity.ok().build();
    }

    // DELETE_SURVEY_ACTIVITY - DELETE /home/api/emission-projects/{id}/activities/{activityId}
    @DeleteMapping("/home/api/emission-projects/{id}/activities/{activityId}")
    public ResponseEntity<?> emission_projects_id_activities_activityId(@PathVariable Long id, @PathVariable Long activityId) {
        log.info("Contract #{}: {}", 2834, "DELETE_SURVEY_ACTIVITY");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 자료 제출 요청이 발행됨. 현재 상태는 PLANNED이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에
        return ResponseEntity.ok().build();
    }

    // LOAD_SURVEY_EVIDENCE - GET /home/api/emission-projects/{id}/activities/{activityId}/evidence
    @GetMapping("/home/api/emission-projects/{id}/activities/{activityId}/evidence")
    public ResponseEntity<?> emission_projects_id_activities_activityId_evidence(@PathVariable Long id, @PathVariable Long activityId) {
        log.info("Contract #{}: {}", 2834, "LOAD_SURVEY_EVIDENCE");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 자료 제출 요청이 발행됨. 현재 상태는 PLANNED이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에
        return ResponseEntity.ok().build();
    }

    // UPLOAD_SURVEY_EVIDENCE - POST /home/api/emission-projects/{id}/activities/{activityId}/evidence
    @PostMapping("/home/api/emission-projects/{id}/activities/{activityId}/evidence")
    public ResponseEntity<?> emission_projects_id_activities_activityId_evidence(@PathVariable Long id, @PathVariable Long activityId) {
        log.info("Contract #{}: {}", 2834, "UPLOAD_SURVEY_EVIDENCE");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 자료 제출 요청이 발행됨. 현재 상태는 PLANNED이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에
        return ResponseEntity.ok().build();
    }

    // DELETE_SURVEY_EVIDENCE - DELETE /home/api/emission-projects/{id}/activities/{activityId}/evidence/{evidenceId}
    @DeleteMapping("/home/api/emission-projects/{id}/activities/{activityId}/evidence/{evidenceId}")
    public ResponseEntity<?> emission_projects_id_activities_activityId_evidence_evidenceId(@PathVariable Long id, @PathVariable Long activityId, @PathVariable Long evidenceId) {
        log.info("Contract #{}: {}", 2834, "DELETE_SURVEY_EVIDENCE");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 자료 제출 요청이 발행됨. 현재 상태는 PLANNED이며 서버가 테넌트·프로젝트·액터 권한을 확인한 경우에
        return ResponseEntity.ok().build();
    }
}
