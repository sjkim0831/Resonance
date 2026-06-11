package egovframework.com.platform.screenbuilder.repository.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.platform.screenbuilder.model.ScreenBuilderEventBindingVO;
import egovframework.com.platform.screenbuilder.model.ScreenBuilderNodeVO;
import egovframework.com.platform.screenbuilder.model.ScreenConfigVO;
import egovframework.com.platform.screenbuilder.repository.ScreenConfigRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Repository
public class ScreenConfigRepositoryImpl implements ScreenConfigRepository {

    private static final Logger log = LoggerFactory.getLogger(ScreenConfigRepositoryImpl.class);

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public ScreenConfigRepositoryImpl(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    private static final RowMapper<ScreenConfigVO> ROW_MAPPER = (rs, rowNum) -> {
        ScreenConfigVO vo = new ScreenConfigVO();
        vo.setScreenId(rs.getString("SCREEN_ID"));
        vo.setMenuCode(rs.getString("MENU_CODE"));
        vo.setPageId(rs.getString("PAGE_ID"));
        vo.setMenuNm(rs.getString("MENU_NM"));
        vo.setMenuUrl(rs.getString("MENU_URL"));
        vo.setTemplateType(rs.getString("TEMPLATE_TYPE"));
        vo.setThemeId(rs.getString("THEME_ID"));
        vo.setCustomClasses(rs.getString("CUSTOM_CLASSES"));
        vo.setStatus(rs.getString("STATUS"));
        vo.setVersion(rs.getInt("VERSION"));
        vo.setScreenFamily(rs.getString("SCREEN_FAMILY"));
        vo.setScreenGroup(rs.getString("SCREEN_GROUP"));
        return vo;
    };

    @Override
    public ScreenConfigVO save(ScreenConfigVO config) {
        String nodesJson = toJson(config.getNodes());
        String eventsJson = toJson(config.getEvents());

        if (existsById(config.getScreenId())) {
            String sql = """
                UPDATE COMTNSCRNCFG SET
                    MENU_CODE = ?, PAGE_ID = ?, MENU_NM = ?, MENU_URL = ?, TEMPLATE_TYPE = ?,
                    THEME_ID = ?, CUSTOM_CLASSES = ?, NODES_JSON = ?, EVENTS_JSON = ?,
                    STATUS = ?, VERSION = ?, SCREEN_FAMILY = ?, SCREEN_GROUP = ?,
                    UPDATED_AT = CURRENT_TIMESTAMP
                WHERE SCREEN_ID = ?
                """;
            jdbcTemplate.update(sql,
                    config.getMenuCode(), config.getPageId(), config.getMenuNm(), config.getMenuUrl(),
                    config.getTemplateType(), config.getThemeId(), config.getCustomClasses(),
                    nodesJson, eventsJson, config.getStatus(), config.getVersion(),
                    config.getScreenFamily(), config.getScreenGroup(), config.getScreenId());
        } else {
            String sql = """
                INSERT INTO COMTNSCRNCFG
                    (SCREEN_ID, MENU_CODE, PAGE_ID, MENU_NM, MENU_URL, TEMPLATE_TYPE, THEME_ID,
                     CUSTOM_CLASSES, NODES_JSON, EVENTS_JSON, STATUS, VERSION, SCREEN_FAMILY, SCREEN_GROUP,
                     CREATED_AT, UPDATED_AT)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """;
            jdbcTemplate.update(sql,
                    config.getScreenId(), config.getMenuCode(), config.getPageId(), config.getMenuNm(),
                    config.getMenuUrl(), config.getTemplateType(), config.getThemeId(),
                    config.getCustomClasses(), nodesJson, eventsJson, config.getStatus(), config.getVersion(),
                    config.getScreenFamily(), config.getScreenGroup());
        }
        return config;
    }

    @Override
    public Optional<ScreenConfigVO> findById(String screenId) {
        String sql = "SELECT * FROM COMTNSCRNCFG WHERE SCREEN_ID = ?";
        List<ScreenConfigVO> results = jdbcTemplate.query(sql, ROW_MAPPER, screenId);
        if (results.isEmpty()) return Optional.empty();

        ScreenConfigVO vo = results.get(0);
        loadNodesAndEvents(vo);
        return Optional.of(vo);
    }

    @Override
    public Optional<ScreenConfigVO> findByMenuCode(String menuCode) {
        String sql = "SELECT * FROM COMTNSCRNCFG WHERE MENU_CODE = ?";
        List<ScreenConfigVO> results = jdbcTemplate.query(sql, ROW_MAPPER, menuCode);
        if (results.isEmpty()) return Optional.empty();

        ScreenConfigVO vo = results.get(0);
        loadNodesAndEvents(vo);
        return Optional.of(vo);
    }

    @Override
    public List<ScreenConfigVO> findAll() {
        String sql = "SELECT * FROM COMTNSCRNCFG ORDER BY UPDATED_AT DESC";
        List<ScreenConfigVO> results = jdbcTemplate.query(sql, ROW_MAPPER);
        for (ScreenConfigVO vo : results) {
            loadNodesAndEvents(vo);
        }
        return results;
    }

    @Override
    public List<ScreenConfigVO> findByStatus(String status) {
        String sql = "SELECT * FROM COMTNSCRNCFG WHERE STATUS = ? ORDER BY UPDATED_AT DESC";
        List<ScreenConfigVO> results = jdbcTemplate.query(sql, ROW_MAPPER, status);
        for (ScreenConfigVO vo : results) {
            loadNodesAndEvents(vo);
        }
        return results;
    }

    @Override
    public List<ScreenConfigVO> findByTemplateType(String templateType) {
        String sql = "SELECT * FROM COMTNSCRNCFG WHERE TEMPLATE_TYPE = ? ORDER BY UPDATED_AT DESC";
        List<ScreenConfigVO> results = jdbcTemplate.query(sql, ROW_MAPPER, templateType);
        for (ScreenConfigVO vo : results) {
            loadNodesAndEvents(vo);
        }
        return results;
    }

    @Override
    public List<ScreenConfigVO> findByThemeId(String themeId) {
        String sql = "SELECT * FROM COMTNSCRNCFG WHERE THEME_ID = ? ORDER BY UPDATED_AT DESC";
        List<ScreenConfigVO> results = jdbcTemplate.query(sql, ROW_MAPPER, themeId);
        for (ScreenConfigVO vo : results) {
            loadNodesAndEvents(vo);
        }
        return results;
    }

    @Override
    public boolean existsById(String screenId) {
        String sql = "SELECT COUNT(*) FROM COMTNSCRNCFG WHERE SCREEN_ID = ?";
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class, screenId);
        return count != null && count > 0;
    }

