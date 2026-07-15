package egovframework.com.platform.governance.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class HomeCompositionService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public Map<String,Object> dashboard(String variant) {
        Map<String,Object> out=new LinkedHashMap<>();
        out.put("variant",variant);
        out.put("sections",jdbc.queryForList("select c.section_code as \"sectionCode\",c.section_name as \"sectionName\",c.section_name_en as \"sectionNameEn\",c.category_code as \"categoryCode\",c.description_text as description,c.component_key as \"componentKey\",c.implementation_status as \"implementationStatus\",c.data_status as \"dataStatus\",c.design_reference as \"designReference\",coalesce(d.enabled_yn,'N')='Y' as enabled,coalesce(d.sort_order,999) as \"sortOrder\",coalesce(d.audience_codes,'PUBLIC,AUTHENTICATED') as \"audienceCodes\" from framework_home_section_catalog c left join framework_home_composition_draft d on d.section_code=c.section_code and d.page_variant=? where c.active_yn='Y' order by coalesce(d.sort_order,999),c.category_code,c.section_code",variant));
        out.put("versions",jdbc.queryForList("select version_id as \"versionId\",version_no as \"versionNo\",published_by as \"publishedBy\",published_at as \"publishedAt\" from framework_home_composition_version where page_variant=? order by version_no desc limit 20",variant));
        return out;
    }

    @Transactional
    public Map<String,Object> saveDraft(String variant,List<Map<String,Object>> sections,String actor) {
        for(Map<String,Object> row:sections){
            jdbc.update("insert into framework_home_composition_draft(page_variant,section_code,enabled_yn,sort_order,audience_codes,updated_by,updated_at) values(?,?,?,?,?,?,current_timestamp) on conflict(page_variant,section_code) do update set enabled_yn=excluded.enabled_yn,sort_order=excluded.sort_order,audience_codes=excluded.audience_codes,updated_by=excluded.updated_by,updated_at=current_timestamp",variant,String.valueOf(row.get("sectionCode")),Boolean.parseBoolean(String.valueOf(row.get("enabled")))?"Y":"N",Integer.parseInt(String.valueOf(row.getOrDefault("sortOrder",999))),String.valueOf(row.getOrDefault("audienceCodes","PUBLIC,AUTHENTICATED")),actor);
        }
        return Map.of("success",true,"savedCount",sections.size());
    }

    @Transactional
    public Map<String,Object> publish(String variant,String actor) {
        List<Map<String,Object>> rows=jdbc.queryForList("select section_code as \"sectionCode\",enabled_yn='Y' as enabled,sort_order as \"sortOrder\",audience_codes as \"audienceCodes\" from framework_home_composition_draft where page_variant=? order by sort_order,section_code",variant);
        int next=jdbc.queryForObject("select coalesce(max(version_no),0)+1 from framework_home_composition_version where page_variant=?",Integer.class,variant);
        try { jdbc.update("insert into framework_home_composition_version(page_variant,version_no,configuration_json,published_by) values(?,?,?,?)",variant,next,objectMapper.writeValueAsString(rows),actor); }
        catch(Exception e){ throw new IllegalStateException("홈 구성 발행 정보를 저장하지 못했습니다.",e); }
        return Map.of("success",true,"versionNo",next,"publishedCount",rows.stream().filter(r->Boolean.TRUE.equals(r.get("enabled"))).count());
    }

    public Map<String,Object> published(String variant) {
        List<Map<String,Object>> versionRows=jdbc.queryForList("select version_no as \"versionNo\",configuration_json as configuration from framework_home_composition_version where page_variant=? order by version_no desc limit 1",variant);
        if(versionRows.isEmpty()) return Map.of("variant",variant,"versionNo",0,"sections",List.of());
        try {
            @SuppressWarnings("unchecked") List<Map<String,Object>> configured=objectMapper.readValue(String.valueOf(versionRows.get(0).get("configuration")),List.class);
            Map<String,Map<String,Object>> catalog=new LinkedHashMap<>();
            jdbc.queryForList("select section_code as \"sectionCode\",component_key as \"componentKey\",implementation_status as \"implementationStatus\" from framework_home_section_catalog where active_yn='Y'").forEach(row->catalog.put(String.valueOf(row.get("sectionCode")),row));
            List<Map<String,Object>> sections=configured.stream().filter(row->Boolean.parseBoolean(String.valueOf(row.get("enabled")))).map(row->{Map<String,Object> asset=catalog.get(String.valueOf(row.get("sectionCode")));if(asset==null||!"IMPLEMENTED".equals(asset.get("implementationStatus")))return null;Map<String,Object> item=new LinkedHashMap<>();item.put("sectionCode",row.get("sectionCode"));item.put("componentKey",asset.get("componentKey"));item.put("sortOrder",row.get("sortOrder"));return item;}).filter(java.util.Objects::nonNull).toList();
            return Map.of("variant",variant,"versionNo",versionRows.get(0).get("versionNo"),"sections",sections);
        } catch(Exception e){throw new IllegalStateException("발행된 홈 구성을 읽지 못했습니다.",e);}
    }
}
