package egovframework.com.feature.admin.web;

import egovframework.com.feature.member.model.vo.InsttFileVO;
import egovframework.com.feature.member.model.vo.InsttInfoVO;
import egovframework.com.feature.member.model.vo.InstitutionStatusVO;
import egovframework.com.feature.member.service.EnterpriseMemberService;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
class AdminCompanyAccountService {

    private static final Logger log = LoggerFactory.getLogger(AdminCompanyAccountService.class);

    private final EnterpriseMemberService entrprsManageService;
    private final AdminCompanyAccountSupportService adminCompanyAccountSupportService;

    SaveResult saveCompanyAccount(
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
            boolean isEn,
            boolean hasAccess,
            boolean apiRequest) {
        SaveResult result = SaveResult.normalize(
                adminCompanyAccountSupportService,
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
                apiRequest);
        if (!hasAccess) {
            return result.forbidden(isEn
                    ? apiRequest
                    ? "Only master administrators can manage company accounts."
                    : "Only global administrators can manage company accounts."
                    : apiRequest
                    ? "회원사 관리는 마스터 관리자만 처리할 수 있습니다."
                    : "회원사 관리는 전체 관리자만 처리할 수 있습니다.");
        }

        InstitutionStatusVO existingInstitution = adminCompanyAccountSupportService.loadInstitutionInfoByInsttId(result.insttId);
        List<InsttFileVO> existingFiles = adminCompanyAccountSupportService.loadInsttFilesByInsttId(result.insttId);
        result.existingFiles = existingFiles == null ? Collections.emptyList() : existingFiles;
        boolean hasExistingFiles = !result.existingFiles.isEmpty();
        boolean exists = existingInstitution != null && !existingInstitution.isEmpty();

        if (exists) {
            result.agencyName = adminCompanyAccountSupportService.trimToLen(
                    adminCompanyAccountSupportService.safeString(existingInstitution.getInsttNm()), 100);
            result.representativeName = adminCompanyAccountSupportService.trimToLen(
                    adminCompanyAccountSupportService.safeString(existingInstitution.getReprsntNm()), 60);
            result.bizRegistrationNumber = adminCompanyAccountSupportService.trimToLen(
                    adminCompanyAccountSupportService.digitsOnly(existingInstitution.getBizrno()), 10);
        }

        validate(result, fileUploads, hasExistingFiles, isEn);
        if (!result.errors.isEmpty()) {
            return result.invalid();
        }

        try {
            String targetInsttId = result.insttId;
            if (targetInsttId.isEmpty()) {
                targetInsttId = adminCompanyAccountSupportService.createInstitutionId();
            }

            InsttInfoVO vo = new InsttInfoVO();
            vo.setInsttId(targetInsttId);
            vo.setInsttNm(result.agencyName);
            vo.setReprsntNm(result.representativeName);
            vo.setBizrno(result.bizRegistrationNumber);
            vo.setZip(result.zipCode);
            vo.setAdres(result.companyAddress);
            vo.setDetailAdres(result.companyAddressDetail);
            vo.setChargerNm(result.chargerName);
            vo.setChargerEmail(result.chargerEmail);
            vo.setChargerTel(result.chargerTel);
            vo.setEntrprsSeCode(result.membershipType);
            vo.setInsttSttus(exists
                    ? adminCompanyAccountSupportService.safeString(existingInstitution.getInsttSttus()).isEmpty()
                        ? "A"
                        : adminCompanyAccountSupportService.safeString(existingInstitution.getInsttSttus())
                    : "A");

            int nextFileSn = hasExistingFiles ? result.existingFiles.size() + 1 : 1;
            List<InsttFileVO> newFiles = adminCompanyAccountSupportService.saveAdminInsttEvidenceFiles(targetInsttId, fileUploads, nextFileSn);
            if (!newFiles.isEmpty()) {
                vo.setBizRegFilePath(adminCompanyAccountSupportService.joinInsttEvidencePaths(newFiles));
            } else if (exists) {
                vo.setBizRegFilePath(existingInstitution.getBizRegFilePath());
            }

            if (exists) {
                entrprsManageService.updateInsttInfo(vo);
            } else {
                entrprsManageService.insertInsttInfo(vo);
            }
            entrprsManageService.insertInsttFiles(newFiles);
            result.insttId = targetInsttId;
            result.success = true;
            result.saved = true;
            return result;
        } catch (Exception e) {
            log.error("Failed to save admin company account. insttId={}", result.insttId, e);
            return result.serverError(isEn ? "An error occurred while saving the company registration." : "회원사 등록 저장 중 오류가 발생했습니다.");
        }
    }

