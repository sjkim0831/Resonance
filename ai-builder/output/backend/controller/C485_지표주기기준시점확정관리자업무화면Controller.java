package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C485_지표주기기준시점확정관리자업무화면Controller {

    private final C485_지표주기기준시점확정관리자업무화면Service service;

    // ssr_define - GET /api/work/scheduled-statistics-reporting/ssr_define
    @GetMapping("/api/work/scheduled-statistics-reporting/ssr_define")
    public ResponseEntity<?> api_work_scheduled_statistics_reporting_ssr_define() {
        log.info("Contract #{}: {}", 485, "ssr_define");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 지표 정의·집계 기준·데이터 기준시점·수신기관·일정이 승인되어 있다. 현재 상태는 READY이며 서버가 테
        return ResponseEntity.ok().build();
    }
}
