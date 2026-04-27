package egovframework.com.feature.admin.tools;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

public class TypeScopedRoleAssignmentTool {

    public static void main(String[] args) throws Exception {
        boolean dryRun = Boolean.parseBoolean(property("authority.assign.dry-run", "true"));
        String jdbcUrl = property("authority.assign.jdbc.url", "jdbc:cubrid:127.0.0.1:33000:carbonet:::?charset=UTF-8");
        String jdbcUser = property("authority.assign.jdbc.user", "dba");
        String jdbcPassword = property("authority.assign.jdbc.password", "");

        try (Connection connection = DriverManager.getConnection(jdbcUrl, jdbcUser, jdbcPassword)) {
            connection.setAutoCommit(false);

            Summary before = collectSummary(connection);
            Result result = applyAssignments(connection, dryRun);
            Summary after = collectSummary(connection);

            if (dryRun) {
                connection.rollback();
            } else {
                connection.commit();
            }

            before.print("BEFORE");
            result.print(dryRun);
            after.print(dryRun ? "AFTER_DRY_RUN" : "AFTER");
        }
    }

    private static Result applyAssignments(Connection connection, boolean dryRun) throws Exception {
        Result result = new Result();
        if (dryRun) {
            result.memberUpdateCount = countMembersNeedingUpdate(connection);
            result.memberInsertCount = countMembersNeedingInsert(connection);
            result.adminUpdateCount = countAdminsNeedingUpdate(connection);
            result.adminInsertCount = countAdminsNeedingInsert(connection);
            return result;
        }

        result.memberUpdateCount = executeUpdate(connection, memberUpdateSql());
        result.memberInsertCount = executeUpdate(connection, memberInsertSql());
        result.adminUpdateCount = executeUpdate(connection, adminUpdateSql());
        result.adminInsertCount = executeUpdate(connection, adminInsertSql());
        return result;
    }

    private static Summary collectSummary(Connection connection) throws Exception {
        Summary summary = new Summary();
        loadCounts(connection,
                "SELECT COALESCE(M.ENTRPRS_SE_CODE, '') AS K, COUNT(*) AS C FROM COMTNENTRPRSMBER M GROUP BY COALESCE(M.ENTRPRS_SE_CODE, '') ORDER BY 1",
                summary.memberTypeCounts);
        loadCounts(connection,
                "SELECT COALESCE(S.AUTHOR_CODE, '') AS K, COUNT(*) AS C FROM COMTNENTRPRSMBER M "
                        + "LEFT JOIN COMTNEMPLYRSCRTYESTBS S ON M.ESNTL_ID = S.SCRTY_DTRMN_TRGET_ID "
                        + "GROUP BY COALESCE(S.AUTHOR_CODE, '') ORDER BY 1",
                summary.memberRoleCounts);
        loadCounts(connection,
                "SELECT COALESCE(I.ENTRPRS_SE_CODE, '') AS K, COUNT(*) AS C FROM COMTNEMPLYRINFO E "
                        + "LEFT JOIN COMTNINSTTINFO I ON E.INSTT_ID = I.INSTT_ID "
                        + "GROUP BY COALESCE(I.ENTRPRS_SE_CODE, '') ORDER BY 1",
                summary.adminTypeCounts);
        loadCounts(connection,
                "SELECT COALESCE(S.AUTHOR_CODE, '') AS K, COUNT(*) AS C FROM COMTNEMPLYRINFO E "
                        + "LEFT JOIN COMTNEMPLYRSCRTYESTBS S ON E.ESNTL_ID = S.SCRTY_DTRMN_TRGET_ID "
                        + "GROUP BY COALESCE(S.AUTHOR_CODE, '') ORDER BY 1",
                summary.adminRoleCounts);
        return summary;
    }

