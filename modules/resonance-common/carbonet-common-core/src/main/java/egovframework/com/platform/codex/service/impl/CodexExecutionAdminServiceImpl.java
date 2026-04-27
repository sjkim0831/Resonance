package egovframework.com.platform.codex.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.platform.menu.dto.AdminCodeCommandDTO;
import egovframework.com.feature.admin.dto.request.AdminMenuFeatureCommandDTO;
import egovframework.com.platform.menu.dto.MenuInfoDTO;
import egovframework.com.platform.governance.mapper.AdminCodeManageMapper;
import egovframework.com.platform.codex.mapper.AuthGroupManageMapper;
import egovframework.com.platform.codex.mapper.MenuFeatureManageMapper;
import egovframework.com.platform.menu.mapper.MenuInfoMapper;
import egovframework.com.platform.codex.model.CodexAdminActorContext;
import egovframework.com.platform.codex.model.CodexExecutionLog;
import egovframework.com.platform.codex.model.CodexExecutionHistoryResponse;
import egovframework.com.platform.codex.model.CodexProvisionResponse;
import egovframework.com.platform.codex.service.CodexExecutionAdminPort;
import egovframework.com.platform.codex.service.CodexProvisioningService;
import egovframework.com.platform.request.codex.CodexProvisionRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.egovframe.boot.security.bean.EgovReloadableFilterInvocationSecurityMetadataSource;
import org.egovframe.boot.security.userdetails.util.EgovUserDetailsHelper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.locks.ReentrantLock;

@Service("codexExecutionAdminService")
@RequiredArgsConstructor
@Slf4j
public class CodexExecutionAdminServiceImpl implements CodexExecutionAdminPort {

    private static final String MASTER_ROLE = "ROLE_SYSTEM_MASTER";
    private static final DateTimeFormatter TS_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final CodexProvisioningService codexProvisioningService;
    private final AdminCodeManageMapper adminCodeManageMapper;
    private final MenuInfoMapper menuInfoMapper;
    private final MenuFeatureManageMapper menuFeatureManageMapper;
    private final AuthGroupManageMapper authGroupManageMapper;
    private final ObjectMapper objectMapper;
    private final EgovReloadableFilterInvocationSecurityMetadataSource securityMetadataSource;

    @Value("${security.codex.history-file:/tmp/carbonet-codex-history.jsonl}")
    private String historyFilePath;

    private final ReentrantLock historyLock = new ReentrantLock();

    @Override
    public CodexProvisionResponse execute(CodexProvisionRequest request, CodexAdminActorContext actorContext) throws Exception {
        CodexProvisionRequest effectiveRequest = prepareEffectiveRequest(request, actorContext);
        try {
            CodexProvisionResponse response = codexProvisioningService.provision(effectiveRequest);
            if (effectiveRequest.isReloadSecurityMetadata()) {
                EgovUserDetailsHelper.reloadSecurityMetadata(securityMetadataSource);
                response.setSecurityMetadataReloaded(true);
            }
            CodexExecutionLog logEntry = buildLogEntry(effectiveRequest, actorContext, response, 200, null);
            appendHistory(logEntry);
            applyInspection(logEntry, response);
            return response;
        } catch (IllegalArgumentException e) {
            appendHistory(buildLogEntry(effectiveRequest, actorContext, null, 400, e.getMessage()));
            throw e;
        } catch (Exception e) {
            appendHistory(buildLogEntry(effectiveRequest, actorContext, null, 500, e.getMessage()));
            throw e;
        }
    }

    @Override
    public CodexExecutionHistoryResponse getRecentHistory(int limit) throws Exception {
        List<CodexExecutionLog> items = readHistory();
        items.sort(Comparator.comparing(CodexExecutionLog::getExecutedAt, Comparator.nullsLast(String::compareTo)).reversed());

        CodexExecutionHistoryResponse response = new CodexExecutionHistoryResponse();
        int safeLimit = limit <= 0 ? 20 : Math.min(limit, 100);
        int end = Math.min(items.size(), safeLimit);
        for (int i = 0; i < end; i++) {
            response.getItems().add(inspectEntry(items.get(i)));
        }
        response.setTotalCount(items.size());
        return response;
    }

