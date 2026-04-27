package egovframework.com.common.policy;

import egovframework.com.feature.admin.web.AdminCompanyScopeService;
import egovframework.com.feature.auth.service.CurrentUserContextService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Collections;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class GovernanceContextAssembler {

    private final CurrentUserContextService currentUserContextService;
    private final AdminCompanyScopeService adminCompanyScopeService;

    public GovernancePolicyModels.ActorContext buildActorContext(HttpServletRequest request) {
        CurrentUserContextService.CurrentUserContext context = currentUserContextService.resolve(request);
        AdminCompanyScopeService.CompanyScope companyScope = adminCompanyScopeService.resolve(context.getUserId());
        return new GovernancePolicyModels.ActorContext(
                context.isAuthenticated(),
                context.getUserId(),
                context.getActualUserId(),
                resolveUserKind(context),
                resolveMemberType(context),
                context.getAuthorCode(),
                companyScope.getInsttId(),
                "",
                context.isWebmaster() || "ROLE_SYSTEM_MASTER".equalsIgnoreCase(context.getAuthorCode()),
                context.getAuthorCode().isEmpty() ? Collections.emptyList() : Collections.singletonList(context.getAuthorCode()),
                Collections.emptyList(),
                Collections.emptyList(),
                Collections.emptyList());
    }

    private GovernancePolicyModels.UserKind resolveUserKind(CurrentUserContextService.CurrentUserContext context) {
        if (!context.isAuthenticated()) {
            return GovernancePolicyModels.UserKind.ANONYMOUS;
        }
        String authorCode = safe(context.getAuthorCode()).toUpperCase(Locale.ROOT);
        if (authorCode.contains("SYSTEM")
                || authorCode.contains("OPERATION")
                || authorCode.contains("CS_ADMIN")
                || "ROLE_ADMIN".equals(authorCode)) {
            return GovernancePolicyModels.UserKind.ADMIN;
        }
        return GovernancePolicyModels.UserKind.MEMBER;
    }

    private String resolveMemberType(CurrentUserContextService.CurrentUserContext context) {
        String authorCode = safe(context.getAuthorCode()).toUpperCase(Locale.ROOT);
        if (authorCode.contains("EMITTER")) {
            return "E";
        }
        if (authorCode.contains("PERFORMER")) {
            return "P";
        }
        if (authorCode.contains("CENTER")) {
            return "C";
        }
        if (authorCode.contains("GOV")) {
            return "G";
        }
        return "";
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
