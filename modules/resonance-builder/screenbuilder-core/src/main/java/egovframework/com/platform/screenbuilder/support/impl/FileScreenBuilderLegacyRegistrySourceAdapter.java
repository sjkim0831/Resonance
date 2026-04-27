package egovframework.com.platform.screenbuilder.support.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.platform.screenbuilder.model.ScreenBuilderComponentRegistryItemVO;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderLegacyRegistrySourcePort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

@Component
@RequiredArgsConstructor
public class FileScreenBuilderLegacyRegistrySourceAdapter implements ScreenBuilderLegacyRegistrySourcePort {

    private final ObjectMapper objectMapper;

    @Override
    public List<ScreenBuilderComponentRegistryItemVO> loadLegacyRegistryItems() throws Exception {
        Path path = Paths.get("data", "screen-builder", "component-registry.json");
        if (!Files.exists(path)) {
            return Collections.emptyList();
        }
        try (InputStream inputStream = Files.newInputStream(path)) {
            ScreenBuilderComponentRegistryItemVO[] rows = objectMapper.readValue(inputStream, ScreenBuilderComponentRegistryItemVO[].class);
            if (rows == null || rows.length == 0) {
                return Collections.emptyList();
            }
            return Arrays.asList(rows);
        }
    }
}
