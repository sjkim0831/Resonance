(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.P006_PROCESS_PREVIEW_CORE = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  function buildRoute({workpieceHeight, stations, anchors, dimensions, clearance = 0.5}) {
    if (!Array.isArray(stations) || stations.length < 2) return {status: 'BLOCKED', reason: 'TWO_STATIONS_REQUIRED', points: []};
    if (!stations.every(s => s && anchors?.[s.assetId] && Array.isArray(s.position) && s.position.length >= 3)) return {status: 'BLOCKED', reason: 'ANCHOR_OR_POSITION_UNRESOLVED', points: []};
    const h = Math.max(0.01, Number(workpieceHeight) || 0.5), floorY = h / 2;
    const rotate = (v, yaw) => { const a = (Number(yaw) || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]; };
    const at = (st, side) => { const anchor = anchors[st.assetId], offset = rotate(anchor[side + 'Offset'], st.rotation?.[1]); return [st.position[0] + offset[0], st.position[1] + anchor.workSurfaceHeight + h / 2, st.position[2] + offset[2]]; };
    const dir = st => rotate(anchors[st.assetId].forwardAxis, st.rotation?.[1]);
    const add = (p, d, n) => [p[0] + d[0] * n, p[1] + d[1] * n, p[2] + d[2] * n];
    const ground = p => [p[0], floorY, p[2]];
    const halfLength = st => Math.max(0, Number(dimensions?.[st.assetId]?.[0]) * (Number(st.scale?.[0]) || 1) / 2 || 0);
    const points = [], first = stations[0], firstInput = at(first, 'input'), firstDir = dir(first);
    const firstOutside = add(firstInput, firstDir, -(halfLength(first) + clearance));
    points.push(ground(firstOutside), firstOutside, firstInput);
    for (let index = 0; index < stations.length - 1; index++) {
      const current = stations[index], next = stations[index + 1], output = at(current, 'output'), input = at(next, 'input');
      const currentOutside = add(output, dir(current), halfLength(current) + clearance);
      const nextOutside = add(input, dir(next), -(halfLength(next) + clearance));
      points.push(output, currentOutside, ground(currentOutside), ground(nextOutside), nextOutside, input);
    }
    const last = stations[stations.length - 1], output = at(last, 'output'), outside = add(output, dir(last), halfLength(last) + clearance);
    points.push(output, outside, ground(outside));
    return {status: 'FUNCTIONAL_DEMO', reason: 'HEIGHT_AND_PROCESS_UNVERIFIED', floorY, points};
  }
  function sampleRoute(points, progress) {
    if (!Array.isArray(points) || points.length < 2) return {status:'BLOCKED', complete:false, position:null};
    const t = Math.max(0, Math.min(1, Number(progress) || 0)), scaled = t * (points.length - 1), index = Math.min(points.length - 2, Math.floor(scaled)), blend = scaled - index;
    const a = points[index], b = points[index + 1];
    return {status:'FUNCTIONAL_DEMO', complete:t >= 1, position:a.map((value, axis) => value + (b[axis] - value) * blend)};
  }
  function playbackGate({preview = false, ready = true, stationCount = 0, pathPointCount = 0} = {}) {
    if (!ready) return {ok:false, reason:'READINESS_GATE'};
    if (!preview && stationCount < 2) return {ok:false, reason:'PROCESS_SEQUENCE_NOT_CONFIGURED'};
    if (pathPointCount < 2) return {ok:false, reason:'WORKPIECE_PATH_NOT_READY'};
    return {ok:true, reason:'READY'};
  }
  return Object.freeze({buildRoute, sampleRoute, playbackGate});
});
