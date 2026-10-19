# Version 0.10.0 validation — 19 October 2026

New worlds include eight additional biome types. The roster expands to eleven peoples and eighteen wildlife choices, and Inspect opens individual creature profiles. Prismatic Wildlands seeds eight peoples near suitable habitats. Existing worlds keep their saved terrain and gain the new brushes and inspection controls.

## Verified on this Mac

- Twenty-nine deterministic simulation tests pass, including biome save compatibility, all species, individual selection, habitat survival, pollination, and technology inheritance.
- A separate 41-year Wildlands run grew from 72 to 495 people; all eight peoples survived and reached Bronze or Iron Age.
- JavaScript syntax checks pass.
- Thirty Electron UI smoke checks pass against both source and the packaged Mac app, including the new biome and species brushes, individual inspection by native clicks, Wildlands setup, compact layout, and renderer errors.
- macOS Apple silicon app built and its ZIP checked with `unzip -tq`.
- Windows x64 ZIP built and checked with `unzip -tq`; it has not been run on Windows.

## Deliverables and boundaries

- `dist/mac-arm64/Genesis Grove.app` and `dist/Genesis Grove-0.10.0-arm64-mac.zip` — Apple silicon macOS build.
- `dist/Genesis Grove-0.10.0-win.zip` — Windows x64 archive. Extract the full archive and run `Genesis Grove.exe`.
- Available signing identities are expired or untrusted. The macOS package is unsigned and not notarized. Windows execution, input, audio, import/export, and performance remain unverified on Windows.
- Soldiers fight locally; troop formations and naval invasions are not implemented.
