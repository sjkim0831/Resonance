package egovframework.com.common.adapter.impl;

import egovframework.com.common.adapter.ProjectAuthorityPort;
import egovframework.com.common.adapter.ProjectMenuPort;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Configuration that provides fallback default implementations for Project Ports
 * if a specific Project Adapter JAR is not present or doesn't provide them.
 */
@Configuration
public class DefaultAdapterBindingConfig {

    @Bean
    @ConditionalOnMissingBean(ProjectMenuPort.class)
    public ProjectMenuPort defaultProjectMenuPort() {
        return new ProjectMenuPort() {
            @Override
            public String getProfileId() {
                return "default-profile";
            }

            @Override
            public List<Map<String, Object>> getCustomMenuItems() {
                return Collections.emptyList();
            }

            @Override
            public boolean isMenuHidden(String standardMenuId) {
                return false;
            }
        };
    }

    @Bean
    @ConditionalOnMissingBean(ProjectAuthorityPort.class)
    public ProjectAuthorityPort defaultProjectAuthorityPort() {
        return new ProjectAuthorityPort() {
            @Override
            public boolean hasFeatureAccess(String userId, String featureCode) {
                return true; // Fallback allows common core logic to take precedence
            }

            @Override
            public String getDefaultProjectRole() {
                return "ROLE_USER";
            }
        };
    }
}
