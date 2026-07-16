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
        if(!rows.isEmpty())return rows.get(0);
        Map<String,Object> empty=new LinkedHashMap<>();
        empty.put("routeKey",routeKey);empty.put("routePath",cleanRoute(routePath));empty.put("pageId","");empty.put("pageTitle","");
        empty.put("designNote","");empty.put("functionNote","");empty.put("acceptanceNote","");empty.put("status","DRAFT");empty.put("version",0);
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
        return "[화면 설계 메모 v"+row.get("version")+"] 설계="+row.get("design")+" | 기능="+row.get("function")+" | 완료기준="+row.get("acceptance");
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
