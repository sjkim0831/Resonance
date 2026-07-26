# Omniverse Indoor Daylight Lighting Architecture

## Runtime contract

- Runtime stage and service preflight source:
  `/home/sjkim/OmniverseProjects/woosu_factory_v2.usda`
- Startup controller:
  `/home/sjkim/OmniverseProjects/open_factory_stage.py`
- Streaming settings:
  `my_company.my_editormy_omniverse_app.streaming.kit`

## Lighting model

- Six ceiling `RectLight` prims emit downward along local `-Z`; `rotateX=0`.
- Ceiling fixtures use a neutral industrial white point of 5000 K.
- Ambient daylight uses a 6500 K `DomeLight`.
- A soft 5600 K `DistantLight` supplies directional daylight and readable
  material highlights.
- RTX Real-Time uses ACES tone mapping, fixed camera exposure at ISO 200,
  1/60 second and f/4, DLSS, and two indirect diffuse bounces.
- `/SmartFactory/Cameras/FactoryOverview` is always bound as the streaming
  camera after stage load.
- Grid, axis, light, camera, skeleton, and HUD overlays are hidden in the
  public streaming viewport.

## Observability and self-recovery

- Startup logs the selected preset as `FACTORY_LIGHTING_PRESET`.
- Startup traverses the stage and logs active lights as
  `FACTORY_LIGHTS_ACTIVE`.
- Startup logs `FACTORY_CAMERA_ACTIVE` and writes a server-side validation
  frame to `lighting-validation.png`.
- The systemd preflight checks the same USD file that the runtime opens.
- The service retains bounded automatic restart behavior for process failure.

## Incremental deployment

Only the USD, startup controller, Kit settings, systemd unit, and this design
contract are updated. A full frontend or Kit application build is not required.

## Acceptance criteria

- The USD file parses successfully before deployment.
- Kit reports `FACTORY_STAGE_OPENED True`.
- Kit reports eight active lights: six ceiling panels, one dome, and one
  daylight source.
- Kit reports the `FactoryOverview` camera and produces a non-empty validation
  PNG without editor overlays.
- Signal port 49100 and stream port 47998 listen after the stream-only restart.
- No new RTX, USD parse, or Python startup errors occur.
