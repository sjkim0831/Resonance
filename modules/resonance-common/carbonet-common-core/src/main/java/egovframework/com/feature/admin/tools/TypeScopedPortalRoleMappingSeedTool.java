package egovframework.com.feature.admin.tools;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public class TypeScopedPortalRoleMappingSeedTool {

    public static void main(String[] args) throws Exception {
        boolean dryRun = Boolean.parseBoolean(property("authority.seed.dry-run", "false"));
        String jdbcUrl = property("authority.seed.jdbc.url", "jdbc:cubrid:127.0.0.1:33000:carbonet:::?charset=UTF-8");
        String jdbcUser = property("authority.seed.jdbc.user", "dba");
        String jdbcPassword = property("authority.seed.jdbc.password", "");

        try (Connection connection = DriverManager.getConnection(jdbcUrl, jdbcUser, jdbcPassword)) {
            connection.setAutoCommit(false);

            Set<String> homeFeatureCodes = loadPortalFeatureCodes(connection, "HOME");
            Set<String> adminFeatureCodes = loadPortalFeatureCodes(connection, "ADMIN");

            for (Map.Entry<String, String> entry : buildHomeRolePlan().entrySet()) {
                applySeed(connection, entry.getKey(), entry.getValue(), homeFeatureCodes, dryRun, "HOME");
            }
            for (Map.Entry<String, String> entry : buildAdminRolePlan().entrySet()) {
                applySeed(connection, entry.getKey(), entry.getValue(), adminFeatureCodes, dryRun, "ADMIN");
            }

            if (dryRun) {
                connection.rollback();
            } else {
                connection.commit();
            }
        }
    }

    private static Map<String, String> buildHomeRolePlan() {
        Map<String, String> plan = new LinkedHashMap<>();
        plan.put("ROLE_USER_EMITTER", "ROLE_USER");
        plan.put("ROLE_USER_PERFORMER", "ROLE_USER");
        plan.put("ROLE_USER_CENTER", "ROLE_USER");
        plan.put("ROLE_USER_GOV", "ROLE_USER");
        return plan;
    }

    private static Map<String, String> buildAdminRolePlan() {
        Map<String, String> plan = new LinkedHashMap<>();
        plan.put("ROLE_COMPANY_ADMIN_EMITTER", "ROLE_COMPANY_ADMIN");
        plan.put("ROLE_COMPANY_ADMIN_PERFORMER", "ROLE_COMPANY_ADMIN");
        plan.put("ROLE_COMPANY_ADMIN_CENTER", "ROLE_COMPANY_ADMIN");
        plan.put("ROLE_COMPANY_ADMIN_GOV", "ROLE_COMPANY_ADMIN");
        return plan;
    }

    private static void applySeed(
            Connection connection,
            String targetRole,
            String templateRole,
            Set<String> allowedFeatureCodes,
            boolean dryRun,
            String portalType) throws Exception {
        List<String> templateFeatures = loadFeatureCodes(connection, templateRole);
        List<String> filteredFeatures = new ArrayList<>();
        for (String featureCode : templateFeatures) {
            if (allowedFeatureCodes.contains(featureCode)) {
                filteredFeatures.add(featureCode);
            }
        }

        int beforeCount = countFeatureCodes(connection, targetRole);
        if (!dryRun) {
            replaceFeatureCodes(connection, targetRole, filteredFeatures);
        }
        int afterCount = dryRun ? filteredFeatures.size() : countFeatureCodes(connection, targetRole);
        System.out.println(targetRole + " <= " + templateRole
                + " | portal=" + portalType
                + " | before=" + beforeCount
                + " | filtered=" + filteredFeatures.size()
                + " | after=" + afterCount
                + (dryRun ? " | DRY_RUN" : ""));
    }

    private static Set<String> loadPortalFeatureCodes(Connection connection, String portalType) throws Exception {
        Set<String> featureCodes = new LinkedHashSet<>();
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT DISTINCT F.FEATURE_CODE "
                        + "FROM COMTNMENUFUNCTIONINFO F "
                        + "LEFT JOIN COMTNMENUINFO M ON M.MENU_CODE = F.MENU_CODE "
                        + "WHERE COALESCE(F.USE_AT, 'Y') = 'Y' "
                        + "AND ("
                        + "    (? = 'HOME' AND (F.MENU_CODE LIKE 'H%' OR F.FEATURE_CODE LIKE 'HOME\\_%' ESCAPE '\\' OR COALESCE(M.MENU_URL, '') NOT LIKE '/admin%')) "
                        + " OR (? = 'ADMIN' AND (F.MENU_CODE LIKE 'A%' OR F.FEATURE_CODE LIKE 'ADMIN\\_%' ESCAPE '\\' OR COALESCE(M.MENU_URL, '') LIKE '/admin%'))"
                        + ") "
                        + "ORDER BY F.FEATURE_CODE")) {
            statement.setString(1, portalType);
            statement.setString(2, portalType);
            try (ResultSet rs = statement.executeQuery()) {
                while (rs.next()) {
                    String featureCode = normalize(rs.getString(1));
                    if (!featureCode.isEmpty()) {
                        featureCodes.add(featureCode);
                    }
                }
            }
        }
        return featureCodes;
    }

    private static List<String> loadFeatureCodes(Connection connection, String authorCode) throws Exception {
        List<String> featureCodes = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT FEATURE_CODE FROM COMTNAUTHORFUNCTIONRELATE WHERE AUTHOR_CODE = ? ORDER BY FEATURE_CODE")) {
            statement.setString(1, normalize(authorCode));
            try (ResultSet rs = statement.executeQuery()) {
                while (rs.next()) {
                    String featureCode = normalize(rs.getString(1));
                    if (!featureCode.isEmpty()) {
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
