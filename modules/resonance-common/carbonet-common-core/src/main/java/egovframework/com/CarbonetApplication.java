package egovframework.com;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;
import org.springframework.beans.factory.support.BeanDefinitionRegistry;
import org.springframework.beans.factory.support.BeanDefinitionRegistryPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.Arrays;
import java.util.List;

import javax.sql.DataSource;

@SpringBootApplication
@ComponentScan(
        basePackages = { "egovframework.com", "org.egovframe.boot" },
        excludeFilters = {
                @ComponentScan.Filter(type = FilterType.REGEX, pattern = "egovframework\\.com\\.platform\\.screenbuilder\\..*"),
                @ComponentScan.Filter(type = FilterType.REGEX, pattern = "egovframework\\.com\\.feature\\.admin\\.screenbuilder\\..*"),
                @ComponentScan.Filter(type = FilterType.REGEX, pattern = "egovframework\\.com\\.framework\\.builder\\..*"),
                @ComponentScan.Filter(type = FilterType.REGEX, pattern = "egovframework\\.com\\.feature\\.admin\\.framework\\.builder\\..*")
        })
@EnableScheduling
@Import({egovframework.com.config.data.DataSourceConfig.class})
public class CarbonetApplication {

    @Value("${spring.datasource.driver-class-name:cubrid.jdbc.driver.CUBRIDDriver}")
    private String driverClassName;

    @Value("${spring.datasource.url}")
    private String url;

    @Value("${spring.datasource.username:dba}")
    private String username;

    @Value("${spring.datasource.password:}")
    private String password;

    @Value("${spring.datasource.hikari.maximum-pool-size:20}")
    private int maximumPoolSize;

    @Value("${spring.datasource.hikari.connection-timeout:20000}")
    private long connectionTimeout;

    @Value("${spring.datasource.hikari.idle-timeout:30000}")
    private long idleTimeout;

    @Value("${spring.datasource.hikari.minimum-idle:5}")
    private int minimumIdle;

    @Value("${spring.datasource.hikari.max-lifetime:1800000}")
    private long maxLifetime;

    @Value("${spring.datasource.hikari.initialization-fail-timeout:-1}")
    private long initializationFailTimeout;

    @Bean(name = "dataSource")
    @Primary
    public DataSource dataSource() {
        HikariConfig config = new HikariConfig();
        config.setDriverClassName(driverClassName);
        config.setJdbcUrl(url);
        config.setUsername(username);
        config.setPassword(password);
        config.setMaximumPoolSize(maximumPoolSize);
        config.setConnectionTimeout(connectionTimeout);
        config.setIdleTimeout(idleTimeout);
        config.setMinimumIdle(minimumIdle);
        config.setMaxLifetime(maxLifetime);
        config.setInitializationFailTimeout(initializationFailTimeout);
        return new HikariDataSource(config);
    }

    @Bean
    public static BeanDefinitionRegistryPostProcessor screenBuilderModuleIsolationPostProcessor() {
        return new BeanDefinitionRegistryPostProcessor() {
            private final List<String> excludedPrefixes = Arrays.asList(
                    "egovframework.com.platform.screenbuilder.",
                    "egovframework.com.feature.admin.screenbuilder.",
                    "egovframework.com.framework.builder.",
                    "egovframework.com.feature.admin.framework.builder.");
            private final List<String> excludedClasses = Arrays.asList(
                    "egovframework.com.feature.admin.web.AdminScreenBuilderController");
            private final List<String> excludedBeanNames = Arrays.asList(
                    "adminScreenBuilderController",
                    "screenBuilderApiController");

            @Override
            public void postProcessBeanDefinitionRegistry(BeanDefinitionRegistry registry) throws BeansException {
                for (String beanName : registry.getBeanDefinitionNames()) {
                    if (excludedBeanNames.contains(beanName)) {
                        registry.removeBeanDefinition(beanName);
                        continue;
                    }
                    BeanDefinition beanDefinition = registry.getBeanDefinition(beanName);
                    String beanClassName = beanDefinition.getBeanClassName();
                    if (beanClassName == null || beanClassName.isEmpty()) {
                        continue;
                    }
                    if (isExcluded(beanClassName)) {
                        registry.removeBeanDefinition(beanName);
                    }
                }
            }

            @Override
            public void postProcessBeanFactory(ConfigurableListableBeanFactory beanFactory) throws BeansException {
            }

            private boolean isExcluded(String beanClassName) {
                for (String excludedClass : excludedClasses) {
                    if (excludedClass.equals(beanClassName)) {
                        return true;
                    }
                }
                for (String prefix : excludedPrefixes) {
                    if (beanClassName.startsWith(prefix)) {
                        return true;
                    }
                }
                return false;
            }
        };
    }

    public static void main(String[] args) {
        System.setProperty("file.encoding", "UTF-8");
        SpringApplication.run(CarbonetApplication.class, args);
    }
}
