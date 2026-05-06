package egovframework.com.feature.admin.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.feature.admin.dto.request.EmissionSurveyCaseSaveRequest;
import egovframework.com.feature.admin.dto.request.EmissionSurveyDatasetReplaceRequest;
import egovframework.com.feature.admin.dto.request.EmissionSurveyDraftSetSaveRequest;
import egovframework.com.feature.admin.mapper.AdminEmissionSurveyDraftMapper;
import egovframework.com.feature.admin.service.AdminEmissionSurveyWorkbookService;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.DataValidation;
import org.apache.poi.ss.usermodel.DataValidationConstraint;
import org.apache.poi.ss.usermodel.DataValidationHelper;
import org.apache.poi.ss.usermodel.Name;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.CellRangeAddressList;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.ss.util.RegionUtil;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.egovframe.rte.fdl.cmmn.EgovAbstractServiceImpl;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@Service("adminEmissionSurveyWorkbookService")
public class AdminEmissionSurveyWorkbookServiceImpl extends EgovAbstractServiceImpl implements AdminEmissionSurveyWorkbookService {

    private static final String MENU_CODE = "A0020110";
    private static final String DEFAULT_WORKBOOK_NAME = "데이터 수집 설문지 excel 양식_steel, electric, low-alloy.xlsx";
    private static final String ADMIN_UPLOAD_WORKBOOK_NAME = "관리자 업로드 양식.xlsx";
    private static final String SHARED_OWNER_ACTOR_ID = "COMMON_DATASET";
    private static final String SHARED_DATASET_ID = "EMISSION_SURVEY_SHARED";
    private static final String SHARED_DATASET_PRODUCT_PREFIX = SHARED_DATASET_ID + "::PRODUCT::";
    private static final String SHARED_DATASET_NAME_KO = "공통 배출 설문 데이터셋";
    private static final String SHARED_DATASET_NAME_EN = "Shared Emission Survey Dataset";
    private static final String TEMPLATE_MARKER_PROPERTY = "carbonetEmissionSurveyTemplate";
    private static final String TEMPLATE_MARKER_VALUE = "v2";
    private static final Path WORKSPACE_SAMPLE = Path.of("/opt/Resonance", DEFAULT_WORKBOOK_NAME);
    private static final Path REFERENCE_SAMPLE = Path.of("/opt/reference/수식 설계", DEFAULT_WORKBOOK_NAME);
    private static final Path WORKSPACE_ADMIN_SAMPLE = Path.of("/opt/Resonance", ADMIN_UPLOAD_WORKBOOK_NAME);
    private static final Path WINDOWS_ADMIN_SAMPLE = Path.of("/mnt/c/Users/jwchoo/Downloads", ADMIN_UPLOAD_WORKBOOK_NAME);
    private static final Path DRAFT_REGISTRY_PATH = Path.of("data", "admin", "emission-survey-admin", "case-drafts.json");
    private static final Path SET_REGISTRY_PATH = Path.of("data", "admin", "emission-survey-admin", "draft-sets.json");
    private static final Path UPLOAD_LOG_REGISTRY_PATH = Path.of("data", "admin", "emission-survey-admin", "upload-logs.json");
    private static final DateTimeFormatter TIMESTAMP_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final String UNIT_OPTIONS_SHEET_NAME = "_unit_options";
    private static final String UNIT_OPTIONS_RANGE_NAME = "EmissionSurveyUnitOptions";

    private static final class TemplateCache {
        final long lastModified;
        final Map<String, Object> payload;

        TemplateCache(long lastModified, Map<String, Object> payload) {
            this.lastModified = lastModified;
            this.payload = payload;
        }
    }

    private final java.util.concurrent.ConcurrentHashMap<Path, TemplateCache> payloadCache = new java.util.concurrent.ConcurrentHashMap<>();

    private static final List<String> UNIT_OPTION_CODES = List.of(
            "carat | 캐럿",
            "cg | 센티그램",
            "ct | 캐럿 (중복)",
            "cwt | 헌드레드웨이트",
            "dag | 데카그램",
            "dg | 데시그램",
            "dr (Av) | 드람 (상형)",
            "dwt | 페니웨이트",
            "g | 그램",
            "gr | 그레인",
            "hg | 헥토그램",
            "kg | 킬로그램",
            "kg SWU | 킬로그램 분리작업단위",
            "kt | 킬로톤",
            "lb av | 파운드 (상형)",
            "long tn | 롱톤 (영국 톤)",
            "mg | 밀리그램",
            "Mg | 메가그램 (톤)",
            "Mt | 메가톤",
            "ng | 나노그램",
            "oz av | 온스 (상형)",
            "oz t | 온스 (트로이)",
            "pg | 피코그램",
            "sh tn | 쇼트톤 (미국 톤)",
            "t | 톤",
            "ug | 마이크로그램"
    );
    private static final List<String> WORKBOOK_GUIDANCE = List.of(
            "탭 3. 투입물 데이터 수집과 4. 산출물 데이터 수집의 우측 예시 영역을 seed 데이터로 사용합니다.",
            "Case 3-1 시작은 업로드 엑셀 값을 기본 행으로 채우고 이후 행 추가, 수정, 삭제가 가능합니다.",
            "Case 3-2 LCI DB를 알고 있는 경우는 동일한 컬럼 구조를 유지한 빈 데이터 섹션으로 시작합니다."
    );
    private static final Map<String, List<FixedColumnConfig>> FIXED_SECTION_COLUMNS = Map.of(
            "INPUT_RAW_MATERIALS", List.of(
                    fixedColumn("group", "구분", "BU"),
                    fixedColumn("materialName", "물질명", "BV"),
                    fixedColumn("amount", "양", "BW"),
                    fixedColumn("annualUnit", "단위\n(연간)", "BX"),
                    fixedColumn("usage", "용도", "BY"),
                    fixedColumn("origin", "원산지\n(국가/업체명)", "BZ",
                            "원료물질 수송 (원료 물질에만 기입하여 주시기 바랍니다.)",
                            "원산지\n(국가/업체명)"),
                    fixedColumn("marineTransport", "해양", "CA",
                            "원료물질 수송 (원료 물질에만 기입하여 주시기 바랍니다.)",
                            "수송방법",
                            "해양"),
                    fixedColumn("marineTonKm", "물동량\n(ton · km)", "CB",
                            "원료물질 수송 (원료 물질에만 기입하여 주시기 바랍니다.)",
                            "수송방법",
                            "물동량\n(ton · km)"),
                    fixedColumn("roadTransport", "육로", "CC",
                            "원료물질 수송 (원료 물질에만 기입하여 주시기 바랍니다.)",
                            "수송방법",
                            "육로"),
                    fixedColumn("roadTonKm", "물동량\n(ton · km)", "CD",
                            "원료물질 수송 (원료 물질에만 기입하여 주시기 바랍니다.)",
                            "수송방법",
                            "물동량\n(ton · km)"),
                    fixedColumn("transportRoute", "운송경로", "CE",
                            "원료물질 수송 (원료 물질에만 기입하여 주시기 바랍니다.)",
                            "운송경로"),
                    fixedColumn("remark", "비고", "CF",
                            "원료물질 수송 (원료 물질에만 기입하여 주시기 바랍니다.)",
                            "비고")
            ),
            "INPUT_ENERGY", List.of(
                    fixedColumn("group", "구분", "BU"),
                    fixedColumn("materialName", "물질명", "BV"),
                    fixedColumn("amount", "양", "BW"),
                    fixedColumn("annualUnit", "단위(연간)", "BX"),
                    fixedColumn("usage", "용도", "BY"),
                    fixedColumn("remark", "비고", "BZ")
            ),
            "INPUT_STEAM", List.of(
                    fixedColumn("group", "구분", "BU"),
                    fixedColumn("materialName", "물질명", "BV"),
                    fixedColumn("amount", "양", "BW"),
                    fixedColumn("annualUnit", "단위(연간)", "BX"),
                    fixedColumn("usage", "용도", "BY"),
                    fixedColumn("steamType", "스팀종류\n(포화증기/습증기/과열증기)", "BZ"),
                    fixedColumn("steamMass", "스팀의 질량", "CA"),
                    fixedColumn("condensateMass", "응축수 질량", "CB"),
                    fixedColumn("condensateTemperature", "응축수\n온도", "CC"),
                    fixedColumn("steamCirculation", "스팀순환여부", "CD"),
                    fixedColumn("externalSteam", "외부스팀 여부", "CE")
            ),
            "INPUT_MISC", List.of(
                    fixedColumn("group", "구분", "BU"),
                    fixedColumn("materialName", "물질명", "BV"),
                    fixedColumn("amount", "양", "BW"),
                    fixedColumn("annualUnit", "단위(연간)", "BX"),
                    fixedColumn("usage", "용도", "BY"),
                    fixedColumn("remark", "비고", "BZ")
            ),
            "OUTPUT_PRODUCTS", List.of(
                    fixedColumn("group", "구분", "BR"),
                    fixedColumn("materialName", "물질명", "BS"),
                    fixedColumn("amount", "양", "BT"),
                    fixedColumn("annualUnit", "단위\n(연간)", "BU"),
                    fixedColumn("productionCost", "생산원가", "BV"),
                    fixedColumn("costUnit", "단위", "BW"),
                    fixedColumn("remark", "비고", "BX")
            ),
            "OUTPUT_AIR", List.of(
                    fixedColumn("group", "구분", "BR"),
                    fixedColumn("materialName", "물질명", "BS"),
                    fixedColumn("amount", "양", "BT"),
                    fixedColumn("annualUnit", "단위(연간)", "BU"),
                    fixedColumn("collectionMethod", "데이터 수집 방법", "BV"),
                    fixedColumn("remark", "비고", "BW")
            ),
            "OUTPUT_WATER", List.of(
                    fixedColumn("group", "구분", "BR"),
                    fixedColumn("materialName", "물질명", "BS"),
                    fixedColumn("amount", "양", "BT"),
                    fixedColumn("annualUnit", "단위(연간)", "BU"),
                    fixedColumn("treatmentRoute", "처리경로", "BV"),
                    fixedColumn("treatmentMethod", "처리방법", "BW"),
                    fixedColumn("remark", "비고", "BX")
            ),
            "OUTPUT_WASTE", List.of(
                    fixedColumn("group", "구분", "BR"),
                    fixedColumn("materialName", "물질명", "BS"),
                    fixedColumn("amount", "양", "BT"),
                    fixedColumn("annualUnit", "단위", "BU"),
                    fixedColumn("wasteType", "구분\n(일반/지정 폐기물)", "BV"),
                    fixedColumn("treatmentMethod", "처리방법\n(매립/소각/재활용/기타)", "BX"),
                    fixedColumn("transportTonKm", "물동량", "BY",
                            "재활용 및 최종폐기 과정 수송",
                            "물동량"),
                    fixedColumn("marineTransport", "해양", "BZ",
                            "재활용 및 최종폐기 과정 수송",
                            "수송방법",
                            "해양"),
                    fixedColumn("roadTransport", "육로", "CA",
                            "재활용 및 최종폐기 과정 수송",
                            "수송방법",
                            "육로"),
                    fixedColumn("transportRoute", "운송경로", "CB",
                            "재활용 및 최종폐기 과정 수송",
                            "운송경로"),
                    fixedColumn("remark", "비고", "CC",
                            "재활용 및 최종폐기 과정 수송",
                            "비고")
            )
    );

    private static final List<SectionConfig> SECTION_CONFIGS = List.of(
            new SectionConfig("투입물 데이터 수집", "INPUT", "3. 투입물 데이터 수집", "INPUT_RAW_MATERIALS", "원료 물질 및 보조 물질", 3, 7, 71, 72, 9, 74, 73, 85, 10, 12, 13, 31, List.of(), FIXED_SECTION_COLUMNS.get("INPUT_RAW_MATERIALS")),
            new SectionConfig("투입물 데이터 수집", "INPUT", "3. 투입물 데이터 수집", "INPUT_ENERGY", "에너지", 3, 7, 71, 72, 34, 74, 73, 85, 35, 35, 36, 37, List.of(), FIXED_SECTION_COLUMNS.get("INPUT_ENERGY")),
            new SectionConfig("투입물 데이터 수집", "INPUT", "3. 투입물 데이터 수집", "INPUT_STEAM", "에너지 스팀", 3, 7, 71, 72, 39, 74, 73, 85, 39, 39, 40, 40, List.of(), FIXED_SECTION_COLUMNS.get("INPUT_STEAM")),
            new SectionConfig("투입물 데이터 수집", "INPUT", "3. 투입물 데이터 수집", "INPUT_MISC", "기타", 3, 7, 71, 72, 43, 74, 73, 85, 44, 44, 45, 46, List.of(), FIXED_SECTION_COLUMNS.get("INPUT_MISC")),
            new SectionConfig("산출물 데이터 수집", "OUTPUT", "4. 산출물 데이터 수집", "OUTPUT_PRODUCTS", "제품 및 부산물", 3, 8, 68, 69, 10, 71, 70, 81, 11, 11, 12, 13, List.of(), FIXED_SECTION_COLUMNS.get("OUTPUT_PRODUCTS")),
            new SectionConfig("산출물 데이터 수집", "OUTPUT", "4. 산출물 데이터 수집", "OUTPUT_AIR", "대기 배출물", 3, 8, 68, 69, 16, 71, 70, 81, 17, 17, 18, 53, List.of(), FIXED_SECTION_COLUMNS.get("OUTPUT_AIR")),
            new SectionConfig("산출물 데이터 수집", "OUTPUT", "4. 산출물 데이터 수집", "OUTPUT_WATER", "수계 배출물", 3, 8, 68, 69, 56, 71, 70, 81, 59, 59, 60, 70, List.of(
                    new SectionMetaConfig("wastewaterFacilityInstalled", "사업장 내 1차 하수처리장 설치여부", 57, 70, 58, 70)
            ), FIXED_SECTION_COLUMNS.get("OUTPUT_WATER")),
            new SectionConfig("산출물 데이터 수집", "OUTPUT", "4. 산출물 데이터 수집", "OUTPUT_WASTE", "폐기물", 3, 8, 68, 69, 73, 71, 70, 81, 74, 76, 77, 77, List.of(), FIXED_SECTION_COLUMNS.get("OUTPUT_WASTE"))
    );
    private static final List<SectionConfig> UPLOADED_WORKBOOK_SECTION_CONFIGS = List.of(
            new SectionConfig("투입물 데이터 수집", "INPUT", "3. 투입물 데이터 수집", "INPUT_RAW_MATERIALS", "원료 물질 및 보조 물질", 0, -1, 0, 0, 2, 1, 1, 12, 3, 5, 6, 6, List.of(), templateFixedColumns("INPUT_RAW_MATERIALS", "B")),
            new SectionConfig("투입물 데이터 수집", "INPUT", "3. 투입물 데이터 수집", "INPUT_ENERGY", "에너지", 0, -1, 0, 0, 27, 1, 1, 6, 28, 28, 29, 29, List.of(), templateFixedColumns("INPUT_ENERGY", "B")),
            new SectionConfig("투입물 데이터 수집", "INPUT", "3. 투입물 데이터 수집", "INPUT_STEAM", "에너지 스팀", 0, -1, 0, 0, 33, 1, 1, 11, 34, 34, 35, 35, List.of(), templateFixedColumns("INPUT_STEAM", "B")),
            new SectionConfig("투입물 데이터 수집", "INPUT", "3. 투입물 데이터 수집", "INPUT_MISC", "기타", 0, -1, 0, 0, 38, 1, 1, 7, 39, 39, 40, 40, List.of(), templateFixedColumns("INPUT_MISC", "B")),
            new SectionConfig("산출물 데이터 수집", "OUTPUT", "4. 산출물 데이터 수집", "OUTPUT_PRODUCTS", "제품 및 부산물", 0, -1, 0, 0, 2, 1, 1, 7, 3, 3, 4, 4, List.of(), templateFixedColumns("OUTPUT_PRODUCTS", "B")),
            new SectionConfig("산출물 데이터 수집", "OUTPUT", "4. 산출물 데이터 수집", "OUTPUT_AIR", "대기 배출물", 0, -1, 0, 0, 8, 1, 1, 6, 9, 9, 10, 10, List.of(), templateFixedColumns("OUTPUT_AIR", "B")),
            new SectionConfig("산출물 데이터 수집", "OUTPUT", "4. 산출물 데이터 수집", "OUTPUT_WATER", "수계 배출물", 0, -1, 0, 0, 34, 1, 1, 7, 36, 36, 37, 37, List.of(), templateFixedColumns("OUTPUT_WATER", "B")),
            new SectionConfig("산출물 데이터 수집", "OUTPUT", "4. 산출물 데이터 수집", "OUTPUT_WASTE", "폐기물", 0, -1, 0, 0, 43, 1, 1, 11, 44, 46, 47, 47, List.of(), templateFixedColumns("OUTPUT_WASTE", "B"))
    );
    private static final List<SectionConfig> TEMPLATE_SECTION_CONFIGS = List.of(
            new SectionConfig("투입물 데이터 수집", "INPUT", "3. 투입물 데이터 수집", "INPUT_RAW_MATERIALS", "원료 물질 및 보조 물질", 0, -1, 0, 0, 2, 1, 1, 12, 3, 5, 6, 17, List.of(), templateFixedColumns("INPUT_RAW_MATERIALS", "B")),
            new SectionConfig("투입물 데이터 수집", "INPUT", "3. 투입물 데이터 수집", "INPUT_ENERGY", "에너지", 0, -1, 0, 0, 20, 1, 1, 7, 21, 21, 22, 33, List.of(), templateFixedColumns("INPUT_ENERGY", "B")),
            new SectionConfig("투입물 데이터 수집", "INPUT", "3. 투입물 데이터 수집", "INPUT_STEAM", "에너지 스팀", 0, -1, 0, 0, 36, 1, 1, 11, 37, 37, 38, 49, List.of(), templateFixedColumns("INPUT_STEAM", "B")),
            new SectionConfig("투입물 데이터 수집", "INPUT", "3. 투입물 데이터 수집", "INPUT_MISC", "기타", 0, -1, 0, 0, 52, 1, 1, 7, 53, 53, 54, 65, List.of(), templateFixedColumns("INPUT_MISC", "B")),
            new SectionConfig("산출물 데이터 수집", "OUTPUT", "4. 산출물 데이터 수집", "OUTPUT_PRODUCTS", "제품 및 부산물", 0, -1, 0, 0, 2, 1, 1, 7, 3, 3, 4, 15, List.of(), templateFixedColumns("OUTPUT_PRODUCTS", "B")),
            new SectionConfig("산출물 데이터 수집", "OUTPUT", "4. 산출물 데이터 수집", "OUTPUT_AIR", "대기 배출물", 0, -1, 0, 0, 18, 1, 1, 6, 19, 19, 20, 31, List.of(), templateFixedColumns("OUTPUT_AIR", "B")),
            new SectionConfig("산출물 데이터 수집", "OUTPUT", "4. 산출물 데이터 수집", "OUTPUT_WATER", "수계 배출물", 0, -1, 0, 0, 34, 1, 1, 7, 37, 37, 38, 49, List.of(
                    new SectionMetaConfig("wastewaterFacilityInstalled", "사업장 내 1차 하수처리장 설치여부", 35, 1, 35, 3)
            ), templateFixedColumns("OUTPUT_WATER", "B")),
            new SectionConfig("산출물 데이터 수집", "OUTPUT", "4. 산출물 데이터 수집", "OUTPUT_WASTE", "폐기물", 0, -1, 0, 0, 52, 1, 1, 11, 53, 55, 56, 67, List.of(), templateFixedColumns("OUTPUT_WASTE", "B"))
    );
    private static final List<SectionConfig> ADMIN_UPLOAD_WORKBOOK_SECTION_CONFIGS = List.of(
            new SectionConfig("투입물 데이터 수집", "INPUT", "3. 투입물 데이터 수집", "INPUT_RAW_MATERIALS", "원료 물질 및 보조 물질", 3, 7, 2, 3, 8, excelColumnIndex("D"), excelColumnIndex("E"), excelColumnIndex("R"), 9, 11, 12, 18, List.of(), List.of(
                    fixedColumn("group", "구분", "E"),
                    fixedColumn("materialName", "물질명", "F"),
                    fixedColumn("annualUnit", "단위\n(연간)", "I"),
                    fixedColumn("remark", "비고", "Q", "원료물질 수송 (원료 물질에만 기입하여 주시기 바랍니다.)", "비고")
            )),
            new SectionConfig("투입물 데이터 수집", "INPUT", "3. 투입물 데이터 수집", "INPUT_ENERGY", "에너지", 3, 7, 2, 3, 20, excelColumnIndex("D"), excelColumnIndex("E"), excelColumnIndex("M"), 21, 21, 22, 25, List.of(), List.of(
                    fixedColumn("group", "구분", "E"),
                    fixedColumn("materialName", "물질명", "F"),
                    fixedColumn("annualUnit", "단위(연간)", "I"),
                    fixedColumn("remark", "비고", "M")
            )),
            new SectionConfig("투입물 데이터 수집", "INPUT", "3. 투입물 데이터 수집", "INPUT_STEAM", "에너지 스팀", 3, 7, 2, 3, 25, excelColumnIndex("BS"), excelColumnIndex("BT"), excelColumnIndex("CF"), 26, 26, 27, 28, List.of(), List.of(
                    fixedColumn("group", "구분", "BT"),
                    fixedColumn("materialName", "물질명", "BU"),
                    fixedColumn("annualUnit", "단위(연간)", "BW"),
                    fixedColumn("remark", "비고", "CF")
            )),
            new SectionConfig("투입물 데이터 수집", "INPUT", "3. 투입물 데이터 수집", "INPUT_MISC", "기타", 3, 7, 2, 3, 30, excelColumnIndex("D"), excelColumnIndex("E"), excelColumnIndex("L"), 31, 31, 32, 80, List.of(), List.of(
                    fixedColumn("group", "구분", "E"),
                    fixedColumn("materialName", "물질명", "F"),
                    fixedColumn("annualUnit", "단위(연간)", "H"),
                    fixedColumn("remark", "비고", "L")
            )),
            new SectionConfig("산출물 데이터 수집", "OUTPUT", "4. 산출물 데이터 수집", "OUTPUT_PRODUCTS", "제품 및 부산물", 3, 8, 2, 3, 9, excelColumnIndex("D"), excelColumnIndex("E"), excelColumnIndex("M"), 10, 10, 11, 13, List.of(), List.of(
                    fixedColumn("group", "구분", "E"),
                    fixedColumn("materialName", "물질명", "F"),
                    fixedColumn("annualUnit", "단위\n(연간)", "H"),
                    fixedColumn("remark", "비고", "M")
            )),
            new SectionConfig("산출물 데이터 수집", "OUTPUT", "4. 산출물 데이터 수집", "OUTPUT_AIR", "대기 배출물", 3, 8, 2, 3, 15, excelColumnIndex("D"), excelColumnIndex("E"), excelColumnIndex("R"), 16, 16, 17, 23, List.of(), List.of(
                    fixedColumn("group", "구분", "E"),
                    fixedColumn("materialName", "물질명", "F"),
                    fixedColumn("annualUnit", "단위(연간)", "H"),
                    fixedColumn("remark", "비고", "M")
            )),
            new SectionConfig("산출물 데이터 수집", "OUTPUT", "4. 산출물 데이터 수집", "OUTPUT_WATER", "수계 배출물", 3, 8, 2, 3, 25, excelColumnIndex("D"), excelColumnIndex("E"), excelColumnIndex("R"), 28, 28, 29, 33, List.of(
                    new SectionMetaConfig("wastewaterFacilityInstalled", "사업장 내 1차 하수처리장 설치여부", 26, excelColumnIndex("E"), 27, excelColumnIndex("E"))
            ), List.of(
                    fixedColumn("group", "구분", "E"),
                    fixedColumn("materialName", "물질명", "F"),
                    fixedColumn("annualUnit", "단위(연간)", "H"),
                    fixedColumn("remark", "비고", "N")
            )),
            new SectionConfig("산출물 데이터 수집", "OUTPUT", "4. 산출물 데이터 수집", "OUTPUT_WASTE", "폐기물", 3, 8, 2, 3, 35, excelColumnIndex("D"), excelColumnIndex("E"), excelColumnIndex("R"), 36, 38, 39, 120, List.of(), List.of(
                    fixedColumn("group", "구분", "E"),
                    fixedColumn("materialName", "물질명", "F"),
                    fixedColumn("annualUnit", "단위", "H"),
                    fixedColumn("remark", "비고", "R", "재활용 및 최종폐기 과정 수송", "비고")
            ))
    );

