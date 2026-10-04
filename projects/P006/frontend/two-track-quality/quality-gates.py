"""Deterministic, evidence-gated quality policy. Does not mutate source registries."""
STATES=['USD_CONNECTED','GEOMETRY_VERIFIED','PHYSICAL_VERIFIED','FUNCTION_VERIFIED','PORT_VERIFIED','ASSET_READY']
REQUIRED={
 'GEOMETRY_VERIFIED':['geometryTechnical','assetKindAndShapeReview','geometrySource'],
 'PHYSICAL_VERIFIED':['dimensions','placementBasis','hierarchy','physics'],
 'FUNCTION_VERIFIED':['motionExecution','workpieceInterface','processExecution'],
 'PORT_VERIFIED':['portCompatibility'],
 'ASSET_READY':['saveRestore','qualitySignoff']}
def accepted(e,sha,dependencies):
 return bool(e and e.get('status')=='PASS' and e.get('source') and e.get('artifact') and e.get('reviewer') and e.get('timestamp') and e.get('subjectSha256')==sha and e.get('dependencySignature')==dependencies and e.get('scope') in ['APPROVED_DESIGN','MEASURED_EQUIPMENT','TECHNICAL_USD_TEST'])
def evaluate(asset):
 evidence=asset.get('evidence',{});state='USD_CONNECTED';passed=['USD_CONNECTED'];missing=[]
 for target in STATES[1:]:
  missing=[key for key in REQUIRED[target] if not accepted(evidence.get(key),asset['sha256'],asset['dependencySignature']) or (key!='geometryTechnical' and evidence[key].get('scope')=='TECHNICAL_USD_TEST')]
  if missing:break
  state=target;passed.append(target)
 real=evidence.get('realConnection',{})
 realok=all(real.get(k) is True for k in ['identityVerified','readOnlyConnection','tagRead','observedValueChange','timestampsVerified','eventCorrelation','repeatedObservation']) and real.get('mode')=='REAL' and accepted(real,asset['sha256'],asset['dependencySignature']) and real.get('scope')=='MEASURED_EQUIPMENT'
 return {'state':state,'passedStages':passed,'nextStage':STATES[len(passed)] if len(passed)<len(STATES) else None,'missingEvidence':missing,'REAL_VERIFIED':bool(realok)}
