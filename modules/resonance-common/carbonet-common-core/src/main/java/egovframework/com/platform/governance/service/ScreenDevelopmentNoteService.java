package egovframework.com.platform.governance.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ScreenDevelopmentNoteService {
    private final JdbcTemplate jdbc;

    public Map<String,Object> find(String routePath) {
        String routeKey=routeKey(routePath);
        List<Map<String,Object>> rows=jdbc.queryForList("select route_key as \"routeKey\",route_path as \"routePath\",page_id as \"pageId\",page_title as \"pageTitle\",coalesce(design_note,'') as \"designNote\",coalesce(function_note,'') as \"functionNote\",coalesce(acceptance_note,'') as \"acceptanceNote\",development_status as status,note_version as version,updated_by as \"updatedBy\",updated_at as \"updatedAt\" from framework_screen_development_note where route_key=?",routeKey);
        if(!rows.isEmpty()){
            Map<String,Object> result=new LinkedHashMap<>(rows.get(0));
            result.put("mockups",findMockups(routeKey));
            return result;
        }
        Map<String,Object> empty=new LinkedHashMap<>();
        empty.put("routeKey",routeKey);empty.put("routePath",cleanRoute(routePath));empty.put("pageId","");empty.put("pageTitle","");
        empty.put("designNote","");empty.put("functionNote","");empty.put("acceptanceNote","");empty.put("status","DRAFT");empty.put("version",0);empty.put("mockups",List.of());
        return empty;
    }

    @Transactional public Map<String,Object> save(Map<String,Object> body,String actor) {
        String routePath=required(body,"routePath"),routeKey=routeKey(routePath);
        String design=text(body,"designNote"),function=text(body,"functionNote"),acceptance=text(body,"acceptanceNote");
        if(design.isBlank()&&function.isBlank()&&acceptance.isBlank())throw new IllegalArgumentException("설계, 기능, 완료 기준 중 하나 이상을 입력해야 합니다.");
        String status=text(body,"status").isBlank()?"READY":text(body,"status");
        if(!List.of("DRAFT","READY","IN_DEVELOPMENT","VERIFIED").contains(status))throw new IllegalArgumentException("지원하지 않는 설계 상태입니다.");
        jdbc.query("select pg_advisory_xact_lock(hashtext(?))",rs->{},routeKey);
        jdbc.update("insert into framework_screen_development_note(route_key,route_path,page_id,page_title,design_note,function_note,acceptance_note,development_status,updated_by) values(?,?,?,?,?,?,?,?,?) on conflict(route_key) do update set route_path=excluded.route_path,page_id=excluded.page_id,page_title=excluded.page_title,design_note=excluded.design_note,function_note=excluded.function_note,acceptance_note=excluded.acceptance_note,development_status=excluded.development_status,note_version=framework_screen_development_note.note_version+1,updated_by=excluded.updated_by,updated_at=current_timestamp",routeKey,cleanRoute(routePath),text(body,"pageId"),text(body,"pageTitle"),design,function,acceptance,status,actor);
        jdbc.update("insert into framework_screen_development_note_history(route_key,route_path,page_id,page_title,design_note,function_note,acceptance_note,development_status,note_version,changed_by) select route_key,route_path,page_id,page_title,design_note,function_note,acceptance_note,development_status,note_version,? from framework_screen_development_note where route_key=?",actor,routeKey);
        return find(routePath);
    }

    public String developmentBasis(String routePath) {
        if(routePath==null||routePath.isBlank()||"null".equals(routePath))return "화면 경로 없음";
        List<Map<String,Object>> rows=jdbc.queryForList("select coalesce(design_note,'') as design,coalesce(function_note,'') as function,coalesce(acceptance_note,'') as acceptance,note_version as version from framework_screen_development_note where route_key=?",routeKey(routePath));
        if(rows.isEmpty())return "[화면 설계 메모] 미등록 - 구현 착수 전에 해당 화면의 설계 버튼에서 기준을 등록해야 함";
        Map<String,Object> row=rows.get(0);
        String basis="[화면 설계 메모 v"+row.get("version")+"] 설계="+row.get("design")+" | 기능="+row.get("function")+" | 완료기준="+row.get("acceptance");
        List<Map<String,Object>> selected=jdbc.queryForList("select slot_no as \"slotNo\",mockup_title as title,prompt_text as prompt,html_content as html,mockup_version as version,mockup_status as status from framework_screen_html_mockup where route_key=? and selected=true",routeKey(routePath));
        if(!selected.isEmpty()){
            Map<String,Object> mockup=selected.get(0);
            String html=String.valueOf(mockup.get("html"));
            if(html.length()>12000)html=html.substring(0,12000)+"<!-- truncated -->";
            basis+=" | [선택 HTML 시안 #"+mockup.get("slotNo")+" v"+mockup.get("version")+"] 제목="+mockup.get("title")+" | 프롬프트="+mockup.get("prompt")+" | 상태="+mockup.get("status")+" | HTML="+html;
        }
        return basis;
    }

    @Transactional public Map<String,Object> saveMockup(int slotNo,Map<String,Object> body,String actor){
        if(slotNo<1||slotNo>5)throw new IllegalArgumentException("시안 번호는 1~5만 사용할 수 있습니다.");
        String routePath=required(body,"routePath"),routeKey=routeKey(routePath),prompt=required(body,"prompt"),html=required(body,"html");
        String title=text(body,"title").isBlank()?"HTML 시안 "+slotNo:text(body,"title");
        jdbc.query("select pg_advisory_xact_lock(hashtext(?))",rs->{},routeKey);
        jdbc.update("insert into framework_screen_html_mockup(route_key,route_path,page_id,slot_no,mockup_title,prompt_text,html_content,updated_by) values(?,?,?,?,?,?,?,?) on conflict(route_key,slot_no) do update set route_path=excluded.route_path,page_id=excluded.page_id,mockup_title=excluded.mockup_title,prompt_text=excluded.prompt_text,html_content=excluded.html_content,mockup_version=framework_screen_html_mockup.mockup_version+1,updated_by=excluded.updated_by,updated_at=current_timestamp",routeKey,cleanRoute(routePath),text(body,"pageId"),slotNo,title,prompt,html,actor);
        recordMockupHistory(routeKey,slotNo,actor);
        return find(routePath);
    }

    @Transactional public Map<String,Object> selectMockup(int slotNo,Map<String,Object> body,String actor){
        if(slotNo<1||slotNo>5)throw new IllegalArgumentException("시안 번호는 1~5만 사용할 수 있습니다.");
        String routePath=required(body,"routePath"),routeKey=routeKey(routePath);
        boolean requestApply=Boolean.parseBoolean(String.valueOf(body.getOrDefault("requestApply",false)));
        jdbc.query("select pg_advisory_xact_lock(hashtext(?))",rs->{},routeKey);
        Integer count=jdbc.queryForObject("select count(*) from framework_screen_html_mockup where route_key=? and slot_no=?",Integer.class,routeKey,slotNo);
        if(count==null||count==0)throw new IllegalArgumentException("선택할 HTML 시안이 없습니다.");
        jdbc.update("update framework_screen_html_mockup set selected=false,mockup_status='DRAFT',updated_by=?,updated_at=current_timestamp where route_key=? and selected=true",actor,routeKey);
        jdbc.update("update framework_screen_html_mockup set selected=true,mockup_status=?,updated_by=?,updated_at=current_timestamp where route_key=? and slot_no=?",requestApply?"APPLY_REQUESTED":"SELECTED",actor,routeKey,slotNo);
        recordMockupHistory(routeKey,slotNo,actor);
        return find(routePath);
    }

    private List<Map<String,Object>> findMockups(String routeKey){
        return jdbc.queryForList("select mockup_id as \"mockupId\",slot_no as \"slotNo\",mockup_title as title,prompt_text as prompt,html_content as html,mockup_status as status,selected,mockup_version as version,updated_by as \"updatedBy\",updated_at as \"updatedAt\" from framework_screen_html_mockup where route_key=? order by slot_no",routeKey);
    }

    private void recordMockupHistory(String routeKey,int slotNo,String actor){
        jdbc.update("insert into framework_screen_html_mockup_history(mockup_id,route_key,route_path,page_id,slot_no,mockup_title,prompt_text,html_content,mockup_status,selected,mockup_version,changed_by) select mockup_id,route_key,route_path,page_id,slot_no,mockup_title,prompt_text,html_content,mockup_status,selected,mockup_version,? from framework_screen_html_mockup where route_key=? and slot_no=?",actor,routeKey,slotNo);
    }

    static String routeKey(String value){return cleanRoute(value).toLowerCase();}
    static String cleanRoute(String value){
        String raw=value==null?"/":value.trim();
        try{URI uri=URI.create(raw);String path=uri.getPath();return path==null||path.isBlank()?"/":path.replaceAll("/{2,}","/");}
        catch(Exception ignored){int q=raw.indexOf('?');return (q>=0?raw.substring(0,q):raw).replaceAll("/{2,}","/");}
    }
    private static String text(Map<String,Object>b,String key){Object value=b.get(key);return value==null?"":String.valueOf(value).trim();}
    private static String required(Map<String,Object>b,String key){String value=text(b,key);if(value.isBlank())throw new IllegalArgumentException(key+" is required");return value;}
}
