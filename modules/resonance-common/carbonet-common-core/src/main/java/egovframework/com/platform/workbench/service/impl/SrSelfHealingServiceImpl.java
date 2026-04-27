package egovframework.com.platform.workbench.service.impl;

import egovframework.com.platform.workbench.model.SrTicketRecordVO;
import egovframework.com.platform.workbench.service.SrSelfHealingService;
import egovframework.com.platform.request.workbench.SrTicketCreateRequest;
import egovframework.com.platform.service.workbench.SrTicketWorkbenchPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Slf4j
@Service("srSelfHealingService")
@RequiredArgsConstructor
public class SrSelfHealingServiceImpl implements SrSelfHealingService {

    private final SrTicketWorkbenchPort srTicketWorkbenchService;
    
    private static final DateTimeFormatter TS_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final int AUTO_HEAL_THRESHOLD = 3;
    private static final int AUTO_HEAL_WINDOW_HOURS = 24;
    
    private static final Map<String, ErrorPatternEntry> ERROR_PATTERNS = new HashMap<>();
    private static final Map<String, AutoHealPolicy> AUTO_HEAL_POLICIES = new HashMap<>();
    
    @Value("${security.codex.self-healing.enabled:false}")
    private boolean selfHealingEnabled;
    
    @Value("${security.codex.self-healing.max-auto-heals-per-day:10}")
    private int maxAutoHealsPerDay;
    
    @Value("${security.codex.self-healing.require-human-approval:true}")
    private boolean requireHumanApproval;
    
    private int autoHealCountToday = 0;
    private String lastAutoHealDate = "";
    
    static {
        AUTO_HEAL_POLICIES.put("NULL_POINTER_EXCEPTION", new AutoHealPolicy("NULL_POINTER_EXCEPTION", "common", true));
        AUTO_HEAL_POLICIES.put("UNDEFINED_PROPERTY", new AutoHealPolicy("UNDEFINED_PROPERTY", "common", true));
        AUTO_HEAL_POLICIES.put("API_NOT_FOUND", new AutoHealPolicy("API_NOT_FOUND", "api", true));
        AUTO_HEAL_POLICIES.put("MISSING_PERMISSION", new AutoHealPolicy("MISSING_PERMISSION", "security", false));
        AUTO_HEAL_POLICIES.put("UI_RENDER_ERROR", new AutoHealPolicy("UI_RENDER_ERROR", "frontend", true));
    }

    @Override
    public Map<String, Object> analyzeErrorPattern(String fingerprint, String errorType, String errorMessage) {
        Map<String, Object> result = new LinkedHashMap<>();
        
        ErrorPatternEntry entry = ERROR_PATTERNS.compute(fingerprint, (key, existing) -> {
            if (existing == null) {
                return new ErrorPatternEntry(errorType, errorMessage, 1, LocalDateTime.now());
            }
            existing.incrementCount();
            existing.setLastSeen(LocalDateTime.now());
            if (errorMessage != null && !errorMessage.equals(existing.getSampleMessage())) {
                existing.setSampleMessage(errorMessage);
            }
            return existing;
        });
        
        result.put("fingerprint", fingerprint);
        result.put("errorType", entry.getErrorType());
        result.put("count", entry.getCount());
        result.put("firstSeen", entry.getFirstSeen().format(TS_FORMAT));
        result.put("lastSeen", entry.getLastSeen().format(TS_FORMAT));
        result.put("sampleMessage", entry.getSampleMessage());
        
        boolean shouldAutoHeal = shouldAutoHeal(fingerprint, errorType);
        result.put("shouldAutoHeal", shouldAutoHeal);
        
        if (shouldAutoHeal) {
            AutoHealPolicy policy = AUTO_HEAL_POLICIES.get(errorType);
            result.put("autoHealPolicy", policy != null ? policy.getPolicyId() : "default");
            result.put("requiresHumanApproval", policy != null ? !policy.isAutoExecutable() : requireHumanApproval);
        }
        
        return result;
    }

    @Override
    public boolean shouldAutoHeal(String fingerprint, String errorType) {
        if (!selfHealingEnabled) {
            log.debug("Self-healing is disabled");
            return false;
        }
        
        ErrorPatternEntry entry = ERROR_PATTERNS.get(fingerprint);
        if (entry == null || entry.getCount() < AUTO_HEAL_THRESHOLD) {
            log.debug("Error pattern {} count {} below threshold {}", fingerprint, entry != null ? entry.getCount() : 0, AUTO_HEAL_THRESHOLD);
            return false;
        }
        
        if (entry.getFirstSeen().plusHours(AUTO_HEAL_WINDOW_HOURS).isBefore(LocalDateTime.now())) {
            log.debug("Error pattern {} outside window", fingerprint);
            return false;
        }
        
        if (getAutoHealCountToday() >= maxAutoHealsPerDay) {
            log.debug("Max auto-heals per day reached: {}", maxAutoHealsPerDay);
            return false;
        }
        
        AutoHealPolicy policy = AUTO_HEAL_POLICIES.get(errorType);
        if (policy != null && !policy.isAutoExecutable()) {
            log.debug("Error type {} requires human approval", errorType);
            return false;
        }
        
        return true;
    }

