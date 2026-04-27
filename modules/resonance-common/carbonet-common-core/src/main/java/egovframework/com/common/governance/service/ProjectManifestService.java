package egovframework.com.common.governance.service;

import egovframework.com.common.governance.model.ProjectManifestVO;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Map;

@Service
public class ProjectManifestService {

    private final String GLOBAL_MANIFEST_PATH = "data/version-control/project-runtime-manifest.json";
    private final String LOCAL_MANIFEST_PATH = "config/manifest.json";
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ProjectManifestVO getProjectManifest(String projectId) throws Exception {
        Map<String, Object> manifestData = getRawManifest();
        
        // If it's a global manifest, it has a "projects" wrapper.
        // If it's a local manifest, it might be the project object itself.
        if (manifestData.containsKey("projects")) {
            Map<String, Object> projects = (Map<String, Object>) manifestData.get("projects");
            if (projects != null && projects.containsKey(projectId)) {
                return objectMapper.convertValue(projects.get(projectId), ProjectManifestVO.class);
            }
        } else if (projectId.equals(manifestData.get("projectId")) || (manifestData.get("metadata") instanceof Map && projectId.equals(((Map)manifestData.get("metadata")).get("projectId")))) {
             return objectMapper.convertValue(manifestData, ProjectManifestVO.class);
        }
        return null;
    }

    public Map<String, Object> getRawManifest() throws Exception {
        // Try local deployment path first
        java.io.File localFile = new java.io.File(LOCAL_MANIFEST_PATH);
        if (localFile.exists()) {
            return objectMapper.readValue(localFile, Map.class);
        }
        
        // Fallback to global registry path (useful for operations console)
        java.io.File globalFile = new java.io.File(GLOBAL_MANIFEST_PATH);
        if (globalFile.exists()) {
            return objectMapper.readValue(globalFile, Map.class);
        }

        throw new java.io.FileNotFoundException("Manifest file not found in local or global paths.");
    }
}
