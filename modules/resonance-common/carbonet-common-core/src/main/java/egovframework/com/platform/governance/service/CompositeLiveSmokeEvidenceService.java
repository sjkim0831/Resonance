package egovframework.com.platform.governance.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;

/** Authenticated append-only ingestion for real API, database and browser smoke observations. */
@Service
public class CompositeLiveSmokeEvidenceService {
    private static final String SCHEMA="carbonet.composite-live-smoke-lane/v1";
    private static final Set<String> LANES=Set.of("API","DATABASE","BROWSER");
    private static final Set<String> STATUSES=Set.of(
        "SUCCESS","VALIDATION_ERROR","FORBIDDEN","CONFLICT","RECOVERY");
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public CompositeLiveSmokeEvidenceService(JdbcTemplate jdbc,ObjectMapper mapper){
        this.jdbc=jdbc;this.mapper=mapper;
    }

    @Transactional
    public Map<String,Object> record(Map<String,Object> request,String authenticatedAccount){
        if(authenticatedAccount==null||authenticatedAccount.isBlank())
            throw new SecurityException("AUTHENTICATED_LIVE_SMOKE_ACCOUNT_REQUIRED");
        long jobId=positiveLong(request,"jobId"),authorityId=positiveLong(request,"authorityId");
        String lane=code(request,"lane",LANES),status=code(request,"statusCase",STATUSES);
        String scenarioCode=required(request,"scenarioCode",120);
        String tenantId=required(request,"tenantId",100),projectId=required(request,"projectId",100);
        String observedState=required(request,"observedState",120);
        String targetRef=required(request,"targetRef",1000);
        Map<String,Object> input=object(request.get("input"),"input");
        Map<String,Object> output=object(request.get("output"),"output");
        Map<String,Object> laneDetails=object(request.get("laneDetails"),"laneDetails");
        String runId=UUID.fromString(required(request,"runId",36)).toString();
        String artifactHash=hashText(request.get("artifactHash"),"artifactHash");
        String observedAt=OffsetDateTime.parse(required(request,"observedAt",60)).toString();
        Map<String,Object> authority=currentAuthority(jobId,authorityId,observedAt);
        if(!Boolean.TRUE.equals(authority.get("temporalExact")))
            throw new IllegalArgumentException("LIVE_SMOKE_OBSERVED_AFTER_DEPLOY_REQUIRED");
        String boundProject="GLOBAL".equals(authority.get("scopeType"))?"*":
            String.valueOf(authority.get("boundProjectId"));
        if(!projectId.equals(boundProject))
            throw new SecurityException("LIVE_SMOKE_PROJECT_SCOPE_NOT_EXACT");
        if(!artifactHash.equals(authority.get("artifactHash")))
            throw new IllegalArgumentException("LIVE_SMOKE_ARTIFACT_NOT_CURRENT_JOB");
        Map<String,Object> design=object(authority.get("executableDesign"),"executableDesign");
        Map<String,Object> scenario=exactScenario(design,scenarioCode,status);
        String command=String.valueOf(scenario.get("commandCode"));
        Map<String,Object> commandRow=one(maps(object(design.get("PROCESS"),"PROCESS").get("commands")),
            "commandCode",command,"PROCESS_COMMAND_NOT_EXACT");
        String actor=required(commandRow,"actorCode",120);
        Map<String,Object> transition=one(maps(object(design.get("STATE"),"STATE").get("states")),
            "commandCode",command,"STATE_TRANSITION_NOT_EXACT");
        Map<String,Object> operation=one(maps(object(design.get("API"),"API").get("operations")),
            "commandCode",command,"API_OPERATION_NOT_EXACT");
        if(!CompositeExecutableDesignAuthorityCompiler.stable(input).equals(
                CompositeExecutableDesignAuthorityCompiler.stable(object(
                    scenario.get("inputValues"),"scenario.inputValues"))))
            throw new IllegalArgumentException("LIVE_SMOKE_INPUT_NOT_DECLARED");
        if(!output.keySet().equals(new TreeSet<>(strings(scenario.get("expectedOutputFields")))))
            throw new IllegalArgumentException("LIVE_SMOKE_OUTPUT_FIELDS_NOT_DECLARED");
        String from=required(transition,"fromState",120),to=required(transition,"toState",120);
        String expectedState="SUCCESS".equals(status)?to:from;
        if(!expectedState.equals(observedState))
            throw new IllegalArgumentException("LIVE_SMOKE_STATE_NOT_DECLARED");
        String expectedTarget=target(lane,authority,design,operation);
        if(!expectedTarget.equals(targetRef))
            throw new IllegalArgumentException("LIVE_SMOKE_TARGET_NOT_DECLARED");
        accountExact(authenticatedAccount,tenantId,projectId,actor,status);

        String accountHash=hash(Map.of("accountId",authenticatedAccount,"tenantId",tenantId,
            "projectId",projectId,"actorCode",actor));
        String commandHash=hash(Map.of("commandCode",command));
        String inputHash=hash(input),outputHash=hash(output);
        String stateHash=hash(Map.of("fromState",from,"toState",to,"observedState",observedState));
        String statusHash=hash(Map.of("expectedStatus",status,"observedStatus",status));
        Map<String,Object> laneEvidence=laneEvidence(lane,laneDetails,runId,targetRef,
            inputHash,outputHash,artifactHash);
        String laneEvidenceHash=hash(laneEvidence);
        String evidenceRef="live:"+runId+";lane:"+lane+";artifact:"+artifactHash;
        Map<String,Object> envelope=new LinkedHashMap<>();
        envelope.put("schema","carbonet.composite-live-smoke-evidence/v1");
        envelope.put("jobId",jobId);envelope.put("authorityId",authorityId);
        envelope.put("authorityRevision",authority.get("authorityRevision"));
        envelope.put("processCode",authority.get("processCode"));
        envelope.put("stepCode",authority.get("stepCode"));
        envelope.put("routePath",authority.get("routePath"));envelope.put("audience",authority.get("audience"));
        envelope.put("lane",lane);envelope.put("statusCase",status);
        envelope.put("scenarioCode",scenarioCode);envelope.put("accountHash",accountHash);
        envelope.put("commandHash",commandHash);envelope.put("inputHash",inputHash);
        envelope.put("outputHash",outputHash);envelope.put("stateHash",stateHash);
        envelope.put("statusHash",statusHash);envelope.put("sourceHash",authority.get("sourceHash"));
        envelope.put("authorityHash",authority.get("authorityHash"));envelope.put("targetRef",targetRef);
        envelope.put("laneEvidenceHash",laneEvidenceHash);envelope.put("evidenceRef",evidenceRef);
        String evidenceHash=hash(envelope);
        int writes=jdbc.update("""
            insert into integrated_design_live_smoke_evidence(
              job_id,authority_id,authority_revision,process_code,step_code,route_path,audience,
              lane,status_case,scenario_code,account_id,tenant_id,project_id,actor_code,command_code,
              input_json,output_json,from_state,to_state,observed_state,expected_status,observed_status,
              source_hash,authority_hash,target_ref,lane_evidence,account_hash,command_hash,input_hash,
              output_hash,state_hash,status_hash,lane_evidence_hash,evidence_hash,evidence_ref,
              recorded_by,observed_at)
            values(
              ?,?,?,?,?,?,?,
              ?,?,?,?,?,?,?,?,
              ?::jsonb,?::jsonb,?,?,?,?,?,
              ?,?,?,?::jsonb,?,?,?,
              ?,?,?,?,?,?,?,
              ?::timestamptz)
            on conflict(job_id,authority_id,command_code,scenario_code,lane,status_case) do nothing
            """,jobId,authorityId,authority.get("authorityRevision"),authority.get("processCode"),
            authority.get("stepCode"),authority.get("routePath"),authority.get("audience"),lane,status,
            scenarioCode,authenticatedAccount,tenantId,projectId,actor,command,json(input),json(output),
            from,to,observedState,status,status,authority.get("sourceHash"),authority.get("authorityHash"),
            targetRef,json(laneEvidence),accountHash,commandHash,inputHash,outputHash,stateHash,statusHash,
            laneEvidenceHash,evidenceHash,evidenceRef,authenticatedAccount,observedAt);
        if(writes==0){
            String existing=jdbc.queryForObject("""
                select evidence_hash from integrated_design_live_smoke_evidence
                 where job_id=? and authority_id=? and command_code=? and scenario_code=?
                   and lane=? and status_case=?
                """,String.class,jobId,authorityId,command,scenarioCode,lane,status);
            if(!evidenceHash.equals(existing))throw new IllegalStateException(
                "LIVE_SMOKE_EVIDENCE_CONFLICT_REQUIRES_NEW_JOB");
        }
        return Map.of("success",true,"status","TEST_EVIDENCE_RECORDED","writeCount",writes,
            "jobId",jobId,"authorityId",authorityId,"lane",lane,"statusCase",status,
            "scenarioCode",scenarioCode,"evidenceHash",evidenceHash);
    }

