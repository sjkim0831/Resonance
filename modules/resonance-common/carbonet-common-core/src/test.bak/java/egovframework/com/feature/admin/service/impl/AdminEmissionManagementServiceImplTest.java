package egovframework.com.feature.admin.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.common.model.ComDefaultCodeVO;
import egovframework.com.common.service.CommonCodeService;
import egovframework.com.feature.admin.dto.request.EmissionInputSessionSaveRequest;
import egovframework.com.feature.admin.dto.request.EmissionInputValueRequest;
import egovframework.com.feature.admin.mapper.AdminEmissionManagementMapper;
import egovframework.com.feature.admin.model.vo.EmissionCategoryVO;
import egovframework.com.feature.admin.model.vo.EmissionFactorVO;
import egovframework.com.feature.admin.model.vo.EmissionVariableDefinitionVO;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminEmissionManagementServiceImplTest {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Test
    void saveInputSessionUsesGeneratedKeysFromMapperInsert() {
        AdminEmissionManagementMapper mapper = mock(AdminEmissionManagementMapper.class);
        AdminEmissionManagementServiceImpl service = service(mapper);

        EmissionCategoryVO category = limeCategory();

        EmissionVariableDefinitionVO variable = new EmissionVariableDefinitionVO();
        variable.setVarCode("MLI");

        when(mapper.selectEmissionCategory(2L)).thenReturn(category);
        when(mapper.selectEmissionTierList(2L)).thenReturn(List.of(1, 2, 3));
        when(mapper.selectEmissionVariableDefinitions(anyMap())).thenReturn(List.of(variable));
        when(mapper.selectEmissionFactors(anyMap())).thenReturn(Collections.emptyList());
        doAnswer(invocation -> {
            Map<String, Object> params = invocation.getArgument(0);
            params.put("sessionId", 701L);
            return null;
        }).when(mapper).insertEmissionInputSession(anyMap());
        doAnswer(invocation -> {
            Map<String, Object> params = invocation.getArgument(0);
            params.put("inputValueId", 9001L);
            return null;
        }).when(mapper).insertEmissionInputValue(anyMap());

        EmissionInputValueRequest value = new EmissionInputValueRequest();
        value.setVarCode("MLI");
        value.setLineNo(1);
        value.setValueNum(10d);

        EmissionInputSessionSaveRequest request = new EmissionInputSessionSaveRequest();
        request.setCategoryId(2L);
        request.setTier(1);
        request.setValues(List.of(value));

        Map<String, Object> response = service.saveInputSession(request, "webmaster");

        assertTrue(Boolean.TRUE.equals(response.get("success")));
        assertEquals(701L, response.get("sessionId"));
        assertEquals(1, response.get("savedCount"));
        verify(mapper, times(1)).insertEmissionInputSession(anyMap());
        verify(mapper, times(1)).insertEmissionInputValue(anyMap());
    }

    @Test
    void calculateInputSessionUsesGeneratedResultKeyFromMapperInsert() {
        AdminEmissionManagementMapper mapper = mock(AdminEmissionManagementMapper.class);
        AdminEmissionManagementServiceImpl service = service(mapper);

        EmissionCategoryVO category = limeCategory();

        when(mapper.selectEmissionInputSession(501L)).thenReturn(Map.of(
                "sessionId", 501L,
                "categoryId", 2L,
                "tier", 1
        ));
        when(mapper.selectEmissionCategory(2L)).thenReturn(category);
        when(mapper.selectEmissionInputValues(501L)).thenReturn(List.of(Map.of(
                "varCode", "LIME_TYPE",
                "lineNo", 1,
                "valueText", "고칼슘석회"
        ), Map.of(
                "varCode", "MLI",
                "lineNo", 1,
                "valueNum", 10d
        )));
        when(mapper.selectEmissionFactors(anyMap())).thenReturn(Collections.emptyList());
        doAnswer(invocation -> {
            Map<String, Object> params = invocation.getArgument(0);
            params.put("resultId", 8802L);
            return null;
        }).when(mapper).insertEmissionCalcResult(anyMap());

        Map<String, Object> response = service.calculateInputSession(501L);

        assertEquals(8802L, response.get("resultId"));
        assertEquals(7.5d, ((Number) response.get("co2Total")).doubleValue(), 0.0000001d);
        assertEquals("SUM(EF석회,i * Ml,i)", response.get("formulaSummary"));
        assertEquals("CO2 = Σ(EF석회,i × Ml,i)", response.get("formulaDisplay"));
        assertEquals("CO2 = 7.5", response.get("substitutedFormula"));
        assertFalse(Boolean.TRUE.equals(response.get("defaultApplied")));
        assertFalse(((List<?>) response.get("calculationLogs")).isEmpty());
        @SuppressWarnings("unchecked")
        Map<String, Object> preview = (Map<String, Object>) response.get("definitionFormulaPreview");
        @SuppressWarnings("unchecked")
        Map<String, Object> comparison = (Map<String, Object>) response.get("definitionFormulaComparison");
        assertEquals("BUILTIN:LIME:1", preview.get("draftId"));
        assertEquals(7.5d, ((Number) preview.get("total")).doubleValue(), 0.0000001d);
        assertEquals("READY", comparison.get("promotionStatus"));
        assertTrue(Boolean.TRUE.equals(comparison.get("matched")));
        verify(mapper, times(1)).insertEmissionCalcResult(anyMap());
        verify(mapper, times(1)).selectEmissionInputValues(anyLong());
    }

    @Test
    void calculateLimeTier2SupportsMgoContentWhenCombinedContentIsMissing() {
        AdminEmissionManagementMapper mapper = mock(AdminEmissionManagementMapper.class);
        AdminEmissionManagementServiceImpl service = service(mapper);

        EmissionCategoryVO category = limeCategory();

        when(mapper.selectEmissionInputSession(777L)).thenReturn(Map.of(
                "sessionId", 777L,
                "categoryId", 2L,
                "tier", 2
        ));
        when(mapper.selectEmissionCategory(2L)).thenReturn(category);
        when(mapper.selectEmissionInputValues(777L)).thenReturn(List.of(
                Map.of("varCode", "LIME_TYPE", "lineNo", 1, "valueText", "고토석회(선진국)"),
                Map.of("varCode", "MLI", "lineNo", 1, "valueNum", 10d),
                Map.of("varCode", "CAO_CONTENT", "lineNo", 1, "valueNum", 0.56d),
                Map.of("varCode", "MGO_CONTENT", "lineNo", 1, "valueNum", 0.39d)
        ));
        when(mapper.selectEmissionFactors(anyMap())).thenReturn(Collections.emptyList());
        doAnswer(invocation -> {
            Map<String, Object> params = invocation.getArgument(0);
            params.put("resultId", 9900L);
            return null;
        }).when(mapper).insertEmissionCalcResult(anyMap());

        Map<String, Object> response = service.calculateInputSession(777L);

        assertEquals(8.84697d, ((Number) response.get("co2Total")).doubleValue(), 0.0000001d);
        assertEquals("SUM(EF석회,i * Ml,i * CF_lkd,i * C_h,i)", response.get("formulaSummary"));
        assertEquals("CO2 = Σ(EF석회,i × Ml,i × CF_lkd,i × C_h,i)", response.get("formulaDisplay"));
        assertFalse(((List<?>) response.get("calculationLogs")).isEmpty());
        verify(mapper, times(1)).insertEmissionCalcResult(anyMap());
    }

    @Test
    void calculateLimeTier2UsesLkdAndHydrationCorrectionsFromHwpxTable() {
        AdminEmissionManagementMapper mapper = mock(AdminEmissionManagementMapper.class);
        AdminEmissionManagementServiceImpl service = service(mapper);

        EmissionCategoryVO category = limeCategory();

        when(mapper.selectEmissionInputSession(778L)).thenReturn(Map.of(
                "sessionId", 778L,
                "categoryId", 2L,
                "tier", 2
        ));
        when(mapper.selectEmissionCategory(2L)).thenReturn(category);
        when(mapper.selectEmissionInputValues(778L)).thenReturn(List.of(
                Map.of("varCode", "LIME_TYPE", "lineNo", 1, "valueText", "고칼슘석회"),
                Map.of("varCode", "MLI", "lineNo", 1, "valueNum", 10d),
                Map.of("varCode", "CAO_CONTENT", "lineNo", 1, "valueNum", 95d),
                Map.of("varCode", "MD", "lineNo", 1, "valueNum", 2d),
                Map.of("varCode", "CD", "lineNo", 1, "valueNum", 40d),
                Map.of("varCode", "FD", "lineNo", 1, "valueNum", 50d),
                Map.of("varCode", "HYDRATED_LIME_PRODUCTION_YN", "lineNo", 1, "valueText", "Y"),
                Map.of("varCode", "X", "lineNo", 1, "valueNum", 10d),
                Map.of("varCode", "Y", "lineNo", 1, "valueNum", 20d)
        ));
        when(mapper.selectEmissionFactors(anyMap())).thenReturn(Collections.emptyList());
        doAnswer(invocation -> {
            Map<String, Object> params = invocation.getArgument(0);
            params.put("resultId", 9901L);
            return null;
        }).when(mapper).insertEmissionCalcResult(anyMap());

        Map<String, Object> response = service.calculateInputSession(778L);

        assertEquals(7.600684d, ((Number) response.get("co2Total")).doubleValue(), 0.0000001d);
        assertEquals("SUM(EF석회,i * Ml,i * CF_lkd,i * C_h,i)", response.get("formulaSummary"));
        assertFalse(((List<?>) response.get("calculationLogs")).isEmpty());
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> calculationLogs = (List<Map<String, Object>>) response.get("calculationLogs");
        assertTrue(String.valueOf(calculationLogs.get(1).get("note")).contains("Md/Cd/Fd 산식으로 계산"));
        assertTrue(String.valueOf(calculationLogs.get(2).get("note")).contains("수화 생산 조건으로 계산"));
    }

    @Test
    void calculateLimeTier2UsesUnitHydrationCorrectionWhenHydratedLimeIsNotProduced() {
        AdminEmissionManagementMapper mapper = mock(AdminEmissionManagementMapper.class);
        AdminEmissionManagementServiceImpl service = service(mapper);

        EmissionCategoryVO category = limeCategory();

        when(mapper.selectEmissionInputSession(779L)).thenReturn(Map.of(
                "sessionId", 779L,
                "categoryId", 2L,
                "tier", 2
        ));
        when(mapper.selectEmissionCategory(2L)).thenReturn(category);
        when(mapper.selectEmissionInputValues(779L)).thenReturn(List.of(
                Map.of("varCode", "LIME_TYPE", "lineNo", 1, "valueText", "고칼슘석회"),
                Map.of("varCode", "MLI", "lineNo", 1, "valueNum", 10d),
                Map.of("varCode", "CAO_CONTENT", "lineNo", 1, "valueNum", 95d),
                Map.of("varCode", "HYDRATED_LIME_PRODUCTION_YN", "lineNo", 1, "valueText", "N")
        ));
        when(mapper.selectEmissionFactors(anyMap())).thenReturn(Collections.emptyList());
        doAnswer(invocation -> {
            Map<String, Object> params = invocation.getArgument(0);
            params.put("resultId", 9902L);
            return null;
        }).when(mapper).insertEmissionCalcResult(anyMap());

        Map<String, Object> response = service.calculateInputSession(779L);

        assertEquals(7.60665d, ((Number) response.get("co2Total")).doubleValue(), 0.0000001d);
    }

    @Test
    void calculateLimeTier2AllowsBlankLimeTypeByUsingDefaultFactorFallback() {
        AdminEmissionManagementMapper mapper = mock(AdminEmissionManagementMapper.class);
        AdminEmissionManagementServiceImpl service = service(mapper);

        EmissionCategoryVO category = limeCategory();

        when(mapper.selectEmissionInputSession(780L)).thenReturn(Map.of(
                "sessionId", 780L,
                "categoryId", 2L,
                "tier", 2
        ));
        when(mapper.selectEmissionCategory(2L)).thenReturn(category);
        when(mapper.selectEmissionInputValues(780L)).thenReturn(List.of(
                Map.of("varCode", "MLI", "lineNo", 1, "valueNum", 10d)
        ));
        when(mapper.selectEmissionFactors(anyMap())).thenReturn(Collections.emptyList());
        doAnswer(invocation -> {
            Map<String, Object> params = invocation.getArgument(0);
            params.put("resultId", 9903L);
            return null;
        }).when(mapper).insertEmissionCalcResult(anyMap());

        Map<String, Object> response = service.calculateInputSession(780L);

        assertEquals(7.65d, ((Number) response.get("co2Total")).doubleValue(), 0.0000001d);
        assertTrue(Boolean.TRUE.equals(response.get("defaultApplied")));
    }

    @Test
    void saveInputSessionSkipsManualEfiAndEfkForCementTier3() {
        AdminEmissionManagementMapper mapper = mock(AdminEmissionManagementMapper.class);
        AdminEmissionManagementServiceImpl service = service(mapper);

        EmissionCategoryVO category = cementCategory();

        EmissionVariableDefinitionVO carbonateType = new EmissionVariableDefinitionVO();
        carbonateType.setVarCode("CARBONATE_TYPE");
        EmissionVariableDefinitionVO mi = new EmissionVariableDefinitionVO();
        mi.setVarCode("MI");
        EmissionVariableDefinitionVO fi = new EmissionVariableDefinitionVO();
        fi.setVarCode("FI");
        EmissionVariableDefinitionVO efi = new EmissionVariableDefinitionVO();
        efi.setVarCode("EFI");

        when(mapper.selectEmissionCategory(1L)).thenReturn(category);
        when(mapper.selectEmissionTierList(1L)).thenReturn(List.of(1, 2, 3));
        when(mapper.selectEmissionVariableDefinitions(anyMap())).thenReturn(List.of(carbonateType, mi, fi, efi));
        when(mapper.selectEmissionFactors(anyMap())).thenReturn(Collections.emptyList());
        doAnswer(invocation -> {
            Map<String, Object> params = invocation.getArgument(0);
            params.put("sessionId", 702L);
            return null;
        }).when(mapper).insertEmissionInputSession(anyMap());
        doAnswer(invocation -> {
            Map<String, Object> params = invocation.getArgument(0);
            params.put("inputValueId", 9002L);
            return null;
        }).when(mapper).insertEmissionInputValue(anyMap());

        EmissionInputSessionSaveRequest request = new EmissionInputSessionSaveRequest();
        request.setCategoryId(1L);
        request.setTier(3);
        request.setValues(List.of(
                numericValue("MI", 1, 10d),
                numericValue("FI", 1, 1d),
                numericValue("EFI", 1, 0.123d)
        ));

        Map<String, Object> response = service.saveInputSession(request, "webmaster");

        assertEquals(702L, response.get("sessionId"));
        assertEquals(2, response.get("savedCount"));
        verify(mapper, times(2)).insertEmissionInputValue(anyMap());
    }

    @Test
    void calculateCementTier1SupportsRepeatableMciAndCcliRows() {
        AdminEmissionManagementMapper mapper = mock(AdminEmissionManagementMapper.class);
        AdminEmissionManagementServiceImpl service = service(mapper);

        EmissionCategoryVO category = cementCategory();

        when(mapper.selectEmissionInputSession(881L)).thenReturn(Map.of(
                "sessionId", 881L,
                "categoryId", 1L,
                "tier", 1
        ));
        when(mapper.selectEmissionCategory(1L)).thenReturn(category);
        when(mapper.selectEmissionInputValues(881L)).thenReturn(List.of(
                Map.of("varCode", "MCI", "lineNo", 1, "valueNum", 100d),
                Map.of("varCode", "CCLI", "lineNo", 1, "valueNum", 0.8d),
                Map.of("varCode", "MCI", "lineNo", 2, "valueNum", 50d),
                Map.of("varCode", "CCLI", "lineNo", 2, "valueNum", 0.6d),
                Map.of("varCode", "IM", "lineNo", 1, "valueNum", 10d),
                Map.of("varCode", "EX", "lineNo", 1, "valueNum", 5d)
        ));
        when(mapper.selectEmissionFactors(anyMap())).thenReturn(Collections.emptyList());
        doAnswer(invocation -> {
            Map<String, Object> params = invocation.getArgument(0);
            params.put("resultId", 9911L);
            return null;
        }).when(mapper).insertEmissionCalcResult(anyMap());

        Map<String, Object> response = service.calculateInputSession(881L);

        assertEquals(54.6d, ((Number) response.get("co2Total")).doubleValue(), 0.0000001d);
        assertEquals("CO2 = [Σ(Mci × Ccli) - Im + Ex] × EFclc", response.get("formulaDisplay"));
        assertTrue(String.valueOf(response.get("substitutedFormula")).contains("CO2 = [110.0 - 10.0 + 5.0] × 0.52 = 54.6"));
        assertFalse(((List<?>) response.get("calculationLogs")).isEmpty());
        verify(mapper, times(1)).insertEmissionCalcResult(anyMap());
    }

    private EmissionInputValueRequest numericValue(String varCode, int lineNo, double valueNum) {
        EmissionInputValueRequest value = new EmissionInputValueRequest();
        value.setVarCode(varCode);
        value.setLineNo(lineNo);
        value.setValueNum(valueNum);
        return value;
    }

    private AdminEmissionManagementServiceImpl service(AdminEmissionManagementMapper mapper) {
        return service(mapper, mock(CommonCodeService.class));
    }

    private AdminEmissionManagementServiceImpl service(AdminEmissionManagementMapper mapper, CommonCodeService commonCodeService) {
        return new AdminEmissionManagementServiceImpl(mapper, commonCodeService, OBJECT_MAPPER);
    }

    private EmissionCategoryVO cementCategory() {
        return category(1L, "CEMENT", "시멘트 생산");
    }

    private EmissionCategoryVO limeCategory() {
        return category(2L, "LIME", "석회 생산");
    }

    private EmissionCategoryVO category(Long categoryId, String subCode, String subName) {
        EmissionCategoryVO category = new EmissionCategoryVO();
        category.setCategoryId(categoryId);
        category.setMajorCode("MINERAL");
        category.setMajorName("광물산업");
        category.setSubCode(subCode);
        category.setSubName(subName);
        category.setUseYn("Y");
        return category;
    }

    private EmissionFactorVO factor(String factorCode, double factorValue) {
        EmissionFactorVO factor = new EmissionFactorVO();
        factor.setFactorCode(factorCode);
        factor.setFactorValue(factorValue);
        return factor;
    }

    @Test
    void calculateCementTier1TreatsRatioOneAsOnePercent() {
        AdminEmissionManagementMapper mapper = mock(AdminEmissionManagementMapper.class);
        AdminEmissionManagementServiceImpl service = new AdminEmissionManagementServiceImpl(mapper, mock(CommonCodeService.class), new ObjectMapper());

        EmissionCategoryVO category = new EmissionCategoryVO();
        category.setCategoryId(1L);
        category.setMajorCode("MINERAL");
        category.setMajorName("광물산업");
        category.setSubCode("CEMENT");
        category.setSubName("시멘트 생산");
        category.setUseYn("Y");

        when(mapper.selectEmissionInputSession(882L)).thenReturn(Map.of(
                "sessionId", 882L,
                "categoryId", 1L,
                "tier", 1
        ));
        when(mapper.selectEmissionCategory(1L)).thenReturn(category);
        when(mapper.selectEmissionInputValues(882L)).thenReturn(List.of(
                Map.of("varCode", "MCI", "lineNo", 1, "valueNum", 100d),
                Map.of("varCode", "CCLI", "lineNo", 1, "valueNum", 1d)
        ));
        when(mapper.selectEmissionFactors(anyMap())).thenReturn(Collections.emptyList());
        doAnswer(invocation -> {
            Map<String, Object> params = invocation.getArgument(0);
            params.put("resultId", 9912L);
            return null;
        }).when(mapper).insertEmissionCalcResult(anyMap());

        Map<String, Object> response = service.calculateInputSession(882L);

        assertEquals(0.52d, ((Number) response.get("co2Total")).doubleValue(), 0.0000001d);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> calculationLogs = (List<Map<String, Object>>) response.get("calculationLogs");
        assertTrue(String.valueOf(calculationLogs.get(calculationLogs.size() - 1).get("note")).contains("계수 기본값 사용"));
    }

    @Test
    void calculateCementTier3PrefersCarbonateMappingOverStoredFactor() {
        AdminEmissionManagementMapper mapper = mock(AdminEmissionManagementMapper.class);
        AdminEmissionManagementServiceImpl service = new AdminEmissionManagementServiceImpl(mapper, mock(CommonCodeService.class), new ObjectMapper());

        EmissionCategoryVO category = new EmissionCategoryVO();
        category.setCategoryId(1L);
        category.setMajorCode("MINERAL");
        category.setMajorName("광물산업");
        category.setSubCode("CEMENT");
        category.setSubName("시멘트 생산");
        category.setUseYn("Y");

        when(mapper.selectEmissionInputSession(884L)).thenReturn(Map.of(
                "sessionId", 884L,
                "categoryId", 1L,
                "tier", 3
        ));
        when(mapper.selectEmissionCategory(1L)).thenReturn(category);
        when(mapper.selectEmissionInputValues(884L)).thenReturn(List.of(
                Map.of("varCode", "CARBONATE_TYPE", "lineNo", 1, "valueText", "마그네사이트"),
                Map.of("varCode", "MI", "lineNo", 1, "valueNum", 10d),
                Map.of("varCode", "FI", "lineNo", 1, "valueNum", 100d)
        ));
        when(mapper.selectEmissionFactors(anyMap())).thenReturn(List.of(factor("EFI", 0.25d)));
        doAnswer(invocation -> {
            Map<String, Object> params = invocation.getArgument(0);
            params.put("resultId", 9914L);
            return null;
        }).when(mapper).insertEmissionCalcResult(anyMap());

        Map<String, Object> response = service.calculateInputSession(884L);

        assertEquals(5.2197d, ((Number) response.get("co2Total")).doubleValue(), 0.0000001d);
        assertTrue(Boolean.TRUE.equals(response.get("defaultApplied")));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> appliedFactors = (List<Map<String, Object>>) response.get("appliedFactors");
        assertEquals("EFI[1]", appliedFactors.get(0).get("factorCode"));
        assertTrue(Boolean.TRUE.equals(appliedFactors.get(0).get("defaultApplied")));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> calculationLogs = (List<Map<String, Object>>) response.get("calculationLogs");
        assertTrue(String.valueOf(calculationLogs.get(0).get("note")).contains("탄산염 유형 매핑값 사용"));
    }

    @Test
    void calculateCementTier2ReportsDerivedCfckdTraceNote() {
        AdminEmissionManagementMapper mapper = mock(AdminEmissionManagementMapper.class);
        AdminEmissionManagementServiceImpl service = new AdminEmissionManagementServiceImpl(mapper, mock(CommonCodeService.class), new ObjectMapper());

        EmissionCategoryVO category = new EmissionCategoryVO();
        category.setCategoryId(1L);
        category.setMajorCode("MINERAL");
        category.setMajorName("광물산업");
        category.setSubCode("CEMENT");
        category.setSubName("시멘트 생산");
        category.setUseYn("Y");

        when(mapper.selectEmissionInputSession(886L)).thenReturn(Map.of(
                "sessionId", 886L,
                "categoryId", 1L,
                "tier", 2
        ));
        when(mapper.selectEmissionCategory(1L)).thenReturn(category);
        when(mapper.selectEmissionInputValues(886L)).thenReturn(List.of(
                Map.of("varCode", "MCL", "lineNo", 1, "valueNum", 100d),
                Map.of("varCode", "MD", "lineNo", 1, "valueNum", 2d),
                Map.of("varCode", "CD", "lineNo", 1, "valueNum", 40d),
                Map.of("varCode", "FD", "lineNo", 1, "valueNum", 50d)
        ));
        when(mapper.selectEmissionFactors(anyMap())).thenReturn(Collections.emptyList());
        doAnswer(invocation -> {
            Map<String, Object> params = invocation.getArgument(0);
            params.put("resultId", 9916L);
            return null;
        }).when(mapper).insertEmissionCalcResult(anyMap());

        Map<String, Object> response = service.calculateInputSession(886L);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> calculationLogs = (List<Map<String, Object>>) response.get("calculationLogs");
        assertTrue(String.valueOf(calculationLogs.get(0).get("note")).contains("산식으로 계산"));
    }

    @Test
    void calculateLimeTier1UsesStoredFactorBeforeDefaultFallback() {
        AdminEmissionManagementMapper mapper = mock(AdminEmissionManagementMapper.class);
        AdminEmissionManagementServiceImpl service = new AdminEmissionManagementServiceImpl(mapper, mock(CommonCodeService.class), new ObjectMapper());

        EmissionCategoryVO category = new EmissionCategoryVO();
        category.setCategoryId(2L);
        category.setMajorCode("MINERAL");
        category.setMajorName("광물산업");
        category.setSubCode("LIME");
        category.setSubName("석회 생산");
        category.setUseYn("Y");

        when(mapper.selectEmissionInputSession(885L)).thenReturn(Map.of(
                "sessionId", 885L,
                "categoryId", 2L,
                "tier", 1
        ));
        when(mapper.selectEmissionCategory(2L)).thenReturn(category);
        when(mapper.selectEmissionInputValues(885L)).thenReturn(List.of(
                Map.of("varCode", "MLI", "lineNo", 1, "valueNum", 10d)
        ));
        when(mapper.selectEmissionFactors(anyMap())).thenReturn(List.of(factor("EF_LIME", 0.8d)));
        doAnswer(invocation -> {
            Map<String, Object> params = invocation.getArgument(0);
            params.put("resultId", 9915L);
            return null;
        }).when(mapper).insertEmissionCalcResult(anyMap());

        Map<String, Object> response = service.calculateInputSession(885L);

        assertEquals(8.0d, ((Number) response.get("co2Total")).doubleValue(), 0.0000001d);
        assertTrue(Boolean.TRUE.equals(response.get("defaultApplied")));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> appliedFactors = (List<Map<String, Object>>) response.get("appliedFactors");
        assertTrue(Boolean.TRUE.equals(appliedFactors.get(0).get("defaultApplied")));
    }

    @Test
    void getVariableDefinitionsAttachesCommonCodeOptionsToCarbonateType() throws Exception {
        AdminEmissionManagementMapper mapper = mock(AdminEmissionManagementMapper.class);
        CommonCodeService commonCodeService = mock(CommonCodeService.class);
        AdminEmissionManagementServiceImpl service = new AdminEmissionManagementServiceImpl(mapper, commonCodeService, new ObjectMapper());

        EmissionCategoryVO category = new EmissionCategoryVO();
        category.setCategoryId(1L);
        category.setMajorCode("MINERAL");
        category.setMajorName("광물산업");
        category.setSubCode("CEMENT");
        category.setSubName("시멘트 생산");
        category.setUseYn("Y");

        EmissionVariableDefinitionVO carbonate = new EmissionVariableDefinitionVO();
        carbonate.setVarCode("CARBONATE_TYPE");
        carbonate.setInputType("TEXT");

        when(mapper.selectEmissionCategory(1L)).thenReturn(category);
        when(mapper.selectEmissionTierList(1L)).thenReturn(List.of(1, 2, 3));
        when(mapper.selectEmissionVariableDefinitions(anyMap())).thenReturn(List.of(carbonate));
        when(mapper.selectEmissionFactors(anyMap())).thenReturn(Collections.emptyList());
        egovframework.com.common.service.CmmnDetailCode option = new egovframework.com.common.service.CmmnDetailCode();
        option.setCode("CaCO3");
        option.setCodeNm("방해석 (CaCO3)");
        when(commonCodeService.selectCmmCodeDetail(any(ComDefaultCodeVO.class))).thenReturn(List.of(option));

        Map<String, Object> response = service.getVariableDefinitions(1L, 3);

        @SuppressWarnings("unchecked")
        List<EmissionVariableDefinitionVO> variables = (List<EmissionVariableDefinitionVO>) response.get("variables");
        assertEquals("EMCARB", variables.get(0).getCommonCodeId());
        assertEquals("CaCO3", variables.get(0).getOptions().get(0).get("code"));
        assertEquals("방해석 (CaCO3)", variables.get(0).getOptions().get(0).get("label"));
    }

    @Test
    void getVariableDefinitionsAttachesTierSpecificCommonCodeOptionsToLimeType() throws Exception {
        AdminEmissionManagementMapper mapper = mock(AdminEmissionManagementMapper.class);
        CommonCodeService commonCodeService = mock(CommonCodeService.class);
        AdminEmissionManagementServiceImpl service = new AdminEmissionManagementServiceImpl(mapper, commonCodeService, new ObjectMapper());

        EmissionCategoryVO category = new EmissionCategoryVO();
        category.setCategoryId(2L);
        category.setMajorCode("MINERAL");
        category.setMajorName("광물산업");
        category.setSubCode("LIME");
        category.setSubName("석회 생산");
        category.setUseYn("Y");

        EmissionVariableDefinitionVO limeType = new EmissionVariableDefinitionVO();
        limeType.setVarCode("LIME_TYPE");
        limeType.setInputType("TEXT");

        when(mapper.selectEmissionCategory(2L)).thenReturn(category);
        when(mapper.selectEmissionTierList(2L)).thenReturn(List.of(1, 2, 3));
        when(mapper.selectEmissionVariableDefinitions(anyMap())).thenReturn(List.of(limeType));
        when(mapper.selectEmissionFactors(anyMap())).thenReturn(Collections.emptyList());

        egovframework.com.common.service.CmmnDetailCode tier1Option = new egovframework.com.common.service.CmmnDetailCode();
        tier1Option.setCode("DOLOMITIC_HIGH");
        tier1Option.setCodeNm("고토석회(선진국)");
        egovframework.com.common.service.CmmnDetailCode tier2Option = new egovframework.com.common.service.CmmnDetailCode();
        tier2Option.setCode("DOLOMITIC_HIGH");
        tier2Option.setCodeNm("고토석회(선진국)");

        when(commonCodeService.selectCmmCodeDetail(any(ComDefaultCodeVO.class))).thenAnswer(invocation -> {
            ComDefaultCodeVO request = invocation.getArgument(0);
            if ("EMLIM1".equals(request.getCodeId())) {
                return List.of(tier1Option);
            }
            if ("EMLIM2".equals(request.getCodeId())) {
                return List.of(tier2Option);
            }
            return Collections.emptyList();
        });

        Map<String, Object> tier1Response = service.getVariableDefinitions(2L, 1);
        @SuppressWarnings("unchecked")
        List<EmissionVariableDefinitionVO> tier1Variables = (List<EmissionVariableDefinitionVO>) tier1Response.get("variables");
        assertEquals("EMLIM1", tier1Variables.get(0).getCommonCodeId());
        assertEquals("DOLOMITIC_HIGH", tier1Variables.get(0).getOptions().get(0).get("code"));

        Map<String, Object> tier2Response = service.getVariableDefinitions(2L, 2);
        @SuppressWarnings("unchecked")
        List<EmissionVariableDefinitionVO> tier2Variables = (List<EmissionVariableDefinitionVO>) tier2Response.get("variables");
        assertEquals("EMLIM2", tier2Variables.get(0).getCommonCodeId());
        assertEquals("DOLOMITIC_HIGH", tier2Variables.get(0).getOptions().get(0).get("code"));
        assertEquals("EF석회,i 유형", tier2Variables.get(0).getDisplayName());
        assertEquals("EF석회,i", tier2Variables.get(0).getDisplayCode());
    }

    @Test
    void getVariableDefinitionsIncludesUiMetadataForTierSpecificPresentation() {
        AdminEmissionManagementMapper mapper = mock(AdminEmissionManagementMapper.class);
        AdminEmissionManagementServiceImpl service = new AdminEmissionManagementServiceImpl(mapper, mock(CommonCodeService.class), new ObjectMapper());

        EmissionCategoryVO cementCategory = new EmissionCategoryVO();
        cementCategory.setCategoryId(1L);
        cementCategory.setSubCode("CEMENT");

        EmissionCategoryVO limeCategory = new EmissionCategoryVO();
        limeCategory.setCategoryId(2L);
        limeCategory.setSubCode("LIME");

        EmissionVariableDefinitionVO carbonateType = new EmissionVariableDefinitionVO();
        carbonateType.setVarCode("CARBONATE_TYPE");
        EmissionVariableDefinitionVO efi = new EmissionVariableDefinitionVO();
        efi.setVarCode("EFI");
        EmissionVariableDefinitionVO mci = new EmissionVariableDefinitionVO();
        mci.setVarCode("MCI");
        EmissionVariableDefinitionVO im = new EmissionVariableDefinitionVO();
        im.setVarCode("IM");
        EmissionVariableDefinitionVO cementMd = new EmissionVariableDefinitionVO();
        cementMd.setVarCode("MD");
        EmissionVariableDefinitionVO cementCfckd = new EmissionVariableDefinitionVO();
        cementCfckd.setVarCode("CFCKD");
        EmissionVariableDefinitionVO cao = new EmissionVariableDefinitionVO();
        cao.setVarCode("CAO_CONTENT");
        EmissionVariableDefinitionVO hydratedYn = new EmissionVariableDefinitionVO();
        hydratedYn.setVarCode("HYDRATED_LIME_PRODUCTION_YN");
        EmissionVariableDefinitionVO limeTier3CarbonateType = new EmissionVariableDefinitionVO();
        limeTier3CarbonateType.setVarCode("CARBONATE_TYPE");
        EmissionVariableDefinitionVO limeTier3Md = new EmissionVariableDefinitionVO();
        limeTier3Md.setVarCode("MD");

        when(mapper.selectEmissionCategory(1L)).thenReturn(cementCategory);
        when(mapper.selectEmissionTierList(1L)).thenReturn(List.of(1, 2, 3));
        when(mapper.selectEmissionCategory(2L)).thenReturn(limeCategory);
        when(mapper.selectEmissionTierList(2L)).thenReturn(List.of(1, 2, 3));
        when(mapper.selectEmissionVariableDefinitions(anyMap())).thenAnswer(invocation -> {
            Map<String, Object> params = invocation.getArgument(0);
            Long categoryId = ((Number) params.get("categoryId")).longValue();
            Integer tier = ((Number) params.get("tier")).intValue();
            if (categoryId == 1L && tier == 1) {
                return List.of(mci, im);
            }
            if (categoryId == 1L && tier == 2) {
                return List.of(cementMd, cementCfckd);
            }
            if (categoryId == 1L && tier == 3) {
                return List.of(carbonateType, efi);
            }
            if (categoryId == 2L && tier == 2) {
                return List.of(cao, hydratedYn);
            }
            if (categoryId == 2L && tier == 3) {
                return List.of(limeTier3CarbonateType, limeTier3Md);
            }
            return Collections.emptyList();
        });
        when(mapper.selectEmissionFactors(anyMap())).thenReturn(Collections.emptyList());

        @SuppressWarnings("unchecked")
        List<EmissionVariableDefinitionVO> cementTier1Variables = (List<EmissionVariableDefinitionVO>) service.getVariableDefinitions(1L, 1).get("variables");
        assertEquals("Mci", cementTier1Variables.get(0).getDisplayCode());
        assertEquals("cement-tier1-clinker", cementTier1Variables.get(0).getSectionId());
        assertEquals(1, cementTier1Variables.get(0).getSectionOrder());
        assertEquals("cement-tier1-adjustment", cementTier1Variables.get(1).getSectionId());
        assertEquals(2, cementTier1Variables.get(1).getSectionOrder());

        @SuppressWarnings("unchecked")
        List<EmissionVariableDefinitionVO> cementVariables = (List<EmissionVariableDefinitionVO>) service.getVariableDefinitions(1L, 3).get("variables");
        assertEquals("탄산염 종류", cementVariables.get(0).getDisplayName());
        assertEquals("EFi", cementVariables.get(0).getDisplayCode());
        assertEquals("cement-tier3-carbonate", cementVariables.get(0).getRepeatGroupKey());
        assertEquals("cement-tier3-carbonate", cementVariables.get(0).getSectionId());
        assertEquals(1, cementVariables.get(0).getSectionOrder());
        assertEquals("Y", cementVariables.get(1).getDerivedYn());

        @SuppressWarnings("unchecked")
        List<EmissionVariableDefinitionVO> cementTier2Variables = (List<EmissionVariableDefinitionVO>) service.getVariableDefinitions(1L, 2).get("variables");
        assertEquals("Y", cementTier2Variables.get(0).getSupplementalYn());
        assertTrue(cementTier2Variables.get(0).getUiHint().contains("CFckd"));
        assertEquals("cement-tier2-correction", cementTier2Variables.get(0).getSectionId());
        assertEquals("cement-tier2-cf", cementTier2Variables.get(0).getSectionPreviewType());
        assertEquals("EFC,EFCL,CFCKD", cementTier2Variables.get(0).getSectionRelatedFactorCodes());
        assertEquals("CFckd", cementTier2Variables.get(1).getDisplayCode());
        assertEquals("Y", cementTier2Variables.get(1).getSupplementalYn());

        @SuppressWarnings("unchecked")
        List<EmissionVariableDefinitionVO> limeVariables = (List<EmissionVariableDefinitionVO>) service.getVariableDefinitions(2L, 2).get("variables");
        assertEquals("CaO 함유량", limeVariables.get(0).getDisplayName());
        assertEquals("Y", limeVariables.get(0).getSupplementalYn());
        assertTrue(limeVariables.get(0).getUiHint().contains("EF석회,a"));
        assertEquals("lime-tier2-line", limeVariables.get(0).getRepeatGroupKey());
        assertEquals("lime-tier2-ef", limeVariables.get(0).getSectionId());
        assertEquals("EF석회,i 산정 입력", limeVariables.get(0).getSectionTitle());
        assertEquals("lime-tier2-ef", limeVariables.get(0).getSectionPreviewType());
        assertEquals("EF_LIME,SR_CAO,SR_CAO_MGO", limeVariables.get(0).getSectionRelatedFactorCodes());
        assertEquals("수화석회 생산 여부", limeVariables.get(1).getDisplayName());
        assertEquals("HYDRATED_YN", limeVariables.get(1).getDisplayCode());
        assertEquals("lime-tier2-ch", limeVariables.get(1).getSectionId());
        assertEquals("lime-tier2-ch", limeVariables.get(1).getSectionPreviewType());
        assertEquals("C_H", limeVariables.get(1).getSectionRelatedFactorCodes());

        @SuppressWarnings("unchecked")
        List<EmissionVariableDefinitionVO> limeTier3Variables = (List<EmissionVariableDefinitionVO>) service.getVariableDefinitions(2L, 3).get("variables");
        assertEquals("lime-tier3-carbonate", limeTier3Variables.get(0).getSectionId());
        assertEquals("lime-tier3-carbonate", limeTier3Variables.get(0).getRepeatGroupKey());
        assertEquals(1, limeTier3Variables.get(0).getSectionOrder());
        assertEquals("lime-tier3-lkd", limeTier3Variables.get(1).getSectionId());
        assertEquals(2, limeTier3Variables.get(1).getSectionOrder());
    }

    @Test
    void getVariableDefinitionsUsesRegisteredFormulaSummaryForEachCategoryTier() {
        AdminEmissionManagementMapper mapper = mock(AdminEmissionManagementMapper.class);
        AdminEmissionManagementServiceImpl service = new AdminEmissionManagementServiceImpl(mapper, mock(CommonCodeService.class), new ObjectMapper());

        EmissionCategoryVO cementCategory = new EmissionCategoryVO();
        cementCategory.setCategoryId(1L);
        cementCategory.setSubCode("CEMENT");
        cementCategory.setSubName("시멘트 생산");

        EmissionCategoryVO limeCategory = new EmissionCategoryVO();
        limeCategory.setCategoryId(2L);
        limeCategory.setSubCode("LIME");
        limeCategory.setSubName("석회 생산");

        when(mapper.selectEmissionCategory(1L)).thenReturn(cementCategory);
        when(mapper.selectEmissionTierList(1L)).thenReturn(List.of(1, 2, 3));
        when(mapper.selectEmissionCategory(2L)).thenReturn(limeCategory);
        when(mapper.selectEmissionTierList(2L)).thenReturn(List.of(1, 2, 3));
        when(mapper.selectEmissionVariableDefinitions(anyMap())).thenReturn(Collections.emptyList());
        when(mapper.selectEmissionFactors(anyMap())).thenReturn(Collections.emptyList());

        Map<String, Object> cementTier1 = service.getVariableDefinitions(1L, 1);
        assertEquals("[SUM(Mci * Ccli) - Im + Ex] * EFclc", cementTier1.get("formulaSummary"));
        assertEquals("CO2 = [Σ(Mci × Ccli) - Im + Ex] × EFclc", cementTier1.get("formulaDisplay"));

        Map<String, Object> cementTier2 = service.getVariableDefinitions(1L, 2);
        assertEquals("Mcl * EFcl * CFckd", cementTier2.get("formulaSummary"));
        assertEquals("CO2 = Mcl × EFcl × CFckd", cementTier2.get("formulaDisplay"));

        Map<String, Object> cementTier3 = service.getVariableDefinitions(1L, 3);
        assertEquals("SUM(EFi * Mi * Fi) - Md * Cd * (1 - Fd) * EFd + SUM(Mk * Xk * EFk)", cementTier3.get("formulaSummary"));
        assertEquals("CO2 = Σ(EFi × Mi × Fi) - Md × Cd × (1 - Fd) × EFd + Σ(Mk × Xk × EFk)", cementTier3.get("formulaDisplay"));

        Map<String, Object> limeTier1 = service.getVariableDefinitions(2L, 1);
        assertEquals("SUM(EF석회,i * Ml,i)", limeTier1.get("formulaSummary"));
        assertEquals("CO2 = Σ(EF석회,i × Ml,i)", limeTier1.get("formulaDisplay"));

        Map<String, Object> limeTier2 = service.getVariableDefinitions(2L, 2);
        assertEquals("SUM(EF석회,i * Ml,i * CF_lkd,i * C_h,i)", limeTier2.get("formulaSummary"));
        assertEquals("CO2 = Σ(EF석회,i × Ml,i × CF_lkd,i × C_h,i)", limeTier2.get("formulaDisplay"));

        Map<String, Object> limeTier3 = service.getVariableDefinitions(2L, 3);
        assertEquals("SUM(EFi * Mi * Fi) - Md * Cd * (1 - Fd) * EFd", limeTier3.get("formulaSummary"));
        assertEquals("CO2 = Σ(EFi × Mi × Fi) - Md × Cd × (1 - Fd) × EFd", limeTier3.get("formulaDisplay"));
    }

    @Test
    void getVariableDefinitionsRejectsUnsupportedCategoryTierFromRegistry() {
        AdminEmissionManagementMapper mapper = mock(AdminEmissionManagementMapper.class);
        AdminEmissionManagementServiceImpl service = new AdminEmissionManagementServiceImpl(mapper, mock(CommonCodeService.class), new ObjectMapper());

        EmissionCategoryVO category = new EmissionCategoryVO();
        category.setCategoryId(9L);
        category.setSubCode("CEMENT");

        when(mapper.selectEmissionCategory(9L)).thenReturn(category);
        when(mapper.selectEmissionTierList(9L)).thenReturn(List.of(1, 2, 3, 4));
        when(mapper.selectEmissionVariableDefinitions(anyMap())).thenReturn(Collections.emptyList());
        when(mapper.selectEmissionFactors(anyMap())).thenReturn(Collections.emptyList());

        assertThrows(IllegalArgumentException.class, () -> service.getVariableDefinitions(9L, 4));
    }

    @Test
    void getTierListExcludesUnsupportedRegistryTiersFromVisibleChoices() {
        AdminEmissionManagementMapper mapper = mock(AdminEmissionManagementMapper.class);
        AdminEmissionManagementServiceImpl service = new AdminEmissionManagementServiceImpl(mapper, mock(CommonCodeService.class), new ObjectMapper());

        EmissionCategoryVO category = new EmissionCategoryVO();
        category.setCategoryId(9L);
        category.setSubCode("CEMENT");
        category.setSubName("시멘트 생산");

        when(mapper.selectEmissionCategory(9L)).thenReturn(category);
        when(mapper.selectEmissionTierList(9L)).thenReturn(List.of(1, 2, 3, 4));

        Map<String, Object> response = service.getTierList(9L);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> tiers = (List<Map<String, Object>>) response.get("tiers");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> unsupportedTiers = (List<Map<String, Object>>) response.get("unsupportedTiers");

        assertEquals(List.of(1, 2, 3), tiers.stream().map(item -> ((Number) item.get("tier")).intValue()).toList());
        assertEquals(List.of(4), unsupportedTiers.stream().map(item -> ((Number) item.get("tier")).intValue()).toList());
    }

    @Test
    void calculateCementTier3SupportsRawMaterialCarbonateTypeFallback() {
        AdminEmissionManagementMapper mapper = mock(AdminEmissionManagementMapper.class);
        AdminEmissionManagementServiceImpl service = new AdminEmissionManagementServiceImpl(mapper, mock(CommonCodeService.class), new ObjectMapper());

        EmissionCategoryVO category = new EmissionCategoryVO();
        category.setCategoryId(1L);
        category.setMajorCode("MINERAL");
        category.setMajorName("광물산업");
        category.setSubCode("CEMENT");
        category.setSubName("시멘트 생산");
        category.setUseYn("Y");

        when(mapper.selectEmissionInputSession(883L)).thenReturn(Map.of(
                "sessionId", 883L,
                "categoryId", 1L,
                "tier", 3
        ));
        when(mapper.selectEmissionCategory(1L)).thenReturn(category);
        when(mapper.selectEmissionInputValues(883L)).thenReturn(List.of(
                Map.of("varCode", "CARBONATE_TYPE", "lineNo", 1, "valueText", "CaCO3"),
                Map.of("varCode", "MI", "lineNo", 1, "valueNum", 10d),
                Map.of("varCode", "FI", "lineNo", 1, "valueNum", 1d),
                Map.of("varCode", "MD", "lineNo", 1, "valueNum", 0d),
                Map.of("varCode", "CD", "lineNo", 1, "valueNum", 0d),
                Map.of("varCode", "FD", "lineNo", 1, "valueNum", 0d),
                Map.of("varCode", "RAW_MATERIAL_CARBONATE_TYPE", "lineNo", 1, "valueText", "MgCO3"),
                Map.of("varCode", "MK", "lineNo", 1, "valueNum", 5d),
                Map.of("varCode", "XK", "lineNo", 1, "valueNum", 10d)
        ));
        when(mapper.selectEmissionFactors(anyMap())).thenReturn(Collections.emptyList());
        doAnswer(invocation -> {
            Map<String, Object> params = invocation.getArgument(0);
            params.put("resultId", 9913L);
            return null;
        }).when(mapper).insertEmissionCalcResult(anyMap());

        Map<String, Object> response = service.calculateInputSession(883L);

        assertEquals(0.304956d, ((Number) response.get("co2Total")).doubleValue(), 0.0000001d);
        assertTrue(String.valueOf(response.get("substitutedFormula")).contains("0.304956"));
        assertFalse(((List<?>) response.get("calculationLogs")).isEmpty());
    }

    @Test
    void getScopeStatusReportsMaterializeBlockedWhenPublishedDefinitionHasNoCategory() {
        AdminEmissionManagementMapper mapper = mock(AdminEmissionManagementMapper.class);
        AdminEmissionManagementServiceImpl service = service(mapper);

        Map<String, Object> response = service.getScopeStatus("LIME", 4, false);

        assertEquals("DRAFT", response.get("lifecycleStatus"));
        assertEquals(false, response.get("materializable"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> blockingReasons = (List<Map<String, Object>>) response.get("blockingReasons");
        assertNotNull(blockingReasons);
        assertEquals(0, blockingReasons.size());
    }

    @Test
    void getScopeStatusReportsRuntimeBlockedWhenMetadataExistsWithoutRuntimeSupport() {
        AdminEmissionManagementMapper mapper = mock(AdminEmissionManagementMapper.class);
        AdminEmissionManagementServiceImpl service = service(mapper);

        EmissionCategoryVO category = category(9L, "GLASS", "유리 생산");
        when(mapper.selectEmissionCategoryBySubCode("GLASS")).thenReturn(category);
        when(mapper.selectEmissionTierList(9L)).thenReturn(List.of(1));
        when(mapper.selectEmissionVariableDefinitionCount(anyMap())).thenReturn(1);

        Map<String, Object> response = service.getScopeStatus("GLASS", 1, false);

        assertEquals("RUNTIME_BLOCKED", response.get("lifecycleStatus"));
        assertEquals(false, response.get("runtimeSupported"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> blockingReasons = (List<Map<String, Object>>) response.get("blockingReasons");
        assertEquals("MISSING_RUNTIME_SUPPORT", String.valueOf(blockingReasons.get(0).get("code")));
    }

    @Test
    void getScopeStatusMarksPrimaryActiveWhenLatestPromotionStatusIsPrimaryReady() {
        AdminEmissionManagementMapper mapper = mock(AdminEmissionManagementMapper.class);
        AdminEmissionManagementServiceImpl service = service(mapper);

        EmissionCategoryVO category = limeCategory();
        when(mapper.selectEmissionCategoryBySubCode("LIME")).thenReturn(category);
        when(mapper.selectEmissionTierList(2L)).thenReturn(List.of(1, 2, 3));
        when(mapper.selectEmissionVariableDefinitionCount(anyMap())).thenReturn(1);
        when(mapper.selectLatestEmissionCalcResultsByScope()).thenReturn(List.of(Map.of(
                "scope", "LIME:1",
                "promotionStatus", "PRIMARY_READY"
        )));

        Map<String, Object> response = service.getScopeStatus("LIME", 1, false);

        assertEquals("MATERIALIZED", response.get("lifecycleStatus"));
        assertEquals("PRIMARY_READY", response.get("promotionStatus"));
        assertEquals(true, response.get("primaryActive"));
    }
}
