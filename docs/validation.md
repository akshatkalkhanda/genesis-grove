# Initial build validation — 17 October 2026

This is a playable first version, not feature parity with WorldBox.

## Verified on this Mac

- Ten deterministic simulation tests pass: seed reproducibility and evolution, autonomous population growth and housing, terrain boundaries, land-only spawning and flooding, fire/rain/meteor interactions, fire spread and burnout, blessing and erasing, exact save restoration and subsequent evolution, corrupt-save rejection, population limits.
- Syntax checks pass for all source, scripts and tests.
- Fifteen Electron UI checks pass against the final macOS package's `app.asar` entry point. They cover startup, pause, native pointer meteor input, zoom/fit, device save, blank-world creation, native pointer terrain painting, load, inspect, help, actual file download/export, invalid import preserving the current world, valid import, compact layout and absence of renderer errors.
- Screenshots captured and inspected at full and compact window sizes. The compact layout hides the statistics sidebar to leave room for the map.
- Development server returns HTTP 200 for the game and JavaScript, and HTTP 403 for a request outside the allowed static roots.
- Final macOS and Windows package source/assets match the working source by SHA-256 comparison.
- The actual packaged macOS application was opened successfully and its live controls, world and native menu were observed through the macOS accessibility tree.

Local evidence is in `artifacts/smoke-results.json`, `artifacts/world-desktop.png`, `artifacts/world-compact.png` and `artifacts/exported-world.json`. These files are ignored by Git.

## Deliverables and boundaries

- `dist/mac-arm64/Genesis Grove.app` and `dist/Genesis Grove-0.1.0-arm64-mac.zip`: Apple silicon macOS build, locally exercised. No Intel Mac package was built.
- `dist/Genesis Grove-0.1.0-win.zip`: Windows x64 runtime and game packaged successfully. Extract the entire archive, then run `Genesis Grove.exe`. Native execution, input, audio, import/export and performance on Windows remain unverified.
- Packages are unsigned and macOS is not notarized. Signing credentials are not configured.
- CI definitions for macOS ZIP and Windows NSIS/portable builds exist but were not run on GitHub. Nothing was published or uploaded.
- Browser HTTP delivery was checked locally; a full separate-browser playthrough and a Windows browser playthrough were not performed.
