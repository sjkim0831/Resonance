/* Reusable evidence gate. A missing evidence family fails closed; no inferred PASS. */
module.exports=function validateWorkflowEvidence(e){
 const families=[['CC-01','identityChecks'],['CC-02','bindingChecks'],['CC-03','invalidationChecks'],['CC-04','rejectionChecks'],['CC-05','replayChecks'],['CC-06','authorityChecks'],['CC-07','completionChecks'],['CC-08','actorChecks']];
 const rules=families.map(([id,key])=>({id,status:!Array.isArray(e[key])||!e[key].length?'UNKNOWN':e[key].every(x=>x.pass===true)?'PASS':'FAIL',evidence:e[key]||[]}));
 return {processId:e.processId,projectId:e.projectId,rules,pass:rules.every(r=>r.status==='PASS'),unknown:rules.filter(r=>r.status==='UNKNOWN').length};
};
