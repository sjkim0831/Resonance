package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class C251_감축전략시나리오Service {
    // LOAD_SIMULATION_WORKFLOW
    public Object emission_projects_id_simulation_workflow(Long id) {
        log.info("Contract #{}: {}", 251, "LOAD_SIMULATION_WORKFLOW");
        return null;
    }

    // EXECUTE_SIMULATION
    public Object emission_projects_id_simulate(Long id) {
        log.info("Contract #{}: {}", 251, "EXECUTE_SIMULATION");
        return null;
    }
}
