package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C472_위임승계요청과후보검증사용자업무화면Controller {

    private final C472_위임승계요청과후보검증사용자업무화면Service service;

    // cmd_request - GET /api/work/company-manager-delegation/cmd_request
    @GetMapping("/api/work/company-manager-delegation/cmd_request")
    public ResponseEntity<?> api_work_company_manager_delegation_cmd_request() {
        log.info("Contract #{}: {}", 472, "cmd_request");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 승인된 회원사와 유효한 기존·후임 담당자 후보가 존재한다. 현재 상태는 READY이며 서버가 테넌트·프로젝
        return ResponseEntity.ok().build();
    }
}
