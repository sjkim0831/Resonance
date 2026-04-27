package egovframework.com.platform.governance.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.common.logging.RequestExecutionLogPage;
import egovframework.com.common.logging.RequestExecutionLogService;
import egovframework.com.common.logging.RequestExecutionLogVO;
import egovframework.com.platform.codex.mapper.AuthGroupManageMapper;
import egovframework.com.feature.admin.mapper.AdminNotificationHistoryMapper;
import egovframework.com.feature.admin.mapper.AdminSummarySnapshotMapper;
import egovframework.com.feature.admin.model.vo.AdminSummarySnapshotVO;
import egovframework.com.feature.admin.model.vo.EmissionResultFilterSnapshot;
import egovframework.com.feature.admin.model.vo.EmissionResultSummaryView;
import egovframework.com.platform.codex.model.FeatureCatalogItemVO;
import egovframework.com.platform.governance.model.vo.FeatureCatalogSectionVO;
import egovframework.com.platform.governance.model.vo.FeatureCatalogSummarySnapshot;
import egovframework.com.platform.codex.model.FeatureReferenceCountVO;
import egovframework.com.feature.admin.model.vo.SecurityAuditAggregate;
import egovframework.com.feature.admin.model.vo.SecurityAuditSnapshot;
import egovframework.com.platform.governance.service.AdminSummaryCommandService;
import egovframework.com.platform.governance.service.AdminSummaryService;
import egovframework.com.feature.admin.service.BlocklistPersistenceService;
import org.egovframe.rte.fdl.cmmn.EgovAbstractServiceImpl;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.LinkedHashSet;
import java.util.Set;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.stream.Collectors;
import java.util.regex.Pattern;
import java.util.stream.Stream;

@Service("adminSummaryService")
@Primary
public class AdminSummaryServiceImpl extends EgovAbstractServiceImpl implements AdminSummaryService, AdminSummaryCommandService {

    private static final Logger log = LoggerFactory.getLogger(AdminSummaryServiceImpl.class);
    private static final TypeReference<List<Map<String, String>>> CARD_LIST_TYPE = new TypeReference<List<Map<String, String>>>() {};
    private static final String SNAPSHOT_TYPE_CARD_LIST = "CARD_LIST";
    private static final String SNAPSHOT_TYPE_AUDIT_SUMMARY = "SECURITY_AUDIT_SUMMARY";
    private static final String SNAPSHOT_TYPE_SECURITY_INSIGHT_HISTORY = "SECURITY_INSIGHT_HISTORY";
    private static final String SNAPSHOT_TYPE_SECURITY_INSIGHT_STATE = "SECURITY_INSIGHT_STATE";
    private static final String SNAPSHOT_TYPE_SECURITY_INSIGHT_ACTIVITY = "SECURITY_INSIGHT_ACTIVITY";
    private static final String SNAPSHOT_TYPE_SECURITY_INSIGHT_NOTIFICATION = "SECURITY_INSIGHT_NOTIFICATION";
    private static final String SNAPSHOT_TYPE_SECURITY_INSIGHT_DELIVERY = "SECURITY_INSIGHT_DELIVERY";
    private static final String SNAPSHOT_TYPE_SECURITY_MONITORING_STATE = "SECURITY_MONITORING_STATE";
    private static final String SNAPSHOT_TYPE_SECURITY_MONITORING_ACTIVITY = "SECURITY_MONITORING_ACTIVITY";
    private static final String SNAPSHOT_TYPE_SECURITY_MONITORING_BLOCKLIST = "SECURITY_MONITORING_BLOCKLIST";
    private static final String SNAPSHOT_TYPE_SECURITY_HISTORY_ACTIONS = "SECURITY_HISTORY_ACTIONS";
    private static final DateTimeFormatter SNAPSHOT_TIMESTAMP_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final int SECURITY_INSIGHT_ACTIVITY_HISTORY_LIMIT = 500;
    private static final int SECURITY_INSIGHT_DELIVERY_HISTORY_LIMIT = 500;
    private static final long SOURCE_SCAN_CACHE_TTL_MS = 30_000L;
    private static final int SOURCE_SCAN_MAX_MATCHES_PER_RULE = 12;
    private static final long SOURCE_SCAN_MAX_FILE_BYTES = 768L * 1024L;
    private static final Set<String> SOURCE_SCAN_EXTENSIONS = Set.of(
            ".java", ".kt", ".xml", ".yml", ".yaml", ".properties", ".ts", ".tsx", ".js", ".jsx");
    private static final List<String> SOURCE_SCAN_EXCLUDED_PATH_MARKERS = List.of(
            "src/main/resources/static/react-app/",
            "src/generated/",
            "frontend/dist/",
            "target/",
            "node_modules/",
            "AdminSummaryServiceImpl.java");
    private static final List<Path> SOURCE_SCAN_ROOTS = List.of(
            Paths.get("src/main/java"),
            Paths.get("src/main/resources"),
            Paths.get("frontend/src"));
    private static final List<SourceSecurityRule> SOURCE_SECURITY_RULES = List.of(
            new SourceSecurityRule(
                    "CRITICAL",
                    "source-hardcoded-secret",
                    "source-engine",
                    "HARDCODED_SECRET",
                    "config/secrets",
                    Pattern.compile("(?<![A-Za-z0-9])(password|passwd|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|private[_-]?key)(?![A-Za-z0-9])\\s*[:=]\\s*[\\\"'](?=[^\\\"'\\n]{12,})(?=[^\\\"'\\n]*([0-9]|[_\\-./+=@:$!]))[^\\\"'\\n]+[\\\"']", Pattern.CASE_INSENSITIVE),
                    List.of(".java", ".kt", ".yml", ".yaml", ".properties", ".ts", ".tsx", ".js", ".jsx")),
            new SourceSecurityRule(
                    "CRITICAL",
                    "source-private-key",
                    "source-engine",
                    "PRIVATE_KEY_IN_SOURCE",
                    "config/secrets",
                    Pattern.compile("-----BEGIN\\s+(RSA|EC|OPENSSH|DSA)?\\s*PRIVATE\\s+KEY-----", Pattern.CASE_INSENSITIVE),
                    Collections.emptyList()),
            new SourceSecurityRule(
                    "HIGH",
                    "source-open-redirect",
                    "source-engine",
                    "OPEN_REDIRECT_USER_CONTROLLED",
                    "web-threat",
                    Pattern.compile("sendRedirect\\s*\\([^\\)]*(getParameter|getHeader|getQueryString|request\\.)", Pattern.CASE_INSENSITIVE),
                    List.of(".java", ".kt")),
            new SourceSecurityRule(
                    "HIGH",
                    "source-ssrf",
                    "source-engine",
                    "SSRF_USER_CONTROLLED_URL",
                    "web-threat",
                    Pattern.compile("(new\\s+URL|RestTemplate\\s*\\.|WebClient\\s*\\.|HttpURLConnection)\\s*[^\\n;]*(getParameter|getHeader|getQueryString|request\\.)", Pattern.CASE_INSENSITIVE),
                    List.of(".java", ".kt")),
            new SourceSecurityRule(
                    "HIGH",
                    "source-xss-write",
                    "source-engine",
                    "XSS_UNESCAPED_RESPONSE_WRITE",
                    "web-threat",
                    Pattern.compile("(getWriter\\(\\)\\.write|getWriter\\(\\)\\.print)\\s*\\([^\\)]*(getParameter|request\\.)", Pattern.CASE_INSENSITIVE),
                    List.of(".java", ".kt")),
            new SourceSecurityRule(
                    "HIGH",
                    "source-permit-all",
                    "source-engine",
                    "PERMIT_ALL_WILDCARD",
                    "authorization",
                    Pattern.compile("(antMatchers|requestMatchers)\\s*\\(\\s*\"/\\*\\*\"\\s*\\)\\s*\\.permitAll\\s*\\(", Pattern.CASE_INSENSITIVE),
                    List.of(".java", ".kt")),
            new SourceSecurityRule(
                    "CRITICAL",
                    "source-command-injection-runtime",
                    "source-engine",
                    "COMMAND_INJECTION_RUNTIME_EXEC",
                    "command-exec",
                    Pattern.compile("Runtime\\.getRuntime\\(\\)\\.exec\\s*\\((?!\\s*\\\"[^\\\"]+\\\")", Pattern.CASE_INSENSITIVE),
                    List.of(".java", ".kt")),
            new SourceSecurityRule(
                    "CRITICAL",
                    "source-command-injection-process-builder",
                    "source-engine",
                    "COMMAND_INJECTION_PROCESS_BUILDER",
                    "command-exec",
                    Pattern.compile("new\\s+ProcessBuilder\\s*\\([^\\)]*\\+", Pattern.CASE_INSENSITIVE),
                    List.of(".java", ".kt")),
            new SourceSecurityRule(
                    "HIGH",
                    "source-weak-hash",
                    "source-engine",
                    "WEAK_HASH_ALGO",
                    "crypto",
                    Pattern.compile("MessageDigest\\.getInstance\\(\\s*\\\"(MD5|SHA-1)\\\"\\s*\\)", Pattern.CASE_INSENSITIVE),
                    List.of(".java", ".kt")),
            new SourceSecurityRule(
                    "HIGH",
                    "source-ssl-trust-all",
                    "source-engine",
                    "SSL_TRUST_ALL",
                    "tls",
                    Pattern.compile("(setHostnameVerifier\\s*\\(\\s*\\([^\\)]*\\)\\s*->\\s*true\\s*\\)|X509TrustManager)", Pattern.CASE_INSENSITIVE),
                    List.of(".java", ".kt")),
            new SourceSecurityRule(
                    "MEDIUM",
                    "source-insecure-random",
                    "source-engine",
                    "INSECURE_RANDOM",
                    "crypto",
                    Pattern.compile("new\\s+Random\\s*\\([^\\)]*(token|secret|key|password|otp|nonce)", Pattern.CASE_INSENSITIVE),
                    List.of(".java", ".kt")),
            new SourceSecurityRule(
                    "HIGH",
                    "source-csrf-disabled",
                    "source-engine",
                    "CSRF_DISABLED",
                    "auth",
                    Pattern.compile("csrf\\s*\\(\\s*\\)\\s*\\.disable\\s*\\(", Pattern.CASE_INSENSITIVE),
                    List.of(".java", ".kt")),
            new SourceSecurityRule(
                    "HIGH",
                    "source-path-traversal",
                    "source-engine",
                    "PATH_TRAVERSAL_USER_INPUT_PATH",
                    "path-traversal",
                    Pattern.compile("(new\\s+File|Paths?\\.get)\\s*\\([^\\)]*(getParameter|getHeader|getQueryString|request\\.)", Pattern.CASE_INSENSITIVE),
                    List.of(".java", ".kt")),
            new SourceSecurityRule(
                    "HIGH",
                    "source-insecure-deserialization",
                    "source-engine",
                    "INSECURE_DESERIALIZATION",
                    "serialization",
                    Pattern.compile("new\\s+ObjectInputStream\\s*\\(", Pattern.CASE_INSENSITIVE),
                    List.of(".java", ".kt")),
            new SourceSecurityRule(
                    "HIGH",
                    "source-classloader-user-input",
                    "source-engine",
                    "CLASSLOADER_USER_INPUT",
                    "rce",
                    Pattern.compile("Class\\.forName\\s*\\([^\\)]*(getParameter|getHeader|getQueryString|request\\.)", Pattern.CASE_INSENSITIVE),
                    List.of(".java", ".kt")),
            new SourceSecurityRule(
                    "HIGH",
                    "source-cors-wildcard",
                    "source-engine",
                    "CORS_WILDCARD_ORIGIN",
                    "web-threat",
                    Pattern.compile("(Access-Control-Allow-Origin\\s*[:=]\\s*\\*|allowedOrigins\\s*\\(\\s*\"\\*\"\\s*\\)|setAllowedOrigins\\s*\\([^\\)]*\\*[^\\)]*\\))", Pattern.CASE_INSENSITIVE),
                    List.of(".java", ".kt", ".yml", ".yaml", ".properties")),
            new SourceSecurityRule(
                    "MEDIUM",
                    "source-security-headers-disabled",
                    "source-engine",
                    "SECURITY_HEADERS_DISABLED",
                    "auth",
                    Pattern.compile("(frameOptions\\s*\\(\\s*\\)\\s*\\.disable\\s*\\(|contentSecurityPolicy\\s*\\(\\s*\\)\\s*\\.disable\\s*\\(|xssProtection\\s*\\(\\s*\\)\\s*\\.disable\\s*\\()", Pattern.CASE_INSENSITIVE),
                    List.of(".java", ".kt")),
            new SourceSecurityRule(
                    "HIGH",
                    "source-cookie-httponly-false",
                    "source-engine",
                    "COOKIE_HTTPONLY_FALSE",
                    "auth",
                    Pattern.compile("httpOnly\\s*\\(\\s*false\\s*\\)", Pattern.CASE_INSENSITIVE),
                    List.of(".java", ".kt")),
            new SourceSecurityRule(
                    "MEDIUM",
                    "source-cookie-secure-false",
                    "source-engine",
                    "COOKIE_SECURE_FALSE",
                    "auth",
                    Pattern.compile("secure\\s*\\(\\s*false\\s*\\)", Pattern.CASE_INSENSITIVE),
                    List.of(".java", ".kt")),
            new SourceSecurityRule(
                    "MEDIUM",
                    "source-credential-logging",
                    "source-engine",
                    "POTENTIAL_CREDENTIAL_LOGGING",
                    "secrets",
                    Pattern.compile("(log\\.(info|debug|warn|error)|System\\.out\\.println)\\s*\\([^\\)]*(password|passwd|token|secret|authorization)", Pattern.CASE_INSENSITIVE),
                    List.of(".java", ".kt")),
            new SourceSecurityRule(
                    "HIGH",
                    "source-xxe-risk",
                    "source-engine",
                    "XML_EXTERNAL_ENTITY_RISK",
                    "xxe",
                    Pattern.compile("(DocumentBuilderFactory\\.newInstance\\s*\\(|SAXParserFactory\\.newInstance\\s*\\(|XMLInputFactory\\.newFactory\\s*\\()", Pattern.CASE_INSENSITIVE),
                    List.of(".java", ".kt")),
            new SourceSecurityRule(
                    "MEDIUM",
                    "source-yaml-unsafe-load",
                    "source-engine",
                    "YAML_UNSAFE_LOAD",
                    "deserialization",
                    Pattern.compile("new\\s+Yaml\\s*\\(\\s*\\)\\s*;?", Pattern.CASE_INSENSITIVE),
                    List.of(".java", ".kt")),
            new SourceSecurityRule(
                    "HIGH",
                    "source-aws-access-key",
                    "source-engine",
                    "AWS_ACCESS_KEY_EXPOSED",
                    "config/secrets",
                    Pattern.compile("AKIA[0-9A-Z]{16}", Pattern.CASE_INSENSITIVE),
                    Collections.emptyList()),
            new SourceSecurityRule(
                    "CRITICAL",
                    "source-sql-injection-concat",
                    "source-engine",
                    "SQL_INJECTION_STRING_CONCAT",
                    "db/query",
                    Pattern.compile("(jdbcTemplate\\.(query|update|execute)|createNativeQuery|createQuery|prepareStatement|execute(Query|Update))\\s*\\([^\\n;]*\\+", Pattern.CASE_INSENSITIVE),
                    List.of(".java", ".kt")),
            new SourceSecurityRule(
                    "HIGH",
                    "source-jdbc-without-ssl",
                    "source-engine",
                    "JDBC_URL_WITHOUT_SSL",
                    "db/transport",
                    Pattern.compile("jdbc:(mysql|postgresql|mariadb|sqlserver):[^\\\"'\\n]*(?<!useSSL=false)(?<!sslmode=disable)(?<!encrypt=false)[\\\"'\\n]?", Pattern.CASE_INSENSITIVE),
                    List.of(".java", ".kt", ".yml", ".yaml", ".properties", ".xml")),
            new SourceSecurityRule(
                    "HIGH",
                    "source-password-query-param",
                    "source-engine",
                    "PASSWORD_IN_QUERY_PARAM",
                    "web-threat",
                    Pattern.compile("(\\?|&)(password|passwd)=|getParameter\\s*\\(\\s*\\\"(password|passwd)\\\"\\s*\\)", Pattern.CASE_INSENSITIVE),
                    List.of(".java", ".kt", ".properties", ".yml", ".yaml")),
            new SourceSecurityRule(
                    "HIGH",
                    "source-trust-all-hostname-verifier",
                    "source-engine",
                    "TRUST_ALL_HOSTNAME_VERIFIER",
                    "tls",
                    Pattern.compile("HostnameVerifier\\s*\\{[^\\n]*return\\s+true\\s*;|setHostnameVerifier\\s*\\(\\s*\\([^\\)]*\\)\\s*->\\s*true\\s*\\)", Pattern.CASE_INSENSITIVE),
                    List.of(".java", ".kt")),
            new SourceSecurityRule(
                    "MEDIUM",
                    "source-directory-listing",
                    "source-engine",
                    "POTENTIAL_DIRECTORY_LISTING",
                    "path-traversal",
                    Pattern.compile("(new\\s+File\\s*\\([^\\)]*\\)\\s*\\.listFiles\\s*\\()", Pattern.CASE_INSENSITIVE),
                    List.of(".java", ".kt")),
            new SourceSecurityRule(
                    "HIGH",
                    "source-file-upload-path-escape",
                    "source-engine",
                    "FILE_UPLOAD_PATH_ESCAPE",
                    "file-upload",
                    Pattern.compile("(transferTo|Files\\.copy|Paths?\\.get)\\s*\\([^\\)]*(getOriginalFilename|getParameter|request\\.)", Pattern.CASE_INSENSITIVE),
                    List.of(".java", ".kt")),
            new SourceSecurityRule(
                    "MEDIUM",
                    "source-log-pii",
                    "source-engine",
                    "LOG_PII_EXPOSURE",
                    "privacy",
                    Pattern.compile("(log\\.(info|debug|warn|error)|System\\.out\\.println)\\s*\\([^\\)]*(rrn|resident|email|phone|mobile|birth)", Pattern.CASE_INSENSITIVE),
                    List.of(".java", ".kt")),
            new SourceSecurityRule(
                    "MEDIUM",
                    "source-plain-http-callback",
                    "source-engine",
                    "PLAIN_HTTP_CALLBACK",
                    "web-threat",
                    Pattern.compile("(callback|webhook|redirect|returnUrl|endpoint)[^\\n:=]{0,40}[:=]\\s*[\\\"']http://(?!localhost|127\\.0\\.0\\.1)[^\\\"'\\s]+", Pattern.CASE_INSENSITIVE),
                    List.of(".java", ".kt", ".yml", ".yaml", ".properties", ".xml", ".ts", ".tsx", ".js", ".jsx")),
            new SourceSecurityRule(
                    "MEDIUM",
                    "source-exposed-internal-host",
                    "source-engine",
                    "EXPOSED_INTERNAL_HOST",
                    "network",
                    Pattern.compile("(baseUrl|publicHost|callbackUrl|redirectUrl|webhookUrl)[^\\n:=]{0,40}[:=]\\s*[\\\"'](10\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}|192\\.168\\.\\d{1,3}\\.\\d{1,3}|172\\.(1[6-9]|2\\d|3[0-1])\\.\\d{1,3}\\.\\d{1,3})", Pattern.CASE_INSENSITIVE),
                    List.of(".java", ".kt", ".yml", ".yaml", ".properties", ".xml")),
            new SourceSecurityRule(
                    "HIGH",
                    "source-weak-csrf-exemption-scope",
                    "source-engine",
                    "WEAK_CSRF_EXEMPTION_SCOPE",
                    "auth",
                    Pattern.compile("ignoring(RequestMatchers|AntMatchers)\\s*\\(\\s*\"/\\*\\*\"\\s*\\)|csrf[^\\n;]*ignoring(RequestMatchers|AntMatchers)\\s*\\(\\s*\"/\\*\\*\"\\s*\\)", Pattern.CASE_INSENSITIVE),
                    List.of(".java", ".kt")),
            new SourceSecurityRule(
                    "MEDIUM",
                    "source-overbroad-exception-handling",
                    "source-engine",
                    "OVERBROAD_EXCEPTION_HANDLING",
                    "error-handling",
                    Pattern.compile("catch\\s*\\(\\s*Exception\\s+[A-Za-z_][A-Za-z0-9_]*\\s*\\)\\s*\\{\\s*(//.*)?\\s*\\}|catch\\s*\\(\\s*Exception\\s+[A-Za-z_][A-Za-z0-9_]*\\s*\\)\\s*\\{[^\\}]*ignored[^\\}]*\\}", Pattern.CASE_INSENSITIVE | Pattern.DOTALL),
                    List.of(".java", ".kt")));

    private final RequestExecutionLogService requestExecutionLogService;
    private final AdminSummarySnapshotMapper adminSummarySnapshotMapper;
    private final AuthGroupManageMapper authGroupManageMapper;
    private final AdminNotificationHistoryMapper adminNotificationHistoryMapper;
    private final ObjectProvider<BlocklistPersistenceService> blocklistPersistenceServiceProvider;
    private final ObjectMapper objectMapper;
    private volatile SourceScanSnapshot cachedSourceScanSnapshot;

    public AdminSummaryServiceImpl(RequestExecutionLogService requestExecutionLogService,
            AdminSummarySnapshotMapper adminSummarySnapshotMapper,
            AuthGroupManageMapper authGroupManageMapper,
            AdminNotificationHistoryMapper adminNotificationHistoryMapper,
            ObjectProvider<BlocklistPersistenceService> blocklistPersistenceServiceProvider,
            ObjectMapper objectMapper) {
        this.requestExecutionLogService = requestExecutionLogService;
        this.adminSummarySnapshotMapper = adminSummarySnapshotMapper;
        this.authGroupManageMapper = authGroupManageMapper;
        this.adminNotificationHistoryMapper = adminNotificationHistoryMapper;
        this.blocklistPersistenceServiceProvider = blocklistPersistenceServiceProvider;
        this.objectMapper = objectMapper;
    }

    @Override
    public EmissionResultFilterSnapshot buildEmissionResultFilterSnapshot(boolean isEn,
            String keyword,
            String normalizedResultStatus,
            String normalizedVerificationStatus) {
        return filterEmissionResultSummaryViews(buildEmissionResultSummaryViews(isEn),
                safeString(keyword).toLowerCase(Locale.ROOT),
                safeString(normalizedResultStatus).toUpperCase(Locale.ROOT),
                safeString(normalizedVerificationStatus).toUpperCase(Locale.ROOT));
    }

    @Override
    public FeatureCatalogSummarySnapshot summarizeFeatureCatalog(List<FeatureCatalogSectionVO> featureSections) {
        if (featureSections == null || featureSections.isEmpty()) {
            return FeatureCatalogSummarySnapshot.empty();
        }
        int totalFeatureCount = 0;
        int unassignedFeatureCount = 0;
        for (FeatureCatalogSectionVO section : featureSections) {
            if (section == null || section.getFeatures() == null || section.getFeatures().isEmpty()) {
                continue;
            }
            for (FeatureCatalogItemVO feature : section.getFeatures()) {
                if (feature == null) {
                    continue;
                }
                totalFeatureCount++;
                if (feature.isUnassignedToRole()) {
                    unassignedFeatureCount++;
                }
            }
        }
        return new FeatureCatalogSummarySnapshot(totalFeatureCount, unassignedFeatureCount);
    }

    @Override
    public List<Map<String, String>> getIpWhitelistSummary(boolean isEn) {
        return loadCardSnapshot("IP_WHITELIST_SUMMARY", isEn, defaultIpWhitelistSummary(isEn));
    }

    @Override
    public List<Map<String, String>> getSecurityPolicySummary(boolean isEn) {
        return loadCardSnapshot("SECURITY_POLICY_SUMMARY", isEn, defaultSecurityPolicySummary(isEn));
    }

    @Override
    public List<Map<String, String>> getSecurityMonitoringCards(boolean isEn) {
        List<RequestExecutionLogVO> logs = loadSecurityMonitoringLogs();
        if (logs.isEmpty()) {
            return List.of(
                    summaryCard(isEn ? "Current RPS" : "현재 RPS", "0",
                            isEn ? "Combined HTTP requests per second across external ingress." : "외부 인입 전체 기준 초당 요청 수"),
                    summaryCard(isEn ? "Blocked Requests" : "차단 요청", "0",
                            isEn ? "Requests blocked in the last 5 minutes." : "최근 5분간 차단된 요청 수"),
                    summaryCard(isEn ? "429 Responses" : "429 응답", "0",
                            isEn ? "Rate-limit responses in the last 5 minutes." : "최근 5분간 rate-limit 응답 수"),
                    summaryCard(isEn ? "Active Incidents" : "활성 인시던트", "0",
                            isEn ? "Incidents requiring operator review." : "운영자 확인이 필요한 현재 공격 이벤트"));
        }

        long blockedRequests = logs.stream()
                .filter(item -> item != null && item.getResponseStatus() >= 400)
                .count();
        long tooManyRequests = logs.stream()
                .filter(item -> item != null && item.getResponseStatus() == 429)
                .count();
        long activeIncidents = logs.stream()
                .filter(this::isSecurityMonitoringEventCandidate)
                .limit(20)
                .count();

        return List.of(
                summaryCard(isEn ? "Current RPS" : "현재 RPS", String.valueOf(logs.size()),
                        isEn ? "Combined HTTP requests per second across external ingress." : "외부 인입 전체 기준 초당 요청 수"),
                summaryCard(isEn ? "Blocked Requests" : "차단 요청", String.valueOf(blockedRequests),
                        isEn ? "Requests blocked in the last 5 minutes." : "최근 5분간 차단된 요청 수"),
                summaryCard(isEn ? "429 Responses" : "429 응답", String.valueOf(tooManyRequests),
                        isEn ? "Rate-limit responses in the last 5 minutes." : "최근 5분간 rate-limit 응답 수"),
                summaryCard(isEn ? "Active Incidents" : "활성 인시던트", String.valueOf(activeIncidents),
                        isEn ? "Incidents requiring operator review." : "운영자 확인이 필요한 현재 공격 이벤트"));
    }

