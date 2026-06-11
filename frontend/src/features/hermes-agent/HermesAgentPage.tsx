import { useEffect, useState } from "react";
import {
  Activity,
  Bot,
  Clock,
  Cpu,
  Database,
  Download,
  HardDrive,
  Radio,
  Server,
  Trash2,
} from "lucide-react";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { PageStatusNotice } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import {
  fetchHermesModels,
  fetchHermesSessions,
  fetchHermesSkills,
  fetchHermesStatus,
  pullHermesModel,
  deleteHermesModel,
  type HermesStatusPayload,
  type HermesModelsPayload,
  type HermesSessionsPayload,
  type HermesSkillsPayload,
} from "../../lib/api/hermesApi";
import { Badge, SummaryCards, TabBar, text, rowsOf } from "./aiShared";

type TabKey = "status" | "models" | "sessions" | "skills";

export function HermesAgentPage() {
  const en = isEnglish();
  const [tab, setTab] = useState<TabKey>("status");
  const [status, setStatus] = useState<HermesStatusPayload | null>(null);
  const [models, setModels] = useState<HermesModelsPayload | null>(null);
  const [sessions, setSessions] = useState<HermesSessionsPayload | null>(null);
  const [skills, setSkills] = useState<HermesSkillsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionResult, setActionResult] = useState<string | null>(null);

  useEffect(() => {
    fetchHermesStatus().then(setStatus).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === "models" && !models) {
      fetchHermesModels().then(setModels).catch(() => {});
    } else if (tab === "sessions" && !sessions) {
      fetchHermesSessions().then(setSessions).catch(() => {});
    } else if (tab === "skills" && !skills) {
      fetchHermesSkills().then(setSkills).catch(() => {});
    }
  }, [tab, models, sessions, skills]);

  const handlePullModel = async (modelName: string) => {
    setLoading(true);
    try {
      const result = await pullHermesModel(modelName);
      setActionResult(result.result);
      setModels(null);
      fetchHermesModels().then(setModels).catch(() => {});
    } catch (e) {
      setActionResult("Failed to pull model");
    }
    setLoading(false);
  };

  const handleDeleteModel = async (modelName: string) => {
    if (!confirm(`Delete model ${modelName}?`)) return;
    setLoading(true);
    try {
      const result = await deleteHermesModel(modelName);
      setActionResult(result.result);
      setModels(null);
      fetchHermesModels().then(setModels).catch(() => {});
    } catch (e) {
      setActionResult("Failed to delete model");
    }
    setLoading(false);
  };

  const tabs = [
    { key: "status", label: en ? "Status" : "상태" },
    { key: "models", label: en ? "Models" : "모델" },
    { key: "sessions", label: en ? "Sessions" : "세션" },
    { key: "skills", label: en ? "Skills" : "스킬" },
  ];

  const statusCards = [
    { title: en ? "Hermes Version" : "Hermes 버전", value: text(status?.version) || "v0.10.0", desc: en ? "Framework version" : "프레임워크 버전" },
    { title: en ? "Gateway" : "게이트웨이", value: status?.gatewayStatus || "unknown", desc: en ? "Gateway process status" : "게이트웨이 프로세스 상태" },
    { title: en ? "Active Sessions" : "활성 세션", value: String(status?.activeSessions || 0), desc: en ? "Currently running" : "현재 실행 중" },
    { title: en ? "Hermes Home" : "Hermes 홈", value: status?.hermesHome?.split("/").pop() || "~/.hermes", desc: status?.hermesHome || "~/.hermes" },
  ];

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "AI Management" : "AI 관리" },
        { label: en ? "Hermes Agent" : "Hermes 에이전트" },
      ]}
      sidebarVariant="system"
      title={en ? "Hermes Agent" : "Hermes 에이전트"}
      subtitle={en ? "Local LLM agent runtime management" : "로컬 LLM 에이전트 런타임 관리"}
    >
      <AdminWorkspacePageFrame>
        {actionResult && (
          <div className="gov-alert gov-alert-info" style={{ marginBottom: "1rem" }}>
            {actionResult}
            <button onClick={() => setActionResult(null)} style={{ float: "right" }}>×</button>
          </div>
        )}

        <SummaryCards cards={statusCards} />

        <section className="gov-card" style={{ marginTop: "1rem" }}>
          <TabBar tabs={tabs} active={tab} setActive={(k) => setTab(k as TabKey)} />

          {tab === "status" && (
            <div style={{ padding: "1rem" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>
                {en ? "Platform Status" : "플랫폼 상태"}
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem" }}>
                {(status?.gatewayPlatforms || []).map((platform) => (
                  <div key={platform.name} style={{ padding: "0.75rem", border: "1px solid var(--border)", borderRadius: "0.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 500 }}>{platform.name}</span>
                      <Badge variant={platform.status === "connected" ? "success" : "warning"}>
                        {platform.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: "1.5rem 0 1rem" }}>
                {en ? "System Information" : "시스템 정보"}
              </h3>
              <table className="gov-table">
                <tbody>
                  <tr><td>Hermes Home</td><td>{status?.hermesHome || "~/.hermes"}</td></tr>
                  <tr><td>{en ? "Database" : "데이터베이스"}</td><td>{status?.hermesHome || "~/.hermes"}/state.db</td></tr>
                  <tr><td>{en ? "Config" : "설정"}</td><td>{status?.hermesHome || "~/.hermes"}/config.yaml</td></tr>
                </tbody>
              </table>
            </div>
          )}

          {tab === "models" && (
            <div style={{ padding: "1rem" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>
                {en ? "Downloaded Models (Ollama)" : "다운로드된 모델 (Ollama)"}
              </h3>
              <table className="gov-table">
                <thead>
                  <tr>
                    <th>{en ? "Model" : "모델"}</th>
                    <th>{en ? "Size" : "크기"}</th>
                    <th>{en ? "Status" : "상태"}</th>
                    <th>{en ? "Actions" : "작업"}</th>
                  </tr>
                </thead>
                <tbody>
                  {(models?.models || []).map((model: Record<string, unknown>) => (
                    <tr key={model.name as string}>
                      <td><code>{model.name as string}</code></td>
                      <td>{model.size as string}</td>
                      <td><Badge variant="success">{model.status as string || "downloaded"}</Badge></td>
                      <td>
                        <button
                          className="gov-btn gov-btn-danger gov-btn-sm"
                          onClick={() => handleDeleteModel(model.name as string)}
                          disabled={loading}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: "1.5rem 0 1rem" }}>
                {en ? "Available Models" : "사용 가능한 모델"}
              </h3>
              <table className="gov-table">
                <thead>
                  <tr>
                    <th>{en ? "Model" : "모델"}</th>
                    <th>{en ? "Size" : "크기"}</th>
                    <th>{en ? "Description" : "설명"}</th>
                    <th>{en ? "Actions" : "작업"}</th>
                  </tr>
                </thead>
                <tbody>
                  {(models?.availableModels || []).map((model: Record<string, unknown>) => (
                    <tr key={model.name as string}>
                      <td><code>{model.name as string}</code></td>
                      <td>{model.size as string}</td>
                      <td>{model.description as string}</td>
                      <td>
                        <button
                          className="gov-btn gov-btn-primary gov-btn-sm"
                          onClick={() => handlePullModel(model.name as string)}
                          disabled={loading}
                        >
                          <Download size={14} /> {en ? "Pull" : "다운로드"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "sessions" && (
            <div style={{ padding: "1rem" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>
                {en ? "Recent Sessions" : "최근 세션"}
              </h3>
              <table className="gov-table">
                <thead>
                  <tr>
                    <th>{en ? "ID" : "ID"}</th>
                    <th>{en ? "Source" : "소스"}</th>
                    <th>{en ? "Model" : "모델"}</th>
                    <th>{en ? "Messages" : "메시지"}</th>
                    <th>{en ? "Started" : "시작"}</th>
                  </tr>
                </thead>
                <tbody>
                  {(sessions?.sessions || []).map((session: Record<string, unknown>) => (
                    <tr key={session.id as string}>
                      <td><code>{(session.id as string)?.substring(0, 8)}...</code></td>
                      <td>{session.source as string}</td>
                      <td>{session.model as string}</td>
                      <td>{String(session.messageCount || 0)}</td>
                      <td>{session.startedAt ? new Date(session.startedAt as string).toLocaleString() : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "skills" && (
            <div style={{ padding: "1rem" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>
                {en ? "Installed Skills" : "설치된 스킬"}
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "1rem" }}>
                {(skills?.skills || []).map((skill: Record<string, unknown>) => (
                  <div key={skill.name as string} style={{ padding: "1rem", border: "1px solid var(--border)", borderRadius: "0.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                      <span style={{ fontWeight: 600 }}>{skill.name as string}</span>
                      <Badge variant={skill.enabled ? "success" : "warning"}>
                        {skill.enabled ? "enabled" : "disabled"}
                      </Badge>
                    </div>
                    <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)", margin: 0 }}>
                      {skill.description as string || "No description"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}

export default HermesAgentPage;