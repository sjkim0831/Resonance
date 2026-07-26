package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class C311_운전계획허용범위설정관리자업무화면Service {
    // fom_plan
    public Object api_ccus_facility_facility_operation_monitoring_fom_plan() {
        log.info("Contract #{}: {}", 311, "fom_plan");
        return null;
    }
}
