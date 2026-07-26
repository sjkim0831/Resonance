package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class C553_RegistrationStep1MembershipTypeService {
    // session
    public Object join_api_session() {
        log.info("Contract #{}: {}", 553, "session");
        return null;
    }

    // step1
    public Object join_api_step1() {
        log.info("Contract #{}: {}", 553, "step1");
        return null;
    }

    // reset
    public Object join_api_reset() {
        log.info("Contract #{}: {}", 553, "reset");
        return null;
    }
}
