package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class C130_보고서작성확정Service {
    // reports
    public Object emission_projects_id_reports(Long id) {
        log.info("Contract #{}: {}", 130, "reports");
        return null;
    }

    // finalize
    public Object emission_projects_id_reports_reportId_finalize(Long id, Long reportId) {
        log.info("Contract #{}: {}", 130, "finalize");
        return null;
    }
}