    @Override
    public List<Map<String, String>> getSecurityMonitoringTargets(boolean isEn) {
        List<RequestExecutionLogVO> logs = loadSecurityMonitoringLogs();
        if (logs.isEmpty()) {
            return Collections.emptyList();
        }
        Map<String, Integer> counts = new LinkedHashMap<>();
        Map<String, Integer> maxStatus = new LinkedHashMap<>();
        for (RequestExecutionLogVO item : logs) {
            String requestUri = safeString(item.getRequestUri());
            if (requestUri.isEmpty()) {
                continue;
            }
            counts.merge(requestUri, 1, Integer::sum);
            maxStatus.merge(requestUri, item.getResponseStatus(), Math::max);
        }
        return counts.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .limit(5)
                .map(entry -> {
                    int status = maxStatus.getOrDefault(entry.getKey(), 200);
                    return mapOf(
                            "url", entry.getKey(),
                            "rps", String.valueOf(entry.getValue()),
                            "status", resolveMonitoringTargetStatus(status, isEn),
                            "rule", resolveMonitoringRuleLabel(entry.getKey(), status, isEn));
                })
                .collect(Collectors.toList());
    }

    @Override
    public List<Map<String, String>> getSecurityMonitoringIps(boolean isEn) {
        List<RequestExecutionLogVO> logs = loadSecurityMonitoringLogs();
        if (logs.isEmpty()) {
            return Collections.emptyList();
        }
        Map<String, Integer> counts = new LinkedHashMap<>();
        Map<String, Integer> maxStatus = new LinkedHashMap<>();
        for (RequestExecutionLogVO item : logs) {
            String remoteAddr = firstNonBlank(safeString(item.getRemoteAddr()), "-");
            counts.merge(remoteAddr, 1, Integer::sum);
            maxStatus.merge(remoteAddr, item.getResponseStatus(), Math::max);
        }
        return counts.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .limit(5)
                .map(entry -> {
                    int status = maxStatus.getOrDefault(entry.getKey(), 200);
                    return mapOf(
                            "ip", entry.getKey(),
                            "country", "-",
                            "requestCount", String.valueOf(entry.getValue()),
                            "action", resolveMonitoringIpAction(status, isEn));
                })
                .collect(Collectors.toList());
    }

    @Override
    public List<Map<String, String>> getSecurityMonitoringEvents(boolean isEn) {
        List<RequestExecutionLogVO> logs = loadSecurityMonitoringLogs();
        if (logs.isEmpty()) {
            return Collections.emptyList();
        }
        return logs.stream()
                .filter(this::isSecurityMonitoringEventCandidate)
                .limit(20)
                .map(item -> mapOf(
                        "detectedAt", safeString(item.getExecutedAt()),
                        "title", buildSecurityMonitoringEventTitle(item, isEn),
                        "detail", buildSecurityMonitoringEventDetail(item, isEn),
                        "severity", resolveMonitoringSeverity(item)))
                .collect(Collectors.toList());
    }

    @Override
    public List<Map<String, String>> mergeSecurityMonitoringEventState(List<Map<String, String>> rows, boolean isEn) {
        Map<String, Map<String, String>> stateMap = loadSecurityMonitoringStateMap(isEn);
        List<Map<String, String>> mergedRows = new ArrayList<>();
        for (Map<String, String> row : rows == null ? Collections.<Map<String, String>>emptyList() : rows) {
            if (row == null) {
                continue;
            }
            Map<String, String> merged = new LinkedHashMap<>(row);
            String fingerprint = buildSecurityMonitoringFingerprint(row);
            Map<String, String> state = stateMap.getOrDefault(fingerprint, Collections.emptyMap());
            merged.put("fingerprint", fingerprint);
            merged.put("stateStatus", safeString(state.get("status")));
            merged.put("stateOwner", safeString(state.get("owner")));
            merged.put("stateNote", safeString(state.get("note")));
            merged.put("stateUpdatedAt", safeString(state.get("updatedAt")));
            merged.put("stateUpdatedBy", safeString(state.get("updatedBy")));
            mergedRows.add(merged);
        }
        return mergedRows;
    }

    @Override
    public List<Map<String, String>> getSecurityMonitoringActivityRows(boolean isEn) {
        return readSnapshotCards(snapshotKey("SECURITY_MONITORING_ACTIVITY", isEn));
    }

    @Override
    public List<Map<String, String>> getSecurityMonitoringBlockCandidateRows(boolean isEn) {
        return readSnapshotCards(snapshotKey("SECURITY_MONITORING_BLOCKLIST", isEn));
    }

    @Override
    public List<Map<String, String>> getSecurityHistoryActionRows(boolean isEn) {
        return readSnapshotCards(snapshotKey("SECURITY_HISTORY_ACTIONS", isEn));
    }

    @Override
    public List<Map<String, String>> getBlocklistSummary(boolean isEn) {
        List<Map<String, String>> rows = getBlocklistRows(isEn);
        long activeCount = rows.stream()
                .filter(row -> "ACTIVE".equalsIgnoreCase(safeString(row.get("status"))))
                .count();
        long reviewCount = rows.stream()
                .filter(row -> "REVIEW".equalsIgnoreCase(safeString(row.get("status"))))
                .count();
        long releasedTodayCount = rows.stream()
                .filter(row -> "RELEASED".equalsIgnoreCase(safeString(row.get("status"))))
                .map(row -> parseSnapshotTimestamp(firstNonBlank(safeString(row.get("reviewedAt")), safeString(row.get("releasedAt")))))
                .filter(Objects::nonNull)
                .filter(timestamp -> LocalDate.now().equals(timestamp.toLocalDate()))
                .count();
        long monitoredCount = rows.stream()
                .filter(row -> "MONITORING".equalsIgnoreCase(safeString(row.get("source"))))
                .count();
        List<Map<String, String>> summary = new ArrayList<>();
        summary.add(summaryCard(
                isEn ? "Active Blocks" : "활성 차단",
                String.valueOf(activeCount),
                isEn ? "Currently enforced block targets persisted from monitoring escalations." : "모니터링 승격에서 영속화된 현재 활성 차단 대상 수"));
        summary.add(summaryCard(
                isEn ? "Review Queue" : "검토 대기",
                String.valueOf(reviewCount),
                isEn ? "Candidates waiting for operator activation or release decision." : "운영자 활성화 또는 해제 판단을 기다리는 후보 수"));
        summary.add(summaryCard(
                isEn ? "Releases Today" : "오늘 해제",
                String.valueOf(releasedTodayCount),
                isEn ? "Blocks released today based on persisted review history." : "영속화된 검토 이력 기준 오늘 해제된 차단 수"));
        summary.add(summaryCard(
                isEn ? "Monitoring Rows" : "모니터링 연계",
                String.valueOf(monitoredCount),
                isEn ? "Rows linked to monitoring source events in the persisted blocklist." : "원본 모니터링 이벤트와 연결된 영속 blocklist 행 수"));
        return summary;
    }

    @Override
    public List<Map<String, String>> getBlocklistRows(boolean isEn) {
        List<Map<String, String>> persistedRows = selectPersistedBlocklistRows();
        if (!persistedRows.isEmpty()) {
            return persistedRows.stream()
                    .map(row -> normalizeBlocklistRow(row, isEn))
                    .sorted(this::compareBlocklistRowsNewestFirst)
                    .collect(Collectors.toList());
        }
        return getSecurityMonitoringBlockCandidateRows(isEn).stream()
                .map(row -> normalizeBlocklistRow(row, isEn))
                .sorted(this::compareBlocklistRowsNewestFirst)
                .collect(Collectors.toList());
    }

    @Override
    public List<Map<String, String>> getBlocklistReleaseQueue(boolean isEn) {
        return getBlocklistRows(isEn).stream()
                .filter(row -> {
                    String status = safeString(row.get("status")).toUpperCase(Locale.ROOT);
                    return "REVIEW".equals(status)
                            || ("ACTIVE".equals(status) && !safeString(row.get("expiresAt")).isEmpty());
                })
                .map(row -> {
                    Map<String, String> item = new LinkedHashMap<>();
                    item.put("target", safeString(row.get("target")));
                    item.put("releaseAt", safeString(row.get("expiresAt")));
                    item.put("condition", buildBlocklistReleaseCondition(row, isEn));
                    item.put("source", firstNonBlank(safeString(row.get("source")), "monitoring"));
                    return item;
                })
                .sorted(this::compareBlocklistReleaseQueueRows)
                .collect(Collectors.toList());
    }

    @Override
    public List<Map<String, String>> getBlocklistReleaseHistory(boolean isEn) {
        List<Map<String, String>> persistedHistory = selectPersistedBlocklistActionRows().stream()
                .filter(row -> "RELEASED".equalsIgnoreCase(safeString(row.get("status")))
                        || "RELEASE".equalsIgnoreCase(safeString(row.get("actionType"))))
                .map(row -> {
                    Map<String, String> item = new LinkedHashMap<>();
                    item.put("blockId", safeString(row.get("blockId")));
                    item.put("target", safeString(row.get("target")));
                    item.put("reason", firstNonBlank(safeString(row.get("detail")), safeString(row.get("detailEn"))));
                    item.put("releasedAt", safeString(row.get("actionAt")));
                    item.put("releasedBy", firstNonBlank(safeString(row.get("actorName")), safeString(row.get("actorId"))));
                    item.put("source", firstNonBlank(safeString(row.get("source")), "monitoring"));
                    return item;
                })
                .collect(Collectors.toList());
        if (!persistedHistory.isEmpty()) {
            return persistedHistory.stream()
                    .sorted((left, right) -> Long.compare(
                            blocklistTimestampValue(right.get("releasedAt")),
                            blocklistTimestampValue(left.get("releasedAt"))))
                    .collect(Collectors.toList());
        }
        return getBlocklistRows(isEn).stream()
                .filter(row -> "RELEASED".equalsIgnoreCase(safeString(row.get("status"))))
                .map(row -> {
                    Map<String, String> item = new LinkedHashMap<>();
                    item.put("blockId", safeString(row.get("blockId")));
                    item.put("target", safeString(row.get("target")));
                    item.put("reason", safeString(row.get("reason")));
                    item.put("releasedAt", firstNonBlank(safeString(row.get("reviewedAt")), safeString(row.get("releasedAt"))));
                    item.put("releasedBy", firstNonBlank(safeString(row.get("reviewedBy")), safeString(row.get("owner"))));
                    item.put("source", firstNonBlank(safeString(row.get("source")), "monitoring"));
                    return item;
                })
                .sorted((left, right) -> Long.compare(
                        blocklistTimestampValue(right.get("releasedAt")),
                        blocklistTimestampValue(left.get("releasedAt"))))
                .collect(Collectors.toList());
    }


    @Override
    public SecurityAuditSnapshot loadSecurityAuditSnapshot() {
        try {
            List<RequestExecutionLogVO> auditLogs = new ArrayList<>();
            SecurityAuditAggregate aggregate = new SecurityAuditAggregate();
            RequestExecutionLogPage auditPage = requestExecutionLogService.searchRecent(this::isSecurityAuditTarget, 1, 300);
            for (RequestExecutionLogVO item : auditPage.getItems()) {
                auditLogs.add(item);
                aggregate.accept(item);
            }
            return new SecurityAuditSnapshot(auditLogs, aggregate);
        } catch (Exception e) {
            log.warn("Failed to load request execution logs for security audit.", e);
            return SecurityAuditSnapshot.empty();
        }
    }

    @Override
    public List<Map<String, String>> getSecurityAuditSummary(SecurityAuditSnapshot auditSnapshot, boolean isEn) {
        String snapshotKey = snapshotKey("SECURITY_AUDIT_SUMMARY", isEn);
        List<Map<String, String>> persisted = readSnapshotCards(snapshotKey);
        if (!persisted.isEmpty()) {
            return persisted;
        }
        List<Map<String, String>> rows = buildSecurityAuditSummaryRows(auditSnapshot, isEn);
        persistSnapshot(snapshotKey, rows, SNAPSHOT_TYPE_AUDIT_SUMMARY, resolveLatestAuditTimestamp(auditSnapshot));
        return rows;
    }

    @Override
    public List<Map<String, String>> buildSecurityAuditRows(List<RequestExecutionLogVO> auditLogs, boolean isEn) {
        if (auditLogs == null || auditLogs.isEmpty()) {
            return Collections.emptyList();
        }
        return auditLogs.stream()
                .limit(50)
                .map(item -> mapOf(
                        "auditAt", safeString(item.getExecutedAt()),
                        "actor", resolveSecurityAuditActor(item),
                        "action", resolveSecurityAuditAction(item, isEn),
                        "target", safeString(item.getRequestUri()),
                        "detail", resolveSecurityAuditDetail(item, isEn),
                        "traceId", safeString(item.getTraceId()),
                        "requestId", safeString(item.getRequestId()),
                        "httpMethod", safeString(item.getHttpMethod()),
                        "responseStatus", String.valueOf(item.getResponseStatus()),
                        "durationMs", String.valueOf(item.getDurationMs()),
                        "remoteAddr", safeString(item.getRemoteAddr()),
                        "queryString", safeString(item.getQueryString()),
                        "parameterSummary", safeString(item.getParameterSummary()),
                        "errorMessage", safeString(item.getErrorMessage())))
                .collect(Collectors.toList());
    }

    @Override
    public List<Map<String, String>> getSchedulerSummary(boolean isEn) {
        return loadCardSnapshot("SCHEDULER_SUMMARY", isEn, defaultSchedulerSummary(isEn));
    }

    @Override
    public Map<String, Object> buildMenuPermissionDiagnosticSummary(boolean isEn) {
        Map<String, Object> response = new LinkedHashMap<>();
        try {
            List<Map<String, String>> menuUrlRows = authGroupManageMapper.selectActiveMenuUrlRows();
            List<Map<String, String>> viewFeatureRows = authGroupManageMapper.selectActiveMenuViewFeatureRows();
            List<Map<String, String>> duplicatedMenuUrls = buildDuplicatedMenuUrlRows(menuUrlRows);
            List<Map<String, String>> duplicatedViewMappings = enrichDuplicatedViewMappingRows(buildDuplicatedViewMappingRows(viewFeatureRows));
            List<Map<String, String>> menusMissingView = buildMenusMissingViewRows(authGroupManageMapper.selectActiveMenusMissingViewRows(), isEn);
            List<Map<String, String>> inactiveAuthorFeatureRelations = buildInactiveAuthorFeatureRelationRows(
                    authGroupManageMapper.selectInactiveAuthorFeatureRelationRows(),
                    isEn);
            List<Map<String, String>> inactiveUserOverrides = buildInactiveUserOverrideRows(
                    authGroupManageMapper.selectInactiveUserFeatureOverrideRows(),
                    isEn);
            List<Map<String, String>> sensitiveRoleExposures = buildSensitiveRoleExposureRows(
                    authGroupManageMapper.selectSensitiveFeatureRoleExposureRows(),
                    isEn,
                    false);
            List<Map<String, String>> companyScopeSensitiveExposures = buildSensitiveRoleExposureRows(
                    authGroupManageMapper.selectCompanyScopeSensitiveFeatureExposureRows(),
                    isEn,
                    true);
            int integrityIssueCount = menusMissingView.size()
                    + inactiveAuthorFeatureRelations.size()
                    + inactiveUserOverrides.size();
            int highRiskExposureCount = sensitiveRoleExposures.size();
            int scopeViolationCount = companyScopeSensitiveExposures.size();
            response.put("generatedAt", java.time.LocalDateTime.now().toString());
            response.put("menuUrlDuplicateCount", duplicatedMenuUrls.size());
            response.put("viewFeatureDuplicateCount", duplicatedViewMappings.size());
            response.put("cleanupRecommendationCount", duplicatedMenuUrls.size() + duplicatedViewMappings.size());
            response.put("duplicatedMenuUrls", duplicatedMenuUrls);
            response.put("duplicatedViewMappings", duplicatedViewMappings);
            response.put("autoCleanupExecutableCount", duplicatedMenuUrls.size());
            response.put("codexReviewRequiredCount", duplicatedViewMappings.size());
            response.put("integrityIssueCount", integrityIssueCount);
            response.put("highRiskExposureCount", highRiskExposureCount);
            response.put("scopeViolationCount", scopeViolationCount);
            response.put("menusMissingView", menusMissingView);
            response.put("inactiveAuthorFeatureRelations", inactiveAuthorFeatureRelations);
            response.put("inactiveUserOverrides", inactiveUserOverrides);
            response.put("sensitiveRoleExposures", sensitiveRoleExposures);
            response.put("companyScopeSensitiveExposures", companyScopeSensitiveExposures);
            Map<String, Object> securityInsight = buildSecurityInsightSummary(
                    duplicatedMenuUrls,
                    duplicatedViewMappings,
                    menusMissingView,
                    inactiveAuthorFeatureRelations,
                    inactiveUserOverrides,
                    sensitiveRoleExposures,
                    companyScopeSensitiveExposures,
                    isEn);
            response.putAll(securityInsight);
            boolean healthy = duplicatedMenuUrls.isEmpty()
                    && duplicatedViewMappings.isEmpty()
                    && integrityIssueCount == 0
                    && highRiskExposureCount == 0
                    && scopeViolationCount == 0;
            response.put("message", healthy
                    ? (isEn
                        ? "No duplicate, integrity, or high-risk permission issue was found."
                        : "중복, 무결성, 고위험 권한 이슈가 감지되지 않았습니다.")
                    : (isEn
                        ? "Duplicate, integrity, or high-risk permission issues were detected."
                        : "중복, 무결성 또는 고위험 권한 이슈가 감지되었습니다."));
        } catch (Exception e) {
            log.warn("Failed to build menu permission diagnostic summary.", e);
            response.put("generatedAt", java.time.LocalDateTime.now().toString());
            response.put("menuUrlDuplicateCount", 0);
            response.put("viewFeatureDuplicateCount", 0);
            response.put("cleanupRecommendationCount", 0);
            response.put("duplicatedMenuUrls", Collections.emptyList());
            response.put("duplicatedViewMappings", Collections.emptyList());
            response.put("integrityIssueCount", 0);
            response.put("highRiskExposureCount", 0);
            response.put("scopeViolationCount", 0);
            response.put("menusMissingView", Collections.emptyList());
            response.put("inactiveAuthorFeatureRelations", Collections.emptyList());
            response.put("inactiveUserOverrides", Collections.emptyList());
            response.put("sensitiveRoleExposures", Collections.emptyList());
            response.put("companyScopeSensitiveExposures", Collections.emptyList());
            response.put("message", isEn
                    ? "Failed to collect menu permission diagnostics."
                    : "메뉴 권한 진단 정보를 수집하지 못했습니다.");
        }
        return response;
    }

    private Map<String, Object> buildSecurityInsightSummary(
            List<Map<String, String>> duplicatedMenuUrls,
            List<Map<String, String>> duplicatedViewMappings,
            List<Map<String, String>> menusMissingView,
            List<Map<String, String>> inactiveAuthorFeatureRelations,
            List<Map<String, String>> inactiveUserOverrides,
            List<Map<String, String>> sensitiveRoleExposures,
            List<Map<String, String>> companyScopeSensitiveExposures,
            boolean isEn) {
        List<Map<String, String>> items = new ArrayList<>();
        SourceScanSnapshot sourceScanSnapshot = collectSourceSecurityFindings(isEn);
        items.addAll(buildDuplicateMenuThreatRows(duplicatedMenuUrls, isEn));
        items.addAll(buildDuplicateViewThreatRows(duplicatedViewMappings, isEn));
        items.addAll(buildMissingViewThreatRows(menusMissingView, isEn));
        items.addAll(buildInactiveGrantThreatRows(inactiveAuthorFeatureRelations, inactiveUserOverrides, isEn));
        items.addAll(buildSensitiveExposureThreatRows(sensitiveRoleExposures, companyScopeSensitiveExposures, isEn));
        items.addAll(sourceScanSnapshot.items());
        items.addAll(buildOperationalHeuristicThreatRows(
                duplicatedMenuUrls,
                duplicatedViewMappings,
                inactiveAuthorFeatureRelations,
                sensitiveRoleExposures,
                companyScopeSensitiveExposures,
                isEn));
        SecurityInsightStateSnapshot stateSnapshot = loadSecurityInsightStateSnapshot(isEn);
        Map<String, Map<String, String>> stateMap = stateSnapshot.stateMap();
        items.replaceAll(item -> mergeSecurityInsightState(item, stateMap.get(buildSecurityInsightFingerprint(item))));
        items.sort(Comparator
                .comparing((Map<String, String> row) -> severityWeight(safeString(row.get("severity")))).reversed()
                .thenComparing(row -> safeString(row.get("category")))
                .thenComparing(row -> safeString(row.get("target"))));

        int criticalCount = 0;
        int highCount = 0;
        int mediumCount = 0;
        int lowCount = 0;
        int actionRequiredCount = 0;
        for (Map<String, String> item : items) {
            String severity = safeString(item.get("severity")).toUpperCase(Locale.ROOT);
            if ("CRITICAL".equals(severity)) {
                criticalCount++;
            } else if ("HIGH".equals(severity)) {
                highCount++;
            } else if ("MEDIUM".equals(severity)) {
                mediumCount++;
            } else {
                lowCount++;
            }
            if ("Y".equalsIgnoreCase(safeString(item.get("actionRequired")))) {
                actionRequiredCount++;
            }
        }
        String generatedAt = formatSnapshotTimestamp(LocalDateTime.now());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("securityInsightItems", items);
        response.put("securityInsightTotal", items.size());
        response.put("securityInsightActionRequiredCount", actionRequiredCount);
        response.put("securityInsightGradeCounts", Map.of(
                "critical", criticalCount,
                "high", highCount,
                "medium", mediumCount,
                "low", lowCount));
        response.put("securityInsightGate", Map.of(
                "blocked", criticalCount > 0 || highCount > 0,
                "newCritical", criticalCount,
                "newHigh", highCount,
                "gateCritical", true,
                "gateHigh", true));
        response.put("securityInsightConfig", Map.of(
                "includeEventEngine", true,
                "includeExternalEngine", true,
                "newOnlyMode", false,
                "baselineCount", 0,
                "profile", highCount > 0 || criticalCount > 0 ? "strict" : "balanced",
                "sourceScanEnabled", true,
                "lastScanAt", sourceScanSnapshot.scannedAt().toString(),
                "cachedItems", items.size(),
                "gateCritical", true,
                "gateHigh", true));
        response.put("securityInsightExplorer", Map.of(
                "running", false,
                "mode", "source+governance",
                "phase", items.isEmpty() ? "idle" : "prioritized",
                "etaSeconds", 0,
                "scannedFiles", sourceScanSnapshot.scannedFiles(),
                "totalFiles", sourceScanSnapshot.totalFiles(),
                "matchedCount", items.size(),
                "elapsedSeconds", 0,
                "currentTarget", firstNonBlank(sourceScanSnapshot.currentTarget(), items.isEmpty() ? "-" : safeString(items.get(0).get("target")))));
        response.put("securityInsightMessage", items.isEmpty()
                ? (isEn ? "No security governance finding was detected." : "보안 거버넌스 탐지 항목이 없습니다.")
                : (isEn ? "Security governance and source-scan findings were detected and prioritized." : "보안 거버넌스와 소스 스캔 탐지 항목을 우선순위화했습니다."));
        response.put("securityInsightHistoryRows", mergeSecurityInsightHistoryRows(
                items,
                sourceScanSnapshot,
                criticalCount,
                highCount,
                mediumCount,
                lowCount,
                actionRequiredCount,
                isEn,
                generatedAt));
        response.put("securityInsightActivityRows", readSnapshotCards(snapshotKey("SECURITY_INSIGHT_ACTIVITY", isEn)));
        response.put("securityInsightDeliveryRows", readSnapshotCards(snapshotKey("SECURITY_INSIGHT_DELIVERY", isEn)));
        response.put("securityInsightStateSummary", summarizeSecurityInsightState(items, stateSnapshot));
        response.put("securityInsightNotificationConfig", readSecurityInsightNotificationConfig(isEn));
        return response;
    }

    private SecurityInsightStateSnapshot loadSecurityInsightStateSnapshot(boolean isEn) {
        return loadSecurityInsightStateSnapshot(isEn, true);
    }

    private SecurityInsightStateSnapshot loadSecurityInsightStateSnapshot(boolean isEn, boolean persistExpiredCleanup) {
        String snapshotKey = snapshotKey("SECURITY_INSIGHT_STATE", isEn);
        List<Map<String, String>> rows = readSnapshotCards(snapshotKey);
        List<Map<String, String>> normalizedRows = new ArrayList<>();
        Map<String, Map<String, String>> map = new LinkedHashMap<>();
        int temporarySuppressionCount = 0;
        int expiredSuppressionCount = 0;
        boolean changed = false;
        for (Map<String, String> row : rows) {
            Map<String, String> normalized = new LinkedHashMap<>(row);
            if ("Y".equalsIgnoreCase(safeString(normalized.get("suppressed")))) {
                String expiresAt = safeString(normalized.get("expiresAt"));
                if (!expiresAt.isEmpty()) {
                    temporarySuppressionCount++;
                    LocalDateTime parsedExpiresAt = parseSnapshotTimestamp(expiresAt);
                    if (parsedExpiresAt != null && parsedExpiresAt.isBefore(LocalDateTime.now())) {
                        normalized.put("suppressed", "N");
                        expiredSuppressionCount++;
                        changed = true;
                    }
                }
            }
            boolean hasState = !safeString(normalized.get("status")).isEmpty()
                    || !safeString(normalized.get("owner")).isEmpty()
                    || !safeString(normalized.get("note")).isEmpty()
                    || "Y".equalsIgnoreCase(safeString(normalized.get("suppressed")))
                    || !safeString(normalized.get("expiresAt")).isEmpty();
            if (!hasState) {
                changed = true;
                continue;
            }
            normalizedRows.add(normalized);
            String fingerprint = safeString(row.get("fingerprint"));
            if (!fingerprint.isEmpty()) {
                map.put(fingerprint, normalized);
            }
        }
        if (changed && persistExpiredCleanup) {
            persistSnapshot(snapshotKey, normalizedRows, SNAPSHOT_TYPE_SECURITY_INSIGHT_STATE, formatSnapshotTimestamp(LocalDateTime.now()));
        }
        return new SecurityInsightStateSnapshot(map, temporarySuppressionCount, expiredSuppressionCount);
    }

