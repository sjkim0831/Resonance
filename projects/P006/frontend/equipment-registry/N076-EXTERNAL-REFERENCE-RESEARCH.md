# N076 external reference pack — 2026-09-29

## Decision and scope

N076 remains the project's generic **hydraulic deep-drawing press**. No evidence found identifies the installed machine as any particular manufacturer's model. The public references below are candidate design references only; they must not be presented as N076's actual manufacturer/model, certified dimensions, price, or process approval.

Recommended visual reference for a first quality pass: **MATSUKI MAH-500**, because the manufacturer-published page explicitly classifies the family as hydraulic deep-drawing presses and gives a model-specific force, bolster, daylight, and stroke. Keep the existing generic asset identity and process assignment unchanged until a nameplate/manual or explicit product-owner mapping confirms the match.

## Collected public evidence

| Evidence | Source and verified content | Use / limitation |
|---|---|---|
| Manufacturer product page and family photo | [MATSUKI — Hydraulic Deep Drawing Press, MAH series](https://www.matsuki.co.th/products/hydraulic-press-machine-and-hydraulic-system/253-hydraulic-deep-draqing-press-1-000-25-000kn-mah-series). Official page lists MAH family and an overview image. | Primary shape/family reference; not proof that N076 is a Matsuki press. |
| Candidate dimensions | Same page: MAH-500 is listed as 5,000 kN slide force; 2,500 × 1,500 mm bolster; 1,800 mm daylight; 1,400 mm stroke; 100 hp motor. | Candidate scale envelope only. Do not copy into N076's verified fields. Manufacturer states alternatives can be requested. |
| Independent design/features cross-check | [EBR Metal — Hydraulic Deep Drawing Presses](https://www.ebrmetal.com/products/hydraulic-presses/hydraulic-deep-drawing-presses/). Describes welded steel construction, NC controls, custom build, and warns photos are illustrative. | Generic visual cues only; not N076-specific evidence. |
| Alternate manufacturer reference | [ASAI — Hydraulic Press](https://asai-corp.co.jp/englishydraulic/). Lists models for deep drawing/drawing and technical specifications for several series. | Useful comparative geometry/spec reference; not the selected candidate and not an N076 identity match. |
| Existing project geometry | `assets/3d-derived/N076.glb`: 34,276 bytes, 66 nodes, 21 meshes, 392 triangles, no materials, no animation; parts named base_frame, housing, lower_die, moving_platen, ram, tie_rod. | Existing low-detail visualization baseline; known mesh part labels can seed a high-detail rebuild. |
| Existing catalog render | [N076 catalog render](http://172.16.1.232/projects/P006/assets/visual-catalog/images/N076.png), 640 × 480. | Reference render only—not a manufacturer photo and not a specific real press. |

## Evidence still missing

1. Actual N076 nameplate or manufacturer/model identification.
2. Four-view photos of the installed unit and close-up of ram, bolsters, hydraulic unit, control cabinet, safety guarding, and sensors.
3. N076 manual/dimension drawing, verified stroke/daylight/bolster dimensions, rated force, and die-cushion configuration.
4. Manufacturer video or a verified cycle description with timing, interlocks, and feeder/ejector behavior.
5. Source CAD (STEP/IGES/USD) and explicit usage rights for any third-party geometry/media.
6. A vendor quote for acquisition/operating cost. Public list price was not found; **USD cost remains unknown**, not zero.
7. Specific body-panel blank/die data before asserting automotive panel process suitability.

## Proposed modeling and motion breakdown (not yet verified for N076)

Model components: welded frame/uprights, crown, bed/bolster, moving slide/ram, upper/lower die, hydraulic cylinder/power pack and hoses, operator/control cabinet, guarding/light curtain, and optional blank-holder/ejector only if confirmed on the target machine.

Illustrative cycle to be parameterized after source review: blank present → operator/transfer clear → safety interlock satisfied → ram descends → forming dwell → ram returns → formed blank removed. The ram direction is vertical; travel, speeds, dwell, force profile, and material deformation remain unknown. The animation must visually distinguish the machine stroke from any simulated workpiece deformation and must not imply an approved production recipe.

## Integration guardrails

- Keep original USD/GLB untouched; create an evidence-linked revision and retain its source/hash.
- Record source URL, publisher, access date, media type, license/permission status, and the fields supported by each item.
- Mark all Matsuki-derived measurements `REFERENCE_ONLY / UNVERIFIED_FOR_N076`.
- Do not connect this candidate to E096 or alter plan routing based on resemblance alone.
- Promote to `APPROVED` only after actual N076 identity, geometry, motion, and process fit have separate review records.

## Next implementation slice

1. Add this evidence pack as N076's source dossier in Equipment Studio.
2. Add manufacturer page and render links as evidence references; keep the candidate dimensions in a separate comparison card, not N076's verified fields.
3. Build a revised detailed press assembly with separate named ram/slide and die meshes; add controlled vertical stroke and blank state only after the chosen reference is explicitly accepted.
4. Verify visual framing and process output in the browser when the P006 web listener is available.

Current remote web service is unavailable, so this research pack is staged on the project server but Equipment Studio/browser rendering and visual QA are pending service recovery.
