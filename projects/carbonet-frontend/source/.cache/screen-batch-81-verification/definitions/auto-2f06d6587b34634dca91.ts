import type { GeneratedScreenDefinition } from "../generatedScreenTypes";
export const screen_auto_2f06d6587b34634dca91 = {
  "id": "auto-2f06d6587b34634dca91",
  "blueprintCode": "BP_ADOPT_2F06D6587B34334D8A91",
  "processCode": "EMISSION_PROJECT_PORTFOLIO",
  "stepCode": "EMISSION_PROJECT_PORTFOLIO_LIST",
  "actorCode": "COMPANY_MANAGER",
  "audience": "USER",
  "pageId": "AUTO_2F06D6587B34634DCA91",
  "pageName": "배출량 프로젝트",
  "routePath": "/emission/project_list",
  "screenType": "LIST",
  "templateCode": "KRDS_LIST",
  "specification": {
    "schemaVersion": "2.0.0",
    "designSystem": "KRDS_GOV",
    "businessPurpose": "로그인 계정에 배정된 프로젝트만 검색·요약·페이지 탐색하고 현재 상태와 마감을 확인해 다음 실제 업무로 진입시킨다.",
    "actorResponsibilities": [
      "COMPANY_MANAGER 액터가 권한·업무분리 정책에 따라 배출량 프로젝트 업무를 수행한다."
    ],
    "entryConditions": [
      "인증 계정, 테넌트, 활성 프로젝트 액터 배정 또는 명시적 webmaster 운영 범위가 확인된다."
    ],
    "exitConditions": [
      "프로젝트 ID와 권한 범위를 유지해 상세 또는 다음 업무로 이동하며 권한 없는 상세·삭제는 서버가 거부한다."
    ],
    "states": [
      "LOADING",
      "READY",
      "EMPTY",
      "FILTERED_EMPTY",
      "DELETING",
      "SUCCESS",
      "ERROR",
      "FORBIDDEN",
      "SESSION_EXPIRED",
      "PAGE_OUT_OF_RANGE"
    ],
    "kpis": [
      {
        "code": "KPI_1",
        "label": "권한 밖 프로젝트 노출 0건"
      },
      {
        "code": "KPI_2",
        "label": "필터·총계 일치율 100%"
      },
      {
        "code": "KPI_3",
        "label": "목록·상세 권한 일치율 100%"
      },
      {
        "code": "KPI_4",
        "label": "페이지 중복·누락 0건"
      }
    ],
    "sections": [
      {
        "id": "portfolio-summary"
      },
      {
        "id": "search-filters"
      },
      {
        "id": "project-table"
      },
      {
        "id": "pagination"
      },
      {
        "id": "project-actions"
      }
    ],
    "fields": [
      {
        "source": "emission_project_registry.project_name",
        "required": false,
        "fieldCode": "keyword",
        "apiProperty": "query.keyword"
      },
      {
        "source": "emission_project_registry.project_status",
        "required": false,
        "fieldCode": "statusFilter",
        "apiProperty": "query.status"
      },
      {
        "source": "emission_project_registry.site_name",
        "required": false,
        "fieldCode": "siteFilter",
        "apiProperty": "query.site"
      },
      {
        "source": "emission_project_registry.project_id",
        "required": true,
        "fieldCode": "page",
        "apiProperty": "page"
      },
      {
        "source": "emission_project_registry.project_id",
        "required": true,
        "fieldCode": "size",
        "apiProperty": "size"
      },
      {
        "source": "emission_project_registry.project_id",
        "required": true,
        "fieldCode": "total",
        "apiProperty": "total"
      },
      {
        "source": "emission_project_registry.project_status",
        "required": false,
        "fieldCode": "summaryStatus",
        "apiProperty": "summary[].status"
      },
      {
        "source": "emission_project_registry.project_id",
        "required": false,
        "fieldCode": "summaryCount",
        "apiProperty": "summary[].count"
      },
      {
        "source": "emission_project_registry.project_id",
        "required": true,
        "fieldCode": "projectId",
        "apiProperty": "items[].id"
      },
      {
        "source": "emission_project_registry.project_name",
        "required": true,
        "fieldCode": "projectName",
        "apiProperty": "items[].name"
      },
      {
        "source": "emission_project_registry.site_name",
        "required": true,
        "fieldCode": "siteName",
        "apiProperty": "items[].site"
      },
      {
        "source": "emission_project_registry.calculation_period",
        "required": true,
        "fieldCode": "calculationPeriod",
        "apiProperty": "items[].period"
      },
      {
        "source": "emission_project_registry.scope_name",
        "required": true,
        "fieldCode": "scopeName",
        "apiProperty": "items[].scope"
      },
      {
        "source": "emission_project_registry.owner_name",
        "required": true,
        "fieldCode": "ownerName",
        "apiProperty": "items[].owner"
      },
      {
        "source": "emission_project_registry.progress_percent",
        "required": true,
        "fieldCode": "progressPercent",
        "apiProperty": "items[].progress"
      },
      {
        "source": "emission_project_registry.current_step",
        "required": true,
        "fieldCode": "currentStep",
        "apiProperty": "items[].step"
      },
      {
        "source": "emission_project_registry.due_date",
        "required": false,
        "fieldCode": "dueDate",
        "apiProperty": "items[].dueDate"
      },
      {
        "source": "emission_project_registry.project_status",
        "required": true,
        "fieldCode": "projectStatus",
        "apiProperty": "items[].status"
      },
      {
        "source": "emission_project_registry.tenant_id",
        "required": true,
        "fieldCode": "tenantId",
        "apiProperty": "session.tenantId"
      },
      {
        "source": "framework_project_actor_assignment.user_id",
        "required": true,
        "fieldCode": "actorUserId",
        "apiProperty": "session.userId"
      },
      {
        "source": "framework_project_actor_assignment.active_yn",
        "required": true,
        "fieldCode": "actorActiveYn",
        "apiProperty": "authorization.active"
      }
    ],
    "actions": [
      {
        "code": "ACTION_1",
        "label": "SEARCH"
      },
      {
        "code": "ACTION_2",
        "label": "RESET"
      },
      {
        "code": "ACTION_3",
        "label": "CHANGE_PAGE"
      },
      {
        "code": "ACTION_4",
        "label": "OPEN_PROJECT"
      },
      {
        "code": "ACTION_5",
        "label": "CREATE_PROJECT"
      },
      {
        "code": "ACTION_6",
        "label": "DELETE_PROJECT"
      }
    ],
    "apiContracts": [
      {
        "code": "API_1",
        "label": "GET /home/api/emission-projects"
      },
      {
        "code": "API_2",
        "label": "GET /home/api/emission-projects/{id}"
      },
      {
        "code": "API_3",
        "label": "DELETE /home/api/emission-projects/{id}"
      }
    ],
    "dataContracts": [
      {
        "entity": "emission_project_registry",
        "tenant": "tenant_id",
        "version": "2.0.0",
        "pageSize": 10
      },
      {
        "entity": "framework_project_actor_assignment",
        "condition": "active_yn=Y"
      }
    ],
    "permissions": [
      {
        "code": "COMPANY_MANAGER",
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
    "completionRule": "프로젝트 ID와 권한 범위를 유지해 상세 또는 다음 업무로 이동하며 권한 없는 상세·삭제는 서버가 거부한다.",
    "extensions": {
      "contractId": 739,
      "sharedRuntime": true
    }
  },
  "traceability": {
    "contractId": 739,
    "requirementIds": [
      "EMISSION_PROJECT_PORTFOLIO:EMISSION_PROJECT_PORTFOLIO_LIST:USER"
    ],
    "generationBatchId": 81,
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
