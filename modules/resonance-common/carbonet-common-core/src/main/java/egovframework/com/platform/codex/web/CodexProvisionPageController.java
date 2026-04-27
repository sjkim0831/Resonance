package egovframework.com.platform.codex.web;

import lombok.RequiredArgsConstructor;
import egovframework.com.platform.workbench.service.SrTicketWorkbenchService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.ui.ExtendedModelMap;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@Controller
@RequestMapping({"/admin/system", "/en/admin/system"})
@RequiredArgsConstructor
public class CodexProvisionPageController {

    private final SrTicketWorkbenchService srTicketWorkbenchService;

    @Value("${security.codex.enabled:false}")
    private boolean codexEnabled;

    @Value("${security.codex.api-key:}")
    private String configuredApiKey;

    @Value("${security.codex.runner.enabled:false}")
    private boolean codexRunnerEnabled;

    @Value("${security.codex.runner.repo-root:}")
    private String codexRunnerRepoRoot;

    @Value("${security.codex.runner.workspace-root:/tmp/carbonet-sr-codex-runner}")
    private String codexRunnerWorkspaceRoot;

    @Value("${security.codex.runner.history-file:/tmp/carbonet-sr-codex-runner-history.jsonl}")
    private String codexRunnerHistoryFile;

    @Value("${security.codex.runner.plan-command:}")
    private String codexRunnerPlanCommand;

    @Value("${security.codex.runner.build-command:}")
    private String codexRunnerBuildCommand;

    @Value("${security.codex.runner.deploy-command:}")
    private String codexRunnerDeployCommand;

    @Value("${security.codex.runner.health-check-url:}")
    private String codexRunnerHealthCheckUrl;

    @Value("${security.codex.runner.parallel-lanes:3}")
    private int codexRunnerParallelLanes;

    @GetMapping({"/codex-request", "/codex-provision"})
    public String codexProvisionPage(HttpServletRequest request, Locale locale, Model model) {
        return redirectReactMigration(request, locale, "codex-request");
    }

    @GetMapping({"/codex-request/page-data", "/codex-provision/page-data"})
    @ResponseBody
    public ResponseEntity<Map<String, Object>> codexProvisionPageData(HttpServletRequest request, Locale locale) {
        boolean isEn = isEnglishRequest(request, locale);
        primeCsrfToken(request);
        ExtendedModelMap model = new ExtendedModelMap();
        boolean apiKeyConfigured = configuredApiKey != null && !configuredApiKey.trim().isEmpty();
        model.addAttribute("codexEnabled", codexEnabled);
        model.addAttribute("codexApiKeyConfigured", apiKeyConfigured);
        model.addAttribute("codexRunnerEnabled", codexRunnerEnabled);
        model.addAttribute("codexAvailabilityMessage", resolveAvailabilityMessage(isEn, codexEnabled, apiKeyConfigured));
        model.addAttribute("codexSamplePayload", samplePayload());
        model.addAttribute("codexRuntimeConfig", runtimeConfig());
        model.addAttribute("isEn", isEn);
        try {
            Map<String, Object> ticketPage = srTicketWorkbenchService.getPage("");
            model.addAttribute("srTicketCount", ticketPage.get("ticketCount"));
            model.addAttribute("srTickets", ticketPage.get("tickets"));
        } catch (Exception ignored) {
            model.addAttribute("srTicketCount", 0);
            model.addAttribute("srTickets", java.util.Collections.emptyList());
        }
        return ResponseEntity.ok(new LinkedHashMap<>(model));
    }

