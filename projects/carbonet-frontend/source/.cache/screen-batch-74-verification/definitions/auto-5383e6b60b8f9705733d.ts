import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_5383e6b60b8f9705733d = {
  "id": "auto-5383e6b60b8f9705733d",
  "blueprintCode": "BP_AUTO_5383E6B60B8F9705733D640D",
  "processCode": "CERTIFICATE_ISSUANCE",
  "stepCode": "CERTIFICATE_ISSUANCE_02_WORK",
  "actorCode": "APPROVER",
  "audience": "ADMIN",
  "pageId": "AUTO_5383E6B60B8F9705733D",
  "pageName": "인증서·PDF 발급 관리",
  "routePath": "/admin/emission/survey-report-print",
  "screenType": "ADMIN",
  "templateCode": "KRDS_ADMIN",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "확정된 배출 산정 결과를 검토 가능한 보고서 DOM으로 구성하고, 동일 DOM을 Chromium PDF로 발급하면서 정규화 데이터셋·해시·QR·시각지문을 원장에 원자적으로 등록한다.",
    "actorResponsibilities": [
      "APPROVER 액터가 권한·업무분리 정책에 따라 인증서·PDF 발급 관리 업무를 수행한다."
    ],
    "entryConditions": [
      "APPROVER가 확정된 산정 세션과 제품·부산물 질량, 배출계수 및 섹션별 결과를 보유하고 인증서 발급 권한으로 진입한다."
    ],
    "exitConditions": [
      "최종 PDF가 생성되고 인증서 ID, 데이터셋 해시, 무결성 코드, 발급자, 최종 PDF 시각지문이 ISSUED 원장에 동일 트랜잭션 흐름으로 저장된다."
    ],
    "states": [
      "LOADING",
      "EMPTY",
      "READY",
      "EDITING",
      "PROOFREADING",
      "ISSUING",
      "SUCCESS",
      "ERROR",
      "FORBIDDEN",
      "SESSION_EXPIRED"
    ],
    "kpis": [
      {
        "code": "KPI_1",
        "label": "PDF 발급 성공률"
      },
      {
        "code": "KPI_2",
        "label": "원장·PDF 데이터셋 완전 일치율"
      },
      {
        "code": "KPI_3",
        "label": "시각지문 등록률"
      },
      {
        "code": "KPI_4",
        "label": "OCR 항목 일치율"
      },
      {
        "code": "KPI_5",
        "label": "중복 발급 멱등 처리율"
      }
    ],
    "sections": [
      {
        "id": "report-hero",
        "purpose": "제품명·총 배출량"
      },
      {
        "id": "normalization",
        "purpose": "산출물 질량·GWP·할당"
      },
      {
        "id": "contribution",
        "purpose": "섹션별 막대·원 그래프"
      },
      {
        "id": "inventory",
        "purpose": "물질별 계산 상세"
      },
      {
        "id": "verification",
        "purpose": "인증 ID·해시·QR"
      },
      {
        "id": "actions",
        "purpose": "언어·디자인·PDF 발급"
      }
    ],
    "fields": [
      {
        "name": "인증서 ID",
        "source": "carbonet_report_verification_registry.certificate_id",
        "required": true,
        "fieldCode": "certificateId",
        "apiProperty": "record.certificateId"
      },
      {
        "name": "검증 페이로드 버전",
        "source": "carbonet_report_verification_registry.payload_version",
        "required": true,
        "fieldCode": "payloadVersion",
        "apiProperty": "record.version"
      },
      {
        "name": "발급 일시",
        "source": "carbonet_report_verification_registry.issued_at",
        "required": true,
        "fieldCode": "issuedAt",
        "apiProperty": "record.issuedAt"
      },
      {
        "name": "리포트 제목",
        "source": "carbonet_report_verification_registry.report_title",
        "required": true,
        "fieldCode": "reportTitle",
        "apiProperty": "record.reportTitle"
      },
      {
        "name": "제품명",
        "source": "carbonet_report_verification_registry.product_name",
        "required": true,
        "fieldCode": "productName",
        "apiProperty": "record.productName"
      },
      {
        "name": "산정 결과 생성 일시",
        "source": "carbonet_report_verification_registry.report_generated_at",
        "required": true,
        "fieldCode": "generatedAt",
        "apiProperty": "record.generatedAt"
      },
      {
        "name": "총 탄소배출량",
        "source": "carbonet_report_verification_registry.total_emission",
        "required": true,
        "fieldCode": "totalEmission",
        "apiProperty": "record.totalEmission"
      },
      {
        "name": "전체 인벤토리 행 수",
        "source": "carbonet_report_verification_registry.row_count",
        "required": true,
        "fieldCode": "rowCount",
        "apiProperty": "record.rowCount"
      },
      {
        "name": "산정 완료 행 수",
        "source": "carbonet_report_verification_registry.calculated_row_count",
        "required": true,
        "fieldCode": "calculatedRowCount",
        "apiProperty": "record.calculatedRowCount"
      },
      {
        "name": "검토 경고 수",
        "source": "carbonet_report_verification_registry.warning_count",
        "required": true,
        "fieldCode": "warningCount",
        "apiProperty": "record.warningCount"
      },
      {
        "name": "페이로드 해시",
        "source": "carbonet_report_verification_registry.payload_hash",
        "required": true,
        "fieldCode": "payloadHash",
        "apiProperty": "record.payloadHash"
      },
      {
        "name": "무결성 코드",
        "source": "carbonet_report_verification_registry.integrity_code",
        "required": true,
        "fieldCode": "integrityCode",
        "apiProperty": "record.integrityCode"
      },
      {
        "name": "데이터셋 해시",
        "source": "carbonet_report_verification_registry.dataset_hash",
        "required": true,
        "fieldCode": "datasetHash",
        "apiProperty": "record.datasetHash"
      },
      {
        "name": "정규화 데이터셋",
        "source": "carbonet_report_verification_registry.dataset_json",
        "required": true,
        "fieldCode": "dataset",
        "apiProperty": "record.dataset"
      },
      {
        "name": "발급 담당자",
        "source": "carbonet_report_verification_registry.issuer_id",
        "required": true,
        "fieldCode": "issuerId",
        "apiProperty": "registry.issuerId"
      },
      {
        "name": "발급 상태",
        "source": "carbonet_report_verification_registry.status_code",
        "required": true,
        "fieldCode": "statusCode",
        "apiProperty": "registry.statusCode"
      },
      {
        "name": "원장 등록 일시",
        "source": "carbonet_report_verification_registry.created_at",
        "required": true,
        "fieldCode": "registryCreatedAt",
        "apiProperty": "registry.createdAt"
      },
      {
        "name": "원장 수정 일시",
        "source": "carbonet_report_verification_registry.updated_at",
        "required": true,
        "fieldCode": "registryUpdatedAt",
        "apiProperty": "registry.updatedAt"
      },
      {
        "name": "PDF 시각 지문",
        "source": "carbonet_report_verification_registry.visual_profile_json",
        "required": true,
        "fieldCode": "visualProfile",
        "apiProperty": "registry.visualProfile"
      },
      {
        "name": "시각 지문 버전",
        "source": "carbonet_report_verification_registry.visual_profile_version",
        "required": true,
        "fieldCode": "visualProfileVersion",
        "apiProperty": "registry.visualProfileVersion"
      },
      {
        "name": "시각 지문 등록 일시",
        "source": "carbonet_report_verification_registry.visual_profile_updated_at",
        "required": true,
        "fieldCode": "visualProfileUpdatedAt",
        "apiProperty": "registry.visualProfileUpdatedAt"
      },
      {
        "name": "표지 유형명",
        "source": "carbonet_report_verification_registry.dataset_json",
        "required": true,
        "fieldCode": "displayTitle",
        "apiProperty": "record.dataset.displayTitle"
      },
      {
        "name": "대분류",
        "source": "carbonet_report_verification_registry.dataset_json",
        "required": false,
        "fieldCode": "classificationMajor",
        "apiProperty": "record.dataset.classification.majorLabel"
      },
      {
        "name": "중분류",
        "source": "carbonet_report_verification_registry.dataset_json",
        "required": false,
        "fieldCode": "classificationMiddle",
        "apiProperty": "record.dataset.classification.middleLabel"
      },
      {
        "name": "소분류",
        "source": "carbonet_report_verification_registry.dataset_json",
        "required": false,
        "fieldCode": "classificationSmall",
        "apiProperty": "record.dataset.classification.smallLabel"
      },
      {
        "name": "산정 범주",
        "source": "carbonet_report_verification_registry.dataset_json",
        "required": true,
        "fieldCode": "scopeCategory",
        "apiProperty": "record.dataset.calculationScope.categoryName"
      },
      {
        "name": "산정 Tier",
        "source": "carbonet_report_verification_registry.dataset_json",
        "required": true,
        "fieldCode": "scopeTier",
        "apiProperty": "record.dataset.calculationScope.tierLabel"
      },
      {
        "name": "배출계수 수",
        "source": "carbonet_report_verification_registry.dataset_json",
        "required": true,
        "fieldCode": "factorCount",
        "apiProperty": "record.dataset.calculationScope.factorCount"
      },
      {
        "name": "총 산출물 질량",
        "source": "carbonet_report_verification_registry.dataset_json",
        "required": true,
        "fieldCode": "outputQuantityTotal",
        "apiProperty": "record.dataset.verificationSummary.totalOutputMass"
      },
      {
        "name": "정규화 배율",
        "source": "carbonet_report_verification_registry.dataset_json",
        "required": true,
        "fieldCode": "normalizationFactor",
        "apiProperty": "record.dataset.normalization.factor"
      },
      {
        "name": "정규화 적용 여부",
        "source": "carbonet_report_verification_registry.dataset_json",
        "required": true,
        "fieldCode": "normalizationApplied",
        "apiProperty": "record.dataset.normalization.applied"
      },
      {
        "name": "데이터 신뢰도",
        "source": "carbonet_report_verification_registry.dataset_json",
        "required": true,
        "fieldCode": "dataConfidence",
        "apiProperty": "record.dataset.summary.dataConfidence"
      },
      {
        "name": "최대 기여 항목",
        "source": "carbonet_report_verification_registry.dataset_json",
        "required": false,
        "fieldCode": "topContributorLabel",
        "apiProperty": "record.dataset.summary.topContributorLabel"
      },
      {
        "name": "최대 기여율",
        "source": "carbonet_report_verification_registry.dataset_json",
        "required": false,
        "fieldCode": "topContributorSharePercent",
        "apiProperty": "record.dataset.summary.topContributorSharePercent"
      },
      {
        "name": "섹션별 기여도",
        "source": "carbonet_report_verification_registry.dataset_json",
        "required": true,
        "fieldCode": "sectionSummaries",
        "apiProperty": "record.dataset.sectionSummaries"
      },
      {
        "name": "검증 총 탄소배출량",
        "source": "carbonet_report_verification_registry.dataset_json",
        "required": true,
        "fieldCode": "totalCarbonEmission",
        "apiProperty": "record.dataset.verificationSummary.totalCarbonEmission"
      },
      {
        "name": "제품 GWP",
        "source": "carbonet_report_verification_registry.dataset_json",
        "required": true,
        "fieldCode": "productGwp",
        "apiProperty": "record.dataset.verificationSummary.productGwp"
      },
      {
        "name": "공정 GWP",
        "source": "carbonet_report_verification_registry.dataset_json",
        "required": true,
        "fieldCode": "processGwp",
        "apiProperty": "record.dataset.verificationSummary.processGwp"
      },
      {
        "name": "부산물 할당 방식",
        "source": "carbonet_report_verification_registry.dataset_json",
        "required": true,
        "fieldCode": "byproductAllocation",
        "apiProperty": "record.dataset.verificationSummary.byproductAllocation"
      },
      {
        "name": "제품·부산물 배출 결과",
        "source": "carbonet_report_verification_registry.dataset_json",
        "required": true,
        "fieldCode": "outputRows",
        "apiProperty": "record.dataset.outputRows"
      },
      {
        "name": "상세 계산 인벤토리",
        "source": "carbonet_report_verification_registry.dataset_json",
        "required": true,
        "fieldCode": "inventoryRows",
        "apiProperty": "record.dataset.rows"
      },
      {
        "name": "시나리오 비교",
        "source": "carbonet_report_verification_registry.dataset_json",
        "required": false,
        "fieldCode": "scenarios",
        "apiProperty": "record.dataset.scenarios"
      },
      {
        "name": "검토 경고",
        "source": "carbonet_report_verification_registry.dataset_json",
        "required": false,
        "fieldCode": "alerts",
        "apiProperty": "record.dataset.alerts"
      },
      {
        "name": "리포트 유형",
        "source": "carbonet_report_verification_registry.dataset_json",
        "required": true,
        "fieldCode": "reportType",
        "apiProperty": "record.reportType"
      }
    ],
    "actions": [
      {
        "api": "POST /admin/api/admin/emission-survey-report/proofread",
        "code": "PROOFREAD_LABELS"
      },
      {
        "api": "POST /admin/api/admin/emission-survey-report/issue-pdf",
        "code": "ISSUE_PDF",
        "atomicEvidence": true
      },
      {
        "api": "POST /admin/api/admin/emission-survey-report/verify",
        "code": "VERIFY_DATASET"
      },
      {
        "api": "POST /admin/api/admin/emission-survey-report/verify-ocr",
        "code": "VERIFY_OCR"
      },
      {
        "code": "RETURN_TO_REPORT",
        "guard": "preserve returnLang"
      }
    ],
    "apiContracts": [
      {
        "path": "/admin/api/admin/emission-survey-report/proofread",
        "method": "POST"
      },
      {
        "path": "/admin/api/admin/emission-survey-report/issue-pdf",
        "method": "POST",
        "response": "application/pdf"
      },
      {
        "path": "/admin/api/admin/emission-survey-report/verify",
        "method": "POST"
      },
      {
        "path": "/admin/api/admin/emission-survey-report/verify-ocr",
        "method": "POST"
      }
    ],
    "dataContracts": [
      {
        "stage": "DRAFT",
        "schema": "EmissionSurveyReportPayload",
        "storage": "sessionStorage:carbonet:emission-survey-report"
      },
      {
        "stage": "ISSUED",
        "entity": "carbonet_report_verification_registry",
        "pdfEngine": "Chromium",
        "immutableKeys": [
          "certificate_id",
          "payload_hash",
          "integrity_code",
          "dataset_hash"
        ],
        "schemaVersion": "emission-report-dataset-2.0.0"
      }
    ],
    "permissions": [
      {
        "code": "APPROVER",
        "scope": "TENANT_PROJECT",
        "segregationOfDuties": true,
        "serverAuthorization": true
      }
    ],
    "validations": [
      {
        "code": "ENTRY_AND_REQUIRED_FIELDS",
        "type": "CONTRACT"
      },
      {
        "code": "STATE_AND_VERSION",
        "type": "CONCURRENCY"
      }
    ],
    "errors": [
      {
        "code": "FORBIDDEN",
        "recovery": "권한·업무분리 확인"
      },
      {
        "code": "CONFLICT",
        "recovery": "최신 버전 재조회"
      },
      {
        "code": "DEPENDENCY_FAILURE",
        "recovery": "멱등키로 안전 재시도"
      }
    ],
    "responsive": {
      "mobile": "single-column-actions-bottom",
      "tablet": "adaptive-grid",
      "desktop": "list-detail-workspace"
    },
    "accessibility": {
      "labels": true,
      "keyboard": true,
      "standard": "WCAG_2_1_AA",
      "nonColorStatus": true,
      "focusManagement": true
    },
    "completionRule": "최종 PDF가 생성되고 인증서 ID, 데이터셋 해시, 무결성 코드, 발급자, 최종 PDF 시각지문이 ISSUED 원장에 동일 트랜잭션 흐름으로 저장된다.",
    "extensions": {
      "contractId": 585,
      "sharedRuntime": true
    }
  },
  "traceability": {
    "contractId": 585,
    "requirementIds": [
      "CERTIFICATE_ISSUANCE:CERTIFICATE_ISSUANCE_02_WORK:ADMIN"
    ],
    "generationBatchId": 74,
    "designReadinessScore": 100,
    "requiredScenarioTypes": [
      "HAPPY_PATH",
      "AUTHORITY",
      "ISOLATION",
      "EXCEPTION",
      "RECOVERY"
    ]
  },
  "designCompleteness": {
    "score": 100,
    "checks": {
      "purpose": true,
      "actor": true,
      "entry": true,
      "exit": true,
      "sections": true,
      "fields": true,
      "actions": true,
      "api": true,
      "data": true,
      "permissions": true,
      "validations": true,
      "states": true,
      "errors": true,
      "responsive": true,
      "accessibility": true,
      "tests": true
    },
    "complete": true
  }
} as const satisfies GeneratedScreenDefinition;
