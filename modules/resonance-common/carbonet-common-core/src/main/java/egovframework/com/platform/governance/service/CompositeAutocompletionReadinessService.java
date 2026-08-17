package egovframework.com.platform.governance.service;

import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.Callable;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.Semaphore;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

/**
 * Read-only, hash-bound readiness gate and the short transactional capacity
 * primitives used by the composite autocompletion worker.
 */
@Service
public class CompositeAutocompletionReadinessService {
    private static final long TEN_MINUTE_MILLIS=600_000L;
    private static final int CANARY_ATTEMPT_TIMEOUT_SECONDS=600;
    private final JdbcTemplate jdbc;
    private final ActorProcessGovernanceService governance;
    private final TransactionTemplate readOnly;
    private final TransactionTemplate requiresNew;
    private final ThreadPoolExecutor preflightWorkers;
    private final Semaphore preflightSingleFlight=new Semaphore(1);
    private final int parallelism;
    private final int physicalParallelism;
    private final int configuredReplicas;
    private final String runtimeCommit;
    private final long preflightBudgetMillis;
    private final long cacheMillis;
    private final int preflightQueueCapacity;
    private volatile CompilerSnapshot cached;

    @Autowired
    public CompositeAutocompletionReadinessService(JdbcTemplate jdbc,
            ActorProcessGovernanceService governance,PlatformTransactionManager transactionManager,
            @Value("${resonance.composite-autocompletion.parallelism:8}") int parallelism,
            @Value("${resonance.composite-autocompletion.physical-slots:8}") int physicalParallelism,
            @Value("${resonance.composite-autocompletion.replicas:2}") int configuredReplicas,
            @Value("${resonance.composite-autocompletion.runtime-commit:}") String runtimeCommit,
            @Value("${resonance.composite-autocompletion.preflight-threads:8}") int preflightThreads,
            @Value("${resonance.composite-autocompletion.preflight-budget-ms:12000}")
                long preflightBudgetMillis,
            @Value("${resonance.composite-autocompletion.preflight-cache-ms:30000}") long cacheMillis,
            @Value("${resonance.composite-autocompletion.preflight-queue-capacity:256}")
                int preflightQueueCapacity){
        this.jdbc=jdbc;this.governance=governance;
        this.parallelism=Math.max(1,Math.min(parallelism,8));
        this.physicalParallelism=Math.max(1,Math.min(physicalParallelism,64));
        this.configuredReplicas=Math.max(1,configuredReplicas);
        this.runtimeCommit=normalizeCommit(runtimeCommit);
        this.preflightBudgetMillis=Math.max(1000,Math.min(preflightBudgetMillis,15_000));
        this.cacheMillis=Math.max(0,Math.min(cacheMillis,60_000));
        this.preflightQueueCapacity=Math.max(108,Math.min(preflightQueueCapacity,512));
        int boundedThreads=Math.max(1,Math.min(preflightThreads,8));
        this.preflightWorkers=new ThreadPoolExecutor(boundedThreads,boundedThreads,0L,
            TimeUnit.MILLISECONDS,new ArrayBlockingQueue<>(this.preflightQueueCapacity),runnable->{
                Thread thread=new Thread(runnable,"composite-readiness-preflight");
                thread.setDaemon(true);return thread;},new ThreadPoolExecutor.AbortPolicy());
        this.readOnly=new TransactionTemplate(transactionManager);
        this.readOnly.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.readOnly.setReadOnly(true);
        this.requiresNew=new TransactionTemplate(transactionManager);
        this.requiresNew.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    CompositeAutocompletionReadinessService(JdbcTemplate jdbc,
            ActorProcessGovernanceService governance,PlatformTransactionManager transactionManager,
            int parallelism,int physicalParallelism,int configuredReplicas,String runtimeCommit,
            String approvedRuntimeCommit,String approvedAuthoritySetHash){
        this(jdbc,governance,transactionManager,parallelism,physicalParallelism,configuredReplicas,
            runtimeCommit,8,12_000,30_000,256);
    }

    CompositeAutocompletionReadinessService(JdbcTemplate jdbc,
            ActorProcessGovernanceService governance,PlatformTransactionManager transactionManager,
            int parallelism,int physicalParallelism,int configuredReplicas,String runtimeCommit,
            String approvedRuntimeCommit,String approvedAuthoritySetHash,int preflightThreads,
            long preflightBudgetMillis,long cacheMillis){
        this(jdbc,governance,transactionManager,parallelism,physicalParallelism,configuredReplicas,
            runtimeCommit,preflightThreads,preflightBudgetMillis,cacheMillis,256);
    }

    public Map<String,Object> inspect(boolean capabilityEnabled,int activeWorkerCount){
        return snapshot(capabilityEnabled,activeWorkerCount).report();
    }

    public Map<String,Object> prepare(long expectedRevision,String expectedRuntimeCommit,
            String expectedFinalAuthorityHash,String expectedPostdeployCandidateId,String actor,
            boolean capabilityEnabled,int activeWorkerCount){
        String commit=normalizeCommit(expectedRuntimeCommit);
        String finalHash=normalizeHash(expectedFinalAuthorityHash);
        String candidateId=normalizeCandidateId(expectedPostdeployCandidateId);
        String preparedBy=normalizeActor(actor);
        if(!capabilityEnabled||expectedRevision<0||commit.isEmpty()||finalHash.isEmpty()
                ||candidateId.isEmpty())
            throw new IllegalArgumentException("AUTOCOMPLETION_APPROVAL_BINDING_INVALID");
        Snapshot checked=snapshot(true,activeWorkerCount);
        Map<String,Object> report=checked.report();
        if(!Boolean.TRUE.equals(report.get("enablementPrerequisitesMet"))
                ||!Boolean.TRUE.equals(report.get("quiescentForGateTransition"))
                ||!commit.equals(report.get("runtimeCommit"))
                ||!finalHash.equals(report.get("currentFinalAuthoritySetHash"))
                ||!finalHash.equals(report.get("currentVerifiedCanaryFinalAuthorityHash"))
                ||number(report.get("gateRevision"))!=expectedRevision)
            throw new IllegalStateException("AUTOCOMPLETION_APPROVAL_PREFLIGHT_STALE");
        Map<String,Object> prepared=requiresNew.execute(status->{
            Map<String,Object> gate=lockGate();
            if(number(gate.get("revision"))!=expectedRevision)
                throw new IllegalStateException("AUTOCOMPLETION_GATE_REVISION_CONFLICT");
            if(globallyInFlight()!=0)
                throw new IllegalStateException("AUTOCOMPLETION_PREPARE_WORKERS_ACTIVE");
            String currentSourceHash=currentAuthoritySetHash();
            String currentFinalHash=currentFinalAuthoritySetHash();
            if(!runtimeCommit.equals(commit)||!currentFinalHash.equals(finalHash))
                throw new IllegalStateException("AUTOCOMPLETION_APPROVAL_BINDING_STALE");
            List<Map<String,Object>> canaries=currentVerifiedCanaries(currentSourceHash);
            if(canaries.size()!=1||countCanaries("ACTIVE",runtimeCommit)!=0)
                throw new IllegalStateException("AUTOCOMPLETION_CANARY_BINDING_STALE");
            Map<String,Object> canary=canaries.get(0);
            String sourceHash=normalizeHash(String.valueOf(
                canary.get("sourceInputAuthorityHash")));
            String process=String.valueOf(canary.get("processCode"));
            long jobId=number(canary.get("jobId"));
            if(sourceHash.isEmpty()||process.isBlank()||jobId<=0
                    ||!currentFinalHash.equals(String.valueOf(canary.get("finalAuthorityHash"))))
                throw new IllegalStateException("AUTOCOMPLETION_CANARY_CAUSALITY_INVALID");
            return jdbc.queryForMap("""
                update integrated_design_autocompletion_gate
                   set approval_status='PREPARED',runtime_commit=?,
                       postdeploy_candidate_id=?,
                       source_input_authority_hash=?,final_authority_hash=?,
                       canary_process_code=?,canary_job_id=?,revision=revision+1,
                       approved_by=?,approved_at=current_timestamp,
                       activated_by=null,activated_at=null,revoked_by=null,
                       revoked_at=null,revoke_reason=null,updated_at=current_timestamp
                 where gate_key='GLOBAL' and revision=?
                returning approval_status as "approvalStatus",revision,
                          runtime_commit as "runtimeCommit",
                          postdeploy_candidate_id as "postdeployCandidateId",
                          source_input_authority_hash as "sourceInputAuthorityHash",
                          final_authority_hash as "finalAuthorityHash",
                          canary_process_code as "canaryProcessCode",
                          canary_job_id as "canaryJobId",approved_by as "approvedBy",
                          approved_at as "approvedAt"
                """,commit,candidateId,sourceHash,currentFinalHash,process,jobId,preparedBy,
                expectedRevision);
        });
        if(prepared==null)throw new IllegalStateException("AUTOCOMPLETION_GATE_UPDATE_FAILED");
        Map<String,Object> result=new LinkedHashMap<>(prepared);
        result.put("success",true);result.put("action","PREPARE");
        result.put("effectiveWithoutRollout",false);return result;
    }

    /** Compatibility entrypoint: approval now only prepares and can never start workers. */
    public Map<String,Object> approve(long expectedRevision,String expectedRuntimeCommit,
            String expectedFinalAuthorityHash,String expectedPostdeployCandidateId,String actor,
            boolean capabilityEnabled,int activeWorkerCount){
        return prepare(expectedRevision,expectedRuntimeCommit,expectedFinalAuthorityHash,
            expectedPostdeployCandidateId,actor,capabilityEnabled,activeWorkerCount);
    }

    public Map<String,Object> activate(long expectedRevision,String expectedRuntimeCommit,
            String expectedSourceInputAuthorityHash,String expectedPostdeployCandidateId,
            String actor,boolean capabilityEnabled,int activeWorkerCount){
        String commit=normalizeCommit(expectedRuntimeCommit);
        String sourceHash=normalizeHash(expectedSourceInputAuthorityHash);
        String candidateId=normalizeCandidateId(expectedPostdeployCandidateId);
        String activatedBy=normalizeActor(actor);
        if(!capabilityEnabled||expectedRevision<0||commit.isEmpty()||sourceHash.isEmpty()
                ||candidateId.isEmpty())
            throw new IllegalArgumentException("AUTOCOMPLETION_ACTIVATION_BINDING_INVALID");
        Map<String,Object> report=snapshot(true,activeWorkerCount).report();
        if(!Boolean.TRUE.equals(report.get("enablementPrerequisitesMet"))
                ||!Boolean.TRUE.equals(report.get("quiescentForGateTransition"))
                ||!Boolean.TRUE.equals(report.get("releaseFinalized"))
                ||!Boolean.TRUE.equals(report.get("preparedBindingCurrent"))
                ||!commit.equals(report.get("runtimeCommit"))
                ||!sourceHash.equals(report.get("currentAuthoritySetHash"))
                ||!candidateId.equals(report.get("gatePostdeployCandidateId"))
                ||number(report.get("gateRevision"))!=expectedRevision)
            throw new IllegalStateException("AUTOCOMPLETION_ACTIVATION_PREFLIGHT_STALE");
        Map<String,Object> activated=requiresNew.execute(status->{
            Map<String,Object> gate=lockGate();
            if(number(gate.get("revision"))!=expectedRevision
                    ||!"PREPARED".equals(gate.get("approvalStatus")))
                throw new IllegalStateException("AUTOCOMPLETION_GATE_REVISION_CONFLICT");
            String currentSourceHash=currentAuthoritySetHash();
            String currentFinalHash=currentFinalAuthoritySetHash();
            if(!finalizerPromoted(commit,candidateId)||!runtimeCommit.equals(commit)
                    ||!currentSourceHash.equals(sourceHash)
                    ||!sourceHash.equals(gate.get("sourceInputAuthorityHash"))
                    ||!commit.equals(gate.get("runtimeCommit"))
                    ||!candidateId.equals(gate.get("postdeployCandidateId"))
                    ||!currentFinalHash.equals(gate.get("finalAuthorityHash")))
                throw new IllegalStateException("AUTOCOMPLETION_ACTIVATION_BINDING_STALE");
            List<Map<String,Object>> canaries=currentVerifiedCanaries(currentSourceHash);
            if(canaries.size()!=1||countCanaries("ACTIVE",runtimeCommit)!=0)
                throw new IllegalStateException("AUTOCOMPLETION_CANARY_BINDING_STALE");
            Map<String,Object> canary=canaries.get(0);
            if(!String.valueOf(canary.get("finalAuthorityHash"))
                        .equals(String.valueOf(gate.get("finalAuthorityHash")))
                    ||!String.valueOf(canary.get("processCode"))
                        .equals(String.valueOf(gate.get("canaryProcessCode")))
                    ||number(canary.get("jobId"))!=number(gate.get("canaryJobId")))
                throw new IllegalStateException("AUTOCOMPLETION_CANARY_CAUSALITY_INVALID");
            return jdbc.queryForMap("""
                update integrated_design_autocompletion_gate
                   set approval_status='ACTIVE',revision=revision+1,
                       activated_by=?,activated_at=current_timestamp,
                       revoked_by=null,revoked_at=null,revoke_reason=null,
                       updated_at=current_timestamp
                 where gate_key='GLOBAL' and revision=? and approval_status='PREPARED'
                returning approval_status as "approvalStatus",revision,
                          runtime_commit as "runtimeCommit",
                          postdeploy_candidate_id as "postdeployCandidateId",
                          source_input_authority_hash as "sourceInputAuthorityHash",
                          final_authority_hash as "finalAuthorityHash",
                          canary_process_code as "canaryProcessCode",
                          canary_job_id as "canaryJobId",activated_by as "activatedBy",
                          activated_at as "activatedAt"
                """,activatedBy,expectedRevision);
        });
        if(activated==null)throw new IllegalStateException("AUTOCOMPLETION_GATE_UPDATE_FAILED");
        Map<String,Object> result=new LinkedHashMap<>(activated);
        result.put("success",true);result.put("action","ACTIVATE");
        result.put("effectiveWithoutRollout",true);return result;
    }

    public Map<String,Object> revoke(long expectedRevision,String actor,String reason){
        if(expectedRevision<0)throw new IllegalArgumentException(
            "AUTOCOMPLETION_GATE_REVISION_INVALID");
        String revokedBy=normalizeActor(actor);
        String revokeReason=reason==null||reason.isBlank()?"OPERATOR_REVOKED":reason.trim();
        if(revokeReason.length()>300)revokeReason=revokeReason.substring(0,300);
        String boundedReason=revokeReason;
        Map<String,Object> revoked=requiresNew.execute(status->{
            Map<String,Object> gate=lockGate();
            if(number(gate.get("revision"))!=expectedRevision)
                throw new IllegalStateException("AUTOCOMPLETION_GATE_REVISION_CONFLICT");
            return jdbc.queryForMap("""
                update integrated_design_autocompletion_gate
                   set approval_status='REVOKED',revision=revision+1,revoked_by=?,
                       revoked_at=current_timestamp,revoke_reason=?,updated_at=current_timestamp
                 where gate_key='GLOBAL' and revision=?
                returning approval_status as "approvalStatus",revision,
                          runtime_commit as "runtimeCommit",
                          final_authority_hash as "finalAuthorityHash",
                          revoked_by as "revokedBy",revoked_at as "revokedAt",
                          revoke_reason as "revokeReason"
                """,revokedBy,boundedReason,expectedRevision);
        });
        if(revoked==null)throw new IllegalStateException("AUTOCOMPLETION_GATE_UPDATE_FAILED");
        Map<String,Object> result=new LinkedHashMap<>(revoked);
        result.put("success",true);result.put("action","REVOKE");return result;
    }

    public Map<String,Object> revokePrepared(long expectedRevision,
            String expectedPostdeployCandidateId,String actor,String reason){
        String candidateId=normalizeCandidateId(expectedPostdeployCandidateId);
        if(expectedRevision<0||candidateId.isEmpty())throw new IllegalArgumentException(
            "AUTOCOMPLETION_PREPARED_REVOKE_BINDING_INVALID");
        String revokedBy=normalizeActor(actor);
        String revokeReason=reason==null||reason.isBlank()
            ?"POSTDEPLOY_PREPARED_ABORTED":reason.trim();
        if(revokeReason.length()>300)revokeReason=revokeReason.substring(0,300);
        String boundedReason=revokeReason;
        Map<String,Object> revoked=requiresNew.execute(status->{
            Map<String,Object> gate=lockGate();
            if(number(gate.get("revision"))!=expectedRevision
                    ||!"PREPARED".equals(gate.get("approvalStatus"))
                    ||!candidateId.equals(gate.get("postdeployCandidateId")))
                throw new IllegalStateException(
                    "AUTOCOMPLETION_PREPARED_GATE_BINDING_CONFLICT");
            return jdbc.queryForMap("""
                update integrated_design_autocompletion_gate
                   set approval_status='REVOKED',revision=revision+1,revoked_by=?,
                       revoked_at=current_timestamp,revoke_reason=?,updated_at=current_timestamp
                 where gate_key='GLOBAL' and revision=? and approval_status='PREPARED'
                   and postdeploy_candidate_id=?
                returning approval_status as "approvalStatus",revision,
                          runtime_commit as "runtimeCommit",
                          postdeploy_candidate_id as "postdeployCandidateId",
                          revoked_by as "revokedBy",revoked_at as "revokedAt",
                          revoke_reason as "revokeReason"
                """,revokedBy,boundedReason,expectedRevision,candidateId);
        });
        if(revoked==null)throw new IllegalStateException("AUTOCOMPLETION_GATE_UPDATE_FAILED");
        Map<String,Object> result=new LinkedHashMap<>(revoked);
        result.put("success",true);result.put("action","REVOKE_PREPARED");return result;
    }

    private Map<String,Object> lockGate(){
        return jdbc.queryForMap("""
            select approval_status as "approvalStatus",revision,
                   coalesce(runtime_commit,'') as "runtimeCommit",
                   coalesce(postdeploy_candidate_id,'') as "postdeployCandidateId",
                   coalesce(source_input_authority_hash,'') as "sourceInputAuthorityHash",
                   coalesce(final_authority_hash,'') as "finalAuthorityHash",
                   coalesce(canary_process_code,'') as "canaryProcessCode",
                   coalesce(canary_job_id,0)::bigint as "canaryJobId"
              from integrated_design_autocompletion_gate
             where gate_key='GLOBAL' for update
            """);
    }

    Snapshot snapshot(boolean capabilityEnabled,int activeWorkerCount){
        Baseline baseline=readOnly.execute(status->loadBaseline());
        if(baseline==null)throw new IllegalStateException("AUTOCOMPLETION_READINESS_UNAVAILABLE");
        CompilerSnapshot compiler=compilerSnapshot(baseline);
        String sourceHash=readOnly.execute(status->currentAuthoritySetHash());
        String finalHash=readOnly.execute(status->currentFinalAuthoritySetHash());
        boolean stable=baseline.authoritySetHash().equals(sourceHash);
        Map<String,Candidate> ready=stable?compiler.ready():Map.of();
        Map<String,Object> result=new LinkedHashMap<>(baseline.counts());
        result.put("success",true);result.putAll(baseline.readiness());
        long readyIdentities=ready.values().stream().mapToLong(Candidate::identityCount).sum();
        result.put("structurallyReadyIdentityCount",baseline.readiness().get("readyIdentityCount"));
        result.put("structurallyReadyProcessCount",baseline.readiness().get("readyProcessCount"));
        result.put("readyIdentityCount",readyIdentities);
        result.put("readyIdentityInReadyProcessCount",readyIdentities);
        result.put("readyProcessCount",ready.size());
        result.put("dispatchEligibleProcessCount",ready.size());
        result.put("nonReadyIdentityCount",((Number)baseline.readiness()
            .get("totalIdentityCount")).longValue()-readyIdentities);
        result.put("dryRun",true);result.put("parallelism",parallelism);
        result.put("sourceGlobalParallelism",parallelism);
        result.put("perReplicaParallelism",parallelism);
        result.put("configuredReplicas",configuredReplicas);
        result.put("liveSmokeParallelism",physicalParallelism);
        result.put("capabilityEnabled",capabilityEnabled);
        result.put("activeWorkerCount",activeWorkerCount);
        result.put("runtimeCommit",runtimeCommit);
        result.put("currentRuntimeIdentityHash",currentRuntimeIdentityHash());
        result.put("currentAuthoritySetHash",sourceHash);
        result.put("currentSourceInputAuthorityHash",sourceHash);
        result.put("currentFinalAuthoritySetHash",finalHash);
        Map<String,Object> gate=baseline.gate();
        boolean releaseFinalized=finalizerPromoted(runtimeCommit,
            String.valueOf(gate.get("postdeployCandidateId")));
        result.put("releaseFinalized",releaseFinalized);
        result.put("gateStatus",gate.get("approvalStatus"));
        result.put("gateRevision",gate.get("revision"));
        result.put("gateRuntimeCommit",gate.get("runtimeCommit"));
        result.put("gatePostdeployCandidateId",gate.get("postdeployCandidateId"));
        result.put("gateSourceInputAuthorityHash",gate.get("sourceInputAuthorityHash"));
        result.put("gateFinalAuthorityHash",gate.get("finalAuthorityHash"));
        result.put("gateCanaryProcessCode",gate.get("canaryProcessCode"));
        result.put("gateCanaryJobId",gate.get("canaryJobId"));
        result.put("preflightCandidateCount",compiler.candidateCount());
        result.put("preflightCheckedCount",compiler.checkedCount());
        result.put("preflightFailureCount",compiler.failureCount());
        result.put("preflightTimedOutCount",compiler.timedOutCount());
        result.put("preflightLatencyMs",compiler.latencyMillis());
        result.put("preflightCacheHit",compiler.cacheHit());
        result.put("preflightBusy",compiler.busy());
        result.put("preflightQueueCapacity",preflightQueueCapacity);
        result.put("preflightActiveTaskCount",preflightWorkers.getActiveCount());
        result.put("preflightQueuedTaskCount",preflightWorkers.getQueue().size());
        result.put("preflightStable",stable);
        result.put("preflightComplete",stable&&compiler.timedOutCount()==0
            &&compiler.failureCount()==0&&!compiler.busy()
            &&compiler.checkedCount()==compiler.candidateCount());
        List<Map<String,Object>> canaries=stable
            ?currentVerifiedCanaries(sourceHash):List.of();
        int activeCanaries=countCanaries("ACTIVE",runtimeCommit);
        result.put("activeCanaryCount",activeCanaries);
        result.put("currentVerifiedCanaryCount",canaries.size());
        result.put("currentVerifiedCanaryProcessCode",
            canaries.size()==1?canaries.get(0).get("processCode"):"");
        result.put("currentVerifiedCanaryJobId",
            canaries.size()==1?canaries.get(0).get("jobId"):0L);
        result.put("currentVerifiedCanarySourceInputAuthorityHash",
            canaries.size()==1?canaries.get(0).get("sourceInputAuthorityHash"):"");
        result.put("currentVerifiedCanarySourceInputDependencyHash",
            canaries.size()==1?canaries.get(0).get("sourceInputDependencyHash"):"");
        result.put("currentVerifiedCanaryFinalAuthorityHash",
            canaries.size()==1?canaries.get(0).get("finalAuthorityHash"):"");
        long samples=canaries.size()==1?1L:0L;
        long p95=samples==1?((Number)canaries.get(0).get("durationMs")).longValue():0L;
        result.put("physicalSampleCount",samples);result.put("p95CompileMs",p95);
        Long estimate=samples==0?null:estimateSeconds(ready.size(),p95,physicalParallelism);
        Long required=samples==0?null:requiredParallelismFor(ready.size(),p95);
        result.put("estimatedTotalSeconds",estimate);
        result.put("estimatedPhysicalTotalSeconds",estimate);result.put("p95PhysicalMs",p95);
        result.put("requiredParallelism",required);
        result.put("tenMinuteTarget",samples==0?"MEASUREMENT_REQUIRED":
            (estimate!=null&&estimate<600?"PASS":"FAIL"));
        boolean canaryCurrent=canaries.size()==1&&activeCanaries==0;
        boolean prerequisites=canaryCurrent
            &&Boolean.TRUE.equals(result.get("preflightComplete"))
            &&"PASS".equals(result.get("tenMinuteTarget"));
        result.put("quiescentForGateTransition",
            number(result.get("inFlightWorkCount"))==0L&&activeWorkerCount==0);
        boolean evidenceBindingCurrent=runtimeCommit.matches("[0-9a-f]{40}")
            &&runtimeCommit.equals(String.valueOf(gate.get("runtimeCommit")))
            &&!normalizeCandidateId(String.valueOf(gate.get("postdeployCandidateId"))).isEmpty()
            &&sourceHash.equals(String.valueOf(gate.get("sourceInputAuthorityHash")))
            &&canaryCurrent
            &&String.valueOf(canaries.get(0).get("sourceInputAuthorityHash"))
                .equals(String.valueOf(gate.get("sourceInputAuthorityHash")))
            &&String.valueOf(canaries.get(0).get("finalAuthorityHash"))
                .equals(String.valueOf(gate.get("finalAuthorityHash")))
            &&String.valueOf(canaries.get(0).get("processCode"))
                .equals(String.valueOf(gate.get("canaryProcessCode")))
            &&number(canaries.get(0).get("jobId"))==number(gate.get("canaryJobId"));
        boolean preparedBindingCurrent="PREPARED".equals(gate.get("approvalStatus"))
            &&evidenceBindingCurrent
            &&finalHash.equals(String.valueOf(gate.get("finalAuthorityHash")));
        boolean bindingCurrent="ACTIVE".equals(gate.get("approvalStatus"))
            &&evidenceBindingCurrent&&releaseFinalized;
        result.put("preparedBindingCurrent",preparedBindingCurrent);
        result.put("approvalBindingCurrent",bindingCurrent);
        result.put("enablementPrerequisitesMet",prerequisites);
        result.put("automaticEnablementAllowed",
            capabilityEnabled&&bindingCurrent&&prerequisites);
        result.put("enabled",capabilityEnabled&&bindingCurrent&&prerequisites);
        return new Snapshot(Collections.unmodifiableMap(new LinkedHashMap<>(result)),
            Map.copyOf(ready));
    }

    private Baseline loadBaseline(){
        Map<String,Object> counts=jdbc.queryForMap("""
            select (select count(distinct process_code)
                      from framework_composite_design_target_identity)::integer as "totalProcessCount",
                   (select count(*) from framework_composite_design_target_identity)::integer
                     as "screenIdentityCount",
                   count(*) filter(where completion_status='PENDING')::integer as "pendingCount",
                    count(*) filter(where completion_status='RUNNING')::integer as "runningCount",
                    count(*) filter(where completion_status in('RUNNING',
                      'SOURCE_APPLIED_GENERATION_QUEUED','SOURCE_APPLIED_UNCHANGED',
                      'SOURCE_APPLIED_PHYSICAL_QUEUED'))::integer as "inFlightWorkCount",
                   count(*) filter(where completion_status in('SOURCE_APPLIED_PHYSICAL_QUEUED',
                     'PHYSICAL_GENERATED_VERIFIED'))::integer as "appliedCount",
                   count(*) filter(where completion_status='PHYSICAL_GENERATED_VERIFIED')::integer
                     as "physicalVerifiedCount",
                   count(*) filter(where completion_status='BLOCKED')::integer as "blockedCount",
                   count(*) filter(where completion_status='PHYSICAL_GENERATED_VERIFIED'
                     and duration_ms is not null)::integer as "historicalPhysicalSampleCount",
                   coalesce(percentile_disc(0.95) within group(order by duration_ms)
                     filter(where completion_status='PHYSICAL_GENERATED_VERIFIED'
                       and duration_ms is not null),0)::bigint as "historicalP95PhysicalMs"
              from integrated_design_autocompletion_receipt
            """);
        Map<String,Object> readiness=jdbc.queryForMap(READINESS_SQL);
        List<Candidate> candidates=jdbc.queryForList("select process_code,identity_count,"+
            "dependency_fingerprint from ("+COMPILER_READY_PROCESS_SQL+
            ") candidate order by process_code collate \"C\"").stream()
            .map(row->new Candidate(String.valueOf(row.get("process_code")),
                ((Number)row.get("identity_count")).intValue(),
                String.valueOf(row.get("dependency_fingerprint")))).toList();
        Map<String,Object> gate=jdbc.queryForMap("""
            select approval_status as "approvalStatus",revision,
                   coalesce(runtime_commit,'') as "runtimeCommit",
                   coalesce(postdeploy_candidate_id,'') as "postdeployCandidateId",
                   coalesce(source_input_authority_hash,'') as "sourceInputAuthorityHash",
                   coalesce(final_authority_hash,'') as "finalAuthorityHash",
                   coalesce(canary_process_code,'') as "canaryProcessCode",
                   coalesce(canary_job_id,0)::bigint as "canaryJobId"
              from integrated_design_autocompletion_gate where gate_key='GLOBAL'
            """);
        return new Baseline(counts,readiness,String.valueOf(
            readiness.get("currentAuthoritySetHash")),candidates,gate);
    }

    private CompilerSnapshot compilerSnapshot(Baseline baseline){
        long now=System.currentTimeMillis();CompilerSnapshot current=cached;
        if(current!=null&&current.authoritySetHash().equals(baseline.authoritySetHash())
                &&now-current.completedAtMillis()<=cacheMillis)
            return current.asCacheHit();
        if(!preflightSingleFlight.tryAcquire())return busySnapshot(baseline,false);
        try{
            now=System.currentTimeMillis();current=cached;
            if(current!=null&&current.authoritySetHash().equals(baseline.authoritySetHash())
                    &&now-current.completedAtMillis()<=cacheMillis)
                return current.asCacheHit();
            preflightWorkers.purge();
            if(preflightWorkers.getActiveCount()>0||!preflightWorkers.getQueue().isEmpty()){
                CompilerSnapshot busy=busySnapshot(baseline,false);cached=busy;return busy;
            }
            long started=System.nanoTime();
            List<Callable<CandidateResult>> tasks=baseline.candidates().stream()
                .<Callable<CandidateResult>>map(candidate->()->compile(candidate)).toList();
            Map<String,Candidate> ready=new LinkedHashMap<>();
            int checked=0,failures=0,timeouts=0;
            try{
                List<Future<CandidateResult>> futures=preflightWorkers.invokeAll(tasks,
                    preflightBudgetMillis,TimeUnit.MILLISECONDS);
                for(Future<CandidateResult> future:futures){
                    if(future.isCancelled()){timeouts++;continue;}
                    checked++;
                    try{CandidateResult result=future.get();
                        if(result.ready())ready.put(result.candidate().process(),result.candidate());
                        else failures++;
                    }catch(Exception error){failures++;}
                }
            }catch(RejectedExecutionException error){
                timeouts=tasks.size();
            }catch(InterruptedException error){
                Thread.currentThread().interrupt();timeouts=tasks.size()-checked;
            }finally{preflightWorkers.purge();}
            long latency=TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-started);
            boolean busy=preflightWorkers.getActiveCount()>0
                ||!preflightWorkers.getQueue().isEmpty();
            CompilerSnapshot computed=new CompilerSnapshot(baseline.authoritySetHash(),
                Map.copyOf(ready),baseline.candidates().size(),checked,failures,timeouts,
                latency,false,busy,System.currentTimeMillis());
            cached=computed;
            return computed;
        }finally{
            preflightSingleFlight.release();
        }
    }

