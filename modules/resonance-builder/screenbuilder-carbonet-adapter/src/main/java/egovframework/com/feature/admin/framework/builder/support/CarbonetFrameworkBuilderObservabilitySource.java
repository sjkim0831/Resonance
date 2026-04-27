package egovframework.com.feature.admin.framework.builder.support;

import egovframework.com.common.trace.UiComponentRegistryVO;
import egovframework.com.common.trace.UiPageComponentDetailVO;
import egovframework.com.common.trace.UiPageManifestVO;

import java.util.List;

public interface CarbonetFrameworkBuilderObservabilitySource {

    List<UiPageManifestVO> selectUiPageManifestList() throws Exception;

    List<UiPageComponentDetailVO> selectUiPageComponentDetails(String pageId) throws Exception;

    List<UiComponentRegistryVO> selectUiComponentRegistryList() throws Exception;

    int countUiComponentUsage(String componentId) throws Exception;
}
