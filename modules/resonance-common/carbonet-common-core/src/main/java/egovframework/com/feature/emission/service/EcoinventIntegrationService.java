package egovframework.com.feature.emission.service;

import egovframework.com.feature.emission.domain.entity.EmissionMappingLog;
import egovframework.com.feature.emission.domain.entity.EcoinventMaster;
import egovframework.com.feature.emission.domain.repository.EmissionMappingLogRepository;
import egovframework.com.feature.emission.domain.repository.EcoinventMasterRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class EcoinventIntegrationService {

    private static final int SEARCH_PAGE_SIZE = 100;
    private static final int BATCH_IMPORT_SIZE = 100;
    private static final String MATERIAL_TRANSLATION_TABLE = "emission_material_translation";
    private static final String CHEMICAL_DICTIONARY_TABLE = "emission_chemical_material_dictionary";
    private static final PageRequest MAPPING_RECOMMENDATION_LIMIT = PageRequest.of(0, 100);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final EcoinventMasterRepository repository;
    private final EmissionMappingLogRepository mappingLogRepository;

    @PersistenceContext
    private EntityManager entityManager;

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

    @Value("${CARBONET_AI_RECOMMENDATION_ENABLED:${carbonet.ai.recommendation.enabled:false}}")
    private boolean aiRecommendationEnabled;

    @Value("${CARBONET_AI_OLLAMA_BASE_URL:${carbonet.ai.ollama.base-url:http://127.0.0.1:11434}}")
    private String ollamaBaseUrl;

    @Value("${CARBONET_AI_OLLAMA_MODEL:${carbonet.ai.ollama.model:qwen3:0.6b}}")
    private String ollamaModel;

    private String cachedAccessToken;
    private Instant cachedAccessTokenExpiresAt = Instant.EPOCH;
    private boolean ecoinventTablesReady;
    private boolean materialTranslationTableReady;
    private boolean chemicalDictionaryTableReady;

    @Transactional
    public void syncEcoinventData(String query) {
        ensureEcoinventTablesReady();
        importRemoteDatasets(query);
    }

    @Transactional
    public List<Map<String, Object>> listLocalDatasets(String keyword) {
        return listLocalDatasetPage(Map.of("keyword", safe(keyword))).rows();
    }

    @Transactional
    public DatasetPage listLocalDatasetPage(Map<String, String> params) {
        ensureEcoinventTablesReady();
        ensureMaterialTranslationTableReady();
        SearchRequest request = SearchRequest.from(params);
        if (!request.keyword().isEmpty() && containsKorean(request.keyword())) {
            return listLocalKoreanDatasetPage(request);
        }
        List<Long> matchedIds = findEcoinventIdsByTranslationKeyword(request.keyword());
        QueryParts queryParts = buildLocalSearchQuery(request, matchedIds, false);
        TypedQuery<EcoinventMaster> query = entityManager.createQuery(queryParts.jpql(), EcoinventMaster.class);
        queryParts.parameters().forEach(query::setParameter);
        query.setFirstResult(request.offset());
        query.setMaxResults(request.pageSize());
        List<Map<String, Object>> rows = query.getResultList().stream().map(this::toDatasetRow).toList();
        if (request.sortField().isEmpty()) {
            rows = prioritizeMappedRows(rows);
        }
        if (!request.keyword().isEmpty() && request.sortField().isEmpty() && !containsKorean(request.keyword())) {
            rows = mergeDatasetRows(findMappedFactors(request.keyword()), rows);
        }

        QueryParts countParts = buildLocalSearchQuery(request, matchedIds, true);
        TypedQuery<Long> countQuery = entityManager.createQuery(countParts.jpql(), Long.class);
        countParts.parameters().forEach(countQuery::setParameter);
        long totalCount = countQuery.getSingleResult();
        if (!request.keyword().isEmpty()) {
            totalCount = Math.max(totalCount, rows.size());
        }
        return new DatasetPage(rows, totalCount, request.pageIndex(), request.pageSize());
    }

    private DatasetPage listLocalKoreanDatasetPage(SearchRequest request) {
        List<Long> matchedIds = findEcoinventIdsByTranslationKeyword(request.keyword());
        if (matchedIds.isEmpty()) {
            return new DatasetPage(List.of(), 0L, request.pageIndex(), request.pageSize());
        }
        Map<Long, Integer> relevanceOrder = new LinkedHashMap<>();
        for (int index = 0; index < matchedIds.size(); index++) {
            relevanceOrder.putIfAbsent(matchedIds.get(index), index);
        }
        List<Map<String, Object>> allRows = repository.findAllById(relevanceOrder.keySet()).stream()
                .filter(master -> request.minScore() == null
                        || (master.getImpactScore() != null && master.getImpactScore() >= request.minScore()))
                .filter(master -> request.maxScore() == null
                        || (master.getImpactScore() != null && master.getImpactScore() <= request.maxScore()))
                .sorted((left, right) -> {
                    int relevanceCompare = Integer.compare(
                            relevanceOrder.getOrDefault(left.getId(), Integer.MAX_VALUE),
                            relevanceOrder.getOrDefault(right.getId(), Integer.MAX_VALUE));
                    if (relevanceCompare != 0) {
                        return relevanceCompare;
                    }
                    int geographyCompare = Integer.compare(geographyRank(left.getGeography()), geographyRank(right.getGeography()));
                    if (geographyCompare != 0) {
                        return geographyCompare;
                    }
                    return safe(left.getProductName()).compareToIgnoreCase(safe(right.getProductName()));
                })
                .map(this::toDatasetRow)
                .toList();
        int fromIndex = Math.min(request.offset(), allRows.size());
        int toIndex = Math.min(fromIndex + request.pageSize(), allRows.size());
        return new DatasetPage(allRows.subList(fromIndex, toIndex), allRows.size(), request.pageIndex(), request.pageSize());
    }

    public DatasetPage searchRemoteDatasetPage(Map<String, String> params) {
        SearchRequest request = SearchRequest.from(params);
        SearchPage page = fetchRemoteDatasetPage(request.keyword(), request.offset(), request.pageSize());
        List<Map<String, Object>> rows = enrichRemoteRowsWithScores(page.rows());
        return new DatasetPage(rows, page.total(), request.pageIndex(), request.pageSize());
    }

    @Transactional
    public Map<String, Object> filterOptions(String keyword) {
        ensureEcoinventTablesReady();
        SearchRequest request = SearchRequest.from(Map.of("keyword", safe(keyword)));
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("koreanName", distinctTranslationOptions("korean_name", request.keyword(), 30000));
        response.put("englishName", distinctTranslationOptions("english_exact_name", request.keyword(), 30000));
        response.put("score", distinctNumberOptions("impactScore", request.keyword(), 30000));
        response.put("indicatorId", distinctNumberOptions("indicatorId", request.keyword(), 30000));
        for (Map.Entry<String, String> entry : FILTERABLE_FIELDS.entrySet()) {
            response.put(entry.getKey(), distinctOptions(entry.getValue(), request.keyword(), 30000));
        }
        return response;
    }

    private SearchPage fetchRemoteDatasetPage(String keyword, int offset, int limit) {
        RestTemplate restTemplate = new RestTemplate();
        String encodedQuery = UriUtils.encodeQueryParam(safe(keyword), StandardCharsets.UTF_8);
        String url = buildSearchUrl(encodedQuery, offset, limit);
        ResponseEntity<Map> responseEntity = restTemplate.exchange(url, HttpMethod.GET, authorizedEntity(), Map.class);
        Map<String, Object> response = responseEntity.getBody();
        Object results = response == null ? null : response.get("results");
        if (!(results instanceof List<?> resultList)) {
            return new SearchPage(List.of(), 0L);
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Object item : resultList) {
            if (item instanceof Map<?, ?> dataset) {
                rows.add(toDatasetRow(dataset, false));
            }
        }
        long total = longValue(response.get("total"), rows.size());
        return new SearchPage(rows, total);
    }

    public ImportResult importRemoteDatasets(String keyword) {
        ensureEcoinventTablesReady();
        int importedCount = 0;
        int offset = 0;
        long total = Long.MAX_VALUE;
        while (offset < total) {
            SearchPage page;
            try {
                page = fetchRemoteDatasetPage(keyword, offset, SEARCH_PAGE_SIZE);
            } catch (HttpClientErrorException.TooManyRequests exception) {
                return new ImportResult(importedCount, false, true);
            }
            if (page.rows().isEmpty()) {
                break;
            }
            updateExistingDatasetMetadata(page.rows());
            List<Long> datasetIds = page.rows().stream()
                    .map(row -> longValue(row.get("datasetId"), 0L))
                    .filter(id -> id > 0L)
                    .distinct()
                    .toList();
            List<Long> detailDatasetIds = filterMissingDatasetIds(datasetIds);
            ImportResult detailResult = importDatasetDetails(detailDatasetIds);
            importedCount += detailResult.importedCount();
            if (!detailResult.completed()) {
                return new ImportResult(importedCount, false, detailResult.rateLimited());
            }
            total = page.total() > 0L ? page.total() : offset + page.rows().size();
            offset += page.rows().size();
        }
        return new ImportResult(importedCount, true, false);
    }

    @Transactional
    public int importSelectedDatasets(List<Long> datasetIds) {
        ensureEcoinventTablesReady();
        if (datasetIds == null || datasetIds.isEmpty()) {
            return 0;
        }
        int importedCount = 0;
        List<Long> detailDatasetIds = filterMissingDatasetIds(datasetIds.stream().distinct().toList());
        ImportResult detailResult = importDatasetDetails(detailDatasetIds);
        importedCount += detailResult.importedCount();
        return importedCount;
    }

    private ImportResult importDatasetDetails(List<Long> detailDatasetIds) {
        int importedCount = 0;
        for (int index = 0; index < detailDatasetIds.size(); index += BATCH_IMPORT_SIZE) {
            int endExclusive = Math.min(index + BATCH_IMPORT_SIZE, detailDatasetIds.size());
            List<Map<String, Object>> batchRows;
            try {
                batchRows = fetchRemoteDatasetBatch(detailDatasetIds.subList(index, endExclusive));
            } catch (HttpClientErrorException.TooManyRequests exception) {
                return new ImportResult(importedCount, false, true);
            }
            importedCount += saveDatasetRows(batchRows);
        }
        return new ImportResult(importedCount, true, false);
    }

    @Transactional
    public void saveMapping(String koreanName, Long datasetId, String memo) {
        ensureEcoinventTablesReady();
        EcoinventMaster master = repository.findById(datasetId).orElse(null);
        if (master == null && datasetId != null && datasetId > 0L) {
            importSelectedDatasets(List.of(datasetId));
            master = repository.findById(datasetId).orElse(null);
        }
        if (master == null) {
            throw new IllegalArgumentException("선택한 ecoinvent 데이터셋을 찾을 수 없습니다.");
        }
        saveMappingIfAbsent(safe(koreanName), master, safe(memo));
        String englishName = firstNonBlank(master.getProductName(), master.getMaterialName(), master.getActivityName());
        if (!safe(koreanName).isBlank() && !englishName.isBlank()) {
            ensureMaterialTranslationTableReady();
            saveMaterialEnglishName(safe(koreanName), englishName, "USER_MAPPING");
        }
    }

    @Transactional
    public AutoMappingResult premapKoreanMaterialAliases() {
        ensureEcoinventTablesReady();
        ensureMaterialTranslationTableReady();
        int datasetCount = 0;
        int aliasCount = 0;
        int insertedCount = 0;
        int expectedInputCount = 0;
        int aiAssistedCount = 0;
        for (EcoinventMaster master : repository.findAll()) {
            datasetCount += 1;
            LinkedHashSet<String> aliases = koreanAliasesFor(master);
            String englishName = firstNonBlank(master.getProductName(), master.getMaterialName(), master.getActivityName());
            for (String alias : aliases) {
                if (alias.isBlank() || !containsKorean(alias)) {
                    continue;
                }
                aliasCount += 1;
                if (saveMappingIfAbsent(alias, master, "auto premap from ecoinvent product/activity")) {
                    insertedCount += 1;
                }
                if (!englishName.isBlank() && !containsKorean(englishName) && findMaterialEnglishName(alias).isBlank()) {
                    saveMaterialEnglishName(alias, englishName, "AUTO_ECOINVENT_PREMAP");
                }
            }
        }
        for (Map.Entry<String, List<String>> entry : expectedKoreanMaterialInputs().entrySet()) {
            String koreanName = safe(entry.getKey());
            if (koreanName.isBlank()) {
                continue;
            }
            expectedInputCount += 1;
            LinkedHashSet<String> searchTerms = new LinkedHashSet<>(entry.getValue());
            List<String> aiTerms = aiSearchTerms(koreanName);
            if (!aiTerms.isEmpty()) {
                aiAssistedCount += 1;
                searchTerms.addAll(aiTerms);
            }
            int savedForInput = premapKoreanInput(koreanName, searchTerms);
            insertedCount += savedForInput;
            aliasCount += searchTerms.size();
        }
        int rowTranslationCount = backfillEcoinventMaterialTranslations();
        return new AutoMappingResult(datasetCount, aliasCount, insertedCount, expectedInputCount, aiAssistedCount, rowTranslationCount);
    }

    @Transactional
    public int backfillEcoinventMaterialTranslations() {
        ensureEcoinventTablesReady();
        ensureMaterialTranslationTableReady();
        int upsertedCount = 0;
        for (EcoinventMaster master : repository.findAll()) {
            if (upsertEcoinventMaterialTranslation(master)) {
                upsertedCount += 1;
            }
        }
        return upsertedCount;
    }

    private int premapKoreanInput(String koreanName, Set<String> searchTerms) {
        int insertedCount = 0;
        int mappedCount = 0;
        for (String term : searchTerms) {
            String normalizedTerm = safe(term);
            if (normalizedTerm.isBlank() || containsKorean(normalizedTerm)) {
                continue;
            }
            DatasetPage page = listLocalDatasetPage(Map.of(
                    "keyword", normalizedTerm,
                    "pageIndex", "1",
                    "pageSize", "20"
            ));
            for (Map<String, Object> row : page.rows()) {
                Long datasetId = longValue(row.get("datasetId"), 0L);
                if (datasetId <= 0L) {
                    continue;
                }
                EcoinventMaster master = repository.findById(datasetId).orElse(null);
                if (master == null) {
                    continue;
                }
                if (saveMappingIfAbsent(koreanName, master, "auto expected-input premap: " + normalizedTerm)) {
                    insertedCount += 1;
                }
                String englishName = firstNonBlank(master.getProductName(), master.getMaterialName(), master.getActivityName(), normalizedTerm);
                if (!englishName.isBlank() && !containsKorean(englishName) && findMaterialEnglishName(koreanName).isBlank()) {
                    saveMaterialEnglishName(koreanName, englishName, "AUTO_EXPECTED_INPUT_PREMAP");
                }
                mappedCount += 1;
                if (mappedCount >= 3) {
                    return insertedCount;
                }
            }
        }
        return insertedCount;
    }

    @Transactional
    public List<Map<String, Object>> findMappedFactors(String materialName) {
        ensureEcoinventTablesReady();
        ensureMaterialTranslationTableReady();
        String keyword = safe(materialName);
        if (keyword.isEmpty()) {
            return List.of();
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        for (EmissionMappingLog mapping : mappingLogRepository.findPrioritizedByRawMaterialNameIgnoreCase(keyword, MAPPING_RECOMMENDATION_LIMIT)) {
            if (mapping.getMappedMaterial() != null) {
                rows.add(toDatasetRow(mapping.getMappedMaterial(), mapping.getRawMaterialName()));
            }
        }
        if (rows.isEmpty()) {
            for (EmissionMappingLog mapping : mappingLogRepository.findPrioritizedContainingRawMaterialNameIgnoreCase(keyword, MAPPING_RECOMMENDATION_LIMIT)) {
                if (mapping.getMappedMaterial() != null) {
                    rows.add(toDatasetRow(mapping.getMappedMaterial(), mapping.getRawMaterialName()));
                }
            }
        }
        return rows;
    }

    @Transactional
    public List<Map<String, Object>> searchChemicalMaterials(String keyword, String language) {
        ensureChemicalDictionaryTableReady();
        String normalizedKeyword = safe(keyword);
        if (normalizedKeyword.isBlank()) {
            return List.of();
        }
        String keywordLike = "%" + normalizedKeyword.toLowerCase() + "%";
        List<?> resultRows = entityManager.createNativeQuery("""
                        SELECT id,
                               cas_no,
                               korean_name,
                               english_name,
                               synonyms,
                               source_type,
                               source_url,
                               CASE
                                 WHEN LOWER(korean_name) = LOWER(?) THEN 0
                                 WHEN LOWER(english_name) = LOWER(?) THEN 1
                                 WHEN LOWER(korean_name) LIKE LOWER(?) THEN 2
                                 WHEN LOWER(english_name) LIKE LOWER(?) THEN 3
                                 WHEN LOWER(COALESCE(cas_no, '')) = LOWER(?) THEN 4
                                 WHEN LOWER(COALESCE(synonyms, '')) LIKE LOWER(?) THEN 5
                                 ELSE 9
                               END AS match_rank
                          FROM emission_chemical_material_dictionary
                         WHERE LOWER(korean_name) LIKE LOWER(?)
                            OR LOWER(english_name) LIKE LOWER(?)
                            OR LOWER(COALESCE(cas_no, '')) LIKE LOWER(?)
                            OR LOWER(COALESCE(synonyms, '')) LIKE LOWER(?)
                         ORDER BY match_rank ASC,
                                  CASE WHEN LOWER(?) = 'en' THEN english_name ELSE korean_name END ASC,
                                  id ASC
                        """)
                .setParameter(1, normalizedKeyword)
                .setParameter(2, normalizedKeyword)
                .setParameter(3, keywordLike)
                .setParameter(4, keywordLike)
                .setParameter(5, normalizedKeyword)
                .setParameter(6, keywordLike)
                .setParameter(7, keywordLike)
                .setParameter(8, keywordLike)
                .setParameter(9, keywordLike)
                .setParameter(10, keywordLike)
                .setParameter(11, safe(language))
                .setMaxResults(30)
                .getResultList();
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Object resultRow : resultRows) {
            if (!(resultRow instanceof Object[] columns)) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", longValue(columns[0], 0L));
            row.put("casNo", safeObject(columns[1]));
            row.put("koreanName", safeObject(columns[2]));
            row.put("englishName", safeObject(columns[3]));
            row.put("synonyms", safeObject(columns[4]));
            row.put("sourceType", safeObject(columns[5]));
            row.put("sourceUrl", safeObject(columns[6]));
            row.put("matchedName", "en".equalsIgnoreCase(safe(language)) ? safeObject(columns[3]) : safeObject(columns[2]));
            row.put("matchRank", longValue(columns[7], 9L));
            rows.add(row);
        }
        return rows;
    }

    @Transactional
    public DatasetPage recommendMappedDatasetPage(String materialName, Map<String, String> params) {
        ensureEcoinventTablesReady();
        String keyword = safe(materialName);
        if (keyword.isEmpty()) {
            return listLocalDatasetPage(params);
        }
        EcoinventMaster seed = findMappedSeed(keyword);
        if (seed == null) {
            return listLocalDatasetPage(mergeKeyword(params, keyword));
        }
        Map<String, String> recommendedParams = new LinkedHashMap<>(params == null ? Map.of() : params);
        recommendedParams.remove("materialName");
        recommendedParams.remove("keyword");
        String recommendedProductName = firstNonBlank(seed.getProductName(), seed.getMaterialName());
        recommendedParams.putIfAbsent("keyword", recommendedProductName);
        recommendedParams.putIfAbsent("productName", recommendedProductName);
        recommendedParams.putIfAbsent("indicatorName", firstNonBlank(seed.getIndicatorName(), "global warming potential"));
        if (safe(seed.getGeography()).isEmpty()) {
            recommendedParams.putIfAbsent("keyword", firstNonBlank(seed.getProductName(), keyword));
        }
        return listLocalDatasetPage(recommendedParams);
    }

    @Transactional
    public DatasetPage recommendAiDatasetPage(String materialName, Map<String, String> params) {
        ensureEcoinventTablesReady();
        String keyword = safe(materialName);
        if (keyword.isEmpty()) {
            return new DatasetPage(List.of(), 0L, 1, SearchRequest.from(params == null ? Map.of() : params).pageSize());
        }
        SearchRequest request = SearchRequest.from(params == null ? Map.of() : params);
        List<String> searchTerms = aiSearchTerms(keyword);
        if (searchTerms.isEmpty()) {
            return new DatasetPage(List.of(), 0L, request.pageIndex(), request.pageSize());
        }

        Map<Long, Map<String, Object>> deduped = new LinkedHashMap<>();
        int rank = 1;
        for (String term : searchTerms) {
            Map<String, String> searchParams = new LinkedHashMap<>(params == null ? Map.of() : params);
            searchParams.remove("materialName");
            searchParams.put("keyword", term);
            searchParams.put("pageIndex", "1");
            searchParams.put("pageSize", "20");
            DatasetPage page = listLocalDatasetPage(searchParams);
            for (Map<String, Object> row : page.rows()) {
                Long datasetId = longValue(row.get("datasetId"), 0L);
                if (datasetId <= 0 || deduped.containsKey(datasetId)) {
                    continue;
                }
                Map<String, Object> nextRow = new LinkedHashMap<>(row);
                nextRow.put("aiRecommended", true);
                nextRow.put("aiSearchTerm", term);
                nextRow.put("aiRank", rank++);
                nextRow.put("aiReason", "Project glossary translated the Korean material name and matched it against locally saved ecoinvent datasets.");
                deduped.put(datasetId, nextRow);
                if (deduped.size() >= request.pageSize()) {
                    break;
                }
            }
            if (deduped.size() >= request.pageSize()) {
                break;
            }
        }
        List<Map<String, Object>> rows = new ArrayList<>(deduped.values());
        return new DatasetPage(rows, rows.size(), request.pageIndex(), request.pageSize());
    }

    @Transactional
    public Map<String, String> materialEnglishNames(List<String> materialNames) {
        ensureEcoinventTablesReady();
        ensureMaterialTranslationTableReady();
        LinkedHashSet<String> names = new LinkedHashSet<>();
        if (materialNames != null) {
            materialNames.stream()
                    .map(this::safe)
                    .filter(name -> !name.isBlank())
                    .forEach(names::add);
        }
        Map<String, String> response = new LinkedHashMap<>();
        for (String name : names) {
            String existingName = findMaterialEnglishName(name);
            if (!existingName.isBlank()) {
                response.put(name, existingName);
                continue;
            }
            String dictionaryEnglishName = searchChemicalDictionaryTerms(name).stream().findFirst().orElse("");
            if (!dictionaryEnglishName.isBlank()) {
                saveMaterialEnglishName(name, dictionaryEnglishName, "CHEMICAL_DICTIONARY");
                response.put(name, dictionaryEnglishName);
                continue;
            }
            String englishName = "";
            if (englishName.isBlank() || containsKorean(englishName)) {
                englishName = dictionarySearchTerms(name).stream().findFirst().orElse("");
            }
            if (!englishName.isBlank() && !containsKorean(englishName)) {
                saveMaterialEnglishName(name, englishName, "DICTIONARY");
                response.put(name, englishName);
            }
        }
        return response;
    }

    private EcoinventMaster findMappedSeed(String keyword) {
        for (EmissionMappingLog mapping : mappingLogRepository.findPrioritizedByRawMaterialNameIgnoreCase(keyword, MAPPING_RECOMMENDATION_LIMIT)) {
            if (mapping.getMappedMaterial() != null) {
                return mapping.getMappedMaterial();
            }
        }
        for (EmissionMappingLog mapping : mappingLogRepository.findPrioritizedContainingRawMaterialNameIgnoreCase(keyword, MAPPING_RECOMMENDATION_LIMIT)) {
            if (mapping.getMappedMaterial() != null) {
                return mapping.getMappedMaterial();
            }
        }
        return null;
    }

    private boolean saveMappingIfAbsent(String koreanName, EcoinventMaster master, String memo) {
        String rawName = truncate(safe(koreanName), 255);
        if (rawName.isBlank() || master == null || master.getId() == null) {
            return false;
        }
        if (mappingLogRepository.existsByRawMaterialNameIgnoreCaseAndMappedMaterial_Id(rawName, master.getId())) {
            return false;
        }
        EmissionMappingLog mapping = new EmissionMappingLog();
        mapping.setId(nextMappingLogId());
        mapping.setRawMaterialName(rawName);
        mapping.setMappedMaterial(master);
        mapping.setNote(truncate(safe(memo), 255));
        mappingLogRepository.save(mapping);
        return true;
    }

    private Map<String, String> mergeKeyword(Map<String, String> params, String keyword) {
        Map<String, String> nextParams = new LinkedHashMap<>(params == null ? Map.of() : params);
        nextParams.putIfAbsent("keyword", keyword);
        return nextParams;
    }

    private List<String> aiSearchTerms(String materialName) {
        List<String> dictionaryTerms = dictionarySearchTerms(materialName);
        LinkedHashSet<String> terms = new LinkedHashSet<>(dictionaryTerms);
        terms.addAll(searchChemicalDictionaryTerms(materialName));
        if (requiresExactMineralSearch(materialName)) {
            return new ArrayList<>(terms);
        }
        ensureMaterialTranslationTableReady();
        String savedEnglishName = findMaterialEnglishName(materialName);
        if (!savedEnglishName.isBlank() && !containsKorean(savedEnglishName)) {
            terms.add(savedEnglishName);
            terms.addAll(searchTermVariants(savedEnglishName));
        }
        EcoinventMaster mappedSeed = findMappedSeed(materialName);
        if (mappedSeed != null) {
            terms.add(firstNonBlank(mappedSeed.getProductName(), mappedSeed.getMaterialName()));
            terms.add(firstNonBlank(mappedSeed.getActivityName(), mappedSeed.getProductName()));
        }
        return new ArrayList<>(terms).stream()
                .map(this::safe)
                .filter(term -> !term.isBlank() && !containsKorean(term))
                .limit(10)
                .toList();
    }

    private boolean requiresExactMineralSearch(String materialName) {
        String normalized = safe(materialName).replace(" ", "").toLowerCase();
        return normalized.contains("월라스턴석")
                || normalized.contains("울라스토나이트")
                || normalized.contains("포스터라이트")
                || normalized.contains("사문석");
    }

    private List<String> searchChemicalDictionaryTerms(String materialName) {
        String keyword = safe(materialName);
        if (keyword.isBlank()) {
            return List.of();
        }
        return searchChemicalMaterials(keyword, "en").stream()
                .flatMap(row -> List.of(
                        safeObject(row.get("englishName")),
                        safeObject(row.get("casNo"))
                ).stream())
                .map(this::safe)
                .filter(term -> !term.isBlank() && !containsKorean(term))
                .distinct()
                .limit(8)
                .toList();
    }

    private List<String> dictionarySearchTerms(String materialName) {
        String normalized = materialName.toLowerCase();
        Map<String, List<String>> dictionary = Map.ofEntries(
                Map.entry("탄산칼슘", List.of("calcium carbonate", "limestone")),
                Map.entry("탄산마그네슘", List.of("magnesium carbonate")),
                Map.entry("이산화규소", List.of("silicon dioxide", "silica")),
                Map.entry("암모니아", List.of("ammonia")),
                Map.entry("석회", List.of("lime", "quicklime")),
                Map.entry("생석회", List.of("quicklime", "lime")),
                Map.entry("소석회", List.of("hydrated lime", "calcium hydroxide")),
                Map.entry("전력", List.of("electricity")),
                Map.entry("스팀", List.of("steam")),
                Map.entry("증기", List.of("steam")),
                Map.entry("열", List.of("heat")),
                Map.entry("메탄 연소", List.of("heat, natural gas", "heat, methane", "methane combustion", "natural gas burned")),
                Map.entry("메탄연소", List.of("heat, natural gas", "heat, methane", "methane combustion", "natural gas burned")),
                Map.entry("열(메탄 연소 기반)", List.of("heat, natural gas", "heat, methane", "methane combustion", "natural gas burned")),
                Map.entry("물", List.of("water")),
                Map.entry("폐수", List.of("wastewater", "waste water", "wastewater treatment")),
                Map.entry("폐수처리", List.of("wastewater treatment", "wastewater")),
                Map.entry("천연가스", List.of("natural gas")),
                Map.entry("경유", List.of("diesel")),
                Map.entry("중유", List.of("heavy fuel oil")),
                Map.entry("연료유", List.of("fuel oil")),
                Map.entry("산소", List.of("oxygen")),
                Map.entry("질소", List.of("nitrogen")),
                Map.entry("수산화나트륨", List.of("sodium hydroxide")),
                Map.entry("염산", List.of("hydrochloric acid")),
                Map.entry("황산", List.of("sulfuric acid")),
                Map.entry("이산화탄소", List.of("carbon dioxide")),
                Map.entry("일산화탄소", List.of("carbon monoxide")),
                Map.entry("아산화질소", List.of("nitrous oxide", "dinitrogen monoxide")),
                Map.entry("일산화이질소", List.of("dinitrogen monoxide", "nitrous oxide")),
                Map.entry("육불화황", List.of("sulfur hexafluoride")),
                Map.entry("질소산화물", List.of("nitrogen oxides", "NOx")),
                Map.entry("휘발성유기화합물", List.of("volatile organic compounds", "VOC")),
                Map.entry("황산화물", List.of("sulfur oxides", "SOx")),
                Map.entry("이산화황", List.of("sulfur dioxide")),
                Map.entry("삼불화질소", List.of("nitrogen trifluoride")),
                Map.entry("탄소배출량", List.of("carbon emissions", "greenhouse gas emissions")),
                Map.entry("온실가스 배출량", List.of("greenhouse gas emissions")),
                Map.entry("온실가스배출량", List.of("greenhouse gas emissions")),
                Map.entry("배출계수", List.of("emission factor")),
                Map.entry("탄소발자국", List.of("carbon footprint")),
                Map.entry("제품탄소발자국", List.of("product carbon footprint")),
                Map.entry("전과정평가", List.of("life cycle assessment", "LCA")),
                Map.entry("전과정목록", List.of("life cycle inventory", "LCI")),
                Map.entry("전과정영향평가", List.of("life cycle impact assessment", "LCIA")),
                Map.entry("이산화탄소환산량", List.of("carbon dioxide equivalent", "CO2e")),
                Map.entry("탄소중립", List.of("carbon neutrality", "net zero")),
                Map.entry("넷제로", List.of("net zero", "carbon neutrality")),
                Map.entry("메탄", List.of("methane")),
                Map.entry("시멘트", List.of("cement")),
                Map.entry("클링커", List.of("clinker")),
                Map.entry("석회석", List.of("limestone")),
                Map.entry("점토", List.of("clay")),
                Map.entry("석고", List.of("gypsum")),
                Map.entry("유연탄", List.of("hard coal", "coal")),
                Map.entry("무연탄", List.of("anthracite")),
                Map.entry("석탄", List.of("coal")),
                Map.entry("코크스", List.of("coke")),
                Map.entry("석유코크스", List.of("petroleum coke")),
                Map.entry("LPG", List.of("liquefied petroleum gas", "LPG")),
                Map.entry("액화석유가스", List.of("liquefied petroleum gas", "LPG")),
                Map.entry("LNG", List.of("liquefied natural gas", "LNG")),
                Map.entry("액화천연가스", List.of("liquefied natural gas", "LNG", "natural gas")),
                Map.entry("바이오매스", List.of("biomass")),
                Map.entry("수소", List.of("hydrogen")),
                Map.entry("슬래그", List.of("slag")),
                Map.entry("제강 슬래그", List.of("basic oxygen furnace slag", "electric arc furnace slag", "steel slag", "slag")),
                Map.entry("제강슬래그", List.of("basic oxygen furnace slag", "electric arc furnace slag", "steel slag", "slag")),
                Map.entry("고로 슬래그", List.of("blast furnace slag", "granulated blast furnace slag")),
                Map.entry("고로슬래그", List.of("blast furnace slag", "granulated blast furnace slag")),
                Map.entry("전기로 슬래그", List.of("electric arc furnace slag")),
                Map.entry("전기로슬래그", List.of("electric arc furnace slag")),
                Map.entry("전로 슬래그", List.of("basic oxygen furnace slag")),
                Map.entry("전로슬래그", List.of("basic oxygen furnace slag")),
                Map.entry("폐기물", List.of("waste")),
                Map.entry("폐기물 소각", List.of("waste incineration", "incineration")),
                Map.entry("폐기물소각", List.of("waste incineration", "incineration")),
                Map.entry("소각", List.of("incineration", "waste incineration")),
                Map.entry("매립", List.of("landfill")),
                Map.entry("재활용", List.of("recycling")),
                Map.entry("휘발유", List.of("gasoline", "petrol")),
                Map.entry("등유", List.of("kerosene")),
                Map.entry("프로판", List.of("propane")),
                Map.entry("부탄", List.of("butane")),
                Map.entry("에틸렌", List.of("ethylene")),
                Map.entry("프로필렌", List.of("propylene")),
                Map.entry("메탄올", List.of("methanol")),
                Map.entry("에탄올", List.of("ethanol")),
                Map.entry("철강", List.of("steel")),
                Map.entry("철강재", List.of("steel")),
                Map.entry("강철", List.of("steel")),
                Map.entry("스테인리스", List.of("stainless steel")),
                Map.entry("스테인리스강", List.of("stainless steel")),
                Map.entry("알루미늄", List.of("aluminium", "aluminum")),
                Map.entry("알미늄", List.of("aluminium", "aluminum")),
                Map.entry("구리", List.of("copper")),
                Map.entry("니켈", List.of("nickel")),
                Map.entry("아연", List.of("zinc")),
                Map.entry("납", List.of("lead")),
                Map.entry("주석", List.of("tin")),
                Map.entry("망간", List.of("manganese")),
                Map.entry("크롬", List.of("chromium")),
                Map.entry("리튬", List.of("lithium")),
                Map.entry("코발트", List.of("cobalt")),
                Map.entry("흑연", List.of("graphite")),
                Map.entry("콘크리트", List.of("concrete")),
                Map.entry("유리", List.of("glass")),
                Map.entry("모래", List.of("sand")),
                Map.entry("자갈", List.of("gravel")),
                Map.entry("아스팔트", List.of("asphalt")),
                Map.entry("목재", List.of("wood")),
                Map.entry("종이", List.of("paper")),
                Map.entry("판지", List.of("cardboard")),
                Map.entry("플라스틱", List.of("plastic")),
                Map.entry("폴리에틸렌", List.of("polyethylene", "PE")),
                Map.entry("폴리프로필렌", List.of("polypropylene", "PP")),
                Map.entry("폴리염화비닐", List.of("polyvinyl chloride", "PVC")),
                Map.entry("폴리스티렌", List.of("polystyrene", "PS")),
                Map.entry("페트", List.of("polyethylene terephthalate", "PET")),
                Map.entry("나일론", List.of("nylon", "polyamide")),
                Map.entry("폴리우레탄", List.of("polyurethane", "PU")),
                Map.entry("에폭시", List.of("epoxy resin")),
                Map.entry("고무", List.of("rubber")),
                Map.entry("벤젠", List.of("benzene")),
                Map.entry("톨루엔", List.of("toluene")),
                Map.entry("자일렌", List.of("xylene")),
                Map.entry("아세톤", List.of("acetone")),
                Map.entry("질산", List.of("nitric acid")),
                Map.entry("가성소다", List.of("sodium hydroxide")),
                Map.entry("탄산나트륨", List.of("sodium carbonate")),
                Map.entry("요소", List.of("urea")),
                Map.entry("비료", List.of("fertilizer")),
                Map.entry("월라스턴석", List.of("wollastonite", "calcium silicate")),
                Map.entry("울라스토나이트", List.of("wollastonite", "calcium silicate")),
                Map.entry("포스터라이트", List.of("forsterite", "olivine", "magnesium silicate")),
                Map.entry("사문석", List.of("serpentine", "serpentinite", "hydrated magnesium silicate", "magnesium silicate"))
        );
        LinkedHashSet<String> terms = new LinkedHashSet<>();
        dictionary.forEach((korean, englishTerms) -> {
            if (normalized.contains(korean)) {
                terms.addAll(englishTerms);
            }
        });
        return new ArrayList<>(terms);
    }

    private Map<String, List<String>> expectedKoreanMaterialInputs() {
        return Map.ofEntries(
                Map.entry("탄산칼슘", List.of("calcium carbonate", "limestone")),
                Map.entry("탄산마그네슘", List.of("magnesium carbonate")),
                Map.entry("탄산칼슘/탄산마그네슘", List.of("calcium carbonate", "magnesium carbonate", "limestone")),
                Map.entry("이산화규소", List.of("silicon dioxide", "silica")),
                Map.entry("활성 실리카", List.of("silica", "silicon dioxide")),
                Map.entry("암모니아", List.of("ammonia")),
                Map.entry("석회석", List.of("limestone")),
                Map.entry("생석회", List.of("quicklime", "lime")),
                Map.entry("소석회", List.of("hydrated lime", "calcium hydroxide")),
                Map.entry("수산화칼슘", List.of("calcium hydroxide", "hydrated lime")),
                Map.entry("전력", List.of("electricity")),
                Map.entry("스팀", List.of("steam")),
                Map.entry("에너지 스팀", List.of("steam")),
                Map.entry("열", List.of("heat")),
                Map.entry("열(메탄 연소 기반)", List.of("heat, natural gas", "heat, methane", "methane combustion")),
                Map.entry("메탄 연소 열", List.of("heat, natural gas", "heat, methane", "methane combustion")),
                Map.entry("천연가스", List.of("natural gas")),
                Map.entry("메탄", List.of("methane")),
                Map.entry("경유", List.of("diesel")),
                Map.entry("중유", List.of("heavy fuel oil", "fuel oil")),
                Map.entry("연료유", List.of("fuel oil")),
                Map.entry("휘발유", List.of("gasoline", "petrol")),
                Map.entry("등유", List.of("kerosene")),
                Map.entry("물", List.of("water")),
                Map.entry("폐수", List.of("wastewater", "waste water", "wastewater treatment")),
                Map.entry("폐수처리", List.of("wastewater treatment", "wastewater")),
                Map.entry("대기 배출물", List.of("emission to air", "air emission")),
                Map.entry("수계 배출물", List.of("emission to water", "water emission")),
                Map.entry("기타", List.of("market for", "treatment of")),
                Map.entry("산소", List.of("oxygen")),
                Map.entry("질소", List.of("nitrogen")),
                Map.entry("수산화나트륨", List.of("sodium hydroxide")),
                Map.entry("염산", List.of("hydrochloric acid")),
                Map.entry("황산", List.of("sulfuric acid")),
                Map.entry("이산화탄소", List.of("carbon dioxide")),
                Map.entry("일산화탄소", List.of("carbon monoxide")),
                Map.entry("시멘트", List.of("cement")),
                Map.entry("클링커", List.of("clinker")),
                Map.entry("점토", List.of("clay")),
                Map.entry("석고", List.of("gypsum")),
                Map.entry("유연탄", List.of("hard coal", "coal")),
                Map.entry("무연탄", List.of("anthracite")),
                Map.entry("석탄", List.of("coal")),
                Map.entry("코크스", List.of("coke")),
                Map.entry("석유코크스", List.of("petroleum coke")),
                Map.entry("슬래그", List.of("slag")),
                Map.entry("제강 슬래그", List.of("basic oxygen furnace slag", "electric arc furnace slag", "steel slag", "slag")),
                Map.entry("제강슬래그", List.of("basic oxygen furnace slag", "electric arc furnace slag", "steel slag", "slag")),
                Map.entry("고로 슬래그", List.of("blast furnace slag", "granulated blast furnace slag")),
                Map.entry("전기로 슬래그", List.of("electric arc furnace slag")),
                Map.entry("전로 슬래그", List.of("basic oxygen furnace slag")),
                Map.entry("월라스턴석", List.of("wollastonite", "calcium silicate")),
                Map.entry("울라스토나이트", List.of("wollastonite", "calcium silicate")),
                Map.entry("포스터라이트", List.of("forsterite", "olivine", "magnesium silicate")),
                Map.entry("감람석", List.of("olivine", "forsterite")),
                Map.entry("사문석", List.of("serpentine", "serpentinite", "hydrated magnesium silicate", "magnesium silicate")),
                Map.entry("프로판", List.of("propane")),
                Map.entry("부탄", List.of("butane")),
                Map.entry("에틸렌", List.of("ethylene")),
                Map.entry("프로필렌", List.of("propylene")),
                Map.entry("메탄올", List.of("methanol")),
                Map.entry("에탄올", List.of("ethanol"))
        );
    }

    private LinkedHashSet<String> koreanAliasesFor(EcoinventMaster master) {
        LinkedHashSet<String> aliases = new LinkedHashSet<>();
        for (String source : List.of(
                firstNonBlank(master.getProductName(), ""),
                firstNonBlank(master.getMaterialName(), ""),
                firstNonBlank(master.getActivityName(), ""))) {
            aliases.addAll(koreanAliasesFromEnglish(source));
        }
        return aliases;
    }

    private List<String> koreanAliasesFromEnglish(String value) {
        String normalized = safe(value).toLowerCase();
        if (normalized.isBlank()) {
            return List.of();
        }
        normalized = normalized
                .replace("market for ", "")
                .replace("production of ", "")
                .replace("treatment of ", "")
                .replace("supply of ", "")
                .replaceAll("\\{.*?}", " ")
                .replaceAll("\\(.*?\\)", " ")
                .replaceAll("\\s+", " ")
                .trim();
        Map<String, List<String>> dictionary = Map.ofEntries(
                Map.entry("calcium carbonate", List.of("탄산칼슘")),
                Map.entry("magnesium carbonate", List.of("탄산마그네슘")),
                Map.entry("silicon dioxide", List.of("이산화규소")),
                Map.entry("silica", List.of("이산화규소")),
                Map.entry("ammonia", List.of("암모니아")),
                Map.entry("quicklime", List.of("생석회", "석회")),
                Map.entry("hydrated lime", List.of("소석회", "수산화칼슘")),
                Map.entry("calcium hydroxide", List.of("수산화칼슘", "소석회")),
                Map.entry("limestone", List.of("석회석")),
                Map.entry("lime", List.of("석회")),
                Map.entry("electricity", List.of("전력")),
                Map.entry("steam", List.of("스팀", "증기")),
                Map.entry("water", List.of("물")),
                Map.entry("wastewater treatment", List.of("폐수처리", "폐수")),
                Map.entry("wastewater", List.of("폐수")),
                Map.entry("waste water", List.of("폐수")),
                Map.entry("natural gas", List.of("천연가스")),
                Map.entry("diesel", List.of("경유")),
                Map.entry("heavy fuel oil", List.of("중유")),
                Map.entry("fuel oil", List.of("연료유")),
                Map.entry("gasoline", List.of("휘발유")),
                Map.entry("petrol", List.of("휘발유")),
                Map.entry("kerosene", List.of("등유")),
                Map.entry("oxygen", List.of("산소")),
                Map.entry("nitrogen", List.of("질소")),
                Map.entry("sodium hydroxide", List.of("수산화나트륨")),
                Map.entry("hydrochloric acid", List.of("염산")),
                Map.entry("sulfuric acid", List.of("황산")),
                Map.entry("carbon dioxide", List.of("이산화탄소")),
                Map.entry("carbon monoxide", List.of("일산화탄소")),
                Map.entry("methane combustion", List.of("메탄 연소", "메탄 연소 열")),
                Map.entry("heat, methane", List.of("메탄 연소 열", "열")),
                Map.entry("heat, natural gas", List.of("메탄 연소 열", "열")),
                Map.entry("methane", List.of("메탄")),
                Map.entry("cement", List.of("시멘트")),
                Map.entry("clinker", List.of("클링커")),
                Map.entry("clay", List.of("점토")),
                Map.entry("gypsum", List.of("석고")),
                Map.entry("hard coal", List.of("유연탄", "석탄")),
                Map.entry("anthracite", List.of("무연탄")),
                Map.entry("coal", List.of("석탄")),
                Map.entry("petroleum coke", List.of("석유코크스")),
                Map.entry("basic oxygen furnace slag", List.of("제강 슬래그", "전로 슬래그", "슬래그")),
                Map.entry("electric arc furnace slag", List.of("제강 슬래그", "전기로 슬래그", "슬래그")),
                Map.entry("blast furnace slag", List.of("고로 슬래그", "슬래그")),
                Map.entry("granulated blast furnace slag", List.of("고로 슬래그", "슬래그")),
                Map.entry("steel slag", List.of("제강 슬래그", "슬래그")),
                Map.entry("slag", List.of("슬래그")),
                Map.entry("coke", List.of("코크스")),
                Map.entry("propane", List.of("프로판")),
                Map.entry("butane", List.of("부탄")),
                Map.entry("ethylene", List.of("에틸렌")),
                Map.entry("propylene", List.of("프로필렌")),
                Map.entry("methanol", List.of("메탄올")),
                Map.entry("ethanol", List.of("에탄올")),
                Map.entry("wollastonite", List.of("월라스턴석", "울라스토나이트")),
                Map.entry("calcium silicate", List.of("월라스턴석", "칼슘 실리케이트")),
                Map.entry("forsterite", List.of("포스터라이트")),
                Map.entry("olivine", List.of("포스터라이트", "감람석")),
                Map.entry("serpentine", List.of("사문석")),
                Map.entry("serpentinite", List.of("사문석"))
        );
        LinkedHashSet<String> aliases = new LinkedHashSet<>();
        String searchText = normalized;
        dictionary.forEach((english, koreanNames) -> {
            if (searchText.contains(english)) {
                aliases.addAll(koreanNames);
            }
        });
        String compact = normalized
                .replaceAll(",.*$", "")
                .replaceAll("\\b(at|from|to|in|for|and|or|the|of|with)\\b", " ")
                .replaceAll("[^a-z0-9]+", " ")
                .replaceAll("\\s+", " ")
                .trim();
        if (aliases.isEmpty()) {
            String translated = translateEnglishTokensToKorean(compact);
            if (!translated.isBlank()) {
                aliases.add(translated);
            }
        }
        return new ArrayList<>(aliases);
    }

    private String translateEnglishTokensToKorean(String value) {
        Map<String, String> tokens = Map.ofEntries(
                Map.entry("calcium", "칼슘"),
                Map.entry("magnesium", "마그네슘"),
                Map.entry("carbonate", "탄산염"),
                Map.entry("oxide", "산화물"),
                Map.entry("hydroxide", "수산화물"),
                Map.entry("sodium", "나트륨"),
                Map.entry("potassium", "칼륨"),
                Map.entry("chloride", "염화물"),
                Map.entry("sulfate", "황산염"),
                Map.entry("nitrate", "질산염"),
                Map.entry("phosphate", "인산염"),
                Map.entry("acid", "산"),
                Map.entry("gas", "가스"),
                Map.entry("oil", "유"),
                Map.entry("fuel", "연료"),
                Map.entry("powder", "분말"),
                Map.entry("liquid", "액체"),
                Map.entry("heat", "열"),
                Map.entry("waste", "폐기물"),
                Map.entry("wastewater", "폐수"),
                Map.entry("slag", "슬래그"),
                Map.entry("steel", "제강"),
                Map.entry("furnace", "로")
        );
        List<String> translated = new ArrayList<>();
        for (String token : value.split("\\s+")) {
            String korean = tokens.get(token);
            if (korean != null) {
                translated.add(korean);
            }
        }
        return translated.isEmpty() ? "" : String.join(" ", translated);
    }

    private List<String> searchTermVariants(String value) {
        String normalized = safe(value).toLowerCase();
        LinkedHashSet<String> variants = new LinkedHashSet<>();
        variants.add(normalized);
        variants.add(normalized.replace("market for ", ""));
        variants.add(normalized.replaceAll(",.*$", "").trim());
        variants.add(normalized.replaceAll("\\(.*?\\)", "").trim());
        return variants.stream().filter(term -> !term.isBlank()).toList();
    }

    private String callOllamaForSearchTerms(String materialName) {
        RestTemplate restTemplate = new RestTemplate();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", safe(ollamaModel));
        body.put("stream", false);
        body.put("prompt", """
                /no_think
                Translate this Korean industrial material, chemical, mineral, emission, waste, or energy input name into 3 concise English ecoinvent search terms.
                Prefer material meaning over general wording. For example, "제강 슬래그" means "steel slag", not "steel frame".
                Return only a JSON array of strings. No markdown.
                Korean material: %s
                """.formatted(materialName));
        Map<?, ?> response = restTemplate.postForObject(trimTrailingSlash(ollamaBaseUrl) + "/api/generate", body, Map.class);
        if (response == null || response.get("response") == null) {
            return "";
        }
        return String.valueOf(response.get("response"));
    }

    private String callOllamaForMaterialEnglishName(String materialName) {
        RestTemplate restTemplate = new RestTemplate();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", safe(ollamaModel));
        body.put("stream", false);
        body.put("prompt", """
                /no_think
                Translate this Korean product, byproduct, emission item, or industrial material name into one concise English report label.
                Preserve chemical names when possible. Do not include Korean.
                Return only JSON: {"englishName":"..."}.
                Korean label: %s
                """.formatted(materialName));
        Map<?, ?> response = restTemplate.postForObject(trimTrailingSlash(ollamaBaseUrl) + "/api/generate", body, Map.class);
        if (response == null || response.get("response") == null) {
            return "";
        }
        return String.valueOf(response.get("response"));
    }

    private String parseMaterialEnglishName(String responseText) {
        String text = safe(responseText);
        if (text.isBlank()) {
            return "";
        }
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start >= 0 && end > start) {
            try {
                Map<?, ?> parsed = OBJECT_MAPPER.readValue(text.substring(start, end + 1), Map.class);
                return safeObject(parsed.get("englishName"));
            } catch (JsonProcessingException ignored) {
                // Fall through to text cleanup.
            }
        }
        return text.lines()
                .map(line -> line.replaceAll("^[\\s\\-\\d\\.\"]+", "").replaceAll("[\",]+$", "").trim())
                .filter(line -> !line.isEmpty())
                .findFirst()
                .orElse("");
    }

    private synchronized void ensureMaterialTranslationTableReady() {
        if (materialTranslationTableReady) {
            return;
        }
        Number tableCount = (Number) entityManager.createNativeQuery(
                        "SELECT COUNT(*) FROM information_schema.tables WHERE LOWER(table_name) = LOWER(?) AND table_schema = 'public'")
                .setParameter(1, MATERIAL_TRANSLATION_TABLE)
                .getSingleResult();
        if (tableCount == null || tableCount.longValue() == 0L) {
            entityManager.createNativeQuery("CREATE TABLE " + MATERIAL_TRANSLATION_TABLE + " ("
                    + "RAW_NAME VARCHAR(500) NOT NULL,"
                    + "ECOINVENT_MASTER_ID BIGINT,"
                    + "KOREAN_NAME VARCHAR(1000),"
                    + "ENGLISH_NAME VARCHAR(1000) NOT NULL,"
                    + "ENGLISH_EXACT_NAME VARCHAR(2000),"
                    + "SOURCE_TYPE VARCHAR(40),"
                    + "MAPPING_STATUS VARCHAR(40),"
                    + "MAPPING_NOTE VARCHAR(1000),"
                    + "FRST_REGIST_PNTTM TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,"
                    + "LAST_UPDT_PNTTM TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,"
                    + "PRIMARY KEY (RAW_NAME)"
                    + ")").executeUpdate();
        }
        ensureColumn(MATERIAL_TRANSLATION_TABLE, "ecoinvent_master_id", "ECOINVENT_MASTER_ID BIGINT");
        ensureColumn(MATERIAL_TRANSLATION_TABLE, "korean_name", "KOREAN_NAME VARCHAR(1000)");
        ensureColumn(MATERIAL_TRANSLATION_TABLE, "english_exact_name", "ENGLISH_EXACT_NAME VARCHAR(2000)");
        ensureColumn(MATERIAL_TRANSLATION_TABLE, "mapping_status", "MAPPING_STATUS VARCHAR(40)");
        ensureColumn(MATERIAL_TRANSLATION_TABLE, "mapping_note", "MAPPING_NOTE VARCHAR(1000)");
        materialTranslationTableReady = true;
    }

    private void ensureColumn(String tableName, String columnName, String columnDefinition) {
        if (columnExists(tableName, columnName)) {
            return;
        }
        entityManager.createNativeQuery("ALTER TABLE " + tableName + " ADD COLUMN " + columnDefinition).executeUpdate();
    }

    private boolean columnExists(String tableName, String columnName) {
        Number columnCount = (Number) entityManager.createNativeQuery("""
                        SELECT COUNT(*)
                        FROM information_schema.columns
                        WHERE LOWER(table_name) = LOWER(?)
                          AND LOWER(column_name) = LOWER(?)
                        """)
                .setParameter(1, tableName)
                .setParameter(2, columnName)
                .getSingleResult();
        return columnCount != null && columnCount.longValue() > 0L;
    }

    private synchronized void ensureChemicalDictionaryTableReady() {
        if (chemicalDictionaryTableReady) {
            return;
        }
        if (!tableExists(CHEMICAL_DICTIONARY_TABLE)) {
            entityManager.createNativeQuery("""
                    CREATE TABLE emission_chemical_material_dictionary (
                      id BIGINT NOT NULL,
                      cas_no VARCHAR(80),
                      korean_name VARCHAR(1000) NOT NULL,
                      english_name VARCHAR(1000) NOT NULL,
                      synonyms VARCHAR(4000),
                      source_type VARCHAR(80),
                      source_url VARCHAR(1000),
                      frst_regist_pnttm TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                      last_updt_pnttm TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                      PRIMARY KEY (id)
                    )
                    """).executeUpdate();
        }
        chemicalDictionaryTableReady = true;
    }

    private String findMaterialEnglishName(String rawName) {
        List<?> rows = entityManager.createNativeQuery(
                        "SELECT ENGLISH_NAME FROM " + MATERIAL_TRANSLATION_TABLE + " WHERE RAW_NAME = ?")
                .setParameter(1, rawName)
                .getResultList();
        return rows.isEmpty() ? "" : safeObject(rows.get(0));
    }

    private void saveMaterialEnglishName(String rawName, String englishName, String sourceType) {
        ensureMaterialTranslationTableReady();
        if (findMaterialEnglishName(rawName).isBlank()) {
            entityManager.createNativeQuery("INSERT INTO " + MATERIAL_TRANSLATION_TABLE
                            + " (RAW_NAME, KOREAN_NAME, ENGLISH_NAME, ENGLISH_EXACT_NAME, SOURCE_TYPE, MAPPING_STATUS)"
                            + " VALUES (?, ?, ?, ?, ?, ?)")
                    .setParameter(1, rawName)
                    .setParameter(2, rawName)
                    .setParameter(3, englishName)
                    .setParameter(4, englishName)
                    .setParameter(5, sourceType)
                    .setParameter(6, "DIRECT")
                    .executeUpdate();
            return;
        }
        entityManager.createNativeQuery("UPDATE " + MATERIAL_TRANSLATION_TABLE
                        + " SET KOREAN_NAME = ?, ENGLISH_NAME = ?, ENGLISH_EXACT_NAME = ?, SOURCE_TYPE = ?,"
                        + " MAPPING_STATUS = ?, LAST_UPDT_PNTTM = CURRENT_TIMESTAMP WHERE RAW_NAME = ?")
                .setParameter(1, rawName)
                .setParameter(2, englishName)
                .setParameter(3, englishName)
                .setParameter(4, sourceType)
                .setParameter(5, "DIRECT")
                .setParameter(6, rawName)
                .executeUpdate();
    }

    private boolean upsertEcoinventMaterialTranslation(EcoinventMaster master) {
        if (master == null || master.getId() == null || master.getId() <= 0L) {
            return false;
        }
        String rawName = "ecoinvent:" + master.getId();
        String englishExactName = exactEnglishName(master);
        String koreanExactName = exactKoreanName(master, englishExactName);
        String status = containsKorean(koreanExactName) ? "PRODUCT_NAME_EXACT" : "PRODUCT_KO_PENDING_AI";
        String storedKoreanName = containsKorean(koreanExactName) ? truncate(koreanExactName, 1000) : null;
        String sourceType = "ECOINVENT_PRODUCT_EXACT";
        String note = "ecoinvent_master product_name exact row mapping";

        int updated = entityManager.createNativeQuery("UPDATE " + MATERIAL_TRANSLATION_TABLE
                        + " SET ECOINVENT_MASTER_ID = ?, KOREAN_NAME = ?, ENGLISH_NAME = ?, ENGLISH_EXACT_NAME = ?,"
                        + " SOURCE_TYPE = ?, MAPPING_STATUS = ?, MAPPING_NOTE = ?, LAST_UPDT_PNTTM = CURRENT_TIMESTAMP"
                        + " WHERE RAW_NAME = ?")
                .setParameter(1, master.getId())
                .setParameter(2, storedKoreanName)
                .setParameter(3, truncate(englishExactName, 1000))
                .setParameter(4, truncate(englishExactName, 2000))
                .setParameter(5, sourceType)
                .setParameter(6, status)
                .setParameter(7, note)
                .setParameter(8, rawName)
                .executeUpdate();
        if (updated > 0) {
            return true;
        }
        entityManager.createNativeQuery("INSERT INTO " + MATERIAL_TRANSLATION_TABLE
                        + " (RAW_NAME, ECOINVENT_MASTER_ID, KOREAN_NAME, ENGLISH_NAME, ENGLISH_EXACT_NAME,"
                        + " SOURCE_TYPE, MAPPING_STATUS, MAPPING_NOTE)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
                .setParameter(1, rawName)
                .setParameter(2, master.getId())
                .setParameter(3, storedKoreanName)
                .setParameter(4, truncate(englishExactName, 1000))
                .setParameter(5, truncate(englishExactName, 2000))
                .setParameter(6, sourceType)
                .setParameter(7, status)
                .setParameter(8, note)
                .executeUpdate();
        return true;
    }

    private MaterialTranslationRow materialTranslationByDatasetId(Long datasetId) {
        if (datasetId == null || datasetId <= 0L) {
            return null;
        }
        List<?> rows = entityManager.createNativeQuery("SELECT KOREAN_NAME, ENGLISH_NAME, ENGLISH_EXACT_NAME, SOURCE_TYPE, MAPPING_STATUS"
                        + " FROM " + MATERIAL_TRANSLATION_TABLE
                        + " WHERE ECOINVENT_MASTER_ID = ? ORDER BY LAST_UPDT_PNTTM DESC")
                .setParameter(1, datasetId)
                .setMaxResults(1)
                .getResultList();
        if (rows.isEmpty() || !(rows.get(0) instanceof Object[] columns)) {
            return null;
        }
        return new MaterialTranslationRow(
                safeObject(columns[0]),
                safeObject(columns[1]),
                safeObject(columns[2]),
                safeObject(columns[3]),
                safeObject(columns[4])
        );
    }

    private String exactEnglishName(EcoinventMaster master) {
        String productName = firstNonBlank(master.getProductName(), master.getMaterialName());
        return productName.isBlank() ? "ecoinvent dataset " + master.getId() : productName;
    }

    private String exactKoreanName(EcoinventMaster master, String englishExactName) {
        String translatedProduct = translateEnglishTokensToKorean(firstNonBlank(master.getProductName(), master.getMaterialName()));
        return firstNonBlank(translatedProduct, master.getProductName(), master.getMaterialName(), englishExactName, "ecoinvent 데이터셋");
    }

    private void addPart(List<String> parts, Object value) {
        String text = safeObject(value);
        if (!text.isBlank() && !parts.contains(text)) {
            parts.add(text);
        }
    }

    private List<String> parseAiSearchTerms(String responseText) {
        String text = safe(responseText);
        if (text.isEmpty()) {
            return List.of();
        }
        int start = text.indexOf('[');
        int end = text.lastIndexOf(']');
        if (start >= 0 && end > start) {
            try {
                return OBJECT_MAPPER.readValue(text.substring(start, end + 1),
                        OBJECT_MAPPER.getTypeFactory().constructCollectionType(List.class, String.class));
            } catch (JsonProcessingException ignored) {
                // Fall through to line parsing.
            }
        }
        return text.lines()
                .map(line -> line.replaceAll("^[\\s\\-\\d\\.\"]+", "").replaceAll("[\",]+$", "").trim())
                .filter(line -> !line.isEmpty())
                .limit(3)
                .toList();
    }

    private String trimTrailingSlash(String value) {
        String text = safe(value);
        while (text.endsWith("/")) {
            text = text.substring(0, text.length() - 1);
        }
        return text.isEmpty() ? "http://127.0.0.1:11434" : text;
    }

    private synchronized void ensureEcoinventTablesReady() {
        if (ecoinventTablesReady) {
            return;
        }
        if (!tableExists("ecoinvent_master")) {
            entityManager.createNativeQuery("""
                    CREATE TABLE ecoinvent_master (
                      id BIGINT NOT NULL,
                      material_name VARCHAR(255) NOT NULL,
                      activity_name VARCHAR(1000),
                      activity_type VARCHAR(255),
                      product_name VARCHAR(1000),
                      geography VARCHAR(120),
                      reference_product_unit VARCHAR(120),
                      time_period VARCHAR(255),
                      indicator_id BIGINT,
                      indicator_name VARCHAR(1000),
                      impact_score DOUBLE PRECISION NOT NULL,
                      unit VARCHAR(255) NOT NULL,
                      score_unit VARCHAR(120),
                      version VARCHAR(255),
                      last_sync_date TIMESTAMP,
                      PRIMARY KEY (id)
                    )
                    """).executeUpdate();
        }
        if (!tableExists("emission_mapping_log")) {
            entityManager.createNativeQuery("""
                    CREATE TABLE emission_mapping_log (
                      id BIGINT NOT NULL,
                      raw_material_name VARCHAR(255) NOT NULL,
                      mapped_material_id BIGINT,
                      note VARCHAR(255),
                      PRIMARY KEY (id)
                    )
                    """).executeUpdate();
        }
        ecoinventTablesReady = true;
    }

    private boolean tableExists(String tableName) {
        Number tableCount = (Number) entityManager.createNativeQuery(
                        "SELECT COUNT(*) FROM information_schema.tables WHERE LOWER(table_name) = LOWER(?) AND table_schema = 'public'")
                .setParameter(1, tableName)
                .getSingleResult();
        return tableCount != null && tableCount.longValue() > 0L;
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
        String url = replaceOrAppendQueryParam(batchUrl, "from", "0");
        url = replaceOrAppendQueryParam(url, "limit", String.valueOf(Math.min(Math.max(datasetIds.size(), 1), BATCH_IMPORT_SIZE)));
        Map<String, Object> response = restTemplate.postForObject(url, new HttpEntity<>(body, headers), Map.class);
        Object datasets = response == null ? null : response.get("datasets");
        if (!(datasets instanceof List<?> datasetList)) {
            return List.of();
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Object item : datasetList) {
            if (item instanceof Map<?, ?> dataset) {
                rows.add(toDatasetRow(dataset, true));
            }
        }
        return rows;
    }

    private List<Map<String, Object>> enrichRemoteRowsWithScores(List<Map<String, Object>> rows) {
        List<Long> datasetIds = rows.stream()
                .map(row -> longValue(row.get("datasetId"), 0L))
                .filter(id -> id > 0L)
                .distinct()
                .toList();
        if (datasetIds.isEmpty()) {
            return rows;
        }
        try {
            Map<Long, Map<String, Object>> scoreRows = new LinkedHashMap<>();
            fetchRemoteDatasetBatch(datasetIds).forEach(row -> scoreRows.put(longValue(row.get("datasetId"), 0L), row));
            List<Map<String, Object>> enrichedRows = new ArrayList<>();
            for (Map<String, Object> row : rows) {
                Map<String, Object> scoreRow = scoreRows.get(longValue(row.get("datasetId"), 0L));
                if (scoreRow == null) {
                    enrichedRows.add(row);
                    continue;
                }
                Map<String, Object> merged = new LinkedHashMap<>(row);
                merged.put("indicatorId", scoreRow.get("indicatorId"));
                merged.put("indicatorName", scoreRow.get("indicatorName"));
                merged.put("score", scoreRow.get("score"));
                merged.put("unit", scoreRow.get("unit"));
                enrichedRows.add(merged);
            }
            return enrichedRows;
        } catch (HttpClientErrorException.TooManyRequests ignored) {
            return rows;
        }
    }

    private void saveDatasetRow(Map<String, Object> row) {
        EcoinventMaster master = toMaster(row);
        if (master != null) {
            repository.save(master);
        }
    }

    private int saveDatasetRows(List<Map<String, Object>> rows) {
        Map<Long, EcoinventMaster> existingMasters = new LinkedHashMap<>();
        List<Long> datasetIds = rows.stream()
                .map(row -> longValue(row.get("datasetId"), 0L))
                .filter(id -> id > 0L)
                .distinct()
                .toList();
        repository.findAllById(datasetIds).forEach(master -> existingMasters.put(master.getId(), master));
        List<EcoinventMaster> masters = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            long datasetId = longValue(row.get("datasetId"), 0L);
            EcoinventMaster master = existingMasters.get(datasetId);
            if (master == null) {
                master = toMaster(row);
            } else {
                applyDatasetValues(master, row);
            }
            if (master != null) {
                masters.add(master);
            }
        }
        repository.saveAll(masters);
        return masters.size();
    }

    private void updateExistingDatasetMetadata(List<Map<String, Object>> rows) {
        if (rows.isEmpty()) {
            return;
        }
        Map<Long, Map<String, Object>> rowsById = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            long datasetId = longValue(row.get("datasetId"), 0L);
            if (datasetId > 0L) {
                rowsById.put(datasetId, row);
            }
        }
        if (rowsById.isEmpty()) {
            return;
        }
        List<EcoinventMaster> masters = new ArrayList<>();
        repository.findAllById(rowsById.keySet()).forEach(master -> {
            applyMetadata(master, rowsById.get(master.getId()));
            masters.add(master);
        });
        repository.saveAll(masters);
    }

    private List<Long> filterMissingDatasetIds(List<Long> datasetIds) {
        if (datasetIds.isEmpty()) {
            return List.of();
        }
        Set<Long> existingIds = new HashSet<>();
        repository.findAllById(datasetIds).forEach(master -> existingIds.add(master.getId()));
        return datasetIds.stream()
                .filter(id -> !existingIds.contains(id))
                .toList();
    }

    private EcoinventMaster toMaster(Map<String, Object> row) {
        String materialName = firstNonBlank(row.get("activityName"), row.get("productName"), row.get("materialName"));
        if (materialName.isEmpty()) {
            return null;
        }
        EcoinventMaster master = new EcoinventMaster();
        long datasetId = longValue(row.get("datasetId"), 0L);
        master.setId(datasetId > 0 ? datasetId : nextEcoinventId());
        applyDatasetValues(master, row);
        return master;
    }

    private void applyDatasetValues(EcoinventMaster master, Map<String, Object> row) {
        String materialName = firstNonBlank(row.get("activityName"), row.get("productName"), row.get("materialName"), master.getMaterialName());
        master.setMaterialName(materialName);
        applyMetadata(master, row);
        master.setImpactScore(doubleValue(row.get("score")));
        master.setUnit(firstNonBlank(row.get("referenceProductUnit"), row.get("unit"), "kg CO2 eq"));
        master.setScoreUnit(firstNonBlank(row.get("unit"), row.get("referenceProductUnit"), ""));
        master.setVersion(firstNonBlank(row.get("version"), "latest"));
    }

    private void applyMetadata(EcoinventMaster master, Map<String, Object> row) {
        if (master == null || row == null) {
            return;
        }
        String activityName = firstNonBlank(row.get("activityName"), master.getActivityName(), master.getMaterialName());
        String productName = firstNonBlank(row.get("productName"), master.getProductName(), master.getMaterialName());
        String referenceProductUnit = firstNonBlank(row.get("referenceProductUnit"), master.getReferenceProductUnit(), master.getUnit());
        master.setActivityName(activityName);
        master.setActivityType(truncate(firstNonBlank(row.get("activityType"), master.getActivityType()), 255));
        master.setProductName(productName);
        master.setGeography(truncate(firstNonBlank(row.get("geography"), master.getGeography()), 120));
        master.setReferenceProductUnit(referenceProductUnit);
        master.setTimePeriod(truncate(firstNonBlank(row.get("timePeriod"), master.getTimePeriod()), 255));
        Long indicatorId = longValueOrNull(row.get("indicatorId"));
        if (indicatorId != null && indicatorId > 0L) {
            master.setIndicatorId(indicatorId);
        }
        master.setIndicatorName(truncate(firstNonBlank(row.get("indicatorName"), master.getIndicatorName()), 1000));
        master.setScoreUnit(truncate(firstNonBlank(row.get("unit"), master.getScoreUnit()), 120));
        if (!referenceProductUnit.isEmpty()) {
            master.setUnit(referenceProductUnit);
        }
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
        return toDatasetRow(master, mappedKoreanNames(master.getId()));
    }

    private Map<String, Object> toDatasetRow(EcoinventMaster master, String koreanName) {
        MaterialTranslationRow translation = materialTranslationByDatasetId(master.getId());
        String englishExactName = exactEnglishName(master);
        String displayEnglishName = translation == null
                ? englishExactName
                : firstNonBlank(translation.englishExactName(), translation.englishName(), englishExactName);
        String displayKoreanName = displayableKoreanName(translation, koreanName);
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("datasetId", master.getId());
        row.put("materialName", master.getMaterialName());
        row.put("activityName", firstNonBlank(master.getActivityName(), master.getMaterialName()));
        row.put("activityType", master.getActivityType());
        row.put("productName", firstNonBlank(master.getProductName(), master.getMaterialName()));
        row.put("geography", firstNonBlank(master.getGeography(), ""));
        row.put("referenceProductUnit", firstNonBlank(master.getReferenceProductUnit(), master.getUnit()));
        row.put("timePeriod", master.getTimePeriod());
        row.put("indicatorId", master.getIndicatorId());
        row.put("indicatorName", firstNonBlank(master.getIndicatorName(), "Stored emission factor"));
        row.put("score", master.getImpactScore());
        row.put("unit", firstNonBlank(master.getScoreUnit(), master.getReferenceProductUnit(), master.getUnit()));
        row.put("scoreUnit", master.getScoreUnit());
        row.put("version", master.getVersion());
        row.put("koreanName", displayKoreanName);
        row.put("englishName", displayEnglishName);
        row.put("translationSource", translation == null ? "" : translation.sourceType());
        row.put("translationStatus", translation == null ? "NOT_MAPPED" : translation.mappingStatus());
        return row;
    }

    private String displayableKoreanName(MaterialTranslationRow translation, String mappedKoreanName) {
        if (translation != null
                && !isPendingProductTranslation(translation)
                && containsKorean(translation.koreanName())) {
            return translation.koreanName();
        }
        if (containsKorean(mappedKoreanName)) {
            return mappedKoreanName;
        }
        return "";
    }

    private boolean isPendingProductTranslation(MaterialTranslationRow translation) {
        return translation != null && "PRODUCT_KO_PENDING_AI".equals(safe(translation.mappingStatus()));
    }

    private List<Map<String, Object>> mergeDatasetRows(List<Map<String, Object>> firstRows, List<Map<String, Object>> secondRows) {
        Map<Long, Map<String, Object>> rowsByDatasetId = new LinkedHashMap<>();
        for (Map<String, Object> row : firstRows) {
            long datasetId = longValue(row.get("datasetId"), 0L);
            if (datasetId > 0L) {
                rowsByDatasetId.putIfAbsent(datasetId, row);
            }
        }
        for (Map<String, Object> row : secondRows) {
            long datasetId = longValue(row.get("datasetId"), 0L);
            if (datasetId > 0L) {
                rowsByDatasetId.putIfAbsent(datasetId, row);
            }
        }
        return prioritizeMappedRows(new ArrayList<>(rowsByDatasetId.values()));
    }

    private List<Map<String, Object>> prioritizeMappedRows(List<Map<String, Object>> rows) {
        return rows.stream()
                .sorted((left, right) -> {
                    int leftPriority = safeObject(left.get("koreanName")).isBlank() ? 1 : 0;
                    int rightPriority = safeObject(right.get("koreanName")).isBlank() ? 1 : 0;
                    int mappedCompare = Integer.compare(leftPriority, rightPriority);
                    if (mappedCompare != 0) {
                        return mappedCompare;
                    }
                    int periodCompare = compareLongDesc(periodStart(left.get("timePeriod")), periodStart(right.get("timePeriod")));
                    if (periodCompare != 0) {
                        return periodCompare;
                    }
                    int periodEndCompare = compareLongDesc(periodEnd(left.get("timePeriod")), periodEnd(right.get("timePeriod")));
                    if (periodEndCompare != 0) {
                        return periodEndCompare;
                    }
                    int activityLengthCompare = Integer.compare(
                            safeObject(left.get("activityName")).length(),
                            safeObject(right.get("activityName")).length());
                    if (activityLengthCompare != 0) {
                        return activityLengthCompare;
                    }
                    int geographyCompare = Integer.compare(geographyRank(left.get("geography")), geographyRank(right.get("geography")));
                    if (geographyCompare != 0) {
                        return geographyCompare;
                    }
                    return safeObject(left.get("activityName")).compareToIgnoreCase(safeObject(right.get("activityName")));
                })
                .toList();
    }

    private int compareLongDesc(long left, long right) {
        return Long.compare(right, left);
    }

    private long periodStart(Object value) {
        List<Long> years = periodYears(value);
        return years.isEmpty() ? Long.MIN_VALUE : years.get(0);
    }

    private long periodEnd(Object value) {
        List<Long> years = periodYears(value);
        return years.isEmpty() ? Long.MIN_VALUE : years.get(years.size() - 1);
    }

    private List<Long> periodYears(Object value) {
        String text = safeObject(value);
        if (text.isBlank()) {
            return List.of();
        }
        java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("(19|20)\\d{2}").matcher(text);
        List<Long> years = new ArrayList<>();
        while (matcher.find()) {
            years.add(Long.parseLong(matcher.group()));
        }
        return years;
    }

    private int geographyRank(Object value) {
        String geography = safeObject(value).toLowerCase();
        if (geography.equals("kr") || geography.contains("(kr)")) return 0;
        if (geography.equals("row") || geography.contains("(row)") || geography.equals("rest-of-world (row)")) return 1;
        if (geography.equals("rer") || geography.contains("(rer)")) return 2;
        if (geography.equals("glo") || geography.contains("(glo)") || geography.equals("global (glo)")) return 3;
        if (geography.equals("eu") || geography.contains("(eu)")) return 4;
        if (geography.equals("us") || geography.contains("(us)")) return 5;
        if (geography.equals("jp") || geography.contains("(jp)")) return 6;
        if (geography.equals("cn") || geography.contains("(cn)")) return 7;
        if (geography.equals("in") || geography.contains("(in)")) return 8;
        return 9;
    }

    private String mappedKoreanNames(Long datasetId) {
        if (datasetId == null || datasetId <= 0L) {
            return "";
        }
        List<String> aliases = mappingLogRepository.findTop5ByMappedMaterial_IdOrderByRawMaterialNameAsc(datasetId).stream()
                .map(EmissionMappingLog::getRawMaterialName)
                .map(this::safe)
                .filter(alias -> !alias.isBlank())
                .distinct()
                .toList();
        return String.join(", ", aliases);
    }

    private Map<String, Object> toDatasetRow(Map<?, ?> dataset, boolean batchDataset) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("datasetId", longValue(firstValue(dataset, "id", "dataset_id"), 0L));
        row.put("activityName", firstNonBlank(firstValue(dataset, "activity", "activityName"), ""));
        row.put("activityType", firstNonBlank(firstValue(dataset, "activity_type", "activityType"), ""));
        row.put("productName", firstNonBlank(firstValue(dataset, "product", "productName"), ""));
        row.put("geography", firstNonBlank(firstValue(dataset, "geography"), ""));
        row.put("referenceProductUnit", firstNonBlank(firstValue(dataset, "unit", "referenceProductUnit"), ""));
        row.put("timePeriod", firstNonBlank(firstValue(dataset, "time_period", "timePeriod"), ""));
        row.put("indicatorId", firstScoreValue(dataset, "id", "indicator_id", "indicatorId"));
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

    private synchronized long nextEcoinventId() {
        return repository.findMaxId() + 1L;
    }

    private synchronized long nextMappingLogId() {
        return Math.max(mappingLogRepository.findMaxId() + 1L, System.currentTimeMillis());
    }

    private String buildSearchUrl(String encodedQuery, int offset, int limit) {
        String url = searchUrlTemplate
                .replace("__QUERY__", encodedQuery)
                .replace("{query}", encodedQuery);
        url = replaceOrAppendQueryParam(url, "from", String.valueOf(Math.max(offset, 0)));
        return replaceOrAppendQueryParam(url, "limit", String.valueOf(Math.max(limit, 1)));
    }

    private String replaceOrAppendQueryParam(String url, String name, String value) {
        String pattern = "([?&])" + name + "=[^&]*";
        if (url.matches(".*[?&]" + name + "=.*")) {
            return url.replaceFirst(pattern, "$1" + name + "=" + value);
        }
        return url + (url.contains("?") ? "&" : "?") + name + "=" + value;
    }

    private record SearchPage(List<Map<String, Object>> rows, long total) {
    }

    public record DatasetPage(List<Map<String, Object>> rows, long totalCount, int pageIndex, int pageSize) {
        public int totalPages() {
            return totalCount <= 0L ? 0 : (int) Math.ceil((double) totalCount / (double) pageSize);
        }
    }

    public record ImportResult(int importedCount, boolean completed, boolean rateLimited) {
    }

    public record AutoMappingResult(int datasetCount,
                                    int aliasCount,
                                    int insertedCount,
                                    int expectedInputCount,
                                    int aiAssistedCount,
                                    int rowTranslationCount) {
    }

    private record QueryParts(String jpql, Map<String, Object> parameters) {
    }

    private record MaterialTranslationRow(String koreanName,
                                          String englishName,
                                          String englishExactName,
                                          String sourceType,
                                          String mappingStatus) {
    }

    private record SearchRequest(String keyword,
                                 int pageIndex,
                                 int pageSize,
                                 Double minScore,
                                 Double maxScore,
                                 String sortField,
                                 String sortDirection,
                                 Map<String, String> filters) {
        private int offset() {
            return (pageIndex - 1) * pageSize;
        }

        private static SearchRequest from(Map<String, String> params) {
            int pageIndex = Math.max((int) longValueStatic(params.get("pageIndex"), 1L), 1);
            int pageSize = Math.min(Math.max((int) longValueStatic(params.get("pageSize"), 100L), 1), SEARCH_PAGE_SIZE);
            Map<String, String> filters = new LinkedHashMap<>();
            FILTERABLE_FIELDS.keySet().forEach(key -> {
                String value = safeStatic(params.get(key));
                if (!value.isEmpty()) {
                    filters.put(key, value);
                }
            });
            return new SearchRequest(
                    safeStatic(params.get("keyword")),
                    pageIndex,
                    pageSize,
                    doubleValueOrNullStatic(params.get("minScore")),
                    doubleValueOrNullStatic(params.get("maxScore")),
                    normalizeSortField(params.get("sortField")),
                    normalizeSortDirection(params.get("sortDirection")),
                    filters);
        }

        private static String normalizeSortField(String value) {
            String normalized = safeStatic(value);
            return Set.of("productName", "activityName", "geography").contains(normalized) ? normalized : "";
        }

        private static String normalizeSortDirection(String value) {
            String normalized = safeStatic(value).toLowerCase();
            return "desc".equals(normalized) ? "desc" : "asc";
        }
    }

    private static final Map<String, String> FILTERABLE_FIELDS = Map.ofEntries(
            Map.entry("materialName", "materialName"),
            Map.entry("activityName", "activityName"),
            Map.entry("activityType", "activityType"),
            Map.entry("productName", "productName"),
            Map.entry("geography", "geography"),
            Map.entry("referenceProductUnit", "referenceProductUnit"),
            Map.entry("timePeriod", "timePeriod"),
            Map.entry("indicatorName", "indicatorName"),
            Map.entry("unit", "unit"),
            Map.entry("scoreUnit", "scoreUnit"),
            Map.entry("version", "version")
    );

    private QueryParts buildLocalSearchQuery(SearchRequest request, List<Long> matchedIds, boolean countOnly) {
        StringBuilder jpql = new StringBuilder(countOnly
                ? "select count(e) from EcoinventMaster e where 1 = 1"
                : "select e from EcoinventMaster e where 1 = 1");
        Map<String, Object> parameters = new LinkedHashMap<>();
        if (!request.keyword().isEmpty()) {
            if (containsKorean(request.keyword())) {
                if (matchedIds != null && !matchedIds.isEmpty()) {
                    jpql.append(" and e.id in :matchedIds\n");
                    parameters.put("matchedIds", matchedIds);
                } else {
                    jpql.append(" and 1 = 0\n");
                }
            } else {
                jpql.append("""
                        and (
                            lower(coalesce(e.productName, '')) like :keyword
                            or lower(coalesce(e.activityName, '')) like :keyword
                            or lower(coalesce(e.materialName, '')) like :keyword
                        """);
                if (matchedIds != null && !matchedIds.isEmpty()) {
                    jpql.append(" or e.id in :matchedIds");
                    parameters.put("matchedIds", matchedIds);
                }
                jpql.append("\n                    )\n");
                parameters.put("keyword", "%" + request.keyword().toLowerCase() + "%");
            }
            if (containsKorean(request.keyword())) {
                parameters.put("keyword", "%" + request.keyword().toLowerCase() + "%");
            }
        }
        int index = 0;
        for (Map.Entry<String, String> entry : request.filters().entrySet()) {
            String property = FILTERABLE_FIELDS.get(entry.getKey());
            if (property == null) {
                continue;
            }
            String parameterName = "filter" + index++;
            jpql.append(" and lower(coalesce(e.")
                    .append(property)
                    .append(", '')) like :")
                    .append(parameterName);
            parameters.put(parameterName, "%" + entry.getValue().toLowerCase() + "%");
        }
        if (request.minScore() != null) {
            jpql.append(" and e.impactScore >= :minScore");
            parameters.put("minScore", request.minScore());
        }
        if (request.maxScore() != null) {
            jpql.append(" and e.impactScore <= :maxScore");
            parameters.put("maxScore", request.maxScore());
        }
        if (!countOnly) {
            if (!request.sortField().isEmpty()) {
                appendExplicitSort(jpql, request);
            } else if (!request.keyword().isEmpty()) {
                parameters.put("keywordExact", request.keyword().toLowerCase());
                parameters.put("keywordLength", request.keyword().length());
                appendMatchedIdOrder(jpql, parameters, matchedIds);
                jpql.append("""
                            case
                                when lower(coalesce(e.productName, '')) = :keywordExact then 0
                                when lower(coalesce(e.activityName, '')) = :keywordExact then 0
                                when lower(coalesce(e.materialName, '')) = :keywordExact then 0
                                when lower(coalesce(e.productName, '')) like :keyword then 1
                                when lower(coalesce(e.activityName, '')) like :keyword then 1
                                when lower(coalesce(e.materialName, '')) like :keyword then 1
                                else 2
                            end asc,
                            least(
                                case when lower(coalesce(e.productName, '')) like :keyword then abs(length(coalesce(e.productName, '')) - :keywordLength) else 999999 end,
                                case when lower(coalesce(e.activityName, '')) like :keyword then abs(length(coalesce(e.activityName, '')) - :keywordLength) else 999999 end,
                                case when lower(coalesce(e.materialName, '')) like :keyword then abs(length(coalesce(e.materialName, '')) - :keywordLength) else 999999 end
                            ) asc,
                            least(
                                case when lower(coalesce(e.productName, '')) like :keyword then locate(:keywordExact, lower(coalesce(e.productName, ''))) else 999999 end,
                                case when lower(coalesce(e.activityName, '')) like :keyword then locate(:keywordExact, lower(coalesce(e.activityName, ''))) else 999999 end,
                                case when lower(coalesce(e.materialName, '')) like :keyword then locate(:keywordExact, lower(coalesce(e.materialName, ''))) else 999999 end
                            ) asc,
                            coalesce(e.timePeriod, '') desc,
                            length(coalesce(e.activityName, '')) asc,
                            case
                                when lower(coalesce(e.geography, '')) = 'kr' or lower(coalesce(e.geography, '')) like '%%(kr)' then 0
                                when lower(coalesce(e.geography, '')) = 'row' or lower(coalesce(e.geography, '')) like '%%(row)' or lower(coalesce(e.geography, '')) = 'rest-of-world (row)' then 1
                                when lower(coalesce(e.geography, '')) = 'rer' or lower(coalesce(e.geography, '')) like '%%(rer)' then 2
                                when lower(coalesce(e.geography, '')) = 'glo' or lower(coalesce(e.geography, '')) like '%%(glo)' or lower(coalesce(e.geography, '')) = 'global (glo)' then 3
                                when lower(coalesce(e.geography, '')) = 'eu' or lower(coalesce(e.geography, '')) like '%%(eu)' then 4
                                when lower(coalesce(e.geography, '')) = 'us' or lower(coalesce(e.geography, '')) like '%%(us)' then 5
                                when lower(coalesce(e.geography, '')) = 'jp' or lower(coalesce(e.geography, '')) like '%%(jp)' then 6
                                when lower(coalesce(e.geography, '')) = 'cn' or lower(coalesce(e.geography, '')) like '%%(cn)' then 7
                                when lower(coalesce(e.geography, '')) = 'in' or lower(coalesce(e.geography, '')) like '%%(in)' then 8
                                else 9
                            end asc,
                            e.productName asc,
                            e.activityName asc,
                            e.geography asc,
                            e.id asc
                        """);
            } else {
                jpql.append("""
                         order by
                            coalesce(e.timePeriod, '') desc,
                            length(coalesce(e.activityName, '')) asc,
                            case
                                when lower(coalesce(e.geography, '')) = 'kr' or lower(coalesce(e.geography, '')) like '%%(kr)' then 0
                                when lower(coalesce(e.geography, '')) = 'row' or lower(coalesce(e.geography, '')) like '%%(row)' or lower(coalesce(e.geography, '')) = 'rest-of-world (row)' then 1
                                when lower(coalesce(e.geography, '')) = 'rer' or lower(coalesce(e.geography, '')) like '%%(rer)' then 2
                                when lower(coalesce(e.geography, '')) = 'glo' or lower(coalesce(e.geography, '')) like '%%(glo)' or lower(coalesce(e.geography, '')) = 'global (glo)' then 3
                                when lower(coalesce(e.geography, '')) = 'eu' or lower(coalesce(e.geography, '')) like '%%(eu)' then 4
                                when lower(coalesce(e.geography, '')) = 'us' or lower(coalesce(e.geography, '')) like '%%(us)' then 5
                                when lower(coalesce(e.geography, '')) = 'jp' or lower(coalesce(e.geography, '')) like '%%(jp)' then 6
                                when lower(coalesce(e.geography, '')) = 'cn' or lower(coalesce(e.geography, '')) like '%%(cn)' then 7
                                when lower(coalesce(e.geography, '')) = 'in' or lower(coalesce(e.geography, '')) like '%%(in)' then 8
                                else 9
                            end asc,
                            e.materialName asc,
                            e.geography asc,
                            e.id asc
                        """);
            }
        }
        return new QueryParts(jpql.toString(), parameters);
    }

    private void appendExplicitSort(StringBuilder jpql, SearchRequest request) {
        String direction = "desc".equals(request.sortDirection()) ? "desc" : "asc";
        jpql.append(" order by\n");
        if ("geography".equals(request.sortField())) {
            jpql.append("""
                            case
                                when lower(coalesce(e.geography, '')) = 'kr' or lower(coalesce(e.geography, '')) like '%%(kr)' then 0
                                when lower(coalesce(e.geography, '')) = 'row' or lower(coalesce(e.geography, '')) like '%%(row)' or lower(coalesce(e.geography, '')) = 'rest-of-world (row)' then 1
                                when lower(coalesce(e.geography, '')) = 'rer' or lower(coalesce(e.geography, '')) like '%%(rer)' then 2
                                when lower(coalesce(e.geography, '')) = 'glo' or lower(coalesce(e.geography, '')) like '%%(glo)' or lower(coalesce(e.geography, '')) = 'global (glo)' then 3
                                when lower(coalesce(e.geography, '')) = 'eu' or lower(coalesce(e.geography, '')) like '%%(eu)' then 4
                                when lower(coalesce(e.geography, '')) = 'us' or lower(coalesce(e.geography, '')) like '%%(us)' then 5
                                when lower(coalesce(e.geography, '')) = 'jp' or lower(coalesce(e.geography, '')) like '%%(jp)' then 6
                                when lower(coalesce(e.geography, '')) = 'cn' or lower(coalesce(e.geography, '')) like '%%(cn)' then 7
                                when lower(coalesce(e.geography, '')) = 'in' or lower(coalesce(e.geography, '')) like '%%(in)' then 8
                                else 9
                            end %s,
                            case
                                when lower(coalesce(e.geography, '')) = 'kr' or lower(coalesce(e.geography, '')) like '%%(kr)' then ''
                                when lower(coalesce(e.geography, '')) = 'row' or lower(coalesce(e.geography, '')) like '%%(row)' or lower(coalesce(e.geography, '')) = 'rest-of-world (row)' then ''
                                when lower(coalesce(e.geography, '')) = 'rer' or lower(coalesce(e.geography, '')) like '%%(rer)' then ''
                                when lower(coalesce(e.geography, '')) = 'glo' or lower(coalesce(e.geography, '')) like '%%(glo)' or lower(coalesce(e.geography, '')) = 'global (glo)' then ''
                                when lower(coalesce(e.geography, '')) = 'eu' or lower(coalesce(e.geography, '')) like '%%(eu)' then ''
                                when lower(coalesce(e.geography, '')) = 'us' or lower(coalesce(e.geography, '')) like '%%(us)' then ''
                                when lower(coalesce(e.geography, '')) = 'jp' or lower(coalesce(e.geography, '')) like '%%(jp)' then ''
                                when lower(coalesce(e.geography, '')) = 'cn' or lower(coalesce(e.geography, '')) like '%%(cn)' then ''
                                when lower(coalesce(e.geography, '')) = 'in' or lower(coalesce(e.geography, '')) like '%%(in)' then ''
                                else lower(coalesce(e.geography, ''))
                            end %s,
                            e.productName asc,
                            e.activityName asc,
                            e.id asc
                    """.formatted(direction, direction));
            return;
        }
        String property = "activityName".equals(request.sortField()) ? "activityName" : "productName";
        jpql.append("                            lower(coalesce(e.")
                .append(property)
                .append(", '')) ")
                .append(direction)
                .append(", e.geography asc, e.id asc\n");
    }

    private void appendMatchedIdOrder(StringBuilder jpql, Map<String, Object> parameters, List<Long> matchedIds) {
        jpql.append(" order by\n");
        if (matchedIds == null || matchedIds.isEmpty()) {
            return;
        }
        jpql.append("                            case\n");
        int orderLimit = Math.min(matchedIds.size(), 300);
        for (int index = 0; index < orderLimit; index++) {
            String parameterName = "matchedOrder" + index;
            jpql.append("                                when e.id = :")
                    .append(parameterName)
                    .append(" then ")
                    .append(index)
                    .append("\n");
            parameters.put(parameterName, matchedIds.get(index));
        }
        jpql.append("                                else ")
                .append(orderLimit + 1)
                .append("\n")
                .append("                            end asc,\n");
    }

    private List<String> distinctOptions(String property, String keyword, int limit) {
        if (!FILTERABLE_FIELDS.containsValue(property)) {
            return List.of();
        }
        String keywordOrderBy = """
                order by
                    case
                        when lower(coalesce(e.%1$s, '')) = :keywordExact then 0
                        when lower(coalesce(e.%1$s, '')) like :keywordPrefix then 1
                        when lower(coalesce(e.%1$s, '')) like :keywordLike then 2
                        else 3
                    end asc,
                """.formatted(property);
        String orderBy = "geography".equals(property)
                ? """
                order by
                    case
                        when lower(coalesce(e.%1$s, '')) = :keywordExact then 0
                        when lower(coalesce(e.%1$s, '')) like :keywordPrefix then 1
                        when lower(coalesce(e.%1$s, '')) like :keywordLike then 2
                        else 3
                    end asc,
                    case
                        when lower(coalesce(e.%1$s, '')) = 'kr' or lower(coalesce(e.%1$s, '')) like '%%(kr)' then 0
                        when lower(coalesce(e.%1$s, '')) = 'row' or lower(coalesce(e.%1$s, '')) like '%%(row)' or lower(coalesce(e.%1$s, '')) = 'rest-of-world (row)' then 1
                        when lower(coalesce(e.%1$s, '')) = 'rer' or lower(coalesce(e.%1$s, '')) like '%%(rer)' then 2
                        when lower(coalesce(e.%1$s, '')) = 'glo' or lower(coalesce(e.%1$s, '')) like '%%(glo)' or lower(coalesce(e.%1$s, '')) = 'global (glo)' then 3
                        when lower(coalesce(e.%1$s, '')) = 'eu' or lower(coalesce(e.%1$s, '')) like '%%(eu)' then 4
                        when lower(coalesce(e.%1$s, '')) = 'us' or lower(coalesce(e.%1$s, '')) like '%%(us)' then 5
                        when lower(coalesce(e.%1$s, '')) = 'jp' or lower(coalesce(e.%1$s, '')) like '%%(jp)' then 6
                        when lower(coalesce(e.%1$s, '')) = 'cn' or lower(coalesce(e.%1$s, '')) like '%%(cn)' then 7
                        when lower(coalesce(e.%1$s, '')) = 'in' or lower(coalesce(e.%1$s, '')) like '%%(in)' then 8
                        else 9
                    end asc,
                    e.%1$s asc
                """.formatted(property)
                : keywordOrderBy + "                    count(e.id) desc, e.%1$s asc".formatted(property);
        
        List<Long> matchedIds = findEcoinventIdsByTranslationKeyword(keyword);
        boolean hasKoreanMatches = matchedIds != null && !matchedIds.isEmpty();
        
        StringBuilder jpql = new StringBuilder();
        jpql.append("select e.%1$s\n")
            .append("from EcoinventMaster e\n")
            .append("where e.%1$s is not null\n")
            .append("  and e.%1$s <> ''\n")
            .append("  and (:keyword = ''\n")
            .append("    or lower(coalesce(e.materialName, '')) like :keywordLike\n")
            .append("    or lower(coalesce(e.activityName, '')) like :keywordLike\n")
            .append("    or lower(coalesce(e.activityType, '')) like :keywordLike\n")
            .append("    or lower(coalesce(e.productName, '')) like :keywordLike\n")
            .append("    or lower(coalesce(e.geography, '')) like :keywordLike\n")
            .append("    or lower(coalesce(e.referenceProductUnit, '')) like :keywordLike\n")
            .append("    or lower(coalesce(e.timePeriod, '')) like :keywordLike\n")
            .append("    or lower(coalesce(e.indicatorName, '')) like :keywordLike\n")
            .append("    or lower(coalesce(e.unit, '')) like :keywordLike\n")
            .append("    or lower(coalesce(e.scoreUnit, '')) like :keywordLike\n")
            .append("    or lower(coalesce(e.version, '')) like :keywordLike");
        
        if (hasKoreanMatches) {
            jpql.append("\n    or e.id in :matchedIds");
        }
        
        jpql.append(")\n")
            .append("group by e.%1$s\n")
            .append("%2$s");
        
        String jpqlString = jpql.toString().formatted(property, orderBy);
        
        TypedQuery<String> query = entityManager.createQuery(jpqlString, String.class)
                .setParameter("keyword", keyword)
                .setParameter("keywordLike", "%" + keyword.toLowerCase() + "%")
                .setParameter("keywordExact", keyword.toLowerCase())
                .setParameter("keywordPrefix", keyword.toLowerCase() + "%")
                .setMaxResults(limit);
        
        if (hasKoreanMatches) {
            query.setParameter("matchedIds", matchedIds);
        }
        
        return query.getResultList();
    }

    private List<String> distinctTranslationOptions(String columnName, String keyword, int limit) {
        ensureMaterialTranslationTableReady();
        if (!Set.of("korean_name", "english_name", "english_exact_name", "raw_name").contains(columnName)) {
            return List.of();
        }
        String normalized = safe(keyword).toLowerCase();
        String likeKeyword = "%" + normalized + "%";
        List<?> rows = entityManager.createNativeQuery(
                        "SELECT " + columnName
                                + " FROM " + MATERIAL_TRANSLATION_TABLE
                                + " WHERE " + columnName + " IS NOT NULL"
                                + " AND " + columnName + " <> ''"
                                + " AND (? = '' OR LOWER(raw_name) LIKE ?"
                                + " OR LOWER(korean_name) LIKE ?"
                                + " OR LOWER(english_name) LIKE ?"
                                + " OR LOWER(english_exact_name) LIKE ?)"
                                + " GROUP BY " + columnName
                                + " ORDER BY CASE"
                                + " WHEN LOWER(" + columnName + ") = ? THEN 0"
                                + " WHEN LOWER(" + columnName + ") LIKE ? THEN 1"
                                + " WHEN LOWER(" + columnName + ") LIKE ? THEN 2"
                                + " ELSE 3 END, " + columnName)
                .setParameter(1, normalized)
                .setParameter(2, likeKeyword)
                .setParameter(3, likeKeyword)
                .setParameter(4, likeKeyword)
                .setParameter(5, likeKeyword)
                .setParameter(6, normalized)
                .setParameter(7, normalized + "%")
                .setParameter(8, likeKeyword)
                .setMaxResults(limit)
                .getResultList();
        return rows.stream()
                .map(this::safeObject)
                .filter(value -> !value.isBlank())
                .distinct()
                .toList();
    }

    private List<String> distinctNumberOptions(String property, String keyword, int limit) {
        Map<String, String> columns = Map.of(
                "impactScore", "impact_score",
                "indicatorId", "indicator_id");
        String columnName = columns.get(property);
        if (columnName == null) {
            return List.of();
        }
        String normalized = safe(keyword).toLowerCase();
        String likeKeyword = "%" + normalized + "%";
        List<?> rows = entityManager.createNativeQuery(
                        "SELECT CAST(" + columnName + " AS VARCHAR(80))"
                                + " FROM ecoinvent_master"
                                + " WHERE " + columnName + " IS NOT NULL"
                                + " AND (? = '' OR LOWER(CAST(" + columnName + " AS VARCHAR(80))) LIKE ?)"
                                + " GROUP BY " + columnName
                                + " ORDER BY CASE"
                                + " WHEN LOWER(CAST(" + columnName + " AS VARCHAR(80))) = ? THEN 0"
                                + " WHEN LOWER(CAST(" + columnName + " AS VARCHAR(80))) LIKE ? THEN 1"
                                + " WHEN LOWER(CAST(" + columnName + " AS VARCHAR(80))) LIKE ? THEN 2"
                                + " ELSE 3 END ASC, " + columnName + " ASC")
                .setParameter(1, normalized)
                .setParameter(2, likeKeyword)
                .setParameter(3, normalized)
                .setParameter(4, normalized + "%")
                .setParameter(5, likeKeyword)
                .setMaxResults(limit)
                .getResultList();
        return rows.stream()
                .map(this::safeObject)
                .filter(value -> !value.isBlank())
                .distinct()
                .toList();
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

    private boolean containsKorean(String value) {
        return safe(value).matches(".*[ㄱ-ㅎㅏ-ㅣ가-힣].*");
    }

    private static String safeStatic(String value) {
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

    private static long longValueStatic(Object value, long fallback) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            return Long.parseLong(String.valueOf(value).replace(",", ""));
        } catch (Exception ignored) {
            return fallback;
        }
    }

    private Long longValueOrNull(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            return Long.parseLong(safeObject(value).replace(",", ""));
        } catch (Exception ignored) {
            return null;
        }
    }

    private static Double doubleValueOrNullStatic(String value) {
        String normalized = safeStatic(value);
        if (normalized.isEmpty()) {
            return null;
        }
        try {
            return Double.parseDouble(normalized.replace(",", ""));
        } catch (Exception ignored) {
            return null;
        }
    }

    private String jsonValue(Object value) {
        if (value == null) {
            return "";
        }
        try {
            return OBJECT_MAPPER.writeValueAsString(value);
        } catch (JsonProcessingException ignored) {
            return safeObject(value);
        }
    }

    private List<Long> findEcoinventIdsByTranslationKeyword(String keyword) {
        String normalized = safe(keyword);
        if (normalized.isEmpty()) {
            return List.of();
        }
        String likeKeyword = "%" + normalized.toLowerCase() + "%";
        
        boolean koreanKeyword = containsKorean(normalized);
        List<?> translationIds;
        if (koreanKeyword) {
            translationIds = entityManager.createNativeQuery(
                    "SELECT ecoinvent_master_id FROM " + MATERIAL_TRANSLATION_TABLE
                    + " WHERE ecoinvent_master_id IS NOT NULL"
                    + " AND korean_name IS NOT NULL AND korean_name <> ''"
                    + " AND LOWER(korean_name) LIKE ?"
                    + " ORDER BY CASE"
                    + " WHEN LOWER(korean_name) = ? THEN 0"
                    + " ELSE 1 END,"
                    + " ABS(LENGTH(korean_name) - ?),"
                    + " STRPOS(LOWER(korean_name), ?), korean_name, raw_name")
                    .setParameter(1, likeKeyword)
                    .setParameter(2, normalized.toLowerCase())
                    .setParameter(3, normalized.length())
                    .setParameter(4, normalized.toLowerCase())
                    .setMaxResults(1000)
                    .getResultList();
        } else {
            translationIds = entityManager.createNativeQuery(
                    "SELECT ecoinvent_master_id FROM " + MATERIAL_TRANSLATION_TABLE
                    + " WHERE ecoinvent_master_id IS NOT NULL AND ("
                    + " LOWER(raw_name) LIKE ? OR LOWER(korean_name) LIKE ?"
                    + " OR LOWER(english_name) LIKE ? OR LOWER(english_exact_name) LIKE ?)"
                    + " ORDER BY CASE"
                    + " WHEN LOWER(english_exact_name) = ? THEN 0"
                    + " WHEN LOWER(english_exact_name) LIKE ? THEN 1"
                    + " WHEN LOWER(english_name) = ? THEN 2"
                    + " WHEN LOWER(english_name) LIKE ? THEN 3"
                    + " WHEN LOWER(raw_name) LIKE ? THEN 4"
                    + " ELSE 5 END, english_exact_name, english_name")
                    .setParameter(1, likeKeyword)
                    .setParameter(2, likeKeyword)
                    .setParameter(3, likeKeyword)
                    .setParameter(4, likeKeyword)
                    .setParameter(5, normalized.toLowerCase())
                    .setParameter(6, normalized.toLowerCase() + "%")
                    .setParameter(7, normalized.toLowerCase())
                    .setParameter(8, normalized.toLowerCase() + "%")
                    .setParameter(9, likeKeyword)
                    .setMaxResults(1000)
                    .getResultList();
        }
                
        List<?> mappingIds = entityManager.createNativeQuery(
                        "SELECT mapped_material_id FROM emission_mapping_log "
                        + " WHERE mapped_material_id IS NOT NULL AND LOWER(raw_material_name) LIKE ?"
                        + " ORDER BY CASE"
                        + " WHEN LOWER(raw_material_name) = ? THEN 0"
                        + " ELSE 1 END,"
                        + " ABS(LENGTH(raw_material_name) - ?),"
                        + " STRPOS(LOWER(raw_material_name), ?), raw_material_name")
                .setParameter(1, likeKeyword)
                .setParameter(2, normalized.toLowerCase())
                .setParameter(3, normalized.length())
                .setParameter(4, normalized.toLowerCase())
                .setMaxResults(1000)
                .getResultList();
                
        Set<Long> ids = new LinkedHashSet<>();
        List<?> primaryIds = koreanKeyword ? mappingIds : translationIds;
        List<?> secondaryIds = koreanKeyword ? translationIds : mappingIds;
        for (List<?> sourceIds : List.of(primaryIds, secondaryIds)) {
            for (Object idObj : sourceIds) {
                Long id = longValueOrNull(idObj);
                if (id != null) {
                    ids.add(id);
                }
            }
        }
        return new ArrayList<>(ids);
    }

    private String truncate(String value, int maxLength) {
        String text = safeObject(value);
        return text.length() <= maxLength ? text : text.substring(0, maxLength);
    }
}
