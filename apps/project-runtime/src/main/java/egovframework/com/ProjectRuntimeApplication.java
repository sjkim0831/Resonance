package egovframework.com;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import egovframework.com.config.data.DataSourceConfig;
import egovframework.com.platform.screenbuilder.web.ThemeBuilderApiController;
import egovframework.com.platform.screenbuilder.repository.impl.ComponentRepositoryImpl;
import egovframework.com.platform.screenbuilder.repository.impl.ScreenConfigRepositoryImpl;
import egovframework.com.platform.screenbuilder.service.impl.BuilderComponentServiceImpl;
import egovframework.com.platform.screenbuilder.service.impl.BuilderScreenServiceImpl;
import egovframework.com.platform.screenbuilder.web.BuilderApiController;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import javax.sql.DataSource;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Independent runtime for Carbonet projects.
 * Focuses on project execution and business logic, excluding management/builder internals.
 *
 * NOTE: screenbuilder-carbonet-adapter package is excluded from component scan because it contains
 * Process.exec dependencies that cause startup failures in containerized environments.
 * Controllers that need to be exposed are manually registered as beans below.
 */
@SpringBootApplication
@ComponentScan(
        basePackages = { "egovframework.com", "org.egovframe.boot" },
        excludeFilters = {
                @ComponentScan.Filter(type = FilterType.REGEX, pattern = "egovframework\\.com\\.platform\\.screenbuilder\\..*"),
                @ComponentScan.Filter(type = FilterType.REGEX, pattern = "egovframework\\.com\\.feature\\.admin\\.screenbuilder\\..*"),
                @ComponentScan.Filter(type = FilterType.REGEX, pattern = "egovframework\\.com\\.framework\\.builder\\..*"),
                @ComponentScan.Filter(type = FilterType.REGEX, pattern = "egovframework\\.com\\.feature\\.admin\\.framework\\.builder\\..*"),
                @ComponentScan.Filter(type = FilterType.REGEX, pattern = "egovframework\\.com\\.platform\\.versioncontrol\\..*"),
                @ComponentScan.Filter(type = FilterType.REGEX, pattern = "egovframework\\.com\\.platform\\.runtimecontrol\\..*")
        })
@EnableScheduling
@Import(DataSourceConfig.class)
public class ProjectRuntimeApplication {

    @Bean
    public ThemeBuilderApiController themeBuilderApiController(ObjectMapper objectMapper) {
        return new ThemeBuilderApiController(objectMapper);
    }

    @Bean
    public ScreenBuilderMockController screenBuilderMockController(
            ObjectMapper objectMapper,
            @Value("${CARBONET_BACKEND_METADATA_FS_OVERRIDE_PATH:/app/backend-metadata}") String backendMetadataPath) {
        return new ScreenBuilderMockController(objectMapper, backendMetadataPath);
    }

    @Bean
    public JdbcTemplate jdbcTemplate(@Qualifier("dataSource") DataSource dataSource) {
        return new JdbcTemplate(dataSource);
    }

    @Bean
    public ComponentRepositoryImpl componentRepository(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        return new ComponentRepositoryImpl(jdbcTemplate, objectMapper);
    }

    @Bean
    public ScreenConfigRepositoryImpl screenConfigRepository(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        return new ScreenConfigRepositoryImpl(jdbcTemplate, objectMapper);
    }

    @Bean
    public BuilderComponentServiceImpl builderComponentService(ComponentRepositoryImpl componentRepository) {
        return new BuilderComponentServiceImpl(componentRepository);
    }

    @Bean
    public BuilderScreenServiceImpl builderScreenService(ScreenConfigRepositoryImpl screenConfigRepository, ObjectMapper objectMapper) {
        return new BuilderScreenServiceImpl(screenConfigRepository, objectMapper);
    }

    @Bean
    public BuilderApiController builderApiController(BuilderComponentServiceImpl builderComponentService, BuilderScreenServiceImpl builderScreenService, ObjectMapper objectMapper) {
        return new BuilderApiController(builderComponentService, builderScreenService, objectMapper);
    }

