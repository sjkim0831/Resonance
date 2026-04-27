package egovframework.com;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.scheduling.annotation.EnableScheduling;

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
@EnableScheduling
public class OperationsConsoleApplication {
    public static void main(String[] args) {
        System.setProperty("file.encoding", "UTF-8");
        System.setProperty("spring.application.name", "operations-console");
        SpringApplication.run(OperationsConsoleApplication.class, args);
    }
}
