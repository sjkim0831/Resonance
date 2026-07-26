package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class C239_내업무프로젝트선택Service {
    // emission-tasks
    public Object emission_tasks() {
        log.info("Contract #{}: {}", 239, "emission-tasks");
        return null;
    }

    // completion
    public Object emission_projects_id_completion(Long id) {
        log.info("Contract #{}: {}", 239, "completion");
        return null;
    }
}
