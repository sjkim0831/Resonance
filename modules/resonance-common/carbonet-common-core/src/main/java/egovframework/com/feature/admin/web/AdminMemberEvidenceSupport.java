package egovframework.com.feature.admin.web;

import egovframework.com.platform.codex.service.AdminAuthorityPagePayloadSupport;

import egovframework.com.feature.member.model.vo.EntrprsMberFileVO;
import egovframework.com.feature.member.model.vo.EntrprsManageVO;
import egovframework.com.feature.member.model.vo.InsttInfoVO;
import egovframework.com.feature.member.model.vo.InstitutionStatusVO;
import egovframework.com.feature.member.service.EnterpriseMemberService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.File;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminMemberEvidenceSupport {

    private final EnterpriseMemberService entrprsManageService;
    private final AdminAuthorityPagePayloadSupport authorityPagePayloadSupport;

    public EntrprsManageVO mergeMemberWithInstitutionInfo(EntrprsManageVO member, InstitutionStatusVO institutionInfo) {
        if (institutionInfo == null || institutionInfo.isEmpty()) {
            return member;
        }
        if (isBlankMemberValue(member.getCmpnyNm())) {
            member.setCmpnyNm(stringValue(institutionInfo.getInsttNm()));
        }
        if (isBlankMemberValue(member.getCxfc())) {
            member.setCxfc(stringValue(institutionInfo.getReprsntNm()));
        }
        if (isBlankMemberValue(member.getBizrno())) {
            member.setBizrno(stringValue(institutionInfo.getBizrno()));
        }
        if (isBlankMemberValue(member.getApplcntEmailAdres())) {
            member.setApplcntEmailAdres(stringValue(institutionInfo.getChargerEmail()));
        }
        if (isBlankMemberValue(member.getApplcntNm())) {
            member.setApplcntNm(stringValue(institutionInfo.getChargerNm()));
        }
        return member;
    }

    public List<EvidenceFileView> loadEvidenceFiles(EntrprsManageVO member) {
        try {
            List<EntrprsMberFileVO> fileList = entrprsManageService.selectEntrprsMberFiles(member.getEntrprsmberId());
            if (fileList != null && !fileList.isEmpty()) {
                List<EvidenceFileView> evidenceFiles = new ArrayList<>();
                for (EntrprsMberFileVO fileVO : fileList) {
                    String path = authorityPagePayloadSupport.safeValue(fileVO.getFileStrePath());
                    if (path.isEmpty()) {
                        continue;
                    }
                    String normalizedFileId = authorityPagePayloadSupport.safeValue(fileVO.getFileId());
                    String previewUrl = "";
                    String downloadUrl = "";
                    if (!normalizedFileId.isEmpty()) {
                        String encodedFileId = java.net.URLEncoder.encode(normalizedFileId, java.nio.charset.StandardCharsets.UTF_8);
                        previewUrl = "/admin/member/file?fileId=" + encodedFileId;
                        downloadUrl = previewUrl + "&download=true";
                    }
                    String originalName = authorityPagePayloadSupport.safeValue(fileVO.getOrignlFileNm());
                    String displayName = originalName.isEmpty() ? new File(path).getName() : originalName;
                    evidenceFiles.add(new EvidenceFileView(
                            displayName,
                            authorityPagePayloadSupport.safeValue(fileVO.getStreFileNm()),
                            authorityPagePayloadSupport.safeValue(fileVO.getFileId()),
                            authorityPagePayloadSupport.safeValue(fileVO.getRegDate()),
                            path,
                            previewUrl,
                            downloadUrl));
                }
                if (!evidenceFiles.isEmpty()) {
                    return evidenceFiles;
                }
            }
        } catch (Exception ignored) {
        }
        return buildEvidenceFilesFromPath(member.getBizRegFilePath());
    }

    public InstitutionStatusVO loadInstitutionInfo(EntrprsManageVO member) {
        try {
            if (authorityPagePayloadSupport.safeValue(member.getInsttId()).isEmpty()
                    && (authorityPagePayloadSupport.safeValue(member.getBizrno()).isEmpty()
                    || authorityPagePayloadSupport.safeValue(member.getCxfc()).isEmpty())) {
                return null;
            }
            InsttInfoVO insttInfoVO = new InsttInfoVO();
            if (!authorityPagePayloadSupport.safeValue(member.getInsttId()).isEmpty()) {
                insttInfoVO.setInsttId(member.getInsttId());
            } else {
                insttInfoVO.setBizrno(member.getBizrno());
                insttInfoVO.setReprsntNm(member.getCxfc());
            }
            return entrprsManageService.selectInsttInfoForStatus(insttInfoVO);
        } catch (Exception e) {
            return null;
        }
    }

    private List<EvidenceFileView> buildEvidenceFilesFromPath(String filePathValue) {
        String value = authorityPagePayloadSupport.safeValue(filePathValue);
        if (value.isEmpty()) {
            return Collections.emptyList();
        }
        return java.util.Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(path -> !path.isEmpty())
                .map(path -> new EvidenceFileView(
                        new File(path).getName(),
                        "",
                        "",
                        "",
                        path,
                        "",
                        ""))
                .collect(Collectors.toList());
    }

    private boolean isBlankMemberValue(String value) {
        String normalized = authorityPagePayloadSupport.safeValue(value);
        return normalized.isEmpty()
                || "-".equals(normalized)
                || "000000".equals(normalized)
                || "주소미입력".equals(normalized)
                || "address pending".equalsIgnoreCase(normalized);
    }

    private String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    public static class EvidenceFileView {
        private final String fileName;
        private final String storedFileName;
        private final String fileId;
        private final String regDate;
        private final String filePath;
        private final String previewUrl;
        private final String downloadUrl;

        public EvidenceFileView(String fileName, String storedFileName, String fileId, String regDate, String filePath, String previewUrl, String downloadUrl) {
            this.fileName = fileName;
            this.storedFileName = storedFileName;
            this.fileId = fileId;
            this.regDate = regDate;
            this.filePath = filePath;
            this.previewUrl = previewUrl;
            this.downloadUrl = downloadUrl;
        }

        public String getFileName() { return fileName; }
        public String getStoredFileName() { return storedFileName; }
        public String getFileId() { return fileId; }
        public String getRegDate() { return regDate; }
        public String getFilePath() { return filePath; }
        public String getPreviewUrl() { return previewUrl; }
        public String getDownloadUrl() { return downloadUrl; }
    }
}
