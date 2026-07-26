"""Deterministic option-source resolution for generated selection fields."""

from __future__ import annotations

from typing import Any, Dict, List


def _options(*pairs: tuple[str, str]) -> List[Dict[str, str]]:
    return [{"value": value, "label": label} for value, label in pairs]


GENERAL_STATUS = _options(
    ("DRAFT", "초안"),
    ("READY", "준비"),
    ("IN_PROGRESS", "진행 중"),
    ("PENDING", "대기"),
    ("APPROVED", "승인"),
    ("REJECTED", "반려"),
    ("COMPLETED", "완료"),
    ("FAILED", "실패"),
    ("CANCELLED", "취소"),
)

STATIC_OPTIONS: Dict[str, List[Dict[str, str]]] = {
    "decisionCode": _options(("APPROVE", "승인"), ("REJECT", "반려"), ("REQUEST_CHANGE", "보완 요청")),
    "decision": _options(("APPROVE", "승인"), ("REJECT", "반려"), ("HOLD", "보류")),
    "rejectionReasonCode": _options(
        ("MISSING_DATA", "필수자료 누락"),
        ("INVALID_DATA", "데이터 오류"),
        ("INSUFFICIENT_EVIDENCE", "증빙 불충분"),
        ("POLICY_VIOLATION", "정책 위반"),
        ("OTHER", "기타"),
    ),
    "riskLevel": _options(("LOW", "낮음"), ("MEDIUM", "보통"), ("HIGH", "높음"), ("CRITICAL", "심각")),
    "scopeCode": _options(("SCOPE_1", "Scope 1"), ("SCOPE_2", "Scope 2"), ("SCOPE_3", "Scope 3")),
    "qualityStatus": _options(("VALID", "적합"), ("WARNING", "확인 필요"), ("INVALID", "부적합")),
    "qualityCode": _options(("A", "우수"), ("B", "양호"), ("C", "보통"), ("D", "보완 필요")),
    "caseType": _options(
        ("HAPPY_PATH", "정상"),
        ("VALIDATION", "검증"),
        ("EXCEPTION", "예외"),
        ("AUTHORITY", "권한"),
        ("ISOLATION", "데이터 격리"),
        ("RECOVERY", "복구"),
    ),
    "jobType": _options(("DESIGN", "설계"), ("FRONTEND", "프론트엔드"), ("BACKEND", "백엔드"), ("TEST", "테스트"), ("DEPLOY", "배포")),
    "resourceType": _options(("PAGE", "페이지"), ("COMPONENT", "컴포넌트"), ("SECTION", "섹션"), ("API", "API"), ("DATABASE", "DB"), ("AUTOMATION", "자동화")),
    "deploymentStatus": _options(("PLANNED", "예정"), ("BUILDING", "빌드 중"), ("DEPLOYED", "배포 완료"), ("FAILED", "실패"), ("ROLLED_BACK", "롤백")),
    "automationStatus": _options(("MANUAL", "수동"), ("ASSISTED", "보조 자동화"), ("AUTOMATIC", "자동")),
    "languageCode": _options(("ko", "한국어"), ("en", "영어")),
    "downloadFormat": _options(("PDF", "PDF"), ("XLSX", "Excel"), ("CSV", "CSV")),
    "flowType": _options(("INPUT", "투입"), ("OUTPUT", "산출"), ("TRANSFER", "이관")),
    "impactCategory": _options(("CLIMATE_CHANGE", "기후변화"), ("RESOURCE_USE", "자원사용"), ("WATER_USE", "물사용"), ("ECOTOXICITY", "생태독성")),
    "tradeType": _options(("SUPPLY", "공급"), ("DEMAND", "수요"), ("MATCHING", "매칭"), ("CONTRACT", "계약")),
    "settlementStatus": _options(("PENDING", "정산 대기"), ("CALCULATED", "산정 완료"), ("PAID", "지급 완료"), ("REFUNDED", "환불")),
    "reductionMethod": _options(("EFFICIENCY", "효율 개선"), ("FUEL_SWITCH", "연료 전환"), ("RENEWABLE", "재생에너지"), ("CAPTURE", "포집·활용·저장"), ("PROCESS_CHANGE", "공정 개선")),
    "sourceType": _options(("MANUAL", "직접 입력"), ("EXCEL", "엑셀"), ("API", "외부 API"), ("METER", "계측기"), ("DOCUMENT", "증빙 문서")),
    "attendanceStatus": _options(("PRESENT", "출석"), ("ABSENT", "결석"), ("LATE", "지각"), ("EXCUSED", "인정 결석")),
    "enrollmentStatus": _options(("APPLIED", "신청"), ("APPROVED", "승인"), ("IN_PROGRESS", "수강 중"), ("COMPLETED", "수료"), ("CANCELLED", "취소")),
    "reviewStage": _options(("SUBMITTED", "제출"), ("REVIEW", "검토"), ("SUPPLEMENT", "보완"), ("APPROVAL", "승인"), ("CLOSED", "종료")),
    "channel": _options(("SYSTEM", "시스템"), ("API", "API"), ("EMAIL", "이메일"), ("OFFLINE", "오프라인")),
    "byproductAllocation": _options(("MASS", "질량 기준"), ("ENERGY", "에너지 기준"), ("ECONOMIC", "경제적 가치 기준"), ("SYSTEM_EXPANSION", "시스템 확장")),
    "reportType": _options(("SUMMARY", "요약 보고서"), ("DETAIL", "상세 보고서"), ("CERTIFICATE", "인증서"), ("REGULATORY", "규제 제출")),
}