    private Map<String,Object> currentAuthority(long jobId,long authorityId,String observedAt){
        List<Map<String,Object>> rows=jdbc.queryForList("""
            select authority.authority_revision as "authorityRevision",
                   authority.process_code as "processCode",authority.step_code as "stepCode",
                   authority.route_path as "routePath",authority.audience as "audience",
                   authority.source_hash as "sourceHash",authority.authority_hash as "authorityHash",
                   authority.composite_json->'executableDesign' as "executableDesign",
                   binding.scope_type as "scopeType",binding.project_id as "boundProjectId",
                   framework_try_jsonb(job.result_json)#>>
                     '{canonicalGeneration,compositeArtifactManifestHash}' as "artifactHash",
                   (?::timestamptz>=job.completed_at and
                    ?::timestamptz<=clock_timestamp()) as "temporalExact"
              from integrated_design_authority authority
              join framework_development_job job on job.job_id=authority.job_id
              join integrated_design_autocompletion_receipt receipt
                on receipt.process_code=authority.process_code and receipt.job_id=job.job_id
              join lateral(select candidate.* from integrated_design_scope_binding candidate
                where candidate.authority_id=authority.authority_id
                  and candidate.authority_revision=authority.authority_revision
                  and candidate.process_code=authority.process_code
                  and candidate.step_code=authority.step_code
                  and candidate.route_path=authority.route_path
                  and candidate.audience=authority.audience
                  and candidate.document_set_hash=authority.document_set_hash
                  and candidate.authority_hash=authority.authority_hash
                order by candidate.bound_at desc,candidate.design_version desc nulls last
                limit 1) binding on true
             where authority.authority_id=? and authority.job_id=?
               and receipt.completion_status='SOURCE_APPLIED_PHYSICAL_QUEUED'
               and job.job_type='FULL_STACK_GENERATION'
               and job.job_group_code=authority.process_code||'_CANONICAL_PUBLICATION'
               and job.job_status in('VERIFIED','COMPLETED') and job.quality_status='VERIFIED'
               and job.completed_at is not null
               and not exists(select 1 from integrated_design_scope_binding conflicting
                 where conflicting.authority_id=authority.authority_id
                   and conflicting.authority_revision=authority.authority_revision
                   and conflicting.process_code=authority.process_code
                   and conflicting.step_code=authority.step_code
                   and conflicting.route_path=authority.route_path
                   and conflicting.audience=authority.audience
                   and conflicting.document_set_hash=authority.document_set_hash
                   and conflicting.authority_hash=authority.authority_hash
                   and (conflicting.scope_type<>binding.scope_type
                     or coalesce(conflicting.project_id,'')<>coalesce(binding.project_id,'')))
            """,observedAt,observedAt,authorityId,jobId);
        if(rows.size()!=1)throw new IllegalStateException("LIVE_SMOKE_CURRENT_JOB_AUTHORITY_REQUIRED");
        Map<String,Object> row=new LinkedHashMap<>(rows.get(0));
        if(!Set.of("GLOBAL","PROJECT").contains(String.valueOf(row.get("scopeType")))
                ||("PROJECT".equals(row.get("scopeType"))
                    &&!String.valueOf(row.get("boundProjectId"))
                        .matches("^[A-Z][A-Z0-9_-]{2,63}$"))
                ||!String.valueOf(row.get("artifactHash")).matches("[0-9a-f]{64}"))
            throw new IllegalStateException("LIVE_SMOKE_CURRENT_SCOPE_OR_ARTIFACT_NOT_EXACT");
        Object raw=row.get("executableDesign");
        if(!(raw instanceof Map<?,?>))try{row.put("executableDesign",mapper.readValue(String.valueOf(raw),Map.class));}
        catch(Exception invalid){throw new IllegalStateException("LIVE_SMOKE_EXECUTABLE_DESIGN_INVALID");}
        return row;
    }

