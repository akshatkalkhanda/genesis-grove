# Version 0.11.0 validation — 19 October 2026

Close zoom and Follow expose named creatures with XP, levels, health growth, strength, intelligence, traits, and parent records. Kingdoms make supply-aware decisions and use obstacle-aware routes. Towns build productive farms, windmills, armories, and training camps. A separate lighting clock prevents rapid day/night flashing at high speed.

## Verified on this Mac

- Thirty-nine deterministic tests pass, including age/XP growth, old-save migration, restored-world evolution, A* detours, kingdom strategy, harvests, training, forging, and lighting speed limits.
- A 21-year Wildlands fixture contains all four new building types and creatures with health above 100; it is imported and rendered during the desktop smoke test.
- JavaScript syntax checks pass.
- Thirty-three Electron UI smoke checks pass against both source and the packaged Mac app, including close zoom, Follow, expanded profiles, lighting controls, developed towns, compact layout, and renderer errors.
- macOS Apple silicon app built and its ZIP checked with `unzip -tq`.
- Windows x64 ZIP built and checked with `unzip -tq`; it has not been run on Windows.

## Deliverables and boundaries

- `dist/mac-arm64/Genesis Grove.app` and `dist/Genesis Grove-0.11.0-arm64-mac.zip` — Apple silicon macOS build.
- `dist/Genesis Grove-0.11.0-win.zip` — Windows x64 archive. Extract the full archive and run `Genesis Grove.exe`.
- Packaging commands explicitly disable automatic publishing. CI platform jobs run independently, avoiding the missing publishing-token failure seen on the v0.10.0 tag.
- Available signing identities are expired or untrusted. The macOS package is unsigned and not notarized. Windows execution, input, audio, import/export, and performance remain unverified on Windows.
- Soldiers fight locally; troop formations and naval invasions are not implemented.