    @Override
    public CodexExecutionHistoryResponse.CodexExecutionHistoryRow inspect(String logId) throws Exception {
        CodexExecutionLog item = findHistory(logId);
        if (item == null) {
            throw new IllegalArgumentException("Execution log was not found.");
        }
        return inspectEntry(item);
    }

    @Override
    public CodexProvisionResponse remediate(String logId, CodexAdminActorContext actorContext) throws Exception {
        CodexExecutionLog item = findHistory(logId);
        if (item == null || safeString(item.getRequestJson()).isEmpty()) {
            throw new IllegalArgumentException("Execution log was not found.");
        }
        CodexProvisionRequest request = objectMapper.readValue(item.getRequestJson(), CodexProvisionRequest.class);
        return execute(request, actorContext);
    }

    private CodexProvisionRequest prepareEffectiveRequest(CodexProvisionRequest request, CodexAdminActorContext actorContext) {
        CodexProvisionRequest effectiveRequest = request == null ? new CodexProvisionRequest() : objectMapper.convertValue(request, CodexProvisionRequest.class);
        if (safeString(effectiveRequest.getActorId()).isEmpty()) {
            effectiveRequest.setActorId(safeString(actorContext.getActorUserId()));
        }
        if (safeString(effectiveRequest.getCompanyId()).isEmpty() && safeString(effectiveRequest.getInsttId()).isEmpty()
                && actorContext != null && !actorContext.isMaster() && !safeString(actorContext.getActorInsttId()).isEmpty()) {
            effectiveRequest.setCompanyId(actorContext.getActorInsttId());
            effectiveRequest.setInsttId(actorContext.getActorInsttId());
        } else if (safeString(effectiveRequest.getCompanyId()).isEmpty() && !safeString(effectiveRequest.getInsttId()).isEmpty()) {
            effectiveRequest.setCompanyId(safeString(effectiveRequest.getInsttId()));
        } else if (safeString(effectiveRequest.getInsttId()).isEmpty() && !safeString(effectiveRequest.getCompanyId()).isEmpty()) {
            effectiveRequest.setInsttId(safeString(effectiveRequest.getCompanyId()));
        }
        if (safeString(effectiveRequest.getTargetApiPath()).isEmpty() && effectiveRequest.getPage() != null) {
            effectiveRequest.setTargetApiPath(safeString(effectiveRequest.getPage().getMenuUrl()));
        }
        return effectiveRequest;
    }