    @Override
    public boolean existsByMenuCode(String menuCode) {
        String sql = "SELECT COUNT(*) FROM COMTNSCRNCFG WHERE MENU_CODE = ?";
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class, menuCode);
        return count != null && count > 0;
    }

    @Override
    public void deleteById(String screenId) {
        String sql = "DELETE FROM COMTNSCRNCFG WHERE SCREEN_ID = ?";
        jdbcTemplate.update(sql, screenId);
    }

    @Override
    public int count() {
        String sql = "SELECT COUNT(*) FROM COMTNSCRNCFG";
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class);
        return count == null ? 0 : count;
    }

    private void loadNodesAndEvents(ScreenConfigVO vo) {
        try {
            String nodesSql = "SELECT NODES_JSON FROM COMTNSCRNCFG WHERE SCREEN_ID = ?";
            String nodesJson = jdbcTemplate.queryForObject(nodesSql, String.class, vo.getScreenId());
            if (nodesJson != null && !nodesJson.isEmpty()) {
                List<ScreenBuilderNodeVO> nodes = objectMapper.readValue(nodesJson,
                        objectMapper.getTypeFactory().constructCollectionType(List.class, ScreenBuilderNodeVO.class));
                vo.setNodes(nodes);
            }
        } catch (JsonProcessingException e) {
            log.warn("Failed to parse nodes for screen {}", vo.getScreenId(), e);
            vo.setNodes(new ArrayList<>());
        }

        try {
            String eventsSql = "SELECT EVENTS_JSON FROM COMTNSCRNCFG WHERE SCREEN_ID = ?";
            String eventsJson = jdbcTemplate.queryForObject(eventsSql, String.class, vo.getScreenId());
            if (eventsJson != null && !eventsJson.isEmpty()) {
                List<ScreenBuilderEventBindingVO> events = objectMapper.readValue(eventsJson,
                        objectMapper.getTypeFactory().constructCollectionType(List.class, ScreenBuilderEventBindingVO.class));
                vo.setEvents(events);
            }
        } catch (JsonProcessingException e) {
            log.warn("Failed to parse events for screen {}", vo.getScreenId(), e);
            vo.setEvents(new ArrayList<>());
        }
    }

    private String toJson(Object obj) {
        if (obj == null) return "[]";
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize to JSON", e);
            return "[]";
        }
    }
}