package egovframework.com.platform.screenbuilder.repository.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.platform.screenbuilder.model.BuilderComponentVO;
import egovframework.com.platform.screenbuilder.repository.ComponentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

@Repository
public class ComponentRepositoryImpl implements ComponentRepository {

    private static final Logger log = LoggerFactory.getLogger(ComponentRepositoryImpl.class);

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public ComponentRepositoryImpl(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    private static final RowMapper<BuilderComponentVO> ROW_MAPPER = (rs, rowNum) -> {
        BuilderComponentVO vo = new BuilderComponentVO();
        vo.setComponentId(rs.getString("COMPONENT_ID"));
        vo.setComponentNm(rs.getString("COMPONENT_NM"));
        vo.setComponentDc(rs.getString("COMPONENT_DC"));
        vo.setComponentType(rs.getString("COMPONENT_TYPE"));
        vo.setCategoryCd(rs.getString("CATEGORY_CD"));
        vo.setIconNm(rs.getString("ICON_NM"));
        vo.setDefaultClassNm(rs.getString("DEFAULT_CLASS_NM"));
        vo.setIsContainer("Y".equals(rs.getString("IS_CONTAINER")));
        vo.setIsReusable(!"N".equals(rs.getString("IS_REUSABLE")));
        vo.setSortOrder(rs.getInt("SORT_ORDER"));
        vo.setUseAt(rs.getString("USE_AT"));
        return vo;
    };

    @Override
    public BuilderComponentVO save(BuilderComponentVO component) {
        if (existsById(component.getComponentId())) {
            String sql = """
                UPDATE COMTNCOMPONENTINFO SET
                    COMPONENT_NM = ?, COMPONENT_DC = ?, COMPONENT_TYPE = ?, CATEGORY_CD = ?,
                    ICON_NM = ?, DEFAULT_CLASS_NM = ?, IS_CONTAINER = ?, IS_REUSABLE = ?,
                    SORT_ORDER = ?, USE_AT = ?, UPDT_PNTTM = CURRENT_TIMESTAMP
                WHERE COMPONENT_ID = ?
                """;
            jdbcTemplate.update(sql,
                    component.getComponentNm(), component.getComponentDc(), component.getComponentType(),
                    component.getCategoryCd(), component.getIconNm(), component.getDefaultClassNm(),
                    Boolean.TRUE.equals(component.getIsContainer()) ? "Y" : "N",
                    Boolean.TRUE.equals(component.getIsReusable()) ? "Y" : "N",
                    component.getSortOrder(), component.getUseAt(), component.getComponentId());
        } else {
            String sql = """
                INSERT INTO COMTNCOMPONENTINFO
                    (COMPONENT_ID, COMPONENT_NM, COMPONENT_DC, COMPONENT_TYPE, CATEGORY_CD, ICON_NM,
                     DEFAULT_CLASS_NM, IS_CONTAINER, IS_REUSABLE, SORT_ORDER, USE_AT,
                     CREAT_PNTTM, UPDT_PNTTM)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """;
            jdbcTemplate.update(sql,
                    component.getComponentId(), component.getComponentNm(), component.getComponentDc(),
                    component.getComponentType(), component.getCategoryCd(), component.getIconNm(),
                    component.getDefaultClassNm(),
                    Boolean.TRUE.equals(component.getIsContainer()) ? "Y" : "N",
                    Boolean.TRUE.equals(component.getIsReusable()) ? "Y" : "N",
                    component.getSortOrder(), component.getUseAt());
        }
        return component;
    }

    @Override
    public Optional<BuilderComponentVO> findById(String componentId) {
        String sql = "SELECT * FROM COMTNCOMPONENTINFO WHERE COMPONENT_ID = ?";
        List<BuilderComponentVO> results = jdbcTemplate.query(sql, ROW_MAPPER, componentId);
        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
    }

    @Override
    public List<BuilderComponentVO> findAll() {
        String sql = "SELECT * FROM COMTNCOMPONENTINFO ORDER BY SORT_ORDER";
        return jdbcTemplate.query(sql, ROW_MAPPER);
    }

    @Override
    public List<BuilderComponentVO> findByComponentType(String componentType) {
        String sql = "SELECT * FROM COMTNCOMPONENTINFO WHERE COMPONENT_TYPE = ? ORDER BY SORT_ORDER";
        return jdbcTemplate.query(sql, ROW_MAPPER, componentType);
    }

    @Override
    public List<BuilderComponentVO> findByCategoryCd(String categoryCd) {
        String sql = "SELECT * FROM COMTNCOMPONENTINFO WHERE CATEGORY_CD = ? ORDER BY SORT_ORDER";
        return jdbcTemplate.query(sql, ROW_MAPPER, categoryCd);
    }

    @Override
    public List<BuilderComponentVO> findByUseAt(String useAt) {
        String sql = "SELECT * FROM COMTNCOMPONENTINFO WHERE USE_AT = ? ORDER BY SORT_ORDER";
        return jdbcTemplate.query(sql, ROW_MAPPER, useAt);
    }

    @Override
    public boolean existsById(String componentId) {
        String sql = "SELECT COUNT(*) FROM COMTNCOMPONENTINFO WHERE COMPONENT_ID = ?";
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class, componentId);
        return count != null && count > 0;
    }

    @Override
    public void deleteById(String componentId) {
        String sql = "DELETE FROM COMTNCOMPONENTINFO WHERE COMPONENT_ID = ?";
        jdbcTemplate.update(sql, componentId);
    }

    @Override
    public int count() {
        String sql = "SELECT COUNT(*) FROM COMTNCOMPONENTINFO";
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class);
        return count == null ? 0 : count;
    }
}