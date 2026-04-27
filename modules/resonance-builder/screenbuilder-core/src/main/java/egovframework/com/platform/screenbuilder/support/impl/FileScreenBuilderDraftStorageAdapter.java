package egovframework.com.platform.screenbuilder.support.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.platform.screenbuilder.model.ScreenBuilderDraftDocumentVO;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderDraftStoragePort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Component
@RequiredArgsConstructor
public class FileScreenBuilderDraftStorageAdapter implements ScreenBuilderDraftStoragePort {

    private final ObjectMapper objectMapper;

    @Override
    public ScreenBuilderDraftDocumentVO loadDraft(String menuCode) throws Exception {
        Path draftPath = resolveDraftPath(menuCode);
        if (!Files.exists(draftPath)) {
            return null;
        }
        try (InputStream inputStream = Files.newInputStream(draftPath)) {
            return objectMapper.readValue(inputStream, ScreenBuilderDraftDocumentVO.class);
        }
    }

    @Override
    public void saveDraft(ScreenBuilderDraftDocumentVO draft) throws Exception {
        Path draftPath = resolveDraftPath(draft == null ? "" : draft.getMenuCode());
        Files.createDirectories(draftPath.getParent());
        objectMapper.writerWithDefaultPrettyPrinter().writeValue(draftPath.toFile(), draft);
    }

    @Override
    public ScreenBuilderDraftDocumentVO loadHistoryVersion(String menuCode, String versionId) throws Exception {
        Path versionPath = resolveHistoryDir(menuCode).resolve(safe(versionId) + ".json");
        if (!Files.exists(versionPath)) {
            return null;
        }
        try (InputStream inputStream = Files.newInputStream(versionPath)) {
            return objectMapper.readValue(inputStream, ScreenBuilderDraftDocumentVO.class);
        }
    }

    @Override
    public List<ScreenBuilderDraftDocumentVO> listHistoryVersions(String menuCode) throws Exception {
        Path historyDir = resolveHistoryDir(menuCode);
        if (!Files.exists(historyDir)) {
            return Collections.emptyList();
        }
        List<Path> files = new ArrayList<>();
        try (Stream<Path> stream = Files.list(historyDir)) {
            stream.filter(path -> path.getFileName().toString().endsWith(".json")).forEach(files::add);
        }
        files.sort((left, right) -> right.getFileName().toString().compareTo(left.getFileName().toString()));
        List<ScreenBuilderDraftDocumentVO> rows = new ArrayList<>();
        for (Path file : files) {
            try (InputStream inputStream = Files.newInputStream(file)) {
                ScreenBuilderDraftDocumentVO document = objectMapper.readValue(inputStream, ScreenBuilderDraftDocumentVO.class);
                rows.add(document);
            }
        }
        return rows;
    }

    @Override
    public void saveHistorySnapshot(ScreenBuilderDraftDocumentVO draft, boolean preferDraftCopy) throws Exception {
        Path draftPath = resolveDraftPath(draft == null ? "" : draft.getMenuCode());
        Path historyDir = resolveHistoryDir(draft == null ? "" : draft.getMenuCode());
        Files.createDirectories(historyDir);
        Path historyPath = historyDir.resolve(safe(draft == null ? "" : draft.getVersionId()) + ".json");
        if (preferDraftCopy && Files.exists(draftPath)) {
            Files.copy(draftPath, historyPath, StandardCopyOption.REPLACE_EXISTING);
            return;
        }
        objectMapper.writerWithDefaultPrettyPrinter().writeValue(historyPath.toFile(), draft);
    }

    @Override
    public List<ScreenBuilderDraftDocumentVO> listAllDrafts() throws Exception {
        Path draftRoot = resolveDraftRoot();
        if (!Files.exists(draftRoot)) {
            return Collections.emptyList();
        }
        try (Stream<Path> stream = Files.list(draftRoot)) {
            List<Path> files = stream.filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().endsWith(".json"))
                    .filter(path -> !"component-registry.json".equals(path.getFileName().toString()))
                    .sorted(Comparator.comparing(path -> path.getFileName().toString()))
                    .collect(Collectors.toList());
            List<ScreenBuilderDraftDocumentVO> rows = new ArrayList<>();
            for (Path file : files) {
                try (InputStream inputStream = Files.newInputStream(file)) {
                    rows.add(objectMapper.readValue(inputStream, ScreenBuilderDraftDocumentVO.class));
                }
            }
            return rows;
        }
    }

    @Override
    public List<String> listHistoryMenuCodes() throws Exception {
        Path historyRoot = resolveDraftRoot().resolve("history");
        if (!Files.exists(historyRoot)) {
            return Collections.emptyList();
        }
        try (Stream<Path> stream = Files.list(historyRoot)) {
            return stream.filter(Files::isDirectory)
                    .map(path -> path.getFileName().toString())
                    .sorted()
                    .collect(Collectors.toList());
        }
    }

    @Override
    public Map<String, Object> loadStatusSummaryProjection(String menuCode, boolean isEn) throws Exception {
        Path projectionPath = resolveStatusSummaryProjectionPath(menuCode, isEn);
        if (!Files.exists(projectionPath)) {
            return null;
        }
        try (InputStream inputStream = Files.newInputStream(projectionPath)) {
            @SuppressWarnings("unchecked")
            Map<String, Object> stored = objectMapper.readValue(inputStream, LinkedHashMap.class);
            return stored;
        }
    }

    @Override
    public void saveStatusSummaryProjection(String menuCode, boolean isEn, Map<String, Object> projection) throws Exception {
        Path projectionPath = resolveStatusSummaryProjectionPath(menuCode, isEn);
        Files.createDirectories(projectionPath.getParent());
        objectMapper.writerWithDefaultPrettyPrinter().writeValue(projectionPath.toFile(), projection);
    }

    @Override
    public void deleteStatusSummaryProjection(String menuCode, boolean isEn) throws Exception {
        Files.deleteIfExists(resolveStatusSummaryProjectionPath(menuCode, isEn));
    }

    @Override
    public void deleteAllStatusSummaryProjections() throws Exception {
        Path projectionRoot = resolveStatusSummaryProjectionDir();
        if (!Files.exists(projectionRoot)) {
            return;
        }
        try (Stream<Path> stream = Files.list(projectionRoot)) {
            for (Path file : stream.collect(Collectors.toList())) {
                Files.deleteIfExists(file);
            }
        }
    }

    private Path resolveDraftRoot() {
        return Paths.get("data", "screen-builder");
    }

    private Path resolveDraftPath(String menuCode) {
        return resolveDraftRoot().resolve(safe(menuCode) + ".json");
    }

    private Path resolveHistoryDir(String menuCode) {
        return resolveDraftRoot().resolve("history").resolve(safe(menuCode));
    }

    private Path resolveStatusSummaryProjectionDir() {
        return resolveDraftRoot().resolve("status-summary");
    }

    private Path resolveStatusSummaryProjectionPath(String menuCode, boolean isEn) {
        return resolveStatusSummaryProjectionDir().resolve(safe(menuCode) + (isEn ? ".en.json" : ".ko.json"));
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
