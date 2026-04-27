package egovframework.com.feature.admin.web;

import egovframework.com.platform.observability.model.LoginHistorySearchVO;
import egovframework.com.platform.observability.model.LoginHistoryVO;
import egovframework.com.platform.observability.service.AdminLoginHistoryService;
import egovframework.com.feature.auth.domain.entity.EmplyrInfo;
import egovframework.com.feature.member.model.vo.CompanyListItemVO;
import egovframework.com.feature.member.model.vo.EntrprsManageVO;
import egovframework.com.feature.member.service.EnterpriseMemberService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.ui.Model;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Collections;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminListPageModelAssembler {

    private static final Logger log = LoggerFactory.getLogger(AdminListPageModelAssembler.class);

    private final EnterpriseMemberService entrprsManageService;
    private final AdminLoginHistoryService adminLoginHistoryService;
    private final AdminListQuerySupportService adminListQuerySupportService;

    public static class LoginHistoryDataset {
        private final List<LoginHistoryVO> rows;
        private final int totalCount;
        private final String keyword;
        private final String normalizedUserSe;
        private final String normalizedLoginResult;
        private final List<Map<String, String>> companyOptions;
        private final String selectedInsttId;
        private final boolean masterAccess;

        public LoginHistoryDataset(
                List<LoginHistoryVO> rows,
                int totalCount,
                String keyword,
                String normalizedUserSe,
                String normalizedLoginResult,
                List<Map<String, String>> companyOptions,
                String selectedInsttId,
                boolean masterAccess) {
            this.rows = rows;
            this.totalCount = totalCount;
            this.keyword = keyword;
            this.normalizedUserSe = normalizedUserSe;
            this.normalizedLoginResult = normalizedLoginResult;
            this.companyOptions = companyOptions;
            this.selectedInsttId = selectedInsttId;
            this.masterAccess = masterAccess;
        }

        public List<LoginHistoryVO> getRows() { return rows; }
        public int getTotalCount() { return totalCount; }
        public String getKeyword() { return keyword; }
        public String getNormalizedUserSe() { return normalizedUserSe; }
        public String getNormalizedLoginResult() { return normalizedLoginResult; }
        public List<Map<String, String>> getCompanyOptions() { return companyOptions; }
        public String getSelectedInsttId() { return selectedInsttId; }
        public boolean isMasterAccess() { return masterAccess; }
    }

    public void populateMemberList(
            String pageIndexParam,
            String searchKeyword,
            String membershipType,
            String sbscrbSttus,
            Model model,
            HttpServletRequest request) {
        int pageIndex = parsePageIndex(pageIndexParam);
        int currentPage = Math.max(pageIndex, 1);
        int pageSize = 10;
        String currentUserId = adminListQuerySupportService.extractCurrentUserId(request);
        String currentUserAuthorCode = adminListQuerySupportService.resolveCurrentUserAuthorCode(currentUserId);
        boolean canView = adminListQuerySupportService.hasMemberManagementCompanyOperatorAccess(currentUserId, currentUserAuthorCode);
        boolean companyScopedAccess = adminListQuerySupportService.requiresMemberManagementCompanyScope(currentUserId, currentUserAuthorCode);
        String currentUserInsttId = adminListQuerySupportService.resolveCurrentUserInsttId(currentUserId);

        if (!canView) {
            model.addAttribute("member_listError", "회원 목록을 조회할 권한이 없습니다.");
            model.addAttribute("member_list", Collections.emptyList());
            model.addAttribute("totalCount", 0);
            model.addAttribute("pageIndex", 1);
            model.addAttribute("pageSize", pageSize);
            model.addAttribute("totalPages", 1);
            model.addAttribute("startPage", 1);
            model.addAttribute("endPage", 1);
            model.addAttribute("searchKeyword", adminListQuerySupportService.safeString(searchKeyword).trim());
            model.addAttribute("membershipType", adminListQuerySupportService.safeString(membershipType).trim().toUpperCase(Locale.ROOT));
            model.addAttribute("sbscrbSttus", adminListQuerySupportService.safeString(sbscrbSttus).trim());
            return;
        }

        if (companyScopedAccess && currentUserInsttId.isEmpty()) {
            model.addAttribute("member_listError", "회원사 정보가 없는 관리자 계정은 회원 목록을 조회할 수 없습니다.");
            model.addAttribute("member_list", Collections.emptyList());
            model.addAttribute("totalCount", 0);
            model.addAttribute("pageIndex", 1);
            model.addAttribute("pageSize", pageSize);
            model.addAttribute("totalPages", 1);
            model.addAttribute("startPage", 1);
            model.addAttribute("endPage", 1);
            model.addAttribute("searchKeyword", adminListQuerySupportService.safeString(searchKeyword).trim());
            model.addAttribute("membershipType", adminListQuerySupportService.safeString(membershipType).trim().toUpperCase(Locale.ROOT));
            model.addAttribute("sbscrbSttus", adminListQuerySupportService.safeString(sbscrbSttus).trim());
            return;
        }

        EntrprsManageVO searchVO = new EntrprsManageVO();
        searchVO.setPageIndex(currentPage);
        searchVO.setRecordCountPerPage(pageSize);

        String keyword = adminListQuerySupportService.safeString(searchKeyword).trim();
        searchVO.setSearchKeyword(keyword);
        searchVO.setSearchCondition("all");

        String memberType = adminListQuerySupportService.safeString(membershipType).trim().toUpperCase(Locale.ROOT);
        if (!memberType.isEmpty()) {
            String dbTypeCode = adminListQuerySupportService.normalizeMembershipCode(memberType);
            if (!dbTypeCode.isEmpty()) {
                searchVO.setEntrprsSeCode(dbTypeCode);
            }
        }

        String status = adminListQuerySupportService.safeString(sbscrbSttus).trim();
        if (!status.isEmpty()) {
            searchVO.setSbscrbSttus(status);
        }
        if (companyScopedAccess) {
            searchVO.setInsttId(currentUserInsttId);
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
            memberList = Collections.emptyList();
            totalCount = 0;
            model.addAttribute("member_listError", e.getMessage());
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

        List<Map<String, Object>> memberRows = new java.util.ArrayList<>();
        for (EntrprsManageVO member : memberList) {
            memberRows.add(toMemberListRow(member));
        }

        model.addAttribute("member_list", memberRows);
        model.addAttribute("totalCount", totalCount);
        model.addAttribute("pageIndex", currentPage);
        model.addAttribute("pageSize", pageSize);
        model.addAttribute("totalPages", totalPages);
        model.addAttribute("startPage", startPage);
        model.addAttribute("endPage", endPage);
        model.addAttribute("searchKeyword", keyword);
        model.addAttribute("membershipType", memberType);
        model.addAttribute("sbscrbSttus", status);
    }

    private Map<String, Object> toMemberListRow(EntrprsManageVO member) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("entrprsmberId", adminListQuerySupportService.safeString(member.getEntrprsmberId()));
        row.put("applcntNm", adminListQuerySupportService.safeString(member.getApplcntNm()));
        row.put("entrprsSeCode", adminListQuerySupportService.safeString(member.getEntrprsSeCode()));
        row.put("cmpnyNm", adminListQuerySupportService.safeString(member.getCmpnyNm()));
        row.put("sbscrbDe", adminListQuerySupportService.safeString(member.getSbscrbDe()));
        row.put("entrprsMberSttus", adminListQuerySupportService.safeString(member.getEntrprsMberSttus()));
        return row;
    }

    public void populateAdminMemberList(
            String pageIndexParam,
            String searchKeyword,
            String sbscrbSttus,
            Model model,
            HttpServletRequest request) {
        int pageIndex = parsePageIndex(pageIndexParam);
        int currentPage = Math.max(pageIndex, 1);
        int pageSize = 10;

        String keyword = adminListQuerySupportService.safeString(searchKeyword);
        String status = adminListQuerySupportService.safeString(sbscrbSttus).toUpperCase(Locale.ROOT);
        String currentUserId = adminListQuerySupportService.extractCurrentUserId(request);
        String currentUserAuthorCode = adminListQuerySupportService.resolveCurrentUserAuthorCode(currentUserId);
        boolean canView = adminListQuerySupportService.hasMemberManagementCompanyAdminAccess(currentUserId, currentUserAuthorCode);
        if (!canView) {
            model.addAttribute("member_listError", "관리자 목록을 조회할 권한이 없습니다.");
            model.addAttribute("member_list", Collections.emptyList());
            model.addAttribute("totalCount", 0);
            model.addAttribute("pageIndex", 1);
            model.addAttribute("pageSize", pageSize);
            model.addAttribute("totalPages", 1);
            model.addAttribute("startPage", 1);
            model.addAttribute("endPage", 1);
            model.addAttribute("searchKeyword", keyword);
            model.addAttribute("sbscrbSttus", status);
            model.addAttribute("canUseAdminListActions", false);
            return;
        }

        List<EmplyrInfo> visibleAdmins;
        try {
            visibleAdmins = adminListQuerySupportService.selectVisibleAdminMembers(currentUserId, currentUserAuthorCode, keyword, status);
        } catch (Exception e) {
            log.error("Failed to load admin member list.", e);
            model.addAttribute("member_listError", e.getMessage());
            model.addAttribute("member_list", Collections.emptyList());
            model.addAttribute("totalCount", 0);
            model.addAttribute("pageIndex", 1);
            model.addAttribute("pageSize", pageSize);
            model.addAttribute("totalPages", 1);
            model.addAttribute("startPage", 1);
            model.addAttribute("endPage", 1);
            model.addAttribute("searchKeyword", keyword);
            model.addAttribute("sbscrbSttus", status);
            model.addAttribute("canUseAdminListActions", false);
            return;
        }

        int totalCount = visibleAdmins.size();
        int totalPages = Math.max((int) Math.ceil(totalCount / (double) pageSize), 1);
        if (currentPage > totalPages) {
            currentPage = totalPages;
        }
        int fromIndex = Math.max(0, Math.min((currentPage - 1) * pageSize, totalCount));
        int toIndex = Math.max(fromIndex, Math.min(fromIndex + pageSize, totalCount));
        List<EmplyrInfo> pageItems = totalCount == 0 ? Collections.emptyList() : visibleAdmins.subList(fromIndex, toIndex);
        int startPage = Math.max(1, currentPage - 4);
        int endPage = Math.min(totalPages, startPage + 9);
        if (endPage - startPage < 9) {
            startPage = Math.max(1, endPage - 9);
        }
        int prevPage = Math.max(1, currentPage - 1);
        int nextPage = Math.min(totalPages, currentPage + 1);

        model.addAttribute("member_list", pageItems);
        model.addAttribute("totalCount", totalCount);
        model.addAttribute("pageIndex", currentPage);
        model.addAttribute("pageSize", pageSize);
        model.addAttribute("totalPages", totalPages);
        model.addAttribute("startPage", startPage);
        model.addAttribute("endPage", endPage);
        model.addAttribute("prevPage", prevPage);
        model.addAttribute("nextPage", nextPage);
        model.addAttribute("searchKeyword", keyword);
        model.addAttribute("sbscrbSttus", status);
        model.addAttribute("canUseAdminListActions", adminListQuerySupportService.canCreateAdminAccounts(currentUserId, currentUserAuthorCode));
    }

    public void populateCompanyList(
            String pageIndexParam,
            String searchKeyword,
            String sbscrbSttus,
            Model model,
            HttpServletRequest request) {
        int pageIndex = parsePageIndex(pageIndexParam);
        int currentPage = Math.max(pageIndex, 1);
        int pageSize = 10;

        String keyword = adminListQuerySupportService.safeString(searchKeyword);
        String status = adminListQuerySupportService.safeString(sbscrbSttus).toUpperCase(Locale.ROOT);
        String currentUserId = adminListQuerySupportService.extractCurrentUserId(request);
        String currentUserAuthorCode = adminListQuerySupportService.resolveCurrentUserAuthorCode(currentUserId);
        String scopedInsttId = adminListQuerySupportService.requiresOwnCompanyAccess(currentUserId, currentUserAuthorCode)
                ? adminListQuerySupportService.resolveCurrentUserInsttId(currentUserId)
                : "";

        List<CompanyListItemVO> companyList;
        int totalCount;
        try {
            Map<String, Object> searchParams = new LinkedHashMap<>();
            searchParams.put("keyword", keyword);
            searchParams.put("status", status);
            searchParams.put("insttId", scopedInsttId);
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
            log.error("Failed to load company list.", e);
            companyList = Collections.emptyList();
            totalCount = 0;
            model.addAttribute("company_listError", e.getMessage());
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
        int prevPage = Math.max(1, currentPage - 1);
        int nextPage = Math.min(totalPages, currentPage + 1);

        model.addAttribute("company_list", companyList);
        model.addAttribute("totalCount", totalCount);
        model.addAttribute("pageIndex", currentPage);
        model.addAttribute("pageSize", pageSize);
        model.addAttribute("totalPages", totalPages);
        model.addAttribute("startPage", startPage);
        model.addAttribute("endPage", endPage);
        model.addAttribute("prevPage", prevPage);
        model.addAttribute("nextPage", nextPage);
        model.addAttribute("searchKeyword", keyword);
        model.addAttribute("sbscrbSttus", status);
    }

    public void populateLoginHistory(
            String pageIndexParam,
            String searchKeyword,
            String userSe,
            String loginResult,
            String requestedInsttId,
            Model model,
            HttpServletRequest request) {
        int pageIndex = parsePageIndex(pageIndexParam);
        int currentPage = Math.max(pageIndex, 1);
        int pageSize = 10;
        String keyword = adminListQuerySupportService.safeString(searchKeyword);
        String normalizedUserSe = adminListQuerySupportService.safeString(userSe).toUpperCase(Locale.ROOT);
        String normalizedLoginResult = adminListQuerySupportService.safeString(loginResult).toUpperCase(Locale.ROOT);
        String currentUserId = adminListQuerySupportService.extractCurrentUserId(request);
        String currentUserAuthorCode = adminListQuerySupportService.resolveCurrentUserAuthorCode(currentUserId);
        boolean masterAccess = adminListQuerySupportService.hasMemberManagementMasterAccess(currentUserId, currentUserAuthorCode);
        String currentUserInsttId = adminListQuerySupportService.resolveCurrentUserInsttId(currentUserId);
        List<Map<String, String>> companyOptions = masterAccess
                ? adminListQuerySupportService.loadAccessHistoryCompanyOptions()
                : adminListQuerySupportService.buildScopedAccessHistoryCompanyOptions(currentUserInsttId);
        String selectedInsttId = masterAccess
                ? adminListQuerySupportService.resolveSelectedInsttId(requestedInsttId, companyOptions, true)
                : currentUserInsttId;

        LoginHistorySearchVO searchVO = new LoginHistorySearchVO();
        searchVO.setSearchKeyword(keyword);
        searchVO.setUserSe(normalizedUserSe);
        searchVO.setLoginResult(normalizedLoginResult);
        searchVO.setInsttId(selectedInsttId);
        searchVO.setRecordCountPerPage(pageSize);

        List<LoginHistoryVO> pageItems;
        int totalCount;
        try {
            totalCount = adminLoginHistoryService.selectLoginHistoryListTotCnt(searchVO);
            int totalPages = totalCount == 0 ? 1 : (int) Math.ceil(totalCount / (double) pageSize);
            if (currentPage > totalPages) {
                currentPage = totalPages;
            }
            searchVO.setFirstIndex((currentPage - 1) * pageSize);
            pageItems = adminLoginHistoryService.selectLoginHistoryList(searchVO);
        } catch (Exception e) {
            log.error("Failed to load login history.", e);
            totalCount = 0;
            pageItems = Collections.emptyList();
            model.addAttribute("loginHistoryError", e.getMessage());
        }

        populateLoginHistoryModel(model, currentPage, pageSize, keyword, normalizedUserSe, normalizedLoginResult,
                companyOptions, selectedInsttId, masterAccess, pageItems, totalCount);
    }

    public void populateBlockedLoginHistory(
            String pageIndexParam,
            String searchKeyword,
            String userSe,
            String requestedInsttId,
            Model model,
            HttpServletRequest request) {
        int pageIndex = parsePageIndex(pageIndexParam);
        int currentPage = Math.max(pageIndex, 1);
        int pageSize = 10;
        LoginHistoryDataset dataset = loadBlockedLoginHistoryDataset(searchKeyword, userSe, requestedInsttId, request);
        List<LoginHistoryVO> allRows = dataset.getRows();
        int totalCount = dataset.getTotalCount();
        int totalPages = totalCount == 0 ? 1 : (int) Math.ceil(totalCount / (double) pageSize);
        if (currentPage > totalPages) {
            currentPage = totalPages;
        }
        int fromIndex = Math.max(0, Math.min((currentPage - 1) * pageSize, allRows.size()));
        int toIndex = Math.max(fromIndex, Math.min(fromIndex + pageSize, allRows.size()));
        List<LoginHistoryVO> pageItems = allRows.isEmpty() ? Collections.emptyList() : new ArrayList<>(allRows.subList(fromIndex, toIndex));
        populateLoginHistoryModel(model, currentPage, pageSize, dataset.getKeyword(), dataset.getNormalizedUserSe(), dataset.getNormalizedLoginResult(),
                dataset.getCompanyOptions(), dataset.getSelectedInsttId(), dataset.isMasterAccess(), pageItems, totalCount);
    }

    public LoginHistoryDataset loadBlockedLoginHistoryDataset(
            String searchKeyword,
            String userSe,
            String requestedInsttId,
            HttpServletRequest request) {
        String keyword = adminListQuerySupportService.safeString(searchKeyword);
        String normalizedUserSe = adminListQuerySupportService.safeString(userSe).toUpperCase(Locale.ROOT);
        String normalizedLoginResult = "FAIL";
        String currentUserId = adminListQuerySupportService.extractCurrentUserId(request);
        String currentUserAuthorCode = adminListQuerySupportService.resolveCurrentUserAuthorCode(currentUserId);
        boolean masterAccess = adminListQuerySupportService.hasMemberManagementMasterAccess(currentUserId, currentUserAuthorCode);
        String currentUserInsttId = adminListQuerySupportService.resolveCurrentUserInsttId(currentUserId);
        List<Map<String, String>> companyOptions = masterAccess
                ? adminListQuerySupportService.loadAccessHistoryCompanyOptions()
                : adminListQuerySupportService.buildScopedAccessHistoryCompanyOptions(currentUserInsttId);
        String selectedInsttId = masterAccess
                ? adminListQuerySupportService.resolveSelectedInsttId(requestedInsttId, companyOptions, true)
                : currentUserInsttId;

        LoginHistorySearchVO searchVO = new LoginHistorySearchVO();
        searchVO.setSearchKeyword(keyword);
        searchVO.setUserSe(normalizedUserSe);
        searchVO.setLoginResult(normalizedLoginResult);
        searchVO.setBlockedOnly("Y");
        searchVO.setInsttId(selectedInsttId);

        List<LoginHistoryVO> rows;
        int totalCount;
        try {
            totalCount = adminLoginHistoryService.selectLoginHistoryListTotCnt(searchVO);
            if (totalCount <= 0) {
                rows = Collections.emptyList();
            } else {
                searchVO.setFirstIndex(0);
                searchVO.setRecordCountPerPage(totalCount);
                rows = adminLoginHistoryService.selectLoginHistoryList(searchVO);
            }
        } catch (Exception e) {
            log.error("Failed to load blocked login history dataset.", e);
            rows = Collections.emptyList();
            totalCount = 0;
        }
        return new LoginHistoryDataset(
                rows,
                totalCount,
                keyword,
                normalizedUserSe,
                normalizedLoginResult,
                companyOptions,
                selectedInsttId,
                masterAccess);
    }

    private void populateLoginHistoryModel(
            Model model,
            int currentPage,
            int pageSize,
            String keyword,
            String normalizedUserSe,
            String normalizedLoginResult,
            List<Map<String, String>> companyOptions,
            String selectedInsttId,
            boolean masterAccess,
            List<LoginHistoryVO> pageItems,
            int totalCount) {
        int totalPages = totalCount == 0 ? 1 : (int) Math.ceil(totalCount / (double) pageSize);
        if (currentPage > totalPages) {
            currentPage = totalPages;
        }
        int startPage = Math.max(1, currentPage - 4);
        int endPage = Math.min(totalPages, startPage + 9);
        if (endPage - startPage < 9) {
            startPage = Math.max(1, endPage - 9);
        }
        int prevPage = Math.max(1, currentPage - 1);
        int nextPage = Math.min(totalPages, currentPage + 1);

        model.addAttribute("loginHistoryList", pageItems);
        model.addAttribute("totalCount", totalCount);
        model.addAttribute("pageIndex", currentPage);
        model.addAttribute("pageSize", pageSize);
        model.addAttribute("totalPages", totalPages);
        model.addAttribute("startPage", startPage);
        model.addAttribute("endPage", endPage);
        model.addAttribute("prevPage", prevPage);
        model.addAttribute("nextPage", nextPage);
        model.addAttribute("searchKeyword", keyword);
        model.addAttribute("userSe", normalizedUserSe);
        model.addAttribute("loginResult", normalizedLoginResult);
        model.addAttribute("companyOptions", companyOptions);
        model.addAttribute("selectedInsttId", selectedInsttId);
        model.addAttribute("canManageAllCompanies", masterAccess);
    }

    private int parsePageIndex(String pageIndexParam) {
        if (pageIndexParam != null && !pageIndexParam.trim().isEmpty()) {
            try {
                return Integer.parseInt(pageIndexParam.trim());
            } catch (NumberFormatException ignored) {
                return 1;
            }
        }
        return 1;
    }
}
