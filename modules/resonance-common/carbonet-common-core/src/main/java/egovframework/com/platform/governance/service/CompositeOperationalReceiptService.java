package egovframework.com.platform.governance.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.LinkedHashMap;
import java.util.Map;

/** Persists SOURCE-to-physical convergence without changing an exact replay. */
final class CompositeOperationalReceiptService {
    private static final ObjectMapper JSON=new ObjectMapper();
    private final JdbcTemplate jdbc;

    CompositeOperationalReceiptService(JdbcTemplate jdbc){this.jdbc=jdbc;}

    void trackDirectSave(String process,Map<String,Object> batch,Map<String,Object> source){
        boolean verified=Boolean.TRUE.equals(source.get("physicalVerified"));
        String completion=verified?"PHYSICAL_GENERATED_VERIFIED":"SOURCE_APPLIED_PHYSICAL_QUEUED";
        Map<String,Object> stableReceipt=new LinkedHashMap<>();stableReceipt.put("processCode",process);
        for(String field:new String[]{"screenCount","documentCount","authorityCount"})
            stableReceipt.put(field,count(batch,field));
        for(String field:new String[]{"jobId","sourceHash","designSetHash","designCatalogHash",
                "endpointCatalogHash","packageBindingHash","generationStatus","physicalVerified"})
            stableReceipt.put(field,source.get(field));
        jdbc.update("""
            insert into integrated_design_autocompletion_receipt(
              process_code,completion_status,screen_count,document_count,authority_count,
              job_id,receipt_json,dependency_fingerprint,started_at,completed_at,duration_ms)
            values(?,?,?,?,?,?,?::jsonb,framework_composite_dependency_fingerprint(?),
              current_timestamp,case when ? then current_timestamp end,case when ? then 0 end)
            on conflict(process_code) do update set
              completion_status=excluded.completion_status,
              screen_count=excluded.screen_count,document_count=excluded.document_count,
              authority_count=excluded.authority_count,job_id=excluded.job_id,
              receipt_json=integrated_design_autocompletion_receipt.receipt_json||excluded.receipt_json,
              dependency_fingerprint=excluded.dependency_fingerprint,
              started_at=case when integrated_design_autocompletion_receipt.dependency_fingerprint
                is distinct from excluded.dependency_fingerprint then current_timestamp
                else coalesce(integrated_design_autocompletion_receipt.started_at,current_timestamp) end,
              completed_at=case when excluded.completion_status='PHYSICAL_GENERATED_VERIFIED'
                then current_timestamp else null end,
              duration_ms=case when excluded.completion_status='PHYSICAL_GENERATED_VERIFIED'
                then greatest(0,(extract(epoch from(current_timestamp-case
                  when integrated_design_autocompletion_receipt.dependency_fingerprint
                    is distinct from excluded.dependency_fingerprint then current_timestamp
                  else coalesce(integrated_design_autocompletion_receipt.started_at,current_timestamp)
                  end))*1000)::bigint) else null end,
              blocker_code=null,lease_token=null,lease_until=null,updated_at=current_timestamp
            where integrated_design_autocompletion_receipt.completion_status
                    is distinct from excluded.completion_status
               or integrated_design_autocompletion_receipt.screen_count
                    is distinct from excluded.screen_count
               or integrated_design_autocompletion_receipt.document_count
                    is distinct from excluded.document_count
               or integrated_design_autocompletion_receipt.authority_count
                    is distinct from excluded.authority_count
               or integrated_design_autocompletion_receipt.job_id is distinct from excluded.job_id
               or integrated_design_autocompletion_receipt.receipt_json
                    is distinct from integrated_design_autocompletion_receipt.receipt_json||
                      excluded.receipt_json
               or integrated_design_autocompletion_receipt.dependency_fingerprint
                    is distinct from excluded.dependency_fingerprint
            """,completion,count(batch,"screenCount"),count(batch,"documentCount"),
            count(batch,"authorityCount"),source.get("jobId"),json(stableReceipt),process,
            verified,verified);
    }

    private static int count(Map<String,Object> source,String field){
        Object value=source.get(field);if(value instanceof Number number)return number.intValue();
        throw new IllegalStateException("COMPOSITE_RECEIPT_COUNT_REQUIRED: "+field);
    }

    private static String json(Object value){
        try{return JSON.writeValueAsString(value);}
        catch(JsonProcessingException error){throw new IllegalStateException(
            "COMPOSITE_RECEIPT_JSON_INVALID",error);}
    }
}
