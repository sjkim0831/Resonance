package egovframework.com.platform.governance.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.lang.reflect.Modifier;
import java.sql.SQLException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.AbstractExecutorService;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.BooleanSupplier;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CompositeDesignOperationalWorkerReplicaCapacityTest {
    @Test
    void rawManualDispatchRemainsNonPublicAndApprovedFacadeIsPublic() throws Exception {
        int rawModifiers=CompositeDesignOperationalWorker.class
            .getDeclaredMethod("dispatch",int.class).getModifiers();
        int approvedModifiers=CompositeDesignOperationalWorker.class
            .getDeclaredMethod("dispatchApproved",int.class).getModifiers();

        assertFalse(Modifier.isPublic(rawModifiers));
        assertTrue(Modifier.isPublic(approvedModifiers));
    }

    @Test
    void automaticSerializationFailuresRequeueTwiceThenCommitSourceExactlyOnce() throws Exception {
        SharedReceiptStore store=activeApprovalStore(1);
        AtomicInteger compilerAttempts=new AtomicInteger();
        ActorProcessGovernanceService governance=serializationRetryGovernance(
            compilerAttempts,2,"40001");
        ReplicaJdbcTemplate jdbc=new ReplicaJdbcTemplate(store);
        NoOpTransactions transactions=new NoOpTransactions(store);
        CompositeAutocompletionReadinessService readiness=
            new CompositeAutocompletionReadinessService(jdbc,governance,transactions,
                1,1,1,store.runtimeCommit,"","");
        CompositeDesignOperationalWorker worker=new CompositeDesignOperationalWorker(jdbc,
            new ObjectMapper(),governance,readiness,transactions,true,1,1,false,600,30);
        try{
            assertEquals(1,worker.dispatchApproved(1).get("claimedCount"));
            long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(2);
            while((store.sourceWriteCount!=1||store.running!=0)&&System.nanoTime()<deadline)
                Thread.sleep(10L);
            assertTrue(store.sourceWriteCount==1&&store.running==0,
                "attempts="+compilerAttempts.get()+", claims="+store.claimCount+
                    ", running="+store.running+", pending="+store.pending.size()+
                    ", retries="+store.serializationRetryAttempt+", blocker="+store.lastBlocker);
            assertEquals(3,compilerAttempts.get());
            assertEquals(3,store.claimCount);
            assertEquals(1,store.sourceWriteCount);
            assertEquals(0,store.blockedCount);
            assertEquals(0,store.serializationRetryAttempt);
            assertEquals(0,store.pending.size());
        }finally{worker.close();readiness.close();}
    }

    @Test
    void manualSerializationFailuresRequeueTwiceThenCommitSourceExactlyOnce() throws Exception {
        SharedReceiptStore store=new SharedReceiptStore(1);
        AtomicInteger compilerAttempts=new AtomicInteger();
        ActorProcessGovernanceService governance=serializationRetryGovernance(
            compilerAttempts,2,"40001");
        ReplicaJdbcTemplate jdbc=new ReplicaJdbcTemplate(store);
        NoOpTransactions transactions=new NoOpTransactions(store);
        CompositeDesignOperationalWorker worker=new CompositeDesignOperationalWorker(
            jdbc,new ObjectMapper(),governance,transactions,false,1,1,false);
        try{
            assertEquals(1,worker.dispatch(1).get("claimedCount"));
            await(()->store.sourceWriteCount==1&&store.running==0,2_000);
            assertEquals(3,compilerAttempts.get());
            assertEquals(3,store.claimCount);
            assertEquals(1,store.sourceWriteCount);
            assertEquals(0,store.blockedCount);
            assertEquals(0,store.serializationRetryAttempt);
            assertEquals(0,store.pending.size());
        }finally{worker.close();}
    }

    @Test
    void canarySerializationRetryReclaimsTheSameCanaryAttemptAndCommitsOnce()
            throws Exception {
        SharedReceiptStore store=new SharedReceiptStore(1);
        store.runtimeCommit="c".repeat(40);
        store.sourceAuthorityHash="a".repeat(64);
        AtomicInteger compilerAttempts=new AtomicInteger();
        ActorProcessGovernanceService governance=serializationRetryGovernance(
            compilerAttempts,2,"40001");
        ReplicaJdbcTemplate jdbc=new ReplicaJdbcTemplate(store);
        NoOpTransactions transactions=new NoOpTransactions(store);
        CompositeAutocompletionReadinessService readiness=
            new CompositeAutocompletionReadinessService(jdbc,governance,transactions,
                1,1,1,store.runtimeCommit,"","");
        CompositeDesignOperationalWorker worker=new CompositeDesignOperationalWorker(jdbc,
            new ObjectMapper(),governance,readiness,transactions,true,1,1,false,600,30);
        try{
            Map<String,Object> dispatch=worker.dispatchCanary();
            assertEquals(1,dispatch.get("canaryAttempt"));
            await(()->store.sourceWriteCount==1&&store.running==0,2_000);
            assertEquals(3,compilerAttempts.get());
            assertEquals(3,store.claimCount);
            assertEquals(1,store.nextCanaryAttemptQueryCount);
            assertEquals(1,store.persistedCanaryAttempt);
            assertEquals(String.valueOf(dispatch.get("canaryId")),store.persistedCanaryId);
            assertEquals(1,store.sourceWriteCount);
        }finally{worker.close();readiness.close();}
    }

    @Test
    void thirdSerializationFailureBlocksWithoutSourceWriteAndDeadlockIsNotRetried()
            throws Exception {
        SharedReceiptStore exhaustedStore=new SharedReceiptStore(1);
        AtomicInteger serializationAttempts=new AtomicInteger();
        ActorProcessGovernanceService serializationGovernance=serializationRetryGovernance(
            serializationAttempts,Integer.MAX_VALUE,"40001");
        CompositeDesignOperationalWorker exhausted=new CompositeDesignOperationalWorker(
            new ReplicaJdbcTemplate(exhaustedStore),new ObjectMapper(),serializationGovernance,
            new NoOpTransactions(exhaustedStore),false,1,1,false);
        SharedReceiptStore deadlockStore=new SharedReceiptStore(1);
        AtomicInteger deadlockAttempts=new AtomicInteger();
        CompositeDesignOperationalWorker deadlock=new CompositeDesignOperationalWorker(
            new ReplicaJdbcTemplate(deadlockStore),new ObjectMapper(),
            serializationRetryGovernance(deadlockAttempts,Integer.MAX_VALUE,"40P01"),
            new NoOpTransactions(deadlockStore),false,1,1,false);
        try{
            exhausted.dispatch(1);
            await(()->exhaustedStore.blockedCount==1&&exhaustedStore.running==0,2_000);
            assertEquals(3,serializationAttempts.get(),exhaustedStore.lastBlocker);
            assertEquals(3,exhaustedStore.claimCount);
            assertEquals(0,exhaustedStore.sourceWriteCount);
            assertEquals(3,exhaustedStore.serializationRetryAttempt);
            assertEquals(0,exhaustedStore.pending.size());

            deadlock.dispatch(1);
            await(()->deadlockStore.blockedCount==1&&deadlockStore.running==0,1_000);
            assertEquals(1,deadlockAttempts.get());
            assertEquals(1,deadlockStore.claimCount);
            assertEquals(0,deadlockStore.sourceWriteCount);
            assertEquals(0,deadlockStore.pending.size());
        }finally{exhausted.close();deadlock.close();}
    }

    @Test
    void retryWaitCannotBeStolenAndDurableSweepResumesAfterBoundedCapacityDeferral()
            throws Exception {
        SharedReceiptStore store=new SharedReceiptStore(1);
        AtomicInteger compilerAttempts=new AtomicInteger();
        ActorProcessGovernanceService governance=serializationRetryGovernance(
            compilerAttempts,1,"40001");
        ReplicaJdbcTemplate jdbc=new ReplicaJdbcTemplate(store);
        NoOpTransactions transactions=new NoOpTransactions(store);
        CompositeDesignOperationalWorker worker=new CompositeDesignOperationalWorker(
            jdbc,new ObjectMapper(),governance,transactions,false,1,1,false);
        try{
            worker.dispatch(1);
            await(()->store.retryWait&&store.running==0,1_000);
            store.globalRunningOverride=1;
            Thread.sleep(450L);
            assertEquals(1,compilerAttempts.get());
            assertEquals(1,store.claimCount);
            assertEquals(0,worker.dispatch(1).get("claimedCount"),
                "ordinary/manual claim must not steal a RETRY_WAIT receipt");
            assertEquals(1,store.claimCount);

            store.globalRunningOverride=-1;
            worker.runScheduledBatch();
            await(()->store.sourceWriteCount==1&&store.running==0,1_000);
            assertEquals(2,compilerAttempts.get());
            assertEquals(2,store.claimCount);
            assertEquals(1,store.sourceWriteCount);
        }finally{worker.close();}
    }

    @Test
    void rejectedHeartbeatSchedulerReturnsRunningLeaseToDurableRetryWait() throws Exception {
        SharedReceiptStore store=new SharedReceiptStore(1);
        ActorProcessGovernanceService governance=serializationRetryGovernance(
            new AtomicInteger(),0,"40001");
        ReplicaJdbcTemplate jdbc=new ReplicaJdbcTemplate(store);
        NoOpTransactions transactions=new NoOpTransactions(store);
        CompositeDesignOperationalWorker worker=new CompositeDesignOperationalWorker(
            jdbc,new ObjectMapper(),governance,transactions,false,1,1,false);
        try{
            var field=CompositeDesignOperationalWorker.class.getDeclaredField("leaseHeartbeats");
            field.setAccessible(true);
            ((ScheduledExecutorService)field.get(worker)).shutdownNow();
            assertEquals(1,worker.dispatch(1).get("claimedCount"));
            await(()->store.retryWait&&store.running==0,1_000);
            assertEquals(0,store.sourceWriteCount);
            assertEquals(1,store.claimCount);
            assertEquals(1,store.pending.size());
        }finally{worker.close();}
    }

    @Test
    void rejectedWorkerExecutorReturnsRunningLeaseWithoutLocalCapacityLeak() throws Exception {
        SharedReceiptStore store=new SharedReceiptStore(1);
        ActorProcessGovernanceService governance=serializationRetryGovernance(
            new AtomicInteger(),0,"40001");
        ReplicaJdbcTemplate jdbc=new ReplicaJdbcTemplate(store);
        NoOpTransactions transactions=new NoOpTransactions(store);
        CompositeDesignOperationalWorker worker=new CompositeDesignOperationalWorker(
            jdbc,new ObjectMapper(),governance,transactions,false,1,1,false);
        try{
            var workersField=CompositeDesignOperationalWorker.class.getDeclaredField("workers");
            workersField.setAccessible(true);
            ((ExecutorService)workersField.get(worker)).shutdownNow();
            var heartbeatField=
                CompositeDesignOperationalWorker.class.getDeclaredField("leaseHeartbeats");
            heartbeatField.setAccessible(true);
            ((ScheduledExecutorService)heartbeatField.get(worker)).shutdownNow();
            Map<String,Object> dispatch=worker.dispatch(1);
            assertEquals(1,dispatch.get("claimedCount"));
            assertEquals(0,dispatch.get("activeWorkerCount"));
            assertTrue(store.retryWait);
            assertEquals(0,store.running);
            assertEquals(0,store.sourceWriteCount);
            assertEquals(1,store.claimCount);
            assertEquals(1,store.pending.size());
        }finally{worker.close();}
    }

    @Test
    void closeRequeuesAcceptedButNotStartedClaimWithoutWaitingForLeaseExpiry() throws Exception {
        SharedReceiptStore store=new SharedReceiptStore(1);
        ActorProcessGovernanceService governance=serializationRetryGovernance(
            new AtomicInteger(),0,"40001");
        ReplicaJdbcTemplate jdbc=new ReplicaJdbcTemplate(store);
        NoOpTransactions transactions=new NoOpTransactions(store);
        CompositeDesignOperationalWorker worker=new CompositeDesignOperationalWorker(
            jdbc,new ObjectMapper(),governance,transactions,false,1,1,false);
        try{
            var workersField=CompositeDesignOperationalWorker.class.getDeclaredField("workers");
            workersField.setAccessible(true);
            ((ExecutorService)workersField.get(worker)).shutdownNow();
            HoldingExecutor holding=new HoldingExecutor();
            workersField.set(worker,holding);
            Map<String,Object> dispatch=worker.dispatch(1);
            assertEquals(1,dispatch.get("claimedCount"));
            assertEquals(1,dispatch.get("activeWorkerCount"));
            assertEquals(1,holding.queuedCount());
            assertEquals(1,store.running);

            worker.close();
            var runningField=CompositeDesignOperationalWorker.class.getDeclaredField("running");
            runningField.setAccessible(true);
            assertEquals(0,((AtomicInteger)runningField.get(worker)).get());
            assertTrue(store.retryWait);
            assertEquals(0,store.running);
            assertEquals(0,store.sourceWriteCount);
            assertEquals(1,store.claimCount);
            assertEquals(1,store.pending.size());
            assertEquals(0,holding.queuedCount());
        }finally{worker.close();}
    }

    @Test
    void twoRuntimeReplicasShareOneGlobalEightWorkerCapacity() throws Exception {
        SharedReceiptStore store=new SharedReceiptStore(20);
        ActorProcessGovernanceService blockedGovernance=mock(ActorProcessGovernanceService.class);
        when(blockedGovernance.inspectCompositeCompilerReadiness(anyString())).thenAnswer(call->
            Map.of("success",true,"compilerClosure","PASS","identityCount",1,
                "documentCount",18));
        doThrow(new IllegalStateException("TEST_WORK_REMAINS_LEASED"))
            .when(blockedGovernance).lockCompositeProcessAuthority(anyString());
        CompositeDesignOperationalWorker first=new CompositeDesignOperationalWorker(
            new ReplicaJdbcTemplate(store),new ObjectMapper(),blockedGovernance,new NoOpTransactions(store),
            false,8,25,false,8,2);
        CompositeDesignOperationalWorker second=new CompositeDesignOperationalWorker(
            new ReplicaJdbcTemplate(store),new ObjectMapper(),blockedGovernance,new NoOpTransactions(store),
            false,8,25,false,8,2);
        ExecutorService callers=Executors.newFixedThreadPool(2);
        try{
            Future<Map<String,Object>> firstCall=callers.submit(()->first.dispatch(25));
            Future<Map<String,Object>> secondCall=callers.submit(()->second.dispatch(25));
            Map<String,Object> firstReceipt=firstCall.get();
            Map<String,Object> secondReceipt=secondCall.get();
            int total=((Number)firstReceipt.get("claimedCount")).intValue()+
                ((Number)secondReceipt.get("claimedCount")).intValue();
            assertEquals(8,total);
            assertEquals(8,store.running);
        }finally{callers.shutdownNow();first.close();second.close();}
    }

    @Test
    void exactCompilerPreflightChecks108ProcessesInsideFifteenSecondBudget(){
        SharedReceiptStore store=new SharedReceiptStore(108);
        ActorProcessGovernanceService governance=readyGovernance();
        CompositeAutocompletionReadinessService readiness=
            new CompositeAutocompletionReadinessService(new ReplicaJdbcTemplate(store),governance,
                new NoOpTransactions(store),8,8,2,"","","");
        try{
            long started=System.nanoTime();
            Map<String,Object> first=readiness.inspect(false,0);
            long elapsed=TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-started);
            assertTrue(elapsed<15_000,"108-process preflight took "+elapsed+"ms");
            assertEquals(108,first.get("preflightCandidateCount"));
            assertEquals(108,first.get("preflightCheckedCount"));
            assertEquals(0,first.get("preflightFailureCount"));
            assertEquals(0,first.get("preflightTimedOutCount"));
            assertEquals(108,first.get("readyProcessCount"));
            assertEquals(true,first.get("preflightComplete"));
            assertFalse((Boolean)first.get("preflightCacheHit"));
            Map<String,Object> cached=readiness.inspect(false,0);
            assertTrue((Boolean)cached.get("preflightCacheHit"));
        }finally{readiness.close();}
    }

    @Test
    void compilerPreflightTimeoutIsBoundedAndFailsClosed(){
        SharedReceiptStore store=new SharedReceiptStore(16);
        ActorProcessGovernanceService slow=mock(ActorProcessGovernanceService.class);
        when(slow.inspectCompositeCompilerReadiness(anyString())).thenAnswer(call->{
            try{Thread.sleep(2_000);}catch(InterruptedException interrupted){
                Thread.currentThread().interrupt();throw new IllegalStateException("INTERRUPTED");}
            return Map.of("success",true,"compilerClosure","PASS","identityCount",1,
                "documentCount",18);
        });
        CompositeAutocompletionReadinessService readiness=
            new CompositeAutocompletionReadinessService(new ReplicaJdbcTemplate(store),slow,
                new NoOpTransactions(store),8,8,2,"","","",8,1_000,0);
        try{
            long started=System.nanoTime();Map<String,Object> report=readiness.inspect(false,0);
            long elapsed=TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-started);
            assertTrue(elapsed<2_000,"timed-out preflight took "+elapsed+"ms");
            assertTrue(((Number)report.get("preflightTimedOutCount")).intValue()>0);
            assertEquals(false,report.get("preflightComplete"));
            assertEquals(false,report.get("automaticEnablementAllowed"));
        }finally{readiness.close();}
    }

    @Test
    void timedOutPreflightIsSingleFlightCachedAndCannotAccumulateJdbcWork(){
        SharedReceiptStore store=new SharedReceiptStore(16);
        AtomicInteger calls=new AtomicInteger();CountDownLatch release=new CountDownLatch(1);
        ActorProcessGovernanceService stuck=mock(ActorProcessGovernanceService.class);
        when(stuck.inspectCompositeCompilerReadiness(anyString())).thenAnswer(call->{
            calls.incrementAndGet();
            while(release.getCount()>0)try{release.await();}
                catch(InterruptedException ignored){/* emulate an uninterruptible JDBC driver */}
            return Map.of("success",true,"compilerClosure","PASS","identityCount",1,
                "documentCount",18);
        });
        CompositeAutocompletionReadinessService readiness=
            new CompositeAutocompletionReadinessService(new ReplicaJdbcTemplate(store),stuck,
                new NoOpTransactions(store),8,8,2,"","","",8,1_000,30_000);
        try{
            Map<String,Object> timedOut=readiness.inspect(false,0);
            int submitted=calls.get();
            Map<String,Object> cached=readiness.inspect(false,0);
            assertTrue((Boolean)timedOut.get("preflightBusy"));
            assertTrue((Boolean)cached.get("preflightCacheHit"));
            assertEquals(submitted,calls.get());
            assertTrue(submitted<=8,"more than the bounded worker set entered JDBC");
            assertEquals(256,cached.get("preflightQueueCapacity"));
            assertFalse((Boolean)cached.get("preflightComplete"));
        }finally{release.countDown();readiness.close();}
    }

    @Test
    void queuedCanaryRetriesUsePersistedProcessSourceH0AndDenyFourthAttempt(){
        SharedReceiptStore store=new SharedReceiptStore(1);
        store.runtimeCommit="a".repeat(40);
        store.sourceAuthorityHash="b".repeat(64);
        store.finalAuthorityHash="c".repeat(64);
        store.maxCanaryAttempt=1;
        CompositeAutocompletionReadinessService readiness=
            new CompositeAutocompletionReadinessService(new ReplicaJdbcTemplate(store),
                readyGovernance(),new NoOpTransactions(store),8,8,2,store.runtimeCommit,"","");
        try{
            assertEquals(2,readiness.nextCanaryAttempt(
                store.runtimeCommit,store.sourceAuthorityHash));
            assertTrue(store.staleCanaryCleanupObserved);
            readiness.prepareCanaryRetry(store.runtimeCommit,store.sourceAuthorityHash);
            assertEquals(1,store.canaryRetryPreparedCount);

            // Physical output H1 advances, but the campaign and process input H0 stay fixed.
            store.finalAuthorityHash="d".repeat(64);store.maxCanaryAttempt=2;
            assertEquals(3,readiness.nextCanaryAttempt(
                store.runtimeCommit,store.sourceAuthorityHash));
            readiness.prepareCanaryRetry(store.runtimeCommit,store.sourceAuthorityHash);
            assertEquals(2,store.canaryRetryPreparedCount);

            store.maxCanaryAttempt=3;
            assertThrows(IllegalStateException.class,()->readiness.nextCanaryAttempt(
                store.runtimeCommit,store.sourceAuthorityHash));
            assertEquals(2,store.canaryRetryPreparedCount);
            assertTrue(store.persistedProcessSourcePredicateObserved);
        }finally{readiness.close();}
    }

    @Test
    void durableGateBindsDistinctSourceH0AndVerifiedFinalH1(){
        SharedReceiptStore store=new SharedReceiptStore(1);
        store.runtimeCommit="c".repeat(40);store.sourceAuthorityHash="0".repeat(64);
        store.finalAuthorityHash="f".repeat(64);
        store.sourceInputAuthorityHash="0".repeat(64);
        store.gateStatus="ACTIVE";store.currentVerifiedCanary=true;
        CompositeAutocompletionReadinessService readiness=
            new CompositeAutocompletionReadinessService(new ReplicaJdbcTemplate(store),
                readyGovernance(),new NoOpTransactions(store),8,8,2,store.runtimeCommit,"","");
        try{
            Map<String,Object> report=readiness.inspect(true,0);
            assertEquals(store.sourceInputAuthorityHash,
                report.get("currentVerifiedCanarySourceInputAuthorityHash"));
            assertEquals(store.sourceAuthorityHash,report.get("currentAuthoritySetHash"));
            assertEquals(store.finalAuthorityHash,report.get("currentFinalAuthoritySetHash"));
            assertFalse(store.sourceAuthorityHash.equals(store.finalAuthorityHash));
            assertTrue(store.verifiedDispatchExactPredicateObserved);
            assertEquals(true,report.get("approvalBindingCurrent"));
            assertEquals(true,report.get("enabled"));
        }finally{readiness.close();}
    }

    @Test
    void durablePrepareThenActivateAreExactRevisionCasWithoutRestart(){
        SharedReceiptStore store=new SharedReceiptStore(1);
        store.runtimeCommit="c".repeat(40);store.sourceAuthorityHash="0".repeat(64);
        store.finalAuthorityHash="f".repeat(64);
        store.sourceInputAuthorityHash="0".repeat(64);store.currentVerifiedCanary=true;
        String candidate="postdeploy:test:20260817";
        CompositeAutocompletionReadinessService readiness=
            new CompositeAutocompletionReadinessService(new ReplicaJdbcTemplate(store),
                readyGovernance(),new NoOpTransactions(store),8,8,2,store.runtimeCommit,"","");
        try{
            Map<String,Object> prepared=readiness.prepare(0L,store.runtimeCommit,
                store.finalAuthorityHash,candidate,"SYSTEM_ADMIN",true,0);
            assertTrue(store.verifiedDispatchExactPredicateObserved);
            assertEquals("PREPARE",prepared.get("action"));
            assertEquals(false,prepared.get("effectiveWithoutRollout"));
            assertEquals("PREPARED",store.gateStatus);assertEquals(1L,store.gateRevision);
            assertThrows(IllegalStateException.class,()->readiness.prepare(0L,
                store.runtimeCommit,store.finalAuthorityHash,candidate,"SYSTEM_ADMIN",true,0));

            Map<String,Object> activated=readiness.activate(1L,store.runtimeCommit,
                store.sourceAuthorityHash,candidate,"SYSTEM_ADMIN",true,0);
            assertEquals("ACTIVATE",activated.get("action"));
            assertEquals(true,activated.get("effectiveWithoutRollout"));
            assertEquals("ACTIVE",store.gateStatus);assertEquals(2L,store.gateRevision);
        }finally{readiness.close();}
    }

    @Test
    void fixedSourceH0KeepsActiveGateAcrossFourteenChangingH1WavesAnd108Drain(){
        SharedReceiptStore store=new SharedReceiptStore(108);
        store.runtimeCommit="c".repeat(40);
        store.sourceAuthorityHash="0".repeat(64);
        store.sourceInputAuthorityHash=store.sourceAuthorityHash;
        store.finalAuthorityHash="1".repeat(64);
        store.gateFinalAuthorityHash=store.finalAuthorityHash;
        store.gateStatus="ACTIVE";store.currentVerifiedCanary=true;
        // Hold source capacity at eight so runScheduledBatch exercises drift/revoke logic only;
        // the fixture advances the completed wave exactly as the async workers would.
        store.running=8;
        ReplicaJdbcTemplate jdbc=new ReplicaJdbcTemplate(store);
        NoOpTransactions transactions=new NoOpTransactions(store);
        ActorProcessGovernanceService governance=readyGovernance();
        CompositeAutocompletionReadinessService readiness=
            new CompositeAutocompletionReadinessService(jdbc,governance,transactions,
                8,8,2,store.runtimeCommit,"","");
        CompositeDesignOperationalWorker worker=new CompositeDesignOperationalWorker(
            jdbc,new ObjectMapper(),governance,readiness,transactions,true,8,25,false,600,30);
        int drained=0;
        try{
            for(int wave=1;wave<=14;wave++){
                int waveSize=Math.min(8,108-drained);
                store.finalAuthorityHash=String.format("%064x",wave+1L);
                worker.runScheduledBatch();
                for(int index=0;index<waveSize;index++)store.pending.removeFirst();
                drained+=waveSize;
                assertEquals("ACTIVE",store.gateStatus,"wave="+wave);
                assertEquals(0,store.revokeCount,"wave="+wave);
                assertEquals(store.sourceAuthorityHash,
                    worker.inspect().get("currentSourceInputAuthorityHash"),"wave="+wave);
                assertEquals(store.finalAuthorityHash,
                    worker.inspect().get("currentFinalAuthoritySetHash"),"wave="+wave);
            }
            assertEquals(108,drained);assertEquals(0,store.pending.size());
            assertEquals("ACTIVE",store.gateStatus);assertEquals(0,store.revokeCount);
        }finally{worker.close();readiness.close();}
    }

    @Test
    void preparedGateKeepsScheduledAndExplicitBulkClaimsAtZero(){
        SharedReceiptStore store=new SharedReceiptStore(8);
        store.runtimeCommit="c".repeat(40);
        store.sourceAuthorityHash="0".repeat(64);
        store.sourceInputAuthorityHash=store.sourceAuthorityHash;
        store.finalAuthorityHash="1".repeat(64);
        store.gateFinalAuthorityHash=store.finalAuthorityHash;
        store.gateStatus="PREPARED";store.currentVerifiedCanary=true;store.gateRevision=1L;
        ReplicaJdbcTemplate jdbc=new ReplicaJdbcTemplate(store);
        NoOpTransactions transactions=new NoOpTransactions(store);
        ActorProcessGovernanceService governance=readyGovernance();
        CompositeAutocompletionReadinessService readiness=
            new CompositeAutocompletionReadinessService(jdbc,governance,transactions,
                8,8,2,store.runtimeCommit,"","");
        CompositeDesignOperationalWorker worker=new CompositeDesignOperationalWorker(
            jdbc,new ObjectMapper(),governance,readiness,transactions,true,8,25,false,600,30);
        try{
            worker.runScheduledBatch();
            assertEquals(0,store.running);assertEquals(8,store.pending.size());
            assertEquals("PREPARED",store.gateStatus);assertEquals(0,store.revokeCount);
            assertThrows(IllegalStateException.class,()->worker.dispatchApproved(8));
            assertEquals(0,store.running);assertEquals(8,store.pending.size());
        }finally{worker.close();readiness.close();}
    }

    @Test
    void runtimeIdentityDriftBetweenApprovalSnapshotAndClaimKeepsClaimsAndSourceAtZero(){
        SharedReceiptStore store=activeApprovalStore(4);
        store.runtimeIdentityDriftAfterRead=1;
        ActorProcessGovernanceService governance=readyGovernance();
        ReplicaJdbcTemplate jdbc=new ReplicaJdbcTemplate(store);
        NoOpTransactions transactions=new NoOpTransactions(store);
        CompositeAutocompletionReadinessService readiness=
            new CompositeAutocompletionReadinessService(jdbc,governance,transactions,
                8,8,2,store.runtimeCommit,"","");
        CompositeDesignOperationalWorker worker=new CompositeDesignOperationalWorker(jdbc,
            new ObjectMapper(),governance,readiness,transactions,true,8,25,false,600,30);
        try{
            assertThrows(IllegalStateException.class,()->worker.dispatchApproved(4));
            assertEquals(0,store.running);assertEquals(4,store.pending.size());
            assertEquals(0,store.sourceWriteCount);
        }finally{worker.close();readiness.close();}
    }

    @Test
    void runtimeIdentityDriftAfterClaimIsRejectedBeforeCompilerSourceLock()throws Exception{
        SharedReceiptStore store=activeApprovalStore(1);
        store.runtimeIdentityDriftAfterRead=2;
        CountDownLatch canonicalLockEntered=new CountDownLatch(1);
        AtomicInteger sourceCompilerInvocations=new AtomicInteger();
        ActorProcessGovernanceService governance=readyGovernance();
        doAnswer(call->{canonicalLockEntered.countDown();return null;})
            .when(governance).lockCompositeProcessAuthority(anyString());
        doAnswer(call->{sourceCompilerInvocations.incrementAndGet();return Map.of();})
            .when(governance).compileIntegratedDesignProcess(anyMap(),anyString());
        ReplicaJdbcTemplate jdbc=new ReplicaJdbcTemplate(store);
        NoOpTransactions transactions=new NoOpTransactions(store);
        CompositeAutocompletionReadinessService readiness=
            new CompositeAutocompletionReadinessService(jdbc,governance,transactions,
                8,8,2,store.runtimeCommit,"","");
        CompositeDesignOperationalWorker worker=new CompositeDesignOperationalWorker(jdbc,
            new ObjectMapper(),governance,readiness,transactions,true,8,25,false,600,30);
        try{
            Map<String,Object> receipt=worker.dispatchApproved(1);
            assertEquals(1,receipt.get("claimedCount"));
            assertTrue(canonicalLockEntered.await(1,TimeUnit.SECONDS));
            assertTrue(store.runtimeIdentityDriftObserved.await(1,TimeUnit.SECONDS));
            assertEquals(0,sourceCompilerInvocations.get());
        }finally{worker.close();readiness.close();}
    }

    @Test
    void leaseHeartbeatUsesExactRunningTokenCas(){
        SharedReceiptStore store=new SharedReceiptStore(1);
        ActorProcessGovernanceService governance=readyGovernance();
        CompositeDesignOperationalWorker worker=new CompositeDesignOperationalWorker(
            new ReplicaJdbcTemplate(store),new ObjectMapper(),governance,
            new NoOpTransactions(store),false,8,25,false);
        try{
            assertEquals(1,worker.heartbeatLease("PROCESS_1",UUID.randomUUID().toString()));
            store.leaseHeartbeatValid=false;
            assertEquals(0,worker.heartbeatLease("PROCESS_1",UUID.randomUUID().toString()));
        }finally{worker.close();}
    }

    @Test
    void twoRuntimeReplicasAllowExactlyOneGlobalCanary() throws Exception {
        SharedReceiptStore store=new SharedReceiptStore(20);
        ActorProcessGovernanceService governance=readyGovernance();
        String commit="c".repeat(40);
        store.runtimeCommit=commit;
        ReplicaJdbcTemplate firstJdbc=new ReplicaJdbcTemplate(store);
        ReplicaJdbcTemplate secondJdbc=new ReplicaJdbcTemplate(store);
        NoOpTransactions firstTransactions=new NoOpTransactions(store);
        NoOpTransactions secondTransactions=new NoOpTransactions(store);
        CompositeAutocompletionReadinessService firstReadiness=
            new CompositeAutocompletionReadinessService(firstJdbc,governance,firstTransactions,
                8,8,2,commit,"","");
        CompositeAutocompletionReadinessService secondReadiness=
            new CompositeAutocompletionReadinessService(secondJdbc,governance,secondTransactions,
                8,8,2,commit,"","");
        CompositeDesignOperationalWorker first=new CompositeDesignOperationalWorker(firstJdbc,
            new ObjectMapper(),governance,firstReadiness,firstTransactions,true,8,25,false,600,30);
        CompositeDesignOperationalWorker second=new CompositeDesignOperationalWorker(secondJdbc,
            new ObjectMapper(),governance,secondReadiness,secondTransactions,true,8,25,false,600,30);
        ExecutorService callers=Executors.newFixedThreadPool(2);
        try{
            Future<Boolean> firstCall=callers.submit(()->claimsCanary(first));
            Future<Boolean> secondCall=callers.submit(()->claimsCanary(second));
            int successful=(firstCall.get()?1:0)+(secondCall.get()?1:0);
            assertEquals(1,successful);assertEquals(1,store.activeCanaries);
        }finally{callers.shutdownNow();first.close();second.close();}
    }

    @Test
    void newRuntimeSameH0RearmsExactlyOnePhysicalCanaryWithoutSourceExecution()
            throws Exception {
        SharedReceiptStore store=physicalRevalidationStore();
        CountDownLatch sourceExecutorEntered=new CountDownLatch(1);
        ActorProcessGovernanceService governance=readyGovernance();
        doAnswer(call->{sourceExecutorEntered.countDown();
            throw new IllegalStateException("PHYSICAL_REVALIDATION_MUST_NOT_COMPILE_SOURCE");})
            .when(governance).lockCompositeProcessAuthority(anyString());
        ReplicaJdbcTemplate jdbc=new ReplicaJdbcTemplate(store);
        NoOpTransactions transactions=new NoOpTransactions(store);
        CompositeAutocompletionReadinessService readiness=
            new CompositeAutocompletionReadinessService(jdbc,governance,transactions,
                8,8,2,store.runtimeCommit,"","");
        CompositeDesignOperationalWorker worker=new CompositeDesignOperationalWorker(jdbc,
            new ObjectMapper(),governance,readiness,transactions,true,8,25,false,600,30);
        try{
            Map<String,Object> receipt=worker.dispatchCanary();
            assertEquals(1,receipt.get("claimedCount"));
            assertEquals(0,receipt.get("activeWorkerCount"));
            assertEquals(1,receipt.get("canaryAttempt"));
            assertEquals(List.of("PROCESS_1"),receipt.get("processCodes"));
            assertEquals(1,store.physicalRearmCount);
            assertEquals(42L,store.preservedPhysicalJobId);
            assertEquals(0,store.sourceWriteCount);
            assertEquals(0,store.canaryRetryPreparedCount);
            assertFalse(sourceExecutorEntered.await(250,TimeUnit.MILLISECONDS));
        }finally{worker.close();}
    }

    @Test
    void sameRuntimePartialTerminalAndSourceH0DriftCannotRearm(){
        SharedReceiptStore sameRuntime=physicalRevalidationStore();
        sameRuntime.priorVerifiedRuntimeCommit=sameRuntime.runtimeCommit;
        sameRuntime.gateRuntimeCommit=sameRuntime.runtimeCommit;
        assertEquals(0,rearmPhysical(sameRuntime).size(),"same runtime commit");

        SharedReceiptStore partial=physicalRevalidationStore();
        partial.allReceiptsPhysicalVerified=false;
        assertEquals(0,rearmPhysical(partial).size(),"partial terminal receipts");

        SharedReceiptStore drifted=physicalRevalidationStore();
        drifted.priorVerifiedSourceAuthorityHash="d".repeat(64);
        drifted.sourceInputAuthorityHash=drifted.priorVerifiedSourceAuthorityHash;
        assertEquals(0,rearmPhysical(drifted).size(),"source H0 drift");
    }

    @Test
    void twoRuntimeReplicasRearmExactlyOnePhysicalCanary() throws Exception {
        SharedReceiptStore store=physicalRevalidationStore();
        ActorProcessGovernanceService governance=readyGovernance();
        ReplicaJdbcTemplate firstJdbc=new ReplicaJdbcTemplate(store);
        ReplicaJdbcTemplate secondJdbc=new ReplicaJdbcTemplate(store);
        NoOpTransactions firstTransactions=new NoOpTransactions(store);
        NoOpTransactions secondTransactions=new NoOpTransactions(store);
        CompositeAutocompletionReadinessService firstReadiness=
            new CompositeAutocompletionReadinessService(firstJdbc,governance,firstTransactions,
                8,8,2,store.runtimeCommit,"","");
        CompositeAutocompletionReadinessService secondReadiness=
            new CompositeAutocompletionReadinessService(secondJdbc,governance,secondTransactions,
                8,8,2,store.runtimeCommit,"","");
        CompositeDesignOperationalWorker first=new CompositeDesignOperationalWorker(firstJdbc,
            new ObjectMapper(),governance,firstReadiness,firstTransactions,true,8,25,false,600,30);
        CompositeDesignOperationalWorker second=new CompositeDesignOperationalWorker(secondJdbc,
            new ObjectMapper(),governance,secondReadiness,secondTransactions,true,8,25,false,600,30);
        ExecutorService callers=Executors.newFixedThreadPool(2);
        try{
            Future<Boolean> firstCall=callers.submit(()->claimsCanary(first));
            Future<Boolean> secondCall=callers.submit(()->claimsCanary(second));
            assertEquals(1,(firstCall.get()?1:0)+(secondCall.get()?1:0));
            assertEquals(1,store.physicalRearmCount);
            assertEquals(1,store.activeCanaries);
            assertEquals(0,store.sourceWriteCount);
        }finally{callers.shutdownNow();first.close();second.close();}
    }

    @Test
    void physicalOnlyCanaryRetryStopsAfterThirdAttemptAndPreservesSource(){
        SharedReceiptStore store=physicalRevalidationStore();
        CompositeAutocompletionReadinessService readiness=
            new CompositeAutocompletionReadinessService(new ReplicaJdbcTemplate(store),
                readyGovernance(),new NoOpTransactions(store),8,8,2,store.runtimeCommit,"","");
        try{
            for(int expectedAttempt=1;expectedAttempt<=3;expectedAttempt++){
                int attempt=readiness.nextCanaryAttempt(
                    store.runtimeCommit,store.sourceAuthorityHash);
                assertEquals(expectedAttempt,attempt);
                List<Map<String,Object>> rearmed=readiness.rearmPhysicalCanary(
                    UUID.randomUUID().toString(),store.runtimeCommit,
                    store.sourceAuthorityHash,attempt);
                assertEquals(1,rearmed.size());
                assertEquals(true,rearmed.get(0).get("physicalRevalidation"));
                assertEquals(42L,rearmed.get(0).get("jobId"));
                assertEquals(expectedAttempt,store.maxCanaryAttempt);
                store.failPhysicalRevalidation();
            }
            assertThrows(IllegalStateException.class,()->readiness.nextCanaryAttempt(
                store.runtimeCommit,store.sourceAuthorityHash));
            assertEquals(3,store.physicalRearmCount);
            assertEquals(0,store.sourceWriteCount);
            assertEquals(0,store.canaryRetryPreparedCount);
            assertEquals(42L,store.preservedPhysicalJobId);
        }finally{readiness.close();}
    }

    @Test
    void disabledCapabilityCannotClaimCanary(){
        SharedReceiptStore store=new SharedReceiptStore(1);
        CompositeDesignOperationalWorker worker=new CompositeDesignOperationalWorker(
            new ReplicaJdbcTemplate(store),new ObjectMapper(),readyGovernance(),
            new NoOpTransactions(store),false,8,25,false);
        try{
            assertThrows(IllegalStateException.class,worker::dispatchCanary);
            assertEquals(0,store.activeCanaries);assertEquals(0,store.running);
        }finally{worker.close();}
    }

    private static boolean claimsCanary(CompositeDesignOperationalWorker worker){
        try{return ((Number)worker.dispatchCanary().get("claimedCount")).intValue()==1;}
        catch(IllegalStateException expected){return false;}
    }

    private static SharedReceiptStore physicalRevalidationStore(){
        SharedReceiptStore store=new SharedReceiptStore(1);
        store.runtimeCommit="c".repeat(40);
        store.priorVerifiedRuntimeCommit="b".repeat(40);
        store.sourceAuthorityHash="a".repeat(64);
        store.priorVerifiedSourceAuthorityHash=store.sourceAuthorityHash;
        store.sourceInputAuthorityHash=store.sourceAuthorityHash;
        store.gateStatus="ACTIVE";
        store.gateRuntimeCommit=store.priorVerifiedRuntimeCommit;
        store.currentVerifiedCanary=true;
        store.allReceiptsPhysicalVerified=true;
        return store;
    }

    private static SharedReceiptStore activeApprovalStore(int count){
        SharedReceiptStore store=new SharedReceiptStore(count);
        store.runtimeCommit="c".repeat(40);
        store.sourceAuthorityHash="0".repeat(64);
        store.sourceInputAuthorityHash=store.sourceAuthorityHash;
        store.finalAuthorityHash="1".repeat(64);
        store.gateFinalAuthorityHash=store.finalAuthorityHash;
        store.gateStatus="ACTIVE";store.currentVerifiedCanary=true;
        return store;
    }

    private static List<Map<String,Object>> rearmPhysical(SharedReceiptStore store){
        CompositeAutocompletionReadinessService readiness=
            new CompositeAutocompletionReadinessService(new ReplicaJdbcTemplate(store),
                readyGovernance(),new NoOpTransactions(store),8,8,2,store.runtimeCommit,"","");
        try{return readiness.rearmPhysicalCanary(UUID.randomUUID().toString(),
            store.runtimeCommit,store.sourceAuthorityHash,1);}
        finally{readiness.close();}
    }

    private static ActorProcessGovernanceService readyGovernance(){
        ActorProcessGovernanceService governance=mock(ActorProcessGovernanceService.class);
        when(governance.inspectCompositeCompilerReadiness(anyString())).thenAnswer(call->
            Map.of("success",true,"compilerClosure","PASS","identityCount",1,
                "documentCount",18));
        doThrow(new IllegalStateException("TEST_WORK_REMAINS_LEASED"))
            .when(governance).lockCompositeProcessAuthority(anyString());
        return governance;
    }

    private static ActorProcessGovernanceService serializationRetryGovernance(
            AtomicInteger attempts,int failures,String sqlState){
        ActorProcessGovernanceService governance=readyGovernance();
        doAnswer(call->null).when(governance).lockCompositeProcessAuthority(anyString());
        doAnswer(call->{
            int attempt=attempts.incrementAndGet();
            if(attempt<=failures)throw new IllegalStateException(
                "TRANSIENT_DATABASE_CONFLICT",new SQLException("retry",sqlState));
            return Map.of("status","SOURCE_APPLIED_PHYSICAL_QUEUED",
                "screenCount",1,"documentCount",18,"authorityCount",1,
                "receipts",List.of(Map.of("jobId",9001L)));
        }).when(governance).compileIntegratedDesignProcess(anyMap(),anyString());
        return governance;
    }

    private static void await(BooleanSupplier completed,long timeoutMs)throws Exception{
        long deadline=System.nanoTime()+TimeUnit.MILLISECONDS.toNanos(timeoutMs);
        while(!completed.getAsBoolean()&&System.nanoTime()<deadline)Thread.sleep(10L);
        assertTrue(completed.getAsBoolean(),"condition was not met within "+timeoutMs+"ms");
    }

    private static final class SharedReceiptStore {
        private final ArrayDeque<String> pending=new ArrayDeque<>();
        private final ReentrantLock transactionLeader=new ReentrantLock();
        private final int total;
        private int running;
        private int activeCanaries;
        private int verifiedCanaries;
        private int maxCanaryAttempt;
        private String gateStatus="DISABLED";
        private String gateRuntimeCommit="";
        private boolean currentVerifiedCanary;
        private String runtimeCommit="";
        private String runtimeIdentityHash="9".repeat(64);
        private int runtimeIdentityReadCount;
        private int runtimeIdentityDriftAfterRead=Integer.MAX_VALUE;
        private final CountDownLatch runtimeIdentityDriftObserved=new CountDownLatch(1);
        private String sourceAuthorityHash="a".repeat(64);
        private String finalAuthorityHash="f".repeat(64);
        private String sourceInputAuthorityHash="0".repeat(64);
        private String gateFinalAuthorityHash="f".repeat(64);
        private String postdeployCandidateId="postdeploy:test:20260817";
        private long gateRevision;
        private int revokeCount;
        private int canaryRetryPreparedCount;
        private boolean persistedProcessSourcePredicateObserved;
        private boolean staleCanaryCleanupObserved;
        private boolean verifiedDispatchExactPredicateObserved;
        private boolean leaseHeartbeatValid=true;
        private boolean allReceiptsPhysicalVerified;
        private String priorVerifiedRuntimeCommit="";
        private String priorVerifiedSourceAuthorityHash="";
        private String physicalRevalidationStatus="";
        private int physicalRearmCount;
        private int sourceWriteCount;
        private int claimCount;
        private int blockedCount;
        private int serializationRetryAttempt;
        private long retryNotBeforeEpochMs;
        private String currentLeaseToken="";
        private String lastBlocker="";
        private boolean retryWait;
        private int globalRunningOverride=-1;
        private String retryContextJson="";
        private int nextCanaryAttemptQueryCount;
        private int persistedCanaryAttempt;
        private String persistedCanaryId="";
        private String persistedCanaryStatus="";
        private String persistedCanaryRuntimeCommit="";
        private String persistedCanaryRuntimeIdentity="";
        private String persistedCanaryAuthorityHash="";
        private String persistedCanaryDependencyHash="";
        private long preservedPhysicalJobId=42L;
        private SharedReceiptStore(int count){
            total=count;
            for(int index=1;index<=count;index++)pending.add("PROCESS_"+index);
        }
        private void failPhysicalRevalidation(){
            activeCanaries=0;physicalRevalidationStatus="FAILED";
        }
    }

    private static final class HoldingExecutor extends AbstractExecutorService {
        private final List<Runnable> queued=new ArrayList<>();
        private boolean shutdown;
        @Override public synchronized void execute(Runnable command){
            if(shutdown)throw new java.util.concurrent.RejectedExecutionException();
            queued.add(command);
        }
        @Override public synchronized void shutdown(){shutdown=true;}
        @Override public synchronized List<Runnable> shutdownNow(){
            shutdown=true;List<Runnable> abandoned=List.copyOf(queued);queued.clear();
            return abandoned;
        }
        @Override public synchronized boolean isShutdown(){return shutdown;}
        @Override public synchronized boolean isTerminated(){return shutdown&&queued.isEmpty();}
        @Override public boolean awaitTermination(long timeout,TimeUnit unit){return isTerminated();}
        private synchronized int queuedCount(){return queued.size();}
    }

    private static final class ReplicaJdbcTemplate extends JdbcTemplate {
        private final SharedReceiptStore store;
        private ReplicaJdbcTemplate(SharedReceiptStore store){this.store=store;}

        @Override public Map<String,Object> queryForMap(String sql){
            Map<String,Object> row=new LinkedHashMap<>();
            if(sql.contains("historicalPhysicalSampleCount")){
                row.put("totalProcessCount",store.total);row.put("screenIdentityCount",store.total);
                row.put("pendingCount",store.pending.size());row.put("runningCount",store.running);
                row.put("appliedCount",0);row.put("physicalVerifiedCount",0);
                row.put("blockedCount",0);row.put("historicalPhysicalSampleCount",0);
                row.put("historicalP95PhysicalMs",0L);return row;
            }
            if(sql.contains("integrated_design_autocompletion_gate")){
                row.put("approvalStatus",store.gateStatus);
                row.put("revision",store.gateRevision);
                boolean bound=!"DISABLED".equals(store.gateStatus);
                row.put("runtimeCommit",bound?(store.gateRuntimeCommit.isEmpty()
                    ?store.runtimeCommit:store.gateRuntimeCommit):"");
                row.put("postdeployCandidateId",bound?store.postdeployCandidateId:"");
                row.put("sourceInputAuthorityHash",bound
                    ?store.sourceInputAuthorityHash:"");
                row.put("finalAuthorityHash",bound?store.gateFinalAuthorityHash:"");
                row.put("canaryProcessCode",bound?"PROCESS_1":"");
                row.put("canaryJobId",bound?42L:0L);return row;
            }
            row.put("totalIdentityCount",store.total);row.put("totalProcessCount",store.total);
            row.put("readyIdentityCount",store.total);
            row.put("processesWithReadyIdentityCount",store.total);
            row.put("partiallyReadyProcessCount",0);row.put("readyProcessCount",store.total);
            row.put("readyIdentityInReadyProcessCount",store.total);
            row.put("currentAuthoritySetHash",store.sourceAuthorityHash);return row;
        }

        @Override public Map<String,Object> queryForMap(String sql,Object... arguments){
            if(sql.contains("update integrated_design_autocompletion_gate")){
                long expected=((Number)arguments[arguments.length-1]).longValue();
                if(expected!=store.gateRevision)throw new IllegalStateException(
                    "AUTOCOMPLETION_GATE_REVISION_CONFLICT");
                if(sql.contains("set approval_status='PREPARED'")){
                    store.gateStatus="PREPARED";
                    store.postdeployCandidateId=String.valueOf(arguments[1]);
                    store.sourceInputAuthorityHash=String.valueOf(arguments[2]);
                    store.gateFinalAuthorityHash=String.valueOf(arguments[3]);
                }else if(sql.contains("set approval_status='ACTIVE'")){
                    if(!"PREPARED".equals(store.gateStatus))throw new IllegalStateException(
                        "AUTOCOMPLETION_GATE_REVISION_CONFLICT");
                    store.gateStatus="ACTIVE";
                }else if(sql.contains("set approval_status='REVOKED'")){
                    store.gateStatus="REVOKED";store.revokeCount++;
                }
                store.gateRevision++;
                Map<String,Object> row=new LinkedHashMap<>();
                row.put("approvalStatus",store.gateStatus);
                row.put("revision",store.gateRevision);row.put("runtimeCommit",
                    store.gateRuntimeCommit.isEmpty()?store.runtimeCommit:store.gateRuntimeCommit);
                row.put("postdeployCandidateId",store.postdeployCandidateId);
                row.put("sourceInputAuthorityHash",store.sourceInputAuthorityHash);
                row.put("finalAuthorityHash",store.gateFinalAuthorityHash);
                row.put("canaryProcessCode","PROCESS_1");row.put("canaryJobId",42L);
                row.put("approvedBy","SYSTEM_ADMIN");row.put("approvedAt","NOW");return row;
            }
            return queryForMap(sql);
        }

        @Override public int update(String sql){return 1;}

        @Override public void execute(String sql){
            if(!sql.contains("lock table comtnthemedefinition")
                    ||!sql.contains("ui_section_registry in share mode"))
                throw new IllegalStateException("UNEXPECTED_FAKE_JDBC_EXECUTE: "+sql);
        }
        @Override public int update(String sql,Object... arguments){
            if(sql.contains("PHYSICAL_VERIFICATION_TIMEOUT"))
                store.staleCanaryCleanupObserved=true;
            if(sql.contains("requestedSourceDependencyHash")
                    &&sql.contains("framework_composite_dependency_fingerprint(process_code)")){
                store.persistedProcessSourcePredicateObserved=true;
                if(sql.contains("set completion_status='PENDING'")){
                    if(arguments.length==2
                            &&store.runtimeCommit.equals(String.valueOf(arguments[0]))
                            &&store.sourceAuthorityHash.equals(String.valueOf(arguments[1])))
                        store.canaryRetryPreparedCount++;
                    else return 0;
                }
            }
            if(sql.contains("and lease_until>=current_timestamp"))
                return store.leaseHeartbeatValid?1:0;
            if(sql.contains("EXECUTOR_RETRY_WAIT"))synchronized(store){
                String process=String.valueOf(arguments[arguments.length-2]);
                store.retryContextJson=jsonArgument(arguments);
                store.running=Math.max(0,store.running-1);
                store.currentLeaseToken="";store.retryWait=true;
                store.retryNotBeforeEpochMs=System.currentTimeMillis()+50L;
                if(!store.pending.contains(process))store.pending.addFirst(process);
                return 1;
            }
            if(sql.contains("sourceAppliedFinalAuthorityHash")
                    &&sql.contains("where process_code=? and lease_token=?::uuid"))
                synchronized(store){
                    store.running=Math.max(0,store.running-1);
                    store.sourceWriteCount++;
                    store.serializationRetryAttempt=0;
                    store.retryNotBeforeEpochMs=0L;
                    store.currentLeaseToken="";
                    return 1;
                }
            if(sql.contains("set completion_status='BLOCKED'")
                    &&sql.contains("lease_token=?::uuid"))synchronized(store){
                store.running=Math.max(0,store.running-1);
                store.blockedCount++;
                store.lastBlocker=String.valueOf(arguments[0]);
                store.currentLeaseToken="";
                return 1;
            }
            return 1;
        }

        @Override public <T> T queryForObject(String sql,Class<T> type){
            if(sql.contains("completion_status='RUNNING'"))return type.cast(Integer.valueOf(
                store.globalRunningOverride>=0?store.globalRunningOverride:store.running));
            if(sql.contains("'{canary,status}'"))
                return type.cast(Integer.valueOf(store.activeCanaries));
            if(type==String.class)return type.cast(sql.contains(
                "framework_composite_final_authority_fingerprint")
                ?store.finalAuthorityHash:store.sourceAuthorityHash);
            return null;
        }

        @Override public <T> T queryForObject(String sql,Class<T> type,Object... arguments){
            if(sql.contains("pg_try_advisory_xact_lock"))return type.cast(Boolean.TRUE);
            if(sql.contains("receipt_json->'requestedScope'"))return type.cast(
                "{\"scopeType\":\"GLOBAL\",\"source\":\"MIGRATION_GLOBAL_TARGET\"}");
            if(sql.trim().equals("select framework_composite_dependency_fingerprint(?)"))
                return type.cast("b".repeat(64));
            if(sql.contains("framework_runtime_release_state")
                    &&sql.contains("framework_postdeploy_release_attempt"))
                return type.cast(Boolean.TRUE);
            if(sql.contains("completion_status='RUNNING'"))return type.cast(Integer.valueOf(
                store.globalRunningOverride>=0?store.globalRunningOverride:store.running));
            if(sql.contains("coalesce(max(case when receipt_json#>>'{canary,attemptNumber}'"))
                synchronized(store){
                store.nextCanaryAttemptQueryCount++;
                return type.cast(Integer.valueOf(store.runtimeCommit.equals(String.valueOf(arguments[0]))
                    &&store.sourceAuthorityHash.equals(String.valueOf(arguments[1]))
                    &&sql.contains("requestedSourceDependencyHash")
                    &&sql.contains("framework_composite_dependency_fingerprint(process_code)")
                    ?store.maxCanaryAttempt:0));}
            if(sql.contains("'{canary,status}'='VERIFIED'"))
                return type.cast(Integer.valueOf(store.verifiedCanaries));
            if(sql.contains("'{canary,status}'")||sql.contains("'{canary,runtimeCommit}'"))
                return type.cast(Integer.valueOf(store.activeCanaries));
            if(type==Integer.class)return type.cast(Integer.valueOf(0));
            return null;
        }

        @Override public List<Map<String,Object>> queryForList(String sql){
            return rows(sql,new Object[0]);
        }

        @Override public List<Map<String,Object>> queryForList(String sql,Object... arguments){
            return rows(sql,arguments);
        }

        @Override public <T> List<T> queryForList(String sql,Class<T> type,
                Object... arguments){
            if(sql.contains("from framework_runtime_release_state runtime")
                    &&sql.contains("runtime.source_commit=?")){
                String commit=arguments.length==0?"":String.valueOf(arguments[0]);
                if(!store.runtimeCommit.equals(commit))return List.of();
                String identity;
                synchronized(store){
                    store.runtimeIdentityReadCount++;
                    boolean drifted=store.runtimeIdentityReadCount>
                        store.runtimeIdentityDriftAfterRead;
                    identity=drifted?"8".repeat(64):store.runtimeIdentityHash;
                    if(drifted)store.runtimeIdentityDriftObserved.countDown();
                }
                return List.of(type.cast(identity));
            }
            throw new IllegalStateException("UNEXPECTED_FAKE_JDBC_TYPED_LIST: "+sql);
        }

        private List<Map<String,Object>> rows(String sql,Object... arguments){
            if(sql.contains("pg_advisory_xact_lock"))return List.of();
            if(sql.contains("as \"retryContext\"")&&sql.contains("blocker_code='RETRY_WAIT'"))
                synchronized(store){
                    if(!store.retryWait||store.retryNotBeforeEpochMs>System.currentTimeMillis()
                            ||store.pending.isEmpty())return List.of();
                    return List.of(Map.of("processCode",store.pending.peekFirst(),
                        "retryContext",store.retryContextJson));
                }
            if(sql.contains("as \"canaryId\"")&&sql.contains("as \"leaseCurrent\""))
                synchronized(store){
                    if(store.running==0)return List.of();
                    return List.of(Map.ofEntries(
                        Map.entry("canaryId",store.persistedCanaryId),
                        Map.entry("canaryStatus",store.persistedCanaryStatus),
                        Map.entry("sourceAuthorityHash",store.persistedCanaryAuthorityHash),
                        Map.entry("sourceDependencyHash",store.persistedCanaryDependencyHash),
                        Map.entry("runtimeCommit",store.persistedCanaryRuntimeCommit),
                        Map.entry("runtimeIdentityHash",store.persistedCanaryRuntimeIdentity),
                        Map.entry("attemptNumber",Integer.toString(store.persistedCanaryAttempt)),
                        Map.entry("rootDependencyHash",store.persistedCanaryDependencyHash),
                        Map.entry("dependencyFingerprint",store.persistedCanaryDependencyHash),
                        Map.entry("leaseCurrent",true),Map.entry("jobUnassigned",true)));
                }
            if(sql.contains("with locked as (")
                    &&sql.contains("SERIALIZATION_RETRY_EXHAUSTED"))synchronized(store){
                String process=String.valueOf(arguments[1]);
                String token=String.valueOf(arguments[2]);
                if(store.running==0||!store.currentLeaseToken.equals(token))return List.of();
                store.serializationRetryAttempt=Math.min(3,store.serializationRetryAttempt+1);
                store.retryContextJson=jsonArgument(arguments);
                int attempt=store.serializationRetryAttempt;
                long delay=attempt==1?50L:100L;
                store.running--;
                store.currentLeaseToken="";
                if(attempt<3){
                    store.retryWait=true;
                    if(!store.persistedCanaryId.isEmpty()){
                        store.persistedCanaryStatus="RETRY_WAIT";store.activeCanaries=0;}
                    store.pending.addFirst(process);
                    store.retryNotBeforeEpochMs=System.currentTimeMillis()+delay;
                    return List.of(Map.of("retryAttempt",attempt,
                        "completionStatus","PENDING","retryDelayMs",delay));
                }
                store.blockedCount++;
                store.retryWait=false;
                if(!store.persistedCanaryId.isEmpty()){
                    store.persistedCanaryStatus="FAILED";store.activeCanaries=0;}
                return List.of(Map.of("retryAttempt",attempt,
                    "completionStatus","BLOCKED","retryDelayMs",delay));
            }
            if(sql.contains("SOURCE_APPLIED_PHYSICAL_QUEUED")
                    &&(sql.contains("physicalRevalidation")
                        ||sql.contains("revalidationOnly")||sql.contains("sourceReused")))
                synchronized(store){
                    String commit=argumentMatching(arguments,"[0-9a-f]{40}");
                    String sourceHash=argumentMatching(arguments,"[0-9a-f]{64}");
                    String canaryId=argumentMatching(arguments,
                        "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
                    int attempt=integerArgument(arguments);
                    boolean retry="FAILED".equals(store.physicalRevalidationStatus)
                        &&store.maxCanaryAttempt==attempt-1;
                    // A failed revalidation receipt is PHYSICAL_QUEUED, not terminal verified.
                    // The all-terminal predicate must therefore belong only to attempt 1;
                    // keeping it as a common WHERE clause makes attempts 2 and 3 unreachable.
                    if(retry&&sql.contains("where facts.target_count>0 and "
                            +"facts.verified_count=facts.target_count"))return List.of();
                    boolean first=store.physicalRevalidationStatus.isEmpty()
                        &&store.maxCanaryAttempt==0
                        &&!commit.equals(store.priorVerifiedRuntimeCommit);
                    boolean eligible=store.activeCanaries==0
                        &&store.allReceiptsPhysicalVerified
                        &&store.sourceAuthorityHash.equals(sourceHash)
                        &&store.priorVerifiedSourceAuthorityHash.equals(sourceHash)
                        &&(first||retry)&&attempt>=1&&attempt<=3;
                    if(!eligible)return List.of();
                    store.activeCanaries=1;store.maxCanaryAttempt=attempt;
                    store.physicalRevalidationStatus="ACTIVE";
                    store.physicalRearmCount++;
                    return List.of(Map.of("processCode","PROCESS_1",
                        "jobId",store.preservedPhysicalJobId,
                        "physicalRevalidation",true,"canaryId",canaryId));
                }
            if(sql.contains("verifiedFinalAuthorityHash")){
                store.verifiedDispatchExactPredicateObserved=sql.contains(
                    "framework_composite_verified_canary_dispatch_exact");
                String requestedCommit=argumentMatching(arguments,"[0-9a-f]{40}");
                String requestedHash=argumentMatching(arguments,"[0-9a-f]{64}");
                String verifiedCommit=store.priorVerifiedRuntimeCommit.isEmpty()
                    ?store.runtimeCommit:store.priorVerifiedRuntimeCommit;
                String verifiedHash=store.priorVerifiedSourceAuthorityHash.isEmpty()
                    ?store.sourceAuthorityHash:store.priorVerifiedSourceAuthorityHash;
                boolean current=store.currentVerifiedCanary
                    &&verifiedCommit.equals(requestedCommit)
                    &&verifiedHash.equals(requestedHash)
                    &&store.verifiedDispatchExactPredicateObserved;
                return current?List.of(Map.of("processCode","PROCESS_1","durationMs",1_000L,
                    "jobId",42L,"sourceInputAuthorityHash",store.sourceInputAuthorityHash,
                    "sourceInputDependencyHash","b".repeat(64),
                    "finalAuthorityHash",store.gateFinalAuthorityHash)):List.of();
            }
            if(sql.contains("dependency_fingerprint from ("))synchronized(store){
                List<Map<String,Object>> candidates=new ArrayList<>();
                for(String process:store.pending)candidates.add(Map.of(
                    "process_code",process,"identity_count",1,
                    "dependency_fingerprint","b".repeat(64)));
                return candidates;
            }
            if(sql.contains("with candidate as ("))synchronized(store){
                String process=String.valueOf(arguments[0]);
                boolean serializationRetry=sql.contains(
                    "receipt.receipt_json->'serializationRetryContext'=?::jsonb");
                String token=String.valueOf(arguments[serializationRetry?4:3]);
                if(store.retryNotBeforeEpochMs>System.currentTimeMillis())return List.of();
                if(serializationRetry!=store.retryWait)return List.of();
                if(store.pending.remove(process)){
                    Map<String,Object> row=new LinkedHashMap<>();
                    row.put("processCode",process);row.put("leaseToken",token);
                    store.running++;store.claimCount++;store.currentLeaseToken=token;
                    store.retryWait=false;
                    String receiptJson=String.valueOf(arguments[serializationRetry?6:5]);
                    if(!"{}".equals(receiptJson)){
                        try{
                            var payload=new ObjectMapper().readTree(receiptJson);
                            var canary=payload.path("canary");
                            store.persistedCanaryId=canary.path("canaryId").asText();
                            store.persistedCanaryStatus=canary.path("status").asText();
                            store.persistedCanaryAttempt=canary.path("attemptNumber").asInt();
                            store.persistedCanaryRuntimeCommit=canary.path("runtimeCommit").asText();
                            store.persistedCanaryRuntimeIdentity=
                                canary.path("requestedRuntimeIdentityHash").asText();
                            store.persistedCanaryAuthorityHash=
                                canary.path("requestedSourceAuthorityHash").asText();
                            store.persistedCanaryDependencyHash=
                                canary.path("requestedSourceDependencyHash").asText();
                            store.activeCanaries=1;
                        }catch(Exception error){throw new IllegalStateException(error);}
                    }
                    return List.of(row);
                }
                return List.of();
            }
            return List.of();
        }

        private static String argumentMatching(Object[] arguments,String pattern){
            for(Object argument:arguments){
                String value=String.valueOf(argument);
                if(value.matches(pattern))return value;
            }
            return "";
        }

        private static int integerArgument(Object[] arguments){
            for(int index=arguments.length-1;index>=0;index--)
                if(arguments[index] instanceof Integer value)return value;
            return 0;
        }

        private static String jsonArgument(Object[] arguments){
            for(Object argument:arguments){
                String value=String.valueOf(argument);
                if(value.startsWith("{")&&value.contains("\"mode\""))return value;
            }
            return "{}";
        }
    }

    private static final class NoOpTransactions implements PlatformTransactionManager {
        private final SharedReceiptStore store;
        private NoOpTransactions(SharedReceiptStore store){this.store=store;}
        @Override public TransactionStatus getTransaction(TransactionDefinition definition){
            store.transactionLeader.lock();
            return new SimpleTransactionStatus();
        }
        @Override public void commit(TransactionStatus status){store.transactionLeader.unlock();}
        @Override public void rollback(TransactionStatus status){store.transactionLeader.unlock();}
    }
}
