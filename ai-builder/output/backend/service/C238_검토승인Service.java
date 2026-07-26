package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class C238_검토승인Service {
    // review-workflow
    public Object emission_projects_projectId_review_workflow(Long projectId) {
        log.info("Contract #{}: {}", 238, "review-workflow");
        return null;
    }

    // start
    public Object emission_projects_projectId_submissions_submissionId_verification_start(Long projectId, Long submissionId) {
        log.info("Contract #{}: {}", 238, "start");
        return null;
    }

    // decision
    public Object emission_projects_projectId_submissions_submissionId_verification_decision(Long projectId, Long submissionId) {
        log.info("Contract #{}: {}", 238, "decision");
        return null;
    }

    // decision
    public Object emission_projects_projectId_submissions_submissionId_approval_decision(Long projectId, Long submissionId) {
        log.info("Contract #{}: {}", 238, "decision");
        return null;
    }
}
