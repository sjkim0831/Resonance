package egovframework.com.common.governance.model;

import lombok.Data;
import java.util.List;

@Data
public class PackageRegistryVO {
    private List<Artifact> commonCore;
    private List<Artifact> stableGate;
    private List<AdapterArtifact> adapters;

    @Data
    public static class Artifact {
        private String version;
        private String artifactId;
        private String buildId;
        private String storageKey;
    }

    @Data
    public static class AdapterArtifact extends Artifact {
        private String id;
        private String contractVersion;
    }
}
