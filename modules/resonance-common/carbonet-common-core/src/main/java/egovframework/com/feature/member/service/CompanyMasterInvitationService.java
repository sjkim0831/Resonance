package egovframework.com.feature.member.service;

import egovframework.com.common.util.FileSecurityUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CompanyMasterInvitationService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final long TTL_HOURS = 24L;
    private final JdbcTemplate jdbc;

    @Transactional
    public Map<String, Object> issue(String insttId, String createdBy) {
        Map<String, Object> company = jdbc.queryForMap("""
            SELECT instt_id, coalesce(charger_email,''), coalesce(charger_nm,''),
                   coalesce(reprsnt_nm,''), coalesce(instt_nm,'')
              FROM comtninsttinfo
             WHERE instt_id=? AND instt_sttus='P'
            """, insttId);
        jdbc.update("UPDATE framework_company_master_invitation SET status='REVOKED',revoked_at=current_timestamp WHERE instt_id=? AND status='ACTIVE'", insttId);
        byte[] tokenBytes = new byte[32];
        RANDOM.nextBytes(tokenBytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
        UUID invitationId = UUID.randomUUID();
        LocalDateTime expiresAt = LocalDateTime.now().plusHours(TTL_HOURS);
        String email = value(company, "charger_email");
        String managerName = first(value(company, "charger_nm"), value(company, "reprsnt_nm"), value(company, "instt_nm"));
        jdbc.update("""
            INSERT INTO framework_company_master_invitation
              (invitation_id,instt_id,email,manager_name,token_hash,expires_at,status,created_by)
            VALUES (?,?,?,?,?,?,'ACTIVE',?)
            """, invitationId, insttId, email, managerName, sha256(token), expiresAt, first(createdBy, "SYSTEM"));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("invitationId", invitationId.toString());
        out.put("insttId", insttId);
        out.put("email", maskEmail(email));
        out.put("expiresAt", expiresAt.toString());
        out.put("activationPath", "/join/companyMasterInvite?token=" + token);
        return out;
    }

    public Map<String, Object> inspect(String token) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
            SELECT x.invitation_id,x.instt_id,i.instt_nm,x.manager_name,x.email,x.expires_at,x.status,x.used_at
              FROM framework_company_master_invitation x
              JOIN comtninsttinfo i ON i.instt_id=x.instt_id
             WHERE x.token_hash=?
            """, sha256(token));
        if (rows.isEmpty()) return status(false, "INVALID", "유효하지 않은 초대 링크입니다.");
        Map<String, Object> row = rows.get(0);
        String code = invitationState(row);
        Map<String, Object> out = status("ACTIVE".equals(code), code,
                "ACTIVE".equals(code) ? "기업 마스터 계정을 설정해 주세요." : stateMessage(code));
        out.put("insttId", value(row, "instt_id"));
        out.put("companyName", value(row, "instt_nm"));
        out.put("managerName", value(row, "manager_name"));
        out.put("email", maskEmail(value(row, "email")));
        out.put("expiresAt", String.valueOf(row.get("expires_at")));
        return out;
    }

    @Transactional
    public Map<String, Object> activate(String token, String requestedInsttId, String accountId, String password, String userName) {
        validateAccount(accountId, password);
        List<Map<String, Object>> rows = jdbc.queryForList("""
            SELECT x.*,i.instt_nm,i.charger_tel,i.adres,i.detail_adres,i.zip
              FROM framework_company_master_invitation x
              JOIN comtninsttinfo i ON i.instt_id=x.instt_id
             WHERE x.token_hash=? FOR UPDATE OF x
            """, sha256(token));
        if (rows.isEmpty()) throw new IllegalArgumentException("유효하지 않은 초대 링크입니다.");
        Map<String, Object> row = rows.get(0);
        String state = invitationState(row);
        if (!"ACTIVE".equals(state)) throw new IllegalStateException(stateMessage(state));
        String insttId = value(row, "instt_id");
        if (!requestedInsttId.isBlank() && !insttId.equals(requestedInsttId)) {
            throw new SecurityException("초대받은 회사와 요청 회사가 일치하지 않습니다.");
        }
        Integer existing = jdbc.queryForObject("SELECT count(*) FROM comtnemplyrinfo WHERE lower(emplyr_id)=lower(?)", Integer.class, accountId);
        if (existing != null && existing > 0) throw new DuplicateKeyException("이미 사용 중인 아이디입니다.");
        String esntlId = "USR" + UUID.randomUUID().toString().replace("-", "").substring(0, 17).toUpperCase();
        String encrypted;
        try { encrypted = FileSecurityUtil.encryptPassword(password, accountId); }
        catch (Exception e) { throw new IllegalStateException("비밀번호 암호화에 실패했습니다.", e); }
        String resolvedName = first(userName, value(row, "manager_name"), "기업 관리자");
        jdbc.update("""
            INSERT INTO comtnemplyrinfo(
              emplyr_id,orgnzt_id,user_nm,password,house_adres,password_hint,password_cnsr,
              house_end_telno,area_no,detail_adres,zip,email_adres,ofcps_nm,house_middle_telno,
              emplyr_sttus_code,esntl_id,sbscrb_de,lock_at,lock_cnt,chg_pwd_last_pnttm,marketing_yn,instt_id)
            VALUES (?,?,?,?,'','회사 마스터 초대','관리자 설정','','',?,?,?,'회사 마스터','',
                    'P',?,current_timestamp,'N',0,current_timestamp,'N',?)
            """, accountId, insttId, resolvedName, encrypted, value(row, "detail_adres"), value(row, "zip"), value(row, "email"), esntlId, insttId);
        jdbc.update("INSERT INTO comtnemplyrscrtyestbs(scrty_dtrmn_trget_id,mber_ty_code,author_code) VALUES (?,'USR','ROLE_ADMIN')", esntlId);
        jdbc.update("""
            INSERT INTO framework_account_actor_assignment(account_id,tenant_id,project_id,actor_code,data_scope,assignment_status)
            VALUES (?,?,'*','COMPANY_MANAGER',?,'ACTIVE')
            ON CONFLICT(account_id,tenant_id,project_id,actor_code) DO UPDATE SET data_scope=excluded.data_scope,assignment_status='ACTIVE',valid_until=null
            """, accountId, insttId, insttId);
        int changed = jdbc.update("""
            UPDATE framework_company_master_invitation
               SET status='USED',used_at=current_timestamp,used_by_account_id=?
             WHERE invitation_id=? AND status='ACTIVE' AND used_at IS NULL AND expires_at>current_timestamp
            """, accountId, row.get("invitation_id"));
        if (changed != 1) throw new IllegalStateException("초대 링크가 이미 사용되었거나 만료되었습니다.");
        Map<String, Object> out = status(true, "ACTIVATED", "기업 마스터 계정 설정이 완료되었습니다.");
        out.put("accountId", accountId);
        out.put("insttId", insttId);
        out.put("companyName", value(row, "instt_nm"));
        out.put("actorCode", "COMPANY_MANAGER");
        out.put("authorityCode", "ROLE_ADMIN");
        out.put("loginPath", "/signin/loginView");
        return out;
    }

    private String invitationState(Map<String, Object> row) {
        String state = value(row, "status");
        if ("USED".equals(state) || row.get("used_at") != null) return "USED";
        if (!"ACTIVE".equals(state)) return "REVOKED";
        Object expires = row.get("expires_at");
        if (expires instanceof java.sql.Timestamp && ((java.sql.Timestamp) expires).toLocalDateTime().isBefore(LocalDateTime.now())) return "EXPIRED";
        if (expires instanceof LocalDateTime && ((LocalDateTime) expires).isBefore(LocalDateTime.now())) return "EXPIRED";
        return "ACTIVE";
    }

    private void validateAccount(String id, String password) {
        if (id == null || !id.matches("^[A-Za-z][A-Za-z0-9._-]{4,39}$")) throw new IllegalArgumentException("아이디는 영문으로 시작하는 5~40자여야 합니다.");
        if (password == null || password.length() < 10 || !password.matches(".*[A-Z].*") || !password.matches(".*[a-z].*") || !password.matches(".*[0-9].*") || !password.matches(".*[^A-Za-z0-9].*")) throw new IllegalArgumentException("비밀번호는 10자 이상이며 영문 대·소문자, 숫자, 특수문자를 포함해야 합니다.");
    }

    private Map<String, Object> status(boolean success, String code, String message) {
        Map<String, Object> out = new LinkedHashMap<>(); out.put("success", success); out.put("status", code); out.put("message", message); return out;
    }
    private String stateMessage(String code) {
        if ("USED".equals(code)) return "이미 사용된 초대 링크입니다.";
        if ("EXPIRED".equals(code)) return "만료된 초대 링크입니다. 관리자에게 재발급을 요청해 주세요.";
        if ("REVOKED".equals(code)) return "취소된 초대 링크입니다. 최신 초대 링크를 사용해 주세요.";
        return "유효하지 않은 초대 링크입니다.";
    }
    private String sha256(String value) {
        if (value == null || value.isBlank()) return "";
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (Exception e) { throw new IllegalStateException("SHA-256 unavailable", e); }
    }
    private String value(Map<String, Object> row, String key) { Object v=row.get(key); return v==null?"":String.valueOf(v).trim(); }
    private String first(String... values) { for(String v:values) if(v!=null&&!v.isBlank()) return v.trim(); return ""; }
    private String maskEmail(String email) { int at=email.indexOf('@'); return at<=1?email:email.substring(0,1)+"***"+email.substring(at); }
}
