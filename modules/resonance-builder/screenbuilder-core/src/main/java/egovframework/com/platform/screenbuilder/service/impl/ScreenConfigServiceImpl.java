package egovframework.com.platform.screenbuilder.service.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.platform.screenbuilder.model.ScreenBuilderEventBindingVO;
import egovframework.com.platform.screenbuilder.model.ScreenBuilderNodeVO;
import egovframework.com.platform.screenbuilder.model.ScreenConfigVO;
import egovframework.com.platform.screenbuilder.service.ScreenConfigService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class ScreenConfigServiceImpl implements ScreenConfigService {

    private static final Logger log = LoggerFactory.getLogger(ScreenConfigServiceImpl.class);

    private final Map<String, ScreenConfigVO> configStore = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper;

    public ScreenConfigServiceImpl(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void init() {
        createSampleConfigs();
    }

    private void createSampleConfigs() {
        ScreenConfigVO sample = new ScreenConfigVO();
        sample.setScreenId("SCRN-" + System.currentTimeMillis());
        sample.setMenuCode("SAMPLE001");
        sample.setMenuNm("샘플 화면");
        sample.setMenuUrl("/admin/system/sample");
        sample.setTemplateType("admin");
        sample.setStatus(ScreenConfigVO.STATUS_DRAFT);

        List<ScreenBuilderNodeVO> nodes = new ArrayList<>();

        ScreenBuilderNodeVO headerNode = new ScreenBuilderNodeVO();
        headerNode.setNodeId("header-1");
        headerNode.setComponentType("section");
        headerNode.setParentNodeId(null);
        headerNode.setSlotName("header");
        headerNode.setSortOrder(0);
        Map<String, Object> headerProps = new LinkedHashMap<>();
        headerProps.put("title", "샘플 화면");
        headerProps.put("className", "bg-white shadow-md rounded-lg p-4 mb-4");
        headerProps.put("style", Map.of("padding", "16px", "marginBottom", "16px"));
        headerNode.setProps(headerProps);
        nodes.add(headerNode);

        ScreenBuilderNodeVO contentNode = new ScreenBuilderNodeVO();
        contentNode.setNodeId("content-1");
        contentNode.setComponentType("section");
        contentNode.setParentNodeId("header-1");
        contentNode.setSlotName("content");
        contentNode.setSortOrder(1);
        Map<String, Object> contentProps = new LinkedHashMap<>();
        contentProps.put("title", "콘텐츠");
        contentProps.put("className", "bg-gray-50 rounded-lg p-6");
        contentNode.setProps(contentProps);
        nodes.add(contentNode);

        ScreenBuilderNodeVO buttonNode = new ScreenBuilderNodeVO();
        buttonNode.setNodeId("btn-save");
        buttonNode.setComponentType("button");
        buttonNode.setParentNodeId("content-1");
        buttonNode.setSlotName("children");
        buttonNode.setSortOrder(0);
        Map<String, Object> buttonProps = new LinkedHashMap<>();
        buttonProps.put("label", "저장");
        buttonProps.put("variant", "primary");
        buttonProps.put("customId", "btn-save-primary");
        buttonProps.put("className", "bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700");
        buttonProps.put("dataAttrs", Map.of("action", "save", "screen", "sample"));
        buttonNode.setProps(buttonProps);
        nodes.add(buttonNode);

        sample.setNodes(nodes);

        List<ScreenBuilderEventBindingVO> events = new ArrayList<>();
        ScreenBuilderEventBindingVO clickEvent = new ScreenBuilderEventBindingVO();
        clickEvent.setEventBindingId("EVT-" + System.currentTimeMillis());
        clickEvent.setNodeId("btn-save");
        clickEvent.setEventName("onClick");
        clickEvent.setActionType("custom_fn");
        clickEvent.setActionConfig(Map.of(
            "functionBody", "(node, event, state) => { console.log('저장 클릭됨'); state.set('saved', true); }"
        ));
        events.add(clickEvent);

        sample.setEvents(events);
        configStore.put(sample.getMenuCode(), sample);

        log.info("Created sample screen config: menuCode={}, screenId={}", sample.getMenuCode(), sample.getScreenId());
    }

    @Override
    public ScreenConfigVO createOrUpdateConfig(ScreenConfigVO config) {
        String menuCode = config.getMenuCode();
        if (menuCode == null || menuCode.isEmpty()) {
            menuCode = "SCRN-" + System.currentTimeMillis();
            config.setMenuCode(menuCode);
        }

        ScreenConfigVO existing = configStore.get(menuCode);
        if (existing != null) {
            config.setScreenId(existing.getScreenId());
            config.setVersion(existing.getVersion() + 1);
            config.setCreatedAt(existing.getCreatedAt());
        } else {
            config.setScreenId("SCRN-" + System.currentTimeMillis());
            config.setVersion(1);
            config.setCreatedAt(LocalDateTime.now());
        }

        config.setUpdatedAt(LocalDateTime.now());
        configStore.put(menuCode, config);

        log.info("Saved screen config: menuCode={}, screenId={}, version={}",
                config.getMenuCode(), config.getScreenId(), config.getVersion());

        return config;
    }

    @Override
    public Optional<ScreenConfigVO> getConfigByMenuCode(String menuCode) {
        return Optional.ofNullable(configStore.get(menuCode));
    }

    @Override
    public Optional<ScreenConfigVO> getConfigByScreenId(String screenId) {
        return configStore.values().stream()
                .filter(c -> screenId.equals(c.getScreenId()))
                .findFirst();
    }

    @Override
    public List<ScreenConfigVO> getAllConfigs() {
        return new ArrayList<>(configStore.values());
    }

    @Override
    public List<ScreenConfigVO> getConfigsByStatus(String status) {
        return configStore.values().stream()
                .filter(c -> status.equals(c.getStatus()))
                .collect(Collectors.toList());
    }

    @Override
    public boolean deleteConfig(String screenId) {
        Optional<ScreenConfigVO> config = getConfigByScreenId(screenId);
        if (config.isPresent()) {
            configStore.remove(config.get().getMenuCode());
            return true;
        }
        return false;
    }

    @Override
    public ScreenConfigVO publishConfig(String screenId) {
        ScreenConfigVO config = getConfigByScreenId(screenId)
                .orElseThrow(() -> new IllegalArgumentException("Config not found: " + screenId));
        config.setStatus(ScreenConfigVO.STATUS_PUBLISHED);
        config.setUpdatedAt(LocalDateTime.now());
        configStore.put(config.getMenuCode(), config);
        log.info("Published screen config: screenId={}, menuCode={}", screenId, config.getMenuCode());
        return config;
    }

    @Override
    public ScreenConfigVO duplicateConfig(String sourceScreenId, String newMenuCode, String newMenuTitle) {
        ScreenConfigVO source = getConfigByScreenId(sourceScreenId)
                .orElseThrow(() -> new IllegalArgumentException("Source config not found: " + sourceScreenId));

        ScreenConfigVO copy = new ScreenConfigVO();
        copy.setScreenId("SCRN-" + System.currentTimeMillis());
        copy.setMenuCode(newMenuCode);
        copy.setMenuNm(newMenuTitle);
        copy.setMenuUrl("/admin/screen/" + newMenuCode.toLowerCase());
        copy.setTemplateType(source.getTemplateType());
        copy.setThemeId(source.getThemeId());
        copy.setCustomClasses(source.getCustomClasses());
        copy.setCustomStyles(source.getCustomStyles());
        copy.setStatus(ScreenConfigVO.STATUS_DRAFT);
        copy.setCreatedAt(LocalDateTime.now());
        copy.setUpdatedAt(LocalDateTime.now());

        List<ScreenBuilderNodeVO> copiedNodes = new ArrayList<>();
        Map<String, String> nodeIdMap = new HashMap<>();

        for (ScreenBuilderNodeVO node : source.getNodes()) {
            String oldId = node.getNodeId();
            String newId = oldId + "-copy-" + System.currentTimeMillis();
            nodeIdMap.put(oldId, newId);

            ScreenBuilderNodeVO copied = new ScreenBuilderNodeVO();
            copied.setNodeId(newId);
            copied.setComponentId(node.getComponentId());
            copied.setParentNodeId(node.getParentNodeId());
            copied.setComponentType(node.getComponentType());
            copied.setSlotName(node.getSlotName());
            copied.setSortOrder(node.getSortOrder());
            copied.setProps(new LinkedHashMap<>(node.getProps()));
            copiedNodes.add(copied);
        }

        for (ScreenBuilderNodeVO node : copiedNodes) {
            if (node.getParentNodeId() != null) {
                String newParentId = nodeIdMap.get(node.getParentNodeId());
                if (newParentId != null) {
                    node.setParentNodeId(newParentId);
                }
            }
        }

        copy.setNodes(copiedNodes);

        List<ScreenBuilderEventBindingVO> copiedEvents = new ArrayList<>();
        for (ScreenBuilderEventBindingVO event : source.getEvents()) {
            ScreenBuilderEventBindingVO copiedEvent = new ScreenBuilderEventBindingVO();
            copiedEvent.setEventBindingId("EVT-" + System.currentTimeMillis());
            copiedEvent.setNodeId(nodeIdMap.getOrDefault(event.getNodeId(), event.getNodeId()));
            copiedEvent.setEventName(event.getEventName());
            copiedEvent.setActionType(event.getActionType());
            copiedEvent.setActionConfig(new LinkedHashMap<>(event.getActionConfig()));
            copiedEvents.add(copiedEvent);
        }
        copy.setEvents(copiedEvents);

        configStore.put(copy.getMenuCode(), copy);
        log.info("Duplicated screen config: from={}, to={}", sourceScreenId, copy.getScreenId());

        return copy;
    }

    @Override
    public List<String> getAvailableThemes() {
        return List.of(
                "default",
                "modern",
                "compact",
                "dashboard",
                "form"
        );
    }

    @Override
    public boolean configExists(String menuCode) {
        return configStore.containsKey(menuCode);
    }

    public String nodesToJson(List<ScreenBuilderNodeVO> nodes) {
        try {
            return objectMapper.writeValueAsString(nodes);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize nodes", e);
            return "[]";
        }
    }

    public List<ScreenBuilderNodeVO> nodesFromJson(String json) {
        try {
            return objectMapper.readValue(json,
                    objectMapper.getTypeFactory().constructCollectionType(List.class, ScreenBuilderNodeVO.class));
        } catch (JsonProcessingException e) {
            log.error("Failed to deserialize nodes", e);
            return new ArrayList<>();
        }
    }
}