    private Map<String, String> mergeSecurityInsightState(Map<String, String> item, Map<String, String> state) {
        Map<String, String> merged = new LinkedHashMap<>(item);
        String fingerprint = buildSecurityInsightFingerprint(item);
        merged.put("fingerprint", fingerprint);
        if (state == null || state.isEmpty()) {
            merged.put("stateStatus", "");
            merged.put("stateOwner", "");
            merged.put("stateNote", "");
            merged.put("stateSuppressed", "N");
            merged.put("stateExpiresAt", "");
            merged.put("stateUpdatedAt", "");
            merged.put("stateUpdatedBy", "");
            return merged;
        }
        merged.put("stateStatus", safeString(state.get("status")));
        merged.put("stateOwner", safeString(state.get("owner")));
        merged.put("stateNote", safeString(state.get("note")));
        merged.put("stateSuppressed", safeString(state.get("suppressed")).isEmpty() ? "N" : safeString(state.get("suppressed")));
        merged.put("stateExpiresAt", safeString(state.get("expiresAt")));
        merged.put("stateUpdatedAt", safeString(state.get("updatedAt")));
        merged.put("stateUpdatedBy", safeString(state.get("updatedBy")));
        return merged;
    }

    private Map<String, Object> summarizeSecurityInsightState(List<Map<String, String>> items, SecurityInsightStateSnapshot stateSnapshot) {
        int acknowledgedCount = 0;
        int resolvedCount = 0;
        int falsePositiveCount = 0;
        int suppressedCount = 0;
        for (Map<String, String> item : safeRows(items)) {
            String status = safeString(item.get("stateStatus")).toUpperCase(Locale.ROOT);
            if ("ACKNOWLEDGED".equals(status)) {
                acknowledgedCount++;
            } else if ("RESOLVED".equals(status)) {
                resolvedCount++;
            } else if ("FALSE_POSITIVE".equals(status)) {
                falsePositiveCount++;
            }
            if ("Y".equalsIgnoreCase(safeString(item.get("stateSuppressed")))) {
                suppressedCount++;
            }
        }
        return Map.of(
                "acknowledgedCount", acknowledgedCount,
                "resolvedCount", resolvedCount,
                "falsePositiveCount", falsePositiveCount,
                "suppressedCount", suppressedCount,
                "temporarySuppressionCount", stateSnapshot.temporarySuppressionCount(),
                "expiredSuppressionCount", stateSnapshot.expiredSuppressionCount());
    }

    private String buildSecurityInsightFingerprint(Map<String, String> row) {
        return String.join("::",
                safeString(row.get("severity")),
                safeString(row.get("category")),
                safeString(row.get("engine")),
                safeString(row.get("target")),
                safeString(row.get("subject")),
                safeString(row.get("title")));
    }

    private List<Map<String, String>> mergeSecurityInsightHistoryRows(
            List<Map<String, String>> items,
            SourceScanSnapshot sourceScanSnapshot,
            int criticalCount,
            int highCount,
            int mediumCount,
            int lowCount,
            int actionRequiredCount,
            boolean isEn,
            String generatedAt) {
        String snapshotKey = snapshotKey("SECURITY_INSIGHT_HISTORY", isEn);
        List<Map<String, String>> persisted = new ArrayList<>(readSnapshotCards(snapshotKey));
        String signature = buildSecurityInsightSignature(items);
        Map<String, String> current = new LinkedHashMap<>();
        current.put("generatedAt", generatedAt);
        current.put("signature", signature);
        current.put("totalFindings", String.valueOf(items.size()));
        current.put("criticalCount", String.valueOf(criticalCount));
        current.put("highCount", String.valueOf(highCount));
        current.put("mediumCount", String.valueOf(mediumCount));
        current.put("lowCount", String.valueOf(lowCount));
        current.put("actionRequiredCount", String.valueOf(actionRequiredCount));
        current.put("blocked", String.valueOf(criticalCount > 0 || highCount > 0));
        current.put("profile", criticalCount > 0 || highCount > 0 ? "strict" : "balanced");
        current.put("scannedFiles", String.valueOf(sourceScanSnapshot.scannedFiles()));
        current.put("totalFiles", String.valueOf(sourceScanSnapshot.totalFiles()));
        current.put("topCategory", summarizeDominantDimension(items, "category"));
        current.put("topEngine", summarizeDominantDimension(items, "engine"));
        current.put("topTarget", safeString(items.isEmpty() ? "" : items.get(0).get("target")));
        current.put("message", items.isEmpty()
                ? (isEn ? "No detection findings." : "탐지 항목이 없습니다.")
                : (isEn ? "Detection snapshot captured." : "탐지 스냅샷을 저장했습니다."));

        List<Map<String, String>> history = new ArrayList<>();
        if (!persisted.isEmpty() && signature.equals(safeString(persisted.get(0).get("signature")))) {
            history.add(current);
            history.addAll(persisted.stream().skip(1).limit(11).collect(Collectors.toList()));
        } else {
            history.add(current);
            history.addAll(persisted.stream().limit(11).collect(Collectors.toList()));
        }
        persistSnapshot(snapshotKey, history, SNAPSHOT_TYPE_SECURITY_INSIGHT_HISTORY, generatedAt);
        return history;
    }

    private String buildSecurityInsightSignature(List<Map<String, String>> items) {
        try {
            return Integer.toHexString(objectMapper.writeValueAsString(items).hashCode());
        } catch (Exception e) {
            return Integer.toHexString(items.hashCode());
        }
    }

    private String summarizeDominantDimension(List<Map<String, String>> items, String key) {
        if (items == null || items.isEmpty()) {
            return "-";
        }
        Map<String, Long> counts = items.stream()
                .map(row -> safeString(row.get(key)))
                .filter(value -> !value.isBlank())
                .collect(Collectors.groupingBy(value -> value, LinkedHashMap::new, Collectors.counting()));
        if (counts.isEmpty()) {
            return "-";
        }
        Map.Entry<String, Long> dominant = counts.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .orElse(null);
        if (dominant == null) {
            return "-";
        }
        return dominant.getKey() + " (" + dominant.getValue() + ")";
    }

    private String formatSnapshotTimestamp(LocalDateTime dateTime) {
        if (dateTime == null) {
            return "";
        }
        return dateTime.format(SNAPSHOT_TIMESTAMP_FORMATTER);
    }

    private LocalDateTime parseSnapshotTimestamp(String value) {
        String normalized = safeString(value);
        if (normalized.isEmpty()) {
            return null;
        }
        try {
            return LocalDateTime.parse(normalized, SNAPSHOT_TIMESTAMP_FORMATTER);
        } catch (Exception ignored) {
            return null;
        }
    }

    private Map<String, String> readSecurityInsightNotificationConfig(boolean isEn) {
        String snapshotKey = snapshotKey("SECURITY_INSIGHT_NOTIFICATION", isEn);
        List<Map<String, String>> rows = readSnapshotCards(snapshotKey);
        if (rows.isEmpty()) {
            return defaultSecurityInsightNotificationConfig();
        }
        Map<String, String> merged = new LinkedHashMap<>(defaultSecurityInsightNotificationConfig());
        merged.putAll(rows.get(0));
        return merged;
    }

    private Map<String, String> defaultSecurityInsightNotificationConfig() {
        Map<String, String> defaults = new LinkedHashMap<>();
        defaults.put("slackEnabled", "Y");
        defaults.put("mailEnabled", "Y");
        defaults.put("webhookEnabled", "N");
        defaults.put("notifyCritical", "Y");
        defaults.put("notifyHigh", "Y");
        defaults.put("newOnlyMode", "Y");
        defaults.put("digestEnabled", "Y");
        defaults.put("digestHour", "09");
        defaults.put("digestMinute", "00");
        defaults.put("slackChannel", "#security-alerts");
        defaults.put("mailRecipients", "security-ops@carbonet.local");
        defaults.put("webhookUrl", "");
        defaults.put("lastDigestAt", "");
        defaults.put("lastDigestStatus", "");
        defaults.put("updatedAt", "");
        defaults.put("updatedBy", "");
        return defaults;
    }

    private boolean isExecutionApproved(boolean isEn, String fingerprint, String actorUserId) {
        if (safeString(fingerprint).isEmpty()) {
            return false;
        }
        SecurityInsightStateSnapshot snapshot = loadSecurityInsightStateSnapshot(isEn);
        Map<String, String> state = snapshot.stateMap().get(fingerprint);
        if (state == null) {
            return false;
        }
        String status = safeString(state.get("status")).toUpperCase(Locale.ROOT);
        if (!("APPROVED".equals(status) || "EXECUTED".equals(status) || "VERIFIED".equals(status))) {
            return false;
        }
        String updatedBy = safeString(state.get("updatedBy"));
        if ("APPROVED".equals(status) && !updatedBy.isEmpty() && updatedBy.equals(safeString(actorUserId))) {
            return false;
        }
        return true;
    }

