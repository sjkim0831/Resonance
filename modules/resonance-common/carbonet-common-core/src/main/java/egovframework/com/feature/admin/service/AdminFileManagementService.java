package egovframework.com.feature.admin.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AdminFileManagementService {

    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final TypeReference<List<Map<String, Object>>> FILE_ITEM_LIST_TYPE = new TypeReference<List<Map<String, Object>>>() {
    };

    private final ObjectMapper objectMapper;
    private final Map<String, FileItem> fileStore = new ConcurrentHashMap<>();
    private final AdminPagePayloadFactory adminPagePayloadFactory;

    public AdminFileManagementService(ObjectMapper objectMapper, AdminPagePayloadFactory adminPagePayloadFactory) {
        this.objectMapper = objectMapper;
        this.adminPagePayloadFactory = adminPagePayloadFactory;
        seed(new FileItem("FILE_001", "2026_탄소배출_제출가이드_v3.pdf", "가이드", "Guide", "PDF", "4.2 MB",
                "ACTIVE", "PUBLIC", 6, 1840, "게시 종료 후 3년", "3 years after retirement",
                "공개", "Public", "배출 운영팀", "Emission Operations", "2026-03-31 09:20", "content_mgr",
                "배출량 제출, 검증 일정, 자주 묻는 오류를 안내하는 대표 운영 파일입니다.",
                "Primary operator file for emission submission, validation schedule, and common errors.",
                "", false, 3, List.of()));
        seed(new FileItem("FILE_002", "faq_import_template.xlsx", "운영 템플릿", "Ops Template", "XLSX", "612 KB",
                "REVIEW", "INTERNAL", 2, 98, "버전 교체 후 1년", "1 year after replacement",
                "내부", "Internal", "고객지원 운영", "Support Operations", "2026-03-30 15:05", "faq_admin",
                "FAQ 일괄 업로드 검증에 사용하는 내부 운영 템플릿입니다.",
                "Internal upload template used for FAQ bulk import validation.",
                "", false, 2, List.of()));
        seed(new FileItem("FILE_003", "partner_onboarding_assets.zip", "파트너 자료", "Partner Asset", "ZIP", "18.4 MB",
                "ACTIVE", "LIMITED", 4, 266, "계약 종료 후 5년", "5 years after contract end",
                "제한", "Restricted", "대외연계 운영", "External Integration Ops", "2026-03-29 11:42", "partner_mgr",
                "파트너 센터 온보딩과 API 연계 안내에 사용하는 제한 배포 자료입니다.",
                "Restricted distribution asset bundle for partner onboarding and API integration guides.",
                "", false, 4, List.of()));
        seed(new FileItem("FILE_004", "legacy_popup_assets_2024.pptx", "보관 자료", "Archive", "PPTX", "9.1 MB",
                "ARCHIVE", "INTERNAL", 0, 17, "영구 보관", "Permanent retention",
                "내부", "Internal", "서비스 기획", "Service Planning", "2026-03-18 08:33", "planner01",
                "이전 팝업 운영 이력을 보관하는 참조용 파일입니다.",
                "Reference file preserving historical popup operations.",
                "", false, 1, List.of()));
        loadPersistedUploads();
    }

    public synchronized Map<String, Object> buildPagePayload(String searchKeyword, String status, String visibility, String fileId, boolean isEn) {
        String keyword = safe(searchKeyword).toLowerCase(Locale.ROOT);
        String normalizedStatus = safe(status).toUpperCase(Locale.ROOT);
        String normalizedVisibility = safe(visibility).toUpperCase(Locale.ROOT);

        List<Map<String, String>> catalog = baseCatalog(isEn);
        List<Map<String, String>> filtered = new ArrayList<>();
        for (Map<String, String> row : catalog) {
            if (!matchesKeyword(row, keyword)) {
                continue;
            }
            if (!normalizedStatus.isEmpty() && !"ALL".equals(normalizedStatus)
                    && !normalizedStatus.equalsIgnoreCase(safe(row.get("status")))) {
                continue;
            }
            if (!normalizedVisibility.isEmpty() && !"ALL".equals(normalizedVisibility)
                    && !normalizedVisibility.equalsIgnoreCase(safe(row.get("visibility")))) {
                continue;
            }
            filtered.add(row);
        }

        Map<String, String> selected = selectRow(filtered, catalog, safe(fileId));

        Map<String, Object> payload = adminPagePayloadFactory.create(isEn, "A0040104");
        payload.put("searchKeyword", safe(searchKeyword));
        payload.put("status", safe(status));
        payload.put("visibility", safe(visibility));
        payload.put("selectedFileId", safe(selected.get("id")));
        payload.put("summaryCards", buildSummaryCards(catalog, filtered.size(), isEn));
        payload.put("fileRows", filtered);
        payload.put("selectedFile", selected);
        payload.put("selectedFileHistory", buildHistoryRows(safe(selected.get("id")), isEn));
        payload.put("deletedFileRows", buildDeletedFileRows(isEn));
        payload.put("governanceNotes", buildGovernanceNotes(isEn));
        return payload;
    }

    public synchronized Map<String, Object> saveFile(MultipartFile uploadFile,
                                                     String category,
                                                     String visibility,
                                                     String status,
                                                     String description,
                                                     boolean isEn) throws IOException {
        if (uploadFile == null || uploadFile.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Please choose a file to upload." : "업로드할 파일을 선택해 주세요.");
        }

        Path uploadDir = resolveUploadDir();
        Files.createDirectories(uploadDir);

        String originalName = safe(uploadFile.getOriginalFilename());
        if (originalName.isEmpty()) {
            originalName = "uploaded-file";
        }
        String extension = extractExtension(originalName);
        String fileId = "FILE_UP_" + System.currentTimeMillis();
        String storedFileName = fileId + (extension.isEmpty() ? "" : "." + extension.toLowerCase(Locale.ROOT));
        Path target = uploadDir.resolve(storedFileName).normalize();
        uploadFile.transferTo(target.toFile());

        LocalDateTime now = LocalDateTime.now();
        String timestamp = now.format(DATE_TIME_FORMATTER);
        FileItem item = new FileItem(
                fileId,
                originalName,
                safe(category).isEmpty() ? "운영 업로드" : safe(category),
                safe(category).isEmpty() ? "Uploaded Asset" : safe(category),
                extension.isEmpty() ? "FILE" : extension.toUpperCase(Locale.ROOT),
                humanReadableSize(uploadFile.getSize()),
                safe(status).isEmpty() ? "REVIEW" : safe(status).toUpperCase(Locale.ROOT),
                safe(visibility).isEmpty() ? "INTERNAL" : safe(visibility).toUpperCase(Locale.ROOT),
                0,
                0,
                "업로드 후 수동 검토",
                "Manual review after upload",
                securityGradeLabel(safe(visibility), false),
                securityGradeLabel(safe(visibility), true),
                "콘텐츠 운영",
                "Content Operations",
                timestamp,
                "codex-admin",
                safe(description).isEmpty() ? "관리자 파일 관리 화면에서 업로드한 파일입니다." : safe(description),
                safe(description).isEmpty() ? "Uploaded from the admin file-management screen." : safe(description),
                target.toAbsolutePath().toString(),
                true,
                1,
                List.of(new FileHistoryEntry(timestamp, "UPLOAD", "codex-admin",
                isEn ? "File uploaded to local storage." : "로컬 저장소에 파일을 업로드했습니다."))
        );
        fileStore.put(item.id, item);
        persistUploads();

        Map<String, Object> response = adminPagePayloadFactory.createStatusResponse(
                "success",
                true,
                "fileId",
                item.id,
                isEn ? "File uploaded." : "파일을 업로드했습니다.");
        response.put("file", toRow(item, isEn));
        return response;
    }

    public synchronized Map<String, Object> deleteFile(String fileId, boolean isEn) throws IOException {
        String normalizedId = safe(fileId);
        if (normalizedId.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "No file selected." : "삭제할 파일이 선택되지 않았습니다.");
        }
        FileItem removed = fileStore.remove(normalizedId);
        if (removed == null) {
            throw new IllegalArgumentException(isEn ? "File not found." : "파일 정보를 찾을 수 없습니다.");
        }
        if (removed.uploaded && !safe(removed.storedPath).isEmpty()) {
            Path filePath = Paths.get(removed.storedPath).toAbsolutePath().normalize();
            Path rootPath = resolveUploadDir().toAbsolutePath().normalize();
            if (filePath.startsWith(rootPath)) {
                Files.deleteIfExists(filePath);
            }
        }
        FileItem archived = removed.withAddedHistory(historyEntry("DELETE", "codex-admin",
                isEn ? "File entry deleted from the managed list." : "관리 목록에서 파일 항목을 삭제했습니다."));
        writeDeletedHistory(archived);
        persistUploads();

        return adminPagePayloadFactory.createStatusResponse(
                "success",
                true,
                "fileId",
                normalizedId,
                isEn ? "File deleted." : "파일을 삭제했습니다.");
    }

    public synchronized Map<String, Object> updateFile(String fileId,
                                                       String category,
                                                       String visibility,
                                                       String status,
                                                       String description,
                                                       boolean isEn) throws IOException {
        String normalizedId = safe(fileId);
        if (normalizedId.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "No file selected." : "수정할 파일이 선택되지 않았습니다.");
        }

        FileItem current = fileStore.get(normalizedId);
        if (current == null) {
            throw new IllegalArgumentException(isEn ? "File not found." : "파일 정보를 찾을 수 없습니다.");
        }
        if (!current.uploaded) {
            throw new IllegalArgumentException(isEn ? "Seeded reference rows cannot be edited here." : "기본 참조 행은 여기서 수정할 수 없습니다.");
        }

        String normalizedCategory = safe(category);
        String normalizedVisibility = safe(visibility).toUpperCase(Locale.ROOT);
        String normalizedStatus = safe(status).toUpperCase(Locale.ROOT);
        String normalizedDescription = safe(description);
        LocalDateTime now = LocalDateTime.now();

        FileItem updated = new FileItem(
                current.id,
                current.fileName,
                normalizedCategory.isEmpty() ? current.categoryKo : normalizedCategory,
                normalizedCategory.isEmpty() ? current.categoryEn : normalizedCategory,
                current.extension,
                current.sizeLabel,
                normalizedStatus.isEmpty() ? current.status : normalizedStatus,
                normalizedVisibility.isEmpty() ? current.visibility : normalizedVisibility,
                current.linkedScreens,
                current.downloadCount,
                current.retentionKo,
                current.retentionEn,
                securityGradeLabel(normalizedVisibility.isEmpty() ? current.visibility : normalizedVisibility, false),
                securityGradeLabel(normalizedVisibility.isEmpty() ? current.visibility : normalizedVisibility, true),
                current.ownerKo,
                current.ownerEn,
                now.format(DATE_TIME_FORMATTER),
                "codex-admin",
                normalizedDescription.isEmpty() ? current.descriptionKo : normalizedDescription,
                normalizedDescription.isEmpty() ? current.descriptionEn : normalizedDescription,
                current.storedPath,
                true,
                current.version,
                current.histories
        ).withAddedHistory(historyEntry("UPDATE", "codex-admin",
                isEn ? "Metadata updated for category, visibility, status, or description." : "분류, 공개 범위, 상태 또는 설명을 수정했습니다."));
        fileStore.put(updated.id, updated);
        persistUploads();

        Map<String, Object> response = adminPagePayloadFactory.createStatusResponse(
                "success",
                true,
                "fileId",
                updated.id,
                isEn ? "File metadata updated." : "파일 정보를 수정했습니다.");
        response.put("file", toRow(updated, isEn));
        return response;
    }

    public synchronized Map<String, Object> replaceFile(String fileId,
                                                        MultipartFile uploadFile,
                                                        boolean isEn) throws IOException {
        String normalizedId = safe(fileId);
        if (normalizedId.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "No file selected." : "교체할 파일이 선택되지 않았습니다.");
        }
        if (uploadFile == null || uploadFile.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Please choose a replacement file." : "교체할 파일을 선택해 주세요.");
        }

        FileItem current = fileStore.get(normalizedId);
        if (current == null) {
            throw new IllegalArgumentException(isEn ? "File not found." : "파일 정보를 찾을 수 없습니다.");
        }
        if (!current.uploaded) {
            throw new IllegalArgumentException(isEn ? "Seeded reference rows cannot be replaced here." : "기본 참조 행은 여기서 교체할 수 없습니다.");
        }

        Path uploadDir = resolveUploadDir();
        Files.createDirectories(uploadDir);
        String originalName = safe(uploadFile.getOriginalFilename());
        if (originalName.isEmpty()) {
            originalName = current.fileName;
        }
        String extension = extractExtension(originalName);
        String storedFileName = current.id + (extension.isEmpty() ? "" : "." + extension.toLowerCase(Locale.ROOT));
        Path target = uploadDir.resolve(storedFileName).normalize();
        uploadFile.transferTo(target.toFile());

        LocalDateTime now = LocalDateTime.now();
        FileItem updated = new FileItem(
                current.id,
                originalName,
                current.categoryKo,
                current.categoryEn,
                extension.isEmpty() ? current.extension : extension.toUpperCase(Locale.ROOT),
                humanReadableSize(uploadFile.getSize()),
                current.status,
                current.visibility,
                current.linkedScreens,
                current.downloadCount,
                current.retentionKo,
                current.retentionEn,
                current.securityGradeKo,
                current.securityGradeEn,
                current.ownerKo,
                current.ownerEn,
                now.format(DATE_TIME_FORMATTER),
                "codex-admin",
                current.descriptionKo,
                current.descriptionEn,
                target.toAbsolutePath().toString(),
                true,
                current.version + 1,
                current.histories
        ).withAddedHistory(historyEntry("REPLACE", "codex-admin",
                isEn ? "Stored file replaced and version incremented." : "저장 파일을 교체하고 버전을 증가시켰습니다."));
        fileStore.put(updated.id, updated);
        persistUploads();

        Map<String, Object> response = adminPagePayloadFactory.createStatusResponse(
                "success",
                true,
                "fileId",
                updated.id,
                isEn ? "File replaced." : "파일을 교체했습니다.");
        response.put("file", toRow(updated, isEn));
        return response;
    }

    public synchronized DownloadTarget prepareDownload(String fileId, boolean isEn) throws IOException {
        String normalizedId = safe(fileId);
        if (normalizedId.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "No file selected." : "다운로드할 파일이 선택되지 않았습니다.");
        }

        FileItem current = fileStore.get(normalizedId);
        if (current == null) {
            throw new IllegalArgumentException(isEn ? "File not found." : "파일 정보를 찾을 수 없습니다.");
        }
        if (safe(current.storedPath).isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Download is available only for uploaded files." : "다운로드는 업로드된 파일에 대해서만 지원됩니다.");
        }

        Path filePath = Paths.get(current.storedPath).toAbsolutePath().normalize();
        Path rootPath = resolveUploadDir().toAbsolutePath().normalize();
        if (!filePath.startsWith(rootPath) || !Files.exists(filePath) || !Files.isRegularFile(filePath)) {
            throw new IllegalArgumentException(isEn ? "File not found or access denied." : "파일을 찾을 수 없거나 접근할 수 없습니다.");
        }

        FileItem updated = current.withDownloadCount(current.downloadCount + 1)
                .withAddedHistory(historyEntry("DOWNLOAD", "codex-admin",
                        isEn ? "Download requested for the stored file." : "저장된 파일 다운로드를 요청했습니다."));
        fileStore.put(updated.id, updated);
        persistUploads();
        return new DownloadTarget(filePath, updated.fileName);
    }

    public synchronized Map<String, Object> restoreDeletedFile(String fileId, String restoreNote, boolean isEn) throws IOException {
        String normalizedId = safe(fileId);
        String normalizedRestoreNote = safe(restoreNote);
        if (normalizedId.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "No deleted file selected." : "복구할 삭제 파일이 선택되지 않았습니다.");
        }
        if (fileStore.containsKey(normalizedId)) {
            throw new IllegalArgumentException(isEn ? "The file is already active." : "이미 활성 파일로 존재합니다.");
        }

        Path backupPath = resolveHistoryDir().resolve(normalizedId + ".json").normalize();
        if (!Files.exists(backupPath)) {
            throw new IllegalArgumentException(isEn ? "Deleted backup not found." : "삭제 백업 정보를 찾을 수 없습니다.");
        }

        Map<String, Object> row = objectMapper.readValue(backupPath.toFile(), new TypeReference<Map<String, Object>>() {
        });
        FileItem item = fileItemFromMap(row);
        if (item == null) {
            throw new IllegalArgumentException(isEn ? "Deleted backup is invalid." : "삭제 백업 정보가 올바르지 않습니다.");
        }
        String restoreMessage = isEn
                ? "Deleted backup restored to the active list."
                : "삭제 백업을 활성 목록으로 복구했습니다.";
        if (!normalizedRestoreNote.isEmpty()) {
            restoreMessage = restoreMessage + (isEn ? " Note: " : " 메모: ") + normalizedRestoreNote;
        }
        FileItem restored = item.withAddedHistory(historyEntry("RESTORE", "codex-admin", restoreMessage));
        fileStore.put(restored.id, restored);
        Files.deleteIfExists(backupPath);
        persistUploads();

        Map<String, Object> response = adminPagePayloadFactory.createStatusResponse(
                "success",
                true,
                "fileId",
                restored.id,
                isEn ? "Deleted file restored." : "삭제 파일을 복구했습니다.");
        response.put("file", toRow(restored, isEn));
        return response;
    }

    private boolean matchesKeyword(Map<String, String> row, String keyword) {
        if (keyword.isEmpty()) {
            return true;
        }
        return safe(row.get("id")).toLowerCase(Locale.ROOT).contains(keyword)
                || safe(row.get("fileName")).toLowerCase(Locale.ROOT).contains(keyword)
                || safe(row.get("categoryLabel")).toLowerCase(Locale.ROOT).contains(keyword)
                || safe(row.get("extension")).toLowerCase(Locale.ROOT).contains(keyword)
                || safe(row.get("owner")).toLowerCase(Locale.ROOT).contains(keyword)
                || safe(row.get("updatedBy")).toLowerCase(Locale.ROOT).contains(keyword);
    }

    private Map<String, String> selectRow(List<Map<String, String>> filtered, List<Map<String, String>> catalog, String fileId) {
        if (!fileId.isEmpty()) {
            for (Map<String, String> row : filtered) {
                if (fileId.equals(safe(row.get("id")))) {
                    return row;
                }
            }
            for (Map<String, String> row : catalog) {
                if (fileId.equals(safe(row.get("id")))) {
                    return row;
                }
            }
        }
        return filtered.isEmpty() ? (catalog.isEmpty() ? new LinkedHashMap<>() : catalog.get(0)) : filtered.get(0);
    }

    private List<Map<String, String>> baseCatalog(boolean isEn) {
        List<FileItem> items = new ArrayList<>(fileStore.values());
        items.sort(Comparator.comparing((FileItem item) -> item.updatedAt).reversed().thenComparing(item -> item.id));
        List<Map<String, String>> rows = new ArrayList<>();
        for (FileItem item : items) {
            rows.add(toRow(item, isEn));
        }
        return rows;
    }

    private List<Map<String, String>> buildSummaryCards(List<Map<String, String>> catalog, int filteredCount, boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(summaryCard(isEn ? "Files" : "등록 파일", String.valueOf(filteredCount),
                isEn ? "Rows matching the current filter." : "현재 조회 조건에 맞는 파일 수입니다."));
        rows.add(summaryCard(isEn ? "Active" : "운영중", String.valueOf(countByValue(catalog, "status", "ACTIVE")),
                isEn ? "Currently distributed files." : "현재 배포 중인 파일입니다."));
        rows.add(summaryCard(isEn ? "Review" : "검토중", String.valueOf(countByValue(catalog, "status", "REVIEW")),
                isEn ? "Files pending release review." : "배포 검토 대기 파일입니다."));
        rows.add(summaryCard(isEn ? "Archive" : "보관", String.valueOf(countByValue(catalog, "status", "ARCHIVE")),
                isEn ? "Archived files retained for audit." : "감사 및 참조 목적으로 보관 중인 파일입니다."));
        return rows;
    }

    private List<Map<String, String>> buildGovernanceNotes(boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(noteRow(
                isEn ? "Review visibility before widening access." : "공개 범위 확대 전 영향 확인",
                isEn ? "Confirm owner, linked screen impact, and retention policy before changing a file from internal to public."
                        : "파일을 내부에서 공개로 바꾸기 전에는 담당자, 연결 화면 영향, 보관 정책을 함께 확인해야 합니다."));
        rows.add(noteRow(
                isEn ? "Keep archive files immutable." : "보관 파일은 변경보다 대체 우선",
                isEn ? "Archived files should remain immutable for audit consistency. Publish a new version instead of overwriting."
                        : "감사 일관성을 위해 보관 파일은 덮어쓰기보다 새 버전 발행을 우선합니다."));
        rows.add(noteRow(
                isEn ? "Match file scope with consuming surfaces." : "사용 화면과 파일 범위 정합성 유지",
                isEn ? "Partner-only or operator-only files should not be linked to public FAQ, sitemap, or banner surfaces."
                        : "파트너 전용 또는 운영 전용 파일은 공개 FAQ, 사이트맵, 배너 영역에 직접 연결하지 않습니다."));
        return rows;
    }

    private List<Map<String, String>> buildDeletedFileRows(boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        Path historyDir = resolveHistoryDir();
        if (!Files.exists(historyDir)) {
            return rows;
        }
        try {
            Files.list(historyDir)
                    .filter(path -> path.getFileName().toString().endsWith(".json"))
                    .sorted(Comparator.reverseOrder())
                    .forEach(path -> {
                        try {
                            Map<String, Object> source = objectMapper.readValue(path.toFile(), new TypeReference<Map<String, Object>>() {
                            });
                            FileItem item = fileItemFromMap(source);
                            if (item != null) {
                                Map<String, String> row = new LinkedHashMap<>();
                                row.put("id", item.id);
                                row.put("fileName", item.fileName);
                                row.put("versionLabel", "v" + item.version);
                                row.put("updatedAt", item.updatedAt);
                                row.put("updatedBy", item.updatedBy);
                                row.put("categoryLabel", isEn ? item.categoryEn : item.categoryKo);
                                row.put("lastActionMessage", item.histories.isEmpty() ? "" : safe(item.histories.get(0).message));
                                rows.add(row);
                            }
                        } catch (IOException ignored) {
                            // Skip broken deleted backup rows.
                        }
                    });
        } catch (IOException ignored) {
            return rows;
        }
        return rows;
    }

    private List<Map<String, String>> buildHistoryRows(String fileId, boolean isEn) {
        FileItem item = fileStore.get(fileId);
        List<Map<String, String>> rows = new ArrayList<>();
        if (item == null) {
            return rows;
        }
        if (item.histories.isEmpty()) {
            if (!item.uploaded) {
                rows.add(historyRow(item.updatedAt, "SEED", item.updatedBy,
                        isEn ? "Seeded reference row shipped with the page." : "화면에 기본 포함된 참조 데이터입니다.", isEn));
            }
            return rows;
        }
        for (FileHistoryEntry history : item.histories) {
            rows.add(historyRow(history.at, history.action, history.actor, history.message, isEn));
        }
        return rows;
    }

    private int countByValue(List<Map<String, String>> rows, String key, String expectedValue) {
        int count = 0;
        for (Map<String, String> row : rows) {
            if (expectedValue.equalsIgnoreCase(safe(row.get(key)))) {
                count++;
            }
        }
        return count;
    }

    private Map<String, String> summaryCard(String title, String value, String description) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("title", title);
        row.put("value", value);
        row.put("description", description);
        return row;
    }

    private Map<String, String> noteRow(String title, String body) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("title", title);
        row.put("body", body);
        return row;
    }

    private Map<String, String> historyRow(String at, String action, String actor, String message, boolean isEn) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("at", at);
        row.put("action", action);
        row.put("actionLabel", historyActionLabel(action, isEn));
        row.put("actor", actor);
        row.put("message", message);
        return row;
    }

    private Map<String, String> toRow(FileItem item, boolean isEn) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("id", item.id);
        row.put("fileName", item.fileName);
        row.put("categoryLabel", isEn ? item.categoryEn : item.categoryKo);
        row.put("versionLabel", "v" + item.version);
        row.put("extension", item.extension);
        row.put("sizeLabel", item.sizeLabel);
        row.put("status", item.status);
        row.put("statusLabel", statusLabel(item.status, isEn));
        row.put("visibility", item.visibility);
        row.put("visibilityLabel", visibilityLabel(item.visibility, isEn));
        row.put("linkedScreens", String.valueOf(item.linkedScreens));
        row.put("downloadCount", String.valueOf(item.downloadCount));
        row.put("retentionLabel", isEn ? item.retentionEn : item.retentionKo);
        row.put("securityGradeLabel", isEn ? item.securityGradeEn : item.securityGradeKo);
        row.put("owner", isEn ? item.ownerEn : item.ownerKo);
        row.put("updatedAt", item.updatedAt);
        row.put("updatedBy", item.updatedBy);
        row.put("description", isEn ? item.descriptionEn : item.descriptionKo);
        row.put("storedPath", item.storedPath);
        row.put("uploaded", item.uploaded ? "Y" : "N");
        row.put("downloadAvailable", canDownload(item) ? "Y" : "N");
        return row;
    }

    private String statusLabel(String status, boolean isEn) {
        if ("ACTIVE".equalsIgnoreCase(status)) {
            return isEn ? "Active" : "운영중";
        }
        if ("REVIEW".equalsIgnoreCase(status)) {
            return isEn ? "Review" : "검토중";
        }
        return isEn ? "Archive" : "보관";
    }

    private String visibilityLabel(String visibility, boolean isEn) {
        if ("PUBLIC".equalsIgnoreCase(visibility)) {
            return isEn ? "Public" : "공개";
        }
        if ("LIMITED".equalsIgnoreCase(visibility)) {
            return isEn ? "Limited" : "제한";
        }
        return isEn ? "Internal" : "내부";
    }

    private String securityGradeLabel(String visibility, boolean isEn) {
        if ("PUBLIC".equalsIgnoreCase(visibility)) {
            return isEn ? "Public" : "공개";
        }
        if ("LIMITED".equalsIgnoreCase(visibility)) {
            return isEn ? "Restricted" : "제한";
        }
        return isEn ? "Internal" : "내부";
    }

    private String historyActionLabel(String action, boolean isEn) {
        if ("UPLOAD".equalsIgnoreCase(action)) {
            return isEn ? "Upload" : "업로드";
        }
        if ("UPDATE".equalsIgnoreCase(action)) {
            return isEn ? "Metadata Update" : "정보 수정";
        }
        if ("DOWNLOAD".equalsIgnoreCase(action)) {
            return isEn ? "Download" : "다운로드";
        }
        if ("DELETE".equalsIgnoreCase(action)) {
            return isEn ? "Delete" : "삭제";
        }
        if ("REPLACE".equalsIgnoreCase(action)) {
            return isEn ? "Replace Binary" : "파일 교체";
        }
        if ("RESTORE".equalsIgnoreCase(action)) {
            return isEn ? "Restore" : "복구";
        }
        return isEn ? "Seed" : "기본값";
    }

    private String extractExtension(String fileName) {
        String safeFileName = safe(fileName);
        int lastDotIndex = safeFileName.lastIndexOf('.');
        if (lastDotIndex < 0 || lastDotIndex == safeFileName.length() - 1) {
            return "";
        }
        return safeFileName.substring(lastDotIndex + 1).replaceAll("[^a-zA-Z0-9]", "");
    }

    private String humanReadableSize(long sizeBytes) {
        if (sizeBytes < 1024) {
            return sizeBytes + " B";
        }
        double sizeKb = sizeBytes / 1024.0;
        if (sizeKb < 1024) {
            return String.format(Locale.ROOT, "%.0f KB", sizeKb);
        }
        return String.format(Locale.ROOT, "%.1f MB", sizeKb / 1024.0);
    }

    private Path resolveUploadDir() {
        return Paths.get("./var/file/admin-content").toAbsolutePath().normalize();
    }

    private Path resolveIndexPath() {
        return resolveUploadDir().resolve("index.json").normalize();
    }

    private Path resolveHistoryDir() {
        return resolveUploadDir().resolve("history").normalize();
    }

    private void seed(FileItem item) {
        fileStore.put(item.id, item);
    }

    private void loadPersistedUploads() {
        Path indexPath = resolveIndexPath();
        if (!Files.exists(indexPath)) {
            return;
        }
        try {
            List<Map<String, Object>> rows = objectMapper.readValue(indexPath.toFile(), FILE_ITEM_LIST_TYPE);
            for (Map<String, Object> row : rows) {
                FileItem item = fileItemFromMap(row);
                if (item != null && item.uploaded) {
                    fileStore.put(item.id, item);
                }
            }
        } catch (IOException ignored) {
            // Ignore corrupted local cache and continue with seeded defaults.
        }
    }

    private void persistUploads() throws IOException {
        Path uploadDir = resolveUploadDir();
        Files.createDirectories(uploadDir);
        Path indexPath = resolveIndexPath();
        List<Map<String, Object>> rows = new ArrayList<>();
        List<FileItem> items = new ArrayList<>(fileStore.values());
        items.sort(Comparator.comparing((FileItem item) -> item.updatedAt).reversed().thenComparing(item -> item.id));
        for (FileItem item : items) {
            if (!item.uploaded) {
                continue;
            }
            rows.add(toPersistedRow(item));
        }
        objectMapper.writerWithDefaultPrettyPrinter().writeValue(indexPath.toFile(), rows);
    }

    private void writeDeletedHistory(FileItem item) throws IOException {
        Path uploadDir = resolveUploadDir();
        Files.createDirectories(uploadDir);
        Path historyDir = resolveHistoryDir();
        Files.createDirectories(historyDir);
        objectMapper.writerWithDefaultPrettyPrinter().writeValue(historyDir.resolve(item.id + ".json").toFile(), toPersistedRow(item));
    }

    private Map<String, Object> toPersistedRow(FileItem item) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", item.id);
        row.put("fileName", item.fileName);
        row.put("categoryKo", item.categoryKo);
        row.put("categoryEn", item.categoryEn);
        row.put("extension", item.extension);
        row.put("sizeLabel", item.sizeLabel);
        row.put("status", item.status);
        row.put("visibility", item.visibility);
        row.put("linkedScreens", item.linkedScreens);
        row.put("downloadCount", item.downloadCount);
        row.put("retentionKo", item.retentionKo);
        row.put("retentionEn", item.retentionEn);
        row.put("securityGradeKo", item.securityGradeKo);
        row.put("securityGradeEn", item.securityGradeEn);
        row.put("ownerKo", item.ownerKo);
        row.put("ownerEn", item.ownerEn);
        row.put("updatedAt", item.updatedAt);
        row.put("updatedBy", item.updatedBy);
        row.put("descriptionKo", item.descriptionKo);
        row.put("descriptionEn", item.descriptionEn);
        row.put("storedPath", item.storedPath);
        row.put("uploaded", item.uploaded);
        row.put("version", item.version);
        List<Map<String, Object>> histories = new ArrayList<>();
        for (FileHistoryEntry history : item.histories) {
            Map<String, Object> historyRow = new LinkedHashMap<>();
            historyRow.put("at", history.at);
            historyRow.put("action", history.action);
            historyRow.put("actor", history.actor);
            historyRow.put("message", history.message);
            histories.add(historyRow);
        }
        row.put("histories", histories);
        return row;
    }

    private FileItem fileItemFromMap(Map<String, Object> row) {
        String id = safe(row.get("id"));
        String fileName = safe(row.get("fileName"));
        if (id.isEmpty() || fileName.isEmpty()) {
            return null;
        }
        return new FileItem(
                id,
                fileName,
                safe(row.get("categoryKo")),
                safe(row.get("categoryEn")),
                safe(row.get("extension")),
                safe(row.get("sizeLabel")),
                safe(row.get("status")),
                safe(row.get("visibility")),
                parseInt(row.get("linkedScreens")),
                parseInt(row.get("downloadCount")),
                safe(row.get("retentionKo")),
                safe(row.get("retentionEn")),
                safe(row.get("securityGradeKo")),
                safe(row.get("securityGradeEn")),
                safe(row.get("ownerKo")),
                safe(row.get("ownerEn")),
                safe(row.get("updatedAt")),
                safe(row.get("updatedBy")),
                safe(row.get("descriptionKo")),
                safe(row.get("descriptionEn")),
                safe(row.get("storedPath")),
                parseBoolean(row.get("uploaded")),
                parseInt(firstNonBlank(safe(row.get("version")), "1")),
                parseHistories(row.get("histories"))
        );
    }

    private String firstNonBlank(String value, String fallback) {
        return safe(value).isEmpty() ? fallback : safe(value);
    }

    @SuppressWarnings("unchecked")
    private List<FileHistoryEntry> parseHistories(Object source) {
        List<FileHistoryEntry> rows = new ArrayList<>();
        if (!(source instanceof List<?>)) {
            return rows;
        }
        List<?> list = (List<?>) source;
        for (Object item : list) {
            if (!(item instanceof Map<?, ?>)) {
                continue;
            }
            Map<?, ?> map = (Map<?, ?>) item;
            rows.add(new FileHistoryEntry(
                    safe(map.get("at")),
                    safe(map.get("action")),
                    safe(map.get("actor")),
                    safe(map.get("message"))
            ));
        }
        return rows;
    }

    private FileHistoryEntry historyEntry(String action, String actor, String message) {
        return new FileHistoryEntry(LocalDateTime.now().format(DATE_TIME_FORMATTER), action, actor, message);
    }

    private boolean canDownload(FileItem item) {
        if (safe(item.storedPath).isEmpty()) {
            return false;
        }
        Path filePath = Paths.get(item.storedPath).toAbsolutePath().normalize();
        Path rootPath = resolveUploadDir().toAbsolutePath().normalize();
        return filePath.startsWith(rootPath) && Files.exists(filePath) && Files.isRegularFile(filePath);
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String safe(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private int parseInt(Object value) {
        String normalized = safe(value);
        if (normalized.isEmpty()) {
            return 0;
        }
        try {
            return Integer.parseInt(normalized);
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private boolean parseBoolean(Object value) {
        return "true".equalsIgnoreCase(safe(value)) || "y".equalsIgnoreCase(safe(value));
    }

    public static final class DownloadTarget {
        private final Path path;
        private final String fileName;

        public DownloadTarget(Path path, String fileName) {
            this.path = path;
            this.fileName = fileName;
        }

        public Path getPath() {
            return path;
        }

        public String getFileName() {
            return fileName;
        }
    }

    private static final class FileItem {
        private final String id;
        private final String fileName;
        private final String categoryKo;
        private final String categoryEn;
        private final String extension;
        private final String sizeLabel;
        private final String status;
        private final String visibility;
        private final int linkedScreens;
        private final int downloadCount;
        private final String retentionKo;
        private final String retentionEn;
        private final String securityGradeKo;
        private final String securityGradeEn;
        private final String ownerKo;
        private final String ownerEn;
        private final String updatedAt;
        private final String updatedBy;
        private final String descriptionKo;
        private final String descriptionEn;
        private final String storedPath;
        private final boolean uploaded;
        private final int version;
        private final List<FileHistoryEntry> histories;

        private FileItem(String id, String fileName, String categoryKo, String categoryEn, String extension, String sizeLabel,
                         String status, String visibility, int linkedScreens, int downloadCount, String retentionKo, String retentionEn,
                         String securityGradeKo, String securityGradeEn, String ownerKo, String ownerEn, String updatedAt, String updatedBy,
                         String descriptionKo, String descriptionEn, String storedPath, boolean uploaded, int version, List<FileHistoryEntry> histories) {
            this.id = id;
            this.fileName = fileName;
            this.categoryKo = categoryKo;
            this.categoryEn = categoryEn;
            this.extension = extension;
            this.sizeLabel = sizeLabel;
            this.status = status;
            this.visibility = visibility;
            this.linkedScreens = linkedScreens;
            this.downloadCount = downloadCount;
            this.retentionKo = retentionKo;
            this.retentionEn = retentionEn;
            this.securityGradeKo = securityGradeKo;
            this.securityGradeEn = securityGradeEn;
            this.ownerKo = ownerKo;
            this.ownerEn = ownerEn;
            this.updatedAt = updatedAt;
            this.updatedBy = updatedBy;
            this.descriptionKo = descriptionKo;
            this.descriptionEn = descriptionEn;
            this.storedPath = storedPath;
            this.uploaded = uploaded;
            this.version = version <= 0 ? 1 : version;
            this.histories = histories == null ? List.of() : List.copyOf(histories);
        }

        private FileItem withDownloadCount(int nextDownloadCount) {
            return new FileItem(id, fileName, categoryKo, categoryEn, extension, sizeLabel, status, visibility, linkedScreens,
                    nextDownloadCount, retentionKo, retentionEn, securityGradeKo, securityGradeEn, ownerKo, ownerEn,
                    updatedAt, updatedBy, descriptionKo, descriptionEn, storedPath, uploaded, version, histories);
        }

        private FileItem withAddedHistory(FileHistoryEntry history) {
            List<FileHistoryEntry> nextHistories = new ArrayList<>(histories);
            nextHistories.add(0, history);
            return new FileItem(id, fileName, categoryKo, categoryEn, extension, sizeLabel, status, visibility, linkedScreens,
                    downloadCount, retentionKo, retentionEn, securityGradeKo, securityGradeEn, ownerKo, ownerEn,
                    updatedAt, updatedBy, descriptionKo, descriptionEn, storedPath, uploaded, version, nextHistories);
        }
    }

    private static final class FileHistoryEntry {
        private final String at;
        private final String action;
        private final String actor;
        private final String message;

        private FileHistoryEntry(String at, String action, String actor, String message) {
            this.at = at;
            this.action = action;
            this.actor = actor;
            this.message = message;
        }
    }
}
