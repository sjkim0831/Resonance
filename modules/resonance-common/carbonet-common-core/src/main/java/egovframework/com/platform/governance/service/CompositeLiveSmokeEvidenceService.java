package egovframework.com.platform.governance.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.BasicFileAttributes;
import java.nio.file.attribute.PosixFileAttributeView;
import java.nio.file.attribute.PosixFilePermission;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.HexFormat;
import java.util.Objects;

/** Authenticated append-only ingestion for real API, database and browser smoke observations. */
@Service
public class CompositeLiveSmokeEvidenceService {
    private static final String SCHEMA="carbonet.composite-live-smoke-lane/v1";
    private static final Set<String> LANES=Set.of("API","DATABASE","BROWSER");
    private static final Set<String> STATUSES=Set.of(
        "SUCCESS","VALIDATION_ERROR","FORBIDDEN","CONFLICT","RECOVERY");
    private static final String DEFAULT_EVIDENCE_ROOT=
        "/opt/resonance-data/control-plane/var/test-evidence/composite-live-smoke";
    private static final long MAX_DOM_BYTES=4L*1024*1024;
    private static final long MAX_SCREENSHOT_BYTES=20L*1024*1024;
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final Path evidenceRoot;

    @Autowired
    public CompositeLiveSmokeEvidenceService(JdbcTemplate jdbc,ObjectMapper mapper,
            @Value("${resonance.composite-live-smoke.evidence-root:"+DEFAULT_EVIDENCE_ROOT+"}")
            String evidenceRoot){
        this(jdbc,mapper,Path.of(evidenceRoot));
    }
    public CompositeLiveSmokeEvidenceService(JdbcTemplate jdbc,ObjectMapper mapper){
        this(jdbc,mapper,Path.of(DEFAULT_EVIDENCE_ROOT).toAbsolutePath());
    }
    CompositeLiveSmokeEvidenceService(JdbcTemplate jdbc,ObjectMapper mapper,Path evidenceRoot){
        this.jdbc=jdbc;this.mapper=mapper;
        if(evidenceRoot==null)throw new IllegalArgumentException("LIVE_SMOKE_EVIDENCE_ROOT_REQUIRED");
        this.evidenceRoot=evidenceRoot.toAbsolutePath().normalize();
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
        UUID executionId=UUID.fromString(required(request,"executionId",36));
        String idempotencyKey=required(request,"idempotencyKey",200);
        String idempotencyKeyHash=hash(Map.of("idempotencyKey",idempotencyKey));
        int observedHttpStatus=exactInteger(request,"observedHttpStatus",100,599);
        Map<String,Object> input=object(request.get("input"),"input");
        Map<String,Object> output=object(request.get("output"),"output");
        Map<String,Object> laneDetails=object(request.get("laneDetails"),"laneDetails");
        String runId=UUID.fromString(required(request,"runId",36)).toString();
        String artifactHash=hashText(request.get("artifactHash"),"artifactHash");
        String observedAt=OffsetDateTime.parse(required(request,"observedAt",60)).toString();
        Map<String,Object> authority=currentAuthority(jobId,authorityId,observedAt);
        if(!Boolean.TRUE.equals(authority.get("temporalExact")))
            throw new IllegalArgumentException("LIVE_SMOKE_OBSERVED_AFTER_DEPLOY_REQUIRED");
        String scopeType=String.valueOf(authority.get("scopeType"));
        String boundProject=String.valueOf(authority.get("boundProjectId"));
        if(("PROJECT".equals(scopeType)&&!projectId.equals(boundProject))
                ||!projectId.matches("^[A-Z][A-Z0-9_-]{2,63}$"))
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
        String from=required(transition,"fromState",120),to=required(transition,"toState",120);
        String expectedState=Set.of("SUCCESS","CONFLICT","RECOVERY").contains(status)?to:from;
        if(!expectedState.equals(observedState))
            throw new IllegalArgumentException("LIVE_SMOKE_STATE_NOT_DECLARED");
        if(observedHttpStatus!=exactInteger(scenario,"expectedHttpStatus",100,599))
            throw new IllegalArgumentException("LIVE_SMOKE_HTTP_STATUS_NOT_DECLARED");
        ReferenceObservation reference=referenceOutput(jobId,authorityId,
            ((Number)authority.get("authorityRevision")).longValue(),scenario,status);
        validateExecutionObservation(executionId,idempotencyKey,idempotencyKeyHash,tenantId,
            projectId,String.valueOf(authority.get("processCode")),String.valueOf(authority.get("stepCode")),
            command,status,expectedState,scenario,reference);
        Map<String,Object> expectedOutput=expectedOutput(scenario,input,transition,executionId,
            idempotencyKey,command,reference.output());
        if(!CompositeExecutableDesignAuthorityCompiler.stable(output).equals(
                CompositeExecutableDesignAuthorityCompiler.stable(expectedOutput)))
            throw new IllegalArgumentException("LIVE_SMOKE_OUTPUT_VALUES_NOT_DECLARED");
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
            inputHash,outputHash,artifactHash,executionId,idempotencyKeyHash,observedHttpStatus,status);
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
            on conflict(job_id,authority_id,authority_revision,command_code,scenario_code,lane,status_case)
            do nothing
            """,jobId,authorityId,authority.get("authorityRevision"),authority.get("processCode"),
            authority.get("stepCode"),authority.get("routePath"),authority.get("audience"),lane,status,
            scenarioCode,authenticatedAccount,tenantId,projectId,actor,command,json(input),json(output),
            from,to,observedState,status,status,authority.get("sourceHash"),authority.get("authorityHash"),
            targetRef,json(laneEvidence),accountHash,commandHash,inputHash,outputHash,stateHash,statusHash,
            laneEvidenceHash,evidenceHash,evidenceRef,authenticatedAccount,observedAt);
        if(writes==0){
            String existing=jdbc.queryForObject("""
                select evidence_hash from integrated_design_live_smoke_evidence
                 where job_id=? and authority_id=? and authority_revision=?
                   and command_code=? and scenario_code=? and lane=? and status_case=?
                """,String.class,jobId,authorityId,authority.get("authorityRevision"),command,
                scenarioCode,lane,status);
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

    private ReferenceObservation referenceOutput(long jobId,long authorityId,long revision,
            Map<String,Object> scenario,String status){
        if(!Set.of("CONFLICT","RECOVERY").contains(status))return ReferenceObservation.EMPTY;
        Map<String,Object> trigger=object(scenario.get("trigger"),"scenario.trigger");
        String reference=required(trigger,"referenceScenarioCode",120);
        List<Map<String,Object>> rows=jdbc.queryForList("""
            select output_json::text as "output",lane_evidence::text as "laneEvidence"
              from integrated_design_live_smoke_evidence
             where job_id=? and authority_id=? and authority_revision=?
               and scenario_code=? and status_case='SUCCESS' and lane='API'
            """,jobId,authorityId,revision,reference);
        if(rows.size()!=1)throw new IllegalStateException("LIVE_SMOKE_REFERENCE_SCENARIO_REQUIRED");
        Map<String,Object> proof=jsonObject(rows.get(0).get("laneEvidence"),"reference.laneEvidence");
        return new ReferenceObservation(jsonObject(rows.get(0).get("output"),"reference.output"),
            required(proof,"executionId",36),hashText(proof.get("idempotencyKeyHash"),
                "reference.idempotencyKeyHash"));
    }

    private void validateExecutionObservation(UUID executionId,String idempotencyKey,
            String idempotencyKeyHash,String tenant,String project,String process,String step,
            String command,String status,String expectedState,Map<String,Object> scenario,
            ReferenceObservation reference){
        List<Map<String,Object>> executions=jdbc.queryForList("""
            select current_state as "currentState" from framework_process_execution
             where execution_id=? and tenant_id=? and project_id=? and process_code=?
            """,executionId,tenant,project,process);
        if(executions.size()!=1||!expectedState.equals(executions.get(0).get("currentState")))
            throw new IllegalArgumentException("LIVE_SMOKE_EXECUTION_STATE_NOT_EXACT");
        Integer events=jdbc.queryForObject("""
            select count(*) from framework_process_execution_event
             where execution_id=? and step_code=? and command_code=? and idempotency_key=?
            """,Integer.class,executionId,step,command,idempotencyKey);
        int expectedEvents=Set.of("SUCCESS","RECOVERY").contains(status)?1:0;
        if(events==null||events!=expectedEvents)
            throw new IllegalArgumentException("LIVE_SMOKE_DATABASE_EVENT_CARDINALITY_NOT_EXACT");
        if(Set.of("CONFLICT","RECOVERY").contains(status)){
            if(!executionId.toString().equalsIgnoreCase(reference.executionId()))
                throw new IllegalArgumentException("LIVE_SMOKE_REFERENCE_EXECUTION_NOT_EXACT");
            boolean sameKey=idempotencyKeyHash.equals(reference.idempotencyKeyHash());
            if(("RECOVERY".equals(status)&&!sameKey)||("CONFLICT".equals(status)&&sameKey))
                throw new IllegalArgumentException("LIVE_SMOKE_REFERENCE_IDEMPOTENCY_NOT_EXACT");
        }
    }

    private Map<String,Object> expectedOutput(Map<String,Object> scenario,Map<String,Object> input,
            Map<String,Object> transition,UUID executionId,String idempotencyKey,String command,
            Map<String,Object> reference){
        Map<String,Object> descriptors=object(scenario.get("expectedOutputValues"),
            "scenario.expectedOutputValues");
        List<String> fields=strings(scenario.get("expectedOutputFields"));
        if(!descriptors.keySet().equals(new TreeSet<>(fields)))
            throw new IllegalArgumentException("LIVE_SMOKE_EXPECTED_OUTPUT_DESCRIPTOR_NOT_EXACT");
        List<Map<String,Object>> events=jdbc.queryForList("""
            select event_id as "eventId",to_state as "toState"
              from framework_process_execution_event
             where execution_id=? and command_code=? and idempotency_key=?
            """,executionId,command,idempotencyKey);
        Map<String,Object> event=events.size()==1?events.get(0):Map.of();
        Map<String,Object> output=new LinkedHashMap<>();
        for(String field:fields){
            Map<String,Object> descriptor=object(descriptors.get(field),"expectedOutputValues."+field);
            String source=required(descriptor,"source",40);Object value;
            if("LITERAL".equals(source)){
                if(!descriptor.keySet().equals(Set.of("source","value"))||descriptor.get("value")==null)
                    throw new IllegalArgumentException("LIVE_SMOKE_LITERAL_OUTPUT_NOT_EXACT");
                value=descriptor.get("value");
            }else{
                if(!descriptor.keySet().equals(Set.of("source","path")))
                    throw new IllegalArgumentException("LIVE_SMOKE_PATH_OUTPUT_NOT_EXACT");
                String path=required(descriptor,"path",120);
                Map<String,Object> origin=switch(source){
                    case "REQUEST" -> input;
                    case "DATABASE_EVENT" -> event;
                    case "DECLARED_STATE" -> transition;
                    case "REFERENCE_SCENARIO" -> reference;
                    default -> throw new IllegalArgumentException("LIVE_SMOKE_OUTPUT_SOURCE_UNSUPPORTED");
                };
                if(!origin.containsKey(path)||origin.get(path)==null)
                    throw new IllegalArgumentException("LIVE_SMOKE_OUTPUT_SOURCE_UNRESOLVED");
                value=origin.get(path);
            }
            output.put(field,value);
        }
        return output;
    }

    private Map<String,Object> laneEvidence(String lane,Map<String,Object> details,String runId,
            String target,String inputHash,String outputHash,String artifactHash,UUID executionId,
            String idempotencyKeyHash,int observedHttpStatus,String status){
        Set<String> expected=switch(lane){
            case "DATABASE" -> Set.of("rereadHash","transactionHash");
            case "BROWSER" -> Set.of("domHash","screenshotHash","rendered",
                "runtimeObserved","accessDenied","domArtifactRef","screenshotArtifactRef");
            default -> Set.of("transportHash","httpStatus");
        };
        if(!details.keySet().equals(expected))throw new IllegalArgumentException("LIVE_SMOKE_LANE_DETAILS_NOT_EXACT");
        if("API".equals(lane)&&(!(details.get("httpStatus") instanceof Number number)
                ||number.intValue()!=observedHttpStatus))
            throw new IllegalArgumentException("LIVE_SMOKE_API_HTTP_STATUS_NOT_EXACT");
        if("BROWSER".equals(lane)&&(!Boolean.TRUE.equals(details.get("rendered"))
                ||Boolean.TRUE.equals(details.get("accessDenied"))!="FORBIDDEN".equals(status)
                ||Boolean.TRUE.equals(details.get("runtimeObserved"))=="FORBIDDEN".equals(status)))
            throw new IllegalArgumentException("LIVE_SMOKE_BROWSER_OBSERVATION_NOT_EXACT");
        Map<String,Object> verifiedDetails=new LinkedHashMap<>(details);
        if("BROWSER".equals(lane)){
            ArtifactObservation dom=verifyArtifact(evidenceRoot,
                required(details,"domArtifactRef",1000),hashText(details.get("domHash"),"laneDetails.domHash"),
                "dom.html",MAX_DOM_BYTES);
            ArtifactObservation screenshot=verifyArtifact(evidenceRoot,
                required(details,"screenshotArtifactRef",1000),
                hashText(details.get("screenshotHash"),"laneDetails.screenshotHash"),
                "screenshot.png",MAX_SCREENSHOT_BYTES);
            verifiedDetails.put("domHash",dom.hash());verifiedDetails.put("screenshotHash",screenshot.hash());
            verifiedDetails.put("domArtifactRef",dom.reference());
            verifiedDetails.put("screenshotArtifactRef",screenshot.reference());
        }
        for(Map.Entry<String,Object> entry:verifiedDetails.entrySet())if(!Set.of(
                "rendered","runtimeObserved","accessDenied","httpStatus",
                "domArtifactRef","screenshotArtifactRef").contains(entry.getKey()))
            hashText(entry.getValue(),"laneDetails."+entry.getKey());
        Map<String,Object> proof=new LinkedHashMap<>();
        proof.put("schema",SCHEMA);proof.put("source",switch(lane){
            case "API"->"API_HTTP";case "DATABASE"->"POSTGRES_REREAD";default->"BROWSER_DOM";});
        proof.put("runId",runId);proof.put("targetRef",target);proof.put("observed",true);
        proof.put("requestHash",inputHash);proof.put("responseHash",outputHash);
        proof.put("artifactHash",artifactHash);proof.put("executionId",executionId.toString());
        proof.put("idempotencyKeyHash",idempotencyKeyHash);proof.put("observedHttpStatus",observedHttpStatus);
        proof.putAll(verifiedDetails);return proof;
    }

    static ArtifactObservation verifyArtifact(Path configuredRoot,String reference,String submittedHash,
            String suffix,long maximumBytes){
        if(configuredRoot==null||reference==null||submittedHash==null
                ||!("dom.html".equals(suffix)||"screenshot.png".equals(suffix))
                ||maximumBytes<1)throw new IllegalArgumentException("LIVE_SMOKE_ARTIFACT_ARGUMENT_INVALID");
        String uuid="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
        String pattern="^[1-9][0-9]{0,18}/"+uuid+"/[0-9a-f]{64}\\."+
            suffix.replace(".","\\.")+"$";
        if(!reference.matches(pattern)||!submittedHash.matches("[0-9a-f]{64}"))
            throw new IllegalArgumentException("LIVE_SMOKE_ARTIFACT_REFERENCE_INVALID");
        Path root=configuredRoot.toAbsolutePath().normalize();
        if(!Files.isDirectory(root,LinkOption.NOFOLLOW_LINKS)||Files.isSymbolicLink(root))
            throw new IllegalStateException("LIVE_SMOKE_EVIDENCE_ROOT_NOT_IMMUTABLE");
        Path relative=Path.of(reference);
        if(relative.isAbsolute()||relative.getNameCount()!=3)
            throw new IllegalArgumentException("LIVE_SMOKE_ARTIFACT_REFERENCE_INVALID");
        Path candidate=root.resolve(relative).normalize();
        if(!candidate.startsWith(root)||candidate.equals(root))
            throw new IllegalArgumentException("LIVE_SMOKE_ARTIFACT_OUTSIDE_ALLOWLIST");
        Path cursor=root;
        for(Path component:relative){
            cursor=cursor.resolve(component);
            if(Files.isSymbolicLink(cursor))
                throw new IllegalArgumentException("LIVE_SMOKE_ARTIFACT_SYMLINK_FORBIDDEN");
        }
        try{
            Path realRoot=root.toRealPath(),realCandidate=candidate.toRealPath();
            if(!realCandidate.startsWith(realRoot)||!realCandidate.equals(candidate.toAbsolutePath().normalize()))
                throw new IllegalArgumentException("LIVE_SMOKE_ARTIFACT_SYMLINK_FORBIDDEN");
            BasicFileAttributes before=Files.readAttributes(candidate,BasicFileAttributes.class,
                LinkOption.NOFOLLOW_LINKS);
            if(!before.isRegularFile()||before.size()<1||before.size()>maximumBytes)
                throw new IllegalArgumentException("LIVE_SMOKE_ARTIFACT_FILE_INVALID");
            if(Files.getFileAttributeView(candidate,PosixFileAttributeView.class,
                    LinkOption.NOFOLLOW_LINKS)!=null){
                Set<PosixFilePermission> permissions=Files.getPosixFilePermissions(candidate,
                    LinkOption.NOFOLLOW_LINKS);
                if(permissions.contains(PosixFilePermission.OWNER_WRITE)
                        ||permissions.contains(PosixFilePermission.GROUP_WRITE)
                        ||permissions.contains(PosixFilePermission.OTHERS_WRITE))
                    throw new IllegalArgumentException("LIVE_SMOKE_ARTIFACT_WRITABLE_FORBIDDEN");
            }
            byte[] bytes;
            try(InputStream input=Files.newInputStream(candidate,StandardOpenOption.READ,LinkOption.NOFOLLOW_LINKS)){
                bytes=input.readNBytes(Math.toIntExact(maximumBytes+1));
            }
            BasicFileAttributes after=Files.readAttributes(candidate,BasicFileAttributes.class,
                LinkOption.NOFOLLOW_LINKS);
            if(bytes.length!=before.size()||bytes.length>maximumBytes||before.size()!=after.size()
                    ||!before.lastModifiedTime().equals(after.lastModifiedTime())
                    ||!Objects.equals(before.fileKey(),after.fileKey()))
                throw new IllegalArgumentException("LIVE_SMOKE_ARTIFACT_CHANGED_DURING_READ");
            String observed=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
            String filename=candidate.getFileName().toString();
            if(!observed.equals(submittedHash)||!filename.equals(observed+"."+suffix))
                throw new IllegalArgumentException("LIVE_SMOKE_ARTIFACT_HASH_MISMATCH");
            return new ArtifactObservation(reference,observed,bytes.length);
        }catch(IllegalArgumentException error){throw error;}
        catch(java.nio.file.NoSuchFileException error){
            throw new IllegalArgumentException("LIVE_SMOKE_ARTIFACT_MISSING");
        }catch(Exception error){
            throw new IllegalArgumentException("LIVE_SMOKE_ARTIFACT_READ_FAILED");
        }
    }

    record ArtifactObservation(String reference,String hash,long byteCount){}

    private String target(String lane,Map<String,Object> authority,Map<String,Object> design,
            Map<String,Object> operation){
        if("API".equals(lane))return operation.get("method")+" "+operation.get("path");
        if("BROWSER".equals(lane))return String.valueOf(authority.get("routePath"));
        return "entity:framework_process_execution";
    }

    private record ReferenceObservation(Map<String,Object> output,String executionId,
        String idempotencyKeyHash){
        private static final ReferenceObservation EMPTY=new ReferenceObservation(Map.of(),"","");
    }

    private String hash(Object value){return jdbc.queryForObject(
        "select framework_composite_live_smoke_hash(?::jsonb)",String.class,json(value));}
    private String json(Object value){try{return mapper.writeValueAsString(value);}
        catch(Exception error){throw new IllegalArgumentException("LIVE_SMOKE_JSON_INVALID",error);}}
    @SuppressWarnings("unchecked") private Map<String,Object> jsonObject(Object raw,String key){
        try{return mapper.readValue(String.valueOf(raw),LinkedHashMap.class);}
        catch(Exception error){throw new IllegalArgumentException("LIVE_SMOKE_"+key+"_INVALID",error);}}
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
    private static int exactInteger(Map<String,Object> value,String key,int min,int max){
        Object raw=value.get(key);if(!(raw instanceof Number))
            throw new IllegalArgumentException("LIVE_SMOKE_"+key+"_INVALID");
        try{int exact=new BigDecimal(String.valueOf(raw)).intValueExact();
            if(exact<min||exact>max)throw new ArithmeticException();return exact;
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
