package egovframework.com.feature.admin.web;

import egovframework.com.feature.admin.dto.request.AdminAdminAccountCreateRequestDTO;
import egovframework.com.feature.admin.dto.request.AdminMemberEditSaveRequestDTO;
import egovframework.com.feature.admin.dto.request.AdminMemberRegisterSaveRequestDTO;
import egovframework.com.feature.admin.dto.request.AdminPermissionSaveRequestDTO;
import egovframework.com.feature.member.dto.response.CompanySearchResponseDTO;
import egovframework.com.platform.service.observability.PlatformObservabilityHistoryPagePayloadPort;
import egovframework.com.platform.codex.service.AdminMemberPagePayloadService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.multipart.MultipartFile;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Controller
@RequestMapping({"/admin", "/en/admin"})
@RequiredArgsConstructor
public class AdminMemberController {

    private final AdminReactRouteSupport adminReactRouteSupport;
    private final AdminMemberPagePayloadService adminMemberPagePayloadService;
    private final AdminMemberSupportService adminMemberSupportService;
    private final AdminMemberRegisterCommandService adminMemberRegisterCommandService;
    private final AdminMemberEditCommandService adminMemberEditCommandService;
    private final AdminAdminPermissionCommandService adminAdminPermissionCommandService;
    private final AdminAdminAccountCreateCommandService adminAdminAccountCreateCommandService;
    private final AdminMemberPasswordResetCommandService adminMemberPasswordResetCommandService;
    private final AdminCompanyAccountCommandService adminCompanyAccountCommandService;
    private final AdminMemberFileAccessService adminMemberFileAccessService;
    private final PlatformObservabilityHistoryPagePayloadPort platformObservabilityHistoryPagePayloadPort;

