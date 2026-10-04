# P006 E096 press + workpiece synchronized process pilot

## Purpose and status

This pilot connects the E096 GLB scene to a single, clearly synthetic workpiece and the product planner's simulation clock. It demonstrates the sequence `feed → press approach → dwell → retract → discharge` for one process step assigned `equipmentModel.assetId = E096`.

```ini
PILOT_STATUS = FUNCTIONAL_DEMO
EQUIPMENT_ASSET = E096
WORKPIECE_MODEL = GENERATED_BOX_PROXY
WORKPIECE_COUNT = 1
PROCESS_TIME_SYNC = SAME_ORIGIN_BROADCAST_CHANNEL
PRODUCT_BOM_OR_AUTOMOTIVE_FIT = UNVERIFIED
MANUFACTURER_STROKE_AND_KINEMATICS = UNVERIFIED
PHYSICAL_CONTACT_AND_FORMING_RESULT = UNVERIFIED
PERSISTENCE_WRITES = NONE
```

## Requirement-to-screen and data mapping

| Requirement | Screen/code | Input → output | Evidence gate |
|---|---|---|---|
| Load actual machine | `product-planner-e096-press-cycle.html` | Production `/3d-derived/E096.glb` → GLTFLoader scene | HTTP/GLB signature; named `bed`, `ram`, `tool` meshes exist |
| Place one workpiece | Same page `createWorkpiece()` | Demo dimensions X 0.18m, Y 0.05m, Z 0.12m → orange BoxGeometry | `bed` world bounds used for surface candidate; route on world +X is a demo assumption |
| Clear process sequence | `applyProgress()` | normalized process progress 0..1 → five named phases and workpiece X position | each transition visible in stage and timeline |
| Drive press candidates | `ram` and `tool` local Z | `bed` top and `tool` world lower bound → candidate travel, clamped to 0.50m | hierarchy +Z maps downward in loaded scene; travel is an animation candidate, not manufacturer stroke |
| Follow plan clock | `product-planner.js` + same-origin `BroadcastChannel` | task `processId`, `equipmentModel.assetId`, start/end, runtime time/state/speed → E096 phase | only task rows explicitly assigned Asset ID E096 are animated |
| Pause/reset | plan runtime broadcasts RUNNING/PAUSED/READY/COMPLETE | process runtime state → frozen or reset scene progress | plan remains the time source; pilot does not edit plan or database |
| Standalone demonstration | pilot page controls | 6–30 seconds, default 8 → one cycle | explicitly labelled demo timing |
| Isolate demo from another tab's running plan | `syncToggle` | disconnect this pilot from same-origin `BroadcastChannel` → independent local cycle | only this view is detached; product plan and other tabs are not stopped or changed |
| Product Planner execution view | `product-planner.html` E096 cycle panel → `?embed=1` same-origin iframe | compact embed hides standalone-only guidance/cards so the press viewport and controls fit together; separate-window link remains available | the planner view does not convert the demo into production evidence |

## Coordinate and motion assumptions

- The work surface candidate is the top Y coordinate of the actual loaded `bed` mesh bounds after the same floor-normalization used by the visual scene.
- The proxy's lower face is placed on that candidate height. Its dimensions and material are generated solely for the demonstration.
- The tool's initial lower Y bound and the proxy top determine a candidate local-Z displacement with a 2mm visual clearance. The calculation requires the GLB's local +Z axis to point mostly downward and clamps the result to 0.50m; otherwise the pilot reports that the alignment could not be calculated.
- `ram` and `tool` move by the same local-Z offset, preserving their own mesh geometry. This is a display rig based on the inspected scene hierarchy, not an approved machine linkage.
- The X-axis feed/discharge route is a screen assumption; no physical conveyor or product port is added.
- For a connected plan task, process progress is normalized over its scheduled start/end interval. One visual cycle represents the whole task interval regardless of order quantity or batch/unit time basis. No production throughput is inferred.

## Operator procedure

