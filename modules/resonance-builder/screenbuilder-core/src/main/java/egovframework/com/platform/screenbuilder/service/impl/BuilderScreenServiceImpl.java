package egovframework.com.platform.screenbuilder.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.platform.screenbuilder.model.ScreenBuilderEventBindingVO;
import egovframework.com.platform.screenbuilder.model.ScreenBuilderNodeVO;
import egovframework.com.platform.screenbuilder.model.ScreenConfigVO;
import egovframework.com.platform.screenbuilder.repository.ScreenConfigRepository;
import egovframework.com.platform.screenbuilder.service.BuilderScreenService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class BuilderScreenServiceImpl implements BuilderScreenService {

    private static final Logger log = LoggerFactory.getLogger(BuilderScreenServiceImpl.class);

    private final ScreenConfigRepository screenConfigRepository;
    private final ObjectMapper objectMapper;

    public BuilderScreenServiceImpl(ScreenConfigRepository screenConfigRepository, ObjectMapper objectMapper) {
        this.screenConfigRepository = screenConfigRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    public ScreenConfigVO createScreen(ScreenConfigVO config) {
        if (config.getScreenId() == null || config.getScreenId().isEmpty()) {
            config.setScreenId("SCRN-" + System.currentTimeMillis());
        }
        if (config.getVersion() == null) {
            config.setVersion(1);
        }
        config.setCreatedAt(LocalDateTime.now());
        config.setUpdatedAt(LocalDateTime.now());
        config.setStatus(ScreenConfigVO.STATUS_DRAFT);

        if (config.getNodes() == null) {
            config.setNodes(createDefaultNodes(config));
        }
        if (config.getEvents() == null) {
            config.setEvents(new ArrayList<>());
        }

        return screenConfigRepository.save(config);
    }

    private List<ScreenBuilderNodeVO> createDefaultNodes(ScreenConfigVO config) {
        List<ScreenBuilderNodeVO> nodes = new ArrayList<>();

        ScreenBuilderNodeVO pageNode = new ScreenBuilderNodeVO();
        pageNode.setNodeId("page-root");
        pageNode.setComponentType("page");
        pageNode.setParentNodeId(null);
        pageNode.setSlotName("root");
        pageNode.setSortOrder(0);
        Map<String, Object> pageProps = new LinkedHashMap<>();
        pageProps.put("className", "min-h-screen bg-gray-50");
        pageProps.put("title", config.getMenuNm());
        pageNode.setProps(pageProps);
        nodes.add(pageNode);

        ScreenBuilderNodeVO headerNode = new ScreenBuilderNodeVO();
        headerNode.setNodeId("header-1");
        headerNode.setComponentType("section");
        headerNode.setParentNodeId("page-root");
        headerNode.setSlotName("header");
        headerNode.setSortOrder(1);
        Map<String, Object> headerProps = new LinkedHashMap<>();
        headerProps.put("className", "bg-white shadow");
        headerProps.put("title", config.getMenuNm());
        headerNode.setProps(headerProps);
        nodes.add(headerNode);

        ScreenBuilderNodeVO contentNode = new ScreenBuilderNodeVO();
        contentNode.setNodeId("content-1");
        contentNode.setComponentType("section");
        contentNode.setParentNodeId("page-root");
        contentNode.setSlotName("content");
        contentNode.setSortOrder(2);
        Map<String, Object> contentProps = new LinkedHashMap<>();
        contentProps.put("className", "p-6");
        contentProps.put("title", "Content");
        contentNode.setProps(contentProps);
        nodes.add(contentNode);

        return nodes;
    }

    @Override
    public ScreenConfigVO updateScreen(String screenId, ScreenConfigVO config) {
        ScreenConfigVO existing = screenConfigRepository.findById(screenId)
                .orElseThrow(() -> new IllegalArgumentException("Screen not found: " + screenId));

        config.setScreenId(screenId);
        config.setCreatedAt(existing.getCreatedAt());
        config.setUpdatedAt(LocalDateTime.now());
        config.setVersion(existing.getVersion() + 1);

        return screenConfigRepository.save(config);
    }

    @Override
    public ScreenConfigVO getScreen(String screenId) {
        return screenConfigRepository.findById(screenId)
                .orElseThrow(() -> new IllegalArgumentException("Screen not found: " + screenId));
    }

    @Override
    public ScreenConfigVO getScreenByMenuCode(String menuCode) {
        return screenConfigRepository.findByMenuCode(menuCode)
                .orElse(null);
    }

    @Override
    public List<ScreenConfigVO> getAllScreens() {
        return screenConfigRepository.findAll();
    }

    @Override
    public List<ScreenConfigVO> getScreensByStatus(String status) {
        return screenConfigRepository.findByStatus(status);
    }

    @Override
    public void deleteScreen(String screenId) {
        if (!screenConfigRepository.existsById(screenId)) {
            throw new IllegalArgumentException("Screen not found: " + screenId);
        }
        screenConfigRepository.deleteById(screenId);
    }

    @Override
    public ScreenConfigVO publishScreen(String screenId) {
        ScreenConfigVO config = getScreen(screenId);
        config.setStatus(ScreenConfigVO.STATUS_PUBLISHED);
        config.setPublishedAt(LocalDateTime.now());
        config.setUpdatedAt(LocalDateTime.now());
        return screenConfigRepository.save(config);
    }

    @Override
    public ScreenConfigVO duplicateScreen(String sourceScreenId, String newMenuCode, String newMenuTitle) {
        ScreenConfigVO source = getScreen(sourceScreenId);

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
        if (source.getEvents() != null) {
            for (ScreenBuilderEventBindingVO event : source.getEvents()) {
                ScreenBuilderEventBindingVO copiedEvent = new ScreenBuilderEventBindingVO();
                copiedEvent.setEventBindingId("EVT-" + System.currentTimeMillis());
                copiedEvent.setNodeId(nodeIdMap.getOrDefault(event.getNodeId(), event.getNodeId()));
                copiedEvent.setEventName(event.getEventName());
                copiedEvent.setActionType(event.getActionType());
                copiedEvent.setActionConfig(new LinkedHashMap<>(event.getActionConfig()));
                copiedEvents.add(copiedEvent);
            }
        }
        copy.setEvents(copiedEvents);

        return screenConfigRepository.save(copy);
    }

    @Override
    public ScreenBuilderNodeVO addNodeToScreen(String screenId, ScreenBuilderNodeVO node) {
        ScreenConfigVO config = getScreen(screenId);

        if (node.getNodeId() == null || node.getNodeId().isEmpty()) {
            node.setNodeId("node-" + System.currentTimeMillis());
        }

        if (config.getNodes() == null) {
            config.setNodes(new ArrayList<>());
        }

        config.getNodes().add(node);
        config.setUpdatedAt(LocalDateTime.now());
        config.setVersion(config.getVersion() + 1);

        screenConfigRepository.save(config);

        return node;
    }

    @Override
    public ScreenBuilderNodeVO updateNode(String screenId, String nodeId, ScreenBuilderNodeVO node) {
        ScreenConfigVO config = getScreen(screenId);

        List<ScreenBuilderNodeVO> nodes = config.getNodes();
        if (nodes == null) {
            throw new IllegalArgumentException("No nodes found for screen: " + screenId);
        }

        for (int i = 0; i < nodes.size(); i++) {
            if (nodeId.equals(nodes.get(i).getNodeId())) {
                node.setNodeId(nodeId);
                node.setParentNodeId(nodes.get(i).getParentNodeId());
                nodes.set(i, node);
                break;
            }
        }

        config.setNodes(nodes);
        config.setUpdatedAt(LocalDateTime.now());
        config.setVersion(config.getVersion() + 1);

        screenConfigRepository.save(config);

        return node;
    }

    @Override
    public void removeNode(String screenId, String nodeId) {
        ScreenConfigVO config = getScreen(screenId);

        List<ScreenBuilderNodeVO> nodes = config.getNodes();
        if (nodes == null) {
            return;
        }

        nodes.removeIf(n -> nodeId.equals(n.getNodeId()));

        for (ScreenBuilderNodeVO node : nodes) {
            if (nodeId.equals(node.getParentNodeId())) {
                node.setParentNodeId(null);
            }
        }

        config.setNodes(nodes);
        config.setUpdatedAt(LocalDateTime.now());
        config.setVersion(config.getVersion() + 1);

        screenConfigRepository.save(config);
    }

    @Override
    public List<ScreenBuilderNodeVO> getNodes(String screenId) {
        ScreenConfigVO config = getScreen(screenId);
        return config.getNodes() != null ? config.getNodes() : new ArrayList<>();
    }

    @Override
    public String getPreviewHtml(String screenId) {
        ScreenConfigVO config = getScreen(screenId);
        return generateHtml(config);
    }

    private String generateHtml(ScreenConfigVO config) {
        StringBuilder html = new StringBuilder();
        html.append("<!DOCTYPE html><html><head>");
        html.append("<meta charset='UTF-8'>");
        html.append("<meta name='viewport' content='width=device-width, initial-scale=1.0'>");
        html.append("<script src='https://cdn.tailwindcss.com'></script>");
        html.append("</head><body class='bg-gray-50'>");

        if (config.getNodes() != null) {
            for (ScreenBuilderNodeVO node : config.getNodes()) {
                html.append(renderNode(node));
            }
        }

        html.append("</body></html>");
        return html.toString();
    }

    private String renderNode(ScreenBuilderNodeVO node) {
        String className = node.getProps() != null ?
                String.valueOf(node.getProps().getOrDefault("className", "")) : "";
        String customId = node.getProps() != null ?
                String.valueOf(node.getProps().getOrDefault("customId", "")) : "";
        String idAttr = customId.isEmpty() ? "" : " id='" + customId + "'";

        return switch (node.getComponentType()) {
            case "page" -> String.format("<div class='min-h-screen %s'%s>", className, idAttr);
            case "section" -> String.format("<section class='%s'%s>", className, idAttr);
            case "header" -> String.format("<header class='%s'%s>", className, idAttr);
            case "footer" -> String.format("<footer class='%s'%s>", className, idAttr);
            case "button" -> {
                String label = node.getProps() != null ?
                        String.valueOf(node.getProps().getOrDefault("label", "Button")) : "Button";
                yield String.format("<button class='%s'%s>%s</button>", className, idAttr, label);
            }
            case "card" -> String.format("<div class='bg-white rounded-lg shadow p-4 %s'%s>", className, idAttr);
            case "input" -> {
                String placeholder = node.getProps() != null ?
                        String.valueOf(node.getProps().getOrDefault("placeholder", "")) : "";
                yield String.format("<input class='%s' placeholder='%s'%s>", className, placeholder, idAttr);
            }
            case "table" -> String.format("<table class='%s'%s><tbody><tr><td>Sample</td></tr></tbody></table>", className, idAttr);
            case "form" -> String.format("<form class='%s'%s>", className, idAttr);
            default -> String.format("<div class='%s'%s></div>", className, idAttr);
        };
    }
}