    private Map<String,Object> exactScenario(Map<String,Object> design,String code,String status){
        List<Map<String,Object>> matches=maps(object(design.get("TEST"),"TEST").get("scenarios")).stream()
            .filter(row->code.equals(row.get("scenarioCode"))&&status.equals(row.get("expectedStatus"))).toList();
        if(matches.size()!=1)throw new IllegalArgumentException("LIVE_SMOKE_SCENARIO_NOT_DECLARED");
        return matches.get(0);
    }

    private void accountExact(String account,String tenant,String project,String actor,String status){
        Boolean active=jdbc.queryForObject("""
            select exists(select 1 from comtnemplyrinfo account
              join comtnemplyrscrtyestbs security
                on security.scrty_dtrmn_trget_id=account.esntl_id
               and nullif(btrim(security.author_code),'') is not null
             where lower(account.emplyr_id)=lower(?) and account.emplyr_sttus_code in('P','A'))
              or exists(select 1 from comtnentrprsmber account
                join comtnemplyrscrtyestbs security
                  on security.scrty_dtrmn_trget_id=account.esntl_id
                 and nullif(btrim(security.author_code),'') is not null
               where lower(account.entrprs_mber_id)=lower(?)
                 and account.entrprs_mber_sttus in('P','A'))
            """,Boolean.class,account,account);
        int assignments=jdbc.queryForObject("""
            select count(*) from framework_account_actor_assignment assignment
              join framework_actor_definition actor on actor.actor_code=assignment.actor_code
                and actor.use_at='Y'
             where lower(assignment.account_id)=lower(?) and assignment.tenant_id=?
               and assignment.actor_code=?
               and (project_id='*' or (project_id=? and exists(select 1
                 from framework_project_actor_assignment project_actor
                where project_actor.project_id=? and project_actor.actor_code=?
                  and lower(project_actor.user_id)=lower(?) and project_actor.active_yn='Y')))
               and assignment_status='ACTIVE' and valid_from<=current_date
               and (valid_until is null or valid_until>=current_date)
            """,Integer.class,account,tenant,actor,project,project,actor,account);
        if(!Boolean.TRUE.equals(active)||("FORBIDDEN".equals(status)?assignments!=0:assignments!=1))
            throw new SecurityException("LIVE_SMOKE_ACCOUNT_ACTOR_SCOPE_NOT_EXACT");
    }

