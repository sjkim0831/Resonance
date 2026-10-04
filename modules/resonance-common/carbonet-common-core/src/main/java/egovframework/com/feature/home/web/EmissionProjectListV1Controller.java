package egovframework.com.feature.home.web;

import egovframework.com.feature.auth.service.CurrentUserContextService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import java.time.LocalDate;
import java.util.*;

/** Read-only list contract. Does not change legacy clients, permissions or project data. */
@RestController
public class EmissionProjectListV1Controller {
    private final JdbcTemplate jdbc;
    private final CurrentUserContextService users;
    public EmissionProjectListV1Controller(JdbcTemplate jdbc, CurrentUserContextService users) {
        this.jdbc=jdbc; this.users=users;
    }

    static final String ACCESS = "p.tenant_id=? AND (? OR EXISTS (SELECT 1 FROM framework_account_actor_assignment a WHERE a.tenant_id=p.tenant_id AND lower(a.account_id)=lower(?) AND a.assignment_status='ACTIVE' AND (a.valid_from IS NULL OR a.valid_from<=current_date) AND (a.valid_until IS NULL OR a.valid_until>=current_date) AND a.project_id IN ('*',p.project_id) AND (a.data_scope='*' OR p.project_id=ANY(string_to_array(replace(a.data_scope,' ',''),',')))))";
    static final String BASE = """
        WITH permitted AS (SELECT p.* FROM emission_project_registry p WHERE %s),
        enriched AS (
          SELECT p.*, CASE WHEN p.project_status='보고 완료' THEN 'REPORT_COMPLETED'
            WHEN p.project_status IN ('완료','COMPLETED') THEN 'COMPLETED'
            WHEN p.project_status IN ('중단','STOPPED','CANCELLED') THEN 'STOPPED'
            WHEN p.project_status IN ('진행','검증','보완 필요','IN_PROGRESS') THEN 'IN_PROGRESS'
            ELSE 'UNKNOWN' END AS display_status,
          CASE WHEN c.calculation_id IS NULL THEN 'NOT_CALCULATED'
            WHEN c.calculation_status IN ('FAILED','ERROR') THEN 'FAILED'
            WHEN c.calculation_status IN ('RUNNING','CALCULATING') THEN 'RUNNING'
            WHEN c.calculation_status IN ('CALCULATED','VERIFIED','APPROVED','LOCKED')
              THEN CASE WHEN c.calculated_at IS NULL THEN 'UNKNOWN'
                WHEN coalesce(a.changed_at,c.calculated_at)>c.calculated_at THEN 'STALE'
                ELSE 'CALCULATED' END ELSE 'UNKNOWN' END AS calculation_state,
          c.calculation_id AS latest_calculation_id,
          c.calculation_status AS latest_calculation_status,
          c.total_emission AS latest_calculation_total,
          c.result_unit AS latest_calculation_unit,
          greatest(p.updated_at,p.created_at,a.changed_at,c.calculated_at,c.locked_at) AS last_changed_at
          FROM permitted p
          LEFT JOIN LATERAL (SELECT * FROM emission_calculation_run r WHERE r.project_id=p.project_id AND r.tenant_id=p.tenant_id ORDER BY r.version_no DESC,r.calculation_id DESC LIMIT 1) c ON true
          LEFT JOIN LATERAL (SELECT max(updated_at) AS changed_at FROM emission_activity_data d WHERE d.project_id=p.project_id) a ON true
        )
        """.formatted(ACCESS);

