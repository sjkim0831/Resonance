package egovframework.com.web;

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
import java.util.List;
import java.util.Map;

/** Session-bound read model consumed by the notification center. */
@RestController
@RequestMapping({"/api/my/integrated-design-notifications",
    "/en/api/my/integrated-design-notifications"})
public class IntegratedDesignNotificationController {
    private final JdbcTemplate jdbc;
    public IntegratedDesignNotificationController(JdbcTemplate jdbc){this.jdbc=jdbc;}

    @GetMapping
    public ResponseEntity<?> list(Principal principal,
            @RequestParam(defaultValue="") String tenantId,
            @RequestParam(defaultValue="") String projectId,
            @RequestParam(defaultValue="50") int limit){
        String account=account(principal);if(account==null)return unauthorized();
        if(limit<1||limit>100)return ResponseEntity.unprocessableEntity().body(Map.of(
            "success",false,"message","limit must be between 1 and 100"));
        List<Map<String,Object>> rows=jdbc.queryForList("""
            select inbox_id as "inboxId",tenant_id as "tenantId",project_id as "projectId",
                   actor_code as "actorCode",title,message_text as "message",
                   target_url as "targetUrl",payload_hash as "payloadHash",
                   read_at as "readAt",created_at as "createdAt"
              from integrated_design_notification_inbox
             where lower(account_id)=lower(?) and (?='' or tenant_id=?)
               and (?='' or project_id=?)
             order by created_at desc,inbox_id desc limit ?
            """,account,tenantId,tenantId,projectId,projectId,limit);
        Map<String,Object> totals=jdbc.queryForMap("""
            select count(*)::integer as "totalCount",
                   count(*) filter(where read_at is null)::integer as "unreadCount"
              from integrated_design_notification_inbox
             where lower(account_id)=lower(?) and (?='' or tenant_id=?)
               and (?='' or project_id=?)
            """,account,tenantId,tenantId,projectId,projectId);
        return ResponseEntity.ok(Map.of("success",true,"notifications",rows,
            "returnedCount",rows.size(),"totalCount",totals.get("totalCount"),
            "unreadCount",totals.get("unreadCount")));
    }

    @PostMapping("/read")
    public ResponseEntity<?> markRead(Principal principal,@RequestBody Map<String,Object> body){
        String account=account(principal);if(account==null)return unauthorized();
        long inboxId;
        try{inboxId=Long.parseLong(String.valueOf(body.get("inboxId")));}
        catch(Exception error){return ResponseEntity.unprocessableEntity().body(Map.of(
            "success",false,"message","inboxId must be a positive integer"));}
        if(inboxId<1)return ResponseEntity.unprocessableEntity().body(Map.of(
            "success",false,"message","inboxId must be a positive integer"));
        int updated=jdbc.update("""
            update integrated_design_notification_inbox set read_at=current_timestamp
             where inbox_id=? and lower(account_id)=lower(?) and read_at is null
            """,inboxId,account);
        int owned=jdbc.queryForObject("""
            select count(*) from integrated_design_notification_inbox
             where inbox_id=? and lower(account_id)=lower(?)
            """,Integer.class,inboxId,account);
        if(owned!=1)return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
            "success",false,"message","Notification not found"));
        return ResponseEntity.ok(Map.of("success",true,"changed",updated==1));
    }

    private static String account(Principal principal){
        if(principal==null||principal.getName()==null)return null;
        String value=principal.getName();return value.isBlank()||!value.equals(value.trim())
            ||value.length()>100?null:value;
    }
    private static ResponseEntity<Map<String,Object>> unauthorized(){
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
            "success",false,"message","Authentication is required"));
    }
}
