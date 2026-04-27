package egovframework.com.feature.admin.framework.builder.support.impl;

import egovframework.com.common.trace.UiComponentRegistryVO;
import egovframework.com.common.trace.UiPageComponentDetailVO;
import egovframework.com.common.trace.UiPageManifestVO;
import egovframework.com.feature.admin.framework.builder.support.CarbonetFrameworkBuilderObservabilitySource;
import egovframework.com.framework.builder.runtime.mapper.FrameworkBuilderObservabilityMapper;

import java.util.List;

public class CarbonetFrameworkBuilderObservabilitySourceAdapter implements CarbonetFrameworkBuilderObservabilitySource {

    private final FrameworkBuilderObservabilityMapper frameworkBuilderObservabilityMapper;

    public CarbonetFrameworkBuilderObservabilitySourceAdapter(FrameworkBuilderObservabilityMapper frameworkBuilderObservabilityMapper) {
        this.frameworkBuilderObservabilityMapper = frameworkBuilderObservabilityMapper;
    }

    @Override
    public List<UiPageManifestVO> selectUiPageManifestList() throws Exception {
        return frameworkBuilderObservabilityMapper.selectUiPageManifestList();
    }

    @Override
    public List<UiPageComponentDetailVO> selectUiPageComponentDetails(String pageId) throws Exception {
        return frameworkBuilderObservabilityMapper.selectUiPageComponentDetails(pageId);
    }

    @Override
    public List<UiComponentRegistryVO> selectUiComponentRegistryList() throws Exception {
        return frameworkBuilderObservabilityMapper.selectUiComponentRegistryList();
    }

    @Override
    public int countUiComponentUsage(String componentId) throws Exception {
        List<?> usages = frameworkBuilderObservabilityMapper.selectUiComponentUsageList(componentId);
        return usages == null ? 0 : usages.size();
    }
}
