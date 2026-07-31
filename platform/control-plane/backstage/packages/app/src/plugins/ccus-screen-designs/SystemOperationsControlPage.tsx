import { useCallback, useEffect, useMemo, useState } from 'react';
import { Content, Header, Page } from '@backstage/core-components';
import { fetchApiRef, useApi } from '@backstage/core-plugin-api';
import {
  Box,
  Button,
  Chip,
  Grid,
  Paper,
  Typography,
  makeStyles,
} from '@material-ui/core';
import RefreshIcon from '@material-ui/icons/Refresh';
import StorageIcon from '@material-ui/icons/Storage';
import TimelineIcon from '@material-ui/icons/Timeline';
import {
  RESONANCE_CONTROL_ASSETS,
  ControlAssetRecord,
} from './controlAssetRegistry';

type OperationsSummary = {
  checkedAt: string;
  services: {
    code: string;
    name: string;
    status: string;
    evidence: string;
  }[];
  inventory: Record<string, number>;
  taskStatuses: Record<string, number>;
  deployment: {
    checkedAt?: string;
    status?: string;
    category?: string;
    targetCommit?: string;
    mode?: string;
    elapsedMs?: number;
    retryAllowed?: boolean;
    retryAttempted?: boolean;
    evidence?: string;
  };
};

const useStyles = makeStyles(theme => ({
  hero: {
    padding: theme.spacing(3),
    borderRadius: 14,
    color: '#fff',
    background: 'linear-gradient(120deg,#172554 0%,#075985 55%,#0f766e 100%)',
    marginBottom: theme.spacing(2),
  },
  metric: {
    height: '100%',
    padding: theme.spacing(2),
    border: '1px solid #dbe4ea',
    borderRadius: 12,
  },
  panel: {
    padding: theme.spacing(2.5),
    border: '1px solid #dbe4ea',
    borderRadius: 12,
    marginTop: theme.spacing(2),
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'minmax(220px,1fr) 140px minmax(220px,1.2fr)',
    gap: theme.spacing(2),
    alignItems: 'center',
    padding: theme.spacing(1.5, 0),
    borderBottom: '1px solid #edf1f3',
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: '1fr',
      gap: theme.spacing(0.5),
    },
  },
  value: { fontSize: 26, fontWeight: 800, color: '#12344d' },
}));

export function SystemOperationsControlPage() {
  // Build-performance smoke target; this comment intentionally changes source.
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const [summary, setSummary] = useState<OperationsSummary>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const assets = useMemo(
    () =>
      RESONANCE_CONTROL_ASSETS.filter(
        asset => asset.targetPlugin === 'ccus-screen-designs/system-operations',
      ),
    [],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchApi.fetch(
        '/api/resonance-projects/operations/summary',
      );
      if (!result.ok) throw new Error(`API ${result.status}`);
      setSummary((await result.json()) as OperationsSummary);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [fetchApi]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const inventory = summary?.inventory ?? {};
  return (
    <Page themeId="tool">
      <Header
        title="시스템 운영 관제"
        subtitle="시스템·DB·배치·빌드 상태와 이전 자산을 한 화면에서 검증합니다."
      />
      <Content>
        <Box className={classes.hero}>
          <Typography variant="h4">Resonance Operations Control</Typography>
          <Typography variant="body1">
            조회 결과와 증적이 있는 기능만 정상 상태로 표시합니다.
          </Typography>
          <Box mt={2}>
            <Button
              variant="contained"
              color="default"
              startIcon={<RefreshIcon />}
              onClick={() => void refresh()}
              disabled={loading}
            >
              {loading ? '확인 중' : '상태 새로고침'}
            </Button>
          </Box>
        </Box>

        {error ? (
          <Paper className={classes.panel}>
            <Typography color="error">운영 상태 조회 실패: {error}</Typography>
          </Paper>
        ) : null}

        <Grid container spacing={2}>
          {[
            ['프로젝트', inventory.projectCount ?? 0],
            ['개발 태스크', inventory.taskCount ?? 0],
            ['제어 자산', inventory.controlAssetCount ?? 0],
            ['디자인 자산', inventory.designAssetCount ?? 0],
          ].map(([label, value]) => (
            <Grid item xs={12} sm={6} md={3} key={String(label)}>
              <Paper className={classes.metric}>
                <Typography variant="body2">{label}</Typography>
                <Typography className={classes.value}>{value}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Paper className={classes.panel}>
          <Box display="flex" alignItems="center" gridGap={8} mb={1}>
            <TimelineIcon color="primary" />
            <Typography variant="h6">자동 배포 복구 현황</Typography>
          </Box>
          <Box className={classes.row}>
            <Box>
              <Typography variant="subtitle1">
                최근 배포 {summary?.deployment?.status ?? 'UNKNOWN'}
              </Typography>
              <Typography variant="caption">
                {summary?.deployment?.targetCommit?.slice(0, 10) ?? '커밋 확인 전'}
              </Typography>
            </Box>
            <Chip
              size="small"
              color={summary?.deployment?.status === 'SUCCESS' ? 'primary' : 'default'}
              label={summary?.deployment?.category ?? 'NO_EVIDENCE'}
            />
            <Typography variant="body2">
              {summary?.deployment?.retryAttempted
                ? '안전한 자동 복구 1회 실행됨'
                : summary?.deployment?.retryAllowed
                ? '자동 복구 가능'
                : '자동 복구 미실행'}
              {typeof summary?.deployment?.elapsedMs === 'number'
                ? ` · ${summary.deployment.elapsedMs}ms`
                : ''}
            </Typography>
          </Box>
        </Paper>

        <Paper className={classes.panel}>
          <Box display="flex" alignItems="center" gridGap={8} mb={1}>
            <StorageIcon color="primary" />
            <Typography variant="h6">실시간 서비스 점검</Typography>
          </Box>
          {(summary?.services ?? []).map(service => (
            <Box className={classes.row} key={service.code}>
              <Typography variant="subtitle1">{service.name}</Typography>
              <Chip
                size="small"
                color={service.status === 'UP' ? 'primary' : 'default'}
                label={service.status}
              />
              <Typography variant="body2">{service.evidence}</Typography>
            </Box>
          ))}
          <Typography variant="caption">
            최근 확인: {summary?.checkedAt ?? '확인 전'}
          </Typography>
        </Paper>

        <Paper className={classes.panel}>
          <Box display="flex" alignItems="center" gridGap={8} mb={1}>
            <TimelineIcon color="primary" />
            <Typography variant="h6">통합된 기존 운영 화면</Typography>
          </Box>
          {assets.map((asset: ControlAssetRecord) => (
            <Box className={classes.row} key={asset.screenId}>
              <Box>
                <Typography variant="subtitle1">{asset.screenName}</Typography>
                <Typography variant="caption">{asset.routePath}</Typography>
              </Box>
              <Chip size="small" label={asset.migrationStatus} />
              <Typography variant="body2">
                {asset.targetPlugin} · 계약 {asset.dependencyContracts.length}개
              </Typography>
            </Box>
          ))}
        </Paper>
      </Content>
    </Page>
  );
}
