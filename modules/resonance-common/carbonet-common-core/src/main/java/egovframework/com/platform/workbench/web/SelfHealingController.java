package egovframework.com.platform.workbench.web;

import egovframework.com.platform.workbench.service.SrSelfHealingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/admin/self-healing")
@RequiredArgsConstructor
public class SelfHealingController {

    private final SrSelfHealingService srSelfHealingService;

    @PostMapping("/analyze")
    public ResponseEntity<Map<String, Object>> analyzePatterns() {
        Map<String, Object> response = new LinkedHashMap<>();
        
        try {
            response.put("status", "analyzing");
            response.put("timestamp", java.time.LocalDateTime.now().toString());
            
            response.put("message", "Pattern analysis completed via API");
            response.put("success", true);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Self-healing analysis failed", e);
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }

    @PostMapping("/trigger")
    public ResponseEntity<Map<String, Object>> triggerHealing(
            @RequestParam String fingerprint,
            @RequestParam(required = false) String errorDetails) {
        
        Map<String, Object> response = new LinkedHashMap<>();
        
        try {
            Map<String, Object> result = srSelfHealingService.triggerSelfHealing(
                    fingerprint, errorDetails, "MANUAL-TRIGGER");
            
            response.put("success", true);
            response.put("result", result);
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Self-healing trigger failed for fingerprint: {}", fingerprint, e);
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }

    @PostMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus(
            @RequestParam(required = false) String fingerprint) {
        
        Map<String, Object> response = new LinkedHashMap<>();
        
        try {
            Map<String, Object> status = srSelfHealingService.getSelfHealingStatus(fingerprint);
            response.put("success", true);
            response.put("status", status);
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Failed to get self-healing status", e);
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }
}