    @GetMapping({"/home/api/emission-project-list-v1","/en/home/api/emission-project-list-v1"})
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public ResponseEntity<?> list(@RequestParam(defaultValue="") String keyword,
        @RequestParam(defaultValue="") String siteId, @RequestParam(defaultValue="") String status,
        @RequestParam(defaultValue="") String periodFrom, @RequestParam(defaultValue="") String periodTo,
        @RequestParam(name="page",required=false) String pageValue, @RequestParam(name="pageSize",required=false) String sizeValue,
        @RequestParam(defaultValue="UPDATED_DESC") String sort, HttpServletRequest request) {
        var user=users.resolve(request);
        if(!user.isAuthenticated()) return ResponseEntity.status(401).body(Map.of("message","로그인이 필요합니다."));
        String tenant=user.isWebmaster()?"DEFAULT":(user.getInsttId().isBlank()?"DEFAULT":user.getInsttId());
        try {
            int page=pageValue==null||pageValue.isBlank()?1:Integer.parseInt(pageValue);
            int pageSize=sizeValue==null||sizeValue.isBlank()?20:Integer.parseInt(sizeValue);
            if(sort==null||sort.isBlank())sort="UPDATED_DESC";
            String term=keyword.trim();
            if(term.length()>100) throw new IllegalArgumentException("프로젝트명 검색은 100자 이내로 입력하세요.");
            if(!Set.of("","IN_PROGRESS","COMPLETED","STOPPED","REPORT_COMPLETED").contains(status)) throw new IllegalArgumentException("진행 상태가 올바르지 않습니다.");
            if(!Set.of(20,50,100).contains(pageSize)||page<1||page>1000000) throw new IllegalArgumentException("페이지 설정이 올바르지 않습니다.");
            LocalDate from=periodFrom.isBlank()?null:LocalDate.parse(periodFrom);
            LocalDate to=periodTo.isBlank()?null:LocalDate.parse(periodTo);
            if(from!=null&&to!=null&&from.isAfter(to)) throw new IllegalArgumentException("시작일은 종료일보다 늦을 수 없습니다.");
            Long site=siteId.isBlank()?null:Long.valueOf(siteId);
            if(site!=null&&site<=0) throw new IllegalArgumentException("사업장 선택값이 올바르지 않습니다.");
            String ordering=switch(sort) {
                case "UPDATED_DESC" -> "last_changed_at DESC NULLS LAST,project_id ASC";
                case "UPDATED_ASC" -> "last_changed_at ASC NULLS LAST,project_id ASC";
                case "NAME_ASC" -> "project_name ASC,project_id ASC";
                case "NAME_DESC" -> "project_name DESC,project_id ASC";
                default -> throw new IllegalArgumentException("정렬값이 올바르지 않습니다.");
            };
            List<Object> args=new ArrayList<>(List.of(tenant,user.isWebmaster(),user.getUserId()));
            StringBuilder where=new StringBuilder(" WHERE true");
            if(!term.isEmpty()){where.append(" AND strpos(lower(e.project_name),lower(?))>0");args.add(term);}
            if(!status.isEmpty()){where.append(" AND e.display_status=?");args.add(status);}
            if(site!=null){where.append(" AND EXISTS (SELECT 1 FROM emission_project_site ps WHERE ps.project_id=e.project_id AND ps.site_id=?)");args.add(site);}
            if(from!=null){where.append(" AND e.period_end>=?");args.add(java.sql.Date.valueOf(from));}
            if(to!=null){where.append(" AND e.period_start<=?");args.add(java.sql.Date.valueOf(to));}
            Long total=jdbc.queryForObject(BASE+"SELECT count(*) FROM enriched e"+where,Long.class,args.toArray());
            long count=total==null?0:total;
            Map<String,Object> summary=new LinkedHashMap<>(jdbc.queryForMap(BASE+"""
                SELECT count(*) AS "projectCount",
                  count(*) FILTER (WHERE e.display_status='COMPLETED') AS "completedCount",
                  count(*) FILTER (WHERE e.calculation_state='CALCULATED') AS "calculatedCount",
                  count(*) FILTER (WHERE e.calculation_state='NOT_CALCULATED') AS "notCalculatedCount",
                  count(a.result_lock_id) AS "approvedProjectCount",
                  CASE WHEN count(DISTINCT a.result_unit) FILTER (WHERE a.result_lock_id IS NOT NULL)<=1
                    THEN coalesce(sum(a.total_emission),0) ELSE NULL END AS "approvedTotalEmission",
                  count(DISTINCT a.result_unit) FILTER (WHERE a.result_lock_id IS NOT NULL) AS "approvedUnitCount",
                  min(a.result_unit) FILTER (WHERE a.result_lock_id IS NOT NULL) AS "approvedResultUnit"
                FROM enriched e
                LEFT JOIN LATERAL (
                  SELECT l.result_lock_id,l.total_emission,l.result_unit
                  FROM emission_current_contract c
                  JOIN emission_result_lock l ON l.project_id=c.project_id
                    AND l.calculation_id=c.calculation_id AND l.submission_id=c.submission_id
                    AND l.tenant_id=e.tenant_id AND l.lock_status='LOCKED'
                  WHERE c.project_id=e.project_id AND c.approval_current=true
                  ORDER BY l.locked_at DESC,l.result_lock_id DESC LIMIT 1
                ) a ON true
                """+where,args.toArray()));
            Map<String,Object> latestCalculationSummary=jdbc.queryForMap(BASE+"""
                SELECT count(*) FILTER (WHERE e.calculation_state='CALCULATED'
                    AND e.latest_calculation_status IN ('CALCULATED','VERIFIED')
                    AND NOT EXISTS (SELECT 1 FROM emission_current_contract cc WHERE cc.project_id=e.project_id
                      AND cc.tenant_id=e.tenant_id AND cc.calculation_id=e.latest_calculation_id AND cc.approval_current=true))
                    AS "latestUnapprovedCalculationProjectCount",
                  CASE WHEN count(DISTINCT e.latest_calculation_unit) FILTER (WHERE e.calculation_state='CALCULATED'
                      AND e.latest_calculation_status IN ('CALCULATED','VERIFIED')
                      AND NOT EXISTS (SELECT 1 FROM emission_current_contract cc WHERE cc.project_id=e.project_id
                        AND cc.tenant_id=e.tenant_id AND cc.calculation_id=e.latest_calculation_id AND cc.approval_current=true))<=1
                    THEN coalesce(sum(e.latest_calculation_total) FILTER (WHERE e.calculation_state='CALCULATED'
                      AND e.latest_calculation_status IN ('CALCULATED','VERIFIED')
                      AND NOT EXISTS (SELECT 1 FROM emission_current_contract cc WHERE cc.project_id=e.project_id
                        AND cc.tenant_id=e.tenant_id AND cc.calculation_id=e.latest_calculation_id AND cc.approval_current=true)),0)
                    ELSE NULL END AS "latestUnapprovedCalculationTotalEmission",
                  count(DISTINCT e.latest_calculation_unit) FILTER (WHERE e.calculation_state='CALCULATED'
                      AND e.latest_calculation_status IN ('CALCULATED','VERIFIED')
                      AND NOT EXISTS (SELECT 1 FROM emission_current_contract cc WHERE cc.project_id=e.project_id
                        AND cc.tenant_id=e.tenant_id AND cc.calculation_id=e.latest_calculation_id AND cc.approval_current=true))
                    AS "latestUnapprovedCalculationUnitCount",
                  min(e.latest_calculation_unit) FILTER (WHERE e.calculation_state='CALCULATED'
                      AND e.latest_calculation_status IN ('CALCULATED','VERIFIED')
                      AND NOT EXISTS (SELECT 1 FROM emission_current_contract cc WHERE cc.project_id=e.project_id
                        AND cc.tenant_id=e.tenant_id AND cc.calculation_id=e.latest_calculation_id AND cc.approval_current=true))
                    AS "latestUnapprovedCalculationResultUnit"
                FROM enriched e
                """+where,args.toArray());
            summary.putAll(latestCalculationSummary);
            String filteredCte=", filtered AS (SELECT e.* FROM enriched e"+where+") ";
            Map<String,Object> actionCounts=jdbc.queryForMap(BASE+filteredCte+"""
                SELECT count(r.request_id) FILTER(WHERE r.request_status IN ('REQUESTED','IN_PROGRESS')) AS "requestedCount",
                  count(r.request_id) FILTER(WHERE r.request_status='SUBMITTED') AS "pendingAcceptanceCount",
                  count(r.request_id) FILTER(WHERE r.request_status='CORRECTION_REQUIRED') AS "correctionCount",
                  count(r.request_id) FILTER(WHERE r.request_status IN ('REQUESTED','IN_PROGRESS','SUBMITTED','CORRECTION_REQUIRED')
                    AND coalesce(r.correction_due_date,r.due_date)<=current_date+7) AS "deadlineCount"
                FROM filtered f LEFT JOIN emission_activity_request r
                  ON r.project_id=f.project_id AND r.tenant_id=f.tenant_id
                """,args.toArray());
            Map<String,Object> taskCounts=jdbc.queryForMap(BASE+filteredCte+"""
                SELECT count(t.task_id) FILTER(WHERE t.task_status<>'DONE') AS "openCount",
                  count(t.task_id) FILTER(WHERE t.task_status<>'DONE' AND t.due_date<current_date) AS "overdueCount",
                  count(t.task_id) FILTER(WHERE t.task_status<>'DONE' AND t.due_date BETWEEN current_date AND current_date+7) AS "dueSoonCount",
                  count(t.task_id) FILTER(WHERE t.task_code='APPROVAL' AND t.task_status<>'DONE') AS "approvalCount"
                FROM filtered f LEFT JOIN emission_project_task t ON t.project_id=f.project_id
                """,args.toArray());
            String monthFrom=from==null?"":from.toString().substring(0,7),monthTo=to==null?"":to.toString().substring(0,7);
            String monthFilter=" AND (?='' OR substring(i.activity_period,1,7)>=?) AND (?='' OR substring(i.activity_period,1,7)<=?)";
            List<Object> monthArgs=new ArrayList<>(args);monthArgs.add(monthFrom);monthArgs.add(monthFrom);monthArgs.add(monthTo);monthArgs.add(monthTo);
            Map<String,Object> monthCheck=jdbc.queryForMap(BASE+filteredCte+"""
                , locked AS (
                  SELECT e.project_id,e.tenant_id,l.calculation_id,l.total_emission
                  FROM filtered e JOIN emission_current_contract c
                    ON c.project_id=e.project_id AND c.approval_current=true
                  JOIN emission_result_lock l ON l.project_id=c.project_id AND l.tenant_id=e.tenant_id
                    AND l.calculation_id=c.calculation_id AND l.submission_id=c.submission_id AND l.lock_status='LOCKED'
                ), quality AS (
                  SELECT l.project_id,l.calculation_id,l.total_emission,count(i.calculation_item_id) AS item_count,
                    count(i.calculation_item_id) FILTER(WHERE i.activity_period IS NULL OR i.activity_period !~ '^[0-9]{4}-(0[1-9]|1[0-2])') AS invalid_period_count,
                    coalesce(sum(i.emission_value),0) AS item_total
                  FROM locked l LEFT JOIN emission_calculation_item i ON i.calculation_id=l.calculation_id
                  GROUP BY l.project_id,l.calculation_id,l.total_emission
                )
                SELECT count(*) AS "lockedCount",
                  coalesce(bool_and(q.item_count>0 AND q.invalid_period_count=0 AND q.total_emission IS NOT NULL
                    AND abs(q.item_total-q.total_emission)<=0.000001),false) AS "complete"
                FROM quality q
                """,args.toArray());
            int lockedCount=((Number)monthCheck.get("lockedCount")).intValue();
            boolean monthlyComplete=Boolean.TRUE.equals(monthCheck.get("complete"));
            String monthlyStatus=lockedCount==0?"NO_APPROVED_RESULT":monthlyComplete?"AVAILABLE":"INCOMPLETE_RESULT_PERIODS";
            List<Map<String,Object>> monthlyEmissions=List.of();
            if(monthlyComplete) monthlyEmissions=jdbc.queryForList(BASE+filteredCte+"""
                , locked AS (
                  SELECT e.project_id,e.tenant_id,l.calculation_id
                  FROM filtered e JOIN emission_current_contract c
                    ON c.project_id=e.project_id AND c.approval_current=true
                  JOIN emission_result_lock l ON l.project_id=c.project_id AND l.tenant_id=e.tenant_id
                    AND l.calculation_id=c.calculation_id AND l.submission_id=c.submission_id AND l.lock_status='LOCKED'
                )
                SELECT substring(i.activity_period,1,7) AS month,sum(i.emission_value) AS "totalEmission"
                FROM locked l JOIN emission_calculation_item i ON i.calculation_id=l.calculation_id
                WHERE i.activity_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])'"""+monthFilter+" GROUP BY substring(i.activity_period,1,7) ORDER BY month",monthArgs.toArray());
            Map<String,Object> latestCalculationCheck=jdbc.queryForMap(BASE+filteredCte+"""
                , working AS (
                  SELECT f.project_id,f.tenant_id,f.latest_calculation_id,f.latest_calculation_total
                  FROM filtered f
                  WHERE f.calculation_state='CALCULATED' AND f.latest_calculation_status IN ('CALCULATED','VERIFIED')
                    AND NOT EXISTS (SELECT 1 FROM emission_current_contract cc WHERE cc.project_id=f.project_id
                      AND cc.tenant_id=f.tenant_id AND cc.calculation_id=f.latest_calculation_id AND cc.approval_current=true)
                ), quality AS (
                  SELECT w.project_id,w.latest_calculation_id,w.latest_calculation_total,
                    count(i.calculation_item_id) AS item_count,
                    count(i.calculation_item_id) FILTER (WHERE coalesce(nullif(i.activity_period,''),nullif(d.activity_period,''))
                      ~ '^[0-9]{4}-(0[1-9]|1[0-2])$') AS valid_period_count,
                    coalesce(sum(i.emission_value),0) AS item_total
                  FROM working w LEFT JOIN emission_calculation_item i ON i.calculation_id=w.latest_calculation_id
                  LEFT JOIN emission_activity_data d ON d.activity_id=i.activity_id AND d.project_id=w.project_id
                  GROUP BY w.project_id,w.latest_calculation_id,w.latest_calculation_total
                )
                SELECT count(*) AS "projectCount",
                  coalesce(bool_and(q.item_count>0 AND q.valid_period_count=q.item_count AND q.latest_calculation_total IS NOT NULL
                    AND abs(q.item_total-q.latest_calculation_total)<=0.000001),false) AS "complete"
                FROM quality q
                """,args.toArray());
            int latestCalculationProjectCount=((Number)latestCalculationCheck.get("projectCount")).intValue();
            boolean latestCalculationComplete=Boolean.TRUE.equals(latestCalculationCheck.get("complete"));
            String latestCalculationMonthlyStatus=latestCalculationProjectCount==0?"NO_UNAPPROVED_CALCULATION":latestCalculationComplete?"AVAILABLE":"INCOMPLETE_RESULT_PERIODS";
            List<Map<String,Object>> latestCalculationMonthlyEmissions=List.of();
            List<Map<String,Object>> latestCalculationCategoryEmissions=List.of();
            if(latestCalculationComplete) {
                String calculationPeriod="coalesce(nullif(i.activity_period,''),nullif(d.activity_period,''))";
                String calculationMonthlySql=BASE+filteredCte+"""
                    , working AS (
                      SELECT f.project_id,f.latest_calculation_id FROM filtered f
                      WHERE f.calculation_state='CALCULATED' AND f.latest_calculation_status IN ('CALCULATED','VERIFIED')
                        AND NOT EXISTS (SELECT 1 FROM emission_current_contract cc WHERE cc.project_id=f.project_id
                          AND cc.tenant_id=f.tenant_id AND cc.calculation_id=f.latest_calculation_id AND cc.approval_current=true)
                    )
                    SELECT substring(%s,1,7) AS month,sum(i.emission_value) AS "totalEmission"
                    FROM working w JOIN emission_calculation_item i ON i.calculation_id=w.latest_calculation_id
                    LEFT JOIN emission_activity_data d ON d.activity_id=i.activity_id AND d.project_id=w.project_id
                    WHERE %s ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
                      AND (?='' OR substring(%s,1,7)>=?) AND (?='' OR substring(%s,1,7)<=?)
                    GROUP BY substring(%s,1,7) ORDER BY month
                    """.formatted(calculationPeriod,calculationPeriod,calculationPeriod,calculationPeriod,calculationPeriod);
                latestCalculationMonthlyEmissions=jdbc.queryForList(calculationMonthlySql,monthArgs.toArray());
                latestCalculationCategoryEmissions=jdbc.queryForList(BASE+filteredCte+"""
                    , working AS (
                      SELECT f.project_id,f.latest_calculation_id FROM filtered f
                      WHERE f.calculation_state='CALCULATED' AND f.latest_calculation_status IN ('CALCULATED','VERIFIED')
                        AND NOT EXISTS (SELECT 1 FROM emission_current_contract cc WHERE cc.project_id=f.project_id
                          AND cc.tenant_id=f.tenant_id AND cc.calculation_id=f.latest_calculation_id AND cc.approval_current=true)
                    )
                    SELECT coalesce(nullif(btrim(i.category),''),nullif(btrim(d.category),''),'미분류') AS category,
                      sum(i.emission_value) AS "totalEmission"
                    FROM working w JOIN emission_calculation_item i ON i.calculation_id=w.latest_calculation_id
                    LEFT JOIN emission_activity_data d ON d.activity_id=i.activity_id AND d.project_id=w.project_id
                    GROUP BY coalesce(nullif(btrim(i.category),''),nullif(btrim(d.category),''),'미분류')
                    ORDER BY category
                    """,args.toArray());
            }
            long overdueTaskCount=((Number)taskCounts.get("overdueCount")).longValue();
            long dueSoonTaskCount=((Number)taskCounts.get("dueSoonCount")).longValue();
            taskCounts.put("urgentCount",overdueTaskCount+dueSoonTaskCount);
            taskCounts.put("serverDate",LocalDate.now().toString());
            int actualPage=(int)Math.min(page,Math.max(1,(count+pageSize-1)/pageSize));
            List<Object> paged=new ArrayList<>(args);paged.add(pageSize);paged.add((actualPage-1)*pageSize);
            var items=jdbc.queryForList(BASE+"""
                SELECT e.project_id AS id,e.project_name AS name,e.period_start AS "periodStart",e.period_end AS "periodEnd",
                  e.calculation_period AS "legacyPeriod",e.display_status AS status,e.calculation_state AS "calculatedStatus",
                  e.latest_calculation_total AS "latestCalculationTotal",e.latest_calculation_unit AS "latestCalculationUnit",
                  a.total_emission AS "approvedTotalEmission",a.result_unit AS "approvedResultUnit",e.last_changed_at AS "updatedAt"
                FROM enriched e
                LEFT JOIN LATERAL (
                  SELECT l.total_emission,l.result_unit FROM emission_current_contract c
                  JOIN emission_result_lock l ON l.project_id=c.project_id AND l.tenant_id=c.tenant_id
                    AND l.calculation_id=c.calculation_id AND l.submission_id=c.submission_id AND l.lock_status='LOCKED'
                  WHERE c.project_id=e.project_id AND c.tenant_id=e.tenant_id AND c.approval_current=true
                  ORDER BY l.locked_at DESC,l.result_lock_id DESC LIMIT 1
                ) a ON true
                """+where+" ORDER BY "+ordering+" LIMIT ? OFFSET ?",paged.toArray());
            // One relation query for the page, not one request per project. Legacy names are marked separately.
            if(!items.isEmpty()) {
                var ids=items.stream().map(row->row.get("id")).toList();
                String marks=String.join(",",Collections.nCopies(ids.size(),"?"));
                var relations=jdbc.queryForList("SELECT ps.project_id,ps.site_id AS id,ps.site_name AS name FROM emission_project_site ps JOIN emission_site_registry s ON s.site_id=ps.site_id JOIN emission_project_registry p ON p.project_id=ps.project_id AND p.tenant_id=s.tenant_id WHERE ps.project_id IN ("+marks+") ORDER BY ps.display_order,ps.site_id",ids.toArray());
                for(var row:items) row.put("sites",relations.stream().filter(r->Objects.equals(r.get("project_id"),row.get("id"))).map(r->Map.of("id",String.valueOf(r.get("id")),"name",String.valueOf(r.get("name")))).toList());
            }
            var siteOptions=jdbc.queryForList("SELECT DISTINCT s.site_id::text AS id,s.site_name AS name FROM emission_site_registry s JOIN emission_project_site ps ON ps.site_id=s.site_id JOIN emission_project_registry p ON p.project_id=ps.project_id AND p.tenant_id=s.tenant_id WHERE "+ACCESS+" ORDER BY name,id",tenant,user.isWebmaster(),user.getUserId());
            // Creation permission is deliberately not inferred from the presence of projects.
            boolean canCreate=user.isWebmaster()||Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM framework_account_actor_assignment a WHERE a.tenant_id=? AND lower(a.account_id)=lower(?) AND a.actor_code='COMPANY_MANAGER' AND a.assignment_status='ACTIVE' AND a.project_id='*' AND a.data_scope='*' AND (a.valid_from IS NULL OR a.valid_from<=current_date) AND (a.valid_until IS NULL OR a.valid_until>=current_date))",Boolean.class,tenant,user.getUserId()));
            Map<String,Object> result=new LinkedHashMap<>();
            result.put("contractVersion",1);result.put("items",items);result.put("totalCount",count);result.put("page",actualPage);result.put("pageSize",pageSize);result.put("sites",siteOptions);result.put("canCreate",canCreate);result.put("summary",summary);result.put("actionCounts",actionCounts);result.put("taskCounts",taskCounts);result.put("monthlyStatus",monthlyStatus);result.put("monthlyEmissions",monthlyEmissions);
            result.put("latestCalculationMonthlyStatus",latestCalculationMonthlyStatus);result.put("latestCalculationMonthlyEmissions",latestCalculationMonthlyEmissions);result.put("latestCalculationCategoryEmissions",latestCalculationCategoryEmissions);
            result.put("scopeNotice","기존 프로젝트 단위 접근권한 적용. 사업장별 별도 접근범위는 아직 이 조회 계약에서 지원하지 않습니다.");
            return ResponseEntity.ok(result);
        } catch(java.time.format.DateTimeParseException e) {
            return ResponseEntity.badRequest().body(Map.of("message","날짜 형식이 올바르지 않습니다."));
        } catch(IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message",e.getMessage()));
        }
    }
}
