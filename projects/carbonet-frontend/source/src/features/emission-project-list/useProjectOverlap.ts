import {useEffect,useState} from 'react';
import {buildLocalizedPath} from '../../lib/navigation/runtime';

type Match={id:string;name:string};
export function useProjectOverlap(start:string,end:string,siteIds:string[]){
 const [state,setState]=useState<{loading:boolean;error:boolean;matches:Match[];truncated:boolean}>({loading:false,error:false,matches:[],truncated:false});
 const key=[...siteIds].sort().join(',');
 useEffect(()=>{
  const abort=new AbortController();
  if(!start||!end||start>end||!key){setState({loading:false,error:false,matches:[],truncated:false});return()=>abort.abort();}
  setState({loading:true,error:false,matches:[],truncated:false});
  const timer=setTimeout(()=>{void(async()=>{
   try{
    const ids=key.split(','),found=new Map<string,Match>();let truncated=false;
    // Bound concurrent requests; each query is tenant/access scoped by the server.
    for(let i=0;i<ids.length;i+=4){
     const results=await Promise.all(ids.slice(i,i+4).map(async siteId=>{
      const query=new URLSearchParams({siteId,periodFrom:start,periodTo:end,pageSize:'20'});
      const r=await fetch(buildLocalizedPath('/home/api/emission-project-list-v1','/en/home/api/emission-project-list-v1')+'?'+query,{credentials:'include',signal:abort.signal});
      const body=await r.json();if(!r.ok||!Array.isArray(body.items))throw Error('OVERLAP_LOOKUP_FAILED');return body;
     }));
     for(const body of results){truncated ||= body.totalCount>body.items.length;for(const row of body.items)found.set(row.id,{id:row.id,name:row.name});}
    }
    if(!abort.signal.aborted)setState({loading:false,error:false,matches:[...found.values()],truncated});
   }catch{if(!abort.signal.aborted)setState({loading:false,error:true,matches:[],truncated:false});}
  })();},350);
  return()=>{clearTimeout(timer);abort.abort();};
 },[start,end,key]);
 return state;
}
