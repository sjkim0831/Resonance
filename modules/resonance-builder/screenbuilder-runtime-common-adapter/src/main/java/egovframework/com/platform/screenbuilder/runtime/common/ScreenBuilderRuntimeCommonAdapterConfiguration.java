package egovframework.com.platform.screenbuilder.runtime.common;

import egovframework.com.platform.screenbuilder.support.ScreenBuilderArtifactNamingPolicyPort;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderMenuBindingPolicyPort;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderRequestContextPolicyPort;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderRuntimeComparePolicyPort;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(ScreenBuilderRuntimeCommonProperties.class)
public class ScreenBuilderRuntimeCommonAdapterConfiguration {

    @Bean
    @ConditionalOnMissingBean(name = "screenBuilderPropertyBackedPolicyAdapter")
    public PropertyBackedScreenBuilderPolicyAdapter screenBuilderPropertyBackedPolicyAdapter(
            ScreenBuilderRuntimeCommonProperties properties) {
        return new PropertyBackedScreenBuilderPolicyAdapter(properties);
    }

    @Bean
    @ConditionalOnMissingBean(ScreenBuilderMenuBindingPolicyPort.class)
    public ScreenBuilderMenuBindingPolicyPort screenBuilderMenuBindingPolicyPort(
            PropertyBackedScreenBuilderPolicyAdapter adapter) {
        return adapter;
    }

    @Bean
    @ConditionalOnMissingBean(ScreenBuilderArtifactNamingPolicyPort.class)
    public ScreenBuilderArtifactNamingPolicyPort screenBuilderArtifactNamingPolicyPort(
            PropertyBackedScreenBuilderPolicyAdapter adapter) {
        return adapter;
    }

    @Bean
    @ConditionalOnMissingBean(ScreenBuilderRuntimeComparePolicyPort.class)
    public ScreenBuilderRuntimeComparePolicyPort screenBuilderRuntimeComparePolicyPort(
            PropertyBackedScreenBuilderPolicyAdapter adapter) {
        return adapter;
    }

    @Bean
    @ConditionalOnMissingBean(ScreenBuilderRequestContextPolicyPort.class)
    public ScreenBuilderRequestContextPolicyPort screenBuilderRequestContextPolicyPort(
            PropertyBackedScreenBuilderPolicyAdapter adapter) {
        return adapter;
    }
}
