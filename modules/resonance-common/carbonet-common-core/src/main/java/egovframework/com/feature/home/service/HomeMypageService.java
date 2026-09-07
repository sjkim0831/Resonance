package egovframework.com.feature.home.service;


import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;

public interface HomeMypageService {

    Map<String, Object> buildMypageContext(boolean en, HttpServletRequest request);

    Map<String, Object> buildMypagePayload(boolean en, HttpServletRequest request);

    Map<String, Object> buildMypageSectionPayload(boolean en, String section, HttpServletRequest request);

    Map<String, Object> updateProfile(boolean en, String zip, String address, String detailAddress,
            HttpServletRequest request);

    Map<String, Object> updateCompany(boolean en, String companyName, String representativeName, String zip,
            String address, String detailAddress, HttpServletRequest request);

    Map<String, Object> updateMarketingPreference(boolean en, String marketingYn, HttpServletRequest request);

    Map<String, Object> updateStaffContact(boolean en, String staffName, String deptNm, String areaNo,
            String middleTelno, String endTelno, HttpServletRequest request);

    Map<String, Object> updateEmailAddress(boolean en, String email, HttpServletRequest request);

    Map<String, Object> requestContactVerification(boolean en, String channel, String targetValue,
            HttpServletRequest request);

    Map<String, Object> confirmContactVerification(boolean en, String challengeId, String verificationCode,
            HttpServletRequest request);

    Map<String, Object> updatePassword(boolean en, String currentPassword, String newPassword, HttpServletRequest request);

    Map<String, Object> buildMfaStatus(boolean en, HttpServletRequest request);

    Map<String, Object> requestMfaEnrollment(boolean en, HttpServletRequest request);

    Map<String, Object> verifyMfaEnrollment(boolean en, String challengeId, String verificationCode,
            HttpServletRequest request);

    Map<String, Object> disableMfa(boolean en, String currentPassword, HttpServletRequest request);
}
