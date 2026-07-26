package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class C2834_자료입력업무수행관리자업무화면Service {
    // LOAD_SURVEY_ACTIVITIES
    public Object emission_projects_id_activities(Long id) {
        log.info("Contract #{}: {}", 2834, "LOAD_SURVEY_ACTIVITIES");
        return null;
    }

    // CREATE_SURVEY_ACTIVITY
    public Object emission_projects_id_activities(Long id) {
        log.info("Contract #{}: {}", 2834, "CREATE_SURVEY_ACTIVITY");
        return null;
    }

    // LOAD_SURVEY_ACTIVITY
    public Object emission_projects_id_activities_activityId(Long id, Long activityId) {
        log.info("Contract #{}: {}", 2834, "LOAD_SURVEY_ACTIVITY");
        return null;
    }

    // UPDATE_SURVEY_ACTIVITY
    public Object emission_projects_id_activities_activityId(Long id, Long activityId) {
        log.info("Contract #{}: {}", 2834, "UPDATE_SURVEY_ACTIVITY");
        return null;
    }

    // DELETE_SURVEY_ACTIVITY
    public Object emission_projects_id_activities_activityId(Long id, Long activityId) {
        log.info("Contract #{}: {}", 2834, "DELETE_SURVEY_ACTIVITY");
        return null;
    }

    // LOAD_SURVEY_EVIDENCE
    public Object emission_projects_id_activities_activityId_evidence(Long id, Long activityId) {
        log.info("Contract #{}: {}", 2834, "LOAD_SURVEY_EVIDENCE");
        return null;
    }

    // UPLOAD_SURVEY_EVIDENCE
    public Object emission_projects_id_activities_activityId_evidence(Long id, Long activityId) {
        log.info("Contract #{}: {}", 2834, "UPLOAD_SURVEY_EVIDENCE");
        return null;
    }

    // DELETE_SURVEY_EVIDENCE
    public Object emission_projects_id_activities_activityId_evidence_evidenceId(Long id, Long activityId, Long evidenceId) {
        log.info("Contract #{}: {}", 2834, "DELETE_SURVEY_EVIDENCE");
        return null;
    }
}
