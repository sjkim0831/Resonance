package egovframework.com.feature.admin.web;

import egovframework.com.feature.admin.dto.request.AdminAuthChangeSaveRequestDTO;
import egovframework.com.feature.admin.dto.request.AdminAuthGroupCreateRequestDTO;
import egovframework.com.feature.admin.dto.request.AdminAuthGroupFeatureSaveRequestDTO;
import egovframework.com.feature.admin.dto.request.AdminAuthorRoleProfileSaveRequestDTO;
import egovframework.com.feature.admin.dto.request.AdminDeptRoleMappingSaveRequestDTO;
import egovframework.com.feature.admin.dto.request.AdminDeptRoleMemberSaveRequestDTO;
import egovframework.com.platform.codex.service.AdminAuthorityPagePayloadService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Controller
@RequestMapping({"/admin", "/en/admin"})
@RequiredArgsConstructor
public class AdminAuthorityController {

    private final AdminReactRouteSupport adminReactRouteSupport;
    private final AdminAuthorityPagePayloadService adminAuthorityPagePayloadService;
    private final AdminAuthorityApiCommandService adminAuthorityApiCommandService;
    private final AdminAuthorityFormCommandService adminAuthorityFormCommandService;

    @RequestMapping(value = { "/member/auth-group", "/auth/group", "/system/role" }, method = RequestMethod.GET)
    public String authGroupPage(
            @RequestParam(value = "authorCode", required = false) String authorCode,
            @RequestParam(value = "roleCategory", required = false) String roleCategory,
            @RequestParam(value = "insttId", required = false) String insttId,
            @RequestParam(value = "userSearchKeyword", required = false) String userSearchKeyword,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "auth-group");
    }

    @GetMapping("/api/admin/auth-groups/page")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> authGroupPageApi(
            @RequestParam(value = "authorCode", required = false) String authorCode,
            @RequestParam(value = "roleCategory", required = false) String roleCategory,
            @RequestParam(value = "insttId", required = false) String insttId,
            @RequestParam(value = "menuCode", required = false) String menuCode,
            @RequestParam(value = "featureCode", required = false) String featureCode,
            @RequestParam(value = "userSearchKeyword", required = false) String userSearchKeyword,
            HttpServletRequest request,
            Locale locale) {
        return ResponseEntity.ok(adminAuthorityPagePayloadService.buildAuthGroupPagePayload(
                authorCode,
                roleCategory,
                insttId,
                menuCode,
                featureCode,
                userSearchKeyword,
                request,
                locale));
    }

    @PostMapping("/api/admin/auth-groups/profile-save")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveAuthGroupProfileApi(
            @RequestBody AdminAuthorRoleProfileSaveRequestDTO payload,
            HttpServletRequest request,
            Locale locale) {
        return adminAuthorityApiCommandService.saveAuthGroupProfile(payload, request, locale);
    }

    @PostMapping("/api/admin/auth-groups")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> createAuthGroupApi(
            @RequestBody AdminAuthGroupCreateRequestDTO payload,
            HttpServletRequest request,
            Locale locale) {
        return adminAuthorityApiCommandService.createAuthGroup(payload, request, locale);
    }

    @PostMapping("/api/admin/auth-groups/features")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveAuthGroupFeaturesApi(
            @RequestBody AdminAuthGroupFeatureSaveRequestDTO payload,
            HttpServletRequest request,
            Locale locale) {
        return adminAuthorityApiCommandService.saveAuthGroupFeatures(payload, request, locale);
    }

    @RequestMapping(value = { "/member/auth-change", "/system/auth-change" }, method = RequestMethod.GET)
    public String authChangePage(
            @RequestParam(value = "updated", required = false) String updated,
            @RequestParam(value = "targetUserId", required = false) String targetUserId,
            @RequestParam(value = "error", required = false) String error,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "auth-change");
    }

    @GetMapping("/api/admin/auth-change/page")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> authChangePageApi(
            @RequestParam(value = "updated", required = false) String updated,
            @RequestParam(value = "targetUserId", required = false) String targetUserId,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "pageIndex", required = false) Integer pageIndex,
            @RequestParam(value = "error", required = false) String error,
            HttpServletRequest request,
            Locale locale) {
        return ResponseEntity.ok(adminAuthorityPagePayloadService.buildAuthChangePagePayload(
                updated,
                targetUserId,
                searchKeyword,
                pageIndex,
                error,
                request,
                locale));
    }

    @GetMapping("/api/admin/auth-change/history")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> authChangeHistoryApi(
            HttpServletRequest request,
            Locale locale) {
        return ResponseEntity.ok(adminAuthorityPagePayloadService.buildAuthChangeHistoryPayload(request, locale));
    }

    @PostMapping("/api/admin/auth-change/save")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveAuthChangeApi(
            @RequestBody AdminAuthChangeSaveRequestDTO payload,
            HttpServletRequest request,
            Locale locale) {
        return adminAuthorityApiCommandService.saveAuthChange(payload, request, locale);
    }

    @RequestMapping(value = { "/member/dept-role-mapping", "/system/dept-role-mapping" }, method = RequestMethod.GET)
    public String deptRolePage(
            @RequestParam(value = "updated", required = false) String updated,
            @RequestParam(value = "insttId", required = false) String insttId,
            @RequestParam(value = "error", required = false) String error,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "dept-role");
    }

    @GetMapping("/api/admin/dept-role-mapping/page")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> deptRoleMappingPageApi(
            @RequestParam(value = "updated", required = false) String updated,
            @RequestParam(value = "insttId", required = false) String insttId,
            @RequestParam(value = "memberSearchKeyword", required = false) String memberSearchKeyword,
            @RequestParam(value = "memberPageIndex", required = false) Integer memberPageIndex,
            @RequestParam(value = "error", required = false) String error,
            HttpServletRequest request,
            Locale locale) {
        return ResponseEntity.ok(adminAuthorityPagePayloadService.buildDeptRolePagePayload(
                updated,
                insttId,
                memberSearchKeyword,
                memberPageIndex,
                error,
                request,
                locale));
    }

    @PostMapping("/api/admin/dept-role-mapping/save")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveDeptRoleMappingApi(
            @RequestBody AdminDeptRoleMappingSaveRequestDTO payload,
            HttpServletRequest request,
            Locale locale) {
        return adminAuthorityApiCommandService.saveDeptRoleMapping(payload, request, locale);
    }

    @PostMapping("/api/admin/dept-role-mapping/member-save")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveDeptRoleMemberApi(
            @RequestBody AdminDeptRoleMemberSaveRequestDTO payload,
            HttpServletRequest request,
            Locale locale) {
        return adminAuthorityApiCommandService.saveDeptRoleMember(payload, request, locale);
    }

    @RequestMapping(value = { "/member/auth-change/save", "/system/auth-change/save" }, method = RequestMethod.POST)
    public String saveAuthChange(
            @RequestParam(value = "emplyrId", required = false) String emplyrId,
            @RequestParam(value = "authorCode", required = false) String authorCode,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return adminAuthorityFormCommandService.saveAuthChange(emplyrId, authorCode, request, locale, model);
    }

    @RequestMapping(value = { "/member/dept-role-mapping/save", "/system/dept-role-mapping/save" }, method = RequestMethod.POST)
    public String saveDeptRoleMapping(
            @RequestParam(value = "insttId", required = false) String insttId,
            @RequestParam(value = "cmpnyNm", required = false) String cmpnyNm,
            @RequestParam(value = "deptNm", required = false) String deptNm,
            @RequestParam(value = "authorCode", required = false) String authorCode,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return adminAuthorityFormCommandService.saveDeptRoleMapping(insttId, cmpnyNm, deptNm, authorCode, request, locale, model);
    }

    @RequestMapping(value = { "/member/dept-role-mapping/member-save", "/system/dept-role-mapping/member-save" }, method = RequestMethod.POST)
    public String saveDeptRoleMember(
            @RequestParam(value = "insttId", required = false) String insttId,
            @RequestParam(value = "entrprsMberId", required = false) String entrprsMberId,
            @RequestParam(value = "authorCode", required = false) String authorCode,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return adminAuthorityFormCommandService.saveDeptRoleMember(insttId, entrprsMberId, authorCode, request, locale, model);
    }

    @RequestMapping(value = { "/member/auth-group/create", "/auth/group/create", "/system/role/create" }, method = RequestMethod.POST)
    public String createAuthGroup(
            @RequestParam(value = "authorCode", required = false) String authorCode,
            @RequestParam(value = "authorNm", required = false) String authorNm,
            @RequestParam(value = "authorDc", required = false) String authorDc,
            @RequestParam(value = "roleCategory", required = false) String roleCategory,
            @RequestParam(value = "insttId", required = false) String insttId,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return adminAuthorityFormCommandService.createAuthGroup(authorCode, authorNm, authorDc, roleCategory, insttId, request, locale, model);
    }

    @RequestMapping(value = { "/member/auth-group/save-features", "/auth/group/save-features", "/system/role/save-features" }, method = RequestMethod.POST)
    public String saveAuthGroupFeatures(
            @RequestParam(value = "authorCode", required = false) String authorCode,
            @RequestParam(value = "featureCodes", required = false) List<String> featureCodes,
            @RequestParam(value = "roleCategory", required = false) String roleCategory,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return adminAuthorityFormCommandService.saveAuthGroupFeatures(authorCode, featureCodes, roleCategory, request, locale, model);
    }
}
