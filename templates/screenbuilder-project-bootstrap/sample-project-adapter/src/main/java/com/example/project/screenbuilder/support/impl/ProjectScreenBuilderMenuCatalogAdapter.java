package com.example.project.screenbuilder.support.impl;

import egovframework.com.platform.screenbuilder.support.ScreenBuilderMenuCatalogPort;
import egovframework.com.platform.screenbuilder.support.model.ScreenBuilderMenuDescriptor;

import java.util.List;

public class ProjectScreenBuilderMenuCatalogAdapter implements ScreenBuilderMenuCatalogPort {

    @Override
    public List<ScreenBuilderMenuDescriptor> selectMenuTreeList(String codeId) {
        throw new UnsupportedOperationException(
                "Implement project menu lookup and map rows into ScreenBuilderMenuDescriptor.");
    }
}
