package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class C68_활동자료증빙수집관리자업무화면Service {
    // LOAD_ACTIVITIES
    public Object emission_projects_id_activities(Long id) {
        log.info("Contract #{}: {}", 68, "LOAD_ACTIVITIES");
        return null;
    }

    // CREATE_ACTIVITY
    public Object emission_projects_id_activities(Long id) {
        log.info("Contract #{}: {}", 68, "CREATE_ACTIVITY");
        return null;
    }

    // LOAD_ACTIVITY
    public Object emission_projects_id_activities_activityId(Long id, Long activityId) {
        log.info("Contract #{}: {}", 68, "LOAD_ACTIVITY");
        return null;
    }

    // UPDATE_ACTIVITY
    public Object emission_projects_id_activities_activityId(Long id, Long activityId) {
        log.info("Contract #{}: {}", 68, "UPDATE_ACTIVITY");
        return null;
    }

    // DELETE_ACTIVITY
    public Object emission_projects_id_activities_activityId(Long id, Long activityId) {
        log.info("Contract #{}: {}", 68, "DELETE_ACTIVITY");
        return null;
    }

    // LOAD_EVIDENCE
    public Object emission_projects_id_activities_activityId_evidence(Long id, Long activityId) {
        log.info("Contract #{}: {}", 68, "LOAD_EVIDENCE");
        return null;
    }

    // UPLOAD_EVIDENCE
    public Object emission_projects_id_activities_activityId_evidence(Long id, Long activityId) {
        log.info("Contract #{}: {}", 68, "UPLOAD_EVIDENCE");
        return null;
    }

    // DELETE_EVIDENCE
    public Object emission_projects_id_activities_activityId_evidence_evidenceId(Long id, Long activityId, Long evidenceId) {
        log.info("Contract #{}: {}", 68, "DELETE_EVIDENCE");
        return null;
    }
}
