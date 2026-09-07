package egovframework.com.feature.home.web;

import egovframework.com.feature.auth.service.CurrentUserContextService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequiredArgsConstructor
public class MemberWithdrawalController {
  private final JdbcTemplate jdbc;
  private final CurrentUserContextService users;

  @GetMapping("/home/api/member-withdrawals/preflight")
  public ResponseEntity<?> preflight(HttpServletRequest req){
    var c=users.resolve(req); if(!c.isAuthenticated()) return denied(401,"AUTHENTICATION_REQUIRED");
    String t=tenant(c); boolean manager=actor(c.getUserId(),t,"COMPANY_MASTER")||actor(c.getUserId(),t,"MEMBER_ADMIN");
    Integer open=jdbc.queryForObject("select count(*) from member_withdrawal_request where lower(member_id)=lower(?) and status in ('REQUESTED','REVIEWED','APPROVED')",Integer.class,c.getUserId());
    return ResponseEntity.ok(Map.of("memberId",c.getUserId(),"tenantId",t,"openRequestCount",open==null?0:open,
      "handoverRequired",manager,"eligible",open==null||open==0,
      "retentionPolicy",List.of(Map.of("category","감사·승인 기록","period","법정·내부 정책 기간"),Map.of("category","인증·발급 원장","period","무결성 검증 기간"))));
  }

  @GetMapping("/home/api/member-withdrawals/mine")
  public ResponseEntity<?> mine(HttpServletRequest req){
    var c=users.resolve(req); if(!c.isAuthenticated()) return denied(401,"AUTHENTICATION_REQUIRED");
    return ResponseEntity.ok(jdbc.queryForList("select request_id,status,reason_text,handover_to,review_note,decision_note,retention_until,destruction_due_at,requested_at,reviewed_at,decided_at,completed_at from member_withdrawal_request where lower(member_id)=lower(?) order by requested_at desc limit 10",c.getUserId()));
  }

  @GetMapping("/home/api/member-withdrawals")
  public ResponseEntity<?> list(HttpServletRequest req){
    var c=users.resolve(req); if(!c.isAuthenticated()) return denied(401,"AUTHENTICATION_REQUIRED");
    String t=tenant(c);
    boolean allowed=c.isWebmaster()||actor(c.getUserId(),t,"PRIVACY_OFFICER")||actor(c.getUserId(),t,"APPROVER")||actor(c.getUserId(),t,"MEMBER_ADMIN");
    if(!allowed)return denied(403,"ACTOR_REQUIRED");
    return ResponseEntity.ok(jdbc.queryForList("select request_id,tenant_id,member_id,status,reason_text,handover_to,retention_until,destruction_due_at,requested_at,reviewed_at,decided_at,completed_at from member_withdrawal_request where tenant_id=? order by requested_at desc limit 100",t));
  }

