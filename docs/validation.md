# Version 0.9.0 validation — 18 October 2026

Kingdoms now hold finite claims around their towns, leaving wilderness unclaimed. Home garrisons march toward a shared reachable enemy town, appear as banner markers, and can capture it by siege. Selecting a kingdom shows its supplies, towns, army, allies, and enemies.

## Verified on this Mac

- Twenty-three deterministic simulation tests pass, including finite claims, group marching and capture, overseas targeting limits, recruitment, trade delivery, and save compatibility.
- JavaScript syntax checks pass.
- Twenty-six Electron UI smoke checks pass against both source and the packaged Mac app, including the selected-kingdom card, main menu, map preview, painting, saves, import/export, diplomacy, challenge mode, compact layout, and renderer errors.
- The 100-kingdom challenge remained active through 5,000 simulation steps in a development run, with surviving civilizations across Stone, Copper, Bronze, Iron, and Steel ages.
- macOS Apple silicon app built and its ZIP checked with `unzip -tq`.
- Windows x64 ZIP built and checked with `unzip -tq`; it has not been run on Windows.

## Deliverables and boundaries

- `dist/mac-arm64/Genesis Grove.app` and `dist/Genesis Grove-0.9.0-arm64-mac.zip` — Apple silicon macOS build.
- `dist/Genesis Grove-0.9.0-win.zip` — Windows x64 archive. Extract the full archive and run `Genesis Grove.exe`.
- Available signing identities are expired or untrusted. The macOS package is unsigned and not notarized. Windows execution, input, audio, import/export, and performance remain unverified on Windows.
- Soldiers fight locally; troop formations and naval invasions are not implemented.
