package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class C4_검토승인확정관리자업무화면Service {
    // review-workflow
    public Object emission_projects_id_review_workflow(Long id) {
        log.info("Contract #{}: {}", 4, "review-workflow");
        return null;
    }

    // decision
    public Object emission_projects_id_submissions_submissionId_approval_decision(Long id, Long submissionId) {
        log.info("Contract #{}: {}", 4, "decision");
        return null;
    }
}
