import { useCallback, useEffect, useMemo, useState } from 'react';
import { Content, Header, Page } from '@backstage/core-components';
import { fetchApiRef, useApi } from '@backstage/core-plugin-api';
import {
  Box,
  Button,
  Chip,
  Grid,
  MenuItem,
  Paper,
  TextField,
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

type SecurityPolicy = {
  policyCode: string;
  policyName: string;
  description: string;
  enabled: boolean;
  configuration: Record<string, unknown>;
  updatedBy: string;
  updatedAt: string;
};

type NetworkRule = {
  ruleId: string;
  ruleType: 'ALLOW_IP' | 'BLOCK_IP' | 'BLOCK_SUBJECT';
  value: string;
  reason: string;
  enabled: boolean;
  expiresAt?: string;
  createdAt: string;
};

const securityRoutes = new Set([
  '/admin/system/authority-management',
  '/admin/system/access_history',
  '/admin/system/security-audit',
  '/admin/system/security-monitoring',
  '/admin/system/security-policy',
  '/admin/system/blocklist',
  '/admin/system/ip_whitelist',
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
  const [policies, setPolicies] = useState<SecurityPolicy[]>([]);
  const [networkRules, setNetworkRules] = useState<NetworkRule[]>([]);
  const [newRule, setNewRule] = useState({
    ruleType: 'ALLOW_IP',
    value: '',
    reason: '',
  });
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
      const [summaryResult, controlsResult] = await Promise.all([
        fetchApi.fetch('/api/resonance-identity-admin/summary'),
        fetchApi.fetch('/api/resonance-identity-admin/security-controls'),
      ]);
      if (!summaryResult.ok || !controlsResult.ok) {
        throw new Error(`API ${summaryResult.status}/${controlsResult.status}`);
      }
      setSummary((await summaryResult.json()) as SecuritySummary);
      const controls = (await controlsResult.json()) as {
        policies: SecurityPolicy[];
        networkRules: NetworkRule[];
      };
      setPolicies(controls.policies);
      setNetworkRules(controls.networkRules);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [fetchApi]);

  const updatePolicy = async (policy: SecurityPolicy) => {
    const response = await fetchApi.fetch(
      `/api/resonance-identity-admin/security-controls/policies/${encodeURIComponent(
        policy.policyCode,
      )}`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          enabled: !policy.enabled,
          configuration: policy.configuration,
        }),
      },
    );
    if (!response.ok) {
      setMessage(`정책 변경 실패: API ${response.status}`);
      return;
    }
    await refresh();
  };

  const createRule = async () => {
    const response = await fetchApi.fetch(
      '/api/resonance-identity-admin/security-controls/network-rules',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(newRule),
      },
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setMessage(payload.message ?? `규칙 등록 실패: API ${response.status}`);
      return;
    }
    setNewRule({ ruleType: 'ALLOW_IP', value: '', reason: '' });
    await refresh();
  };

  const toggleRule = async (rule: NetworkRule) => {
    const response = await fetchApi.fetch(
      `/api/resonance-identity-admin/security-controls/network-rules/${encodeURIComponent(
        rule.ruleId,
      )}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: !rule.enabled }),
      },
    );
    if (!response.ok) {
      setMessage(`규칙 상태 변경 실패: API ${response.status}`);
      return;
    }
    await refresh();
  };

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
          <Typography variant="h6">보안 정책</Typography>
          {policies.map(policy => (
            <Box className={classes.row} key={policy.policyCode}>
              <Box>
                <Typography variant="subtitle1">{policy.policyName}</Typography>
                <Typography variant="caption">
                  {policy.policyCode} · {policy.description}
                </Typography>
              </Box>
              <Chip
                color={policy.enabled ? 'primary' : 'default'}
                label={policy.enabled ? '활성' : '비활성'}
              />
              <Button
                variant="outlined"
                onClick={() => void updatePolicy(policy)}
              >
                {policy.enabled ? '비활성화' : '활성화'}
              </Button>
            </Box>
          ))}
        </Paper>

        <Paper className={classes.panel}>
          <Typography variant="h6">IP·차단 규칙</Typography>
          <Grid container spacing={1}>
            <Grid item xs={12} md={3}>
              <TextField
                select
                fullWidth
                variant="outlined"
                size="small"
                label="규칙 유형"
                value={newRule.ruleType}
                onChange={event =>
                  setNewRule(current => ({
                    ...current,
                    ruleType: event.target.value,
                  }))
                }
              >
                <MenuItem value="ALLOW_IP">IP 허용</MenuItem>
                <MenuItem value="BLOCK_IP">IP 차단</MenuItem>
                <MenuItem value="BLOCK_SUBJECT">계정·주체 차단</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                variant="outlined"
                size="small"
                label="IP/CIDR 또는 주체"
                value={newRule.value}
                onChange={event =>
                  setNewRule(current => ({
                    ...current,
                    value: event.target.value,
                  }))
                }
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                variant="outlined"
                size="small"
                label="사유"
                value={newRule.reason}
                onChange={event =>
                  setNewRule(current => ({
                    ...current,
                    reason: event.target.value,
                  }))
                }
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                disabled={!newRule.value.trim()}
                onClick={() => void createRule()}
              >
                규칙 등록
              </Button>
            </Grid>
          </Grid>
          <Box mt={2}>
            {networkRules.map(rule => (
              <Box className={classes.row} key={rule.ruleId}>
                <Box>
                  <Typography variant="subtitle1">{rule.value}</Typography>
                  <Typography variant="caption">
                    {rule.ruleType} · {rule.reason || '사유 없음'}
                  </Typography>
                </Box>
                <Chip
                  color={rule.enabled ? 'primary' : 'default'}
                  label={rule.enabled ? '적용 중' : '중지'}
                />
                <Button
                  variant="outlined"
                  onClick={() => void toggleRule(rule)}
                >
                  {rule.enabled ? '중지' : '재적용'}
                </Button>
              </Box>
            ))}
          </Box>
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
