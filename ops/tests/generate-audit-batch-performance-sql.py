#!/usr/bin/env python3
from pathlib import Path
import sys

source = Path(sys.argv[1]).read_text(encoding="utf-8")

def extract(start_marker: str, end_marker: str) -> str:
    start = source.index(start_marker) + len(start_marker)
    end = source.index(end_marker, start)
    return source[start:end]

def bind(sql: str, values: list[str]) -> str:
    output: list[str] = []
    index = 0
    cursor = 0
    while cursor < len(sql):
        if sql[cursor] == "'":
            end = cursor + 1
            while end < len(sql):
                if sql[end] == "'" and end + 1 < len(sql) and sql[end + 1] == "'":
                    end += 2
                    continue
                if sql[end] == "'":
                    end += 1
                    break
                end += 1
            output.append(sql[cursor:end])
            cursor = end
        elif sql.startswith("??", cursor):
            output.append("?")
            cursor += 2
        elif sql[cursor] == "?":
            if index >= len(values):
                raise SystemExit(f"not enough bind values: supplied={len(values)} placeholder={index+1}")
            output.append(values[index])
            index += 1
            cursor += 1
        else:
            output.append(sql[cursor])
            cursor += 1
    if index != len(values):
        raise SystemExit(f"unused bind values: {len(values)-index}")
    return "".join(output)

report = extract('List<Map<String,Object>> items=jdbc.queryForList("""', '""",compact,SYSTEM_TEST_REPORT_COMPACT_JSON_LIMIT_BYTES')
report = bind(report, ["true", "2048", "''", "''", "''", "''", "50", "500", "''", "''"])

audit = extract('if(auditBatch!=null){\n            targets=jdbc.queryForList("""', '""",auditBatchId,(long)targetOffset,maxTargets+1)')
audit = bind(audit, [":'audit_batch_id'", "6750", "251"])

print("SET LOCAL statement_timeout='30s';")
print("""INSERT INTO framework_runtime_release_state(
  release_key,source_commit,deployment_namespace,deployment_name,deployment_uid,
  deployment_generation,observed_generation,desired_replicas,image_ref,image_id,health_status,recorded_by
) VALUES (
  'CARBONET_RUNTIME',repeat('a',40),'performance-test','carbonet-api','performance-test-uid',
  1,1,1,'carbonet-api:performance-test','sha256:'||repeat('b',64),'UP','AUDIT_PERFORMANCE_TEST'
) ON CONFLICT (release_key) DO NOTHING;""")
print("""SELECT (framework_start_screen_workflow_audit_batch(
  'AUDIT_PERFORMANCE_TEST',250
)->>'auditBatchId') AS audit_batch_id \\gset""")
print("\\echo REPORT_LATE_PAGE_50_WARMUP")
print("EXPLAIN (ANALYZE,BUFFERS,SUMMARY ON,TIMING OFF) " + report + ";")
print("\\echo REPORT_LATE_PAGE_50")
print("EXPLAIN (ANALYZE,BUFFERS,SUMMARY ON,TIMING OFF) " + report + ";")
print("\\echo AUDIT_LATE_PAGE_250")
print("EXPLAIN (ANALYZE,BUFFERS,SUMMARY ON,TIMING OFF) " + audit + ";")
