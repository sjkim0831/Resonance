package egovframework.com.feature.home.service.impl;

import egovframework.com.common.context.ProjectRuntimeContext;
import egovframework.com.feature.auth.domain.entity.EntrprsMber;
import egovframework.com.feature.auth.domain.entity.EmplyrInfo;
import egovframework.com.feature.auth.domain.repository.EnterpriseMemberRepository;
import egovframework.com.feature.auth.domain.repository.EmployeeMemberRepository;
import egovframework.com.feature.auth.domain.entity.PasswordResetHistory;
import egovframework.com.feature.auth.service.AuthService;
import egovframework.com.feature.auth.service.MfaOtpDeliveryService;
import egovframework.com.feature.auth.util.JwtTokenProvider;
import egovframework.com.feature.home.service.HomeMypageService;
import egovframework.com.feature.member.model.vo.InsttInfoVO;
import egovframework.com.feature.member.model.vo.InstitutionStatusVO;
import egovframework.com.feature.member.service.EnterpriseMemberService;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.ui.Model;
import org.springframework.util.ObjectUtils;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.format.DateTimeFormatter;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.apache.tomcat.util.codec.binary.Base64;
import org.springframework.transaction.annotation.Transactional;

@Service("homeMypageService")
@RequiredArgsConstructor
public class HomeMypageServiceImpl implements HomeMypageService {

    private static final DateTimeFormatter DISPLAY_DATE_TIME = DateTimeFormatter.ofPattern("yyyy.MM.dd HH:mm:ss");

    private final JwtTokenProvider jwtProvider;
    private final EnterpriseMemberRepository enterpriseMemberRepository;
    private final EmployeeMemberRepository employeeMemberRepository;
    private final EnterpriseMemberService entrprsManageService;
    private final AuthService authService;
    private final ProjectRuntimeContext projectRuntimeContext;
    private final JdbcTemplate jdbcTemplate;
    private final MfaOtpDeliveryService mfaOtpDeliveryService;

    private static final SecureRandom MFA_RANDOM = new SecureRandom();
    private static final int MFA_TTL_MINUTES = 10;
    private static final ConcurrentMap<String, DevelopmentContactChallenge> DEVELOPMENT_CONTACT_CHALLENGES = new ConcurrentHashMap<>();

    private record DevelopmentContactChallenge(String userId, String codeHash, String channel, String target,
            Instant expiresAt, int attempts, boolean consumed) {
        DevelopmentContactChallenge failedAttempt() {
            return new DevelopmentContactChallenge(userId, codeHash, channel, target, expiresAt, attempts + 1, consumed);
        }

        DevelopmentContactChallenge consume() {
            return new DevelopmentContactChallenge(userId, codeHash, channel, target, expiresAt, attempts, true);
        }
    }

    @Value("${carbonet.mfa.development-code-enabled:false}")
    private boolean mfaDevelopmentCodeEnabled;


    @Override
    public Map<String, Object> buildMypageContext(boolean en, HttpServletRequest request) {
        String accessToken = jwtProvider.getCookie(request, "accessToken");
        if (ObjectUtils.isEmpty(accessToken)) {
            return createAnonymousMypageContext(en);
        }

        String userId = extractUserId(accessToken);
        if (ObjectUtils.isEmpty(userId)) {
            return createAnonymousMypageContext(en);
        }

        Map<String, Object> payload = createAuthenticatedPayload(userId);
        String insttId = findEnterpriseMember(userId)
                .map(EntrprsMber::getInsttId)
                .map(this::safeString)
                .orElse("");
        if (insttId.isEmpty()) {
            insttId = findEmployeeInstitution(userId)
                    .map(row -> safeString(row.get("insttId")))
                    .orElse("");
        }
        payload.put("insttId", insttId);
        return payload;
    }

    @Override
    public Map<String, Object> buildMypagePayload(boolean en, HttpServletRequest request) {
        String accessToken = jwtProvider.getCookie(request, "accessToken");
        if (ObjectUtils.isEmpty(accessToken)) {
            return createAnonymousMypagePayload(en);
        }

        String userId = extractUserId(accessToken);
        if (ObjectUtils.isEmpty(userId)) {
            return createAnonymousMypagePayload(en);
        }

        Map<String, Object> payload = createAuthenticatedPayload(userId);
        payload.put("isLoggedIn", true);

        Optional<EntrprsMber> enterpriseOpt = findEnterpriseMember(userId);
        if (enterpriseOpt.isEmpty()) {
            payload.put("pageType", "default");
            employeeMemberRepository.findFirstByEmplyrIdIgnoreCase(userId)
                    .ifPresent(employee -> payload.put("employeeMember", employee));
            findEmployeeInstitution(userId).ifPresent(company -> payload.put("company", company));
            return payload;
        }

        EntrprsMber enterprise = enterpriseOpt.get();
        payload.put("member", enterprise);
        String entrprsMberSttus = ObjectUtils.isEmpty(enterprise.getEntrprsMberStus())
                ? ""
                : enterprise.getEntrprsMberStus().trim();

        if ("X".equalsIgnoreCase(entrprsMberSttus)) {
            payload.put("pageType", "blocked");
            payload.put("companyName", ObjectUtils.isEmpty(enterprise.getCmpnyNm()) ? "-" : enterprise.getCmpnyNm());
            payload.put("memberStatus", entrprsMberSttus.toUpperCase(Locale.ROOT));
            return payload;
        }

        if ("R".equalsIgnoreCase(entrprsMberSttus)) {
            payload.put("pageType", "pending");
            payload.put("submittedAt", formatSubmittedAt(enterprise));
            payload.put("companyName", ObjectUtils.isEmpty(enterprise.getCmpnyNm()) ? "-" : enterprise.getCmpnyNm());
            payload.put("pendingStatus", entrprsMberSttus.toUpperCase(Locale.ROOT));
            populateInstitutionReviewInfoMap(payload, enterprise);
            return payload;
        }

        payload.put("pageType", "default");
        return payload;
    }

