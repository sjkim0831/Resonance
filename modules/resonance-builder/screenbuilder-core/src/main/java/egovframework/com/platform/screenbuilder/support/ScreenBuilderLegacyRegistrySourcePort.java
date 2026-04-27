package egovframework.com.platform.screenbuilder.support;

import egovframework.com.platform.screenbuilder.model.ScreenBuilderComponentRegistryItemVO;

import java.util.List;

public interface ScreenBuilderLegacyRegistrySourcePort {

    List<ScreenBuilderComponentRegistryItemVO> loadLegacyRegistryItems() throws Exception;
}
