import { useState } from 'react';
import { fetchApiRef, useApi } from '@backstage/core-plugin-api';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@material-ui/core';
import FileCopyIcon from '@material-ui/icons/FileCopy';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';

export function ProjectLifecycleActions(props: {
  projectId: string;
  projectName: string;
  owner: string;
  onError: (message: string) => void;
}) {
  const fetchApi = useApi(fetchApiRef);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [projectName, setProjectName] = useState('');

  const reloadWithProject = (nextProjectId: string) => {
    window.localStorage.setItem('resonance.selectedProjectId', nextProjectId);
    const url = new URL(window.location.href);
    url.searchParams.set('projectId', nextProjectId);
    window.location.assign(url.toString());
  };

  const copyProject = async () => {
    setSaving(true);
    props.onError('');
    try {
      const response = await fetchApi.fetch(
        `/api/resonance-projects/${encodeURIComponent(props.projectId)}/copy`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ projectId, projectName, owner: props.owner }),
        },
      );
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? `API ${response.status}`);
      reloadWithProject(projectId);
    } catch (error) {
      props.onError(error instanceof Error ? error.message : String(error));
      setSaving(false);
    }
  };

  const deleteProject = async () => {
    if (!window.confirm(`${props.projectName} (${props.projectId}) 프로젝트를 삭제하시겠습니까?`)) return;
    setSaving(true);
    props.onError('');
    try {
      const response = await fetchApi.fetch(
        `/api/resonance-projects/${encodeURIComponent(props.projectId)}?confirmProjectId=${encodeURIComponent(props.projectId)}`,
        { method: 'DELETE' },
      );
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? `API ${response.status}`);
      reloadWithProject('CCUS-PLATFORM');
    } catch (error) {
      props.onError(error instanceof Error ? error.message : String(error));
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={<FileCopyIcon />}
        onClick={() => {
          setProjectId(`${props.projectId}-COPY`.slice(0, 64));
          setProjectName(`${props.projectName} 복사본`);
          setOpen(true);
        }}
      >
        프로젝트 복사
      </Button>
      <Button
        size="small"
        color="secondary"
        startIcon={<DeleteOutlineIcon />}
        disabled={saving || props.projectId === 'CCUS-PLATFORM'}
        onClick={deleteProject}
      >
        삭제
      </Button>
      <Dialog open={open} onClose={() => !saving && setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>프로젝트 복사</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary">
            프로젝트 계약과 권한을 즉시 복사하고 설계·제어 자산은 새 프로젝트용으로 재생성합니다. 실행·감사 이력과 업로드 원본은 제외합니다.
          </Typography>
          <Box mt={2}>
            <TextField fullWidth required variant="outlined" size="small" label="새 프로젝트 ID"
              value={projectId} onChange={event => setProjectId(event.target.value.toUpperCase())} />
          </Box>
          <Box mt={2}>
            <TextField fullWidth required variant="outlined" size="small" label="새 프로젝트명"
              value={projectName} onChange={event => setProjectName(event.target.value)} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button disabled={saving} onClick={() => setOpen(false)}>취소</Button>
          <Button color="primary" variant="contained" disabled={saving || !projectId || !projectName}
            onClick={copyProject}>{saving ? '복사 중' : '복사 생성'}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
