package egovframework.com.feature.admin.mapper;

import egovframework.com.common.mapper.support.BaseMapperSupport;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component("adminBannerManagementMetaMapper")
public class AdminBannerManagementMetaMapper extends BaseMapperSupport {

    public List<Map<String, Object>> selectBannerMetaRows() {
        return selectList("AdminBannerManagementMetaMapper.selectBannerMetaRows");
    }

    public Map<String, Object> selectBannerMetaById(String bannerId) {
        return selectOne("AdminBannerManagementMetaMapper.selectBannerMetaById", bannerId);
    }

    public int countBannerMetaById(String bannerId) {
        Integer count = selectOne("AdminBannerManagementMetaMapper.countBannerMetaById", bannerId);
        return count == null ? 0 : count;
    }

    public void insertBannerMetaRow(Map<String, Object> row) {
        insert("AdminBannerManagementMetaMapper.insertBannerMetaRow", row);
    }

    public void updateBannerMetaRow(Map<String, Object> row) {
        update("AdminBannerManagementMetaMapper.updateBannerMetaRow", row);
    }
}
