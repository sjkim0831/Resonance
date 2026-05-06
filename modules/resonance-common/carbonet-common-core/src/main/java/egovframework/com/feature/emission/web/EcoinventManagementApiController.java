package egovframework.com.feature.emission.web;

import egovframework.com.feature.emission.service.EcoinventIntegrationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class EcoinventManagementApiController {

    private final EcoinventIntegrationService ecoinventIntegrationService;

    @PostMapping("/admin/api/emission/ecoinvent/sync")
    public ResponseEntity<String> syncData(@RequestParam String query) {
        ecoinventIntegrationService.syncEcoinventData(query);
        return ResponseEntity.ok("Sync completed for: " + query);
    }

    @GetMapping({
            "/admin/emission/ecoinvent/api/datasets",
            "/en/admin/emission/ecoinvent/api/datasets"
    })
    public ResponseEntity<Map<String, Object>> datasets(@RequestParam(required = false) String keyword,
                                                        @RequestParam(defaultValue = "false") boolean remote) {
        List<Map<String, Object>> rows = remote
                ? ecoinventIntegrationService.searchRemoteDatasets(keyword)
                : ecoinventIntegrationService.listLocalDatasets(keyword);
        return ResponseEntity.ok(success(rows, rows.size() + "건을 불러왔습니다."));
    }

    @PostMapping({
            "/admin/emission/ecoinvent/api/import",
            "/en/admin/emission/ecoinvent/api/import"
    })
    public ResponseEntity<Map<String, Object>> importSelected(@RequestBody Map<String, Object> payload) {
        List<Long> datasetIds = extractLongList(payload.get("datasetIds"));
        int count = ecoinventIntegrationService.importSelectedDatasets(datasetIds);
        return ResponseEntity.ok(success(null, count + "건을 저장했습니다."));
    }

    @PostMapping({
            "/admin/emission/ecoinvent/api/import-all",
            "/en/admin/emission/ecoinvent/api/import-all"
    })
    public ResponseEntity<Map<String, Object>> importAll(@RequestBody Map<String, Object> payload) {
        int count = ecoinventIntegrationService.importRemoteDatasets(String.valueOf(payload.getOrDefault("keyword", "")));
        return ResponseEntity.ok(success(null, count + "건을 저장했습니다."));
    }

    @PostMapping({
            "/admin/emission/ecoinvent/api/mappings",
            "/en/admin/emission/ecoinvent/api/mappings"
    })
    public ResponseEntity<Map<String, Object>> saveMapping(@RequestBody Map<String, Object> payload) {
        ecoinventIntegrationService.saveMapping(
                String.valueOf(payload.getOrDefault("koreanName", "")),
                longValue(payload.get("datasetId"), 0L),
                String.valueOf(payload.getOrDefault("memo", "")));
        return ResponseEntity.ok(success(null, "한글 물질명 매핑을 저장했습니다."));
    }

    @GetMapping({
            "/admin/emission/survey-admin/api/ecoinvent-factors",
            "/en/admin/emission/survey-admin/api/ecoinvent-factors"
    })
    public ResponseEntity<Map<String, Object>> mappedFactors(@RequestParam(required = false) String materialName) {
        List<Map<String, Object>> rows = ecoinventIntegrationService.findMappedFactors(materialName);
        return ResponseEntity.ok(success(rows, rows.size() + "건을 불러왔습니다."));
    }

    private Map<String, Object> success(Object data, String message) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("message", message);
        response.put("data", data);
        response.put("count", data instanceof List<?> list ? list.size() : 0);
        return response;
    }

    private List<Long> extractLongList(Object value) {
        if (!(value instanceof List<?> values)) {
            return List.of();
        }
        return values.stream().map(item -> longValue(item, 0L)).filter(item -> item > 0).toList();
    }

    private long longValue(Object value, long fallback) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (Exception ignored) {
            return fallback;
        }
    }
}
