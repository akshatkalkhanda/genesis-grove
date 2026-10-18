# Version 0.3.0 validation — 18 October 2026

This release adds the 100-kingdom challenge, autonomous diplomacy, optional rebellions, and colored land territories.

## Verified on this Mac

- Fifteen deterministic simulation tests pass, including a 100-kingdom start, year-100 milestone, challenge save roundtrip, old-save defaults, invalid-law rejection, and an enabled rebellion splitting a town.
- A separate 16,000-step run reached year 1,001 with all four survival milestones recorded and 46 of the original 100 kingdoms alive for the tested seed.
- Syntax checks pass for all source, scripts and tests.
- Nineteen Electron UI checks pass against the source and packaged macOS app. They cover the challenge setup, survival display, world-law toggle, 20× speed, native pointer painting, saves, export/import, and compact layout.
- Both release ZIPs pass `unzip -tq`. The macOS and Windows app archives contain source files byte-for-byte equal to the working directory and report version 0.3.0.
- Screenshots were captured at full, challenge, and compact window sizes. The compact layout hides the statistics sidebar to leave room for the map; the Kingdoms button remains available in the header.

Local evidence is in `artifacts/smoke-results.json`, `artifacts/world-desktop.png`, `artifacts/world-challenge.png`, `artifacts/world-compact.png` and `artifacts/exported-world.json`. These files are ignored by Git.

## Deliverables and boundaries

- `dist/mac-arm64/Genesis Grove.app` and `dist/Genesis Grove-0.3.0-arm64-mac.zip`: Apple silicon macOS build, checked through Electron. No Intel Mac package was built.
- `dist/Genesis Grove-0.3.0-win.zip`: Windows x64 runtime and game packaged successfully. Extract the entire archive, then run `Genesis Grove.exe`. Native execution, input, audio, import/export and performance on Windows remain unverified.
- Packages are unsigned and macOS is not notarized. Signing credentials are not configured.
- CI definitions for macOS ZIP and Windows NSIS/portable builds exist. The source is published in the public GitHub repository; the large desktop archives are local.