    @Override
    public Map<String, Object> triggerSelfHealing(String fingerprint, String errorDetails, String actorId) {
        Map<String, Object> result = new LinkedHashMap<>();
        
        if (!shouldAutoHeal(fingerprint, null)) {
            result.put("success", false);
            result.put("reason", "Auto-heal conditions not met");
            return result;
        }
        
        ErrorPatternEntry entry = ERROR_PATTERNS.get(fingerprint);
        if (entry == null) {
            result.put("success", false);
            result.put("reason", "Error pattern not found");
            return result;
        }
        
        String errorType = entry.getErrorType();
        AutoHealPolicy policy = AUTO_HEAL_POLICIES.get(errorType);
        
        if (policy != null && policy.isAutoExecutable()) {
            String ticketId = "AUTO-" + fingerprint + "-" + System.currentTimeMillis();
            
            SrTicketCreateRequest request = new SrTicketCreateRequest();
            request.setTicketId(ticketId);
            request.setPageId("self-healing");
            request.setPageLabel("Self-Healing: " + errorType);
            request.setRoutePath("/admin/system/sr-workbench");
            request.setSummary("Auto-generated: " + errorType);
            request.setInstruction("This ticket was auto-generated by the self-healing system.\n\n" +
                "Error Fingerprint: " + fingerprint + "\n" +
                "Error Type: " + errorType + "\n" +
                "Sample Message: " + entry.getSampleMessage() + "\n\n" +
                "This error has occurred " + entry.getCount() + " times in the past " + AUTO_HEAL_WINDOW_HOURS + " hours.\n\n" +
                "Please analyze and fix this issue.");
            request.setCommandPrompt("Fix the " + errorType + " error that occurs in the codebase.");
            request.setGeneratedDirection("Auto-generated fix direction for " + errorType);
            
            try {
                srTicketWorkbenchService.createTicket(request, "SYSTEM-SELF-HEALING");
                
                incrementAutoHealCount();
                
                result.put("success", true);
                result.put("ticketId", ticketId);
                result.put("autoHeal", true);
                result.put("message", "Self-healing ticket created automatically");
                
                log.info("Self-healing ticket created: {} for error type: {}", ticketId, errorType);
                
            } catch (Exception e) {
                log.error("Failed to create self-healing ticket", e);
                result.put("success", false);
                result.put("reason", "Failed to create ticket: " + e.getMessage());
            }
        } else {
            result.put("success", true);
            result.put("autoHeal", false);
            result.put("requiresHumanApproval", true);
            result.put("message", "Human approval required for this error type");
        }
        
        return result;
    }

    @Override
    public Map<String, Object> getSelfHealingStatus(String fingerprint) {
        Map<String, Object> result = new LinkedHashMap<>();
        
        result.put("selfHealingEnabled", selfHealingEnabled);
        result.put("maxAutoHealsPerDay", maxAutoHealsPerDay);
        result.put("autoHealsUsedToday", getAutoHealCountToday());
        result.put("requireHumanApproval", requireHumanApproval);
        
        if (fingerprint != null && ERROR_PATTERNS.containsKey(fingerprint)) {
            ErrorPatternEntry entry = ERROR_PATTERNS.get(fingerprint);
            result.put("fingerprint", fingerprint);
            result.put("errorType", entry.getErrorType());
            result.put("count", entry.getCount());
            result.put("shouldAutoHeal", shouldAutoHeal(fingerprint, entry.getErrorType()));
        }
        
        return result;
    }

    @Override
    public boolean validateAutoExecutionPolicy(String policyId) {
        AutoHealPolicy policy = AUTO_HEAL_POLICIES.get(policyId);
        return policy != null && policy.isAutoExecutable();
    }

    private synchronized int getAutoHealCountToday() {
        String today = LocalDateTime.now().format(DateTimeFormatter.ISO_DATE);
        if (!today.equals(lastAutoHealDate)) {
            autoHealCountToday = 0;
            lastAutoHealDate = today;
        }
        return autoHealCountToday;
    }

    private synchronized void incrementAutoHealCount() {
        String today = LocalDateTime.now().format(DateTimeFormatter.ISO_DATE);
        if (!today.equals(lastAutoHealDate)) {
            autoHealCountToday = 0;
            lastAutoHealDate = today;
        }
        autoHealCountToday++;
    }

    private static class ErrorPatternEntry {
        private final String errorType;
        private String sampleMessage;
        private int count;
        private LocalDateTime firstSeen;
        private LocalDateTime lastSeen;

        ErrorPatternEntry(String errorType, String sampleMessage, int count, LocalDateTime firstSeen) {
            this.errorType = errorType;
            this.sampleMessage = sampleMessage;
            this.count = count;
            this.firstSeen = firstSeen;
            this.lastSeen = firstSeen;
        }

        public String getErrorType() { return errorType; }
        public String getSampleMessage() { return sampleMessage; }
        public void setSampleMessage(String sampleMessage) { this.sampleMessage = sampleMessage; }
        public int getCount() { return count; }
        public void incrementCount() { this.count++; }
        public LocalDateTime getFirstSeen() { return firstSeen; }
        public LocalDateTime getLastSeen() { return lastSeen; }
        public void setLastSeen(LocalDateTime lastSeen) { this.lastSeen = lastSeen; }
    }

    private static class AutoHealPolicy {
        private final String policyId;
        private final String category;
        private final boolean autoExecutable;

        AutoHealPolicy(String policyId, String category, boolean autoExecutable) {
            this.policyId = policyId;
            this.category = category;
            this.autoExecutable = autoExecutable;
        }

        public String getPolicyId() { return policyId; }
        public String getCategory() { return category; }
        public boolean isAutoExecutable() { return autoExecutable; }
    }
}
