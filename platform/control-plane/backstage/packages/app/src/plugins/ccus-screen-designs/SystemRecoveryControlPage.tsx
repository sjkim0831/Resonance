import { useCallback, useEffect, useState } from 'react';
import { Content, Header, Page } from '@backstage/core-components';
import { fetchApiRef, useApi } from '@backstage/core-plugin-api';
import {
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core';
import RefreshIcon from '@material-ui/icons/Refresh';

type RecoverySummary = {
  checkedAt: string;
  executionMode: string;
  directShellExecution: boolean;
  workerConnected: boolean;
  restoreDrill: {
    health: 'HEALTHY' | 'RUNNING' | 'FAILED' | 'STALE';
    automaticSchedule: boolean;
    intervalDays: number;
    staleAfterDays: number;
    latestCommandId: string | null;
    latestStatus: string;
    lastSuccessAt: string | null;
    durationSeconds: number | null;
    tableCount: number | null;
    evidenceStatus: string | null;
  };
  backupSchedule: {
    health: 'HEALTHY' | 'RUNNING' | 'FAILED' | 'STALE';
    automaticSchedule: boolean;
    intervalHours: number;
    staleAfterHours: number;
    latestStatus: string;
    lastSuccessAt: string | null;
    file: string | null;
    bytes: number;
    verificationMode: string | null;
    verified: boolean;
  };
  offsiteBackup: {
    health: 'HEALTHY' | 'FAILED' | 'STALE';
    automaticSchedule: boolean;
    intervalHours: number;
    staleAfterHours: number;
    reporterId: string | null;
    latestStatus: string;
    backupName: string | null;
    encryptedBytes: number;
    encryption: string | null;
    restoreVerified: boolean;
    completedAt: string | null;
    errorMessage: string;
  };
  offsiteRestoreDrill: {
    health: 'HEALTHY' | 'FAILED' | 'STALE';
    intervalDays: number;
    staleAfterDays: number;
    latestStatus: string;
    reporterId: string | null;
    backupName: string | null;
    isolation: string | null;
    durationSeconds: number;
    schemaCount: number;
    tableCount: number;
    traceEventCount: number;
    unifiedAssetCount: number;
    startedAt: string | null;
    finishedAt: string | null;
    errorMessage: string;
  };
  policies: {
    code: string;
    name: string;
    value: Record<string, unknown>;
    active: boolean;
  }[];
  commands: {
    commandId: string;
    commandType: string;
    targetEnvironment: string;
    status: string;
    requestedBy: string;
    changeTicket: string;
    createdAt: string;
  }[];
};

const commandOptions = [
  ['RESTORE_DRILL', '격리 복원 리허설'],
  ['CREATE_BACKUP', '백업 생성'],
  ['VERIFY_BACKUP', '백업 검증'],
  ['RESTORE_BACKUP', '백업 복구'],
  ['PROMOTE_PRIMARY', 'DB Primary 승격'],
  ['SYNC_DEPLOY', 'DB 동기화·배포'],
] as const;
const highRisk = new Set(['RESTORE_BACKUP', 'PROMOTE_PRIMARY', 'SYNC_DEPLOY']);
const drillHealthLabels = {
  HEALTHY: '정상',
  RUNNING: '실행 중',
  FAILED: '실패',
  STALE: '확인 필요',
} as const;

const useStyles = makeStyles(theme => ({
  warning: {
    padding: theme.spacing(2),
    border: '1px solid #f59e0b',
    borderRadius: 12,
    background: '#fffbeb',
    marginBottom: theme.spacing(2),
  },
  panel: {
    padding: theme.spacing(2.5),
    border: '1px solid #dbe4ea',
    borderRadius: 12,
    marginBottom: theme.spacing(2),
  },
  form: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
    gap: theme.spacing(2),
    [theme.breakpoints.down('sm')]: { gridTemplateColumns: '1fr' },
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'minmax(200px,1fr) 130px minmax(220px,1.2fr)',
    gap: theme.spacing(2),
    padding: theme.spacing(1.5, 0),
    borderBottom: '1px solid #e2e8f0',
    [theme.breakpoints.down('sm')]: { gridTemplateColumns: '1fr' },
  },
}));

