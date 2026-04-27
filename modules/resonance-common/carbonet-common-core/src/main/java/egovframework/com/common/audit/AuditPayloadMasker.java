package egovframework.com.common.audit;

import org.springframework.stereotype.Component;

@Component
public class AuditPayloadMasker {

    public String mask(String payload) {
        if (payload == null || payload.trim().isEmpty()) {
            return "";
        }
        String masked = payload;
        masked = masked.replaceAll("(?i)(\"password\"\\s*:\\s*\")[^\"]*(\")", "$1***$2");
        masked = masked.replaceAll("(?i)(\"token\"\\s*:\\s*\")[^\"]*(\")", "$1***$2");
        masked = masked.replaceAll("(?i)(\"bizrno\"\\s*:\\s*\")[^\"]*(\")", "$1***$2");
        masked = masked.replaceAll("(?i)(\"email\"\\s*:\\s*\")[^\"]*(\")", "$1***$2");
        return masked;
    }
}