  @PostMapping("/home/api/member-withdrawals") @Transactional
  public ResponseEntity<?> request(@RequestBody Map<String,Object> body,HttpServletRequest req){
    var c=users.resolve(req); if(!c.isAuthenticated()) return denied(401,"AUTHENTICATION_REQUIRED");
    String reason=text(body.get("reason")); if(reason.length()<5)return denied(400,"WITHDRAWAL_REASON_REQUIRED");
    if(!Boolean.TRUE.equals(body.get("confirmed")))return denied(400,"WITHDRAWAL_CONFIRMATION_REQUIRED");
    String t=tenant(c),handover=text(body.get("handoverTo")); boolean manager=actor(c.getUserId(),t,"COMPANY_MASTER")||actor(c.getUserId(),t,"MEMBER_ADMIN");
    if(manager&&handover.isBlank())return denied(400,"HANDOVER_TARGET_REQUIRED");
    UUID id=UUID.randomUUID();
    jdbc.update("insert into member_withdrawal_request(request_id,tenant_id,member_id,reason_text,handover_to,confirmation_at,status) values(?,?,?,?,?,current_timestamp,'REQUESTED')",id,t,c.getUserId(),reason,handover.isBlank()?null:handover);
    audit(c.getUserId(),"REQUEST",id,"REQUESTED"); return ResponseEntity.ok(Map.of("requestId",id,"status","REQUESTED"));
  }
  @PostMapping("/home/api/member-withdrawals/{id}/review") @Transactional
  public ResponseEntity<?> review(@PathVariable UUID id,@RequestBody Map<String,Object> body,HttpServletRequest req){return transition(id,"REQUESTED","REVIEWED","PRIVACY_OFFICER",text(body.get("note")),req);}
  @PostMapping("/home/api/member-withdrawals/{id}/approve") @Transactional
  public ResponseEntity<?> approve(@PathVariable UUID id,@RequestBody Map<String,Object> body,HttpServletRequest req){return transition(id,"REVIEWED","APPROVED","APPROVER",text(body.get("note")),req);}
  @PostMapping("/home/api/member-withdrawals/{id}/reject") @Transactional
  public ResponseEntity<?> reject(@PathVariable UUID id,@RequestBody Map<String,Object> body,HttpServletRequest req){String note=text(body.get("note"));if(note.length()<5)return denied(400,"REJECTION_REASON_REQUIRED");return transition(id,"REVIEWED","REJECTED","APPROVER",note,req);}
  @PostMapping("/home/api/member-withdrawals/{id}/complete") @Transactional
  public ResponseEntity<?> complete(@PathVariable UUID id,HttpServletRequest req){
    var c=users.resolve(req); if(!c.isAuthenticated())return denied(401,"AUTHENTICATION_REQUIRED"); if(!actor(c.getUserId(),tenant(c),"MEMBER_ADMIN")&&!c.isWebmaster())return denied(403,"ACTOR_REQUIRED");
    var rows=jdbc.queryForList("select member_id from member_withdrawal_request where request_id=? and status='APPROVED' for update",id); if(rows.isEmpty())return denied(409,"INVALID_WITHDRAWAL_STATE");
    String member=String.valueOf(rows.get(0).get("member_id"));
    jdbc.update("update comtnentrprsmber set entrprs_mber_sttus='D' where lower(entrprs_mber_id)=lower(?)",member);
    jdbc.update("delete from comtnauthtokenstore where lower(user_id)=lower(?)",member);
    jdbc.update("delete from member_mfa_challenge where lower(user_id)=lower(?)",member);
    jdbc.update("delete from member_mfa_setting where lower(user_id)=lower(?)",member);
    jdbc.update("update member_withdrawal_request set status='COMPLETED',completed_by=?,completed_at=current_timestamp,retention_until=current_date+interval '5 years',destruction_due_at=current_timestamp+interval '5 years',row_version=row_version+1 where request_id=?",c.getUserId(),id);
    audit(c.getUserId(),"COMPLETE",id,"COMPLETED"); return ResponseEntity.ok(Map.of("requestId",id,"status","COMPLETED","memberStatus","D","sessionsRevoked",true,"retentionScheduled",true));
  }
  private ResponseEntity<?> transition(UUID id,String from,String to,String required,String note,HttpServletRequest req){var c=users.resolve(req);if(!c.isAuthenticated())return denied(401,"AUTHENTICATION_REQUIRED");if(!actor(c.getUserId(),tenant(c),required)&&!c.isWebmaster())return denied(403,"ACTOR_REQUIRED");String cols=to.equals("REVIEWED")?"review_note=?,reviewed_by=?,reviewed_at=current_timestamp":"decision_note=?,decided_by=?,decided_at=current_timestamp";int n=jdbc.update("update member_withdrawal_request set status=?,"+cols+",row_version=row_version+1 where request_id=? and status=?",to,note,c.getUserId(),id,from);if(n==0)return denied(409,"INVALID_WITHDRAWAL_STATE");audit(c.getUserId(),to,id,to);return ResponseEntity.ok(Map.of("requestId",id,"status",to));}
  private boolean actor(String account,String tenant,String actor){Integer n=jdbc.queryForObject("select count(*) from framework_account_actor_assignment where lower(account_id)=lower(?) and tenant_id=? and actor_code=? and assignment_status='ACTIVE' and (valid_until is null or valid_until>=current_date)",Integer.class,account,tenant,actor);return n!=null&&n>0;}
  private void audit(String user,String action,UUID id,String result){jdbc.update("insert into audit_event(audit_id,trace_id,request_id,actor_id,actor_role,menu_code,page_id,action_code,entity_type,entity_id,before_summary,after_summary,result_status,reason_summary,ip_address,user_agent,created_at,project_id) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,current_timestamp,?)",UUID.randomUUID().toString(),id.toString(),id.toString(),user,"MEMBER","ACCOUNT_WITHDRAWAL","ACCOUNT_WITHDRAWAL",action,"MEMBER_WITHDRAWAL",id.toString(),"",result,"SUCCESS","","","","MEMBER");}
  private String tenant(CurrentUserContextService.CurrentUserContext c){return c.getInsttId()==null||c.getInsttId().isBlank()?"DEFAULT":c.getInsttId().trim();}
  private String text(Object v){return v==null?"":String.valueOf(v).trim();} private ResponseEntity<?> denied(int s,String m){return ResponseEntity.status(s).body(Map.of("message",m));}
}
