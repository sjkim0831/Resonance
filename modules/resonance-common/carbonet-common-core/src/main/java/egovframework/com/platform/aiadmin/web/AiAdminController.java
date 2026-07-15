package egovframework.com.platform.aiadmin.web;

import egovframework.com.platform.aiadmin.service.AiAdminService;
import egovframework.com.platform.aiadmin.service.HermesService;
import egovframework.com.platform.aiadmin.service.KrdsCodeGenerationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.annotation.RequestMethod;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;
import java.util.Map;

@Controller
@RequestMapping({"/admin/ai", "/en/admin/ai"})
@RequiredArgsConstructor
public class AiAdminController {

    private final AiAdminService aiAdminService;
    private final HermesService hermesService;
    private final KrdsCodeGenerationService krdsCodeGenerationService;

    @GetMapping("/dashboard")
    public String dashboardPage(HttpServletRequest request, Locale locale) { return redirectSpa("ai-dashboard", request, locale); }
    @GetMapping("/models")
    public String modelsPage(HttpServletRequest request, Locale locale) { return redirectSpa("ai-models", request, locale); }
    @GetMapping("/training")
    public String trainingPage(HttpServletRequest request, Locale locale) { return redirectSpa("ai-training", request, locale); }
    @GetMapping("/rag")
    public String ragPage(HttpServletRequest request, Locale locale) { return redirectSpa("ai-rag", request, locale); }
    @GetMapping("/agents")
    public String agentsPage(HttpServletRequest request, Locale locale) { return redirectSpa("ai-agents", request, locale); }
    @GetMapping("/logs")
    public String logsPage(HttpServletRequest request, Locale locale) { return redirectSpa("ai-logs", request, locale); }
    @GetMapping("/quality")
    public String qualityPage(HttpServletRequest request, Locale locale) { return redirectSpa("ai-quality", request, locale); }
    @GetMapping("/observability")
    public String observabilityPage(HttpServletRequest request, Locale locale) { return redirectSpa("ai-observability", request, locale); }

    @GetMapping("/dashboard/page-data") @ResponseBody
    public ResponseEntity<Map<String, Object>> dashboard(HttpServletRequest request, Locale locale) { primeCsrfToken(request); return ResponseEntity.ok(aiAdminService.buildDashboard(isEnglishRequest(request, locale))); }
    @GetMapping("/models/page-data") @ResponseBody
    public ResponseEntity<Map<String, Object>> models(HttpServletRequest request, Locale locale, @RequestParam(required=false) String status, @RequestParam(required=false) String provider) { primeCsrfToken(request); return ResponseEntity.ok(aiAdminService.buildModelsPage(status, provider, isEnglishRequest(request, locale))); }
    @GetMapping("/training/page-data") @ResponseBody
    public ResponseEntity<Map<String, Object>> training(HttpServletRequest request, Locale locale, @RequestParam(required=false) String status, @RequestParam(required=false) String type) { primeCsrfToken(request); return ResponseEntity.ok(aiAdminService.buildTrainingPage(status, type, isEnglishRequest(request, locale))); }
    @GetMapping("/rag/page-data") @ResponseBody
    public ResponseEntity<Map<String, Object>> rag(HttpServletRequest request, Locale locale, @RequestParam(required=false) String status, @RequestParam(required=false) String source) { primeCsrfToken(request); return ResponseEntity.ok(aiAdminService.buildRagPage(status, source, isEnglishRequest(request, locale))); }
    @PostMapping("/rag/krds-code") @ResponseBody
    public ResponseEntity<Map<String, Object>> generateKrdsCode(HttpServletRequest request, Locale locale, @RequestBody Map<String, String> body) {
        primeCsrfToken(request);
        return ResponseEntity.ok(krdsCodeGenerationService.generate(body.get("prompt"), body.get("target"), isEnglishRequest(request, locale)));
    }
    @GetMapping("/agents/page-data") @ResponseBody
    public ResponseEntity<Map<String, Object>> agents(HttpServletRequest request, Locale locale, @RequestParam(required=false) String status) { primeCsrfToken(request); return ResponseEntity.ok(aiAdminService.buildAgentsPage(status, isEnglishRequest(request, locale))); }
    @GetMapping("/logs/page-data") @ResponseBody
    public ResponseEntity<Map<String, Object>> logs(HttpServletRequest request, Locale locale, @RequestParam(required=false) String logType, @RequestParam(required=false) String level, @RequestParam(required=false) String from, @RequestParam(required=false) String to) { primeCsrfToken(request); return ResponseEntity.ok(aiAdminService.buildLogsPage(logType, level, from, to, isEnglishRequest(request, locale))); }
    @GetMapping("/quality/page-data") @ResponseBody
    public ResponseEntity<Map<String, Object>> quality(HttpServletRequest request, Locale locale, @RequestParam(required=false) String period, @RequestParam(required=false) String modelId) { primeCsrfToken(request); return ResponseEntity.ok(aiAdminService.buildQualityPage(period, modelId, isEnglishRequest(request, locale))); }
    @GetMapping("/observability/page-data") @ResponseBody
    public ResponseEntity<Map<String, Object>> observability(HttpServletRequest request, Locale locale, @RequestParam(required=false) String traceId, @RequestParam(required=false) String modelId) { primeCsrfToken(request); return ResponseEntity.ok(aiAdminService.buildObservabilityPage(traceId, modelId, isEnglishRequest(request, locale))); }

