package egovframework.com;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Independent runtime for Carbonet projects.
 * Focuses on project execution and business logic, excluding management/builder internals.
 */
@SpringBootApplication
@ComponentScan(
        basePackages = { "egovframework.com", "org.egovframe.boot" },
        excludeFilters = {
                @ComponentScan.Filter(type = FilterType.REGEX, pattern = "egovframework\\.com\\.platform\\.screenbuilder\\..*"),
                @ComponentScan.Filter(type = FilterType.REGEX, pattern = "egovframework\\.com\\.feature\\.admin\\.screenbuilder\\..*"),
                @ComponentScan.Filter(type = FilterType.REGEX, pattern = "egovframework\\.com\\.framework\\.builder\\..*"),
                @ComponentScan.Filter(type = FilterType.REGEX, pattern = "egovframework\\.com\\.feature\\.admin\\.framework\\.builder\\..*"),
                @ComponentScan.Filter(type = FilterType.REGEX, pattern = "egovframework\\.com\\.platform\\.versioncontrol\\..*"),
                @ComponentScan.Filter(type = FilterType.REGEX, pattern = "egovframework\\.com\\.platform\\.runtimecontrol\\..*")
        })
@EnableScheduling
public class ProjectRuntimeApplication {
    public static void main(String[] args) {
        System.setProperty("file.encoding", "UTF-8");
        System.setProperty("spring.application.name", "project-runtime");
        SpringApplication.run(ProjectRuntimeApplication.class, args);
    }
}