1. Open Product Planner → 공정·운송 → 완제품·부품·설비 USD 연결.
2. Assign Asset ID `E096` to the process row whose timeline should drive this pilot, then apply model/time changes.
3. In Product Planner → 실행, use the embedded **설비+작업물 동시 사이클 · E096 소형 프레스** frame. If the planner has no active E096 task, load the model and choose **독립 공정 시연** in the frame. The separate-window link is a fallback.
4. Start **전체 공정 애니메이션** in Product Planner. The embedded pilot loads E096, highlights the assigned process window, and follows its running time. Pause is reflected in the embedded status. After pause, the whole-plan button reads **이어서 재생** and resumes from the saved simulation minute; after completion it offers **처음부터 다시 재생**. Reset publishes READY at minute zero so the embedded press and workpiece return to their initial state.
5. If no linked E096 task is available, use 독립 공정 시연 to view a standalone eight-second cycle. The embedded frame first requires **실제 E096 모델 로드**; it then enables the cycle control.
6. If another tab is broadcasting a running plan and blocks the independent cycle, select **시간표 연결 해제** in this pilot only, then run the eight-second cycle. Select **시간표 연결** to resume receiving plan state. This does not pause or alter the plan in another tab.

## Acceptance evidence

The browser review showed the actual GLTFLoader scene and proxy, E096 assigned to a plan task, full-plan completion, matching pause/completion state in the iframe, and local save/reload restoration. On 2026-09-26, pause at simulation minute 19.8 changed the whole-plan control to **이어서 재생**; resume advanced to minute 22.9 rather than restarting at zero. A subsequent active sample showed the E096 GLB loaded (1/1), the press visible, and a geometry-derived stroke candidate of 0.298m. After reset settled, the plan runtime showed `실행 전`, `0.0 / 255.0분`, the embedded/site cameras all showed `공통 시간 0.0분`, and E096 returned to `작업물 투입` with stroke candidate 0.000m. The start control returned to **전체 공정 애니메이션 재생** and pause was disabled. The viewport was visually inspected in the browser. These are browser-local functional-demo checks, not an authenticated server-DB persistence test or a full physical/production simulation. This pilot does not persist factory layout or machine changes; the demo plan is browser-local.

## Risks and limits

- Product and car component inventory reports no actual passenger-vehicle product model or major-part model. The orange proxy is not a vehicle part.
- A task link to E096 is a user-selected visualization reference. It does not make the small press suitable for automotive panel manufacture.
- Collision-free visual contact with the generated box does not prove forming, pressure, tooling, material, or safe kinematics.
- If BroadcastChannel is unavailable or the pages have different origins, cross-tab synchronization is unavailable; the standalone control remains usable.
- Broadcast messages carry plan runtime metadata to another same-origin tab only. They contain no credentials and are not written to server storage.
- A same-origin running plan intentionally takes precedence over the independent cycle while sync is connected. The pilot now provides an explicit per-view disconnect/reconnect control so a stale or other-tab RUNNING snapshot cannot leave the user without a runnable demo; detaching does not mutate shared plan state.

## Next work card

1. 2026-09-27 read-only audit rechecked the 724-asset inventory and Production model roots: no identified automotive workpiece USD/GLB with verified size/datum was found. Keep the orange box explicitly `FUNCTIONAL_DEMO`; the available RC-Car-CAD chassis/suspension GLB is a static assembly review asset and is not an E096 press workpiece. See `P006-E096-WORKPIECE-ASSET-AUDIT-20260927.json`.
2. Current E096 metadata has no manufacturer/model number or manufacturer stroke/tool-pivot/cycle document. Keep `manufacturerVerified=false` and `kinematicsVerified=false`; do not promote the geometry-derived demo travel to a verified stroke.
3. When the exact press identity and a licensed, identified workpiece USD/GLB with size and datum are supplied, map source USD prims to GLB nodes and replace the proxy without changing its evidence labels prematurely.
4. For broader regression evidence, capture a continuous play → pause → resume → full completion → reset recording across planner + iframe; the current browser check has verified pause-point resume and reset synchronization but did not run the full 255-minute plan to completion in this revision.
5. Only after product and machine evidence is supplied, define operation completion and result state. Do not mark automotive forming or `ANIMATION_VERIFIED` from this pilot.

## Requirements and work log

| Who | What | Where | When | How / output |
|---|---|---|---|---|
| Operator | Assign E096 to a plan process | Product Planner model table | Before playback | Asset ID E096 and apply button |
| Operator | Start full plan with embedded pilot visible | Product Planner execution page | During run | Same-origin iframe receives BroadcastChannel snapshot |
| Pilot | Animate one demo object and machine candidates | E096 stage | During linked process | Scheduled progress mapped to five phases |
| Pilot | Display limits | Status, labels, gate panel | Always | FUNCTIONAL_DEMO and UNVERIFIED badges |

Work time for this incremental implementation: record actual elapsed time after browser verification. Additional storage is the pilot HTML plus small planner/doc changes; no model asset or DB row is created. Additional service cost: $0.
