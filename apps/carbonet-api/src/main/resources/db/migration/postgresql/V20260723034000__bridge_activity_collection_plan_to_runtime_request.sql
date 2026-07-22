-- Keep the project registration collection plan and the executable request timeline in sync.
-- Only active, unfinished collection tasks without an existing live request are backfilled.
WITH candidates AS (
  SELECT p.tenant_id,
         p.project_id,
         coalesce(manager.user_id,p.owner_name) AS requester_id,
         data_owner.user_id AS assignee_id,
         coalesce(task.due_date,p.due_date,current_date+7) AS due_date
  FROM emission_project_registry p
  JOIN emission_project_task task
    ON task.project_id=p.project_id
   AND task.task_code='ACTIVITY_DATA'
   AND task.task_status<>'DONE'
  JOIN framework_project_actor_assignment data_owner
    ON data_owner.project_id=p.project_id
   AND data_owner.actor_code='SITE_DATA_OWNER'
   AND data_owner.active_yn='Y'
  LEFT JOIN framework_project_actor_assignment manager
    ON manager.project_id=p.project_id
   AND manager.actor_code='COMPANY_MANAGER'
   AND manager.active_yn='Y'
  WHERE p.project_status<>'DELETED'
    AND NOT EXISTS (
      SELECT 1
      FROM emission_activity_request request
      WHERE request.tenant_id=p.tenant_id
        AND request.project_id=p.project_id
        AND lower(request.assignee_id)=lower(data_owner.user_id)
        AND request.request_status NOT IN ('CLOSED','CANCELLED')
    )
)
INSERT INTO emission_activity_request(
  tenant_id,project_id,request_title,request_detail,requested_items,
  requester_id,assignee_id,due_date,request_status
)
SELECT tenant_id,project_id,
       '월별 활동자료 및 증빙 제출 요청',
       '산정기간의 활동자료를 입력하고 원본 증빙을 함께 제출해 주세요.',
       '연료 사용량, 전력 사용량, 생산량, 계량기·고지서 증빙',
       requester_id,assignee_id,due_date,'REQUESTED'
FROM candidates;

INSERT INTO emission_activity_request_event(request_id,event_code,new_status,actor_id,event_note)
SELECT request.request_id,'REQUESTED','REQUESTED',request.requester_id,
       '기존 프로젝트 수집 계획을 실행 가능한 활동자료 요청으로 연결'
FROM emission_activity_request request
WHERE NOT EXISTS (
  SELECT 1 FROM emission_activity_request_event event
  WHERE event.request_id=request.request_id
);