    private static void loadCounts(Connection connection, String sql, Map<String, Integer> target) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(sql);
             ResultSet rs = statement.executeQuery()) {
            while (rs.next()) {
                target.put(normalizeKey(rs.getString("K")), rs.getInt("C"));
            }
        }
    }

    private static int countMembersNeedingUpdate(Connection connection) throws Exception {
        return count(connection,
                "SELECT COUNT(*) AS C FROM COMTNENTRPRSMBER M "
                        + "INNER JOIN COMTNEMPLYRSCRTYESTBS S ON M.ESNTL_ID = S.SCRTY_DTRMN_TRGET_ID "
                        + "WHERE " + memberTargetRoleCase("M.ENTRPRS_SE_CODE") + " != '' "
                        + "AND COALESCE(S.AUTHOR_CODE, '') != " + memberTargetRoleCase("M.ENTRPRS_SE_CODE"));
    }

    private static int countMembersNeedingInsert(Connection connection) throws Exception {
        return count(connection,
                "SELECT COUNT(*) AS C FROM COMTNENTRPRSMBER M "
                        + "LEFT JOIN COMTNEMPLYRSCRTYESTBS S ON M.ESNTL_ID = S.SCRTY_DTRMN_TRGET_ID "
                        + "WHERE " + memberTargetRoleCase("M.ENTRPRS_SE_CODE") + " != '' "
                        + "AND S.SCRTY_DTRMN_TRGET_ID IS NULL");
    }

    private static int countAdminsNeedingUpdate(Connection connection) throws Exception {
        return count(connection,
                "SELECT COUNT(*) AS C FROM COMTNEMPLYRINFO E "
                        + "INNER JOIN COMTNINSTTINFO I ON E.INSTT_ID = I.INSTT_ID "
                        + "INNER JOIN COMTNEMPLYRSCRTYESTBS S ON E.ESNTL_ID = S.SCRTY_DTRMN_TRGET_ID "
                        + "WHERE " + adminTargetRoleCase("I.ENTRPRS_SE_CODE") + " != '' "
                        + "AND COALESCE(S.AUTHOR_CODE, '') NOT IN ('ROLE_SYSTEM_MASTER','ROLE_SYSTEM_ADMIN','ROLE_ADMIN','ROLE_OPERATION_ADMIN','ROLE_CS_ADMIN') "
                        + "AND COALESCE(S.AUTHOR_CODE, '') != " + adminTargetRoleCase("I.ENTRPRS_SE_CODE"));
    }

    private static int countAdminsNeedingInsert(Connection connection) throws Exception {
        return count(connection,
                "SELECT COUNT(*) AS C FROM COMTNEMPLYRINFO E "
                        + "INNER JOIN COMTNINSTTINFO I ON E.INSTT_ID = I.INSTT_ID "
                        + "LEFT JOIN COMTNEMPLYRSCRTYESTBS S ON E.ESNTL_ID = S.SCRTY_DTRMN_TRGET_ID "
                        + "WHERE " + adminTargetRoleCase("I.ENTRPRS_SE_CODE") + " != '' "
                        + "AND S.SCRTY_DTRMN_TRGET_ID IS NULL");
    }

    private static int count(Connection connection, String sql) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(sql);
             ResultSet rs = statement.executeQuery()) {
            return rs.next() ? rs.getInt("C") : 0;
        }
    }

    private static int executeUpdate(Connection connection, String sql) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            return statement.executeUpdate();
        }
    }

    private static String memberUpdateSql() {
        return "UPDATE COMTNEMPLYRSCRTYESTBS S "
                + "SET AUTHOR_CODE = (SELECT " + memberTargetRoleCase("M.ENTRPRS_SE_CODE")
                + "                    FROM COMTNENTRPRSMBER M "
                + "                   WHERE M.ESNTL_ID = S.SCRTY_DTRMN_TRGET_ID), "
                + "    MBER_TY_CODE = 'USR02' "
                + "WHERE EXISTS (SELECT 1 FROM COMTNENTRPRSMBER M "
                + "              WHERE M.ESNTL_ID = S.SCRTY_DTRMN_TRGET_ID "
                + "                AND " + memberTargetRoleCase("M.ENTRPRS_SE_CODE") + " != '' "
                + "                AND COALESCE(S.AUTHOR_CODE, '') != " + memberTargetRoleCase("M.ENTRPRS_SE_CODE") + ")";
    }

    private static String memberInsertSql() {
        return "INSERT INTO COMTNEMPLYRSCRTYESTBS (SCRTY_DTRMN_TRGET_ID, MBER_TY_CODE, AUTHOR_CODE) "
                + "SELECT M.ESNTL_ID, 'USR02', " + memberTargetRoleCase("M.ENTRPRS_SE_CODE") + " "
                + "FROM COMTNENTRPRSMBER M "
                + "LEFT JOIN COMTNEMPLYRSCRTYESTBS S ON M.ESNTL_ID = S.SCRTY_DTRMN_TRGET_ID "
                + "WHERE " + memberTargetRoleCase("M.ENTRPRS_SE_CODE") + " != '' "
                + "AND S.SCRTY_DTRMN_TRGET_ID IS NULL";
    }

    private static String adminUpdateSql() {
        return "UPDATE COMTNEMPLYRSCRTYESTBS S "
                + "SET AUTHOR_CODE = (SELECT " + adminTargetRoleCase("I.ENTRPRS_SE_CODE")
                + "                    FROM COMTNEMPLYRINFO E INNER JOIN COMTNINSTTINFO I ON E.INSTT_ID = I.INSTT_ID "
                + "                   WHERE E.ESNTL_ID = S.SCRTY_DTRMN_TRGET_ID), "
                + "    MBER_TY_CODE = 'USR03' "
                + "WHERE EXISTS (SELECT 1 FROM COMTNEMPLYRINFO E INNER JOIN COMTNINSTTINFO I ON E.INSTT_ID = I.INSTT_ID "
                + "              WHERE E.ESNTL_ID = S.SCRTY_DTRMN_TRGET_ID "
                + "                AND " + adminTargetRoleCase("I.ENTRPRS_SE_CODE") + " != '' "
                + "                AND COALESCE(S.AUTHOR_CODE, '') NOT IN ('ROLE_SYSTEM_MASTER','ROLE_SYSTEM_ADMIN','ROLE_ADMIN','ROLE_OPERATION_ADMIN','ROLE_CS_ADMIN') "
                + "                AND COALESCE(S.AUTHOR_CODE, '') != " + adminTargetRoleCase("I.ENTRPRS_SE_CODE") + ")";
    }

    private static String adminInsertSql() {
        return "INSERT INTO COMTNEMPLYRSCRTYESTBS (SCRTY_DTRMN_TRGET_ID, MBER_TY_CODE, AUTHOR_CODE) "
                + "SELECT E.ESNTL_ID, 'USR03', " + adminTargetRoleCase("I.ENTRPRS_SE_CODE") + " "
                + "FROM COMTNEMPLYRINFO E "
                + "INNER JOIN COMTNINSTTINFO I ON E.INSTT_ID = I.INSTT_ID "
                + "LEFT JOIN COMTNEMPLYRSCRTYESTBS S ON E.ESNTL_ID = S.SCRTY_DTRMN_TRGET_ID "
                + "WHERE " + adminTargetRoleCase("I.ENTRPRS_SE_CODE") + " != '' "
                + "AND S.SCRTY_DTRMN_TRGET_ID IS NULL";
    }

    private static String memberTargetRoleCase(String membershipColumn) {
        return "CASE COALESCE(" + membershipColumn + ", '') "
                + "WHEN 'E' THEN 'ROLE_USER_EMITTER' "
                + "WHEN 'P' THEN 'ROLE_USER_PERFORMER' "
                + "WHEN 'C' THEN 'ROLE_USER_CENTER' "
                + "WHEN 'G' THEN 'ROLE_USER_GOV' "
                + "ELSE '' END";
    }

    private static String adminTargetRoleCase(String membershipColumn) {
        return "CASE COALESCE(" + membershipColumn + ", '') "
                + "WHEN 'E' THEN 'ROLE_COMPANY_ADMIN_EMITTER' "
                + "WHEN 'P' THEN 'ROLE_COMPANY_ADMIN_PERFORMER' "
                + "WHEN 'C' THEN 'ROLE_COMPANY_ADMIN_CENTER' "
                + "WHEN 'G' THEN 'ROLE_COMPANY_ADMIN_GOV' "
                + "ELSE '' END";
    }

    private static String normalizeKey(String value) {
        String normalized = value == null ? "" : value.trim();
        return normalized.isEmpty() ? "<EMPTY>" : normalized.toUpperCase(Locale.ROOT);
    }

    private static String property(String key, String defaultValue) {
        String value = System.getProperty(key, "");
        return value == null || value.trim().isEmpty() ? defaultValue : value.trim();
    }

    private static final class Result {
        private int memberUpdateCount;
        private int memberInsertCount;
        private int adminUpdateCount;
        private int adminInsertCount;

        private void print(boolean dryRun) {
            System.out.println("=== APPLY_PLAN " + (dryRun ? "DRY_RUN" : "EXECUTED") + " ===");
            System.out.println("[Members] update=" + memberUpdateCount + ", insert=" + memberInsertCount);
            System.out.println("[Admins] update=" + adminUpdateCount + ", insert=" + adminInsertCount);
        }
    }

    private static final class Summary {
        private final Map<String, Integer> memberTypeCounts = new LinkedHashMap<>();
        private final Map<String, Integer> memberRoleCounts = new LinkedHashMap<>();
        private final Map<String, Integer> adminTypeCounts = new LinkedHashMap<>();
        private final Map<String, Integer> adminRoleCounts = new LinkedHashMap<>();

        private void print(String label) {
            System.out.println("=== " + label + " ===");
            System.out.println("[Members] types=" + memberTypeCounts);
            System.out.println("[Members] roles=" + memberRoleCounts);
            System.out.println("[Admins] types=" + adminTypeCounts);
            System.out.println("[Admins] roles=" + adminRoleCounts);
        }
    }
}
