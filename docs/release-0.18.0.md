# 0.18.0: Observe mode and living nature

The first UI slice puts the map in the foreground. Worlds open in Observe mode;
click to inspect, drag to pan, and choose a tool category to create. Escape cancels
the brush. The compact dock replaces the permanent creator sidebar and catalog.
Citizen and kingdom inspectors start with a short summary and expandable details.

Nature adds moving rain clouds, thunderstorms with real lightning, droughts,
blizzards and deep-ocean coastal tsunamis. These affect fire, soil, crop growth,
health, roads, homes and buildings according to the [nature rules](nature.md).
Automatic natural events are optional and off by default. Active weather survives
saving/loading, and older worlds receive quiet defaults.

- [Actual Observe screen](images/observe-0.18.0.png)
- [Actual coastal weather screen](images/nature-0.18.0.png)
- [Updated implementation path](video-analysis/README.md)

## Verification

- 106 deterministic simulation tests passed, including eight weather tests.
- JavaScript syntax checks passed.
- Source Electron smoke: 50 checks, zero renderer errors.
- Packaged Mac Electron smoke: 50 checks, zero renderer errors.
- Native input covers Observe click/drag, Escape cancellation, controls without
  paint-through, visible inspectors at 1024×768, at least 80% unobstructed map at
  1366×768, valid/invalid tsunami placement, active weather and save/load.
- Both local Mac arm64 and Windows x64 ZIP builds completed. All 32 packaged
  source files in both archives' applications match the validated workspace;
  packaged metadata reports version 0.18.0 and the expected desktop entry.

Mac packages are unsigned. The Windows ZIP is cross-built; gameplay has not been
tested on Windows. Native platform build results are tracked by the version-tag
workflow, separately from the Mac UI checks above.

This is the first UI and nature slice. Four-kingdom setup and save recovery come
next. Full layer selection, dedicated army/ship inspectors, presentation mode,
fluid simulation, evacuation and later hazards remain on the roadmap.
