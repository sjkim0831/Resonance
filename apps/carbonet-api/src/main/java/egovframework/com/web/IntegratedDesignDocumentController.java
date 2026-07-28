package egovframework.com.web;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping({"/admin/api/system/integrated-design-documents", "/en/admin/api/system/integrated-design-documents"})
public class IntegratedDesignDocumentController {
    private static final Map<String,String> TYPES = new LinkedHashMap<>();
    private static final Set<String> STATUSES = Set.of("DRAFT","READY","IN_REVIEW","APPROVED","VERIFIED");
    static {
        TYPES.put("REQUIREMENT", "업무·요구사항");
        TYPES.put("ACTOR_RACI", "액터·RACI");
        TYPES.put("AUTHORITY", "권한·데이터 범위");
        TYPES.put("PROCESS", "프로세스·분기");
        TYPES.put("STATE", "상태 전이");
        TYPES.put("NAVIGATION", "화면 흐름·라우트");
        TYPES.put("ACTIVE_UI", "액티브 UI·레이아웃");
        TYPES.put("DESIGN_ASSET", "테마·섹션·컴포넌트");
        TYPES.put("FIELD_DICTIONARY", "필드·데이터 사전");
        TYPES.put("DATA_HANDOFF", "입출력·데이터 인계");
        TYPES.put("DATABASE", "DB·스키마");
        TYPES.put("API", "API·이벤트");
        TYPES.put("BUSINESS_RULE", "업무 규칙·계산식");
        TYPES.put("VALIDATION", "검증·오류·예외");
        TYPES.put("NOTIFICATION", "알림·기한·에스컬레이션");
        TYPES.put("TEST", "테스트 시나리오·기대값");
        TYPES.put("TASK_EVIDENCE", "개발 태스크·산출물·증적");
        TYPES.put("RELEASE_AUDIT", "배포·감사·복구");
    }

    private final JdbcTemplate jdbc;
    public IntegratedDesignDocumentController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @GetMapping
    public Map<String,Object> list(
            @RequestParam String processCode,
            @RequestParam(defaultValue = "") String stepCode,
            @RequestParam(defaultValue = "") String routePath) {
        List<Map<String,Object>> saved = jdbc.queryForList("""
          SELECT document_id AS "documentId", document_type AS "documentType",
                 title,content,status,revision,updated_by AS "updatedBy",updated_at AS "updatedAt"
            FROM integrated_design_document
           WHERE process_code=? AND step_code=? AND route_path=? AND active_yn='Y'
          """, processCode, stepCode, routePath);
        Map<String,Map<String,Object>> byType = new LinkedHashMap<>();
        saved.forEach(row -> byType.put(String.valueOf(row.get("documentType")), row));
        List<Map<String,Object>> documents = TYPES.entrySet().stream().map(entry -> {
            Map<String,Object> row = new LinkedHashMap<>();
            row.put("documentType", entry.getKey());
            row.put("title", entry.getValue());
            row.put("content", "");
            row.put("status", "DRAFT");
            row.put("revision", 0);
            row.putAll(byType.getOrDefault(entry.getKey(), Map.of()));
            return row;
        }).toList();
        long ready = documents.stream().filter(row -> Set.of("READY","APPROVED","VERIFIED").contains(row.get("status"))).count();
        return Map.of("processCode", processCode, "stepCode", stepCode, "routePath", routePath,
                "documents", documents, "total", TYPES.size(), "ready", ready);
    }

    @PostMapping
    @Transactional
    public Map<String,Object> save(@RequestBody Map<String,Object> body, Principal principal) {
        String processCode = required(body, "processCode");
        String stepCode = text(body, "stepCode");
        String routePath = text(body, "routePath");
        String documentType = required(body, "documentType").toUpperCase();
        if (!TYPES.containsKey(documentType)) throw new IllegalArgumentException("지원하지 않는 설계 문서 유형입니다.");
        String title = text(body, "title");
        if (title.isBlank()) title = TYPES.get(documentType);
        String status = text(body, "status").toUpperCase();
        if (!STATUSES.contains(status)) status = "DRAFT";
        String actor = principal == null ? "SYSTEM" : principal.getName();
        jdbc.update("""
          INSERT INTO integrated_design_document(
            process_code,step_code,route_path,document_type,title,content,status,updated_by)
          VALUES(?,?,?,?,?,?,?,?)
          ON CONFLICT(process_code,step_code,route_path,document_type) DO UPDATE SET
            title=excluded.title,content=excluded.content,status=excluded.status,
            active_yn='Y',updated_by=excluded.updated_by
          """, processCode,stepCode,routePath,documentType,title,text(body,"content"),status,actor);
        return Map.of("success", true, "documentType", documentType,
                "revision", jdbc.queryForObject("""
                  SELECT revision FROM integrated_design_document
                   WHERE process_code=? AND step_code=? AND route_path=? AND document_type=?
                  """, Long.class, processCode,stepCode,routePath,documentType));
    }

    private static String text(Map<String,Object> body, String key) {
        return String.valueOf(body.getOrDefault(key, "")).trim();
    }
    private static String required(Map<String,Object> body, String key) {
        String value = text(body,key);
        if (value.isBlank()) throw new IllegalArgumentException(key + " 값이 필요합니다.");
        return value;
    }
}