    private CompilerSnapshot busySnapshot(Baseline baseline,boolean cacheHit){
        return new CompilerSnapshot(baseline.authoritySetHash(),Map.of(),
            baseline.candidates().size(),0,0,baseline.candidates().size(),0L,cacheHit,true,
            System.currentTimeMillis());
    }

    private CandidateResult compile(Candidate candidate){
        try{
            Map<String,Object> report=governance.inspectCompositeCompilerReadiness(candidate.process());
            boolean ready=Boolean.TRUE.equals(report.get("success"))
                &&"PASS".equals(report.get("compilerClosure"))
                &&report.get("identityCount") instanceof Number identities
                &&identities.intValue()==candidate.identityCount()
                &&report.get("documentCount") instanceof Number documents
                &&documents.intValue()==candidate.identityCount()*18;
            return new CandidateResult(candidate,ready);
        }catch(RuntimeException error){return new CandidateResult(candidate,false);}
    }

    void acquireGlobalDispatchLock(long key){
        jdbc.queryForList("select pg_advisory_xact_lock(?)",key);
    }

    void assertActiveExecutionBinding(long expectedRevision,String expectedCommit,
            String expectedSourceHash,String expectedRuntimeIdentity){
        String commit=normalizeCommit(expectedCommit);
        String sourceHash=normalizeHash(expectedSourceHash);
        String runtimeIdentity=normalizeHash(expectedRuntimeIdentity);
        Map<String,Object> gate=jdbc.queryForMap("""
            select approval_status as "approvalStatus",revision,
                   coalesce(runtime_commit,'') as "runtimeCommit",
                   coalesce(postdeploy_candidate_id,'') as "postdeployCandidateId",
                   coalesce(source_input_authority_hash,'') as "sourceInputAuthorityHash",
                   coalesce(final_authority_hash,'') as "finalAuthorityHash",
                   coalesce(canary_process_code,'') as "canaryProcessCode",
                   coalesce(canary_job_id,0)::bigint as "canaryJobId"
              from integrated_design_autocompletion_gate
             where gate_key='GLOBAL' for share
            """);
        if(!"ACTIVE".equals(gate.get("approvalStatus"))
                ||number(gate.get("revision"))!=expectedRevision
                ||commit.isEmpty()||sourceHash.isEmpty()||runtimeIdentity.isEmpty()
                ||!runtimeCommit.equals(commit)
                ||!commit.equals(gate.get("runtimeCommit"))
                ||!sourceHash.equals(gate.get("sourceInputAuthorityHash")))
            throw new IllegalStateException("AUTOCOMPLETION_ACTIVE_GATE_STALE");
        String currentSourceHash=currentAuthoritySetHash();
        String currentRuntimeIdentity=currentRuntimeIdentityHash(commit,true);
        List<Map<String,Object>> canaries=currentVerifiedCanaries(sourceHash);
        boolean exact=sourceHash.equals(currentSourceHash)
            &&runtimeIdentity.equals(currentRuntimeIdentity)
            &&canaries.size()==1
            &&sourceHash.equals(String.valueOf(canaries.get(0).get("sourceInputAuthorityHash")))
            &&String.valueOf(gate.get("finalAuthorityHash")).equals(
                String.valueOf(canaries.get(0).get("finalAuthorityHash")))
            &&String.valueOf(gate.get("canaryProcessCode")).equals(
                String.valueOf(canaries.get(0).get("processCode")))
            &&number(gate.get("canaryJobId"))==number(canaries.get(0).get("jobId"))
            &&finalizerPromoted(commit,String.valueOf(gate.get("postdeployCandidateId")));
        if(!exact)throw new IllegalStateException(
            "AUTOCOMPLETION_RUNTIME_CANARY_BINDING_STALE");
    }

