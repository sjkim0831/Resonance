package egovframework.com.web;

import egovframework.com.platform.governance.service.ActorProcessGovernanceService;
import egovframework.com.platform.governance.service.CompositeDesignOperationalWorker;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
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
    private final ActorProcessGovernanceService governance;
    private final CompositeDesignOperationalWorker operationalWorker;
    public IntegratedDesignDocumentController(
            JdbcTemplate jdbc,ActorProcessGovernanceService governance,
            CompositeDesignOperationalWorker operationalWorker) {
        this.jdbc = jdbc;
        this.governance = governance;
        this.operationalWorker=operationalWorker;
    }

    @GetMapping
    public Map<String,Object> list(
            @RequestParam String processCode,
            @RequestParam(defaultValue = "") String stepCode,
            @RequestParam(defaultValue = "") String routePath,
            @RequestParam(defaultValue = "") String audience) {
        String canonicalAudience=audience.trim().toUpperCase();
        if(canonicalAudience.isBlank()){
            List<String> matches=jdbc.queryForList("""
              SELECT DISTINCT upper(audience) FROM framework_professional_screen_contract
               WHERE process_code=? AND step_code=?
                 AND lower(split_part(route_path,'?',1))=lower(?)
              """,String.class,processCode,stepCode,routePath);
            if(matches.size()!=1)throw new IllegalArgumentException(
                    "A single USER or ADMIN audience is required.");
            canonicalAudience=matches.get(0);
        }
        final String resolvedAudience=canonicalAudience;
        List<Map<String,Object>> saved = jdbc.queryForList("""
          SELECT document_id AS "documentId", document_type AS "documentType",
                 title,content,status,revision,updated_by AS "updatedBy",updated_at AS "updatedAt"
            FROM integrated_design_document
           WHERE process_code=? AND step_code=? AND route_path=? AND audience=? AND active_yn='Y'
          """, processCode, stepCode, routePath,resolvedAudience);
        Map<String,Map<String,Object>> byType = new LinkedHashMap<>();
        saved.forEach(row -> byType.put(String.valueOf(row.get("documentType")), row));
        List<Map<String,Object>> authorityHeads=jdbc.queryForList("""
          SELECT authority_revision AS "authorityRevision",authority_hash AS "authorityHash",
                 document_set_hash AS "documentSetHash",package_binding_hash AS "packageBindingHash",
                 selected_blueprint_id AS "selectedBlueprintId",ownership_strategy AS "ownershipStrategy"
            FROM integrated_design_authority
           WHERE process_code=? AND step_code=? AND route_path=? AND audience=?
          """,processCode,stepCode,routePath,resolvedAudience);
        if(authorityHeads.size()>1)throw new IllegalStateException(
                "COMPOSITE_DESIGN_AUTHORITY_HEAD_NOT_EXACT");
        Map<String,Object> authority=authorityHeads.isEmpty()?Map.of(
                "authorityRevision",0,"authorityHash",""):
                new LinkedHashMap<>(authorityHeads.get(0));
        List<Map<String,Object>> documents = TYPES.entrySet().stream().map(entry -> {
            Map<String,Object> row = new LinkedHashMap<>();
            row.put("documentType", entry.getKey());
            row.put("title", entry.getValue());
            row.put("content", "");
            row.put("status", "DRAFT");
            row.put("revision", 0);
            row.putAll(byType.getOrDefault(entry.getKey(), Map.of()));
            row.put("authorityRevision",authority.get("authorityRevision"));
            row.put("baseAuthorityHash",authority.get("authorityHash"));
            row.put("audience",resolvedAudience);
            return row;
        }).toList();
        long ready = documents.stream().filter(row -> Set.of("READY","APPROVED","VERIFIED").contains(row.get("status"))).count();
        return Map.of("processCode", processCode, "stepCode", stepCode, "routePath", routePath,
                "audience",resolvedAudience,
                "documents", documents, "total", TYPES.size(), "ready", ready,
                "authority",authority);
    }

    @PostMapping
    public ResponseEntity<?> save(
            @RequestBody Map<String,Object> body, Principal principal) {
        String actor=principal==null?"":String.valueOf(principal.getName());
        if(actor.isBlank())return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("success",false,"message","Authentication is required."));
        if(!actor.equals(actor.trim())||actor.length()>100)
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "success",false,"message","Authenticated actor identity is invalid."));
        if(!governance.isControlPlaneAdministrator(actor))
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "success",false,
                    "message","System administrator authority is required."));
        try{
        if("AUTO_COMPLETE_ELIGIBLE".equals(text(body,"action"))){
            if(Boolean.TRUE.equals(body.get("dryRun")))return ResponseEntity.ok(
                operationalWorker.inspect());
            Object raw=body.getOrDefault("limit",4);int limit;
            try{limit=Integer.parseInt(String.valueOf(raw));}
            catch(NumberFormatException error){throw new IllegalArgumentException(
                "limit must be an integer",error);}
            if(limit<1||limit>25)throw new IllegalArgumentException(
                "limit must be between 1 and 25");
            return ResponseEntity.accepted().body(operationalWorker.dispatchApproved(limit));
        }
        if("GENERATE_AXIS_TEMPLATES".equals(text(body,"action"))){
            String processCode=required(body,"processCode").trim().toUpperCase();
            if(!processCode.matches("^[A-Z][A-Z0-9_:-]{1,79}$"))
                return ResponseEntity.unprocessableEntity().body(Map.of(
                    "success",false,"message","Invalid processCode."));
            Map<String,Object> request=new LinkedHashMap<>(body);request.put("previewOnly",true);
            return ResponseEntity.ok(governance.compileIntegratedDesignProcess(request,actor));
        }
        if(Set.of("GENERATE_VALIDATE_COMPILE","PROCESS_GENERATE_VALIDATE_COMPILE")
                .contains(text(body,"action"))){
            Map<String,Object> request=new LinkedHashMap<>(body);request.put("previewOnly",false);
            return ResponseEntity.ok(governance.compileIntegratedDesignProcess(request,actor));
        }
        String documentType=required(body,"documentType").toUpperCase();
        if(!TYPES.containsKey(documentType))return ResponseEntity.unprocessableEntity()
                .body(Map.of("success",false,"message","Unsupported design document type."));
        Map<String,Object> canonicalBody=new LinkedHashMap<>(body);
        canonicalBody.put("documentType",documentType);
        if(text(canonicalBody,"title").isBlank())
            canonicalBody.put("title",TYPES.get(documentType));
        return ResponseEntity.ok(governance.saveIntegratedDesignDocument(canonicalBody,actor));}
        catch(SecurityException exception){
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "success",false,"sourceCommitted",false,"jobCount",0,
                    "message",exception.getMessage()));
        }
        catch(IllegalArgumentException exception){
            return ResponseEntity.unprocessableEntity().body(Map.of(
                    "success",false,"sourceCommitted",false,"jobCount",0,
                    "message",exception.getMessage()));
        }catch(IllegalStateException exception){
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                    "success",false,"sourceCommitted",false,"jobCount",0,
                    "message",exception.getMessage()));
        }
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
