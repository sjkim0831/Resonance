package egovframework.com.platform.screenbuilder.support.impl;

import egovframework.com.common.trace.UiComponentRegistryVO;
import egovframework.com.common.trace.UiComponentUsageVO;
import egovframework.com.common.mapper.UiObservabilityRegistryMapper;
import egovframework.com.platform.screenbuilder.support.CarbonetScreenBuilderComponentRegistrySource;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class CarbonetScreenBuilderComponentRegistrySourceImpl implements CarbonetScreenBuilderComponentRegistrySource {

    private final UiObservabilityRegistryMapper uiObservabilityRegistryMapper;

    public CarbonetScreenBuilderComponentRegistrySourceImpl(UiObservabilityRegistryMapper uiObservabilityRegistryMapper) {
        this.uiObservabilityRegistryMapper = uiObservabilityRegistryMapper;
    }

    @Override
    public List<UiComponentUsageVO> selectComponentUsageList(String componentId) throws Exception {
        return uiObservabilityRegistryMapper.selectUiComponentUsageList(componentId);
    }

    @Override
    public void remapComponentUsage(String fromComponentId, String toComponentId) throws Exception {
        Map<String, String> payload = new LinkedHashMap<>();
        payload.put("fromComponentId", fromComponentId);
        payload.put("toComponentId", toComponentId);
        uiObservabilityRegistryMapper.updateUiPageComponentMapComponentId(payload);
    }

    @Override
    public void deleteComponentRegistry(String componentId) throws Exception {
        uiObservabilityRegistryMapper.deleteUiComponentRegistry(componentId);
    }

    @Override
    public List<UiComponentRegistryVO> selectComponentRegistryList() throws Exception {
        return uiObservabilityRegistryMapper.selectUiComponentRegistryList();
    }

    @Override
    public int countComponentRegistry(String componentId) throws Exception {
        return uiObservabilityRegistryMapper.countUiComponentRegistry(componentId);
    }

    @Override
    public void insertComponentRegistry(UiComponentRegistryVO row) throws Exception {
        uiObservabilityRegistryMapper.insertUiComponentRegistry(row);
    }

    @Override
    public void updateComponentRegistry(UiComponentRegistryVO row) throws Exception {
        uiObservabilityRegistryMapper.updateUiComponentRegistry(row);
    }
}