    boolean retainActiveGateOrRevokeOnSourceDrift(long expectedRevision,String expectedCommit,
            String expectedSourceHash,String actor){
        Map<String,Object> gate=lockGate();
        String commit=normalizeCommit(expectedCommit);
        String sourceHash=normalizeHash(expectedSourceHash);
        if(!"ACTIVE".equals(gate.get("approvalStatus"))
                ||number(gate.get("revision"))!=expectedRevision
                ||!commit.equals(gate.get("runtimeCommit"))
                ||!sourceHash.equals(gate.get("sourceInputAuthorityHash")))return false;
        if(sourceHash.equals(currentAuthoritySetHash()))return true;
        int updated=jdbc.update("""
            update integrated_design_autocompletion_gate
               set approval_status='REVOKED',revision=revision+1,revoked_by=?,
                   revoked_at=current_timestamp,revoke_reason='SOURCE_INPUT_DRIFT_AT_CLAIM',
                   updated_at=current_timestamp
             where gate_key='GLOBAL' and revision=? and approval_status='ACTIVE'
               and runtime_commit=? and source_input_authority_hash=?
            """,normalizeActor(actor),expectedRevision,commit,sourceHash);
        if(updated!=1)throw new IllegalStateException(
            "AUTOCOMPLETION_SOURCE_DRIFT_REVOKE_CAS_LOST");
        return false;
    }

