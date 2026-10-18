# Version 0.2.0 validation — 18 October 2026

This is a playable original sandbox with race traits and player controlled kingdom diplomacy.

## Verified on this Mac

- Twelve deterministic simulation tests pass, including distinct race economies and growth, kingdom combat and relations, legacy save migration, and corrupt-save rejection.
- Syntax checks pass for all source, scripts and tests.
- Sixteen Electron UI checks pass against the packaged macOS app. They cover startup, pause, native pointer painting, zoom/fit, saves, new-world creation, load, inspect, help, changing diplomacy, export/import, compact layout and absence of renderer errors.
- The packaged macOS and Windows app archives contain the same game source files as the working directory and report version 0.2.0.
- Screenshots were captured at full and compact window sizes. The compact layout hides the statistics sidebar to leave room for the map; the Kingdoms button remains available in the header.

Local evidence is in `artifacts/smoke-results.json`, `artifacts/world-desktop.png`, `artifacts/world-compact.png` and `artifacts/exported-world.json`. These files are ignored by Git.

## Deliverables and boundaries

- `dist/mac-arm64/Genesis Grove.app` and `dist/Genesis Grove-0.2.0-arm64-mac.zip`: Apple silicon macOS build, checked through Electron. No Intel Mac package was built.
- `dist/Genesis Grove-0.2.0-win.zip`: Windows x64 runtime and game packaged successfully. Extract the entire archive, then run `Genesis Grove.exe`. Native execution, input, audio, import/export and performance on Windows remain unverified.
- Packages are unsigned and macOS is not notarized. Signing credentials are not configured.
- CI definitions for macOS ZIP and Windows NSIS/portable builds exist. The source is published in the public GitHub repository; the large desktop archives are local.
