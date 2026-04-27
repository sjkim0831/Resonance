package egovframework.com;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.context.ApplicationContext;
import org.springframework.scheduling.annotation.EnableScheduling;

import egovframework.com.common.mapper.UiObservabilityRegistryMapper;
import egovframework.com.framework.authority.model.FrameworkAuthorityRoleContractVO;
import egovframework.com.feature.admin.framework.builder.mapper.FrameworkBuilderCompatibilityMapper;
import egovframework.com.framework.builder.runtime.mapper.FrameworkBuilderObservabilityMapper;
import egovframework.com.feature.admin.framework.builder.support.impl.FrameworkBuilderCarbonetAdapterConfiguration;
import egovframework.com.platform.screenbuilder.support.CarbonetScreenBuilderAuthoritySource;
import egovframework.com.platform.screenbuilder.support.CarbonetScreenBuilderCommandPageSource;
import egovframework.com.platform.screenbuilder.support.CarbonetScreenBuilderComponentRegistrySource;
import egovframework.com.platform.screenbuilder.support.CarbonetScreenBuilderMenuSource;
import egovframework.com.platform.screenbuilder.support.CarbonetScreenBuilderRuntimeCompareSource;
import egovframework.com.platform.screenbuilder.support.impl.CarbonetScreenBuilderCommandPageSourceImpl;
import egovframework.com.platform.screenbuilder.support.impl.CarbonetScreenBuilderComponentRegistrySourceImpl;
import egovframework.com.platform.screenbuilder.support.impl.ScreenBuilderCarbonetAdapterConfiguration;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Platform operations and management console.
 * Includes builder internals, version control, and platform monitoring.
 */
@SpringBootApplication
@ComponentScan(basePackages = { "egovframework.com", "org.egovframe.boot" },
    excludeFilters = {
        @ComponentScan.Filter(type = org.springframework.context.annotation.FilterType.REGEX,
            pattern = "egovframework\\.com\\.feature\\.emission\\..*"),
        @ComponentScan.Filter(type = org.springframework.context.annotation.FilterType.REGEX,
            pattern = "egovframework\\.com\\.feature\\.trade\\..*")
    })
@Import({
    FrameworkBuilderCarbonetAdapterConfiguration.class,
    ScreenBuilderCarbonetAdapterConfiguration.class,
    FrameworkBuilderObservabilityMapper.class
})
@EnableScheduling
public class OperationsConsoleApplication {
    @Bean(name = "frameworkBuilderCarbonetAdapterConfiguration")
    public FrameworkBuilderCarbonetAdapterConfiguration frameworkBuilderCarbonetAdapterConfiguration() {
        return new FrameworkBuilderCarbonetAdapterConfiguration();
    }

    @Bean(name = "screenBuilderCarbonetAdapterConfiguration")
    public ScreenBuilderCarbonetAdapterConfiguration screenBuilderCarbonetAdapterConfiguration() {
        return new ScreenBuilderCarbonetAdapterConfiguration();
    }

    @Bean
    @Primary
    public CarbonetScreenBuilderCommandPageSource carbonetScreenBuilderCommandPageSource(ApplicationContext applicationContext) {
        return new CarbonetScreenBuilderCommandPageSourceImpl(applicationContext);
    }

    @Bean
    @Primary
    public CarbonetScreenBuilderComponentRegistrySource carbonetScreenBuilderComponentRegistrySource(
            UiObservabilityRegistryMapper uiObservabilityRegistryMapper) {
        return new CarbonetScreenBuilderComponentRegistrySourceImpl(uiObservabilityRegistryMapper);
    }

    @Bean
    @Primary
    public CarbonetScreenBuilderAuthoritySource carbonetScreenBuilderAuthoritySource() {
        return () -> Collections.<FrameworkAuthorityRoleContractVO>emptyList();
    }

    @Bean
    @Primary
    public CarbonetScreenBuilderMenuSource carbonetScreenBuilderMenuSource() {
        return codeId -> List.of();
    }

    @Bean
    @Primary
    public CarbonetScreenBuilderRuntimeCompareSource carbonetScreenBuilderRuntimeCompareSource() {
        return request -> Map.of("status", "SKIPPED", "reason", "runtime compare source is not configured for operations-console");
    }

    @Bean
    public FrameworkBuilderObservabilityMapper frameworkBuilderObservabilityMapper() {
        return new FrameworkBuilderObservabilityMapper();
    }

    @Bean
    public FrameworkBuilderCompatibilityMapper frameworkBuilderCompatibilityMapper() {
        return new FrameworkBuilderCompatibilityMapper();
    }

    public static void main(String[] args) {
        System.setProperty("file.encoding", "UTF-8");
        System.setProperty("spring.application.name", "operations-console");
        SpringApplication.run(OperationsConsoleApplication.class, args);
    }
}
