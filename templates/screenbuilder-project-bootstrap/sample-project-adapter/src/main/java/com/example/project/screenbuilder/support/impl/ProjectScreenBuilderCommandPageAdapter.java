package com.example.project.screenbuilder.support.impl;

import egovframework.com.platform.screenbuilder.support.ScreenBuilderCommandPagePort;

import java.util.Map;

public class ProjectScreenBuilderCommandPageAdapter implements ScreenBuilderCommandPagePort {

    @Override
    public Map<String, Object> getScreenCommandPage(String pageId) {
        throw new UnsupportedOperationException(
                "Implement project command-page lookup for the given pageId.");
    }
}
