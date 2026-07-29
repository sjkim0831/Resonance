import { useCallback, useEffect, useMemo, useState } from 'react';
import { Content, Header, Page } from '@backstage/core-components';
import { fetchApiRef, useApi } from '@backstage/core-plugin-api';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  Grid,
  MenuItem,
  Paper,
  Select,
  Switch,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core';

type Identity = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  enabled: boolean;
  groups: string[];
  tenantId: string;
  projectScopes: string[];
  dataScopes: string[];
};

type AuditRow = {
  auditId: string;
  actorRef: string;
  targetUsername: string;
  actionCode: string;
  createdAt: string;
};

const useStyles = makeStyles(theme => ({
  summary: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    border: '1px solid #cbd5e1',
    borderRadius: 12,
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(300px, 1.2fr) minmax(320px, 0.8fr)',
    gap: theme.spacing(2),
    [theme.breakpoints.down('sm')]: { gridTemplateColumns: '1fr' },
  },
  panel: {
    padding: theme.spacing(2.5),
    border: '1px solid #dbe4ea',
    borderRadius: 12,
  },
  identity: {
    width: '100%',
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
    border: '1px solid #dbe4ea',
    borderRadius: 10,
    textAlign: 'left',
    background: '#fff',
    cursor: 'pointer',
  },
  selected: {
    borderColor: '#2563eb',
    background: '#eff6ff',
  },
  field: { marginTop: theme.spacing(1.5) },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginTop: theme.spacing(2),
  },
  audit: {
    padding: theme.spacing(1.25, 0),
    borderBottom: '1px solid #e2e8f0',
  },
}));

