package egovframework.com.feature.admin.web;

import egovframework.com.platform.codex.service.AdminAuthorityPagePayloadSupport;

import egovframework.com.feature.admin.dto.request.AdminAuthChangeSaveRequestDTO;
import egovframework.com.feature.admin.dto.request.AdminAuthGroupCreateRequestDTO;
import egovframework.com.feature.admin.dto.request.AdminAuthGroupFeatureSaveRequestDTO;
import egovframework.com.feature.admin.dto.request.AdminAuthorRoleProfileSaveRequestDTO;
import egovframework.com.feature.admin.dto.request.AdminDeptRoleMappingSaveRequestDTO;
import egovframework.com.feature.admin.dto.request.AdminDeptRoleMemberSaveRequestDTO;
import egovframework.com.platform.codex.model.AuthorInfoVO;
import egovframework.com.platform.governance.model.vo.AuthorRoleProfileVO;
import egovframework.com.platform.codex.model.DepartmentRoleMappingVO;
import egovframework.com.platform.codex.model.UserAuthorityTargetVO;
import egovframework.com.platform.governance.service.AuthorRoleProfileService;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.platform.dbchange.model.DbChangeCaptureRequest;
import egovframework.com.platform.dbchange.service.DbChangeCaptureService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AdminAuthorityCommandService {

    private static final Logger log = LoggerFactory.getLogger(AdminAuthorityCommandService.class);

    private final AdminReactRouteSupport adminReactRouteSupport;
    private final AuthGroupManageService authGroupManageService;
    private final AuthorRoleProfileService authorRoleProfileService;
    private final AdminAuthorityPagePayloadSupport adminAuthorityPagePayloadSupport;
    private final CurrentUserContextService currentUserContextService;
    private final AdminCompanyScopeService adminCompanyScopeService;
    private final AdminRoleAssignmentDbChangeCaptureSupport adminRoleAssignmentDbChangeCaptureSupport;
    private final DbChangeCaptureService dbChangeCaptureService;
    private final ObjectMapper objectMapper;

    public CommandResult saveAuthGroupProfile(AdminAuthorRoleProfileSaveRequestDTO payload, HttpServletRequest request, Locale locale) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(request, locale);
        CurrentUserContextService.CurrentUserContext context = currentUserContextService.resolve(request);
        boolean ownCompanyAccess = "own-company".equals(context.getCompanyScope()) || "role-scoped".equals(context.getCompanyScope());
        String selectedRoleCategory = adminAuthorityPagePayloadSupport.resolveRoleCategory(payload == null ? null : payload.getRoleCategory());
        String scopedInsttId = ownCompanyAccess ? context.getInsttId() : "";
        String normalizedAuthorCode = safeString(payload == null ? null : payload.getAuthorCode()).toUpperCase(Locale.ROOT);

        if (!context.isWebmaster() && !ownCompanyAccess) {
            return forbidden(isEn
                    ? "Only webmaster or company-scoped administrators can update role profiles."
                    : "webmaster 또는 회사 범위 관리자만 권한 그룹 프로필을 수정할 수 있습니다.");
        }
        if (normalizedAuthorCode.isEmpty()) {
            return badRequest(isEn ? "Role code is required." : "Role 코드를 확인해 주세요.");
        }
        if (!adminAuthorityPagePayloadSupport.canAssignAuthorCode(context.getUserId(), context.getAuthorCode(), normalizedAuthorCode)) {
            return forbidden(isEn
                    ? "You can only update role profiles lower than your own authority."
                    : "본인 권한보다 낮은 권한 그룹 프로필만 수정할 수 있습니다.");
        }
        if (!context.isWebmaster()) {
            if ("GENERAL".equals(selectedRoleCategory)) {
                return forbidden(isEn
                        ? "Company-scoped administrators can only update department or user role profiles."
                        : "회사 범위 관리자는 부서/사용자 권한 그룹 프로필만 수정할 수 있습니다.");
            }
            if (!isCompanyScopedAuthorCodeForInstt(normalizedAuthorCode, selectedRoleCategory, scopedInsttId)) {
                return forbidden(isEn
                        ? "You can only update role profiles created for your own company."
                        : "본인 회사에 속한 권한 그룹 프로필만 수정할 수 있습니다.");
            }
        }

        try {
            AuthorRoleProfileVO profile = new AuthorRoleProfileVO();
            profile.setAuthorCode(normalizedAuthorCode);
            profile.setDisplayTitle(safeString(payload == null ? null : payload.getDisplayTitle()));
            profile.setPriorityWorks(payload == null ? Collections.emptyList() : payload.getPriorityWorks());
            profile.setDescription(safeString(payload == null ? null : payload.getDescription()));
            profile.setMemberEditVisibleYn(safeString(payload == null ? null : payload.getMemberEditVisibleYn()));
            profile.setRoleType(safeString(payload == null ? null : payload.getRoleType()));
            profile.setBaseRoleYn(safeString(payload == null ? null : payload.getBaseRoleYn()));
            profile.setParentAuthorCode(safeString(payload == null ? null : payload.getParentAuthorCode()));
            profile.setAssignmentScope(safeString(payload == null ? null : payload.getAssignmentScope()));
            profile.setDefaultMemberTypes(payload == null ? Collections.emptyList() : payload.getDefaultMemberTypes());
            AuthorRoleProfileVO saved = authorRoleProfileService.saveProfile(profile);
            Map<String, Object> data = successBody();
            data.put("authorCode", normalizedAuthorCode);
            data.put("savedProfile", saved);
            return ok(data);
        } catch (IllegalArgumentException e) {
            return badRequest(e.getMessage());
        } catch (Exception e) {
            return serverError(isEn ? "Failed to save the role profile." : "권한 그룹 프로필 저장에 실패했습니다.");
        }
    }

    public CommandResult createAuthGroup(AdminAuthGroupCreateRequestDTO payload, HttpServletRequest request, Locale locale) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(request, locale);
        CurrentUserContextService.CurrentUserContext context = currentUserContextService.resolve(request);
        boolean ownCompanyAccess = "own-company".equals(context.getCompanyScope()) || "role-scoped".equals(context.getCompanyScope());
        String selectedRoleCategory = adminAuthorityPagePayloadSupport.resolveRoleCategory(payload == null ? null : payload.getRoleCategory());

        if (!context.isWebmaster() && !ownCompanyAccess) {
            return forbidden(isEn
                    ? "Only webmaster or company-scoped administrators can create authority groups."
                    : "webmaster 또는 회사 범위 관리자가 권한 그룹을 추가할 수 있습니다.");
        }
        if (!context.isWebmaster() && "GENERAL".equals(selectedRoleCategory)) {
            return forbidden(isEn
                    ? "Company-scoped administrators can only create department or user roles."
                    : "회사 범위 관리자는 부서/사용자 권한 그룹만 생성할 수 있습니다.");
        }

        String requestedInsttId = safeString(payload == null ? null : payload.getInsttId());
        String scopedInsttId = ownCompanyAccess ? context.getInsttId() : requestedInsttId;
        boolean forceScoped = ownCompanyAccess
                || (!requestedInsttId.isEmpty() && ("DEPARTMENT".equals(selectedRoleCategory) || "USER".equals(selectedRoleCategory)));
        String normalizedCode = normalizeScopedAuthorCode(payload == null ? null : payload.getAuthorCode(), selectedRoleCategory, scopedInsttId, forceScoped);
        String normalizedName = safeString(payload == null ? null : payload.getAuthorNm());
        String normalizedDesc = safeString(payload == null ? null : payload.getAuthorDc());
        if (normalizedCode.isEmpty() || normalizedName.isEmpty()) {
            return badRequest(isEn ? "Role code and role name are required." : "Role 코드와 Role 명은 필수입니다.");
        }
        if (!adminAuthorityPagePayloadSupport.canAssignAuthorCode(context.getUserId(), context.getAuthorCode(), normalizedCode)) {
            return forbidden(isEn
                    ? "You can only create authority groups lower than your own authority."
                    : "본인 권한보다 낮은 권한 그룹만 생성할 수 있습니다.");
        }

        try {
            if (authGroupManageService.countAuthorCode(normalizedCode) > 0) {
                return badRequest(isEn ? "The role code already exists." : "이미 존재하는 Role 코드입니다.");
            }
            authGroupManageService.insertAuthor(normalizedCode, normalizedName, normalizedDesc);
            recordAuthorGroupDbChange(request, context, normalizedCode, "INSERT", null, authGroupManageService.selectAuthor(normalizedCode));
            Map<String, Object> data = successBody();
            data.put("authorCode", normalizedCode);
            data.put("roleCategory", selectedRoleCategory);
            data.put("insttId", scopedInsttId);
            return ok(data);
        } catch (Exception e) {
            return serverError(isEn ? "Failed to create the role group." : "권한 그룹 추가에 실패했습니다.");
        }
    }

    public CommandResult saveAuthGroupFeatures(AdminAuthGroupFeatureSaveRequestDTO payload, HttpServletRequest request, Locale locale) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(request, locale);
        CurrentUserContextService.CurrentUserContext context = currentUserContextService.resolve(request);
        boolean ownCompanyAccess = "own-company".equals(context.getCompanyScope()) || "role-scoped".equals(context.getCompanyScope());
        String selectedRoleCategory = adminAuthorityPagePayloadSupport.resolveRoleCategory(payload == null ? null : payload.getRoleCategory());
        String scopedInsttId = ownCompanyAccess ? context.getInsttId() : "";

        if (!context.isWebmaster() && !ownCompanyAccess) {
            return forbidden(isEn
                    ? "Only webmaster or company-scoped administrators can update role-feature mappings."
                    : "webmaster 또는 회사 범위 관리자만 Role-기능 매핑을 수정할 수 있습니다.");
        }

        String normalizedAuthorCode = safeString(payload == null ? null : payload.getAuthorCode()).toUpperCase(Locale.ROOT);
        if (normalizedAuthorCode.isEmpty()) {
            return badRequest(isEn ? "Role code is required." : "Role 코드를 확인해 주세요.");
        }
        if (!adminAuthorityPagePayloadSupport.canAssignAuthorCode(context.getUserId(), context.getAuthorCode(), normalizedAuthorCode)) {
            return forbidden(isEn
                    ? "You can only update authority groups lower than your own authority."
                    : "본인 권한보다 낮은 권한 그룹만 수정할 수 있습니다.");
        }
        if (!context.isWebmaster()) {
            if ("GENERAL".equals(selectedRoleCategory)) {
                return forbidden(isEn
                        ? "Company-scoped administrators can only update department or user roles."
                        : "회사 범위 관리자는 부서/사용자 권한 그룹만 수정할 수 있습니다.");
            }
            if (!isCompanyScopedAuthorCodeForInstt(normalizedAuthorCode, selectedRoleCategory, scopedInsttId)) {
                return forbidden(isEn
                        ? "You can only update role groups created for your own company."
                        : "본인 회사에 속한 권한 그룹만 수정할 수 있습니다.");
            }
        }

        try {
            Set<String> grantableFeatureCodes = adminAuthorityPagePayloadSupport.resolveGrantableFeatureCodeSet(
                    context.getUserId(),
                    context.isWebmaster());
            List<String> beforeFeatureCodes = authGroupManageService.selectAuthorFeatureCodes(normalizedAuthorCode);
            authGroupManageService.saveAuthorFeatureRelations(
                    normalizedAuthorCode,
                    mergeRoleFeatureSelection(
                            normalizedAuthorCode,
                            payload == null ? Collections.emptyList() : payload.getFeatureCodes(),
                            grantableFeatureCodes));
            List<String> savedFeatureCodes = adminAuthorityPagePayloadSupport.filterFeatureCodesByGrantable(
                    payload == null ? Collections.emptyList() : payload.getFeatureCodes(),
                    grantableFeatureCodes);
            recordAuthorFeatureRelationDbChange(
                    request,
                    context,
                    normalizedAuthorCode,
                    beforeFeatureCodes,
                    authGroupManageService.selectAuthorFeatureCodes(normalizedAuthorCode));
            Map<String, Object> data = successBody();
            data.put("authorCode", normalizedAuthorCode);
            data.put("featureCount", savedFeatureCodes.size());
            data.put("savedFeatureCodes", savedFeatureCodes);
            return ok(data);
        } catch (Exception e) {
            return serverError(isEn ? "Failed to save role-feature mappings." : "Role-기능 매핑 저장에 실패했습니다.");
        }
    }

    public CommandResult saveAuthChange(AdminAuthChangeSaveRequestDTO payload, HttpServletRequest request, Locale locale) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(request, locale);
        CurrentUserContextService.CurrentUserContext context = currentUserContextService.resolve(request);
        AdminCompanyScopeService.CompanyScope companyScope = adminCompanyScopeService.resolve(context.getUserId());
        boolean masterAccess = context.isWebmaster() || companyScope.canManageMemberScopeAllCompanies();
        boolean companyAccess = companyScope.canManageMemberScope();
        if (!masterAccess && !companyAccess) {
            return forbidden(isEn
                    ? "You do not have permission to change administrator roles."
                    : "관리자 권한을 변경할 권한이 없습니다.");
        }

        String normalizedEmplyrId = safeString(payload == null ? null : payload.getEmplyrId());
        String normalizedAuthorCode = safeString(payload == null ? null : payload.getAuthorCode()).toUpperCase(Locale.ROOT);
        if (normalizedEmplyrId.isEmpty() || normalizedAuthorCode.isEmpty()) {
            return badRequest(isEn
                    ? "Administrator ID and role are required."
                    : "관리자 ID와 권한 그룹을 확인해 주세요.");
        }
        if ("webmaster".equalsIgnoreCase(normalizedEmplyrId) && !"ROLE_SYSTEM_MASTER".equalsIgnoreCase(normalizedAuthorCode)) {
            return badRequest(isEn
                    ? "webmaster must keep ROLE_SYSTEM_MASTER."
                    : "webmaster 계정은 ROLE_SYSTEM_MASTER만 유지할 수 있습니다.");
        }

        try {
            if (!adminCompanyScopeService.canExecuteScopedQuery(companyScope, false)) {
                return forbidden(isEn
                        ? "The current administrator is not bound to a company."
                        : "현재 관리자 계정에 소속 회원사가 없습니다.");
            }
            String actorInsttId = adminCompanyScopeService.resolveScopedInsttIdForQuery(companyScope, "", false);
            String targetInsttId = safeString(authGroupManageService.selectAdminInsttIdByUserId(normalizedEmplyrId));
            if (!masterAccess && (!actorInsttId.equals(targetInsttId) || targetInsttId.isEmpty())) {
                return forbidden(isEn
                        ? "You can only change administrator roles within your own company."
                        : "본인 회사 소속 관리자 권한만 변경할 수 있습니다.");
            }
            String currentAssignedAuthorCode = safeString(authGroupManageService.selectAuthorCodeByUserId(normalizedEmplyrId))
                    .toUpperCase(Locale.ROOT);
            List<AuthorInfoVO> generalAuthorGroups = adminAuthorityPagePayloadSupport.filterAuthorGroups(
                    authGroupManageService.selectAuthorList(),
                    "GENERAL",
                    context.getUserId(),
                    context.getAuthorCode());
            if (!adminAuthorityPagePayloadSupport.isGrantableOrCurrentAuthorCode(
                    generalAuthorGroups,
                    normalizedAuthorCode,
                    currentAssignedAuthorCode)) {
                return badRequest(isEn
                        ? "Only valid general administrator roles can be assigned here."
                        : "이 화면에서는 유효한 일반 관리자 권한 그룹만 지정할 수 있습니다.");
            }
            Map<String, String> beforeRole = adminAuthorityPagePayloadSupport.resolveAdminRoleSummary(normalizedEmplyrId);
            authGroupManageService.updateAdminRoleAssignment(normalizedEmplyrId, normalizedAuthorCode);
            adminRoleAssignmentDbChangeCaptureSupport.captureAdminRoleAssignment(
                    request,
                    context.getUserId(),
                    context.getAuthorCode(),
                    context.getInsttId(),
                    normalizedEmplyrId,
                    beforeRole,
                    adminAuthorityPagePayloadSupport.buildAuthorSummary(normalizedAuthorCode),
                    "AMENU_AUTH_CHANGE",
                    "auth-change");
            Map<String, Object> data = successBody();
            data.put("emplyrId", normalizedEmplyrId);
            data.put("authorCode", normalizedAuthorCode);
            data.put("beforeRole", beforeRole);
            data.put("afterRole", adminAuthorityPagePayloadSupport.buildAuthorSummary(normalizedAuthorCode));
            return ok(data);
        } catch (IllegalArgumentException e) {
            return badRequest(e.getMessage());
        } catch (Exception e) {
            return serverError(isEn
                    ? "Failed to save administrator role assignment."
                    : "관리자 권한 변경 저장에 실패했습니다.");
        }
    }

    public CommandResult saveDeptRoleMapping(AdminDeptRoleMappingSaveRequestDTO payload, HttpServletRequest request, Locale locale) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(request, locale);
        CurrentUserContextService.CurrentUserContext context = currentUserContextService.resolve(request);
        AdminCompanyScopeService.CompanyScope companyScope = adminCompanyScopeService.resolve(context.getUserId());
        boolean globalDeptRoleAccess = companyScope.canManageAllCompanies();
        boolean ownCompanyDeptRoleAccess = companyScope.canManageOwnCompany();
        if (!globalDeptRoleAccess && !ownCompanyDeptRoleAccess) {
            return forbidden(isEn
                    ? "You do not have permission to change department role mappings."
                    : "부서 권한 맵핑을 변경할 권한이 없습니다.");
        }

        String normalizedInsttId = adminCompanyScopeService.resolveScopedInsttIdForQuery(
                companyScope,
                payload == null ? null : payload.getInsttId(),
                false);
        String normalizedCmpnyNm = safeString(payload == null ? null : payload.getCmpnyNm());
        String normalizedDeptNm = safeString(payload == null ? null : payload.getDeptNm());
        String normalizedAuthorCode = safeString(payload == null ? null : payload.getAuthorCode()).toUpperCase(Locale.ROOT);
        if (normalizedInsttId.isEmpty() || normalizedDeptNm.isEmpty() || normalizedAuthorCode.isEmpty()) {
            return badRequest(isEn
                    ? "Company ID, department, and role are required."
                    : "회사 ID, 부서명, 권한 그룹을 확인해 주세요.");
        }
        if (!adminCompanyScopeService.canExecuteScopedQuery(companyScope, false)) {
            return forbidden(isEn
                    ? "The current administrator is not bound to a company."
                    : "현재 관리자 계정에 소속 회원사가 없습니다.");
        }
        if (!globalDeptRoleAccess && !normalizedInsttId.equals(companyScope.getInsttId())) {
            return forbidden(isEn
                    ? "You can only change department role mappings for your own company."
                    : "본인 회사의 부서 권한 맵핑만 변경할 수 있습니다.");
        }
        if (!adminAuthorityPagePayloadSupport.canAssignDepartmentAuthorCode(normalizedAuthorCode, normalizedInsttId, globalDeptRoleAccess)) {
            return badRequest(isEn
                    ? "You can only assign department roles allowed for the selected company."
                    : "선택한 회사에서 허용된 부서 권한만 지정할 수 있습니다.");
        }

        try {
            DepartmentRoleMappingVO beforeMapping = authGroupManageService.selectDepartmentRoleMapping(normalizedInsttId, normalizedDeptNm);
            authGroupManageService.saveDepartmentRoleMapping(
                    normalizedInsttId,
                    normalizedCmpnyNm,
                    normalizedDeptNm,
                    normalizedAuthorCode,
                    context.getUserId());
            recordDepartmentRoleMappingDbChange(
                    request,
                    context,
                    normalizedInsttId,
                    normalizedDeptNm,
                    beforeMapping,
                    authGroupManageService.selectDepartmentRoleMapping(normalizedInsttId, normalizedDeptNm));
            Map<String, Object> data = successBody();
            data.put("insttId", normalizedInsttId);
            data.put("deptNm", normalizedDeptNm);
            data.put("authorCode", normalizedAuthorCode);
            return ok(data);
        } catch (IllegalArgumentException e) {
            return badRequest(e.getMessage());
        } catch (Exception e) {
            return serverError(isEn
                    ? "Failed to save department role mapping."
                    : "부서 권한 맵핑 저장에 실패했습니다.");
        }
    }

    public CommandResult saveDeptRoleMember(AdminDeptRoleMemberSaveRequestDTO payload, HttpServletRequest request, Locale locale) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(request, locale);
        CurrentUserContextService.CurrentUserContext context = currentUserContextService.resolve(request);
        AdminCompanyScopeService.CompanyScope companyScope = adminCompanyScopeService.resolve(context.getUserId());
        boolean globalDeptRoleAccess = companyScope.canManageAllCompanies();
        boolean ownCompanyDeptRoleAccess = companyScope.canManageOwnCompany();

        String normalizedInsttId = adminCompanyScopeService.resolveScopedInsttIdForQuery(
                companyScope,
                payload == null ? null : payload.getInsttId(),
                false);
        String normalizedEntrprsMberId = safeString(payload == null ? null : payload.getEntrprsMberId());
        String normalizedAuthorCode = safeString(payload == null ? null : payload.getAuthorCode()).toUpperCase(Locale.ROOT);
        if (normalizedInsttId.isEmpty() || normalizedEntrprsMberId.isEmpty() || normalizedAuthorCode.isEmpty()) {
            return badRequest(isEn
                    ? "Company, member, and role are required."
                    : "회사, 회원, 권한 그룹을 확인해 주세요.");
        }

        try {
            if (!adminCompanyScopeService.canExecuteScopedQuery(companyScope, false)) {
                return forbidden(isEn
                        ? "The current administrator is not bound to a company."
                        : "현재 관리자 계정에 소속 회원사가 없습니다.");
            }
            String targetInsttId = safeString(authGroupManageService.selectEnterpriseInsttIdByUserId(normalizedEntrprsMberId));
            if (!globalDeptRoleAccess && ownCompanyDeptRoleAccess && !normalizedInsttId.equals(companyScope.getInsttId())) {
                return forbidden(isEn
                        ? "You can only update members in your own company."
                        : "본인 회사 소속 회원만 수정할 수 있습니다.");
            }
            if (!globalDeptRoleAccess && !ownCompanyDeptRoleAccess) {
                return forbidden(isEn
                        ? "You do not have permission to update company member roles."
                        : "회사 회원 권한을 변경할 권한이 없습니다.");
            }
            if (!targetInsttId.isEmpty() && !normalizedInsttId.equals(targetInsttId)) {
                return badRequest(isEn
                        ? "Selected company and member company do not match."
                        : "선택한 회사와 회원 소속 회사가 일치하지 않습니다.");
            }
            if (!adminAuthorityPagePayloadSupport.canAssignMemberAuthorCode(normalizedAuthorCode, normalizedInsttId, globalDeptRoleAccess)) {
                return badRequest(isEn
                        ? "You can only assign roles allowed for the selected company."
                        : "선택한 회사에서 허용된 권한만 부여할 수 있습니다.");
            }
            UserAuthorityTargetVO beforeAssignment = authGroupManageService.selectUserAuthorityTarget(normalizedInsttId, normalizedEntrprsMberId);
            authGroupManageService.updateEnterpriseUserRoleAssignment(normalizedEntrprsMberId, normalizedAuthorCode);
            recordEnterpriseUserRoleAssignmentDbChange(
                    request,
                    context,
                    normalizedInsttId,
                    normalizedEntrprsMberId,
                    beforeAssignment,
                    authGroupManageService.selectUserAuthorityTarget(normalizedInsttId, normalizedEntrprsMberId));
            Map<String, Object> data = successBody();
            data.put("insttId", normalizedInsttId);
            data.put("entrprsMberId", normalizedEntrprsMberId);
            data.put("authorCode", normalizedAuthorCode);
            return ok(data);
        } catch (IllegalArgumentException e) {
            return badRequest(e.getMessage());
        } catch (Exception e) {
            return serverError(isEn
                    ? "Failed to save company member role."
                    : "회사 회원 권한 저장에 실패했습니다.");
        }
    }

    public static class CommandResult {
        private final HttpStatus status;
        private final Map<String, Object> body;

        CommandResult(HttpStatus status, Map<String, Object> body) {
            this.status = status;
            this.body = body;
        }

        public HttpStatus getStatus() {
            return status;
        }

        public Map<String, Object> getBody() {
            return body;
        }

        public boolean isSuccess() {
            return status.is2xxSuccessful() && Boolean.TRUE.equals(body.get("success"));
        }
    }

    private CommandResult ok(Map<String, Object> body) {
        return new CommandResult(HttpStatus.OK, body);
    }

    private CommandResult badRequest(String message) {
        return new CommandResult(HttpStatus.BAD_REQUEST, failureBody(message));
    }

    private CommandResult forbidden(String message) {
        return new CommandResult(HttpStatus.FORBIDDEN, failureBody(message));
    }

    private CommandResult serverError(String message) {
        return new CommandResult(HttpStatus.INTERNAL_SERVER_ERROR, failureBody(message));
    }

    private void recordAuthorGroupDbChange(HttpServletRequest request,
                                           CurrentUserContextService.CurrentUserContext context,
                                           String authorCode,
                                           String changeType,
                                           AuthorInfoVO before,
                                           AuthorInfoVO after) {
        try {
            DbChangeCaptureRequest captureRequest = new DbChangeCaptureRequest();
            captureRequest.setProjectId("carbonet");
            captureRequest.setMenuCode("AMENU_AUTH_GROUP");
            captureRequest.setPageId("auth-group");
            captureRequest.setApiPath(request == null ? "" : safeString(request.getRequestURI()));
            captureRequest.setHttpMethod(request == null ? "" : safeString(request.getMethod()));
            captureRequest.setActorId(context == null ? "" : safeString(context.getUserId()));
            captureRequest.setActorRole(context == null ? "" : safeString(context.getAuthorCode()));
            captureRequest.setActorScopeId(context == null ? "" : safeString(context.getInsttId()));
            captureRequest.setTargetTableName("COMTNAUTHORINFO");
            captureRequest.setTargetPkJson(writeJson(singleKeyMap("authorCode", authorCode)));
            captureRequest.setEntityType("AUTHOR_GROUP");
            captureRequest.setEntityId(authorCode);
            captureRequest.setChangeType(changeType);
            captureRequest.setBeforeSummaryJson(writeJson(before));
            captureRequest.setAfterSummaryJson(writeJson(after));
            captureRequest.setChangeSummary("Authority group created: " + authorCode);
            captureRequest.setPatchFormatCode("JSON_PATCH");
            captureRequest.setPatchKindCode("ROW_INSERT");
            captureRequest.setTargetEnv("PROD");
            captureRequest.setTargetKeysJson(writeJson(singleKeyMap("authorCode", authorCode)));
            captureRequest.setPatchPayloadJson(writeJson(after));
            captureRequest.setRenderedSqlPreview("");
            captureRequest.setRiskLevel("HIGH");
            captureRequest.setLogicalObjectId("COMTNAUTHORINFO:" + authorCode);
            captureRequest.setSourceEnv("LOCAL");
            dbChangeCaptureService.captureChange(captureRequest);
        } catch (Exception e) {
            log.warn("Failed to capture authority-group DB change. authorCode={}, changeType={}", authorCode, changeType, e);
        }
    }

    private String writeJson(Object value) {
        if (value == null) {
            return "";
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            log.warn("Failed to serialize authority-group DB capture payload.", e);
            return "";
        }
    }

    private Map<String, String> singleKeyMap(String key, String value) {
        Map<String, String> map = new HashMap<>();
        map.put(key, value);
        return map;
    }

    private void recordAuthorFeatureRelationDbChange(HttpServletRequest request,
                                                     CurrentUserContextService.CurrentUserContext context,
                                                     String authorCode,
                                                     List<String> beforeFeatureCodes,
                                                     List<String> afterFeatureCodes) {
        try {
            DbChangeCaptureRequest captureRequest = new DbChangeCaptureRequest();
            captureRequest.setProjectId("carbonet");
            captureRequest.setMenuCode("AMENU_AUTH_GROUP");
            captureRequest.setPageId("auth-group");
            captureRequest.setApiPath(request == null ? "" : safeString(request.getRequestURI()));
            captureRequest.setHttpMethod(request == null ? "" : safeString(request.getMethod()));
            captureRequest.setActorId(context == null ? "" : safeString(context.getUserId()));
            captureRequest.setActorRole(context == null ? "" : safeString(context.getAuthorCode()));
            captureRequest.setActorScopeId(context == null ? "" : safeString(context.getInsttId()));
            captureRequest.setTargetTableName("COMTNAUTHORFUNCTIONRELATE");
            captureRequest.setTargetPkJson(writeJson(singleKeyMap("authorCode", authorCode)));
            captureRequest.setEntityType("AUTHOR_FEATURE_RELATION");
            captureRequest.setEntityId(authorCode);
            captureRequest.setChangeType("UPDATE");
            captureRequest.setBeforeSummaryJson(writeJson(beforeFeatureCodes));
            captureRequest.setAfterSummaryJson(writeJson(afterFeatureCodes));
            captureRequest.setChangeSummary("Authority feature mapping updated: " + authorCode);
            captureRequest.setPatchFormatCode("JSON_PATCH");
            captureRequest.setPatchKindCode("RELATION_REPLACE");
            captureRequest.setTargetEnv("PROD");
            captureRequest.setTargetKeysJson(writeJson(singleKeyMap("authorCode", authorCode)));
            captureRequest.setPatchPayloadJson(writeJson(afterFeatureCodes));
            captureRequest.setRenderedSqlPreview("");
            captureRequest.setRiskLevel("HIGH");
            captureRequest.setLogicalObjectId("COMTNAUTHORFUNCTIONRELATE:" + authorCode);
            captureRequest.setSourceEnv("LOCAL");
            dbChangeCaptureService.captureChange(captureRequest);
        } catch (Exception e) {
            log.warn("Failed to capture authority-feature relation DB change. authorCode={}", authorCode, e);
        }
    }

    private void recordDepartmentRoleMappingDbChange(HttpServletRequest request,
                                                     CurrentUserContextService.CurrentUserContext context,
                                                     String insttId,
                                                     String deptNm,
                                                     DepartmentRoleMappingVO before,
                                                     DepartmentRoleMappingVO after) {
        try {
            String changeType = before == null ? "INSERT" : "UPDATE";
            DbChangeCaptureRequest captureRequest = new DbChangeCaptureRequest();
            captureRequest.setProjectId("carbonet");
            captureRequest.setMenuCode("AMENU_AUTH_DEPT_ROLE");
            captureRequest.setPageId("auth-dept-role");
            captureRequest.setApiPath(request == null ? "" : safeString(request.getRequestURI()));
            captureRequest.setHttpMethod(request == null ? "" : safeString(request.getMethod()));
            captureRequest.setActorId(context == null ? "" : safeString(context.getUserId()));
            captureRequest.setActorRole(context == null ? "" : safeString(context.getAuthorCode()));
            captureRequest.setActorScopeId(context == null ? "" : safeString(context.getInsttId()));
            captureRequest.setTargetTableName("COMTNDEPTAUTHORRELATE");
            captureRequest.setTargetPkJson(writeJson(buildDeptRoleMappingPk(insttId, deptNm)));
            captureRequest.setEntityType("DEPARTMENT_ROLE_MAPPING");
            captureRequest.setEntityId(insttId + ":" + deptNm);
            captureRequest.setChangeType(changeType);
            captureRequest.setBeforeSummaryJson(writeJson(before));
            captureRequest.setAfterSummaryJson(writeJson(after));
            captureRequest.setChangeSummary(buildDepartmentRoleMappingChangeSummary(insttId, deptNm, before, after));
            captureRequest.setPatchFormatCode("JSON_PATCH");
            captureRequest.setPatchKindCode("UPSERT_BY_COMPOSITE_KEY");
            captureRequest.setTargetEnv("PROD");
            captureRequest.setTargetKeysJson(writeJson(buildDeptRoleMappingPk(insttId, deptNm)));
            captureRequest.setPatchPayloadJson(writeJson(after));
            captureRequest.setRenderedSqlPreview("");
            captureRequest.setRiskLevel("HIGH");
            captureRequest.setLogicalObjectId("COMTNDEPTAUTHORRELATE:" + insttId + ":" + deptNm);
            captureRequest.setSourceEnv("LOCAL");
            dbChangeCaptureService.captureChange(captureRequest);
        } catch (Exception e) {
            log.warn("Failed to capture department-role mapping DB change. insttId={}, deptNm={}", insttId, deptNm, e);
        }
    }

    private void recordEnterpriseUserRoleAssignmentDbChange(HttpServletRequest request,
                                                            CurrentUserContextService.CurrentUserContext context,
                                                            String insttId,
                                                            String userId,
                                                            UserAuthorityTargetVO before,
                                                            UserAuthorityTargetVO after) {
        adminRoleAssignmentDbChangeCaptureSupport.captureEnterpriseUserRoleAssignment(
                request,
                context == null ? "" : context.getUserId(),
                context == null ? "" : context.getAuthorCode(),
                context == null ? "" : context.getInsttId(),
                insttId,
                userId,
                before,
                after,
                "AMENU_AUTH_DEPT_ROLE",
                "auth-dept-role-member");
    }

    private Map<String, String> buildDeptRoleMappingPk(String insttId, String deptNm) {
        Map<String, String> pk = new LinkedHashMap<>();
        pk.put("insttId", insttId);
        pk.put("deptNm", deptNm);
        return pk;
    }

    private String buildDepartmentRoleMappingChangeSummary(String insttId,
                                                           String deptNm,
                                                           DepartmentRoleMappingVO before,
                                                           DepartmentRoleMappingVO after) {
        String beforeAuthorCode = before == null ? "" : safeString(before.getAuthorCode());
        String afterAuthorCode = after == null ? "" : safeString(after.getAuthorCode());
        if (beforeAuthorCode.isEmpty()) {
            return "Department role mapping created: " + insttId + "/" + deptNm + " -> " + afterAuthorCode;
        }
        return "Department role mapping updated: " + insttId + "/" + deptNm + " " + beforeAuthorCode + " -> " + afterAuthorCode;
    }

    private Map<String, Object> successBody() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        return body;
    }

    private Map<String, Object> failureBody(String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", false);
        body.put("message", safeString(message));
        return body;
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }

    private String normalizeScopedAuthorCode(String authorCode, String roleCategory, String insttId, boolean forceScoped) {
        String normalizedCode = safeString(authorCode).toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9_]", "_");
        if (!forceScoped || (!"DEPARTMENT".equals(roleCategory) && !"USER".equals(roleCategory))) {
            return normalizedCode;
        }
        String prefix = buildScopedAuthorPrefix(roleCategory, insttId);
        if (prefix.isEmpty()) {
            return normalizedCode;
        }
        String suffix = normalizedCode;
        if (suffix.startsWith(prefix)) {
            return suffix;
        }
        suffix = suffix.replaceFirst("^ROLE_[A-Z0-9]+_", "");
        suffix = suffix.replaceFirst("^COMPANY_[A-Z0-9]+_", "");
        suffix = suffix.replaceAll("^_+", "");
        if (suffix.isEmpty()) {
            suffix = "CUSTOM";
        }
        return prefix + suffix;
    }

    private boolean isCompanyScopedAuthorCodeForInstt(String authorCode, String roleCategory, String insttId) {
        String scopedPrefix = buildScopedAuthorPrefix(roleCategory, insttId);
        return !scopedPrefix.isEmpty() && safeString(authorCode).toUpperCase(Locale.ROOT).startsWith(scopedPrefix);
    }

    private String buildScopedAuthorPrefix(String roleCategory, String insttId) {
        String token = normalizeInsttScopeToken(insttId);
        if (token.isEmpty()) {
            return "";
        }
        if ("DEPARTMENT".equals(roleCategory)) {
            return "ROLE_DEPT_I" + shortenInsttScopeToken(token) + "_";
        }
        if ("USER".equals(roleCategory)) {
            return "ROLE_USER_I" + shortenInsttScopeToken(token) + "_";
        }
        return "";
    }

    private String normalizeInsttScopeToken(String insttId) {
        return safeString(insttId).toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
    }

    private String shortenInsttScopeToken(String normalizedToken) {
        String token = safeString(normalizedToken);
        if (token.length() <= 8) {
            return token;
        }
        return token.substring(token.length() - 8);
    }

    private List<String> mergeRoleFeatureSelection(String authorCode, List<String> requestedFeatureCodes,
                                                   Set<String> grantableFeatureCodes) throws Exception {
        List<String> normalizedRequested = normalizeFeatureCodes(requestedFeatureCodes);
        if (grantableFeatureCodes == null) {
            return normalizedRequested;
        }
        Set<String> merged = new java.util.LinkedHashSet<>(normalizeFeatureCodes(authGroupManageService.selectAuthorFeatureCodes(authorCode)));
        merged.removeIf(grantableFeatureCodes::contains);
        merged.addAll(adminAuthorityPagePayloadSupport.filterFeatureCodesByGrantable(normalizedRequested, grantableFeatureCodes));
        return new java.util.ArrayList<>(merged);
    }

    private List<String> normalizeFeatureCodes(List<String> featureCodes) {
        if (featureCodes == null) {
            return Collections.emptyList();
        }
        java.util.LinkedHashSet<String> dedup = new java.util.LinkedHashSet<>();
        for (String featureCode : featureCodes) {
            String normalized = safeString(featureCode).toUpperCase(Locale.ROOT);
            if (!normalized.isEmpty()) {
                dedup.add(normalized);
            }
        }
        return new java.util.ArrayList<>(dedup);
    }
}
