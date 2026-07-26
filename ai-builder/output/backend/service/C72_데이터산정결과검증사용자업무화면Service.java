package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class C72_데이터산정결과검증사용자업무화면Service {
    // review-workflow
    public Object emission_projects_projectId_review_workflow(Long projectId) {
        log.info("Contract #{}: {}", 72, "review-workflow");
        return null;
    }

    // start
    public Object emission_projects_projectId_submissions_submissionId_verification_start(Long projectId, Long submissionId) {
        log.info("Contract #{}: {}", 72, "start");
        return null;
    }

    // decision
    public Object emission_projects_projectId_submissions_submissionId_verification_decision(Long projectId, Long submissionId) {
        log.info("Contract #{}: {}", 72, "decision");
        return null;
    }

    // decision
    public Object emission_projects_projectId_submissions_submissionId_approval_decision(Long projectId, Long submissionId) {
        log.info("Contract #{}: {}", 72, "decision");
        return null;
    }
}
