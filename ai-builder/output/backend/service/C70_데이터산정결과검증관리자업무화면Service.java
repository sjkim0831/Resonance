package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class C70_데이터산정결과검증관리자업무화면Service {
    // LOAD_REVIEW_WORKFLOW
    public Object emission_projects_id_review_workflow(Long id) {
        log.info("Contract #{}: {}", 70, "LOAD_REVIEW_WORKFLOW");
        return null;
    }

    // START_VERIFICATION
    public Object emission_projects_id_submissions_submissionId_verification_start(Long id, Long submissionId) {
        log.info("Contract #{}: {}", 70, "START_VERIFICATION");
        return null;
    }

    // DECIDE_VERIFICATION
    public Object emission_projects_id_submissions_submissionId_verification_decision(Long id, Long submissionId) {
        log.info("Contract #{}: {}", 70, "DECIDE_VERIFICATION");
        return null;
    }
}
