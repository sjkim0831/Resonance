package egovframework.com.platform.screenbuilder.support;

import java.util.Arrays;
import java.util.List;

/**
 * Canonical screenbuilder platform family contract shared by builder core,
 * runtime-common adapters, project adapters, and platform control planes.
 */
public final class ScreenBuilderPlatformFamilyRegistry {

    public static final String COMMON_CORE_ARTIFACT_ID = "common-core";
    public static final String BUILDER_VALIDATOR_ARTIFACT_ID = "builder-validator";
    public static final String DEPLOY_CONTRACT_ARTIFACT_ID = "deploy-contract";
    public static final String PROJECT_ADAPTER_OWNER_LANE = "project-adapter";
    public static final String PLATFORM_FAMILY_ID_SUFFIX = "-family";
    public static final String PLATFORM_ARTIFACT_TARGET_SYSTEM = "resonance-runtime";
    public static final String PLATFORM_COMPARE_BASELINE = "governed-runtime-truth";

    private ScreenBuilderPlatformFamilyRegistry() {
    }

    public static String releaseFamilyId(String projectId) {
        return normalizeProjectId(projectId) + PLATFORM_FAMILY_ID_SUFFIX;
    }

    public static String projectAdapterContractArtifactId(String projectId) {
        return normalizeProjectId(projectId) + "-adapter-contract";
    }

    public static String projectAdapterArtifactId(String projectId) {
        return normalizeProjectId(projectId) + "-adapter-artifact";
    }

    public static String legacyProjectAdapterArtifactId(String projectId) {
        return normalizeProjectId(projectId) + "-adapter";
    }

    public static List<String> commonArtifactSet() {
        return Arrays.asList(
                COMMON_CORE_ARTIFACT_ID,
                BUILDER_VALIDATOR_ARTIFACT_ID,
                DEPLOY_CONTRACT_ARTIFACT_ID
        );
    }

    public static List<String> projectAdapterArtifactSet(String projectId) {
        return Arrays.asList(
                projectAdapterContractArtifactId(projectId),
                projectAdapterArtifactId(projectId)
        );
    }

    public static boolean isProjectAdapterArtifact(String projectId, String artifactId) {
        String normalizedArtifactId = normalize(artifactId);
        return projectAdapterArtifactId(projectId).equals(normalizedArtifactId)
                || projectAdapterContractArtifactId(projectId).equals(normalizedArtifactId)
                || legacyProjectAdapterArtifactId(projectId).equals(normalizedArtifactId);
    }

    public static boolean isProjectAdapterArtifactId(String artifactId) {
        String normalizedArtifactId = normalize(artifactId);
        return normalizedArtifactId.endsWith("-adapter-artifact")
                || normalizedArtifactId.endsWith("-adapter-contract")
                || normalizedArtifactId.endsWith("-adapter");
    }

    public static String resolveInstallScope(String artifactId) {
        if (COMMON_CORE_ARTIFACT_ID.equals(normalize(artifactId))) {
            return "COMMON";
        }
        if (isProjectAdapterArtifactId(artifactId)) {
            return "PROJECT";
        }
        return "PROJECT";
    }

    public static String canonicalArtifactId(String projectId, String artifactId) {
        String normalizedArtifactId = normalize(artifactId);
        if (legacyProjectAdapterArtifactId(projectId).equals(normalizedArtifactId)) {
            return projectAdapterArtifactId(projectId);
        }
        return normalizedArtifactId;
    }

    public static String normalizeProjectId(String projectId) {
        String normalized = normalize(projectId);
        return normalized.isEmpty() ? "carbonet" : normalized;
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
