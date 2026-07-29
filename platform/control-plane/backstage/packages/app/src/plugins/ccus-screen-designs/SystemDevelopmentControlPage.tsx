import { useMemo, useState } from 'react';
import { Content, Header, Page } from '@backstage/core-components';
import {
  Box,
  Button,
  Chip,
  Grid,
  Paper,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core';
import AccountTreeIcon from '@material-ui/icons/AccountTree';
import BuildIcon from '@material-ui/icons/Build';
import CodeIcon from '@material-ui/icons/Code';
import LaunchIcon from '@material-ui/icons/Launch';
import {
  RESONANCE_CONTROL_ASSETS,
  ControlAssetRecord,
} from './controlAssetRegistry';

const developmentRoutes = new Set([
  '/admin/system/api-management',
  '/admin/system/feature-management',
  '/admin/system/controller-management',
  '/admin/system/function-console',
  '/admin/system/module',
  '/admin/system/code',
  '/admin/system/column-management',
  '/admin/system/full-stack-management',
  '/admin/system/package-governance',
  '/admin/system/version-management',
  '/admin/system/codex-provision',
]);

const useStyles = makeStyles(theme => ({
  hero: {
    padding: theme.spacing(3),
    borderRadius: 14,
    color: '#fff',
    background: 'linear-gradient(120deg,#172554 0%,#1e3a8a 52%,#0369a1 100%)',
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
    gridTemplateColumns: 'minmax(220px,1fr) minmax(220px,1.2fr) 150px',
    gap: theme.spacing(2),
    alignItems: 'center',
    padding: theme.spacing(1.5, 0),
    borderBottom: '1px solid #edf1f3',
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: '1fr',
      gap: theme.spacing(0.75),
    },
  },
  value: { fontSize: 26, fontWeight: 800, color: '#12344d' },
  contracts: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
    marginTop: theme.spacing(0.75),
  },
}));

const includesQuery = (asset: ControlAssetRecord, query: string) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [
    asset.screenName,
    asset.routePath,
    ...asset.actorCodes,
    ...asset.processCodes,
    ...asset.dependencyContracts,
  ]
    .join(' ')
    .toLowerCase()
    .includes(normalized);
};

export function SystemDevelopmentControlPage() {
  const classes = useStyles();
  const [query, setQuery] = useState('');
  const assets = useMemo(
    () =>
      RESONANCE_CONTROL_ASSETS.filter(
        asset =>
          developmentRoutes.has(asset.routePath) && includesQuery(asset, query),
      ),
    [query],
  );
  const totals = useMemo(
    () => ({
      actors: new Set(assets.flatMap(asset => asset.actorCodes)).size,
      processes: new Set(assets.flatMap(asset => asset.processCodes)).size,
      contracts: new Set(assets.flatMap(asset => asset.dependencyContracts))
        .size,
    }),
    [assets],
  );

  return (
    <Page themeId="tool">
      <Header
        title="개발 자산 제어"
        subtitle="API부터 버전까지 설계·계약·검증·배포 추적성을 한곳에서 관리합니다."
      />
      <Content>
        <Box className={classes.hero}>
          <Typography variant="h4">System Development Control</Typography>
          <Typography variant="body1">
            화면이 아니라 액터·프로세스·데이터 계약을 기준으로 개발 자산을
            추적합니다.
          </Typography>
          <Box mt={2} display="flex" flexWrap="wrap" gridGap={8}>
            <Button
              variant="contained"
              color="default"
              startIcon={<AccountTreeIcon />}
              href="/actor-process-control"
            >
              액터·프로세스
            </Button>
            <Button
              variant="contained"
              color="default"
              startIcon={<BuildIcon />}
              href="/design-assets"
            >
              설계 승인
            </Button>
            <Button
              variant="contained"
              color="default"
              startIcon={<LaunchIcon />}
              href="/resonance-projects"
            >
              프로젝트 실행
            </Button>
          </Box>
        </Box>

        <Grid container spacing={2}>
          {[
            ['개발 자산', assets.length],
            ['연결 액터', totals.actors],
            ['연결 프로세스', totals.processes],
            ['데이터 계약', totals.contracts],
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
          <Box display="flex" alignItems="center" gridGap={8} mb={2}>
            <CodeIcon color="primary" />
            <Typography variant="h6">개발 자산 및 계약</Typography>
          </Box>
          <TextField
            fullWidth
            variant="outlined"
            size="small"
            label="화면·경로·액터·프로세스·계약 검색"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
          <Box mt={2}>
            {assets.map(asset => (
              <Box className={classes.row} key={asset.screenId}>
                <Box>
                  <Typography variant="subtitle1">
                    {asset.screenName}
                  </Typography>
                  <Typography variant="caption">{asset.routePath}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2">
                    액터 {asset.actorCodes.length} · 프로세스{' '}
                    {asset.processCodes.length} · 테스트 {asset.testCount} ·
                    태스크 {asset.taskCount}
                  </Typography>
                  <Box className={classes.contracts}>
                    {asset.dependencyContracts.slice(0, 5).map(contract => (
                      <Chip key={contract} size="small" label={contract} />
                    ))}
                    {asset.dependencyContracts.length > 5 ? (
                      <Chip
                        size="small"
                        label={`+${asset.dependencyContracts.length - 5}`}
                      />
                    ) : null}
                  </Box>
                </Box>
                <Chip
                  color={
                    asset.migrationStatus === 'NATIVE_READY'
                      ? 'primary'
                      : 'default'
                  }
                  label={asset.migrationStatus}
                />
              </Box>
            ))}
          </Box>
        </Paper>
      </Content>
    </Page>
  );
}
