package com.example.project.screenbuilder.support.impl;

import egovframework.com.common.trace.UiComponentRegistryVO;
import egovframework.com.common.trace.UiComponentUsageVO;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderComponentRegistryPort;

import java.util.Collections;
import java.util.List;

public class ProjectScreenBuilderComponentRegistryAdapter implements ScreenBuilderComponentRegistryPort {

    @Override
    public List<UiComponentUsageVO> selectComponentUsageList(String componentId) {
        return Collections.emptyList();
    }

    @Override
    public void remapComponentUsage(String fromComponentId, String toComponentId) {
        throw new UnsupportedOperationException(
                "Implement project component-usage remap if the project supports publish-time replacement.");
    }

    @Override
    public void deleteComponentRegistry(String componentId) {
        throw new UnsupportedOperationException(
                "Implement project component-registry delete if the project stores registry rows.");
    }

    @Override
    public List<UiComponentRegistryVO> selectComponentRegistryList() {
        return Collections.emptyList();
    }

    @Override
    public int countComponentRegistry(String componentId) {
        return 0;
    }

    @Override
    public void upsertComponentRegistry(UiComponentRegistryVO row) {
        throw new UnsupportedOperationException(
                "Implement project component-registry upsert if the project manages registry rows.");
    }
}
