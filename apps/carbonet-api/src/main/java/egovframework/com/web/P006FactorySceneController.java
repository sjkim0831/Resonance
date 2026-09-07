package egovframework.com.web;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

@RestController
@RequestMapping("/actuator/p006/factory-scenes")
public class P006FactorySceneController {
    private static final UUID DEFAULT_SCENE_ID = UUID.fromString("00000000-0000-0000-0000-000000000006");
    private static final Set<String> ASSETS = Set.of("pump", "conveyor", "robot", "inspection", "tank", "compressor", "dryer", "filter", "cooler", "panel", "pipe", "valve", "sensor", "casting_machine", "holding_furnace", "turntable_furnace", "trimming_machine", "cooling_unit", "robot_panel", "spray_ladler", "release_agent", "main_panel", "vacuum_unit", "casting_filter", "melting_furnace", "takeout_robot", "punching_press", "ladler", "mold_cooling");

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public P006FactorySceneController(JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    @GetMapping("/default")
    @Transactional
    public Map<String, Object> load(HttpServletRequest request) {
        requireProjectSession(request);
        ensureScene();
        List<Map<String, Object>> objects = jdbc.query("""
                select object_id::text, asset_code, transform_json::text, behavior_json::text, created_at
                  from dt_scene_object where scene_id = ? order by created_at, object_id
                """, (rs, row) -> {
            Map<String, Object> value = new LinkedHashMap<>();
            value.put("objectId", rs.getString(1));
            value.put("assetCode", rs.getString(2));
            value.put("transform", readJson(rs.getString(3)));
            value.put("behavior", readJson(rs.getString(4)));
            value.put("createdAt", rs.getTimestamp(5).toInstant().toString());
            return value;
        }, DEFAULT_SCENE_ID);
        return Map.of("sceneId", DEFAULT_SCENE_ID.toString(), "sceneName", "P006 기본 조립 장면", "objects", objects, "objectCount", objects.size());
    }

    @PostMapping("/default/objects")
    @Transactional
    public ResponseEntity<?> save(HttpServletRequest request, @RequestBody ObjectCommand command) throws JsonProcessingException {
        requireProjectSession(request);
        String asset = command.assetCode() == null ? "" : command.assetCode().trim().toLowerCase();
        if ((!ASSETS.contains(asset) && !asset.matches("catalog_a\\d{4}")) || command.x() < 0 || command.x() > 100 || command.y() < 0 || command.y() > 100) {
            return ResponseEntity.badRequest().body(Map.of("status", "INVALID", "message", "assetCode와 x/y(0~100)를 확인하세요."));
        }
        ensureScene();
        UUID objectId = command.objectId() == null || command.objectId().isBlank() ? UUID.randomUUID() : UUID.fromString(command.objectId());
        Map<String, Object> transform = Map.of("x", command.x(), "y", command.y(), "z", 0, "rotationY", command.rotationY());
        int changed = jdbc.update("""
                insert into dt_scene_object(object_id, scene_id, asset_code, prim_path, transform_json, behavior_json)
                values (?, ?, ?, ?, ?::jsonb, '{}'::jsonb)
                on conflict (object_id) do update set asset_code=excluded.asset_code, transform_json=excluded.transform_json
                """, objectId, DEFAULT_SCENE_ID, asset, "/P006/Factory/" + objectId, objectMapper.writeValueAsString(transform));
        jdbc.update("insert into dt_audit_log(actor_id,action_code,target_type,target_id,result_code,detail_json) values ('P006_WEB','SCENE_OBJECT_SAVE','SCENE_OBJECT',?,'SUCCESS',?::jsonb)", objectId.toString(), objectMapper.writeValueAsString(transform));
        return ResponseEntity.ok(Map.of("status", "SAVED", "objectId", objectId.toString(), "changed", changed, "transform", transform));
    }

    @DeleteMapping("/default/objects/{objectId}")
    @Transactional
    public ResponseEntity<?> delete(HttpServletRequest request, @PathVariable("objectId") UUID objectId) {
        requireProjectSession(request);
        int deleted = jdbc.update("delete from dt_scene_object where scene_id=? and object_id=?", DEFAULT_SCENE_ID, objectId);
        if (deleted == 0) return ResponseEntity.notFound().build();
        jdbc.update("insert into dt_audit_log(actor_id,action_code,target_type,target_id,result_code) values ('P006_WEB','SCENE_OBJECT_DELETE','SCENE_OBJECT',?,'SUCCESS')", objectId.toString());
        return ResponseEntity.ok(Map.of("status", "DELETED", "objectId", objectId.toString()));
    }

    private void ensureScene() {
        jdbc.update("""
                insert into dt_scene(scene_id,scene_name,usd_path,status,created_by)
                values (?, 'P006 기본 조립 장면', '/home/sjkim/OmniverserProjects/woosu_layout.usd', 'DRAFT', 'P006_WEB')
                on conflict (scene_id) do nothing
                """, DEFAULT_SCENE_ID);
    }

    private void requireProjectSession(HttpServletRequest request) {
        String token = cookie(request, "P006_SESSION");
        if (token.isBlank()) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "P006 로그인이 필요합니다.");
        Integer count = jdbc.queryForObject("select count(*) from dt_project_session s join dt_project_account a on a.account_id=s.account_id where s.session_hash=? and s.expires_at>current_timestamp and a.status='ACTIVE'", Integer.class, sha256(token));
        if (count == null || count == 0) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "P006 세션이 만료되었습니다.");
    }

    private String cookie(HttpServletRequest request, String name) {
        if (request.getCookies() == null) return "";
        for (var value : request.getCookies()) if (name.equals(value.getName())) return value.getValue();
        return "";
    }

    private String sha256(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (Exception exception) { throw new IllegalStateException(exception); }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> readJson(String json) {
        try { return objectMapper.readValue(json, Map.class); }
        catch (Exception ignored) { return Map.of(); }
    }

    public record ObjectCommand(String objectId, String assetCode, double x, double y, double rotationY) {}

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<?> accessError(ResponseStatusException exception) {
        return ResponseEntity.status(exception.getStatusCode()).body(Map.of("status", "DENIED", "message", exception.getReason() == null ? "접근이 거부되었습니다." : exception.getReason()));
    }
}
