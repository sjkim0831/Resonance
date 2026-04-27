package egovframework.com.feature.admin.tools;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public class AuthorityRoleMappingSeedTool {

    private static final String ROLE_COMPANY_ADMIN = "ROLE_COMPANY_ADMIN";
    private static final String ROLE_DEPT_OPERATION = "ROLE_DEPT_OPERATION";
    private static final String ROLE_DEPT_CS = "ROLE_DEPT_CS";

    public static void main(String[] args) throws Exception {
        boolean dryRun = Boolean.parseBoolean(property("authority.seed.dry-run", "false"));
        String jdbcUrl = property("authority.seed.jdbc.url", "jdbc:cubrid:127.0.0.1:33000:carbonet:::?charset=UTF-8");
        String jdbcUser = property("authority.seed.jdbc.user", "dba");
        String jdbcPassword = property("authority.seed.jdbc.password", "");

        try (Connection connection = DriverManager.getConnection(jdbcUrl, jdbcUser, jdbcPassword)) {
            connection.setAutoCommit(false);
            Map<String, String> plan = buildSeedPlan(loadAuthorCodes(connection));
            if (plan.isEmpty()) {
                System.out.println("No target roles found for authority mapping seed.");
                return;
            }

            for (Map.Entry<String, String> entry : plan.entrySet()) {
                String targetRole = entry.getKey();
                String templateRole = entry.getValue();
                List<String> templateFeatures = loadFeatureCodes(connection, templateRole);
                int beforeCount = countFeatureCodes(connection, targetRole);
                if (!dryRun) {
                    replaceFeatureCodes(connection, targetRole, templateFeatures);
                }
                int afterCount = dryRun ? templateFeatures.size() : countFeatureCodes(connection, targetRole);
                System.out.println(targetRole + " <= " + templateRole
                        + " | before=" + beforeCount
                        + " | template=" + templateFeatures.size()
                        + " | after=" + afterCount
                        + (dryRun ? " | DRY_RUN" : ""));
            }

            if (dryRun) {
                connection.rollback();
            } else {
                connection.commit();
            }
        }
    }

    private static Map<String, String> buildSeedPlan(Set<String> authorCodes) {
        Map<String, String> plan = new LinkedHashMap<>();
        if (authorCodes.contains(ROLE_COMPANY_ADMIN)) {
            // Company-scoped admin starts from the operational company baseline.
            plan.put(ROLE_COMPANY_ADMIN, ROLE_DEPT_OPERATION);
        }
        for (String authorCode : authorCodes) {
            if (!authorCode.startsWith("ROLE_DEPT_I")) {
                continue;
            }
            plan.put(authorCode, resolveTemplateRole(authorCode));
        }
        return plan;
    }

    private static String resolveTemplateRole(String authorCode) {
        return normalize(authorCode).endsWith("_CS") ? ROLE_DEPT_CS : ROLE_DEPT_OPERATION;
    }

    private static Set<String> loadAuthorCodes(Connection connection) throws Exception {
        Set<String> authorCodes = new LinkedHashSet<>();
        try (Statement statement = connection.createStatement();
             ResultSet rs = statement.executeQuery("SELECT AUTHOR_CODE FROM COMTNAUTHORINFO ORDER BY AUTHOR_CODE")) {
            while (rs.next()) {
                String authorCode = normalize(rs.getString(1));
                if (!authorCode.isEmpty()) {
                    authorCodes.add(authorCode);
                }
            }
        }
        return authorCodes;
    }

    private static List<String> loadFeatureCodes(Connection connection, String authorCode) throws Exception {
        List<String> featureCodes = new ArrayList<>();
        Set<String> dedup = new LinkedHashSet<>();
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT FEATURE_CODE FROM COMTNAUTHORFUNCTIONRELATE WHERE AUTHOR_CODE = ? ORDER BY FEATURE_CODE")) {
            statement.setString(1, normalize(authorCode));
            try (ResultSet rs = statement.executeQuery()) {
                while (rs.next()) {
                    String featureCode = normalize(rs.getString(1));
                    if (!featureCode.isEmpty() && dedup.add(featureCode)) {
                        featureCodes.add(featureCode);
                    }
                }
            }
        }
        return featureCodes;
    }

    private static int countFeatureCodes(Connection connection, String authorCode) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT COUNT(*) FROM COMTNAUTHORFUNCTIONRELATE WHERE AUTHOR_CODE = ?")) {
            statement.setString(1, normalize(authorCode));
            try (ResultSet rs = statement.executeQuery()) {
                return rs.next() ? rs.getInt(1) : 0;
            }
        }
    }

    private static void replaceFeatureCodes(Connection connection, String authorCode, List<String> featureCodes) throws Exception {
        try (PreparedStatement deleteStatement = connection.prepareStatement(
                "DELETE FROM COMTNAUTHORFUNCTIONRELATE WHERE AUTHOR_CODE = ?")) {
            deleteStatement.setString(1, normalize(authorCode));
            deleteStatement.executeUpdate();
        }
        if (featureCodes == null || featureCodes.isEmpty()) {
            return;
        }
        try (PreparedStatement insertStatement = connection.prepareStatement(
                "INSERT INTO COMTNAUTHORFUNCTIONRELATE (AUTHOR_CODE, FEATURE_CODE, GRANT_AUTHORITY_YN, CREAT_DT) VALUES (?, ?, 'N', ?)")) {
            Timestamp createdAt = Timestamp.valueOf(LocalDateTime.now());
            for (String featureCode : featureCodes) {
                insertStatement.setString(1, normalize(authorCode));
                insertStatement.setString(2, normalize(featureCode));
                insertStatement.setTimestamp(3, createdAt);
                insertStatement.addBatch();
            }
            insertStatement.executeBatch();
        }
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private static String property(String key, String defaultValue) {
        String value = System.getProperty(key, "");
        return value == null || value.trim().isEmpty() ? defaultValue : value.trim();
    }
}
