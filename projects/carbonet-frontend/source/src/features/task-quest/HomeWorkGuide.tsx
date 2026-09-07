import { useState } from "react";

export function HomeWorkGuide({ en, onOverview }: { en: boolean; onOverview: () => void }) {
  const [open, setOpen] = useState(new URLSearchParams(window.location.search).get("guide") === "1");
  const steps = en ? [
    ["Find a service or information", "Enter a search term in the main search field, then use the search button. Use the navigation or service cards to open a service directly."],
    ["Check notices and public statistics", "Review notices and the update dates beside statistics. Home summary figures are not the processing status of your individual task."],
    ["Check a certificate", "Use Certificate authenticity verification, upload the issued PDF, then inspect the verdict and the issued/uploaded hashes."],
    ["Start or continue work", "Open All workflows to locate the process and step, then open its actual screen. Assign the responsible person and approver and save on the work screen when those fields are available—not on Home."],
    ["If you cannot continue", "Sign in for protected work. If a menu or action is unavailable, check your organization and role. Use Help for general support and Screen design for the screen specification."],
  ] : [
    ["서비스·자료 찾기", "중앙 통합 검색창에 검색어를 입력한 뒤 검색 버튼을 누르세요. 상단 메뉴나 서비스 카드를 선택하면 해당 서비스 화면으로 이동합니다."],
    ["공지·공개 통계 확인", "공지사항과 통계의 기준일·최종 업데이트를 확인하세요. 홈의 요약 수치는 내 개별 업무의 처리 상태와는 다릅니다."],
    ["인증서 진위 확인", "‘인증서 진위 확인’을 선택하고 발급받은 PDF를 올리세요. 결과 화면에서 진위 판정과 발급 원본·업로드 해시를 확인합니다."],
    ["업무 시작·이어가기", "‘전체 업무 보기’에서 프로세스와 단계를 확인하고 실제 업무 화면을 여세요. 담당자·결재자 지정 항목이 있는 업무는 그 화면에서 지정한 뒤 저장합니다. 홈에서는 배정·승인·완료 처리하지 않습니다."],
    ["진행할 수 없을 때", "로그인이 필요한 업무는 로그인 후 이용하세요. 메뉴나 실행 권한이 없으면 소속·역할을 확인하세요. 일반 문의는 도움말, 화면 명세는 ‘화면 설계’에서 확인할 수 있습니다."],
  ];
  return <>
    <aside className="fixed right-3 top-[9.5rem] z-[950] w-[calc(100vw-1.5rem)] max-w-[23rem] sm:right-5 lg:right-8" data-home-work-guide="">
      <div className="mb-2 flex justify-end gap-2">
        <button type="button" aria-expanded={open} aria-controls="home-work-guide-content" className="rounded-full border border-blue-800 bg-white px-4 py-3 text-sm font-bold text-blue-950 shadow" onClick={() => setOpen(!open)}>{en ? "Work guide" : "업무 길잡이"}</button>
      </div>
      {open && <section id="home-work-guide-content" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <header className="flex items-center justify-between bg-[#052b57] px-4 py-3 text-white"><h2 className="font-bold">{en ? "How to use Home" : "홈 이용 길잡이"}</h2><button aria-label={en ? "Collapse guide" : "길잡이 접기"} onClick={() => setOpen(false)}>−</button></header>
        <div className="max-h-[calc(100dvh-19rem)] overflow-y-auto p-4">
          <p className="mb-3 text-sm text-slate-700">{en ? "Find services and information, then move to the screen where your work is performed." : "필요한 서비스와 정보를 찾고, 업무를 처리할 화면으로 이동하는 곳입니다."}</p>
          {steps.map(([title, body], i) => <details key={title} open={i === 0} className="mb-2 rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-bold text-blue-950">{i + 1}. {title}</summary><p className="mt-2 text-sm leading-6 text-slate-700">{body}</p></details>)}
          <button type="button" data-full-workflow-trigger="" onClick={onOverview} className="mt-3 w-full rounded-lg bg-[#246beb] px-4 py-3 font-bold text-white">{en ? "All workflows" : "전체 업무 보기"}</button>
          <p className="mt-2 text-xs text-slate-500">{en ? "This guide explains usage; it does not mark any task complete." : "길잡이는 사용 방법만 안내하며 업무를 완료 처리하지 않습니다."}</p>
        </div>
      </section>}
    </aside>
  </>;
}
