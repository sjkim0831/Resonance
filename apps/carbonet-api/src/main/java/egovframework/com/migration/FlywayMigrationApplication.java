package egovframework.com.migration;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.flywaydb.core.api.output.MigrateResult;

import java.util.Locale;
import java.util.Map;

/**
 * Minimal deployment entry point which owns schema migration without starting
 * Spring, JPA, Actuator, web, session, or application component scanning.
 */
public final class FlywayMigrationApplication {

    private FlywayMigrationApplication() {
    }

    public static void main(String[] args) {
        long startedAt = System.nanoTime();
        String host = env("POSTGRES_HOST", "postgres-haproxy");
        String database = env("POSTGRES_DB", "carbonet");
        String url = env(
                "SPRING_DATASOURCE_URL",
                "jdbc:postgresql://" + host + ":5432/" + database + "?sslmode=disable"
        );
        String applicationName = env("CARBONET_FLYWAY_APPLICATION_NAME", "carbonet-flyway");
        if (applicationName.length() > 63
                || !applicationName.matches("[a-z0-9]([-a-z0-9]*[a-z0-9])?")) {
            throw new IllegalStateException("Flyway application name is invalid");
        }
        if (url.matches("(?i).*([?&])ApplicationName=.*")) {
            throw new IllegalStateException("SPRING_DATASOURCE_URL must not override the owned Flyway application name");
        }
        url = url + (url.contains("?") ? "&" : "?") + "ApplicationName=" + applicationName;
        String user = env("SPRING_FLYWAY_USER", env("POSTGRES_USER", "postgres"));
        String password = requiredEnv("SPRING_FLYWAY_PASSWORD");
        int statementTimeoutSeconds = boundedIntegerEnv(
                "CARBONET_FLYWAY_STATEMENT_TIMEOUT_SECONDS", 780, 60, 3600);
        int lockTimeoutSeconds = boundedIntegerEnv(
                "CARBONET_FLYWAY_LOCK_TIMEOUT_SECONDS", 10, 5, 120);
        if (lockTimeoutSeconds >= statementTimeoutSeconds) {
            throw new IllegalStateException("Flyway lock timeout must be shorter than statement timeout");
        }
        String initSql = String.format(
                Locale.ROOT,
                "SET statement_timeout = '%ds'; SET lock_timeout = '%ds'",
                statementTimeoutSeconds,
                lockTimeoutSeconds
        );

        Flyway flyway = Flyway.configure()
                .dataSource(url, user, password)
                .initSql(initSql)
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

        System.out.printf(
                "FLYWAY_MIGRATION_BUDGET applicationName=%s statementTimeoutSeconds=%d lockTimeoutSeconds=%d%n",
                applicationName,
                statementTimeoutSeconds,
                lockTimeoutSeconds
        );
        MigrateResult result = flyway.migrate();
        System.out.printf(
                "FLYWAY_MIGRATION_PASS database=%s initial=%s target=%s executed=%d success=%s durationMs=%d%n",
                database,
                result.initialSchemaVersion,
                result.targetSchemaVersion,
                result.migrationsExecuted,
                result.success,
                (System.nanoTime() - startedAt) / 1_000_000L
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

    private static int boundedIntegerEnv(String name, int fallback, int minimum, int maximum) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            return fallback;
        }
        try {
            int parsed = Integer.parseInt(value);
            if (parsed < minimum || parsed > maximum) {
                throw new IllegalStateException(
                        "Deployment timeout environment is outside " + minimum + ".." + maximum + ": " + name);
            }
            return parsed;
        } catch (NumberFormatException exception) {
            throw new IllegalStateException("Deployment timeout environment must be a whole number: " + name, exception);
        }
    }
}
