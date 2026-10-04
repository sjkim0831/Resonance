package egovframework.com.feature.home.web;

import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.feature.home.service.EmissionProjectRegistryService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.dao.DuplicateKeyException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.*;

@RestController
public class EmissionProjectDraftController {
 private final JdbcTemplate jdbc; private final CurrentUserContextService users; private final EmissionProjectRegistryService registry; private final TransactionTemplate tx; private final ObjectMapper json;
 public EmissionProjectDraftController(JdbcTemplate j,CurrentUserContextService u,EmissionProjectRegistryService r,PlatformTransactionManager t,ObjectMapper m){jdbc=j;users=u;registry=r;tx=new TransactionTemplate(t);json=m;}
 private String[] identity(HttpServletRequest request){
  var u=users.resolve(request);if(!u.isAuthenticated())throw new SecurityException("로그인이 필요합니다.");
  String tenant=u.isWebmaster()?"DEFAULT":u.getInsttId();if(tenant==null||tenant.isBlank())throw new SecurityException("소속 회사를 확인해 주세요.");
  boolean allowed=u.isWebmaster()||Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM framework_account_actor_assignment WHERE tenant_id=? AND lower(account_id)=lower(?) AND actor_code='COMPANY_MANAGER' AND assignment_status='ACTIVE' AND project_id='*' AND data_scope='*' AND (valid_from IS NULL OR valid_from<=current_date) AND (valid_until IS NULL OR valid_until>=current_date))",Boolean.class,tenant,u.getUserId()));
  if(!allowed)throw new SecurityException("회사 프로젝트 등록 권한이 필요합니다.");
  var readiness=registry.onboardingReadiness(tenant);
  if(String.valueOf(readiness.get("missing")).contains("COMPANY_NOT_APPROVED"))throw new SecurityException("회원사 승인 후 등록할 수 있습니다.");
  return new String[]{tenant,u.getUserId()};
 }
 @GetMapping({"/home/api/emission-project-drafts/options","/en/home/api/emission-project-drafts/options"})
 public ResponseEntity<?> options(HttpServletRequest req){try{var id=identity(req);return ResponseEntity.ok(Map.of("companyId",id[0],"projectSetupContractVersion",2,"sites",jdbc.queryForList("SELECT site_id::text AS id,site_code AS code,site_name AS name,address FROM emission_site_registry WHERE tenant_id=? AND site_status='ACTIVE' AND effective_from<=current_date AND (effective_until IS NULL OR effective_until>=current_date) ORDER BY site_name,site_id",id[0])));}catch(SecurityException e){return ResponseEntity.status(users.resolve(req).isAuthenticated()?403:401).body(Map.of("message",e.getMessage()));}}
 private String text(Map<String,Object>b,String k){return Objects.toString(b.get(k),"").trim();}
 @GetMapping({"/home/api/emission-project-drafts/{projectId}/boundary-seed","/en/home/api/emission-project-drafts/{projectId}/boundary-seed"})
 public ResponseEntity<?> boundarySeed(@PathVariable String projectId,HttpServletRequest req){
  var u=users.resolve(req);if(!u.isAuthenticated())return ResponseEntity.status(401).body(Map.of("message","로그인이 필요합니다."));
  String tenant=u.isWebmaster()?"DEFAULT":u.getInsttId();
  try{
   // Reuse the existing project access guard before exposing period or site references.
   registry.organizationalBoundary(projectId,tenant,u.getUserId(),u.isWebmaster());
   var project=jdbc.queryForMap("SELECT project_id AS id,period_start AS \"periodStart\",period_end AS \"periodEnd\" FROM emission_project_registry WHERE project_id=? AND tenant_id=?",projectId,tenant);
   project.put("sites",jdbc.queryForList("SELECT s.site_id::text AS id,s.site_code AS code,s.site_name AS name FROM emission_project_site p JOIN emission_site_registry s ON s.site_id=p.site_id WHERE p.project_id=? AND s.tenant_id=? ORDER BY p.display_order,p.site_id",projectId,tenant));
   return ResponseEntity.ok(project);
  }catch(SecurityException e){return ResponseEntity.status(403).body(Map.of("message","프로젝트 조회 권한이 없습니다."));}
  catch(Exception e){return ResponseEntity.badRequest().body(Map.of("message","프로젝트 기간과 사업장 연결을 확인하지 못했습니다."));}
 }
 @PostMapping({"/home/api/emission-project-drafts","/en/home/api/emission-project-drafts"})
 public ResponseEntity<?> create(@RequestBody Map<String,Object>b,HttpServletRequest req){
  try{
   var identity=identity(req);String tenant=identity[0],actor=identity[1],name=text(b,"name"),description=text(b,"description"),requestId=text(b,"clientRequestId");
   if(name.isEmpty()||name.length()>200||description.length()>2000)throw new IllegalArgumentException("프로젝트명은 1~200자, 설명은 2,000자 이내로 입력해 주세요.");
   if(!requestId.matches("[A-Za-z0-9_-]{16,100}"))throw new IllegalArgumentException("저장 요청 식별자가 올바르지 않습니다.");
   LocalDate start=LocalDate.parse(text(b,"periodStart")),end=LocalDate.parse(text(b,"periodEnd")),dueDate=LocalDate.parse(text(b,"dueDate"));
   if(start.isAfter(end)||start.getYear()<2000||end.getYear()>2100)throw new IllegalArgumentException("산정기간은 2000~2100년이며 시작일이 종료일보다 늦을 수 없습니다.");
   if(dueDate.isBefore(start))throw new IllegalArgumentException("마감일은 산정 시작일보다 빠를 수 없습니다.");
   int reportingYear=Integer.parseInt(text(b,"reportingYear"));if(reportingYear<2000||reportingYear>2100)throw new IllegalArgumentException("보고연도는 2000~2100년으로 입력해 주세요.");
   String boundary=text(b,"organizationBoundary"),standard=text(b,"emissionStandard"),methodology=text(b,"methodologyVersion"),verification=text(b,"verificationLevel"),cycle=text(b,"collectionCycle");
   if(!Set.of("OPERATIONAL_CONTROL","FINANCIAL_CONTROL","EQUITY_SHARE").contains(boundary))throw new IllegalArgumentException("조직 경계를 선택해 주세요.");
   if(!Set.of("ISO_14064_1","GHG_PROTOCOL","K_ETS").contains(standard))throw new IllegalArgumentException("배출량 산정 표준을 선택해 주세요.");
   if(methodology.isBlank()||methodology.length()>40)throw new IllegalArgumentException("방법론 버전을 1~40자로 입력해 주세요.");
   if(!Set.of("LIMITED","REASONABLE").contains(verification))throw new IllegalArgumentException("검증 수준을 선택해 주세요.");
   if(!Set.of("MONTHLY","QUARTERLY","ANNUAL").contains(cycle))throw new IllegalArgumentException("자료 수집 주기를 선택해 주세요.");
   int materiality;try{materiality=Integer.parseInt(text(b,"materialityThreshold"));}catch(NumberFormatException ex){throw new IllegalArgumentException("중요성 기준을 0~100의 정수로 입력해 주세요.");}if(materiality<0||materiality>100)throw new IllegalArgumentException("중요성 기준은 0~100이어야 합니다.");
   if(!(b.get("scopes") instanceof List<?> scopeList)||scopeList.isEmpty())throw new IllegalArgumentException("산정 Scope를 하나 이상 선택해 주세요.");
   List<String> scopes=scopeList.stream().map(String::valueOf).distinct().sorted().toList();if(scopes.stream().anyMatch(v->!Set.of("Scope 1","Scope 2","Scope 3").contains(v)))throw new IllegalArgumentException("지원하지 않는 산정 Scope입니다.");
   if(!(b.get("siteIds") instanceof List<?> list)||list.isEmpty()||list.size()>500)throw new IllegalArgumentException("사업장을 1~500개 선택해 주세요.");
   List<Long> siteIds=list.stream().map(v->Long.valueOf(v.toString())).distinct().sorted().toList();
   String scopesJson=json.writeValueAsString(scopes);
   String fingerprint=json.writeValueAsString(List.of(name,description,start.toString(),end.toString(),siteIds,reportingYear,scopes,boundary,standard,methodology,verification,cycle,materiality,dueDate.toString()));
   Map<String,Object> result=tx.execute(status->{
    jdbc.query("SELECT pg_advisory_xact_lock(hashtextextended(?,0))",rs->{},tenant+":"+requestId);
    var existing=jdbc.queryForList("SELECT project_id,settings_snapshot->>'creationPayload' AS payload FROM emission_project_registry WHERE tenant_id=? AND creation_request_id=?",tenant,requestId);
    if(!existing.isEmpty()){if(!fingerprint.equals(existing.get(0).get("payload")))throw new IllegalArgumentException("같은 저장 요청에 다른 내용이 전달되었습니다. 내용을 확인해 다시 저장해 주세요.");return Map.<String,Object>of("id",existing.get(0).get("project_id"),"replayed",true);}
    List<Map<String,Object>> sites=new ArrayList<>();
    for(Long siteId:siteIds){var rows=jdbc.queryForList("SELECT site_id,site_name FROM emission_site_registry WHERE site_id=? AND tenant_id=? AND site_status='ACTIVE' AND effective_from<=current_date AND (effective_until IS NULL OR effective_until>=current_date) FOR SHARE",siteId,tenant);if(rows.size()!=1)throw new IllegalArgumentException("선택한 사업장이 변경되었거나 등록할 수 없습니다. 목록을 새로 불러와 주세요.");sites.add(rows.get(0));}
    String projectId="PRJ-"+LocalDate.now().getYear()+"-"+UUID.randomUUID().toString().replace("-","").substring(0,20).toUpperCase();
    jdbc.update("INSERT INTO emission_project_registry(project_id,tenant_id,project_name,site_name,calculation_period,scope_name,owner_name,due_date,current_step,project_status,period_start,period_end,reporting_year,organization_boundary,emission_standard,methodology_version,verification_level,collection_cycle,materiality_threshold,creation_request_id,settings_snapshot) VALUES (?,?,?,?,?,?,?,?,?,'진행',?,?,?,?,?,?,?,?,?,?,jsonb_build_object('description',?,'scopes',?::jsonb,'setupStatus','BASIC_REGISTERED','createdBy',?,'creationPayload',?))",projectId,tenant,name,sites.get(0).get("site_name"),start+" ~ "+end,String.join(", ",scopes),actor,dueDate,"기본정보 등록 · 후속 설정 필요",start,end,reportingYear,boundary,standard,methodology,verification,cycle,materiality,requestId,description,scopesJson,actor,fingerprint);
    for(int i=0;i<sites.size();i++)jdbc.update("INSERT INTO emission_project_site(project_id,site_id,site_name,display_order) VALUES (?,?,?,?)",projectId,sites.get(i).get("site_id"),sites.get(i).get("site_name"),i);
    jdbc.update("INSERT INTO emission_project_history(project_id,event_type,event_description,actor_name) VALUES (?,'BASIC_REGISTERED','프로젝트 기본정보·범위·산정 기준·마감일 저장. 단계별 담당자는 업무 배정 화면에서 지정합니다.',?)",projectId,actor);
    initializeTasks(projectId,actor);
    return Map.<String,Object>of("id",projectId,"replayed",false);
   });return ResponseEntity.ok(result);
  }catch(SecurityException e){return ResponseEntity.status(users.resolve(req).isAuthenticated()?403:401).body(Map.of("message",e.getMessage()));}
  catch(DuplicateKeyException e){return ResponseEntity.status(409).body(Map.of("message","동일한 프로젝트명이 이미 사용 중입니다. 현재 DB 이름 고유 제약에 따라 다른 이름을 입력해 주세요."));}
  catch(IllegalArgumentException|java.time.DateTimeException e){return ResponseEntity.badRequest().body(Map.of("message",Objects.toString(e.getMessage(),"입력값을 확인해 주세요.")));}
  catch(Exception e){return ResponseEntity.status(500).body(Map.of("message","저장하지 못했습니다. 입력값은 유지됩니다. 다시 시도해 주세요."));}
 }
 private void initializeTasks(String id,String actor){
  String[][] tasks={
   {"BASIC_INFO","프로젝트 기본정보 확인","SETUP","COMPANY_MANAGER","","/emission/organizational-boundary","기본정보·보고범위·산정기준 저장 및 필수 단계별 담당자 배정"},
   {"ACTIVITY_DATA","활동자료 입력·제출","COLLECT","SITE_DATA_OWNER","BASIC_INFO","/emission/activity-data","품질검사를 통과한 자료 제출"},
   {"CALCULATION","배출계수 연결·산정","CALCULATE","CALCULATOR","ACTIVITY_DATA","/emission/calculation","산정 버전 생성"},
   {"VERIFICATION","검증·보완","VALIDATE","VERIFIER","CALCULATION","/emission/validate","검증 통과 이력 저장"},
   {"APPROVAL","검토·승인","APPROVE","APPROVER","VERIFICATION","/emission/validate?tab=approval","권한 있는 결재자의 승인"},
   {"REPORT","확정·보고","REPORT","COMPANY_MANAGER","APPROVAL","/emission/report_submit","확정 보고서 발행"},
   {"REGULATORY_SUBMISSION","규제기관 제출·접수","REGULATORY_SUBMISSION_S1","COMPANY_MANAGER","REPORT","/emission/report-submission","기관 접수·수리 이력 저장"}
  };
  for(int i=0;i<tasks.length;i++){String[] t=tasks[i];jdbc.update("INSERT INTO emission_project_task(project_id,task_code,task_name,step_order,task_status,progress_weight,process_code,process_step_code,actor_code,predecessor_codes,completion_rule,target_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",id,t[0],t[1],i+1,i==0?"READY":"WAITING",i==0?10:15,i==6?"REGULATORY_SUBMISSION":"EMISSION_PROJECT",i==6?t[2]:"EMISSION_PROJECT_"+t[2],t[3],t[4],t[6],t[5]+(t[5].contains("?")?"&":"?")+"projectId="+id);}
  jdbc.update("UPDATE emission_project_registry SET current_step='프로젝트 준비 확인 필요',progress_percent=0 WHERE project_id=?",id);
 }
}
