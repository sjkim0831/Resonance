package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class C554_회원가입1단계회원유형선택Service {
    // session
    public Object join_api_session() {
        log.info("Contract #{}: {}", 554, "session");
        return null;
    }

    // step1
    public Object join_api_step1() {
        log.info("Contract #{}: {}", 554, "step1");
        return null;
    }

    // reset
    public Object join_api_reset() {
        log.info("Contract #{}: {}", 554, "reset");
        return null;
    }
}
