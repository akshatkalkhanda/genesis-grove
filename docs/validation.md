# Version 0.9.1 validation — 18 October 2026

Breakaway kingdoms inherit their parent's age. Kingdoms that reach a research threshold can rediscover an age already reached by another kingdom, including a fallen one. This lets older saved worlds recover from a late-game Stone Age regression. Discovering a new age still requires ore.

## Verified on this Mac

- Twenty-five deterministic simulation tests pass, including technology inheritance, rediscovery from a saved world, and 100 years of autonomous rebellions without age regression.
- A separate 543-year sandbox run with rebellions and expansion enabled ended with 14 living kingdoms, all in the Steel Age.
- JavaScript syntax checks pass.
- Twenty-six Electron UI smoke checks pass against both source and the packaged Mac app, including the selected-kingdom card, main menu, map preview, painting, saves, import/export, diplomacy, challenge mode, compact layout, and renderer errors.
- The 100-kingdom challenge remained active through 5,000 simulation steps in a development run, with surviving civilizations across Stone, Copper, Bronze, Iron, and Steel ages.
- macOS Apple silicon app built and its ZIP checked with `unzip -tq`.
- Windows x64 ZIP built and checked with `unzip -tq`; it has not been run on Windows.

## Deliverables and boundaries

- `dist/mac-arm64/Genesis Grove.app` and `dist/Genesis Grove-0.9.1-arm64-mac.zip` — Apple silicon macOS build.
- `dist/Genesis Grove-0.9.1-win.zip` — Windows x64 archive. Extract the full archive and run `Genesis Grove.exe`.
- Available signing identities are expired or untrusted. The macOS package is unsigned and not notarized. Windows execution, input, audio, import/export, and performance remain unverified on Windows.
- Soldiers fight locally; troop formations and naval invasions are not implemented.
