package egovframework.com.common.governance.service;

import egovframework.com.common.governance.model.CompatibilityMatrixVO;
import egovframework.com.common.governance.model.PackageRegistryVO;
import egovframework.com.common.governance.model.ProjectManifestVO;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class UpgradeGovernanceService {

    private final ProjectManifestService projectManifestService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private final String REGISTRY_PATH = "data/version-control/package-registry.json";
    private final String MATRIX_PATH = "data/version-control/compatibility-matrix.json";

    public List<Map<String, Object>> evaluateUpgradeCandidates(String projectId) throws Exception {
        ProjectManifestVO manifest = projectManifestService.getProjectManifest(projectId);
        if (manifest == null) {
            throw new IllegalArgumentException("Project not found: " + projectId);
        }

        String currentCoreVersion = manifest.getInstallations().getCommonCore();

        PackageRegistryVO registry = loadRegistry();
        CompatibilityMatrixVO matrix = loadMatrix();

        List<Map<String, Object>> candidates = new ArrayList<>();

        // Find newer commonCore versions
        for (PackageRegistryVO.Artifact coreArtifact : registry.getCommonCore()) {
            if (isNewerVersion(currentCoreVersion, coreArtifact.getVersion())) {
                Map<String, Object> candidate = new HashMap<>();
                candidate.put("targetVersion", coreArtifact.getVersion());
                
                // Assess compatibility
                CompatibilityMatrixVO.Rule appliedRule = findCompatibilityRule(matrix, "commonCore", coreArtifact.getVersion());
                if (appliedRule != null) {
                    candidate.put("compatibilityClass", appliedRule.getCompatibilityClass());
                    candidate.put("impact", appliedRule.getImpact());
                    candidate.put("notes", appliedRule.getNotes());
                    
                    // Check adapter contract requirement
                    String requiredAdapterContract = appliedRule.getDependencies().get("adapterContract");
                    if (requiredAdapterContract != null && !requiredAdapterContract.equals(manifest.getInstallations().getAdapterContract())) {
                        candidate.put("requiresAdapterUpdate", true);
                        candidate.put("compatibilityClass", "CONTRACT_AWARE"); // Escalate risk
                    } else {
                        candidate.put("requiresAdapterUpdate", false);
                    }
                } else {
                    candidate.put("compatibilityClass", "UNKNOWN");
                    candidate.put("impact", "High");
                }
                candidates.add(candidate);
            }
        }
        return candidates;
    }

    private PackageRegistryVO loadRegistry() throws Exception {
        byte[] jsonData = Files.readAllBytes(Paths.get(REGISTRY_PATH));
        return objectMapper.readValue(jsonData, PackageRegistryVO.class);
    }

    private CompatibilityMatrixVO loadMatrix() throws Exception {
        byte[] jsonData = Files.readAllBytes(Paths.get(MATRIX_PATH));
        return objectMapper.readValue(jsonData, CompatibilityMatrixVO.class);
    }

    private CompatibilityMatrixVO.Rule findCompatibilityRule(CompatibilityMatrixVO matrix, String component, String version) {
        if (matrix.getRules() == null) return null;
        for (CompatibilityMatrixVO.Rule rule : matrix.getRules()) {
            if (component.equals(rule.getSourceComponent()) && version.equals(rule.getSourceVersion())) {
                return rule;
            }
        }
        return null;
    }

    // Very simple semver comparison for demonstration purposes
    private boolean isNewerVersion(String current, String target) {
        return current.compareTo(target) < 0; 
    }
}
