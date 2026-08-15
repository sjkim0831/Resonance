import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Content, Header, Page } from '@backstage/core-components';
import { fetchApiRef, useApi } from '@backstage/core-plugin-api';
import {
  Box,
  Button,
  Chip,
  Drawer,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import SearchIcon from '@material-ui/icons/Search';
import {
  getSharedProjectId,
  useSharedProjectSelection,
} from './useSharedProjectSelection';
import { pollDesignAssetSync } from './designAssetSyncPolling';

type AssetType = 'THEME' | 'CSS' | 'SECTION' | 'COMPONENT' | 'SCREEN' | 'MENU';
type DesignAsset = {
  assetType: AssetType;
  assetId: string;
  assetName: string;
  routePath: string;
  version: string;
  active: boolean;
  payload: Record<string, unknown>;
  fingerprint: string;
  syncedAt: string;
};
type DesignAccess = {
  actorRef: string;
  roles: string[];
  permissions: {
    canRequest: boolean;
    canReview: boolean;
    canApprove: boolean;
    canAudit: boolean;
  };
};
type SourceReceipt = {
  status?: string;
  success?: boolean;
  sourceCommitted?: boolean;
  idempotent?: boolean;
  activationPolicy?: string;
  controlPlaneSnapshot?: string;
  snapshotFingerprint?: string;
  syncReceiptId?: string;
  retryAttempt?: number;
  retryNotBefore?: string;
  affectedScreenCount?: number;
  affectedProcessCount?: number;
  jobCount?: number;
  endpointExpected?: number;
  message?: string;
};

const types: { code: AssetType; label: string }[] = [
  { code: 'THEME', label: '테마' },
  { code: 'CSS', label: 'CSS' },
  { code: 'SECTION', label: '섹션' },
  { code: 'COMPONENT', label: '컴포넌트' },
  { code: 'SCREEN', label: '화면' },
  { code: 'MENU', label: '메뉴' },
];
const sourceMutableTypes = new Set<AssetType>([
  'THEME',
  'SECTION',
  'COMPONENT',
  'SCREEN',
]);

const useStyles = makeStyles(theme => ({
  hero: {
    padding: theme.spacing(3),
    marginBottom: theme.spacing(2),
    color: '#fff',
    borderRadius: 14,
    background: 'linear-gradient(120deg,#172554,#075985 58%,#0f766e)',
  },
  toolbar: {
    display: 'grid',
    gridTemplateColumns: 'minmax(300px,1fr) 240px 320px',
    gap: theme.spacing(2),
    alignItems: 'center',
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    [theme.breakpoints.down('sm')]: { gridTemplateColumns: '1fr' },
  },
  metric: {
    padding: theme.spacing(2),
    border: '1px solid #dbe4ea',
    borderRadius: 10,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
    gap: theme.spacing(2),
    [theme.breakpoints.down('md')]: {
      gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
    },
    [theme.breakpoints.down('sm')]: { gridTemplateColumns: '1fr' },
  },
  card: {
    padding: theme.spacing(2),
    border: '1px solid #dbe4ea',
    borderRadius: 10,
    cursor: 'pointer',
    minWidth: 0,
    '&:hover': { borderColor: '#0369a1', background: '#f7fbff' },
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: 12,
    overflowWrap: 'anywhere',
  },
  drawer: {
    width: 620,
    maxWidth: '96vw',
    padding: theme.spacing(3),
    [theme.breakpoints.down('xs')]: { width: '100vw' },
  },
}));

export function DesignAssetControlPage() {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState('');
  const [projectId, setProjectId] = useState(() => getSharedProjectId());
  useSharedProjectSelection(projectId, setProjectId);
  const [projects, setProjects] = useState<
    { projectId: string; projectName: string }[]
  >([]);
  const [assets, setAssets] = useState<DesignAsset[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<DesignAsset | null>(null);
  const [error, setError] = useState('');
  const [editorName, setEditorName] = useState('');
  const [editorPayload, setEditorPayload] = useState('');
  const [saveState, setSaveState] = useState('');
  const [receipt, setReceipt] = useState<SourceReceipt | null>(null);
  const [access, setAccess] = useState<DesignAccess | null>(null);
  const sourceSyncPollRef = useRef<AbortController | null>(null);
  const activeType = types[tab]?.code ?? 'THEME';

  const load = useCallback(async () => {
    const [assetResponse, accessResponse] = await Promise.all([
      fetchApi.fetch(
        `/api/resonance-projects/design-assets/${encodeURIComponent(
          projectId,
        )}?assetType=${activeType}&limit=500`,
      ),
      fetchApi.fetch(
        `/api/resonance-projects/design-assets/${encodeURIComponent(
          projectId,
        )}/access`,
      ),
    ]);
    const [assetPayload, accessPayload] = await Promise.all([
      assetResponse.json(),
      accessResponse.json(),
    ]);
    if (!assetResponse.ok) {
      throw new Error(assetPayload.message || '자산 조회 실패');
    }
    if (!accessResponse.ok) {
      throw new Error(accessPayload.message || '권한 조회 실패');
    }
    setAssets(assetPayload.assets ?? []);
    setCounts(assetPayload.counts ?? {});
    setAccess(accessPayload);
    return (assetPayload.assets ?? []) as DesignAsset[];
  }, [activeType, fetchApi, projectId]);

  useEffect(() => {
    void fetchApi
      .fetch('/api/resonance-projects')
      .then(response => response.json())
      .then(payload => setProjects(payload.projects ?? []))
      .catch(reason => setError(String(reason)));
  }, [fetchApi]);

  useEffect(() => {
    void load()
      .then(() => setError(''))
      .catch(reason => setError(String(reason.message || reason)));
  }, [load]);

  useEffect(() => () => sourceSyncPollRef.current?.abort(), []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return assets;
    return assets.filter(asset =>
      [asset.assetId, asset.assetName, asset.routePath]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [assets, query]);

  const openAsset = (asset: DesignAsset) => {
    sourceSyncPollRef.current?.abort();
    setSelected(asset);
    setEditorName(asset.assetName);
    setEditorPayload(JSON.stringify(asset.payload, null, 2));
    setSaveState('');
    setReceipt(null);
  };

  const saveSource = async () => {
    if (!selected) return;
    let payload: Record<string, unknown>;
    try {
      const parsed = JSON.parse(editorPayload);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('object required');
      }
      payload = parsed as Record<string, unknown>;
    } catch {
      throw new Error('설계 계약 JSON은 객체 형식이어야 합니다.');
    }
    setSaveState('저장·영향 분석·코드 생성 요청 중');
    const sourceResponse = await fetchApi.fetch(
      `/api/resonance-projects/design-assets/${encodeURIComponent(
        projectId,
      )}/source`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          activationPolicy: 'SOURCE_IMMEDIATE_V1',
          authorityMode: 'SOURCE',
          assetType: selected.assetType,
          assetId: selected.assetId,
          baseFingerprint: selected.fingerprint,
          assetName: editorName,
          routePath: selected.routePath,
          version: selected.version,
          active: selected.active,
          payload,
        }),
      },
    );
    const result = (await sourceResponse.json()) as SourceReceipt;
    setReceipt(result);
    if (
      sourceResponse.status === 202 &&
      result.sourceCommitted === true &&
      result.controlPlaneSnapshot === 'SYNC_REQUIRED'
    ) {
      if (!result.syncReceiptId) {
        setSaveState('동기화 추적 실패');
        throw new Error(
          result.message ||
            '자동 동기화 영수증이 없어 완료로 처리할 수 없습니다.',
        );
      }
      setSaveState('런타임 원본 커밋됨 · 제어판 동기화 대기');
      setError(result.message || '제어판 스냅샷 자동 동기화를 기다립니다.');
      const controller = new AbortController();
      sourceSyncPollRef.current?.abort();
      sourceSyncPollRef.current = controller;
      const sync = await pollDesignAssetSync({
        signal: controller.signal,
        readReceipt: async () => {
          const syncResponse = await fetchApi.fetch(
            `/api/resonance-projects/design-assets/${encodeURIComponent(
              projectId,
            )}/source-sync/${encodeURIComponent(result.syncReceiptId!)}`,
            { signal: controller.signal },
          );
          const syncReceipt = (await syncResponse.json()) as SourceReceipt;
          if (!syncResponse.ok && syncResponse.status !== 202) {
            throw new Error(
              syncReceipt.message ||
                `동기화 상태 조회 실패 (${syncResponse.status})`,
            );
          }
          return syncReceipt;
        },
      });
      if (controller.signal.aborted || sync.outcome === 'CANCELLED') return;
      if (sync.outcome === 'SYNCHRONIZED' && sync.receipt) {
        const authoritativeAssets = await load();
        const authoritative = authoritativeAssets.find(
          asset =>
            asset.assetType === selected.assetType &&
            asset.assetId === selected.assetId,
        );
        if (
          !authoritative ||
          authoritative.fingerprint !== sync.receipt.snapshotFingerprint
        ) {
          setSaveState('동기화 검증 대기');
          throw new Error('동기화 영수증과 재조회한 스냅샷 지문이 다릅니다.');
        }
        setSelected(authoritative);
        setReceipt({ ...result, ...sync.receipt });
        setSaveState('동기화 완료 · 백엔드 영수증 검증됨');
        setError('');
        return;
      }
      setSaveState('동기화 진행 중 · 백엔드 자동 재시도 유지');
      setError(
        sync.receipt?.message ||
          '화면 확인 시간은 끝났지만 백엔드 자동 동기화는 계속됩니다.',
      );
      return;
    }
    if (
      result.sourceCommitted === true &&
      result.controlPlaneSnapshot === 'SYNCHRONIZED' &&
      /^[0-9a-f]{64}$/.test(String(result.snapshotFingerprint ?? ''))
    ) {
      const nextFingerprint = String(result.snapshotFingerprint);
      setSelected({
        ...selected,
        assetName: editorName,
        payload,
        fingerprint: nextFingerprint,
      });
      setSaveState(
        `${result.status ?? 'APPLIED'} · 화면 ${Number(
          result.affectedScreenCount ?? 0,
        )} · 프로세스 ${Number(
          result.affectedProcessCount ?? 0,
        )} · 생성 작업 ${Number(result.jobCount ?? 0)}`,
      );
      await load();
      if (!sourceResponse.ok) {
        setError(
          result.message ||
            '설계 원본은 저장되었으며 후속 검토가 필요한 결과가 있습니다.',
        );
      } else {
        setError('');
      }
      return;
    }
    setSaveState(
      result.sourceCommitted === true
        ? '런타임 원본 커밋됨 · 제어판 미동기화'
        : '적용되지 않음 · 생성 작업 0',
    );
    throw new Error(
      result.message ||
        '런타임 원본과 제어판 스냅샷이 모두 확인되지 않아 완료로 처리할 수 없습니다.',
    );
  };

  const receiptSynchronized =
    receipt?.sourceCommitted === true &&
    receipt.controlPlaneSnapshot === 'SYNCHRONIZED' &&
    /^[0-9a-f]{64}$/.test(String(receipt.snapshotFingerprint ?? ''));
  let sourceStorageLabel = '안 됨';
  if (receipt?.sourceCommitted) sourceStorageLabel = '커밋됨 · 동기화 대기';
  if (receiptSynchronized) sourceStorageLabel = '및 스냅샷 동기화 완료';

  return (
    <Page themeId="tool">
      <Header
        title="공통 디자인 자산 관리"
        subtitle="테마·섹션·컴포넌트·화면 설계를 저장하면 영향 화면과 프로세스 코드가 즉시 동기화됩니다."
      />
      <Content>
        <Box className={classes.hero}>
          <Typography variant="h5">
            Common Design Source · SOURCE_IMMEDIATE_V1
          </Typography>
          <Typography variant="body2">
            DESIGN_APPROVER가 설계 원본을 저장하면 스키마와 의존성을 먼저
            검증하고, 같은 트랜잭션에서 canonical 화면을 변경한 뒤 영향
            프로세스별 코드·엔드포인트 생성 작업을 자동 등록합니다.
          </Typography>
          {access && (
            <Box mt={2} display="flex" flexWrap="wrap" gridGap={8}>
              <Chip size="small" label={access.actorRef} />
              {access.roles.map(role => (
                <Chip key={role} size="small" label={role} />
              ))}
            </Box>
          )}
        </Box>
        <Grid container spacing={2}>
          {types.map(type => (
            <Grid item xs={6} sm={4} lg={2} key={type.code}>
              <Paper className={classes.metric} elevation={0}>
                <Typography variant="caption">{type.label}</Typography>
                <Typography variant="h5">
                  {Number(counts[type.code] ?? 0).toLocaleString()}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
        {receipt && (
          <Box mt={2} mb={2}>
            <Paper variant="outlined">
              <Box p={2}>
                <Box display="flex" flexWrap="wrap" gridGap={8}>
                  <Chip
                    color={receiptSynchronized ? 'primary' : 'default'}
                    label={
                      receiptSynchronized
                        ? receipt.status ?? 'SYNCHRONIZED'
                        : 'PENDING'
                    }
                  />
                  <Chip
                    label={receipt.activationPolicy ?? 'SOURCE_IMMEDIATE_V1'}
                  />
                  <Chip label={`원본 저장 ${sourceStorageLabel}`} />
                  <Chip
                    label={`스냅샷 ${receipt.controlPlaneSnapshot ?? '-'}`}
                  />
                </Box>
                <Box mt={1}>
                  <Typography variant="body2">
                    영향 화면 {Number(receipt.affectedScreenCount ?? 0)}개 ·
                    영향 프로세스 {Number(receipt.affectedProcessCount ?? 0)}개
                    · 생성 작업 {Number(receipt.jobCount ?? 0)}개 · 예상
                    엔드포인트 {Number(receipt.endpointExpected ?? 0)}개
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Box>
        )}
        <Paper className={classes.toolbar} elevation={0}>
          <Tabs
            value={tab}
            onChange={(_, value) => setTab(value)}
            indicatorColor="primary"
            textColor="primary"
            variant="scrollable"
          >
            {types.map(type => (
              <Tab key={type.code} label={type.label} />
            ))}
          </Tabs>
          <TextField
            select
            size="small"
            variant="outlined"
            label="프로젝트"
            value={projectId}
            onChange={event => setProjectId(event.target.value)}
          >
            {projects.map(project => (
              <MenuItem key={project.projectId} value={project.projectId}>
                {project.projectName}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            variant="outlined"
            label="ID·이름·경로 검색"
            value={query}
            onChange={event => setQuery(event.target.value)}
            InputProps={{ startAdornment: <SearchIcon fontSize="small" /> }}
          />
        </Paper>
        {error && (
          <Typography color="error" gutterBottom>
            {error}
          </Typography>
        )}
        <Typography variant="body2" color="textSecondary" gutterBottom>
          {visible.length.toLocaleString()}개 {types[tab]?.label} 자산
        </Typography>
        <Box className={classes.grid}>
          {visible.map(asset => (
            <Paper
              className={classes.card}
              elevation={0}
              key={`${asset.assetType}:${asset.assetId}`}
              onClick={() => openAsset(asset)}
            >
              <Box display="flex" justifyContent="space-between">
                <Chip size="small" label={asset.assetType} />
                <Chip
                  size="small"
                  color={asset.active ? 'primary' : 'default'}
                  label={asset.active ? 'ACTIVE' : 'INACTIVE'}
                />
              </Box>
              <Typography variant="h6">{asset.assetName}</Typography>
              <Typography className={classes.mono}>{asset.assetId}</Typography>
              {asset.routePath && (
                <Typography variant="caption">{asset.routePath}</Typography>
              )}
            </Paper>
          ))}
        </Box>
      </Content>
      <Drawer
        anchor="right"
        open={Boolean(selected)}
        onClose={() => {
          sourceSyncPollRef.current?.abort();
          setSelected(null);
        }}
      >
        {selected && (
          <Box className={classes.drawer}>
            <Box display="flex" justifyContent="space-between">
              <Box>
                <Typography variant="overline">{selected.assetType}</Typography>
                <Typography variant="h5">{selected.assetName}</Typography>
              </Box>
              <IconButton
                onClick={() => {
                  sourceSyncPollRef.current?.abort();
                  setSelected(null);
                }}
              >
                <CloseIcon />
              </IconButton>
            </Box>
            <Typography className={classes.mono}>{selected.assetId}</Typography>
            <Box mt={2}>
              <Typography variant="caption">라우트</Typography>
              <Typography>{selected.routePath || '-'}</Typography>
            </Box>
            <Box mt={2}>
              <Typography variant="caption">버전 · 원본 지문</Typography>
              <Typography className={classes.mono}>
                {selected.version} · {selected.fingerprint}
              </Typography>
            </Box>
            <Box mt={2}>
              <Typography variant="caption">동기화 시각</Typography>
              <Typography>{selected.syncedAt}</Typography>
            </Box>
            <Box mt={2}>
              <Typography variant="caption">설계 원본 계약</Typography>
              <Typography variant="body2" color="textSecondary">
                저장 즉시 영향 화면·기능·권한·API 계약을 다시 계산합니다.
                실패하면 원본과 생성 작업을 모두 0건으로 되돌립니다.
              </Typography>
              <TextField
                fullWidth
                variant="outlined"
                label="자산명"
                margin="dense"
                value={editorName}
                disabled={!sourceMutableTypes.has(selected.assetType)}
                onChange={event => setEditorName(event.target.value)}
              />
              <TextField
                fullWidth
                multiline
                minRows={12}
                variant="outlined"
                label="계약 JSON"
                margin="dense"
                value={editorPayload}
                disabled={!sourceMutableTypes.has(selected.assetType)}
                onChange={event => setEditorPayload(event.target.value)}
              />
              <Box display="flex" gridGap={12} mt={2}>
                <Button
                  color="primary"
                  variant="contained"
                  disabled={
                    !access?.permissions.canApprove ||
                    !sourceMutableTypes.has(selected.assetType) ||
                    saveState.includes('요청 중')
                  }
                  onClick={() =>
                    void saveSource().catch(reason => {
                      setSaveState(current =>
                        current.includes('런타임 원본 커밋됨') ||
                        current.includes('동기화')
                          ? current
                          : '적용되지 않음 · 생성 작업 0',
                      );
                      setError(String(reason.message || reason));
                    })
                  }
                >
                  설계 저장·코드 자동 반영
                </Button>
              </Box>
              {!sourceMutableTypes.has(selected.assetType) && (
                <Box mt={1}>
                  <Typography variant="body2" color="textSecondary">
                    CSS와 메뉴는 현재 조회 전용입니다. 테마·섹션·컴포넌트· 화면
                    설계만 즉시 반영할 수 있습니다.
                  </Typography>
                </Box>
              )}
              {saveState && (
                <Box mt={2}>
                  <Chip color="primary" label={saveState} />
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Drawer>
    </Page>
  );
}
