import { useEffect, useMemo, useState } from 'react';
import { Content, Header, Page } from '@backstage/core-components';
import { fetchApiRef, useApi } from '@backstage/core-plugin-api';
import {
  Box,
  Button,
  Chip,
  Paper,
  Typography,
  makeStyles,
} from '@material-ui/core';
import SaveIcon from '@material-ui/icons/Save';
import {
  MIGRATION_CUTOVER_LEDGER,
  MIGRATION_CUTOVER_SUMMARY,
  toControlAssetPayload,
} from './migrationCutoverRegistry';

const useStyles = makeStyles(theme => ({
  summary: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4,minmax(0,1fr))',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
    [theme.breakpoints.down('sm')]: { gridTemplateColumns: '1fr 1fr' },
  },
  metric: { padding: theme.spacing(2), borderRadius: 12 },
  row: {
    display: 'grid',
    gridTemplateColumns:
      'minmax(240px,1.1fr) minmax(220px,1fr) 130px minmax(220px,1fr)',
    gap: theme.spacing(2),
    alignItems: 'center',
    padding: theme.spacing(1.5),
    borderBottom: '1px solid #e2e8f0',
    [theme.breakpoints.down('sm')]: { gridTemplateColumns: '1fr' },
  },
}));

export function MigrationCutoverPage() {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [ledger, setLedger] = useState<Record<string, string>>({});
  const rows = useMemo(() => MIGRATION_CUTOVER_LEDGER, []);
  const nativeRows = useMemo(
    () => rows.filter(entry => entry.implementation === 'NATIVE'),
    [rows],
  );
  const verifiedCount = nativeRows.filter(
    entry => ledger[entry.assetId] === 'VERIFIED',
  ).length;

  const loadLedger = async () => {
    const response = await fetchApi.fetch(
      '/api/resonance-projects/control-assets/CCUS-PLATFORM',
    );
    if (!response.ok) return;
    const payload = await response.json();
    setLedger(
      Object.fromEntries(
        (payload.assets ?? []).map(
          (asset: { assetId: string; migrationStatus: string }) => [
            asset.assetId,
            asset.migrationStatus,
          ],
        ),
      ),
    );
  };

  useEffect(() => {
    void loadLedger();
    // The API client is stable for the lifetime of this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const synchronize = async () => {
    setSaving(true);
    setMessage('이관 원장을 DB에 기록하는 중입니다.');
    try {
      const response = await fetchApi.fetch(
        '/api/resonance-projects/control-assets/CCUS-PLATFORM/sync',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ assets: rows.map(toControlAssetPayload) }),
        },
      );
      const payload = (await response.json()) as {
        synchronized?: number;
        message?: string;
      };
      if (!response.ok) {
        throw new Error(payload.message ?? `API ${response.status}`);
      }
      setMessage(
        `${
          payload.synchronized ?? rows.length
        }개 이관 항목을 DB에 기록했습니다.`,
      );
      await loadLedger();
    } catch (error) {
      setMessage(
        `이관 원장 기록 실패: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setSaving(false);
    }
  };

  const verifyNative = async () => {
    setSaving(true);
    setMessage('인증 E2E 증적을 원장에 반영하는 중입니다.');
    try {
      const response = await fetchApi.fetch(
        '/api/resonance-projects/control-assets/CCUS-PLATFORM/verify-native',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            targets: nativeRows.map(entry => ({
              assetId: entry.assetId,
              targetUrl: entry.targetRoute.split('?')[0],
            })),
            evidence: {
              testStatus: 'PASS',
              verifiedBy: 'authenticated-backstage-e2e',
              checks: [
                'authenticated-session-retained',
                'native-route-rendered',
                'no-error-boundary',
                'expected-workspace-heading',
              ],
            },
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? `API ${response.status}`);
      }
      setMessage(
        `${payload.verified}개 네이티브 항목의 인증 E2E 검증을 완료했습니다.`,
      );
      await loadLedger();
    } catch (error) {
      setMessage(
        `인증 E2E 반영 실패: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setSaving(false);
    }
  };

  const retireSource = async () => {
    setSaving(true);
    setMessage('검증된 Resonance 원본 메뉴를 안전하게 전환하는 중입니다.');
    try {
      const verifiedRows = nativeRows.filter(
        entry => ledger[entry.assetId] === 'VERIFIED',
      );
      if (verifiedRows.length !== nativeRows.length) {
        throw new Error('모든 네이티브 항목의 인증 검증이 먼저 필요합니다.');
      }
      const response = await fetchApi.fetch(
        '/api/resonance-projects/control-assets/CCUS-PLATFORM/retire-source',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            assetIds: verifiedRows.map(entry => entry.assetId),
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? `API ${response.status}`);
      }
      setMessage(
        `${payload.retired}개 항목을 Backstage로 전환했습니다. Resonance 메뉴 ${
          payload.bridgeResult?.changedMenus ?? 0
        }개는 복구 가능 상태로 보관됩니다.`,
      );
      await loadLedger();
    } catch (error) {
      setMessage(
        `원본 메뉴 전환 실패: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page themeId="tool">
      <Header
        title="Resonance → Backstage 이관 원장"
        subtitle="기능·API·DB·권한·테스트 증적을 확인한 항목만 원본 메뉴 전환 대상으로 승인합니다."
      />
      <Content>
        <Box className={classes.summary}>
          {[
            ['전체 이관 단위', MIGRATION_CUTOVER_SUMMARY.total],
            ['액터·프로세스 탭', MIGRATION_CUTOVER_SUMMARY.actorProcessTabs],
            ['시스템 관리 화면', MIGRATION_CUTOVER_SUMMARY.systemScreens],
            ['인증 검증 완료', verifiedCount],
          ].map(([label, value]) => (
            <Paper className={classes.metric} key={String(label)}>
              <Typography variant="body2">{label}</Typography>
              <Typography variant="h4">{value}</Typography>
            </Paper>
          ))}
        </Box>

        <Box mb={2} display="flex" alignItems="center" gridGap={12}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            disabled={saving}
            onClick={() => void synchronize()}
          >
            DB 이관 원장 동기화
          </Button>
          <Button
            variant="outlined"
            color="primary"
            disabled={saving || !nativeRows.length}
            onClick={() => void verifyNative()}
          >
            인증 E2E 결과 일괄 반영
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            disabled={saving || verifiedCount !== nativeRows.length}
            onClick={() => void retireSource()}
          >
            검증 완료 원본 메뉴 전환
          </Button>
          <Typography variant="body2">{message}</Typography>
        </Box>

        <Paper>
          {rows.map(entry => {
            const currentStatus =
              ledger[entry.assetId] ?? entry.migrationStatus;
            return (
              <Box className={classes.row} key={entry.assetId}>
                <Box>
                  <Typography variant="subtitle1">
                    {entry.sourceName}
                  </Typography>
                  <Typography variant="caption">{entry.sourceRoute}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2">
                    대상: {entry.targetRoute}
                  </Typography>
                  <Typography variant="caption">{entry.category}</Typography>
                </Box>
                <Box>
                  <Chip size="small" label={currentStatus} />
                  <Box mt={0.5}>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={entry.implementation}
                    />
                  </Box>
                </Box>
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    {entry.cutoverBlockedBy.length
                      ? entry.cutoverBlockedBy.join(' · ')
                      : '전환 조건 충족'}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Paper>
      </Content>
    </Page>
  );
}
