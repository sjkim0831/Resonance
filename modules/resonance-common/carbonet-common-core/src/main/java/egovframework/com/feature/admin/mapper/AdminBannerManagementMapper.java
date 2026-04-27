package egovframework.com.feature.admin.mapper;

import egovframework.com.common.mapper.support.BaseMapperSupport;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component("adminBannerManagementMapper")
public class AdminBannerManagementMapper extends BaseMapperSupport {

    public List<Map<String, Object>> selectBannerRows() {
        return selectList("AdminBannerManagementMapper.selectBannerRows");
    }

    public Map<String, Object> selectBannerById(String bannerId) {
        return selectOne("AdminBannerManagementMapper.selectBannerById", bannerId);
    }

    public int countBannerById(String bannerId) {
        Integer count = selectOne("AdminBannerManagementMapper.countBannerById", bannerId);
        return count == null ? 0 : count;
    }

    public void insertBannerRow(Map<String, Object> row) {
        insert("AdminBannerManagementMapper.insertBannerRow", row);
    }

    public void updateBannerRow(Map<String, Object> row) {
        update("AdminBannerManagementMapper.updateBannerRow", row);
    }
}