    private Map<String, Object> runtimeConfig() {
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("runnerEnabled", codexRunnerEnabled);
        config.put("repoRoot", safe(codexRunnerRepoRoot));
        config.put("workspaceRoot", safe(codexRunnerWorkspaceRoot));
        config.put("runnerHistoryFile", safe(codexRunnerHistoryFile));
        config.put("planCommandConfigured", !safe(codexRunnerPlanCommand).isEmpty());
        config.put("buildCommandConfigured", !safe(codexRunnerBuildCommand).isEmpty());
        config.put("deployCommandConfigured", !safe(codexRunnerDeployCommand).isEmpty());
        config.put("planCommand", safe(codexRunnerPlanCommand));
        config.put("buildCommand", safe(codexRunnerBuildCommand));
        config.put("deployCommand", safe(codexRunnerDeployCommand));
        config.put("healthCheckUrl", safe(codexRunnerHealthCheckUrl));
        config.put("parallelLanes", Math.max(codexRunnerParallelLanes, 1));
        return config;
    }

    private String resolveAvailabilityMessage(boolean isEn, boolean enabled, boolean apiKeyConfigured) {
        if (!enabled) {
            return isEn ? "Codex execution is disabled in this environment." : "이 환경에서는 Codex 실행이 비활성화되어 있습니다.";
        }
        if (!apiKeyConfigured) {
            return isEn ? "Codex API key is not configured." : "Codex API 키가 설정되지 않았습니다.";
        }
        return isEn ? "Codex execution is available." : "Codex 실행이 가능합니다.";
    }

    private boolean isEnglishRequest(HttpServletRequest request, Locale locale) {
        if (request != null) {
            String path = request.getRequestURI();
            if (path != null && path.startsWith("/en/")) {
                return true;
            }
            String param = request.getParameter("language");
            if ("en".equalsIgnoreCase(param)) {
                return true;
            }
        }
        return locale != null && locale.getLanguage().toLowerCase(Locale.ROOT).startsWith("en");
    }

    private String samplePayload() {
        return "{\n"
                + "  \"requestId\": \"REQ-20260313-001\",\n"
                + "  \"actorId\": \"CODEX\",\n"
                + "  \"targetApiPath\": \"/admin/system/codex-request\",\n"
                + "  \"companyId\": \"INSTT_0001\",\n"
                + "  \"menuType\": \"ADMIN\",\n"
                + "  \"reloadSecurityMetadata\": true,\n"
                + "  \"page\": {\n"
                + "    \"domainCode\": \"A190\",\n"
                + "    \"domainName\": \"AI 운영\",\n"
                + "    \"domainNameEn\": \"AI Operations\",\n"
                + "    \"groupCode\": \"A19001\",\n"
                + "    \"groupName\": \"AI 작업센터\",\n"
                + "    \"groupNameEn\": \"AI Workbench\",\n"
                + "    \"code\": \"A1900103\",\n"
                + "    \"codeNm\": \"Codex 요청 관리\",\n"
                + "    \"codeDc\": \"Codex Request Management\",\n"
                + "    \"menuUrl\": \"/admin/system/codex-request\",\n"
                + "    \"menuIcon\": \"smart_toy\",\n"
                + "    \"useAt\": \"Y\"\n"
                + "  },\n"
                + "  \"features\": [\n"
                + "    {\n"
                + "      \"menuCode\": \"A1900103\",\n"
                + "      \"featureCode\": \"A1900103_VIEW\",\n"
                + "      \"featureNm\": \"Codex 요청 조회\",\n"
                + "      \"featureNmEn\": \"View Codex Requests\",\n"
                + "      \"featureDc\": \"Codex request list view\",\n"
                + "      \"useAt\": \"Y\"\n"
                + "    }\n"
                + "  ]\n"
                + "}";
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

    private String redirectReactMigration(HttpServletRequest request, Locale locale, String route) {
        StringBuilder builder = new StringBuilder("forward:");
        builder.append(isEnglishRequest(request, locale) ? "/en/admin/app?route=" : "/admin/app?route=");
        builder.append(route);
        if (request != null) {
            String query = request.getQueryString();
            if (query != null && !query.isBlank()) {
                builder.append("&").append(query);
            }
        }
        return builder.toString();
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
