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
import AccountCircleIcon from '@material-ui/icons/AccountCircle';
import RefreshIcon from '@material-ui/icons/Refresh';
import SecurityIcon from '@material-ui/icons/Security';
import {
  RESONANCE_CONTROL_ASSETS,
  ControlAssetRecord,
} from './controlAssetRegistry';

type SecuritySummary = {
  checkedAt: string;
  identityProvider: {
    code: string;
    status: string;
    issuerConfigured: boolean;
  };
  identities: { total: number; enabled: number; disabled: number };
  groups: { total: number; managed: string[] };
  auditCounts: Record<string, number>;
};

const securityRoutes = new Set([
  '/admin/system/authority-management',
  '/admin/system/access_history',
  '/admin/system/security-audit',
  '/admin/system/security-monitoring',
]);

const useStyles = makeStyles(theme => ({
  hero: {
    padding: theme.spacing(3),
    borderRadius: 14,
    color: '#fff',
    background: 'linear-gradient(120deg,#172554 0%,#312e81 54%,#075985 100%)',
    marginBottom: theme.spacing(2),
  },
  metric: {
    height: '100%',
    padding: theme.spacing(2),
    border: '1px solid #dbe4ea',
    borderRadius: 12,
  },
  value: { fontSize: 26, fontWeight: 800, color: '#12344d' },
  panel: {
    padding: theme.spacing(2.5),
    border: '1px solid #dbe4ea',
    borderRadius: 12,
    marginTop: theme.spacing(2),
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'minmax(220px,1fr) 150px minmax(220px,1.2fr)',
    gap: theme.spacing(2),
    alignItems: 'center',
    padding: theme.spacing(1.5, 0),
    borderBottom: '1px solid #edf1f3',
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: '1fr',
      gap: theme.spacing(0.5),
    },
  },
}));

export function SystemSecurityControlPage() {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const [summary, setSummary] = useState<SecuritySummary>();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const assets = useMemo(
    () =>
      RESONANCE_CONTROL_ASSETS.filter(asset =>
        securityRoutes.has(asset.routePath),
      ),
    [],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchApi.fetch(
        '/api/resonance-identity-admin/summary',
      );
      if (!result.ok) throw new Error(`API ${result.status}`);
      setSummary((await result.json()) as SecuritySummary);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [fetchApi]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const auditTotal = Object.values(summary?.auditCounts ?? {}).reduce(
    (total, count) => total + count,
    0,
  );
  return (
    <Page themeId="tool">
      <Header
        title="보안·권한 관제"
        subtitle="Keycloak 계정·권한과 변경 감사 증적을 한 화면에서 검증합니다."
      />
      <Content>
        <Box className={classes.hero}>
          <Typography variant="h4">Security &amp; Identity Control</Typography>
          <Typography variant="body1">
            인증 공급자 응답과 감사 기록이 확인된 경우에만 정상으로 표시합니다.
          </Typography>
          <Box mt={2} display="flex" flexWrap="wrap" gridGap={8}>
            <Button
              variant="contained"
              color="default"
              startIcon={<RefreshIcon />}
              disabled={loading}
              onClick={() => void refresh()}
            >
              {loading ? '확인 중' : '보안 상태 확인'}
            </Button>
            <Button
              variant="contained"
              color="default"
              startIcon={<AccountCircleIcon />}
              href="/identity-administration"
            >
              통합 계정 관리
            </Button>
          </Box>
        </Box>

        {message ? (
          <Paper className={classes.panel}>
            <Typography color="error">
              보안 상태 조회 실패: {message}
            </Typography>
          </Paper>
        ) : null}

        <Grid container spacing={2}>
          {[
            ['전체 계정', summary?.identities.total ?? 0],
            ['활성 계정', summary?.identities.enabled ?? 0],
            ['관리 권한 그룹', summary?.groups.managed.length ?? 0],
            ['감사 기록', auditTotal],
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
            <SecurityIcon color="primary" />
            <Typography variant="h6">인증·감사 상태</Typography>
          </Box>
          <Box className={classes.row}>
            <Typography variant="subtitle1">인증 공급자</Typography>
            <Chip
              color={
                summary?.identityProvider.status === 'UP'
                  ? 'primary'
                  : 'default'
              }
              label={summary?.identityProvider.status ?? '확인 전'}
            />
            <Typography variant="body2">
              {summary?.identityProvider.code ?? 'KEYCLOAK'} · issuer{' '}
              {summary?.identityProvider.issuerConfigured
                ? 'configured'
                : 'not configured'}
            </Typography>
          </Box>
          {Object.entries(summary?.auditCounts ?? {}).map(([action, count]) => (
            <Box className={classes.row} key={action}>
              <Typography variant="subtitle1">{action}</Typography>
              <Chip label={`${count}건`} />
              <Typography variant="body2">계정 정책 변경 감사 증적</Typography>
            </Box>
          ))}
          <Typography variant="caption">
            최근 확인: {summary?.checkedAt ?? '확인 전'}
          </Typography>
        </Paper>

        <Paper className={classes.panel}>
          <Typography variant="h6">통합된 보안 관리 화면</Typography>
          {assets.map((asset: ControlAssetRecord) => (
            <Box className={classes.row} key={asset.screenId}>
              <Box>
                <Typography variant="subtitle1">{asset.screenName}</Typography>
                <Typography variant="caption">{asset.routePath}</Typography>
              </Box>
              <Chip label={asset.migrationStatus} />
              <Typography variant="body2">
                액터 {asset.actorCodes.length} · 프로세스{' '}
                {asset.processCodes.length} · 계약{' '}
                {asset.dependencyContracts.length}
              </Typography>
            </Box>
          ))}
        </Paper>
      </Content>
    </Page>
  );
}
