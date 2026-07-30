package egovframework.com.config;

import java.util.List;

/**
 * Compile-only canary for the immutable Java deployment path.
 *
 * <p>The class is intentionally not registered as a Spring bean and therefore
 * has no runtime side effects. Updating the revision exercises incremental
 * compilation, image assembly, one-shot Flyway, rolling availability, runtime
 * contracts, actor journeys, and the deployment performance SLO.</p>
 */
public final class DeploymentCanary {

    public static final String CONTRACT_VERSION = "1.1.0";
    public static final String REVISION = "2026-07-31T00:15:00+09:00";
    public static final List<String> REQUIRED_CHECKS = List.of(
            "incremental-java-compilation",
            "immutable-image",
            "one-shot-flyway",
            "zero-downtime-rollout",
            "runtime-health",
            "actor-process-journey",
            "deploy-performance-slo"
    );

    private DeploymentCanary() {
    }
}
