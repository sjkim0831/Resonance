package egovframework.com.feature.admin.web;

import egovframework.com.platform.codex.service.AdminAuthorityPagePayloadSupport;

import egovframework.com.feature.member.model.vo.EntrprsManageVO;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
class AdminApprovalActionService {

    private static final Logger log = LoggerFactory.getLogger(AdminApprovalActionService.class);

    private final AdminMemberAccessSupport adminMemberAccessSupport;
    private final AdminAuthorityPagePayloadSupport adminAuthorityPagePayloadSupport;
    private final AdminPayloadSelectionSupport adminPayloadSelectionSupport;
    private final AdminApprovalStatusChangeService adminApprovalStatusChangeService;

    ActionResult submitMemberApproval(
            Object action,
            Object memberId,
            Object selectedMemberIds,
            Object rejectReason,
            HttpServletRequest request,
            boolean isEn,
            boolean hasAccess) {
        ActionResult result = ActionResult.member(
                normalizeAction(action),
                adminPayloadSelectionSupport.extractPayloadIds(selectedMemberIds, stringValue(memberId)),
                normalizeRejectReason(rejectReason));
        if (!hasAccess) {
            return result.forbidden(isEn
                    ? "You do not have permission to approve members."
                    : "회원 승인 처리를 수행할 권한이 없습니다.");
        }
        if (result.selectedIds.isEmpty()) {
            return result.badRequest(isEn
                    ? "No approval target was selected."
                    : "승인 처리할 회원을 선택해 주세요.");
        }
        if (result.targetStatus.isEmpty()) {
            return result.badRequest(isEn
                    ? "The requested action is not valid."
                    : "요청한 처리 작업이 올바르지 않습니다.");
        }
        try {
            for (String targetMemberId : result.selectedIds) {
                EntrprsManageVO targetMember = adminMemberAccessSupport.loadMemberById(targetMemberId);
                if (!adminMemberAccessSupport.canCurrentAdminAccessMember(request, targetMember)) {
                    return result.forbidden(isEn
                            ? "You can only approve members in your own company."
                            : "본인 회사 소속 회원만 승인 처리할 수 있습니다.");
                }
                adminApprovalStatusChangeService.processMemberApprovalStatusChange(
                        targetMemberId,
                        result.targetStatus,
                        result.rejectReason);
            }
            return result.success();
        } catch (Exception e) {
            log.error("Failed to process member approval action. action={}, memberIds={}",
                    result.action, result.selectedIds, e);
            return result.serverError(isEn
                    ? "An error occurred while processing the approval request."
                    : "회원 승인 처리 중 오류가 발생했습니다.");
        }
    }

    ActionResult submitCompanyApproval(
            Object action,
            Object insttId,
            Object selectedInsttIds,
            Object rejectReason,
            boolean isEn,
            boolean hasAccess) {
        ActionResult result = ActionResult.company(
                normalizeAction(action),
                adminPayloadSelectionSupport.extractPayloadIds(selectedInsttIds, stringValue(insttId)),
                normalizeRejectReason(rejectReason));
        if (!hasAccess) {
            return result.forbidden(isEn
                    ? "Only master administrators can approve companies."
                    : "회원사 승인 처리는 마스터 관리자만 수행할 수 있습니다.");
        }
        if (result.selectedIds.isEmpty()) {
            return result.badRequest(isEn
                    ? "No company was selected for approval."
                    : "승인 처리할 회원사를 선택해 주세요.");
        }
        if (result.targetStatus.isEmpty()) {
            return result.badRequest(isEn
                    ? "The requested action is not valid."
                    : "요청한 처리 작업이 올바르지 않습니다.");
        }
        try {
            for (String targetInsttId : result.selectedIds) {
                adminApprovalStatusChangeService.processCompanyApprovalStatusChange(
                        targetInsttId,
                        result.targetStatus,
                        result.rejectReason);
            }
            return result.success();
        } catch (Exception e) {
            log.error("Failed to process company approval action. action={}, insttIds={}",
                    result.action, result.selectedIds, e);
            return result.serverError(isEn
                    ? "An error occurred while processing the company approval request."
                    : "회원사 승인 처리 중 오류가 발생했습니다.");
        }
    }

    private String normalizeAction(Object action) {
        return stringValue(action).toLowerCase(Locale.ROOT);
    }

    private String normalizeRejectReason(Object rejectReason) {
        String normalized = adminAuthorityPagePayloadSupport.safeValue(stringValue(rejectReason));
        return normalized.length() <= 1000 ? normalized : normalized.substring(0, 1000);
    }

    private String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    @Getter
    static class ActionResult {
        private boolean success;
        private int statusCode;
        private String message;
        private String action;
        private String targetStatus;
        private String resultCode;
        private String rejectReason;
        private List<String> selectedIds;

        static ActionResult member(String action, List<String> selectedIds, String rejectReason) {
            return base(action, selectedIds, rejectReason);
        }

        static ActionResult company(String action, List<String> selectedIds, String rejectReason) {
            return base(action, selectedIds, rejectReason);
        }

        static ActionResult certificate(String action, List<String> selectedIds, String rejectReason) {
            return base(action, selectedIds, rejectReason);
        }

        private static ActionResult base(String action, List<String> selectedIds, String rejectReason) {
            ActionResult result = new ActionResult();
            result.action = action == null ? "" : action;
            result.selectedIds = selectedIds == null ? new ArrayList<>() : new ArrayList<>(selectedIds);
            result.rejectReason = rejectReason == null ? "" : rejectReason;
            result.targetStatus = "approve".equals(result.action) || "batch_approve".equals(result.action) ? "P"
                    : ("reject".equals(result.action) || "batch_reject".equals(result.action) ? "R" : "");
            result.statusCode = HttpStatus.OK.value();
            return result;
        }

        ActionResult success() {
            this.success = true;
            this.resultCode = "P".equals(targetStatus)
                    ? (selectedIds.size() > 1 ? "batchApproved" : "approved")
                    : (selectedIds.size() > 1 ? "batchRejected" : "rejected");
            return this;
        }

        ActionResult badRequest(String message) {
            this.statusCode = HttpStatus.BAD_REQUEST.value();
            this.message = message;
            return this;
        }

        ActionResult forbidden(String message) {
            this.statusCode = HttpStatus.FORBIDDEN.value();
            this.message = message;
            return this;
        }

        ActionResult serverError(String message) {
            this.statusCode = HttpStatus.INTERNAL_SERVER_ERROR.value();
            this.message = message;
            return this;
        }

        ResponseEntity<Map<String, Object>> toResponseEntity() {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", success);
            if (success) {
                response.put("result", resultCode);
                response.put("selectedIds", selectedIds);
            }
            if (message != null && !message.isEmpty()) {
                response.put("message", message);
            }
            return ResponseEntity.status(statusCode).body(response);
        }

        boolean isSuccess() {
            return success;
        }

        String getMessage() {
            return message;
        }

        String getAction() {
            return action;
        }

        String getTargetStatus() {
            return targetStatus;
        }

        String getResultCode() {
            return resultCode;
        }

        String getRejectReason() {
            return rejectReason;
        }

        List<String> getSelectedIds() {
            return selectedIds;
        }
    }
}
