package egovframework.com.feature.admin.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Tenant-scoped source of truth for organization sites used by emission projects. */
@Service
@RequiredArgsConstructor
public class EmissionSiteRegistryService {
    private static final Set<String> BOUNDARIES = Set.of("OPERATIONAL_CONTROL", "FINANCIAL_CONTROL", "EQUITY_SHARE");
    private static final Set<String> STATUSES = Set.of("DRAFT", "ACTIVE", "INACTIVE");
    private final JdbcTemplate jdbc;

    public Map<String, Object> list(String tenantId, String keyword, String status) {
        String tenant = required(tenantId, "tenantId", 100);
        String term = keyword == null ? "" : keyword.trim();
        String state = status == null ? "" : status.trim().toUpperCase(Locale.ROOT);
        if (!state.isEmpty() && !STATUSES.contains(state)) throw new IllegalArgumentException("SITE_STATUS_INVALID");
        String like = "%" + term + "%";
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", jdbc.queryForList("""
            SELECT site_id AS "id",site_code AS "code",site_name AS "name",country_code AS "countryCode",
                   postal_code AS "postalCode",address,detail_address AS "detailAddress",
                   boundary_method AS "boundaryMethod",data_owner_id AS "dataOwner",site_status AS status,
                   effective_from AS "effectiveFrom",effective_until AS "effectiveUntil",source_type AS "sourceType",
                   version_no AS version,updated_by AS "updatedBy",updated_at AS "updatedAt"
              FROM emission_site_registry
             WHERE tenant_id=? AND (?='' OR lower(site_code||' '||site_name||' '||address) LIKE lower(?))
               AND (?='' OR site_status=?)
             ORDER BY CASE site_status WHEN 'ACTIVE' THEN 0 WHEN 'DRAFT' THEN 1 ELSE 2 END,site_name
            """, tenant, term, like, state, state));
        result.put("summary", jdbc.queryForList("SELECT site_status AS status,count(*) AS count FROM emission_site_registry WHERE tenant_id=? GROUP BY site_status ORDER BY site_status", tenant));
        return result;
    }

    @Transactional
    public Map<String, Object> save(String tenantId, String actor, Map<String, Object> body) {
        String tenant = required(tenantId, "tenantId", 100);
        String user = required(actor, "actor", 100);
        String code = required(body.get("code"), "siteCode", 40).toUpperCase(Locale.ROOT);
        if (!code.matches("[A-Z0-9][A-Z0-9_-]{1,39}")) throw new IllegalArgumentException("SITE_CODE_INVALID");
        String name = required(body.get("name"), "siteName", 160);
        String country = optional(body.get("countryCode"), "KR").toUpperCase(Locale.ROOT);
        if (!country.matches("[A-Z]{2}")) throw new IllegalArgumentException("SITE_COUNTRY_INVALID");
        String address = required(body.get("address"), "address", 300);
        String boundary = optional(body.get("boundaryMethod"), "OPERATIONAL_CONTROL").toUpperCase(Locale.ROOT);
        if (!BOUNDARIES.contains(boundary)) throw new IllegalArgumentException("SITE_BOUNDARY_INVALID");
        String status = optional(body.get("status"), "ACTIVE").toUpperCase(Locale.ROOT);
        if (!STATUSES.contains(status)) throw new IllegalArgumentException("SITE_STATUS_INVALID");
        LocalDate from = date(body.get("effectiveFrom"), LocalDate.now(), "SITE_EFFECTIVE_FROM_INVALID");
        LocalDate until = date(body.get("effectiveUntil"), null, "SITE_EFFECTIVE_UNTIL_INVALID");
        if (until != null && until.isBefore(from)) throw new IllegalArgumentException("SITE_EFFECTIVE_RANGE_INVALID");
        String postal = limited(body.get("postalCode"), 10);
        String detail = limited(body.get("detailAddress"), 300);
        String dataOwner = limited(body.get("dataOwner"), 100);
        Number id = body.get("id") instanceof Number number ? number : null;
        if (id == null) {
            Long created = jdbc.queryForObject("""
                INSERT INTO emission_site_registry
                  (tenant_id,site_code,site_name,country_code,postal_code,address,detail_address,boundary_method,
                   data_owner_id,site_status,effective_from,effective_until,created_by,updated_by)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING site_id
                """, Long.class, tenant, code, name, country, postal, address, detail, boundary, dataOwner, status, from, until, user, user);
            return Map.of("success", true, "id", created == null ? 0 : created, "created", true);
        }
        int changed = jdbc.update("""
            UPDATE emission_site_registry SET site_code=?,site_name=?,country_code=?,postal_code=?,address=?,detail_address=?,
                   boundary_method=?,data_owner_id=?,site_status=?,effective_from=?,effective_until=?,version_no=version_no+1,
                   updated_by=?,updated_at=current_timestamp
             WHERE site_id=? AND tenant_id=?
            """, code, name, country, postal, address, detail, boundary, dataOwner, status, from, until, user, id.longValue(), tenant);
        if (changed == 0) throw new SecurityException("SITE_SCOPE_DENIED");
        return Map.of("success", true, "id", id.longValue(), "created", false);
    }

    private String required(Object value, String key, int max) {
        String text = value == null ? "" : String.valueOf(value).trim();
        if (text.isEmpty()) throw new IllegalArgumentException(key + " is required");
        if (text.length() > max) throw new IllegalArgumentException(key + " is too long");
        return text;
    }
    private String optional(Object value, String fallback) { String text=value==null?"":String.valueOf(value).trim();return text.isEmpty()?fallback:text; }
    private String limited(Object value,int max) { String text=value==null?"":String.valueOf(value).trim();if(text.length()>max)throw new IllegalArgumentException("SITE_VALUE_TOO_LONG");return text; }
    private LocalDate date(Object value,LocalDate fallback,String error) { String text=value==null?"":String.valueOf(value).trim();if(text.isEmpty())return fallback;try{return LocalDate.parse(text);}catch(Exception exception){throw new IllegalArgumentException(error);} }
}
