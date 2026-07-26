package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class C1_프로젝트기본정보및책임확정사용자업무화면Service {
    // {id}
    public Object emission_projects_id(Long id) {
        log.info("Contract #{}: {}", 1, "{id}");
        return null;
    }

    // emission-projects
    public Object emission_projects() {
        log.info("Contract #{}: {}", 1, "emission-projects");
        return null;
    }
}
