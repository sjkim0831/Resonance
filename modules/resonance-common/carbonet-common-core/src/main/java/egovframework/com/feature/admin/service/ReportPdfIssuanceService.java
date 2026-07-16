package egovframework.com.feature.admin.service;

import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
public class ReportPdfIssuanceService {

    private static final int PROFILE_COLUMNS = 48;
    private static final int PROFILE_ROWS = 68;
    private static final int MAX_HTML_BYTES = 12 * 1024 * 1024;
    private static final Duration RENDER_TIMEOUT = Duration.ofSeconds(45);

    private final ReportVerificationRegistryService registryService;

    @Value("${carbonet.report.chromium-bin:${CARBONET_CHROMIUM_BIN:/usr/bin/google-chrome}}")
    private String chromiumBin;

    public IssuedPdf issue(Map<String, Object> request, String actorId) {
        Object recordValue = request.get("record");
        if (!(recordValue instanceof Map<?, ?> rawRecord)) {
            throw new IllegalArgumentException("A report verification record is required.");
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> record = (Map<String, Object>) rawRecord;
        String html = String.valueOf(request.getOrDefault("html", ""));
        validateHtml(html);

        byte[] pdf = render(html);
        Map<String, Object> visualProfile = buildVisualProfile(pdf);
        registryService.issue(record, actorId);
        registryService.registerVisualProfile(Map.of(
                "certificateId", String.valueOf(record.get("certificateId")),
                "visualProfile", visualProfile
        ));
        return new IssuedPdf(pdf, String.valueOf(record.get("certificateId")),
                ((List<?>) visualProfile.get("pages")).size());
    }

    private void validateHtml(String html) {
        byte[] bytes = html.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 100 || bytes.length > MAX_HTML_BYTES) {
            throw new IllegalArgumentException("Report HTML is empty or too large.");
        }
        String lower = html.toLowerCase();
        for (String forbidden : List.of("<script", "<iframe", "<object", "<embed", "javascript:", " onload=", " onerror=")) {
            if (lower.contains(forbidden)) {
                throw new IllegalArgumentException("Unsafe report HTML was rejected.");
            }
        }
    }

    private byte[] render(String html) {
        Path tempDir = null;
        try {
            tempDir = Files.createTempDirectory("carbonet-report-");
            Path source = tempDir.resolve("report.html");
            Path output = tempDir.resolve("report.pdf");
            Path chromiumLog = tempDir.resolve("chromium.log");
            Files.writeString(source, html, StandardCharsets.UTF_8);
            Process process = new ProcessBuilder(
                    chromiumBin,
                    "--headless",
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--run-all-compositor-stages-before-draw",
                    "--virtual-time-budget=5000",
                    "--no-pdf-header-footer",
                    "--print-to-pdf-no-header",
                    "--print-to-pdf=" + output,
                    source.toUri().toString()
            ).redirectErrorStream(true).redirectOutput(chromiumLog.toFile()).start();
            boolean completed = process.waitFor(RENDER_TIMEOUT.toSeconds(), TimeUnit.SECONDS);
            if (!completed) {
                process.destroyForcibly();
                throw new IllegalStateException("PDF rendering timed out.");
            }
            String log = Files.exists(chromiumLog) ? Files.readString(chromiumLog, StandardCharsets.UTF_8) : "";
            if (process.exitValue() != 0 || !Files.isRegularFile(output) || Files.size(output) < 1_000) {
                throw new IllegalStateException("PDF rendering failed: " + log.substring(0, Math.min(log.length(), 800)));
            }
            return Files.readAllBytes(output);
        } catch (IOException exception) {
            throw new IllegalStateException("Chromium PDF renderer is unavailable.", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("PDF rendering was interrupted.", exception);
        } finally {
            deleteTree(tempDir);
        }
    }

    private Map<String, Object> buildVisualProfile(byte[] pdf) {
        try (PDDocument document = PDDocument.load(pdf)) {
            PDFRenderer renderer = new PDFRenderer(document);
            List<Map<String, Object>> pages = new ArrayList<>();
            for (int pageIndex = 0; pageIndex < document.getNumberOfPages(); pageIndex++) {
                BufferedImage source = renderer.renderImageWithDPI(pageIndex, 72, ImageType.GRAY);
                BufferedImage scaled = new BufferedImage(PROFILE_COLUMNS, PROFILE_ROWS, BufferedImage.TYPE_BYTE_GRAY);
                Graphics2D graphics = scaled.createGraphics();
                graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
                graphics.drawImage(source, 0, 0, PROFILE_COLUMNS, PROFILE_ROWS, null);
                graphics.dispose();
                List<Integer> values = new ArrayList<>(PROFILE_COLUMNS * PROFILE_ROWS);
                for (int y = 0; y < PROFILE_ROWS; y++) {
                    for (int x = 0; x < PROFILE_COLUMNS; x++) {
                        values.add(scaled.getRaster().getSample(x, y, 0));
                    }
                }
                pages.add(Map.of("values", values));
            }
            Map<String, Object> profile = new LinkedHashMap<>();
            profile.put("version", 1);
            profile.put("columns", PROFILE_COLUMNS);
            profile.put("rows", PROFILE_ROWS);
            profile.put("pages", pages);
            return profile;
        } catch (IOException exception) {
            throw new IllegalStateException("The issued PDF visual fingerprint could not be generated.", exception);
        }
    }

    private void deleteTree(Path root) {
        if (root == null) return;
        try (var paths = Files.walk(root)) {
            paths.sorted((left, right) -> right.compareTo(left)).forEach(path -> {
                try { Files.deleteIfExists(path); } catch (IOException ignored) { }
            });
        } catch (IOException ignored) { }
    }

    public record IssuedPdf(byte[] bytes, String certificateId, int pageCount) { }
}
