package egovframework.com.config.security;

import org.egovframe.boot.security.EgovSecurityProperties;
import org.springframework.beans.BeansException;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;
import org.springframework.beans.factory.support.BeanDefinitionRegistry;
import org.springframework.beans.factory.support.BeanDefinitionRegistryPostProcessor;
import org.springframework.beans.factory.support.RootBeanDefinition;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;

@Configuration
@EnableConfigurationProperties(EgovSecurityProperties.class)
public class CarbonetSecurityOverrideConfig {

    @Bean
    public static BeanDefinitionRegistryPostProcessor carbonetAccessDeniedHandlerOverride() {
        return new BeanDefinitionRegistryPostProcessor() {
            @Override
            public void postProcessBeanDefinitionRegistry(@NonNull BeanDefinitionRegistry registry) throws BeansException {
                if (registry.containsBeanDefinition("egovAccessDeniedHandler")) {
                    registry.removeBeanDefinition("egovAccessDeniedHandler");
                }

                RootBeanDefinition beanDefinition = new RootBeanDefinition(CarbonetAccessDeniedHandler.class);
                beanDefinition.setRole(BeanDefinition.ROLE_APPLICATION);
                beanDefinition.setAutowireMode(RootBeanDefinition.AUTOWIRE_CONSTRUCTOR);
                registry.registerBeanDefinition("egovAccessDeniedHandler", beanDefinition);

                if (registry.containsBeanDefinition("loginUrlAuthenticationEntryPoint")) {
                    registry.removeBeanDefinition("loginUrlAuthenticationEntryPoint");
                }

                RootBeanDefinition entryPointBeanDefinition =
                        new RootBeanDefinition(CarbonetAdminAwareLoginUrlAuthenticationEntryPoint.class);
                entryPointBeanDefinition.setRole(BeanDefinition.ROLE_APPLICATION);
                entryPointBeanDefinition.setAutowireMode(RootBeanDefinition.AUTOWIRE_CONSTRUCTOR);
                registry.registerBeanDefinition("loginUrlAuthenticationEntryPoint", entryPointBeanDefinition);
            }

            @Override
            public void postProcessBeanFactory(@NonNull ConfigurableListableBeanFactory beanFactory) throws BeansException {
            }
        };
    }
}
