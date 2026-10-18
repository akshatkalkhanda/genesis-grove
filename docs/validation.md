# Version 0.7.0 validation — 18 October 2026

Town residents now work as farmers, woodcutters, miners, smiths, or builders. Growing towns build barracks and train soldiers; civilians keep working while soldiers defend and attack. Peaceful kingdoms send real surplus supplies by caravan or ship.

## Verified on this Mac

- Twenty-two deterministic simulation tests pass, including recruitment and supply costs, civilian combat exclusion, deposit exhaustion, trade delivery, and save compatibility.
- JavaScript syntax checks pass.
- Twenty-three Electron UI smoke checks pass against both source and the packaged Mac app, including world creation, native painting, saves, import/export, kingdom jobs and soldiers, diplomacy, challenge mode, compact layout, and renderer errors.
- The 100-kingdom challenge remained active through 5,000 simulation steps in a development run, with surviving civilizations across Stone, Copper, Bronze, Iron, and Steel ages.
- macOS Apple silicon app built and its ZIP checked with `unzip -tq`.
- Windows x64 ZIP built and checked with `unzip -tq`; it has not been run on Windows.

## Deliverables and boundaries

- `dist/mac-arm64/Genesis Grove.app` and `dist/Genesis Grove-0.7.0-arm64-mac.zip` — Apple silicon macOS build.
- `dist/Genesis Grove-0.7.0-win.zip` — Windows x64 archive. Extract the full archive and run `Genesis Grove.exe`.
- Available signing identities are expired or untrusted. The macOS package is unsigned and not notarized. Windows execution, input, audio, import/export, and performance remain unverified on Windows.
- Soldiers fight locally; troop formations and naval invasions are not implemented.
