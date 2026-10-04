import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { WorkImplementationPage } from "./WorkImplementationPage";
import { ProcessCatalogPage } from "../actor-process-governance/ProcessCatalogPage";
import { fetchNewPagePage, fetchScreenBuilderPreview } from "../../lib/api/platform";

vi.mock("../admin-entry/AdminPageShell", () => ({ AdminPageShell: ({ children }: any) => <div>{children}</div> }));
vi.mock("../admin-system/GovernanceCompressionNav", () => ({ GovernanceCompressionNav: () => null }));
vi.mock("../../lib/navigation/runtime", () => ({ isEnglish: () => false, buildLocalizedPath: (koPath: string) => koPath }));
vi.mock("../../lib/api/platform", () => ({ fetchNewPagePage: vi.fn(), fetchScreenBuilderPreview: vi.fn() }));
vi.mock("./workbenchApi", () => ({
  fetchDevelopmentCapabilities: vi.fn(async () => ({ developmentOnly: false, planEnabled: false, executeEnabled: false, deploymentEnabled: false, reason: "Fixture runner disabled" })),
  fetchSrWorkbenchPage: vi.fn(async () => ({ tickets: [] })),
  safeRoute: (route: string) => route.startsWith("/") && !route.startsWith("//") ? route : "",
  ticketContext: () => ({}), currentEvidence: () => false
}));

const base = "/admin/api/system/actor-process";
let version: string;
let rule: string;
let conflict: boolean;
let writes: Record<string, unknown>[];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  version = "1"; rule = "fixture original"; conflict = false; writes = [];
  vi.mocked(fetchNewPagePage).mockResolvedValue({ menuCode: "TEST_MENU", pageId: "test-page", canonicalMenuUrl: "/admin/fixture/work", menuName: "Fixture 업무 화면" });
  vi.mocked(fetchScreenBuilderPreview).mockResolvedValue({ menuCode: "TEST_MENU", pageId: "test-page", menuUrl: "/admin/fixture/work", menuTitle: "Fixture 업무 화면", isEn: false, templateType: "form", versionStatus: "PUBLISHED", releaseUnitId: "published-7", nodes: [], events: [] });
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const binding = { screenResourceId: 71, screenName: "Fixture 업무 화면", audience: "ADMIN", routePath: "/admin/fixture/work" };
    const step = { processCode: "TEST_WORK", stepCode: "TEST_STEP", stepName: "Fixture Step", stepOrder: 1, inputContract: "{}", outputContract: "{}", completionRule: rule, screenBindings: [binding] };
    if (url === `${base}/catalog`) return json({ counts: { businessTypes: 1, processes: 1, steps: 1 }, businessTypes: [{ businessOrder: 1, workTypeCode: "TEST", workTypeName: "Fixture", active: true, processes: [{ processCode: "TEST_WORK", processName: "Fixture Process", processVersion: version, lifecycleStatus: "DRAFT", workspaceUrl: "/fixture", steps: [step] }] }] });
    if (url === `${base}/process-design?processCode=TEST_WORK`) return json({ steps: [step] });
    if (url === `${base}/design/professional-graph?processCode=TEST_WORK`) return json({ edges: [{ processCode: "TEST_WORK", fromStepCode: "TEST_STEP", fromStepName: "Fixture Step", toStepCode: "NEXT_STEP", toStepName: "Next Step", edgeType: "CORRECTION", conditionCode: "HAS_ERROR", conditionContract: "오류 있으면 보완", actorCode: "DATA_OWNER", reviewStatus: "CONFIRMED" }] });
    if (url === `${base}/processes/TEST_WORK/revisions`) return json({ revisions: [{ processCode: "TEST_WORK", stepCode: "TEST_STEP", changeType: "UPDATE", revisionReason: "fixture roundtrip", beforeProcessVersion: "1", afterProcessVersion: version, changedFields: ["completionRule"], createdAt: "2026-09-27T01:00:00Z" }] });
    if (url === `${base}/processes/TEST_WORK/steps/TEST_STEP` && init?.method === "PUT") {
      const body = JSON.parse(String(init.body)); writes.push(body);
      if (conflict || body.expectedProcessVersion !== version) return json({ message: "STALE_PROCESS_VERSION" }, 409);
      rule = body.completionRule; version = String(Number(version) + 1);
      return json({ processVersion: version });
    }
    throw new Error(`Unexpected request: ${init?.method || "GET"} ${url}`);
  }));
});
const ready = async () => { render(<WorkImplementationPage />); await waitFor(() => expect(screen.getByLabelText("완료 규칙")).toHaveValue("fixture original")); };
const save = (nextRule: string) => {
  fireEvent.click(screen.getByRole("button", { name: "설계 수정", exact: true }));
  fireEvent.change(screen.getByLabelText("완료 규칙"), { target: { value: nextRule } });
  fireEvent.change(screen.getByLabelText("변경 사유"), { target: { value: "fixture roundtrip" } });
  fireEvent.click(screen.getByRole("button", { name: "Revision 저장 후 전체 업무 보기 갱신" }));
};