    private final DataFormatter formatter = new DataFormatter(Locale.KOREA);
    private final ObjectMapper objectMapper;
    private final AdminEmissionSurveyDraftMapper adminEmissionSurveyDraftMapper;
    private CellStyle templateCellStyle;
    private CellStyle templateTitleStyle;
    private CellStyle templateSectionStyle;
    private CellStyle templateHeaderStyle;
    private CellStyle templateMetaLabelStyle;

    private Map<String, Object> cachedTemplatePayload;
    private long templateLastModified;

    public AdminEmissionSurveyWorkbookServiceImpl(ObjectMapper objectMapper,
                                                 AdminEmissionSurveyDraftMapper adminEmissionSurveyDraftMapper) {
        this.objectMapper = objectMapper;
        this.adminEmissionSurveyDraftMapper = adminEmissionSurveyDraftMapper;
    }

    @Override
    public Map<String, Object> getPagePayload(String actorId, String productName, boolean isEn) {
        Path samplePath = resolveSamplePath();
        if (samplePath != null && Files.exists(samplePath)) {
            try {
                long lastModified = Files.getLastModifiedTime(samplePath).toMillis();
                if (cachedTemplatePayload != null && templateLastModified == lastModified) {
                    Map<String, Object> cloned = new LinkedHashMap<>(cachedTemplatePayload);
                    cloned.put("isEn", isEn);
                    return enrichPagePayloadWithProductSelection(cloned, normalizeProductName(productName), isEn);
                }

                try (InputStream is = Files.newInputStream(samplePath);
                     Workbook workbook = new XSSFWorkbook(is)) {
                    Map<String, List<CellRangeAddress>> mergedRegionsMap = new LinkedHashMap<>();
                    for (int i = 0; i < workbook.getNumberOfSheets(); i++) {
                        Sheet sheet = workbook.getSheetAt(i);
                        mergedRegionsMap.put(sheet.getSheetName(), sheet.getMergedRegions());
                    }

                    Map<String, Object> payload = buildPayload(
                            workbook,
                            DEFAULT_WORKBOOK_NAME,
                            samplePath.toString(),
                            REFERENCE_SAMPLE.toString(),
                            false,
                            storageActorId(),
                            isEn,
                            mergedRegionsMap
                    );
                    this.cachedTemplatePayload = new LinkedHashMap<>(payload);
                    this.templateLastModified = lastModified;
                    return enrichPagePayloadWithProductSelection(new LinkedHashMap<>(payload), normalizeProductName(productName), isEn);
                }
            } catch (Exception e) {
                // Fallback to empty if file fails
            }
        }
        return enrichPagePayloadWithProductSelection(basePayload(storageActorId(), isEn, null, false, List.of()), normalizeProductName(productName), isEn);
    }

    @Override
    public Map<String, Object> parseWorkbook(MultipartFile uploadFile,
                                             String actorId,
                                             String lciMajorCode,
                                             String lciMajorLabel,
                                             String lciMiddleCode,
                                             String lciMiddleLabel,
                                             String lciSmallCode,
                                             String lciSmallLabel,
                                             boolean isEn) {
        Objects.requireNonNull(uploadFile, "uploadFile");
        validateUploadFile(uploadFile, isEn);
        try (InputStream inputStream = new ByteArrayInputStream(uploadFile.getBytes());
             Workbook workbook = new XSSFWorkbook(inputStream)) {
            Map<String, List<CellRangeAddress>> mergedRegionsMap = new LinkedHashMap<>();
            for (int i = 0; i < workbook.getNumberOfSheets(); i++) {
                Sheet sheet = workbook.getSheetAt(i);
                mergedRegionsMap.put(sheet.getSheetName(), sheet.getMergedRegions());
            }
            return buildPayload(
                    workbook,
                    uploadFile.getOriginalFilename(),
                    WORKSPACE_SAMPLE.toString(),
                    REFERENCE_SAMPLE.toString(),
                    true,
                    storageActorId(),
                    isEn,
                    mergedRegionsMap
            );
        } catch (Exception e) {
            return basePayload(storageActorId(), isEn, null, false, List.of());
        }
    }

    @Override
    public Map<String, Object> previewSharedDatasetWorkbook(MultipartFile uploadFile, boolean isEn) {
        Objects.requireNonNull(uploadFile, "uploadFile");
        validateUploadFile(uploadFile, isEn);
        try (InputStream inputStream = new ByteArrayInputStream(uploadFile.getBytes());
             Workbook workbook = new XSSFWorkbook(inputStream)) {
            Map<String, List<CellRangeAddress>> mergedRegionsMap = new LinkedHashMap<>();
            for (int i = 0; i < workbook.getNumberOfSheets(); i++) {
                Sheet sheet = workbook.getSheetAt(i);
                mergedRegionsMap.put(sheet.getSheetName(), sheet.getMergedRegions());
            }
            Map<String, Object> payload = resolveSharedDatasetUploadPayload(
                    workbook,
                    uploadFile.getOriginalFilename(),
                    WORKSPACE_SAMPLE.toString(),
                    REFERENCE_SAMPLE.toString(),
                    storageActorId(),
                    isEn,
                    mergedRegionsMap
            );
            String selectedProductName = resolveSelectedProductName(payload.get("sections"));
            List<Map<String, Object>> existingRows = readDatasetSections(storageActorId(), buildDatasetId(selectedProductName));
            payload.put("selectedProductName", selectedProductName);
            payload.put("existingDatasetSectionRows", existingRows);
            payload.put("hasExistingDataset", !existingRows.isEmpty());
            payload.put("previewMessage", !existingRows.isEmpty()
                    ? (isEn ? "Existing DB data was found. Review it below before deciding whether to replace it with the uploaded file."
                    : "기존 DB 데이터가 있습니다. 업로드 파일로 교체할지 결정하기 전에 아래 내용을 확인하세요.")
                    : (isEn ? "No existing DB data was found. You can apply the uploaded file to DB."
                    : "기존 DB 데이터가 없습니다. 업로드 파일 내용을 DB에 반영할 수 있습니다."));
            return payload;
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException(isEn
                    ? "Failed to preview the uploaded workbook. Please upload a valid .xlsx file."
                    : "업로드한 워크북 미리보기를 생성하지 못했습니다. 올바른 .xlsx 파일인지 확인해 주세요.", e);
        }
    }

    @Override
    public synchronized Map<String, Object> replaceSharedDatasetWorkbook(MultipartFile uploadFile, boolean isEn) {
        Objects.requireNonNull(uploadFile, "uploadFile");
        validateUploadFile(uploadFile, isEn);
        try (InputStream inputStream = new ByteArrayInputStream(uploadFile.getBytes());
             Workbook workbook = new XSSFWorkbook(inputStream)) {
            Map<String, List<CellRangeAddress>> mergedRegionsMap = new LinkedHashMap<>();
            for (int i = 0; i < workbook.getNumberOfSheets(); i++) {
                Sheet sheet = workbook.getSheetAt(i);
                mergedRegionsMap.put(sheet.getSheetName(), sheet.getMergedRegions());
            }
            Map<String, Object> payload = resolveSharedDatasetUploadPayload(
                    workbook,
                    uploadFile.getOriginalFilename(),
                    WORKSPACE_SAMPLE.toString(),
                    REFERENCE_SAMPLE.toString(),
                    storageActorId(),
                    isEn,
                    mergedRegionsMap
            );
            clearSharedDatasetProducts(resolveTargetProductNames((List<Map<String, Object>>) (List<?>) (payload.get("sections") instanceof List<?> ? payload.get("sections") : List.of())));
            Map<String, Object> uploadAudit = saveUploadedWorkbookDataset(
                    payload,
                    storageActorId(),
                    safe(uploadFile.getOriginalFilename()),
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    isEn
            );
            String selectedProductName = resolveSelectedProductName(payload.get("sections"));
            payload.put("selectedProductName", selectedProductName);
            payload.put("uploadAudit", uploadAudit);
            payload.put("selectedDatasetSectionRows", readDatasetSections(storageActorId(), buildDatasetId(selectedProductName)));
            payload.put("message", isEn ? "Uploaded file has been applied to the shared DB dataset." : "업로드 파일 내용을 공통 데이터셋에 반영했습니다.");
            return payload;
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException(isEn
                    ? "Failed to replace the shared dataset from the uploaded workbook."
                    : "업로드 파일로 공통 데이터셋을 교체하지 못했습니다.", e);
        }
    }

