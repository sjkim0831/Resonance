package egovframework.com.feature.admin.mapper;

import egovframework.com.common.mapper.support.BaseMapperSupport;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component("adminEmissionGwpValueMapper")
public class AdminEmissionGwpValueMapper extends BaseMapperSupport {

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> selectAll() {
        return (List<Map<String, Object>>) (List<?>) selectList("AdminEmissionGwpValueMapper.selectAll");
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> selectByRowId(String rowId) {
        return (Map<String, Object>) selectOne("AdminEmissionGwpValueMapper.selectByRowId", rowId);
    }

    public int countAll() {
        Integer count = selectOne("AdminEmissionGwpValueMapper.countAll");
        return count == null ? 0 : count;
    }

    public int countByRowId(String rowId) {
        Integer count = selectOne("AdminEmissionGwpValueMapper.countByRowId", rowId);
        return count == null ? 0 : count;
    }

    public int selectNextSortOrderBySection(String sectionCode) {
        Integer next = selectOne("AdminEmissionGwpValueMapper.selectNextSortOrderBySection", sectionCode);
        return next == null ? 1 : next;
    }

    public int selectMaxRowNumber() {
        Integer max = selectOne("AdminEmissionGwpValueMapper.selectMaxRowNumber");
        return max == null ? 0 : max;
    }

    public void insertRow(Map<String, Object> params) {
        insert("AdminEmissionGwpValueMapper.insertRow", params);
    }

    public void updateRow(Map<String, Object> params) {
        update("AdminEmissionGwpValueMapper.updateRow", params);
    }

    public void deleteRow(String rowId) {
        delete("AdminEmissionGwpValueMapper.deleteRow", rowId);
    }
}
