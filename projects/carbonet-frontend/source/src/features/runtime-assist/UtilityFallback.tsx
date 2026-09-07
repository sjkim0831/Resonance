import { useState } from 'react';

export function UtilityFallback({kind,error=false}:{kind:'work'|'design'|'help';error?:boolean}) {
  const [notice,setNotice]=useState('');
  const labels=kind==='work'?['업무 길잡이','QA 업무']:kind==='design'?['화면 설계']:['도움말'];
  return <>{labels.map(label=><button key={label} type="button" onClick={()=>setNotice(label)} className={`fixed z-[1280] min-h-12 rounded-full border border-blue-800 bg-white px-4 font-bold text-blue-900 shadow-lg ${label==='QA 업무'?'bottom-20 left-3':label==='화면 설계'?'bottom-20 right-4':label==='도움말'?'bottom-5 left-3':'right-4 top-[9.5rem]'}`}>{label}</button>)}
    {notice&&<section role="status" className="fixed bottom-36 right-4 z-[1290] w-[min(24rem,calc(100vw-2rem))] rounded-xl border bg-white p-4 shadow-xl"><strong>{notice}</strong><p className="my-3 text-sm">{error?'안내 기능을 불러오지 못했습니다. 입력 중인 내용을 보존한 뒤 화면을 새로고침해 주세요.':'안내 기능을 불러오는 중입니다. 준비되면 기존 버튼으로 자동 연결됩니다.'}</p><button className="min-h-11 border px-3" type="button" onClick={()=>setNotice('')}>닫기</button></section>}
  </>;
}