    void assertAuthoritySetCurrent(String expected){
        if(!expected.matches("[0-9a-f]{64}")||!expected.equals(currentAuthoritySetHash()))
            throw new IllegalStateException("AUTOCOMPLETION_AUTHORITY_SET_CHANGED");
    }

    void assertProcessSourceCurrent(String process,String expected){
        String normalized=normalizeHash(expected);
        String current=jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint(?)",String.class,process);
        if(normalized.isEmpty()||!normalized.equals(current))throw new IllegalStateException(
            "AUTOCOMPLETION_PROCESS_SOURCE_CHANGED");
    }

    boolean retainCanaryClaimOrInvalidate(String process,String token,String expectedGlobalHash,
            String expectedProcessHash,String expectedCommit,String expectedRuntimeIdentity,
            String expectedCanaryId,int expectedAttempt){
        List<Map<String,Object>> claims=jdbc.queryForList("""
            select receipt.receipt_json#>>'{canary,canaryId}' as "canaryId",
                   receipt.receipt_json#>>'{canary,status}' as "canaryStatus",
                   receipt.receipt_json#>>'{canary,requestedSourceAuthorityHash}' as
                     "sourceAuthorityHash",
                   receipt.receipt_json#>>'{canary,requestedSourceDependencyHash}' as
                     "sourceDependencyHash",
                   receipt.receipt_json#>>'{canary,runtimeCommit}' as "runtimeCommit",
                   receipt.receipt_json#>>'{canary,requestedRuntimeIdentityHash}' as
                     "runtimeIdentityHash",
                   receipt.receipt_json#>>'{canary,attemptNumber}' as "attemptNumber",
                   receipt.receipt_json->>'sourceInputDependencyHash' as "rootDependencyHash",
                   receipt.dependency_fingerprint as "dependencyFingerprint",
                   receipt.lease_until>=clock_timestamp() as "leaseCurrent",
                   receipt.job_id is null as "jobUnassigned"
              from integrated_design_autocompletion_receipt receipt
             where receipt.process_code=? and receipt.lease_token=?::uuid
               and receipt.completion_status='RUNNING'
             for update of receipt
            """,process,token);
        if(claims.size()!=1)
            throw new IllegalStateException("AUTOCOMPLETION_CANARY_CLAIM_CAS_LOST");
        Map<String,Object> claim=claims.get(0);
        boolean claimCurrent=Boolean.TRUE.equals(claim.get("leaseCurrent"))
            &&Boolean.TRUE.equals(claim.get("jobUnassigned"))
            &&expectedCanaryId.equals(claim.get("canaryId"))
            &&"ACTIVE".equals(claim.get("canaryStatus"))
            &&Integer.toString(expectedAttempt).equals(claim.get("attemptNumber"))
            &&expectedProcessHash.equals(claim.get("rootDependencyHash"))
            &&expectedProcessHash.equals(claim.get("dependencyFingerprint"))
            &&expectedGlobalHash.equals(claim.get("sourceAuthorityHash"))
            &&expectedProcessHash.equals(claim.get("sourceDependencyHash"))
            &&expectedCommit.equals(claim.get("runtimeCommit"))
            &&expectedRuntimeIdentity.equals(claim.get("runtimeIdentityHash"));
        String currentGlobal=currentAuthoritySetHash();
        String currentProcess=jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint(?)",String.class,process);
        String currentIdentity=currentRuntimeIdentityHash(expectedCommit,true);
        if(claimCurrent&&expectedGlobalHash.equals(currentGlobal)&&expectedProcessHash.equals(currentProcess)
                &&expectedRuntimeIdentity.equals(currentIdentity))return true;
        int updated=jdbc.update("""
            update integrated_design_autocompletion_receipt
               set completion_status='PENDING',job_id=null,lease_token=null,lease_until=null,
                   blocker_code=null,started_at=null,completed_at=null,duration_ms=null,
                   dependency_fingerprint=?,receipt_json=receipt_json||jsonb_build_object(
                     'generationStatus','CANARY_SOURCE_BINDING_CHANGED_REQUEUE',
                     'sourceCommitted',false,'jobCount',0,
                     'canary',(receipt_json->'canary')||jsonb_build_object(
                       'status','INVALIDATED','invalidatedAt',clock_timestamp(),
                       'failureCode','SOURCE_OR_RUNTIME_BINDING_CHANGED')),
                   updated_at=current_timestamp
             where process_code=? and lease_token=?::uuid and completion_status='RUNNING'
            """,currentProcess,process,token);
        if(updated!=1)throw new IllegalStateException("AUTOCOMPLETION_CANARY_INVALIDATE_CAS_LOST");
        return false;
    }

