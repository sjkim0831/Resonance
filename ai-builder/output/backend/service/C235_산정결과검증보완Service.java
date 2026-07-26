package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class C235_산정결과검증보완Service {
    // quality
    public Object emission_projects_id_quality(Long id) {
        log.info("Contract #{}: {}", 235, "quality");
        return null;
    }

    // review-workflow
    public Object emission_projects_id_review_workflow(Long id) {
        log.info("Contract #{}: {}", 235, "review-workflow");
        return null;
    }

    // start
    public Object emission_projects_id_submissions_submissionId_verification_start(Long id, Long submissionId) {
        log.info("Contract #{}: {}", 235, "start");
        return null;
    }

    // decision
    public Object emission_projects_id_submissions_submissionId_verification_decision(Long id, Long submissionId) {
        log.info("Contract #{}: {}", 235, "decision");
        return null;
    }
}