    private Map<String,Object> laneEvidence(String lane,Map<String,Object> details,String runId,
            String target,String inputHash,String outputHash,String artifactHash){
        Set<String> expected=switch(lane){
            case "DATABASE" -> Set.of("rereadHash","transactionHash");
            case "BROWSER" -> Set.of("domHash","screenshotHash","rendered");
            default -> Set.of("transportHash");
        };
        if(!details.keySet().equals(expected))throw new IllegalArgumentException("LIVE_SMOKE_LANE_DETAILS_NOT_EXACT");
        if("BROWSER".equals(lane)&&!Boolean.TRUE.equals(details.get("rendered")))
            throw new IllegalArgumentException("LIVE_SMOKE_BROWSER_NOT_RENDERED");
        for(Map.Entry<String,Object> entry:details.entrySet())if(!"rendered".equals(entry.getKey()))
            hashText(entry.getValue(),"laneDetails."+entry.getKey());
        Map<String,Object> proof=new LinkedHashMap<>();
        proof.put("schema",SCHEMA);proof.put("source",switch(lane){
            case "API"->"API_HTTP";case "DATABASE"->"POSTGRES_REREAD";default->"BROWSER_DOM";});
        proof.put("runId",runId);proof.put("targetRef",target);proof.put("observed",true);
        proof.put("requestHash",inputHash);proof.put("responseHash",outputHash);
        proof.put("artifactHash",artifactHash);proof.putAll(details);return proof;
    }

