package egovframework.com.feature.admin.web;
import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.feature.home.service.EmissionProjectRegistryService;
import jakarta.servlet.http.HttpServletRequest; import lombok.RequiredArgsConstructor; import org.springframework.http.ResponseEntity; import org.springframework.web.bind.annotation.*; import java.util.Map;
@RestController @RequiredArgsConstructor @RequestMapping({"/admin/api/report-certificates","/en/admin/api/report-certificates"})
public class AdminReportCertificateController { private final EmissionProjectRegistryService service; private final CurrentUserContextService users;
 @GetMapping public Map<String,Object> list(){return service.adminCertificates();}
 @GetMapping("/access-history") public Map<String,Object> history(HttpServletRequest q){var c=users.resolve(q);return service.reportAccessHistory(c.getInsttId().isBlank()?"DEFAULT":c.getInsttId(),c.getUserId(),true);}
 @PostMapping("/{reportId}/revoke") public ResponseEntity<?> revoke(@PathVariable long reportId,@RequestBody Map<String,Object>b,HttpServletRequest q){try{return ResponseEntity.ok(service.revokeCertificate(reportId,users.resolve(q).getUserId(),String.valueOf(b.getOrDefault("reason",""))));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("message",e.getMessage()));}}
 @PostMapping("/{reportId}/reissue") public ResponseEntity<?> reissue(@PathVariable long reportId,@RequestBody Map<String,Object>b,HttpServletRequest q){try{return ResponseEntity.ok(service.reissueCertificate(reportId,users.resolve(q).getUserId(),String.valueOf(b.getOrDefault("reason",""))));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("message",e.getMessage()));}}
}
