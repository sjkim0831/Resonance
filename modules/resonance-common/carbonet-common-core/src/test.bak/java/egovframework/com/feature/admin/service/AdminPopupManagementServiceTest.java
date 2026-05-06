package egovframework.com.feature.admin.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdminPopupManagementServiceTest {

    @Test
    void buildListPayloadFiltersPopupRowsByStatusAndAudience() {
        AdminPopupManagementService service = new AdminPopupManagementService(new ObjectMapper());

        Map<String, Object> payload = service.buildListPayload("", "ACTIVE", "MEMBER", "", false);

        @SuppressWarnings("unchecked")
        List<Map<String, String>> rows = (List<Map<String, String>>) payload.get("popupRows");
        @SuppressWarnings("unchecked")
        Map<String, String> selected = (Map<String, String>) payload.get("selectedPopup");

        assertEquals("A0040203", payload.get("menuCode"));
        assertEquals(1, rows.size());
        assertEquals("POPUP-2026-024", rows.get(0).get("popupId"));
        assertEquals("ACTIVE", rows.get(0).get("exposureStatus"));
        assertEquals("MEMBER", rows.get(0).get("targetAudience"));
        assertEquals("회원", rows.get(0).get("targetAudienceLabel"));
        assertEquals("POPUP-2026-024", selected.get("popupId"));
    }

    @Test
    void buildListPayloadKeepsRequestedSelectionOutsideCurrentFilter() {
        AdminPopupManagementService service = new AdminPopupManagementService(new ObjectMapper());

        Map<String, Object> payload = service.buildListPayload("운영", "ACTIVE", "", "POPUP-2026-031", false);

        @SuppressWarnings("unchecked")
        List<Map<String, String>> rows = (List<Map<String, String>>) payload.get("popupRows");
        @SuppressWarnings("unchecked")
        Map<String, String> selected = (Map<String, String>) payload.get("selectedPopup");

        assertFalse(rows.isEmpty());
        assertTrue(rows.stream().allMatch(row -> "ACTIVE".equals(row.get("exposureStatus"))));
        assertEquals("POPUP-2026-031", selected.get("popupId"));
        assertEquals("분기 운영 공지 팝업", selected.get("popupTitle"));
        assertEquals("예약", selected.get("exposureStatusLabel"));
    }
}
