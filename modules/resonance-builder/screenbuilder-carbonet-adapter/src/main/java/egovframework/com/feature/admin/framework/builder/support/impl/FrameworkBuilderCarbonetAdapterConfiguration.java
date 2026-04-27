package egovframework.com.feature.admin.framework.builder.support.impl;

import egovframework.com.feature.admin.framework.builder.support.CarbonetFrameworkApiResponseSource;
import egovframework.com.feature.admin.framework.builder.mapper.FrameworkBuilderCompatibilityMapper;
import egovframework.com.feature.admin.framework.builder.support.CarbonetFrameworkBuilderMetadataSource;
import egovframework.com.feature.admin.framework.builder.support.CarbonetFrameworkBuilderObservabilitySource;
import egovframework.com.framework.builder.runtime.mapper.FrameworkBuilderObservabilityMapper;
import egovframework.com.framework.builder.support.FrameworkBuilderCompatibilityPersistencePort;
import egovframework.com.framework.builder.support.FrameworkBuilderMetadataPort;
import egovframework.com.framework.builder.support.FrameworkBuilderObservabilityPort;
import egovframework.com.framework.builder.support.FrameworkBuilderRequestContextPort;
import egovframework.com.framework.contract.service.FrameworkContractMetadataService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FrameworkBuilderCarbonetAdapterConfiguration {

    @Bean
    @ConditionalOnMissingBean(CarbonetFrameworkApiResponseSource.class)
    public CarbonetFrameworkApiResponseSource carbonetFrameworkApiResponseSource() {
        return new CarbonetFrameworkApiResponseSourceAdapter();
    }

    @Bean
    @ConditionalOnMissingBean(CarbonetFrameworkBuilderMetadataSource.class)
    public CarbonetFrameworkBuilderMetadataSource carbonetFrameworkBuilderMetadataSource(
            FrameworkContractMetadataService frameworkContractMetadataService) {
        return new CarbonetFrameworkBuilderMetadataSourceAdapter(frameworkContractMetadataService);
    }

    @Bean
    @ConditionalOnMissingBean(CarbonetFrameworkBuilderObservabilitySource.class)
    public CarbonetFrameworkBuilderObservabilitySource carbonetFrameworkBuilderObservabilitySource(
            FrameworkBuilderObservabilityMapper frameworkBuilderObservabilityMapper) {
        return new CarbonetFrameworkBuilderObservabilitySourceAdapter(frameworkBuilderObservabilityMapper);
    }

    @Bean
    @ConditionalOnMissingBean(FrameworkBuilderMetadataPort.class)
    public FrameworkBuilderMetadataPort frameworkBuilderMetadataPort(
            CarbonetFrameworkBuilderMetadataSource carbonetFrameworkBuilderMetadataSource) {
        return new CarbonetFrameworkBuilderMetadataAdapter(carbonetFrameworkBuilderMetadataSource);
    }

    @Bean
    @ConditionalOnMissingBean(FrameworkBuilderObservabilityPort.class)
    public FrameworkBuilderObservabilityPort frameworkBuilderObservabilityPort(
            CarbonetFrameworkBuilderObservabilitySource carbonetFrameworkBuilderObservabilitySource) {
        return new CarbonetFrameworkBuilderObservabilityAdapter(carbonetFrameworkBuilderObservabilitySource);
    }

    @Bean
    @ConditionalOnMissingBean(FrameworkBuilderRequestContextPort.class)
    public FrameworkBuilderRequestContextPort frameworkBuilderRequestContextPort() {
        return new CarbonetFrameworkBuilderRequestContextAdapter();
    }

    @Bean
    @ConditionalOnMissingBean(FrameworkBuilderCompatibilityPersistencePort.class)
    public FrameworkBuilderCompatibilityPersistencePort frameworkBuilderCompatibilityPersistencePort(
            FrameworkBuilderCompatibilityMapper frameworkBuilderCompatibilityMapper) {
        return new CarbonetFrameworkBuilderCompatibilityPersistenceAdapter(frameworkBuilderCompatibilityMapper);
    }
}