    private SourceScanSnapshot collectSourceSecurityFindings(boolean isEn) {
        SourceScanSnapshot cached = cachedSourceScanSnapshot;
        long now = System.currentTimeMillis();
        if (cached != null && now - cached.cachedAtMillis() < SOURCE_SCAN_CACHE_TTL_MS) {
            return cached;
        }
        List<Map<String, String>> items = new ArrayList<>();
        int totalFiles = 0;
        int scannedFiles = 0;
        String currentTarget = "-";
        try {
            for (Path root : SOURCE_SCAN_ROOTS) {
                if (!Files.exists(root)) {
                    continue;
                }
                try (Stream<Path> stream = Files.walk(root)) {
                    List<Path> files = stream
                            .filter(Files::isRegularFile)
                            .filter(this::isSourceScanCandidate)
                            .collect(Collectors.toList());
                    totalFiles += files.size();
                    for (Path file : files) {
                        currentTarget = normalizeSourcePath(file);
                        scannedFiles++;
                        List<String> lines = readSourceLines(file);
                        if (lines.isEmpty()) {
                            continue;
                        }
                        for (SourceSecurityRule rule : SOURCE_SECURITY_RULES) {
                            if (!rule.matchesExtension(file)) {
                                continue;
                            }
                            int matchCountForRule = 0;
                            for (int index = 0; index < lines.size(); index++) {
                                String line = lines.get(index);
                                if (!rule.pattern().matcher(line).find()) {
                                    continue;
                                }
                                items.add(threatRow(
                                        rule.severity(),
                                        rule.category(),
                                        rule.engine(),
                                        normalizeSourcePath(file) + ":" + (index + 1),
                                        rule.subject(),
                                        isEn ? sourceRuleTitleEn(rule) : sourceRuleTitleKo(rule),
                                        isEn ? sourceRuleRemediationEn(rule) : sourceRuleRemediationKo(rule),
                                        "required",
                                        "Y",
                                        "93",
                                        "Y"));
                                matchCountForRule++;
                                if (matchCountForRule >= SOURCE_SCAN_MAX_MATCHES_PER_RULE) {
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        } catch (IOException e) {
            log.warn("Failed to collect source security findings", e);
        }
        SourceScanSnapshot snapshot = new SourceScanSnapshot(
                Collections.unmodifiableList(items),
                totalFiles,
                scannedFiles,
                currentTarget,
                LocalDateTime.now(),
                now);
        cachedSourceScanSnapshot = snapshot;
        return snapshot;
    }

    private List<Map<String, String>> buildOperationalHeuristicThreatRows(
            List<Map<String, String>> duplicatedMenuUrls,
            List<Map<String, String>> duplicatedViewMappings,
            List<Map<String, String>> inactiveAuthorFeatureRelations,
            List<Map<String, String>> sensitiveRoleExposures,
            List<Map<String, String>> companyScopeSensitiveExposures,
            boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        String authApiController = readSourceFile("src/main/java/egovframework/com/feature/auth/web/AuthApiController.java");
        String authorizeFilter = readSourceFile("src/main/java/egovframework/com/common/filter/AuthorizeFilter.java");
        String adminAuthInterceptor = readSourceFile("src/main/java/egovframework/com/common/interceptor/AdminMainAuthInterceptor.java");
        String requestExecutionLogVo = readSourceFile("src/main/java/egovframework/com/common/logging/RequestExecutionLogVO.java");
        String observabilityController = readSourceFile("src/main/java/egovframework/com/platform/observability/web/PlatformObservabilityActionController.java");
        String codexController = readSourceFile("src/main/java/egovframework/com/platform/codex/web/CodexProvisionAdminApiController.java");
        String backupService = readSourceFile("src/main/java/egovframework/com/feature/admin/service/BackupConfigManagementService.java");
        String backupPage = readSourceFile("frontend/src/features/backup-config/BackupConfigMigrationPage.tsx");
        String codexPage = readSourceFile("frontend/src/features/codex-provision/CodexProvisionMigrationPage.tsx");
        String securityPolicyPage = readSourceFile("frontend/src/features/security-policy/SecurityPolicyMigrationPage.tsx");
        String adminAuthSkipBlock = extractBetween(
                adminAuthInterceptor,
                "private boolean shouldSkipAuthorization",
                "private String normalizeMenuUrl(String requestUri)");

        if (!authApiController.isEmpty()
                && !containsAny(authApiController, "changeSessionId", "session.invalidate()", "invalidate();")) {
            rows.add(threatRow(
                    "HIGH",
                    "session-fixation-risk",
                    "heuristic-engine",
                    "/admin/login,/signin",
                    "AuthApiController",
                    isEn ? "Login flow may not rotate the session" : "로그인 후 세션 재발급 누락 가능성",
                    isEn ? "Rotate or invalidate the existing session immediately after successful authentication." : "로그인 성공 직후 기존 세션을 무효화하거나 세션 ID를 재발급해야 합니다.",
                    "required",
                    "Y",
                    "86",
                    "Y"));
        }

        if (!authorizeFilter.isEmpty()
                && containsAny(authorizeFilter, "path.startsWith(\"/admin\")", "path.startsWith(\"/en/admin\")")) {
            rows.add(threatRow(
                    "HIGH",
                    "gateway-guard-admin-bypass",
                    "heuristic-engine",
                    "/admin/**",
                    "AuthorizeFilter",
                    isEn ? "Gateway guard bypasses admin paths" : "게이트웨이 가드가 관리자 경로를 우회",
                    isEn ? "Do not mark the entire /admin prefix as public in the gateway guard." : "게이트웨이 가드에서 /admin 전체를 public 경로로 두지 말아야 합니다.",
                    "required",
                    "Y",
                    "90",
                    "Y"));
        }

        if (!adminAuthSkipBlock.isEmpty()
                && containsAny(adminAuthSkipBlock,
                "\"/admin/member/login_history\"",
                "\"/admin/member/security\"")) {
            rows.add(threatRow(
                    "HIGH",
                    "admin-auth-skip-sensitive-page",
                    "heuristic-engine",
                    "/admin/member/login_history,/admin/member/security",
                    "AdminMainAuthInterceptor",
                    isEn ? "Sensitive admin pages are skipped by the auth interceptor" : "민감 관리자 페이지가 인증 인터셉터에서 예외 처리됨",
                    isEn ? "Revalidate whether login/security history pages should bypass admin authorization checks." : "로그인/보안 이력 페이지를 관리자 인증 예외로 둘지 다시 검토해야 합니다.",
                    "required",
                    "Y",
                    "89",
                    "Y"));
        }

        if (!observabilityController.isEmpty()
                && containsAny(observabilityController, "/system/backup/run", "/system/version/restore")
                && !containsAny(observabilityController.toLowerCase(Locale.ROOT), "ratelimit", "rate limit", "throttle")) {
            rows.add(threatRow(
                    "HIGH",
                    "missing-rate-limit",
                    "heuristic-engine",
                    "/admin/system/backup/run",
                    "PlatformObservabilityActionController",
                    isEn ? "Sensitive admin action without rate limiting" : "민감 관리자 작업에 rate limit 부재",
                    isEn ? "Apply throttling or rate limiting to backup, restore, and version restore actions." : "백업, 복구, 버전 복원 같은 민감 작업에 호출 제한을 적용해야 합니다.",
                    "required",
                    "Y",
                    "84",
                    "Y"));
        }

        if (!codexController.isEmpty()
                && containsAny(codexController, "/execute", "/queue-direct-execute", "/skip-plan-execute")
                && !containsAny(codexController.toLowerCase(Locale.ROOT), "ratelimit", "rate limit", "throttle")) {
            rows.add(threatRow(
                    "HIGH",
                    "missing-rate-limit",
                    "heuristic-engine",
                    "/admin/system/codex-request",
                    "CodexProvisionAdminApiController",
                    isEn ? "Codex execution endpoint without rate limiting" : "Codex 실행 엔드포인트에 rate limit 부재",
                    isEn ? "Protect Codex execution endpoints with per-user throttling." : "Codex 실행 엔드포인트에 사용자 단위 호출 제한을 적용해야 합니다.",
                    "required",
                    "Y",
                    "87",
                    "Y"));
        }

        if (!observabilityController.isEmpty()
                && containsAny(observabilityController, "/system/backup/run", "/system/version/restore")
                && !containsAny(observabilityController, "auditTrailService", "record(", "requestExecutionLogService")) {
            rows.add(threatRow(
                    "HIGH",
                    "audit-gap",
                    "heuristic-engine",
                    "/admin/system/backup,/admin/system/restore,/admin/system/version",
                    "PlatformObservabilityActionController",
                    isEn ? "Sensitive action without explicit audit hook" : "민감 작업에 명시적 감사 기록 훅 부재",
                    isEn ? "Ensure backup, restore, and version restore actions emit explicit audit records." : "백업, 복구, 버전 복원 작업에 명시적 감사 기록을 남겨야 합니다.",
                    "required",
                    "Y",
                    "83",
                    "Y"));
        }

        if (!backupPage.isEmpty()
                && containsAny(backupPage, "Run Git Bundle", "Restore This Version", "Git 번들 백업 실행", "이 버전으로 복원")
                && !containsAny(backupPage, "confirm(", "window.confirm", "Modal", "dialog")) {
            rows.add(threatRow(
                    "MEDIUM",
                    "sensitive-action-no-confirm",
                    "heuristic-engine",
                    "/admin/system/backup,/admin/system/version",
                    "BackupConfigMigrationPage",
                    isEn ? "Sensitive action without explicit confirmation" : "민감 작업에 명시적 확인 단계 부재",
                    isEn ? "Add a user confirmation step before executing restore or backup actions." : "복원/백업 실행 전 사용자 확인 단계를 추가해야 합니다.",
                    "review",
                    "Y",
                    "79",
                    "Y"));
        }

        if (!codexPage.isEmpty()
                && containsAny(codexPage, "대기열 실행", "direct-execute", "skip-plan-execute")
                && !containsAny(codexPage, "confirm(", "window.confirm", "Modal", "dialog")) {
            rows.add(threatRow(
                    "MEDIUM",
                    "sensitive-action-no-confirm",
                    "heuristic-engine",
                    "/admin/system/codex-request",
                    "CodexProvisionMigrationPage",
                    isEn ? "Codex execution action without explicit confirmation" : "Codex 실행 작업에 명시적 확인 단계 부재",
                    isEn ? "Require an operator confirmation step before queueing or executing Codex actions." : "Codex 실행/대기열 등록 전 운영자 확인 단계를 두어야 합니다.",
                    "review",
                    "Y",
                    "81",
                    "Y"));
        }

        if (!backupService.isEmpty()
                && !containsAny(backupService, "executeDatabaseRestoreWithMaintenance", "maintenanceModeService.activate")) {
            rows.add(threatRow(
                    "HIGH",
                    "missing-maintenance-guard",
                    "heuristic-engine",
                    "/admin/system/restore",
                    "BackupConfigManagementService",
                    isEn ? "Restore path without maintenance guard" : "복구 경로에 점검 모드 가드 부재",
                    isEn ? "Wrap restore execution in maintenance mode to prevent live traffic failures." : "실시간 요청 실패를 막기 위해 복구 실행을 점검 모드로 감싸야 합니다.",
                    "required",
                    "Y",
                    "88",
                    "Y"));
        }

        if (!duplicatedMenuUrls.isEmpty() || !duplicatedViewMappings.isEmpty() || !inactiveAuthorFeatureRelations.isEmpty()) {
            rows.add(threatRow(
                    "MEDIUM",
                    "permission-drift",
                    "heuristic-engine",
                    "/admin/system/security-policy",
                    "menu-permission-diagnostics",
                    isEn ? "Permission contract drift detected" : "메뉴/기능/권한 계약 드리프트 감지",
                    isEn ? "Resolve duplicate routes, duplicate VIEW mappings, and inactive grants to restore permission consistency." : "중복 라우트, 중복 VIEW, 비활성 권한 참조를 정리해 권한 계약을 일치시켜야 합니다.",
                    "required",
                    "Y",
                    "85",
                    "Y"));
        }

        if (!sensitiveRoleExposures.isEmpty() || !companyScopeSensitiveExposures.isEmpty()) {
            rows.add(threatRow(
                    "HIGH",
                    "unused-high-privilege-feature",
                    "heuristic-engine",
                    "/admin/system/security-policy",
                    "sensitive-role-exposure",
                    isEn ? "High-privilege feature assignment requires revalidation" : "고권한 기능 부여 재검증 필요",
                    isEn ? "Review whether all assigned sensitive features are still required for the target roles." : "민감 기능이 현재 역할에 계속 필요한지 재검증해야 합니다.",
                    "review",
                    "Y",
                    "80",
                    "Y"));
        }

        boolean adminSystemPublicBypass = containsAny(authorizeFilter,
                "path.startsWith(\"/admin\")",
                "path.startsWith(\"/en/admin\")")
                || containsAny(adminAuthSkipBlock,
                "\"/admin/system/\"",
                "startsWith(\"/admin/system/\")",
                "\"/en/admin/system/\"",
                "startsWith(\"/en/admin/system/\")");

        if (!observabilityController.isEmpty()
                && containsAny(observabilityController, "@RequestMapping(value = \"/system/backup\"", "@RequestMapping(value = \"/system/restore\"", "@RequestMapping(value = \"/system/version\"")
                && adminSystemPublicBypass) {
            rows.add(threatRow(
                    "MEDIUM",
                    "public-endpoint-admin-prefix",
                    "heuristic-engine",
                    "/admin/system/*",
                    "PlatformObservabilityActionController",
                    isEn ? "Admin-prefixed endpoint relies on external auth chain only" : "관리자 경로가 외부 인증 체인에만 의존",
                    isEn ? "Reconfirm that admin endpoints are consistently protected by interceptors or method security." : "관리자 경로가 인터셉터나 메서드 보안으로 일관되게 보호되는지 재확인해야 합니다.",
                    "review",
                    "Y",
                    "74",
                    "Y"));
        }

        if (!requestExecutionLogVo.isEmpty()
                && !containsAny(requestExecutionLogVo, "traceId", "requestId", "featureCode", "menuCode")) {
            rows.add(threatRow(
                    "MEDIUM",
                    "audit-context-gap",
                    "heuristic-engine",
                    "RequestExecutionLogVO",
                    "request-execution-log",
                    isEn ? "Audit log context fields are limited" : "감사 로그 상관관계 필드가 제한적임",
                    isEn ? "Add trace/request/menu/feature correlation fields so sensitive actions can be reconstructed precisely." : "민감 작업 재구성을 위해 trace/request/menu/feature 상관관계 필드를 보강해야 합니다.",
                    "review",
                    "Y",
                    "76",
                    "Y"));
        }

        return rows;
    }

    private String readSourceFile(String relativePath) {
        Path path = Paths.get(relativePath);
        if (!Files.exists(path) || !Files.isRegularFile(path)) {
            return "";
        }
        try {
            if (Files.size(path) > SOURCE_SCAN_MAX_FILE_BYTES) {
                return "";
            }
            return Files.readString(path, StandardCharsets.UTF_8);
        } catch (IOException e) {
            return "";
        }
    }

    private String extractBetween(String source, String startToken, String endToken) {
        if (source == null || source.isEmpty()) {
            return "";
        }
        int start = source.indexOf(startToken);
        if (start < 0) {
            return "";
        }
        int end = source.indexOf(endToken, start);
        if (end < 0) {
            return source.substring(start);
        }
        return source.substring(start, end);
    }

    private boolean containsAny(String source, String... fragments) {
        String normalizedSource = safeString(source);
        if (normalizedSource.isEmpty() || fragments == null) {
            return false;
        }
        for (String fragment : fragments) {
            if (!safeString(fragment).isEmpty() && normalizedSource.contains(fragment)) {
                return true;
            }
        }
        return false;
    }

    private boolean isSourceScanCandidate(Path file) {
        String normalizedPath = normalizeSourcePath(file);
        for (String marker : SOURCE_SCAN_EXCLUDED_PATH_MARKERS) {
            if (normalizedPath.contains(marker)) {
                return false;
            }
        }
        String name = safeString(file.getFileName() == null ? "" : file.getFileName().toString()).toLowerCase(Locale.ROOT);
        if (name.isEmpty()) {
            return false;
        }
        for (String extension : SOURCE_SCAN_EXTENSIONS) {
            if (name.endsWith(extension)) {
                return true;
            }
        }
        return false;
    }

    private List<String> readSourceLines(Path file) {
        try {
            if (Files.size(file) > SOURCE_SCAN_MAX_FILE_BYTES) {
                return Collections.emptyList();
            }
            return Files.readAllLines(file, StandardCharsets.UTF_8);
        } catch (IOException e) {
            return Collections.emptyList();
        }
    }

    private String normalizeSourcePath(Path file) {
        Path normalized = file.normalize();
        Path base = Paths.get("").toAbsolutePath().normalize();
        try {
            return base.relativize(normalized.toAbsolutePath().normalize()).toString().replace('\\', '/');
        } catch (IllegalArgumentException ignored) {
            return normalized.toString().replace('\\', '/');
        }
    }

    private String sourceRuleTitleKo(SourceSecurityRule rule) {
        switch (rule.subject()) {
            case "HARDCODED_SECRET":
                return "소스 내 하드코딩된 비밀값";
            case "PRIVATE_KEY_IN_SOURCE":
                return "소스 내 개인키 노출";
            case "OPEN_REDIRECT_USER_CONTROLLED":
                return "사용자 입력 기반 오픈 리다이렉트";
            case "SSRF_USER_CONTROLLED_URL":
                return "사용자 입력 기반 SSRF 가능성";
            case "XSS_UNESCAPED_RESPONSE_WRITE":
                return "응답 직접 출력 기반 XSS 가능성";
            case "PERMIT_ALL_WILDCARD":
                return "전체 경로 permitAll 설정";
            default:
                return "소스 보안 탐지";
        }
    }

    private String sourceRuleTitleEn(SourceSecurityRule rule) {
        switch (rule.subject()) {
            case "HARDCODED_SECRET":
                return "Hardcoded secret in source";
            case "PRIVATE_KEY_IN_SOURCE":
                return "Private key exposed in source";
            case "OPEN_REDIRECT_USER_CONTROLLED":
                return "User-controlled open redirect";
            case "SSRF_USER_CONTROLLED_URL":
                return "User-controlled SSRF candidate";
            case "XSS_UNESCAPED_RESPONSE_WRITE":
                return "Unescaped response write XSS candidate";
            case "PERMIT_ALL_WILDCARD":
                return "Wildcard permitAll authorization";
            case "COMMAND_INJECTION_RUNTIME_EXEC":
                return "Runtime exec command injection candidate";
            case "COMMAND_INJECTION_PROCESS_BUILDER":
                return "ProcessBuilder command injection candidate";
            case "WEAK_HASH_ALGO":
                return "Weak hash algorithm";
            case "SSL_TRUST_ALL":
                return "Trust-all TLS configuration";
            case "INSECURE_RANDOM":
                return "Insecure random usage";
            case "CSRF_DISABLED":
                return "CSRF protection disabled";
            case "PATH_TRAVERSAL_USER_INPUT_PATH":
                return "User-controlled file path";
            case "INSECURE_DESERIALIZATION":
                return "Insecure deserialization";
            case "CLASSLOADER_USER_INPUT":
                return "User-controlled dynamic class loading";
            case "CORS_WILDCARD_ORIGIN":
                return "Wildcard CORS origin";
            case "SECURITY_HEADERS_DISABLED":
                return "Security headers disabled";
            case "COOKIE_HTTPONLY_FALSE":
                return "HttpOnly disabled cookie";
            case "COOKIE_SECURE_FALSE":
                return "Secure disabled cookie";
            case "POTENTIAL_CREDENTIAL_LOGGING":
                return "Potential credential logging";
            case "XML_EXTERNAL_ENTITY_RISK":
                return "XML external entity risk";
            case "YAML_UNSAFE_LOAD":
                return "Unsafe YAML loader";
            case "FILE_UPLOAD_NO_EXTENSION_VALIDATION":
                return "File upload validation review required";
            case "AWS_ACCESS_KEY_EXPOSED":
                return "AWS access key exposed";
            case "SQL_INJECTION_STRING_CONCAT":
                return "SQL string concatenation risk";
            case "SQL_SELECT_STAR_PRODUCTION":
                return "SELECT * usage";
            case "JDBC_URL_WITHOUT_SSL":
                return "JDBC connection without SSL";
            case "PASSWORD_IN_QUERY_PARAM":
                return "Password in query parameter";
            case "TRUST_ALL_HOSTNAME_VERIFIER":
                return "Trust-all hostname verifier";
            case "POTENTIAL_DIRECTORY_LISTING":
                return "Potential directory listing";
            case "FILE_UPLOAD_PATH_ESCAPE":
                return "File upload path escape risk";
            case "LOG_PII_EXPOSURE":
                return "Potential PII logging";
            default:
                return "Source security finding";
        }
    }

    private String sourceRuleRemediationKo(SourceSecurityRule rule) {
        switch (rule.subject()) {
            case "HARDCODED_SECRET":
                return "하드코딩된 비밀값을 제거하고 환경변수나 보안 저장소로 이동해야 합니다.";
            case "PRIVATE_KEY_IN_SOURCE":
                return "개인키를 저장소에서 제거하고 즉시 교체해야 합니다.";
            case "OPEN_REDIRECT_USER_CONTROLLED":
                return "리다이렉트 대상은 allowlist 또는 서버 고정 경로로 제한해야 합니다.";
            case "SSRF_USER_CONTROLLED_URL":
                return "외부 호출 대상은 검증된 allowlist와 스킴 제한을 적용해야 합니다.";
            case "XSS_UNESCAPED_RESPONSE_WRITE":
                return "사용자 입력을 직접 응답에 쓰지 말고 인코딩 또는 템플릿 escaping을 사용해야 합니다.";
            case "PERMIT_ALL_WILDCARD":
                return "전체 경로 permitAll 설정을 제거하고 필요한 공개 경로만 명시해야 합니다.";
            case "COMMAND_INJECTION_RUNTIME_EXEC":
            case "COMMAND_INJECTION_PROCESS_BUILDER":
                return "명령 실행 인자는 사용자 입력과 분리하고 allowlist 기반 인자 검증을 적용해야 합니다.";
            case "WEAK_HASH_ALGO":
                return "MD5/SHA-1 대신 SHA-256 이상 또는 적절한 현대 해시를 사용해야 합니다.";
            case "SSL_TRUST_ALL":
                return "trust-all TLS 설정을 제거하고 정상 인증서 검증을 복구해야 합니다.";
            case "INSECURE_RANDOM":
                return "보안 용도 난수는 SecureRandom으로 바꿔야 합니다.";
            case "CSRF_DISABLED":
                return "전역 CSRF 비활성화를 제거하고 필요한 예외만 최소화해야 합니다.";
            case "PATH_TRAVERSAL_USER_INPUT_PATH":
                return "사용자 입력 경로는 정규화 후 허용 루트와 확장자를 검증해야 합니다.";
            case "INSECURE_DESERIALIZATION":
                return "신뢰되지 않은 직렬화 입력을 금지하거나 안전한 포맷으로 교체해야 합니다.";
            case "CLASSLOADER_USER_INPUT":
                return "동적 클래스 로딩 대상은 사용자 입력이 아니라 서버 고정 allowlist를 사용해야 합니다.";
            case "CORS_WILDCARD_ORIGIN":
                return "CORS origin은 '*' 대신 명시적 허용 목록으로 제한해야 합니다.";
            case "SECURITY_HEADERS_DISABLED":
                return "보안 헤더 비활성화를 제거하고 필요한 예외만 제한적으로 적용해야 합니다.";
            case "COOKIE_HTTPONLY_FALSE":
            case "COOKIE_SECURE_FALSE":
                return "민감 쿠키에는 HttpOnly/Secure 속성을 적용해야 합니다.";
            case "POTENTIAL_CREDENTIAL_LOGGING":
                return "비밀번호, 토큰, 시크릿은 로그에 출력하지 않도록 마스킹해야 합니다.";
            case "XML_EXTERNAL_ENTITY_RISK":
                return "XML 파서는 XXE 방지 설정을 명시하고 외부 엔티티를 차단해야 합니다.";
            case "YAML_UNSAFE_LOAD":
                return "범용 YAML 로더 대신 안전한 타입 제한 로더를 사용해야 합니다.";
            case "FILE_UPLOAD_NO_EXTENSION_VALIDATION":
                return "업로드 파일은 확장자, MIME, 저장 경로를 함께 검증해야 합니다.";
            case "AWS_ACCESS_KEY_EXPOSED":
                return "노출된 AWS 키를 즉시 폐기하고 저장소에서 제거해야 합니다.";
            case "SQL_INJECTION_STRING_CONCAT":
                return "사용자 입력이 SQL 문자열 결합에 직접 들어가지 않도록 바인딩 파라미터로 바꿔야 합니다.";
            case "SQL_SELECT_STAR_PRODUCTION":
                return "운영 쿼리는 필요한 컬럼만 명시해 조회 범위를 줄여야 합니다.";
            case "JDBC_URL_WITHOUT_SSL":
                return "외부 DB 연결은 SSL/TLS 옵션을 명시하고 평문 연결을 피해야 합니다.";
            case "PASSWORD_IN_QUERY_PARAM":
                return "비밀번호는 query string으로 전달하지 말고 body나 안전한 인증 수단으로 바꿔야 합니다.";
            case "TRUST_ALL_HOSTNAME_VERIFIER":
                return "hostname verifier의 무조건 허용을 제거하고 정상 호스트 검증을 사용해야 합니다.";
            case "POTENTIAL_DIRECTORY_LISTING":
                return "디렉터리 목록 노출은 차단하고 허용된 파일만 명시적으로 제공해야 합니다.";
            case "FILE_UPLOAD_PATH_ESCAPE":
                return "업로드 파일명과 저장 경로를 분리하고 경로 탈출을 차단해야 합니다.";
            case "LOG_PII_EXPOSURE":
                return "개인정보는 로그에 남기지 말고 식별 불가능한 수준으로 마스킹해야 합니다.";
            default:
                return "보안 규칙에 맞게 소스 코드를 수정해야 합니다.";
        }
    }

    private String sourceRuleRemediationEn(SourceSecurityRule rule) {
        switch (rule.subject()) {
            case "HARDCODED_SECRET":
                return "Remove hardcoded secrets and move them to environment-backed secure storage.";
            case "PRIVATE_KEY_IN_SOURCE":
                return "Remove the private key from source control and rotate it immediately.";
            case "OPEN_REDIRECT_USER_CONTROLLED":
                return "Constrain redirect targets to an allowlist or fixed server-side routes.";
            case "SSRF_USER_CONTROLLED_URL":
                return "Validate outbound targets with an allowlist and strict scheme restrictions.";
            case "XSS_UNESCAPED_RESPONSE_WRITE":
                return "Avoid direct response writes from user input and apply encoding or template escaping.";
            case "PERMIT_ALL_WILDCARD":
                return "Remove wildcard permitAll and explicitly list the minimal public routes.";
            case "COMMAND_INJECTION_RUNTIME_EXEC":
            case "COMMAND_INJECTION_PROCESS_BUILDER":
                return "Separate command arguments from user input and enforce allowlist-based validation.";
            case "WEAK_HASH_ALGO":
                return "Replace MD5/SHA-1 with SHA-256 or a stronger modern hash.";
            case "SSL_TRUST_ALL":
                return "Remove trust-all TLS behavior and restore certificate validation.";
            case "INSECURE_RANDOM":
                return "Use SecureRandom for security-sensitive randomness.";
            case "CSRF_DISABLED":
                return "Remove global CSRF disablement and scope exceptions narrowly.";
            case "PATH_TRAVERSAL_USER_INPUT_PATH":
                return "Normalize and validate user-controlled paths against an allowed root and extension set.";
            case "INSECURE_DESERIALIZATION":
                return "Avoid deserializing untrusted input or switch to a safe serialization format.";
            case "CLASSLOADER_USER_INPUT":
                return "Do not load classes from user input; map to a fixed allowlist instead.";
            case "CORS_WILDCARD_ORIGIN":
                return "Replace wildcard CORS origins with an explicit allowlist.";
            case "SECURITY_HEADERS_DISABLED":
                return "Re-enable security headers and keep exceptions narrow.";
            case "COOKIE_HTTPONLY_FALSE":
            case "COOKIE_SECURE_FALSE":
                return "Apply HttpOnly and Secure to sensitive cookies.";
            case "POTENTIAL_CREDENTIAL_LOGGING":
                return "Mask passwords, tokens, and secrets before logging.";
            case "XML_EXTERNAL_ENTITY_RISK":
                return "Harden XML parsers against XXE and disable external entities.";
            case "YAML_UNSAFE_LOAD":
                return "Use a safe YAML loader with restricted types.";
            case "FILE_UPLOAD_NO_EXTENSION_VALIDATION":
                return "Validate file extension, MIME type, and storage path for uploads.";
            case "AWS_ACCESS_KEY_EXPOSED":
                return "Rotate the exposed AWS key immediately and remove it from source control.";
            case "SQL_INJECTION_STRING_CONCAT":
                return "Replace SQL string concatenation with bound parameters.";
            case "SQL_SELECT_STAR_PRODUCTION":
                return "Select only required columns instead of using SELECT * in production queries.";
            case "JDBC_URL_WITHOUT_SSL":
                return "Enable SSL/TLS for external JDBC connections instead of plain transport.";
            case "PASSWORD_IN_QUERY_PARAM":
                return "Do not send passwords in query strings; move them to the body or a safer auth flow.";
            case "TRUST_ALL_HOSTNAME_VERIFIER":
                return "Remove permissive hostname verification and restore proper host validation.";
            case "POTENTIAL_DIRECTORY_LISTING":
                return "Avoid directory listing exposure and serve only explicitly allowed files.";
            case "FILE_UPLOAD_PATH_ESCAPE":
                return "Separate upload file names from storage paths and block path traversal.";
            case "LOG_PII_EXPOSURE":
                return "Mask or omit personal data before writing logs.";
            default:
                return "Update the source to meet the security rule intent.";
        }
    }

    private List<Map<String, String>> buildDuplicateMenuThreatRows(List<Map<String, String>> rows, boolean isEn) {
        List<Map<String, String>> result = new ArrayList<>();
        for (Map<String, String> row : safeRows(rows)) {
            result.add(threatRow(
                    "MEDIUM",
                    "duplicate-menu-url",
                    "policy-governance",
                    safeString(row.get("menuUrl")),
                    safeString(row.get("menuCodes")),
                    isEn ? "Duplicated active menu URL" : "활성 메뉴 URL 중복",
                    isEn ? "Keep one primary menu and disable the rest." : "대표 메뉴 1건만 유지하고 나머지를 비활성화해야 합니다.",
                    "review",
                    "Y",
                    "82",
                    "Y",
                    mapOf(
                            "sqlPreview", safeString(row.get("recommendedSqlPreview")),
                            "rollbackSql", buildMenuCleanupRollbackSql(safeString(row.get("recommendedDisableMenuCodes"))))));
        }
        return result;
    }

    private List<Map<String, String>> buildDuplicateViewThreatRows(List<Map<String, String>> rows, boolean isEn) {
        List<Map<String, String>> result = new ArrayList<>();
        for (Map<String, String> row : safeRows(rows)) {
            int roleImpact = safeParseInt(row.get("authorRelationImpactCount"));
            int overrideImpact = safeParseInt(row.get("userOverrideImpactCount"));
            String severity = roleImpact > 0 || overrideImpact > 0 ? "HIGH" : "MEDIUM";
            result.add(threatRow(
                    severity,
                    "duplicate-view-feature",
                    "policy-governance",
                    safeString(row.get("menuUrl")),
                    safeString(row.get("featureCodes")),
                    isEn ? "Duplicated VIEW mapping" : "VIEW 기능 중복 매핑",
                    isEn ? "Review authority impact before disabling redundant VIEW features." : "중복 VIEW 기능을 비활성화하기 전에 권한 영향을 먼저 확인해야 합니다.",
                    "required",
                    "Y",
                    roleImpact > 0 ? "91" : "78",
                    "Y",
                    mapOf(
                            "sqlPreview", safeString(row.get("recommendedSqlPreview")),
                            "rollbackSql", buildFeatureDisableRollbackSql(safeString(row.get("recommendedRemoveFeatureCodes"))),
                            "featureCodes", safeString(row.get("recommendedRemoveFeatureCodes")))));
        }
        return result;
    }

    private List<Map<String, String>> buildMissingViewThreatRows(List<Map<String, String>> rows, boolean isEn) {
        List<Map<String, String>> result = new ArrayList<>();
        for (Map<String, String> row : safeRows(rows)) {
            String menuCode = safeString(row.get("menuCode"));
            String menuUrl = safeString(row.get("menuUrl"));
            result.add(threatRow(
                    "HIGH",
                    "missing-view-feature",
                    "integrity-engine",
                    menuUrl,
                    menuCode,
                    isEn ? "Active menu without VIEW feature" : "활성 메뉴에 VIEW 기능 누락",
                    isEn ? "Restore one active VIEW feature for this route." : "이 경로에 활성 VIEW 기능을 복구해야 합니다.",
                    "required",
                    "Y",
                    "89",
                    "Y",
                    mapOf(
                            "sqlPreview", buildMissingViewSqlPreview(menuCode, menuUrl),
                            "rollbackSql", buildMissingViewRollbackSql(menuCode))));
        }
        return result;
    }

    private List<Map<String, String>> buildInactiveGrantThreatRows(
            List<Map<String, String>> authorRows,
            List<Map<String, String>> overrideRows,
            boolean isEn) {
        List<Map<String, String>> result = new ArrayList<>();
        for (Map<String, String> row : safeRows(authorRows)) {
            String featureCode = safeString(row.get("featureCode"));
            String authorCode = safeString(row.get("authorCode"));
            result.add(threatRow(
                    "HIGH",
                    "inactive-role-grant",
                    "integrity-engine",
                    firstNonBlank(safeString(row.get("menuUrl")), featureCode),
                    authorCode,
                    isEn ? "Role references inactive feature" : "역할이 비활성 기능을 참조",
                    isEn ? "Remove the stale grant or restore the feature intentionally." : "오래된 권한 연결을 제거하거나 기능을 의도적으로 복구해야 합니다.",
                    "required",
                    "Y",
                    "90",
                    "Y",
                    mapOf(
                            "sqlPreview", buildInactiveRoleGrantSqlPreview(authorCode, featureCode),
                            "rollbackSql", buildInactiveRoleGrantRollbackSql(authorCode, featureCode),
                            "featureCode", featureCode)));
        }
        for (Map<String, String> row : safeRows(overrideRows)) {
            String featureCode = safeString(row.get("featureCode"));
            String targetId = safeString(row.get("targetId"));
            result.add(threatRow(
                    "HIGH",
                    "inactive-user-override",
                    "integrity-engine",
                    firstNonBlank(safeString(row.get("menuUrl")), featureCode),
                    targetId,
                    isEn ? "User override references inactive feature" : "사용자 override가 비활성 기능을 참조",
                    isEn ? "Clear the override or restore the feature intentionally." : "override를 정리하거나 기능을 의도적으로 복구해야 합니다.",
                    "required",
                    "Y",
                    "88",
                    "Y",
                    mapOf(
                            "sqlPreview", buildInactiveUserOverrideSqlPreview(targetId, featureCode),
                            "rollbackSql", buildInactiveUserOverrideRollbackSql(targetId, featureCode),
                            "featureCode", featureCode)));
        }
        return result;
    }

    private List<Map<String, String>> buildSensitiveExposureThreatRows(
            List<Map<String, String>> sensitiveRows,
            List<Map<String, String>> scopedRows,
            boolean isEn) {
        List<Map<String, String>> result = new ArrayList<>();
        for (Map<String, String> row : safeRows(sensitiveRows)) {
            String authorCode = safeString(row.get("authorCode"));
            String featureCode = safeString(row.get("featureCode"));
            result.add(threatRow(
                    "CRITICAL",
                    "sensitive-feature-exposure",
                    "scope-engine",
                    safeString(row.get("menuUrl")),
                    authorCode,
                    isEn ? "Sensitive system feature exposed beyond master role" : "민감 시스템 기능이 마스터 외 역할에 노출",
                    isEn ? "Restrict the feature to the intended master-level role immediately." : "해당 기능을 즉시 의도된 마스터 역할 범위로 제한해야 합니다.",
                    "immediate",
                    "Y",
                    "97",
                    "Y",
                    mapOf(
                            "sqlPreview", buildSensitiveExposureSqlPreview(authorCode, featureCode),
                            "rollbackSql", buildInactiveRoleGrantRollbackSql(authorCode, featureCode),
                            "featureCode", featureCode)));
        }
        for (Map<String, String> row : safeRows(scopedRows)) {
            String authorCode = safeString(row.get("authorCode"));
            String featureCode = safeString(row.get("featureCode"));
            result.add(threatRow(
                    "CRITICAL",
                    "company-scope-sensitive-exposure",
                    "scope-engine",
                    safeString(row.get("menuUrl")),
                    authorCode,
                    isEn ? "Company-scoped role has global-sensitive feature" : "회사 범위 역할에 전역 민감 기능 부여",
                    isEn ? "Remove the global-sensitive grant from company-scoped roles immediately." : "회사 범위 역할에서 전역 민감 기능 권한을 즉시 제거해야 합니다.",
                    "immediate",
                    "Y",
                    "99",
                    "Y",
                    mapOf(
                            "sqlPreview", buildSensitiveExposureSqlPreview(authorCode, featureCode),
                            "rollbackSql", buildInactiveRoleGrantRollbackSql(authorCode, featureCode),
                            "featureCode", featureCode)));
        }
        return result;
    }

    private Map<String, String> threatRow(
            String severity,
            String category,
            String engine,
            String target,
            String subject,
            String title,
            String remediation,
            String action,
            String actionRequired,
            String confidence,
            String isNew) {
        return threatRow(severity, category, engine, target, subject, title, remediation, action, actionRequired, confidence, isNew, Collections.emptyMap());
    }

    private Map<String, String> threatRow(
            String severity,
            String category,
            String engine,
            String target,
            String subject,
            String title,
            String remediation,
            String action,
            String actionRequired,
            String confidence,
            String isNew,
            Map<String, String> extra) {
        Map<String, String> row = mapOf(
                "severity", severity,
                "category", category,
                "engine", engine,
                "target", target,
                "subject", subject,
                "title", title,
                "remediation", remediation,
                "action", action,
                "actionRequired", actionRequired,
                "confidence", confidence,
                "isNew", isNew);
        if (extra != null && !extra.isEmpty()) {
            row.putAll(extra);
        }
        return row;
    }

    private List<Map<String, String>> safeRows(List<Map<String, String>> rows) {
        return rows == null ? Collections.emptyList() : rows;
    }

    private String buildMenuCleanupRollbackSql(String disableCandidatesCsv) {
        List<String> menuCodes = splitCsv(disableCandidatesCsv);
        if (menuCodes.isEmpty()) {
            return "";
        }
        return "UPDATE COMTNMENUINFO SET USE_AT = 'Y' WHERE MENU_CODE IN (" + sqlInList(menuCodes) + ");";
    }

    private String buildFeatureDisableRollbackSql(String featureCodesCsv) {
        List<String> featureCodes = splitCsv(featureCodesCsv);
        if (featureCodes.isEmpty()) {
            return "";
        }
        return "UPDATE COMTNMENUFUNCTIONINFO SET USE_AT = 'Y' WHERE FEATURE_CODE IN (" + sqlInList(featureCodes) + ");";
    }

    private String buildMissingViewSqlPreview(String menuCode, String menuUrl) {
        String normalizedMenuCode = safeString(menuCode);
        if (normalizedMenuCode.isEmpty()) {
            return "";
        }
        String featureCode = normalizedMenuCode + "_VIEW";
        return ""
                + "-- missing-view-feature auto-fix preview\n"
                + "SELECT MENU_CODE, FEATURE_CODE, USE_AT FROM COMTNMENUFUNCTIONINFO WHERE MENU_CODE = '" + normalizedMenuCode + "';\n"
                + "INSERT INTO COMTNMENUFUNCTIONINFO (MENU_CODE, FEATURE_CODE, FEATURE_NM, FEATURE_DC, USE_AT)\n"
                + "SELECT '" + normalizedMenuCode + "', '" + featureCode + "', 'VIEW', 'Auto-restored VIEW for " + safeSqlLiteral(menuUrl) + "', 'Y'\n"
                + "FROM db_root\n"
                + "WHERE NOT EXISTS (\n"
                + "  SELECT 1 FROM COMTNMENUFUNCTIONINFO WHERE FEATURE_CODE = '" + featureCode + "'\n"
                + ");";
    }

    private String buildMissingViewRollbackSql(String menuCode) {
        String normalizedMenuCode = safeString(menuCode);
        if (normalizedMenuCode.isEmpty()) {
            return "";
        }
        String featureCode = normalizedMenuCode + "_VIEW";
        return "DELETE FROM COMTNMENUFUNCTIONINFO WHERE FEATURE_CODE = '" + featureCode + "' AND MENU_CODE = '" + normalizedMenuCode + "';";
    }

    private String buildInactiveRoleGrantSqlPreview(String authorCode, String featureCode) {
        if (safeString(authorCode).isEmpty() || safeString(featureCode).isEmpty()) {
            return "";
        }
        return ""
                + "SELECT * FROM COMTNAUTHORFUNCTIONRELATE WHERE AUTHOR_CODE = '" + safeSqlLiteral(authorCode) + "' AND FEATURE_CODE = '" + safeSqlLiteral(featureCode) + "';\n"
                + "DELETE FROM COMTNAUTHORFUNCTIONRELATE WHERE AUTHOR_CODE = '" + safeSqlLiteral(authorCode) + "' AND FEATURE_CODE = '" + safeSqlLiteral(featureCode) + "';";
    }

    private String buildInactiveRoleGrantRollbackSql(String authorCode, String featureCode) {
        if (safeString(authorCode).isEmpty() || safeString(featureCode).isEmpty()) {
            return "";
        }
        return ""
                + "INSERT INTO COMTNAUTHORFUNCTIONRELATE (AUTHOR_CODE, FEATURE_CODE, REGIST_DT)\n"
                + "SELECT '" + safeSqlLiteral(authorCode) + "', '" + safeSqlLiteral(featureCode) + "', CURRENT_TIMESTAMP FROM db_root\n"
                + "WHERE NOT EXISTS (\n"
                + "  SELECT 1 FROM COMTNAUTHORFUNCTIONRELATE WHERE AUTHOR_CODE = '" + safeSqlLiteral(authorCode) + "' AND FEATURE_CODE = '" + safeSqlLiteral(featureCode) + "'\n"
                + ");";
    }

    private String buildInactiveUserOverrideSqlPreview(String targetId, String featureCode) {
        if (safeString(targetId).isEmpty() || safeString(featureCode).isEmpty()) {
            return "";
        }
        return ""
                + "SELECT * FROM COMTNUSERFEATUREOVERRIDE WHERE SCRTY_DTRMN_TRGET_ID = '" + safeSqlLiteral(targetId) + "' AND FEATURE_CODE = '" + safeSqlLiteral(featureCode) + "';\n"
                + "UPDATE COMTNUSERFEATUREOVERRIDE SET USE_AT = 'N' WHERE SCRTY_DTRMN_TRGET_ID = '" + safeSqlLiteral(targetId) + "' AND FEATURE_CODE = '" + safeSqlLiteral(featureCode) + "' AND COALESCE(USE_AT,'Y') = 'Y';";
    }

    private String buildInactiveUserOverrideRollbackSql(String targetId, String featureCode) {
        if (safeString(targetId).isEmpty() || safeString(featureCode).isEmpty()) {
            return "";
        }
        return "UPDATE COMTNUSERFEATUREOVERRIDE SET USE_AT = 'Y' WHERE SCRTY_DTRMN_TRGET_ID = '" + safeSqlLiteral(targetId) + "' AND FEATURE_CODE = '" + safeSqlLiteral(featureCode) + "';";
    }

    private String buildSensitiveExposureSqlPreview(String authorCode, String featureCode) {
        return buildInactiveRoleGrantSqlPreview(authorCode, featureCode);
    }

    private String sqlInList(List<String> values) {
        return values.stream()
                .map(value -> "'" + safeSqlLiteral(value) + "'")
                .collect(Collectors.joining(", "));
    }

    private String safeSqlLiteral(String value) {
        return safeString(value).replace("'", "''");
    }

    private String safeObjectString(Object value) {
        return value == null ? "" : safeString(String.valueOf(value));
    }

    private void appendSecurityInsightActivity(boolean isEn, String action, String actorUserId, String target, String detail) {
        persistNotificationActivityHistory(action, actorUserId, target, detail);
        String snapshotKey = snapshotKey("SECURITY_INSIGHT_ACTIVITY", isEn);
        List<Map<String, String>> rows = new ArrayList<>(readSnapshotCards(snapshotKey));
        Map<String, String> row = new LinkedHashMap<>();
        row.put("happenedAt", formatSnapshotTimestamp(LocalDateTime.now()));
        row.put("action", safeString(action));
        row.put("actorUserId", safeString(actorUserId));
        row.put("target", safeString(target));
        row.put("detail", safeString(detail));
        row.put("source", "server");
        rows.add(0, row);
        persistSnapshot(snapshotKey,
                trimSnapshotRows(rows, SECURITY_INSIGHT_ACTIVITY_HISTORY_LIMIT),
                SNAPSHOT_TYPE_SECURITY_INSIGHT_ACTIVITY,
                formatSnapshotTimestamp(LocalDateTime.now()));
    }

    private Map<String, Map<String, String>> loadSecurityMonitoringStateMap(boolean isEn) {
        String snapshotKey = snapshotKey("SECURITY_MONITORING_STATE", isEn);
        Map<String, Map<String, String>> stateMap = new LinkedHashMap<>();
        for (Map<String, String> row : readSnapshotCards(snapshotKey)) {
            String fingerprint = safeString(row.get("fingerprint"));
            if (fingerprint.isEmpty()) {
                continue;
            }
            stateMap.put(fingerprint, new LinkedHashMap<>(row));
        }
        return stateMap;
    }

    private String buildSecurityMonitoringFingerprint(Map<String, String> row) {
        return String.join("|",
                safeString(row == null ? null : row.get("detectedAt")),
                safeString(row == null ? null : row.get("title")),
                safeString(row == null ? null : row.get("detail")),
                safeString(row == null ? null : row.get("severity")));
    }

    private void appendSecurityMonitoringActivity(boolean isEn, String action, String actorUserId, String target, String detail) {
        String snapshotKey = snapshotKey("SECURITY_MONITORING_ACTIVITY", isEn);
        List<Map<String, String>> rows = new ArrayList<>(readSnapshotCards(snapshotKey));
        Map<String, String> row = new LinkedHashMap<>();
        row.put("happenedAt", formatSnapshotTimestamp(LocalDateTime.now()));
        row.put("action", safeString(action));
        row.put("actorUserId", safeString(actorUserId));
        row.put("target", safeString(target));
        row.put("detail", safeString(detail));
        row.put("source", "server");
        rows.add(0, row);
        persistSnapshot(snapshotKey,
                rows.stream().limit(20).collect(Collectors.toList()),
                SNAPSHOT_TYPE_SECURITY_MONITORING_ACTIVITY,
                formatSnapshotTimestamp(LocalDateTime.now()));
    }

    private List<RequestExecutionLogVO> loadSecurityMonitoringLogs() {
        RequestExecutionLogPage page = requestExecutionLogService.searchRecent(this::isSecurityMonitoringLogCandidate, 1, 200);
        return page == null ? Collections.emptyList() : page.getItems();
    }

    private boolean isSecurityMonitoringLogCandidate(RequestExecutionLogVO item) {
        if (item == null) {
            return false;
        }
        if (isLocalSecurityMonitoringRequest(item)) {
            return false;
        }
        String requestUri = safeString(item.getRequestUri());
        if (requestUri.isEmpty()) {
            return false;
        }
        return requestUri.startsWith("/admin")
                || requestUri.startsWith("/api")
                || requestUri.contains("login")
                || item.getResponseStatus() >= 400;
    }

    private boolean isLocalSecurityMonitoringRequest(RequestExecutionLogVO item) {
        if (item == null) {
            return false;
        }
        return isLoopbackAddress(item.getRemoteAddr()) || isIgnoredSecurityMonitoringUri(item.getRequestUri());
    }

    private boolean isLoopbackAddress(String remoteAddr) {
        String normalized = safeString(remoteAddr).trim().toLowerCase(Locale.ROOT);
        if (normalized.isEmpty()) {
            return false;
        }
        if (normalized.startsWith("[")) {
            normalized = normalized.substring(1);
        }
        if (normalized.endsWith("]")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized.equals("localhost")
                || normalized.equals("127.0.0.1")
                || normalized.startsWith("127.")
                || normalized.equals("::1")
                || normalized.equals("0:0:0:0:0:0:0:1")
                || normalized.startsWith("::ffff:127.");
    }

    private boolean isIgnoredSecurityMonitoringUri(String requestUri) {
        String normalized = safeString(requestUri);
        return normalized.startsWith("/.well-known/appspecific/com.chrome.devtools.json")
                || normalized.startsWith("/admin/system/security-monitoring/page-data")
                || normalized.startsWith("/admin/api/admin/observability/audit-events");
    }

    private boolean isSecurityMonitoringEventCandidate(RequestExecutionLogVO item) {
        if (item == null) {
            return false;
        }
        return item.getResponseStatus() >= 400
                || item.getDurationMs() >= 2000
                || safeString(item.getRequestUri()).contains("login");
    }

    private String resolveMonitoringSeverity(RequestExecutionLogVO item) {
        if (item == null) {
            return "LOW";
        }
        if (item.getResponseStatus() >= 500 || safeString(item.getRequestUri()).startsWith("/admin")) {
            return "CRITICAL";
        }
        if (item.getResponseStatus() >= 400 || item.getDurationMs() >= 3000) {
            return "HIGH";
        }
        if (item.getDurationMs() >= 1000) {
            return "MEDIUM";
        }
        return "LOW";
    }

    private String resolveMonitoringTargetStatus(int responseStatus, boolean isEn) {
        if (responseStatus >= 500) {
            return isEn ? "Escalated" : "경계";
        }
        if (responseStatus >= 400) {
            return isEn ? "Throttled" : "제한중";
        }
        return isEn ? "Protected" : "방어중";
    }

    private String resolveMonitoringIpAction(int responseStatus, boolean isEn) {
        if (responseStatus >= 500) {
            return isEn ? "Priority review" : "우선 검토";
        }
        if (responseStatus >= 400) {
            return isEn ? "Temp blocked" : "임시차단";
        }
        return isEn ? "Observed" : "모니터링";
    }

    private String resolveMonitoringRuleLabel(String requestUri, int responseStatus, boolean isEn) {
        String uri = safeString(requestUri);
        if (uri.contains("login")) {
            return isEn ? "Login abuse guard" : "로그인 보호";
        }
        if (responseStatus >= 500) {
            return isEn ? "Server error escalation" : "서버 오류 승격";
        }
        if (responseStatus >= 400) {
            return isEn ? "Request throttle" : "요청 제어";
        }
        return isEn ? "Traffic monitoring" : "트래픽 모니터링";
    }

    private String buildSecurityMonitoringEventTitle(RequestExecutionLogVO item, boolean isEn) {
        String uri = safeString(item.getRequestUri());
        if (uri.contains("login")) {
            return isEn ? "Login anomaly detected" : "로그인 이상 징후 감지";
        }
        if (item.getResponseStatus() >= 500) {
            return isEn ? "Server-side error pattern" : "서버 오류 패턴";
        }
        if (item.getResponseStatus() >= 400) {
            return isEn ? "Repeated client error pattern" : "반복 클라이언트 오류 패턴";
        }
        if (item.getDurationMs() >= 2000) {
            return isEn ? "Slow request spike" : "지연 요청 급증";
        }
        return isEn ? "Monitored request event" : "모니터링 요청 이벤트";
    }

    private String buildSecurityMonitoringEventDetail(RequestExecutionLogVO item, boolean isEn) {
        return (isEn ? "URI " : "대상 URI ")
                + safeString(item.getRequestUri())
                + " · "
                + (isEn ? "status " : "상태 ")
                + item.getResponseStatus()
                + " · "
                + (isEn ? "ip " : "IP ")
                + firstNonBlank(safeString(item.getRemoteAddr()), "-")
                + " · "
                + (isEn ? "duration " : "소요 ")
                + item.getDurationMs()
                + "ms";
    }

    private List<Map<String, String>> defaultSecurityMonitoringTargets(boolean isEn) {
        return List.of(
                mapOf("url", "/admin/login/actionLogin", "rps", "88", "status", isEn ? "Escalated" : "경계", "rule", isEn ? "Admin login hardening" : "관리자 로그인 강화"),
                mapOf("url", "/signin/actionLogin", "rps", "240", "status", isEn ? "Protected" : "방어중", "rule", isEn ? "User login protection" : "사용자 로그인 보호"),
                mapOf("url", "/api/search/carbon-footprint", "rps", "510", "status", isEn ? "Throttled" : "제한중", "rule", isEn ? "Search API throttle" : "검색 API 제어"));
    }

    private List<Map<String, String>> defaultSecurityMonitoringIps(boolean isEn) {
        return List.of(
                mapOf("ip", "198.51.100.42", "country", "US", "requestCount", "4,120", "action", isEn ? "Temp blocked" : "임시차단"),
                mapOf("ip", "203.0.113.78", "country", "KR", "requestCount", "2,844", "action", isEn ? "Captcha enforced" : "CAPTCHA 전환"),
                mapOf("ip", "45.67.22.91", "country", "DE", "requestCount", "2,337", "action", isEn ? "429 only" : "429 응답"));
    }

    private List<Map<String, String>> defaultSecurityMonitoringEvents(boolean isEn) {
        return List.of(
                mapOf("detectedAt", "2026-03-12 09:18", "title", isEn ? "Burst login attack detected" : "로그인 버스트 공격 감지", "detail", isEn ? "Admin login burst exceeded threshold from 3 IPs." : "3개 IP에서 관리자 로그인 burst 임계치 초과", "severity", "HIGH"),
                mapOf("detectedAt", "2026-03-12 09:12", "title", isEn ? "Search API abuse pattern" : "검색 API 남용 패턴", "detail", isEn ? "Single token generated 429 for 6 consecutive minutes." : "단일 토큰에서 6분 연속 429 다발", "severity", "MEDIUM"));
    }

    private static final class SecurityInsightStateSnapshot {
        private final Map<String, Map<String, String>> stateMap;
        private final int temporarySuppressionCount;
        private final int expiredSuppressionCount;

        private SecurityInsightStateSnapshot(
                Map<String, Map<String, String>> stateMap,
                int temporarySuppressionCount,
                int expiredSuppressionCount) {
            this.stateMap = stateMap;
            this.temporarySuppressionCount = temporarySuppressionCount;
            this.expiredSuppressionCount = expiredSuppressionCount;
        }

        private Map<String, Map<String, String>> stateMap() {
            return stateMap;
        }

        private int temporarySuppressionCount() {
            return temporarySuppressionCount;
        }

        private int expiredSuppressionCount() {
            return expiredSuppressionCount;
        }
    }

    private static final class DeliveryResult {
        private final String status;
        private final String detail;
        private final String slackStatus;
        private final String mailStatus;
        private final String webhookStatus;

        private DeliveryResult(String status, String detail, String slackStatus, String mailStatus, String webhookStatus) {
            this.status = status;
            this.detail = detail;
            this.slackStatus = slackStatus;
            this.mailStatus = mailStatus;
            this.webhookStatus = webhookStatus;
        }

        private String status() {
            return status;
        }

        private String detail() {
            return detail;
        }

        private String slackStatus() {
            return slackStatus;
        }

        private String mailStatus() {
            return mailStatus;
        }

        private String webhookStatus() {
            return webhookStatus;
        }
    }

    private static final class SourceSecurityRule {
        private final String severity;
        private final String category;
        private final String engine;
        private final String subject;
        private final String family;
        private final Pattern pattern;
        private final List<String> allowedExtensions;

        private SourceSecurityRule(
                String severity,
                String category,
                String engine,
                String subject,
                String family,
                Pattern pattern,
                List<String> allowedExtensions) {
            this.severity = severity;
            this.category = category;
            this.engine = engine;
            this.subject = subject;
            this.family = family;
            this.pattern = pattern;
            this.allowedExtensions = allowedExtensions;
        }

        private boolean matchesExtension(Path file) {
            if (allowedExtensions == null || allowedExtensions.isEmpty()) {
                return true;
            }
            String name = file.getFileName() == null ? "" : file.getFileName().toString().toLowerCase(Locale.ROOT);
            for (String extension : allowedExtensions) {
                if (name.endsWith(extension)) {
                    return true;
                }
            }
            return false;
        }

        private String severity() {
            return severity;
        }

        private String category() {
            return category;
        }

        private String engine() {
            return engine;
        }

        private String subject() {
            return subject;
        }

        private Pattern pattern() {
            return pattern;
        }
    }

    private static final class SourceScanSnapshot {
        private final List<Map<String, String>> items;
        private final int totalFiles;
        private final int scannedFiles;
        private final String currentTarget;
        private final LocalDateTime scannedAt;
        private final long cachedAtMillis;

        private SourceScanSnapshot(
                List<Map<String, String>> items,
                int totalFiles,
                int scannedFiles,
                String currentTarget,
                LocalDateTime scannedAt,
                long cachedAtMillis) {
            this.items = items;
            this.totalFiles = totalFiles;
            this.scannedFiles = scannedFiles;
            this.currentTarget = currentTarget;
            this.scannedAt = scannedAt;
            this.cachedAtMillis = cachedAtMillis;
        }

        private List<Map<String, String>> items() {
            return items;
        }

        private int totalFiles() {
            return totalFiles;
        }

        private int scannedFiles() {
            return scannedFiles;
        }

        private String currentTarget() {
            return currentTarget;
        }

        private LocalDateTime scannedAt() {
            return scannedAt;
        }

        private long cachedAtMillis() {
            return cachedAtMillis;
        }
    }

    private int severityWeight(String severity) {
        String normalized = safeString(severity).toUpperCase(Locale.ROOT);
        if ("CRITICAL".equals(normalized)) {
            return 4;
        }
        if ("HIGH".equals(normalized)) {
            return 3;
        }
        if ("MEDIUM".equals(normalized)) {
            return 2;
        }
        return 1;
    }

    private int safeParseInt(String value) {
        try {
            return Integer.parseInt(safeString(value));
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String value : values) {
            String normalized = safeString(value);
            if (!normalized.isEmpty()) {
                return normalized;
            }
        }
        return "";
    }

    @Override
    @Transactional
    public Map<String, Object> runMenuPermissionAutoCleanup(String actorUserId, boolean isEn, List<String> targetMenuUrls) {
        Map<String, Object> response = new LinkedHashMap<>();
        List<Map<String, String>> duplicatedMenuUrls = buildDuplicatedMenuUrlRows(authGroupManageMapper.selectActiveMenuUrlRows());
        Set<String> targetUrlSet = normalizeMenuUrlTargets(targetMenuUrls);
        List<Map<String, String>> selectedRows = duplicatedMenuUrls.stream()
                .filter(row -> targetUrlSet.isEmpty() || targetUrlSet.contains(safeString(row.get("menuUrl"))))
                .collect(Collectors.toList());
        List<String> disableMenuCodes = selectedRows.stream()
                .map(row -> splitCsv(row.get("recommendedDisableMenuCodes")))
                .flatMap(Collection::stream)
                .distinct()
                .sorted()
                .collect(Collectors.toList());
        if (disableMenuCodes.isEmpty()) {
            response.put("success", true);
            response.put("actorUserId", safeString(actorUserId));
            response.put("disabledMenuCodes", Collections.emptyList());
            response.put("processedMenuUrls", selectedRows.stream()
                    .map(row -> safeString(row.get("menuUrl")))
                    .filter(value -> !value.isEmpty())
                    .sorted()
                    .collect(Collectors.toList()));
            response.put("message", isEn
                    ? "There are no duplicated menu URLs left to auto-clean."
                    : "자동 정리할 중복 메뉴 URL이 남아 있지 않습니다.");
            response.put("diagnostics", buildMenuPermissionDiagnosticSummary(isEn));
            return response;
        }
        authGroupManageMapper.disableMenusByMenuCodes(disableMenuCodes);
        appendSecurityInsightActivity(isEn,
                "auto-cleanup-menu",
                actorUserId,
                String.join(", ", disableMenuCodes),
                isEn ? "Duplicated menu URLs cleaned up." : "중복 메뉴 URL 자동 정리 실행");
        response.put("success", true);
        response.put("actorUserId", safeString(actorUserId));
        response.put("disabledMenuCodes", disableMenuCodes);
        response.put("processedMenuUrls", selectedRows.stream()
                .map(row -> safeString(row.get("menuUrl")))
                .filter(value -> !value.isEmpty())
                .sorted()
                .collect(Collectors.toList()));
        response.put("disabledMenuCount", disableMenuCodes.size());
        response.put("processedTargetCount", selectedRows.size());
        response.put("message", isEn
                ? "Likely auto-cleanup candidates were disabled successfully."
                : "자동 정리 가능 후보 메뉴를 비활성화했습니다.");
        response.put("diagnostics", buildMenuPermissionDiagnosticSummary(isEn));
        return response;
    }

    @Override
    @Transactional
    public Map<String, Object> updateSecurityInsightState(String actorUserId, boolean isEn, Map<String, Object> payload) {
        Map<String, Object> response = new LinkedHashMap<>();
        String fingerprint = safeObjectString(payload == null ? null : payload.get("fingerprint"));
        if (fingerprint.isEmpty()) {
            response.put("success", false);
            response.put("message", isEn ? "Fingerprint is required." : "탐지 fingerprint가 필요합니다.");
            return response;
        }
        String snapshotKey = snapshotKey("SECURITY_INSIGHT_STATE", isEn);
        List<Map<String, String>> rows = new ArrayList<>(readSnapshotCards(snapshotKey));
        Map<String, String> nextRow = new LinkedHashMap<>();
        nextRow.put("fingerprint", fingerprint);
        nextRow.put("status", safeObjectString(payload.get("status")));
        nextRow.put("owner", safeObjectString(payload.get("owner")));
        nextRow.put("note", safeObjectString(payload.get("note")));
        nextRow.put("suppressed", "Y".equalsIgnoreCase(safeObjectString(payload.get("suppressed"))) ? "Y" : "N");
        nextRow.put("expiresAt", safeObjectString(payload.get("expiresAt")));
        nextRow.put("updatedAt", formatSnapshotTimestamp(LocalDateTime.now()));
        nextRow.put("updatedBy", safeString(actorUserId));
        nextRow.put("category", safeObjectString(payload.get("category")));
        nextRow.put("target", safeObjectString(payload.get("target")));
        nextRow.put("title", safeObjectString(payload.get("title")));

        boolean hasState = !safeString(nextRow.get("status")).isEmpty()
                || !safeString(nextRow.get("owner")).isEmpty()
                || !safeString(nextRow.get("note")).isEmpty()
                || "Y".equals(nextRow.get("suppressed"))
                || !safeString(nextRow.get("expiresAt")).isEmpty();

        List<Map<String, String>> updated = rows.stream()
                .filter(row -> !fingerprint.equals(safeString(row.get("fingerprint"))))
                .collect(Collectors.toCollection(ArrayList::new));
        if (hasState) {
            updated.add(0, nextRow);
        }
        persistSnapshot(snapshotKey, updated, SNAPSHOT_TYPE_SECURITY_INSIGHT_STATE, formatSnapshotTimestamp(LocalDateTime.now()));
        appendSecurityInsightActivity(isEn,
                "save-state",
                actorUserId,
                fingerprint,
                isEn ? "Detection state updated." : "탐지 상태 저장");
        response.put("success", true);
        response.put("savedState", nextRow);
        response.put("message", isEn ? "Detection state saved." : "탐지 상태를 저장했습니다.");
        return response;
    }

    @Override
    @Transactional
    public Map<String, Object> updateSecurityMonitoringState(String actorUserId, boolean isEn, Map<String, Object> payload) {
        Map<String, Object> response = new LinkedHashMap<>();
        String fingerprint = safeObjectString(payload == null ? null : payload.get("fingerprint"));
        if (fingerprint.isEmpty()) {
            response.put("success", false);
            response.put("message", isEn ? "Monitoring event fingerprint is required." : "모니터링 이벤트 fingerprint가 필요합니다.");
            return response;
        }
        String snapshotKey = snapshotKey("SECURITY_MONITORING_STATE", isEn);
        List<Map<String, String>> rows = new ArrayList<>(readSnapshotCards(snapshotKey));
        Map<String, String> nextRow = new LinkedHashMap<>();
        nextRow.put("fingerprint", fingerprint);
        nextRow.put("status", safeObjectString(payload.get("status")));
        nextRow.put("owner", safeObjectString(payload.get("owner")));
        nextRow.put("note", safeObjectString(payload.get("note")));
        nextRow.put("updatedAt", formatSnapshotTimestamp(LocalDateTime.now()));
        nextRow.put("updatedBy", safeString(actorUserId));
        nextRow.put("severity", safeObjectString(payload.get("severity")));
        nextRow.put("title", safeObjectString(payload.get("title")));
        nextRow.put("detail", safeObjectString(payload.get("detail")));
        nextRow.put("detectedAt", safeObjectString(payload.get("detectedAt")));

        boolean hasState = !safeString(nextRow.get("status")).isEmpty()
                || !safeString(nextRow.get("owner")).isEmpty()
                || !safeString(nextRow.get("note")).isEmpty();
        List<Map<String, String>> updated = rows.stream()
                .filter(row -> !fingerprint.equals(safeString(row.get("fingerprint"))))
                .collect(Collectors.toCollection(ArrayList::new));
        if (hasState) {
            updated.add(0, nextRow);
        }
        persistSnapshot(snapshotKey, updated, SNAPSHOT_TYPE_SECURITY_MONITORING_STATE, formatSnapshotTimestamp(LocalDateTime.now()));
        appendSecurityMonitoringActivity(
                isEn,
                "save-state",
                actorUserId,
                firstNonBlank(safeObjectString(payload.get("title")), fingerprint),
                firstNonBlank(safeObjectString(payload.get("status")), isEn ? "Monitoring state updated." : "모니터링 상태 저장"));
        response.put("success", true);
        response.put("savedState", nextRow);
        response.put("message", isEn ? "Monitoring state saved." : "모니터링 상태를 저장했습니다.");
        return response;
    }

    @Override
    @Transactional
    public Map<String, Object> registerSecurityMonitoringBlockCandidate(String actorUserId, boolean isEn, Map<String, Object> payload) {
        Map<String, Object> response = new LinkedHashMap<>();
        String target = safeObjectString(payload == null ? null : payload.get("target"));
        if (target.isEmpty()) {
            response.put("success", false);
            response.put("message", isEn ? "A block target is required." : "차단 대상이 필요합니다.");
            return response;
        }
        String snapshotKey = snapshotKey("SECURITY_MONITORING_BLOCKLIST", isEn);
        List<Map<String, String>> rows = new ArrayList<>(readSnapshotCards(snapshotKey));
        String timestamp = formatSnapshotTimestamp(LocalDateTime.now());
        String blockId = "BL-MON-" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("MMddHHmmss"));
        String blockType = firstNonBlank(safeObjectString(payload.get("blockType")), "IP");
        String sourceTitle = safeObjectString(payload.get("sourceTitle"));
        Map<String, String> candidate = new LinkedHashMap<>();
        candidate.put("blockId", blockId);
        candidate.put("target", target);
        candidate.put("blockType", blockType);
        candidate.put("reason", firstNonBlank(
                safeObjectString(payload.get("reason")),
                sourceTitle.isEmpty()
                        ? (isEn ? "Monitoring escalation candidate" : "모니터링 승격 후보")
                        : (isEn ? "Escalated from monitoring: " : "모니터링 승격: ") + sourceTitle));
        candidate.put("status", "REVIEW");
        candidate.put("expiresAt", safeObjectString(payload.get("expiresAt")));
        candidate.put("owner", safeString(actorUserId));
        candidate.put("sourceTitle", sourceTitle);
        candidate.put("sourceFingerprint", safeObjectString(payload.get("fingerprint")));
        candidate.put("sourceSeverity", safeObjectString(payload.get("severity")));
        candidate.put("registeredAt", timestamp);
        candidate.put("source", "monitoring");
        rows.add(0, candidate);
        persistSnapshot(
                snapshotKey,
                rows.stream().limit(20).collect(Collectors.toList()),
                SNAPSHOT_TYPE_SECURITY_MONITORING_BLOCKLIST,
                timestamp);
        persistBlocklistRow(candidate, actorUserId, isEn);
        appendBlocklistActionHistory(
                candidate,
                "REGISTER",
                "REVIEW",
                actorUserId,
                firstNonBlank(candidate.get("reason"), isEn ? "Monitoring block candidate registered." : "모니터링 차단 후보 등록"),
                timestamp,
                isEn);
        appendSecurityMonitoringActivity(
                isEn,
                "register-block-candidate",
                actorUserId,
                target,
                isEn ? "Monitoring block candidate registered." : "모니터링 차단 후보 등록");
        response.put("success", true);
        response.put("candidate", candidate);
        response.put("message", isEn ? "Block candidate registered." : "차단 후보를 등록했습니다.");
        return response;
    }

    @Override
    @Transactional
    public Map<String, Object> updateSecurityMonitoringBlockCandidate(String actorUserId, boolean isEn, Map<String, Object> payload) {
        String blockId = safeObjectString(payload == null ? null : payload.get("blockId"));
        String status = safeObjectString(payload == null ? null : payload.get("status")).toUpperCase(Locale.ROOT);
        if (blockId.isEmpty() || status.isEmpty()) {
            return Map.of(
                    "success", false,
                    "message", isEn ? "Block candidate id and status are required." : "차단 후보 ID와 상태가 필요합니다.");
        }
        String snapshotKey = snapshotKey("SECURITY_MONITORING_BLOCKLIST", isEn);
        List<Map<String, String>> rows = new ArrayList<>(readSnapshotCards(snapshotKey));
        boolean updated = false;
        Map<String, String> saved = null;
        for (int i = 0; i < rows.size(); i++) {
            Map<String, String> row = rows.get(i);
            if (!blockId.equals(safeString(row.get("blockId")))) {
                continue;
            }
            Map<String, String> next = new LinkedHashMap<>(row);
            next.put("status", status);
            String expiresAt = safeObjectString(payload.get("expiresAt"));
            if (!expiresAt.isEmpty()) {
                next.put("expiresAt", expiresAt);
            }
            next.put("reviewedAt", formatSnapshotTimestamp(LocalDateTime.now()));
            next.put("reviewedBy", safeString(actorUserId));
            if ("ACTIVE".equals(status)) {
                next.put("activatedAt", formatSnapshotTimestamp(LocalDateTime.now()));
                next.put("activatedBy", safeString(actorUserId));
            }
            rows.set(i, next);
            updated = true;
            saved = next;
            break;
        }
        if (!updated) {
            return Map.of(
                    "success", false,
                    "message", isEn ? "Block candidate was not found." : "차단 후보를 찾을 수 없습니다.");
        }
        persistSnapshot(snapshotKey, rows, SNAPSHOT_TYPE_SECURITY_MONITORING_BLOCKLIST, formatSnapshotTimestamp(LocalDateTime.now()));
        if (saved != null) {
            persistBlocklistRow(saved, actorUserId, isEn);
            String actionType = "ACTIVE".equals(status)
                    ? "ACTIVATE"
                    : ("RELEASED".equals(status) ? "RELEASE" : "STATUS_CHANGE");
            appendBlocklistActionHistory(
                    saved,
                    actionType,
                    status,
                    actorUserId,
                    firstNonBlank(
                            safeString(saved.get("reason")),
                            isEn ? "Monitoring block candidate updated." : "모니터링 차단 후보 상태 변경"),
                    formatSnapshotTimestamp(LocalDateTime.now()),
                    isEn);
        }
        if (saved != null && "ACTIVE".equals(status)) {
            String fingerprint = safeString(saved.get("sourceFingerprint"));
            if (!fingerprint.isEmpty()) {
                updateSecurityMonitoringState(actorUserId, isEn, Map.of(
                        "fingerprint", fingerprint,
                        "status", "BLOCKED",
                        "owner", safeString(saved.get("owner")),
                        "note", firstNonBlank(
                                safeString(saved.get("reason")),
                                isEn ? "Escalated to blocklist." : "차단목록으로 승격되었습니다."),
                        "severity", safeString(saved.get("sourceSeverity")),
                        "title", safeString(saved.get("sourceTitle"))));
            }
        }
        appendSecurityMonitoringActivity(
                isEn,
                "update-block-candidate",
                actorUserId,
                firstNonBlank(saved == null ? "" : saved.get("target"), blockId),
                isEn ? "Monitoring block candidate status updated to " + status + "." : "모니터링 차단 후보 상태 변경: " + status);
        return Map.of(
                "success", true,
                "candidate", saved,
                "message", isEn ? "Block candidate updated." : "차단 후보 상태를 변경했습니다.");
    }

    @Override
    @Transactional
    public Map<String, Object> dispatchSecurityMonitoringNotification(String actorUserId, boolean isEn, Map<String, Object> payload) {
        String title = safeObjectString(payload == null ? null : payload.get("title"));
        String detail = safeObjectString(payload == null ? null : payload.get("detail"));
        String severity = safeObjectString(payload == null ? null : payload.get("severity")).toUpperCase(Locale.ROOT);
        if (title.isEmpty()) {
            return Map.of(
                    "success", false,
                    "message", isEn ? "Monitoring event title is required." : "모니터링 이벤트 제목이 필요합니다.");
        }
        Map<String, String> notificationConfig = readSecurityInsightNotificationConfig(isEn);
        List<Map<String, String>> selected = List.of(mapOf(
                "severity", severity,
                "title", title,
                "detail", detail,
                "target", safeObjectString(payload.get("target")),
                "subject", safeObjectString(payload.get("sourceIp")),
                "engine", "monitoring-engine",
                "category", "security-monitoring-event",
                "action", "immediate"));
        DeliveryResult deliveryResult = sendSecurityInsightWebhook(selected, notificationConfig, "CRITICAL".equals(severity), isEn);
        appendSecurityMonitoringActivity(
                isEn,
                "dispatch-notification",
                actorUserId,
                firstNonBlank(safeObjectString(payload.get("target")), title),
                (isEn ? "Monitoring notification dispatched: " : "모니터링 알림 발송: ") + deliveryResult.status());
        return Map.of(
                "success", true,
                "message", "DELIVERED".equals(deliveryResult.status())
                        ? (isEn ? "Monitoring notification delivered." : "모니터링 알림을 발송했습니다.")
                        : (isEn ? "Monitoring notification was recorded." : "모니터링 알림 발송을 기록했습니다."),
                "deliveryStatus", deliveryResult.status(),
                "deliveryDetail", deliveryResult.detail());
    }

    @Override
    @Transactional
    public Map<String, Object> executeSecurityHistoryAction(String actorUserId, boolean isEn, Map<String, Object> payload) {
        String action = safeObjectString(payload == null ? null : payload.get("action")).toUpperCase(Locale.ROOT);
        String historyKey = safeObjectString(payload == null ? null : payload.get("historyKey"));
        String userId = safeObjectString(payload == null ? null : payload.get("userId"));
        String targetIp = safeObjectString(payload == null ? null : payload.get("targetIp"));
        String insttId = safeObjectString(payload == null ? null : payload.get("insttId"));
        String note = safeObjectString(payload == null ? null : payload.get("note"));
        if (action.isEmpty()) {
            return Map.of(
                    "success", false,
                    "message", isEn ? "Security action is required." : "보안 조치 유형이 필요합니다.");
        }
        if (historyKey.isEmpty()) {
            return Map.of(
                    "success", false,
                    "message", isEn ? "History key is required." : "이력 키가 필요합니다.");
        }

        String happenedAt = formatSnapshotTimestamp(LocalDateTime.now());
        Map<String, String> savedAction = new LinkedHashMap<>();
        savedAction.put("historyKey", historyKey);
        savedAction.put("action", action);
        savedAction.put("userId", userId);
        savedAction.put("targetIp", targetIp);
        savedAction.put("insttId", insttId);
        savedAction.put("note", note);
        savedAction.put("executedAt", happenedAt);
        savedAction.put("executedBy", safeString(actorUserId));

        String message;
        if ("ESCALATE_BLOCK_IP".equals(action)) {
            if (targetIp.isEmpty()) {
                return Map.of(
                        "success", false,
                        "message", isEn ? "Target IP is required to escalate block." : "IP 차단 승격에는 대상 IP가 필요합니다.");
            }
            Map<String, Object> blockCandidateResult = registerSecurityMonitoringBlockCandidate(actorUserId, isEn, Map.of(
                    "target", targetIp,
                    "blockType", "IP",
                    "reason", firstNonBlank(note, isEn ? "Escalated from security history." : "보안 이력에서 차단 승격"),
                    "sourceTitle", firstNonBlank(userId, targetIp),
                    "severity", "HIGH",
                    "fingerprint", historyKey));
            if (!Boolean.TRUE.equals(blockCandidateResult.get("success"))) {
                return blockCandidateResult;
            }
            Object candidate = blockCandidateResult.get("candidate");
            if (candidate instanceof Map) {
                Object blockId = ((Map<?, ?>) candidate).get("blockId");
                if (blockId != null) {
                    savedAction.put("blockId", safeString(String.valueOf(blockId)));
                }
            }
            message = isEn ? "IP block escalation registered." : "IP 차단 승격을 등록했습니다.";
        } else if ("UNBLOCK_USER".equals(action)) {
            message = isEn ? "User unblock request recorded." : "사용자 차단 해제 요청을 기록했습니다.";
        } else if ("REGISTER_EXCEPTION".equals(action)) {
            message = isEn ? "Temporary exception request recorded." : "임시 예외 요청을 기록했습니다.";
        } else if ("SAVE_NOTE".equals(action)) {
            message = isEn ? "Operator note saved." : "운영 메모를 저장했습니다.";
        } else {
            return Map.of(
                    "success", false,
                    "message", isEn ? "Unsupported security action." : "지원하지 않는 보안 조치입니다.");
        }

        String snapshotKey = snapshotKey("SECURITY_HISTORY_ACTIONS", isEn);
        List<Map<String, String>> rows = new ArrayList<>(readSnapshotCards(snapshotKey));
        List<Map<String, String>> updated = rows.stream()
                .filter(row -> !historyKey.equals(safeString(row.get("historyKey")))
                        || ("SAVE_NOTE".equals(action)
                        ? !"SAVE_NOTE".equals(safeString(row.get("action")))
                        : false))
                .collect(Collectors.toCollection(ArrayList::new));
        updated.add(0, savedAction);
        persistSnapshot(
                snapshotKey,
                updated.stream().limit(200).collect(Collectors.toList()),
                SNAPSHOT_TYPE_SECURITY_HISTORY_ACTIONS,
                happenedAt);
        appendSecurityMonitoringActivity(
                isEn,
                "security-history-" + action.toLowerCase(Locale.ROOT),
                actorUserId,
                firstNonBlank(targetIp, userId, historyKey),
                message);
        return Map.of(
                "success", true,
                "message", message,
                "savedAction", savedAction);
    }

    @Override
    @Transactional
    public Map<String, Object> clearSecurityInsightSuppressions(String actorUserId, boolean isEn) {
        String snapshotKey = snapshotKey("SECURITY_INSIGHT_STATE", isEn);
        List<Map<String, String>> rows = new ArrayList<>(readSnapshotCards(snapshotKey));
        List<Map<String, String>> updated = new ArrayList<>();
        for (Map<String, String> row : rows) {
            Map<String, String> next = new LinkedHashMap<>(row);
            next.put("suppressed", "N");
            next.put("updatedAt", formatSnapshotTimestamp(LocalDateTime.now()));
            next.put("updatedBy", safeString(actorUserId));
            boolean hasState = !safeString(next.get("status")).isEmpty()
                    || !safeString(next.get("owner")).isEmpty()
                    || !safeString(next.get("note")).isEmpty()
                    || !safeString(next.get("expiresAt")).isEmpty();
            if (hasState) {
                updated.add(next);
            }
        }
        persistSnapshot(snapshotKey, updated, SNAPSHOT_TYPE_SECURITY_INSIGHT_STATE, formatSnapshotTimestamp(LocalDateTime.now()));
        appendSecurityInsightActivity(isEn,
                "clear-suppressions",
                actorUserId,
                "security-policy",
                isEn ? "All suppressions cleared." : "숨김 상태 일괄 해제");
        return Map.of(
                "success", true,
                "message", isEn ? "Suppressions cleared." : "숨김 상태를 해제했습니다.");
    }

    @Override
    @Transactional
    public Map<String, Object> runSecurityInsightAutoFix(String actorUserId, boolean isEn, Map<String, Object> payload) {
        String category = safeObjectString(payload == null ? null : payload.get("category"));
        String target = safeObjectString(payload == null ? null : payload.get("target"));
        String subject = safeObjectString(payload == null ? null : payload.get("subject"));
        String featureCode = safeObjectString(payload == null ? null : payload.get("featureCode"));
        String fingerprint = safeObjectString(payload == null ? null : payload.get("fingerprint"));
        List<String> featureCodes = splitCsv(safeObjectString(payload == null ? null : payload.get("featureCodes")));
        if (!isExecutionApproved(isEn, fingerprint, actorUserId)) {
            return Map.of(
                    "success", false,
                    "message", isEn ? "Only APPROVED findings with a different executor can run auto-fix." : "APPROVED 상태이며 승인자와 다른 실행자만 자동 정리를 실행할 수 있습니다.");
        }
        if ("duplicate-menu-url".equals(category)) {
            return runMenuPermissionAutoCleanup(actorUserId, isEn, target.isEmpty() ? Collections.emptyList() : List.of(target));
        }
        if ("duplicate-view-feature".equals(category) && !featureCodes.isEmpty()) {
            authGroupManageMapper.disableFeaturesByFeatureCodes(featureCodes);
            appendSecurityInsightActivity(isEn,
                    "auto-fix-duplicate-view",
                    actorUserId,
                    String.join(", ", featureCodes),
                    isEn ? "Duplicated VIEW features disabled." : "중복 VIEW 기능 비활성화");
            return Map.of(
                    "success", true,
                    "message", isEn ? "Duplicated VIEW features were disabled." : "중복 VIEW 기능을 비활성화했습니다.",
                    "diagnostics", buildMenuPermissionDiagnosticSummary(isEn));
        }
        if (("inactive-role-grant".equals(category)
                || "sensitive-feature-exposure".equals(category)
                || "company-scope-sensitive-exposure".equals(category))
                && !subject.isEmpty()
                && !featureCode.isEmpty()) {
            authGroupManageMapper.deleteAuthorFeatureRelation(subject, featureCode);
            appendSecurityInsightActivity(isEn,
                    "auto-fix-role-grant",
                    actorUserId,
                    subject + " -> " + featureCode,
                    isEn ? "Role-feature relation removed." : "역할 권한 연결 제거");
            return Map.of(
                    "success", true,
                    "message", isEn ? "Role-feature relation was removed." : "역할 권한 연결을 제거했습니다.",
                    "diagnostics", buildMenuPermissionDiagnosticSummary(isEn));
        }
        if ("inactive-user-override".equals(category) && !subject.isEmpty() && !featureCode.isEmpty()) {
            authGroupManageMapper.deactivateUserFeatureOverride(subject, featureCode);
            appendSecurityInsightActivity(isEn,
                    "auto-fix-user-override",
                    actorUserId,
                    subject + " -> " + featureCode,
                    isEn ? "User override deactivated." : "사용자 override 비활성화");
            return Map.of(
                    "success", true,
                    "message", isEn ? "User override was deactivated." : "사용자 override를 비활성화했습니다.",
                    "diagnostics", buildMenuPermissionDiagnosticSummary(isEn));
        }
        return Map.of(
                "success", false,
                "message", isEn ? "This finding is not auto-fixable." : "이 탐지 항목은 자동 정리 대상이 아닙니다.");
    }

    @Override
    @Transactional
    public Map<String, Object> saveSecurityInsightNotificationConfig(String actorUserId, boolean isEn, Map<String, Object> payload) {
        String snapshotKey = snapshotKey("SECURITY_INSIGHT_NOTIFICATION", isEn);
        Map<String, String> next = new LinkedHashMap<>(defaultSecurityInsightNotificationConfig());
        next.put("slackEnabled", "Y".equalsIgnoreCase(safeObjectString(payload.get("slackEnabled"))) ? "Y" : "N");
        next.put("mailEnabled", "Y".equalsIgnoreCase(safeObjectString(payload.get("mailEnabled"))) ? "Y" : "N");
        next.put("webhookEnabled", "Y".equalsIgnoreCase(safeObjectString(payload.get("webhookEnabled"))) ? "Y" : "N");
        next.put("notifyCritical", "Y".equalsIgnoreCase(safeObjectString(payload.get("notifyCritical"))) ? "Y" : "N");
        next.put("notifyHigh", "Y".equalsIgnoreCase(safeObjectString(payload.get("notifyHigh"))) ? "Y" : "N");
        next.put("newOnlyMode", "Y".equalsIgnoreCase(safeObjectString(payload.get("newOnlyMode"))) ? "Y" : "N");
        next.put("digestEnabled", "Y".equalsIgnoreCase(safeObjectString(payload.get("digestEnabled"))) ? "Y" : "N");
        next.put("digestHour", normalizeHour(safeObjectString(payload.get("digestHour"))));
        next.put("digestMinute", normalizeMinute(safeObjectString(payload.get("digestMinute"))));
        next.put("slackChannel", safeObjectString(payload.get("slackChannel")));
        next.put("mailRecipients", safeObjectString(payload.get("mailRecipients")));
        next.put("webhookUrl", safeObjectString(payload.get("webhookUrl")));
        Map<String, String> existing = readSecurityInsightNotificationConfig(isEn);
        next.put("lastDigestAt", safeString(existing.get("lastDigestAt")));
        next.put("lastDigestStatus", safeString(existing.get("lastDigestStatus")));
        next.put("updatedAt", formatSnapshotTimestamp(LocalDateTime.now()));
        next.put("updatedBy", safeString(actorUserId));
        persistSnapshot(snapshotKey, List.of(next), SNAPSHOT_TYPE_SECURITY_INSIGHT_NOTIFICATION, formatSnapshotTimestamp(LocalDateTime.now()));
        appendSecurityInsightActivity(isEn,
                "save-notification-config",
                actorUserId,
                "security-policy-notification",
                isEn ? "Notification routing updated." : "보안 알림 라우팅 저장");
        return Map.of(
                "success", true,
                "message", isEn ? "Notification routing saved." : "보안 알림 라우팅을 저장했습니다.",
                "config", next);
    }

    @Override
    @Transactional
    public Map<String, Object> runSecurityInsightBulkAutoFix(String actorUserId, boolean isEn, List<Map<String, Object>> findings) {
        List<Map<String, Object>> rows = findings == null ? Collections.emptyList() : findings;
        int requestedCount = rows.size();
        int successCount = 0;
        int skippedCount = 0;
        List<Map<String, String>> details = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> normalized = row == null ? Map.of() : row;
            Map<String, Object> result = runSecurityInsightAutoFix(actorUserId, isEn, normalized);
            boolean success = Boolean.TRUE.equals(result.get("success"));
            if (success) {
                successCount++;
            } else {
                skippedCount++;
            }
            details.add(mapOf(
                    "category", safeObjectString(normalized.get("category")),
                    "target", safeObjectString(normalized.get("target")),
                    "subject", safeObjectString(normalized.get("subject")),
                    "success", success ? "Y" : "N",
                    "message", safeObjectString(result.get("message"))));
        }
        appendSecurityInsightActivity(isEn,
                "bulk-auto-fix",
                actorUserId,
                "requested=" + requestedCount + ", success=" + successCount + ", skipped=" + skippedCount,
                isEn ? "Bulk security auto-fix executed." : "보안 일괄 자동 정리 실행");
        return Map.of(
                "success", successCount > 0,
                "message", isEn
                        ? String.format(Locale.ROOT, "Bulk auto-fix completed. success=%d skipped=%d", successCount, skippedCount)
                        : String.format(Locale.ROOT, "일괄 자동 정리를 실행했습니다. 성공=%d, 건너뜀=%d", successCount, skippedCount),
                "requestedCount", requestedCount,
                "successCount", successCount,
                "skippedCount", skippedCount,
                "details", details,
                "diagnostics", buildMenuPermissionDiagnosticSummary(isEn));
    }

    @Override
    @Transactional
    public Map<String, Object> runSecurityInsightRollback(String actorUserId, boolean isEn, Map<String, Object> payload) {
        String category = safeObjectString(payload == null ? null : payload.get("category"));
        String subject = safeObjectString(payload == null ? null : payload.get("subject"));
        String featureCode = safeObjectString(payload == null ? null : payload.get("featureCode"));
        String fingerprint = safeObjectString(payload == null ? null : payload.get("fingerprint"));
        List<String> featureCodes = splitCsv(safeObjectString(payload == null ? null : payload.get("featureCodes")));
        if (!isExecutionApproved(isEn, fingerprint, actorUserId)) {
            return Map.of(
                    "success", false,
                    "message", isEn ? "Only APPROVED findings with a different executor can run rollback." : "APPROVED 상태이며 승인자와 다른 실행자만 원복을 실행할 수 있습니다.");
        }
        if ("duplicate-view-feature".equals(category) && !featureCodes.isEmpty()) {
            authGroupManageMapper.enableFeaturesByFeatureCodes(featureCodes);
            appendSecurityInsightActivity(isEn,
                    "rollback-duplicate-view",
                    actorUserId,
                    String.join(", ", featureCodes),
                    isEn ? "Duplicated VIEW features re-enabled." : "중복 VIEW 기능 원복");
            return Map.of(
                    "success", true,
                    "message", isEn ? "Duplicated VIEW features were restored." : "중복 VIEW 기능을 원복했습니다.",
                    "diagnostics", buildMenuPermissionDiagnosticSummary(isEn));
        }
        if (("inactive-role-grant".equals(category)
                || "sensitive-feature-exposure".equals(category)
                || "company-scope-sensitive-exposure".equals(category))
                && !subject.isEmpty()
                && !featureCode.isEmpty()) {
            if (authGroupManageMapper.countAuthorFeaturePermission(subject, featureCode) == 0) {
                Map<String, String> params = new LinkedHashMap<>();
                params.put("authorCode", subject);
                params.put("featureCode", featureCode);
                authGroupManageMapper.insertAuthorFeatureRelation(params);
            }
            appendSecurityInsightActivity(isEn,
                    "rollback-role-grant",
                    actorUserId,
                    subject + " -> " + featureCode,
                    isEn ? "Role-feature relation restored." : "역할 권한 연결 원복");
            return Map.of(
                    "success", true,
                    "message", isEn ? "Role-feature relation was restored." : "역할 권한 연결을 원복했습니다.",
                    "diagnostics", buildMenuPermissionDiagnosticSummary(isEn));
        }
        if ("inactive-user-override".equals(category) && !subject.isEmpty() && !featureCode.isEmpty()) {
            authGroupManageMapper.reactivateUserFeatureOverride(subject, featureCode);
            appendSecurityInsightActivity(isEn,
                    "rollback-user-override",
                    actorUserId,
                    subject + " -> " + featureCode,
                    isEn ? "User override restored." : "사용자 override 원복");
            return Map.of(
                    "success", true,
                    "message", isEn ? "User override was restored." : "사용자 override를 원복했습니다.",
                    "diagnostics", buildMenuPermissionDiagnosticSummary(isEn));
        }
        return Map.of(
                "success", false,
                "message", isEn ? "This finding is not rollback-capable." : "이 탐지 항목은 원복 실행 대상이 아닙니다.");
    }

    @Override
    @Transactional
    public Map<String, Object> dispatchSecurityInsightNotifications(String actorUserId, boolean isEn, Map<String, Object> payload) {
        boolean criticalOnly = "Y".equalsIgnoreCase(safeObjectString(payload.get("criticalOnly")));
        boolean highIncluded = "Y".equalsIgnoreCase(safeObjectString(payload.get("includeHigh")));
        boolean digestRun = "Y".equalsIgnoreCase(safeObjectString(payload.get("digestRun")));
        Map<String, String> notificationConfig = readSecurityInsightNotificationConfig(isEn);
        Map<String, Object> summary = buildSecurityInsightSummary(
                buildDuplicatedMenuUrlRows(authGroupManageMapper.selectActiveMenuUrlRows()),
                buildDuplicatedViewMappingRows(authGroupManageMapper.selectActiveMenuViewFeatureRows()),
                buildMenusMissingViewRows(authGroupManageMapper.selectActiveMenusMissingViewRows(), isEn),
                buildInactiveAuthorFeatureRelationRows(authGroupManageMapper.selectInactiveAuthorFeatureRelationRows(), isEn),
                buildInactiveUserOverrideRows(authGroupManageMapper.selectInactiveUserFeatureOverrideRows(), isEn),
                buildSensitiveRoleExposureRows(authGroupManageMapper.selectSensitiveFeatureRoleExposureRows(), isEn, false),
                buildSensitiveRoleExposureRows(authGroupManageMapper.selectCompanyScopeSensitiveFeatureExposureRows(), isEn, true),
                isEn);
        List<Map<String, String>> items = safeRows((List<Map<String, String>>) summary.get("securityInsightItems"));
        List<Map<String, String>> selected = items.stream()
                .filter(row -> {
                    String severity = safeString(row.get("severity")).toUpperCase(Locale.ROOT);
                    boolean isNew = "Y".equalsIgnoreCase(safeString(row.get("isNew")));
                    if ("Y".equalsIgnoreCase(notificationConfig.get("newOnlyMode")) && !isNew) {
                        return false;
                    }
                    if ("CRITICAL".equals(severity)) {
                        return "Y".equalsIgnoreCase(notificationConfig.get("notifyCritical"));
                    }
                    if ("HIGH".equals(severity)) {
                        return !criticalOnly && highIncluded && "Y".equalsIgnoreCase(notificationConfig.get("notifyHigh"));
                    }
                    return false;
                })
                .collect(Collectors.toList());
        String snapshotKey = snapshotKey("SECURITY_INSIGHT_DELIVERY", isEn);
        List<Map<String, String>> persisted = new ArrayList<>(readSnapshotCards(snapshotKey));
        Map<String, String> row = new LinkedHashMap<>();
        row.put("sentAt", formatSnapshotTimestamp(LocalDateTime.now()));
        row.put("actorUserId", safeString(actorUserId));
        row.put("mode", digestRun ? "scheduled-digest" : (criticalOnly ? "critical-only" : "critical-high"));
        row.put("findingCount", String.valueOf(selected.size()));
        row.put("slackEnabled", safeString(notificationConfig.get("slackEnabled")));
        row.put("mailEnabled", safeString(notificationConfig.get("mailEnabled")));
        row.put("webhookEnabled", safeString(notificationConfig.get("webhookEnabled")));
        row.put("slackChannel", safeString(notificationConfig.get("slackChannel")));
        row.put("mailRecipients", safeString(notificationConfig.get("mailRecipients")));
        row.put("webhookUrl", safeString(notificationConfig.get("webhookUrl")));
        DeliveryResult deliveryResult = sendSecurityInsightWebhook(selected, notificationConfig, criticalOnly, isEn);
        row.put("status", selected.isEmpty() ? "SKIPPED" : deliveryResult.status());
        row.put("topFinding", selected.isEmpty() ? "-" : safeString(selected.get(0).get("title")));
        row.put("deliveryDetail", deliveryResult.detail());
        row.put("slackStatus", deliveryResult.slackStatus());
        row.put("mailStatus", deliveryResult.mailStatus());
        row.put("webhookStatus", deliveryResult.webhookStatus());
        persistNotificationDeliveryHistory(row);
        persisted.add(0, row);
        persistSnapshot(snapshotKey,
                trimSnapshotRows(persisted, SECURITY_INSIGHT_DELIVERY_HISTORY_LIMIT),
                SNAPSHOT_TYPE_SECURITY_INSIGHT_DELIVERY,
                formatSnapshotTimestamp(LocalDateTime.now()));
        if (digestRun) {
            String notificationSnapshotKey = snapshotKey("SECURITY_INSIGHT_NOTIFICATION", isEn);
            Map<String, String> nextConfig = new LinkedHashMap<>(notificationConfig);
            nextConfig.put("lastDigestAt", row.get("sentAt"));
            nextConfig.put("lastDigestStatus", row.get("status"));
            nextConfig.put("updatedAt", safeString(notificationConfig.get("updatedAt")));
            nextConfig.put("updatedBy", safeString(notificationConfig.get("updatedBy")));
            persistSnapshot(notificationSnapshotKey,
                    List.of(nextConfig),
                    SNAPSHOT_TYPE_SECURITY_INSIGHT_NOTIFICATION,
                    formatSnapshotTimestamp(LocalDateTime.now()));
        }
        appendSecurityInsightActivity(isEn,
                digestRun ? "dispatch-digest" : "dispatch-notification",
                actorUserId,
                digestRun ? "scheduled-digest" : (criticalOnly ? "critical-only" : "critical-high"),
                digestRun
                        ? (isEn ? "Scheduled digest dispatch recorded." : "보안 digest 발송 기록 저장")
                        : (isEn ? "Security notification dispatch recorded." : "보안 알림 발송 기록 저장"));
        return Map.of(
                "success", true,
                "message", selected.isEmpty()
                        ? (isEn ? "No matching findings to dispatch." : "발송할 탐지 항목이 없습니다.")
                        : (digestRun
                            ? (isEn ? "Security digest dispatch was recorded." : "보안 digest 발송을 기록했습니다.")
                            : (isEn ? "Security notification dispatch was recorded." : "보안 알림 발송을 기록했습니다.")),
                "delivery", row);
    }

    @Override
    @Transactional
    public Map<String, Object> expireSecurityInsightSuppressions(boolean isEn) {
        SecurityInsightStateSnapshot snapshot = loadSecurityInsightStateSnapshot(isEn, true);
        return Map.of(
                "success", true,
                "temporarySuppressionCount", snapshot.temporarySuppressionCount(),
                "expiredSuppressionCount", snapshot.expiredSuppressionCount(),
                "message", isEn
                        ? "Expired suppressions were normalized."
                        : "만료된 suppress 상태를 정리했습니다.");
    }

    @Override
    @Transactional
    public Map<String, Object> runScheduledSecurityInsightDigest(boolean isEn) {
        Map<String, String> notificationConfig = readSecurityInsightNotificationConfig(isEn);
        if (!"Y".equalsIgnoreCase(safeString(notificationConfig.get("digestEnabled")))) {
            return Map.of("success", true, "status", "SKIPPED", "message", isEn ? "Digest disabled." : "digest가 비활성화되어 있습니다.");
        }
        LocalDateTime now = LocalDateTime.now();
        LocalTime targetTime = LocalTime.of(
                Integer.parseInt(normalizeHour(safeString(notificationConfig.get("digestHour")))),
                Integer.parseInt(normalizeMinute(safeString(notificationConfig.get("digestMinute")))));
        LocalDateTime scheduledAt = LocalDate.now().atTime(targetTime);
        if (now.isBefore(scheduledAt)) {
            return Map.of("success", true, "status", "SKIPPED", "message", isEn ? "Digest time not reached." : "digest 실행 시각 전입니다.");
        }
        LocalDateTime lastDigestAt = parseSnapshotTimestamp(safeString(notificationConfig.get("lastDigestAt")));
        if (lastDigestAt != null && !lastDigestAt.isBefore(scheduledAt)) {
            return Map.of("success", true, "status", "SKIPPED", "message", isEn ? "Digest already sent for current window." : "현재 실행 구간의 digest가 이미 발송되었습니다.");
        }
        return dispatchSecurityInsightNotifications("system:digest-scheduler", isEn, Map.of(
                "criticalOnly", "N",
                "includeHigh", "Y",
                "digestRun", "Y"));
    }

    private DeliveryResult sendSecurityInsightWebhook(
            List<Map<String, String>> selected,
            Map<String, String> notificationConfig,
            boolean criticalOnly,
            boolean isEn) {
        if (selected == null || selected.isEmpty()) {
            return new DeliveryResult("SKIPPED", isEn ? "No findings selected." : "발송 대상 탐지가 없습니다.", "SKIPPED", "SKIPPED", "SKIPPED");
        }
        String webhookUrl = safeString(notificationConfig.get("webhookUrl"));
        String slackStatus = "N".equalsIgnoreCase(safeString(notificationConfig.get("slackEnabled"))) ? "DISABLED" : "CONFIG_REQUIRED";
        String mailStatus = "N".equalsIgnoreCase(safeString(notificationConfig.get("mailEnabled"))) ? "DISABLED" : "MAIL_NOT_CONFIGURED";
        String webhookStatus = "N".equalsIgnoreCase(safeString(notificationConfig.get("webhookEnabled"))) ? "DISABLED" : "CONFIG_REQUIRED";
        if (!safeString(notificationConfig.get("mailRecipients")).isEmpty() && "Y".equalsIgnoreCase(safeString(notificationConfig.get("mailEnabled")))) {
            mailStatus = "MAIL_NOT_CONFIGURED";
        }
        if (!webhookUrl.isEmpty()) {
            boolean slackWebhook = webhookUrl.contains("hooks.slack.com");
            if (slackWebhook && "Y".equalsIgnoreCase(safeString(notificationConfig.get("slackEnabled")))) {
                String status = postWebhookPayload(buildWebhookPayload(selected, criticalOnly, webhookUrl), webhookUrl);
                slackStatus = status;
                webhookStatus = "Y".equalsIgnoreCase(safeString(notificationConfig.get("webhookEnabled"))) ? "SHARED_WITH_SLACK" : webhookStatus;
            } else if ("Y".equalsIgnoreCase(safeString(notificationConfig.get("webhookEnabled")))) {
                webhookStatus = postWebhookPayload(buildWebhookPayload(selected, criticalOnly, webhookUrl), webhookUrl);
            }
        }
        String overallStatus = "RECORDED";
        if ("FAILED".equals(slackStatus) || "FAILED".equals(webhookStatus)) {
            overallStatus = "FAILED";
        } else if ("DELIVERED".equals(slackStatus) || "DELIVERED".equals(webhookStatus)) {
            overallStatus = "DELIVERED";
        }
        String detail = String.format(
                Locale.ROOT,
                "slack=%s, mail=%s, webhook=%s",
                slackStatus,
                mailStatus,
                webhookStatus);
        return new DeliveryResult(overallStatus, detail, slackStatus, mailStatus, webhookStatus);
    }

    private String postWebhookPayload(Object payload, String webhookUrl) {
        try {
            String json = objectMapper.writeValueAsString(payload);
            HttpRequest request = HttpRequest.newBuilder(URI.create(webhookUrl))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                return "DELIVERED";
            }
            return "FAILED";
        } catch (Exception ex) {
            return "FAILED";
        }
    }

    private String normalizeHour(String value) {
        int hour = parseBoundedInt(value, 9, 0, 23);
        return String.format(Locale.ROOT, "%02d", hour);
    }

    private String normalizeMinute(String value) {
        int minute = parseBoundedInt(value, 0, 0, 59);
        return String.format(Locale.ROOT, "%02d", minute);
    }

    private int parseBoundedInt(String value, int fallback, int min, int max) {
        try {
            int parsed = Integer.parseInt(safeString(value));
            if (parsed < min || parsed > max) {
                return fallback;
            }
            return parsed;
        } catch (Exception ex) {
            return fallback;
        }
    }

    private int parseCardInt(String value) {
        try {
            return Integer.parseInt(safeString(value).replaceAll("[^0-9-]", ""));
        } catch (Exception ex) {
            return 0;
        }
    }

    private Object buildWebhookPayload(List<Map<String, String>> selected, boolean criticalOnly, String webhookUrl) {
        if (safeString(webhookUrl).contains("hooks.slack.com")) {
            String text = String.format(
                    Locale.ROOT,
                    "[security-policy] mode=%s findings=%d top=%s",
                    criticalOnly ? "critical-only" : "critical-high",
                    selected.size(),
                    safeString(selected.get(0).get("title")));
            return Map.of("text", text);
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("sentAt", formatSnapshotTimestamp(LocalDateTime.now()));
        body.put("mode", criticalOnly ? "critical-only" : "critical-high");
        body.put("findingCount", selected.size());
        body.put("topFinding", safeString(selected.get(0).get("title")));
        body.put("findings", selected.stream().limit(20).collect(Collectors.toList()));
        return body;
    }

    private List<Map<String, String>> buildSecurityAuditSummaryRows(SecurityAuditSnapshot auditSnapshot, boolean isEn) {
        SecurityAuditAggregate aggregate = auditSnapshot == null
                ? SecurityAuditAggregate.empty()
                : auditSnapshot.getAggregate();
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(summaryCard(isEn ? "Company Scope Denies" : "회사 스코프 차단", String.valueOf(aggregate.getDeniedCount()),
                isEn ? "Blocked requests due to missing or mismatched company scope." : "회사 컨텍스트 누락 또는 불일치로 차단된 요청"));
        rows.add(summaryCard(isEn ? "Global No-Context" : "전역 예외 허용", String.valueOf(aggregate.getGlobalBypassCount()),
                isEn ? "Global admin executions without an explicit company context." : "명시적 회사 ID 없이 허용된 전역 관리자 실행"));
        rows.add(summaryCard(isEn ? "Implicit Self Scope" : "자기회사 암묵 적용", String.valueOf(aggregate.getImplicitSelfCount()),
                isEn ? "Requests resolved to the actor company without an explicit company parameter." : "회사 ID 파라미터 없이 계정 회사로 해석된 요청"));
        rows.add(summaryCard(isEn ? "Company Mismatch" : "회사 불일치", String.valueOf(aggregate.getMismatchCount()),
                isEn ? "Requests blocked because the target company did not match the actor company." : "대상 회사와 계정 회사가 달라 차단된 요청"));
        return rows;
    }

    private List<Map<String, String>> buildMenusMissingViewRows(List<Map<String, String>> rows, boolean isEn) {
        if (rows == null || rows.isEmpty()) {
            return Collections.emptyList();
        }
        return rows.stream()
                .map(row -> mapOf(
                        "menuCode", safeString(row.get("menuCode")),
                        "menuUrl", safeString(row.get("menuUrl")),
                        "issueSummary", isEn ? "Active menu without active VIEW feature" : "활성 메뉴에 활성 VIEW 기능이 없습니다."))
                .sorted(Comparator.comparing(row -> safeString(row.get("menuUrl"))))
                .collect(Collectors.toList());
    }

    private List<Map<String, String>> buildInactiveAuthorFeatureRelationRows(List<Map<String, String>> rows, boolean isEn) {
        if (rows == null || rows.isEmpty()) {
            return Collections.emptyList();
        }
        return rows.stream()
                .map(row -> mapOf(
                        "authorCode", safeString(row.get("authorCode")),
                        "authorNm", safeString(row.get("authorNm")),
                        "featureCode", safeString(row.get("featureCode")),
                        "menuCode", safeString(row.get("menuCode")),
                        "menuUrl", safeString(row.get("menuUrl")),
                        "issueType", safeString(row.get("issueType")),
                        "issueLabel", resolvePermissionIssueLabel(safeString(row.get("issueType")), isEn)))
                .collect(Collectors.toList());
    }

    private List<Map<String, String>> buildInactiveUserOverrideRows(List<Map<String, String>> rows, boolean isEn) {
        if (rows == null || rows.isEmpty()) {
            return Collections.emptyList();
        }
        return rows.stream()
                .map(row -> mapOf(
                        "targetId", safeString(row.get("targetId")),
                        "memberTypeCode", safeString(row.get("memberTypeCode")),
                        "featureCode", safeString(row.get("featureCode")),
                        "menuCode", safeString(row.get("menuCode")),
                        "menuUrl", safeString(row.get("menuUrl")),
                        "overrideType", safeString(row.get("overrideType")),
                        "issueType", safeString(row.get("issueType")),
                        "issueLabel", resolvePermissionIssueLabel(safeString(row.get("issueType")), isEn)))
                .collect(Collectors.toList());
    }

    private List<Map<String, String>> buildSensitiveRoleExposureRows(List<Map<String, String>> rows, boolean isEn, boolean companyScopedOnly) {
        if (rows == null || rows.isEmpty()) {
            return Collections.emptyList();
        }
        return rows.stream()
                .map(row -> mapOf(
                        "authorCode", safeString(row.get("authorCode")),
                        "authorNm", safeString(row.get("authorNm")),
                        "menuCode", safeString(row.get("menuCode")),
                        "menuUrl", safeString(row.get("menuUrl")),
                        "featureCode", safeString(row.get("featureCode")),
                        "riskLabel", companyScopedOnly
                                ? (isEn ? "Company-scoped role on global-sensitive feature" : "회사 범위 역할에 전역 민감 기능 부여")
                                : (isEn ? "Sensitive feature assigned beyond master" : "민감 기능이 마스터 외 역할에 부여됨")))
                .collect(Collectors.toList());
    }

    private String resolvePermissionIssueLabel(String issueType, boolean isEn) {
        String normalized = safeString(issueType).toUpperCase(Locale.ROOT);
        if ("FEATURE_MISSING".equals(normalized)) {
            return isEn ? "Feature row is missing" : "기능 행이 없습니다.";
        }
        if ("FEATURE_INACTIVE".equals(normalized)) {
            return isEn ? "Feature is inactive" : "기능이 비활성 상태입니다.";
        }
        if ("MENU_INACTIVE".equals(normalized)) {
            return isEn ? "Menu is inactive" : "메뉴가 비활성 상태입니다.";
        }
        if ("MENU_CODE_INACTIVE".equals(normalized)) {
            return isEn ? "Menu code is inactive" : "메뉴 코드가 비활성 상태입니다.";
        }
        return isEn ? "Unknown integrity issue" : "알 수 없는 무결성 이슈";
    }

    private EmissionResultFilterSnapshot filterEmissionResultSummaryViews(List<EmissionResultSummaryView> allItems,
            String keyword,
            String normalizedResultStatus,
            String normalizedVerificationStatus) {
        List<EmissionResultSummaryView> filteredItems = new ArrayList<>();
        long reviewCount = 0L;
        long verifiedCount = 0L;
        if (allItems == null || allItems.isEmpty()) {
            return new EmissionResultFilterSnapshot(filteredItems, reviewCount, verifiedCount);
        }
        for (EmissionResultSummaryView item : allItems) {
            if (item == null) {
                continue;
            }
            if (!keyword.isEmpty()
                    && !item.getProjectName().toLowerCase(Locale.ROOT).contains(keyword)
                    && !item.getCompanyName().toLowerCase(Locale.ROOT).contains(keyword)
                    && !item.getResultId().toLowerCase(Locale.ROOT).contains(keyword)) {
                continue;
            }
            if (!normalizedResultStatus.isEmpty() && !normalizedResultStatus.equals(item.getResultStatusCode())) {
                continue;
            }
            if (!normalizedVerificationStatus.isEmpty()
                    && !normalizedVerificationStatus.equals(item.getVerificationStatusCode())) {
                continue;
            }
            filteredItems.add(item);
            if ("REVIEW".equals(item.getResultStatusCode())) {
                reviewCount++;
            }
            if ("VERIFIED".equals(item.getVerificationStatusCode())) {
                verifiedCount++;
            }
        }
        return new EmissionResultFilterSnapshot(filteredItems, reviewCount, verifiedCount);
    }

    private List<EmissionResultSummaryView> buildEmissionResultSummaryViews(boolean isEn) {
        String prefix = isEn ? "/en/admin" : "/admin";
        List<EmissionResultSummaryView> items = new ArrayList<>();
        items.add(new EmissionResultSummaryView("ER-2026-001", "2026 Q1 Capture Plant Baseline",
                "Korea CCUS Plant", "2026-03-04", "125,440 tCO2e", "COMPLETED",
                isEn ? "Completed" : "산정 완료", "VERIFIED", isEn ? "Verified" : "검증 완료",
                prefix + "/emission/result_detail?resultId=ER-2026-001"));
        items.add(new EmissionResultSummaryView("ER-2026-002", "Blue Hydrogen Process Review",
                "Hanbit Energy", "2026-03-03", "84,210 tCO2e", "REVIEW",
                isEn ? "Under Review" : "검토 중", "PENDING", isEn ? "Pending" : "검증 대기",
                prefix + "/emission/result_detail?resultId=ER-2026-002"));
        items.add(new EmissionResultSummaryView("ER-2026-003", "Transport Network Simulation",
                "East Carbon Hub", "2026-02-28", "56,980 tCO2e", "DRAFT",
                isEn ? "Draft" : "임시 저장", "NOT_REQUIRED", isEn ? "Not Required" : "검증 제외",
                prefix + "/emission/result_detail?resultId=ER-2026-003"));
        items.add(new EmissionResultSummaryView("ER-2026-004", "Storage Integrity Monitoring",
                "Seohae Storage", "2026-02-26", "142,300 tCO2e", "COMPLETED",
                isEn ? "Completed" : "산정 완료", "VERIFIED", isEn ? "Verified" : "검증 완료",
                prefix + "/emission/result_detail?resultId=ER-2026-004"));
        items.add(new EmissionResultSummaryView("ER-2026-005", "Methanol Conversion Project",
                "Daehan Synthesis", "2026-02-24", "73,560 tCO2e", "REVIEW",
                isEn ? "Under Review" : "검토 중", "PENDING", isEn ? "Pending" : "검증 대기",
                prefix + "/emission/result_detail?resultId=ER-2026-005"));
        items.add(new EmissionResultSummaryView("ER-2026-006", "Regional Capture Efficiency Audit",
                "Busan Capture Cluster", "2026-02-20", "91,004 tCO2e", "COMPLETED",
                isEn ? "Completed" : "산정 완료", "VERIFIED", isEn ? "Verified" : "검증 완료",
                prefix + "/emission/result_detail?resultId=ER-2026-006"));
        return items;
    }

    private List<Map<String, String>> buildDuplicatedMenuUrlRows(List<Map<String, String>> rows) {
        if (rows == null || rows.isEmpty()) {
            return Collections.emptyList();
        }
        Map<String, Set<String>> grouped = new LinkedHashMap<>();
        for (Map<String, String> row : rows) {
            String menuUrl = safeString(row.get("menuUrl"));
            String menuCode = safeString(row.get("menuCode"));
            if (menuUrl.isEmpty() || menuCode.isEmpty()) {
                continue;
            }
            grouped.computeIfAbsent(menuUrl, key -> new LinkedHashSet<>()).add(menuCode);
        }
        List<Map<String, String>> result = new ArrayList<>();
        for (Map.Entry<String, Set<String>> entry : grouped.entrySet()) {
            if (entry.getValue().size() < 2) {
                continue;
            }
            List<String> menuCodes = new ArrayList<>(entry.getValue());
            Collections.sort(menuCodes);
            String primaryMenuCode = menuCodes.get(0);
            String disableCandidates = menuCodes.size() > 1
                    ? String.join(", ", menuCodes.subList(1, menuCodes.size()))
                    : "";
            result.add(mapOf(
                    "menuUrl", entry.getKey(),
                    "menuCodeCount", String.valueOf(menuCodes.size()),
                    "menuCodes", String.join(", ", menuCodes),
                    "recommendedPrimaryMenuCode", primaryMenuCode,
                    "recommendedDisableMenuCodes", disableCandidates,
                    "recommendedAction", "KEEP_PRIMARY_DISABLE_OTHERS",
                    "recommendedSqlPreview", buildMenuCleanupSqlPreview(entry.getKey(), primaryMenuCode, disableCandidates)));
        }
        return result;
    }

    private List<Map<String, String>> buildDuplicatedViewMappingRows(List<Map<String, String>> rows) {
        if (rows == null || rows.isEmpty()) {
            return Collections.emptyList();
        }
        Map<String, Set<String>> menuCodesByUrl = new LinkedHashMap<>();
        Map<String, Set<String>> featureCodesByUrl = new LinkedHashMap<>();
        for (Map<String, String> row : rows) {
            String menuUrl = safeString(row.get("menuUrl"));
            String menuCode = safeString(row.get("menuCode"));
            String featureCode = safeString(row.get("featureCode"));
            if (menuUrl.isEmpty() || featureCode.isEmpty()) {
                continue;
            }
            menuCodesByUrl.computeIfAbsent(menuUrl, key -> new LinkedHashSet<>()).add(menuCode);
            featureCodesByUrl.computeIfAbsent(menuUrl, key -> new LinkedHashSet<>()).add(featureCode);
        }
        List<Map<String, String>> result = new ArrayList<>();
        for (Map.Entry<String, Set<String>> entry : featureCodesByUrl.entrySet()) {
            if (entry.getValue().size() < 2) {
                continue;
            }
            List<String> menuCodes = new ArrayList<>(menuCodesByUrl.getOrDefault(entry.getKey(), Collections.emptySet()));
            List<String> featureCodes = new ArrayList<>(entry.getValue());
            Collections.sort(menuCodes);
            Collections.sort(featureCodes);
            String primaryMenuCode = menuCodes.isEmpty() ? "" : menuCodes.get(0);
            String primaryFeatureCode = featureCodes.get(0);
            String removeCandidates = featureCodes.size() > 1
                    ? String.join(", ", featureCodes.subList(1, featureCodes.size()))
                    : "";
            result.add(mapOf(
                    "menuUrl", entry.getKey(),
                    "menuCodeCount", String.valueOf(menuCodes.size()),
                    "menuCodes", String.join(", ", menuCodes),
                    "viewFeatureCount", String.valueOf(featureCodes.size()),
                    "featureCodes", String.join(", ", featureCodes),
                    "recommendedPrimaryMenuCode", primaryMenuCode,
                    "recommendedPrimaryFeatureCode", primaryFeatureCode,
                    "recommendedRemoveFeatureCodes", removeCandidates,
                    "recommendedAction", "KEEP_PRIMARY_VIEW_REMOVE_OTHERS",
                    "recommendedSqlPreview", buildViewCleanupSqlPreview(entry.getKey(), primaryMenuCode, primaryFeatureCode, removeCandidates)));
        }
        return result;
    }

    private List<Map<String, String>> enrichDuplicatedViewMappingRows(List<Map<String, String>> rows) {
        if (rows == null || rows.isEmpty()) {
            return Collections.emptyList();
        }
        List<String> featureCodes = rows.stream()
                .map(row -> splitCsv(row.get("recommendedRemoveFeatureCodes")))
                .flatMap(Collection::stream)
                .distinct()
                .collect(Collectors.toList());
        if (featureCodes.isEmpty()) {
            List<Map<String, String>> fallback = new ArrayList<>();
            for (Map<String, String> row : rows) {
                Map<String, String> copy = new LinkedHashMap<>(row);
                copy.put("authorRelationImpactCount", "0");
                copy.put("userOverrideImpactCount", "0");
                copy.put("referenceImpactSummary", "-");
                copy.put("codexCliPrompt", buildCodexCliPrompt(copy, Collections.emptyList()));
                fallback.add(copy);
            }
            return fallback;
        }
        Map<String, Integer> authorRelationCounts = toReferenceCountMap(authGroupManageMapper.selectAuthorFeatureRelationCounts(featureCodes));
        Map<String, Integer> userOverrideCounts = toReferenceCountMap(authGroupManageMapper.selectUserFeatureOverrideCounts(featureCodes));
        List<Map<String, String>> enriched = new ArrayList<>();
        for (Map<String, String> row : rows) {
            Map<String, String> copy = new LinkedHashMap<>(row);
            List<String> removeCandidates = splitCsv(row.get("recommendedRemoveFeatureCodes"));
            List<String> impactRows = new ArrayList<>();
            int totalAuthorRelationCount = 0;
            int totalUserOverrideCount = 0;
            for (String featureCode : removeCandidates) {
                int authorCount = authorRelationCounts.getOrDefault(featureCode, 0);
                int overrideCount = userOverrideCounts.getOrDefault(featureCode, 0);
                totalAuthorRelationCount += authorCount;
                totalUserOverrideCount += overrideCount;
                impactRows.add(featureCode + " [role=" + authorCount + ", override=" + overrideCount + "]");
            }
            copy.put("authorRelationImpactCount", String.valueOf(totalAuthorRelationCount));
            copy.put("userOverrideImpactCount", String.valueOf(totalUserOverrideCount));
            copy.put("referenceImpactSummary", impactRows.isEmpty() ? "-" : String.join("; ", impactRows));
            copy.put("codexCliPrompt", buildCodexCliPrompt(copy, impactRows));
            enriched.add(copy);
        }
        enriched.sort(Comparator.comparing(row -> safeString(row.get("menuUrl"))));
        return enriched;
    }

    private String buildMenuCleanupSqlPreview(String menuUrl, String primaryMenuCode, String disableCandidates) {
        List<String> candidateCodes = splitCsv(disableCandidates);
        StringBuilder builder = new StringBuilder();
        builder.append("-- menuUrl: ").append(menuUrl).append("\n");
        builder.append("-- keep primary menu: ").append(primaryMenuCode).append("\n");
        if (candidateCodes.isEmpty()) {
            builder.append("-- no disable candidates");
            return builder.toString();
        }
        builder.append("SELECT MENU_CODE, MENU_URL, USE_AT\n")
                .append("FROM COMTNMENUINFO\n")
                .append("WHERE MENU_CODE IN (").append(joinQuoted(candidateCodes)).append(")\n")
                .append("ORDER BY MENU_CODE;\n\n");
        builder.append("UPDATE COMTNMENUINFO\n")
                .append("SET USE_AT = 'N'\n")
                .append("WHERE MENU_CODE IN (").append(joinQuoted(candidateCodes)).append(");");
        return builder.toString();
    }

    private String buildViewCleanupSqlPreview(String menuUrl,
            String primaryMenuCode,
            String primaryFeatureCode,
            String removeCandidates) {
        List<String> candidateCodes = splitCsv(removeCandidates);
        StringBuilder builder = new StringBuilder();
        builder.append("-- menuUrl: ").append(menuUrl).append("\n");
        builder.append("-- keep primary menu/view: ").append(primaryMenuCode).append(" / ").append(primaryFeatureCode).append("\n");
        if (candidateCodes.isEmpty()) {
            builder.append("-- no redundant VIEW features");
            return builder.toString();
        }
        builder.append("SELECT MENU_CODE, FEATURE_CODE, USE_AT\n")
                .append("FROM COMTNMENUFUNCTIONINFO\n")
                .append("WHERE FEATURE_CODE IN (").append(joinQuoted(candidateCodes)).append(")\n")
                .append("ORDER BY MENU_CODE, FEATURE_CODE;\n\n");
        builder.append("UPDATE COMTNMENUFUNCTIONINFO\n")
                .append("SET USE_AT = 'N'\n")
                .append("WHERE FEATURE_CODE IN (").append(joinQuoted(candidateCodes)).append(");");
        return builder.toString();
    }

    private List<String> splitCsv(String csv) {
        if (csv == null || csv.trim().isEmpty()) {
            return Collections.emptyList();
        }
        List<String> values = new ArrayList<>();
        for (String token : csv.split(",")) {
            String value = safeString(token);
            if (!value.isEmpty()) {
                values.add(value);
            }
        }
        return values;
    }

    private String joinQuoted(List<String> values) {
        if (values == null || values.isEmpty()) {
            return "";
        }
        return values.stream()
                .map(value -> "'" + value.replace("'", "''") + "'")
                .collect(Collectors.joining(", "));
    }

    private Map<String, Integer> toReferenceCountMap(List<FeatureReferenceCountVO> rows) {
        Map<String, Integer> result = new LinkedHashMap<>();
        if (rows == null) {
            return result;
        }
        for (FeatureReferenceCountVO row : rows) {
            if (row == null || safeString(row.getFeatureCode()).isEmpty()) {
                continue;
            }
            result.put(safeString(row.getFeatureCode()), row.getReferenceCount());
        }
        return result;
    }

    private Set<String> normalizeMenuUrlTargets(List<String> targetMenuUrls) {
        if (targetMenuUrls == null || targetMenuUrls.isEmpty()) {
            return Collections.emptySet();
        }
        Set<String> targets = new HashSet<>();
        for (String targetMenuUrl : targetMenuUrls) {
            String normalized = safeString(targetMenuUrl);
            if (!normalized.isEmpty()) {
                targets.add(normalized);
            }
        }
        return targets;
    }

    private String buildCodexCliPrompt(Map<String, String> row, List<String> impactRows) {
        String menuUrl = safeString(row.get("menuUrl"));
        String primaryMenuCode = safeString(row.get("recommendedPrimaryMenuCode"));
        String primaryFeatureCode = safeString(row.get("recommendedPrimaryFeatureCode"));
        String featureCodes = safeString(row.get("featureCodes"));
        String removeCandidates = safeString(row.get("recommendedRemoveFeatureCodes"));
        StringBuilder builder = new StringBuilder();
        builder.append("`/admin/system/security-policy` VIEW 중복 정리 요청\n");
        builder.append("- 대상 URL: ").append(menuUrl).append("\n");
        builder.append("- 대표 유지 메뉴: ").append(primaryMenuCode).append("\n");
        builder.append("- 대표 유지 VIEW 기능: ").append(primaryFeatureCode).append("\n");
        builder.append("- 전체 VIEW 기능: ").append(featureCodes).append("\n");
        builder.append("- 정리 후보 기능: ").append(removeCandidates.isEmpty() ? "-" : removeCandidates).append("\n");
        builder.append("- 권한 영향: ").append(impactRows.isEmpty() ? "-" : String.join(", ", impactRows)).append("\n");
        builder.append("- 요청: 위 중복 VIEW 기능 묶음을 검토하고, 대표 VIEW 1건만 유지하는 SQL preview와 롤백 SQL을 생성해줘. 실제 삭제 대신 USE_AT='N' 비활성화 기준으로 제안해줘.");
        return builder.toString();
    }

    private boolean isSecurityAuditTarget(RequestExecutionLogVO item) {
        if (item == null) {
            return false;
        }
        String decision = safeString(item.getCompanyScopeDecision()).toUpperCase(Locale.ROOT);
        return !decision.isEmpty()
                && ("DENY_MISSING_COMPANY_CONTEXT".equals(decision)
                || "DENY_COMPANY_MISMATCH".equals(decision)
                || "DENY_NO_ACTOR_COMPANY".equals(decision)
                || "ALLOW_GLOBAL_NO_CONTEXT".equals(decision)
                || "ALLOW_IMPLICIT_SELF".equals(decision)
                || "DENY_GLOBAL_ONLY_ROUTE".equals(decision)
                || "DENY_NO_COMPANY_SCOPE_PERMISSION".equals(decision));
    }

    private String resolveSecurityAuditActor(RequestExecutionLogVO item) {
        String actor = safeString(item.getActorUserId());
        String actorType = safeString(item.getActorType());
        String insttId = safeString(item.getActorInsttId());
        StringBuilder builder = new StringBuilder(actor.isEmpty() ? "-" : actor);
        if (!actorType.isEmpty()) {
            builder.append(" (").append(actorType).append(")");
        }
        if (!insttId.isEmpty()) {
            builder.append(" / ").append(insttId);
        }
        return builder.toString();
    }

    private String resolveSecurityAuditAction(RequestExecutionLogVO item, boolean isEn) {
        String decision = safeString(item.getCompanyScopeDecision()).toUpperCase(Locale.ROOT);
        if ("DENY_MISSING_COMPANY_CONTEXT".equals(decision)) {
            return isEn ? "Blocked missing company context" : "회사 컨텍스트 누락 차단";
        }
        if ("DENY_COMPANY_MISMATCH".equals(decision)) {
            return isEn ? "Blocked company mismatch" : "회사 불일치 차단";
        }
        if ("DENY_NO_ACTOR_COMPANY".equals(decision)) {
            return isEn ? "Blocked missing actor company" : "계정 회사 정보 누락 차단";
        }
        if ("ALLOW_GLOBAL_NO_CONTEXT".equals(decision)) {
            return isEn ? "Allowed global execution without company context" : "회사 컨텍스트 없는 전역 관리자 허용";
        }
        if ("ALLOW_IMPLICIT_SELF".equals(decision)) {
            return isEn ? "Allowed implicit self-company resolution" : "자기회사 암묵 해석 허용";
        }
        if ("DENY_GLOBAL_ONLY_ROUTE".equals(decision)) {
            return isEn ? "Blocked global-only route" : "전체 관리자 전용 경로 차단";
        }
        return decision.isEmpty() ? (isEn ? "Request audit" : "요청 감사") : decision;
    }

    private String resolveSecurityAuditDetail(RequestExecutionLogVO item, boolean isEn) {
        String actorInsttId = safeString(item.getActorInsttId());
        String targetInsttId = safeString(item.getTargetCompanyContextId());
        String explicit = item.isCompanyContextExplicit()
                ? (isEn ? "Explicit context" : "명시적 컨텍스트")
                : (isEn ? "Implicit/no parameter" : "암묵/파라미터 없음");
        String reason = safeString(item.getCompanyScopeReason());
        return (isEn ? "actor=" : "계정=") + (actorInsttId.isEmpty() ? "-" : actorInsttId)
                + ", " + (isEn ? "target=" : "대상=") + (targetInsttId.isEmpty() ? "-" : targetInsttId)
                + ", " + explicit
                + (reason.isEmpty() ? "" : ", " + reason);
    }

    private Map<String, String> normalizeBlocklistRow(Map<String, String> row, boolean isEn) {
        Map<String, String> normalized = new LinkedHashMap<>();
        normalized.putAll(row == null ? Collections.emptyMap() : row);
        normalized.put("blockId", safeString(normalized.get("blockId")));
        normalized.put("target", safeString(normalized.get("target")));
        normalized.put("blockType", firstNonBlank(safeString(normalized.get("blockType")), "IP").toUpperCase(Locale.ROOT));
        normalized.put("reason", safeString(normalized.get("reason")));
        normalized.put("status", firstNonBlank(safeString(normalized.get("status")), "REVIEW").toUpperCase(Locale.ROOT));
        normalized.put("expiresAt", safeString(normalized.get("expiresAt")));
        normalized.put("owner", firstNonBlank(
                safeString(normalized.get("owner")),
                safeString(normalized.get("reviewedBy")),
                isEn ? "Monitoring Operator" : "모니터링 운영자"));
        normalized.put("source", firstNonBlank(safeString(normalized.get("source")), "monitoring").toLowerCase(Locale.ROOT));
        normalized.put("registeredAt", firstNonBlank(
                safeString(normalized.get("registeredAt")),
                safeString(normalized.get("activatedAt")),
                safeString(normalized.get("reviewedAt"))));
        normalized.put("updatedAt", firstNonBlank(
                safeString(normalized.get("reviewedAt")),
                safeString(normalized.get("activatedAt")),
                safeString(normalized.get("registeredAt"))));
        if ("RELEASED".equalsIgnoreCase(safeString(normalized.get("status")))) {
            normalized.put("releasedAt", firstNonBlank(
                    safeString(normalized.get("reviewedAt")),
                    safeString(normalized.get("releasedAt"))));
        }
        return normalized;
    }

    private int compareBlocklistRowsNewestFirst(Map<String, String> left, Map<String, String> right) {
        long rightValue = blocklistTimestampValue(firstNonBlank(
                safeString(right.get("updatedAt")),
                safeString(right.get("registeredAt")),
                safeString(right.get("expiresAt"))));
        long leftValue = blocklistTimestampValue(firstNonBlank(
                safeString(left.get("updatedAt")),
                safeString(left.get("registeredAt")),
                safeString(left.get("expiresAt"))));
        return Long.compare(rightValue, leftValue);
    }

    private int compareBlocklistReleaseQueueRows(Map<String, String> left, Map<String, String> right) {
        return Long.compare(
                blocklistTimestampValue(left.get("releaseAt")),
                blocklistTimestampValue(right.get("releaseAt")));
    }

    private String buildBlocklistReleaseCondition(Map<String, String> row, boolean isEn) {
        String status = safeString(row.get("status")).toUpperCase(Locale.ROOT);
        String reason = safeString(row.get("reason"));
        if ("REVIEW".equals(status)) {
            return reason.isEmpty()
                    ? (isEn ? "Pending operator review before activation." : "활성화 전 운영자 검토 대기")
                    : reason;
        }
        if (!safeString(row.get("expiresAt")).isEmpty()) {
            return isEn ? "Scheduled release when expiration is reached." : "만료 시각 도달 시 해제 예정";
        }
        return reason.isEmpty()
                ? (isEn ? "Release condition not specified." : "해제 조건 미지정")
                : reason;
    }

    private long blocklistTimestampValue(String value) {
        LocalDateTime parsed = parseSnapshotTimestamp(value);
        if (parsed == null) {
            try {
                parsed = LocalDateTime.parse(safeString(value), DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"));
            } catch (Exception ignored) {
                parsed = null;
            }
        }
        if (parsed != null) {
            return parsed.atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli();
        }
        return 0L;
    }

    private List<Map<String, String>> selectPersistedBlocklistRows() {
        BlocklistPersistenceService persistenceService = blocklistPersistenceServiceProvider.getIfAvailable();
        if (persistenceService == null) {
            return Collections.emptyList();
        }
        try {
            List<Map<String, String>> rows = persistenceService.selectBlockRows();
            return rows == null ? Collections.emptyList() : rows;
        } catch (Exception ex) {
            log.warn("Failed to load persisted blocklist rows. Falling back to snapshot source.", ex);
            return Collections.emptyList();
        }
    }

    private List<Map<String, String>> selectPersistedBlocklistActionRows() {
        BlocklistPersistenceService persistenceService = blocklistPersistenceServiceProvider.getIfAvailable();
        if (persistenceService == null) {
            return Collections.emptyList();
        }
        try {
            List<Map<String, String>> rows = persistenceService.selectActionHistoryRows();
            return rows == null ? Collections.emptyList() : rows;
        } catch (Exception ex) {
            log.warn("Failed to load persisted blocklist action history. Falling back to snapshot source.", ex);
            return Collections.emptyList();
        }
    }

    private void persistBlocklistRow(Map<String, String> sourceRow, String actorUserId, boolean isEn) {
        BlocklistPersistenceService persistenceService = blocklistPersistenceServiceProvider.getIfAvailable();
        if (persistenceService == null || sourceRow == null || safeString(sourceRow.get("blockId")).isEmpty()) {
            return;
        }
        try {
            Map<String, String> normalized = normalizeBlocklistRow(sourceRow, isEn);
            Map<String, String> row = new LinkedHashMap<>();
            row.put("blockId", safeString(normalized.get("blockId")));
            row.put("target", safeString(normalized.get("target")));
            row.put("blockType", safeString(normalized.get("blockType")));
            row.put("reason", safeString(normalized.get("reason")));
            row.put("reasonEn", safeString(sourceRow.get("reasonEn")));
            row.put("status", safeString(normalized.get("status")));
            row.put("expiresAt", safeString(normalized.get("expiresAt")));
            row.put("owner", safeString(normalized.get("owner")));
            row.put("ownerEn", safeString(sourceRow.get("ownerEn")));
            row.put("source", firstNonBlank(safeString(normalized.get("source")), "monitoring"));
            row.put("sourceTitle", safeString(sourceRow.get("sourceTitle")));
            row.put("sourceFingerprint", safeString(sourceRow.get("sourceFingerprint")));
            row.put("sourceSeverity", safeString(sourceRow.get("sourceSeverity")));
            row.put("registeredAt", firstNonBlank(safeString(normalized.get("registeredAt")), formatSnapshotTimestamp(LocalDateTime.now())));
            row.put("activatedAt", safeString(sourceRow.get("activatedAt")));
            row.put("activatedBy", firstNonBlank(safeString(sourceRow.get("activatedBy")), "ACTIVE".equalsIgnoreCase(safeString(normalized.get("status"))) ? safeString(actorUserId) : ""));
            row.put("reviewedAt", safeString(sourceRow.get("reviewedAt")));
            row.put("reviewedBy", safeString(sourceRow.get("reviewedBy")));
            row.put("updatedAt", firstNonBlank(safeString(normalized.get("updatedAt")), formatSnapshotTimestamp(LocalDateTime.now())));
            row.put("updatedBy", safeString(actorUserId));
            persistenceService.saveBlockRow(row);
        } catch (Exception ex) {
            log.warn("Failed to persist blocklist row. blockId={}", safeString(sourceRow.get("blockId")), ex);
        }
    }

    private void appendBlocklistActionHistory(
            Map<String, String> sourceRow,
            String actionType,
            String status,
            String actorUserId,
            String detail,
            String actionAt,
            boolean isEn) {
        BlocklistPersistenceService persistenceService = blocklistPersistenceServiceProvider.getIfAvailable();
        if (persistenceService == null || sourceRow == null || safeString(sourceRow.get("blockId")).isEmpty()) {
            return;
        }
        try {
            Map<String, String> actionRow = new LinkedHashMap<>();
            actionRow.put("actionId", buildBlocklistActionId(sourceRow.get("blockId"), actionType, actionAt));
            actionRow.put("blockId", safeString(sourceRow.get("blockId")));
            actionRow.put("target", safeString(sourceRow.get("target")));
            actionRow.put("actionType", safeString(actionType));
            actionRow.put("status", safeString(status));
            actionRow.put("detail", safeString(detail));
            actionRow.put("detailEn", isEn ? safeString(detail) : "");
            actionRow.put("actorId", safeString(actorUserId));
            actionRow.put("actorName", firstNonBlank(safeString(sourceRow.get("reviewedBy")), safeString(sourceRow.get("owner")), safeString(actorUserId)));
            actionRow.put("source", firstNonBlank(safeString(sourceRow.get("source")), "monitoring"));
            actionRow.put("actionAt", firstNonBlank(safeString(actionAt), formatSnapshotTimestamp(LocalDateTime.now())));
            actionRow.put("expiresAt", safeString(sourceRow.get("expiresAt")));
            persistenceService.saveActionHistoryRow(actionRow);
        } catch (Exception ex) {
            log.warn("Failed to persist blocklist action history. blockId={}, actionType={}", safeString(sourceRow.get("blockId")), safeString(actionType), ex);
        }
    }

    private String buildBlocklistActionId(String blockId, String actionType, String actionAt) {
        String normalizedBlockId = safeString(blockId);
        String normalizedActionType = safeString(actionType);
        String normalizedActionAt = safeString(actionAt)
                .replace("-", "")
                .replace(":", "")
                .replace(" ", "")
                .trim();
        return normalizedBlockId + "-" + normalizedActionType + "-" + normalizedActionAt;
    }

    private List<Map<String, String>> loadCardSnapshot(String baseKey, boolean isEn, List<Map<String, String>> fallback) {
        String snapshotKey = snapshotKey(baseKey, isEn);
        List<Map<String, String>> persisted = readSnapshotCards(snapshotKey);
        if (!persisted.isEmpty()) {
            return persisted;
        }
        persistSnapshot(snapshotKey, fallback, SNAPSHOT_TYPE_CARD_LIST, null);
        return fallback;
    }

    private List<Map<String, String>> readSnapshotCards(String snapshotKey) {
        try {
            AdminSummarySnapshotVO snapshot = adminSummarySnapshotMapper.selectSnapshotByKey(snapshotKey);
            if (snapshot == null || safeString(snapshot.getSnapshotJson()).isEmpty()) {
                return Collections.emptyList();
            }
            List<Map<String, String>> rows = objectMapper.readValue(snapshot.getSnapshotJson(), CARD_LIST_TYPE);
            return rows == null ? Collections.emptyList() : rows.stream()
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.debug("Failed to read admin summary snapshot. snapshotKey={}", snapshotKey, e);
            return Collections.emptyList();
        }
    }

    private void persistSnapshot(String snapshotKey,
            List<Map<String, String>> rows,
            String snapshotType,
            String sourceUpdatedAt) {
        try {
            AdminSummarySnapshotVO snapshot = new AdminSummarySnapshotVO();
            snapshot.setSnapshotKey(snapshotKey);
            snapshot.setSnapshotJson(objectMapper.writeValueAsString(rows == null ? Collections.emptyList() : rows));
            snapshot.setSnapshotType(snapshotType);
            snapshot.setSourceUpdatedAt(safeString(sourceUpdatedAt));
            snapshot.setUseAt("Y");
            if (adminSummarySnapshotMapper.countSnapshotByKey(snapshotKey) > 0) {
                adminSummarySnapshotMapper.updateSnapshot(snapshot);
            } else {
                adminSummarySnapshotMapper.insertSnapshot(snapshot);
            }
        } catch (Exception e) {
            log.debug("Failed to persist admin summary snapshot. snapshotKey={}", snapshotKey, e);
        }
    }

    private void persistNotificationDeliveryHistory(Map<String, String> row) {
        try {
            Map<String, Object> params = new LinkedHashMap<>();
            params.put("deliveryId", "NDH-" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS")));
            params.put("actorUserId", safeString(row.get("actorUserId")));
            params.put("deliveryMode", safeString(row.get("mode")));
            params.put("findingCount", parseIntegerObject(row.get("findingCount")));
            params.put("slackEnabled", safeString(row.get("slackEnabled")));
            params.put("mailEnabled", safeString(row.get("mailEnabled")));
            params.put("webhookEnabled", safeString(row.get("webhookEnabled")));
            params.put("slackChannel", safeString(row.get("slackChannel")));
            params.put("mailRecipients", safeString(row.get("mailRecipients")));
            params.put("webhookUrl", safeString(row.get("webhookUrl")));
            params.put("deliveryStatus", safeString(row.get("status")));
            params.put("topFinding", safeString(row.get("topFinding")));
            params.put("deliveryDetail", safeString(row.get("deliveryDetail")));
            params.put("slackStatus", safeString(row.get("slackStatus")));
            params.put("mailStatus", safeString(row.get("mailStatus")));
            params.put("webhookStatus", safeString(row.get("webhookStatus")));
            adminNotificationHistoryMapper.insertDeliveryHistory(params);
        } catch (Exception e) {
            log.debug("Failed to persist notification delivery history row. Falling back to snapshot only.", e);
        }
    }

    private void persistNotificationActivityHistory(String action, String actorUserId, String target, String detail) {
        try {
            Map<String, Object> params = new LinkedHashMap<>();
            params.put("activityId", "NAH-" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS")));
            params.put("actionCode", safeString(action));
            params.put("actorUserId", safeString(actorUserId));
            params.put("targetText", safeString(target));
            params.put("detailText", safeString(detail));
            params.put("sourceType", "server");
            adminNotificationHistoryMapper.insertActivityHistory(params);
        } catch (Exception e) {
            log.debug("Failed to persist notification activity history row. Falling back to snapshot only.", e);
        }
    }

    private List<Map<String, String>> trimSnapshotRows(List<Map<String, String>> rows, int limit) {
        if (rows == null || rows.isEmpty() || limit <= 0) {
            return Collections.emptyList();
        }
        if (rows.size() <= limit) {
            return rows;
        }
        return new ArrayList<>(rows.subList(0, limit));
    }

    private Integer parseIntegerObject(String value) {
        try {
            return Integer.valueOf(safeString(value));
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private String resolveLatestAuditTimestamp(SecurityAuditSnapshot auditSnapshot) {
        if (auditSnapshot == null || auditSnapshot.getAuditLogs() == null || auditSnapshot.getAuditLogs().isEmpty()) {
            return "";
        }
        return safeString(auditSnapshot.getAuditLogs().get(0).getExecutedAt());
    }

    private String snapshotKey(String baseKey, boolean isEn) {
        return baseKey + "_" + (isEn ? "EN" : "KO");
    }

    private List<Map<String, String>> defaultIpWhitelistSummary(boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(summaryCard(isEn ? "Active Rules" : "활성 규칙", "12",
                isEn ? "CIDR and single-IP policies currently applied." : "현재 게이트웨이에 반영 중인 CIDR/단일 IP 정책"));
        rows.add(summaryCard(isEn ? "Pending Requests" : "승인 대기", "3",
                isEn ? "Approval requests waiting for security review." : "보안담당 승인 대기 중인 예외 허용 요청"));
        rows.add(summaryCard(isEn ? "Expiring Today" : "오늘 만료", "2",
                isEn ? "Temporary exceptions scheduled to expire today." : "오늘 자동 회수 예정인 임시 허용"));
        rows.add(summaryCard(isEn ? "Protected Scopes" : "보호 범위", "4",
                isEn ? "Admin, API, Batch, and Internal access scopes." : "관리자, API, Batch, 내부망 범위 운영"));
        return rows;
    }

    private List<Map<String, String>> defaultSecurityPolicySummary(boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(summaryCard(isEn ? "Applied Policies" : "적용 정책", "7",
                isEn ? "Rate-limit and automated response rules currently enabled." : "현재 적용 중인 rate-limit 및 자동대응 룰"));
        rows.add(summaryCard(isEn ? "Protected Endpoints" : "보호 URL", "19",
                isEn ? "Endpoints protected by dedicated thresholds." : "개별 임계치가 설정된 엔드포인트 수"));
        rows.add(summaryCard(isEn ? "Captcha Triggers" : "CAPTCHA 발동", "3",
                isEn ? "Flows with bot challenge fallback enabled." : "봇 검증이 연결된 사용자 흐름"));
        rows.add(summaryCard(isEn ? "Escalation Paths" : "자동 조치", "4",
                isEn ? "Routes with temporary block escalation." : "임시 차단까지 자동 승격되는 정책"));
        return rows;
    }

    private List<Map<String, String>> defaultSecurityMonitoringSummary(boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(summaryCard(isEn ? "Current RPS" : "현재 RPS", "1,284",
                isEn ? "Combined HTTP requests per second across external ingress." : "외부 인입 전체 기준 초당 요청 수"));
        rows.add(summaryCard(isEn ? "Blocked Requests" : "차단 요청", "438",
                isEn ? "Requests blocked in the last 5 minutes." : "최근 5분간 차단된 요청 수"));
        rows.add(summaryCard(isEn ? "429 Responses" : "429 응답", "126",
                isEn ? "Rate-limit responses in the last 5 minutes." : "최근 5분간 rate-limit 응답 수"));
        rows.add(summaryCard(isEn ? "Active Incidents" : "활성 인시던트", "2",
                isEn ? "Incidents requiring operator review." : "운영자 확인이 필요한 현재 공격 이벤트"));
        return rows;
    }

    private List<Map<String, String>> defaultBlocklistSummary(boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(summaryCard(isEn ? "Active Blocks" : "활성 차단", "27",
                isEn ? "Currently enforced IP, CIDR, account, and UA blocks." : "현재 적용 중인 IP/CIDR/계정/UA 차단"));
        rows.add(summaryCard(isEn ? "Auto Blocks" : "자동 차단", "21",
                isEn ? "Entries generated by security rules." : "보안 룰로 자동 생성된 차단"));
        rows.add(summaryCard(isEn ? "Manual Blocks" : "수동 차단", "6",
                isEn ? "Operator-issued blocks requiring audit review." : "운영자가 등록한 수동 차단"));
        rows.add(summaryCard(isEn ? "Releases Today" : "오늘 해제", "4",
                isEn ? "Scheduled or approved releases for today." : "오늘 예정된 차단 해제 건수"));
        return rows;
    }

    private List<Map<String, String>> defaultSchedulerSummary(boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(summaryCard(isEn ? "Registered Jobs" : "등록 잡", "14",
                isEn ? "Cron-based and on-demand jobs managed from the system menu." : "시스템 메뉴에서 관리 중인 cron 및 수동 실행 잡 수"));
        rows.add(summaryCard(isEn ? "Active Jobs" : "활성 잡", "11",
                isEn ? "Jobs enabled for production execution." : "운영 실행이 활성화된 스케줄러 잡 수"));
        rows.add(summaryCard(isEn ? "Failed Today" : "오늘 실패", "2",
                isEn ? "Jobs that require operator review today." : "오늘 운영 확인이 필요한 실패 잡 수"));
        rows.add(summaryCard(isEn ? "Next 1 Hour" : "1시간 내 예정", "6",
                isEn ? "Executions expected within the next hour." : "다음 1시간 이내 실행 예정 건수"));
        return rows;
    }

    private Map<String, String> summaryCard(String title, String value, String description) {
        Map<String, String> card = new LinkedHashMap<>();
        card.put("title", title);
        card.put("value", value);
        card.put("description", description);
        return card;
    }

    private Map<String, String> mapOf(String... values) {
        Map<String, String> result = new LinkedHashMap<>();
        if (values == null) {
            return result;
        }
        for (int i = 0; i + 1 < values.length; i += 2) {
            result.put(values[i], values[i + 1]);
        }
        return result;
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }
}
