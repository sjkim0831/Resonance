// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {EmissionMyWorkPage} from "./EmissionMyWorkPage";
vi.mock("../../lib/navigation/runtime",()=>({buildLocalizedPath:(p:string)=>p,isEnglish:()=>false}));
const item={id:51,projectId:"EM-P-1",projectName:"시범 배출량",site:"부산",name:"활동자료 제출",status:"READY",targetUrl:"/emission/data-request",processCode:"EMISSION_PROJECT",processStepCode:"EMISSION_PROJECT_COLLECT"};
describe("EmissionMyWorkPage",()=>{beforeEach(()=>vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({items:[item],summary:{total:1}})})));afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it("loads own emission scope and links the assigned task",async()=>{render(<EmissionMyWorkPage/>);expect(await screen.findByRole("heading",{name:"탄소배출 업무 목록"})).not.toBeNull();expect(screen.getByText("활동자료 제출")).not.toBeNull();expect(screen.queryByText("업무 종류")).toBeNull();expect(screen.getByRole("link",{name:"업무 열기"}).getAttribute("href")).toContain("/emission/data-request?");expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("scope=mine"),expect.objectContaining({credentials:"include"}));});
it("filters status to an explicit empty state",async()=>{render(<EmissionMyWorkPage/>);await screen.findByText("활동자료 제출");fireEvent.change(screen.getByLabelText("상태"),{target:{value:"DONE"}});expect(screen.getByText("현재 계정에 배정된 탄소배출 업무가 없습니다.")).not.toBeNull();});
it("shows API errors rather than false empty success",async()=>{vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:false,status:503,json:async()=>({message:"WORK_ITEMS_UNAVAILABLE"})}));render(<EmissionMyWorkPage/>);expect((await screen.findByRole("alert")).textContent).toContain("WORK_ITEMS_UNAVAILABLE");});});
