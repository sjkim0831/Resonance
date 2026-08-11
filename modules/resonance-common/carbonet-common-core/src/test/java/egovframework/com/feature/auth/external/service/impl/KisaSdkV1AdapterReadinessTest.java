package egovframework.com.feature.auth.external.service.impl;

import egovframework.com.feature.auth.external.config.ExternalAuthProperties;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class KisaSdkV1AdapterReadinessTest {

    @Test
    void requiresEveryProviderSettingAndNeverClaimsUnimplementedOrchestration() {
        ExternalAuthProperties properties = new ExternalAuthProperties();
        KisaSdkV1Adapter adapter = new KisaSdkV1Adapter(properties);
        assertFalse(adapter.hasCompleteLiveConfiguration());

        ExternalAuthProperties.Kisa kisa = properties.getKisa();
        kisa.setClientId("client");
        kisa.setServiceCode("service");
        kisa.setCaCode("ca");
        kisa.setPrepareEndpoint("https://provider.invalid/prepare");
        kisa.setResultEndpoint("https://provider.invalid/result");
        assertFalse(adapter.hasCompleteLiveConfiguration());

        kisa.setCallbackScheme("carbonet://identity/callback");
        assertTrue(adapter.hasCompleteLiveConfiguration());
        assertFalse(adapter.isLiveOrchestrationImplemented());
        assertFalse(adapter.isReadyForLiveFlow());
    }
}
