package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class C247_공개진위확인완료Service {
    // {certificateId}
    public Object api_public_report_certificates_certificateId(Long certificateId) {
        log.info("Contract #{}: {}", 247, "{certificateId}");
        return null;
    }

    // verify
    public Object api_home_certificate_verify_verify() {
        log.info("Contract #{}: {}", 247, "verify");
        return null;
    }

    // verify-ocr
    public Object api_home_certificate_verify_verify_ocr() {
        log.info("Contract #{}: {}", 247, "verify-ocr");
        return null;
    }
}
