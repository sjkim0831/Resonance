package egovframework.com.feature.admin.web;

import egovframework.com.platform.codex.service.AdminAuthorityPagePayloadSupport;

import egovframework.com.common.audit.AuditTrailService;
import egovframework.com.feature.auth.util.ClientIpUtil;
import egovframework.com.feature.member.model.vo.InstitutionStatusVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminMemberRegisterCommandSupportService {

    private final AuditTrailService auditTrailService;
    private final AdminRequestContextSupport adminRequestContextSupport;
    private final AdminAuthorityPagePayloadSupport adminAuthorityPagePayloadSupport;
    private final AdminCompanyAccountSupportService adminCompanyAccountSupportService;

    public boolean isEnglishRequest(HttpServletRequest request, Locale locale) {
        return adminRequestContextSupport.isEnglishRequest(request, locale);
    }

    public String extractCurrentUserId(HttpServletRequest request) {
        return adminRequestContextSupport.extractCurrentUserId(request);
    }

    public String trimToLen(String value, int maxLen) {
        return adminCompanyAccountSupportService.trimToLen(value, maxLen);
    }

    public String safeString(String value) {
        return adminCompanyAccountSupportService.safeString(value);
    }

    public String digitsOnly(String value) {
        return adminCompanyAccountSupportService.digitsOnly(value);
    }

    public boolean isValidEmail(String email) {
        return adminCompanyAccountSupportService.isValidEmail(email);
    }

    public String normalizeMembershipCode(String membershipType) {
        return adminCompanyAccountSupportService.normalizeMembershipCode(membershipType);
    }

    public InstitutionStatusVO loadInstitutionInfoByInsttId(String insttId) {
        return adminCompanyAccountSupportService.loadInstitutionInfoByInsttId(insttId);
    }

    public List<String> normalizeFeatureCodes(List<String> featureCodes) {
        if (featureCodes == null || featureCodes.isEmpty()) {
            return Collections.emptyList();
        }
        Set<String> normalized = new LinkedHashSet<>();
        for (String featureCode : featureCodes) {
            String value = safeString(featureCode).toUpperCase(Locale.ROOT);
            if (!value.isEmpty()) {
                normalized.add(value);
            }
        }
        return new ArrayList<>(normalized);
    }

    public boolean isStrongAdminPassword(String password) {
        String value = safeString(password);
        return value.matches("^(?=.*[A-Za-z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,}$");
    }

    public String[] splitPhoneNumber(String phoneNumber) {
        String digits = digitsOnly(phoneNumber);
        if (digits.length() == 9) {
            return new String[]{digits.substring(0, 2), digits.substring(2, 5), digits.substring(5)};
        }
        if (digits.length() == 10) {
            if (digits.startsWith("02")) {
                return new String[]{digits.substring(0, 2), digits.substring(2, 6), digits.substring(6)};
            }
            return new String[]{digits.substring(0, 3), digits.substring(3, 6), digits.substring(6)};
        }
        if (digits.length() == 11) {
            return new String[]{digits.substring(0, 3), digits.substring(3, 7), digits.substring(7)};
        }
        return null;
    }

    public Set<String> resolveGrantableFeatureCodeSet(String currentUserId) throws Exception {
        return adminAuthorityPagePayloadSupport.resolveGrantableFeatureCodeSet(
                currentUserId,
                "webmaster".equalsIgnoreCase(safeString(currentUserId)));
    }

    public void recordMemberRegisterAudit(
            HttpServletRequest request,
            String actorId,
            String actorRole,
            String memberId,
            String insttId,
            String authorCode) {
        try {
            auditTrailService.record(
                    actorId,
                    actorRole,
                    "AMENU_MEMBER_REGISTER",
                    "member-register",
                    "MEMBER_REGISTER_SAVE",
                    "MEMBER",
                    memberId,
                    "SUCCESS",
                    "",
                    "{\"memberId\":\"" + safeJson(memberId) + "\",\"insttId\":\"" + safeJson(insttId) + "\",\"authorCode\":\"" + safeJson(authorCode) + "\"}",
                    "{\"status\":\"SUCCESS\"}",
                    resolveRequestIp(request),
                    request == null ? "" : safeJson(request.getHeader("User-Agent")).replace("'", "\""));
        } catch (Exception e) {
            log.warn("Failed to record member register audit. actorId={}, memberId={}", actorId, memberId, e);
        }
    }

    private String safeJson(String value) {
        return safeString(value).replace("\"", "'");
    }

    private String resolveRequestIp(HttpServletRequest request) {
        if (request == null) {
            return ClientIpUtil.getClientIp();
        }
        String forwarded = safeString(request.getHeader("X-Forwarded-For"));
        if (!forwarded.isEmpty()) {
            int index = forwarded.indexOf(',');
            return index >= 0 ? forwarded.substring(0, index).trim() : forwarded;
        }
        String realIp = safeString(request.getHeader("X-Real-IP"));
        if (!realIp.isEmpty()) {
            return realIp;
        }
        String remoteAddr = safeString(request.getRemoteAddr());
        return remoteAddr.isEmpty() ? ClientIpUtil.getClientIp() : remoteAddr;
    }
}
