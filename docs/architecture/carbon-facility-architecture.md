# Carbon Emissions Capture Facility Architecture

## Purpose

Replace the generic factory mock-up with a process-readable CCUS and
carbon-credit MRV facility. The scene is generated from a repeatable source
script and permits only documented process equipment animation.

## Actor

- Facility operator: observes capture, purification, compression, storage, and
  utilization equipment.
- Environmental manager: reviews the MRV/CEMS equipment boundary used to
  support emissions reporting and carbon-credit evidence.
- Engineering team: updates equipment metadata and regenerates the USDA scene.
- Viewer user: navigates with left drag, right drag, and mouse wheel.

## Process

1. Flue gas enters through the induced-draft fan.
2. The baghouse removes particulate matter.
3. The wet scrubber reduces SOx and NOx.
4. The amine absorber separates CO2.
5. The regenerator recovers the solvent.
6. The compressor and molecular-sieve skids purify and compress CO2.
7. The liquefaction unit prepares CO2 for insulated storage.
8. The utilization reactor mineralizes a portion of captured CO2.
9. The CEMS stack and MRV control center collect reporting evidence.

## Equipment contract

- Flue-gas inlet fan and orange inlet duct
- Baghouse particulate collector with four filter banks
- Wet scrubber and dual recirculation pump skid
- Amine CO2 absorber and solvent regenerator columns
- Reboiler heat exchanger
- Clean-gas stack with CEMS analyzer
- Four-stage CO2 compressor
- Three-bed molecular-sieve dehydration unit
- Three-column liquefaction cold box
- Two insulated liquid-CO2 storage vessels
- Renewable-power and electrolyzer utility zone
- CO2 mineralization reactor
- MRV and carbon-credit data center

Each major equipment `Xform` carries `carbon:equipment`, `carbon:status`, and
where relevant capacity, product, standard, or stream metadata.

## Interaction contract

- Left-button drag is translated to middle-button drag for planar camera movement.
- Right-button drag is forwarded as native right drag for camera look.
- Mouse wheel is forwarded for dolly/zoom.
- Browser context menus are suppressed only on the 3D canvas.
- Display-to-stream coordinates account for the cropped source viewport.

## Export contract

- USDA: the authoritative generated scene, including process animation metadata
  and time samples.
- GLB: a portable, baked geometry snapshot generated from the current USDA by
  `export-carbon-facility-glb.mjs`.
- PNG: the latest validated facility frame produced by the Kit startup script.
- MP4: exactly 30 seconds of the visible 3D viewport at 1280 x 720 and 30 fps.
  The browser records WebM, uploads it in 512 KiB ordered chunks to stay below
  reverse-proxy request limits, and the web service converts it to
  H.264/yuv420p with FFmpeg. A final-frame pad and duration trim guarantee a
  30.000-second MP4.
- Only one MP4 export is admitted per viewer at a time. The viewer reports the
  remaining seconds, conversion state, and failure state without restarting the
  Omniverse stream.
- The page attempts the download automatically and also leaves a visible direct
  MP4 download link when browser download policy blocks the automatic action.
- Export endpoints use attachment headers and no-store caching so regenerated
  assets are not confused with older downloads.

## Active viewer lease

- The most recently opened viewer receives the only active lease
  (`Last-opened-wins`).
- Same-browser tabs receive an immediate `BroadcastChannel` activation event.
  Older tabs unload their WebRTC iframe and become inactive.
- All browsers and devices validate the lease with a server heartbeat every
  three seconds. A generation mismatch disables camera controls, reconnect,
  automatic recovery, and MP4 capture in the older page.
- A newly activated page replaces the previous lease and performs one bounded
  stream recovery when needed. The server merges concurrent recovery requests
  and enforces a 90-second global restart cooldown.
- Closing an active page releases only its own matching lease; an older page
  cannot release or reclaim a newer page's generation.

## Animation policy

- The previous carrier translation, turntable rotation, ram reciprocation, and
  robot oscillation are removed.
- The four-second timeline loops while the stream is active.
- Rotating motion is limited to the inlet fan, scrubber pumps, and four-stage
  CO2 compressor rotors.
- Cyan markers indicate captured-CO2 transport through compression and storage
  headers; green markers indicate measured clean-stack flow.
- The facility, storage vessels, structural steel, and camera never animate.
- Every animated prim exposes `carbon:animation`; the parent contract declares
  `carbon:animation = ENABLED`, cycle, and process-only policy.
- The startup script owns play, loop, start, and end behavior so a health
  recovery restart returns the scene to a known animation state.

## Generation and deployment

- Generator: `generate-carbon-facility-scene.mjs`
- Portable exporter: `export-carbon-facility-glb.mjs`
- Generated stage: `carbon_emissions_facility.usda`
- Generated portable model: `carbon_emissions_facility.glb`
- Runtime camera: `/CarbonFacility/Cameras/FacilityOverview`
- Validation frame: `carbon-facility-validation.png`
- Deployment is incremental and does not require a frontend or Kit rebuild.

## Acceptance tests

- Generated USDA contains documented `timeSamples` only below
  `/CarbonFacility/ProcessEquipment/OperationalAnimations`.
- Old generic equipment identifiers are absent.
- Kit logs a successful stage open, eight active lights, the facility camera,
  and a saved validation frame.
- Validation image shows all process zones without grid, axes, or light icons.
- Pointer drag changes the rendered camera frame and wheel changes camera
  distance.
- Stream and web services remain active after the bounded stream restart.
- Kit logs `FACTORY_ANIMATION_ACTIVE loop=4s camera=user-controlled`.
- USDA, GLB, and PNG export endpoints return HTTP 200, the expected media type,
  and a non-empty attachment.
- A completed MP4 export is readable by FFprobe and has a duration of 30 seconds
  within encoder/container tolerance.
