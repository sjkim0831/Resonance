package egovframework.com.feature.member.service;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class MemberConsentHistoryService {
    public static final String TERMS_VERSION = "2026-07-15.1";
    private static final String TERMS_TEXT = "제1조(목적) 이 약관은 탄소중립 CCUS 통합관리 포털에서 제공하는 모든 서비스의 이용조건 및 절차, 이용자와 포털의 권리, 의무, 책임사항과 기타 필요한 사항을 규정함을 목적으로 합니다. "
            + "제2조(용어의 정의) 이용자는 이 약관에 따라 서비스를 이용하는 회원 및 비회원을 말하며, 회원은 개인정보를 제공하여 회원등록을 하고 서비스를 계속 이용할 수 있는 자를 말합니다. "
            + "제3조(약관의 효력 및 변경) 약관은 서비스 화면에 게시하거나 기타 방법으로 공시함으로써 효력이 발생하며 관계 법령을 위반하지 않는 범위에서 개정할 수 있습니다.";
    private static final String PRIVACY_TEXT = "수집 및 이용 목적: 가입의사 확인, 본인 식별·인증, 회원자격 유지·관리, 부정이용 방지, 고지·통지. "
            + "수집 항목: 성명, 아이디, 비밀번호, 이메일 주소, 전화번호, 소속 기관 정보. "
            + "보유 기간: 회원 탈퇴 또는 서비스 종료 시까지이며 관계 법령에 따른 보존 의무가 있으면 해당 기간 동안 보관합니다.";
    private static final String GWP_TEXT = "회원은 온실가스 배출량 및 감축량 산정에 사용되는 GWP 관련 정보와 CCUS 사업·시설·활동자료를 정확하고 완전하게 제공해야 합니다. "
            + "허위·누락·오류 정보로 발생하는 산정 및 검증 오류의 책임이 정보 제공자에게 있음을 확인합니다. "
            + "CCUS 통합관리 포털에 제공·등록되지 않은 정보는 포털을 통한 신고, 검증, 승인, 보고 및 증빙의 근거로 인정되지 않으며 이에 따른 법적·행정적 효력이 발생하지 않습니다. "
            + "관계 법령 또는 관할 기관이 별도의 제출 방법이나 효력을 정한 경우 해당 규정을 우선 적용합니다.";
    private static final String MARKETING_TEXT = "CCUS 관련 정책 뉴스레터와 세미나 안내를 이메일 또는 SMS로 수신하는 선택 동의입니다.";

    private final JdbcTemplate jdbc;

    public MemberConsentHistoryService(DataSource dataSource) {
        this.jdbc = new JdbcTemplate(dataSource);
    }

    public void recordJoinConsents(String sessionId,
                                   String membershipType,
                                   boolean termsAgreed,
                                   boolean privacyAgreed,
                                   boolean gwpAgreed,
                                   boolean marketingAgreed,
                                   HttpServletRequest request) {
        if (!termsAgreed || !privacyAgreed || !gwpAgreed) {
            throw new IllegalArgumentException("필수 약관에 모두 동의해 주세요.");
        }
        String ip = resolveClientIp(request);
        String userAgent = truncate(request.getHeader("User-Agent"), 500);
        upsert(sessionId, membershipType, "TERMS", TERMS_TEXT, true, ip, userAgent);
        upsert(sessionId, membershipType, "PRIVACY", PRIVACY_TEXT, true, ip, userAgent);
        upsert(sessionId, membershipType, "GWP_CCUS", GWP_TEXT, true, ip, userAgent);
        upsert(sessionId, membershipType, "MARKETING", MARKETING_TEXT, marketingAgreed, ip, userAgent);
    }

    public void linkMember(String sessionId, String memberId) {
        jdbc.update("UPDATE member_consent_history SET member_id = ?, updated_at = CURRENT_TIMESTAMP "
                + "WHERE join_session_id = ?", memberId, sessionId);
    }

    public Map<String, Object> buildAdminPage(String keyword, String consentType, String agreedValue) {
        String normalizedKeyword = keyword == null ? "" : keyword.trim().toLowerCase(Locale.ROOT);
        String normalizedType = consentType == null ? "" : consentType.trim().toUpperCase(Locale.ROOT);
        Boolean agreed = "Y".equalsIgnoreCase(agreedValue) ? Boolean.TRUE
                : "N".equalsIgnoreCase(agreedValue) ? Boolean.FALSE : null;
        StringBuilder sql = new StringBuilder("SELECT consent_id AS \"consentId\", member_id AS \"memberId\", "
                + "join_session_id AS \"joinSessionId\", membership_type AS \"membershipType\", "
                + "consent_type AS \"consentType\", terms_version AS \"termsVersion\", terms_hash AS \"termsHash\", "
                + "agreed, agreed_at AS \"agreedAt\", withdrawn_at AS \"withdrawnAt\", "
                + "ip_address AS \"ipAddress\", user_agent AS \"userAgent\", consent_source AS \"consentSource\" "
                + "FROM member_consent_history WHERE 1=1");
        java.util.ArrayList<Object> args = new java.util.ArrayList<>();
        if (!normalizedKeyword.isEmpty()) {
            sql.append(" AND (LOWER(COALESCE(member_id,'')) LIKE ? OR LOWER(join_session_id) LIKE ? OR LOWER(COALESCE(ip_address,'')) LIKE ?)");
            String like = "%" + normalizedKeyword + "%";
            args.add(like); args.add(like); args.add(like);
        }
        if (!normalizedType.isEmpty() && !"ALL".equals(normalizedType)) {
            sql.append(" AND consent_type = ?");
            args.add(normalizedType);
        }
        if (agreed != null) {
            sql.append(" AND agreed = ?");
            args.add(agreed);
        }
        sql.append(" ORDER BY created_at DESC, consent_id DESC LIMIT 200");
        List<Map<String, Object>> rows = jdbc.queryForList(sql.toString(), args.toArray());
        Map<String, Object> summary = jdbc.queryForMap("SELECT COUNT(*) AS total, "
                + "COUNT(*) FILTER (WHERE consent_type='GWP_CCUS' AND agreed) AS gwp_agreed, "
                + "COUNT(*) FILTER (WHERE member_id IS NOT NULL) AS linked, "
                + "COUNT(*) FILTER (WHERE withdrawn_at IS NOT NULL) AS withdrawn FROM member_consent_history");
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("rows", rows);
        payload.put("summary", summary);
        payload.put("termsVersion", TERMS_VERSION);
        payload.put("generatedAt", OffsetDateTime.now().toString());
        return payload;
    }

    private void upsert(String sessionId, String membershipType, String type, String text,
                        boolean agreed, String ip, String userAgent) {
        jdbc.update("INSERT INTO member_consent_history "
                        + "(join_session_id, membership_type, consent_type, terms_version, terms_hash, agreed, agreed_at, ip_address, user_agent) "
                        + "VALUES (?, ?, ?, ?, ?, ?, CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE NULL END, ?, ?) "
                        + "ON CONFLICT (join_session_id, consent_type, terms_version) DO UPDATE SET "
                        + "membership_type=EXCLUDED.membership_type, terms_hash=EXCLUDED.terms_hash, agreed=EXCLUDED.agreed, "
                        + "agreed_at=EXCLUDED.agreed_at, ip_address=EXCLUDED.ip_address, user_agent=EXCLUDED.user_agent, updated_at=CURRENT_TIMESTAMP",
                sessionId, membershipType, type, TERMS_VERSION, sha256(text), agreed, agreed, ip, userAgent);
    }

    private String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("Unable to hash consent text", e);
        }
    }

    private String resolveClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) return truncate(forwarded.split(",")[0].trim(), 64);
        return truncate(request.getRemoteAddr(), 64);
    }

    private String truncate(String value, int max) {
        if (value == null) return "";
        return value.length() <= max ? value : value.substring(0, max);
    }
}