    private String target(String lane,Map<String,Object> authority,Map<String,Object> design,
            Map<String,Object> operation){
        if("API".equals(lane))return operation.get("method")+" "+operation.get("path");
        if("BROWSER".equals(lane))return String.valueOf(authority.get("routePath"));
        return "entities:"+String.join(",",maps(object(design.get("DATABASE"),"DATABASE")
            .get("entities")).stream().map(row->String.valueOf(row.get("entity"))).sorted().toList());
    }

    private String hash(Object value){return jdbc.queryForObject(
        "select framework_composite_live_smoke_hash(?::jsonb)",String.class,json(value));}
    private String json(Object value){try{return mapper.writeValueAsString(value);}
        catch(Exception error){throw new IllegalArgumentException("LIVE_SMOKE_JSON_INVALID",error);}}
    private static String required(Map<String,Object> value,String key,int max){
        String text=String.valueOf(value.getOrDefault(key,"")).trim();
        if(text.isEmpty()||text.length()>max)throw new IllegalArgumentException("LIVE_SMOKE_"+key+"_INVALID");
        return text;
    }
    private static String code(Map<String,Object> value,String key,Set<String> allowed){
        String text=required(value,key,30).toUpperCase();
        if(!allowed.contains(text))throw new IllegalArgumentException("LIVE_SMOKE_"+key+"_INVALID");return text;
    }
    private static long positiveLong(Map<String,Object> value,String key){
        Object raw=value.get(key);if(!(raw instanceof Number))
            throw new IllegalArgumentException("LIVE_SMOKE_"+key+"_INVALID");
        try{long exact=new BigDecimal(String.valueOf(raw)).longValueExact();
            if(exact<1)throw new ArithmeticException();return exact;
        }catch(ArithmeticException invalid){
            throw new IllegalArgumentException("LIVE_SMOKE_"+key+"_INVALID");
        }
    }
    private static String hashText(Object value,String key){String text=String.valueOf(value);
        if(!text.matches("[0-9a-f]{64}"))throw new IllegalArgumentException("LIVE_SMOKE_"+key+"_INVALID");return text;}
    @SuppressWarnings("unchecked") private static Map<String,Object> object(Object raw,String key){
        if(!(raw instanceof Map<?,?>))throw new IllegalArgumentException("LIVE_SMOKE_"+key+"_INVALID");
        return (Map<String,Object>)raw;
    }
    private static List<Map<String,Object>> maps(Object raw){
        if(!(raw instanceof List<?> list))throw new IllegalArgumentException("LIVE_SMOKE_ARRAY_INVALID");
        List<Map<String,Object>> result=new ArrayList<>();for(Object value:list)result.add(object(value,"row"));return result;
    }
    private static List<String> strings(Object raw){
        if(!(raw instanceof List<?> list))throw new IllegalArgumentException("LIVE_SMOKE_STRING_ARRAY_INVALID");
        return list.stream().map(String::valueOf).toList();
    }
    private static Map<String,Object> one(List<Map<String,Object>> rows,String key,String value,String error){
        List<Map<String,Object>> matches=rows.stream().filter(row->value.equals(row.get(key))).toList();
        if(matches.size()!=1)throw new IllegalArgumentException(error);return matches.get(0);
    }
}
