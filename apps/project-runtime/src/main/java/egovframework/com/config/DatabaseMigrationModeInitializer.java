package egovframework.com.config;

import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.Environment;

public class DatabaseMigrationModeInitializer implements ApplicationContextInitializer<ConfigurableApplicationContext> {

    @Override
    public void initialize(ConfigurableApplicationContext applicationContext) {
        Environment environment = applicationContext.getEnvironment();
        boolean flywayEnabled = environment.getProperty("spring.flyway.enabled", Boolean.class, false);
        boolean liquibaseEnabled = environment.getProperty("spring.liquibase.enabled", Boolean.class, false);

        if (flywayEnabled && liquibaseEnabled) {
            throw new IllegalStateException(
                    "Flyway and Liquibase cannot be enabled at the same time. "
                            + "Enable only one of CARBONET_FLYWAY_ENABLED or CARBONET_LIQUIBASE_ENABLED."
            );
        }
    }
}