    @GetMapping("/hermes")
    public String hermesPage(HttpServletRequest request, Locale locale) { return redirectSpa("ai-hermes", request, locale); }
    @GetMapping("/hermes/status") @ResponseBody
    public ResponseEntity<Map<String, Object>> hermesStatus(HttpServletRequest request, Locale locale) { primeCsrfToken(request); return ResponseEntity.ok(hermesService.buildHermesStatus(isEnglishRequest(request, locale))); }
    @GetMapping("/hermes/models") @ResponseBody
    public ResponseEntity<Map<String, Object>> hermesModels(HttpServletRequest request, Locale locale) { primeCsrfToken(request); return ResponseEntity.ok(hermesService.buildHermesModelsPage(isEnglishRequest(request, locale))); }
    @GetMapping("/hermes/sessions") @ResponseBody
    public ResponseEntity<Map<String, Object>> hermesSessions(HttpServletRequest request, Locale locale, @RequestParam(defaultValue = "20") int limit, @RequestParam(defaultValue = "0") int offset) { primeCsrfToken(request); return ResponseEntity.ok(hermesService.buildHermesSessionsPage(limit, offset, isEnglishRequest(request, locale))); }
    @GetMapping("/hermes/logs") @ResponseBody
    public ResponseEntity<Map<String, Object>> hermesLogs(HttpServletRequest request, Locale locale, @RequestParam(required=false) String component, @RequestParam(defaultValue = "100") int lines) { primeCsrfToken(request); return ResponseEntity.ok(hermesService.buildHermesLogsPage(component, lines, isEnglishRequest(request, locale))); }
    @GetMapping("/hermes/skills") @ResponseBody
    public ResponseEntity<Map<String, Object>> hermesSkills(HttpServletRequest request, Locale locale) { primeCsrfToken(request); return ResponseEntity.ok(hermesService.buildHermesSkillsPage(isEnglishRequest(request, locale))); }
    @PostMapping("/hermes/models/pull") @ResponseBody
    public ResponseEntity<Map<String, String>> hermesPullModel(@RequestBody Map<String, String> body) { return ResponseEntity.ok(Map.of("result", hermesService.pullModel(body.get("modelName")))); }
    @PostMapping("/hermes/models/delete") @ResponseBody
    public ResponseEntity<Map<String, String>> hermesDeleteModel(@RequestBody Map<String, String> body) { return ResponseEntity.ok(Map.of("result", hermesService.deleteModel(body.get("modelName")))); }

    private void primeCsrfToken(HttpServletRequest request) { if (request == null) return; Object t = request.getAttribute("_csrf"); if (t instanceof CsrfToken) ((CsrfToken) t).getToken(); }
    private String redirectSpa(String r, HttpServletRequest req, Locale loc) {
        StringBuilder b = new StringBuilder("forward:"); b.append(isEnglishRequest(req, loc) ? "/en/admin/app?route=" : "/admin/app?route="); b.append(r);
        if (req != null) { String q = req.getQueryString(); if (q != null && !q.isBlank()) b.append("&").append(q); }
        return b.toString();
    }
    private boolean isEnglishRequest(HttpServletRequest req, Locale loc) {
        if (req != null) { if (req.getRequestURI() != null && req.getRequestURI().startsWith("/en/")) return true; if ("en".equalsIgnoreCase(req.getParameter("language"))) return true; }
        return loc != null && loc.getLanguage().toLowerCase(Locale.ROOT).startsWith("en");
    }
}
