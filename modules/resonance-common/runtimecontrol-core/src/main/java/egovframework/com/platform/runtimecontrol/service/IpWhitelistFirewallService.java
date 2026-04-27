package egovframework.com.platform.runtimecontrol.service;

public interface IpWhitelistFirewallService {

    FirewallExecutionResult openPortForIp(String applicationName, String ipAddress, String port);

    final class FirewallExecutionResult {
        private final boolean success;
        private final String message;

        public FirewallExecutionResult(boolean success, String message) {
            this.success = success;
            this.message = message;
        }

        public boolean isSuccess() {
            return success;
        }

        public String getMessage() {
            return message;
        }
    }
}