    int invalidateStalePhysicalRevalidations(){
        return jdbc.update("""
            with current_runtime as materialized (
              select runtime.source_commit,
                     framework_runtime_release_identity_hash(runtime) runtime_identity_hash
                from framework_runtime_release_state runtime
               where runtime.release_key='CARBONET_RUNTIME'
                 and runtime.health_status='UP'
               for share of runtime
            ), stale_receipt as materialized (
              select receipt.process_code,receipt.job_id,
                     receipt.receipt_json->>'liveSmokeDispatchId' dispatch_id,
                     receipt.dependency_fingerprint=
                       framework_composite_dependency_fingerprint(receipt.process_code)
                       source_current
                from integrated_design_autocompletion_receipt receipt
               where (receipt.receipt_json#>>'{canary,status}'='VERIFIED' or
                     (receipt.receipt_json#>>'{canary,status}'='ACTIVE' and
                      receipt.receipt_json#>>'{canary,physicalRevalidation}'='true'))
                  and (receipt.dependency_fingerprint is distinct from
                         framework_composite_dependency_fingerprint(receipt.process_code)
                   or not exists(select 1 from current_runtime runtime
                     where runtime.source_commit=
                             receipt.receipt_json#>>'{canary,runtimeCommit}'
                        and runtime.runtime_identity_hash=
                              receipt.receipt_json#>>'{canary,requestedRuntimeIdentityHash}')
                   or (receipt.receipt_json#>>'{canary,status}'='VERIFIED' and not
                     framework_composite_verified_canary_dispatch_exact(receipt.process_code,
                       receipt.job_id,receipt.receipt_json)))
               for update of receipt
            ), stale_dispatch as (
              update integrated_design_live_smoke_dispatch dispatch
                 set status='SUPERSEDED',lease_token=null,lease_until=null,
                     completed_at=coalesce(dispatch.completed_at,clock_timestamp()),
                     last_error_code='RUNTIME_OR_SOURCE_SUPERSEDED',
                     last_error_hash=framework_composite_live_smoke_hash(jsonb_build_object(
                       'dispatchId',dispatch.dispatch_id,
                       'runtimeCommit',dispatch.runtime_commit,
                       'runtimeIdentityHash',dispatch.runtime_identity_hash))
                from stale_receipt stale
               where stale.dispatch_id~'^[0-9]+$'
                  and stale.dispatch_id=dispatch.dispatch_id::text
                  and stale.job_id=dispatch.job_id
                  and stale.process_code=dispatch.process_code
                  and dispatch.status<>'SUPERSEDED'
              returning dispatch.dispatch_id,dispatch.process_code
            )
            update integrated_design_autocompletion_receipt receipt
               set completion_status=case when stale.source_current
                     then 'PHYSICAL_GENERATED_VERIFIED' else receipt.completion_status end,
                   blocker_code=case when stale.source_current
                     then null else receipt.blocker_code end,
                   receipt_json=receipt.receipt_json||jsonb_build_object(
                     'generationStatus','PHYSICAL_REVALIDATION_INVALIDATED',
                     'liveSmokeDispatchStatus','SUPERSEDED',
                     'physicalVerified',stale.source_current,
                     'liveSmokeVerified',false,
                      'canary',(receipt.receipt_json->'canary')||jsonb_build_object(
                        'status','INVALIDATED','invalidatedAt',clock_timestamp(),
                        'failureCode','RUNTIME_OR_SOURCE_SUPERSEDED',
                        'physicalRevalidation',stale.source_current,
                        'sourceReused',stale.source_current,'sourceWriteCount',0)),
                   completed_at=case when stale.source_current
                     then clock_timestamp() else receipt.completed_at end,
                   duration_ms=case when stale.source_current
                     then greatest(0,(extract(epoch from
                       (clock_timestamp()-receipt.started_at))*1000)::bigint)
                     else receipt.duration_ms end,updated_at=current_timestamp
              from stale_receipt stale
             where receipt.process_code=stale.process_code
            """);
    }

    int nextCanaryAttempt(String commit,String authoritySetHash){
        invalidateStalePhysicalRevalidations();
        jdbc.update("""
            update integrated_design_live_smoke_dispatch dispatch
               set status='SUPERSEDED',lease_token=null,lease_until=null,
                   completed_at=coalesce(dispatch.completed_at,clock_timestamp()),
                   last_error_code='CANARY_ATTEMPT_EXPIRED',
                   last_error_hash=framework_composite_live_smoke_hash(jsonb_build_object(
                     'dispatchId',dispatch.dispatch_id,'reason','CANARY_ATTEMPT_EXPIRED'))
              from integrated_design_autocompletion_receipt receipt
             where receipt.receipt_json#>>'{canary,status}'='ACTIVE'
               and receipt.receipt_json#>>'{canary,physicalRevalidation}'='true'
               and receipt.receipt_json->>'liveSmokeDispatchId'=dispatch.dispatch_id::text
               and receipt.completion_status='SOURCE_APPLIED_PHYSICAL_QUEUED'
               and (receipt.started_at is null or receipt.started_at<current_timestamp-
                    (? * interval '1 second'))
               and dispatch.status<>'SUPERSEDED'
            """,CANARY_ATTEMPT_TIMEOUT_SECONDS);
        jdbc.update("""
            update integrated_design_autocompletion_receipt
               set completion_status=case
                     when receipt_json#>>'{canary,physicalRevalidation}'='true'
                       then 'PHYSICAL_GENERATED_VERIFIED' else completion_status end,
                   blocker_code=case
                     when receipt_json#>>'{canary,physicalRevalidation}'='true'
                       then null else blocker_code end,
                   completed_at=case
                     when receipt_json#>>'{canary,physicalRevalidation}'='true'
                       then clock_timestamp() else completed_at end,
                   receipt_json=receipt_json||jsonb_build_object('canary',
                     (receipt_json->'canary')||jsonb_build_object('status','FAILED',
                       'failedAt',clock_timestamp(),'failureCode',case
                         when completion_status='RUNNING' then 'LEASE_EXPIRED'
                         else 'PHYSICAL_VERIFICATION_TIMEOUT' end)),
                   updated_at=current_timestamp
             where receipt_json#>>'{canary,status}' in('ACTIVE','RETRY_WAIT')
               and ((completion_status='RUNNING'
                     and (lease_until is null or lease_until<current_timestamp))
                 or (completion_status='SOURCE_APPLIED_PHYSICAL_QUEUED'
                     and (started_at is null or started_at<current_timestamp-
                       (? * interval '1 second'))))
            """,CANARY_ATTEMPT_TIMEOUT_SECONDS);
        Integer active=jdbc.queryForObject("""
            select count(*)::integer from integrated_design_autocompletion_receipt
             where receipt_json#>>'{canary,status}' in('ACTIVE','RETRY_WAIT')
            """,Integer.class);
        int verified=currentVerifiedCanaries(authoritySetHash).size();
        Integer attempts=jdbc.queryForObject("""
            select coalesce(max(case when receipt_json#>>'{canary,attemptNumber}'~'^[0-9]+$'
                    then (receipt_json#>>'{canary,attemptNumber}')::integer else 0 end),0)::integer
              from integrated_design_autocompletion_receipt
             where receipt_json#>>'{canary,runtimeCommit}'=?
               and receipt_json#>>'{canary,requestedSourceAuthorityHash}'=?
               and receipt_json#>>'{canary,requestedSourceDependencyHash}'=
                   receipt_json->>'sourceInputDependencyHash'
               and receipt_json#>>'{canary,requestedSourceDependencyHash}'=
                   framework_composite_dependency_fingerprint(process_code)
            """,Integer.class,commit,authoritySetHash);
        if((active!=null&&active>0)||verified>0)
            throw new IllegalStateException("CANARY_ALREADY_EXISTS_FOR_RUNTIME");
        int prior=attempts==null?0:attempts;
        if(prior>=3)throw new IllegalStateException("CANARY_RETRY_LIMIT_REACHED");
        return prior+1;
    }

    void prepareCanaryRetry(String commit,String authoritySetHash){
        jdbc.update("""
            update integrated_design_autocompletion_receipt
               set completion_status='PENDING',attempt_count=0,lease_token=null,lease_until=null,
                   job_id=null,blocker_code=null,started_at=null,completed_at=null,duration_ms=null,
                   updated_at=current_timestamp
             where receipt_json#>>'{canary,runtimeCommit}'=?
               and receipt_json#>>'{canary,requestedSourceAuthorityHash}'=?
               and receipt_json#>>'{canary,status}' in('FAILED','INVALIDATED')
               and coalesce(receipt_json#>>'{canary,physicalRevalidation}','false')<>'true'
               and receipt_json#>>'{canary,requestedSourceDependencyHash}'=
                   receipt_json->>'sourceInputDependencyHash'
               and receipt_json#>>'{canary,requestedSourceDependencyHash}'=
                   framework_composite_dependency_fingerprint(process_code)
               and completion_status in('RUNNING','BLOCKED','PHYSICAL_FAILED',
                 'SOURCE_APPLIED_PHYSICAL_QUEUED')
            """,commit,authoritySetHash);
    }

