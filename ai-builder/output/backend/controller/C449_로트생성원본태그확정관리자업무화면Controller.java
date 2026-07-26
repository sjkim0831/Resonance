package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C449_로트생성원본태그확정관리자업무화면Controller {

    private final C449_로트생성원본태그확정관리자업무화면Service service;

    // clt_create - GET /api/work/co2-lot-tag-management/clt_create
    @GetMapping("/api/work/co2-lot-tag-management/clt_create")
    public ResponseEntity<?> api_work_co2_lot_tag_management_clt_create() {
        log.info("Contract #{}: {}", 449, "clt_create");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 승인된 포집 기업·설비·계측기와 생산 실적이 존재한다. 현재 상태는 READY이며 서버가 테넌트·프로젝트·
        return ResponseEntity.ok().build();
    }
}
