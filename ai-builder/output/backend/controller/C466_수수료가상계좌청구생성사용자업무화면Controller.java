package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class C466_수수료가상계좌청구생성사용자업무화면Controller {

    private final C466_수수료가상계좌청구생성사용자업무화면Service service;

    // cftr_bill - GET /api/work/certificate-fee-tax-refund/cftr_bill
    @GetMapping("/api/work/certificate-fee-tax-refund/cftr_bill")
    public ResponseEntity<?> api_work_certificate_fee_tax_refund_cftr_bill() {
        log.info("Contract #{}: {}", 466, "cftr_bill");
        // Entry: 다음 프로세스 시작 조건을 충족한다: 적격성 검증을 통과한 인증 신청과 유효한 법인 청구정보가 존재한다. 현재 상태는 READY이며 서버가 테넌
        return ResponseEntity.ok().build();
    }
}