    private Optional<Map<String, Object>> findEmployeeInstitution(String userId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT trim(i.instt_id) AS "insttId",
                       coalesce(i.instt_nm, '') AS "insttNm",
                       coalesce(i.bizrno, '') AS "bizrno",
                       coalesce(i.reprsnt_nm, '') AS "representativeName",
                       coalesce(i.zip, '') AS "zip",
                       coalesce(i.adres, '') AS "address",
                       coalesce(i.detail_adres, '') AS "detailAddress",
                       coalesce(i.entrprs_se_code, '') AS "companyType",
                       coalesce(i.instt_sttus, '') AS "status",
                       coalesce(i.charger_nm, e.user_nm, '') AS "managerName",
                       coalesce(i.charger_email, e.email_adres, '') AS "managerEmail",
                       coalesce(i.charger_tel, e.mbtlnum, '') AS "managerTel"
                  FROM comtnemplyrinfo e
                  JOIN comtninsttinfo i ON trim(i.instt_id)=trim(e.instt_id)
                 WHERE lower(e.emplyr_id)=lower(?)
                 ORDER BY i.last_updt_pnttm DESC NULLS LAST
                 LIMIT 1
                """, userId);
        return rows.stream().findFirst();
    }

    @Override
    public Map<String, Object> buildMypageSectionPayload(boolean en, String section, HttpServletRequest request) {
        String normalizedSection = normalizeSection(section);
        Map<String, Object> payload = buildMypagePayload(en, request);
        initializeSectionPayload(payload, normalizedSection, en);

        if (!Boolean.TRUE.equals(payload.get("authenticated"))) {
            payload.put("sectionReason", en ? "Please sign in first." : "로그인 후 이용 가능합니다.");
            return payload;
        }

        if (!"default".equals(payload.get("pageType"))) {
            payload.put("sectionReason", en
                    ? "This section is available after the company review is completed."
                    : "이 섹션은 회원사 승인이 완료된 뒤 이용할 수 있습니다.");
            return payload;
        }

        Object memberObject = payload.get("member");
        if (!(memberObject instanceof EntrprsMber)) {
            if ("email".equals(normalizedSection) && payload.get("employeeMember") instanceof EmplyrInfo employee) {
                payload.put("member", buildEmployeeContactPayload(employee));
                payload.put("canViewSection", true);
                payload.put("canUseSection", true);
                payload.put("items", buildEmployeeContactItems(employee));
                return payload;
            }
            payload.put("sectionReason", en
                    ? "Member information could not be loaded."
                    : "회원 정보를 불러오지 못했습니다.");
            return payload;
        }

        EntrprsMber member = (EntrprsMber) memberObject;
        payload.put("canViewSection", true);
        payload.put("canUseSection", canUseSection(normalizedSection));
        payload.put("items", buildSectionItems(normalizedSection, member));

        if ("password".equals(normalizedSection)) {
            payload.put("passwordHistory", buildPasswordHistory(member.getEntrprsMberId()));
        }

        return payload;
    }

    @Override
    public Map<String, Object> updateProfile(boolean en, String zip, String address, String detailAddress,
            HttpServletRequest request) {
        Map<String, Object> payload = buildMypageSectionPayload(en, "profile", request);
        EntrprsMber member = prepareWritableSectionPayload(payload, en);
        if (member == null) {
            return payload;
        }
        member.setZip(normalizeZip(zip));
        member.setAdres(safeString(address));
        member.setDetailAdres(safeString(detailAddress));
        enterpriseMemberRepository.save(member);
        return markSaveSuccess(payload, "profile", member, en ? "Profile updated." : "개인정보를 저장했습니다.");
    }

    @Override
    public Map<String, Object> updateCompany(boolean en, String companyName, String representativeName, String zip,
            String address, String detailAddress, HttpServletRequest request) {
        Map<String, Object> payload = buildMypageSectionPayload(en, "company", request);
        String normalizedCompanyName = safeString(companyName);
        String normalizedRepresentativeName = safeString(representativeName);
        if (normalizedCompanyName.isEmpty()) {
            markSaveFailure(payload, en ? "Please enter the company name." : "회사명을 입력해 주세요.");
            return payload;
        }
        EntrprsMber member = prepareWritableSectionPayload(payload, en);
        if (member == null) {
            return payload;
        }
        member.setCmpnyNm(normalizedCompanyName);
        member.setCxfc(normalizedRepresentativeName);
        member.setZip(normalizeZip(zip));
        member.setAdres(safeString(address));
        member.setDetailAdres(safeString(detailAddress));
        enterpriseMemberRepository.save(member);
        return markSaveSuccess(payload, "company", member, en ? "Company information updated." : "회사정보를 저장했습니다.");
    }

    @Override
    public Map<String, Object> updateMarketingPreference(boolean en, String marketingYn, HttpServletRequest request) {
        Map<String, Object> payload = buildMypageSectionPayload(en, "marketing", request);
        EntrprsMber member = prepareWritableSectionPayload(payload, en);
        if (member == null) {
            return payload;
        }
        String normalizedMarketingYn = normalizeMarketingYn(marketingYn);
        member.setMarketingYn(normalizedMarketingYn);
        enterpriseMemberRepository.save(member);
        return markSaveSuccess(payload, "marketing", member, en ? "Marketing preference updated." : "마케팅 수신 설정을 저장했습니다.");
    }

    @Override
    public Map<String, Object> updateStaffContact(boolean en, String staffName, String deptNm, String areaNo,
            String middleTelno, String endTelno, HttpServletRequest request) {
        Map<String, Object> payload = buildMypageSectionPayload(en, "staff", request);
        String normalizedStaffName = safeString(staffName);
        String normalizedAreaNo = digitsOnly(areaNo, 4);
        String normalizedMiddleTelno = digitsOnly(middleTelno, 4);
        String normalizedEndTelno = digitsOnly(endTelno, 4);

        if (normalizedStaffName.isEmpty()) {
            markSaveFailure(payload, en ? "Please enter the staff name." : "담당자명을 입력해 주세요.");
            return payload;
        }
        if (!isValidPhonePart(normalizedAreaNo, 2, 4)
                || !isValidPhonePart(normalizedMiddleTelno, 3, 4)
                || !isValidPhonePart(normalizedEndTelno, 4, 4)) {
            markSaveFailure(payload, en ? "Please enter a valid phone number." : "올바른 연락처를 입력해 주세요.");
            return payload;
        }

        EntrprsMber member = prepareWritableSectionPayload(payload, en);
        if (member == null) {
            return payload;
        }
        member.setApplcntNm(normalizedStaffName);
        member.setDeptNm(safeString(deptNm));
        member.setAreaNo(normalizedAreaNo);
        member.setEntrprsMiddleTelno(normalizedMiddleTelno);
        member.setEntrprsEndTelno(normalizedEndTelno);
        enterpriseMemberRepository.save(member);
        return markSaveSuccess(payload, "staff", member, en ? "Staff contact updated." : "실무자 정보를 저장했습니다.");
    }

    @Override
    public Map<String, Object> updateEmailAddress(boolean en, String email, HttpServletRequest request) {
        Map<String, Object> payload = buildMypageSectionPayload(en, "email", request);
        String normalizedEmail = safeString(email);
        if (!isValidEmail(normalizedEmail)) {
            markSaveFailure(payload, en ? "Please enter a valid email address." : "올바른 이메일 주소를 입력해 주세요.");
            return payload;
        }
        EntrprsMber member = prepareWritableSectionPayload(payload, en);
        if (member == null) {
            return payload;
        }
        member.setApplcntEmailAdres(normalizedEmail);
        member.setAuthEmail(normalizedEmail);
        enterpriseMemberRepository.save(member);
        return markSaveSuccess(payload, "email", member, en ? "Email address updated." : "이메일 주소를 저장했습니다.");
    }

    @Override
    public Map<String, Object> requestContactVerification(boolean en, String channel, String targetValue,
            HttpServletRequest request) {
        Map<String, Object> payload = buildMypageSectionPayload(en, "email", request);
        String userId = safeString(payload.get("userId"));
        if (!Boolean.TRUE.equals(payload.get("authenticated")) || !Boolean.TRUE.equals(payload.get("canUseSection"))
                || userId.isEmpty()) return markMfaFailure(payload, en ? "Member information could not be loaded."
                        : "회원 정보를 불러오지 못했습니다.");
        String normalizedChannel = safeString(channel).toUpperCase(Locale.ROOT);
        String normalizedTarget = "EMAIL".equals(normalizedChannel) ? safeString(targetValue)
                : digitsOnly(targetValue, 11);
        if (!("EMAIL".equals(normalizedChannel) && isValidEmail(normalizedTarget))
                && !("PHONE".equals(normalizedChannel) && normalizedTarget.matches("01\\d{8,9}"))) {
            return markMfaFailure(payload, en ? "Enter a valid email address or mobile number."
                    : "올바른 이메일 주소 또는 휴대전화 번호를 입력해 주세요.");
        }
        String challengeId = UUID.randomUUID().toString();
        String code = String.format("%06d", MFA_RANDOM.nextInt(1_000_000));
        if (mfaDevelopmentCodeEnabled) {
            DEVELOPMENT_CONTACT_CHALLENGES.entrySet().removeIf(entry -> entry.getValue().userId().equals(userId));
            DEVELOPMENT_CONTACT_CHALLENGES.put(challengeId, new DevelopmentContactChallenge(userId,
                    mfaDigest(challengeId, code), normalizedChannel, normalizedTarget,
                    Instant.now().plusSeconds(MFA_TTL_MINUTES * 60L), 0, false));
        } else {
            jdbcTemplate.update("DELETE FROM member_mfa_challenge WHERE user_id=? AND purpose='CONTACT_CHANGE' AND verified_at IS NULL", userId);
            jdbcTemplate.update("""
                    INSERT INTO member_mfa_challenge
                      (challenge_id,user_id,purpose,code_hash,expires_at,attempt_count,created_at,target_channel,target_value)
                    VALUES (?,?, 'CONTACT_CHANGE', ?, CURRENT_TIMESTAMP + INTERVAL '10 minutes', 0, CURRENT_TIMESTAMP, ?, ?)
                    """, UUID.fromString(challengeId), userId, mfaDigest(challengeId, code), normalizedChannel, normalizedTarget);
        }
        if (!mfaOtpDeliveryService.deliver(challengeId, userId, normalizedTarget, code, "CONTACT_CHANGE", normalizedChannel, en)) {
            if (mfaDevelopmentCodeEnabled) DEVELOPMENT_CONTACT_CHALLENGES.remove(challengeId);
            else jdbcTemplate.update("DELETE FROM member_mfa_challenge WHERE challenge_id=?", UUID.fromString(challengeId));
            return markMfaFailure(payload, en ? "The verification code could not be delivered."
                    : "인증번호를 발송하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        }
        payload.put("challengeId", challengeId);
        payload.put("channel", normalizedChannel);
        payload.put("targetMasked", "EMAIL".equals(normalizedChannel) ? maskEmail(normalizedTarget)
                : normalizedTarget.replaceFirst("(\\d{3})(\\d{3,4})(\\d{4})", "$1-****-$3"));
        payload.put("expiresInSeconds", MFA_TTL_MINUTES * 60);
        payload.put("message", en ? "A verification code was sent." : "인증번호를 발송했습니다.");
        if (mfaDevelopmentCodeEnabled) payload.put("developmentCode", code);
        return payload;
    }

    @Override
    @Transactional
    public Map<String, Object> confirmContactVerification(boolean en, String challengeId, String verificationCode,
            HttpServletRequest request) {
        Map<String, Object> payload = buildMypageSectionPayload(en, "email", request);
        String userId = safeString(payload.get("userId"));
        if (!Boolean.TRUE.equals(payload.get("authenticated")) || !Boolean.TRUE.equals(payload.get("canUseSection"))
                || userId.isEmpty()) return markMfaFailure(payload, en ? "Member information could not be loaded."
                        : "회원 정보를 불러오지 못했습니다.");
        if (!safeString(challengeId).matches("[0-9a-fA-F-]{36}") || !safeString(verificationCode).matches("\\d{6}")) {
            return markMfaFailure(payload, en ? "Enter the 6-digit verification code." : "6자리 인증번호를 입력해 주세요.");
        }
        UUID id = UUID.fromString(challengeId);
        String channel;
        String target;
        if (mfaDevelopmentCodeEnabled) {
            DevelopmentContactChallenge challenge = DEVELOPMENT_CONTACT_CHALLENGES.get(challengeId);
            if (challenge == null || !challenge.userId().equals(userId)
                    || challenge.expiresAt().isBefore(Instant.now()) || challenge.consumed()) {
                return markMfaFailure(payload, en ? "The verification request expired or was already used."
                        : "인증 요청이 만료됐거나 이미 사용됐습니다.");
            }
            if (challenge.attempts() >= 5 || !MessageDigest.isEqual(challenge.codeHash().getBytes(StandardCharsets.UTF_8),
                    mfaDigest(challengeId, verificationCode).getBytes(StandardCharsets.UTF_8))) {
                DEVELOPMENT_CONTACT_CHALLENGES.computeIfPresent(challengeId, (key, value) -> value.failedAttempt());
                return markMfaFailure(payload, en ? "The verification code is incorrect." : "인증번호가 일치하지 않습니다.");
            }
            channel = challenge.channel();
            target = challenge.target();
        } else {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                    SELECT code_hash,attempt_count,expires_at>CURRENT_TIMESTAMP AS valid,target_channel,target_value,consumed_at
                      FROM member_mfa_challenge
                     WHERE challenge_id=? AND user_id=? AND purpose='CONTACT_CHANGE' FOR UPDATE
                    """, id, userId);
            if (rows.isEmpty() || !Boolean.TRUE.equals(rows.get(0).get("valid")) || rows.get(0).get("consumed_at") != null) {
                return markMfaFailure(payload, en ? "The verification request expired or was already used."
                        : "인증 요청이 만료됐거나 이미 사용됐습니다.");
            }
            int attempts = ((Number) rows.get(0).getOrDefault("attempt_count", 0)).intValue();
            if (attempts >= 5 || !MessageDigest.isEqual(safeString(rows.get(0).get("code_hash")).getBytes(StandardCharsets.UTF_8),
                    mfaDigest(challengeId, verificationCode).getBytes(StandardCharsets.UTF_8))) {
                jdbcTemplate.update("UPDATE member_mfa_challenge SET attempt_count=attempt_count+1 WHERE challenge_id=?", id);
                return markMfaFailure(payload, en ? "The verification code is incorrect." : "인증번호가 일치하지 않습니다.");
            }
            channel = safeString(rows.get(0).get("target_channel"));
            target = safeString(rows.get(0).get("target_value"));
        }
        Optional<EntrprsMber> enterpriseMember = findEnterpriseMember(userId);
        if (enterpriseMember.isPresent()) {
            EntrprsMber member = enterpriseMember.get();
            if ("EMAIL".equals(channel)) {
                member.setApplcntEmailAdres(target);
                member.setAuthEmail(target);
            } else {
                member.setAreaNo(target.substring(0, 3));
                member.setEntrprsMiddleTelno(target.substring(3, target.length() - 4));
                member.setEntrprsEndTelno(target.substring(target.length() - 4));
            }
            enterpriseMemberRepository.save(member);
            payload.put("member", member);
            payload.put("items", buildSectionItems("email", member));
        } else {
            EmplyrInfo employee = employeeMemberRepository.findFirstByEmplyrIdIgnoreCase(userId).orElse(null);
            if (employee == null) return markMfaFailure(payload, en ? "Member information could not be loaded."
                    : "회원 정보를 불러오지 못했습니다.");
            if ("EMAIL".equals(channel)) {
                employee.setEmailAdres(target);
                employee.setAuthEmail(target);
            } else {
                employee.setMbtlNum(target);
            }
            employeeMemberRepository.save(employee);
            payload.put("member", buildEmployeeContactPayload(employee));
            payload.put("items", buildEmployeeContactItems(employee));
        }
        if (mfaDevelopmentCodeEnabled) {
            DEVELOPMENT_CONTACT_CHALLENGES.computeIfPresent(challengeId, (key, value) -> value.consume());
        } else {
            jdbcTemplate.update("UPDATE member_mfa_challenge SET verified_at=CURRENT_TIMESTAMP,consumed_at=CURRENT_TIMESTAMP WHERE challenge_id=?", id);
        }
        payload.put("saved", true);
        payload.put("channel", channel);
        payload.put("message", "EMAIL".equals(channel)
                ? (en ? "Your email address has been changed." : "이메일 주소가 변경되었습니다.")
                : (en ? "Your mobile number has been changed." : "휴대전화 번호가 변경되었습니다."));
        return payload;
    }

    private Map<String, Object> buildEmployeeContactPayload(EmplyrInfo employee) {
        String phone = digitsOnly(employee.getMbtlNum(), 11);
        Map<String, Object> member = new LinkedHashMap<>();
        member.put("applcntEmailAdres", safeString(employee.getEmailAdres()));
        member.put("authEmail", safeString(employee.getAuthEmail()));
        member.put("areaNo", phone.length() >= 10 ? phone.substring(0, 3) : "");
        member.put("entrprsMiddleTelno", phone.length() >= 10 ? phone.substring(3, phone.length() - 4) : "");
        member.put("entrprsEndTelno", phone.length() >= 10 ? phone.substring(phone.length() - 4) : "");
        return member;
    }

    private List<Map<String, String>> buildEmployeeContactItems(EmplyrInfo employee) {
        List<Map<String, String>> items = new java.util.ArrayList<>();
        addItem(items, "현재 이메일", employee.getEmailAdres());
        addItem(items, "인증 이메일", employee.getAuthEmail());
        addItem(items, "현재 휴대전화", employee.getMbtlNum());
        return items;
    }

    @Override
    public Map<String, Object> updatePassword(boolean en, String currentPassword, String newPassword, HttpServletRequest request) {
        Map<String, Object> payload = buildMypageSectionPayload(en, "password", request);
        EntrprsMber member = prepareWritableSectionPayload(payload, en);
        if (member == null) {
            return payload;
        }
        if (!matchesPassword(currentPassword, member.getEntrprsMberId(), member.getEntrprsMberPassword())) {
            markSaveFailure(payload, en ? "Current password does not match." : "현재 비밀번호가 일치하지 않습니다.");
            return payload;
        }
        if (!validatePasswordPolicy(newPassword)) {
            markSaveFailure(payload, en
                    ? "Please meet the password policy (at least 9 chars and 3 character types)."
                    : "비밀번호 정책(9자리 이상, 3종류 조합)을 충족해 주세요.");
            return payload;
        }
        boolean updated = authService.resetPassword(member.getEntrprsMberId(), "ENT", newPassword, member.getEntrprsMberId(),
                resolveClientIp(request), "MYPAGE_SELF_SERVICE");
        if (!updated) {
            markSaveFailure(payload, en ? "Password update failed." : "비밀번호 변경에 실패했습니다.");
            return payload;
        }
        Optional<EntrprsMber> refreshed = findEnterpriseMember(member.getEntrprsMberId());
        refreshed.ifPresent(value -> {
            payload.put("member", value);
            payload.put("items", buildSectionItems("password", value));
            payload.put("passwordHistory", buildPasswordHistory(value.getEntrprsMberId()));
        });
        payload.put("saved", true);
        payload.put("message", en ? "Password updated." : "비밀번호를 변경했습니다.");
        invalidateCurrentAuthentication(request);
        return payload;
    }

    @Override
    public Map<String, Object> buildMfaStatus(boolean en, HttpServletRequest request) {
        Map<String, Object> payload = buildMypageSectionPayload(en, "password", request);
        EntrprsMber member = prepareWritableSectionPayload(payload, en);
        if (member == null) return payload;
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT method, destination_masked, enabled, verified_at, updated_at
                  FROM member_mfa_setting WHERE user_id=?
                """, member.getEntrprsMberId());
        payload.put("mfaEnabled", !rows.isEmpty() && Boolean.TRUE.equals(rows.get(0).get("enabled")));
        payload.put("mfaMethod", rows.isEmpty() ? "EMAIL_OTP" : safeString(rows.get(0).get("method")));
        payload.put("destinationMasked", rows.isEmpty() ? maskEmail(member.getApplcntEmailAdres())
                : safeString(rows.get(0).get("destination_masked")));
        payload.put("verifiedAt", rows.isEmpty() ? "" : safeString(rows.get(0).get("verified_at")));
        return payload;
    }

    @Override
    public Map<String, Object> requestMfaEnrollment(boolean en, HttpServletRequest request) {
        Map<String, Object> payload = buildMfaStatus(en, request);
        if (!Boolean.TRUE.equals(payload.get("authenticated")) || !Boolean.TRUE.equals(payload.get("canUseSection"))) return payload;
        String userId = safeString(payload.get("userId"));
        String challengeId = UUID.randomUUID().toString();
        String code = String.format("%06d", MFA_RANDOM.nextInt(1_000_000));
        String codeHash = mfaDigest(challengeId, code);
        jdbcTemplate.update("DELETE FROM member_mfa_challenge WHERE user_id=? AND purpose='ENROLL' AND verified_at IS NULL", userId);
        jdbcTemplate.update("""
                INSERT INTO member_mfa_challenge
                  (challenge_id,user_id,purpose,code_hash,expires_at,attempt_count,created_at)
                VALUES (?,?, 'ENROLL', ?, CURRENT_TIMESTAMP + INTERVAL '10 minutes', 0, CURRENT_TIMESTAMP)
                """, UUID.fromString(challengeId), userId, codeHash);
        String destination = findEnterpriseMember(userId).map(EntrprsMber::getApplcntEmailAdres).orElse("");
        if (!mfaOtpDeliveryService.deliver(challengeId, userId, destination, code, "ENROLL", en)) {
            jdbcTemplate.update("DELETE FROM member_mfa_challenge WHERE challenge_id=?", UUID.fromString(challengeId));
            return markMfaFailure(payload, en ? "The verification code could not be delivered."
                    : "인증번호를 발송하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        }
        payload.put("challengeId", challengeId);
        payload.put("expiresInSeconds", MFA_TTL_MINUTES * 60);
        payload.put("message", en ? "A verification code was issued." : "인증번호를 발급했습니다.");
        if (mfaDevelopmentCodeEnabled) payload.put("developmentCode", code);
        return payload;
    }

    @Override
    @Transactional
    public Map<String, Object> verifyMfaEnrollment(boolean en, String challengeId, String verificationCode,
            HttpServletRequest request) {
        Map<String, Object> payload = buildMfaStatus(en, request);
        if (!Boolean.TRUE.equals(payload.get("authenticated")) || !Boolean.TRUE.equals(payload.get("canUseSection"))) return payload;
        String userId = safeString(payload.get("userId"));
        if (!safeString(challengeId).matches("[0-9a-fA-F-]{36}") || !safeString(verificationCode).matches("\\d{6}")) {
            return markMfaFailure(payload, en ? "Enter the 6-digit verification code." : "6자리 인증번호를 입력해 주세요.");
        }
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT code_hash,attempt_count,expires_at>CURRENT_TIMESTAMP AS valid
                  FROM member_mfa_challenge
                 WHERE challenge_id=? AND user_id=? AND purpose='ENROLL' AND verified_at IS NULL
                 FOR UPDATE
                """, UUID.fromString(challengeId), userId);
        if (rows.isEmpty() || !Boolean.TRUE.equals(rows.get(0).get("valid"))) {
            return markMfaFailure(payload, en ? "The verification request expired." : "인증 요청이 만료됐습니다.");
        }
        int attempts = ((Number) rows.get(0).getOrDefault("attempt_count", 0)).intValue();
        if (attempts >= 5 || !MessageDigest.isEqual(
                safeString(rows.get(0).get("code_hash")).getBytes(StandardCharsets.UTF_8),
                mfaDigest(challengeId, verificationCode).getBytes(StandardCharsets.UTF_8))) {
            jdbcTemplate.update("UPDATE member_mfa_challenge SET attempt_count=attempt_count+1 WHERE challenge_id=?", UUID.fromString(challengeId));
            return markMfaFailure(payload, en ? "The verification code is incorrect." : "인증번호가 일치하지 않습니다.");
        }
        String masked = findEnterpriseMember(userId).map(EntrprsMber::getApplcntEmailAdres).map(this::maskEmail).orElse("");
        jdbcTemplate.update("UPDATE member_mfa_challenge SET verified_at=CURRENT_TIMESTAMP WHERE challenge_id=?", UUID.fromString(challengeId));
        jdbcTemplate.update("""
                INSERT INTO member_mfa_setting(user_id,method,destination_masked,enabled,verified_at,updated_at)
                VALUES (?, 'EMAIL_OTP', ?, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id) DO UPDATE SET method=EXCLUDED.method,destination_masked=EXCLUDED.destination_masked,
                  enabled=TRUE,verified_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
                """, userId, masked);
        payload.put("mfaEnabled", true);
        payload.put("destinationMasked", masked);
        payload.put("saved", true);
        payload.put("message", en ? "Multi-factor authentication is enabled." : "다중 인증을 활성화했습니다.");
        return payload;
    }

    @Override
    public Map<String, Object> disableMfa(boolean en, String currentPassword, HttpServletRequest request) {
        Map<String, Object> payload = buildMfaStatus(en, request);
        EntrprsMber member = prepareWritableSectionPayload(payload, en);
        if (member == null) return payload;
        if (!matchesPassword(currentPassword, member.getEntrprsMberId(), member.getEntrprsMberPassword())) {
            return markMfaFailure(payload, en ? "Current password does not match." : "현재 비밀번호가 일치하지 않습니다.");
        }
        jdbcTemplate.update("UPDATE member_mfa_setting SET enabled=FALSE,updated_at=CURRENT_TIMESTAMP WHERE user_id=?",
                member.getEntrprsMberId());
        payload.put("mfaEnabled", false);
        payload.put("saved", true);
        payload.put("message", en ? "Multi-factor authentication is disabled." : "다중 인증을 해제했습니다.");
        return payload;
    }

    private Map<String, Object> markMfaFailure(Map<String, Object> payload, String message) {
        payload.put("saved", false);
        payload.put("message", message);
        return payload;
    }

    private String mfaDigest(String challengeId, String code) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return java.util.HexFormat.of().formatHex(digest.digest((challengeId + ":" + code).getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private String maskEmail(String email) {
        String value = safeString(email);
        int at = value.indexOf('@');
        if (at <= 1) return value.isEmpty() ? "등록 이메일 없음" : "***";
        return value.substring(0, 1) + "***" + value.substring(at);
    }

    private void invalidateCurrentAuthentication(HttpServletRequest request) {
        try {
            HttpSession session = request == null ? null : request.getSession(false);
            if (session != null) {
                session.invalidate();
            }
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private Map<String, Object> createAnonymousMypageContext(boolean en) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("authenticated", false);
        payload.put("redirectUrl", en ? "/en/signin/loginView" : "/signin/loginView");
        payload.put("insttId", "");
        return payload;
    }

    private Map<String, Object> createAuthenticatedPayload(String userId) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("authenticated", true);
        payload.put("userId", userId);
        return payload;
    }

    private Map<String, Object> createAnonymousMypagePayload(boolean en) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("authenticated", false);
        payload.put("redirectUrl", en ? "/en/signin/loginView" : "/signin/loginView");
        payload.put("pageType", "redirect");
        return payload;
    }

    private void initializeSectionPayload(Map<String, Object> payload, String normalizedSection, boolean en) {
        payload.put("section", normalizedSection);
        payload.put("sectionTitle", resolveSectionTitle(normalizedSection, en));
        payload.put("canViewSection", false);
        payload.put("canUseSection", false);
        payload.put("sectionReason", "");
        payload.put("items", Collections.emptyList());
    }

    private void markSaveFailure(Map<String, Object> payload, Object message) {
        payload.put("saved", false);
        if (message != null) {
            payload.put("message", message);
        }
    }

    private EntrprsMber resolveSectionMember(Map<String, Object> payload, boolean en) {
        Object memberObject = payload.get("member");
        if (memberObject instanceof EntrprsMber) {
            return (EntrprsMber) memberObject;
        }
        markSaveFailure(payload, en ? "Member information could not be loaded." : "회원 정보를 불러오지 못했습니다.");
        return null;
    }

    private EntrprsMber prepareWritableSectionPayload(Map<String, Object> payload, boolean en) {
        if (!Boolean.TRUE.equals(payload.get("authenticated"))) {
            markSaveFailure(payload, null);
            return null;
        }
        if (!Boolean.TRUE.equals(payload.get("canUseSection"))) {
            markSaveFailure(payload, payload.get("sectionReason"));
            return null;
        }
        return resolveSectionMember(payload, en);
    }

    private boolean canUseSection(String normalizedSection) {
        return "profile".equals(normalizedSection)
                || "company".equals(normalizedSection)
                || "staff".equals(normalizedSection)
                || "marketing".equals(normalizedSection)
                || "email".equals(normalizedSection)
                || "password".equals(normalizedSection);
    }

    private Map<String, Object> markSaveSuccess(
            Map<String, Object> payload,
            String section,
            EntrprsMber member,
            String message) {
        payload.put("member", member);
        payload.put("items", buildSectionItems(section, member));
        payload.put("saved", true);
        payload.put("message", message);
        return payload;
    }

    private String extractUserId(String accessToken) {
        try {
            if (jwtProvider.accessValidateToken(accessToken) != 200) {
                return "";
            }
            Claims claims = jwtProvider.accessExtractClaims(accessToken);
            Object encryptedUserId = claims.get("userId");
            if (encryptedUserId == null) {
                return "";
            }
            return jwtProvider.decrypt(encryptedUserId.toString());
        } catch (Exception e) {
            return "";
        }
    }

    private List<Map<String, String>> buildSectionItems(String section, EntrprsMber member) {
        List<Map<String, String>> items = new java.util.ArrayList<>();
        switch (section) {
            case "profile":
                addItem(items, "아이디", member.getEntrprsMberId());
                addItem(items, "담당자명", member.getApplcntNm());
                addItem(items, "이메일", member.getApplcntEmailAdres());
                addItem(items, "전화번호", formatPhone(member));
                addItem(items, "주소", joinAddress(member.getZip(), member.getAdres(), member.getDetailAdres()));
                break;
            case "company":
                addItem(items, "회사명", member.getCmpnyNm());
                addItem(items, "사업자번호", member.getBizrno());
                addItem(items, "기관 ID", member.getInsttId());
                addItem(items, "대표자", member.getCxfc());
                addItem(items, "회사 연락처", formatPhone(member));
                addItem(items, "회사 주소", joinAddress(member.getZip(), member.getAdres(), member.getDetailAdres()));
                break;
            case "staff":
                addItem(items, "주 담당자", member.getApplcntNm());
                addItem(items, "연락 이메일", member.getApplcntEmailAdres());
                addItem(items, "대표 연락처", formatPhone(member));
                addItem(items, "안내", "현재는 대표 실무자 1건 기준으로 수정할 수 있습니다.");
                break;
            case "notification":
                addItem(items, "알림 수신 이메일", member.getApplcntEmailAdres());
                addItem(items, "마케팅 수신", yesNo(member.getMarketingYn()));
                addItem(items, "안내", "추가 알림 채널 설정 컬럼이 없어 현재는 읽기 전용입니다.");
                break;
            case "password":
                addItem(items, "마지막 비밀번호 변경", formatDateTime(member.getChgPwdLastPnttm()));
                addItem(items, "계정 잠금 여부", safeString(member.getLockAt()).isEmpty() ? "N" : safeString(member.getLockAt()));
                addItem(items, "안내", "현재는 이력 조회만 전환했습니다.");
                break;
            case "email":
                addItem(items, "현재 이메일", member.getApplcntEmailAdres());
                addItem(items, "인증 이메일", member.getAuthEmail());
                addItem(items, "안내", "이메일 변경은 별도 인증 흐름 정리 후 전환합니다.");
                break;
            case "marketing":
                addItem(items, "현재 수신 설정", yesNo(member.getMarketingYn()));
                addItem(items, "저장 가능", "Y");
                break;
            default:
                addItem(items, "안내", "지원하지 않는 섹션입니다.");
                break;
        }
        return items;
    }

    private List<Map<String, String>> buildPasswordHistory(String userId) {
        List<PasswordResetHistory> histories = authService.findRecentPasswordResetHistories(userId);
        List<Map<String, String>> rows = new java.util.ArrayList<>();
        for (PasswordResetHistory history : histories) {
            Map<String, String> row = new LinkedHashMap<>();
            row.put("resetAt", formatDateTime(history.getResetPnttm()));
            row.put("resetBy", safeString(history.getResetByUserId()));
            row.put("source", safeString(history.getResetSource()));
            rows.add(row);
        }
        return rows;
    }

    private void addItem(List<Map<String, String>> items, String label, String value) {
        Map<String, String> item = new LinkedHashMap<>();
        item.put("label", label);
        item.put("value", safeString(value).isEmpty() ? "-" : safeString(value));
        items.add(item);
    }

    private String resolveSectionTitle(String section, boolean en) {
        switch (section) {
            case "profile":
                return en ? "Profile" : "개인정보";
            case "company":
                return en ? "Company" : "회사정보";
            case "staff":
                return en ? "Staff" : "실무자 정보";
            case "notification":
                return en ? "Notifications" : "알림 설정";
            case "password":
                return en ? "Password" : "비밀번호";
            case "email":
                return en ? "Email" : "이메일";
            case "marketing":
                return en ? "Marketing" : "마케팅 수신";
            default:
                return en ? "Mypage" : "마이페이지";
        }
    }

    private String normalizeSection(String section) {
        String normalized = safeString(section).toLowerCase(Locale.ROOT);
        switch (normalized) {
            case "profile":
            case "company":
            case "staff":
            case "notification":
            case "password":
            case "email":
            case "marketing":
                return normalized;
            default:
                return "profile";
        }
    }

    private String normalizeMarketingYn(String marketingYn) {
        return "Y".equalsIgnoreCase(safeString(marketingYn)) ? "Y" : "N";
    }

    private String digitsOnly(String value, int maxLength) {
        String digits = safeString(value).replaceAll("[^0-9]", "");
        return digits.length() > maxLength ? digits.substring(0, maxLength) : digits;
    }

    private String normalizeZip(String zip) {
        return digitsOnly(zip, 6);
    }

    private boolean isValidPhonePart(String value, int minLength, int maxLength) {
        int length = safeString(value).length();
        return length >= minLength && length <= maxLength;
    }

    private boolean isValidEmail(String email) {
        return !safeString(email).isEmpty() && safeString(email).matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    }

    private boolean validatePasswordPolicy(String password) {
        if (password == null || password.length() < 9) {
            return false;
        }
        int classes = 0;
        if (password.matches(".*[a-z].*")) {
            classes++;
        }
        if (password.matches(".*[A-Z].*")) {
            classes++;
        }
        if (password.matches(".*\\d.*")) {
            classes++;
        }
        if (password.matches(".*[^A-Za-z0-9].*")) {
            classes++;
        }
        return classes >= 3;
    }

    private boolean matchesPassword(String rawPassword, String userId, String storedPassword) {
        if (rawPassword == null || userId == null || storedPassword == null) {
            return false;
        }
        String encoded = encryptPassword(rawPassword, userId);
        return Objects.equals(encoded, storedPassword) || Objects.equals(rawPassword, storedPassword);
    }

    private String encryptPassword(String key, String salt) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            md.reset();
            md.update(salt.getBytes(StandardCharsets.UTF_8));
            return Base64.encodeBase64String(md.digest(key.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            return "";
        }
    }

    private String resolveClientIp(HttpServletRequest request) {
        if (request == null) {
            return "LOCAL";
        }
        String forwardedFor = safeString(request.getHeader("X-Forwarded-For"));
        if (!forwardedFor.isEmpty()) {
            return safeString(forwardedFor.split(",")[0]);
        }
        String realIp = safeString(request.getHeader("X-Real-IP"));
        if (!realIp.isEmpty()) {
            return realIp;
        }
        String remoteAddr = safeString(request.getRemoteAddr());
        return remoteAddr.isEmpty() ? "LOCAL" : remoteAddr;
    }

    private String formatPhone(EntrprsMber member) {
        return safeString(member.getAreaNo()) + safeString(member.getEntrprsMiddleTelno()) + safeString(member.getEntrprsEndTelno());
    }

    private String joinAddress(String zip, String address, String detailAddress) {
        String merged = String.join(" ", safeString(zip), safeString(address), safeString(detailAddress)).trim();
        return merged.isEmpty() ? "-" : merged;
    }

    private String yesNo(String value) {
        return "Y".equalsIgnoreCase(safeString(value)) ? "Y" : "N";
    }

    private String formatDateTime(java.time.LocalDateTime value) {
        return value == null ? "-" : value.format(DISPLAY_DATE_TIME);
    }

    private void populateInstitutionReviewInfo(Model model, EntrprsMber enterprise) {
        try {
            InsttInfoVO searchVO = new InsttInfoVO();
            if (!ObjectUtils.isEmpty(enterprise.getInsttId())) {
                searchVO.setInsttId(enterprise.getInsttId());
            } else if (!ObjectUtils.isEmpty(enterprise.getBizrno())) {
                searchVO.setBizrno(enterprise.getBizrno());
            } else {
                return;
            }

            InstitutionStatusVO insttInfo = entrprsManageService.selectInsttInfoForStatus(searchVO);
            if (insttInfo == null || insttInfo.isEmpty()) {
                return;
            }

            Object submittedAt = insttInfo.getFrstRegistPnttm();
            Object rejectReason = insttInfo.getRjctRsn();
            Object rejectProcessedAt = insttInfo.getRjctPnttm();

            if (!ObjectUtils.isEmpty(submittedAt)) {
                model.addAttribute("submittedAt", submittedAt);
            }
            if (!ObjectUtils.isEmpty(rejectReason)) {
                model.addAttribute("rejectionReason", rejectReason.toString());
            }
            if (!ObjectUtils.isEmpty(rejectProcessedAt)) {
                model.addAttribute("rejectionProcessedAt", rejectProcessedAt.toString());
            }
        } catch (Exception ignored) {
            // Mypage gating must not fail even if institution review info lookup fails.
        }
    }

    private void populateInstitutionReviewInfoMap(Map<String, Object> payload, EntrprsMber enterprise) {
        try {
            InsttInfoVO searchVO = new InsttInfoVO();
            if (!ObjectUtils.isEmpty(enterprise.getInsttId())) {
                searchVO.setInsttId(enterprise.getInsttId());
            } else if (!ObjectUtils.isEmpty(enterprise.getBizrno())) {
                searchVO.setBizrno(enterprise.getBizrno());
            } else {
                return;
            }

            InstitutionStatusVO insttInfo = entrprsManageService.selectInsttInfoForStatus(searchVO);
            if (insttInfo == null || insttInfo.isEmpty()) {
                return;
            }

            Object submittedAt = insttInfo.getFrstRegistPnttm();
            Object rejectReason = insttInfo.getRjctRsn();
            Object rejectProcessedAt = insttInfo.getRjctPnttm();

            if (!ObjectUtils.isEmpty(submittedAt)) {
                payload.put("submittedAt", submittedAt);
            }
            if (!ObjectUtils.isEmpty(rejectReason)) {
                payload.put("rejectionReason", rejectReason.toString());
            }
            if (!ObjectUtils.isEmpty(rejectProcessedAt)) {
                payload.put("rejectionProcessedAt", rejectProcessedAt.toString());
            }
        } catch (Exception ignored) {
            // Mypage gating must not fail even if institution review info lookup fails.
        }
    }

    private String formatSubmittedAt(EntrprsMber enterprise) {
        if (enterprise.getSbscrbDe() == null) {
            return "-";
        }
        return enterprise.getSbscrbDe().format(DISPLAY_DATE_TIME);
    }

    private String safeString(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private Optional<EntrprsMber> findEnterpriseMember(String userId) {
        String normalizedUserId = safeString(userId);
        if (normalizedUserId.isEmpty()) {
            return Optional.empty();
        }
        String projectId = safeString(projectRuntimeContext == null ? null : projectRuntimeContext.getProjectId());
        if (!projectId.isEmpty()) {
            Optional<EntrprsMber> projectScoped = enterpriseMemberRepository.findByEntrprsMberIdAndProjectId(normalizedUserId, projectId);
            if (projectScoped.isPresent()) {
                return projectScoped;
            }
        }
        return enterpriseMemberRepository.findById(normalizedUserId);
    }
}