    @RequestMapping({"/api/platform/screen-builder", "/en/api/platform/screen-builder",
             "/admin/api/platform/screen-builder", "/en/admin/api/platform/screen-builder"})
    public static class ScreenBuilderMockController {
        private final ObjectMapper objectMapper;
        private final Path metadataRoot;

        public ScreenBuilderMockController(ObjectMapper objectMapper, String backendMetadataPath) {
            this.objectMapper = objectMapper;
            this.metadataRoot = Path.of(backendMetadataPath == null || backendMetadataPath.isBlank()
                    ? "/app/backend-metadata"
                    : backendMetadataPath.trim());
        }

        @GetMapping("/page")
        public Map<String, Object> getScreenBuilderPage() {
            Map<String, Object> override = readMetadataResponse("screen-builder/page.json");
            if (override != null) {
                return override;
            }
            ObjectNode page = objectMapper.createObjectNode();
            page.put("status", "ok");
            page.put("message", "Screen Builder API ready");
            page.put("menuCode", "A0060100");
            page.put("pageTitle", "Screen Builder");
            page.putArray("components");
            return Map.of("data", page, "status", "success");
        }

        @GetMapping("/components")
        public Map<String, Object> getComponents() {
            Map<String, Object> override = readMetadataResponse("screen-builder/components.json");
            if (override != null) {
                return override;
            }
            ArrayNode components = objectMapper.createArrayNode();
            ObjectNode btn = objectMapper.createObjectNode();
            btn.put("id", "btn-001");
            btn.put("type", "button");
            btn.put("label", "Button");
            btn.put("category", "form");
            components.add(btn);
            ObjectNode input = objectMapper.createObjectNode();
            input.put("id", "input-001");
            input.put("type", "input");
            input.put("label", "Input Field");
            input.put("category", "form");
            components.add(input);
            ObjectNode table = objectMapper.createObjectNode();
            table.put("id", "table-001");
            table.put("type", "table");
            table.put("label", "Data Table");
            table.put("category", "data");
            components.add(table);
            ObjectNode grid = objectMapper.createObjectNode();
            grid.put("id", "grid-001");
            grid.put("type", "grid");
            grid.put("label", "Grid Layout");
            grid.put("category", "layout");
            components.add(grid);
            ObjectNode card = objectMapper.createObjectNode();
            card.put("id", "card-001");
            card.put("type", "card");
            card.put("label", "Card");
            card.put("category", "display");
            components.add(card);
            return Map.of("data", components, "status", "success");
        }

        @GetMapping("/drafts")
        public Map<String, Object> getDrafts() {
            Map<String, Object> override = readMetadataResponse("screen-builder/drafts.json");
            if (override != null) {
                return override;
            }
            return Map.of("data", objectMapper.createArrayNode(), "status", "success");
        }

        @GetMapping("/versions")
        public Map<String, Object> getVersions() {
            Map<String, Object> override = readMetadataResponse("screen-builder/versions.json");
            if (override != null) {
                return override;
            }
            return Map.of("data", objectMapper.createArrayNode(), "status", "success");
        }

        @GetMapping("/themes")
        public Map<String, Object> getThemes() {
            Map<String, Object> override = readMetadataResponse("screen-builder/themes.json");
            if (override != null) {
                return override;
            }
            return Map.of("data", objectMapper.createArrayNode(), "status", "success");
        }

        @SuppressWarnings("unchecked")
        private Map<String, Object> readMetadataResponse(String relativePath) {
            Path metadataFile = metadataRoot.resolve(relativePath).normalize();
            if (!metadataFile.startsWith(metadataRoot.normalize()) || !Files.isRegularFile(metadataFile)) {
                return null;
            }
            try {
                return objectMapper.readValue(metadataFile.toFile(), Map.class);
            } catch (IOException e) {
                throw new IllegalStateException("Invalid backend metadata file: " + metadataFile, e);
            }
        }
    }

    public static void main(String[] args) {
        System.setProperty("file.encoding", "UTF-8");
        System.setProperty("spring.application.name", "project-runtime");
        SpringApplication.run(ProjectRuntimeApplication.class, args);
    }
}
