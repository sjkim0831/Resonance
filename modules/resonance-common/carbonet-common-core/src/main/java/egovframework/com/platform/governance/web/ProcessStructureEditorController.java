package egovframework.com.platform.governance.web;

import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.platform.governance.service.ActorProcessGovernanceService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;
import java.util.*;

/** Partial structure editing adapter: preserve all non-edited canonical columns. */
@RestController
@RequestMapping("/admin/api/system/actor-process/processes/{processCode}/structure")
public class ProcessStructureEditorController {
 private final JdbcTemplate db; private final TransactionTemplate tx;
 private final ActorProcessGovernanceService service; private final CurrentUserContextService users;
 public ProcessStructureEditorController(JdbcTemplate db,org.springframework.transaction.PlatformTransactionManager manager,ActorProcessGovernanceService service,CurrentUserContextService users){this.db=db;this.tx=new TransactionTemplate(manager);this.service=service;this.users=users;}
 private String actor(HttpServletRequest request){var u=users.resolve(request);if(u==null||!u.isAuthenticated())throw new Access(401);if(!u.isWebmaster()&&!Set.of("ROLE_SYSTEM_ADMIN","ROLE_SYSTEM_MASTER").contains(Objects.toString(u.getAuthorCode(),"")))throw new Access(403);return u.getUserId();}
 private static class Access extends RuntimeException{final int status;Access(int status){this.status=status;}}
 private static class Conflict extends RuntimeException{Conflict(){super("STALE_PROCESS_VERSION");}}
 private static String required(Map<String,Object> b,String key){String v=Objects.toString(b.get(key),"").trim();if(v.isEmpty())throw new IllegalArgumentException("필수값 누락: "+key);return v;}
 private static Map<String,Object> camel(Map<String,Object> source){Map<String,Object> out=new LinkedHashMap<>();source.forEach((k,v)->{StringBuilder name=new StringBuilder();boolean upper=false;for(char c:k.toCharArray()){if(c=='_')upper=true;else{name.append(upper?Character.toUpperCase(c):c);upper=false;}}out.put(name.toString(),v);});return out;}
 private Map<String,Object> process(String code,boolean lock){return camel(db.queryForMap("select * from framework_process_definition where process_code=?"+(lock?" for update":""),code));}
 @GetMapping public ResponseEntity<?> read(@PathVariable String processCode,HttpServletRequest request){try{actor(request);return ResponseEntity.ok(Map.of("process",process(processCode,false),"steps",db.queryForList("select * from framework_process_step where process_code=? order by step_order",processCode).stream().map(ProcessStructureEditorController::camel).toList()));}catch(Exception e){return failure(e);}}
 @PostMapping public ResponseEntity<?> save(@PathVariable String processCode,@RequestBody Map<String,Object> body,HttpServletRequest request){try{String actor=actor(request);return ResponseEntity.ok(tx.execute(status->update(processCode,body,actor)));}catch(Exception e){return failure(e);}}
 private Map<String,Object> update(String code,Map<String,Object> body,String actor){
  if(!body.keySet().stream().allMatch(Set.of("mode","stepCode","expectedProcessVersion","revisionReason","changes")::contains))throw new IllegalArgumentException("지원하지 않는 요청 필드");
  String reason=required(body,"revisionReason");if(reason.length()>2000)throw new IllegalArgumentException("변경 사유는 2000자 이내");
  Map<String,Object> current=process(code,true);String expected=required(body,"expectedProcessVersion");if(!expected.equals(Objects.toString(current.get("processVersion"),"")))throw new Conflict();
  String mode=required(body,"mode");if(!(body.get("changes") instanceof Map<?,?> raw))throw new IllegalArgumentException("CHANGES_REQUIRED");Map<String,Object> changes=new LinkedHashMap<>();raw.forEach((k,v)->changes.put(String.valueOf(k),v));
  Set<String> allowed=mode.equals("process")?Set.of("processName","goal","startCondition","completionCondition"):mode.equals("step")?Set.of("stepName","stepOrder","actorCode","fromState","commandCode","toState","completionRule"):mode.equals("add")?Set.of("stepCode","stepName","stepOrder","actorCode","fromState","commandCode","toState","completionRule","inputContract","outputContract"):Set.of();
  if(changes.isEmpty()||!allowed.containsAll(changes.keySet()))throw new IllegalArgumentException("지원하지 않는 변경 필드");
  String before=snapshot(code);String beforeHash=db.queryForObject("select framework_process_structure_hash(?)",String.class,code);
  Map<String,Object> result;
  if(mode.equals("process")){boolean changed=changes.entrySet().stream().anyMatch(e->!Objects.toString(e.getValue(),"").equals(Objects.toString(current.get(e.getKey()),"")));if(!changed)throw new IllegalArgumentException("변경된 값이 없습니다");current.putAll(changes);current.put("version",current.get("processVersion"));result=service.createProcess(current,actor);}
  else {String step=required(body,"stepCode");List<Map<String,Object>> rows=db.queryForList("select * from framework_process_step where process_code=? and step_code=?",code,step);if(mode.equals("add")&&!rows.isEmpty())throw new IllegalArgumentException("이미 존재하는 절차 코드");if(mode.equals("step")&&rows.isEmpty())throw new org.springframework.dao.EmptyResultDataAccessException(1);Map<String,Object> next=rows.isEmpty()?new LinkedHashMap<>():camel(rows.get(0));
   if(mode.equals("step")&&changes.entrySet().stream().allMatch(e->Objects.toString(e.getValue(),"").equals(Objects.toString(next.get(e.getKey()),""))))throw new IllegalArgumentException("변경된 값이 없습니다");
   next.putAll(changes);next.put("processCode",code);next.put("stepCode",step);
   int order;try{order=Integer.parseInt(required(next,"stepOrder"));}catch(NumberFormatException e){throw new IllegalArgumentException("순서는 정수여야 합니다");}
   Integer count=db.queryForObject("select count(*) from framework_process_step where process_code=?",Integer.class,code);if(order<1||order>Objects.requireNonNull(count)+(mode.equals("add")?1:0))throw new IllegalArgumentException("절차 순서 범위 오류");
   result=service.addStep(next,actor);
  }
  String afterVersion=Objects.toString(process(code,false).get("processVersion"),"");
  String afterHash=db.queryForObject("select framework_process_structure_hash(?)",String.class,code);
  db.update("insert into framework_process_step_revision_audit(process_code,step_code,change_type,revision_reason,actor,expected_process_version,before_process_version,after_process_version,before_structure_hash,after_structure_hash,before_snapshot,after_snapshot) values(?,?,'UPDATE',?,?,?,?,?,?,?,?::jsonb,?::jsonb)",code,mode.equals("process")?null:body.get("stepCode"),reason,actor,expected,expected,afterVersion,beforeHash,afterHash,before,snapshot(code));
  Map<String,Object> out=new LinkedHashMap<>(result);out.put("processVersion",afterVersion);return out;
 }
 private String snapshot(String code){return db.queryForObject("select jsonb_build_object('process',to_jsonb(p),'steps',(select coalesce(jsonb_agg(to_jsonb(s) order by step_order),'[]'::jsonb) from framework_process_step s where s.process_code=p.process_code))::text from framework_process_definition p where process_code=?",String.class,code);}
 private ResponseEntity<?> failure(Exception e){int status=e instanceof Access a?a.status:e instanceof Conflict?409:e instanceof org.springframework.dao.EmptyResultDataAccessException?404:e instanceof IllegalArgumentException?422:500;return ResponseEntity.status(status).body(Map.of("success",false,"message",status==500?"정의 저장에 실패했습니다. 기존 입력을 유지했습니다.":status==401?"로그인이 필요합니다":status==403?"설계 관리자 권한이 필요합니다":Objects.toString(e.getMessage(),"대상 없음")));}
}
