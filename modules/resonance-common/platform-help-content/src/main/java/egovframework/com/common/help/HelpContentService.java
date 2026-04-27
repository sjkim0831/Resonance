package egovframework.com.common.help;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.common.mapper.HelpContentMapper;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class HelpContentService {

    private final ObjectMapper objectMapper;
    private final HelpContentMapper helpContentMapper;

    public HelpContentService(ObjectMapper objectMapper, HelpContentMapper helpContentMapper) {
        this.objectMapper = objectMapper;
        this.helpContentMapper = helpContentMapper;
    }

    public Map<String, Object> getPageHelp(String pageId) {
        String normalizedPageId = pageId == null ? "" : pageId.trim();
        if (normalizedPageId.isEmpty()) {
            return defaultResponse();
        }
        Map<String, Object> dbContent = readFromDb(normalizedPageId, true);
        if (!isEmpty(dbContent)) {
            return dbContent;
        }
        Map<String, Object> jsonContent = readFromJson(normalizedPageId);
        if (!isEmpty(jsonContent)) {
            return jsonContent;
        }
        return defaultResponse();
    }

    public Map<String, Object> getPageHelpForAdmin(String pageId) {
        String normalizedPageId = pageId == null ? "" : pageId.trim();
        if (normalizedPageId.isEmpty()) {
            return buildAdminResponse("", "DEFAULT", null, Collections.<HelpItemVO>emptyList());
        }
        Map<String, Object> dbContent = readFromDb(normalizedPageId, false);
        if (!isEmptyAdmin(dbContent)) {
            return dbContent;
        }
        Map<String, Object> jsonContent = readFromJson(normalizedPageId);
        if (!isEmpty(jsonContent)) {
            return mergeAdminDefaults(normalizedPageId, "JSON", jsonContent);
        }
        return buildAdminResponse(normalizedPageId, "DEFAULT", null, Collections.<HelpItemVO>emptyList());
    }

    @Transactional
    public void savePageHelp(HelpManagementSaveRequest request) {
        String pageId = safe(request == null ? null : request.getPageId());
        if (pageId.isEmpty()) {
            throw new IllegalArgumentException("pageId is required");
        }

        HelpPageVO page = new HelpPageVO();
        page.setPageId(pageId);
        page.setTitle(safe(request.getTitle()));
        page.setSummary(safe(request.getSummary()));
        page.setHelpVersion(defaultIfBlank(request.getHelpVersion(), "v1"));
        page.setActiveYn(normalizeYn(request.getActiveYn()));

        if (helpContentMapper.countHelpPage(pageId) > 0) {
            helpContentMapper.updateHelpPage(page);
        } else {
            helpContentMapper.insertHelpPage(page);
        }

        helpContentMapper.deleteHelpItems(pageId);
        List<HelpManagementItemRequest> items = request.getItems() == null
                ? Collections.<HelpManagementItemRequest>emptyList()
                : request.getItems();
        int displayOrder = 1;
        for (HelpManagementItemRequest itemRequest : items) {
            if (itemRequest == null) {
                continue;
            }
            HelpItemVO item = new HelpItemVO();
            item.setItemId(defaultIfBlank(itemRequest.getItemId(), nextItemId("HLP")));
            item.setPageId(pageId);
            item.setTitle(safe(itemRequest.getTitle()));
            item.setBody(safe(itemRequest.getBody()));
            item.setAnchorSelector(safe(itemRequest.getAnchorSelector()));
            item.setDisplayOrder(itemRequest.getDisplayOrder() == null ? displayOrder : itemRequest.getDisplayOrder());
            item.setActiveYn(normalizeYn(itemRequest.getActiveYn()));
            item.setPlacement(normalizePlacement(itemRequest.getPlacement()));
            item.setImageUrl(safe(itemRequest.getImageUrl()));
            item.setIconName(safe(itemRequest.getIconName()));
            item.setHighlightStyle(normalizeHighlightStyle(itemRequest.getHighlightStyle()));
            item.setCtaLabel(safe(itemRequest.getCtaLabel()));
            item.setCtaUrl(safe(itemRequest.getCtaUrl()));
            helpContentMapper.insertHelpItem(item);
            displayOrder++;
        }
    }

    private Map<String, Object> readFromDb(String normalizedPageId, boolean activeOnly) {
        try {
            HelpPageVO page = helpContentMapper.selectHelpPage(normalizedPageId);
            List<HelpItemVO> items = helpContentMapper.selectHelpItems(normalizedPageId);
            if (activeOnly) {
                page = filterInactivePage(page);
                items = page == null ? Collections.<HelpItemVO>emptyList() : filterActiveItems(items);
            }
            return buildAdminResponse(normalizedPageId, "DB", page, items);
        } catch (Exception e) {
            return buildAdminResponse(normalizedPageId, "DEFAULT", null, Collections.<HelpItemVO>emptyList());
        }
    }

    private Map<String, Object> readFromJson(String normalizedPageId) {
        try {
            ClassPathResource resource = new ClassPathResource("help/page-help.json");
            InputStream inputStream = resource.getInputStream();
            Map<String, Map<String, Object>> helpMap = objectMapper.readValue(
                    inputStream,
                    new TypeReference<Map<String, Map<String, Object>>>() {
                    });
            Map<String, Object> content = helpMap.get(normalizedPageId);
            if (content == null) {
                return defaultResponse();
            }
            return content;
        } catch (Exception e) {
            return defaultResponse();
        }
    }

    private boolean isEmpty(Map<String, Object> response) {
        Object title = response.get("title");
        Object summary = response.get("summary");
        Object items = response.get("items");
        return (title == null || title.toString().trim().isEmpty())
                && (summary == null || summary.toString().trim().isEmpty())
                && (!(items instanceof List) || ((List<?>) items).isEmpty());
    }

    private boolean isEmptyAdmin(Map<String, Object> response) {
        if (response == null) {
            return true;
        }
        Object source = response.get("source");
        if ("DB".equals(source)) {
            return false;
        }
        return isEmpty(response);
    }

    private HelpPageVO filterInactivePage(HelpPageVO page) {
        if (page == null) {
            return null;
        }
        return "Y".equalsIgnoreCase(page.getActiveYn()) ? page : null;
    }

    private List<HelpItemVO> filterActiveItems(List<HelpItemVO> items) {
        if (items == null || items.isEmpty()) {
            return Collections.emptyList();
        }
        List<HelpItemVO> filtered = new ArrayList<>();
        for (HelpItemVO item : items) {
            if (item != null && "Y".equalsIgnoreCase(item.getActiveYn())) {
                filtered.add(item);
            }
        }
        return filtered;
    }

    private Map<String, Object> buildAdminResponse(String pageId, String source, HelpPageVO page, List<HelpItemVO> items) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("pageId", safe(pageId));
        response.put("source", source);
        response.put("title", page == null ? "" : safe(page.getTitle()));
        response.put("summary", page == null ? "" : safe(page.getSummary()));
        response.put("helpVersion", page == null ? "v1" : defaultIfBlank(page.getHelpVersion(), "v1"));
        response.put("activeYn", page == null ? "Y" : normalizeYn(page.getActiveYn()));
        response.put("items", items == null ? Collections.<HelpItemVO>emptyList() : items);
        return response;
    }

    private Map<String, Object> mergeAdminDefaults(String pageId, String source, Map<String, Object> content) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("pageId", pageId);
        response.put("source", source);
        response.put("title", safe((String) content.get("title")));
        response.put("summary", safe((String) content.get("summary")));
        response.put("helpVersion", "v1");
        response.put("activeYn", "Y");
        response.put("items", content.get("items"));
        return response;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String defaultIfBlank(String value, String defaultValue) {
        String normalized = safe(value);
        return normalized.isEmpty() ? defaultValue : normalized;
    }

    private String normalizeYn(String value) {
        return "N".equalsIgnoreCase(safe(value)) ? "N" : "Y";
    }

    private String normalizePlacement(String value) {
        String normalized = safe(value).toLowerCase();
        if ("left".equals(normalized) || "right".equals(normalized) || "bottom".equals(normalized)) {
            return normalized;
        }
        return "top";
    }

    private String nextItemId(String prefix) {
        String base = UUID.randomUUID().toString().replace("-", "").toUpperCase(Locale.ROOT);
        return prefix + "-" + base.substring(0, 16);
    }

    private String normalizeHighlightStyle(String value) {
        String normalized = safe(value).toLowerCase();
        if ("warning".equals(normalized) || "success".equals(normalized) || "neutral".equals(normalized)) {
            return normalized;
        }
        return "focus";
    }

    private Map<String, Object> defaultResponse() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("title", "");
        response.put("summary", "");
        response.put("items", Collections.<Map<String, Object>>emptyList());
        return response;
    }
}
