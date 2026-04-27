package egovframework.com.common.service;

import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

@Service
public class MaintenanceModeService {

    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private final AtomicReference<MaintenanceState> stateRef = new AtomicReference<>(MaintenanceState.inactive());

    public void activate(String reason, String actorId) {
        stateRef.set(new MaintenanceState(
                true,
                normalize(reason),
                normalize(actorId),
                LocalDateTime.now().format(TIME_FORMAT)
        ));
    }

    public void deactivate() {
        stateRef.set(MaintenanceState.inactive());
    }

    public boolean isActive() {
        return stateRef.get().active;
    }

    public Map<String, String> snapshot() {
        MaintenanceState state = stateRef.get();
        Map<String, String> result = new LinkedHashMap<>();
        result.put("active", state.active ? "Y" : "N");
        result.put("reason", state.reason);
        result.put("actorId", state.actorId);
        result.put("startedAt", state.startedAt);
        return result;
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private static final class MaintenanceState {
        private final boolean active;
        private final String reason;
        private final String actorId;
        private final String startedAt;

        private MaintenanceState(boolean active, String reason, String actorId, String startedAt) {
            this.active = active;
            this.reason = reason;
            this.actorId = actorId;
            this.startedAt = startedAt;
        }

        private static MaintenanceState inactive() {
            return new MaintenanceState(false, "", "", "");
        }
    }
}
