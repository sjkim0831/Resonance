package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class C585_인증서PDF발급관리Service {
    // proofread
    public Object admin_api_admin_emission_survey_report_proofread() {
        log.info("Contract #{}: {}", 585, "proofread");
        return null;
    }

    // issue-pdf
    public Object admin_api_admin_emission_survey_report_issue_pdf() {
        log.info("Contract #{}: {}", 585, "issue-pdf");
        return null;
    }

    // verify
    public Object admin_api_admin_emission_survey_report_verify() {
        log.info("Contract #{}: {}", 585, "verify");
        return null;
    }

    // verify-ocr
    public Object admin_api_admin_emission_survey_report_verify_ocr() {
        log.info("Contract #{}: {}", 585, "verify-ocr");
        return null;
    }
}
