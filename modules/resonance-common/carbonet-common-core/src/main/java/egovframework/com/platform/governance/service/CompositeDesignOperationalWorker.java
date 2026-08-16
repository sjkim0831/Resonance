package egovframework.com.platform.governance.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Bounded operational harness for the strict composite compiler. It never edits
 * protected documents: each process either commits all SOURCE/codegen bindings
 * or records one blocker after the transaction rolls back.
 */
@Service
public class CompositeDesignOperationalWorker {
    private static final String SYSTEM_ACTOR="COMPOSITE_AUTOCOMPLETION";
    private static final long GLOBAL_DISPATCH_ADVISORY_KEY=0x434f4d504155544fL;
    private static final long GLOBAL_SOURCE_SLOT_BASE=0x434f4d50534c4f50L;
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final ActorProcessGovernanceService governance;
    private final CompositeAutocompletionReadinessService readiness;
    private final TransactionTemplate requiresNew;
    private final ExecutorService workers;
    private final ScheduledExecutorService leaseHeartbeats;
    private final AtomicInteger running=new AtomicInteger();
    private final Object dispatchMonitor=new Object();
    private int manualDrainRemaining;
    private String manualRunToken="";
    private final boolean capabilityEnabled;
    private final int parallelism;
    private final int defaultLimit;
    private final boolean notificationEnabled;
    private final int leaseSeconds;
    private final int heartbeatSeconds;

