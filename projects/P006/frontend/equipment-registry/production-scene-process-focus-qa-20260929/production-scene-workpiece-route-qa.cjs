const assert = require('node:assert/strict');
const C = require('./product-planner-core.js');
global.window = {};
require('./product-planner-car-demo.js');
const D = global.window.ProductPlannerCarDemo;

const plan = C.carExample();
const runtime = C.createRuntime(plan);
const layout = D.stationLayout(plan, runtime.schedule, 4);
const entries = plan.parts.map(part => ({
  id: part.id,
  part,
  group: { visible: false, position: { x: 0, y: 0, z: 0 } }
}));
const body = entries.find(entry => entry.id === 'body');
const at = time => {
  D.update(entries, { unit: 4, T: {} }, time, new Set(), plan, runtime.schedule, layout);
  return { ...body.group.position, visible: body.group.visible, label: body.flowLabel };
};
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const press = runtime.schedule.tasks.find(task => task.processId === 'body-form');
const weld = runtime.schedule.tasks.find(task => task.processId === 'body-weld');
assert.equal(press.end, weld.start, 'press-to-weld should be a consecutive planned handoff');
const justBefore = at(press.end - 0.001);
const boundary = at(weld.start);
const justAfter = at(weld.start + 0.001);
assert.ok(justBefore.visible && boundary.visible && justAfter.visible, 'body workpiece must remain visible through the handoff');
assert.ok(distance(justBefore, boundary) < 0.05, `position jumped at handoff: ${distance(justBefore, boundary).toFixed(3)}m`);
assert.ok(distance(boundary, justAfter) < 0.05, `position jumped after handoff: ${distance(boundary, justAfter).toFixed(3)}m`);
assert.match(boundary.label, /차체 접합/, 'handoff should identify the active weld operation');
const weldCenter = layout.points.get('body-weld');
const midWeld = at(weld.start + weld.duration * 0.5);
assert.ok(Math.hypot(midWeld.x - weldCenter.x, midWeld.z - weldCenter.z) < 5, 'body should pass through the weld-cell work envelope');
console.log(JSON.stringify({ result: 'PASS', handoffMinute: weld.start, jumpMeters: Number(distance(justBefore, boundary).toFixed(4)), weldMidpoint: { x: Number(midWeld.x.toFixed(2)), z: Number(midWeld.z.toFixed(2)) }, activeOperation: boundary.label }, null, 2));
