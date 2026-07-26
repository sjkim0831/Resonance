package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class C132_인증서발급다운로드감사Service {
    // issue
    public Object emission_projects_id_reports_reportId_issue(Long id, Long reportId) {
        log.info("Contract #{}: {}", 132, "issue");
        return null;
    }

    // download
    public Object emission_projects_id_reports_reportId_download(Long id, Long reportId) {
        log.info("Contract #{}: {}", 132, "download");
        return null;
    }

    // report-access-history
    public Object report_access_history() {
        log.info("Contract #{}: {}", 132, "report-access-history");
        return null;
    }
}
