import { useState, useCallback } from 'react';
import { AdminPageShell } from '../admin-entry/AdminPageShell';
import { AdminWorkspacePageFrame } from '../admin-ui/pageFrames';

type BackupType = 'full' | 'quick' | 'unload';
type BackupStatus = 'idle' | 'running' | 'success' | 'error';

interface BackupLog {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

function BackupCard({ title, description, type, onBackup, status }: {
  title: string;
  description: string;
  type: BackupType;
  onBackup: (type: BackupType) => void;
  status: BackupStatus;
}) {
  const statusColors = {
    idle: 'border-gray-200 bg-white',
    running: 'border-blue-200 bg-blue-50',
    success: 'border-green-200 bg-green-50',
    error: 'border-red-200 bg-red-50',
  };

  const statusText = {
    idle: '대기',
    running: '실행중...',
    success: '완료',
    error: '실패',
  };

  return (
    <div className={`rounded-lg border p-6 ${statusColors[status]}`}>
      <h3 className="text-lg font-bold mb-2">{title}</h3>
      <p className="text-gray-600 text-sm mb-4">{description}</p>
      <div className="flex items-center justify-between">
        <span className={`text-sm font-medium px-2 py-1 rounded ${
          status === 'success' ? 'bg-green-100 text-green-800' :
          status === 'error' ? 'bg-red-100 text-red-800' :
          status === 'running' ? 'bg-blue-100 text-blue-800' :
          'bg-gray-100 text-gray-600'
        }`}>
          {statusText[status]}
        </span>
        <button
          onClick={() => onBackup(type)}
          disabled={status === 'running'}
          className={`px-4 py-2 rounded-lg font-medium ${
            status === 'running'
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {status === 'running' ? '실행중...' : '백업 실행'}
        </button>
      </div>
    </div>
  );
}

function LogViewer({ logs }: { logs: BackupLog[] }) {
  return (
    <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm max-h-96 overflow-y-auto">
      {logs.length === 0 ? (
        <p className="text-gray-500">백업 로그가 여기에 표시됩니다...</p>
      ) : (
        logs.map((log, idx) => (
          <div key={idx} className={`mb-1 ${
            log.type === 'error' ? 'text-red-400' :
            log.type === 'success' ? 'text-green-400' :
            'text-gray-300'
          }`}>
            <span className="text-gray-500">[{log.timestamp}]</span>{' '}
            {log.message}
          </div>
        ))
      )}
    </div>
  );
}

export function ServerBackupPage() {
  const [logs, setLogs] = useState<BackupLog[]>([]);
  const [status, setStatus] = useState<Record<BackupType, BackupStatus>>({
    full: 'idle',
    quick: 'idle',
    unload: 'idle',
  });

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [...prev.slice(-50), { timestamp, message, type }]);
  }, []);

  const runBackup = async (type: BackupType) => {
    setStatus(prev => ({ ...prev, [type]: 'running' }));
    addLog(`${type === 'full' ? '전체' : type === 'quick' ? '빠른' : '내보내기'} 백업을 시작합니다...`, 'info');

    try {
      const response = await fetch('/api/backup/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });

      if (response.ok) {
        const result = await response.json();
        addLog(`백업 완료: ${result.file || '성공'}`, 'success');
        setStatus(prev => ({ ...prev, [type]: 'success' }));
      } else {
        throw new Error('Backup failed');
      }
    } catch (error) {
      addLog(`백업 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`, 'error');
      setStatus(prev => ({ ...prev, [type]: 'error' }));
    }

    setTimeout(() => {
      setStatus(prev => ({ ...prev, [type]: 'idle' }));
    }, 3000);
  };

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: 'Home' },
        { label: 'System' },
        { label: 'Server Backup' },
      ]}
      title="Server Backup"
      subtitle="서버 및 데이터베이스 백업 관리"
    >
      <AdminWorkspacePageFrame>
        <div className="grid gap-6 md:grid-cols-3 mb-6">
          <BackupCard
            title="전체 백업 (Full)"
            description="전체 데이터베이스와 설정 파일을 백업합니다. 가장 안전하지만 시간이 오래 걸립니다."
            type="full"
            onBackup={runBackup}
            status={status.full}
          />
          <BackupCard
            title="빠른 백업 (Quick)"
            description="증분 백업으로 변경분만 백업합니다. 설정 시간이 짧습니다."
            type="quick"
            onBackup={runBackup}
            status={status.quick}
          />
          <BackupCard
            title="내보내기 (Unload)"
            description="데이터베이스 스키마와 데이터를 SQL 파일로 내보냅니다."
            type="unload"
            onBackup={runBackup}
            status={status.unload}
          />
        </div>

        <div className="bg-white rounded-lg border p-4 mb-6">
          <h3 className="font-bold mb-3">백업 기록</h3>
          <div className="mb-4">
            <p className="text-sm text-gray-500 mb-2">현재 백업 파일:</p>
            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span>carbonet-fullbackup-20260622_003558.tar.gz</span>
                <span className="text-gray-500">55MB</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-bold mb-3">실행 로그</h3>
          <LogViewer logs={logs} />
        </div>

        <div className="mt-4 flex gap-4">
          <button
            onClick={() => setLogs([])}
            className="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200"
          >
            로그 지우기
          </button>
        </div>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}

export default ServerBackupPage;