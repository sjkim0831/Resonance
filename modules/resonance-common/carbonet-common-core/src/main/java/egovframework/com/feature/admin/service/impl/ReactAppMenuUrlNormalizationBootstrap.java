package egovframework.com.feature.admin.service.impl;

import egovframework.com.common.util.ReactPageUrlMapper;
import egovframework.com.platform.menu.dto.MenuInfoDTO;
import egovframework.com.platform.governance.service.AdminCodeManageService;
import egovframework.com.platform.menu.service.MenuInfoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class ReactAppMenuUrlNormalizationBootstrap {

    private static final String ACTOR_ID = "SYSTEM_BOOTSTRAP";

    private final MenuInfoService menuInfoService;
    private final AdminCodeManageService adminCodeManageService;

    @EventListener(ApplicationReadyEvent.class)
    public void normalizeLegacyReactMenuUrls() {
        try {
            List<MenuInfoDTO> rows = new ArrayList<>();
            rows.addAll(menuInfoService.selectMenuTreeList("AMENU1"));
            rows.addAll(menuInfoService.selectMenuTreeList("HMENU1"));

            int updated = 0;
            for (MenuInfoDTO row : rows) {
                String rawUrl = safe(row.getMenuUrl());
                if (!rawUrl.contains("/app?route=")) {
                    continue;
                }

                String canonicalUrl = ReactPageUrlMapper.toCanonicalMenuUrl(rawUrl);
                if (canonicalUrl.isEmpty() || canonicalUrl.equals(rawUrl)) {
                    continue;
                }

                adminCodeManageService.updatePageManagement(
                        safe(row.getCode()),
                        safe(row.getCodeNm()),
                        safe(row.getCodeDc()),
                        canonicalUrl,
                        safe(row.getMenuIcon()),
                        defaultUseAt(row.getUseAt()),
                        ACTOR_ID
                );
                updated++;
            }

            log.info("React app menu URL normalization completed. updated={}", updated);
        } catch (Exception e) {
            log.error("Failed to normalize legacy react menu URLs.", e);
        }
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String defaultUseAt(String value) {
        String normalized = safe(value);
        return normalized.isEmpty() ? "Y" : normalized;
    }
}