it("saves through Revision, reloads the contract, restores it, and the catalog reads the latest version", async () => {
  await ready(); save("fixture changed");
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("버전 1 → 2"));
  expect(writes[0]).toEqual({ completionRule: "fixture changed", revisionReason: "fixture roundtrip", expectedProcessVersion: "1" });
  expect(screen.getByLabelText("완료 규칙")).toHaveValue("fixture changed");
  save("fixture original");
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("버전 2 → 3"));
  expect(rule).toBe("fixture original");
  expect(writes[1].expectedProcessVersion).toBe("2");
  render(<ProcessCatalogPage />);
  await waitFor(() => expect(screen.getByText("정의 v3 · DRAFT")).toBeInTheDocument());
});

it("preserves the draft and reason on HTTP 409 without claiming success", async () => {
  await ready(); conflict = true; save("conflicting draft");
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("입력 내용은 보존"));
  expect(screen.getByLabelText("완료 규칙")).toHaveValue("conflicting draft");
  expect(screen.getByLabelText("변경 사유")).toHaveValue("fixture roundtrip");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(rule).toBe("fixture original");
});

it("does not send a write for an unchanged contract", async () => {
  await ready(); save("fixture original");
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("변경할 계약 항목이 없습니다"));
  expect(writes).toHaveLength(0);
});

it("resolves the menu and page keys before opening the bound design", async () => {
  await ready();
  const runtime = screen.getByRole("link", { name: "/admin/fixture/work" });
  expect(runtime).toHaveAttribute("href", "/admin/fixture/work");
  expect(screen.queryByRole("link", { name: "연결된 설계 편집" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "화면 편집 연결" }));
  const designDraft = await screen.findByRole("link", { name: "연결된 설계 편집" });
  const designUrl = new URL(designDraft.getAttribute("href")!, "http://localhost");
  expect(designUrl.pathname).toBe("/admin/system/screen-builder");
  expect(designUrl.searchParams.get("menuUrl")).toBe("/admin/fixture/work");
  expect(designUrl.searchParams.get("menuTitle")).toBe("Fixture 업무 화면");
  expect(designUrl.searchParams.get("menuCode")).toBe("TEST_MENU");
  expect(designUrl.searchParams.get("pageId")).toBe("test-page");
  expect(await screen.findByText("게시 버전: published-7")).toBeInTheDocument();
});

it("does not edit the fallback new-page when the bound route cannot be resolved", async () => {
  vi.mocked(fetchNewPagePage).mockResolvedValue({ menuCode: "OTHER", pageId: "new-page", canonicalMenuUrl: "/admin/system/new-page" });
  await ready();
  fireEvent.click(screen.getByRole("button", { name: "화면 편집 연결" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("메뉴·페이지 연결을 찾지 못했습니다");
  expect(screen.queryByRole("link", { name: "연결된 설계 편집" })).not.toBeInTheDocument();
});

it("shows the same catalog procedure in list and flow views", async () => {
  await ready();
  fireEvent.click(screen.getByRole("button", { name: "업무 흐름" }));
  expect(await screen.findByRole("region", { name: "업무 흐름도" })).toHaveTextContent("Fixture Step");
  expect(screen.getByRole("region", { name: "업무 흐름도" })).toHaveTextContent("시작 상태 미확인 → 명령 미확인 → 종료 상태 미확인");
  expect(screen.getByRole("region", { name: "업무 흐름도" })).toHaveTextContent("오류 있으면 보완");
  fireEvent.click(screen.getByRole("button", { name: "목록" }));
  expect(screen.getByRole("button", { name: /Fixture Step/ })).toBeInTheDocument();
});

it("maps a catalog procedure to its bound page and input/output contracts", async () => {
  await ready();
  fireEvent.click(screen.getByRole("button", { name: "화면 지도" }));
  const map = screen.getByRole("region", { name: "화면 연결 지도" });
  expect(map).toHaveTextContent("Fixture Step");
  expect(map).toHaveTextContent("/admin/fixture/work");
  expect(map).toHaveTextContent("입력·인계");
  expect(map).toHaveTextContent("출력·인계");
});

it("loads persisted official revision history for the comparison view", async () => {
  await ready();
  fireEvent.click(screen.getByRole("button", { name: "변경 비교" }));
  const compare = await screen.findByRole("region", { name: "설계 변경 비교" });
  expect(compare).toHaveTextContent("fixture roundtrip");
  expect(compare).toHaveTextContent("1 → 1");
  expect(fetch).toHaveBeenCalledWith(`${base}/processes/TEST_WORK/revisions`, expect.objectContaining({ credentials: "include" }));
});
