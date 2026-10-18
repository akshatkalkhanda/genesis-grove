# Version 0.8.0 validation — 18 October 2026

The app now opens on a main menu. World setup previews the map from the chosen seed and landscape, allows simulation rules to be chosen, and creates a paused world. Empty ocean can be painted before time starts. Tool categories use a two-row layout that fits the compact sidebar.

## Verified on this Mac

- Twenty-two deterministic simulation tests pass, including recruitment and supply costs, civilian combat exclusion, deposit exhaustion, trade delivery, and save compatibility.
- JavaScript syntax checks pass.
- Twenty-five Electron UI smoke checks pass against both source and the packaged Mac app, including main menu, seed preview matching the created map, paused empty-world painting, non-overlapping category tabs at desktop and compact sizes, saves, import/export, diplomacy, challenge mode, and renderer errors.
- The 100-kingdom challenge remained active through 5,000 simulation steps in a development run, with surviving civilizations across Stone, Copper, Bronze, Iron, and Steel ages.
- macOS Apple silicon app built and its ZIP checked with `unzip -tq`.
- Windows x64 ZIP built and checked with `unzip -tq`; it has not been run on Windows.

## Deliverables and boundaries

- `dist/mac-arm64/Genesis Grove.app` and `dist/Genesis Grove-0.8.0-arm64-mac.zip` — Apple silicon macOS build.
- `dist/Genesis Grove-0.8.0-win.zip` — Windows x64 archive. Extract the full archive and run `Genesis Grove.exe`.
- Available signing identities are expired or untrusted. The macOS package is unsigned and not notarized. Windows execution, input, audio, import/export, and performance remain unverified on Windows.
- Soldiers fight locally; troop formations and naval invasions are not implemented.
