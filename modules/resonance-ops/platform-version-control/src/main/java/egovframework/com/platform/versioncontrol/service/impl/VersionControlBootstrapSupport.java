package egovframework.com.platform.versioncontrol.service.impl;

import egovframework.com.platform.versioncontrol.model.vo.ReleaseUnitVO;
import egovframework.com.platform.versioncontrol.service.VersionControlService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class VersionControlBootstrapSupport implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(VersionControlBootstrapSupport.class);
    private final VersionControlService versionControlService;

    @Override
    public void run(String... args) throws Exception {
        String projectId = "carbonet"; // 기본 프로젝트 ID
        List<ReleaseUnitVO> units = versionControlService.getReleaseUnitsByProject(projectId);

        if (units.isEmpty()) {
            log.info("Initializing default release unit for project: {}", projectId);
            ReleaseUnitVO defaultUnit = new ReleaseUnitVO();
            defaultUnit.setProjectId(projectId);
            defaultUnit.setReleaseVersion("1.0.0-SNAPSHOT");
            defaultUnit.setReleaseStatus("DRAFT");
            defaultUnit.setDescription("Initial bootstrap release unit for Carbonet platform.");
            defaultUnit.setCreatedBy("SYSTEM");
            
            String id = versionControlService.createReleaseUnit(defaultUnit);
            log.info("Default release unit created with ID: {}", id);
        }
    }
}
