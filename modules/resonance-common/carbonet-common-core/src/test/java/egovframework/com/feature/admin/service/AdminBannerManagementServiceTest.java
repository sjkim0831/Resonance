package egovframework.com.feature.admin.service;

import egovframework.com.feature.admin.mapper.AdminBannerManagementMapper;
import egovframework.com.feature.admin.mapper.AdminBannerManagementMetaMapper;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminBannerManagementServiceTest {

    @Test
    void buildEditPayloadFallsBackToSeedBannerWhenDatabaseRowsAreUnavailable() {
        AdminBannerManagementMapper bannerMapper = mock(AdminBannerManagementMapper.class);
        AdminBannerManagementMetaMapper metaMapper = mock(AdminBannerManagementMetaMapper.class);
        AdminPagePayloadFactory payloadFactory = new AdminPagePayloadFactory();
        when(bannerMapper.selectBannerRows()).thenReturn(Collections.emptyList());
        when(metaMapper.selectBannerMetaRows()).thenReturn(Collections.emptyList());

        AdminBannerManagementService service = new AdminBannerManagementService(bannerMapper, metaMapper, payloadFactory);

        Map<String, Object> payload = service.buildEditPayload("BNR-240301", false);
        @SuppressWarnings("unchecked")
        Map<String, Object> detail = (Map<String, Object>) payload.get("bannerDetail");

        assertEquals("BNR-240301", payload.get("bannerId"));
        assertEquals("2026 배출권 거래 집중 안내", detail.get("title"));
        assertEquals("/home", detail.get("targetUrl"));
        assertEquals("LIVE", detail.get("status"));
    }

    @Test
    void saveBannerKeepsUpdatedOverlayEvenWhenDatabasePersistenceFails() {
        AdminBannerManagementMapper bannerMapper = mock(AdminBannerManagementMapper.class);
        AdminBannerManagementMetaMapper metaMapper = mock(AdminBannerManagementMetaMapper.class);
        AdminPagePayloadFactory payloadFactory = new AdminPagePayloadFactory();
        when(bannerMapper.selectBannerRows()).thenReturn(Collections.emptyList());
        when(metaMapper.selectBannerMetaRows()).thenReturn(Collections.emptyList());
        when(bannerMapper.selectBannerById("BNR-240301")).thenThrow(new RuntimeException("db unavailable"));

        AdminBannerManagementService service = new AdminBannerManagementService(bannerMapper, metaMapper, payloadFactory);

        Map<String, Object> response = service.saveBanner(
                "BNR-240301",
                "Updated English Banner",
                "/en/home",
                "PAUSED",
                "2026-04-02 09:00",
                "2026-04-20 18:00",
                true
        );

        @SuppressWarnings("unchecked")
        Map<String, Object> savedDetail = (Map<String, Object>) response.get("bannerDetail");
        @SuppressWarnings("unchecked")
        Map<String, Object> reloadedDetail = (Map<String, Object>) service.buildEditPayload("BNR-240301", true).get("bannerDetail");

        assertTrue(Boolean.TRUE.equals(response.get("saved")));
        assertEquals("Updated English Banner", savedDetail.get("title"));
        assertEquals("Updated English Banner", reloadedDetail.get("title"));
        assertEquals("/en/home", reloadedDetail.get("targetUrl"));
        assertEquals("PAUSED", reloadedDetail.get("status"));

        verify(bannerMapper).selectBannerById("BNR-240301");
    }

    @Test
    void saveBannerPersistsBannerAndMetaRowsWhenDatabasePathIsAvailable() {
        AdminBannerManagementMapper bannerMapper = mock(AdminBannerManagementMapper.class);
        AdminBannerManagementMetaMapper metaMapper = mock(AdminBannerManagementMetaMapper.class);
        AdminPagePayloadFactory payloadFactory = new AdminPagePayloadFactory();
        when(bannerMapper.selectBannerRows()).thenReturn(Collections.emptyList());
        when(metaMapper.selectBannerMetaRows()).thenReturn(Collections.emptyList());
        when(bannerMapper.selectBannerById("BNR-240301")).thenReturn(Collections.emptyMap());
        when(bannerMapper.countBannerById("BNR-240301")).thenReturn(0);
        when(metaMapper.countBannerMetaById("BNR-240301")).thenReturn(0);

        AdminBannerManagementService service = new AdminBannerManagementService(bannerMapper, metaMapper, payloadFactory);

        Map<String, Object> response = service.saveBanner(
                "BNR-240301",
                "배너 제목 변경",
                "/admin/content/banner_list",
                "LIVE",
                "2026-04-03 10:00",
                "2026-04-30 18:00",
                false
        );

        @SuppressWarnings("unchecked")
        Map<String, Object> detail = (Map<String, Object>) response.get("bannerDetail");

        assertTrue(Boolean.TRUE.equals(response.get("saved")));
        assertEquals("배너 제목 변경", detail.get("title"));
        assertEquals("/admin/content/banner_list", detail.get("targetUrl"));
        verify(bannerMapper, times(1)).insertBannerRow(anyMap());
        verify(metaMapper, times(1)).insertBannerMetaRow(anyMap());
    }
}