    private void validate(
            SaveResult result,
            List<MultipartFile> fileUploads,
            boolean hasExistingFiles,
            boolean isEn) {
        if (result.membershipType.isEmpty()) {
            result.errors.add(isEn ? "Please select a valid membership type." : "유효한 회원 유형을 선택해 주세요.");
        }
        if (result.agencyName.isEmpty()) {
            result.errors.add(isEn ? "Please enter the institution or company name." : "기관/기업명을 입력해 주세요.");
        }
        if (result.representativeName.isEmpty()) {
            result.errors.add(isEn ? "Please enter the representative name." : "대표자명을 입력해 주세요.");
        }
        if (result.bizRegistrationNumber.length() != 10) {
            result.errors.add(isEn ? "Please enter a 10-digit business registration number." : "사업자등록번호 10자리를 입력해 주세요.");
        }
        if (result.zipCode.isEmpty()) {
            result.errors.add(isEn ? "Please search and enter the postal code." : "우편번호를 입력해 주세요.");
        }
        if (result.companyAddress.isEmpty()) {
            result.errors.add(isEn ? "Please enter the business address." : "사업장 주소를 입력해 주세요.");
        }
        if (result.chargerName.isEmpty()) {
            result.errors.add(isEn ? "Please enter the contact name." : "담당자 성명을 입력해 주세요.");
        }
        if (!adminCompanyAccountSupportService.isValidEmail(result.chargerEmail)) {
            result.errors.add(isEn ? "Please enter a valid email address." : "올바른 담당자 이메일을 입력해 주세요.");
        }
        if (adminCompanyAccountSupportService.digitsOnly(result.chargerTel).length() < 9) {
            result.errors.add(isEn ? "Please enter a valid contact number." : "올바른 담당자 연락처를 입력해 주세요.");
        }
        if (!adminCompanyAccountSupportService.hasValidInsttEvidenceFiles(fileUploads) && !hasExistingFiles) {
            result.errors.add(isEn ? "Please upload at least one supporting document." : "증빙 서류를 1개 이상 업로드해 주세요.");
        }
    }

    @Getter
    static class SaveResult {
        private boolean success;
        private boolean forbidden;
        private boolean saved;
        private int statusCode;
        private String message;
        private List<String> errors;
        private String insttId;
        private String membershipType;
        private String agencyName;
        private String representativeName;
        private String bizRegistrationNumber;
        private String zipCode;
        private String companyAddress;
        private String companyAddressDetail;
        private String chargerName;
        private String chargerEmail;
        private String chargerTel;
        private List<InsttFileVO> existingFiles;
        private final boolean apiRequest;

        private SaveResult(boolean apiRequest) {
            this.apiRequest = apiRequest;
            this.errors = new ArrayList<>();
            this.existingFiles = Collections.emptyList();
            this.statusCode = HttpStatus.OK.value();
        }

        static SaveResult normalize(
                AdminCompanyAccountSupportService support,
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
                boolean apiRequest) {
            SaveResult result = new SaveResult(apiRequest);
            result.insttId = support.safeString(insttId);
            result.membershipType = support.normalizeMembershipCode(membershipType);
            result.agencyName = support.trimToLen(support.safeString(agencyName), 100);
            result.representativeName = support.trimToLen(support.safeString(representativeName), 60);
            result.bizRegistrationNumber = support.trimToLen(support.digitsOnly(bizRegistrationNumber), 10);
            result.zipCode = support.trimToLen(support.digitsOnly(zipCode), 6);
            result.companyAddress = support.trimToLen(support.safeString(companyAddress), 200);
            result.companyAddressDetail = support.trimToLen(support.safeString(companyAddressDetail), 200);
            result.chargerName = support.trimToLen(support.safeString(chargerName), 60);
            result.chargerEmail = support.trimToLen(support.safeString(chargerEmail), 100);
            result.chargerTel = support.trimToLen(support.safeString(chargerTel), 30);
            return result;
        }

        SaveResult forbidden(String message) {
            this.success = false;
            this.forbidden = true;
            this.message = message;
            this.statusCode = HttpStatus.FORBIDDEN.value();
            return this;
        }

        SaveResult invalid() {
            this.success = false;
            this.statusCode = HttpStatus.BAD_REQUEST.value();
            return this;
        }

        SaveResult serverError(String message) {
            this.success = false;
            this.message = message;
            this.errors = Collections.singletonList(message);
            this.statusCode = HttpStatus.INTERNAL_SERVER_ERROR.value();
            return this;
        }

        ResponseEntity<Map<String, Object>> toResponseEntity() {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", success);
            if (saved) {
                response.put("insttId", insttId);
                response.put("saved", true);
            }
            if (!errors.isEmpty()) {
                response.put("errors", errors);
            }
            if (message != null && !message.isEmpty()) {
                response.put("message", message);
            }
            return ResponseEntity.status(statusCode).body(response);
        }

        boolean isForbidden() {
            return forbidden;
        }

        boolean isSuccess() {
            return success;
        }

        String getMessage() {
            return message;
        }

        String getInsttId() {
            return insttId;
        }

        String getMembershipType() {
            return membershipType;
        }

        String getAgencyName() {
            return agencyName;
        }

        String getRepresentativeName() {
            return representativeName;
        }

        String getBizRegistrationNumber() {
            return bizRegistrationNumber;
        }

        String getZipCode() {
            return zipCode;
        }

        String getCompanyAddress() {
            return companyAddress;
        }

        String getCompanyAddressDetail() {
            return companyAddressDetail;
        }

        String getChargerName() {
            return chargerName;
        }

        String getChargerEmail() {
            return chargerEmail;
        }

        String getChargerTel() {
            return chargerTel;
        }

        List<InsttFileVO> getExistingFiles() {
            return existingFiles;
        }

        List<String> getErrors() {
            return errors;
        }
    }
}
