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
        EcoinventIntegrationService.ImportResult result = ecoinventIntegrationService.importRemoteDatasets(query);
        return ResponseEntity.ok(result.completed()
                ? "Sync completed for: " + query
                : "Sync paused by ecoinvent API rate limit. Saved: " + result.importedCount());
    }

    @GetMapping({
            "/admin/emission/ecoinvent/api/datasets",
            "/en/admin/emission/ecoinvent/api/datasets",
            "/admin/api/admin/emission/ecoinvent/datasets",
            "/en/admin/api/admin/emission/ecoinvent/datasets"
    })
    public ResponseEntity<Map<String, Object>> datasets(@RequestParam Map<String, String> params) {
        EcoinventIntegrationService.DatasetPage page = booleanValue(params.get("remote"))
                ? ecoinventIntegrationService.searchRemoteDatasetPage(params)
                : ecoinventIntegrationService.listLocalDatasetPage(params);
        return ResponseEntity.ok(success(page.rows(), page.totalCount() + "건 중 "
                + page.rows().size() + "건을 불러왔습니다.", page));
    }

    @GetMapping({
            "/admin/emission/ecoinvent/api/filter-options",
            "/en/admin/emission/ecoinvent/api/filter-options",
            "/admin/api/admin/emission/ecoinvent/filter-options",
            "/en/admin/api/admin/emission/ecoinvent/filter-options"
    })
    public ResponseEntity<Map<String, Object>> filterOptions(@RequestParam(required = false) String keyword) {
        Map<String, Object> options = ecoinventIntegrationService.filterOptions(keyword);
        return ResponseEntity.ok(success(options, "검색 필터 후보를 불러왔습니다.", options.size()));
    }

    @PostMapping({
            "/admin/emission/ecoinvent/api/import",
            "/en/admin/emission/ecoinvent/api/import",
            "/admin/api/admin/emission/ecoinvent/import",
            "/en/admin/api/admin/emission/ecoinvent/import"
    })
    public ResponseEntity<Map<String, Object>> importSelected(@RequestBody Map<String, Object> payload) {
        List<Long> datasetIds = extractLongList(payload.get("datasetIds"));
        int count = ecoinventIntegrationService.importSelectedDatasets(datasetIds);
        return ResponseEntity.ok(success(null, count + "건을 저장했습니다.", count));
    }

    @PostMapping({
            "/admin/emission/ecoinvent/api/import-all",
            "/en/admin/emission/ecoinvent/api/import-all",
            "/admin/api/admin/emission/ecoinvent/import-all",
            "/en/admin/api/admin/emission/ecoinvent/import-all"
    })
    public ResponseEntity<Map<String, Object>> importAll(@RequestBody Map<String, Object> payload) {
        EcoinventIntegrationService.ImportResult result = ecoinventIntegrationService.importRemoteDatasets(
                String.valueOf(payload.getOrDefault("keyword", "")));
        String message = result.completed()
                ? result.importedCount() + "건을 저장했습니다."
                : result.importedCount() + "건까지 저장했고 ecoinvent 시간당 호출 제한으로 멈췄습니다. 잠시 후 다시 실행하면 이미 저장된 데이터는 건너뛰고 이어받습니다.";
        Map<String, Object> response = success(null, message, result.importedCount());
        response.put("completed", result.completed());
        response.put("rateLimited", result.rateLimited());
        return ResponseEntity.ok(response);
    }

    @PostMapping({
            "/admin/emission/ecoinvent/api/premap-korean",
            "/en/admin/emission/ecoinvent/api/premap-korean",
            "/admin/api/admin/emission/ecoinvent/premap-korean",
            "/en/admin/api/admin/emission/ecoinvent/premap-korean"
    })
    public ResponseEntity<Map<String, Object>> premapKorean() {
        EcoinventIntegrationService.AutoMappingResult result = ecoinventIntegrationService.premapKoreanMaterialAliases();
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("datasetCount", result.datasetCount());
        data.put("aliasCount", result.aliasCount());
        data.put("insertedCount", result.insertedCount());
        data.put("expectedInputCount", result.expectedInputCount());
        data.put("aiAssistedCount", result.aiAssistedCount());
        data.put("rowTranslationCount", result.rowTranslationCount());
        return ResponseEntity.ok(success(data,
                "ecoinvent 저장 데이터 " + result.datasetCount()
                        + "건에서 한글 alias/예상 입력 " + result.aliasCount()
                        + "건을 확인했고 사전 보조 " + result.aiAssistedCount()
                        + "건을 포함해 신규 선매핑 " + result.insertedCount()
                        + "건, 행 단위 정확명 " + result.rowTranslationCount() + "건을 저장했습니다.",
                result.rowTranslationCount()));
    }

    @PostMapping({
            "/admin/emission/ecoinvent/api/backfill-translations",
            "/en/admin/emission/ecoinvent/api/backfill-translations",
            "/admin/api/admin/emission/ecoinvent/backfill-translations",
            "/en/admin/api/admin/emission/ecoinvent/backfill-translations"
    })
    public ResponseEntity<Map<String, Object>> backfillTranslations() {
        int count = ecoinventIntegrationService.backfillEcoinventMaterialTranslations();
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("rowTranslationCount", count);
        return ResponseEntity.ok(success(data, "ecoinvent 행 단위 한글/영문 정확명 " + count + "건을 저장했습니다.", count));
    }

    @PostMapping({
            "/admin/emission/ecoinvent/api/mappings",
            "/en/admin/emission/ecoinvent/api/mappings",
            "/admin/api/admin/emission/ecoinvent/mappings",
            "/en/admin/api/admin/emission/ecoinvent/mappings"
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

    @GetMapping({
            "/admin/emission/survey-admin/api/chemical-materials",
            "/en/admin/emission/survey-admin/api/chemical-materials"
    })
    public ResponseEntity<Map<String, Object>> chemicalMaterials(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false, defaultValue = "ko") String language) {
        List<Map<String, Object>> rows = ecoinventIntegrationService.searchChemicalMaterials(keyword, language);
        return ResponseEntity.ok(success(rows, "화학물질정보시스템 우선 후보 " + rows.size() + "건을 불러왔습니다."));
    }

    @GetMapping({
            "/admin/emission/survey-admin/api/ecoinvent-recommendations",
            "/en/admin/emission/survey-admin/api/ecoinvent-recommendations"
    })
    public ResponseEntity<Map<String, Object>> recommendations(@RequestParam Map<String, String> params) {
        String materialName = params.getOrDefault("materialName", "");
        EcoinventIntegrationService.DatasetPage page = ecoinventIntegrationService.recommendMappedDatasetPage(materialName, params);
        return ResponseEntity.ok(success(page.rows(), page.totalCount() + "건 중 "
                + page.rows().size() + "건을 불러왔습니다.", page));
    }

    @GetMapping({
            "/admin/emission/survey-admin/api/ecoinvent-ai-recommendations",
            "/en/admin/emission/survey-admin/api/ecoinvent-ai-recommendations"
    })
    public ResponseEntity<Map<String, Object>> aiRecommendations(@RequestParam Map<String, String> params) {
        String materialName = params.getOrDefault("materialName", "");
        EcoinventIntegrationService.DatasetPage page = ecoinventIntegrationService.recommendAiDatasetPage(materialName, params);
        return ResponseEntity.ok(success(page.rows(), "AI 추천 후보 "
                + page.rows().size() + "건을 불러왔습니다.", page));
    }

    @PostMapping({
            "/admin/emission/survey-admin/api/material-english-names",
            "/en/admin/emission/survey-admin/api/material-english-names"
    })
    public ResponseEntity<Map<String, Object>> materialEnglishNames(@RequestBody Map<String, Object> payload) {
        Object rawNames = payload.get("materialNames");
        List<String> materialNames = rawNames instanceof List<?> list
                ? list.stream().map(String::valueOf).toList()
                : List.of();
        Map<String, String> rows = ecoinventIntegrationService.materialEnglishNames(materialNames);
        return ResponseEntity.ok(success(rows, "영문 물질명 사전 " + rows.size() + "건을 불러왔습니다.", rows.size()));
    }

    private Map<String, Object> success(Object data, String message) {
        return success(data, message, data instanceof List<?> list ? list.size() : 0);
    }

    private Map<String, Object> success(Object data, String message, int count) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("message", message);
        response.put("data", data);
        response.put("count", count);
        return response;
    }

    private Map<String, Object> success(Object data, String message, EcoinventIntegrationService.DatasetPage page) {
        Map<String, Object> response = success(data, message, page.rows().size());
        response.put("totalCount", page.totalCount());
        response.put("totalPages", page.totalPages());
        response.put("pageIndex", page.pageIndex());
        response.put("pageSize", page.pageSize());
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

    private boolean booleanValue(String value) {
        String normalized = String.valueOf(value).trim();
        return "true".equalsIgnoreCase(normalized)
                || "1".equals(normalized)
                || "Y".equalsIgnoreCase(normalized);
    }

}
