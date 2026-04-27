package egovframework.com.common.context;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Context for the current project runtime instance.
 * Loaded from command line arguments or environment variables.
 */
@Component
@ConfigurationProperties(prefix = "app")
@Getter
@Setter
public class ProjectRuntimeContext {
    /**
     * The ID of the project this runtime is currently executing.
     * Example: P001, P002
     */
    private String projectId;
    
    /**
     * The role of this runtime instance.
     * Example: project, ops, builder
     */
    private String role = "project";
}