    @RequestMapping(value = "/member/stats", method = { RequestMethod.GET, RequestMethod.POST })
    public String memberStatsPage(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "member-stats");
    }

    @GetMapping("/member/stats/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> memberStatsPageApi(HttpServletRequest request, Locale locale) {
        return ResponseEntity.ok(adminMemberPagePayloadService.buildMemberStatsPagePayload(request, locale));
    }

    @RequestMapping(value = "/member/register", method = { RequestMethod.GET, RequestMethod.POST })
    public String memberRegisterPage(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "member-register");
    }

    @GetMapping("/member/register/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> memberRegisterPageApi(HttpServletRequest request, Locale locale) {
        return ResponseEntity.ok(adminMemberPagePayloadService.buildMemberRegisterPagePayload(request, locale));
    }

    @GetMapping("/api/admin/member/register/check-id")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> memberRegisterCheckIdApi(
            @RequestParam(value = "memberId", required = false) String memberId,
            HttpServletRequest request,
            Locale locale) {
        return adminMemberSupportService.checkMemberId(memberId, request, locale);
    }

    @PostMapping("/api/admin/member/register")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> memberRegisterSubmitApi(
            @RequestBody AdminMemberRegisterSaveRequestDTO payload,
            HttpServletRequest request,
            Locale locale) {
        return adminMemberRegisterCommandService.submit(payload, request, locale);
    }

    @RequestMapping(value = "/member/edit", method = RequestMethod.GET)
    public String memberEditPage(@RequestParam(value = "memberId", required = false) String memberId,
                                 @RequestParam(value = "updated", required = false) String updated,
                                 HttpServletRequest request,
                                 Locale locale,
                                 Model model) {
        return forwardReactMigration(request, locale, "member-edit");
    }

    @GetMapping("/api/admin/member/edit")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> memberEditApi(@RequestParam(value = "memberId", required = false) String memberId,
                                                             @RequestParam(value = "updated", required = false) String updated,
                                                             HttpServletRequest request,
                                                             Locale locale) {
        return ResponseEntity.ok(adminMemberPagePayloadService.buildMemberEditPagePayload(memberId, updated, request, locale));
    }

    @PostMapping("/api/admin/member/edit")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> memberEditSubmitApi(@RequestBody AdminMemberEditSaveRequestDTO payload,
                                                                   HttpServletRequest request,
                                                                   Locale locale) {
        return adminMemberEditCommandService.submitApi(payload, request, locale);
    }

    @RequestMapping(value = "/member/edit", method = RequestMethod.POST)
    public String memberEditSubmit(@RequestParam(value = "memberId", required = false) String memberId,
                                   @RequestParam(value = "applcntNm", required = false) String applcntNm,
                                   @RequestParam(value = "applcntEmailAdres", required = false) String applcntEmailAdres,
                                   @RequestParam(value = "phoneNumber", required = false) String phoneNumber,
                                   @RequestParam(value = "entrprsSeCode", required = false) String entrprsSeCode,
                                   @RequestParam(value = "entrprsMberSttus", required = false) String entrprsMberSttus,
                                   @RequestParam(value = "authorCode", required = false) String authorCode,
                                   @RequestParam(value = "featureCodes", required = false) List<String> featureCodes,
                                   @RequestParam(value = "zip", required = false) String zip,
                                   @RequestParam(value = "adres", required = false) String adres,
                                   @RequestParam(value = "detailAdres", required = false) String detailAdres,
                                   @RequestParam(value = "marketingYn", required = false) String marketingYn,
                                   @RequestParam(value = "deptNm", required = false) String deptNm,
                                   HttpServletRequest request,
                                   Locale locale,
                                   Model model) {
        return adminMemberEditCommandService.submitForm(
                memberId,
                applcntNm,
                applcntEmailAdres,
                phoneNumber,
                entrprsSeCode,
                entrprsMberSttus,
                authorCode,
                featureCodes,
                zip,
                adres,
                detailAdres,
                marketingYn,
                deptNm,
                request,
                locale,
                model);
    }

    @RequestMapping(value = "/member/detail", method = RequestMethod.GET)
    public String memberDetailPage(@RequestParam(value = "memberId", required = false) String memberId,
                                   HttpServletRequest request,
                                   Locale locale,
                                   Model model) {
        return forwardReactMigration(request, locale, "member-detail");
    }

    @GetMapping("/api/admin/member/detail/page")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> memberDetailPageApi(@RequestParam(value = "memberId", required = false) String memberId,
                                                                   HttpServletRequest request,
                                                                   Locale locale) {
        Map<String, Object> response = adminMemberPagePayloadService.buildMemberDetailPagePayload(memberId, request, locale);
        boolean canView = Boolean.TRUE.equals(response.get("canViewMemberDetail"));
        String status = String.valueOf(response.getOrDefault("memberDetailStatus", ""));
        if (canView) {
            return ResponseEntity.ok(response);
        }
        return "FORBIDDEN".equalsIgnoreCase(status)
                ? ResponseEntity.status(HttpServletResponse.SC_FORBIDDEN).body(response)
                : ResponseEntity.status(HttpServletResponse.SC_NOT_FOUND).body(response);
    }

    @RequestMapping(value = "/member/reset_password", method = RequestMethod.GET)
    public String memberResetPasswordPage(@RequestParam(value = "pageIndex", required = false) String pageIndexParam,
                                          @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
                                          @RequestParam(value = "resetSource", required = false) String resetSource,
                                          @RequestParam(value = "memberId", required = false) String memberId,
                                          HttpServletRequest request,
                                          Locale locale,
                                          Model model) {
        return forwardReactMigration(request, locale, "password-reset");
    }

    @GetMapping("/api/admin/member/reset-password")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> memberResetPasswordPageApi(@RequestParam(value = "pageIndex", required = false) String pageIndexParam,
                                                                          @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
                                                                          @RequestParam(value = "resetSource", required = false) String resetSource,
                                                                          @RequestParam(value = "insttId", required = false) String insttId,
                                                                          @RequestParam(value = "memberId", required = false) String memberId,
                                                                          HttpServletRequest request,
                                                                          Locale locale) {
        return ResponseEntity.ok(adminMemberPagePayloadService.buildPasswordResetPagePayload(
                pageIndexParam,
                searchKeyword,
                resetSource,
                insttId,
                memberId,
                request,
                locale));
    }

    @RequestMapping(value = "/member/reset_password", method = RequestMethod.POST, produces = "application/json")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> resetMemberPassword(@RequestParam(value = "memberId", required = false) String memberId,
                                                                   HttpServletRequest request,
                                                                   Locale locale) {
        return adminMemberPasswordResetCommandService.reset(memberId, request, locale);
    }

    @RequestMapping(value = "/member/security", method = { RequestMethod.GET, RequestMethod.POST })
    public String memberSecurityHistoryPage(
            @RequestParam(value = "pageIndex", required = false) String pageIndexParam,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "userSe", required = false) String userSe,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return forwardReactMigration(request, locale, "member-security-history");
    }

    @GetMapping("/member/security/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> memberSecurityHistoryPageApi(
            @RequestParam(value = "pageIndex", required = false) String pageIndexParam,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "userSe", required = false) String userSe,
            @RequestParam(value = "insttId", required = false) String insttId,
            @RequestParam(value = "actionStatus", required = false) String actionStatus,
            HttpServletRequest request,
            Locale locale) {
        primeCsrfToken(request);
        return ResponseEntity.ok(platformObservabilityHistoryPagePayloadPort.buildSecurityHistoryPagePayload(
                pageIndexParam,
                searchKeyword,
                userSe,
                insttId,
                actionStatus,
                request,
                adminReactRouteSupport.isEnglishRequest(request, locale)));
    }

    @RequestMapping(value = { "/member/admin_account" }, method = RequestMethod.GET)
    public String adminAccountPage(@RequestParam(value = "emplyrId", required = false) String emplyrId,
                                   @RequestParam(value = "updated", required = false) String updated,
                                   @RequestParam(value = "mode", required = false) String mode,
                                   HttpServletRequest request,
                                   Locale locale,
                                   Model model) {
        return forwardReactMigration(request, locale,
                (emplyrId == null || emplyrId.trim().isEmpty()) ? "admin-create" : "admin-permission");
    }

    @GetMapping("/api/admin/member/admin-account/page")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> adminAccountCreatePageApi(HttpServletRequest request,
                                                                         Locale locale) {
        return ResponseEntity.ok(adminMemberPagePayloadService.buildAdminAccountCreatePagePayload(request, locale));
    }

    @GetMapping("/api/admin/member/admin-account/check-id")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> adminAccountCheckIdApi(@RequestParam(value = "adminId", required = false) String adminId,
                                                                      HttpServletRequest request,
                                                                      Locale locale) {
        return adminMemberSupportService.checkAdminAccountId(adminId, request, locale);
    }

    @GetMapping("/api/admin/companies/search")
    @ResponseBody
    public ResponseEntity<CompanySearchResponseDTO> adminCompanySearchApi(@RequestParam(value = "keyword", defaultValue = "") String keyword,
                                                                          @RequestParam(value = "page", defaultValue = "1") int page,
                                                                          @RequestParam(value = "size", defaultValue = "5") int size,
                                                                          @RequestParam(value = "status", defaultValue = "") String status,
                                                                          @RequestParam(value = "membershipType", defaultValue = "") String membershipType,
                                                                          HttpServletRequest request,
                                                                          Locale locale) {
        return adminMemberSupportService.searchCompanies(keyword, page, size, status, membershipType, request, locale);
    }

    @PostMapping("/api/admin/member/admin-account")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> adminAccountCreateSubmitApi(@RequestBody AdminAdminAccountCreateRequestDTO payload,
                                                                           HttpServletRequest request,
                                                                           Locale locale) {
        return adminAdminAccountCreateCommandService.submitApi(payload, request, locale);
    }

    @GetMapping("/api/admin/member/admin-account/permissions")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> adminAccountPermissionApi(@RequestParam(value = "emplyrId", required = false) String emplyrId,
                                                                         @RequestParam(value = "updated", required = false) String updated,
                                                                         @RequestParam(value = "mode", required = false) String mode,
                                                                         HttpServletRequest request,
                                                                         Locale locale) {
        return ResponseEntity.ok(adminMemberPagePayloadService.buildAdminAccountPermissionPagePayload(
                emplyrId,
                updated,
                mode,
                request,
                locale));
    }

    @PostMapping("/api/admin/member/admin-account/permissions")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> adminAccountPermissionsSubmitApi(@RequestBody AdminPermissionSaveRequestDTO payload,
                                                                                HttpServletRequest request,
                                                                                Locale locale) {
        return adminAdminPermissionCommandService.submitApi(payload, request, locale);
    }

    private String forwardReactMigration(HttpServletRequest request, Locale locale, String route) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, route);
    }

    private void primeCsrfToken(HttpServletRequest request) {
        if (request == null) {
            return;
        }
        Object token = request.getAttribute("_csrf");
        if (token instanceof CsrfToken) {
            ((CsrfToken) token).getToken();
        }
    }

    @RequestMapping(value = { "/member/admin_account/permissions" }, method = RequestMethod.POST)
    public String adminAccountPermissionsSubmit(@RequestParam(value = "emplyrId", required = false) String emplyrId,
                                                @RequestParam(value = "authorCode", required = false) String authorCode,
                                                @RequestParam(value = "featureCodes", required = false) List<String> featureCodes,
                                                @RequestParam(value = "language", required = false) String language,
                                                HttpServletRequest request,
                                                Locale locale,
                                                Model model) {
        return adminAdminPermissionCommandService.submitForm(
                emplyrId,
                authorCode,
                featureCodes,
                language,
                request,
                locale,
                model);
    }

    @RequestMapping(value = "/member/list", method = { RequestMethod.GET, RequestMethod.POST })
    public String memberListPage(@RequestParam(value = "pageIndex", required = false) String pageIndexParam,
                                 @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
                                 @RequestParam(value = "membershipType", required = false) String membershipType,
                                 @RequestParam(value = "sbscrbSttus", required = false) String sbscrbSttus,
                                 HttpServletRequest request,
                                 Locale locale,
                                 Model model) {
        return forwardReactMigration(request, locale, "member-list");
    }

    @RequestMapping(value = "/member/withdrawn", method = { RequestMethod.GET, RequestMethod.POST })
    public String withdrawnMemberListPage(@RequestParam(value = "pageIndex", required = false) String pageIndexParam,
                                          @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
                                          @RequestParam(value = "membershipType", required = false) String membershipType,
                                          @RequestParam(value = "sbscrbSttus", required = false) String sbscrbSttus,
                                          HttpServletRequest request,
                                          Locale locale,
                                          Model model) {
        return forwardReactMigration(request, locale, "member-list");
    }

    @RequestMapping(value = "/member/activate", method = { RequestMethod.GET, RequestMethod.POST })
    public String activateMemberListPage(@RequestParam(value = "pageIndex", required = false) String pageIndexParam,
                                         @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
                                         @RequestParam(value = "membershipType", required = false) String membershipType,
                                         @RequestParam(value = "sbscrbSttus", required = false) String sbscrbSttus,
                                         HttpServletRequest request,
                                         Locale locale,
                                         Model model) {
        return forwardReactMigration(request, locale, "member-list");
    }

    @GetMapping("/api/admin/member/list/page")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> memberListPageApi(@RequestParam(value = "pageIndex", required = false) String pageIndexParam,
                                                                 @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
                                                                 @RequestParam(value = "membershipType", required = false) String membershipType,
                                                                 @RequestParam(value = "sbscrbSttus", required = false) String sbscrbSttus,
                                                                 HttpServletRequest request,
                                                                 Locale locale) {
        return ResponseEntity.ok(adminMemberPagePayloadService.buildMemberListPagePayload(
                pageIndexParam,
                searchKeyword,
                membershipType,
                sbscrbSttus,
                request,
                locale));
    }

    @RequestMapping(value = { "/member/admin_list", "/member/admin-list" }, method = { RequestMethod.GET, RequestMethod.POST })
    public String adminListPage(@RequestParam(value = "pageIndex", required = false) String pageIndexParam,
                                @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
                                @RequestParam(value = "sbscrbSttus", required = false) String sbscrbSttus,
                                HttpServletRequest request,
                                Locale locale,
                                Model model) {
        return forwardReactMigration(request, locale, "admin-list");
    }

    @RequestMapping(value = "/member/company_list", method = { RequestMethod.GET, RequestMethod.POST })
    public String companyListPage(@RequestParam(value = "pageIndex", required = false) String pageIndexParam,
                                  @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
                                  @RequestParam(value = "sbscrbSttus", required = false) String sbscrbSttus,
                                  HttpServletRequest request,
                                  Locale locale,
                                  Model model) {
        return forwardReactMigration(request, locale, "company-list");
    }

    @GetMapping("/api/admin/member/admin-list/page")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> adminListPageApi(@RequestParam(value = "pageIndex", required = false) String pageIndexParam,
                                                                @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
                                                                @RequestParam(value = "sbscrbSttus", required = false) String sbscrbSttus,
                                                                HttpServletRequest request,
                                                                Locale locale) {
        return ResponseEntity.ok(adminMemberPagePayloadService.buildAdminListPagePayload(
                pageIndexParam,
                searchKeyword,
                sbscrbSttus,
                request,
                locale));
    }

    @GetMapping("/api/admin/member/company-list/page")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> companyListPageApi(@RequestParam(value = "pageIndex", required = false) String pageIndexParam,
                                                                  @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
                                                                  @RequestParam(value = "sbscrbSttus", required = false) String sbscrbSttus,
                                                                  HttpServletRequest request,
                                                                  Locale locale) {
        Map<String, Object> response = adminMemberPagePayloadService.buildCompanyListPagePayload(
                pageIndexParam,
                searchKeyword,
                sbscrbSttus,
                request,
                locale);
        boolean canView = Boolean.TRUE.equals(response.get("canViewCompanyList"));
        return canView ? ResponseEntity.ok(response) : ResponseEntity.status(HttpServletResponse.SC_FORBIDDEN).body(response);
    }

    @RequestMapping(value = "/member/company_detail", method = RequestMethod.GET)
    public String companyDetailPage(@RequestParam(value = "insttId", required = false) String insttId,
                                    HttpServletRequest request,
                                    Locale locale,
                                    Model model) {
        return forwardReactMigration(request, locale, "company-detail");
    }

    @GetMapping("/api/admin/member/company-detail/page")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> companyDetailPageApi(@RequestParam(value = "insttId", required = false) String insttId,
                                                                    HttpServletRequest request,
                                                                    Locale locale) {
        Map<String, Object> response = adminMemberPagePayloadService.buildCompanyDetailPagePayload(insttId, request, locale);
        if (!Boolean.TRUE.equals(response.get("canViewCompanyDetail"))) {
            return "FORBIDDEN".equals(response.get("companyDetailStatus"))
                    ? ResponseEntity.status(HttpServletResponse.SC_FORBIDDEN).body(response)
                    : ResponseEntity.status(HttpServletResponse.SC_NOT_FOUND).body(response);
        }
        return ResponseEntity.ok(response);
    }

    @RequestMapping(value = "/member/company_account", method = RequestMethod.GET)
    public String companyAccountPage(@RequestParam(value = "insttId", required = false) String insttId,
                                     @RequestParam(value = "saved", required = false) String saved,
                                     HttpServletRequest request,
                                     Locale locale,
                                     Model model) {
        return forwardReactMigration(request, locale, "company-account");
    }

    @GetMapping("/api/admin/member/company-account/page")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> companyAccountPageApi(@RequestParam(value = "insttId", required = false) String insttId,
                                                                     @RequestParam(value = "saved", required = false) String saved,
                                                                     HttpServletRequest request,
                                                                     Locale locale) {
        Map<String, Object> response = adminMemberPagePayloadService.buildCompanyAccountPagePayload(
                insttId,
                saved,
                request,
                locale);
        if (!Boolean.TRUE.equals(response.get("canViewCompanyAccount"))) {
            return ResponseEntity.status(HttpServletResponse.SC_FORBIDDEN).body(response);
        }
        return ResponseEntity.ok(response);
    }

    @PostMapping(value = "/api/admin/member/company-account", consumes = "multipart/form-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> companyAccountSubmitApi(
            @RequestParam(value = "insttId", required = false) String insttId,
            @RequestParam("membershipType") String membershipType,
            @RequestParam("agencyName") String agencyName,
            @RequestParam("representativeName") String representativeName,
            @RequestParam("bizRegistrationNumber") String bizRegistrationNumber,
            @RequestParam("zipCode") String zipCode,
            @RequestParam("companyAddress") String companyAddress,
            @RequestParam(value = "companyAddressDetail", required = false) String companyAddressDetail,
            @RequestParam("chargerName") String chargerName,
            @RequestParam("chargerEmail") String chargerEmail,
            @RequestParam("chargerTel") String chargerTel,
            @RequestParam(value = "fileUploads", required = false) List<MultipartFile> fileUploads,
            HttpServletRequest request,
            Locale locale) {
        return adminCompanyAccountCommandService.submitApi(
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
                request,
                locale);
    }

    @RequestMapping(value = "/member/company_account", method = RequestMethod.POST, params = "agencyName")
    public String companyAccountSubmit(
            @RequestParam(value = "insttId", required = false) String insttId,
            @RequestParam("membershipType") String membershipType,
            @RequestParam("agencyName") String agencyName,
            @RequestParam("representativeName") String representativeName,
            @RequestParam("bizRegistrationNumber") String bizRegistrationNumber,
            @RequestParam("zipCode") String zipCode,
            @RequestParam("companyAddress") String companyAddress,
            @RequestParam(value = "companyAddressDetail", required = false) String companyAddressDetail,
            @RequestParam("chargerName") String chargerName,
            @RequestParam("chargerEmail") String chargerEmail,
            @RequestParam("chargerTel") String chargerTel,
            @RequestParam(value = "fileUploads", required = false) List<MultipartFile> fileUploads,
            HttpServletRequest request,
            HttpSession session,
            Locale locale,
            Model model) {
        return adminCompanyAccountCommandService.submitForm(
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
                request,
                locale,
                model);
    }

    @RequestMapping(value = "/member/company-file", method = RequestMethod.GET)
    public void companyFile(@RequestParam(value = "fileId", required = false) String fileId,
                            @RequestParam(value = "download", required = false) String download,
                            HttpServletRequest request,
                            HttpServletResponse response) throws Exception {
        adminMemberFileAccessService.serveCompanyFile(fileId, download, request, response);
    }

    @RequestMapping(value = "/member/file", method = RequestMethod.GET)
    public void memberFile(@RequestParam(value = "fileId", required = false) String fileId,
                           @RequestParam(value = "download", required = false) String download,
                           HttpServletRequest request,
                           HttpServletResponse response) throws Exception {
        adminMemberFileAccessService.serveMemberFile(fileId, download, request, response);
    }
}