    @Autowired
    public CompositeDesignOperationalWorker(JdbcTemplate jdbc,ObjectMapper mapper,
            ActorProcessGovernanceService governance,
            CompositeAutocompletionReadinessService readiness,
            PlatformTransactionManager transactionManager,
            @Value("${resonance.composite-autocompletion.capability-enabled:${resonance.composite-autocompletion.enabled:false}}")
                boolean capabilityEnabled,
            @Value("${resonance.composite-autocompletion.parallelism:8}") int parallelism,
            @Value("${resonance.composite-autocompletion.batch-limit:25}") int defaultLimit,
            @Value("${resonance.composite-notification.enabled:true}") boolean notificationEnabled,
            @Value("${resonance.composite-autocompletion.lease-seconds:600}") int leaseSeconds,
            @Value("${resonance.composite-autocompletion.heartbeat-seconds:30}") int heartbeatSeconds){
        this.jdbc=jdbc;this.mapper=mapper;this.governance=governance;this.readiness=readiness;
        this.capabilityEnabled=capabilityEnabled;
        this.notificationEnabled=notificationEnabled;
        this.parallelism=Math.max(1,Math.min(parallelism,8));
        this.leaseSeconds=Math.max(30,Math.min(leaseSeconds,3600));
        this.heartbeatSeconds=Math.max(5,Math.min(heartbeatSeconds,
            Math.max(5,this.leaseSeconds/3)));
        this.defaultLimit=Math.max(1,Math.min(defaultLimit,25));
        this.workers=Executors.newFixedThreadPool(this.parallelism,runnable->{
            Thread thread=new Thread(runnable,"composite-design-autocompletion");
            thread.setDaemon(true);return thread;});
        this.leaseHeartbeats=Executors.newSingleThreadScheduledExecutor(runnable->{
            Thread thread=new Thread(runnable,"composite-design-lease-heartbeat");
            thread.setDaemon(true);return thread;});
        this.requiresNew=new TransactionTemplate(transactionManager);
        this.requiresNew.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public CompositeDesignOperationalWorker(JdbcTemplate jdbc,ObjectMapper mapper,
            ActorProcessGovernanceService governance,PlatformTransactionManager transactionManager,
            boolean enabled,int parallelism,int defaultLimit,boolean notificationEnabled){
        this(jdbc,mapper,governance,new CompositeAutocompletionReadinessService(jdbc,governance,
            transactionManager,parallelism,parallelism,1,"","",""),transactionManager,enabled,
            parallelism,defaultLimit,notificationEnabled,600,30);
    }

    public CompositeDesignOperationalWorker(JdbcTemplate jdbc,ObjectMapper mapper,
            ActorProcessGovernanceService governance,PlatformTransactionManager transactionManager,
            boolean enabled,int parallelism,int defaultLimit,boolean notificationEnabled,
            int physicalParallelism,int configuredReplicas){
        this(jdbc,mapper,governance,new CompositeAutocompletionReadinessService(jdbc,governance,
            transactionManager,parallelism,physicalParallelism,configuredReplicas,"","",""),
            transactionManager,enabled,parallelism,defaultLimit,notificationEnabled,600,30);
    }

    @Scheduled(fixedDelayString="${resonance.composite-autocompletion.delay-ms:1000}",
        initialDelayString="${resonance.composite-autocompletion.initial-delay-ms:30000}")
    public void runScheduledBatch(){
        reconcilePhysicalCompletion();
        if(capabilityEnabled){
            CompositeAutocompletionReadinessService.Snapshot snapshot=readiness.snapshot(true,running.get());
            Map<String,Object> report=snapshot.report();
            if("ACTIVE".equals(report.get("gateStatus"))
                    &&!String.valueOf(report.get("gateSourceInputAuthorityHash"))
                        .equals(String.valueOf(report.get("currentAuthoritySetHash")))){
                // Enter the same serialized claim transaction with budget zero.
                // Only the exact H0 drift CAS inside that transaction may revoke.
                dispatchAvailable(0,false,"",null,snapshot);return;
            }
            if(Boolean.TRUE.equals(report.get("automaticEnablementAllowed")))
                dispatchAvailable(defaultLimit,false,"",null,snapshot);
        }
    }

    @Scheduled(fixedDelayString="${resonance.composite-notification.delay-ms:1000}",
        initialDelayString="${resonance.composite-notification.initial-delay-ms:3000}")
    public void deliverNotifications(){
        if(notificationEnabled)requiresNew.execute(status->jdbc.queryForMap(
            "select * from deliver_integrated_design_notifications(?)",25));
    }

    public Map<String,Object> inspect(){
        return readiness.inspect(capabilityEnabled,running.get());
    }

    public Map<String,Object> approve(long expectedRevision,String expectedRuntimeCommit,
            String expectedFinalAuthorityHash,String expectedPostdeployCandidateId,String actor){
        return readiness.prepare(expectedRevision,expectedRuntimeCommit,
            expectedFinalAuthorityHash,expectedPostdeployCandidateId,actor,
            capabilityEnabled,running.get());
    }

    public Map<String,Object> prepare(long expectedRevision,String expectedRuntimeCommit,
            String expectedFinalAuthorityHash,String expectedPostdeployCandidateId,String actor){
        return readiness.prepare(expectedRevision,expectedRuntimeCommit,
            expectedFinalAuthorityHash,expectedPostdeployCandidateId,actor,
            capabilityEnabled,running.get());
    }

    public Map<String,Object> activate(long expectedRevision,String expectedRuntimeCommit,
            String expectedSourceInputAuthorityHash,String expectedPostdeployCandidateId,
            String actor){
        return readiness.activate(expectedRevision,expectedRuntimeCommit,
            expectedSourceInputAuthorityHash,expectedPostdeployCandidateId,actor,
            capabilityEnabled,running.get());
    }

    public Map<String,Object> revoke(long expectedRevision,String actor,String reason){
        return readiness.revoke(expectedRevision,actor,reason);
    }

    public Map<String,Object> revokePrepared(long expectedRevision,
            String expectedPostdeployCandidateId,String actor,String reason){
        return readiness.revokePrepared(expectedRevision,expectedPostdeployCandidateId,
            actor,reason);
    }

    Map<String,Object> dispatch(int requestedLimit){
        int requested=Math.max(1,Math.min(requestedLimit,25));
        String runToken="";
        if(!capabilityEnabled)synchronized(dispatchMonitor){
            if(manualDrainRemaining==0)manualRunToken=UUID.randomUUID().toString();
            manualDrainRemaining=Math.min(25,manualDrainRemaining+requested);
            runToken=manualRunToken;
        }
        CompositeAutocompletionReadinessService.Snapshot snapshot=readiness.snapshot(capabilityEnabled,running.get());
        return dispatchAvailable(requested,!capabilityEnabled,runToken,null,snapshot);
    }

    public Map<String,Object> dispatchCanary(){
        if(!capabilityEnabled)throw new IllegalStateException("AUTOCOMPLETION_CAPABILITY_DISABLED");
        CompositeAutocompletionReadinessService.Snapshot snapshot=readiness.snapshot(capabilityEnabled,running.get());
        Map<String,Object> inspection=snapshot.report();
        String currentCommit=String.valueOf(inspection.get("runtimeCommit"));
        String authorityHash=String.valueOf(inspection.get("currentAuthoritySetHash"));
        String runtimeIdentity=String.valueOf(inspection.get("currentRuntimeIdentityHash"));
        if(!Boolean.TRUE.equals(inspection.get("preflightComplete"))
                ||!currentCommit.matches("[0-9a-f]{40}")
                ||!authorityHash.matches("[0-9a-f]{64}")
                ||!runtimeIdentity.matches("[0-9a-f]{64}"))
            throw new IllegalStateException("CANARY_RUNTIME_BINDING_NOT_READY");
        return dispatchAvailable(1,false,"",new CanaryContext(UUID.randomUUID().toString(),
            currentCommit,authorityHash,runtimeIdentity),snapshot);
    }

    public Map<String,Object> dispatchApproved(int requestedLimit){
        if(requestedLimit<1||requestedLimit>25)
            throw new IllegalArgumentException("AUTOCOMPLETION_LIMIT_INVALID");
        CompositeAutocompletionReadinessService.Snapshot snapshot=readiness.snapshot(capabilityEnabled,running.get());
        if(!Boolean.TRUE.equals(snapshot.report().get("automaticEnablementAllowed")))
            throw new IllegalStateException("AUTOCOMPLETION_APPROVAL_NOT_CURRENT");
        return dispatchAvailable(requestedLimit,false,"",null,snapshot);
    }

    private Map<String,Object> dispatchAvailable(int requestedLimit,boolean manual,String runToken,
            CanaryContext canary,CompositeAutocompletionReadinessService.Snapshot snapshot){
        Map<String,CompositeAutocompletionReadinessService.Candidate> compilerReady=
            snapshot.readyProcesses();
        AtomicInteger canaryAttempt=new AtomicInteger();
        List<Map<String,Object>> claimed;
        synchronized(dispatchMonitor){
            int localAvailable=Math.max(0,parallelism-running.get());
            int budget=manual?Math.min(requestedLimit,manualDrainRemaining):requestedLimit;
            claimed=requiresNew.execute(status->{
                readiness.acquireGlobalDispatchLock(GLOBAL_DISPATCH_ADVISORY_KEY);
                GateContext gateContext=null;
                if(canary==null&&!manual){
                    gateContext=new GateContext(((Number)snapshot.report().get("gateRevision")).longValue(),
                        String.valueOf(snapshot.report().get("runtimeCommit")),
                        String.valueOf(snapshot.report().get("gateSourceInputAuthorityHash")),"","","",0,false);
                    if(!readiness.retainActiveGateOrRevokeOnSourceDrift(gateContext.revision(),
                            gateContext.runtimeCommit(),gateContext.sourceInputHash(),SYSTEM_ACTOR))
                        return List.<Map<String,Object>>of();
                }else readiness.assertAuthoritySetCurrent(String.valueOf(
                    snapshot.report().get("currentAuthoritySetHash")));
                readiness.discover();requeueDependencyDrift();
                String token=UUID.randomUUID().toString();
                if(canary!=null){
                    canaryAttempt.set(readiness.nextCanaryAttempt(
                        canary.runtimeCommit(),canary.authoritySetHash()));
                    List<Map<String,Object>> physical=readiness.rearmPhysicalCanary(canary.canaryId(),
                        canary.runtimeCommit(),canary.authoritySetHash(),canaryAttempt.get());
                    if(!physical.isEmpty())return physical;
                    readiness.prepareCanaryRetry(
                        canary.runtimeCommit(),canary.authoritySetHash());
                }
                int globalAvailable=Math.max(0,parallelism-readiness.globallyRunning());
                int limit=Math.min(Math.max(0,budget),Math.min(localAvailable,globalAvailable));
                if(canary!=null)limit=Math.min(limit,1);
                if(limit==0)return List.<Map<String,Object>>of();
                List<Map<String,Object>> rows=new ArrayList<>();
                for(CompositeAutocompletionReadinessService.Candidate candidate:
                        compilerReady.values()){
                    if(rows.size()>=limit)break;
                    List<Map<String,Object>> one=claimOne(candidate,token,canary,
                        canaryAttempt.get());
                    GateContext claimedGate=null;
                    if(gateContext!=null)claimedGate=new GateContext(gateContext.revision(),
                        gateContext.runtimeCommit(),gateContext.sourceInputHash(),
                        candidate.dependencyFingerprint(),"","",0,false);
                    else if(canary!=null)claimedGate=new GateContext(0,canary.runtimeCommit(),
                        canary.authoritySetHash(),candidate.dependencyFingerprint(),
                        canary.runtimeIdentityHash(),canary.canaryId(),canaryAttempt.get(),true);
                    if(claimedGate!=null)for(Map<String,Object> row:one)
                        row.put("gateContext",claimedGate);
                    rows.addAll(one);
                }
                return rows;
            });
            if(claimed==null)claimed=List.of();
            if(manual){
                manualDrainRemaining=Math.max(0,manualDrainRemaining-claimed.size());
            }
            for(Map<String,Object> claim:claimed)if(!Boolean.TRUE.equals(
                    claim.get("physicalRevalidation")))running.incrementAndGet();
        }
        for(Map<String,Object> claim:claimed){
            if(Boolean.TRUE.equals(claim.get("physicalRevalidation"))){
                reconcilePhysicalCompletion();continue;}
            workers.submit(()->{
            String process=String.valueOf(claim.get("processCode"));
            String leaseToken=String.valueOf(claim.get("leaseToken"));
            GateContext gateContext=claim.get("gateContext") instanceof GateContext context
                ?context:null;
            ScheduledFuture<?> heartbeat=leaseHeartbeats.scheduleAtFixedRate(()->{
                if(heartbeatLease(process,leaseToken)!=1)
                    throw new IllegalStateException("AUTOCOMPLETION_LEASE_HEARTBEAT_CAS_LOST");
            },heartbeatSeconds,heartbeatSeconds,TimeUnit.SECONDS);
            try{complete(process,leaseToken,gateContext);}
            finally{
                heartbeat.cancel(false);
                running.decrementAndGet();
                if(canary==null&&capabilityEnabled)try{dispatchApproved(defaultLimit);}
                    catch(RuntimeException ignored){/* current approval gate closes the drain */}
                else{
                    int budget;String token;
                    synchronized(dispatchMonitor){budget=manualDrainRemaining;token=manualRunToken;}
                    if(canary==null&&manual&&budget>0)
                        dispatchAvailable(budget,true,token,null,
                            readiness.snapshot(false,running.get()));
                }
            }});
        }
        return dispatchReceipt(claimed,manual,runToken,canary,canaryAttempt.get());
    }

    private Map<String,Object> dispatchReceipt(List<Map<String,Object>> claimed,
            boolean manual,String runToken,CanaryContext canary,int canaryAttempt){
        int remaining;
        synchronized(dispatchMonitor){remaining=manual?manualDrainRemaining:0;}
        Map<String,Object> receipt=new LinkedHashMap<>();receipt.put("success",true);
        receipt.put("claimedCount",claimed.size());receipt.put("activeWorkerCount",running.get());
        receipt.put("processCodes",claimed.stream().map(row->row.get("processCode")).toList());
        receipt.put("manualDrain",manual);receipt.put("manualRunToken",manual?runToken:"");
        receipt.put("canary",canary!=null);
        receipt.put("canaryId",canary==null?"":canary.canaryId());
        receipt.put("canaryAttempt",canary==null?0:canaryAttempt);
        receipt.put("remainingRequestedCount",remaining);return receipt;
    }

    private List<Map<String,Object>> claimOne(
            CompositeAutocompletionReadinessService.Candidate candidate,String token,
            CanaryContext canary,int canaryAttempt){
        String canaryJson=canary==null?"{}":json(Map.of(
            "sourceInputDependencyHash",candidate.dependencyFingerprint(),
            "canary",Map.of("canaryId",canary.canaryId(),"status","ACTIVE",
                "attemptNumber",canaryAttempt,"runtimeCommit",canary.runtimeCommit(),
                "requestedRuntimeIdentityHash",canary.runtimeIdentityHash(),
                "requestedSourceAuthorityHash",canary.authoritySetHash(),
                "requestedSourceDependencyHash",candidate.dependencyFingerprint())));
        List<Map<String,Object>> claimed=readiness.claimOne(candidate,token,leaseSeconds,canaryJson);
        if(canary!=null)claimed.forEach(row->{row.put("canary",true);
            row.put("canaryId",canary.canaryId());});
        return claimed;
    }

    int heartbeatLease(String process,String token){
        return readiness.heartbeatLease(requiresNew,process,token,leaseSeconds);
    }

    private record CanaryContext(String canaryId,String runtimeCommit,String authoritySetHash,String runtimeIdentityHash){}
    private record GateContext(long revision,String runtimeCommit,String sourceInputHash,String processInputHash,String runtimeIdentityHash,String canaryId,int canaryAttempt,boolean canary){}

    void reconcilePhysicalCompletion(){
        requiresNew.executeWithoutResult(status->{
            readiness.invalidateStalePhysicalRevalidations();
            requeueDependencyDrift();
            List<Map<String,Object>> terminal=jdbc.queryForList("""
                select receipt.process_code as "processCode",receipt.job_id as "jobId",
                       job.job_status as "jobStatus"
                  from integrated_design_autocompletion_receipt receipt
                  join framework_development_job job on job.job_id=receipt.job_id
                   and job.process_code=receipt.process_code
                 where receipt.completion_status='SOURCE_APPLIED_PHYSICAL_QUEUED'
                   and job.job_type='FULL_STACK_GENERATION'
                   and job.job_group_code=receipt.process_code||'_CANONICAL_PUBLICATION'
                   and job.job_status in('FAILED','BLOCKED','VERIFIED','COMPLETED')
                 order by receipt.process_code collate "C"
                 for update of receipt,job
                """);
            CompositePhysicalEvidenceService evidence=new CompositePhysicalEvidenceService(jdbc);
            for(Map<String,Object> candidate:terminal){
                String process=String.valueOf(candidate.get("processCode"));
                long jobId=((Number)candidate.get("jobId")).longValue();
                String jobStatus=String.valueOf(candidate.get("jobStatus"));
                CompositePhysicalEvidenceService.Verdict verdict=
                    List.of("VERIFIED","COMPLETED").contains(jobStatus)
                        ?evidence.assess(jobId,process)
                        :CompositePhysicalEvidenceService.Verdict.CANONICAL_INVALID;
                String finalizationSql=switch(verdict){
                    case EXACT -> PROMOTE_EXACT_PHYSICAL_SQL;
                    case LIVE_SMOKE_TEST_PENDING -> MARK_LIVE_SMOKE_TEST_PENDING_SQL;
                    case CANONICAL_INVALID -> REQUEUE_INCOMPLETE_PHYSICAL_SQL;
                };
                int updated=verdict==CompositePhysicalEvidenceService.Verdict.LIVE_SMOKE_TEST_PENDING
                    ?jdbc.update(finalizationSql,readiness.runtimeCommit(),process,jobId)
                    :jdbc.update(finalizationSql,process,jobId);
                if(updated==0)requeueDependencyDrift();
                else if(updated!=1)throw new IllegalStateException(
                    "COMPOSITE_PHYSICAL_RECEIPT_CAS_NOT_EXACT: "+process);
            }
        });
    }

    private static final String PROMOTE_EXACT_PHYSICAL_SQL="""
                with current_runtime as materialized (
                  select runtime.source_commit,
                         encode(sha256(convert_to(concat_ws('|',runtime.source_commit,
                           runtime.deployment_namespace,runtime.deployment_name,
                           runtime.deployment_uid,runtime.deployment_generation,
                           runtime.observed_generation,runtime.desired_replicas,
                           runtime.image_ref,runtime.image_id,runtime.health_status
                         ),'UTF8')),'hex') runtime_identity_hash
                    from framework_runtime_release_state runtime
                   where runtime.release_key='CARBONET_RUNTIME'
                     and runtime.health_status='UP'
                ), completed_dispatch as (
                  update integrated_design_live_smoke_dispatch dispatch
                     set status='COMPLETED',lease_token=null,lease_until=null,
                          completed_at=clock_timestamp()
                    from integrated_design_autocompletion_receipt current_receipt,
                         current_runtime runtime
                   where current_receipt.process_code=? and current_receipt.job_id=?
                     and current_receipt.receipt_json->>'liveSmokeDispatchId'~'^[0-9]+$'
                     and dispatch.dispatch_id=
                       (current_receipt.receipt_json->>'liveSmokeDispatchId')::bigint
                     and dispatch.status='EVIDENCE_SUBMITTED'
                     and dispatch.runtime_commit=runtime.source_commit
                     and dispatch.runtime_identity_hash=runtime.runtime_identity_hash
                     and (nullif(current_receipt.receipt_json#>>'{canary,runtimeCommit}','')
                          is null or current_receipt.receipt_json#>>'{canary,runtimeCommit}'=
                          dispatch.runtime_commit)
                     and dispatch.submitted_evidence_count=dispatch.expected_evidence_count
                     and dispatch.authority_revision_set_hash=
                       framework_composite_authority_revision_set_hash(dispatch.job_id)
                  returning dispatch.*
                )
                update integrated_design_autocompletion_receipt receipt
                   set completion_status='PHYSICAL_GENERATED_VERIFIED',completed_at=current_timestamp,
                       duration_ms=greatest(0,(extract(epoch from
                         (current_timestamp-receipt.started_at))*1000)::bigint),
                       receipt_json=receipt.receipt_json||jsonb_build_object(
                         'generationStatus','PHYSICAL_GENERATED_VERIFIED','physicalVerified',true,
                         'testStatus','VERIFIED','liveSmokeVerified',true,
                         'liveSmokeDispatchId',dispatch.dispatch_id,
                         'liveSmokeDispatchStatus','COMPLETED',
                         'liveSmokeEvidenceCount',(select count(*)
                           from integrated_design_live_smoke_evidence smoke
                           join integrated_design_authority current_authority
                             on current_authority.authority_id=smoke.authority_id
                            and current_authority.job_id=smoke.job_id
                            and current_authority.authority_revision=smoke.authority_revision
                            and current_authority.source_hash=smoke.source_hash
                            and current_authority.authority_hash=smoke.authority_hash
                           where smoke.job_id=job.job_id
                             and smoke.dispatch_id=dispatch.dispatch_id
                             and smoke.process_code=receipt.process_code),
                         'liveSmokeEvidenceSetHash',(select framework_composite_live_smoke_hash(
                           coalesce(jsonb_agg(smoke.evidence_hash order by smoke.authority_id,
                             smoke.authority_revision,smoke.command_code collate "C",
                             smoke.scenario_code collate "C",smoke.status_case collate "C",
                             smoke.lane collate "C"),'[]'::jsonb))
                           from integrated_design_live_smoke_evidence smoke
                           join integrated_design_authority current_authority
                             on current_authority.authority_id=smoke.authority_id
                            and current_authority.job_id=smoke.job_id
                            and current_authority.authority_revision=smoke.authority_revision
                            and current_authority.source_hash=smoke.source_hash
                            and current_authority.authority_hash=smoke.authority_hash
                           where smoke.job_id=job.job_id
                             and smoke.dispatch_id=dispatch.dispatch_id
                             and smoke.process_code=receipt.process_code),
                         'canonicalGeneration',
                           framework_try_jsonb(job.result_json)->'canonicalGeneration',
                         'jobEvidenceRef',job.evidence_ref)||case
                         when receipt.receipt_json#>>'{canary,status}'='ACTIVE' then
                           jsonb_build_object('canary',(receipt.receipt_json->'canary')||
                             jsonb_build_object('status','VERIFIED',
                               'physicalVerifiedAt',clock_timestamp(),
                               'verifiedFinalAuthorityHash',(select
                                 framework_composite_live_smoke_hash(coalesce(jsonb_agg(
                                    jsonb_build_object('processCode',target.process_code,
                                      'finalAuthorityFingerprint',
                                      framework_composite_final_authority_fingerprint(
                                        target.process_code))
                                   order by target.process_code collate "C"),'[]'::jsonb))
                                 from (select distinct upper(process_code) process_code
                                   from framework_composite_design_target_identity) target)))
                         else '{}'::jsonb end,
                       blocker_code=null,updated_at=current_timestamp
                  from framework_development_job job,completed_dispatch dispatch
                 where receipt.process_code=dispatch.process_code and receipt.job_id=dispatch.job_id
                    and receipt.completion_status='SOURCE_APPLIED_PHYSICAL_QUEUED'
                    and receipt.job_id=job.job_id and job.process_code=receipt.process_code
                    and job.job_type='FULL_STACK_GENERATION'
                    and job.job_group_code=receipt.process_code||'_CANONICAL_PUBLICATION'
                    and job.job_status in('VERIFIED','COMPLETED')
                    and job.quality_status='VERIFIED' and nullif(job.evidence_ref,'') is not null
                    and receipt.dependency_fingerprint=
                      framework_composite_dependency_fingerprint(receipt.process_code)
                    and 1=(select count(*) from framework_process_artifact artifact
                      where artifact.process_code=receipt.process_code
                        and artifact.step_code=job.step_code
                        and artifact.target_path=job.target_path
                        and artifact.contract_ref='AUTO:FULL_STACK_GENERATION' and artifact.required
                        and artifact.delivery_status='VERIFIED'
                        and artifact.evidence_ref=job.evidence_ref)
                    and exists(
                      select 1 from lateral(select
                        framework_try_jsonb(job.specification_json) specification,
                        framework_try_jsonb(job.result_json) result,
                        framework_try_jsonb(job.result_json)->'canonicalGeneration' evidence
                      ) proof
                      where jsonb_typeof(proof.specification)='object'
                        and jsonb_typeof(proof.result)='object'
                        and jsonb_typeof(proof.evidence)='object'
                        and proof.evidence->>'schema'='carbonet.canonical-generation-evidence/v1'
                        and proof.evidence->>'activationPolicy'='SOURCE_IMMEDIATE_V1'
                        and proof.specification->>'activationPolicy'='SOURCE_IMMEDIATE_V1'
                        and proof.evidence->>'processCode'=receipt.process_code
                        and proof.evidence->>'stepCode'=job.step_code
                        and proof.evidence->>'sourceHash'=proof.specification->>'sourceHash'
                        and proof.specification->>'processInputHash'=proof.specification->>'sourceHash'
                        and proof.evidence->>'designCatalogHash'=
                          proof.specification->>'designCatalogHash'
                        and proof.evidence->>'endpointCatalogHash'=
                          proof.specification->>'endpointCatalogHash'
                        and proof.evidence->>'compositeAuthoritySetHash'=
                          proof.specification->>'compositeAuthoritySetHash'
                        and proof.evidence->>'sourceHash'~'^[0-9a-f]{64}$'
                        and proof.specification->>'designSetHash'~'^[0-9a-f]{64}$'
                        and proof.evidence->>'designCatalogHash'~'^[0-9a-f]{64}$'
                        and proof.evidence->>'endpointCatalogHash'~'^[0-9a-f]{64}$'
                        and proof.evidence->>'packageHash'~'^[0-9a-f]{64}$'
                        and proof.evidence->>'releaseHash'~'^[0-9a-f]{64}$'
                        and proof.evidence->>'compositeAuthoritySetHash'~'^[0-9a-f]{64}$'
                        and proof.evidence->>'compositeArtifactManifestHash'~'^[0-9a-f]{64}$'
                        and proof.result->>'commit'~'^[0-9a-f]{40}$'
                        and job.rollback_ref~'^[0-9a-f]{40}$'
                        and job.evidence_ref~'^git:[0-9a-f]{40};release:[0-9a-f]{64};log:.+$'
                        and split_part(job.evidence_ref,';',1)=
                          'git:'||(proof.result->>'commit')
                        and split_part(job.evidence_ref,';',2)=
                          'release:'||(proof.evidence->>'releaseHash')
                        and jsonb_typeof(proof.specification->'compositeAuthorities')='array'
                        and jsonb_array_length(proof.specification->'compositeAuthorities')>0
                        and 1=(select count(*) from framework_step_execution_spec execution
                          where execution.process_code=receipt.process_code
                            and execution.step_code=job.step_code
                            and execution.source_hash=proof.evidence->>'sourceHash'
                            and execution.generation_status='GENERATED')
                        and jsonb_array_length(proof.specification->'compositeAuthorities')=
                          (select count(*) from integrated_design_authority authority
                            where authority.process_code=receipt.process_code)
                        and not exists(select 1 from integrated_design_authority authority
                          where authority.process_code=receipt.process_code and(
                            authority.job_id is distinct from job.job_id
                            or authority.source_hash is distinct from proof.evidence->>'sourceHash'
                            or authority.design_set_hash is distinct from
                              proof.specification->>'designSetHash'
                            or authority.design_catalog_hash is distinct from
                              proof.evidence->>'designCatalogHash'
                            or authority.endpoint_catalog_hash is distinct from
                              proof.evidence->>'endpointCatalogHash'
                            or 1<>(select count(*)
                              from jsonb_array_elements(
                                proof.specification->'compositeAuthorities') binding
                              where binding->>'stepCode'=authority.step_code
                                and binding->>'routePath'=authority.route_path
                                and binding->>'audience'=authority.audience
                                and binding->>'authorityHash'=authority.authority_hash
                                and binding->>'documentSetHash'=authority.document_set_hash
                                and binding->>'sourceHash'=authority.source_hash
                                and binding->>'designSetHash'=authority.design_set_hash
                                and binding->>'designCatalogHash'=authority.design_catalog_hash
                                and binding->>'endpointCatalogHash'=authority.endpoint_catalog_hash
                                and binding->>'packageBindingHash'=authority.package_binding_hash)
                            or not exists(select 1 from integrated_design_scope_binding binding
                              where binding.authority_id=authority.authority_id
                                and binding.authority_revision=authority.authority_revision
                                and binding.process_code=authority.process_code
                                and binding.step_code=authority.step_code
                                and binding.route_path=authority.route_path
                                and binding.audience=authority.audience
                                and binding.document_set_hash=authority.document_set_hash
                                and binding.authority_hash=authority.authority_hash)
                            or exists(select 1 from integrated_design_scope_binding binding
                              where binding.authority_id=authority.authority_id
                                and binding.authority_revision=authority.authority_revision
                                and (binding.process_code is distinct from authority.process_code
                                  or binding.step_code is distinct from authority.step_code
                                  or binding.route_path is distinct from authority.route_path
                                  or binding.audience is distinct from authority.audience
                                  or binding.document_set_hash is distinct from
                                    authority.document_set_hash
                                  or binding.authority_hash is distinct from
                                    authority.authority_hash))))
                        and 1=(select count(distinct binding.scope_type)
                          from integrated_design_authority scope_authority
                          join integrated_design_scope_binding binding
                            on binding.authority_id=scope_authority.authority_id
                           and binding.authority_revision=scope_authority.authority_revision
                         where scope_authority.process_code=receipt.process_code)
                        and 1>=(select count(distinct binding.project_id)
                          from integrated_design_authority scope_authority
                          join integrated_design_scope_binding binding
                            on binding.authority_id=scope_authority.authority_id
                           and binding.authority_revision=scope_authority.authority_revision
                         where scope_authority.process_code=receipt.process_code
                           and binding.scope_type='PROJECT')
                        and 1=(select count(*) from framework_development_job_event event
                          where event.job_id=job.job_id
                            and event.event_type='CANONICAL_RELEASE_FINALIZED'
                            and framework_try_jsonb(event.detail_json)=proof.evidence)
                    )
                """;
    private static final String MARK_LIVE_SMOKE_TEST_PENDING_SQL="""
                with current_runtime as materialized (
                  select runtime.source_commit,
                         encode(sha256(convert_to(concat_ws('|',runtime.source_commit,
                           runtime.deployment_namespace,runtime.deployment_name,
                           runtime.deployment_uid,runtime.deployment_generation,
                           runtime.observed_generation,runtime.desired_replicas,
                           runtime.image_ref,runtime.image_id,runtime.health_status
                         ),'UTF8')),'hex') runtime_identity_hash
                    from framework_runtime_release_state runtime
                   where runtime.release_key='CARBONET_RUNTIME' and runtime.health_status='UP' for share of runtime
                ), dispatch_contract as materialized (
                  select job.job_id,job.process_code,runtime.source_commit runtime_commit,
                         runtime.runtime_identity_hash,
                         case when receipt.receipt_json#>>'{canary,attemptNumber}'~'^[0-9]+$'
                           then (receipt.receipt_json#>>'{canary,attemptNumber}')::integer else 0 end
                           canary_attempt,
                         framework_composite_authority_revision_set_hash(job.job_id) revision_set_hash,
                         framework_try_jsonb(job.result_json)#>>
                           '{canonicalGeneration,compositeArtifactManifestHash}' artifact_hash,
                         framework_try_jsonb(job.specification_json)->>'sourceHash' process_source_hash,
                         sum(jsonb_array_length(authority.composite_json#>
                           '{executableDesign,TEST,scenarios}')*3)::integer expected_count,
                         case when count(distinct binding.scope_type)=1
                                   and min(binding.scope_type)='GLOBAL'
                                   and bool_and(binding.project_id is null) then '*'
                              when count(distinct binding.scope_type)=1
                                   and min(binding.scope_type)='PROJECT'
                                   and count(distinct binding.project_id)=1
                                then min(binding.project_id)
                              else null end project_id
                    from framework_development_job job
                    join integrated_design_autocompletion_receipt receipt on
                      receipt.process_code=job.process_code and receipt.job_id=job.job_id
                    join current_runtime runtime on runtime.source_commit=coalesce(
                      nullif(receipt.receipt_json#>>'{canary,runtimeCommit}',''),nullif(?,''),
                      framework_try_jsonb(job.result_json)->>'commit') and (
                      coalesce(receipt.receipt_json#>>'{canary,physicalRevalidation}','false')<>'true' or runtime.runtime_identity_hash=receipt.receipt_json#>>'{canary,requestedRuntimeIdentityHash}')
                    join integrated_design_authority authority on authority.job_id=job.job_id
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
                   where job.process_code=? and job.job_id=?
                   group by job.job_id,job.process_code,job.result_json,job.specification_json,
                            receipt.receipt_json,runtime.source_commit,runtime.runtime_identity_hash
                ), superseded as (
                  update integrated_design_live_smoke_dispatch dispatch
                     set status='SUPERSEDED',lease_token=null,lease_until=null,
                         completed_at=coalesce(completed_at,clock_timestamp()),
                         last_error_code='AUTHORITY_REVISION_SUPERSEDED',
                         last_error_hash=framework_composite_live_smoke_hash(jsonb_build_object(
                           'oldRevisionSetHash',dispatch.authority_revision_set_hash,
                           'newRevisionSetHash',contract.revision_set_hash))
                    from dispatch_contract contract
                   where dispatch.job_id=contract.job_id
                     and (dispatch.authority_revision_set_hash<>contract.revision_set_hash
                       or dispatch.runtime_identity_hash<>contract.runtime_identity_hash)
                     and dispatch.status<>'SUPERSEDED'
                  returning dispatch.dispatch_id
                ), inserted as (
                   insert into integrated_design_live_smoke_dispatch(
                    job_id,process_code,project_id,runtime_commit,runtime_identity_hash,
                    canary_attempt,authority_revision_set_hash,artifact_manifest_hash,
                    process_source_hash,expected_evidence_count,status)
                  select job_id,process_code,project_id,runtime_commit,runtime_identity_hash,canary_attempt,
                         revision_set_hash,artifact_hash,process_source_hash,expected_count,'QUEUED'
                    from dispatch_contract
                   where project_id is not null and expected_count>0
                     and runtime_commit~'^[0-9a-f]{40}$' and canary_attempt between 0 and 3
                     and revision_set_hash~'^[0-9a-f]{64}$'
                     and artifact_hash~'^[0-9a-f]{64}$'
                     and process_source_hash~'^[0-9a-f]{64}$'
                  on conflict(job_id,authority_revision_set_hash,runtime_identity_hash,canary_attempt)
                    do nothing
                  returning *
                ), ensured as (
                  select * from inserted union all
                  select dispatch.* from integrated_design_live_smoke_dispatch dispatch
                  join dispatch_contract contract on contract.job_id=dispatch.job_id
                    and contract.revision_set_hash=dispatch.authority_revision_set_hash
                    and contract.runtime_commit=dispatch.runtime_commit
                    and contract.runtime_identity_hash=dispatch.runtime_identity_hash
                    and contract.canary_attempt=dispatch.canary_attempt
                   where not exists(select 1 from inserted)
                )
                update integrated_design_autocompletion_receipt receipt
                   set receipt_json=receipt.receipt_json||jsonb_build_object(
                         'generationStatus','PHYSICAL_QUEUED','testStatus','TEST_PENDING',
                         'physicalVerified',false,'liveSmokeVerified',false,
                         'liveSmokeDispatchId',dispatch.dispatch_id,
                         'liveSmokeDispatchStatus',dispatch.status,
                         'liveSmokeExpectedEvidenceCount',dispatch.expected_evidence_count),
                       blocker_code='TEST_PENDING',completed_at=null,duration_ms=null,
                       updated_at=current_timestamp
                  from framework_development_job job,ensured dispatch
                 where receipt.process_code=dispatch.process_code and receipt.job_id=dispatch.job_id
                   and receipt.completion_status='SOURCE_APPLIED_PHYSICAL_QUEUED'
                   and receipt.job_id=job.job_id and job.process_code=receipt.process_code
                   and job.job_type='FULL_STACK_GENERATION'
                   and job.job_group_code=receipt.process_code||'_CANONICAL_PUBLICATION'
                   and job.job_status in('VERIFIED','COMPLETED')
                   and job.quality_status='VERIFIED'
                   and (receipt.blocker_code is distinct from 'TEST_PENDING'
                     or receipt.receipt_json->>'generationStatus' is distinct from 'PHYSICAL_QUEUED'
                     or receipt.receipt_json->>'testStatus' is distinct from 'TEST_PENDING'
                     or receipt.receipt_json->'physicalVerified' is distinct from 'false'::jsonb
                     or receipt.receipt_json->'liveSmokeVerified' is distinct from 'false'::jsonb
                     or receipt.receipt_json->>'liveSmokeDispatchId' is distinct from
                          dispatch.dispatch_id::text
                     or receipt.receipt_json->>'liveSmokeExpectedEvidenceCount' is distinct from
                          dispatch.expected_evidence_count::text
                     or not exists(select 1 from integrated_design_live_smoke_dispatch current_dispatch
                       where current_dispatch.job_id=job.job_id
                         and current_dispatch.authority_revision_set_hash=
                           framework_composite_authority_revision_set_hash(job.job_id)
                         and current_dispatch.runtime_commit=dispatch.runtime_commit
                         and current_dispatch.runtime_identity_hash=dispatch.runtime_identity_hash))
                """;
    private static final String REQUEUE_INCOMPLETE_PHYSICAL_SQL="""
                update integrated_design_autocompletion_receipt receipt
                   set completion_status=case
                          when receipt.receipt_json#>>'{canary,physicalRevalidation}'='true'
                            then 'PHYSICAL_GENERATED_VERIFIED'
                          when receipt.attempt_count<5 then 'PENDING'
                          else 'PHYSICAL_FAILED' end,
                        blocker_code=left(case when job.job_status in('VERIFIED','COMPLETED')
                          then 'CANONICAL_PHYSICAL_EVIDENCE_INVALID'
                          else coalesce(job.last_error,job.job_status) end,1000),
                        receipt_json=receipt.receipt_json||jsonb_build_object(
                          'generationStatus',case when receipt.attempt_count<5
                            then 'PHYSICAL_RETRY_QUEUED' else 'PHYSICAL_FAILED' end,
                          'physicalVerified',false,
                          'jobStatus',job.job_status)||case
                          when receipt.receipt_json#>>'{canary,status}'='ACTIVE' then
                            jsonb_build_object('canary',(receipt.receipt_json->'canary')||
                              jsonb_build_object('status','FAILED',
                                'failedAt',clock_timestamp()))
                          else '{}'::jsonb end,updated_at=current_timestamp
                        ,completed_at=case
                          when receipt.receipt_json#>>'{canary,physicalRevalidation}'='true'
                            then current_timestamp
                          when receipt.attempt_count<5 then null else current_timestamp end,
                        duration_ms=case
                          when receipt.receipt_json#>>'{canary,physicalRevalidation}'='true'
                            then greatest(0,(extract(epoch from
                              (current_timestamp-receipt.started_at))*1000)::bigint)
                          when receipt.attempt_count<5 then null else greatest(0,
                            (extract(epoch from(current_timestamp-receipt.started_at))*1000)::bigint)
                          end
                   from framework_development_job job
                  where receipt.process_code=? and receipt.job_id=?
                    and receipt.completion_status='SOURCE_APPLIED_PHYSICAL_QUEUED'
                    and receipt.job_id=job.job_id
                    and job.job_status in('FAILED','BLOCKED','VERIFIED','COMPLETED')
                """;

    private int requeueDependencyDrift(){
        return jdbc.update("""
            update integrated_design_autocompletion_receipt receipt
               set completion_status='PENDING',attempt_count=0,job_id=null,
                   lease_token=null,lease_until=null,blocker_code=null,
                   receipt_json=receipt.receipt_json||jsonb_build_object(
                     'generationStatus','DEPENDENCY_CHANGED_REQUEUE',
                     'physicalVerified',false,'staleJobDiscarded',receipt.job_id is not null)||case
                     when receipt.receipt_json#>>'{canary,status}'='ACTIVE' then
                       jsonb_build_object('canary',(receipt.receipt_json->'canary')||
                         jsonb_build_object('status','INVALIDATED',
                           'invalidatedAt',clock_timestamp()))
                     else '{}'::jsonb end,
                   dependency_fingerprint=framework_composite_dependency_fingerprint(
                     receipt.process_code),completed_at=null,duration_ms=null,
                   updated_at=current_timestamp
             where receipt.completion_status in('SOURCE_APPLIED_GENERATION_QUEUED',
                     'SOURCE_APPLIED_UNCHANGED','SOURCE_APPLIED_PHYSICAL_QUEUED',
                     'PHYSICAL_GENERATED_VERIFIED','PHYSICAL_FAILED','BLOCKED')
               and receipt.dependency_fingerprint is distinct from
                   framework_composite_dependency_fingerprint(receipt.process_code)
            """);
    }

    private void complete(String process,String token,GateContext gateContext){
        try{
            requiresNew.executeWithoutResult(status->{
                readiness.acquireSourceExecutionSlot(GLOBAL_SOURCE_SLOT_BASE,parallelism,process);
                readiness.lockCompilerSourceRegistries();
                governance.lockCompositeProcessAuthority(process);
                if(gateContext!=null){
                    if(gateContext.canary()){
                        if(!readiness.retainCanaryClaimOrInvalidate(process,token,gateContext.sourceInputHash(),
                            gateContext.processInputHash(),gateContext.runtimeCommit(),gateContext.runtimeIdentityHash(),
                            gateContext.canaryId(),gateContext.canaryAttempt()))return;
                    }else{
                        readiness.assertActiveGate(gateContext.revision(),
                            gateContext.runtimeCommit(),gateContext.sourceInputHash());
                        readiness.assertProcessSourceCurrent(process,gateContext.processInputHash());
                    }
                }
                Map<String,Object> request=new LinkedHashMap<>(scopeForProcess(process));
                request.put("processCode",process);request.put("previewOnly",false);
                Map<String,Object> result=governance.compileIntegratedDesignProcess(request,SYSTEM_ACTOR);
                String state=String.valueOf(result.get("status"));
                if(!List.of("SOURCE_APPLIED_PHYSICAL_QUEUED","PHYSICAL_GENERATED_VERIFIED").contains(state))
                    throw new IllegalStateException("AUTOCOMPLETION_SOURCE_STATUS_INVALID: "+state);
                Map<String,Object> pendingEvidenceCheck=new LinkedHashMap<>(result);
                pendingEvidenceCheck.put("status","SOURCE_APPLIED_PHYSICAL_QUEUED");
                pendingEvidenceCheck.put("generationStatus","PHYSICAL_EVIDENCE_RECHECK_QUEUED");
                pendingEvidenceCheck.put("physicalVerified",false);
                state="SOURCE_APPLIED_PHYSICAL_QUEUED";
                long jobId=firstJobId(result);int updated=jdbc.update("""
                    update integrated_design_autocompletion_receipt set completion_status=?,
                           screen_count=?,document_count=?,authority_count=?,job_id=?,
                           receipt_json=receipt_json||?::jsonb||jsonb_build_object(
                             'sourceAppliedFinalAuthorityHash',(select
                               framework_composite_live_smoke_hash(coalesce(jsonb_agg(
                                 jsonb_build_object('processCode',target.process_code,
                                   'finalAuthorityFingerprint',
                                     framework_composite_final_authority_fingerprint(
                                       target.process_code))
                                 order by target.process_code collate "C"),'[]'::jsonb))
                               from (select distinct upper(process_code) process_code
                                 from framework_composite_design_target_identity) target)),
                           lease_token=null,lease_until=null,
                           blocker_code=null,
                           completed_at=case when ?='PHYSICAL_GENERATED_VERIFIED'
                             then current_timestamp else null end,
                           duration_ms=case when ?='PHYSICAL_GENERATED_VERIFIED' then greatest(0,
                             (extract(epoch from(current_timestamp-started_at))*1000)::bigint) else null end,
                           dependency_fingerprint=framework_composite_dependency_fingerprint(?),
                           updated_at=current_timestamp
                     where process_code=? and lease_token=?::uuid and completion_status='RUNNING'
                    """,state,number(result,"screenCount"),number(result,"documentCount"),
                    number(result,"authorityCount"),jobId,json(pendingEvidenceCheck),state,state,process,
                    process,token);
                if(updated!=1)throw new IllegalStateException("AUTOCOMPLETION_LEASE_CAS_LOST");
            });
        }catch(RuntimeException error){
            String blocker=error.getMessage()==null?error.getClass().getSimpleName():error.getMessage();
            requiresNew.executeWithoutResult(status->jdbc.update("""
                update integrated_design_autocompletion_receipt set completion_status='BLOCKED',
                       blocker_code=?,receipt_json=receipt_json||jsonb_build_object('sourceCommitted',false,
                         'jobCount',0,'blocker',?)||case
                         when receipt_json#>>'{canary,status}'='ACTIVE' then jsonb_build_object(
                           'canary',(receipt_json->'canary')||jsonb_build_object(
                             'status','FAILED','failedAt',clock_timestamp()))
                         else '{}'::jsonb end,lease_token=null,lease_until=null,
                       dependency_fingerprint=framework_composite_dependency_fingerprint(?),
                       completed_at=current_timestamp,
                       duration_ms=greatest(0,(extract(epoch from
                         (current_timestamp-started_at))*1000)::bigint),updated_at=current_timestamp
                 where process_code=? and lease_token=?::uuid and completion_status='RUNNING'
                """,left(blocker,1000),left(blocker,1000),process,process,token));
        }
    }

    Map<String,Object> scopeForProcess(String process){
        List<Map<String,Object>> scopes=jdbc.queryForList("""
            select authority.authority_id as "authorityId",
                   authority.process_code as "authorityProcessCode",
                   authority.step_code as "authorityStepCode",
                   authority.route_path as "authorityRoutePath",
                   authority.audience as "authorityAudience",
                   authority.document_set_hash as "authorityDocumentSetHash",
                   authority.authority_hash as "currentAuthorityHash",
                   binding.process_code as "bindingProcessCode",
                   binding.step_code as "bindingStepCode",
                   binding.route_path as "bindingRoutePath",
                   binding.audience as "bindingAudience",
                   binding.document_set_hash as "bindingDocumentSetHash",
                   binding.authority_hash as "bindingAuthorityHash",
                   binding.scope_type as "scopeType",binding.project_id as "projectId",
                   binding.design_version as "designVersion",
                   binding.contract_sha256 as "contractSha256",binding.bound_at as "boundAt"
              from integrated_design_authority authority
              join integrated_design_scope_binding binding
                on binding.authority_id=authority.authority_id
               and binding.authority_revision=authority.authority_revision
             where authority.process_code=?
             order by authority.step_code collate "C",authority.route_path collate "C",
                      authority.audience collate "C"
             for share of authority,binding
            """,process);
        Integer authorities=jdbc.queryForObject(
            "select count(*) from integrated_design_authority where process_code=?",Integer.class,process);
        if(authorities==null||authorities==0){
            try{
                String requested=jdbc.queryForObject("""
                    select coalesce(receipt_json->'requestedScope','null'::jsonb)::text
                      from integrated_design_autocompletion_receipt where process_code=?
                    """,String.class,process);
                @SuppressWarnings("unchecked") Map<String,Object> marker=
                    mapper.readValue(requested,Map.class);
                if(marker.size()==2&&"GLOBAL".equals(marker.get("scopeType"))
                        &&"MIGRATION_GLOBAL_TARGET".equals(marker.get("source")))
                    return Map.of("scopeType","GLOBAL");
            }catch(Exception ignored){/* normalized to one deterministic blocker below */}
            throw new IllegalStateException("COMPOSITE_WORKER_SCOPE_UNBOUND");
        }
        if(scopes.isEmpty()||scopes.stream().anyMatch(row->
                !java.util.Objects.equals(row.get("authorityProcessCode"),row.get("bindingProcessCode"))
                ||!java.util.Objects.equals(row.get("authorityStepCode"),row.get("bindingStepCode"))
                ||!java.util.Objects.equals(row.get("authorityRoutePath"),row.get("bindingRoutePath"))
                ||!java.util.Objects.equals(row.get("authorityAudience"),row.get("bindingAudience"))
                ||!java.util.Objects.equals(row.get("authorityDocumentSetHash"),
                    row.get("bindingDocumentSetHash"))
                ||!java.util.Objects.equals(row.get("currentAuthorityHash"),
                    row.get("bindingAuthorityHash"))))throw new IllegalStateException(
                    "COMPOSITE_WORKER_SCOPE_BINDING_NOT_EXACT");
        long types=scopes.stream().map(row->String.valueOf(row.get("scopeType"))).distinct().count();
        if(types!=1)throw new IllegalStateException("COMPOSITE_WORKER_SCOPE_NOT_EXACT");
        if("GLOBAL".equals(String.valueOf(scopes.get(0).get("scopeType")))){
            long boundAuthorities=scopes.stream().map(row->((Number)row.get("authorityId")).longValue())
                .distinct().count();
            if(scopes.size()!=authorities||boundAuthorities!=authorities)throw new IllegalStateException(
                "COMPOSITE_WORKER_SCOPE_BINDING_NOT_EXACT");
            return Map.of("scopeType","GLOBAL");
        }
        long projects=scopes.stream().map(row->String.valueOf(row.get("projectId"))).distinct().count();
        if(projects!=1)throw new IllegalStateException("PROJECT_COMPOSITE_PROCESS_SHARED");
        Map<String,java.util.Set<Long>> releaseAuthorities=new LinkedHashMap<>();
        Map<String,Integer> releaseRows=new LinkedHashMap<>();
        Map<String,Map<String,Object>> releases=new LinkedHashMap<>();
        Map<String,java.sql.Timestamp> releaseTimes=new LinkedHashMap<>();
        for(Map<String,Object> row:scopes){
            String release=String.valueOf(row.get("designVersion"))+"\u001f"+row.get("contractSha256");
            releaseRows.merge(release,1,Integer::sum);
            releaseAuthorities.computeIfAbsent(release,ignored->new java.util.HashSet<>())
                .add(((Number)row.get("authorityId")).longValue());
            releases.putIfAbsent(release,row);
            java.sql.Timestamp boundAt=(java.sql.Timestamp)row.get("boundAt");
            releaseTimes.merge(release,boundAt,(left,right)->left.after(right)?left:right);
        }
        String latestRelease=null;Map<String,Object> latest=null;int latestVersion=-1;
        java.sql.Timestamp latestAt=null;
        for(Map.Entry<String,Map<String,Object>> release:releases.entrySet()){
            int version=((Number)release.getValue().get("designVersion")).intValue();
            java.sql.Timestamp boundAt=releaseTimes.get(release.getKey());
            if(latestAt==null||boundAt.after(latestAt)
                    ||(boundAt.equals(latestAt)&&version>latestVersion)){
                latestRelease=release.getKey();latestVersion=version;
                latestAt=boundAt;latest=release.getValue();
            }
        }
        if(latest==null||releaseRows.get(latestRelease).intValue()!=authorities.intValue()
                ||releaseAuthorities.get(latestRelease).size()!=authorities)
            throw new IllegalStateException("COMPOSITE_WORKER_PROJECT_RELEASE_NOT_EXACT");
        return Map.of("scopeType","PROJECT",
            "projectId",latest.get("projectId"),"designVersion",latest.get("designVersion"),
            "contractSha256",latest.get("contractSha256"));
    }

    private long firstJobId(Map<String,Object> result){
        Object raw=result.get("receipts");if(!(raw instanceof List<?> rows)||rows.isEmpty()
                ||!(rows.get(0) instanceof Map<?,?> receipt)||!(receipt.get("jobId") instanceof Number job))
            throw new IllegalStateException("AUTOCOMPLETION_JOB_RECEIPT_REQUIRED");
        return job.longValue();
    }
    private static int number(Map<String,Object> row,String key){
        if(!(row.get(key) instanceof Number value))throw new IllegalStateException(
            "AUTOCOMPLETION_COUNT_REQUIRED: "+key);return value.intValue();
    }
    static long estimateSeconds(long processCount,long p95Millis,int slots){return
        CompositeAutocompletionReadinessService.estimateSeconds(processCount,p95Millis,slots);}
    static long requiredParallelismFor(long processCount,long p95Millis){return
        CompositeAutocompletionReadinessService.requiredParallelismFor(processCount,p95Millis);}
    private String json(Object value){try{return mapper.writeValueAsString(value);}
        catch(JsonProcessingException error){throw new IllegalStateException("AUTOCOMPLETION_RECEIPT_INVALID",error);}}
    private static String left(String value,int limit){return value.length()<=limit?value:value.substring(0,limit);}

    @PreDestroy public void close(){workers.shutdownNow();leaseHeartbeats.shutdownNow();
        readiness.close();}
}
