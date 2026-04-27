package egovframework.com.platform.screenbuilder.support.impl;

import egovframework.com.platform.screenbuilder.support.CarbonetScreenBuilderAuthoritySource;
import egovframework.com.platform.screenbuilder.support.CarbonetScreenBuilderCommandPageSource;
import egovframework.com.platform.screenbuilder.support.CarbonetScreenBuilderComponentRegistrySource;
import egovframework.com.platform.screenbuilder.support.CarbonetScreenBuilderMenuSource;
import egovframework.com.platform.screenbuilder.support.CarbonetScreenBuilderRuntimeCompareSource;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderArtifactNamingPolicyPort;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderAuthorityContractPort;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderCommandPagePort;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderComponentRegistryPort;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderMenuBindingPolicyPort;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderMenuCatalogPort;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderRequestContextPolicyPort;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderRuntimeComparePolicyPort;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderRuntimeComparePort;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ScreenBuilderCarbonetAdapterConfiguration {

    @Bean
    @ConditionalOnMissingBean(ScreenBuilderAuthorityContractPort.class)
    public ScreenBuilderAuthorityContractPort screenBuilderAuthorityContractPort(
            CarbonetScreenBuilderAuthoritySource carbonetScreenBuilderAuthoritySource) {
        return new CarbonetScreenBuilderAuthorityContractAdapter(carbonetScreenBuilderAuthoritySource);
    }

    @Bean
    @ConditionalOnMissingBean(ScreenBuilderArtifactNamingPolicyPort.class)
    public ScreenBuilderArtifactNamingPolicyPort screenBuilderArtifactNamingPolicyPort() {
        return new CarbonetScreenBuilderArtifactNamingPolicyAdapter();
    }

    @Bean
    @ConditionalOnMissingBean(ScreenBuilderRequestContextPolicyPort.class)
    public ScreenBuilderRequestContextPolicyPort screenBuilderRequestContextPolicyPort() {
        return new CarbonetScreenBuilderRequestContextPolicyAdapter();
    }

    @Bean
    @ConditionalOnMissingBean(ScreenBuilderMenuBindingPolicyPort.class)
    public ScreenBuilderMenuBindingPolicyPort screenBuilderMenuBindingPolicyPort() {
        return new CarbonetScreenBuilderMenuBindingPolicyAdapter();
    }

    @Bean
    @ConditionalOnMissingBean(ScreenBuilderRuntimeComparePolicyPort.class)
    public ScreenBuilderRuntimeComparePolicyPort screenBuilderRuntimeComparePolicyPort() {
        return new CarbonetScreenBuilderRuntimeComparePolicyAdapter();
    }

    @Bean
    @ConditionalOnMissingBean(ScreenBuilderCommandPagePort.class)
    public ScreenBuilderCommandPagePort screenBuilderCommandPagePort(
            CarbonetScreenBuilderCommandPageSource carbonetScreenBuilderCommandPageSource) {
        return new CarbonetScreenBuilderCommandPageAdapter(carbonetScreenBuilderCommandPageSource);
    }

    @Bean
    @ConditionalOnMissingBean(ScreenBuilderComponentRegistryPort.class)
    public ScreenBuilderComponentRegistryPort screenBuilderComponentRegistryPort(
            CarbonetScreenBuilderComponentRegistrySource carbonetScreenBuilderComponentRegistrySource) {
        return new CarbonetScreenBuilderComponentRegistryAdapter(carbonetScreenBuilderComponentRegistrySource);
    }

    @Bean
    @ConditionalOnMissingBean(ScreenBuilderRuntimeComparePort.class)
    public ScreenBuilderRuntimeComparePort screenBuilderRuntimeComparePort(
            CarbonetScreenBuilderRuntimeCompareSource carbonetScreenBuilderRuntimeCompareSource) {
        return new CarbonetScreenBuilderRuntimeCompareAdapter(carbonetScreenBuilderRuntimeCompareSource);
    }

    @Bean
    @ConditionalOnMissingBean(ScreenBuilderMenuCatalogPort.class)
    public ScreenBuilderMenuCatalogPort screenBuilderMenuCatalogPort(
            CarbonetScreenBuilderMenuSource carbonetScreenBuilderMenuSource,
            ScreenBuilderMenuBindingPolicyPort screenBuilderMenuBindingPolicyPort,
            ScreenBuilderRuntimeComparePolicyPort screenBuilderRuntimeComparePolicyPort) {
        return new CarbonetScreenBuilderMenuCatalogAdapter(
                carbonetScreenBuilderMenuSource,
                screenBuilderMenuBindingPolicyPort,
                screenBuilderRuntimeComparePolicyPort);
    }
}
