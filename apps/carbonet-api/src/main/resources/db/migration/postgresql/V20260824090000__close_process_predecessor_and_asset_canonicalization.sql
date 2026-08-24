-- Keep canonical E4B assets singular and prevent process tasks from being
-- instantiated before their declared prerequisite process exists.
SET lock_timeout='5s';
SET statement_timeout='60s';

UPDATE framework_unified_asset asset
   SET active_yn='N',updated_at=current_timestamp
 WHERE asset.active_yn='Y'
   AND EXISTS (
     SELECT 1 FROM framework_asset_canonical_map map
      WHERE map.duplicate_asset_id=asset.asset_id
   );

UPDATE framework_unified_asset_relation relation
   SET active_yn='N',updated_at=current_timestamp
 WHERE relation.active_yn='Y'
   AND (EXISTS (SELECT 1 FROM framework_unified_asset asset
                WHERE asset.asset_id=relation.source_asset_id AND asset.active_yn='N')
     OR EXISTS (SELECT 1 FROM framework_unified_asset asset
                WHERE asset.asset_id=relation.target_asset_id AND asset.active_yn='N'));

-- Remove only untouched generated process tasks whose declared prerequisite
-- process has no task. User-authored, started, completed and notified work is
-- retained fail-closed.
WITH orphan_process AS (
  SELECT DISTINCT task.project_id,task.process_code
    FROM emission_project_task task
    JOIN framework_business_process_sequence sequence
      ON sequence.process_code=task.process_code
     AND sequence.sequence_status='ACTIVE'
   WHERE task.task_code LIKE 'AUTO\_%' ESCAPE '\'
     AND nullif(btrim(sequence.prerequisite_process_codes),'') IS NOT NULL
     AND EXISTS (
       SELECT 1
         FROM unnest(string_to_array(sequence.prerequisite_process_codes,',')) required(process_code)
        WHERE NOT EXISTS (
          SELECT 1 FROM emission_project_task prerequisite
           WHERE prerequisite.project_id=task.project_id
             AND prerequisite.process_code=btrim(required.process_code)
        )
     )
     AND NOT EXISTS (
       SELECT 1 FROM emission_project_task protected
        WHERE protected.project_id=task.project_id
          AND protected.process_code=task.process_code
          AND (protected.task_code NOT LIKE 'AUTO\_%' ESCAPE '\'
            OR protected.task_status NOT IN ('WAITING','READY','BLOCKED')
            OR protected.started_at IS NOT NULL
            OR protected.completed_at IS NOT NULL
            OR EXISTS (SELECT 1 FROM emission_workflow_notification notification
                        WHERE notification.task_id=protected.task_id))
     )
)
DELETE FROM emission_project_task task
 USING orphan_process orphan
 WHERE task.project_id=orphan.project_id
   AND task.process_code=orphan.process_code;

DO $$
DECLARE
  definition text;
  ready_needle text := $ready$
      AND a.implementation_status='READY'
      AND NOT EXISTS(SELECT 1 FROM emission_project_task existing WHERE existing.project_id=target_project_id AND framework_task_matches_process(existing.process_code, existing.task_code, a.process_code))$ready$;
  ready_replacement text := $ready$
      AND a.implementation_status='READY'
      AND NOT EXISTS (
        SELECT 1
          FROM unnest(string_to_array(nullif(seq.prerequisite_process_codes,''),',')) required(process_code)
         WHERE NOT EXISTS (
           SELECT 1 FROM emission_project_task prerequisite
            WHERE prerequisite.project_id=target_project_id
              AND prerequisite.process_code=btrim(required.process_code)
         )
      )
      AND NOT EXISTS(SELECT 1 FROM emission_project_task existing WHERE existing.project_id=target_project_id AND framework_task_matches_process(existing.process_code, existing.task_code, a.process_code))$ready$;
  row_count_needle text := $rowcount$  GET DIAGNOSTICS inserted_tasks = ROW_COUNT;$rowcount$;
  row_count_replacement text := $rowcount$  GET DIAGNOSTICS inserted_tasks = ROW_COUNT;

  -- The first task of a non-entry process is bound to the last task of every
  -- declared prerequisite process. This makes the task graph match the
  -- business-process graph instead of relying on an implicit blocked reason.
  UPDATE emission_project_task root_task
     SET predecessor_codes=predecessor.task_codes,updated_at=current_timestamp
    FROM framework_business_process_sequence sequence
    CROSS JOIN LATERAL (
      SELECT string_agg(last_task.task_code,',' ORDER BY required.ordinality) task_codes
        FROM unnest(string_to_array(sequence.prerequisite_process_codes,','))
             WITH ORDINALITY required(process_code,ordinality)
        CROSS JOIN LATERAL (
          SELECT task.task_code
            FROM emission_project_task task
           WHERE task.project_id=target_project_id
             AND task.process_code=btrim(required.process_code)
           ORDER BY task.step_order DESC,task.task_id DESC
           LIMIT 1
        ) last_task
    ) predecessor
   WHERE root_task.project_id=target_project_id
     AND root_task.process_code=sequence.process_code
     AND root_task.task_code LIKE 'AUTO\_%' ESCAPE '\'
     AND root_task.process_step_code=(SELECT step.step_code FROM framework_process_step step
                                      WHERE step.process_code=root_task.process_code
                                      ORDER BY step.step_order,step.step_code LIMIT 1)
     AND nullif(btrim(root_task.predecessor_codes),'') IS NULL
     AND nullif(btrim(sequence.prerequisite_process_codes),'') IS NOT NULL
     AND predecessor.task_codes IS NOT NULL;$rowcount$;
BEGIN
  definition:=pg_get_functiondef(
    'framework_sync_project_processes(character varying,character varying)'::regprocedure
  );
  IF position(ready_replacement in definition)=0 THEN
    IF position(ready_needle in definition)=0 THEN
      RAISE EXCEPTION 'PROJECT_PROCESS_PREREQUISITE_GUARD_SOURCE_NOT_FOUND';
    END IF;
    definition:=replace(definition,ready_needle,ready_replacement);
  END IF;
  IF position('predecessor.task_codes' in definition)=0 THEN
    IF position(row_count_needle in definition)=0 THEN
      RAISE EXCEPTION 'PROJECT_PROCESS_PREDECESSOR_BIND_SOURCE_NOT_FOUND';
    END IF;
    definition:=replace(definition,row_count_needle,row_count_replacement);
  END IF;
  EXECUTE definition;
END $$;

DO $$
DECLARE project_code varchar;
BEGIN
  FOR project_code IN SELECT project_id FROM emission_project_registry LOOP
    PERFORM framework_sync_project_processes(project_code,'FLYWAY_PREDECESSOR_CLOSURE');
  END LOOP;
END $$;

DO $$
DECLARE active_duplicates integer; invalid_workflows integer;
BEGIN
  SELECT count(*) INTO active_duplicates
    FROM framework_asset_canonical_map map
    JOIN framework_unified_asset asset ON asset.asset_id=map.duplicate_asset_id
   WHERE asset.active_yn='Y';
  SELECT count(*) INTO invalid_workflows
    FROM emission_project_workflow_health WHERE workflow_health<>'READY';
  IF active_duplicates<>0 OR invalid_workflows<>0 THEN
    RAISE EXCEPTION 'PROCESS_ASSET_CLOSURE_FAILED active_duplicates=% invalid_workflows=%',
      active_duplicates,invalid_workflows;
  END IF;
END $$;

RESET statement_timeout;
RESET lock_timeout;
