package egovframework.com.platform.governance.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.StringReader;
import java.nio.ByteBuffer;
import java.nio.channels.SeekableByteChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.SecureDirectoryStream;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.BasicFileAttributeView;
import java.nio.file.attribute.BasicFileAttributes;
import java.nio.file.attribute.PosixFileAttributeView;
import java.nio.file.attribute.PosixFilePermission;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.HexFormat;
import java.util.HashSet;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import javax.swing.text.MutableAttributeSet;
import javax.swing.text.html.HTML;
import javax.swing.text.html.HTMLEditorKit;
import javax.swing.text.html.parser.ParserDelegator;

/** Authenticated append-only ingestion for real API, database and browser smoke observations. */
@Service
public class CompositeLiveSmokeEvidenceService {
    private static final String SCHEMA="carbonet.composite-live-smoke-lane/v1";
    private static final Set<String> LANES=Set.of("API","DATABASE","BROWSER");
    private static final Set<String> STATUSES=Set.of(
        "SUCCESS","VALIDATION_ERROR","FORBIDDEN","CONFLICT","RECOVERY");
    static final String DEFAULT_EVIDENCE_ROOT=
        "/opt/resonance-data/control-plane/var/test-evidence/composite-live-smoke";
    static final long MAX_DOM_BYTES=4L*1024*1024;
    static final long MAX_SCREENSHOT_BYTES=20L*1024*1024;
    private static final int WATERMARK_COLUMNS=32,WATERMARK_CELL=4;
    private static final int WATERMARK_ZERO=0x052b57,WATERMARK_ONE=0x246beb;
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
        long dispatchId=positiveLong(request,"dispatchId"),jobId=positiveLong(request,"jobId");
        UUID leaseToken=exactUuid(request,"leaseToken");
        long authorityId=positiveLong(request,"authorityId");
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
        String runId=exactUuid(request,"runId").toString();
        String artifactHash=hashText(request.get("artifactHash"),"artifactHash");
        String observedAt=OffsetDateTime.parse(required(request,"observedAt",60)).toString();
        Map<String,Object> authority=currentAuthority(dispatchId,jobId,authorityId,leaseToken,observedAt);
        if(!Boolean.TRUE.equals(authority.get("temporalExact")))
            throw new IllegalArgumentException("LIVE_SMOKE_OBSERVED_AFTER_DEPLOY_REQUIRED");
        String scopeType=String.valueOf(authority.get("scopeType"));
        String boundProject=String.valueOf(authority.get("boundProjectId"));
        String dispatchProject=String.valueOf(authority.get("dispatchProjectId"));
        if(("PROJECT".equals(scopeType)&&!projectId.equals(boundProject))
                ||!("*".equals(dispatchProject)||projectId.equals(dispatchProject))
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
        long authorityRevision=((Number)authority.get("authorityRevision")).longValue();
        String expectedRunId=deterministicRunId(dispatchId,authorityId,authorityRevision,command,
            scenarioCode,status);
        if(!expectedRunId.equals(runId))
            throw new IllegalArgumentException("LIVE_SMOKE_RUN_DISPATCH_BINDING_NOT_EXACT");
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
        ReferenceObservation reference=referenceOutput(dispatchId,jobId,authorityId,
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
        BrowserArtifactContext browserContext=new BrowserArtifactContext(runId,
            String.valueOf(authority.get("processCode")),String.valueOf(authority.get("stepCode")),
            String.valueOf(authority.get("routePath")),String.valueOf(authority.get("audience")),
            tenantId,projectId,executionId.toString(),observedState);
        Map<String,Object> laneEvidence=laneEvidence(lane,laneDetails,dispatchId,runId,targetRef,
            inputHash,outputHash,artifactHash,executionId,idempotencyKey,idempotencyKeyHash,
            observedHttpStatus,status,command,output,browserContext);
        String laneEvidenceHash=hash(laneEvidence);
        String evidenceRef="live:"+runId+";lane:"+lane+";artifact:"+artifactHash;
        Map<String,Object> envelope=new LinkedHashMap<>();
        envelope.put("schema","carbonet.composite-live-smoke-evidence/v1");
        envelope.put("dispatchId",dispatchId);envelope.put("jobId",jobId);
        envelope.put("authorityId",authorityId);
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
              dispatch_id,job_id,authority_id,authority_revision,process_code,step_code,route_path,audience,
              lane,status_case,scenario_code,account_id,tenant_id,project_id,actor_code,command_code,
              input_json,output_json,from_state,to_state,observed_state,expected_status,observed_status,
              source_hash,authority_hash,target_ref,lane_evidence,account_hash,command_hash,input_hash,
              output_hash,state_hash,status_hash,lane_evidence_hash,evidence_hash,evidence_ref,
              recorded_by,observed_at)
            values(
              ?,?,?,?,?,?,?,?,
              ?,?,?,?,?,?,?,?,
              ?::jsonb,?::jsonb,?,?,?,?,?,
              ?,?,?,?::jsonb,?,?,?,
              ?,?,?,?,?,?,?,
              ?::timestamptz)
            on conflict(dispatch_id,authority_id,authority_revision,command_code,scenario_code,lane,status_case)
            do nothing
            """,dispatchId,jobId,authorityId,authority.get("authorityRevision"),authority.get("processCode"),
            authority.get("stepCode"),authority.get("routePath"),authority.get("audience"),lane,status,
            scenarioCode,authenticatedAccount,tenantId,projectId,actor,command,json(input),json(output),
            from,to,observedState,status,status,authority.get("sourceHash"),authority.get("authorityHash"),
            targetRef,json(laneEvidence),accountHash,commandHash,inputHash,outputHash,stateHash,statusHash,
            laneEvidenceHash,evidenceHash,evidenceRef,authenticatedAccount,observedAt);
        if(writes==0){
            String existing=jdbc.queryForObject("""
                select evidence_hash from integrated_design_live_smoke_evidence
                 where dispatch_id=? and authority_id=? and authority_revision=?
                   and command_code=? and scenario_code=? and lane=? and status_case=?
                """,String.class,dispatchId,authorityId,authority.get("authorityRevision"),command,
                scenarioCode,lane,status);
            if(!evidenceHash.equals(existing))throw new IllegalStateException(
                "LIVE_SMOKE_EVIDENCE_CONFLICT_REQUIRES_NEW_JOB");
        }
        return Map.of("success",true,"status","TEST_EVIDENCE_RECORDED","writeCount",writes,
            "jobId",jobId,"authorityId",authorityId,"lane",lane,"statusCase",status,
            "scenarioCode",scenarioCode,"evidenceHash",evidenceHash);
    }

    private Map<String,Object> currentAuthority(long dispatchId,long jobId,long authorityId,
            UUID leaseToken,String observedAt){
        List<Map<String,Object>> rows=jdbc.queryForList("""
            select authority.authority_revision as "authorityRevision",
                   authority.process_code as "processCode",authority.step_code as "stepCode",
                   authority.route_path as "routePath",authority.audience as "audience",
                   authority.source_hash as "sourceHash",authority.authority_hash as "authorityHash",
                   authority.composite_json->'executableDesign' as "executableDesign",
                   binding.scope_type as "scopeType",binding.project_id as "boundProjectId",
                   framework_try_jsonb(job.result_json)#>>
                     '{canonicalGeneration,compositeArtifactManifestHash}' as "artifactHash",
                   dispatch.dispatch_id as "dispatchId",dispatch.project_id as "dispatchProjectId",
                   (?::timestamptz>=dispatch.started_at and
                     ?::timestamptz<=clock_timestamp()) as "temporalExact"
              from integrated_design_authority authority
              join framework_development_job job on job.job_id=authority.job_id
              join integrated_design_live_smoke_dispatch dispatch
                on dispatch.dispatch_id=? and dispatch.job_id=job.job_id
               and dispatch.process_code=authority.process_code
               and dispatch.process_source_hash=authority.source_hash
               and dispatch.authority_revision_set_hash=
                   framework_composite_authority_revision_set_hash(job.job_id)
               and dispatch.artifact_manifest_hash=framework_try_jsonb(job.result_json)#>>
                   '{canonicalGeneration,compositeArtifactManifestHash}'
               and dispatch.status='RUNNING' and dispatch.lease_token=?
               and dispatch.lease_until>=clock_timestamp()
              join framework_runtime_release_state runtime
                on runtime.release_key='CARBONET_RUNTIME' and runtime.health_status='UP'
               and runtime.source_commit=dispatch.runtime_commit
               and dispatch.runtime_identity_hash=encode(sha256(convert_to(concat_ws('|',
                 runtime.source_commit,runtime.deployment_namespace,runtime.deployment_name,
                 runtime.deployment_uid,runtime.deployment_generation,
                 runtime.observed_generation,runtime.desired_replicas,
                 runtime.image_ref,runtime.image_id,runtime.health_status
               ),'UTF8')),'hex')
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
               and receipt.dependency_fingerprint=
                   framework_composite_dependency_fingerprint(receipt.process_code)
               and receipt.receipt_json->>'liveSmokeDispatchId'=dispatch.dispatch_id::text
               and job.job_type='FULL_STACK_GENERATION'
               and job.job_group_code=authority.process_code||'_CANONICAL_PUBLICATION'
               and job.job_status in('VERIFIED','COMPLETED') and job.quality_status='VERIFIED'
               and dispatch.started_at is not null and job.completed_at is not null
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
             for share of runtime,dispatch,receipt,job,authority
            """,observedAt,observedAt,dispatchId,leaseToken,authorityId,jobId);
        if(rows.size()!=1)throw new IllegalStateException("LIVE_SMOKE_CURRENT_JOB_AUTHORITY_REQUIRED");
        Map<String,Object> row=new LinkedHashMap<>(rows.get(0));
        if(!Set.of("GLOBAL","PROJECT").contains(String.valueOf(row.get("scopeType")))
                ||("PROJECT".equals(row.get("scopeType"))
                    &&!String.valueOf(row.get("boundProjectId"))
                        .matches("^[A-Z][A-Z0-9_-]{2,63}$"))
                ||((Number)row.get("dispatchId")).longValue()!=dispatchId
                ||!String.valueOf(row.get("dispatchProjectId")).matches("^[A-Z*][A-Z0-9_*\\-]{0,99}$")
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

    private ReferenceObservation referenceOutput(long dispatchId,long jobId,long authorityId,long revision,
            Map<String,Object> scenario,String status){
        if(!Set.of("CONFLICT","RECOVERY").contains(status))return ReferenceObservation.EMPTY;
        Map<String,Object> trigger=object(scenario.get("trigger"),"scenario.trigger");
        String reference=required(trigger,"referenceScenarioCode",120);
        List<Map<String,Object>> rows=jdbc.queryForList("""
            select output_json::text as "output",lane_evidence::text as "laneEvidence"
              from integrated_design_live_smoke_evidence
             where dispatch_id=? and job_id=? and authority_id=? and authority_revision=?
               and scenario_code=? and status_case='SUCCESS' and lane='API'
            """,dispatchId,jobId,authorityId,revision,reference);
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

    private Map<String,Object> laneEvidence(String lane,Map<String,Object> details,long dispatchId,
            String runId,String target,String inputHash,String outputHash,String artifactHash,
            UUID executionId,String idempotencyKey,String idempotencyKeyHash,int observedHttpStatus,
            String status,String command,Map<String,Object> output,BrowserArtifactContext browserContext){
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
                "dom.html",MAX_DOM_BYTES,dispatchId,runId);
            ArtifactObservation screenshot=verifyArtifact(evidenceRoot,
                required(details,"screenshotArtifactRef",1000),
                hashText(details.get("screenshotHash"),"laneDetails.screenshotHash"),
                "screenshot.png",MAX_SCREENSHOT_BYTES,dispatchId,runId);
            verifyDomArtifact(dom,command,status,output,idempotencyKey,observedHttpStatus,browserContext);
            verifyPngArtifact(screenshot,runId);
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
            String suffix,long maximumBytes,long expectedDispatchId,String expectedRunId){
        return verifyArtifact(configuredRoot,reference,submittedHash,suffix,maximumBytes,
            expectedDispatchId,expectedRunId,null);
    }

    static ArtifactObservation verifyArtifact(Path configuredRoot,String reference,String submittedHash,
            String suffix,long maximumBytes,long expectedDispatchId,String expectedRunId,
            ArtifactReadMutation mutation){
        if(configuredRoot==null||reference==null||submittedHash==null
                ||!("dom.html".equals(suffix)||"screenshot.png".equals(suffix))
                ||maximumBytes<1||expectedDispatchId<1||expectedRunId==null)
            throw new IllegalArgumentException("LIVE_SMOKE_ARTIFACT_ARGUMENT_INVALID");
        String uuid="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
        String pattern="^"+expectedDispatchId+"/"+uuid+"/[0-9a-f]{64}\\."+
            suffix.replace(".","\\.")+"$";
        if(!reference.matches(pattern)||!submittedHash.matches("[0-9a-f]{64}")
                ||!reference.split("/",-1)[1].equals(expectedRunId)
                ||!expectedRunId.matches(uuid))
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
            byte[] bytes;
            try(PinnedArtifact pinned=openPinnedArtifact(root,relative)){
                BasicFileAttributes secureBefore=pinned.attributes();
                if(!sameFileAttributes(before,secureBefore)||secureBefore.fileKey()==null)
                    throw new IllegalArgumentException("LIVE_SMOKE_ARTIFACT_CHANGED_DURING_OPEN");
                Set<PosixFilePermission> permissions=pinned.permissions();
                if(permissions.contains(PosixFilePermission.OWNER_WRITE)
                        ||permissions.contains(PosixFilePermission.GROUP_WRITE)
                        ||permissions.contains(PosixFilePermission.OTHERS_WRITE))
                    throw new IllegalArgumentException("LIVE_SMOKE_ARTIFACT_WRITABLE_FORBIDDEN");
                SeekableByteChannel channel=pinned.channel();
                long openedSize=channel.size();
                if(openedSize<1||openedSize>maximumBytes)
                    throw new IllegalArgumentException("LIVE_SMOKE_ARTIFACT_FILE_INVALID");
                if(mutation!=null)mutation.run();
                BasicFileAttributes openedPath=pinned.attributes();
                if(!sameFileAttributes(secureBefore,openedPath))
                    throw new IllegalArgumentException("LIVE_SMOKE_ARTIFACT_CHANGED_DURING_OPEN");
                ByteBuffer content=ByteBuffer.allocate(Math.toIntExact(openedSize));
                while(content.hasRemaining()&&channel.read(content)>=0){}
                if(content.hasRemaining()||channel.size()!=openedSize)
                    throw new IllegalArgumentException("LIVE_SMOKE_ARTIFACT_CHANGED_DURING_READ");
                bytes=content.array();
                BasicFileAttributes secureAfter=pinned.attributes();
                if(!sameFileAttributes(secureBefore,secureAfter))
                    throw new IllegalArgumentException("LIVE_SMOKE_ARTIFACT_CHANGED_DURING_READ");
            }
            BasicFileAttributes after=Files.readAttributes(candidate,BasicFileAttributes.class,
                LinkOption.NOFOLLOW_LINKS);
            if(bytes.length!=before.size()||bytes.length>maximumBytes
                    ||!sameFileAttributes(before,after))
                throw new IllegalArgumentException("LIVE_SMOKE_ARTIFACT_CHANGED_DURING_READ");
            String observed=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
            String filename=candidate.getFileName().toString();
            if(!observed.equals(submittedHash)||!filename.equals(observed+"."+suffix))
                throw new IllegalArgumentException("LIVE_SMOKE_ARTIFACT_HASH_MISMATCH");
            Path finalRealCandidate=candidate.toRealPath();
            if(!finalRealCandidate.equals(realCandidate)||Files.isSymbolicLink(candidate))
                throw new IllegalArgumentException("LIVE_SMOKE_ARTIFACT_CHANGED_DURING_READ");
            return new ArtifactObservation(reference,observed,bytes.length,bytes);
        }catch(IllegalArgumentException error){throw error;}
        catch(java.nio.file.NoSuchFileException error){
            throw new IllegalArgumentException("LIVE_SMOKE_ARTIFACT_MISSING");
        }catch(Exception error){
            throw new IllegalArgumentException("LIVE_SMOKE_ARTIFACT_READ_FAILED");
        }
    }

    @FunctionalInterface
    interface ArtifactReadMutation{void run()throws Exception;}

    static boolean secureArtifactReadsAvailable(Path root)throws Exception{
        try(DirectoryStream<Path> stream=Files.newDirectoryStream(root)){
            return stream instanceof SecureDirectoryStream<?>;
        }
    }

    private static PinnedArtifact openPinnedArtifact(Path root,Path relative)throws Exception{
        DirectoryStream<Path> rootStream=Files.newDirectoryStream(root);
        if(!(rootStream instanceof SecureDirectoryStream<Path> secureRoot)){
            rootStream.close();
            throw new IllegalArgumentException("LIVE_SMOKE_SECURE_DIRECTORY_STREAM_REQUIRED");
        }
        SecureDirectoryStream<Path> current=secureRoot;
        List<SecureDirectoryStream<Path>> opened=new ArrayList<>();opened.add(secureRoot);
        try{
            for(int index=0;index<relative.getNameCount()-1;index++){
                SecureDirectoryStream<Path> next=current.newDirectoryStream(relative.getName(index),
                    LinkOption.NOFOLLOW_LINKS);
                opened.add(next);current=next;
            }
            SeekableByteChannel channel=current.newByteChannel(
                relative.getName(relative.getNameCount()-1),
                Set.of(StandardOpenOption.READ,LinkOption.NOFOLLOW_LINKS));
            return new PinnedArtifact(channel,current,relative.getFileName(),opened);
        }catch(Exception error){
            for(int index=opened.size()-1;index>=0;index--)try{opened.get(index).close();}
            catch(Exception ignored){}
            throw error;
        }
    }

    private static boolean sameFileAttributes(BasicFileAttributes left,BasicFileAttributes right){
        return left.isRegularFile()==right.isRegularFile()&&left.size()==right.size()
            &&left.lastModifiedTime().equals(right.lastModifiedTime())
            &&left.fileKey()!=null&&left.fileKey().equals(right.fileKey());
    }

    private static final class PinnedArtifact implements AutoCloseable{
        private final SeekableByteChannel channel;
        private final SecureDirectoryStream<Path> parent;
        private final Path name;
        private final List<SecureDirectoryStream<Path>> directories;
        private PinnedArtifact(SeekableByteChannel channel,SecureDirectoryStream<Path> parent,Path name,
                List<SecureDirectoryStream<Path>> directories){
            this.channel=channel;this.parent=parent;this.name=name;this.directories=directories;
        }
        private SeekableByteChannel channel(){return channel;}
        private BasicFileAttributes attributes()throws java.io.IOException{
            BasicFileAttributeView view=parent.getFileAttributeView(name,BasicFileAttributeView.class,
                LinkOption.NOFOLLOW_LINKS);
            if(view==null)throw new java.io.IOException("secure basic attributes unavailable");
            return view.readAttributes();
        }
        private Set<PosixFilePermission> permissions()throws java.io.IOException{
            PosixFileAttributeView view=parent.getFileAttributeView(name,PosixFileAttributeView.class,
                LinkOption.NOFOLLOW_LINKS);
            if(view==null)throw new java.io.IOException("secure posix attributes unavailable");
            return view.readAttributes().permissions();
        }
        @Override public void close()throws java.io.IOException{
            java.io.IOException failure=null;
            try{channel.close();}catch(java.io.IOException error){failure=error;}
            for(int index=directories.size()-1;index>=0;index--)try{directories.get(index).close();}
            catch(java.io.IOException error){if(failure==null)failure=error;else failure.addSuppressed(error);}
            if(failure!=null)throw failure;
        }
    }

    static DomObservation verifyDomArtifact(ArtifactObservation artifact,String command,String status,
            Map<String,Object> output,String idempotencyKey,int observedHttpStatus,
            BrowserArtifactContext context){
        String html=new String(artifact.bytes(),StandardCharsets.UTF_8);
        List<Map<String,String>> observations=new ArrayList<>();int[] resultMarkers={0};
        List<String> watermarkCells=new ArrayList<>();
        int[] commandMarkers={0},watermarkMarkers={0};
        try{
            new ParserDelegator().parse(new StringReader(html),new HTMLEditorKit.ParserCallback(){
                private void inspect(MutableAttributeSet attributes){
                    Map<String,String> values=new LinkedHashMap<>();
                    Enumeration<?> names=attributes.getAttributeNames();
                    while(names.hasMoreElements()){
                        Object name=names.nextElement();Object value=attributes.getAttribute(name);
                        values.put(String.valueOf(name).toLowerCase(),String.valueOf(value));
                    }
                    if(values.containsKey("data-last-command-code"))observations.add(values);
                    if("true".equals(values.get("data-live-smoke-result")))resultMarkers[0]++;
                    if(command.equals(values.get("data-command-code")))commandMarkers[0]++;
                    if(values.containsKey("data-live-smoke-watermark")){
                        watermarkMarkers[0]++;
                        if(!context.runId().equals(values.get("data-live-smoke-watermark")))
                            throw new IllegalArgumentException("LIVE_SMOKE_DOM_WATERMARK_NOT_EXACT");
                    }
                    if(values.containsKey("data-watermark-bit"))
                        watermarkCells.add(values.get("data-watermark-bit"));
                }
                @Override public void handleStartTag(HTML.Tag tag,MutableAttributeSet attributes,int position){inspect(attributes);}
                @Override public void handleSimpleTag(HTML.Tag tag,MutableAttributeSet attributes,int position){inspect(attributes);}
            },true);
        }catch(Exception error){throw new IllegalArgumentException("LIVE_SMOKE_DOM_PARSE_FAILED");}
        if(observations.size()!=1||resultMarkers[0]!=1||commandMarkers[0]!=1
                ||watermarkMarkers[0]!=1||watermarkCells.size()!=128)
            throw new IllegalArgumentException("LIVE_SMOKE_DOM_MARKER_CARDINALITY_NOT_EXACT");
        int[] expectedWatermark=watermarkBits(context.runId());
        for(int index=0;index<expectedWatermark.length;index++)
            if(!String.valueOf(expectedWatermark[index]).equals(watermarkCells.get(index)))
                throw new IllegalArgumentException("LIVE_SMOKE_DOM_WATERMARK_NOT_EXACT");
        Map<String,String> marker=observations.get(0);
        boolean denied="FORBIDDEN".equals(status);
        if(!command.equals(marker.get("data-last-command-code"))
                ||!status.equals(marker.get("data-last-status-case"))
                ||!String.valueOf(observedHttpStatus).equals(marker.get("data-last-http-status"))
                ||(idempotencyKey!=null&&!idempotencyKey.equals(marker.get("data-last-idempotency-key")))
                ||!String.valueOf(!denied).equals(marker.get("data-runtime-observed"))
                ||!String.valueOf(denied).equals(marker.get("data-access-denied"))
                ||!context.runId().equals(marker.get("data-live-smoke-run-id"))
                ||!context.processCode().equals(marker.get("data-process-code"))
                ||!context.stepCode().equals(marker.get("data-step-code"))
                ||!context.routePath().equals(marker.get("data-route-path"))
                ||!context.audience().equals(marker.get("data-audience"))
                ||!context.tenantId().equals(marker.get("data-tenant-id"))
                ||!context.projectId().equals(marker.get("data-project-id"))
                ||!context.executionId().equalsIgnoreCase(marker.get("data-execution-id"))
                ||!context.currentState().equals(marker.get("data-current-state")))
            throw new IllegalArgumentException("LIVE_SMOKE_DOM_RUNTIME_MARKER_NOT_EXACT");
        try{
            String outputJson=marker.get("data-last-output-json");
            if(outputJson==null||outputJson.isBlank()||outputJson.length()>MAX_DOM_BYTES)
                throw new IllegalArgumentException("LIVE_SMOKE_DOM_OUTPUT_INVALID");
            Map<String,Object> domOutput=object(new ObjectMapper().readValue(outputJson,Map.class),
                "dom.output");
            if(!CompositeExecutableDesignAuthorityCompiler.stable(domOutput).equals(
                    CompositeExecutableDesignAuthorityCompiler.stable(output)))
                throw new IllegalArgumentException("LIVE_SMOKE_DOM_OUTPUT_NOT_EXACT");
            String observedIdempotency=marker.get("data-last-idempotency-key");
            if(observedIdempotency==null||observedIdempotency.isBlank()||observedIdempotency.length()>200)
                throw new IllegalArgumentException("LIVE_SMOKE_DOM_IDEMPOTENCY_INVALID");
            return new DomObservation(observedIdempotency,domOutput);
        }catch(IllegalArgumentException error){throw error;}
        catch(Exception error){throw new IllegalArgumentException("LIVE_SMOKE_DOM_OUTPUT_INVALID");}
    }

    static void verifyPngArtifact(ArtifactObservation artifact,String expectedRunId){
        byte[] bytes=artifact.bytes();byte[] signature={(byte)0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a};
        if(bytes.length<256||!Arrays.equals(signature,Arrays.copyOf(bytes,signature.length)))
            throw new IllegalArgumentException("LIVE_SMOKE_SCREENSHOT_PNG_SIGNATURE_INVALID");
        try(ImageInputStream input=ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))){
            if(input==null)throw new IllegalArgumentException("LIVE_SMOKE_SCREENSHOT_PNG_DECODE_INVALID");
            var readers=ImageIO.getImageReaders(input);
            if(!readers.hasNext())throw new IllegalArgumentException("LIVE_SMOKE_SCREENSHOT_PNG_DECODE_INVALID");
            ImageReader reader=readers.next();
            try{
                if(!"png".equalsIgnoreCase(reader.getFormatName()))
                    throw new IllegalArgumentException("LIVE_SMOKE_SCREENSHOT_PNG_FORMAT_INVALID");
                reader.setInput(input,true,true);int width=reader.getWidth(0),height=reader.getHeight(0);
                long pixels=(long)width*height;
                if(width<64||height<64||width>20_000||height>20_000||pixels>50_000_000L)
                    throw new IllegalArgumentException("LIVE_SMOKE_SCREENSHOT_DIMENSIONS_INVALID");
                BufferedImage image=reader.read(0);Set<Integer> colors=new HashSet<>();
                int xStep=Math.max(1,width/32),yStep=Math.max(1,height/32);
                for(int y=0;y<height&&colors.size()<2;y+=yStep)
                    for(int x=0;x<width&&colors.size()<2;x+=xStep)colors.add(image.getRGB(x,y));
                if(colors.size()<2)throw new IllegalArgumentException("LIVE_SMOKE_SCREENSHOT_CONTENT_TRIVIAL");
                if(!watermarkMatches(image,expectedRunId))
                    throw new IllegalArgumentException("LIVE_SMOKE_SCREENSHOT_WATERMARK_NOT_EXACT");
            }finally{reader.dispose();}
        }catch(IllegalArgumentException error){throw error;}
        catch(Exception error){throw new IllegalArgumentException("LIVE_SMOKE_SCREENSHOT_PNG_DECODE_INVALID");}
    }

    private static boolean watermarkMatches(BufferedImage image,String runId){
        int[] bits=watermarkBits(runId);
        for(int scale=1;scale<=4;scale++){
            if(image.getWidth()<WATERMARK_COLUMNS*WATERMARK_CELL*scale
                    ||image.getHeight()<4*WATERMARK_CELL*scale)continue;
            boolean exact=true;
            for(int index=0;index<bits.length&&exact;index++){
                int x=(index%WATERMARK_COLUMNS)*WATERMARK_CELL*scale+2*scale;
                int y=(index/WATERMARK_COLUMNS)*WATERMARK_CELL*scale+2*scale;
                int expected=bits[index]==1?WATERMARK_ONE:WATERMARK_ZERO;
                exact=colorNear(image.getRGB(x,y)&0x00ffffff,expected);
            }
            if(exact)return true;
        }
        return false;
    }

    private static boolean colorNear(int observed,int expected){
        return Math.abs(((observed>>16)&255)-((expected>>16)&255))<=6
            &&Math.abs(((observed>>8)&255)-((expected>>8)&255))<=6
            &&Math.abs((observed&255)-(expected&255))<=6;
    }

    static int[] watermarkBits(String runId){
        String hex=runId==null?"":runId.replace("-","").toLowerCase();
        if(!hex.matches("[0-9a-f]{32}"))
            throw new IllegalArgumentException("LIVE_SMOKE_WATERMARK_RUN_ID_INVALID");
        int[] bits=new int[128];int index=0;
        for(char value:hex.toCharArray()){
            int nibble=Character.digit(value,16);
            for(int shift=3;shift>=0;shift--)bits[index++]=(nibble>>shift)&1;
        }
        return bits;
    }

    static String deterministicRunId(long dispatchId,long authorityId,long revision,
            String command,String scenario,String status){
        String seed=dispatchId+"|"+authorityId+"|"+revision+"|"+command+"|"+scenario+"|"+status+"|RUN";
        try{
            byte[] bytes=Arrays.copyOf(MessageDigest.getInstance("SHA-256").digest(
                seed.getBytes(StandardCharsets.UTF_8)),16);
            bytes[6]=(byte)((bytes[6]&0x0f)|0x40);bytes[8]=(byte)((bytes[8]&0x3f)|0x80);
            String hex=HexFormat.of().formatHex(bytes);
            return hex.substring(0,8)+"-"+hex.substring(8,12)+"-"+hex.substring(12,16)+"-"+
                hex.substring(16,20)+"-"+hex.substring(20);
        }catch(Exception error){throw new IllegalStateException("LIVE_SMOKE_RUN_ID_HASH_FAILED",error);}
    }

    record ArtifactObservation(String reference,String hash,long byteCount,byte[] bytes){
        ArtifactObservation{bytes=bytes.clone();}
        @Override public byte[] bytes(){return bytes.clone();}
    }
    record BrowserArtifactContext(String runId,String processCode,String stepCode,String routePath,
            String audience,String tenantId,String projectId,String executionId,String currentState){}
    record DomObservation(String idempotencyKey,Map<String,Object> output){}

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
    private static UUID exactUuid(Map<String,Object> value,String key){
        String text=required(value,key,36);
        if(!text.matches("[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"))
            throw new IllegalArgumentException("LIVE_SMOKE_"+key+"_INVALID");
        UUID parsed=UUID.fromString(text);
        if(!parsed.toString().equals(text))throw new IllegalArgumentException("LIVE_SMOKE_"+key+"_INVALID");
        return parsed;
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
