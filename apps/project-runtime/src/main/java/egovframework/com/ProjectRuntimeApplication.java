package egovframework.com;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.config.data.DataSourceConfig;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;

import javax.sql.DataSource;

/**
 * Focuses on project execution and business logic, excluding management/builder internals.
 *
 * NOTE: screenbuilder-carbonet-adapter package is excluded from component scan because it contains
 * Process.exec dependencies that cause startup failures in containerized environments.
 * Controllers that need to be exposed are manually registered as beans below.
 */
@SpringBootApplication
@ComponentScan(
        basePackages = { "egovframework.com", "org.egovframe.boot", "com.resonance" },
        excludeFilters = {
                @ComponentScan.Filter(type = FilterType.REGEX, pattern = "egovframework\\.com\\.platform\\.screenbuilder\\..*"),
                @ComponentScan.Filter(type = FilterType.REGEX, pattern = "egovframework\\.com\\.feature\\.admin\\.screenbuilder\\..*"),
                @ComponentScan.Filter(type = FilterType.REGEX, pattern = "egovframework\\.com\\.framework\\.builder\\..*"),
                @ComponentScan.Filter(type = FilterType.REGEX, pattern = "egovframework\\.com\\.feature\\.admin\\.framework\\.builder\\..*"),
                @ComponentScan.Filter(type = FilterType.REGEX, pattern = "egovframework\\.com\\.platform\\.versioncontrol\\..*"),
                @ComponentScan.Filter(type = FilterType.REGEX, pattern = "egovframework\\.com\\.platform\\.runtimecontrol\\..*")
        })
@EnableScheduling
@Import(DataSourceConfig.class)
public class ProjectRuntimeApplication {

    static {
        // Enforce SLF4J logging for MyBatis before any MyBatis classes get loaded
        try {
            org.apache.ibatis.logging.LogFactory.useSlf4jLogging();
            System.out.println("[ProjectRuntimeApplication] Static Init: Forced SLF4J Logging for MyBatis");
        } catch (Throwable t) {
            System.err.println("[ProjectRuntimeApplication] Static Init: Failed to force SLF4J: " + t.getMessage());
        }
    }

    @Bean
    public JdbcTemplate jdbcTemplate(@Qualifier("dataSource") DataSource dataSource) {
        return new JdbcTemplate(dataSource);
    }

    public static void main(String[] args) {
        // Double enforce at main entry point
        try {
            org.apache.ibatis.logging.LogFactory.useSlf4jLogging();
            System.out.println("[ProjectRuntimeApplication] Main Entry: Forced SLF4J Logging for MyBatis");
        } catch (Throwable t) {
            System.err.println("[ProjectRuntimeApplication] Main Entry: Failed to force SLF4J: " + t.getMessage());
        }
        System.setProperty("file.encoding", "UTF-8");
        System.setProperty("spring.application.name", "project-runtime");
        SpringApplication.run(ProjectRuntimeApplication.class, args);
    }
}