    List<Map<String,Object>> rearmPhysicalCanary(String canaryId,String commit,
            String authoritySetHash,int attempt){
        String normalizedCommit=normalizeCommit(commit);
        String normalizedHash=normalizeHash(authoritySetHash);
        if(!canaryId.matches("[0-9a-fA-F-]{36}")||normalizedCommit.isEmpty()
                ||normalizedHash.isEmpty()||attempt<1||attempt>3)
            throw new IllegalArgumentException("CANARY_REVALIDATION_BINDING_INVALID");
        return jdbc.queryForList("""
            with binding as materialized (
              select ?::uuid canary_id,?::varchar runtime_commit,
                     ?::varchar source_hash,?::integer attempt
            ), target as materialized (
              select distinct upper(process_code) process_code
                from framework_composite_design_target_identity
            ), current_set as materialized (
              select framework_composite_live_smoke_hash(coalesce(jsonb_agg(
                       jsonb_build_object('processCode',process_code,
                         'dependencyFingerprint',
                           framework_composite_dependency_fingerprint(process_code))
                       order by process_code collate "C"),'[]'::jsonb)) source_hash
                from target
            ), runtime as materialized (
              select state.source_commit,
                     framework_runtime_release_identity_hash(state) runtime_identity_hash
                from framework_runtime_release_state state,binding
               where state.release_key='CARBONET_RUNTIME' and state.health_status='UP'
                 and state.source_commit=binding.runtime_commit
               for share of state
            ), gate as materialized (
              select approval_status,runtime_commit,source_input_authority_hash,
                     canary_process_code,canary_job_id
                from integrated_design_autocompletion_gate
               where gate_key='GLOBAL' for update
            ), locked_receipt as materialized (
              select receipt.*,framework_composite_dependency_fingerprint(
                       receipt.process_code) current_process_hash
                from integrated_design_autocompletion_receipt receipt
                join target using(process_code)
               order by receipt.process_code collate "C" for update of receipt
            ), facts as materialized (
              select (select count(*) from target) target_count,
                     count(*) filter(where completion_status='PHYSICAL_GENERATED_VERIFIED'
                       and job_id is not null
                       and dependency_fingerprint=current_process_hash) verified_count,
                     count(*) filter(where receipt_json#>>'{canary,status}'='ACTIVE')
                       active_count
                from locked_receipt
            ), candidate as (
              select receipt.process_code,receipt.job_id,receipt.current_process_hash,
                     receipt.receipt_json,runtime.runtime_identity_hash,binding.*
                from locked_receipt receipt,binding,current_set,runtime,gate,facts
               where facts.target_count>0 and facts.active_count=0
                 and gate.approval_status='ACTIVE'
                 and gate.source_input_authority_hash=binding.source_hash
                 and gate.runtime_commit<>binding.runtime_commit
                 and current_set.source_hash=binding.source_hash
                 and not exists(select 1 from locked_receipt prior
                   where prior.receipt_json#>>'{canary,runtimeCommit}'=binding.runtime_commit
                     and prior.receipt_json#>>'{canary,status}'='VERIFIED')
                 and receipt.job_id is not null
                 and receipt.dependency_fingerprint=receipt.current_process_hash
                 and ((binding.attempt=1 and facts.verified_count=facts.target_count
                       and receipt.process_code=gate.canary_process_code
                       and receipt.job_id=gate.canary_job_id)
                   or (binding.attempt between 2 and 3
                       and receipt.receipt_json#>>'{canary,physicalRevalidation}'='true'
                       and receipt.receipt_json#>>'{canary,runtimeCommit}'=
                           binding.runtime_commit
                       and receipt.receipt_json#>>'{canary,status}' in('FAILED','INVALIDATED')
                       and receipt.receipt_json#>>'{canary,attemptNumber}'=
                           (binding.attempt-1)::text
                       and not exists(select 1 from locked_receipt other
                         where other.process_code<>receipt.process_code and(
                           other.completion_status<>'PHYSICAL_GENERATED_VERIFIED'
                           or other.job_id is null
                           or other.dependency_fingerprint<>other.current_process_hash))))
               order by receipt.process_code collate "C" limit 1
            )
            update integrated_design_autocompletion_receipt receipt
               set completion_status='SOURCE_APPLIED_PHYSICAL_QUEUED',
                   lease_token=null,lease_until=null,blocker_code=null,
                   receipt_json=(receipt.receipt_json-'liveSmokeDispatchId'
                     -'liveSmokeDispatchStatus'-'liveSmokeEvidenceCount'
                     -'liveSmokeEvidenceSetHash')||jsonb_build_object(
                       'sourceInputDependencyHash',candidate.current_process_hash,
                       'previousCanary',receipt.receipt_json->'canary',
                       'generationStatus','PHYSICAL_REVALIDATION_QUEUED',
                       'physicalVerified',false,'liveSmokeVerified',false,
                       'sourceReused',true,'sourceWriteCount',0,
                       'canary',jsonb_build_object(
                         'canaryId',candidate.canary_id,'status','ACTIVE',
                         'attemptNumber',candidate.attempt,
                         'runtimeCommit',candidate.runtime_commit,
                         'requestedRuntimeIdentityHash',candidate.runtime_identity_hash,
                         'requestedSourceAuthorityHash',candidate.source_hash,
                         'requestedSourceDependencyHash',candidate.current_process_hash,
                         'physicalRevalidation',true,'sourceReused',true,
                         'sourceWriteCount',0,'startedAt',clock_timestamp())),
                   started_at=clock_timestamp(),completed_at=null,duration_ms=null,
                   updated_at=current_timestamp
              from candidate
             where receipt.process_code=candidate.process_code
               and receipt.job_id=candidate.job_id
            returning receipt.process_code as "processCode",receipt.job_id as "jobId",
                      true as "physicalRevalidation",true as "sourceReused",
                      candidate.canary_id::text as "canaryId"
            """,canaryId,normalizedCommit,normalizedHash,attempt);
    }

    int globallyRunning(){
        Integer count=jdbc.queryForObject("""
            select count(*)::integer from integrated_design_autocompletion_receipt
             where completion_status='RUNNING' and lease_until>=current_timestamp
            """,Integer.class);
        return count==null?0:count;
    }

    String runtimeCommit(){return runtimeCommit;}

    String currentRuntimeIdentityHash(){return currentRuntimeIdentityHash(runtimeCommit,false);}

    private String currentRuntimeIdentityHash(String commit,boolean lock){
        if(!normalizeCommit(commit).matches("[0-9a-f]{40}"))return "";
        List<String> rows=jdbc.queryForList("""
            select framework_runtime_release_identity_hash(runtime)
              from framework_runtime_release_state runtime
             where runtime.release_key='CARBONET_RUNTIME' and runtime.health_status='UP'
               and runtime.source_commit=?
            """+(lock?" for share of runtime":""),String.class,normalizeCommit(commit));
        return rows.size()==1?rows.get(0):"";
    }

    private int globallyInFlight(){
        Integer count=jdbc.queryForObject("""
            select count(*)::integer from integrated_design_autocompletion_receipt
             where completion_status in('RUNNING','SOURCE_APPLIED_GENERATION_QUEUED',
               'SOURCE_APPLIED_UNCHANGED','SOURCE_APPLIED_PHYSICAL_QUEUED')
            """,Integer.class);
        return count==null?0:count;
    }

    void acquireSourceExecutionSlot(long slotBase,int slots,String process){
        int bounded=Math.max(1,Math.min(slots,8));
        int start=Math.floorMod(process.hashCode(),bounded);
        for(int offset=0;offset<bounded;offset++){
            int slot=(start+offset)%bounded;
            Boolean acquired=jdbc.queryForObject(
                "select pg_try_advisory_xact_lock(?)",Boolean.class,slotBase+slot);
            if(Boolean.TRUE.equals(acquired))return;
        }
        jdbc.queryForList("select pg_advisory_xact_lock(?)",slotBase+start);
    }

    void lockCompilerSourceRegistries(){
        jdbc.execute("""
            lock table comtnthemedefinition,integrated_design_notification_template,
              ui_component_registry,ui_section_registry in share mode
            """);
    }

    void discover(){
        jdbc.update("""
            insert into integrated_design_autocompletion_receipt(
              process_code,completion_status,dependency_fingerprint,receipt_json)
            select eligible.process_code,'PENDING',eligible.dependency_fingerprint,
                   case when not exists(select 1 from integrated_design_authority authority
                          where authority.process_code=eligible.process_code)
                     then jsonb_build_object('requestedScope',jsonb_build_object(
                       'scopeType','GLOBAL','source','MIGRATION_GLOBAL_TARGET'))
                     else '{}'::jsonb end
              from (
            """+COMPILER_READY_PROCESS_SQL+"""
              ) eligible
            on conflict(process_code) do nothing
            """);
    }

    List<Map<String,Object>> claimOne(Candidate candidate,String token,int leaseSeconds,
            String receiptJson){
        return jdbc.queryForList("""
            with candidate as (
              select receipt.process_code
                from integrated_design_autocompletion_receipt receipt
               where receipt.process_code=?
                 and framework_composite_dependency_fingerprint(receipt.process_code)=?
                 and exists(select 1 from (
            """+COMPILER_READY_PROCESS_SQL+"""
                   ) eligible where eligible.process_code=receipt.process_code
                     and eligible.dependency_fingerprint=?)
                 and ((receipt.completion_status='PENDING'
                       and receipt.blocker_code is distinct from 'RETRY_WAIT') or
                   (receipt.completion_status='RUNNING'
                    and not jsonb_exists(receipt.receipt_json,'serializationRetryContext') and
                    (receipt.lease_until is null or receipt.lease_until<current_timestamp)))
               for update skip locked
            )
            update integrated_design_autocompletion_receipt receipt
               set completion_status='RUNNING',lease_token=?::uuid,
                   lease_until=current_timestamp+(? * interval '1 second'),
                   attempt_count=attempt_count+1,blocker_code=null,
                   receipt_json=(case when receipt.blocker_code='RETRY_WAIT'
                       then receipt.receipt_json-'retryNotBeforeEpochMs'-'retryDelayMs'-'blocker'
                       else receipt.receipt_json-'serializationRetryAttempt'
                         -'serializationRetryLimit'-'serializationRetryContext'
                         -'retryNotBeforeEpochMs'-'retryDelayMs'-'blocker'
                     end)||?::jsonb,
                   dependency_fingerprint=?,started_at=coalesce(started_at,current_timestamp),
                   completed_at=null,duration_ms=null,updated_at=current_timestamp
              from candidate where receipt.process_code=candidate.process_code
            returning receipt.process_code as "processCode",receipt.lease_token as "leaseToken"
            """,candidate.process(),candidate.dependencyFingerprint(),
            candidate.dependencyFingerprint(),token,leaseSeconds,receiptJson,
            candidate.dependencyFingerprint());
    }

