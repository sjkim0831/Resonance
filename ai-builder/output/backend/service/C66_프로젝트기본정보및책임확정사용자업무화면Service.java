package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class C66_프로젝트기본정보및책임확정사용자업무화면Service {
    // LOAD_PROJECT_DETAIL
    public Object emission_projects_id(Long id) {
        log.info("Contract #{}: {}", 66, "LOAD_PROJECT_DETAIL");
        return null;
    }

    // UPDATE_PROJECT
    public Object emission_projects_id(Long id) {
        log.info("Contract #{}: {}", 66, "UPDATE_PROJECT");
        return null;
    }

    // LOAD_ACTIVITY_REQUESTS
    public Object emission_projects_id_activity_requests(Long id) {
        log.info("Contract #{}: {}", 66, "LOAD_ACTIVITY_REQUESTS");
        return null;
    }

    // CREATE_ACTIVITY_REQUEST
    public Object emission_projects_id_activity_requests(Long id) {
        log.info("Contract #{}: {}", 66, "CREATE_ACTIVITY_REQUEST");
        return null;
    }

    // START_ACTIVITY
    public Object emission_projects_id_activity_requests_requestId_start(Long id, Long requestId) {
        log.info("Contract #{}: {}", 66, "START_ACTIVITY");
        return null;
    }
}
