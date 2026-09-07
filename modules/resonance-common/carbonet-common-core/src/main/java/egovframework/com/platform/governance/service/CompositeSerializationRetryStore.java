package egovframework.com.platform.governance.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Map;

/** Durable, transaction-isolated persistence for exact serialization retries. */
final class CompositeSerializationRetryStore {
    private static final int RETRY_LIMIT=3;
    private static final long FIRST_RETRY_DELAY_MS=50L;
    private static final long SECOND_RETRY_DELAY_MS=100L;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate requiresNew;

    CompositeSerializationRetryStore(JdbcTemplate jdbc,TransactionTemplate requiresNew){
        this.jdbc=jdbc;this.requiresNew=requiresNew;
    }

    RetryState requeueExecutorRejection(String process,String token,String contextJson,
            String rejectionCode){
        Integer updated=requiresNew.execute(status->jdbc.update("""
            update integrated_design_autocompletion_receipt receipt
               set completion_status='PENDING',blocker_code='RETRY_WAIT',
                   receipt_json=receipt.receipt_json||jsonb_build_object(
                     'sourceCommitted',false,'jobCount',0,'blocker',?,
                     'generationStatus','EXECUTOR_RETRY_WAIT',
                     'serializationRetryAttempt',coalesce(case
                       when receipt.receipt_json->>'serializationRetryAttempt'~'^[0-9]{1,2}$'
                         then (receipt.receipt_json->>'serializationRetryAttempt')::integer
                       else 0 end,0),'serializationRetryLimit',?,
                     'serializationRetryContext',?::jsonb,'retryDelayMs',?,
                     'retryNotBeforeEpochMs',floor(extract(epoch from clock_timestamp())*1000)::bigint+?)
                     ||case when receipt.receipt_json#>>'{canary,status}'='ACTIVE' then
                       jsonb_build_object('canary',(receipt.receipt_json->'canary')||
                         jsonb_build_object('status','RETRY_WAIT','retryAt',clock_timestamp(),
                           'failureCode',?)) else '{}'::jsonb end,
                   lease_token=null,lease_until=null,job_id=null,completed_at=null,
                   duration_ms=null,updated_at=current_timestamp
             where receipt.process_code=? and receipt.lease_token=?::uuid
               and receipt.completion_status='RUNNING'
            """,rejectionCode,RETRY_LIMIT,contextJson,
            FIRST_RETRY_DELAY_MS,FIRST_RETRY_DELAY_MS,rejectionCode,process,token));
        return new RetryState(updated!=null&&updated==1,FIRST_RETRY_DELAY_MS);
    }