    List<Map<String,Object>> claimSerializationRetry(Candidate candidate,String token,
            int leaseSeconds,String receiptJson,String retryContextJson){
        return jdbc.queryForList("""
            with candidate as (
              select receipt.process_code
                from integrated_design_autocompletion_receipt receipt
               where receipt.process_code=?
                 and receipt.completion_status='PENDING'
                 and receipt.blocker_code='RETRY_WAIT'
                 and receipt.receipt_json->'serializationRetryContext'=?::jsonb
                 and receipt.receipt_json->>'retryNotBeforeEpochMs'~'^[0-9]{1,20}$'
                 and (receipt.receipt_json->>'retryNotBeforeEpochMs')::numeric<=
                     extract(epoch from clock_timestamp())*1000
                 and framework_composite_dependency_fingerprint(receipt.process_code)=?
                 and exists(select 1 from (
            """+COMPILER_READY_PROCESS_SQL+"""
                   ) eligible where eligible.process_code=receipt.process_code
                     and eligible.dependency_fingerprint=?)
               for update skip locked
            )
            update integrated_design_autocompletion_receipt receipt
               set completion_status='RUNNING',lease_token=?::uuid,
                   lease_until=current_timestamp+(? * interval '1 second'),
                   attempt_count=attempt_count+1,blocker_code=null,
                   receipt_json=(receipt.receipt_json-'retryNotBeforeEpochMs'
                     -'retryDelayMs'-'blocker')||?::jsonb,
                   dependency_fingerprint=?,started_at=coalesce(started_at,current_timestamp),
                   completed_at=null,duration_ms=null,updated_at=current_timestamp
              from candidate where receipt.process_code=candidate.process_code
            returning receipt.process_code as "processCode",receipt.lease_token as "leaseToken"
            """,candidate.process(),retryContextJson,candidate.dependencyFingerprint(),
            candidate.dependencyFingerprint(),token,leaseSeconds,receiptJson,
            candidate.dependencyFingerprint());
    }

    int clearSupersededSerializationRetries(String mode,long revision,String runtimeCommit,
            String sourceInputHash,String runtimeIdentityHash){
        return jdbc.update("""
            update integrated_design_autocompletion_receipt receipt
               set completion_status='PENDING',blocker_code=null,job_id=null,
                   lease_token=null,lease_until=null,started_at=null,completed_at=null,
                   duration_ms=null,attempt_count=0,
                   receipt_json=(receipt.receipt_json-'serializationRetryAttempt'
                     -'serializationRetryLimit'-'serializationRetryContext'
                     -'retryNotBeforeEpochMs'-'retryDelayMs'-'blocker')||case
                       when receipt.receipt_json#>>'{canary,status}'='RETRY_WAIT' then
                         jsonb_build_object('canary',((receipt.receipt_json->'canary')
                           -'retryAt'-'failureCode')||jsonb_build_object(
                             'status','INVALIDATED','invalidatedAt',clock_timestamp(),
                             'failureCode','SERIALIZATION_RETRY_SUPERSEDED'))
                       else '{}'::jsonb end,
                   dependency_fingerprint=framework_composite_dependency_fingerprint(
                     receipt.process_code),updated_at=current_timestamp
             where receipt.completion_status='PENDING' and receipt.blocker_code='RETRY_WAIT'
               and receipt.receipt_json#>>'{serializationRetryContext,mode}'=?
               and (coalesce(receipt.receipt_json#>>'{serializationRetryContext,gateRevision}','')
                       is distinct from ?::text
                 or coalesce(receipt.receipt_json#>>'{serializationRetryContext,runtimeCommit}','')
                       is distinct from ?
                 or coalesce(receipt.receipt_json#>>'{serializationRetryContext,sourceInputHash}','')
                       is distinct from ?
                 or coalesce(receipt.receipt_json#>>'{serializationRetryContext,runtimeIdentityHash}','')
                       is distinct from ?)
            """,mode,Long.toString(revision),runtimeCommit,sourceInputHash,runtimeIdentityHash);
    }

    int heartbeatLease(TransactionTemplate requiresNew,String process,String token,int leaseSeconds){
        Integer updated=requiresNew.execute(status->jdbc.update("""
            update integrated_design_autocompletion_receipt
               set lease_until=current_timestamp+(? * interval '1 second'),
                   updated_at=current_timestamp
             where process_code=? and lease_token=?::uuid
               and completion_status='RUNNING' and lease_until>=current_timestamp
            """,leaseSeconds,process,token));
        return updated==null?0:updated;
    }

    private List<Map<String,Object>> currentVerifiedCanaries(String sourceAuthorityHash){
        if(!runtimeCommit.matches("[0-9a-f]{40}")
                ||!sourceAuthorityHash.matches("[0-9a-f]{64}"))
            return List.of();
        return jdbc.queryForList("""
            select receipt.process_code as "processCode",receipt.duration_ms as "durationMs",
                   receipt.job_id as "jobId",
                   receipt.receipt_json#>>'{canary,requestedSourceAuthorityHash}' as
                     "sourceInputAuthorityHash",
                   receipt.receipt_json#>>'{canary,requestedSourceDependencyHash}' as
                     "sourceInputDependencyHash",
                   receipt.receipt_json#>>'{canary,verifiedFinalAuthorityHash}' as
                     "finalAuthorityHash"
              from integrated_design_autocompletion_receipt receipt
              join integrated_design_live_smoke_dispatch dispatch
                on receipt.receipt_json->>'liveSmokeDispatchId'~'^[0-9]+$'
               and dispatch.dispatch_id=(receipt.receipt_json->>'liveSmokeDispatchId')::bigint
               and dispatch.job_id=receipt.job_id and dispatch.process_code=receipt.process_code
               and dispatch.status='COMPLETED'
                and dispatch.runtime_commit=receipt.receipt_json#>>'{canary,runtimeCommit}'
                and dispatch.runtime_identity_hash=
                    receipt.receipt_json#>>'{canary,requestedRuntimeIdentityHash}'
                and receipt.receipt_json#>>'{canary,attemptNumber}'~'^[1-3]$'
                and dispatch.canary_attempt=
                    (receipt.receipt_json#>>'{canary,attemptNumber}')::integer
              join framework_runtime_release_state runtime
                on runtime.release_key='CARBONET_RUNTIME' and runtime.health_status='UP'
               and runtime.source_commit=dispatch.runtime_commit
               and dispatch.runtime_identity_hash=framework_runtime_release_identity_hash(runtime)
             where receipt.completion_status='PHYSICAL_GENERATED_VERIFIED'
               and receipt.duration_ms is not null
               and receipt.receipt_json#>>'{canary,status}'='VERIFIED'
               and receipt.receipt_json#>>'{canary,runtimeCommit}'=?
               and receipt.receipt_json#>>'{canary,requestedSourceAuthorityHash}'=?
               and receipt.receipt_json#>>'{canary,verifiedFinalAuthorityHash}'~'^[0-9a-f]{64}$'
               and receipt.receipt_json#>>'{canary,requestedSourceDependencyHash}'=
                   receipt.receipt_json->>'sourceInputDependencyHash'
               and nullif(receipt.receipt_json#>>'{canary,physicalVerifiedAt}','') is not null
                and receipt.dependency_fingerprint=
                    framework_composite_dependency_fingerprint(receipt.process_code)
                and framework_composite_verified_canary_dispatch_exact(receipt.process_code,
                      receipt.job_id,receipt.receipt_json)
              order by receipt.process_code collate "C"
             for share of receipt,dispatch,runtime
            """,runtimeCommit,sourceAuthorityHash);
    }

    private int countCanaries(String status,String commit){
        if(!commit.matches("[0-9a-f]{40}"))return 0;
        Integer count=jdbc.queryForObject("""
            select count(*)::integer from integrated_design_autocompletion_receipt
             where receipt_json#>>'{canary,status}'=?
               and receipt_json#>>'{canary,runtimeCommit}'=?
            """,Integer.class,status,commit);
        return count==null?0:count;
    }

    private String currentAuthoritySetHash(){
        return jdbc.queryForObject(AUTHORITY_SET_HASH_SQL,String.class);
    }

    private String currentFinalAuthoritySetHash(){
        return jdbc.queryForObject(FINAL_AUTHORITY_SET_HASH_SQL,String.class);
    }

    private boolean finalizerPromoted(String commit,String candidateId){
        if(!commit.matches("[0-9a-f]{40}")
                ||normalizeCandidateId(candidateId).isEmpty())return false;
        Boolean promoted=jdbc.queryForObject("""
            with current_runtime as (
              select runtime.source_commit,runtime.health_status,
                     framework_runtime_release_identity_hash(runtime) runtime_identity_hash
                from framework_runtime_release_state runtime
               where runtime.release_key='CARBONET_RUNTIME'
                 and runtime.health_status='UP' and runtime.source_commit=?
            )
            select exists(
              select 1 from current_runtime runtime
              join framework_postdeploy_release_attempt attempt
                on attempt.source_commit=runtime.source_commit
              join framework_postdeploy_evidence_promotion promotion
                on promotion.candidate_id=attempt.candidate_id
               and promotion.source_commit=attempt.source_commit
               and promotion.promotion_id=attempt.promotion_id
               and promotion.runtime_identity_hash=attempt.runtime_identity_hash
              join integrated_design_autocompletion_gate gate
                on gate.gate_key='GLOBAL'
               and gate.runtime_commit=attempt.source_commit
               and gate.postdeploy_candidate_id=attempt.candidate_id
               and attempt.attempt_status='PROMOTED'
               and attempt.terminal_reason='PROMOTION_COMMITTED'
               and attempt.runtime_identity_hash is not null
               and attempt.runtime_identity_hash=runtime.runtime_identity_hash
               and attempt.promotion_id is not null
               and attempt.terminal_at is not null
               and gate.approved_at is not null
               and attempt.terminal_at>=gate.approved_at
             where attempt.candidate_id=?
            )
            """,Boolean.class,commit,candidateId);
        return Boolean.TRUE.equals(promoted);
    }

    static long estimateSeconds(long processCount,long p95Millis,int slots){
        return ceilDiv(saturatedMultiply(processCount,p95Millis),
            saturatedMultiply(Math.max(1,slots),1000L));
    }

    static long requiredParallelismFor(long processCount,long p95Millis){
        return saturatedMultiply(processCount,p95Millis)/TEN_MINUTE_MILLIS+1L;
    }

    private static long saturatedMultiply(long left,long right){
        try{return Math.multiplyExact(left,right);}catch(ArithmeticException ignored){return Long.MAX_VALUE;}
    }

    private static long ceilDiv(long numerator,long denominator){
        if(denominator<=0)throw new IllegalArgumentException("AUTOCOMPLETION_DIVISOR_INVALID");
        return numerator==0?0:1L+(numerator-1L)/denominator;
    }

    private static String normalizeCommit(String value){
        String normalized=value==null?"":value.trim().toLowerCase();
        return normalized.matches("[0-9a-f]{40}")?normalized:"";
    }

