package egovframework.com.feature.home.web;

import egovframework.com.common.menu.service.SiteMapService;
import egovframework.com.feature.home.service.HomeMenuService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class SiteMapPagePayloadService {

    private final SiteMapService siteMapService;
    private final HomeMenuService homeMenuService;

    private Map<String, Object> createPayload(boolean isEn) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("isEn", isEn);
        return payload;
    }

    public Map<String, Object> buildUserPayload(boolean isEn, boolean isLoggedIn) {
        Map<String, Object> payload = createPayload(isEn);
        payload.put("isLoggedIn", isLoggedIn);
        payload.put("homeMenu", homeMenuService.getHomeMenu(isEn));
        payload.put("siteMapSections", siteMapService.getUserSiteMap(isEn));
        return payload;
    }

    public Map<String, Object> buildAdminPayload(boolean isEn, HttpServletRequest request) {
        Map<String, Object> payload = createPayload(isEn);
        payload.put("siteMapSections", siteMapService.getAdminSiteMap(isEn, request));
        return payload;
    }
}
