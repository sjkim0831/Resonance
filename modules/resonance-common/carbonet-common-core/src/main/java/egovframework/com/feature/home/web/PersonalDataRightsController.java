package egovframework.com.feature.home.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.feature.auth.service.CurrentUserContextService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/api/mypage/personal-data", "/api/en/mypage/personal-data"})
@RequiredArgsConstructor
public class PersonalDataRightsController {
    private final CurrentUserContextService currentUserContextService;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    @GetMapping
    public ResponseEntity<Map<String, Object>> summary(HttpServletRequest request) {
        var context = currentUserContextService.resolve(request);
        if (!context.isAuthenticated()) return ResponseEntity.status(401).body(Map.of("authenticated", false));
        Map<String, Object> data = loadOwnData(context.getUserId());
        if (data.isEmpty()) return ResponseEntity.status(404).body(Map.of("authenticated", true, "message", "회원 정보를 찾을 수 없습니다."));
        List<Map<String, Object>> history = jdbcTemplate.queryForList("""
            select export_id as "exportId", export_format as "format", export_sha256 as "sha256",
                   created_at as "createdAt", downloaded_at as "downloadedAt"
              from member_personal_data_export_audit
             where lower(member_id)=lower(?) order by created_at desc limit 10
            """, context.getUserId());
        return ResponseEntity.ok(Map.of(
            "authenticated", true, "memberId", context.getUserId(), "data", data, "exportHistory", history,
            "correctionRoutes", Map.of("profile", "/mypage/profile", "contact", "/mypage/email", "company", "/mypage/company"),
            "excludedFields", List.of("password", "authenticationToken", "otpCodeHash", "residentIdentifier")));
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> export(HttpServletRequest request) throws Exception {
        var context = currentUserContextService.resolve(request);
        if (!context.isAuthenticated()) return ResponseEntity.status(401).body(new byte[0]);
        Map<String, Object> data = loadOwnData(context.getUserId());
        if (data.isEmpty()) return ResponseEntity.notFound().build();
        String exportId = java.util.UUID.randomUUID().toString();
        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("exportId", exportId);
        envelope.put("generatedAt", Instant.now().toString());
        envelope.put("subjectMemberId", context.getUserId());
        envelope.put("scope", "SELF_ONLY");
        envelope.put("data", data);
        envelope.put("excludedFields", List.of("password", "authenticationToken", "otpCodeHash", "residentIdentifier"));
        byte[] bytes = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(envelope).getBytes(StandardCharsets.UTF_8);
        String sha = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        jdbcTemplate.update("""
            insert into member_personal_data_export_audit(export_id,member_id,export_format,export_sha256,byte_size,created_at,downloaded_at,request_ip)
            values (?,?, 'JSON', ?, ?, current_timestamp, current_timestamp, ?)
            """, exportId, context.getUserId(), sha, bytes.length, safeIp(request));
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setContentDisposition(ContentDisposition.attachment().filename("personal-data-" + context.getUserId() + ".json", StandardCharsets.UTF_8).build());
        headers.set("X-Content-SHA256", sha);
        headers.setCacheControl("no-store");
        return ResponseEntity.ok().headers(headers).body(bytes);
    }

    private Map<String, Object> loadOwnData(String userId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
            select trim(entrprs_mber_id) as "memberId", coalesce(applcnt_nm,'') as "name",
                   coalesce(applcnt_email_adres,'') as "email",
                   concat(coalesce(area_no,''),coalesce(entrprs_middle_telno,''),coalesce(entrprs_end_telno,'')) as "phone",
                   coalesce(cmpny_nm,'') as "companyName", coalesce(instt_id,'') as "institutionId",
                   coalesce(dept_nm,'') as "department", coalesce(zip,'') as "zip",
                   coalesce(adres,'') as "address", coalesce(detail_adres,'') as "detailAddress",
                   coalesce(marketing_yn,'N') as "marketingConsent", coalesce(entrprs_mber_sttus,'') as "memberStatus"
              from comtnentrprsmber where lower(entrprs_mber_id)=lower(?) limit 1
            """, userId);
        return rows.isEmpty() ? Map.of() : new LinkedHashMap<>(rows.get(0));
    }

    private String safeIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        return forwarded == null || forwarded.isBlank() ? request.getRemoteAddr() : forwarded.split(",")[0].trim();
    }
}
