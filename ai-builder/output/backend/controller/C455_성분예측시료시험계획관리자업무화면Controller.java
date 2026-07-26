package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C455_성분예측시료시험계획관리자업무화면Controller {

    private final C455_성분예측시료시험계획관리자업무화면Service service;

    // cqa_plan - GET /api/work/co2-quality-analysis/cqa_plan
    @GetMapping("/api/work/co2-quality-analysis/cqa_plan")
    public ResponseEntity<?> api_work_co2_quality_analysis_cqa_plan() {
        log.info("Contract #{}: {}", 455, "cqa_plan");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 추적 가능한 CO2 로트와 시료채취 지점, 품질 기준이 존재한다. 현재 상태는 READY이며 서버가 테넌트
        return ResponseEntity.ok().build();
    }
}
