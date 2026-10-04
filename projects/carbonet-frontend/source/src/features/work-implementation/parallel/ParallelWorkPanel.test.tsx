import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ParallelWorkPanel } from "./ParallelWorkPanel";
it("shows three planned assignments without presenting them as running agents", () => {
  render(<ParallelWorkPanel processes={[]} catalogLoaded={false} />);
  expect(screen.getAllByText("배정 대기 · 미배정")).toHaveLength(3);
  expect(screen.getByText("정의 대조: 카탈로그 조회 대기")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /프로젝트 · 조직 경계/ }));
  expect(screen.getByRole("link", { name: "/emission/project/create" })).toHaveAttribute("href", "/emission/project/create");
  expect(screen.getByText("수정 가능한 파일 4개")).toBeInTheDocument();
});
it("shows missing canonical steps as conflicts after catalog loading", () => {
  render(<ParallelWorkPanel processes={[]} catalogLoaded={true} />);
  expect(screen.getByText("정의 대조: 현재 조회된 카탈로그 기준")).toBeInTheDocument();
  expect(screen.getByText("EMISSION_PROJECT_PORTFOLIO/EMISSION_PROJECT_PORTFOLIO_LIST")).toBeInTheDocument();
  expect(screen.getByText(/통합: 대기 항목 확인 필요/)).toBeInTheDocument();
});
