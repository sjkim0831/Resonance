package egovframework.com.migration;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.flywaydb.core.api.output.MigrateResult;

import java.util.Map;

/**
 * Minimal deployment entry point which owns schema migration without starting
 * Spring, JPA, Actuator, web, session, or application component scanning.
 */
public final class FlywayMigrationApplication {

    private FlywayMigrationApplication() {
    }

    public static void main(String[] args) {
        String host = env("POSTGRES_HOST", "postgres-haproxy");
        String database = env("POSTGRES_DB", "carbonet");
        String url = env(
                "SPRING_DATASOURCE_URL",
                "jdbc:postgresql://" + host + ":5432/" + database + "?sslmode=disable"
        );
        String user = env("SPRING_FLYWAY_USER", env("POSTGRES_USER", "postgres"));
        String password = requiredEnv("SPRING_FLYWAY_PASSWORD");

        Flyway flyway = Flyway.configure()
                .dataSource(url, user, password)
                .locations("classpath:db/migration/postgresql")
                .table("carbonet_flyway_schema_history")
                .baselineOnMigrate(true)
                .baselineVersion(MigrationVersion.fromVersion("20260710000000"))
                .baselineDescription("Existing Carbonet schema before managed migrations")
                .validateOnMigrate(true)
                .outOfOrder(false)
                .cleanDisabled(true)
                .placeholders(Map.of("appName", "carbonet", "managedBy", "flyway"))
                .load();

        MigrateResult result = flyway.migrate();
        System.out.printf(
                "FLYWAY_MIGRATION_PASS database=%s initial=%s target=%s executed=%d success=%s%n",
                database,
                result.initialSchemaVersion,
                result.targetSchemaVersion,
                result.migrationsExecuted,
                result.success
        );
        if (!result.success) {
            throw new IllegalStateException("Flyway migration did not complete successfully");
        }
    }

    private static String env(String name, String fallback) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? fallback : value;
    }

    private static String requiredEnv(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("Required deployment environment is missing: " + name);
        }
        return value;
    }
}
