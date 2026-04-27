package egovframework.com.framework.builder.runtime.mapper;

import egovframework.com.common.mapper.support.BaseMapperSupport;
import egovframework.com.common.trace.UiComponentRegistryVO;
import egovframework.com.common.trace.UiComponentUsageVO;
import egovframework.com.common.trace.UiPageComponentDetailVO;
import egovframework.com.common.trace.UiPageManifestVO;
import org.springframework.stereotype.Component;

import java.util.List;

@Component("frameworkBuilderObservabilityMapper")
public class FrameworkBuilderObservabilityMapper extends BaseMapperSupport {

    public List<UiPageManifestVO> selectUiPageManifestList() {
        return selectList("FrameworkBuilderObservabilityMapper.selectUiPageManifestList");
    }

    public List<UiPageComponentDetailVO> selectUiPageComponentDetails(String pageId) {
        return selectList("FrameworkBuilderObservabilityMapper.selectUiPageComponentDetails", pageId);
    }

    public List<UiComponentRegistryVO> selectUiComponentRegistryList() {
        return selectList("FrameworkBuilderObservabilityMapper.selectUiComponentRegistryList");
    }

    public List<UiComponentUsageVO> selectUiComponentUsageList(String componentId) {
        return selectList("FrameworkBuilderObservabilityMapper.selectUiComponentUsageList", componentId);
    }
}
