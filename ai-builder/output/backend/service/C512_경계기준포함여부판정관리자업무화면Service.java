package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class C512_경계기준포함여부판정관리자업무화면Service {
    // organizational-boundary
    public Object emission_projects_id_organizational_boundary(Long id) {
        log.info("Contract #{}: {}", 512, "organizational-boundary");
        return null;
    }

    // review-ready
    public Object emission_projects_id_organizational_boundary_review_ready(Long id) {
        log.info("Contract #{}: {}", 512, "review-ready");
        return null;
    }
}
