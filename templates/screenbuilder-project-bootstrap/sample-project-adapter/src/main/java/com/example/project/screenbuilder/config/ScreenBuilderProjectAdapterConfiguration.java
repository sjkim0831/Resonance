package com.example.project.screenbuilder.config;

import com.example.project.screenbuilder.support.impl.ProjectScreenBuilderAuthorityContractAdapter;
import com.example.project.screenbuilder.support.impl.ProjectScreenBuilderCommandPageAdapter;
import com.example.project.screenbuilder.support.impl.ProjectScreenBuilderComponentRegistryAdapter;
import com.example.project.screenbuilder.support.impl.ProjectScreenBuilderMenuCatalogAdapter;
import com.example.project.screenbuilder.support.impl.ProjectScreenBuilderRuntimeCompareAdapter;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderAuthorityContractPort;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderCommandPagePort;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderComponentRegistryPort;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderMenuCatalogPort;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderRuntimeComparePort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ScreenBuilderProjectAdapterConfiguration {

    @Bean
    public ScreenBuilderMenuCatalogPort screenBuilderMenuCatalogPort() {
        return new ProjectScreenBuilderMenuCatalogAdapter();
    }

    @Bean
    public ScreenBuilderCommandPagePort screenBuilderCommandPagePort() {
        return new ProjectScreenBuilderCommandPageAdapter();
    }

    @Bean
    public ScreenBuilderComponentRegistryPort screenBuilderComponentRegistryPort() {
        return new ProjectScreenBuilderComponentRegistryAdapter();
    }

    @Bean
    public ScreenBuilderAuthorityContractPort screenBuilderAuthorityContractPort() {
        return new ProjectScreenBuilderAuthorityContractAdapter();
    }

    @Bean
    public ScreenBuilderRuntimeComparePort screenBuilderRuntimeComparePort() {
        return new ProjectScreenBuilderRuntimeCompareAdapter();
    }
}