    @Override
    public synchronized Map<String, Object> replaceSharedDatasetSections(EmissionSurveyDatasetReplaceRequest request, boolean isEn) {
        if (request == null || request.getSections() == null || request.getSections().isEmpty()) {
            throw new IllegalArgumentException(isEn
                    ? "At least one section is required to replace the shared dataset."
                    : "공통 데이터셋 교체를 위해 최소 1개 이상의 섹션이 필요합니다.");
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("sections", request.getSections());
        payload.put("sourcePath", safe(request.getSourcePath()));
        payload.put("targetPath", safe(request.getTargetPath()));
        clearSharedDatasetProducts(resolveTargetProductNames(request.getSections()));
        Map<String, Object> uploadAudit = saveUploadedWorkbookDataset(
                payload,
                storageActorId(),
                safe(request.getSourceFileName()),
                "",
                "",
                "",
                "",
                "",
                "",
                isEn
        );
        String selectedProductName = resolveSelectedProductName(request.getSections());
        payload.put("selectedProductName", selectedProductName);
        payload.put("uploadAudit", uploadAudit);
        payload.put("selectedDatasetSectionRows", readDatasetSections(storageActorId(), buildDatasetId(selectedProductName)));
        payload.put("message", isEn ? "Mapped dataset sections have been applied to the shared DB dataset." : "매핑된 데이터셋 섹션을 공통 데이터셋에 반영했습니다.");
        return payload;
    }

    private Map<String, Object> buildAdminUploadedPayload(Workbook workbook,
                                                          String sourceFileName,
                                                          String sourcePath,
                                                          String targetPath,
                                                          String actorId,
                                                          boolean isEn,
                                                          Map<String, List<CellRangeAddress>> mergedRegionsMap) {
        List<SectionConfig> adminConfigs = ADMIN_UPLOAD_WORKBOOK_SECTION_CONFIGS;
        List<Map<String, Object>> sections = parseSections(workbook, adminConfigs, false, mergedRegionsMap);
        Map<String, Object> payload = basePayload(actorId, isEn, sourcePath, true, sections);
        payload.put("sourceFileName", sourceFileName == null || sourceFileName.isBlank() ? ADMIN_UPLOAD_WORKBOOK_NAME : sourceFileName);
        payload.put("targetPath", targetPath);
        payload.put("majorOptions", List.of(
                option("INPUT", "3. 투입물 데이터 수집"),
                option("OUTPUT", "4. 산출물 데이터 수집")
        ));
        payload.put("sectionOptions", adminConfigs.stream()
                .map(config -> option(config.sectionCode, config.sectionLabel))
                .collect(Collectors.toList()));
        payload.put("caseOptions", List.of(
                option("CASE_3_1", "3-1 시작"),
                option("CASE_3_2", "3-2 LCI DB를 알고 있는 경우")
        ));
        payload.put("summaryCards", List.of(
                summaryCard("원본 파일", payload.get("sourceFileName"), "관리자 업로드 양식 기준"),
                summaryCard("대분류", "2", "투입물/산출물 2개 분류"),
                summaryCard("중분류", String.valueOf(adminConfigs.size()), "관리자 양식 고정 섹션 수"),
                summaryCard("Case", "2", "3-1 seed / 3-2 empty draft")
        ));
        return payload;
    }

    private Map<String, Object> resolveSharedDatasetUploadPayload(Workbook workbook,
                                                                  String sourceFileName,
                                                                  String sourcePath,
                                                                  String targetPath,
                                                                  String actorId,
                                                                  boolean isEn,
                                                                  Map<String, List<CellRangeAddress>> mergedRegionsMap) {
        if (matchesAdminUploadedWorkbookLayout(workbook, mergedRegionsMap)) {
            return buildAdminUploadedPayload(
                    workbook,
                    sourceFileName,
                    sourcePath,
                    targetPath,
                    actorId,
                    isEn,
                    mergedRegionsMap
            );
        }
        Map<String, Object> adminPayload = buildAdminUploadedPayload(
                workbook,
                sourceFileName,
                sourcePath,
                targetPath,
                actorId,
                isEn,
                mergedRegionsMap
        );
        Map<String, Object> detectedPayload = buildPayload(
                workbook,
                sourceFileName,
                sourcePath,
                targetPath,
                true,
                actorId,
                isEn,
                mergedRegionsMap
        );
        int adminRowCount = totalParsedRowCount((List<Map<String, Object>>) (List<?>) (adminPayload.get("sections") instanceof List<?> ? adminPayload.get("sections") : List.of()));
        int detectedRowCount = totalParsedRowCount((List<Map<String, Object>>) (List<?>) (detectedPayload.get("sections") instanceof List<?> ? detectedPayload.get("sections") : List.of()));
        return detectedRowCount > adminRowCount ? detectedPayload : adminPayload;
    }

    @Override
    public Map<String, Object> loadClassificationCaseDrafts(String lciMajorCode,
                                                            String lciMiddleCode,
                                                            String lciSmallCode,
                                                            String caseCode,
                                                            String productName,
                                                            String actorId,
                                                            boolean isEn) {
        String resolvedMajorCode = safe(lciMajorCode);
        String resolvedMiddleCode = safe(lciMiddleCode);
        String resolvedSmallCode = safe(lciSmallCode);
        String resolvedCaseCode = safe(caseCode);
        String resolvedProductName = normalizeProductName(productName);
        if (resolvedMajorCode.isEmpty() || resolvedMiddleCode.isEmpty()) {
            throw new IllegalArgumentException(isEn
                    ? "Select the LCI major and middle classifications first."
                    : "LCI 대분류와 중분류를 먼저 선택하세요.");
        }
        if (resolvedCaseCode.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Case code is required." : "caseCode는 필수입니다.");
        }
        Map<String, Map<String, Object>> matchedCaseMap = readDraftRegistryByClassification(
                storageActorId(),
                resolvedMajorCode,
                resolvedMiddleCode,
                resolvedSmallCode,
                resolvedCaseCode,
                resolvedProductName
        );
        if (matchedCaseMap.isEmpty()) {
            matchedCaseMap = readLatestSharedCaseMap(resolvedCaseCode, resolvedProductName);
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("lciMajorCode", resolvedMajorCode);
        response.put("lciMiddleCode", resolvedMiddleCode);
        response.put("lciSmallCode", resolvedSmallCode);
        response.put("caseCode", resolvedCaseCode);
        response.put("productName", resolvedProductName);
        response.put("matchedCaseMap", matchedCaseMap);
        response.put("matchedCount", matchedCaseMap.size());
        response.put("message", matchedCaseMap.isEmpty()
                ? (isEn ? "No saved DB draft was found for the selected LCI classification." : "선택한 LCI 분류로 저장된 DB 초안이 없습니다.")
                : (isEn ? "Loaded saved DB drafts for the selected LCI classification." : "선택한 LCI 분류 기준 DB 초안을 불러왔습니다."));
        return response;
    }

    private Map<String, Map<String, Object>> readLatestSharedCaseMap(String caseCode, String productName) {
        Map<String, Map<String, Object>> latestBySection = new LinkedHashMap<>();
        for (Map<String, Object> row : readDraftRegistry(storageActorId()).values()) {
            if (!buildDatasetId(productName).equals(safeObject(row.get("datasetId")))) {
                continue;
            }
            if (!safe(caseCode).equals(safeObject(row.get("caseCode")))) {
                continue;
            }
            String sectionCode = safeObject(row.get("sectionCode"));
            if (sectionCode.isEmpty()) {
                continue;
            }
            Map<String, Object> current = latestBySection.get(sectionCode);
            if (current == null || safeObject(current.get("savedAt")).compareTo(safeObject(row.get("savedAt"))) < 0) {
                latestBySection.put(sectionCode, new LinkedHashMap<>(row));
            }
        }
        Map<String, Map<String, Object>> matched = new LinkedHashMap<>();
        for (Map<String, Object> row : latestBySection.values()) {
            matched.put(safeObject(row.get("sectionCode")) + ":" + safeObject(row.get("caseCode")), row);
        }
        return matched;
    }

    @Override
    public Map<String, Object> getDataPagePayload(String actorId,
                                                  String lciMajorCode,
                                                  String lciMiddleCode,
                                                  String lciSmallCode,
                                                  String status,
                                                  String datasetId,
                                                  String logId,
                                                  int pageIndex,
                                                  int pageSize,
                                                  boolean isEn) {
        String resolvedActorId = storageActorId();
        String resolvedMajorCode = safe(lciMajorCode);
        String resolvedMiddleCode = safe(lciMiddleCode);
        String resolvedSmallCode = safe(lciSmallCode);
        String resolvedStatus = safe(status);
        String resolvedDatasetId = safe(datasetId);
        String resolvedLogId = safe(logId);
        int resolvedPageSize = Math.max(1, Math.min(pageSize, 50));
        int resolvedPageIndex = Math.max(pageIndex, 1);
        List<Map<String, Object>> datasetRows = readDatasetSummaries(resolvedActorId, resolvedMajorCode, resolvedMiddleCode, resolvedSmallCode);
        List<Map<String, Object>> allUploadLogRows = readUploadLogs(resolvedActorId, resolvedMajorCode, resolvedMiddleCode, resolvedSmallCode, resolvedStatus);
        int logCount = allUploadLogRows.size();
        int totalPages = Math.max(1, (int) Math.ceil(logCount / (double) resolvedPageSize));
        if (resolvedPageIndex > totalPages) {
            resolvedPageIndex = totalPages;
        }
        List<Map<String, Object>> uploadLogRows = paginateRows(allUploadLogRows, resolvedPageIndex, resolvedPageSize);
        String selectedDatasetId = resolvedDatasetId;
        if (selectedDatasetId.isEmpty() && !datasetRows.isEmpty()) {
            selectedDatasetId = safeObject(datasetRows.get(0).get("datasetId"));
        }
        String selectedLogId = resolvedLogId;
        if (selectedLogId.isEmpty() && !allUploadLogRows.isEmpty()) {
            selectedLogId = safeObject(allUploadLogRows.get(0).get("logId"));
        }
        List<Map<String, Object>> datasetSectionRows = selectedDatasetId.isEmpty()
                ? List.of()
                : readDatasetSections(resolvedActorId, selectedDatasetId);
        final String selectedLogKey = selectedLogId;
        Map<String, Object> selectedLog = allUploadLogRows.stream()
                .filter(row -> selectedLogKey.equals(safeObject(row.get("logId"))))
                .findFirst()
                .orElseGet(LinkedHashMap::new);
        int datasetCount = datasetRows.size();
        int totalRowCount = datasetRows.stream().mapToInt(row -> parseInteger(row.get("rowCount"))).sum();
        long successCount = allUploadLogRows.stream()
                .filter(row -> "SUCCESS".equalsIgnoreCase(safeObject(row.get("resultStatus"))))
                .count();

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("isEn", isEn);
        payload.put("menuCode", "A0020112");
        payload.put("pageTitle", isEn ? "Shared Dataset Excel Apply" : "공통 데이터셋 엑셀 반영");
        payload.put("pageDescription", isEn
                ? "Upload a workbook, compare it with the current DB dataset, and decide whether to replace the shared dataset."
                : "엑셀 파일을 업로드해 현재 DB 데이터와 비교한 뒤, 공통 데이터셋 반영 여부를 결정합니다.");
        payload.put("currentActorId", sharedDatasetName(isEn));
        payload.put("lciMajorCode", resolvedMajorCode);
        payload.put("lciMiddleCode", resolvedMiddleCode);
        payload.put("lciSmallCode", resolvedSmallCode);
        payload.put("status", resolvedStatus);
        payload.put("datasetId", selectedDatasetId);
        payload.put("logId", selectedLogId);
        payload.put("pageIndex", resolvedPageIndex);
        payload.put("pageSize", resolvedPageSize);
        payload.put("totalCount", logCount);
        payload.put("totalPages", totalPages);
        payload.put("summaryCards", List.of(
                summaryCard(isEn ? "Datasets" : "데이터셋", datasetCount, isEn ? "Shared dataset count" : "공통 데이터셋 개수"),
                summaryCard(isEn ? "Upload Logs" : "업로드 로그", logCount, isEn ? "Captured upload executions" : "기록된 업로드 실행"),
                summaryCard(isEn ? "Success Logs" : "성공 로그", successCount, isEn ? "Upload and save completed" : "업로드 및 저장 완료"),
                summaryCard(isEn ? "Saved Rows" : "저장 행 수", totalRowCount, isEn ? "Rows persisted in the shared dataset" : "공통 데이터셋 기준 누적 행 수")
        ));
        payload.put("statusOptions", List.of(
                option("", isEn ? "All" : "전체"),
                option("SUCCESS", isEn ? "Success" : "성공"),
                option("PARSE_ONLY", isEn ? "Parse Only" : "파싱만"),
                option("FAILED", isEn ? "Failed" : "실패")
        ));
        payload.put("datasetRows", datasetRows);
        payload.put("uploadLogRows", uploadLogRows);
        payload.put("selectedDatasetSectionRows", datasetSectionRows);
        payload.put("selectedLog", selectedLog);
        payload.put("selectedLogSectionResults", parseJsonListOfObjects(safeObject(selectedLog.get("sectionResultJson"))));
        return payload;
    }

    @Override
    public synchronized Map<String, Object> saveCaseDraft(EmissionSurveyCaseSaveRequest request, String actorId, boolean isEn) {
        String sectionCode = safe(request.getSectionCode());
        String caseCode = safe(request.getCaseCode());
        String resolvedOwnerActorId = storageActorId();
        if (sectionCode.isEmpty() || caseCode.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Section code and case code are required." : "sectionCode와 caseCode는 필수입니다.");
        }
        request.setOwnerActorId(resolvedOwnerActorId);
        String resolvedProductName = normalizeProductName(request.getProductName());
        request.setProductName(resolvedProductName);
        request.setDatasetId(buildDatasetId(resolvedProductName));
        request.setDatasetName(sharedDatasetName(isEn, resolvedProductName));
        List<Map<String, Object>> normalizedRows = normalizeRowsForStorage(sectionCode, request.getRows());
        request.setRows(normalizedRows);
        request.setColumns(normalizeSurveySectionColumns(sectionCode, request.getColumns()));
        Map<String, Map<String, Object>> registry = readDraftRegistryFromFile();
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("ownerActorId", resolvedOwnerActorId);
        row.put("datasetId", safe(request.getDatasetId()));
        row.put("datasetName", safe(request.getDatasetName()));
        row.put("productName", safe(request.getProductName()));
        row.put("sectionCode", sectionCode);
        row.put("caseCode", caseCode);
        row.put("majorCode", safe(request.getMajorCode()));
        row.put("lciMajorCode", safe(request.getLciMajorCode()));
        row.put("lciMajorLabel", safe(request.getLciMajorLabel()));
        row.put("lciMiddleCode", safe(request.getLciMiddleCode()));
        row.put("lciMiddleLabel", safe(request.getLciMiddleLabel()));
        row.put("lciSmallCode", safe(request.getLciSmallCode()));
        row.put("lciSmallLabel", safe(request.getLciSmallLabel()));
        row.put("sectionLabel", safe(request.getSectionLabel()));
        row.put("sourceFileName", safe(request.getSourceFileName()));
        row.put("sourcePath", safe(request.getSourcePath()));
        row.put("targetPath", safe(request.getTargetPath()));
        row.put("titleRowLabel", safe(request.getTitleRowLabel()));
        row.put("guidance", request.getGuidance() == null ? List.of() : request.getGuidance());
        row.put("columns", request.getColumns() == null ? List.of() : request.getColumns());
        row.put("actorId", safe(actorId));
        row.put("savedAt", LocalDateTime.now().format(TIMESTAMP_FORMATTER));
        row.put("rows", normalizedRows);
        registry.put(buildRegistryKey(request), row);
        writeDraftRegistry(registry);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("saved", true);
        response.put("draftKey", buildRegistryKey(request));
        response.put("savedAt", row.get("savedAt"));
        response.put("storageMode", isDraftTableReady() ? "database+file" : "file");
        response.put("message", isEn ? "Survey case draft saved." : "설문 케이스 초안을 저장했습니다.");
        if (isDraftTableReady()) {
            saveCaseDraftToDatabase(request, actorId);
            response.put("savedCaseMap", readDraftRegistry(storageActorId()));
        } else {
            response.put("savedCaseMap", registry);
        }
        return response;
    }

    private List<Map<String, Object>> normalizeRowsForStorage(String sectionCode, List<Map<String, Object>> rows) {
        if (rows == null) {
            return List.of();
        }
        List<Map<String, Object>> normalizedRows = new ArrayList<>();
        for (Map<String, Object> sourceRow : rows) {
            Map<String, Object> normalizedRow = new LinkedHashMap<>();
            normalizedRow.put("rowId", sourceRow == null ? "" : safeObject(sourceRow.get("rowId")));
            Map<String, String> sourceValues = sourceRow == null || !(sourceRow.get("values") instanceof Map<?, ?>)
                    ? new LinkedHashMap<>()
                    : toStringMap((Map<?, ?>) sourceRow.get("values"));
            normalizedRow.put("values", normalizeStoredRowValues(sectionCode, sourceValues));
            normalizedRows.add(normalizedRow);
        }
        return normalizedRows;
    }

    private Map<String, String> normalizeStoredRowValues(String sectionCode, Map<String, String> values) {
        Map<String, String> sourceValues = values == null ? new LinkedHashMap<>() : new LinkedHashMap<>(values);
        if (!"OUTPUT_AIR".equalsIgnoreCase(safe(sectionCode))) {
            return sourceValues;
        }
        Map<String, String> normalizedValues = new LinkedHashMap<>();
        normalizedValues.put("group", safe(sourceValues.get("group")));
        normalizedValues.put("materialName", safe(sourceValues.get("materialName")));
        normalizedValues.put("annualUnit", safe(sourceValues.get("annualUnit")));
        normalizedValues.put("remark", safe(sourceValues.get("remark")));
        normalizedValues.put("emissionFactor", resolveStoredEmissionFactor(sourceValues));
        return normalizedValues;
    }

    private String resolveStoredEmissionFactor(Map<String, String> values) {
        if (values == null) {
            return "";
        }
        for (String key : List.of("emissionFactor", "gwpValue", "gwpDirectValue", "gwpReferenceValue")) {
            String value = safe(values.get(key));
            if (!value.isEmpty()) {
                return value;
            }
        }
        return "";
    }

    private Map<String, String> toStringMap(Map<?, ?> source) {
        Map<String, String> result = new LinkedHashMap<>();
        if (source == null) {
            return result;
        }
        for (Map.Entry<?, ?> entry : source.entrySet()) {
            result.put(safeObject(entry.getKey()), safeObject(entry.getValue()));
        }
        return result;
    }

    @Override
    public synchronized Map<String, Object> deleteCaseDraft(String sectionCode, String caseCode, String productName, String actorId, boolean isEn) {
        String resolvedSectionCode = safe(sectionCode);
        String resolvedCaseCode = safe(caseCode);
        String resolvedProductName = normalizeProductName(productName);
        String resolvedActorId = storageActorId();
        if (resolvedSectionCode.isEmpty() || resolvedCaseCode.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Section code and case code are required." : "sectionCode와 caseCode는 필수입니다.");
        }
        Map<String, Map<String, Object>> registry = readDraftRegistryFromFile();
        registry.entrySet().removeIf(entry -> matchesSectionAndCase(entry.getValue(), resolvedSectionCode, resolvedCaseCode)
                && matchesProduct(entry.getValue(), resolvedProductName)
                && matchesOwner(entry.getValue(), resolvedActorId));
        writeDraftRegistry(registry);
        if (isDraftTableReady()) {
            deleteCaseDraftFromDatabase(resolvedSectionCode, resolvedCaseCode, resolvedProductName, resolvedActorId);
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("deleted", true);
        response.put("draftKey", resolvedSectionCode + ":" + resolvedCaseCode);
        response.put("productName", resolvedProductName);
        response.put("savedCaseMap", readDraftRegistry(resolvedActorId));
        response.put("message", isEn ? "Survey case draft deleted." : "설문 케이스 초안을 삭제했습니다.");
        return response;
    }

    private void validateUploadFile(MultipartFile uploadFile, boolean isEn) {
        if (uploadFile.isEmpty()) {
            throw new IllegalArgumentException(isEn
                    ? "The upload file is empty."
                    : "업로드 파일이 비어 있습니다.");
        }
        String originalFilename = uploadFile.getOriginalFilename();
        String lowerName = originalFilename == null ? "" : originalFilename.toLowerCase(Locale.ROOT);
        if (!lowerName.endsWith(".xlsx")) {
            throw new IllegalArgumentException(isEn
                    ? "Only .xlsx workbooks are supported."
                    : ".xlsx 형식의 워크북만 지원합니다.");
        }
    }

    private Map<String, Object> buildPayload(Workbook workbook,
                                             String sourceFileName,
                                             String sourcePath,
                                             String targetPath,
                                             boolean uploaded,
                                             String actorId,
                                             boolean isEn) {
        Map<String, List<CellRangeAddress>> mergedRegionsMap = new LinkedHashMap<>();
        if (workbook != null) {
            for (int i = 0; i < workbook.getNumberOfSheets(); i++) {
                Sheet sheet = workbook.getSheetAt(i);
                mergedRegionsMap.put(sheet.getSheetName(), sheet.getMergedRegions());
            }
        }
        return buildPayload(workbook, sourceFileName, sourcePath, targetPath, uploaded, actorId, isEn, mergedRegionsMap);
    }

    private Map<String, Object> buildPayload(Workbook workbook,
                                             String sourceFileName,
                                             String sourcePath,
                                             String targetPath,
                                             boolean uploaded,
                                             String actorId,
                                             boolean isEn,
                                             Map<String, List<CellRangeAddress>> mergedRegionsMap) {
        boolean adminUploadedWorkbookLayout = matchesAdminUploadedWorkbookLayout(workbook, mergedRegionsMap);
        boolean uploadedWorkbookLayout = matchesUploadedWorkbookLayout(workbook, mergedRegionsMap);
        boolean generatedTemplate = isGeneratedTemplate(workbook) && !uploadedWorkbookLayout && !adminUploadedWorkbookLayout;
        List<SectionConfig> sectionConfigs = resolveSectionConfigs(uploaded, generatedTemplate, uploadedWorkbookLayout, adminUploadedWorkbookLayout);
        List<Map<String, Object>> sections = parseSections(workbook, sectionConfigs, generatedTemplate, mergedRegionsMap);
        if (uploaded && !generatedTemplate && totalParsedRowCount(sections) <= 0) {
            sections = resolveUploadedSectionsByRowCount(workbook, mergedRegionsMap, sectionConfigs, sections);
            sectionConfigs = resolveSectionConfigsForParsedSections(sectionConfigs, sections);
        }
        LinkedHashSet<String> majorCodes = new LinkedHashSet<>();
        LinkedHashMap<String, String> sectionOptions = new LinkedHashMap<>();

        for (Map<String, Object> section : sections) {
            String majorCode = safeObject(section.get("majorCode"));
            String sectionCode = safeObject(section.get("sectionCode"));
            String sectionLabel = safeObject(section.get("sectionLabel"));
            if (!majorCode.isBlank()) {
                majorCodes.add(majorCode);
            }
            if (!sectionCode.isBlank()) {
                sectionOptions.put(sectionCode, sectionLabel);
            }
        }

        Map<String, Object> payload = basePayload(actorId, isEn, sourcePath, uploaded, sections);
        payload.put("sourceFileName", sourceFileName == null || sourceFileName.isBlank() ? DEFAULT_WORKBOOK_NAME : sourceFileName);
        payload.put("targetPath", targetPath);
        payload.put("majorOptions", List.of(
                option("INPUT", "3. 투입물 데이터 수집"),
                option("OUTPUT", "4. 산출물 데이터 수집")
        ));
        payload.put("sectionOptions", sectionOptions.entrySet().stream()
                .map(entry -> option(entry.getKey(), entry.getValue()))
                .collect(Collectors.toList()));
        payload.put("caseOptions", List.of(
                option("CASE_3_1", "3-1 시작"),
                option("CASE_3_2", "3-2 LCI DB를 알고 있는 경우")
        ));
        payload.put("summaryCards", List.of(
                summaryCard("원본 파일", payload.get("sourceFileName"), uploaded ? "업로드된 워크북 기준" : "기본 참조 워크북 기준"),
                summaryCard("대분류", String.valueOf(majorCodes.size()), "투입물/산출물 2개 분류"),
                summaryCard("중분류", String.valueOf(sectionOptions.size()), "엑셀에서 추출한 데이터 섹션 수"),
                summaryCard("Case", "2", "3-1 seed / 3-2 empty draft")
        ));
        return payload;
    }

    private List<Map<String, Object>> parseSections(Workbook workbook,
                                                    List<SectionConfig> sectionConfigs,
                                                    boolean generatedTemplate,
                                                    Map<String, List<CellRangeAddress>> mergedRegionsMap) {
        List<Map<String, Object>> sections = new ArrayList<>();
        for (SectionConfig config : sectionConfigs) {
            Sheet sheet = workbook.getSheet(config.sheetName);
            if (sheet == null) {
                continue;
            }
            Map<String, Object> section = parseSection(
                    sheet,
                    config,
                    sectionConfigs,
                    generatedTemplate,
                    mergedRegionsMap.getOrDefault(config.sheetName, sheet.getMergedRegions())
            );
            sections.add(section);
        }
        return sections;
    }

    private List<Map<String, Object>> resolveUploadedSectionsByRowCount(Workbook workbook,
                                                                        Map<String, List<CellRangeAddress>> mergedRegionsMap,
                                                                        List<SectionConfig> detectedConfigs,
                                                                        List<Map<String, Object>> detectedSections) {
        int detectedRowCount = totalParsedRowCount(detectedSections);
        List<Map<String, Object>> adminSections = parseSections(workbook, ADMIN_UPLOAD_WORKBOOK_SECTION_CONFIGS, false, mergedRegionsMap);
        int adminRowCount = totalParsedRowCount(adminSections);
        List<Map<String, Object>> uploadedSections = parseSections(workbook, UPLOADED_WORKBOOK_SECTION_CONFIGS, false, mergedRegionsMap);
        int uploadedRowCount = totalParsedRowCount(uploadedSections);

        if (adminRowCount > Math.max(detectedRowCount, uploadedRowCount)) {
            return adminSections;
        }
        if (uploadedRowCount > Math.max(detectedRowCount, adminRowCount)) {
            return uploadedSections;
        }
        return detectedSections;
    }

    private List<SectionConfig> resolveSectionConfigsForParsedSections(List<SectionConfig> fallbackConfigs,
                                                                       List<Map<String, Object>> sections) {
        LinkedHashSet<String> sectionCodes = sections.stream()
                .map(section -> safeObject(section.get("sectionCode")))
                .filter(code -> !code.isBlank())
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (sectionCodes.isEmpty()) {
            return fallbackConfigs;
        }
        List<List<SectionConfig>> candidates = List.of(
                ADMIN_UPLOAD_WORKBOOK_SECTION_CONFIGS,
                UPLOADED_WORKBOOK_SECTION_CONFIGS,
                TEMPLATE_SECTION_CONFIGS,
                SECTION_CONFIGS
        );
        for (List<SectionConfig> candidate : candidates) {
            LinkedHashSet<String> candidateCodes = candidate.stream()
                    .map(config -> config.sectionCode)
                    .collect(Collectors.toCollection(LinkedHashSet::new));
            if (candidateCodes.equals(sectionCodes)) {
                return candidate;
            }
        }
        return fallbackConfigs;
    }

    private int totalParsedRowCount(List<Map<String, Object>> sections) {
        if (sections == null) {
            return 0;
        }
        return sections.stream()
                .map(section -> section.get("rows"))
                .mapToInt(this::countRows)
                .sum();
    }

    private Map<String, Object> basePayload(String actorId, boolean isEn, String sourcePath, boolean uploaded, List<Map<String, Object>> sections) {
        String storageActorId = storageActorId();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("isEn", isEn);
        payload.put("menuCode", MENU_CODE);
        payload.put("currentActorId", sharedDatasetName(isEn));
        payload.put("pageTitle", isEn ? "Emission Survey Management" : "배출 설문 관리");
        payload.put("pageDescription", isEn
                ? "Upload the workbook into one shared dataset and edit paired 3-1/3-2 cases by LCI classification."
                : "엑셀을 하나의 공통 데이터셋으로 저장하고, LCI 분류 기준 3-1/3-2 케이스를 편집합니다.");
        payload.put("sourcePath", sourcePath == null ? "" : sourcePath);
        payload.put("uploaded", uploaded);
        payload.put("workbookGuidance", WORKBOOK_GUIDANCE);
        payload.put("sections", sections);
        payload.put("savedCaseMap", readDraftRegistry(storageActorId));
        payload.put("savedSetMap", readSetRegistry());
        payload.put("uploadLogRows", readUploadLogs(storageActorId, "", "", "", ""));
        payload.put("selectedDatasetSectionRows", readDatasetSections(storageActorId, buildDatasetId("")));
        return payload;
    }

    @Override
    public synchronized Map<String, Object> saveDraftSet(EmissionSurveyDraftSetSaveRequest request, String actorId, boolean isEn) {
        String setName = safe(request.getSetName());
        if (setName.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Set name is required." : "세트명은 필수입니다.");
        }
        String setId = safe(request.getSetId()).isBlank()
                ? "SET_" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
                : safe(request.getSetId());
        Map<String, Map<String, Object>> registry = readSetRegistry();
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("setId", setId);
        row.put("setName", setName);
        row.put("sourceFileName", safe(request.getSourceFileName()));
        row.put("sourcePath", safe(request.getSourcePath()));
        row.put("targetPath", safe(request.getTargetPath()));
        row.put("actorId", safe(actorId));
        row.put("savedAt", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        row.put("sectionCount", request.getSections() == null ? 0 : request.getSections().size());
        row.put("sections", request.getSections() == null ? List.of() : request.getSections());
        registry.put(setId, row);
        writeRegistry(SET_REGISTRY_PATH, registry);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("saved", true);
        response.put("setId", setId);
        response.put("savedAt", row.get("savedAt"));
        response.put("savedSetMap", registry);
        response.put("message", isEn ? "Draft set saved." : "초안 세트를 저장했습니다.");
        return response;
    }

    @Override
    public synchronized Map<String, Object> deleteDraftSet(String setId, boolean isEn) {
        String resolvedSetId = safe(setId);
        if (resolvedSetId.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Set id is required." : "setId는 필수입니다.");
        }
        Map<String, Map<String, Object>> registry = readSetRegistry();
        registry.remove(resolvedSetId);
        writeRegistry(SET_REGISTRY_PATH, registry);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("deleted", true);
        response.put("setId", resolvedSetId);
        response.put("savedSetMap", registry);
        response.put("message", isEn ? "Draft set deleted." : "초안 세트를 삭제했습니다.");
        return response;
    }

    private Map<String, Object> parseSection(Sheet sheet,
                                             SectionConfig config,
                                             List<SectionConfig> activeConfigs,
                                             boolean generatedTemplate,
                                             List<CellRangeAddress> mergedRegions) {
        List<FixedColumnConfig> fixedColumns = config.fixedColumns;
        List<Map<String, String>> columns = fixedColumns == null || fixedColumns.isEmpty()
                ? parseColumns(sheet, config, mergedRegions)
                : parseFixedColumns(fixedColumns);
        List<Map<String, Object>> rows = fixedColumns == null || fixedColumns.isEmpty()
                ? parseRows(sheet, config, columns, activeConfigs, generatedTemplate, mergedRegions)
                : parseRowsByFixedColumns(sheet, config, fixedColumns, activeConfigs, generatedTemplate, mergedRegions);
        Map<String, Object> section = new LinkedHashMap<>();
        section.put("sectionCode", config.sectionCode);
        section.put("majorCode", config.majorCode);
        section.put("majorLabel", config.majorLabel);
        section.put("sectionLabel", config.sectionLabel);
        section.put("sheetName", config.sheetName);
        String titleRowLabel = readMergedValue(sheet, mergedRegions, config.titleRow, config.titleCol);
        section.put("titleRowLabel", titleRowLabel.isBlank() ? config.sectionLabel : titleRowLabel);
        section.put("guidance", readGuidance(sheet, mergedRegions, config.guidanceStartRow, config.guidanceEndRow, config.guidanceMarkerCol, config.guidanceTextCol));
        section.put("metadata", parseSectionMetadata(sheet, mergedRegions, config));
        section.put("columns", columns);
        section.put("rows", rows);
        return section;
    }

    private Map<String, Object> parseSection(Sheet sheet,
                                             SectionConfig config,
                                             List<SectionConfig> activeConfigs,
                                             boolean generatedTemplate) {
        return parseSection(sheet, config, activeConfigs, generatedTemplate, sheet == null ? List.of() : sheet.getMergedRegions());
    }

    private List<Map<String, String>> parseFixedColumns(List<FixedColumnConfig> fixedColumns) {
        return fixedColumns.stream()
                .map(column -> column(column.key, column.label, column.headerPath))
                .collect(Collectors.toList());
    }

    private List<Map<String, String>> parseColumns(Sheet sheet, SectionConfig config, List<CellRangeAddress> mergedRegions) {
        List<Map<String, String>> columns = new ArrayList<>();
        for (int colIndex = config.startCol; colIndex <= config.endCol; colIndex++) {
            LinkedHashSet<String> labels = new LinkedHashSet<>();
            for (int rowIndex = config.headerStartRow; rowIndex <= config.headerEndRow; rowIndex++) {
                String value = normalizeLabel(readMergedValue(sheet, mergedRegions, rowIndex, colIndex));
                if (!value.isBlank() && !"…".equals(value) && !"...".equals(value)) {
                    labels.add(value);
                }
            }
            if (labels.isEmpty()) {
                continue;
            }
            String label = String.join(" / ", labels);
            Map<String, String> column = new LinkedHashMap<>();
            column.put("key", sanitizeKey(label, colIndex));
            column.put("label", label);
            columns.add(column);
        }
        return columns;
    }

    private List<Map<String, Object>> parseRowsByFixedColumns(Sheet sheet,
                                                              SectionConfig config,
                                                              List<FixedColumnConfig> fixedColumns,
                                                              List<SectionConfig> activeConfigs,
                                                              boolean generatedTemplate,
                                                              List<CellRangeAddress> mergedRegions) {
        List<Map<String, Object>> rows = new ArrayList<>();
        int rowStart = resolveDataStartRow(sheet, config, mergedRegions);
        int rowEnd = resolveDataEndRow(sheet, config, activeConfigs, generatedTemplate, mergedRegions);
        String lastMeaningfulGroupValue = "";
        for (int rowIndex = rowStart; rowIndex <= rowEnd; rowIndex++) {
            Map<String, String> values = new LinkedHashMap<>();
            for (FixedColumnConfig fixedColumn : fixedColumns) {
                values.put(fixedColumn.key, normalizeValue(readMergedValue(sheet, mergedRegions, rowIndex, fixedColumn.colIndex)));
            }
            String currentGroupValue = normalizeValue(values.get("group"));
            String currentMaterialName = normalizeValue(values.get("materialName"));
            if (currentGroupValue.isBlank()
                    && !currentMaterialName.isBlank()
                    && !"물질명".equals(currentMaterialName)
                    && !lastMeaningfulGroupValue.isBlank()) {
                values.put("group", lastMeaningfulGroupValue);
            }
            if (shouldSkipFixedColumnRow(config, values)) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("rowId", config.sectionCode + "_" + (rowIndex + 1));
            row.put("values", values);
            row.put("templateRow", true);
            rows.add(row);
            String resolvedGroupValue = normalizeValue(values.get("group"));
            if (!resolvedGroupValue.isBlank() && !"구분".equals(resolvedGroupValue)) {
                lastMeaningfulGroupValue = resolvedGroupValue;
            }
        }
        return rows;
    }

    private int resolveDataStartRow(Sheet sheet, SectionConfig config, List<CellRangeAddress> mergedRegions) {
        if (!isAdminUploadSection(config)) {
            return config.dataStartRow;
        }
        int headerRow = findAdminUploadHeaderRow(sheet, config, config.fixedColumns, mergedRegions);
        if (headerRow >= 0) {
            return headerRow + 1;
        }
        return config.dataStartRow;
    }

    private boolean shouldSkipFixedColumnRow(SectionConfig config, Map<String, String> values) {
        return isExamplePlaceholderRow(values)
                || isEmptyRow(values)
                || isGroupOnlyRow(values)
                || isHeaderLikeRow(values)
                || isInputSteamLeakRow(config, values)
                || isOutputAirMetadataLeakRow(config, values)
                || containsGuideMarker(values)
                || isSectionOrMetadataTitleRow(config, values)
                || !hasMeaningfulGroupValue(config, values);
    }

    private boolean isInputSteamLeakRow(SectionConfig config, Map<String, String> values) {
        if (config == null || values == null || !"INPUT_STEAM".equals(config.sectionCode)) {
            return false;
        }
        String materialName = normalizeValue(values.get("materialName"));
        String steamType = normalizeValue(values.get("steamType"));
        if (materialName.contains("스팀")) {
            return false;
        }
        return !steamType.isBlank()
                && !steamType.contains("포화증기")
                && !steamType.contains("습증기")
                && !steamType.contains("과열증기");
    }

    private boolean isOutputAirMetadataLeakRow(SectionConfig config, Map<String, String> values) {
        if (config == null || values == null || !"OUTPUT_AIR".equals(config.sectionCode)) {
            return false;
        }
        String groupValue = normalizeValue(values.get("group"));
        String materialName = normalizeValue(values.get("materialName"));
        if (groupValue.isBlank() || !groupValue.equals(materialName)) {
            return false;
        }
        boolean onlyDuplicateHeaderValue = values.entrySet().stream()
                .filter(entry -> !"group".equals(entry.getKey()) && !"materialName".equals(entry.getKey()))
                .map(Map.Entry::getValue)
                .allMatch(this::isBlankCellValue);
        if (!onlyDuplicateHeaderValue) {
            return false;
        }
        return "사업장 내 1차 하수처리장 설치여부".equals(groupValue)
                || "o".equalsIgnoreCase(groupValue);
    }

    private List<Map<String, Object>> parseRows(Sheet sheet,
                                                SectionConfig config,
                                                List<Map<String, String>> columns,
                                                List<SectionConfig> activeConfigs,
                                                boolean generatedTemplate,
                                                List<CellRangeAddress> mergedRegions) {
        List<Map<String, Object>> rows = new ArrayList<>();
        int rowEnd = resolveDataEndRow(sheet, config, activeConfigs, generatedTemplate, mergedRegions);
        for (int rowIndex = config.dataStartRow; rowIndex <= rowEnd; rowIndex++) {
            Map<String, String> values = new LinkedHashMap<>();
            int colPointer = 0;
            for (int colIndex = config.startCol; colIndex <= config.endCol; colIndex++) {
                if (colPointer >= columns.size()) {
                    break;
                }
                String label = columns.get(colPointer).get("label");
                String key = columns.get(colPointer).get("key");
                String value = normalizeValue(readMergedValue(sheet, mergedRegions, rowIndex, colIndex));
                if (!label.isBlank()) {
                    values.put(key, value);
                    colPointer++;
                }
            }
            if (isExamplePlaceholderRow(values) || isEmptyRow(values)) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("rowId", config.sectionCode + "_" + (rowIndex + 1));
            row.put("values", values);
            row.put("templateRow", true);
            rows.add(row);
        }
        return rows;
    }

    private int resolveDataEndRow(Sheet sheet,
                                   SectionConfig config,
                                   List<SectionConfig> activeConfigs,
                                   boolean generatedTemplate,
                                   List<CellRangeAddress> mergedRegions) {
        if (sheet == null) {
            return config.dataEndRow;
        }
        if (isAdminUploadSection(config)) {
            return resolveAdminUploadDataEndRow(sheet, config, mergedRegions);
        }
        int sheetLastRow = Math.max(config.dataEndRow, sheet.getLastRowNum());
        for (int rowIndex = config.dataStartRow; rowIndex <= sheetLastRow; rowIndex++) {
            if (rowIndex <= config.dataStartRow) {
                continue;
            }
            if (isNextSectionTitleRow(sheet, config, activeConfigs, rowIndex, mergedRegions)) {
                return Math.max(config.dataStartRow, rowIndex - 1);
            }
        }
        return generatedTemplate || usesLeftAlignedWorkbookLayout(config)
                ? sheetLastRow
                : config.dataEndRow;
    }

    private int resolveAdminUploadDataEndRow(Sheet sheet,
                                             SectionConfig config,
                                             List<CellRangeAddress> mergedRegions) {
        int sheetLastRow = Math.max(sheet.getLastRowNum(), config.dataEndRow);
        if ("INPUT_ENERGY".equals(config.sectionCode)) {
            for (int rowIndex = config.dataStartRow; rowIndex <= sheetLastRow; rowIndex++) {
                if (rowIndex == config.dataStartRow) {
                    continue;
                }
                Map<String, String> values = readFixedColumnValues(sheet, mergedRegions, rowIndex, config.fixedColumns);
                if (isHeaderLikeRow(values)) {
                    return rowIndex - 1;
                }
            }
        }
        int nextTitleRow = ADMIN_UPLOAD_WORKBOOK_SECTION_CONFIGS.stream()
                .filter(candidate -> !candidate.sectionCode.equals(config.sectionCode))
                .filter(candidate -> candidate.sheetName.equals(config.sheetName))
                .mapToInt(candidate -> candidate.titleRow)
                .filter(titleRow -> titleRow > config.titleRow)
                .min()
                .orElse(sheetLastRow + 1);
        return Math.max(config.dataStartRow, nextTitleRow - 1);
    }

    private Map<String, String> readFixedColumnValues(Sheet sheet,
                                                      List<CellRangeAddress> mergedRegions,
                                                      int rowIndex,
                                                      List<FixedColumnConfig> fixedColumns) {
        Map<String, String> values = new LinkedHashMap<>();
        if (fixedColumns == null) {
            return values;
        }
        for (FixedColumnConfig fixedColumn : fixedColumns) {
            values.put(fixedColumn.key, normalizeValue(readMergedValue(sheet, mergedRegions, rowIndex, fixedColumn.colIndex)));
        }
        return values;
    }

    private int findAdminUploadHeaderRow(Sheet sheet,
                                         SectionConfig config,
                                         List<FixedColumnConfig> fixedColumns,
                                         List<CellRangeAddress> mergedRegions) {
        if (sheet == null || config == null || fixedColumns == null || fixedColumns.isEmpty()) {
            return -1;
        }
        int searchStartRow = Math.max(0, Math.min(config.titleRow, config.dataStartRow) - 4);
        int nextTitleRow = ADMIN_UPLOAD_WORKBOOK_SECTION_CONFIGS.stream()
                .filter(candidate -> !candidate.sectionCode.equals(config.sectionCode))
                .filter(candidate -> candidate.sheetName.equals(config.sheetName))
                .mapToInt(candidate -> candidate.titleRow)
                .filter(titleRow -> titleRow > config.titleRow)
                .min()
                .orElse(sheet.getLastRowNum() + 1);
        int searchEndRow = Math.min(Math.max(sheet.getLastRowNum(), config.dataStartRow), nextTitleRow - 1);
        int matchedHeaderRow = -1;
        for (int rowIndex = searchStartRow; rowIndex <= searchEndRow; rowIndex++) {
            Map<String, String> values = readFixedColumnValues(sheet, mergedRegions, rowIndex, fixedColumns);
            if (isHeaderLikeRow(values)) {
                if ("INPUT_STEAM".equals(config.sectionCode)) {
                    matchedHeaderRow = rowIndex;
                    continue;
                }
                return rowIndex;
            }
        }
        return matchedHeaderRow;
    }

    private boolean isNextSectionTitleRow(Sheet sheet,
                                          SectionConfig currentConfig,
                                          List<SectionConfig> activeConfigs,
                                          int rowIndex,
                                          List<CellRangeAddress> mergedRegions) {
        String cellValue = normalizeValue(readMergedValue(sheet, mergedRegions, rowIndex, currentConfig.titleCol));
        if (cellValue.isEmpty()) {
            return false;
        }
        return activeConfigs.stream()
                .filter(config -> config != currentConfig)
                .filter(config -> config.sheetName.equals(currentConfig.sheetName))
                .filter(config -> config.titleCol == currentConfig.titleCol)
                .anyMatch(config -> config.sectionLabel.trim().equalsIgnoreCase(cellValue));
    }

    private boolean isEmptyRow(Map<String, String> values) {
        return values.values().stream().allMatch(this::isBlankCellValue);
    }

    private boolean isExamplePlaceholderRow(Map<String, String> values) {
        return values.values().stream()
                .filter(value -> !isBlankCellValue(value))
                .allMatch(this::isPlaceholderCellValue);
    }

    private boolean isGroupOnlyRow(Map<String, String> values) {
        if (values == null || values.isEmpty()) {
            return false;
        }
        String groupValue = values.getOrDefault("group", "");
        if (isBlankCellValue(groupValue)) {
            return false;
        }
        return values.entrySet().stream()
                .filter(entry -> !"group".equals(entry.getKey()))
                .allMatch(entry -> isBlankCellValue(entry.getValue()));
    }

    private boolean isHeaderLikeRow(Map<String, String> values) {
        if (values == null || values.isEmpty()) {
            return false;
        }
        String groupValue = normalizeValue(values.get("group"));
        String materialName = normalizeValue(values.get("materialName"));
        return "구분".equals(groupValue) && "물질명".equals(materialName);
    }

    private boolean containsGuideMarker(Map<String, String> values) {
        if (values == null || values.isEmpty()) {
            return false;
        }
        return values.values().stream()
                .map(this::normalizeValue)
                .filter(value -> !value.isBlank())
                .anyMatch(value -> value.contains("◎") || value.contains("♣"));
    }

    private boolean isSectionOrMetadataTitleRow(SectionConfig config, Map<String, String> values) {
        if (config == null || values == null || values.isEmpty()) {
            return false;
        }
        List<String> nonBlankValues = values.values().stream()
                .map(this::normalizeValue)
                .filter(value -> !value.isBlank())
                .collect(Collectors.toList());
        if (nonBlankValues.isEmpty()) {
            return false;
        }
        List<String> titleCandidates = new ArrayList<>();
        titleCandidates.add(normalizeValue(config.sectionLabel));
        for (SectionMetaConfig metadataConfig : config.metadataConfigs) {
            titleCandidates.add(normalizeValue(metadataConfig.label));
        }
        return titleCandidates.stream()
                .filter(title -> !title.isBlank())
                .anyMatch(title -> nonBlankValues.stream().allMatch(title::equals));
    }

    private boolean hasMeaningfulGroupValue(SectionConfig config, Map<String, String> values) {
        if (values == null || values.isEmpty()) {
            return false;
        }
        String groupValue = normalizeValue(values.get("group"));
        String materialName = normalizeValue(values.get("materialName"));
        if (!materialName.isBlank() && !"물질명".equals(materialName)
                && !containsGuideMarker(Map.of("materialName", materialName))) {
            return true;
        }
        if (groupValue.isBlank()) {
            return false;
        }
        if ("구분".equals(groupValue) || containsGuideMarker(Map.of("group", groupValue))) {
            return false;
        }
        if (config != null) {
            for (SectionMetaConfig metadataConfig : config.metadataConfigs) {
                if (normalizeValue(metadataConfig.label).equals(groupValue)
                        && values.entrySet().stream()
                        .filter(entry -> !"group".equals(entry.getKey()))
                        .map(Map.Entry::getValue)
                        .allMatch(this::isBlankCellValue)) {
                    return false;
                }
            }
        }
        return true;
    }

    private boolean isBlankCellValue(String value) {
        return value == null || value.trim().isEmpty();
    }

    private boolean isPlaceholderCellValue(String value) {
        if (value == null) {
            return false;
        }
        String normalized = value.trim();
        return "…".equals(normalized) || "...".equals(normalized) || "…. ".equals(normalized) || "….".equals(normalized);
    }

    private List<String> readGuidance(Sheet sheet, List<CellRangeAddress> mergedRegions, int startRow, int endRow, int markerCol, int textCol) {
        List<String> guidance = new ArrayList<>();
        for (int rowIndex = startRow; rowIndex <= endRow; rowIndex++) {
            String marker = normalizeValue(readMergedValue(sheet, mergedRegions, rowIndex, markerCol));
            String text = normalizeValue(readMergedValue(sheet, mergedRegions, rowIndex, textCol));
            if (text.isBlank()) {
                continue;
            }
            guidance.add(marker.isBlank() ? text : marker + " " + text);
        }
        return guidance;
    }

    private List<Map<String, String>> parseSectionMetadata(Sheet sheet, List<CellRangeAddress> mergedRegions, SectionConfig config) {
        if (isAdminUploadSection(config) && !config.metadataConfigs.isEmpty()) {
            return parseAdminUploadSectionMetadata(sheet, mergedRegions, config, config.fixedColumns);
        }
        List<Map<String, String>> items = new ArrayList<>();
        for (SectionMetaConfig metaConfig : config.metadataConfigs) {
            String label = normalizeValue(readMergedValue(sheet, mergedRegions, metaConfig.labelRow, metaConfig.labelCol));
            String value = normalizeValue(readMergedValue(sheet, mergedRegions, metaConfig.valueRow, metaConfig.valueCol));
            if (label.isBlank() && value.isBlank()) {
                continue;
            }
            Map<String, String> item = new LinkedHashMap<>();
            item.put("key", metaConfig.key);
            item.put("label", metaConfig.label.isBlank() ? label : metaConfig.label);
            item.put("value", value);
            items.add(item);
        }
        return items;
    }

    private List<Map<String, String>> parseAdminUploadSectionMetadata(Sheet sheet,
                                                                      List<CellRangeAddress> mergedRegions,
                                                                      SectionConfig config,
                                                                      List<FixedColumnConfig> fixedColumns) {
        List<Map<String, String>> items = new ArrayList<>();
        int headerRow = findAdminUploadHeaderRow(sheet, config, fixedColumns, mergedRegions);
        int searchStartRow = Math.max(0, Math.min(config.titleRow, config.dataStartRow) - 4);
        int searchEndRow = headerRow > 0 ? headerRow - 1 : Math.max(config.dataStartRow - 1, config.titleRow);
        for (SectionMetaConfig metaConfig : config.metadataConfigs) {
            String configuredLabel = normalizeValue(metaConfig.label);
            String label = configuredLabel;
            String value = normalizeValue(readMergedValue(sheet, mergedRegions, metaConfig.valueRow, metaConfig.valueCol));
            boolean resolved = false;
            for (int rowIndex = searchStartRow; rowIndex <= searchEndRow && !resolved; rowIndex++) {
                for (FixedColumnConfig fixedColumn : fixedColumns) {
                    String candidate = normalizeValue(readMergedValue(sheet, mergedRegions, rowIndex, fixedColumn.colIndex));
                    if (candidate.isBlank() || !candidate.equals(configuredLabel)) {
                        continue;
                    }
                    label = candidate;
                    for (int valueRowIndex = rowIndex + 1; valueRowIndex <= searchEndRow; valueRowIndex++) {
                        String candidateValue = normalizeValue(readMergedValue(sheet, mergedRegions, valueRowIndex, fixedColumn.colIndex));
                        if (!candidateValue.isBlank()) {
                            value = candidateValue;
                            break;
                        }
                    }
                    resolved = true;
                    break;
                }
            }
            if (label.isBlank() && value.isBlank()) {
                continue;
            }
            Map<String, String> item = new LinkedHashMap<>();
            item.put("key", metaConfig.key);
            item.put("label", label);
            item.put("value", value);
            items.add(item);
        }
        return items;
    }

    private String readMergedValue(Sheet sheet, List<CellRangeAddress> mergedRegions, int rowIndex, int colIndex) {
        if (sheet == null || rowIndex < 0 || colIndex < 0) {
            return "";
        }
        if (mergedRegions != null) {
            for (CellRangeAddress region : mergedRegions) {
                if (region.isInRange(rowIndex, colIndex)) {
                    Row row = sheet.getRow(region.getFirstRow());
                    if (row == null) {
                        return "";
                    }
                    Cell cell = row.getCell(region.getFirstColumn());
                    return cell == null ? "" : formatter.formatCellValue(cell).trim();
                }
            }
        }
        Row row = sheet.getRow(rowIndex);
        if (row == null) {
            return "";
        }
        Cell cell = row.getCell(colIndex);
        return cell == null ? "" : formatter.formatCellValue(cell).trim();
    }

    private String sanitizeKey(String label, int colIndex) {
        String normalized = label.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9가-힣]+", "_")
                .replaceAll("_+", "_")
                .replaceAll("^_|_$", "");
        if (normalized.isBlank()) {
            return "column_" + colIndex;
        }
        return normalized;
    }

    private String normalizeLabel(String value) {
        return value == null ? "" : value.replace("\n", " ").replace("\r", " ").trim();
    }

    private String normalizeValue(String value) {
        if (value == null) {
            return "";
        }
        String normalized = value.replace("\r", " ").replace("\n", " ").trim();
        if (normalized.contains(" | ")) {
            return normalized.split(" \\| ")[0].trim();
        }
        return normalized;
    }

    private Map<String, String> option(String value, String label) {
        Map<String, String> option = new LinkedHashMap<>();
        option.put("value", value);
        option.put("label", label);
        return option;
    }

    private Map<String, String> column(String key, String label, List<String> headerPath) {
        Map<String, String> column = new LinkedHashMap<>();
        column.put("key", key);
        column.put("label", label);
        if (headerPath != null && !headerPath.isEmpty()) {
            column.put("headerPath", writeJson(headerPath));
        }
        return column;
    }

    private static FixedColumnConfig fixedColumn(String key, String label, String columnLetter) {
        return new FixedColumnConfig(key, label, excelColumnIndex(columnLetter), List.of(label));
    }

    private static FixedColumnConfig fixedColumn(String key, String label, String columnLetter, String... headerPath) {
        List<String> resolvedHeaderPath = headerPath == null || headerPath.length == 0
                ? List.of(label)
                : List.of(headerPath);
        return new FixedColumnConfig(key, label, excelColumnIndex(columnLetter), resolvedHeaderPath);
    }

    public byte[] buildBlankTemplateBytes() {
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            buildBlankTemplateWorkbook(workbook);
            workbook.write(outputStream);
            return outputStream.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException("빈 설문 양식 생성에 실패했습니다.", e);
        }
    }

    @Override
    public byte[] buildAdminUploadBlankTemplateBytes() {
        Path adminSamplePath = resolveAdminSamplePath();
        if (adminSamplePath == null || !Files.exists(adminSamplePath)) {
            throw new IllegalStateException("관리자 업로드 양식 원본을 찾지 못했습니다.");
        }
        try (InputStream inputStream = Files.newInputStream(adminSamplePath);
             Workbook workbook = new XSSFWorkbook(inputStream);
             ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            clearAdminWorkbookSampleValues(workbook);
            workbook.write(outputStream);
            return outputStream.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException("관리자 업로드 빈 양식 생성에 실패했습니다.", e);
        }
    }

    private void buildBlankTemplateWorkbook(Workbook workbook) {
        writeTemplateMarker(workbook);
        populateTemplateSheet(workbook, "투입물 데이터 수집", "3. 투입물 데이터 수집");
        populateTemplateSheet(workbook, "산출물 데이터 수집", "4. 산출물 데이터 수집");
        ensureUnitOptionsSheet(workbook);
        workbook.setActiveSheet(0);
        workbook.setSelectedTab(0);
    }

    private void clearAdminWorkbookSampleValues(Workbook workbook) {
        for (SectionConfig config : ADMIN_UPLOAD_WORKBOOK_SECTION_CONFIGS) {
            Sheet sheet = workbook.getSheet(config.sheetName);
            if (sheet == null) {
                continue;
            }
            for (int rowIndex = config.dataStartRow; rowIndex <= config.dataEndRow; rowIndex++) {
                for (FixedColumnConfig column : config.fixedColumns) {
                    clearCellValue(sheet, rowIndex, column.colIndex);
                }
            }
            for (SectionMetaConfig metadataConfig : config.metadataConfigs) {
                clearCellValue(sheet, metadataConfig.valueRow, metadataConfig.valueCol);
            }
        }
        clearWorkbookRange(workbook.getSheet("표지"), "G", 25, "G", 25);
        clearWorkbookRange(workbook.getSheet("데이터 수집 범위"), "F", 6, "G", 18);
        clearWorkbookRange(workbook.getSheet("참고자료"), "U", 9, "V", 19);
    }

    private void clearWorkbookRange(Sheet sheet, String startColumnLetter, int startRow, String endColumnLetter, int endRow) {
        if (sheet == null) {
            return;
        }
        int startColIndex = excelColumnIndex(startColumnLetter);
        int endColIndex = excelColumnIndex(endColumnLetter);
        for (int rowIndex = Math.max(startRow - 1, 0); rowIndex <= Math.max(endRow - 1, 0); rowIndex++) {
            for (int colIndex = startColIndex; colIndex <= endColIndex; colIndex++) {
                clearCellValue(sheet, rowIndex, colIndex);
            }
        }
    }

    private void writeTemplateMarker(Workbook workbook) {
        if (workbook instanceof XSSFWorkbook) {
            XSSFWorkbook xssfWorkbook = (XSSFWorkbook) workbook;
            xssfWorkbook.getProperties().getCustomProperties().addProperty(TEMPLATE_MARKER_PROPERTY, TEMPLATE_MARKER_VALUE);
        }
    }

    private void populateTemplateSheet(Workbook workbook, String sheetName, String majorTitle) {
        Sheet sheet = workbook.createSheet(sheetName);
        setCellValue(sheet, 0, 1, majorTitle, resolveTemplateTitleStyle(workbook));
        sheet.createFreezePane(1, 1);
        sheet.setColumnWidth(0, 3 * 256);
        Row titleRow = sheet.getRow(0);
        if (titleRow != null) {
            titleRow.setHeightInPoints(28f);
        }
        TEMPLATE_SECTION_CONFIGS.stream()
                .filter(config -> config.sheetName.equals(sheetName))
                .forEach(config -> writeTemplateSection(sheet, config));
    }

    private void writeTemplateSection(Sheet sheet, SectionConfig config) {
        setCellValue(sheet, config.titleRow, config.titleCol, config.sectionLabel, resolveTemplateSectionStyle(sheet.getWorkbook()));
        Row sectionRow = sheet.getRow(config.titleRow);
        if (sectionRow != null) {
            sectionRow.setHeightInPoints(24f);
        }
        for (SectionMetaConfig metadataConfig : config.metadataConfigs) {
            setCellValue(sheet, metadataConfig.labelRow, metadataConfig.labelCol, metadataConfig.label, resolveTemplateMetaLabelStyle(sheet.getWorkbook()));
        }
        if (config.fixedColumns == null || config.fixedColumns.isEmpty()) {
            return;
        }
        int headerDepth = Math.max(config.fixedColumns.stream().mapToInt(column -> column.headerPath.size()).max().orElse(1), 1);
        for (FixedColumnConfig column : config.fixedColumns) {
            for (int level = 0; level < headerDepth; level++) {
                String label = level < column.headerPath.size() ? column.headerPath.get(level) : "";
                if (!label.isBlank()) {
                    setCellValue(sheet, config.headerStartRow + level, column.colIndex, label, resolveTemplateHeaderStyle(sheet.getWorkbook()));
                }
            }
            sheet.setColumnWidth(column.colIndex, resolveTemplateColumnWidth(column));
        }
        for (int rowIndex = config.headerStartRow; rowIndex <= config.headerEndRow; rowIndex++) {
            Row headerRow = sheet.getRow(rowIndex);
            if (headerRow != null) {
                headerRow.setHeightInPoints(34f);
            }
        }
        for (int rowIndex = config.dataStartRow; rowIndex <= config.dataEndRow; rowIndex++) {
            Row dataRow = sheet.getRow(rowIndex);
            if (dataRow == null) {
                dataRow = sheet.createRow(rowIndex);
            }
            dataRow.setHeightInPoints(24f);
            for (FixedColumnConfig column : config.fixedColumns) {
                setCellValue(sheet, rowIndex, column.colIndex, "", resolveTemplateCellStyle(sheet.getWorkbook()));
            }
        }
        applyUnitDropdownValidation(sheet, config);
        mergeTemplateHeaders(sheet, config, headerDepth);
    }

    private void ensureUnitOptionsSheet(Workbook workbook) {
        Sheet existingSheet = workbook.getSheet(UNIT_OPTIONS_SHEET_NAME);
        if (existingSheet != null) {
            return;
        }
        Sheet unitSheet = workbook.createSheet(UNIT_OPTIONS_SHEET_NAME);
        for (int index = 0; index < UNIT_OPTION_CODES.size(); index++) {
            setCellValue(unitSheet, index, 0, UNIT_OPTION_CODES.get(index), resolveTemplateCellStyle(workbook));
        }
        Name namedRange = workbook.createName();
        namedRange.setNameName(UNIT_OPTIONS_RANGE_NAME);
        namedRange.setRefersToFormula("'" + UNIT_OPTIONS_SHEET_NAME + "'!$A$1:$A$" + UNIT_OPTION_CODES.size());
        workbook.setSheetHidden(workbook.getSheetIndex(unitSheet), true);
    }

    private void applyUnitDropdownValidation(Sheet sheet, SectionConfig config) {
        if (sheet == null || config.fixedColumns == null || config.fixedColumns.isEmpty()) {
            return;
        }
        DataValidationHelper helper = sheet.getDataValidationHelper();
        DataValidationConstraint constraint = helper.createFormulaListConstraint(UNIT_OPTIONS_RANGE_NAME);
        for (FixedColumnConfig column : config.fixedColumns) {
            if (!isUnitColumn(column.key)) {
                continue;
            }
            CellRangeAddressList addressList = new CellRangeAddressList(
                    config.dataStartRow,
                    config.dataEndRow,
                    column.colIndex,
                    column.colIndex
            );
            DataValidation validation = helper.createValidation(constraint, addressList);
            validation.setSuppressDropDownArrow(false);
            validation.setShowErrorBox(true);
            sheet.addValidationData(validation);
        }
    }

    private boolean isUnitColumn(String key) {
        return "annualUnit".equals(key) || "costUnit".equals(key);
    }

    private void mergeTemplateHeaders(Sheet sheet, SectionConfig config, int headerDepth) {
        for (int level = 0; level < headerDepth; level++) {
            int index = 0;
            while (index < config.fixedColumns.size()) {
                FixedColumnConfig column = config.fixedColumns.get(index);
                if (level >= column.headerPath.size()) {
                    index += 1;
                    continue;
                }
                String label = column.headerPath.get(level);
                String prefix = String.join("\u0000", column.headerPath.subList(0, level));
                int lastIndex = index;
                while (lastIndex + 1 < config.fixedColumns.size()) {
                    FixedColumnConfig candidate = config.fixedColumns.get(lastIndex + 1);
                    if (level >= candidate.headerPath.size()) {
                        break;
                    }
                    if (!label.equals(candidate.headerPath.get(level))) {
                        break;
                    }
                    if (!prefix.equals(String.join("\u0000", candidate.headerPath.subList(0, level)))) {
                        break;
                    }
                    lastIndex += 1;
                }
                int firstCol = config.fixedColumns.get(index).colIndex;
                int lastCol = config.fixedColumns.get(lastIndex).colIndex;
                int row = config.headerStartRow + level;
                if (firstCol < lastCol) {
                    CellRangeAddress region = new CellRangeAddress(row, row, firstCol, lastCol);
                    sheet.addMergedRegion(region);
                    applyTemplateBorder(region, sheet);
                } else if (level == column.headerPath.size() - 1 && level < headerDepth - 1) {
                    CellRangeAddress region = new CellRangeAddress(row, config.headerStartRow + headerDepth - 1, firstCol, firstCol);
                    sheet.addMergedRegion(region);
                    applyTemplateBorder(region, sheet);
                }
                index = lastIndex + 1;
            }
        }
    }

    private void applyTemplateBorder(CellRangeAddress region, Sheet sheet) {
        RegionUtil.setBorderTop(BorderStyle.THIN, region, sheet);
        RegionUtil.setBorderRight(BorderStyle.THIN, region, sheet);
        RegionUtil.setBorderBottom(BorderStyle.THIN, region, sheet);
        RegionUtil.setBorderLeft(BorderStyle.THIN, region, sheet);
        RegionUtil.setTopBorderColor(IndexedColors.GREY_40_PERCENT.getIndex(), region, sheet);
        RegionUtil.setRightBorderColor(IndexedColors.GREY_40_PERCENT.getIndex(), region, sheet);
        RegionUtil.setBottomBorderColor(IndexedColors.GREY_40_PERCENT.getIndex(), region, sheet);
        RegionUtil.setLeftBorderColor(IndexedColors.GREY_40_PERCENT.getIndex(), region, sheet);
    }

    private void setCellValue(Sheet sheet, int rowIndex, int colIndex, String value) {
        setCellValue(sheet, rowIndex, colIndex, value, resolveTemplateCellStyle(sheet.getWorkbook()));
    }

    private void setCellValue(Sheet sheet, int rowIndex, int colIndex, String value, CellStyle style) {
        Row row = sheet.getRow(rowIndex);
        if (row == null) {
            row = sheet.createRow(rowIndex);
        }
        Cell cell = row.getCell(colIndex);
        if (cell == null) {
            cell = row.createCell(colIndex);
        }
        cell.setCellValue(value == null ? "" : value);
        if (style != null) {
            cell.setCellStyle(style);
        }
    }

    private CellStyle resolveTemplateCellStyle(Workbook workbook) {
        if (templateCellStyle != null) {
            return templateCellStyle;
        }
        CellStyle style = workbook.createCellStyle();
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setAlignment(HorizontalAlignment.LEFT);
        style.setWrapText(true);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setTopBorderColor(IndexedColors.GREY_40_PERCENT.getIndex());
        style.setRightBorderColor(IndexedColors.GREY_40_PERCENT.getIndex());
        style.setBottomBorderColor(IndexedColors.GREY_40_PERCENT.getIndex());
        style.setLeftBorderColor(IndexedColors.GREY_40_PERCENT.getIndex());
        templateCellStyle = style;
        return style;
    }

    private CellStyle resolveTemplateTitleStyle(Workbook workbook) {
        if (templateTitleStyle != null) {
            return templateTitleStyle;
        }
        CellStyle style = workbook.createCellStyle();
        style.cloneStyleFrom(resolveTemplateCellStyle(workbook));
        style.setAlignment(HorizontalAlignment.LEFT);
        style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        Font font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 14);
        style.setFont(font);
        templateTitleStyle = style;
        return style;
    }

    private CellStyle resolveTemplateSectionStyle(Workbook workbook) {
        if (templateSectionStyle != null) {
            return templateSectionStyle;
        }
        CellStyle style = workbook.createCellStyle();
        style.cloneStyleFrom(resolveTemplateCellStyle(workbook));
        style.setFillForegroundColor(IndexedColors.PALE_BLUE.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        Font font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 11);
        style.setFont(font);
        templateSectionStyle = style;
        return style;
    }

    private CellStyle resolveTemplateHeaderStyle(Workbook workbook) {
        if (templateHeaderStyle != null) {
            return templateHeaderStyle;
        }
        CellStyle style = workbook.createCellStyle();
        style.cloneStyleFrom(resolveTemplateCellStyle(workbook));
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setFillForegroundColor(IndexedColors.LEMON_CHIFFON.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        Font font = workbook.createFont();
        font.setBold(true);
        style.setFont(font);
        templateHeaderStyle = style;
        return style;
    }

    private CellStyle resolveTemplateMetaLabelStyle(Workbook workbook) {
        if (templateMetaLabelStyle != null) {
            return templateMetaLabelStyle;
        }
        CellStyle style = workbook.createCellStyle();
        style.cloneStyleFrom(resolveTemplateCellStyle(workbook));
        style.setFillForegroundColor(IndexedColors.LIGHT_TURQUOISE.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        Font font = workbook.createFont();
        font.setBold(true);
        style.setFont(font);
        templateMetaLabelStyle = style;
        return style;
    }

    private int resolveTemplateColumnWidth(FixedColumnConfig column) {
        String key = column.key;
        if ("group".equals(key)) {
            return 25 * 256;
        }
        if ("materialName".equals(key)) {
            return 28 * 256;
        }
        if ("origin".equals(key) || "transportRoute".equals(key) || "treatmentMethod".equals(key)) {
            return 18 * 256;
        }
        if ("marineTransport".equals(key) || "roadTransport".equals(key)) {
            return 10 * 256;
        }
        if ("marineTonKm".equals(key) || "roadTonKm".equals(key) || "transportTonKm".equals(key)) {
            return 14 * 256;
        }
        if ("remark".equals(key)) {
            return 16 * 256;
        }
        return Math.max(12, column.label.replace("\n", "").length() + 4) * 256;
    }

    private void clearCellValue(Sheet sheet, int rowIndex, int colIndex) {
        if (sheet == null) {
            return;
        }
        for (CellRangeAddress region : sheet.getMergedRegions()) {
            if (!region.isInRange(rowIndex, colIndex)) {
                continue;
            }
            Row mergedRow = sheet.getRow(region.getFirstRow());
            if (mergedRow == null) {
                return;
            }
            Cell mergedCell = mergedRow.getCell(region.getFirstColumn());
            if (mergedCell == null) {
                return;
            }
            mergedCell.setBlank();
            return;
        }
        Row row = sheet.getRow(rowIndex);
        if (row == null) {
            return;
        }
        Cell cell = row.getCell(colIndex);
        if (cell == null) {
            return;
        }
        cell.setBlank();
    }

    private static int excelColumnIndex(String columnLetter) {
        String normalized = columnLetter == null ? "" : columnLetter.trim().toUpperCase(Locale.ROOT);
        int result = 0;
        for (int index = 0; index < normalized.length(); index++) {
            result = (result * 26) + (normalized.charAt(index) - 'A' + 1);
        }
        return Math.max(result - 1, 0);
    }

    private Map<String, String> summaryCard(Object title, Object value, Object description) {
        Map<String, String> card = new LinkedHashMap<>();
        card.put("title", String.valueOf(title));
        card.put("value", String.valueOf(value));
        card.put("description", String.valueOf(description));
        return card;
    }

    private Path resolveSamplePath() {
        if (Files.exists(REFERENCE_SAMPLE)) {
            return REFERENCE_SAMPLE;
        }
        if (Files.exists(WORKSPACE_SAMPLE)) {
            return WORKSPACE_SAMPLE;
        }
        return null;
    }

    private Path resolveAdminSamplePath() {
        if (Files.exists(WINDOWS_ADMIN_SAMPLE)) {
            return WINDOWS_ADMIN_SAMPLE;
        }
        if (Files.exists(WORKSPACE_ADMIN_SAMPLE)) {
            return WORKSPACE_ADMIN_SAMPLE;
        }
        return null;
    }

    private List<SectionConfig> resolveSectionConfigs(boolean uploaded,
                                                      boolean generatedTemplate,
                                                      boolean uploadedWorkbookLayout,
                                                      boolean adminUploadedWorkbookLayout) {
        if (generatedTemplate) {
            return TEMPLATE_SECTION_CONFIGS;
        }
        if (adminUploadedWorkbookLayout) {
            return ADMIN_UPLOAD_WORKBOOK_SECTION_CONFIGS;
        }
        if (uploadedWorkbookLayout || uploaded) {
            return UPLOADED_WORKBOOK_SECTION_CONFIGS;
        }
        return SECTION_CONFIGS;
    }

    private boolean isGeneratedTemplate(Workbook workbook) {
        if (!(workbook instanceof XSSFWorkbook)) {
            return false;
        }
        XSSFWorkbook xssfWorkbook = (XSSFWorkbook) workbook;
        try {
            String marker = xssfWorkbook.getProperties().getCustomProperties().getProperty(TEMPLATE_MARKER_PROPERTY).getLpwstr();
            return TEMPLATE_MARKER_VALUE.equals(marker);
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean matchesUploadedWorkbookLayout(Workbook workbook, Map<String, List<CellRangeAddress>> mergedRegionsMap) {
        if (workbook == null) {
            return false;
        }
        Sheet inputSheet = workbook.getSheet("투입물 데이터 수집");
        Sheet outputSheet = workbook.getSheet("산출물 데이터 수집");
        if (inputSheet == null || outputSheet == null) {
            return false;
        }
        List<CellRangeAddress> inputMerged = mergedRegionsMap.getOrDefault("투입물 데이터 수집", List.of());
        List<CellRangeAddress> outputMerged = mergedRegionsMap.getOrDefault("산출물 데이터 수집", List.of());
        return "원료 물질 및 보조 물질".equals(normalizeValue(readMergedValue(inputSheet, inputMerged, 2, 1)))
                && "폐기물".equals(normalizeValue(readMergedValue(outputSheet, outputMerged, 43, 1)));
    }

    private boolean matchesAdminUploadedWorkbookLayout(Workbook workbook, Map<String, List<CellRangeAddress>> mergedRegionsMap) {
        if (workbook == null) {
            return false;
        }
        Sheet inputSheet = workbook.getSheet("투입물 데이터 수집");
        Sheet outputSheet = workbook.getSheet("산출물 데이터 수집");
        if (inputSheet == null || outputSheet == null) {
            return false;
        }
        List<CellRangeAddress> inputMerged = mergedRegionsMap.getOrDefault("투입물 데이터 수집", List.of());
        List<CellRangeAddress> outputMerged = mergedRegionsMap.getOrDefault("산출물 데이터 수집", List.of());
        boolean legacyLayout = "원료 물질 및 보조 물질".equals(normalizeValue(readMergedValue(inputSheet, inputMerged, 8, excelColumnIndex("BR"))))
                && "폐기물".equals(normalizeValue(readMergedValue(outputSheet, outputMerged, 35, excelColumnIndex("BO"))));
        boolean currentLayout = "원료 물질 및 보조 물질".equals(normalizeValue(readMergedValue(inputSheet, inputMerged, 8, excelColumnIndex("BS"))))
                && "폐기물".equals(normalizeValue(readMergedValue(outputSheet, outputMerged, 31, excelColumnIndex("BP"))));
        return legacyLayout || currentLayout;
    }

    private boolean isAdminUploadSection(SectionConfig config) {
        if (config == null) {
            return false;
        }
        return ADMIN_UPLOAD_WORKBOOK_SECTION_CONFIGS.stream()
                .anyMatch(candidate -> candidate.sectionCode.equals(config.sectionCode)
                        && candidate.sheetName.equals(config.sheetName));
    }

    private boolean matchesUploadedWorkbookLayout(Workbook workbook) {
        Map<String, List<CellRangeAddress>> mergedRegionsMap = new LinkedHashMap<>();
        if (workbook != null) {
            for (int i = 0; i < workbook.getNumberOfSheets(); i++) {
                Sheet sheet = workbook.getSheetAt(i);
                mergedRegionsMap.put(sheet.getSheetName(), sheet.getMergedRegions());
            }
        }
        return matchesUploadedWorkbookLayout(workbook, mergedRegionsMap);
    }

    private boolean usesLeftAlignedWorkbookLayout(SectionConfig config) {
        return config != null && config.titleCol == 1;
    }

    private static List<FixedColumnConfig> templateFixedColumns(String sectionCode, String startColumnLetter) {
        List<FixedColumnConfig> sourceColumns = FIXED_SECTION_COLUMNS.get(sectionCode);
        if (sourceColumns == null || sourceColumns.isEmpty()) {
            return List.of();
        }
        int startColIndex = excelColumnIndex(startColumnLetter);
        List<FixedColumnConfig> columns = new ArrayList<>();
        for (int index = 0; index < sourceColumns.size(); index++) {
            FixedColumnConfig source = sourceColumns.get(index);
            columns.add(new FixedColumnConfig(source.key, source.label, startColIndex + index, source.headerPath));
        }
        return columns;
    }

    private Map<String, Map<String, Object>> readDraftRegistry(String actorId) {
        if (isDraftTableReady()) {
            return readDraftRegistryFromDatabase(storageActorId());
        }
        return filterDraftRegistryByActor(readDraftRegistryFromFile(), storageActorId());
    }

    private Map<String, Map<String, Object>> readDraftRegistryFromDatabase(String actorId) {
        try {
            Map<String, Map<String, Object>> result = new LinkedHashMap<>();
            List<Map<String, Object>> headers = adminEmissionSurveyDraftMapper.selectCaseHeaders();
            for (Map<String, Object> header : headers) {
                if (!matchesOwner(header, actorId)) {
                    continue;
                }
                String caseId = safeObject(header.get("caseId"));
                Map<String, Object> row = withDerivedProductName(new LinkedHashMap<>(header));
                List<Map<String, Object>> items = adminEmissionSurveyDraftMapper.selectCaseRows(caseId);
                List<Map<String, Object>> rows = new ArrayList<>();
                for (Map<String, Object> item : items) {
                    Map<String, Object> draftRow = new LinkedHashMap<>();
                    draftRow.put("rowId", safeObject(item.get("rowKey")));
                    draftRow.put("values", parseJsonMap(safeObject(item.get("rowValuesJson"))));
                    rows.add(draftRow);
                }
                row.put("columns", normalizeSurveySectionColumns(
                        safeObject(header.get("sectionCode")),
                        parseJsonListOfMaps(safeObject(header.get("rowSchemaJson")))));
                row.put("guidance", parseJsonStringList(safeObject(header.get("guidanceJson"))));
                row.put("rows", rows);
                result.put(buildRegistryKey(row), row);
            }
            return result;
        } catch (Exception e) {
            return filterDraftRegistryByActor(readDraftRegistryFromFile(), storageActorId());
        }
    }

    private Map<String, Map<String, Object>> readDraftRegistryFromFile() {
        return readRegistry(DRAFT_REGISTRY_PATH, "Failed to read emission survey draft registry");
    }

    private void writeDraftRegistry(Map<String, Map<String, Object>> registry) {
        writeRegistry(DRAFT_REGISTRY_PATH, registry);
    }

    private Map<String, Map<String, Object>> readSetRegistry() {
        return readRegistry(SET_REGISTRY_PATH, "Failed to read emission survey draft set registry");
    }

    private Map<String, Map<String, Object>> readUploadLogRegistry() {
        return readRegistry(UPLOAD_LOG_REGISTRY_PATH, "Failed to read emission survey upload log registry");
    }

    private Map<String, Map<String, Object>> readRegistry(Path path, String errorMessage) {
        if (!Files.exists(path)) {
            return new LinkedHashMap<>();
        }
        try (InputStream inputStream = Files.newInputStream(path)) {
            Map<String, Map<String, Object>> value = objectMapper.readValue(
                    inputStream,
                    new TypeReference<LinkedHashMap<String, Map<String, Object>>>() {}
            );
            return value == null ? new LinkedHashMap<>() : value;
        } catch (Exception e) {
            throw new IllegalStateException(errorMessage, e);
        }
    }

    private void writeRegistry(Path path, Map<String, Map<String, Object>> registry) {
        try {
            Files.createDirectories(path.getParent());
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(path.toFile(), registry);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to write emission survey registry", e);
        }
    }

    private Map<String, Map<String, Object>> filterDraftRegistryByActor(Map<String, Map<String, Object>> registry, String actorId) {
        String resolvedActorId = safe(actorId);
        if (resolvedActorId.isEmpty()) {
            return registry.entrySet().stream()
                    .filter(entry -> safeObject(entry.getValue().get("ownerActorId")).isEmpty())
                    .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue, (left, right) -> right, LinkedHashMap::new));
        }
        return registry.entrySet().stream()
                .filter(entry -> matchesOwner(entry.getValue(), resolvedActorId))
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue, (left, right) -> right, LinkedHashMap::new));
    }

    private void saveCaseDraftToDatabase(EmissionSurveyCaseSaveRequest request, String actorId) {
        try {
            String caseId = buildCaseId(
                    safe(request.getOwnerActorId()).isBlank() ? safe(actorId) : safe(request.getOwnerActorId()),
                    request.getProductName(),
                    request.getSectionCode(),
                    request.getCaseCode(),
                    request.getLciMajorCode(),
                    request.getLciMiddleCode(),
                    request.getLciSmallCode()
            );
            Map<String, Object> header = new LinkedHashMap<>();
            header.put("caseId", caseId);
            header.put("ownerActorId", safe(request.getOwnerActorId()).isBlank() ? safe(actorId) : safe(request.getOwnerActorId()));
            header.put("datasetId", safe(request.getDatasetId()));
            header.put("datasetName", safe(request.getDatasetName()));
            header.put("sectionCode", safe(request.getSectionCode()));
            header.put("caseCode", safe(request.getCaseCode()));
            header.put("majorCode", safe(request.getMajorCode()));
            header.put("lciMajorCode", safe(request.getLciMajorCode()));
            header.put("lciMajorLabel", safe(request.getLciMajorLabel()));
            header.put("lciMiddleCode", safe(request.getLciMiddleCode()));
            header.put("lciMiddleLabel", safe(request.getLciMiddleLabel()));
            header.put("lciSmallCode", safe(request.getLciSmallCode()));
            header.put("lciSmallLabel", safe(request.getLciSmallLabel()));
            header.put("sectionLabel", safe(request.getSectionLabel()));
            header.put("sourceFileName", safe(request.getSourceFileName()).isBlank() ? DEFAULT_WORKBOOK_NAME : safe(request.getSourceFileName()));
            header.put("sourcePath", safe(request.getSourcePath()).isBlank() ? WORKSPACE_SAMPLE.toString() : safe(request.getSourcePath()));
            header.put("targetPath", safe(request.getTargetPath()).isBlank() ? REFERENCE_SAMPLE.toString() : safe(request.getTargetPath()));
            header.put("caseStatus", "SAVED");
            header.put("rowCount", request.getRows() == null ? 0 : request.getRows().size());
            header.put("rowSchemaJson", writeJson(request.getColumns() == null ? List.of() : request.getColumns()));
            header.put("guidanceJson", writeJson(request.getGuidance() == null ? List.of() : request.getGuidance()));
            header.put("actorId", safe(actorId));
            int updated = adminEmissionSurveyDraftMapper.updateCaseHeaderByCaseId(header);
            if (updated <= 0) {
                adminEmissionSurveyDraftMapper.insertCaseHeader(header);
            }
            adminEmissionSurveyDraftMapper.deleteCaseRows(caseId);
            if (request.getRows() == null) {
                return;
            }
            int order = 1;
            for (Map<String, Object> draftRow : request.getRows()) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("caseRowId", "ESR_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16).toUpperCase(Locale.ROOT));
                row.put("caseId", caseId);
                row.put("rowOrder", order++);
                row.put("rowKey", safeObject(draftRow.get("rowId")));
                row.put("rowValuesJson", writeJson(draftRow.get("values")));
                row.put("actorId", safe(actorId));
                adminEmissionSurveyDraftMapper.insertCaseRow(row);
            }
        } catch (Exception ignored) {
            // Keep file-based fallback behavior when DB tables are absent or unavailable.
        }
    }

    private void deleteCaseDraftFromDatabase(String sectionCode, String caseCode, String productName, String actorId) {
        try {
            List<Map<String, Object>> headers = adminEmissionSurveyDraftMapper.selectCaseHeaders();
            for (Map<String, Object> header : headers) {
                if (!matchesSectionAndCase(header, sectionCode, caseCode)) {
                    continue;
                }
                if (!matchesProduct(header, productName)) {
                    continue;
                }
                if (!matchesOwner(header, actorId)) {
                    continue;
                }
                String caseId = safeObject(header.get("caseId"));
                adminEmissionSurveyDraftMapper.deleteCaseRows(caseId);
                adminEmissionSurveyDraftMapper.deleteCaseHeader(caseId);
            }
        } catch (Exception ignored) {
            // Keep file-based deletion result even when DB cleanup fails.
        }
    }

    private boolean isDraftTableReady() {
        try {
            return adminEmissionSurveyDraftMapper != null && adminEmissionSurveyDraftMapper.countCaseTable() >= 0;
        } catch (Exception e) {
            return false;
        }
    }

    private boolean isUploadLogTableReady() {
        try {
            return adminEmissionSurveyDraftMapper != null && adminEmissionSurveyDraftMapper.countUploadLogTable() >= 0;
        } catch (Exception e) {
            return false;
        }
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String safeObject(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    @SuppressWarnings("unchecked")
    private Map<String, String> parseJsonMap(String json) {
        if (json == null || json.trim().isEmpty()) {
            return new LinkedHashMap<>();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<LinkedHashMap<String, String>>() {});
        } catch (Exception e) {
            return new LinkedHashMap<>();
        }
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value == null ? Map.of() : value);
        } catch (Exception e) {
            return "{}";
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, String>> parseJsonListOfMaps(String json) {
        if (json == null || json.trim().isEmpty()) {
            return new ArrayList<>();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<Map<String, String>>>() {});
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private List<Map<String, String>> normalizeSurveySectionColumns(String sectionCode, List<Map<String, String>> columns) {
        String resolvedSectionCode = safe(sectionCode);
        List<Map<String, String>> fixedColumns = defaultSurveySectionColumns(resolvedSectionCode);
        List<Map<String, String>> sourceColumns = columns == null ? List.of() : columns;
        List<Map<String, String>> normalizedColumns = fixedColumns.isEmpty() || sourceColumns.size() >= fixedColumns.size()
                ? copyColumns(sourceColumns)
                : copyColumns(fixedColumns);
        if ("OUTPUT_PRODUCTS".equals(resolvedSectionCode)) {
            normalizedColumns = normalizedColumns.stream()
                    .filter(column -> !isEmissionFactorColumn(column))
                    .collect(Collectors.toList());
        }
        return normalizedColumns;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> normalizeSurveySectionRows(List<Map<String, Object>> rows) {
        if (rows == null || rows.isEmpty()) {
            return List.of();
        }
        List<Map<String, Object>> normalizedRows = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> normalizedRow = row == null ? new LinkedHashMap<>() : new LinkedHashMap<>(row);
            List<Map<String, String>> columns = normalizedRow.get("columns") instanceof List<?>
                    ? (List<Map<String, String>>) (List<?>) normalizedRow.get("columns")
                    : List.of();
            normalizedRow.put("columns", normalizeSurveySectionColumns(safeObject(normalizedRow.get("sectionCode")), columns));
            normalizedRows.add(normalizedRow);
        }
        return normalizedRows;
    }

    private List<Map<String, String>> defaultSurveySectionColumns(String sectionCode) {
        List<FixedColumnConfig> fixedColumns = FIXED_SECTION_COLUMNS.get(safe(sectionCode));
        return fixedColumns == null || fixedColumns.isEmpty() ? List.of() : parseFixedColumns(fixedColumns);
    }

    private List<Map<String, String>> copyColumns(List<Map<String, String>> columns) {
        if (columns == null || columns.isEmpty()) {
            return new ArrayList<>();
        }
        List<Map<String, String>> copiedColumns = new ArrayList<>();
        for (Map<String, String> column : columns) {
            copiedColumns.add(column == null ? new LinkedHashMap<>() : new LinkedHashMap<>(column));
        }
        return copiedColumns;
    }

    private boolean isEmissionFactorColumn(Map<String, String> column) {
        if (column == null) {
            return false;
        }
        String key = safe(column.get("key"));
        String label = safe(column.get("label"));
        String headerPath = safe(column.get("headerPath"));
        return "emissionFactor".equals(key) || "배출계수".equals(label) || headerPath.contains("배출계수");
    }

    private List<String> parseJsonStringList(String json) {
        if (json == null || json.trim().isEmpty()) {
            return new ArrayList<>();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private List<Map<String, Object>> parseJsonListOfObjects(String json) {
        if (json == null || json.trim().isEmpty()) {
            return new ArrayList<>();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private int parseInteger(Object value) {
        if (value == null) {
            return 0;
        }
        try {
            return Integer.parseInt(String.valueOf(value).trim());
        } catch (Exception e) {
            return 0;
        }
    }

    private List<Map<String, Object>> paginateRows(List<Map<String, Object>> rows, int pageIndex, int pageSize) {
        if (rows == null || rows.isEmpty()) {
            return List.of();
        }
        int fromIndex = Math.max(0, (Math.max(pageIndex, 1) - 1) * Math.max(pageSize, 1));
        if (fromIndex >= rows.size()) {
            return List.of();
        }
        int toIndex = Math.min(rows.size(), fromIndex + Math.max(pageSize, 1));
        return new ArrayList<>(rows.subList(fromIndex, toIndex));
    }

    private Map<String, Object> saveUploadedWorkbookDataset(Map<String, Object> payload,
                                                            String actorId,
                                                            String sourceFileName,
                                                            String lciMajorCode,
                                                            String lciMajorLabel,
                                                            String lciMiddleCode,
                                                            String lciMiddleLabel,
                                                            String lciSmallCode,
                                                            String lciSmallLabel,
                                                            boolean isEn) {
        String resolvedActorId = storageActorId();
        String resolvedMajorCode = safe(lciMajorCode);
        String resolvedMiddleCode = safe(lciMiddleCode);
        String resolvedSmallCode = safe(lciSmallCode);
        String savedAt = LocalDateTime.now().format(TIMESTAMP_FORMATTER);
        List<Map<String, Object>> sectionResults = new ArrayList<>();
        List<Map<String, Object>> sections = (List<Map<String, Object>>) (List<?>) (payload.get("sections") instanceof List<?> ? payload.get("sections") : List.of());
        List<String> productNames = extractProductNames(sections);
        if (productNames.isEmpty()) {
            productNames = List.of("");
        }
        int totalRowCount = 0;
        int savedSectionCount = 0;
        String resultStatus = "PARSE_ONLY";
        String message = isEn ? "Workbook parsed only." : "엑셀을 파싱만 완료했습니다.";

        for (String productName : productNames) {
            String datasetId = buildDatasetId(productName);
            List<Map<String, Object>> productSections = filterSectionsForProduct(sections, productName);
            for (Map<String, Object> section : productSections) {
                EmissionSurveyCaseSaveRequest request = new EmissionSurveyCaseSaveRequest();
                request.setOwnerActorId(resolvedActorId);
                request.setProductName(productName);
                request.setDatasetId(datasetId);
                request.setDatasetName(sharedDatasetName(isEn, productName));
                request.setSectionCode(safeObject(section.get("sectionCode")));
                request.setCaseCode("CASE_3_1");
                request.setMajorCode(safeObject(section.get("majorCode")));
                request.setLciMajorCode(resolvedMajorCode);
                request.setLciMajorLabel(safe(lciMajorLabel));
                request.setLciMiddleCode(resolvedMiddleCode);
                request.setLciMiddleLabel(safe(lciMiddleLabel));
                request.setLciSmallCode(resolvedSmallCode);
                request.setLciSmallLabel(safe(lciSmallLabel));
                request.setSectionLabel(safeObject(section.get("sectionLabel")));
                request.setSourceFileName(sourceFileName);
                request.setSourcePath(safeObject(payload.get("sourcePath")));
                request.setTargetPath(safeObject(payload.get("targetPath")));
                request.setTitleRowLabel(safeObject(section.get("titleRowLabel")));
                request.setGuidance((List<String>) (List<?>) (section.get("guidance") instanceof List<?> ? section.get("guidance") : List.of()));
                request.setColumns((List<Map<String, String>>) (List<?>) (section.get("columns") instanceof List<?> ? section.get("columns") : List.of()));
                request.setRows((List<Map<String, Object>>) (List<?>) (section.get("rows") instanceof List<?> ? section.get("rows") : List.of()));
                saveCaseDraft(request, resolvedActorId, isEn);
                int rowCount = request.getRows() == null ? 0 : request.getRows().size();
                totalRowCount += rowCount;
                savedSectionCount += 1;
                Map<String, Object> sectionResult = new LinkedHashMap<>();
                sectionResult.put("datasetId", datasetId);
                sectionResult.put("productName", normalizeProductName(productName));
                sectionResult.put("sectionCode", request.getSectionCode());
                sectionResult.put("sectionLabel", request.getSectionLabel());
                sectionResult.put("rowCount", rowCount);
                sectionResult.put("caseCode", "CASE_3_1");
                sectionResult.put("savedAt", savedAt);
                sectionResults.add(sectionResult);
            }
        }
        resultStatus = "SUCCESS";
        message = isEn ? "Workbook uploaded and saved into the shared dataset." : "엑셀 업로드 내용을 공통 데이터셋으로 저장했습니다.";

        Map<String, Object> logRow = new LinkedHashMap<>();
        logRow.put("logId", buildLogId());
        logRow.put("datasetId", SHARED_DATASET_ID);
        logRow.put("ownerActorId", resolvedActorId);
        logRow.put("sourceFileName", sourceFileName);
        logRow.put("lciMajorCode", resolvedMajorCode);
        logRow.put("lciMajorLabel", safe(lciMajorLabel));
        logRow.put("lciMiddleCode", resolvedMiddleCode);
        logRow.put("lciMiddleLabel", safe(lciMiddleLabel));
        logRow.put("lciSmallCode", resolvedSmallCode);
        logRow.put("lciSmallLabel", safe(lciSmallLabel));
        logRow.put("resultStatus", resultStatus);
        logRow.put("message", message);
        logRow.put("sectionCount", savedSectionCount);
        logRow.put("rowCount", totalRowCount);
        logRow.put("storageMode", isDraftTableReady() ? "database+file" : "file");
        logRow.put("sectionResultJson", writeJson(sectionResults));
        logRow.put("uploadedAt", savedAt);
        writeUploadLog(logRow);
        return logRow;
    }

    private void writeUploadLog(Map<String, Object> logRow) {
        try {
            if (isUploadLogTableReady()) {
                adminEmissionSurveyDraftMapper.insertUploadLog(logRow);
            }
        } catch (Exception ignored) {
            // Keep file-based fallback behavior when upload log table is absent.
        }
        Map<String, Map<String, Object>> registry = readUploadLogRegistry();
        registry.put(safeObject(logRow.get("logId")), new LinkedHashMap<>(logRow));
        writeRegistry(UPLOAD_LOG_REGISTRY_PATH, registry);
    }

    private List<Map<String, Object>> readUploadLogs(String actorId,
                                                     String lciMajorCode,
                                                     String lciMiddleCode,
                                                     String lciSmallCode,
                                                     String status) {
        String resolvedActorId = storageActorId();
        List<Map<String, Object>> result = new ArrayList<>();
        if (isUploadLogTableReady()) {
            try {
                Map<String, Object> params = new LinkedHashMap<>();
                params.put("ownerActorId", resolvedActorId);
                params.put("lciMajorCode", safe(lciMajorCode));
                params.put("lciMiddleCode", safe(lciMiddleCode));
                params.put("lciSmallCode", safe(lciSmallCode));
                params.put("status", safe(status));
                return adminEmissionSurveyDraftMapper.selectUploadLogs(params);
            } catch (Exception ignored) {
                // Fall through to file registry lookup.
            }
        }
        for (Map<String, Object> row : readUploadLogRegistry().values()) {
            if (!matchesOwner(row, resolvedActorId)) {
                continue;
            }
            if (!safe(status).isEmpty() && !safe(status).equalsIgnoreCase(safeObject(row.get("resultStatus")))) {
                continue;
            }
            if (!safe(lciMajorCode).isEmpty() && !safe(lciMajorCode).equals(safeObject(row.get("lciMajorCode")))) {
                continue;
            }
            if (!safe(lciMiddleCode).isEmpty() && !safe(lciMiddleCode).equals(safeObject(row.get("lciMiddleCode")))) {
                continue;
            }
            if (!safe(lciSmallCode).isEmpty() && !safe(lciSmallCode).equals(safeObject(row.get("lciSmallCode")))) {
                continue;
            }
            result.add(new LinkedHashMap<>(row));
        }
        result.sort(Comparator.comparing(row -> safeObject(row.get("uploadedAt")), Comparator.reverseOrder()));
        return result;
    }

    private List<Map<String, Object>> readDatasetSummaries(String actorId,
                                                           String lciMajorCode,
                                                           String lciMiddleCode,
                                                           String lciSmallCode) {
        String resolvedActorId = storageActorId();
        List<Map<String, Object>> fileRows = buildDatasetSummariesFromRegistry(resolvedActorId, lciMajorCode, lciMiddleCode, lciSmallCode);
        if (isDraftTableReady()) {
            try {
                Map<String, Object> params = new LinkedHashMap<>();
                params.put("ownerActorId", resolvedActorId);
                params.put("lciMajorCode", safe(lciMajorCode));
                params.put("lciMiddleCode", safe(lciMiddleCode));
                params.put("lciSmallCode", safe(lciSmallCode));
                List<Map<String, Object>> databaseRows = adminEmissionSurveyDraftMapper.selectDatasetSummaries(params);
                return mergeDatasetSummaries(databaseRows, fileRows);
            } catch (Exception ignored) {
                // Fall through to file registry lookup.
            }
        }
        return normalizeSurveySectionRows(fileRows);
    }

    private List<Map<String, Object>> buildDatasetSummariesFromRegistry(String actorId,
                                                                        String lciMajorCode,
                                                                        String lciMiddleCode,
                                                                        String lciSmallCode) {
        Map<String, Map<String, Object>> grouped = new LinkedHashMap<>();
        for (Map<String, Object> row : readDraftRegistry(actorId).values()) {
            String datasetId = safeObject(row.get("datasetId"));
            if (datasetId.isEmpty()) {
                continue;
            }
            if (!safe(lciMajorCode).isEmpty() && !safe(lciMajorCode).equals(safeObject(row.get("lciMajorCode")))) {
                continue;
            }
            if (!safe(lciMiddleCode).isEmpty() && !safe(lciMiddleCode).equals(safeObject(row.get("lciMiddleCode")))) {
                continue;
            }
            if (!safe(lciSmallCode).isEmpty() && !safe(lciSmallCode).equals(safeObject(row.get("lciSmallCode")))) {
                continue;
            }
            Map<String, Object> summary = grouped.computeIfAbsent(datasetId, key -> {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("datasetId", datasetId);
                item.put("datasetName", safeObject(row.get("datasetName")));
                item.put("ownerActorId", safeObject(row.get("ownerActorId")));
                item.put("lciMajorCode", safeObject(row.get("lciMajorCode")));
                item.put("lciMajorLabel", safeObject(row.get("lciMajorLabel")));
                item.put("lciMiddleCode", safeObject(row.get("lciMiddleCode")));
                item.put("lciMiddleLabel", safeObject(row.get("lciMiddleLabel")));
                item.put("lciSmallCode", safeObject(row.get("lciSmallCode")));
                item.put("lciSmallLabel", safeObject(row.get("lciSmallLabel")));
                item.put("sourceFileName", safeObject(row.get("sourceFileName")));
                item.put("caseStatus", safeObject(row.get("caseStatus")));
                item.put("sectionCount", 0);
                item.put("rowCount", 0);
                item.put("savedAt", safeObject(row.get("savedAt")));
                return item;
            });
            summary.put("sectionCount", parseInteger(summary.get("sectionCount")) + 1);
            summary.put("rowCount", parseInteger(summary.get("rowCount")) + countRows(row.get("rows")));
            if (safeObject(summary.get("savedAt")).compareTo(safeObject(row.get("savedAt"))) < 0) {
                summary.put("savedAt", safeObject(row.get("savedAt")));
            }
        }
        return grouped.values().stream()
                .sorted(Comparator.comparing(row -> safeObject(row.get("savedAt")), Comparator.reverseOrder()))
                .collect(Collectors.toList());
    }

    private List<Map<String, Object>> mergeDatasetSummaries(List<Map<String, Object>> databaseRows, List<Map<String, Object>> fileRows) {
        if ((databaseRows == null || databaseRows.isEmpty()) && (fileRows == null || fileRows.isEmpty())) {
            return List.of();
        }
        Map<String, Map<String, Object>> merged = new LinkedHashMap<>();
        for (Map<String, Object> row : databaseRows == null ? List.<Map<String, Object>>of() : databaseRows) {
            merged.put(safeObject(row.get("datasetId")), new LinkedHashMap<>(row));
        }
        for (Map<String, Object> row : fileRows == null ? List.<Map<String, Object>>of() : fileRows) {
            String datasetId = safeObject(row.get("datasetId"));
            if (datasetId.isEmpty()) {
                continue;
            }
            Map<String, Object> current = merged.get(datasetId);
            if (current == null || shouldPreferDatasetSummary(row, current)) {
                merged.put(datasetId, new LinkedHashMap<>(row));
            }
        }
        return merged.values().stream()
                .sorted(Comparator.comparing(row -> safeObject(row.get("savedAt")), Comparator.reverseOrder()))
                .collect(Collectors.toList());
    }

    private boolean shouldPreferDatasetSummary(Map<String, Object> candidate, Map<String, Object> current) {
        String candidateSavedAt = safeObject(candidate.get("savedAt"));
        String currentSavedAt = safeObject(current.get("savedAt"));
        if (!candidateSavedAt.isEmpty() && candidateSavedAt.compareTo(currentSavedAt) > 0) {
            return true;
        }
        if (candidateSavedAt.equals(currentSavedAt)) {
            int candidateRowCount = parseInteger(candidate.get("rowCount"));
            int currentRowCount = parseInteger(current.get("rowCount"));
            if (candidateRowCount != currentRowCount) {
                return candidateRowCount > currentRowCount;
            }
            return parseInteger(candidate.get("sectionCount")) > parseInteger(current.get("sectionCount"));
        }
        return parseInteger(candidate.get("rowCount")) > 0 && parseInteger(current.get("rowCount")) == 0;
    }

    private List<Map<String, Object>> readDatasetSections(String actorId, String datasetId) {
        String resolvedActorId = storageActorId();
        List<Map<String, Object>> fileRows = sortSectionRows(readDraftRegistryFromFile().values().stream()
                .filter(row -> safe(datasetId).equals(safeObject(row.get("datasetId"))))
                .map(LinkedHashMap::new)
                .collect(Collectors.toList()));
        if (isDraftTableReady()) {
            try {
                Map<String, Object> params = new LinkedHashMap<>();
                params.put("ownerActorId", resolvedActorId);
                params.put("datasetId", safe(datasetId));
                List<Map<String, Object>> headers = adminEmissionSurveyDraftMapper.selectDatasetSections(params);
                List<Map<String, Object>> rows = new ArrayList<>();
                for (Map<String, Object> header : headers) {
                    Map<String, Object> row = withDerivedProductName(new LinkedHashMap<>(header));
                    List<Map<String, Object>> items = adminEmissionSurveyDraftMapper.selectCaseRows(safeObject(header.get("caseId")));
                    List<Map<String, Object>> caseRows = new ArrayList<>();
                    for (Map<String, Object> item : items) {
                        Map<String, Object> draftRow = new LinkedHashMap<>();
                        draftRow.put("rowId", safeObject(item.get("rowKey")));
                        draftRow.put("values", parseJsonMap(safeObject(item.get("rowValuesJson"))));
                        caseRows.add(draftRow);
                    }
                    row.put("columns", normalizeSurveySectionColumns(
                            safeObject(header.get("sectionCode")),
                            parseJsonListOfMaps(safeObject(header.get("rowSchemaJson")))));
                    row.put("guidance", parseJsonStringList(safeObject(header.get("guidanceJson"))));
                    row.put("rows", caseRows);
                    rows.add(row);
                }
                if (!rows.isEmpty()) {
                    return mergeDatasetSectionRows(sortSectionRows(rows), fileRows);
                }
            } catch (Exception ignored) {
                // Fall through to file registry lookup.
            }
        }
        return fileRows;
    }

    private List<Map<String, Object>> mergeDatasetSectionRows(List<Map<String, Object>> databaseRows, List<Map<String, Object>> fileRows) {
        if ((databaseRows == null || databaseRows.isEmpty()) && (fileRows == null || fileRows.isEmpty())) {
            return List.of();
        }
        Map<String, Map<String, Object>> merged = new LinkedHashMap<>();
        for (Map<String, Object> row : databaseRows == null ? List.<Map<String, Object>>of() : databaseRows) {
            merged.put(datasetSectionKey(row), row);
        }
        for (Map<String, Object> row : fileRows == null ? List.<Map<String, Object>>of() : fileRows) {
            String key = datasetSectionKey(row);
            Map<String, Object> current = merged.get(key);
            if (current == null || shouldPreferDatasetRow(row, current)) {
                merged.put(key, row);
            }
        }
        return normalizeSurveySectionRows(sortSectionRows(new ArrayList<>(merged.values())));
    }

    private boolean shouldPreferDatasetRow(Map<String, Object> candidate, Map<String, Object> current) {
        String candidateSavedAt = safeObject(candidate.get("savedAt"));
        String currentSavedAt = safeObject(current.get("savedAt"));
        if (!candidateSavedAt.isEmpty() && candidateSavedAt.compareTo(currentSavedAt) > 0) {
            return true;
        }
        if (candidateSavedAt.equals(currentSavedAt)) {
            return countRows(candidate.get("rows")) > countRows(current.get("rows"));
        }
        return countRows(candidate.get("rows")) > 0 && countRows(current.get("rows")) == 0;
    }

    private String datasetSectionKey(Map<String, Object> row) {
        return safeObject(row.get("sectionCode")) + ":" + safeObject(row.get("caseCode"));
    }

    private List<Map<String, Object>> sortSectionRows(List<Map<String, Object>> rows) {
        if (rows == null || rows.isEmpty()) {
            return List.of();
        }
        return rows.stream()
                .sorted(Comparator
                        .comparingInt((Map<String, Object> row) -> sectionOrderIndex(safeObject(row.get("sectionCode"))))
                        .thenComparing(row -> safeObject(row.get("caseCode")))
                        .thenComparing(row -> safeObject(row.get("savedAt")), Comparator.reverseOrder()))
                .collect(Collectors.toList());
    }

    private int sectionOrderIndex(String sectionCode) {
        String resolvedSectionCode = safe(sectionCode);
        for (int index = 0; index < SECTION_CONFIGS.size(); index++) {
            if (resolvedSectionCode.equals(safe(SECTION_CONFIGS.get(index).sectionCode))) {
                return index;
            }
        }
        return Integer.MAX_VALUE;
    }

    private int countRows(Object rows) {
        return rows instanceof List<?> ? ((List<?>) rows).size() : 0;
    }

    private String buildDatasetId(String productName) {
        String resolvedProductName = normalizeProductName(productName);
        if (resolvedProductName.isEmpty()) {
            return SHARED_DATASET_ID;
        }
        return SHARED_DATASET_PRODUCT_PREFIX + normalizeDatasetSegment(resolvedProductName);
    }

    private String buildDatasetName(String sourceFileName) {
        return SHARED_DATASET_NAME_KO;
    }

    private String buildLogId() {
        return "ESL_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16).toUpperCase(Locale.ROOT);
    }

    private String storageActorId() {
        return SHARED_OWNER_ACTOR_ID;
    }

    private String sharedDatasetName(boolean isEn) {
        return sharedDatasetName(isEn, "");
    }

    private String sharedDatasetName(boolean isEn, String productName) {
        String resolvedProductName = normalizeProductName(productName);
        if (resolvedProductName.isEmpty()) {
            return isEn ? SHARED_DATASET_NAME_EN : SHARED_DATASET_NAME_KO;
        }
        return (isEn ? SHARED_DATASET_NAME_EN : SHARED_DATASET_NAME_KO) + " / " + resolvedProductName;
    }

    private String normalizeProductName(String productName) {
        return safe(productName);
    }

    private Map<String, Object> withDerivedProductName(Map<String, Object> row) {
        if (row == null) {
            return new LinkedHashMap<>();
        }
        if (safeObject(row.get("productName")).isEmpty()) {
            row.put("productName", extractProductName(row));
        }
        return row;
    }

    private String extractProductName(Map<String, Object> row) {
        String datasetName = safeObject(row.get("datasetName"));
        int separatorIndex = datasetName.indexOf(" / ");
        if (separatorIndex >= 0 && separatorIndex + 3 < datasetName.length()) {
            return datasetName.substring(separatorIndex + 3).trim();
        }
        return extractProductNameFromDatasetId(safeObject(row.get("datasetId")));
    }

    private String extractProductNameFromDatasetId(String datasetId) {
        String resolvedDatasetId = safe(datasetId);
        if (!resolvedDatasetId.startsWith(SHARED_DATASET_PRODUCT_PREFIX)) {
            return "";
        }
        String suffix = resolvedDatasetId.substring(SHARED_DATASET_PRODUCT_PREFIX.length());
        return suffix.replace('_', ' ').trim();
    }

    private String normalizeDatasetSegment(String value) {
        String normalized = safe(value).replaceAll("[^0-9A-Za-z가-힣]+", "_").replaceAll("_+", "_").replaceAll("^_|_$", "");
        return normalized.isEmpty() ? "UNKNOWN" : normalized;
    }

    private boolean matchesProduct(Map<String, Object> row, String productName) {
        String resolvedProductName = normalizeProductName(productName);
        if (resolvedProductName.isEmpty()) {
            String datasetId = safeObject(row.get("datasetId"));
            return datasetId.isEmpty() || SHARED_DATASET_ID.equals(datasetId);
        }
        return resolvedProductName.equals(safeObject(row.get("productName")))
                || buildDatasetId(resolvedProductName).equals(safeObject(row.get("datasetId")));
    }

    private List<String> extractProductNames(List<Map<String, Object>> sections) {
        LinkedHashSet<String> products = new LinkedHashSet<>();
        for (Map<String, Object> section : sections == null ? List.<Map<String, Object>>of() : sections) {
            if (!"OUTPUT_PRODUCTS".equals(safeObject(section.get("sectionCode")))) {
                continue;
            }
            List<Map<String, Object>> rows = (List<Map<String, Object>>) (List<?>) (section.get("rows") instanceof List<?> ? section.get("rows") : List.of());
            for (Map<String, Object> row : rows) {
                Map<String, String> values = (Map<String, String>) (Map<?, ?>) (row.get("values") instanceof Map<?, ?> ? row.get("values") : Map.of());
                String materialName = normalizeProductName(values.get("materialName"));
                String groupValue = normalizeValue(values.get("group"));
                if (materialName.isBlank()) {
                    continue;
                }
                if (groupValue.contains("제품") || groupValue.equalsIgnoreCase("product") || products.isEmpty()) {
                    products.add(materialName);
                }
            }
        }
        return new ArrayList<>(products);
    }

    private List<String> resolveTargetProductNames(List<Map<String, Object>> sections) {
        List<String> productNames = extractProductNames(sections);
        return productNames.isEmpty() ? List.of("") : productNames;
    }

    @SuppressWarnings("unchecked")
    private String resolveSelectedProductName(Object sections) {
        if (!(sections instanceof List<?>)) {
            return "";
        }
        List<String> productNames = extractProductNames((List<Map<String, Object>>) (List<?>) sections);
        return productNames.isEmpty() ? "" : normalizeProductName(productNames.get(0));
    }

    private List<Map<String, Object>> filterSectionsForProduct(List<Map<String, Object>> sections, String productName) {
        String resolvedProductName = normalizeProductName(productName);
        if (resolvedProductName.isEmpty()) {
            return sections == null ? List.of() : sections;
        }
        List<Map<String, Object>> filtered = new ArrayList<>();
        for (Map<String, Object> section : sections == null ? List.<Map<String, Object>>of() : sections) {
            Map<String, Object> copy = new LinkedHashMap<>(section);
            if ("OUTPUT_PRODUCTS".equals(safeObject(section.get("sectionCode")))) {
                List<Map<String, Object>> nextRows = new ArrayList<>();
                List<Map<String, Object>> rows = (List<Map<String, Object>>) (List<?>) (section.get("rows") instanceof List<?> ? section.get("rows") : List.of());
                for (Map<String, Object> row : rows) {
                    Map<String, String> values = (Map<String, String>) (Map<?, ?>) (row.get("values") instanceof Map<?, ?> ? row.get("values") : Map.of());
                    String materialName = normalizeProductName(values.get("materialName"));
                    String groupValue = normalizeValue(values.get("group"));
                    if (materialName.equals(resolvedProductName) || groupValue.contains("부산물") || groupValue.equalsIgnoreCase("byproduct")) {
                        nextRows.add(row);
                    }
                }
                copy.put("rows", nextRows);
            }
            filtered.add(copy);
        }
        return filtered;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, String>> buildProductOptions(String selectedProductName, Object sections) {
        LinkedHashSet<String> productNames = new LinkedHashSet<>();
        for (String productName : readSharedProductNames()) {
            String normalizedProductName = normalizeProductName(productName);
            if (!normalizedProductName.isEmpty()) {
                productNames.add(normalizedProductName);
            }
        }
        if (sections instanceof List<?>) {
            productNames.addAll(extractProductNames((List<Map<String, Object>>) (List<?>) sections));
        }
        List<Map<String, String>> options = new ArrayList<>();
        for (String productName : productNames) {
            Map<String, String> option = new LinkedHashMap<>();
            option.put("value", productName);
            option.put("label", productName);
            options.add(option);
        }
        String resolvedSelected = normalizeProductName(selectedProductName);
        if (!resolvedSelected.isEmpty() && options.stream().noneMatch(option -> resolvedSelected.equals(option.get("value")))) {
            Map<String, String> option = new LinkedHashMap<>();
            option.put("value", resolvedSelected);
            option.put("label", resolvedSelected);
            options.add(0, option);
        }
        return options;
    }

    private List<String> readSharedProductNames() {
        LinkedHashSet<String> products = new LinkedHashSet<>();
        String resolvedActorId = storageActorId();
        if (isDraftTableReady()) {
            try {
                for (Map<String, Object> header : adminEmissionSurveyDraftMapper.selectCaseHeaders()) {
                    if (!matchesOwner(header, resolvedActorId)) {
                        continue;
                    }
                    Map<String, Object> row = withDerivedProductName(new LinkedHashMap<>(header));
                    String productName = normalizeProductName(safeObject(row.get("productName")));
                    if (!productName.isEmpty()) {
                        products.add(productName);
                    }
                }
            } catch (Exception ignored) {
                // Fall through to file/registry lookup when the DB is unavailable.
            }
        }
        for (Map<String, Object> row : filterDraftRegistryByActor(readDraftRegistryFromFile(), resolvedActorId).values()) {
            String productName = normalizeProductName(safeObject(row.get("productName")));
            if (!productName.isEmpty()) {
                products.add(productName);
            }
        }
        return new ArrayList<>(products);
    }

    private Map<String, Object> enrichPagePayloadWithProductSelection(Map<String, Object> payload, String productName, boolean isEn) {
        String resolvedProductName = normalizeProductName(productName);
        List<Map<String, String>> productOptions = buildProductOptions(resolvedProductName, payload.get("sections"));
        if (resolvedProductName.isEmpty() && !productOptions.isEmpty()) {
            resolvedProductName = safe(productOptions.get(0).get("value"));
        }
        List<Map<String, Object>> selectedDatasetSectionRows = readDatasetSections(storageActorId(), buildDatasetId(resolvedProductName));
        if (isEmptySectionList(payload.get("sections")) && !selectedDatasetSectionRows.isEmpty()) {
            payload.put("sections", selectedDatasetSectionRows);
        }
        payload.put("productOptions", productOptions);
        payload.put("selectedProductName", resolvedProductName);
        payload.put("selectedDatasetSectionRows", selectedDatasetSectionRows);
        payload.put("currentActorId", sharedDatasetName(isEn, resolvedProductName));
        return payload;
    }

    private boolean isEmptySectionList(Object sections) {
        return !(sections instanceof List<?>) || ((List<?>) sections).isEmpty();
    }

    private void clearSharedDataset() {
        Map<String, Map<String, Object>> draftRegistry = readDraftRegistryFromFile();
        draftRegistry.entrySet().removeIf(entry -> matchesOwner(entry.getValue(), storageActorId()));
        writeDraftRegistry(draftRegistry);

        Map<String, Map<String, Object>> uploadLogRegistry = readUploadLogRegistry();
        uploadLogRegistry.entrySet().removeIf(entry -> matchesOwner(entry.getValue(), storageActorId()));
        writeRegistry(UPLOAD_LOG_REGISTRY_PATH, uploadLogRegistry);

        if (!isDraftTableReady()) {
            return;
        }
        try {
            List<Map<String, Object>> headers = adminEmissionSurveyDraftMapper.selectCaseHeaders();
            for (Map<String, Object> header : headers) {
                if (!matchesOwner(header, storageActorId())) {
                    continue;
                }
                String caseId = safeObject(header.get("caseId"));
                adminEmissionSurveyDraftMapper.deleteCaseRows(caseId);
                adminEmissionSurveyDraftMapper.deleteCaseHeader(caseId);
            }
        } catch (Exception ignored) {
            // Keep file-backed cleanup even when DB cleanup is unavailable.
        }
        if (!isUploadLogTableReady()) {
            return;
        }
        try {
            adminEmissionSurveyDraftMapper.deleteUploadLogsByOwnerActorId(storageActorId());
        } catch (Exception ignored) {
            // Keep file-backed cleanup even when DB cleanup is unavailable.
        }
    }

    private void clearSharedDatasetProducts(List<String> productNames) {
        LinkedHashSet<String> targets = new LinkedHashSet<>();
        if (productNames == null || productNames.isEmpty()) {
            targets.add("");
        } else {
            for (String productName : productNames) {
                targets.add(normalizeProductName(productName));
            }
        }

        Map<String, Map<String, Object>> draftRegistry = readDraftRegistryFromFile();
        draftRegistry.entrySet().removeIf(entry -> matchesOwner(entry.getValue(), storageActorId())
                && targets.stream().anyMatch(productName -> matchesProduct(entry.getValue(), productName)));
        writeDraftRegistry(draftRegistry);

        if (!isDraftTableReady()) {
            return;
        }
        try {
            List<Map<String, Object>> headers = adminEmissionSurveyDraftMapper.selectCaseHeaders();
            for (Map<String, Object> header : headers) {
                if (!matchesOwner(header, storageActorId())) {
                    continue;
                }
                boolean matched = targets.stream().anyMatch(productName -> matchesProduct(header, productName));
                if (!matched) {
                    continue;
                }
                String caseId = safeObject(header.get("caseId"));
                adminEmissionSurveyDraftMapper.deleteCaseRows(caseId);
                adminEmissionSurveyDraftMapper.deleteCaseHeader(caseId);
            }
        } catch (Exception ignored) {
            // Keep file-backed cleanup even when DB cleanup is unavailable.
        }
    }

    private Map<String, Map<String, Object>> readDraftRegistryByClassification(String actorId,
                                                                               String lciMajorCode,
                                                                               String lciMiddleCode,
                                                                               String lciSmallCode,
                                                                               String caseCode,
                                                                               String productName) {
        Map<String, Map<String, Object>> matched = new LinkedHashMap<>();
        if (isDraftTableReady()) {
            try {
                Map<String, Object> params = new LinkedHashMap<>();
                params.put("ownerActorId", actorId);
                params.put("lciMajorCode", lciMajorCode);
                params.put("lciMiddleCode", lciMiddleCode);
                params.put("lciSmallCode", lciSmallCode);
                params.put("caseCode", caseCode);
                List<Map<String, Object>> headers = adminEmissionSurveyDraftMapper.selectCaseHeadersByClassification(params);
                for (Map<String, Object> header : headers) {
                    if (!matchesProduct(header, productName)) {
                        continue;
                    }
                    Map<String, Object> row = withDerivedProductName(new LinkedHashMap<>(header));
                    List<Map<String, Object>> items = adminEmissionSurveyDraftMapper.selectCaseRows(safeObject(header.get("caseId")));
                    List<Map<String, Object>> rows = new ArrayList<>();
                    for (Map<String, Object> item : items) {
                        Map<String, Object> draftRow = new LinkedHashMap<>();
                        draftRow.put("rowId", safeObject(item.get("rowKey")));
                        draftRow.put("values", parseJsonMap(safeObject(item.get("rowValuesJson"))));
                        rows.add(draftRow);
                    }
                    row.put("columns", normalizeSurveySectionColumns(
                            safeObject(header.get("sectionCode")),
                            parseJsonListOfMaps(safeObject(header.get("rowSchemaJson")))));
                    row.put("guidance", parseJsonStringList(safeObject(header.get("guidanceJson"))));
                    row.put("rows", rows);
                    matched.put(safeObject(header.get("sectionCode")) + ":" + safeObject(header.get("caseCode")), row);
                }
                if (!matched.isEmpty()) {
                    return matched;
                }
            } catch (Exception ignored) {
                // Fall through to file registry lookup.
            }
        }
        for (Map.Entry<String, Map<String, Object>> entry : readDraftRegistryFromFile().entrySet()) {
            Map<String, Object> value = entry.getValue();
            if (!matchesOwner(value, actorId)) {
                continue;
            }
            if (!matchesProduct(value, productName)) {
                continue;
            }
            if (!caseCode.equals(safeObject(value.get("caseCode")))) {
                continue;
            }
            if (!lciMajorCode.equals(safeObject(value.get("lciMajorCode")))) {
                continue;
            }
            if (!lciMiddleCode.equals(safeObject(value.get("lciMiddleCode")))) {
                continue;
            }
            String storedSmallCode = safeObject(value.get("lciSmallCode"));
            if (lciSmallCode.isEmpty()) {
                if (!storedSmallCode.isEmpty()) {
                    continue;
                }
            } else if (!lciSmallCode.equals(storedSmallCode)) {
                continue;
            }
            matched.put(safeObject(value.get("sectionCode")) + ":" + safeObject(value.get("caseCode")), value);
        }
        return matched;
    }

    private boolean matchesSectionAndCase(Map<String, Object> row, String sectionCode, String caseCode) {
        return safeObject(row.get("sectionCode")).equals(safe(sectionCode))
                && safeObject(row.get("caseCode")).equals(safe(caseCode));
    }

    private boolean matchesOwner(Map<String, Object> row, String actorId) {
        String resolvedActorId = safe(actorId);
        String ownerActorId = safeObject(row.get("ownerActorId"));
        if (resolvedActorId.isEmpty()) {
            return ownerActorId.isEmpty();
        }
        return resolvedActorId.equals(ownerActorId);
    }

    private String buildRegistryKey(EmissionSurveyCaseSaveRequest request) {
        return buildRegistryKey(Map.of(
                "ownerActorId", safe(request.getOwnerActorId()),
                "productName", safe(request.getProductName()),
                "sectionCode", safe(request.getSectionCode()),
                "caseCode", safe(request.getCaseCode()),
                "lciMajorCode", safe(request.getLciMajorCode()),
                "lciMiddleCode", safe(request.getLciMiddleCode()),
                "lciSmallCode", safe(request.getLciSmallCode())
        ));
    }

    private String buildRegistryKey(Map<String, Object> row) {
        String classificationKey = String.join(":",
                safeObject(row.get("ownerActorId")),
                safeObject(row.get("productName")),
                safeObject(row.get("lciMajorCode")),
                safeObject(row.get("lciMiddleCode")),
                safeObject(row.get("lciSmallCode")));
        return classificationKey + ":" + safeObject(row.get("sectionCode")) + ":" + safeObject(row.get("caseCode"));
    }

    private String buildCaseId(String ownerActorId,
                               String productName,
                               String sectionCode,
                               String caseCode,
                               String lciMajorCode,
                               String lciMiddleCode,
                               String lciSmallCode) {
        return "ESC_" + Math.abs((
                safe(ownerActorId) + ":" + safe(productName) + ":" + safe(sectionCode) + ":" + safe(caseCode) + ":" + safe(lciMajorCode) + ":" + safe(lciMiddleCode) + ":" + safe(lciSmallCode)
        ).hashCode());
    }

    private static final class SectionConfig {
        private final String sheetName;
        private final String majorCode;
        private final String majorLabel;
        private final String sectionCode;
        private final String sectionLabel;
        private final int guidanceStartRow;
        private final int guidanceEndRow;
        private final int guidanceMarkerCol;
        private final int guidanceTextCol;
        private final int titleRow;
        private final int titleCol;
        private final int startCol;
        private final int endCol;
        private final int headerStartRow;
        private final int headerEndRow;
        private final int dataStartRow;
        private final int dataEndRow;
        private final List<SectionMetaConfig> metadataConfigs;
        private final List<FixedColumnConfig> fixedColumns;

        private SectionConfig(String sheetName,
                              String majorCode,
                              String majorLabel,
                              String sectionCode,
                              String sectionLabel,
                              int guidanceStartRow,
                              int guidanceEndRow,
                              int guidanceMarkerCol,
                              int guidanceTextCol,
                              int titleRow,
                              int titleCol,
                              int startCol,
                              int endCol,
                              int headerStartRow,
                              int headerEndRow,
                              int dataStartRow,
                              int dataEndRow,
                              List<SectionMetaConfig> metadataConfigs,
                              List<FixedColumnConfig> fixedColumns) {
            this.sheetName = sheetName;
            this.majorCode = majorCode;
            this.majorLabel = majorLabel;
            this.sectionCode = sectionCode;
            this.sectionLabel = sectionLabel;
            this.guidanceStartRow = guidanceStartRow;
            this.guidanceEndRow = guidanceEndRow;
            this.guidanceMarkerCol = guidanceMarkerCol;
            this.guidanceTextCol = guidanceTextCol;
            this.titleRow = titleRow;
            this.titleCol = titleCol;
            this.startCol = startCol;
            this.endCol = endCol;
            this.headerStartRow = headerStartRow;
            this.headerEndRow = headerEndRow;
            this.dataStartRow = dataStartRow;
            this.dataEndRow = dataEndRow;
            this.metadataConfigs = metadataConfigs == null ? List.of() : metadataConfigs;
            this.fixedColumns = fixedColumns == null ? List.of() : fixedColumns;
        }
    }

    private static final class SectionMetaConfig {
        private final String key;
        private final String label;
        private final int labelRow;
        private final int labelCol;
        private final int valueRow;
        private final int valueCol;

        private SectionMetaConfig(String key,
                                  String label,
                                  int labelRow,
                                  int labelCol,
                                  int valueRow,
                                  int valueCol) {
            this.key = key;
            this.label = label;
            this.labelRow = labelRow;
            this.labelCol = labelCol;
            this.valueRow = valueRow;
            this.valueCol = valueCol;
        }
    }

    private static final class FixedColumnConfig {
        private final String key;
        private final String label;
        private final int colIndex;
        private final List<String> headerPath;

        private FixedColumnConfig(String key, String label, int colIndex, List<String> headerPath) {
            this.key = key;
            this.label = label;
            this.colIndex = colIndex;
            this.headerPath = headerPath == null || headerPath.isEmpty() ? List.of(label) : headerPath;
        }
    }
}
