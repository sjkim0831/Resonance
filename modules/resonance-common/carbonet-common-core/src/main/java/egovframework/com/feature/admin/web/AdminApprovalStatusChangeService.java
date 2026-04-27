package egovframework.com.feature.admin.web;

import egovframework.com.feature.member.model.vo.EntrprsManageVO;
import egovframework.com.feature.member.model.vo.InsttInfoVO;
import egovframework.com.feature.member.model.vo.InstitutionStatusVO;
import egovframework.com.feature.member.service.EnterpriseMemberService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AdminApprovalStatusChangeService {

    private final EnterpriseMemberService entrprsManageService;

    public void processMemberApprovalStatusChange(String memberId, String targetStatus, String rejectReason) throws Exception {
        String normalizedMemberId = safeString(memberId);
        String normalizedTargetStatus = normalizeMemberStatusCode(targetStatus);
        String normalizedRejectReason = trimToLen(safeString(rejectReason), 1000);
        if (normalizedMemberId.isEmpty() || normalizedTargetStatus.isEmpty()) {
            return;
        }
        EntrprsManageVO member = entrprsManageService.selectEntrprsmberByMberId(normalizedMemberId);
        if (member == null || safeString(member.getEntrprsmberId()).isEmpty()) {
            return;
        }
        member.setEntrprsMberSttus(normalizedTargetStatus);
        member.setRjctRsn(normalizedRejectReason.isEmpty() ? safeString(member.getRjctRsn()) : normalizedRejectReason);
        if ("R".equals(normalizedTargetStatus)) {
            member.setRjctPnttm(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        } else {
            member.setRjctPnttm("");
        }
        entrprsManageService.updateEntrprsmber(member);
        if ("P".equals(normalizedTargetStatus)) {
            entrprsManageService.ensureEnterpriseSecurityMapping(member.getUniqId());
        }
    }

    public void processCompanyApprovalStatusChange(String insttId, String targetStatus, String rejectReason) throws Exception {
        String normalizedInsttId = safeString(insttId);
        String normalizedTargetStatus = normalizeMemberStatusCode(targetStatus);
        String normalizedRejectReason = trimToLen(safeString(rejectReason), 1000);
        if (normalizedInsttId.isEmpty() || normalizedTargetStatus.isEmpty()) {
            return;
        }
        InstitutionStatusVO current = loadInstitutionInfoByInsttId(normalizedInsttId);
        if (current == null || current.isEmpty()) {
            return;
        }
        InsttInfoVO vo = new InsttInfoVO();
        vo.setInsttId(normalizedInsttId);
        vo.setInsttNm(current.getInsttNm());
        vo.setReprsntNm(current.getReprsntNm());
        vo.setBizrno(current.getBizrno());
        vo.setZip(current.getZip());
        vo.setAdres(current.getAdres());
        vo.setDetailAdres(current.getDetailAdres());
        vo.setBizRegFilePath(current.getBizRegFilePath());
        vo.setInsttSttus(normalizedTargetStatus);
        vo.setEntrprsSeCode(current.getEntrprsSeCode());
        vo.setRjctRsn(normalizedRejectReason.isEmpty() ? safeString(current.getRjctRsn()) : normalizedRejectReason);
        if ("R".equals(normalizedTargetStatus)) {
            vo.setRjctPnttm(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        } else {
            vo.setRjctPnttm("");
        }
        vo.setChargerNm(current.getChargerNm());
        vo.setChargerEmail(current.getChargerEmail());
        vo.setChargerTel(current.getChargerTel());
        entrprsManageService.updateInsttInfo(vo);
    }

    private InstitutionStatusVO loadInstitutionInfoByInsttId(String insttId) throws Exception {
        String normalizedInsttId = safeString(insttId);
        if (normalizedInsttId.isEmpty()) {
            return null;
        }
        InsttInfoVO searchVO = new InsttInfoVO();
        searchVO.setInsttId(normalizedInsttId);
        return entrprsManageService.selectInsttInfoForStatus(searchVO);
    }

    private String normalizeMemberStatusCode(String statusCode) {
        String value = safeString(statusCode).toUpperCase(Locale.ROOT);
        if ("P".equals(value) || "A".equals(value) || "R".equals(value) || "D".equals(value) || "X".equals(value)) {
            return value;
        }
        return "";
    }

    private String trimToLen(String value, int maxLen) {
        String normalized = safeString(value);
        if (normalized.length() <= maxLen) {
            return normalized;
        }
        return normalized.substring(0, maxLen);
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }
}
