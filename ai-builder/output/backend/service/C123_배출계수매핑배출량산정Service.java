package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class C123_배출계수매핑배출량산정Service {
    // calculation
    public Object emission_projects_id_calculation(Long id) {
        log.info("Contract #{}: {}", 123, "calculation");
        return null;
    }

    // factor
    public Object emission_projects_id_activities_activityId_factor(Long id, Long activityId) {
        log.info("Contract #{}: {}", 123, "factor");
        return null;
    }

    // auto-map
    public Object emission_projects_id_activities_auto_map(Long id) {
        log.info("Contract #{}: {}", 123, "auto-map");
        return null;
    }

    // calculation
    public Object emission_projects_id_calculation(Long id) {
        log.info("Contract #{}: {}", 123, "calculation");
        return null;
    }
}
