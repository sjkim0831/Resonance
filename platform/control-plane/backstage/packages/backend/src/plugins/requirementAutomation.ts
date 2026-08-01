import { createHash } from 'node:crypto';

export type RequirementDocumentInput = {
  fileName?: string;
  mimeType?: string;
  contentBase64?: string;
  extractedText?: string;
  autoPromote?: boolean;
};

export type RequirementItem = {
  requirementId: string;
  title: string;
  description: string;
  actorCode: string;
  processCode: string;
  stepCode: string;
  screenName: string;
  routePath: string;
  endpoint: { method: string; path: string };
  fields: { fieldCode: string; label: string; type: string; required: boolean }[];
  acceptanceCriteria: string[];
};

const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');

export const decodeRequirementDocument = (input: RequirementDocumentInput) => {
  const fileName = String(input.fileName ?? '').trim();
  if (!fileName || fileName.length > 240) throw new Error('fileName is required');
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  const supported = new Set(['txt', 'md', 'csv', 'json', 'pdf', 'docx', 'xlsx']);
  if (!supported.has(extension)) throw new Error('unsupported requirement document type');
  let text = String(input.extractedText ?? '').trim();
  let raw = Buffer.alloc(0);
  if (input.contentBase64) {
    raw = Buffer.from(String(input.contentBase64), 'base64');
    if (raw.length > 8 * 1024 * 1024) throw new Error('requirement document exceeds 8MB');
    if (!text && ['txt', 'md', 'csv', 'json'].includes(extension)) {
      text = raw.toString('utf8').replace(/^\uFEFF/, '').trim();
    }
  }
  if (!text) {
    throw new Error(
      ['pdf', 'docx', 'xlsx'].includes(extension)
        ? 'extractedText is required for binary documents'
        : 'requirement document is empty',
    );
  }
  if (text.length > 2_000_000) throw new Error('extracted requirement text is too large');
  return {
    fileName,
    extension,
    mimeType: String(input.mimeType ?? 'application/octet-stream'),
    text,
    byteSize: raw.length || Buffer.byteLength(text),
    documentSha256: digest(raw.length ? raw.toString('base64') : text),
    textSha256: digest(text),
  };
};

const inferActor = (line: string) => {
  if (/관리자|운영자|승인자/.test(line)) return 'PLATFORM_ADMIN';
  if (/검증|검토/.test(line)) return 'VERIFIER';
  if (/기업|회사|담당자/.test(line)) return 'COMPANY_MANAGER';
  if (/기관|규제|제출/.test(line)) return 'REGULATOR';
  return 'BUSINESS_USER';
};

const inferMethod = (line: string) => {
  if (/삭제|취소/.test(line)) return 'DELETE';
  if (/수정|변경|보완|승인|반려/.test(line)) return 'PATCH';
  if (/등록|생성|제출|업로드|실행|발급/.test(line)) return 'POST';
  return 'GET';
};

const meaningfulLines = (text: string) =>
  text
    .split(/\r?\n/)
    .map(line => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(line => line.length >= 4 && !/^[_=\-]{4,}$/.test(line))
    .slice(0, 1000);

export const analyzeRequirementText = (
  projectId: string,
  fileName: string,
  text: string,
) => {
  const lines = meaningfulLines(text);
  if (!lines.length) throw new Error('no actionable requirements were found');
  const processCode = `REQ_${digest(`${projectId}:${fileName}:${text}`).slice(0, 12).toUpperCase()}`;
  const requirements: RequirementItem[] = lines.map((line, index) => {
    const order = String(index + 1).padStart(3, '0');
    const requirementId = `${processCode}_R${order}`;
    const stepCode = `${processCode}_S${order}`;
    const actorCode = inferActor(line);
    const method = inferMethod(line);
    const routePath = `/generated/${projectId.toLowerCase()}/${processCode.toLowerCase()}/s${order}`;
    const endpointPath = `/api/runtime/projects/${projectId.toLowerCase()}/processes/${processCode.toLowerCase()}/steps/s${order}`;
    return {
      requirementId,
      title: line.slice(0, 120),
      description: line,
      actorCode,
      processCode,
      stepCode,
      screenName: line.slice(0, 80),
      routePath,
      endpoint: { method, path: endpointPath },
      fields: [
        { fieldCode: 'projectId', label: '프로젝트 ID', type: 'string', required: true },
        { fieldCode: 'actorCode', label: '수행 액터', type: 'string', required: true },
        { fieldCode: 'statusCode', label: '업무 상태', type: 'string', required: true },
        { fieldCode: 'payload', label: '업무 입력 데이터', type: 'object', required: method !== 'GET' },
        { fieldCode: 'rowVersion', label: '동시성 버전', type: 'integer', required: method !== 'GET' },
      ],
      acceptanceCriteria: [
        '권한이 있는 액터만 접근할 수 있다.',
        '필수 입력값과 상태 전이를 서버에서 검증한다.',
        '저장 후 동일 데이터를 재조회할 수 있다.',
        '변경 이력과 실패 복구 증적을 남긴다.',
        '모바일과 WCAG 2.1 AA 기준을 충족한다.',
      ],
    };
  });
  return { processCode, requirements };
};

const workspaceTabs = (workspace: string) =>
  Array.from({ length: 8 }, (_, index) => ({
    id: `${workspace}-${index + 1}`,
    label: `${workspace.toUpperCase()} ${index + 1}`,
  }));

export const buildRequirementDesignContract = ({
  projectId,
  designVersion,
  document,
  analysis,
}: {
  projectId: string;
  designVersion: number;
  document: ReturnType<typeof decodeRequirementDocument>;
  analysis: ReturnType<typeof analyzeRequirementText>;
}) => ({
  schemaVersion: '2.0.0',
  projectId,
  tenantId: 'DEFAULT',
  designVersion,
  source: {
    type: 'REQUIREMENT_DOCUMENT',
    fileName: document.fileName,
    documentSha256: document.documentSha256,
    textSha256: document.textSha256,
  },
  contextFields: [
    'projectId',
    'tenantId',
    'designVersion',
    'actorCode',
    'processCode',
    'stepCode',
  ],
  workspaces: ['design', 'develop', 'operate'].map(id => ({
    id,
    tabs: workspaceTabs(id),
  })),
  process: {
    processCode: analysis.processCode,
    startState: 'DRAFT',
    endState: 'COMPLETED',
    steps: analysis.requirements,
  },
  generation: {
    strategy: 'METADATA_FIRST_INCREMENTAL',
    maxScreens: 1000,
    commonTheme: 'KRDS_GOV_DEFAULT',
    commonLayout: 'COMMON_KRDS_TASK_LAYOUT',
    genericEndpoints: [
      '/runtime/query',
      '/runtime/command',
      '/runtime/transition',
      '/runtime/validate',
      '/runtime/export',
    ],
  },
  qualityGates: [
    'ACTOR_PROCESS_TRACEABILITY',
    'INPUT_OUTPUT_HANDOFF',
    'AUTHORITY_ISOLATION',
    'DATABASE_REREAD',
    'RESPONSIVE_ACCESSIBILITY',
    'RECOVERY_EVIDENCE',
  ],
});
