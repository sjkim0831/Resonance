package egovframework.com.feature.admin.web;

import egovframework.com.platform.codex.service.AdminAuthorityPagePayloadSupport;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.ui.Model;
import org.springframework.web.multipart.MultipartFile;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminCompanyAccountCommandService {

    private final AdminCompanyAccountService adminCompanyAccountService;
    private final AdminCompanyAccountSupportService adminCompanyAccountSupportService;
    private final AdminAuthorityPagePayloadSupport adminAuthorityPagePayloadSupport;

    public ResponseEntity<Map<String, Object>> submitApi(
            String insttId,
            String membershipType,
            String agencyName,
            String representativeName,
            String bizRegistrationNumber,
            String zipCode,
            String companyAddress,
            String companyAddressDetail,
            String chargerName,
            String chargerEmail,
            String chargerTel,
            List<MultipartFile> fileUploads,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminCompanyAccountSupportService.isEnglishRequest(request, locale);
        String currentUserId = adminCompanyAccountSupportService.extractCurrentUserId(request);
        String currentUserAuthorCode = adminAuthorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
        AdminCompanyAccountService.SaveResult result = adminCompanyAccountService.saveCompanyAccount(
                insttId,
                membershipType,
                agencyName,
                representativeName,
                bizRegistrationNumber,
                zipCode,
                companyAddress,
                companyAddressDetail,
                chargerName,
                chargerEmail,
                chargerTel,
                fileUploads,
                isEn,
                adminAuthorityPagePayloadSupport.hasMemberManagementMasterAccess(currentUserId, currentUserAuthorCode),
                true);
        return result.toResponseEntity();
    }

    public String submitForm(
            String insttId,
            String membershipType,
            String agencyName,
            String representativeName,
            String bizRegistrationNumber,
            String zipCode,
            String companyAddress,
            String companyAddressDetail,
            String chargerName,
            String chargerEmail,
            String chargerTel,
            List<MultipartFile> fileUploads,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        adminCompanyAccountSupportService.primeCsrfToken(request);
        boolean isEn = adminCompanyAccountSupportService.isEnglishRequest(request, locale);
        String currentUserId = adminCompanyAccountSupportService.extractCurrentUserId(request);
        AdminCompanyAccountService.SaveResult result = adminCompanyAccountService.saveCompanyAccount(
                insttId,
                membershipType,
                agencyName,
                representativeName,
                bizRegistrationNumber,
                zipCode,
                companyAddress,
                companyAddressDetail,
                chargerName,
                chargerEmail,
                chargerTel,
                fileUploads,
                isEn,
                adminAuthorityPagePayloadSupport.hasGlobalDeptRoleAccess(
                        currentUserId,
                        adminAuthorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId)),
                false);
        if (result.isForbidden()) {
            model.addAttribute("companyAccountErrors", Collections.singletonList(result.getMessage()));
            return adminCompanyAccountSupportService.resolveFormViewName(isEn);
        }
        if (!result.isSuccess()) {
            adminCompanyAccountSupportService.populateCompanyAccountModelFromValues(
                    result.getInsttId(),
                    result.getMembershipType(),
                    result.getAgencyName(),
                    result.getRepresentativeName(),
                    result.getBizRegistrationNumber(),
                    result.getZipCode(),
                    result.getCompanyAddress(),
                    result.getCompanyAddressDetail(),
                    result.getChargerName(),
                    result.getChargerEmail(),
                    result.getChargerTel(),
                    isEn,
                    model);
            model.addAttribute("companyAccountFiles", result.getExistingFiles());
            model.addAttribute("companyAccountErrors", result.getErrors());
            return adminCompanyAccountSupportService.resolveFormViewName(isEn);
        }
        return adminCompanyAccountSupportService.resolveSuccessRedirect(request, locale, result.getInsttId());
    }
}
