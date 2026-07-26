package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class C10_데이터산정결과검증관리자업무화면Service {
    // quality
    public Object emission_projects_id_quality(Long id) {
        log.info("Contract #{}: {}", 10, "quality");
        return null;
    }

    // quality
    public Object emission_projects_id_quality(Long id) {
        log.info("Contract #{}: {}", 10, "quality");
        return null;
    }

    // review-workflow
    public Object emission_projects_id_review_workflow(Long id) {
        log.info("Contract #{}: {}", 10, "review-workflow");
        return null;
    }

    // start
    public Object emission_projects_id_submissions_submissionId_verification_start(Long id, Long submissionId) {
        log.info("Contract #{}: {}", 10, "start");
        return null;
    }

    // decision
    public Object emission_projects_id_submissions_submissionId_verification_decision(Long id, Long submissionId) {
        log.info("Contract #{}: {}", 10, "decision");
        return null;
    }
}
