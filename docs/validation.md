# Version 0.4.0 validation — 18 October 2026

This update adds multiple towns per kingdom, colonist ships and caravans, land sieges, a four-continent challenge map, and kingdom profiles.

## Verified on this Mac

- Seventeen deterministic simulation tests pass. New cases cover a mid-voyage save and invalid crew reference, ship arrival on another island, town capture, and capital conquest.
- A separate 16,000-step run on the new challenge map reached year 1,001, recorded all four milestones, and reloaded its save. The tested seed ended with 56 kingdoms, 129 towns, and 1,199 people.
- Syntax checks pass for all source, scripts and tests.
- Twenty Electron UI checks pass against both source and packaged macOS app. They cover challenge creation, expansion law and profile display, 20× speed, native pointer painting, saves, export/import, and compact layout.
- Both release ZIPs pass `unzip -tq`. The macOS and Windows app archives contain the changed application source byte-for-byte and report version 0.4.0. Electron Builder rewrites package metadata inside each archive.
- Screenshots were captured at full, challenge, and compact window sizes. The challenge screenshot shows four populated landmasses with colored territories.

Local evidence is in `artifacts/smoke-results.json`, `artifacts/world-desktop.png`, `artifacts/world-challenge.png`, `artifacts/world-compact.png` and `artifacts/exported-world.json`. These files are ignored by Git.

## Deliverables and boundaries

- `dist/mac-arm64/Genesis Grove.app` and `dist/Genesis Grove-0.4.0-arm64-mac.zip`: Apple silicon macOS build, checked through Electron. No Intel Mac package was built.
- `dist/Genesis Grove-0.4.0-win.zip`: Windows x64 runtime and game packaged successfully. Extract the entire archive, then run `Genesis Grove.exe`. Native execution, input, audio, import/export, and performance on Windows remain unverified.
- Packages are unsigned and macOS is not notarized. Signing credentials are not configured.
- CI definitions for macOS ZIP and Windows NSIS/portable builds exist. The source is published in the public GitHub repository; the large desktop archives are local.
