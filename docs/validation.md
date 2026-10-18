# Version 0.6.0 validation — 18 October 2026

Kingdoms now mine nearby ore deposits, spend ore to research new ages, and forge individual weapons and armor that change combat. Copper, tin, iron, and coal deposits can also be placed with Powers tools.

## Verified on this Mac

- Twenty deterministic simulation tests pass, including resource-gated age progression, persistent ore deposits, crafting and individual equipment, and save compatibility.
- JavaScript syntax checks pass.
- Twenty-two Electron smoke checks pass. They cover world creation, native painting, saves, import/export, kingdom laws and diplomacy, age/equipment UI, challenge mode, compact layout, and renderer errors.
- macOS Apple silicon app built successfully and launches through Electron smoke checks. Its ZIP passes `unzip -tq`.
- Windows x64 ZIP built successfully and passes `unzip -tq`. It has not been run on Windows.

## Deliverables and boundaries

- `dist/mac-arm64/Genesis Grove.app` and `dist/Genesis Grove-0.6.0-arm64-mac.zip` — Apple silicon macOS build.
- `dist/Genesis Grove-0.6.0-win.zip` — Windows x64 archive. Extract the full archive and run `Genesis Grove.exe`.
- Available signing identities are expired or untrusted. The macOS package is unsigned and not notarized. Windows execution, input, audio, import/export, and performance remain unverified on Windows.
- Dedicated recruitable armies and troop formations are not part of this resource-and-forge update; residents still defend and fight under the existing war rules.
