package egovframework.com.feature.admin.web;

import egovframework.com.feature.admin.dto.request.AdminDevSessionSimulationRequestDTO;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import egovframework.com.feature.auth.domain.entity.EmplyrInfo;
import egovframework.com.feature.auth.domain.repository.EmployeeMemberRepository;
import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.platform.service.observability.PlatformObservabilityCompanyScopePort;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminSessionSimulationService {

    private final CurrentUserContextService currentUserContextService;
    private final AuthGroupManageService authGroupManageService;
    private final EmployeeMemberRepository employeeMemberRepository;
    private final PlatformObservabilityCompanyScopePort platformObservabilityCompanyScopePort;

    public Map<String, Object> buildPayload(HttpServletRequest request, String insttId) {
        CurrentUserContextService.CurrentUserContext context = currentUserContextService.resolve(request);
        boolean available = currentUserContextService.canUseSessionSimulation(request);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("available", available);
        response.put("active", context.isSimulationActive());
        response.put("actualUserId", context.getActualUserId());
        response.put("effectiveUserId", context.getUserId());
        response.put("effectiveAuthorCode", context.getAuthorCode());
        response.put("effectiveInsttId", context.getInsttId());
        if (!available) {
            response.put("companyOptions", Collections.emptyList());
            response.put("adminAccountOptions", Collections.emptyList());
            response.put("authorOptions", Collections.emptyList());
            response.put("selectedInsttId", "");
            response.put("selectedEmplyrId", "");
            response.put("selectedAuthorCode", "");
            return response;
        }

        List<Map<String, String>> companyOptions = buildCompanyOptions();
        String selectedInsttId = resolveSelectedInsttId(
                safeString(insttId).isEmpty() ? context.getInsttId() : insttId,
                companyOptions);
        List<Map<String, String>> adminAccountOptions = buildAdminAccountOptions(selectedInsttId);
        String selectedEmplyrId = resolveSelectedEmplyrId(context, adminAccountOptions);
        String selectedAuthorCode = resolveSelectedAuthorCode(context, selectedEmplyrId, adminAccountOptions);

        response.put("companyOptions", companyOptions);
        response.put("adminAccountOptions", adminAccountOptions);
        response.put("authorOptions", buildAuthorOptions());
        response.put("selectedInsttId", selectedInsttId);
        response.put("selectedEmplyrId", selectedEmplyrId);
        response.put("selectedAuthorCode", selectedAuthorCode);
        return response;
    }

    public Map<String, Object> apply(HttpServletRequest request, AdminDevSessionSimulationRequestDTO payload) {
        CurrentUserContextService.CurrentUserContext context = currentUserContextService.resolve(request);
        ensureAvailable(request, context);

        String normalizedEmplyrId = safeString(payload == null ? null : payload.getEmplyrId());
        String normalizedAuthorCode = safeString(payload == null ? null : payload.getAuthorCode()).toUpperCase(Locale.ROOT);
        if (normalizedEmplyrId.isEmpty() || normalizedAuthorCode.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "관리자 계정과 권한 롤을 선택하세요.");
        }

        EmplyrInfo adminMember = employeeMemberRepository.findById(normalizedEmplyrId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "관리자 계정을 찾을 수 없습니다."));
        String targetInsttId = safeString(adminMember.getInsttId());
        String requestedInsttId = safeString(payload == null ? null : payload.getInsttId());
        if (!requestedInsttId.isEmpty() && !requestedInsttId.equals(targetInsttId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "선택한 회사와 관리자 계정 소속이 일치하지 않습니다.");
        }

        ensureAuthorCodeExists(normalizedAuthorCode);
        currentUserContextService.saveSessionSimulation(
                request,
                context.getActualUserId(),
                normalizedEmplyrId,
                normalizedAuthorCode,
                targetInsttId);
        return buildPayload(request, targetInsttId);
    }

    public Map<String, Object> reset(HttpServletRequest request) {
        CurrentUserContextService.CurrentUserContext context = currentUserContextService.resolve(request);
        ensureAvailable(request, context);
        currentUserContextService.clearSessionSimulation(request);
        return buildPayload(request, "");
    }

    private void ensureAvailable(HttpServletRequest request, CurrentUserContextService.CurrentUserContext context) {
        if (!currentUserContextService.canUseSessionSimulation(request) || safeString(context.getActualUserId()).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "개발 시뮬레이터는 local webmaster만 사용할 수 있습니다.");
        }
    }

    private List<Map<String, String>> buildCompanyOptions() {
        List<EmplyrInfo> admins = employeeMemberRepository.searchAdminMembersForManagement(
                "",
                "",
                "",
                Sort.by(Sort.Order.asc("insttId"), Sort.Order.asc("userNm"), Sort.Order.asc("emplyrId")));
        Set<String> seen = new LinkedHashSet<>();
        List<Map<String, String>> options = new ArrayList<>();
        for (EmplyrInfo admin : admins) {
            String insttId = safeString(admin.getInsttId());
            if (insttId.isEmpty() || !seen.add(insttId)) {
                continue;
            }
            Map<String, String> option = new LinkedHashMap<>();
            option.put("insttId", insttId);
            option.put("cmpnyNm", resolveCompanyName(insttId));
            options.add(option);
        }
        return options;
    }

    private List<Map<String, String>> buildAdminAccountOptions(String insttId) {
        List<EmplyrInfo> admins = employeeMemberRepository.searchAdminMembersForManagement(
                "",
                "",
                safeString(insttId),
                Sort.by(Sort.Order.asc("userNm"), Sort.Order.asc("emplyrId")));
        Map<String, Map<String, String>> authorSummaryByUserId = loadAuthorSummaryByUserId();
        return admins.stream()
                .map(admin -> {
                    Map<String, String> summary = authorSummaryByUserId.getOrDefault(safeString(admin.getEmplyrId()), Collections.emptyMap());
                    Map<String, String> option = new LinkedHashMap<>();
                    option.put("emplyrId", safeString(admin.getEmplyrId()));
                    option.put("userNm", safeString(admin.getUserNm()));
                    option.put("insttId", safeString(admin.getInsttId()));
                    option.put("orgnztId", safeString(admin.getOrgnztId()));
                    option.put("authorCode", safeString(summary.get("authorCode")).toUpperCase(Locale.ROOT));
                    option.put("authorNm", safeString(summary.get("authorNm")));
                    return option;
                })
                .collect(Collectors.toList());
    }

    private Map<String, Map<String, String>> loadAuthorSummaryByUserId() {
        try {
            return authGroupManageService.selectAdminRoleAssignments().stream()
                    .collect(Collectors.toMap(
                            item -> safeString(item.getEmplyrId()),
                            item -> {
                                Map<String, String> summary = new LinkedHashMap<>();
                                summary.put("authorCode", safeString(item.getAuthorCode()));
                                summary.put("authorNm", safeString(item.getAuthorNm()));
                                return summary;
                            },
                            (left, right) -> left,
                            LinkedHashMap::new));
        } catch (Exception ex) {
            return Collections.emptyMap();
        }
    }

    private List<Map<String, String>> buildAuthorOptions() {
        try {
            return authGroupManageService.selectAuthorList().stream()
                    .map(author -> {
                        Map<String, String> option = new LinkedHashMap<>();
                        option.put("authorCode", safeString(author.getAuthorCode()).toUpperCase(Locale.ROOT));
                        option.put("authorNm", safeString(author.getAuthorNm()));
                        return option;
                    })
                    .collect(Collectors.toList());
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "권한 롤 목록을 불러오지 못했습니다.");
        }
    }

    private void ensureAuthorCodeExists(String authorCode) {
        try {
            if (authGroupManageService.countAuthorCode(authorCode) > 0) {
                return;
            }
        } catch (Exception ignored) {
            // Fall through to error below.
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "선택한 권한 롤을 찾을 수 없습니다.");
    }

    private String resolveSelectedInsttId(String requestedInsttId, List<Map<String, String>> companyOptions) {
        String normalized = safeString(requestedInsttId);
        if (!normalized.isEmpty()) {
            for (Map<String, String> option : companyOptions) {
                if (normalized.equals(safeString(option.get("insttId")))) {
                    return normalized;
                }
            }
        }
        return companyOptions.isEmpty() ? "" : safeString(companyOptions.get(0).get("insttId"));
    }

    private String resolveSelectedEmplyrId(CurrentUserContextService.CurrentUserContext context, List<Map<String, String>> adminAccountOptions) {
        String currentSelected = context.isSimulationActive() ? safeString(context.getUserId()) : "";
        if (!currentSelected.isEmpty()) {
            for (Map<String, String> option : adminAccountOptions) {
                if (currentSelected.equals(safeString(option.get("emplyrId")))) {
                    return currentSelected;
                }
            }
        }
        return adminAccountOptions.isEmpty() ? "" : safeString(adminAccountOptions.get(0).get("emplyrId"));
    }

    private String resolveSelectedAuthorCode(CurrentUserContextService.CurrentUserContext context,
                                             String selectedEmplyrId,
                                             List<Map<String, String>> adminAccountOptions) {
        if (context.isSimulationActive()) {
            return safeString(context.getAuthorCode()).toUpperCase(Locale.ROOT);
        }
        for (Map<String, String> option : adminAccountOptions) {
            if (selectedEmplyrId.equals(safeString(option.get("emplyrId")))) {
                return safeString(option.get("authorCode")).toUpperCase(Locale.ROOT);
            }
        }
        return "";
    }

    private String resolveCompanyName(String insttId) {
        List<Map<String, String>> options = platformObservabilityCompanyScopePort.buildScopedAccessHistoryCompanyOptions(insttId);
        if (options.isEmpty()) {
            return insttId;
        }
        return safeString(options.get(0).get("cmpnyNm")).isEmpty() ? insttId : safeString(options.get(0).get("cmpnyNm"));
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }
}
