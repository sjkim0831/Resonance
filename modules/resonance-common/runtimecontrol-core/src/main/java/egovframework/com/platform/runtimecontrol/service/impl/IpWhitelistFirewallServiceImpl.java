package egovframework.com.platform.runtimecontrol.service.impl;

import egovframework.com.platform.runtimecontrol.service.IpWhitelistFirewallService;
import org.egovframe.rte.fdl.cmmn.EgovAbstractServiceImpl;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

@Service("ipWhitelistFirewallService")
public class IpWhitelistFirewallServiceImpl extends EgovAbstractServiceImpl implements IpWhitelistFirewallService {

    @Value("${security.ip-whitelist.firewall-script:/opt/Resonance/ops/scripts/ip-whitelist-firewall-apply.sh}")
    private String firewallScriptPath;

    @Value("${security.ip-whitelist.firewall-timeout-seconds:15}")
    private long firewallTimeoutSeconds;

    @Override
    public FirewallExecutionResult openPortForIp(String applicationName, String ipAddress, String port) {
        String safeIp = safe(ipAddress);
        String safePort = safe(port);
        if (safeIp.isEmpty() || safePort.isEmpty()) {
            return new FirewallExecutionResult(false, "Firewall execution skipped: missing ip or port.");
        }
        try {
            ProcessBuilder builder = new ProcessBuilder(
                    List.of(
                            firewallScriptPath,
                            safeIp,
                            safePort,
                            buildLabel(applicationName, safePort)));
            Process process = builder.start();
            boolean finished = process.waitFor(Math.max(1L, firewallTimeoutSeconds), TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                return new FirewallExecutionResult(false, "Firewall execution timed out.");
            }
            String stdout = read(process.getInputStream());
            String stderr = read(process.getErrorStream());
            if (process.exitValue() == 0) {
                return new FirewallExecutionResult(true, firstNonBlank(stdout, "Firewall rule applied."));
            }
            return new FirewallExecutionResult(false, firstNonBlank(stderr, stdout, "Firewall rule application failed."));
        } catch (Exception ex) {
            return new FirewallExecutionResult(false, "Firewall execution failed: " + safe(ex.getMessage()));
        }
    }

    private String buildLabel(String applicationName, String port) {
        String normalized = safe(applicationName).toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9_-]+", "-");
        if (normalized.isEmpty()) {
            normalized = "custom";
        }
        return "ip-whitelist-" + normalized + "-" + safe(port);
    }

    private String read(InputStream stream) throws Exception {
        if (stream == null) {
            return "";
        }
        return new String(stream.readAllBytes(), StandardCharsets.UTF_8).trim();
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String value : values) {
            String trimmed = safe(value);
            if (!trimmed.isEmpty()) {
                return trimmed;
            }
        }
        return "";
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
