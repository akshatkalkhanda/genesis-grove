# Version 0.5.0 validation — 18 October 2026

This update gives every kingdom a distinct banner and territory color, makes each animal species recognizable, adds Stone-to-Steel technology and weapon upgrades, and refreshes the desktop interface.

## Verified on this Mac

- Nineteen deterministic simulation tests pass. New cases cover distinct kingdom colors, a Copper Age transition, save compatibility, and higher damage from an advanced weapon.
- A separate 5,000-step run reached challenge year 313 with 79 living Steel Age kingdoms, 105 towns, and a save that reloaded. The earlier 16,000-step version 0.4 run reached year 1,001; a full 0.5 run was not repeated.
- Syntax checks pass for all source, scripts and tests.
- Twenty-two Electron UI checks pass against both source and packaged macOS app. They include unique kingdom colors, Stone and Steel Age displays, kingdom equipment, native pointer painting, saves, export/import, and compact layout.
- Both release ZIPs pass `unzip -tq`. The macOS and Windows app archives contain the changed application source byte-for-byte and report version 0.5.0. Electron Builder rewrites package metadata inside each archive.
- Screenshots were captured at full, challenge, Steel Age, and compact window sizes. The default world shows three clearly differentiated kingdoms.

Local evidence is in `artifacts/smoke-results.json`, `artifacts/world-desktop.png`, `artifacts/world-challenge.png`, `artifacts/world-steel-age.png`, `artifacts/world-compact.png` and `artifacts/exported-world.json`. These files are ignored by Git.

## Deliverables and boundaries

- `dist/mac-arm64/Genesis Grove.app` and `dist/Genesis Grove-0.5.0-arm64-mac.zip`: Apple silicon macOS build, checked through Electron. No Intel Mac package was built.
- `dist/Genesis Grove-0.5.0-win.zip`: Windows x64 runtime and game packaged successfully. Extract the entire archive, then run `Genesis Grove.exe`. Native execution, input, audio, import/export, and performance on Windows remain unverified.
- Packages are unsigned and macOS is not notarized. Signing credentials are not configured.
- CI definitions for macOS ZIP and Windows NSIS/portable builds exist. The source is published in the public GitHub repository; the large desktop archives are local.
