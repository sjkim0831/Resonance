package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class C121_산정계획범위확인Service {
    // {id}
    public Object emission_projects_id(Long id) {
        log.info("Contract #{}: {}", 121, "{id}");
        return null;
    }

    // emission-projects
    public Object emission_projects() {
        log.info("Contract #{}: {}", 121, "emission-projects");
        return null;
    }
}
