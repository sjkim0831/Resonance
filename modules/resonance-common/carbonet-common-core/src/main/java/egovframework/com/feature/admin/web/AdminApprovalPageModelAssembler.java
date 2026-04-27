package egovframework.com.feature.admin.web;

import egovframework.com.platform.codex.service.AdminAuthorityPagePayloadSupport;

import egovframework.com.feature.member.model.vo.CompanyListItemVO;
import egovframework.com.feature.member.model.vo.EntrprsManageVO;
import egovframework.com.feature.member.model.vo.InsttFileVO;
import egovframework.com.feature.member.model.vo.InsttInfoVO;
import egovframework.com.feature.member.model.vo.InstitutionStatusVO;
import egovframework.com.feature.member.service.EnterpriseMemberService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.ui.Model;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminApprovalPageModelAssembler {

    private static final Logger log = LoggerFactory.getLogger(AdminApprovalPageModelAssembler.class);

    private final EnterpriseMemberService entrprsManageService;
    private final AdminMemberEvidenceSupport adminMemberEvidenceSupport;
    private final AdminRequestContextSupport adminRequestContextSupport;
    private final AdminAuthorityPagePayloadSupport adminAuthorityPagePayloadSupport;
    private final AdminApprovalNavigationSupport adminApprovalNavigationSupport;

    public void populateMemberApprovalList(
            String pageIndexParam,
            String searchKeyword,
            String membershipType,
            String sbscrbSttus,
            String result,
            Model model,
            boolean isEn,
            HttpServletRequest request,
            Locale locale) {
        int pageIndex = 1;
        if (pageIndexParam != null && !pageIndexParam.trim().isEmpty()) {
            try {
                pageIndex = Integer.parseInt(pageIndexParam.trim());
            } catch (NumberFormatException ignored) {
                pageIndex = 1;
            }
        }
        int currentPage = Math.max(pageIndex, 1);
        int pageSize = 10;

        EntrprsManageVO searchVO = new EntrprsManageVO();
        searchVO.setPageIndex(currentPage);
        searchVO.setRecordCountPerPage(pageSize);

        String keyword = safeString(searchKeyword);
        searchVO.setSearchKeyword(keyword);
        searchVO.setSearchCondition("all");

        String memberType = safeString(membershipType).toUpperCase(Locale.ROOT);
        if (!memberType.isEmpty()) {
            String dbTypeCode = normalizeMembershipCode(memberType);
            if (!dbTypeCode.isEmpty()) {
                searchVO.setEntrprsSeCode(dbTypeCode);
            }
        }

        String status = safeString(sbscrbSttus).toUpperCase(Locale.ROOT);
        if (status.isEmpty()) {
            status = "A";
        }
        searchVO.setSbscrbSttus(status);
        String currentUserId = adminRequestContextSupport.extractCurrentUserId(request);
        String currentUserAuthorCode = adminAuthorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
        if (!adminAuthorityPagePayloadSupport.hasMemberManagementCompanyOperatorAccess(currentUserId, currentUserAuthorCode)) {
            populateMemberApprovalForbidden(model, keyword, memberType, status, result, isEn, request, locale, pageSize);
            return;
        }
        if (adminAuthorityPagePayloadSupport.requiresMemberManagementCompanyScope(currentUserId, currentUserAuthorCode)) {
            searchVO.setInsttId(adminAuthorityPagePayloadSupport.resolveCurrentUserInsttId(currentUserId));
        }

        List<EntrprsManageVO> memberList;
        int totalCount;
        try {
            totalCount = entrprsManageService.selectEntrprsMberListTotCnt(searchVO);
            int totalPages = totalCount == 0 ? 1 : (int) Math.ceil(totalCount / (double) pageSize);
            if (currentPage > totalPages) {
                currentPage = totalPages;
            }
            searchVO.setPageIndex(currentPage);
            searchVO.setFirstIndex((currentPage - 1) * pageSize);
            memberList = entrprsManageService.selectEntrprsMberList(searchVO);
        } catch (Exception e) {
            log.error("Failed to load member approval list.", e);
            memberList = Collections.emptyList();
            totalCount = 0;
            model.addAttribute("memberApprovalError",
                    isEn ? "An error occurred while retrieving the approval list." : "승인 대기 목록 조회 중 오류가 발생했습니다.");
        }

        List<Map<String, Object>> approvalRows = new ArrayList<>();
        for (EntrprsManageVO member : memberList) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("memberId", safeString(member.getEntrprsmberId()));
            row.put("memberName", safeString(member.getApplcntNm()));
            row.put("companyName", safeString(member.getCmpnyNm()));
            row.put("businessNumber", safeString(member.getBizrno()));
            row.put("departmentName", safeString(member.getDeptNm()));
            row.put("representativeName", safeString(member.getCxfc()));
            row.put("joinDate", safeString(member.getSbscrbDe()));
            row.put("membershipTypeLabel", isEn
                    ? resolveMembershipTypeLabelEn(member.getEntrprsSeCode())
                    : resolveMembershipTypeLabel(member.getEntrprsSeCode()));
            row.put("statusLabel", isEn
                    ? resolveStatusLabelEn(member.getEntrprsMberSttus())
                    : resolveStatusLabel(member.getEntrprsMberSttus()));
            row.put("statusBadgeClass", resolveStatusBadgeClass(member.getEntrprsMberSttus()));
            row.put("rejectReason", safeString(member.getRjctRsn()));
            row.put("detailUrl", adminApprovalNavigationSupport.adminPrefix(request, locale) + "/member/detail?memberId="
                    + urlEncode(member.getEntrprsmberId()));
            List<AdminMemberEvidenceSupport.EvidenceFileView> evidenceFiles = adminMemberEvidenceSupport.loadEvidenceFiles(member);
            List<Map<String, Object>> evidencePreviewFiles = new ArrayList<>();
            for (int fileIndex = 0; fileIndex < Math.min(evidenceFiles.size(), 2); fileIndex++) {
                AdminMemberEvidenceSupport.EvidenceFileView file = evidenceFiles.get(fileIndex);
                Map<String, Object> preview = new LinkedHashMap<>();
                preview.put("fileName", safeString(file.getFileName()));
                preview.put("downloadUrl", safeString(file.getDownloadUrl()));
                evidencePreviewFiles.add(preview);
            }
            row.put("evidenceFiles", evidencePreviewFiles);
            row.put("evidenceFileCount", evidenceFiles.size());
            row.put("hasEvidenceFiles", !evidenceFiles.isEmpty());
            approvalRows.add(row);
        }

        int totalPages = totalCount == 0 ? 1 : (int) Math.ceil(totalCount / (double) pageSize);
        if (currentPage > totalPages) {
            currentPage = totalPages;
        }
        int startPage = Math.max(1, currentPage - 4);
        int endPage = Math.min(totalPages, startPage + 9);
        if (endPage - startPage < 9) {
            startPage = Math.max(1, endPage - 9);
        }

        model.addAttribute("approvalRows", approvalRows);
        model.addAttribute("memberApprovalTotalCount", totalCount);
        model.addAttribute("pageIndex", currentPage);
        model.addAttribute("pageSize", pageSize);
        model.addAttribute("totalPages", totalPages);
        model.addAttribute("startPage", startPage);
        model.addAttribute("endPage", endPage);
        model.addAttribute("searchKeyword", keyword);
        model.addAttribute("membershipType", memberType);
        model.addAttribute("sbscrbSttus", status);
        String approvalBasePath = adminApprovalNavigationSupport.resolveMemberApprovalBasePath(request, locale);
        model.addAttribute("memberApprovalAction", approvalBasePath);
        model.addAttribute("memberApprovalListUrl", approvalBasePath);
        model.addAttribute("memberApprovalResult", safeString(result));
        model.addAttribute("memberApprovalResultMessage", resolveApprovalResultMessage(result, isEn));
        model.addAttribute("memberApprovalStatusOptions", buildApprovalStatusOptions(isEn));
        model.addAttribute("memberTypeOptions", buildMemberTypeOptions(isEn));
    }

    public void populateCompanyApprovalList(
            String pageIndexParam,
            String searchKeyword,
            String sbscrbSttus,
            String result,
            Model model,
            boolean isEn,
            HttpServletRequest request,
            Locale locale) {
        int pageIndex = 1;
        if (pageIndexParam != null && !pageIndexParam.trim().isEmpty()) {
            try {
                pageIndex = Integer.parseInt(pageIndexParam.trim());
            } catch (NumberFormatException ignored) {
                pageIndex = 1;
            }
        }
        int currentPage = Math.max(pageIndex, 1);
        int pageSize = 10;

        String keyword = safeString(searchKeyword);
        String status = safeString(sbscrbSttus).toUpperCase(Locale.ROOT);
        if (status.isEmpty()) {
            status = "A";
        }
        String currentUserId = adminRequestContextSupport.extractCurrentUserId(request);
        String currentUserAuthorCode = adminAuthorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
        if (!adminAuthorityPagePayloadSupport.hasMemberManagementMasterAccess(currentUserId, currentUserAuthorCode)) {
            populateCompanyApprovalForbidden(model, keyword, status, result, isEn, request, locale, pageSize);
            return;
        }

        List<?> companyList;
        int totalCount;
        try {
            Map<String, Object> searchParams = new LinkedHashMap<>();
            searchParams.put("keyword", keyword);
            searchParams.put("status", status);
            totalCount = entrprsManageService.searchCompanyListTotCnt(searchParams);
            int totalPages = totalCount == 0 ? 1 : (int) Math.ceil(totalCount / (double) pageSize);
            if (currentPage > totalPages) {
                currentPage = totalPages;
            }
            int offset = (currentPage - 1) * pageSize;
            searchParams.put("offset", offset);
            searchParams.put("pageSize", pageSize);
            companyList = entrprsManageService.searchCompanyListPaged(searchParams);
        } catch (Exception e) {
            log.error("Failed to load company approval list.", e);
            companyList = Collections.emptyList();
            totalCount = 0;
            model.addAttribute("memberApprovalError",
                    isEn ? "An error occurred while retrieving the company approval list." : "회원사 승인 목록 조회 중 오류가 발생했습니다.");
        }

        List<Map<String, Object>> approvalRows = new ArrayList<>();
        for (Object company : companyList) {
            Map<String, Object> row = new LinkedHashMap<>();
            String insttId;
            String companyName;
            String businessNumber;
            String representativeName;
            String membershipTypeCode;
            String joinStat;

            if (company instanceof CompanyListItemVO) {
                CompanyListItemVO companyVO = (CompanyListItemVO) company;
                insttId = safeString(companyVO.getInsttId());
                companyName = safeString(companyVO.getCmpnyNm());
                businessNumber = safeString(companyVO.getBizrno());
                representativeName = safeString(companyVO.getCxfc());
                membershipTypeCode = safeString(companyVO.getEntrprsSeCode());
                joinStat = safeString(companyVO.getJoinStat());
            } else if (company instanceof Map) {
                Map<?, ?> companyMap = (Map<?, ?>) company;
                insttId = stringValue(companyMap.get("insttId"));
                if (insttId.isEmpty()) insttId = stringValue(companyMap.get("INSTT_ID"));
                companyName = stringValue(companyMap.get("cmpnyNm"));
                if (companyName.isEmpty()) companyName = stringValue(companyMap.get("CMPNY_NM"));
                businessNumber = stringValue(companyMap.get("bizrno"));
                if (businessNumber.isEmpty()) businessNumber = stringValue(companyMap.get("BIZRNO"));
                representativeName = stringValue(companyMap.get("cxfc"));
                if (representativeName.isEmpty()) representativeName = stringValue(companyMap.get("CXFC"));
                membershipTypeCode = stringValue(companyMap.get("entrprsSeCode"));
                if (membershipTypeCode.isEmpty()) membershipTypeCode = stringValue(companyMap.get("ENTRPRS_SE_CODE"));
                joinStat = stringValue(companyMap.get("joinStat"));
                if (joinStat.isEmpty()) joinStat = stringValue(companyMap.get("JOIN_STAT"));
            } else {
                continue;
            }
            row.put("insttId", insttId);
            row.put("companyName", companyName);
            row.put("businessNumber", businessNumber);
            row.put("representativeName", representativeName);
            row.put("membershipTypeLabel", isEn
                    ? resolveMembershipTypeLabelEn(membershipTypeCode)
                    : resolveMembershipTypeLabel(membershipTypeCode));
            row.put("statusLabel", isEn
                    ? resolveInstitutionStatusLabelEn(joinStat)
                    : resolveInstitutionStatusLabel(joinStat));
            row.put("statusBadgeClass", resolveInstitutionStatusBadgeClass(joinStat));
            row.put("detailUrl", adminApprovalNavigationSupport.adminPrefix(request, locale) + "/member/company_detail?insttId=" + urlEncode(insttId));
            row.put("editUrl", adminApprovalNavigationSupport.adminPrefix(request, locale) + "/member/company_account?insttId=" + urlEncode(insttId));
            row.put("rejectReason", "");

            if (!insttId.isEmpty()) {
                try {
                    InstitutionStatusVO institutionInfo = loadInstitutionInfoByInsttId(insttId);
                    row.put("rejectReason", institutionInfo == null ? "" : safeString(institutionInfo.getRjctRsn()));
                } catch (Exception e) {
                    log.warn("Failed to load company rejection reason. insttId={}", insttId, e);
                }
            }

            List<InsttFileVO> fileList = loadInsttFilesByInsttId(insttId);
            List<Map<String, String>> evidenceFiles = new ArrayList<>();
            for (InsttFileVO file : fileList) {
                Map<String, String> fileRow = new LinkedHashMap<>();
                fileRow.put("fileName", safeString(file.getOrignlFileNm()));
                fileRow.put("downloadUrl",
                        adminApprovalNavigationSupport.adminPrefix(request, locale) + "/member/company-file?fileId="
                                + urlEncode(file.getFileId()) + "&download=true");
                evidenceFiles.add(fileRow);
            }
            row.put("evidenceFiles", evidenceFiles);
            row.put("hasEvidenceFiles", !evidenceFiles.isEmpty());
            approvalRows.add(row);
        }

        int totalPages = totalCount == 0 ? 1 : (int) Math.ceil(totalCount / (double) pageSize);
        if (currentPage > totalPages) {
            currentPage = totalPages;
        }
        int startPage = Math.max(1, currentPage - 4);
        int endPage = Math.min(totalPages, startPage + 9);
        if (endPage - startPage < 9) {
            startPage = Math.max(1, endPage - 9);
        }

        model.addAttribute("approvalRows", approvalRows);
        model.addAttribute("memberApprovalTotalCount", totalCount);
        model.addAttribute("pageIndex", currentPage);
        model.addAttribute("pageSize", pageSize);
        model.addAttribute("totalPages", totalPages);
        model.addAttribute("startPage", startPage);
        model.addAttribute("endPage", endPage);
        model.addAttribute("searchKeyword", keyword);
        model.addAttribute("sbscrbSttus", status);
        model.addAttribute("memberApprovalAction", adminApprovalNavigationSupport.adminPrefix(request, locale) + "/member/company-approve");
        model.addAttribute("memberApprovalListUrl", adminApprovalNavigationSupport.adminPrefix(request, locale) + "/member/company-approve");
        model.addAttribute("memberApprovalResult", safeString(result));
        model.addAttribute("memberApprovalResultMessage", resolveCompanyApprovalResultMessage(result, isEn));
        model.addAttribute("memberApprovalStatusOptions", buildApprovalStatusOptions(isEn));
    }

    private void populateMemberApprovalForbidden(
            Model model,
            String keyword,
            String memberType,
            String status,
            String result,
            boolean isEn,
            HttpServletRequest request,
            Locale locale,
            int pageSize) {
        model.addAttribute("memberApprovalError",
                isEn ? "Only global administrators can view member approvals." : "회원 승인 목록은 전체 관리자만 조회할 수 있습니다.");
        model.addAttribute("approvalRows", Collections.emptyList());
        model.addAttribute("memberApprovalTotalCount", 0);
        model.addAttribute("pageIndex", 1);
        model.addAttribute("pageSize", pageSize);
        model.addAttribute("totalPages", 1);
        model.addAttribute("startPage", 1);
        model.addAttribute("endPage", 1);
        model.addAttribute("searchKeyword", keyword);
        model.addAttribute("membershipType", memberType);
        model.addAttribute("sbscrbSttus", status);
        String approvalBasePath = adminApprovalNavigationSupport.resolveMemberApprovalBasePath(request, locale);
        model.addAttribute("memberApprovalAction", approvalBasePath);
        model.addAttribute("memberApprovalListUrl", approvalBasePath);
        model.addAttribute("memberApprovalResult", safeString(result));
        model.addAttribute("memberApprovalResultMessage", resolveApprovalResultMessage(result, isEn));
        model.addAttribute("memberApprovalStatusOptions", buildApprovalStatusOptions(isEn));
        model.addAttribute("memberTypeOptions", buildMemberTypeOptions(isEn));
    }

    private void populateCompanyApprovalForbidden(
            Model model,
            String keyword,
            String status,
            String result,
            boolean isEn,
            HttpServletRequest request,
            Locale locale,
            int pageSize) {
        model.addAttribute("memberApprovalError",
                isEn ? "Only global administrators can view company approvals." : "회원사 승인 목록은 전체 관리자만 조회할 수 있습니다.");
        model.addAttribute("approvalRows", Collections.emptyList());
        model.addAttribute("memberApprovalTotalCount", 0);
        model.addAttribute("pageIndex", 1);
        model.addAttribute("pageSize", pageSize);
        model.addAttribute("totalPages", 1);
        model.addAttribute("startPage", 1);
        model.addAttribute("endPage", 1);
        model.addAttribute("searchKeyword", keyword);
        model.addAttribute("sbscrbSttus", status);
        model.addAttribute("memberApprovalAction", adminApprovalNavigationSupport.adminPrefix(request, locale) + "/member/company-approve");
        model.addAttribute("memberApprovalListUrl", adminApprovalNavigationSupport.adminPrefix(request, locale) + "/member/company-approve");
        model.addAttribute("memberApprovalResult", safeString(result));
        model.addAttribute("memberApprovalResultMessage", resolveCompanyApprovalResultMessage(result, isEn));
        model.addAttribute("memberApprovalStatusOptions", buildApprovalStatusOptions(isEn));
    }

    private InstitutionStatusVO loadInstitutionInfoByInsttId(String insttId) {
        String normalizedInsttId = safeString(insttId);
        if (normalizedInsttId.isEmpty()) {
            return null;
        }
        try {
            InsttInfoVO searchVO = new InsttInfoVO();
            searchVO.setInsttId(normalizedInsttId);
            return entrprsManageService.selectInsttInfoForStatus(searchVO);
        } catch (Exception e) {
            log.warn("Failed to load institution info. insttId={}", normalizedInsttId, e);
            return null;
        }
    }

    private List<InsttFileVO> loadInsttFilesByInsttId(String insttId) {
        String normalizedInsttId = safeString(insttId);
        if (normalizedInsttId.isEmpty()) {
            return Collections.emptyList();
        }
        try {
            List<InsttFileVO> fileList = entrprsManageService.selectInsttFiles(normalizedInsttId);
            return fileList == null ? Collections.emptyList() : fileList;
        } catch (Exception e) {
            log.warn("Failed to load institution file list. insttId={}", normalizedInsttId, e);
            return Collections.emptyList();
        }
    }

    private String normalizeMembershipCode(String membershipType) {
        String normalized = safeString(membershipType).toUpperCase(Locale.ROOT);
        if ("EMITTER".equals(normalized)) return "E";
        if ("PERFORMER".equals(normalized)) return "P";
        if ("CENTER".equals(normalized)) return "C";
        if ("GOV".equals(normalized)) return "G";
        if ("E".equals(normalized) || "P".equals(normalized) || "C".equals(normalized) || "G".equals(normalized)) {
            return normalized;
        }
        return "";
    }

    private String resolveMembershipTypeLabel(String code) {
        String value = safeString(code).toUpperCase(Locale.ROOT);
        if ("E".equals(value) || "EMITTER".equals(value)) return "CO2 배출 및 포집 기업";
        if ("P".equals(value) || "PERFORMER".equals(value)) return "CCUS 사업 수행 기업";
        if ("C".equals(value) || "CENTER".equals(value)) return "CCUS 진흥센터";
        if ("G".equals(value) || "GOV".equals(value)) return "주무관청 / 행정기관";
        return value.isEmpty() ? "기타" : value;
    }

    private String resolveMembershipTypeLabelEn(String code) {
        String value = safeString(code).toUpperCase(Locale.ROOT);
        if ("E".equals(value) || "EMITTER".equals(value)) return "CO2 Emitter/Capture Company";
        if ("P".equals(value) || "PERFORMER".equals(value)) return "CCUS Project Company";
        if ("C".equals(value) || "CENTER".equals(value)) return "CCUS Promotion Center";
        if ("G".equals(value) || "GOV".equals(value)) return "Government / Agency";
        return value.isEmpty() ? "Other" : value;
    }

    private String resolveStatusLabel(String statusCode) {
        String value = safeString(statusCode).toUpperCase(Locale.ROOT);
        if ("P".equals(value)) return "활성";
        if ("A".equals(value)) return "승인 대기";
        if ("R".equals(value)) return "반려";
        if ("D".equals(value)) return "삭제";
        if ("X".equals(value)) return "차단";
        return value.isEmpty() ? "기타" : value;
    }

    private String resolveStatusLabelEn(String statusCode) {
        String value = safeString(statusCode).toUpperCase(Locale.ROOT);
        if ("P".equals(value)) return "Active";
        if ("A".equals(value)) return "Pending Approval";
        if ("R".equals(value)) return "Rejected";
        if ("D".equals(value)) return "Deleted";
        if ("X".equals(value)) return "Blocked";
        return value.isEmpty() ? "Other" : value;
    }

    private String resolveStatusBadgeClass(String statusCode) {
        String value = safeString(statusCode).toUpperCase(Locale.ROOT);
        if ("P".equals(value)) return "bg-emerald-100 text-emerald-700";
        if ("A".equals(value)) return "bg-blue-100 text-blue-700";
        if ("R".equals(value)) return "bg-amber-100 text-amber-700";
        if ("D".equals(value)) return "bg-slate-200 text-slate-700";
        if ("X".equals(value)) return "bg-red-100 text-red-700";
        return "bg-gray-100 text-gray-700";
    }

    private String resolveInstitutionStatusLabel(String statusCode) {
        String value = safeString(statusCode).toUpperCase(Locale.ROOT);
        if ("A".equals(value)) return "검토 중";
        if ("P".equals(value)) return "가입 승인 완료";
        if ("R".equals(value)) return "반려";
        if ("X".equals(value)) return "차단";
        if ("D".equals(value)) return "삭제";
        return value.isEmpty() ? "-" : value;
    }

    private String resolveInstitutionStatusLabelEn(String statusCode) {
        String value = safeString(statusCode).toUpperCase(Locale.ROOT);
        if ("A".equals(value)) return "Under Review";
        if ("P".equals(value)) return "Approved";
        if ("R".equals(value)) return "Rejected";
        if ("X".equals(value)) return "Blocked";
        if ("D".equals(value)) return "Deleted";
        return value.isEmpty() ? "-" : value;
    }

    private String resolveInstitutionStatusBadgeClass(String statusCode) {
        String value = safeString(statusCode).toUpperCase(Locale.ROOT);
        if ("A".equals(value)) return "bg-blue-100 text-blue-700";
        if ("P".equals(value)) return "bg-emerald-100 text-emerald-700";
        if ("R".equals(value)) return "bg-amber-100 text-amber-700";
        if ("X".equals(value)) return "bg-red-100 text-red-700";
        if ("D".equals(value)) return "bg-slate-200 text-slate-700";
        return "bg-gray-100 text-gray-700";
    }

    private String resolveApprovalResultMessage(String result, boolean isEn) {
        String normalized = safeString(result);
        if (normalized.isEmpty()) {
            return "";
        }
        if ("approved".equalsIgnoreCase(normalized)) {
            return isEn ? "The member approval has been completed." : "회원 가입 승인이 완료되었습니다.";
        }
        if ("batchApproved".equalsIgnoreCase(normalized)) {
            return isEn ? "Selected members have been approved." : "선택한 회원 승인이 완료되었습니다.";
        }
        if ("rejected".equalsIgnoreCase(normalized)) {
            return isEn ? "The member has been rejected." : "회원 가입 반려 처리가 완료되었습니다.";
        }
        if ("batchRejected".equalsIgnoreCase(normalized)) {
            return isEn ? "Selected members have been rejected." : "선택한 회원 반려 처리가 완료되었습니다.";
        }
        return "";
    }

    private String resolveCompanyApprovalResultMessage(String result, boolean isEn) {
        String normalized = safeString(result);
        if (normalized.isEmpty()) {
            return "";
        }
        if ("approved".equalsIgnoreCase(normalized)) {
            return isEn ? "The company approval has been completed." : "회원사 가입 승인이 완료되었습니다.";
        }
        if ("batchApproved".equalsIgnoreCase(normalized)) {
            return isEn ? "Selected companies have been approved." : "선택한 회원사 승인이 완료되었습니다.";
        }
        if ("rejected".equalsIgnoreCase(normalized)) {
            return isEn ? "The company has been rejected." : "회원사 가입 반려 처리가 완료되었습니다.";
        }
        if ("batchRejected".equalsIgnoreCase(normalized)) {
            return isEn ? "Selected companies have been rejected." : "선택한 회원사 반려 처리가 완료되었습니다.";
        }
        return "";
    }

    private List<Map<String, String>> buildApprovalStatusOptions(boolean isEn) {
        List<Map<String, String>> options = new ArrayList<>();
        options.add(buildOption("A", isEn ? "Pending Approval" : "승인 대기"));
        options.add(buildOption("P", isEn ? "Active" : "활성"));
        options.add(buildOption("R", isEn ? "Rejected" : "반려"));
        return options;
    }

    private List<Map<String, String>> buildMemberTypeOptions(boolean isEn) {
        List<Map<String, String>> options = new ArrayList<>();
        options.add(buildOption("E", isEn ? resolveMembershipTypeLabelEn("E") : resolveMembershipTypeLabel("E")));
        options.add(buildOption("P", isEn ? resolveMembershipTypeLabelEn("P") : resolveMembershipTypeLabel("P")));
        options.add(buildOption("C", isEn ? resolveMembershipTypeLabelEn("C") : resolveMembershipTypeLabel("C")));
        options.add(buildOption("G", isEn ? resolveMembershipTypeLabelEn("G") : resolveMembershipTypeLabel("G")));
        return options;
    }

    private Map<String, String> buildOption(String code, String label) {
        Map<String, String> option = new LinkedHashMap<>();
        option.put("code", code);
        option.put("label", label);
        return option;
    }

    private String urlEncode(String value) {
        return URLEncoder.encode(safeString(value), StandardCharsets.UTF_8);
    }

    private String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }
}
