package egovframework.com.feature.admin.framework.builder.support.impl;

import egovframework.com.common.trace.UiComponentRegistryVO;
import egovframework.com.common.trace.UiPageComponentDetailVO;
import egovframework.com.common.trace.UiPageManifestVO;
import egovframework.com.feature.admin.framework.builder.support.CarbonetFrameworkBuilderObservabilitySource;
import egovframework.com.framework.builder.support.FrameworkBuilderObservabilityPort;
import lombok.RequiredArgsConstructor;

import java.util.List;

@RequiredArgsConstructor
public class CarbonetFrameworkBuilderObservabilityAdapter implements FrameworkBuilderObservabilityPort {

    private final CarbonetFrameworkBuilderObservabilitySource carbonetFrameworkBuilderObservabilitySource;

    @Override
    public List<UiPageManifestVO> selectUiPageManifestList() throws Exception {
        return carbonetFrameworkBuilderObservabilitySource.selectUiPageManifestList();
    }

    @Override
    public List<UiPageComponentDetailVO> selectUiPageComponentDetails(String pageId) throws Exception {
        return carbonetFrameworkBuilderObservabilitySource.selectUiPageComponentDetails(pageId);
    }

    @Override
    public List<UiComponentRegistryVO> selectUiComponentRegistryList() throws Exception {
        return carbonetFrameworkBuilderObservabilitySource.selectUiComponentRegistryList();
    }

    @Override
    public int countUiComponentUsage(String componentId) throws Exception {
        return carbonetFrameworkBuilderObservabilitySource.countUiComponentUsage(componentId);
    }
}
