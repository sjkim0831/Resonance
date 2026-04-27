package egovframework.com.feature.admin.tools;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public class TypeSpecificAuthorityRoleSeedTool {

    private static final DateTimeFormatter AUTHOR_DATE_FORMAT = DateTimeFormatter.ofPattern("MM/dd/yyyy");

    public static void main(String[] args) throws Exception {
        boolean dryRun = Boolean.parseBoolean(property("authority.seed.dry-run", "false"));
        String jdbcUrl = property("authority.seed.jdbc.url", "jdbc:cubrid:127.0.0.1:33000:carbonet:::?charset=UTF-8");
        String jdbcUser = property("authority.seed.jdbc.user", "dba");
        String jdbcPassword = property("authority.seed.jdbc.password", "");

        try (Connection connection = DriverManager.getConnection(jdbcUrl, jdbcUser, jdbcPassword)) {
            connection.setAutoCommit(false);

            Map<RoleSeed, String> plan = buildPlan();
            for (Map.Entry<RoleSeed, String> entry : plan.entrySet()) {
                RoleSeed target = entry.getKey();
                String templateRole = entry.getValue();
                ensureAuthorInfo(connection, target, dryRun);
                List<String> templateFeatures = loadFeatureCodes(connection, templateRole);
                int beforeCount = countFeatureCodes(connection, target.authorCode);
                if (!dryRun) {
                    replaceFeatureCodes(connection, target.authorCode, templateFeatures);
                }
                int afterCount = dryRun ? templateFeatures.size() : countFeatureCodes(connection, target.authorCode);
                System.out.println(target.authorCode + " <= " + templateRole
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

    private static Map<RoleSeed, String> buildPlan() {
        Map<RoleSeed, String> plan = new LinkedHashMap<>();
        plan.put(new RoleSeed("ROLE_USER_EMITTER", "CO2 배출사업자 사용자", "CO2 배출사업자 기본 사용자 권한"), "ROLE_USER");
        plan.put(new RoleSeed("ROLE_COMPANY_ADMIN_EMITTER", "CO2 배출사업자 관리자", "CO2 배출사업자 관리자 기본 권한"), "ROLE_COMPANY_ADMIN");
        plan.put(new RoleSeed("ROLE_USER_PERFORMER", "CCUS 프로젝트 사업자 사용자", "CCUS 프로젝트 사업자 기본 사용자 권한"), "ROLE_USER");
        plan.put(new RoleSeed("ROLE_COMPANY_ADMIN_PERFORMER", "CCUS 프로젝트 사업자 관리자", "CCUS 프로젝트 사업자 관리자 기본 권한"), "ROLE_COMPANY_ADMIN");
        plan.put(new RoleSeed("ROLE_USER_CENTER", "진흥·지원 기관 사용자", "진흥·지원 기관 기본 사용자 권한"), "ROLE_USER");
        plan.put(new RoleSeed("ROLE_COMPANY_ADMIN_CENTER", "진흥·지원 기관 관리자", "진흥·지원 기관 관리자 기본 권한"), "ROLE_COMPANY_ADMIN");
        plan.put(new RoleSeed("ROLE_USER_GOV", "관계 기관·주무관청 사용자", "관계 기관·주무관청 기본 사용자 권한"), "ROLE_USER");
        plan.put(new RoleSeed("ROLE_COMPANY_ADMIN_GOV", "관계 기관·주무관청 관리자", "관계 기관·주무관청 관리자 기본 권한"), "ROLE_COMPANY_ADMIN");

        plan.put(new RoleSeed("ROLE_USER_ENTERPRISE", "기업 회원 사용자", "기업 회원 기본 사용자 권한"), "ROLE_USER");
        plan.put(new RoleSeed("ROLE_COMPANY_ADMIN_ENTERPRISE", "기업 회원 관리자", "기업 회원 관리자 기본 권한"), "ROLE_COMPANY_ADMIN");
        plan.put(new RoleSeed("ROLE_USER_AUTHORITY", "기관 회원 사용자", "기관 회원 기본 사용자 권한"), "ROLE_USER");
        plan.put(new RoleSeed("ROLE_COMPANY_ADMIN_AUTHORITY", "기관 회원 관리자", "기관 회원 관리자 기본 권한"), "ROLE_COMPANY_ADMIN");
        return plan;
    }

    private static void ensureAuthorInfo(Connection connection, RoleSeed seed, boolean dryRun) throws Exception {
        if (countAuthorCode(connection, seed.authorCode) > 0) {
            if (!dryRun) {
                try (PreparedStatement statement = connection.prepareStatement(
                        "UPDATE COMTNAUTHORINFO SET AUTHOR_NM = ?, AUTHOR_DC = ? WHERE AUTHOR_CODE = ?")) {
                    statement.setString(1, seed.authorNm);
                    statement.setString(2, seed.authorDc);
                    statement.setString(3, seed.authorCode);
                    statement.executeUpdate();
                }
            }
            return;
        }
        if (dryRun) {
            return;
        }
        try (PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO COMTNAUTHORINFO (AUTHOR_CODE, AUTHOR_NM, AUTHOR_DC, AUTHOR_CREAT_DE) VALUES (?, ?, ?, ?)")) {
            statement.setString(1, seed.authorCode);
            statement.setString(2, seed.authorNm);
            statement.setString(3, seed.authorDc);
            statement.setString(4, LocalDate.now().format(AUTHOR_DATE_FORMAT));
            statement.executeUpdate();
        }
    }

    private static int countAuthorCode(Connection connection, String authorCode) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT COUNT(*) FROM COMTNAUTHORINFO WHERE AUTHOR_CODE = ?")) {
            statement.setString(1, normalize(authorCode));
            try (ResultSet rs = statement.executeQuery()) {
                return rs.next() ? rs.getInt(1) : 0;
            }
        }
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

    private static final class RoleSeed {
        private final String authorCode;
        private final String authorNm;
        private final String authorDc;

        private RoleSeed(String authorCode, String authorNm, String authorDc) {
            this.authorCode = authorCode;
            this.authorNm = authorNm;
            this.authorDc = authorDc;
        }
    }
}
