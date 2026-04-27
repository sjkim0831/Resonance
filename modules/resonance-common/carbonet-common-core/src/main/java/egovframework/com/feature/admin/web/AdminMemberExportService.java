package egovframework.com.feature.admin.web;

import egovframework.com.platform.codex.model.AdminRoleAssignmentVO;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import egovframework.com.feature.auth.domain.entity.EmplyrInfo;
import egovframework.com.feature.auth.domain.repository.EmployeeMemberRepository;
import egovframework.com.feature.member.model.vo.CompanyListItemVO;
import egovframework.com.feature.member.model.vo.EntrprsManageVO;
import egovframework.com.feature.member.service.EnterpriseMemberService;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.DataFormat;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletResponse;
import java.io.ByteArrayOutputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.text.SimpleDateFormat;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminMemberExportService {

    private static final String ROLE_SYSTEM_MASTER = "ROLE_SYSTEM_MASTER";

    private final EnterpriseMemberService entrprsManageService;
    private final EmployeeMemberRepository employMemberRepository;
    private final AuthGroupManageService authGroupManageService;

    public ResponseEntity<byte[]> buildMemberListExcel(
            String searchKeyword,
            String membershipType,
            String sbscrbSttus) throws Exception {
        EntrprsManageVO searchVO = new EntrprsManageVO();
        searchVO.setPageIndex(1);
        searchVO.setFirstIndex(0);

        searchVO.setSearchKeyword(safeString(searchKeyword));
        searchVO.setSearchCondition("all");

        String normalizedMembershipType = normalizeMembershipCode(safeString(membershipType).toUpperCase(Locale.ROOT));
        if (!normalizedMembershipType.isEmpty()) {
            searchVO.setEntrprsSeCode(normalizedMembershipType);
        }

        String normalizedStatus = safeString(sbscrbSttus);
        if (!normalizedStatus.isEmpty()) {
            searchVO.setSbscrbSttus(normalizedStatus);
        }

        int totalCount = entrprsManageService.selectEntrprsMberListTotCnt(searchVO);
        searchVO.setRecordCountPerPage(Math.max(totalCount, 1));

        @SuppressWarnings("unchecked")
        List<EntrprsManageVO> memberList = (List<EntrprsManageVO>) (List<?>) entrprsManageService.selectEntrprsMberList(searchVO);

        byte[] content;
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("회원목록");
            CellStyle headerStyle = buildHeaderStyle(workbook);
            CellStyle dateTimeStyle = buildDateTimeStyle(workbook);

            String[] headers = {"번호", "회원명", "아이디", "회원유형", "소속기관", "가입일", "상태"};
            writeHeaderRow(sheet, headerStyle, headers);

            int rowIdx = 1;
            int no = totalCount;
            for (EntrprsManageVO member : memberList) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(no--);
                row.createCell(1).setCellValue(safeString(member.getApplcntNm()));
                row.createCell(2).setCellValue(safeString(member.getEntrprsmberId()));
                row.createCell(3).setCellValue(resolveMembershipTypeLabel(member.getEntrprsSeCode()));
                row.createCell(4).setCellValue(safeString(member.getCmpnyNm()));

                Cell joinDateCell = row.createCell(5);
                Date joinDate = parseJoinDate(member.getSbscrbDe());
                if (joinDate != null) {
                    joinDateCell.setCellValue(joinDate);
                    joinDateCell.setCellStyle(dateTimeStyle);
                } else {
                    joinDateCell.setCellValue(safeString(member.getSbscrbDe()));
                }

                row.createCell(6).setCellValue(resolveStatusLabel(member.getEntrprsMberSttus()));
            }

            autosizeColumns(sheet, headers.length);
            workbook.write(out);
            content = out.toByteArray();
        }

        return excelResponse(content, "member_list");
    }

    public ResponseEntity<byte[]> buildAdminListExcel(
            String searchKeyword,
            String sbscrbSttus,
            String currentUserId,
            String currentUserAuthorCode,
            boolean canManage,
            String actorInsttId) throws Exception {
        if (!canManage) {
            return ResponseEntity.status(HttpServletResponse.SC_FORBIDDEN).build();
        }

        List<EmplyrInfo> memberList = selectVisibleAdminMembers(
                currentUserId,
                currentUserAuthorCode,
                searchKeyword,
                sbscrbSttus,
                actorInsttId,
                canManage);
        int totalCount = memberList.size();

        byte[] content;
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("관리자목록");
            CellStyle headerStyle = buildHeaderStyle(workbook);
            CellStyle dateTimeStyle = buildDateTimeStyle(workbook);

            String[] headers = {"번호", "성명", "아이디", "조직 ID", "이메일", "가입일", "상태"};
            writeHeaderRow(sheet, headerStyle, headers);

            int rowIdx = 1;
            int no = totalCount;
            for (EmplyrInfo member : memberList) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(no--);
                row.createCell(1).setCellValue(safeString(member.getUserNm()));
                row.createCell(2).setCellValue(safeString(member.getEmplyrId()));
                row.createCell(3).setCellValue(safeString(member.getOrgnztId()));
                row.createCell(4).setCellValue(safeString(member.getEmailAdres()));

                Cell joinDateCell = row.createCell(5);
                if (member.getSbscrbDe() != null) {
                    joinDateCell.setCellValue(Timestamp.valueOf(member.getSbscrbDe()));
                    joinDateCell.setCellStyle(dateTimeStyle);
                } else {
                    joinDateCell.setCellValue("-");
                }

                row.createCell(6).setCellValue(resolveStatusLabel(member.getEmplyrStusCode()));
            }

            autosizeColumns(sheet, headers.length);
            workbook.write(out);
            content = out.toByteArray();
        }

        return excelResponse(content, "admin_list");
    }

    public ResponseEntity<byte[]> buildCompanyListExcel(
            String searchKeyword,
            String sbscrbSttus,
            boolean canManage,
            String scopedInsttId) throws Exception {
        if (!canManage) {
            return ResponseEntity.status(HttpServletResponse.SC_FORBIDDEN).build();
        }

        Map<String, Object> searchParams = new LinkedHashMap<>();
        searchParams.put("keyword", safeString(searchKeyword));
        searchParams.put("status", safeString(sbscrbSttus).toUpperCase(Locale.ROOT));
        searchParams.put("insttId", safeString(scopedInsttId));

        int totalCount = entrprsManageService.searchCompanyListTotCnt(searchParams);
        searchParams.put("offset", 0);
        searchParams.put("pageSize", Math.max(totalCount, 1));
        List<?> companyList = entrprsManageService.searchCompanyListPaged(searchParams);

        byte[] content;
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("회원사목록");
            CellStyle headerStyle = buildHeaderStyle(workbook);

            String[] headers = {"번호", "기관명", "사업자등록번호", "대표자명", "상태"};
            writeHeaderRow(sheet, headerStyle, headers);

            int rowIdx = 1;
            int no = totalCount;
            for (Object company : companyList) {
                Map<String, String> rowValues = extractCompanyRow(company);
                if (rowValues == null) {
                    continue;
                }
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(no--);
                row.createCell(1).setCellValue(rowValues.get("companyName"));
                row.createCell(2).setCellValue(rowValues.get("businessNumber"));
                row.createCell(3).setCellValue(rowValues.get("representativeName"));
                row.createCell(4).setCellValue(resolveInstitutionStatusLabel(rowValues.get("joinStat")));
            }

            autosizeColumns(sheet, headers.length);
            workbook.write(out);
            content = out.toByteArray();
        }

        return excelResponse(content, "company_list");
    }

    private List<EmplyrInfo> selectVisibleAdminMembers(
            String currentUserId,
            String currentUserAuthorCode,
            String keyword,
            String status,
            String actorInsttId,
            boolean masterAccess) throws Exception {
        List<EmplyrInfo> employees = employMemberRepository.searchAdminMembersForManagement(
                safeString(keyword),
                safeString(status).toUpperCase(Locale.ROOT),
                masterAccess ? "" : safeString(actorInsttId),
                Sort.by(Sort.Order.desc("sbscrbDe"), Sort.Order.asc("emplyrId")));
        Map<String, String> authorCodeByUserId = new LinkedHashMap<>();
        for (AdminRoleAssignmentVO assignment : authGroupManageService.selectAdminRoleAssignments()) {
            authorCodeByUserId.put(
                    safeString(assignment.getEmplyrId()),
                    safeString(assignment.getAuthorCode()).toUpperCase(Locale.ROOT));
        }
        return employees.stream()
                .filter(item -> {
                    String userId = safeString(item.getEmplyrId());
                    String authorCode = authorCodeByUserId.getOrDefault(userId, "");
                    if (authorCode.isEmpty()) {
                        return false;
                    }
                    if (!masterAccess) {
                        String targetInsttId = safeString(item.getInsttId());
                        if (safeString(actorInsttId).isEmpty() || !safeString(actorInsttId).equals(targetInsttId)) {
                            return false;
                        }
                        if (ROLE_SYSTEM_MASTER.equals(authorCode)) {
                            return false;
                        }
                    }
                    return true;
                })
                .collect(Collectors.toList());
    }

    private Map<String, String> extractCompanyRow(Object company) {
        String companyName;
        String businessNumber;
        String representativeName;
        String joinStat;
        if (company instanceof CompanyListItemVO) {
            CompanyListItemVO companyVO = (CompanyListItemVO) company;
            companyName = stringValue(companyVO.getCmpnyNm());
            businessNumber = stringValue(companyVO.getBizrno());
            representativeName = stringValue(companyVO.getCxfc());
            joinStat = stringValue(companyVO.getJoinStat());
        } else if (company instanceof Map) {
            Map<?, ?> companyMap = (Map<?, ?>) company;
            companyName = firstNonBlank(stringValue(companyMap.get("cmpnyNm")), stringValue(companyMap.get("CMPNY_NM")));
            businessNumber = firstNonBlank(stringValue(companyMap.get("bizrno")), stringValue(companyMap.get("BIZRNO")));
            representativeName = firstNonBlank(stringValue(companyMap.get("cxfc")), stringValue(companyMap.get("CXFC")));
            joinStat = firstNonBlank(stringValue(companyMap.get("joinStat")), stringValue(companyMap.get("JOIN_STAT")));
        } else {
            return null;
        }

        Map<String, String> row = new LinkedHashMap<>();
        row.put("companyName", companyName);
        row.put("businessNumber", businessNumber);
        row.put("representativeName", representativeName);
        row.put("joinStat", joinStat);
        return row;
    }

    private ResponseEntity<byte[]> excelResponse(byte[] content, String prefix) throws Exception {
        String baseName = prefix + "_" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss")) + ".xlsx";
        String encoded = URLEncoder.encode(baseName, StandardCharsets.UTF_8.name()).replaceAll("\\+", "%20");
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.set(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encoded);
        return ResponseEntity.ok().headers(headers).body(content);
    }

    private CellStyle buildHeaderStyle(XSSFWorkbook workbook) {
        Font headerFont = workbook.createFont();
        headerFont.setBold(true);
        CellStyle headerStyle = workbook.createCellStyle();
        headerStyle.setFont(headerFont);
        headerStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        headerStyle.setAlignment(HorizontalAlignment.CENTER);
        return headerStyle;
    }

    private CellStyle buildDateTimeStyle(XSSFWorkbook workbook) {
        DataFormat dataFormat = workbook.createDataFormat();
        CellStyle dateTimeStyle = workbook.createCellStyle();
        dateTimeStyle.setDataFormat(dataFormat.getFormat("yyyy-mm-dd hh:mm:ss"));
        dateTimeStyle.setAlignment(HorizontalAlignment.CENTER);
        return dateTimeStyle;
    }

    private void writeHeaderRow(Sheet sheet, CellStyle headerStyle, String[] headers) {
        Row headerRow = sheet.createRow(0);
        for (int i = 0; i < headers.length; i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(headerStyle);
        }
    }

    private void autosizeColumns(Sheet sheet, int columnCount) {
        for (int i = 0; i < columnCount; i++) {
            sheet.autoSizeColumn(i);
            int width = sheet.getColumnWidth(i);
            sheet.setColumnWidth(i, Math.min(width + 1024, 256 * 50));
        }
    }

    private String normalizeMembershipCode(String membershipType) {
        if ("EMITTER".equals(membershipType)) return "E";
        if ("PERFORMER".equals(membershipType)) return "P";
        if ("CENTER".equals(membershipType)) return "C";
        if ("GOV".equals(membershipType)) return "G";
        if ("E".equals(membershipType) || "P".equals(membershipType) || "C".equals(membershipType) || "G".equals(membershipType)) {
            return membershipType;
        }
        return "";
    }

    private String resolveMembershipTypeLabel(String code) {
        String value = safeString(code).toUpperCase(Locale.ROOT);
        if ("E".equals(value) || "EMITTER".equals(value)) return "CO2 배출 및 포집 기업";
        if ("P".equals(value) || "PERFORMER".equals(value)) return "CCUS 사업 수행 기업";
        if ("C".equals(value) || "CENTER".equals(value)) return "CCUS 진흥센터";
        if ("G".equals(value) || "GOV".equals(value)) return "주무관청 / 행정기관";
        return value.isEmpty() ? "기타" : value;
    }

    private String resolveStatusLabel(String statusCode) {
        String value = safeString(statusCode).toUpperCase(Locale.ROOT);
        if ("P".equals(value)) return "활성";
        if ("A".equals(value)) return "승인 대기";
        if ("R".equals(value)) return "반려";
        if ("D".equals(value)) return "삭제";
        if ("X".equals(value)) return "차단";
        return value.isEmpty() ? "기타" : value;
    }

    private String resolveInstitutionStatusLabel(String statusCode) {
        String value = safeString(statusCode).toUpperCase(Locale.ROOT);
        if ("A".equals(value)) return "검토 중";
        if ("P".equals(value)) return "가입 승인 완료";
        if ("R".equals(value)) return "반려";
        if ("X".equals(value)) return "차단";
        if ("D".equals(value)) return "삭제";
        return value.isEmpty() ? "-" : value;
    }

    private String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }

    private String firstNonBlank(String primary, String fallback) {
        return safeString(primary).isEmpty() ? safeString(fallback) : safeString(primary);
    }

    private Date parseJoinDate(String value) {
        String normalized = safeString(value);
        if (normalized.isEmpty()) {
            return null;
        }
        String[] patterns = {
                "yyyy-MM-dd HH:mm:ss",
                "yyyy.MM.dd HH:mm:ss",
                "yyyy/MM/dd HH:mm:ss",
                "yyyyMMddHHmmss",
                "yyyy-MM-dd",
                "yyyy.MM.dd",
                "yyyy/MM/dd",
                "yyyyMMdd"
        };
        for (String pattern : patterns) {
            try {
                return new SimpleDateFormat(pattern).parse(normalized);
            } catch (Exception ignored) {
            }
        }
        return null;
    }
}
