package egovframework.com.config;

import egovframework.com.common.context.ProjectRuntimeContext;
import egovframework.com.common.governance.model.ProjectManifestVO;
import egovframework.com.common.governance.service.ProjectManifestService;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;

import javax.sql.DataSource;

@Configuration
@Profile("prod")
public class DynamicProjectDataSourceConfig {

    private final ProjectRuntimeContext runtimeContext;
    private final ProjectManifestService manifestService;

    public DynamicProjectDataSourceConfig(ProjectRuntimeContext runtimeContext, ProjectManifestService manifestService) {
        this.runtimeContext = runtimeContext;
        this.manifestService = manifestService;
    }

    @Bean
    @Primary
    public DataSource dataSource() throws Exception {
        String projectId = runtimeContext.getProjectId();
        if (projectId == null || projectId.isEmpty()) {
            throw new IllegalStateException("Project ID must be provided via --app.project-id");
        }

        ProjectManifestVO manifest = manifestService.getProjectManifest(projectId);
        if (manifest == null) {
            throw new IllegalArgumentException("No manifest found for project: " + projectId);
        }

        ProjectManifestVO.Database database = manifest.getBindings() == null ? null : manifest.getBindings().getDatabase();
        String dbUrl = resolveProjectDbUrl(database);
        if (dbUrl == null || dbUrl.isEmpty()) {
            throw new IllegalStateException("No project DB url configured for project: " + projectId);
        }
        System.out.println("[DynamicDataSource] Binding to project " + projectId + " at " + dbUrl);

        // Fetch credentials from environment variables (injected via .env or systemd)
        String dbUsername = System.getenv("DB_USERNAME") != null ? System.getenv("DB_USERNAME") : "dba";
        String dbPassword = System.getenv("DB_PASSWORD") != null ? System.getenv("DB_PASSWORD") : "dba123";

        return DataSourceBuilder.create()
                .url(dbUrl)
                .username(dbUsername)
                .password(dbPassword)
                .driverClassName("cubrid.jdbc.driver.CUBRIDDriver")
                .build();
    }

    private String resolveProjectDbUrl(ProjectManifestVO.Database database) {
        if (database == null) {
            return "";
        }
        if (database.getProjectDb() != null && database.getProjectDb().getUrl() != null) {
            return database.getProjectDb().getUrl();
        }
        return database.getUrl() == null ? "" : database.getUrl();
    }
}
