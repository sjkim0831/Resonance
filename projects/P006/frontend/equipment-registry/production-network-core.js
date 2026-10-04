(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.P006NetworkCore = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const SCHEMA = 'P006_NETWORK_V1';
  const RUNTIME_SCHEMA = 'P006_NETWORK_RUNTIME_V1';
  const PART_A = 'DEMO_PART_A';
  const PART_B = 'DEMO_PART_B';
  const PRODUCT = 'DEMO_TWO_PART_ASSEMBLY';
  const EVENT_TYPES = ['PRODUCE_A', 'PRODUCE_B', 'SHIP_A', 'RECEIVE_A', 'SHIP_B', 'RECEIVE_B', 'ASSEMBLE', 'INSPECT_PASS', 'DISPATCH'];
  const PRODUCT_CANDIDATES = [
    { id: PRODUCT, name: '2부품 나사 체결 시연', status: 'FUNCTIONAL_DEMO', assets: ['E001', 'A410', 'A203', 'E122', 'E053'], bom: [{ partId: PART_A, quantity: 1 }, { partId: PART_B, quantity: 1 }], missing: ['실제 부품 A/B 모델', '제품 도면·BOM 원본', 'E122 가동부 축·피벗·체결 순서', '체결 토크·검사 기준', '공장 간 이송 장치/규격'], demoScope: '두 공장의 생산 완료 이벤트, 운송·입고, BOM 대기, 체결 완료 이벤트, 검사·출고 데이터 흐름' },
    { id: 'HARNESS_CANDIDATE', name: '선재 하니스 조립 후보', status: 'EVIDENCE_CANDIDATE', assets: ['A195', 'A203', 'E053'], bom: [], missing: ['실제 케이블·커넥터 제품 모델', '제품별 배선 도면·BOM', '원본 가동부와 동작 근거'], demoScope: '설비 후보 표시만 가능' },
    { id: 'CAST_TRIM_CANDIDATE', name: '주조품 트리밍·검사 후보', status: 'EVIDENCE_CANDIDATE', assets: ['E001', 'E034', 'E053'], bom: [], missing: ['트리밍 대상 주조품', '제거 전후 형상', '검사 기준'], demoScope: '단일 부품 공정 후보 표시만 가능' },
  ];
  const copy = x => JSON.parse(JSON.stringify(x));
  const uuid = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '00000000-0000-4000-8000-' + Math.random().toString(16).slice(2, 14).padEnd(12, '0');
  function makeDesign(factoryLayouts) {
    if (!Array.isArray(factoryLayouts) || factoryLayouts.length !== 3) throw Error('Pilot에는 저장된 공장 3개가 필요합니다.');
    const roles = ['A', 'B', 'C'];
    const positions = [[-8, 0, -4], [-8, 0, 4], [7, 0, 0]];
    const factories = factoryLayouts.map((layout, index) => ({ factoryInstanceId: uuid(), layoutId: layout.id, layoutVersion: layout.version, name: `공장 ${roles[index]}`, mapPosition: positions[index], locked: false, status: 'DESIGN_CANDIDATE' }));
    return { schema: SCHEMA, evidenceStatus: 'FUNCTIONAL_DEMO', factories, routes: [
      { routeId: uuid(), fromFactoryInstanceId: factories[0].factoryInstanceId, toFactoryInstanceId: factories[2].factoryInstanceId, partId: PART_A, transportSeconds: 2, capacity: 1, status: 'DESIGN_CANDIDATE' },
      { routeId: uuid(), fromFactoryInstanceId: factories[1].factoryInstanceId, toFactoryInstanceId: factories[2].factoryInstanceId, partId: PART_B, transportSeconds: 2, capacity: 1, status: 'DESIGN_CANDIDATE' },
    ], product: { productId: PRODUCT, name: PRODUCT_CANDIDATES[0].name, bom: copy(PRODUCT_CANDIDATES[0].bom), evidenceStatus: 'FUNCTIONAL_DEMO', actualProductModel: null, mechanicalAnimationVerified: false }, camera: { x: 0, y: 0, zoom: 0.65 }, selectedFactoryId: null, layoutStatus: 'DRAFT' };
  }
  function initialRuntime(networkId) {
    return { schema: RUNTIME_SCHEMA, networkId, runId: uuid(), state: 'READY', step: 0, events: [], inventory: { A: { [PART_A]: 0 }, B: { [PART_B]: 0 }, C: { [PART_A]: 0, [PART_B]: 0, ASSEMBLY: 0, APPROVED: 0 } }, workpieces: {}, bufferCapacity: { C: 2 }, processedEventIds: [], factoryStates: { A: 'IDLE', B: 'IDLE', C: 'WAITING_PARTS' }, finishedCount: 0, mode: 'FUNCTIONAL_DEMO' };
  }
  function applyEvent(runtime, event) {
    if (runtime.processedEventIds.includes(event.id)) return { applied: false, reason: 'DUPLICATE_EVENT', runtime: copy(runtime) };
    if (event.type !== EVENT_TYPES[runtime.step]) {
      if (event.type === 'ASSEMBLE' && (runtime.inventory.C[PART_A] < 1 || runtime.inventory.C[PART_B] < 1)) return { applied: false, reason: 'BOM_INCOMPLETE', runtime: copy(runtime) };
      return { applied: false, reason: 'PROCESS_ORDER_BLOCKED', runtime: copy(runtime) };
    }
    const next = copy(runtime), a = next.inventory.A, b = next.inventory.B, c = next.inventory.C;
    next.workpieces ||= {}; next.bufferCapacity ||= { C: 2 };
    const lot = suffix => `${next.runId}:${suffix}`;
    const piece = suffix => next.workpieces[lot(suffix)];
    const fail = reason => ({ applied: false, reason, runtime: copy(runtime) });
    switch (event.type) {
      case 'PRODUCE_A': a[PART_A]++; next.workpieces[lot('A')] = { lotId: lot('A'), partId: PART_A, factory: 'A', status: 'OUTPUT_WAIT', inspectionStatus: 'UNVERIFIED', actualModel: null }; next.factoryStates.A = 'COMPLETE'; break;
      case 'PRODUCE_B': b[PART_B]++; next.workpieces[lot('B')] = { lotId: lot('B'), partId: PART_B, factory: 'B', status: 'OUTPUT_WAIT', inspectionStatus: 'UNVERIFIED', actualModel: null }; next.factoryStates.B = 'COMPLETE'; break;
      case 'SHIP_A': if (a[PART_A] < 1 || !piece('A')) return fail('PART_A_NOT_AVAILABLE'); a[PART_A]--; piece('A').status = 'IN_TRANSIT'; next.factoryStates.A = 'IN_TRANSIT'; break;
      case 'RECEIVE_A': if (piece('A')?.status !== 'IN_TRANSIT') return fail('PART_A_NOT_SHIPPED'); if (c[PART_A] + c[PART_B] >= next.bufferCapacity.C) return fail('RECEIVING_BUFFER_FULL'); c[PART_A]++; piece('A').factory = 'C'; piece('A').status = 'RECEIVED'; next.factoryStates.A = 'DELIVERED'; next.factoryStates.C = 'WAITING_PART_B'; break;
      case 'SHIP_B': if (b[PART_B] < 1 || !piece('B')) return fail('PART_B_NOT_AVAILABLE'); b[PART_B]--; piece('B').status = 'IN_TRANSIT'; next.factoryStates.B = 'IN_TRANSIT'; break;
      case 'RECEIVE_B': if (piece('B')?.status !== 'IN_TRANSIT') return fail('PART_B_NOT_SHIPPED'); if (c[PART_A] + c[PART_B] >= next.bufferCapacity.C) return fail('RECEIVING_BUFFER_FULL'); c[PART_B]++; piece('B').factory = 'C'; piece('B').status = 'RECEIVED'; next.factoryStates.B = 'DELIVERED'; next.factoryStates.C = 'READY_TO_ASSEMBLE'; break;
      case 'ASSEMBLE': if (c[PART_A] < 1 || c[PART_B] < 1 || piece('A')?.status !== 'RECEIVED' || piece('B')?.status !== 'RECEIVED') return fail('BOM_INCOMPLETE'); if (event.stationReady !== true) return fail('ASSEMBLY_STATION_NOT_READY'); c[PART_A]--; c[PART_B]--; c.ASSEMBLY++; piece('A').status = 'CONSUMED'; piece('B').status = 'CONSUMED'; next.workpieces[lot('PRODUCT')] = { lotId: lot('PRODUCT'), productId: PRODUCT, factory: 'C', status: 'ASSEMBLED', inspectionStatus: 'PENDING', actualModel: null, componentLotIds: [lot('A'), lot('B')] }; next.factoryStates.C = 'ASSEMBLING'; break;
      case 'INSPECT_PASS': if (c.ASSEMBLY < 1 || piece('PRODUCT')?.status !== 'ASSEMBLED') return fail('ASSEMBLY_NOT_COMPLETE'); c.ASSEMBLY--; c.APPROVED++; piece('PRODUCT').status = 'APPROVED'; piece('PRODUCT').inspectionStatus = 'DEMO_PASS'; next.factoryStates.C = 'INSPECTED_PASS'; break;
      case 'DISPATCH': if (c.APPROVED < 1 || piece('PRODUCT')?.status !== 'APPROVED') return fail('INSPECTION_NOT_COMPLETE'); c.APPROVED--; next.finishedCount++; piece('PRODUCT').status = 'DISPATCHED'; next.factoryStates.C = 'OUTPUT_COMPLETE'; break;
      default: return fail('UNSUPPORTED_EVENT');
    }
    next.processedEventIds.push(event.id);
    next.events.push({ id: event.id, type: event.type, input: event.input || null, output: event.output || null, at: event.at || new Date().toISOString(), evidenceStatus: 'FUNCTIONAL_DEMO' });
    next.step = Math.max(next.step, EVENT_TYPES.indexOf(event.type) + 1);
    if (next.step === EVENT_TYPES.length) next.state = 'COMPLETE';
    return { applied: true, runtime: next };
  }
  function nextEvent(runtime) {
    if (runtime.step >= EVENT_TYPES.length) return null;
    const type = EVENT_TYPES[runtime.step];
    return { id: `${runtime.runId}:${type}`, type, stationReady: type === 'ASSEMBLE', input: type === 'ASSEMBLE' ? { [PART_A]: 1, [PART_B]: 1, stationReadyEvidence: 'DEMO_ASSUMPTION' } : null, output: type === 'DISPATCH' ? { [PRODUCT]: 1 } : null };
  }
  function advance(runtime) {
    const event = nextEvent(runtime);
    return event ? applyEvent(runtime, event) : { applied: false, reason: 'RUN_COMPLETE', runtime: copy(runtime) };
  }
  function layoutDocument(name, extraSettings) {
    return { id: uuid(), name, version: 0, settings: { unit: 'm', coordinateSystem: 'RIGHT_HANDED_Y_UP', grid: 0.5, snap: true, rotationSnap: 15, zoom: 20, ...extraSettings }, instances: [], relationships: [] };
  }
  return { SCHEMA, RUNTIME_SCHEMA, PART_A, PART_B, PRODUCT, PRODUCT_CANDIDATES, EVENT_TYPES, makeDesign, initialRuntime, applyEvent, nextEvent, advance, layoutDocument, uuid };
});
