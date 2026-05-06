package egovframework.com.feature.emission.service;

import egovframework.com.feature.emission.domain.entity.EmissionMappingLog;
import egovframework.com.feature.emission.domain.entity.EcoinventMaster;
import egovframework.com.feature.emission.domain.repository.EmissionMappingLogRepository;
import egovframework.com.feature.emission.domain.repository.EcoinventMasterRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class EcoinventIntegrationService {

    private final EcoinventMasterRepository repository;
    private final EmissionMappingLogRepository mappingLogRepository;

    @Value("${CARBONET.ECOINVENT.CLIENT_ID:${CARBONET_ECOINVENT_CLIENT_ID:}}")
    private String clientId;

    @Value("${CARBONET.ECOINVENT.CLIENT_SECRET:${CARBONET_ECOINVENT_CLIENT_SECRET:}}")
    private String clientSecret;

    @Value("${carbonet.ecoinvent.search-url-template:https://api.ecoinvent.org/v0/datasets?query=__QUERY__&from=0&limit=100&version=latest&system_model=cutoff}")
    private String searchUrlTemplate;

    @Value("${CARBONET_ECOINVENT_TOKEN_URL:https://sso.ecoinvent.org/realms/ecoinvent/protocol/openid-connect/token}")
    private String tokenUrl;

    @Value("${CARBONET_ECOINVENT_BATCH_URL:https://api.ecoinvent.org/v0/datasets/batch?version=latest&system_model=cutoff}")
    private String batchUrl;

    @Value("${CARBONET_ECOINVENT_INDICATOR_IDS:}")
    private String indicatorIds;

    private String cachedAccessToken;
    private Instant cachedAccessTokenExpiresAt = Instant.EPOCH;

    @Transactional
    public void syncEcoinventData(String query) {
        importRemoteDatasets(query);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listLocalDatasets(String keyword) {
        String resolvedKeyword = safe(keyword);
        List<EcoinventMaster> rows = resolvedKeyword.isEmpty()
                ? repository.findTop100ByOrderByMaterialNameAsc()
                : repository.findTop100ByMaterialNameContainingIgnoreCaseOrderByMaterialNameAsc(resolvedKeyword);
        return rows.stream().map(this::toDatasetRow).toList();
    }

    public List<Map<String, Object>> searchRemoteDatasets(String keyword) {
        RestTemplate restTemplate = new RestTemplate();
        String encodedQuery = UriUtils.encodeQueryParam(safe(keyword), StandardCharsets.UTF_8);
        String url = searchUrlTemplate
                .replace("__QUERY__", encodedQuery)
                .replace("{query}", encodedQuery);
        ResponseEntity<Map> responseEntity = restTemplate.exchange(url, HttpMethod.GET, authorizedEntity(), Map.class);
        Map<String, Object> response = responseEntity.getBody();
        Object results = response == null ? null : response.get("results");
        if (!(results instanceof List<?> resultList)) {
            return List.of();
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Object item : resultList) {
            if (item instanceof Map<?, ?> dataset) {
                rows.add(toDatasetRow(dataset));
            }
        }
        return rows;
    }

    @Transactional
    public int importRemoteDatasets(String keyword) {
        List<Map<String, Object>> remoteRows = searchRemoteDatasets(keyword);
        for (Map<String, Object> row : remoteRows) {
            saveDatasetRow(row);
        }
        return remoteRows.size();
    }

    @Transactional
    public int importSelectedDatasets(List<Long> datasetIds) {
        if (datasetIds == null || datasetIds.isEmpty()) {
            return 0;
        }
        List<Map<String, Object>> remoteRows = fetchRemoteDatasetBatch(datasetIds);
        for (Map<String, Object> row : remoteRows) {
            saveDatasetRow(row);
        }
        return remoteRows.size();
    }

    @Transactional
    public void saveMapping(String koreanName, Long datasetId, String memo) {
        EcoinventMaster master = repository.findById(datasetId)
                .orElseThrow(() -> new IllegalArgumentException("선택한 ecoinvent 데이터셋을 찾을 수 없습니다."));
        EmissionMappingLog mapping = new EmissionMappingLog();
        mapping.setRawMaterialName(safe(koreanName));
        mapping.setMappedMaterial(master);
        mapping.setNote(safe(memo));
        mappingLogRepository.save(mapping);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> findMappedFactors(String materialName) {
        String keyword = safe(materialName);
        if (keyword.isEmpty()) {
            return List.of();
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        for (EmissionMappingLog mapping : mappingLogRepository.findTop100ByRawMaterialNameIgnoreCaseOrderByIdDesc(keyword)) {
            if (mapping.getMappedMaterial() != null) {
                rows.add(toDatasetRow(mapping.getMappedMaterial(), mapping.getRawMaterialName()));
            }
        }
        if (rows.isEmpty()) {
            for (EmissionMappingLog mapping : mappingLogRepository.findTop100ByRawMaterialNameContainingIgnoreCaseOrderByIdDesc(keyword)) {
                if (mapping.getMappedMaterial() != null) {
                    rows.add(toDatasetRow(mapping.getMappedMaterial(), mapping.getRawMaterialName()));
                }
            }
        }
        if (rows.isEmpty()) {
            return repository.findTop100ByMaterialNameContainingIgnoreCaseOrderByMaterialNameAsc(keyword)
                    .stream()
                    .map(this::toDatasetRow)
                    .toList();
        }
        return rows;
    }

    private List<Map<String, Object>> fetchRemoteDatasetBatch(List<Long> datasetIds) {
        RestTemplate restTemplate = new RestTemplate();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("dataset_ids", datasetIds);
        List<Long> resolvedIndicatorIds = parseIndicatorIds();
        if (!resolvedIndicatorIds.isEmpty()) {
            body.put("indicator_ids", resolvedIndicatorIds);
        }
        HttpHeaders headers = authorizedHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        Map<String, Object> response = restTemplate.postForObject(batchUrl, new HttpEntity<>(body, headers), Map.class);
        Object datasets = response == null ? null : response.get("datasets");
        if (!(datasets instanceof List<?> datasetList)) {
            return List.of();
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Object item : datasetList) {
            if (item instanceof Map<?, ?> dataset) {
                rows.add(toDatasetRow(dataset));
            }
        }
        return rows;
    }

    private void saveDatasetRow(Map<String, Object> row) {
        String materialName = firstNonBlank(row.get("activityName"), row.get("productName"), row.get("materialName"));
        if (materialName.isEmpty()) {
            return;
        }
        EcoinventMaster master = new EcoinventMaster();
        master.setMaterialName(materialName);
        master.setImpactScore(doubleValue(row.get("score")));
        master.setUnit(firstNonBlank(row.get("referenceProductUnit"), row.get("unit"), "kg CO2 eq"));
        master.setVersion(firstNonBlank(row.get("version"), "latest"));
        repository.save(master);
    }

    private HttpEntity<String> authorizedEntity() {
        return new HttpEntity<>(authorizedHeaders());
    }

    private HttpHeaders authorizedHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(resolveAccessToken());
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        return headers;
    }

    private synchronized String resolveAccessToken() {
        if (cachedAccessToken != null && Instant.now().isBefore(cachedAccessTokenExpiresAt.minusSeconds(30))) {
            return cachedAccessToken;
        }
        if (safe(clientId).isEmpty() || safe(clientSecret).isEmpty()) {
            throw new IllegalStateException("ecoinvent API 인증 정보가 설정되지 않았습니다.");
        }
        RestTemplate restTemplate = new RestTemplate();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("grant_type", "client_credentials");
        body.add("client_id", clientId);
        body.add("client_secret", clientSecret);
        Map<String, Object> response = restTemplate.postForObject(tokenUrl, new HttpEntity<>(body, headers), Map.class);
        cachedAccessToken = Objects.toString(response == null ? "" : response.get("access_token"), "");
        long expiresIn = longValue(response == null ? null : response.get("expires_in"), 3600L);
        cachedAccessTokenExpiresAt = Instant.now().plusSeconds(expiresIn);
        if (cachedAccessToken.isEmpty()) {
            throw new IllegalStateException("ecoinvent API access token 발급에 실패했습니다.");
        }
        return cachedAccessToken;
    }

    private Map<String, Object> toDatasetRow(EcoinventMaster master) {
        return toDatasetRow(master, "");
    }

    private Map<String, Object> toDatasetRow(EcoinventMaster master, String koreanName) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("datasetId", master.getId());
        row.put("activityName", master.getMaterialName());
        row.put("productName", master.getMaterialName());
        row.put("geography", "");
        row.put("referenceProductUnit", master.getUnit());
        row.put("indicatorName", "Stored emission factor");
        row.put("score", master.getImpactScore());
        row.put("unit", master.getUnit());
        row.put("version", master.getVersion());
        row.put("koreanName", koreanName);
        return row;
    }

    private Map<String, Object> toDatasetRow(Map<?, ?> dataset) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("datasetId", longValue(firstValue(dataset, "id", "dataset_id"), 0L));
        row.put("activityName", firstNonBlank(firstValue(dataset, "activity", "activityName"), ""));
        row.put("productName", firstNonBlank(firstValue(dataset, "product", "productName"), ""));
        row.put("geography", firstNonBlank(firstValue(dataset, "geography"), ""));
        row.put("referenceProductUnit", firstNonBlank(firstValue(dataset, "unit", "referenceProductUnit"), ""));
        row.put("indicatorId", firstScoreValue(dataset, "indicator_id", "indicatorId"));
        row.put("indicatorName", firstNonBlank(firstScoreValue(dataset, "indicator", "indicator_name", "indicatorName"), ""));
        row.put("score", doubleValue(firstScoreValue(dataset, "score", "amount", "value")));
        row.put("unit", firstNonBlank(firstScoreValue(dataset, "unit", "unit_name", "unitName"), firstValue(dataset, "unit"), ""));
        row.put("version", firstNonBlank(firstValue(dataset, "version"), "latest"));
        return row;
    }

    private Object firstScoreValue(Map<?, ?> dataset, String... keys) {
        Object scores = firstValue(dataset, "impact_scores", "impactScores");
        if (scores instanceof List<?> scoreList && !scoreList.isEmpty() && scoreList.get(0) instanceof Map<?, ?> score) {
            return firstValue(score, keys);
        }
        return null;
    }

    private Object firstValue(Map<?, ?> row, String... keys) {
        for (String key : keys) {
            Object value = row.get(key);
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private List<Long> parseIndicatorIds() {
        List<Long> ids = new ArrayList<>();
        for (String token : safe(indicatorIds).split(",")) {
            String trimmed = token.trim();
            if (!trimmed.isEmpty()) {
                ids.add(longValue(trimmed, 0L));
            }
        }
        return ids.stream().filter(id -> id > 0).toList();
    }

    private String firstNonBlank(Object... values) {
        for (Object value : values) {
            String text = safeObject(value);
            if (!text.isEmpty()) {
                return text;
            }
        }
        return "";
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String safeObject(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private double doubleValue(Object value) {
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        try {
            return Double.parseDouble(safeObject(value).replace(",", ""));
        } catch (Exception ignored) {
            return 0.0;
        }
    }

    private long longValue(Object value, long fallback) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            return Long.parseLong(safeObject(value).replace(",", ""));
        } catch (Exception ignored) {
            return fallback;
        }
    }
}
