package egovframework.com.platform.governance.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/internal/screen-space")
public class ScreenSpaceBridgeController {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final String bridgeToken;

    public ScreenSpaceBridgeController(
            JdbcTemplate jdbc,
            ObjectMapper mapper,
            @Value("${resonance.ops.token:}") String bridgeToken) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.bridgeToken = bridgeToken;
    }

    @PostMapping("/specs")
    @Transactional
    public ResponseEntity<?> publish(
            @RequestHeader(value = "X-Resonance-Token", defaultValue = "") String suppliedToken,
            @RequestBody Map<String, Object> body) {
        if (!authorized(suppliedToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("success", false, "message", "Invalid control-plane bridge token."));
        }
        String coordinate = required(body, "coordinate");
        String projectId = required(body, "projectId");
        String routePath = required(body, "routePath");
        String processCode = required(body, "process");
        String stepCode = required(body, "step");
        String actorCode = required(body, "actor");
        String stateCode = required(body, "state");
        String archetypeCode = required(body, "archetype");
        String specificationHash = required(body, "specSha256");
        String validationStatus = required(body, "status");
        String sourceActor = required(body, "sourceActor");
        if (!"VERIFIED".equals(validationStatus) || specificationHash.length() != 64) {
            return ResponseEntity.unprocessableEntity()
                    .body(Map.of("success", false, "message", "Only hashed VERIFIED specifications may be published."));
        }
        try {
            String screenSpec = mapper.writeValueAsString(body.get("screenSpec"));
            jdbc.update("""
                    insert into framework_screen_space_spec(
                      coordinate_key,project_id,route_path,process_code,step_code,actor_code,state_code,
                      archetype_code,screen_spec,specification_hash,validation_status,source_actor
                    ) values(?,?,?,?,?,?,?,?,cast(? as jsonb),?,?,?)
                    on conflict(coordinate_key) do update set
                      route_path=excluded.route_path,process_code=excluded.process_code,step_code=excluded.step_code,
                      actor_code=excluded.actor_code,state_code=excluded.state_code,archetype_code=excluded.archetype_code,
                      screen_spec=excluded.screen_spec,specification_hash=excluded.specification_hash,
                      validation_status=excluded.validation_status,source_actor=excluded.source_actor,
                      published_at=current_timestamp,updated_at=current_timestamp
                    """, coordinate, projectId, routePath, processCode, stepCode, actorCode, stateCode,
                    archetypeCode, screenSpec, specificationHash, validationStatus, sourceActor);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "coordinate", coordinate,
                    "status", "PUBLISHED",
                    "runtimeCacheKey", normalizedRoute(routePath) + ":" + specificationHash.substring(0, 16)));
        } catch (Exception exception) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", "Screen specification publication failed."));
        }
    }

    @GetMapping("/specs")
    public ResponseEntity<?> find(
            @RequestHeader(value = "X-Resonance-Token", defaultValue = "") String suppliedToken,
            @RequestParam String routePath) {
        if (!authorized(suppliedToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("success", false, "message", "Invalid control-plane bridge token."));
        }
        List<Map<String, Object>> rows = jdbc.queryForList("""
                select coordinate_key as "coordinate",project_id as "projectId",route_path as "routePath",
                       process_code as "process",step_code as "step",actor_code as "actor",
                       state_code as "state",archetype_code as "archetype",screen_spec as "screenSpec",
                       specification_hash as "specSha256",validation_status as "status",
                       source_actor as "sourceActor",published_at as "publishedAt"
                  from framework_screen_space_spec
                 where lower(split_part(route_path,'?',1))=lower(?)
                 order by updated_at desc limit 1
                """, normalizedRoute(routePath));
        if (rows.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("success", false, "routePath", normalizedRoute(routePath)));
        }
        Map<String, Object> result = new LinkedHashMap<>(rows.get(0));
        result.put("success", true);
        return ResponseEntity.ok(result);
    }

    private boolean authorized(String suppliedToken) {
        if (bridgeToken == null || bridgeToken.isBlank() || suppliedToken == null || suppliedToken.isBlank()) return false;
        return MessageDigest.isEqual(
                bridgeToken.getBytes(StandardCharsets.UTF_8),
                suppliedToken.getBytes(StandardCharsets.UTF_8));
    }

    private static String required(Map<String, Object> body, String key) {
        String value = body.get(key) == null ? "" : String.valueOf(body.get(key)).trim();
        if (value.isEmpty()) throw new IllegalArgumentException(key + " is required");
        return value;
    }

    private static String normalizedRoute(String routePath) {
        String value = routePath == null ? "" : routePath.trim();
        int query = value.indexOf('?');
        return query < 0 ? value : value.substring(0, query);
    }
}
