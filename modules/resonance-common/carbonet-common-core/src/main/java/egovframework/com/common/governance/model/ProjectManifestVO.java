package egovframework.com.common.governance.model;

import lombok.Data;
import java.util.Map;

@Data
public class ProjectManifestVO {
    private Metadata metadata;
    private Installations installations;
    private Bindings bindings;
    private Runtime runtime;
    private Governance governance;

    @Data
    public static class Metadata {
        private String projectId;
        private String projectName;
        private String owner;
        private String description;
    }

    @Data
    public static class Installations {
        private String commonCore;
        private String stableGate;
        private String adapter;
        private String adapterContract;
    }

    @Data
    public static class Bindings {
        private Database database;
        private Map<String, Object> theme;
        private Map<String, Object> menu;
    }

    @Data
    public static class Database {
        private String bindingMode;
        private DatabaseEndpoint commonDb;
        private DatabaseEndpoint projectDb;
        private String url;
        private String schema;
    }

    @Data
    public static class DatabaseEndpoint {
        private String url;
        private String schema;
    }

    @Data
    public static class Runtime {
        private String packagePath;
        private String adapterArtifactPath;
        private String manifestPath;
        private String bootTarget;
        private String status;
        private String bootCommand;
        private String runtimeMode;
        private String lane;
        private String sharedRuntimeId;
        private String lastHealthCheck;
        private Routing routing;
    }

    @Data
    public static class Routing {
        private String selectorPath;
        private String routePrefix;
        private String externalBaseUrl;
        private String domainHost;
        private String managementPath;
        private String infoPath;
    }

    @Data
    public static class Governance {
        private String compatibilityClass;
        private String updatedAt;
    }
}
