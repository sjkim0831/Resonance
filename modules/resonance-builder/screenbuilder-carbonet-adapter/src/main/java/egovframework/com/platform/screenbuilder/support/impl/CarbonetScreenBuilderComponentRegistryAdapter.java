package egovframework.com.platform.screenbuilder.support.impl;

import egovframework.com.common.trace.UiComponentRegistryVO;
import egovframework.com.common.trace.UiComponentUsageVO;
import egovframework.com.platform.screenbuilder.support.CarbonetScreenBuilderComponentRegistrySource;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderComponentRegistryPort;
import lombok.RequiredArgsConstructor;

import java.util.List;

@RequiredArgsConstructor
public class CarbonetScreenBuilderComponentRegistryAdapter implements ScreenBuilderComponentRegistryPort {

    private final CarbonetScreenBuilderComponentRegistrySource carbonetScreenBuilderComponentRegistrySource;

    @Override
    public List<UiComponentUsageVO> selectComponentUsageList(String componentId) throws Exception {
        return carbonetScreenBuilderComponentRegistrySource.selectComponentUsageList(componentId);
    }

    @Override
    public void remapComponentUsage(String fromComponentId, String toComponentId) throws Exception {
        carbonetScreenBuilderComponentRegistrySource.remapComponentUsage(fromComponentId, toComponentId);
    }

    @Override
    public void deleteComponentRegistry(String componentId) throws Exception {
        carbonetScreenBuilderComponentRegistrySource.deleteComponentRegistry(componentId);
    }

    @Override
    public List<UiComponentRegistryVO> selectComponentRegistryList() throws Exception {
        return carbonetScreenBuilderComponentRegistrySource.selectComponentRegistryList();
    }

    @Override
    public int countComponentRegistry(String componentId) throws Exception {
        return carbonetScreenBuilderComponentRegistrySource.countComponentRegistry(componentId);
    }

    @Override
    public void upsertComponentRegistry(UiComponentRegistryVO row) throws Exception {
        if (countComponentRegistry(row == null ? null : row.getComponentId()) > 0) {
            carbonetScreenBuilderComponentRegistrySource.updateComponentRegistry(row);
        } else {
            carbonetScreenBuilderComponentRegistrySource.insertComponentRegistry(row);
        }
    }
}