export function SystemRecoveryControlPage() {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const [summary, setSummary] = useState<RecoverySummary>();
  const [commandType, setCommandType] = useState('CREATE_BACKUP');
  const [targetEnvironment, setTargetEnvironment] = useState('CARBONET_PROD');
  const [changeTicket, setChangeTicket] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    const response = await fetchApi.fetch('/api/resonance-recovery/summary');
    const payload = (await response.json()) as RecoverySummary & {
      message?: string;
    };
    if (!response.ok)
      throw new Error(payload.message ?? `API ${response.status}`);
    setSummary(payload);
  }, [fetchApi]);

  useEffect(() => {
    void refresh().catch(error =>
      setMessage(error instanceof Error ? error.message : String(error)),
    );
  }, [refresh]);

  const submit = async () => {
    setMessage('명령을 검증하고 기록하는 중입니다.');
    const response = await fetchApi.fetch('/api/resonance-recovery/commands', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        commandType,
        targetEnvironment,
        changeTicket,
        confirmation,
      }),
    });
    const payload = (await response.json()) as {
      message?: string;
      commandId?: string;
      status?: string;
      duplicate?: boolean;
    };
    if (!response.ok) {
      setMessage(payload.message ?? `API ${response.status}`);
      return;
    }
    setMessage(
      `${payload.commandId} · ${payload.status}${
        payload.duplicate ? ' · 중복 요청 재사용' : ''
      }`,
    );
    await refresh();
  };

  const needsGuard = highRisk.has(commandType);
  return (
    <Page themeId="tool">
      <Header
        title="시스템 백업·복구 제어"
        subtitle="백업, 복구, DB 승격과 동기화 작업을 정책·권한·감사 기록으로 통제합니다."
      />
      <Content>
        <Paper className={classes.warning} elevation={0}>
          <Typography variant="subtitle1">
            실행 모드: {summary?.executionMode ?? '확인 중'}
          </Typography>
          <Typography variant="body2">
            운영 셸 직접 실행은 비활성화되어 있습니다. 명령은 중복 방지 키와
            감사 기록을 포함해 큐에 저장되며, 검증된 실행 워커 연결 후에만
            수행됩니다.
          </Typography>
          <Box mt={1}>
            <Chip
              size="small"
              color={summary?.workerConnected ? 'primary' : 'default'}
              label={
                summary?.workerConnected
                  ? '실행 워커 연결됨'
                  : '실행 워커 미연결'
              }
            />
          </Box>
        </Paper>

        <Paper className={classes.panel}>
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            flexWrap="wrap"
          >
            <Box>
              <Typography variant="h6">PC 외부 백업 전체 복원 검증</Typography>
              <Typography variant="body2">
                암호화된 외부 백업을 네트워크 차단 환경에서 실제 PostgreSQL로
                전체 복원하고 핵심 데이터를 검증합니다.
              </Typography>
            </Box>
            <Chip
              color={
                summary?.offsiteRestoreDrill.health === 'HEALTHY'
                  ? 'primary'
                  : 'default'
              }
              label={
                summary?.offsiteRestoreDrill.health === 'HEALTHY'
                  ? '정상'
                  : summary?.offsiteRestoreDrill.health === 'FAILED'
                  ? '실패'
                  : '확인 필요'
              }
            />
          </Box>
          <Box className={classes.form} mt={2}>
            <Box>
              <Typography variant="caption">자동 실행 주기</Typography>
              <Typography variant="body1">
                {summary?.offsiteRestoreDrill.intervalDays ?? 7}일
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption">최근 전체 복원</Typography>
              <Typography variant="body1">
                {summary?.offsiteRestoreDrill.finishedAt
                  ? new Date(
                      summary.offsiteRestoreDrill.finishedAt,
                    ).toLocaleString('ko-KR')
                  : '검증 기록 없음'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption">복원 소요시간</Typography>
              <Typography variant="body1">
                {summary?.offsiteRestoreDrill.durationSeconds
                  ? `${Math.floor(
                      summary.offsiteRestoreDrill.durationSeconds / 60,
                    )}분 ${
                      summary.offsiteRestoreDrill.durationSeconds % 60
                    }초`
                  : '-'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption">격리 방식</Typography>
              <Typography variant="body1">
                {summary?.offsiteRestoreDrill.isolation ?? '-'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption">테이블</Typography>
              <Typography variant="body1">
                {summary?.offsiteRestoreDrill.tableCount.toLocaleString() ??
                  '-'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption">추적 이벤트</Typography>
              <Typography variant="body1">
                {summary?.offsiteRestoreDrill.traceEventCount.toLocaleString() ??
                  '-'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption">통합 자산</Typography>
              <Typography variant="body1">
                {summary?.offsiteRestoreDrill.unifiedAssetCount.toLocaleString() ??
                  '-'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption">백업 파일</Typography>
              <Typography variant="body1">
                {summary?.offsiteRestoreDrill.backupName ?? '-'}
              </Typography>
            </Box>
          </Box>
          {summary?.offsiteRestoreDrill.health !== 'HEALTHY' ? (
            <Box mt={2} className={classes.warning}>
              <Typography variant="body2">
                외부 백업 전체 복원이 실패했거나 최근{' '}
                {summary?.offsiteRestoreDrill.staleAfterDays ?? 8}일 동안
                성공 기록이 없습니다.
                {summary?.offsiteRestoreDrill.errorMessage
                  ? ` ${summary.offsiteRestoreDrill.errorMessage}`
                  : ' PC 예약 작업, Docker 및 암호화 키 상태를 확인하세요.'}
              </Typography>
            </Box>
          ) : null}
        </Paper>

        <Paper className={classes.panel}>
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            flexWrap="wrap"
          >
            <Box>
              <Typography variant="h6">PostgreSQL 자동 원본 백업</Typography>
              <Typography variant="body2">
                운영 DB를 정기적으로 덤프하고 체크섬과 복원 가능한 아카이브
                형식을 검증합니다.
              </Typography>
            </Box>
            <Chip
              color={
                summary?.backupSchedule.health === 'HEALTHY'
                  ? 'primary'
                  : 'default'
              }
              label={
                summary?.backupSchedule.health === 'HEALTHY'
                  ? '정상'
                  : summary?.backupSchedule.health === 'RUNNING'
                  ? '실행 중'
                  : summary?.backupSchedule.health === 'FAILED'
                  ? '실패'
                  : '확인 필요'
              }
            />
          </Box>
          <Box className={classes.form} mt={2}>
            <Box>
              <Typography variant="caption">자동 실행</Typography>
              <Typography variant="body1">
                {summary?.backupSchedule.automaticSchedule
                  ? `${summary.backupSchedule.intervalHours}시간마다`
                  : '비활성'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption">최근 성공</Typography>
              <Typography variant="body1">
                {summary?.backupSchedule.lastSuccessAt
                  ? new Date(
                      summary.backupSchedule.lastSuccessAt,
                    ).toLocaleString('ko-KR')
                  : '성공 기록 없음'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption">검증 방식</Typography>
              <Typography variant="body1">
                {summary?.backupSchedule.verificationMode ?? '-'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption">백업 크기</Typography>
              <Typography variant="body1">
                {summary?.backupSchedule.bytes
                  ? `${(
                      summary.backupSchedule.bytes /
                      1024 /
                      1024 /
                      1024
                    ).toFixed(2)} GB`
                  : '-'}
              </Typography>
            </Box>
          </Box>
          {summary?.backupSchedule.health === 'FAILED' ||
          summary?.backupSchedule.health === 'STALE' ? (
            <Box mt={2} className={classes.warning}>
              <Typography variant="body2">
                최근 {summary.backupSchedule.staleAfterHours}시간 내 검증된
                원본 백업이 없습니다. 작업자 연결과 PostgreSQL 상태를
                확인하세요.
              </Typography>
            </Box>
          ) : null}
        </Paper>

        <Paper className={classes.panel}>
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            flexWrap="wrap"
          >
            <Box>
              <Typography variant="h6">독립 저장소 암호화 백업</Typography>
              <Typography variant="body2">
                운영 서버와 다른 물리 장치에 암호화 복제하고 실제 복원
                해시까지 확인합니다.
              </Typography>
            </Box>
            <Chip
              color={
                summary?.offsiteBackup.health === 'HEALTHY'
                  ? 'primary'
                  : 'default'
              }
              label={
                summary?.offsiteBackup.health === 'HEALTHY'
                  ? '정상'
                  : summary?.offsiteBackup.health === 'FAILED'
                  ? '실패'
                  : '확인 필요'
              }
            />
          </Box>
          <Box className={classes.form} mt={2}>
            <Box>
              <Typography variant="caption">실행 주기</Typography>
              <Typography variant="body1">
                {summary?.offsiteBackup.automaticSchedule
                  ? `${summary.offsiteBackup.intervalHours}시간마다`
                  : '비활성'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption">최근 성공</Typography>
              <Typography variant="body1">
                {summary?.offsiteBackup.completedAt
                  ? new Date(
                      summary.offsiteBackup.completedAt,
                    ).toLocaleString('ko-KR')
                  : '성공 기록 없음'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption">암호화</Typography>
              <Typography variant="body1">
                {summary?.offsiteBackup.encryption ?? '-'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption">복원 검증</Typography>
              <Typography variant="body1">
                {summary?.offsiteBackup.restoreVerified
                  ? 'SHA-256 일치'
                  : '미검증'}
              </Typography>
            </Box>
          </Box>
          {summary?.offsiteBackup.health !== 'HEALTHY' ? (
            <Box mt={2} className={classes.warning}>
              <Typography variant="body2">
                최근 {summary?.offsiteBackup.staleAfterHours ?? 12}시간 내
                검증된 독립 백업이 없습니다.
                {summary?.offsiteBackup.errorMessage
                  ? ` ${summary.offsiteBackup.errorMessage}`
                  : ' PC 예약 작업과 네트워크 상태를 확인하세요.'}
              </Typography>
            </Box>
          ) : null}
        </Paper>

        <Paper className={classes.panel}>
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            flexWrap="wrap"
          >
            <Box>
              <Typography variant="h6">격리 복원 리허설</Typography>
              <Typography variant="body2">
                최신 백업을 운영 환경과 단절된 임시 PostgreSQL에 실제 복원하여
                복구 가능성을 검증합니다.
              </Typography>
            </Box>
            <Chip
              color={
                summary?.restoreDrill.health === 'HEALTHY'
                  ? 'primary'
                  : 'default'
              }
              label={
                summary?.restoreDrill
                  ? drillHealthLabels[summary.restoreDrill.health]
                  : '확인 중'
              }
            />
          </Box>
          <Box className={classes.form} mt={2}>
            <Box>
              <Typography variant="caption">자동 실행</Typography>
              <Typography variant="body1">
                {summary?.restoreDrill.automaticSchedule
                  ? `${summary.restoreDrill.intervalDays}일마다`
                  : '비활성'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption">최근 성공</Typography>
              <Typography variant="body1">
                {summary?.restoreDrill.lastSuccessAt
                  ? new Date(summary.restoreDrill.lastSuccessAt).toLocaleString(
                      'ko-KR',
                    )
                  : '성공 기록 없음'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption">복원 소요 시간</Typography>
              <Typography variant="body1">
                {summary?.restoreDrill.durationSeconds != null
                  ? `${summary.restoreDrill.durationSeconds}초`
                  : '-'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption">검증 테이블</Typography>
              <Typography variant="body1">
                {summary?.restoreDrill.tableCount != null
                  ? `${summary.restoreDrill.tableCount.toLocaleString()}개`
                  : '-'}
              </Typography>
            </Box>
          </Box>
          {summary?.restoreDrill.health === 'FAILED' ||
          summary?.restoreDrill.health === 'STALE' ? (
            <Box mt={2} className={classes.warning}>
              <Typography variant="body2">
                최근 격리 복원 검증이 실패했거나{' '}
                {summary.restoreDrill.staleAfterDays}일 이상 성공 기록이
                없습니다. 백업과 워커 상태를 확인하세요.
              </Typography>
            </Box>
          ) : null}
        </Paper>

        <Paper className={classes.panel}>
          <Box display="flex" justifyContent="space-between" mb={2}>
            <Typography variant="h6">운영 명령 등록</Typography>
            <Button startIcon={<RefreshIcon />} onClick={() => void refresh()}>
              새로고침
            </Button>
          </Box>
          <Box className={classes.form}>
            <TextField
              select
              variant="outlined"
              size="small"
              label="명령"
              value={commandType}
              onChange={event => {
                setCommandType(event.target.value);
                setConfirmation('');
              }}
            >
              {commandOptions.map(([value, label]) => (
                <MenuItem value={value} key={value}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              variant="outlined"
              size="small"
              label="대상 환경"
              value={targetEnvironment}
              onChange={event => setTargetEnvironment(event.target.value)}
            />
            <TextField
              variant="outlined"
              size="small"
              required={needsGuard}
              label="변경 티켓"
              value={changeTicket}
              onChange={event => setChangeTicket(event.target.value)}
            />
            <TextField
              variant="outlined"
              size="small"
              required={needsGuard}
              label={
                needsGuard
                  ? `확인 문구: EXECUTE ${commandType}`
                  : '확인 문구(선택)'
              }
              value={confirmation}
              onChange={event => setConfirmation(event.target.value)}
            />
          </Box>
          <Box mt={2}>
            <Button
              variant="contained"
              color="primary"
              onClick={() => void submit()}
            >
              검증 후 명령 큐 등록
            </Button>
            <Box mt={1}>
              <Typography variant="body2">{message}</Typography>
            </Box>
          </Box>
        </Paper>

        <Paper className={classes.panel}>
          <Typography variant="h6">보호 정책</Typography>
          {(summary?.policies ?? []).map(policy => (
            <Box className={classes.row} key={policy.code}>
              <Box>
                <Typography variant="subtitle1">{policy.name}</Typography>
                <Typography variant="caption">{policy.code}</Typography>
              </Box>
              <Chip
                size="small"
                color={policy.active ? 'primary' : 'default'}
                label={policy.active ? '활성' : '비활성'}
              />
              <Typography variant="body2">
                {JSON.stringify(policy.value)}
              </Typography>
            </Box>
          ))}
        </Paper>

        <Paper className={classes.panel}>
          <Typography variant="h6">최근 명령·감사 대상</Typography>
          {(summary?.commands ?? []).map(command => (
            <Box className={classes.row} key={command.commandId}>
              <Box>
                <Typography variant="subtitle1">
                  {command.commandType}
                </Typography>
                <Typography variant="caption">{command.commandId}</Typography>
              </Box>
              <Chip size="small" label={command.status} />
              <Typography variant="body2">
                {command.targetEnvironment} · {command.requestedBy} ·{' '}
                {command.changeTicket || '변경 티켓 없음'}
              </Typography>
            </Box>
          ))}
        </Paper>
      </Content>
    </Page>
  );
}