    RetryState requeueSerializationFailure(String process,String token,String contextJson){
        List<Map<String,Object>> rows=requiresNew.execute(status->jdbc.queryForList("""
            with locked as (
              select receipt.process_code,
                     least(?,coalesce(case
                       when receipt.receipt_json->>'serializationRetryAttempt'~'^[0-9]{1,2}$'
                         then (receipt.receipt_json->>'serializationRetryAttempt')::integer
                       else 0 end,0)+1) as retry_attempt
                from integrated_design_autocompletion_receipt receipt
               where receipt.process_code=? and receipt.lease_token=?::uuid
                 and receipt.completion_status='RUNNING'
               for update
            ), updated as (
              update integrated_design_autocompletion_receipt receipt
                 set completion_status=case when locked.retry_attempt<? then 'PENDING'
                                            else 'BLOCKED' end,
                     blocker_code=case when locked.retry_attempt<? then 'RETRY_WAIT'
                                       else 'SERIALIZATION_RETRY_EXHAUSTED' end,
                     receipt_json=receipt.receipt_json||jsonb_build_object(
                       'sourceCommitted',false,'jobCount',0,
                       'blocker',case when locked.retry_attempt<?
                         then 'SERIALIZATION_RETRY' else 'SERIALIZATION_RETRY_EXHAUSTED' end,
                       'generationStatus',case when locked.retry_attempt<?
                         then 'SERIALIZATION_RETRY_WAIT' else 'BLOCKED' end,
                       'serializationRetryAttempt',locked.retry_attempt,
                       'serializationRetryLimit',?,
                       'serializationRetryContext',?::jsonb,
                       'retryDelayMs',case when locked.retry_attempt=1 then ? else ? end,
                       'retryNotBeforeEpochMs',case when locked.retry_attempt<? then
                         floor(extract(epoch from clock_timestamp())*1000)::bigint+
                           case when locked.retry_attempt=1 then ? else ? end
                         else null end)||case
                       when receipt.receipt_json#>>'{canary,status}'='ACTIVE' then
                         jsonb_build_object('canary',(receipt.receipt_json->'canary')||
                           jsonb_build_object('status',case when locked.retry_attempt<?
                               then 'RETRY_WAIT' else 'FAILED' end,
                             'retryAt',case when locked.retry_attempt<?
                               then clock_timestamp() else null end,
                             'failedAt',case when locked.retry_attempt<?
                               then null else clock_timestamp() end,
                             'failureCode',case when locked.retry_attempt<?
                               then null else 'SERIALIZATION_RETRY_EXHAUSTED' end))
                       else '{}'::jsonb end,
                     lease_token=null,lease_until=null,job_id=null,
                     completed_at=case when locked.retry_attempt<? then null
                                       else current_timestamp end,
                     duration_ms=case when locked.retry_attempt<? then null else greatest(0,
                       (extract(epoch from(current_timestamp-receipt.started_at))*1000)::bigint) end,
                     updated_at=current_timestamp
                from locked where receipt.process_code=locked.process_code
              returning locked.retry_attempt as "retryAttempt",
                        receipt.completion_status as "completionStatus",
                        case when locked.retry_attempt=1 then ? else ? end as "retryDelayMs"
            ) select * from updated
            """,RETRY_LIMIT,process,token,RETRY_LIMIT,RETRY_LIMIT,RETRY_LIMIT,RETRY_LIMIT,
            RETRY_LIMIT,contextJson,FIRST_RETRY_DELAY_MS,SECOND_RETRY_DELAY_MS,RETRY_LIMIT,
            FIRST_RETRY_DELAY_MS,SECOND_RETRY_DELAY_MS,RETRY_LIMIT,RETRY_LIMIT,RETRY_LIMIT,
            RETRY_LIMIT,RETRY_LIMIT,RETRY_LIMIT,FIRST_RETRY_DELAY_MS,SECOND_RETRY_DELAY_MS));
        if(rows==null||rows.size()!=1)return new RetryState(false,0L);
        Map<String,Object> row=rows.get(0);
        boolean requeued="PENDING".equals(String.valueOf(row.get("completionStatus")));
        long delay=row.get("retryDelayMs") instanceof Number value?value.longValue():0L;
        return new RetryState(requeued,delay);
    }

    List<Map<String,Object>> resumeDue(int available){
        return requiresNew.execute(status->{
            jdbc.update("""
                update integrated_design_autocompletion_receipt receipt
                   set completion_status='PENDING',blocker_code='RETRY_WAIT',
                       lease_token=null,lease_until=null,job_id=null,
                       receipt_json=receipt.receipt_json||jsonb_build_object(
                         'retryNotBeforeEpochMs',floor(extract(epoch from clock_timestamp())*1000)::bigint,
                         'retryDelayMs',0,'blocker','SERIALIZATION_RETRY_RESUME'),
                       updated_at=current_timestamp
                 where receipt.completion_status='RUNNING'
                   and jsonb_exists(receipt.receipt_json,'serializationRetryContext')
                   and (receipt.lease_until is null or receipt.lease_until<current_timestamp)
                """);
            return jdbc.queryForList("""
            select receipt.process_code as "processCode",
                   (receipt.receipt_json->'serializationRetryContext')::text as "retryContext"
              from integrated_design_autocompletion_receipt receipt
             where receipt.completion_status='PENDING' and receipt.blocker_code='RETRY_WAIT'
               and receipt.receipt_json->>'retryNotBeforeEpochMs'~'^[0-9]{1,20}$'
               and (receipt.receipt_json->>'retryNotBeforeEpochMs')::numeric<=
                   extract(epoch from clock_timestamp())*1000
               and jsonb_typeof(receipt.receipt_json->'serializationRetryContext')='object'
             order by receipt.process_code collate "C" limit ?
            """,available);
        });
    }

    record RetryState(boolean requeued,long delayMs){}
}
