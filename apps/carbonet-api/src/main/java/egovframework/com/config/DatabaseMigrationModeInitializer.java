package egovframework.com.config;

import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.Environment;

public class DatabaseMigrationModeInitializer implements ApplicationContextInitializer<ConfigurableApplicationContext> {

    @Override
    public void initialize(ConfigurableApplicationContext applicationContext) {
        Environment environment = applicationContext.getEnvironment();
        String flywayHistoryTable = environment.getProperty("spring.flyway.table", "carbonet_flyway_schema_history");
        String liquibaseHistoryTable = environment.getProperty(
                "spring.liquibase.database-change-log-table", "carbonet_databasechangelog");
        String liquibaseLockTable = environment.getProperty(
                "spring.liquibase.database-change-log-lock-table", "carbonet_databasechangeloglock");

        if (flywayHistoryTable.equalsIgnoreCase(liquibaseHistoryTable)
                || flywayHistoryTable.equalsIgnoreCase(liquibaseLockTable)
                || liquibaseHistoryTable.equalsIgnoreCase(liquibaseLockTable)) {
            throw new IllegalStateException(
                    "Flyway and Liquibase history/lock tables must be distinct."
            );
        }
    }
}
