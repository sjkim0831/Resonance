package egovframework.com.migration;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.data.jpa.JpaRepositoriesAutoConfiguration;
import org.springframework.boot.autoconfigure.liquibase.LiquibaseAutoConfiguration;
import org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration;
import org.springframework.context.ConfigurableApplicationContext;

/**
 * Minimal, non-web deployment entry point which owns schema migration.
 *
 * <p>The runtime deployment keeps Flyway disabled so three application pods do
 * not validate and contend for the same schema on every rollout. The
 * deployment pipeline runs this class once from the candidate image and only
 * promotes that image after this process exits successfully.</p>
 */
@SpringBootConfiguration
@EnableAutoConfiguration(exclude = {
        HibernateJpaAutoConfiguration.class,
        JpaRepositoriesAutoConfiguration.class,
        LiquibaseAutoConfiguration.class
})
public class FlywayMigrationApplication {

    public static void main(String[] args) {
        SpringApplication application = new SpringApplication(FlywayMigrationApplication.class);
        application.setWebApplicationType(WebApplicationType.NONE);
        // This context contains only auto-configuration required by Flyway.
        // Eager ordering is intentional: lazy DataSource creation can let an
        // actuator health contributor seal Hikari before property binding.
        application.setLazyInitialization(false);
        try (ConfigurableApplicationContext ignored = application.run(args)) {
            // FlywayAutoConfiguration completes before the context is returned.
        }
    }
}