export function IdentityAdministrationPage() {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [managedGroups, setManagedGroups] = useState<string[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [message, setMessage] = useState('');
  const [create, setCreate] = useState({
    username: '',
    displayName: '',
    email: '',
    password: '',
    groups: ['platform-engineering'],
    tenantId: 'DEFAULT',
    projectScopes: '*',
    dataScopes: '*',
  });
  const [editGroups, setEditGroups] = useState<string[]>([]);
  const [editEnabled, setEditEnabled] = useState(true);
  const [editTenantId, setEditTenantId] = useState('DEFAULT');
  const [editProjectScopes, setEditProjectScopes] = useState('*');
  const [editDataScopes, setEditDataScopes] = useState('*');
  const [resetPassword, setResetPassword] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState(true);

  const selected = useMemo(
    () => identities.find(identity => identity.id === selectedId),
    [identities, selectedId],
  );

  const load = useCallback(async () => {
    const [identityResponse, auditResponse] = await Promise.all([
      fetchApi.fetch('/api/resonance-identity-admin/identities'),
      fetchApi.fetch('/api/resonance-identity-admin/audit'),
    ]);
    if (!identityResponse.ok || !auditResponse.ok) {
      throw new Error('통합계정 정보를 불러오지 못했습니다.');
    }
    const identityPayload = (await identityResponse.json()) as {
      identities?: Identity[];
      managedGroups?: string[];
    };
    const auditPayload = (await auditResponse.json()) as {
      audit?: AuditRow[];
    };
    setIdentities(identityPayload.identities ?? []);
    setManagedGroups(identityPayload.managedGroups ?? []);
    setAudit(auditPayload.audit ?? []);
  }, [fetchApi]);

  useEffect(() => {
    void load().catch(error => setMessage(String(error.message ?? error)));
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    setEditGroups(selected.groups);
    setEditEnabled(selected.enabled);
    setEditTenantId(selected.tenantId);
    setEditProjectScopes(selected.projectScopes.join(', '));
    setEditDataScopes(selected.dataScopes.join(', '));
    setResetPassword('');
  }, [selected]);

  const createIdentity = async () => {
    setMessage('통합계정을 생성하는 중입니다.');
    const response = await fetchApi.fetch(
      '/api/resonance-identity-admin/identities',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...create,
          projectScopes: create.projectScopes
            .split(',')
            .map(value => value.trim())
            .filter(Boolean),
          dataScopes: create.dataScopes
            .split(',')
            .map(value => value.trim())
            .filter(Boolean),
          temporaryPassword: true,
        }),
      },
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setMessage(payload.message ?? '통합계정 생성에 실패했습니다.');
      return;
    }
    setCreate({
      username: '',
      displayName: '',
      email: '',
      password: '',
      groups: ['platform-engineering'],
      tenantId: 'DEFAULT',
      projectScopes: '*',
      dataScopes: '*',
    });
    setMessage('통합계정을 생성했습니다.');
    await load();
  };

  const updateIdentity = async () => {
    if (!selected) return;
    setMessage('계정 정책을 반영하는 중입니다.');
    const response = await fetchApi.fetch(
      `/api/resonance-identity-admin/identities/${encodeURIComponent(
        selected.id,
      )}`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username: selected.username,
          enabled: editEnabled,
          groups: editGroups,
          tenantId: editTenantId,
          projectScopes: editProjectScopes
            .split(',')
            .map(value => value.trim())
            .filter(Boolean),
          dataScopes: editDataScopes
            .split(',')
            .map(value => value.trim())
            .filter(Boolean),
          password: resetPassword || undefined,
          temporaryPassword,
        }),
      },
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setMessage(payload.message ?? '계정 정책 반영에 실패했습니다.');
      return;
    }
    setMessage('권한·상태·비밀번호 정책을 반영했습니다.');
    setResetPassword('');
    await load();
  };

  return (
    <Page themeId="tool">
      <Header
        title="Resonance 통합계정 관리"
        subtitle="Keycloak 계정·액터 권한·상태·비밀번호·감사 이력을 한 화면에서 관리합니다."
      />
      <Content>
        <Paper className={classes.summary} elevation={0}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Typography variant="caption">전체 계정</Typography>
              <Typography variant="h5">{identities.length}</Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="caption">활성 계정</Typography>
              <Typography variant="h5">
                {identities.filter(identity => identity.enabled).length}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="caption">관리 권한 그룹</Typography>
              <Typography variant="h5">{managedGroups.length}</Typography>
            </Grid>
          </Grid>
          {message && (
            <Typography color="primary" className={classes.field}>
              {message}
            </Typography>
          )}
        </Paper>

        <Box className={classes.layout}>
          <Paper className={classes.panel} elevation={0}>
            <Typography variant="h6">계정 목록</Typography>
            <Typography variant="body2" color="textSecondary">
              계정을 선택하면 액터 권한과 로그인 상태를 수정할 수 있습니다.
            </Typography>
            <Box mt={2}>
              {identities.map(identity => (
                <button
                  type="button"
                  key={identity.id}
                  className={`${classes.identity} ${
                    selectedId === identity.id ? classes.selected : ''
                  }`}
                  onClick={() => setSelectedId(identity.id)}
                >
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Box>
                      <Typography variant="subtitle1">
                        {identity.username}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {identity.displayName || identity.email}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={identity.enabled ? '활성' : '비활성'}
                      color={identity.enabled ? 'primary' : 'default'}
                    />
                  </Box>
                  <Box mt={1}>
                    {identity.groups.map(group => (
                      <Chip
                        key={group}
                        size="small"
                        label={group}
                        style={{ marginRight: 4, marginBottom: 4 }}
                      />
                    ))}
                  </Box>
                  <Typography variant="caption" color="textSecondary">
                    {identity.tenantId} · {identity.projectScopes.join(', ')} ·{' '}
                    {identity.dataScopes.join(', ')}
                  </Typography>
                </button>
              ))}
            </Box>
          </Paper>

          <Box>
            <Paper className={classes.panel} elevation={0}>
              <Typography variant="h6">선택 계정 관리</Typography>
              {!selected ? (
                <Typography
                  variant="body2"
                  color="textSecondary"
                  className={classes.field}
                >
                  왼쪽 목록에서 계정을 선택하세요.
                </Typography>
              ) : (
                <>
                  <Typography className={classes.field}>
                    {selected.username}
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={editEnabled}
                        onChange={event => setEditEnabled(event.target.checked)}
                        color="primary"
                      />
                    }
                    label="로그인 활성"
                  />
                  <Typography variant="subtitle2" className={classes.field}>
                    액터 권한 그룹
                  </Typography>
                  {managedGroups.map(group => (
                    <FormControlLabel
                      key={group}
                      control={
                        <Checkbox
                          checked={editGroups.includes(group)}
                          onChange={event =>
                            setEditGroups(current =>
                              event.target.checked
                                ? [...new Set([...current, group])]
                                : current.filter(item => item !== group),
                            )
                          }
                          color="primary"
                        />
                      }
                      label={group}
                    />
                  ))}
                  <TextField
                    className={classes.field}
                    fullWidth
                    label="테넌트 ID"
                    value={editTenantId}
                    onChange={event => setEditTenantId(event.target.value)}
                    helperText="계정 격리 범위입니다. 기본값: DEFAULT"
                  />
                  <TextField
                    className={classes.field}
                    fullWidth
                    label="프로젝트 범위"
                    value={editProjectScopes}
                    onChange={event => setEditProjectScopes(event.target.value)}
                    helperText="쉼표로 프로젝트 ID를 구분합니다. 전체는 *"
                  />
                  <TextField
                    className={classes.field}
                    fullWidth
                    label="데이터 범위"
                    value={editDataScopes}
                    onChange={event => setEditDataScopes(event.target.value)}
                    helperText="쉼표로 데이터 범위를 구분합니다. 전체는 *"
                  />
                  <TextField
                    className={classes.field}
                    fullWidth
                    type="password"
                    label="새 비밀번호(변경할 때만 입력)"
                    value={resetPassword}
                    onChange={event => setResetPassword(event.target.value)}
                    autoComplete="new-password"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={temporaryPassword}
                        onChange={event =>
                          setTemporaryPassword(event.target.checked)
                        }
                        color="primary"
                      />
                    }
                    label="다음 로그인 때 비밀번호 변경"
                  />
                  <Box className={classes.actions}>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={() => void updateIdentity()}
                    >
                      정책 저장
                    </Button>
                  </Box>
                </>
              )}
            </Paper>

            <Paper
              className={classes.panel}
              elevation={0}
              style={{ marginTop: 16 }}
            >
              <Typography variant="h6">신규 통합계정</Typography>
              {(['username', 'displayName', 'email', 'password'] as const).map(
                field => (
                  <TextField
                    key={field}
                    className={classes.field}
                    fullWidth
                    type={field === 'password' ? 'password' : 'text'}
                    label={
                      {
                        username: '로그인 ID',
                        displayName: '표시 이름',
                        email: '이메일',
                        password: '임시 비밀번호',
                      }[field]
                    }
                    value={create[field]}
                    onChange={event =>
                      setCreate(current => ({
                        ...current,
                        [field]: event.target.value,
                      }))
                    }
                  />
                ),
              )}
              <Typography variant="subtitle2" className={classes.field}>
                초기 권한 그룹
              </Typography>
              <Select
                multiple
                fullWidth
                value={create.groups}
                onChange={event =>
                  setCreate(current => ({
                    ...current,
                    groups: event.target.value as string[],
                  }))
                }
              >
                {managedGroups.map(group => (
                  <MenuItem key={group} value={group}>
                    {group}
                  </MenuItem>
                ))}
              </Select>
              {(['tenantId', 'projectScopes', 'dataScopes'] as const).map(
                field => (
                  <TextField
                    key={field}
                    className={classes.field}
                    fullWidth
                    label={
                      {
                        tenantId: '테넌트 ID',
                        projectScopes: '프로젝트 범위',
                        dataScopes: '데이터 범위',
                      }[field]
                    }
                    value={create[field]}
                    onChange={event =>
                      setCreate(current => ({
                        ...current,
                        [field]: event.target.value,
                      }))
                    }
                    helperText={
                      field === 'tenantId'
                        ? '기본값: DEFAULT'
                        : '쉼표로 구분하며 전체 범위는 *를 사용합니다.'
                    }
                  />
                ),
              )}
              <Box className={classes.actions}>
                <Button
                  variant="contained"
                  color="primary"
                  disabled={!create.username || create.password.length < 8}
                  onClick={() => void createIdentity()}
                >
                  계정 생성
                </Button>
              </Box>
            </Paper>
          </Box>
        </Box>

        <Paper
          className={classes.panel}
          elevation={0}
          style={{ marginTop: 16 }}
        >
          <Typography variant="h6">계정 감사 이력</Typography>
          {audit.slice(0, 20).map(row => (
            <Box key={row.auditId} className={classes.audit}>
              <Typography variant="subtitle2">
                {row.actionCode} · {row.targetUsername}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {row.actorRef} · {new Date(row.createdAt).toLocaleString()}
              </Typography>
            </Box>
          ))}
        </Paper>
      </Content>
    </Page>
  );
}
