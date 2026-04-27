package egovframework.com.platform.screenbuilder.support;

import egovframework.com.common.trace.UiComponentRegistryVO;
import egovframework.com.common.trace.UiComponentUsageVO;

import java.util.List;

public interface CarbonetScreenBuilderComponentRegistrySource {

    List<UiComponentUsageVO> selectComponentUsageList(String componentId) throws Exception;

    void remapComponentUsage(String fromComponentId, String toComponentId) throws Exception;

    void deleteComponentRegistry(String componentId) throws Exception;

    List<UiComponentRegistryVO> selectComponentRegistryList() throws Exception;

    int countComponentRegistry(String componentId) throws Exception;

    void insertComponentRegistry(UiComponentRegistryVO row) throws Exception;

    void updateComponentRegistry(UiComponentRegistryVO row) throws Exception;
}
