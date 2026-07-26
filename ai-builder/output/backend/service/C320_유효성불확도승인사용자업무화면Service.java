package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class C320_유효성불확도승인사용자업무화면Service {
    // mcm_approve
    public Object api_ccus_facility_meter_calibration_management_mcm_approve() {
        log.info("Contract #{}: {}", 320, "mcm_approve");
        return null;
    }
}
