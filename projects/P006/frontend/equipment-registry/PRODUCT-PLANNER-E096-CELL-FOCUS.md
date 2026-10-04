# Product Planner E096 Single-Cell View

Date: 2026-09-28  
Status: implementation ready for Production visual verification  
Scope: E096 real GLB + one explicitly synthetic workpiece proxy; no process evidence or manufacturing approval changes.

## User workflow

1. Open Product Planner → execution/run section.
2. In the E096 embedded view, load the press, or start the E096-linked plan.
3. The view fits the full machine, proxy workpiece, and proxy feed/discharge span into the viewport. `설비+작업물 맞춤` restores this framing after camera navigation.
4. Read the stage badge and five-step strip: feed → ram/tool down → dwell → retract → outfeed.
5. Drag to orbit, Alt+drag to pan, wheel to zoom.

## Coordinate/framing design

- All bounds use the loaded E096 GLB after its existing floor-normalization and the visible workpiece proxy.
- The fit region also unions the feed and discharge endpoints so the part does not disappear at either end of the demo motion.
- Camera distance is derived from the bounds' bounding sphere, actual stage aspect, and perspective field-of-view. No model scale or source geometry is changed.
- In the overall plan viewport, a process focus includes its actual equipment bounds and currently visible related part/demo-module bounds. Auto-follow uses the same bound union; overview bounds remain available.
- Camera pan translates the look-at target in camera-right and camera-up directions, scaled by world-units per pixel. It does not alter equipment transforms.

## Evidence limits

`E096.glb` is the actual displayed machine model. The orange 0.18 × 0.05 × 0.12 m box, feed/discharge axis, candidate bed contact, and ram stroke remain `FUNCTIONAL_DEMO` assumptions. No automotive part GLB, manufacturer kinematics, tooling, contact, throughput, or production fit is asserted. Equipment evidence, process relationship, and animation approval fields are untouched.

## Change map

| Requirement | Implementation | Verification |
|---|---|---|
| One-cell framing | E096 page `fitCell()` includes GLB, proxy, route endpoints | Production browser required |
| Process readable | Embedded five-step phase strip and live phase badge | Production browser required |
| Equipment identifiable | `E096 · 소형 프레스` and `bed / ram / tool` existing labels | Production browser required |
| View navigation | orbit drag, Alt-drag pan, wheel zoom, frame-reset button | Production browser required |
| Process focus includes workpiece | `processCellBounds()` unions process machine + visible linked part entities | Product Planner run browser required |
| Preserve dimensions/evidence | No GLB edits or process-state promotion | Source review |

## Next 업무 card

Verify on the deployed Product Planner execution screen: load E096 → confirm entire press and orange proxy are visibly large enough → play/pause/reset → click fit reset → orbit, Alt-pan, zoom → ensure the five phases remain readable. If the camera viewport is too short in the host layout, adjust only the iframe/stage height; do not shrink or alter the model. Then proceed to a second process cell only after this single-cell view is usable.