DYNAMIC_FIELDS = {
    "processCode": ("PROCESS", "processCode", "processName"),
    "stepCode": ("PROCESS_STEP", "stepCode", "stepName"),
    "actorCode": ("ACTOR", "actorCode", "actorName"),
    "ownerActorCode": ("ACTOR", "actorCode", "actorName"),
    "nextActorCode": ("ACTOR", "actorCode", "actorName"),
    "stepActorCode": ("ACTOR", "actorCode", "actorName"),
    "domainCode": ("WORK_TYPE", "workTypeCode", "workTypeName"),
    "authorityCode": ("AUTHORITY", "authorityCode", "authorityName"),
    "commandCode": ("COMMAND", "commandCode", "commandCode"),
    "fromState": ("PROCESS_STATE", "stateCode", "stateCode"),
    "toState": ("PROCESS_STATE", "stateCode", "stateCode"),
    "previousState": ("PROCESS_STATE", "stateCode", "stateCode"),
    "newState": ("PROCESS_STATE", "stateCode", "stateCode"),
}


def resolve_option_contract(
    field_code: str,
    process_code: str,
    reference_options: Dict[str, Any],
) -> tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Return verified inline options plus their refreshable source contract."""
    if field_code in DYNAMIC_FIELDS:
        source_code, value_path, label_path = DYNAMIC_FIELDS[field_code]
        scoped_key = f"{source_code}:{process_code}" if source_code == "PROCESS_STEP" else source_code
        options = reference_options.get(scoped_key) or reference_options.get(source_code) or []
        return options, {
            "sourceType": "REFERENCE_CATALOG",
            "sourceCode": source_code,
            "endpoint": "/admin/api/system/actor-process",
            "responsePath": {
                "PROCESS": "processes",
                "PROCESS_STEP": "steps",
                "ACTOR": "actors",
                "WORK_TYPE": "workTypes",
                "AUTHORITY": "actorAccountReadiness",
                "COMMAND": "steps",
                "PROCESS_STATE": "steps",
            }[source_code],
            "valuePath": value_path,
            "labelPath": label_path,
            "dependsOn": "processCode" if source_code == "PROCESS_STEP" else None,
            "verified": bool(options),
        }

    if field_code == "unitCode":
        options = _options(("kg", "킬로그램"), ("t", "톤"), ("g", "그램"), ("kWh", "킬로와트시"), ("MWh", "메가와트시"), ("Nm3", "노멀세제곱미터"), ("L", "리터"))
    elif field_code == "metricCode":
        options = _options(("TOTAL_EMISSION", "총 배출량"), ("SCOPE_1", "Scope 1"), ("SCOPE_2", "Scope 2"), ("SCOPE_3", "Scope 3"), ("GWP", "GWP"), ("REDUCTION", "감축량"))
    elif field_code == "siteCode":
        options = reference_options.get("SITE", [])
    elif field_code == "resourceCode":
        options = reference_options.get("RESOURCE", [])
    elif field_code in STATIC_OPTIONS:
        options = STATIC_OPTIONS[field_code]
    elif field_code.lower().endswith(("status", "statuscode", "state")) or "Status" in field_code:
        options = GENERAL_STATUS
    elif field_code in {"eventCode", "eventType"}:
        options = _options(("CREATE", "생성"), ("UPDATE", "변경"), ("SUBMIT", "제출"), ("APPROVE", "승인"), ("REJECT", "반려"), ("COMPLETE", "완료"))
    else:
        options = GENERAL_STATUS

    return options, {
        "sourceType": "CANONICAL_ENUM",
        "sourceCode": field_code,
        "valuePath": "value",
        "labelPath": "label",
        "verified": bool(options),
    }
