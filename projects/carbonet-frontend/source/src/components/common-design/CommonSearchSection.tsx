import {type ReactNode,useId,useLayoutEffect,useRef,useState} from 'react';
import './commonSearchSection.css';
import contract from './commonSearchContract.json';

/** Layout only: each page retains its existing values, handlers and API contract. */
export function CommonSearchSection({basic,advanced,actions,children}:{basic:ReactNode;advanced?:ReactNode;actions?:ReactNode;children?:ReactNode}){
 const id=useId(),ref=useRef<HTMLDivElement>(null),[open,setOpen]=useState(false),[summary,setSummary]=useState<string[]>([]);
 const en=location.pathname.startsWith('/en/');
 const publicPage=!/^\/(?:en\/)?admin(?:\/|$)/.test(location.pathname);
 function refresh(){
  const values=Array.from(ref.current?.querySelectorAll<HTMLInputElement|HTMLSelectElement>('input,select')||[]).filter(x=>x.type!=='hidden'&&x.value&&(!['checkbox','radio'].includes(x.type)||(x as HTMLInputElement).checked)).map(x=>{
   const labelNode=x.labels?.[0]||x.closest('.ccus-search-field')?.querySelector('label,span');
   const copy=labelNode?.cloneNode(true) as HTMLElement|undefined;copy?.querySelectorAll('input,select,option,button').forEach(n=>n.remove());
   const label=copy?.textContent?.trim()||x.getAttribute('aria-label')||x.getAttribute('placeholder')||'';
   const value=x.tagName==='SELECT'?(x as HTMLSelectElement).selectedOptions[0]?.textContent||x.value:x.value;
   return `${label.split('\n')[0].slice(0,32)}: ${value}`;
  });setSummary(old=>JSON.stringify(old)===JSON.stringify(values)?old:values);
 }
 useLayoutEffect(refresh);
 return <section className={`ccus-search-c${publicPage?' ccus-search-unified-panel':''}`} data-common-component={contract.id} data-help-id={contract.id} data-design-version={contract.version}>
  <div className="ccus-search-basic"><div className="ccus-search-basic-fields">{basic}</div>{!publicPage&&<div className="ccus-search-actions">{actions}</div>}</div>
  {advanced&&<><button className="ccus-search-toggle" type="button" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(v=>!v)}>{open?'▾':'▸'} {en?'Advanced search':'상세 검색'}{summary.length?` · ${summary.length}`:''}</button><div id={id} className="ccus-search-advanced" hidden={!open} ref={ref} onChangeCapture={()=>requestAnimationFrame(refresh)} onInvalidCapture={()=>setOpen(true)}>{advanced}</div>{summary.length>0&&<div className="ccus-search-chips" aria-label={en?'Entered advanced filters':'입력한 상세 조건'}>{summary.map((s,i)=><span key={i}>{s}</span>)}</div>}</>}
  {publicPage&&actions&&<div className="ccus-search-actions">{actions}</div>}
  {children}
 </section>;
}