    private static String normalizeHash(String value){
        String normalized=value==null?"":value.trim().toLowerCase();
        return normalized.matches("[0-9a-f]{64}")?normalized:"";
    }

    private static String normalizeCandidateId(String value){
        String normalized=value==null?"":value.trim();
        return normalized.matches("[A-Za-z0-9._:-]{12,160}")?normalized:"";
    }

    private static String normalizeActor(String value){
        String normalized=value==null?"":value.trim().toUpperCase(Locale.ROOT);
        if(normalized.isEmpty())throw new IllegalArgumentException(
            "AUTOCOMPLETION_APPROVAL_ACTOR_REQUIRED");
        return normalized.length()<=100?normalized:normalized.substring(0,100);
    }

    private static long number(Object value){return value instanceof Number number
        ?number.longValue():0L;}

    record Candidate(String process,int identityCount,String dependencyFingerprint){}
    record Snapshot(Map<String,Object> report,Map<String,Candidate> readyProcesses){}
    private record CandidateResult(Candidate candidate,boolean ready){}
    private record Baseline(Map<String,Object> counts,Map<String,Object> readiness,
        String authoritySetHash,List<Candidate> candidates,Map<String,Object> gate){}
    private record CompilerSnapshot(String authoritySetHash,Map<String,Candidate> ready,
            int candidateCount,int checkedCount,int failureCount,int timedOutCount,
            long latencyMillis,boolean cacheHit,boolean busy,long completedAtMillis){
        CompilerSnapshot asCacheHit(){return new CompilerSnapshot(authoritySetHash,ready,
            candidateCount,checkedCount,failureCount,timedOutCount,latencyMillis,true,busy,
            completedAtMillis);}
    }

    private static final String AUTHORITY_SET_HASH_SQL="""
        select framework_composite_live_smoke_hash(coalesce(jsonb_agg(
                 jsonb_build_object('processCode',process_code,
                   'dependencyFingerprint',framework_composite_dependency_fingerprint(process_code))
                 order by process_code collate "C"),'[]'::jsonb))
          from (select distinct upper(process_code) process_code
                  from framework_composite_design_target_identity) target
        """;

    private static final String FINAL_AUTHORITY_SET_HASH_SQL="""
        select framework_composite_live_smoke_hash(coalesce(jsonb_agg(
                 jsonb_build_object('processCode',process_code,
                   'finalAuthorityFingerprint',
                     framework_composite_final_authority_fingerprint(process_code))
                 order by process_code collate "C"),'[]'::jsonb))
          from (select distinct upper(process_code) process_code
                  from framework_composite_design_target_identity) target
        """;

    private static final String READINESS_SQL="""
        with target as materialized (
          select upper(process_code) process_code,upper(step_code) step_code,
                 upper(audience) audience,lower(split_part(route_path,'?',1)) route_path,
                 contract_id,contract_count
            from framework_composite_design_target_identity
        ), resource as materialized (
          select lower(split_part(btrim(route_key),'?',1)) route_path,count(*)::integer resource_count
            from framework_screen_resource where btrim(route_key)~'^/'
           group by lower(split_part(btrim(route_key),'?',1))
        ), contract as materialized (
          select contract_id,
                 api_contract is json array and jsonb_array_length(api_contract::jsonb)>0
                   and data_contract is json array and jsonb_array_length(data_contract::jsonb)>0
                   and section_contract is json array and jsonb_array_length(section_contract::jsonb)>0
                   and field_contract is json array and jsonb_array_length(field_contract::jsonb)>0
                   as complete_lanes
            from framework_professional_screen_contract
        ), blueprint as materialized (
          select target.process_code,target.step_code,target.audience,target.route_path,
                 count(blueprint.blueprint_id)::integer blueprint_count,
                 count(blueprint.blueprint_id) filter(where
                   blueprint.transition_status='CONTRACT_LINKED' and
                   lower(btrim(coalesce(blueprint.source_reference,''))) in(
                     'professional_screen_contract:'||target.contract_id::text,
                     'framework_professional_screen_contract:'||target.contract_id::text)
                 )::integer explicit_authority_count
            from target left join framework_screen_blueprint blueprint
              on upper(blueprint.process_code)=target.process_code
             and upper(blueprint.step_code)=target.step_code
             and upper(blueprint.audience)=target.audience
             and lower(split_part(btrim(blueprint.route_path),'?',1))=target.route_path
             and blueprint.validation_status='VALID'
           group by target.process_code,target.step_code,target.audience,target.route_path,
                    target.contract_id
        ), identity as materialized (
          select target.process_code,
                 target.contract_count=1 and coalesce(contract.complete_lanes,false)
                   and coalesce(resource.resource_count,0)=1
                   and (blueprint.blueprint_count=1 or
                     (blueprint.blueprint_count>1 and blueprint.explicit_authority_count=1)) ready
            from target left join resource using(route_path)
            left join contract using(contract_id)
            join blueprint using(process_code,step_code,audience,route_path)
        ), process_rollup as materialized (
          select process_code,count(*)::integer identity_count,
                 count(*) filter(where ready)::integer ready_count
            from identity group by process_code
        ), authority_set as materialized (
          select framework_composite_live_smoke_hash(coalesce(jsonb_agg(
                   jsonb_build_object('processCode',process_code,
                     'dependencyFingerprint',framework_composite_dependency_fingerprint(process_code))
                   order by process_code collate "C"),'[]'::jsonb)) set_hash
            from (select distinct process_code from target) all_process
        )
        select (select count(*)::integer from identity) as "totalIdentityCount",
               (select count(*)::integer from process_rollup) as "totalProcessCount",
               (select count(*)::integer from identity where ready) as "readyIdentityCount",
               (select count(*)::integer from process_rollup where ready_count>0) as
                 "processesWithReadyIdentityCount",
               (select count(*)::integer from process_rollup where ready_count>0
                 and ready_count<identity_count) as "partiallyReadyProcessCount",
               (select count(*)::integer from process_rollup
                 where ready_count=identity_count) as "readyProcessCount",
               (select count(*)::integer from identity join process_rollup using(process_code)
                 where process_rollup.ready_count=process_rollup.identity_count) as
                 "readyIdentityInReadyProcessCount",
               (select set_hash from authority_set) as "currentAuthoritySetHash"
        """;

    static final String COMPILER_READY_PROCESS_SQL="""
        select target.process_code,count(*)::integer identity_count,
               framework_composite_dependency_fingerprint(target.process_code)
                 dependency_fingerprint
          from framework_composite_design_target_identity target
         group by target.process_code
        having bool_and(target.contract_count=1 and exists(
                 select 1 from framework_professional_screen_contract contract
                  where contract.contract_id=target.contract_id
                    and contract.api_contract is json array
                    and jsonb_array_length(contract.api_contract::jsonb)>0
                    and contract.data_contract is json array
                    and jsonb_array_length(contract.data_contract::jsonb)>0
                    and contract.section_contract is json array
                    and jsonb_array_length(contract.section_contract::jsonb)>0
                    and contract.field_contract is json array
                    and jsonb_array_length(contract.field_contract::jsonb)>0)
               and exists(select 1 from integrated_design_document document
                 where document.process_code=target.process_code
                   and document.step_code=target.step_code
                   and document.route_path=target.route_path
                   and document.audience=target.audience and document.active_yn='Y'
                having count(*)=18 and count(distinct document.document_type)=18
                   and bool_and(document.status in('READY','APPROVED','VERIFIED'))
                   and bool_and(document.document_type in(
                     'REQUIREMENT','ACTOR_RACI','AUTHORITY','PROCESS','STATE','NAVIGATION',
                     'ACTIVE_UI','DESIGN_ASSET','FIELD_DICTIONARY','DATA_HANDOFF','DATABASE','API',
                     'BUSINESS_RULE','VALIDATION','NOTIFICATION','TEST','TASK_EVIDENCE','RELEASE_AUDIT'))
                   and bool_and(coalesce(jsonb_typeof(framework_try_jsonb(document.content))='object'
                     and framework_try_jsonb(document.content)->>'schemaVersion'=
                       'carbonet.integrated-design-axis/v1'
                     and upper(framework_try_jsonb(document.content)->>'documentType')=
                       document.document_type
                     and upper(framework_try_jsonb(document.content)#>>'{identity,processCode}')=
                       upper(target.process_code)
                     and upper(framework_try_jsonb(document.content)#>>'{identity,stepCode}')=
                       upper(target.step_code)
                     and lower(framework_try_jsonb(document.content)#>>'{identity,routePath}')=
                       lower(target.route_path)
                     and upper(framework_try_jsonb(document.content)#>>'{identity,audience}')=
                       upper(target.audience),false)))
               and 1=(select count(*) from framework_screen_resource resource
                 where lower(split_part(btrim(resource.route_key),'?',1))=
                       lower(split_part(target.route_path,'?',1)))
               and (1=(select count(*) from framework_screen_blueprint blueprint
                 where upper(blueprint.process_code)=upper(target.process_code)
                   and upper(blueprint.step_code)=upper(target.step_code)
                   and upper(blueprint.audience)=upper(target.audience)
                   and lower(split_part(btrim(blueprint.route_path),'?',1))=
                       lower(split_part(target.route_path,'?',1))
                   and blueprint.validation_status='VALID')
                 or (1<(select count(*) from framework_screen_blueprint blueprint
                   where upper(blueprint.process_code)=upper(target.process_code)
                     and upper(blueprint.step_code)=upper(target.step_code)
                     and upper(blueprint.audience)=upper(target.audience)
                     and lower(split_part(btrim(blueprint.route_path),'?',1))=
                         lower(split_part(target.route_path,'?',1))
                     and blueprint.validation_status='VALID')
                   and 1=(select count(*) from framework_screen_blueprint blueprint
                     where upper(blueprint.process_code)=upper(target.process_code)
                       and upper(blueprint.step_code)=upper(target.step_code)
                       and upper(blueprint.audience)=upper(target.audience)
                       and lower(split_part(btrim(blueprint.route_path),'?',1))=
                           lower(split_part(target.route_path,'?',1))
                       and blueprint.validation_status='VALID'
                       and blueprint.transition_status='CONTRACT_LINKED'
                        and lower(btrim(coalesce(blueprint.source_reference,''))) in(
                          'professional_screen_contract:'||target.contract_id::text,
                          'framework_professional_screen_contract:'||target.contract_id::text)))))
        """;

    @PreDestroy public void close(){preflightWorkers.shutdownNow();}
}
