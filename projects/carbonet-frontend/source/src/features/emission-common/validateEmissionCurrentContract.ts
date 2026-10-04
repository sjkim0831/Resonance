export function validateEmissionCurrentContract(projectId:string, completion:any) {
  const c=completion?.currentContract;
  const checks=[
    {id:'CC-01',name:'현재 업무 객체 일치',pass:!!c&&c.project_id===projectId},
    {id:'CC-02',name:'현재 승인 대상 연결',pass:!c?.approval_current||Boolean(c.calculation_current&&c.submission_id&&c.calculation_id&&c.approval_request_id&&c.request_status==='APPROVED')},
    {id:'CC-03',name:'무효·반려 요청의 완료 제외',pass:!['INVALIDATED','REJECTED','PENDING'].includes(c?.request_status)||(!completion.approvalComplete&&!completion.processComplete)},
    {id:'CC-07',name:'프로세스 완료의 현재 승인 필요',pass:!completion?.processComplete||Boolean(c?.approval_current&&completion.approvalComplete)},
  ];
  return {scope:'CURRENT_SNAPSHOT_ONLY',projectId,checkedAt:new Date().toISOString(),identity:c,checks,pass:checks.every(x=>x.pass),relayRequired:['CC-04','CC-05','CC-06','CC-08'],e2eVerified:false};
}
