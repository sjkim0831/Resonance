package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class C8_배출계수매핑배출량산정관리자업무화면Service {
    // calculation
    public Object emission_projects_id_calculation(Long id) {
        log.info("Contract #{}: {}", 8, "calculation");
        return null;
    }

    // factor
    public Object emission_projects_id_activities_activityId_factor(Long id, Long activityId) {
        log.info("Contract #{}: {}", 8, "factor");
        return null;
    }

    // auto-map
    public Object emission_projects_id_activities_auto_map(Long id) {
        log.info("Contract #{}: {}", 8, "auto-map");
        return null;
    }

    // calculation
    public Object emission_projects_id_calculation(Long id) {
        log.info("Contract #{}: {}", 8, "calculation");
        return null;
    }
}
