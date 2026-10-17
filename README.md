# Genesis Grove

An original, offline, pixel-art god sandbox. Shape islands, start civilizations, introduce wildlife, and change the course of their history with divine powers. Inspired by the world-sandbox genre; no WorldBox code, artwork, branding, or packaged assets are used.

## Play

The browser version works on macOS and Windows with no game dependencies:

```sh
npm run dev
```

Open http://127.0.0.1:4173 in a current Chrome, Edge, Firefox, or Safari browser. Node.js 22 or newer is needed for the local server. The game itself works offline once served. Keep the same browser and port to access the same device save.

For the desktop version:

```sh
npm ci
npm start
```

If a macOS build has already been made, open `dist/mac-arm64/Genesis Grove.app` (Apple silicon) or `dist/mac/Genesis Grove.app` (Intel). Desktop packages include their own runtime; players do not need Node.js.

The initial build includes `dist/Genesis Grove-0.1.0-arm64-mac.zip` for Apple silicon Macs and `dist/Genesis Grove-0.1.0-win.zip` for Windows x64. Extract the Windows ZIP and run `Genesis Grove.exe` inside the extracted folder; keep the other files alongside it. The Windows ZIP was built on macOS and has not been executed on Windows. Both packages are unsigned. An Intel Mac package is not included in this build.

## A living sandbox

- Eight terrain brushes: meadow, forest, ocean, shallows, sand, highlands, mountains, lava.
- Seeded island and continent generation, plus empty ocean for building from scratch.
- Settlers found up to eight named villages, gather food and timber, build houses, raise families, and age. Nearby villages occasionally trade or raid.
- Sheep graze and reproduce; wolves hunt sheep. Forests spread, lava cools, and ash recovers.
- Rain, fire, lightning, meteors, blessings, and a life eraser.
- Pause, 1×/2×/5× time, zoom, pan, territory display, tile inspector, village focus, chronicle, and minimap.
- One manual device save slot; JSON export/import for portable worlds. Import validates terrain, entities, references, and size before replacing the current world.
- Optional synthesized ambient music and power sounds. No audio or image downloads.

This is a playable first version. Diplomacy is a simple frontier trade/raid model, not a full kingdom or war system. Seasons and age names are visual time markers. There are no boats, genetics, research trees, multiplayer, or campaign yet. A device save is overwritten when you press Save again; export worlds you want to keep separately. There is no automatic save.

## Controls

| Action | Control |
| --- | --- |
| Use brush | Left click / drag |
| Place people or animals; strike meteor or lightning | One application per click |
| Pan | Right or middle drag, Alt-drag, WASD |
| Zoom | Scroll, + / −, or map buttons |
| Fit world | Percentage button or minimap arrow |
| Visit village | Click village in sidebar |
| Pause | Space |
| Speed | 1 / 2 / 3 for 1× / 2× / 5× |
| Inspect | I; Esc exits |
| Brush size | [ / ] |
| Device save | Cmd+S / Ctrl+S |

Dialogs pause the simulation while open. Time does not advance in a hidden browser tab. Destructive powers and new-world creation have no undo; save or export first.

## Build and check

```sh
npm test             # deterministic simulation and save validation
npm run lint         # JavaScript syntax checks
npm run smoke        # actual Electron UI, native pointer input, screenshot and export checks
npm run build        # unpacked desktop app for the host platform
npm run dist:mac     # macOS ZIP
npm run dist:win     # Windows installer and portable executable; build on Windows
npm run dist:win:zip # cross-build an unsigned Windows x64 ZIP on macOS
```

`make setup`, `make dev`, `make test`, `make lint`, and `make build` wrap these commands. `npm run lint` checks syntax only; no formatter or type checker is configured. The CI workflow builds macOS and Windows packages on their respective runners, manually or on a version tag. It does not publish releases. Builds are unsigned by default; signing/notarization requires your own credentials. Windows execution must be tested on Windows before claiming that release is verified.

See [architecture and simulation notes](docs/architecture.md) for implementation boundaries.

See [validation results](docs/validation.md) for the checks performed on the first build.
