#!/usr/bin/env python3
"""Prepare a fail-closed static-gate candidate and transactional promotion SQL."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def quote(value: Any) -> str:
    return "'" + str(value or "").replace("'", "''") + "'"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("snapshot", type=Path)
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--sql", type=Path, required=True)
    args = parser.parse_args()
    data = json.loads(args.snapshot.read_text(encoding="utf-8"))
    rows: list[tuple[str, str, str]] = []
    for process in data.get("processes", []):
        for step in process.get("steps", []):
            if (
                step.get("approval_status") == "REVIEW_REQUIRED"
                and step.get("design_status") == "DESIGN_COMPLETE"
                and step.get("blocker_codes") == []
            ):
                rows.append((process["processCode"], step["step_code"], step.get("source_hash") or ""))
                # Candidate-only mutation. The source snapshot and DB remain
                # unchanged until every candidate package passes the gate.
                step["approval_status"] = "APPROVED"
                step["generation_status"] = "READY"
    args.candidate.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    expected = len(rows)
    if not rows:
        args.sql.write_text("", encoding="utf-8")
        print(json.dumps({"candidateCount": 0}, separators=(",", ":")))
        return
    values = ",\n".join(f"({quote(process)},{quote(step)},{quote(source_hash)})" for process, step, source_hash in rows)
    sql = f"""\\set ON_ERROR_STOP on
begin;
create temp table review_candidate(process_code text,step_code text,source_hash text,primary key(process_code,step_code));
insert into review_candidate values
{values};
create temp table promoted_step(process_code text,step_code text);
with updated as (
 update framework_step_execution_spec e
 set approval_status='APPROVED',generation_status='READY',
     approved_by='DETERMINISTIC_STATIC_CONTRACT_GATE',approved_at=current_timestamp,updated_at=current_timestamp
 from review_candidate c
 where e.process_code=c.process_code and e.step_code=c.step_code
   and e.approval_status='REVIEW_REQUIRED' and e.design_status='DESIGN_COMPLETE'
   and e.blocker_codes='[]'::jsonb and coalesce(e.source_hash,'')=c.source_hash
 returning e.process_code,e.step_code
)
insert into promoted_step select * from updated;
do $$ begin
 if (select count(*) from promoted_step)<>{expected} then
  raise exception 'review promotion count mismatch expected={expected} actual=%',(select count(*) from promoted_step);
 end if;
end $$;
insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
select j.job_id,'STATIC_CONTRACT_APPROVED','REVIEW_REQUIRED','APPROVED','review-contract-gate',
       jsonb_build_object('processCode',p.process_code,'stepCode',p.step_code,'evidence','all generated static contract packages passed')
from promoted_step p join framework_development_job j using(process_code,step_code)
where j.job_type in('FULL_STACK','FULL_STACK_GENERATION');
commit;
select count(*) from promoted_step;
"""
    args.sql.write_text(sql, encoding="utf-8")
    print(json.dumps({"candidateCount": expected}, separators=(",", ":")))


if __name__ == "__main__":
    main()