    private CodexExecutionLog buildLogEntry(CodexProvisionRequest request, CodexAdminActorContext actorContext,
                                              CodexProvisionResponse response, int httpStatus, String errorMessage) {
        CodexExecutionLog item = new CodexExecutionLog();
        item.setLogId("CDX-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase(Locale.ROOT));
        item.setExecutedAt(LocalDateTime.now().format(TS_FORMAT));
        item.setRequestId(safeString(request.getRequestId()));
        item.setActorUserId(actorContext == null ? "" : safeString(actorContext.getActorUserId()));
        item.setActorAuthorCode(actorContext == null ? "" : safeString(actorContext.getActorAuthorCode()));
        item.setActorInsttId(actorContext == null ? "" : safeString(actorContext.getActorInsttId()));
        item.setCompanyId(resolveCompanyId(request));
        item.setTargetApiPath(safeString(request.getTargetApiPath()));
        item.setMenuType(safeString(request.getMenuType()));
        item.setPageCode(request.getPage() == null ? "" : safeString(request.getPage().getCode()));
        item.setPageMenuUrl(request.getPage() == null ? "" : safeString(request.getPage().getMenuUrl()));
        item.setHttpStatus(httpStatus);
        item.setExecutionStatus(response == null ? "ERROR" : "SUCCESS");
        item.setErrorMessage(safeString(errorMessage));
        item.setCreatedCount(response == null ? 0 : response.getCreatedCount());
        item.setExistingCount(response == null ? 0 : response.getExistingCount());
        item.setSkippedCount(response == null ? 0 : response.getSkippedCount());
        item.setRequestJson(toJson(request));
        item.setResponseJson(response == null ? "" : toJson(response));
        return item;
    }

    private void applyInspection(CodexExecutionLog entry, CodexProvisionResponse response) throws Exception {
        CodexExecutionHistoryResponse.CodexExecutionHistoryRow inspected = inspectEntry(entry);
        response.setLogId(entry.getLogId());
        response.setInspectionStatus(inspected.getIssueCount() > 0 ? "ISSUE" : "OK");
        response.setIssues(inspected.getIssues());
    }

    private CodexExecutionHistoryResponse.CodexExecutionHistoryRow inspectEntry(CodexExecutionLog entry) throws Exception {
        CodexExecutionHistoryResponse.CodexExecutionHistoryRow row = new CodexExecutionHistoryResponse.CodexExecutionHistoryRow();
        row.setLogId(entry.getLogId());
        row.setExecutedAt(entry.getExecutedAt());
        row.setRequestId(entry.getRequestId());
        row.setActorUserId(entry.getActorUserId());
        row.setActorAuthorCode(entry.getActorAuthorCode());
        row.setActorInsttId(entry.getActorInsttId());
        row.setCompanyId(entry.getCompanyId());
        row.setTargetApiPath(entry.getTargetApiPath());
        row.setPageCode(entry.getPageCode());
        row.setPageMenuUrl(entry.getPageMenuUrl());
        row.setExecutionStatus(entry.getExecutionStatus());
        row.setHttpStatus(entry.getHttpStatus());
        row.setCreatedCount(entry.getCreatedCount());
        row.setExistingCount(entry.getExistingCount());
        row.setSkippedCount(entry.getSkippedCount());
        row.setRequestJson(entry.getRequestJson());

        CodexProvisionRequest request = safeString(entry.getRequestJson()).isEmpty()
                ? new CodexProvisionRequest()
                : objectMapper.readValue(entry.getRequestJson(), CodexProvisionRequest.class);

        List<String> issues = new ArrayList<>();
        boolean master = MASTER_ROLE.equalsIgnoreCase(safeString(entry.getActorAuthorCode()));
        String requestedCompanyId = resolveCompanyId(request);
        boolean companyContextOk = master || !requestedCompanyId.isEmpty();
        if (!companyContextOk) {
            issues.add("master 계정이 아니면 companyId 또는 insttId가 포함되어야 합니다.");
        }
        if (!master && !safeString(entry.getActorInsttId()).isEmpty() && !requestedCompanyId.isEmpty()
                && !safeString(entry.getActorInsttId()).equals(requestedCompanyId)) {
            companyContextOk = false;
            issues.add("요청 companyId가 로그인 관리자 회사와 다릅니다.");
        }
        row.setCompanyContextOk(companyContextOk);

        String codeId = resolveCodeId(safeString(request.getMenuType()));
        boolean pageMapped = true;
        boolean menuMapped = true;
        if (request.getPage() != null && !safeString(request.getPage().getCode()).isEmpty()) {
            String pageCode = safeString(request.getPage().getCode()).toUpperCase(Locale.ROOT);
            pageMapped = adminCodeManageMapper.countDetailCode(detailCountParams(codeId, pageCode)) > 0;
            menuMapped = menuInfoMapper.countMenuInfoByCode(pageCode) > 0;
            if (menuMapped && !safeString(request.getPage().getMenuUrl()).isEmpty()) {
                MenuInfoDTO menuDetail = menuInfoMapper.selectMenuDetailByUrl(safeString(request.getPage().getMenuUrl()));
                menuMapped = menuDetail != null && pageCode.equalsIgnoreCase(safeString(menuDetail.getMenuCode()));
            }
            if (!pageMapped) {
                issues.add("페이지 코드가 detail code에 등록되어 있지 않습니다.");
            }
            if (!menuMapped) {
                issues.add("페이지 URL 또는 메뉴 메타데이터가 등록되어 있지 않습니다.");
            }
        }
        row.setPageMapped(pageMapped);
        row.setMenuMapped(menuMapped);

        boolean featuresMapped = true;
        if (request.getFeatures() != null && !request.getFeatures().isEmpty()) {
            for (CodexProvisionRequest.FeatureRequest feature : request.getFeatures()) {
                if (feature == null) {
                    continue;
                }
                AdminMenuFeatureCommandDTO params = new AdminMenuFeatureCommandDTO();
                params.setFeatureCode(safeString(feature.getFeatureCode()).toUpperCase(Locale.ROOT));
                if (menuFeatureManageMapper.countFeatureCode(params) == 0) {
                    featuresMapped = false;
                    issues.add("기능 코드가 등록되어 있지 않습니다: " + safeString(feature.getFeatureCode()));
                }
            }
        } else {
            String mappedMenuCode = resolveMappedMenuCode(request);
            if (!mappedMenuCode.isEmpty()) {
                List<String> featureCodes = authGroupManageMapper.selectFeatureCodesByMenuCode(mappedMenuCode);
                featuresMapped = featureCodes != null && !featureCodes.isEmpty();
                if (!featuresMapped) {
                    issues.add("대상 메뉴에 기능 코드가 연결되어 있지 않습니다.");
                }
            }
        }
        row.setFeaturesMapped(featuresMapped);

        boolean commonCodesMapped = true;
        if (request.getCommonCodeGroups() != null) {
            for (CodexProvisionRequest.CommonCodeGroupRequest group : request.getCommonCodeGroups()) {
                if (group == null) {
                    continue;
                }
                String commonCodeId = safeString(group.getCodeId()).toUpperCase(Locale.ROOT);
                if (!commonCodeId.isEmpty() && adminCodeManageMapper.countCommonCode(commonCodeId) == 0) {
                    commonCodesMapped = false;
                    issues.add("공통코드 그룹이 등록되어 있지 않습니다: " + commonCodeId);
                }
                if (group.getDetails() == null) {
                    continue;
                }
                for (CodexProvisionRequest.CommonCodeDetailRequest detail : group.getDetails()) {
                    if (detail == null) {
                        continue;
                    }
                    String detailCode = safeString(detail.getCode()).toUpperCase(Locale.ROOT);
                    if (!detailCode.isEmpty() && adminCodeManageMapper.countDetailCode(detailCountParams(commonCodeId, detailCode)) == 0) {
                        commonCodesMapped = false;
                        issues.add("공통코드 상세가 등록되어 있지 않습니다: " + commonCodeId + ":" + detailCode);
                    }
                }
            }
        }
        row.setCommonCodesMapped(commonCodesMapped);

        boolean authorMappingsOk = true;
        if (request.getAuthors() != null) {
            for (CodexProvisionRequest.AuthorRequest author : request.getAuthors()) {
                if (author == null) {
                    continue;
                }
                String authorCode = safeString(author.getAuthorCode()).toUpperCase(Locale.ROOT);
                if (!authorCode.isEmpty() && authGroupManageMapper.countAuthorCode(authorCode) == 0) {
                    authorMappingsOk = false;
                    issues.add("권한 그룹이 등록되어 있지 않습니다: " + authorCode);
                }
                if (author.getFeatureCodes() == null) {
                    continue;
                }
                for (String featureCode : author.getFeatureCodes()) {
                    String normalizedFeatureCode = safeString(featureCode).toUpperCase(Locale.ROOT);
                    if (!normalizedFeatureCode.isEmpty()
                            && authGroupManageMapper.countAuthorFeaturePermission(authorCode, normalizedFeatureCode) == 0) {
                        authorMappingsOk = false;
                        issues.add("권한-기능 매핑이 없습니다: " + authorCode + " -> " + normalizedFeatureCode);
                    }
                }
            }
        }
        row.setAuthorMappingsOk(authorMappingsOk);

        boolean targetApiMapped = true;
        String targetApiPath = safeString(request.getTargetApiPath());
        if (!targetApiPath.isEmpty()) {
            MenuInfoDTO mappedMenu = resolveNearestMenu(targetApiPath);
            targetApiMapped = mappedMenu != null && !safeString(mappedMenu.getMenuCode()).isEmpty();
            if (!targetApiMapped) {
                issues.add("대상 API와 연결된 페이지/메뉴를 찾지 못했습니다.");
            }
        }
        row.setTargetApiMapped(targetApiMapped);

        if (!safeString(entry.getErrorMessage()).isEmpty()) {
            issues.add("실행 오류: " + safeString(entry.getErrorMessage()));
        }

        row.setIssues(issues);
        row.setIssueCount(issues.size());
        row.setIssueSummary(buildIssueSummary(issues));
        return row;
    }

    private String resolveMappedMenuCode(CodexProvisionRequest request) throws Exception {
        if (request.getPage() != null && !safeString(request.getPage().getCode()).isEmpty()) {
            return safeString(request.getPage().getCode()).toUpperCase(Locale.ROOT);
        }
        MenuInfoDTO menu = resolveNearestMenu(safeString(request.getTargetApiPath()));
        return menu == null ? "" : safeString(menu.getMenuCode());
    }

    private MenuInfoDTO resolveNearestMenu(String apiPath) {
        String candidate = normalizeUrl(apiPath);
        while (!candidate.isEmpty()) {
            MenuInfoDTO detail = menuInfoMapper.selectMenuDetailByUrl(candidate);
            if (detail != null && !safeString(detail.getMenuCode()).isEmpty()) {
                return detail;
            }
            int lastSlash = candidate.lastIndexOf('/');
            if (lastSlash <= 0) {
                break;
            }
            candidate = candidate.substring(0, lastSlash);
        }
        return null;
    }

    private AdminCodeCommandDTO detailCountParams(String codeId, String code) {
        AdminCodeCommandDTO params = new AdminCodeCommandDTO();
        params.setCodeId(codeId);
        params.setCode(code);
        return params;
    }

    private String resolveCodeId(String menuType) {
        return "HOME".equalsIgnoreCase(safeString(menuType)) ? "HMENU1" : "AMENU1";
    }

    private String buildIssueSummary(List<String> issues) {
        if (issues == null || issues.isEmpty()) {
            return "정상";
        }
        if (issues.size() == 1) {
            return issues.get(0);
        }
        return issues.get(0) + " 외 " + (issues.size() - 1) + "건";
    }

    private String resolveCompanyId(CodexProvisionRequest request) {
        if (request == null) {
            return "";
        }
        String companyId = safeString(request.getCompanyId());
        if (!companyId.isEmpty()) {
            return companyId;
        }
        return safeString(request.getInsttId());
    }

    private String normalizeUrl(String value) {
        String normalized = safeString(value);
        if (normalized.isEmpty()) {
            return "";
        }
        return normalized.startsWith("/") ? normalized : "/" + normalized;
    }

    private CodexExecutionLog findHistory(String logId) throws Exception {
        for (CodexExecutionLog item : readHistory()) {
            if (safeString(logId).equals(safeString(item.getLogId()))) {
                return item;
            }
        }
        return null;
    }

    private List<CodexExecutionLog> readHistory() throws Exception {
        Path file = historyFile();
        if (!Files.exists(file)) {
            return new ArrayList<>();
        }

        historyLock.lock();
        try (BufferedReader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
            List<CodexExecutionLog> items = new ArrayList<>();
            String line;
            while ((line = reader.readLine()) != null) {
                if (safeString(line).isEmpty()) {
                    continue;
                }
                try {
                    items.add(objectMapper.readValue(line, CodexExecutionLog.class));
                } catch (Exception e) {
                    log.warn("Failed to parse Codex history line.", e);
                }
            }
            return items;
        } finally {
            historyLock.unlock();
        }
    }

    private void appendHistory(CodexExecutionLog item) {
        Path file = historyFile();
        historyLock.lock();
        try {
            Files.createDirectories(file.getParent());
            try (BufferedWriter writer = Files.newBufferedWriter(file, StandardCharsets.UTF_8,
                    Files.exists(file) ? java.nio.file.StandardOpenOption.APPEND : java.nio.file.StandardOpenOption.CREATE,
                    java.nio.file.StandardOpenOption.WRITE)) {
                writer.write(toJson(item));
                writer.newLine();
            }
        } catch (IOException e) {
            log.error("Failed to append Codex execution history.", e);
        } finally {
            historyLock.unlock();
        }
    }

    private Path historyFile() {
        return Paths.get(safeString(historyFilePath).isEmpty() ? "/tmp/carbonet-codex-history.jsonl" : historyFilePath);
    }

    private String toJson(Object value) {
        if (value == null) {
            return "";
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return "";
        }
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }
}
