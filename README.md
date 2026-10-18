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

The current build includes `dist/Genesis Grove-0.3.0-arm64-mac.zip` for Apple silicon Macs and `dist/Genesis Grove-0.3.0-win.zip` for Windows x64. Extract the Windows ZIP and run `Genesis Grove.exe` inside the extracted folder; keep the other files alongside it. The Windows ZIP was built on macOS and has not been executed on Windows. Both packages are unsigned. An Intel Mac package is not included in this build.

## A living sandbox

- Eight terrain brushes: meadow, forest, ocean, shallows, sand, highlands, mountains, lava.
- Seeded island and continent generation, plus empty ocean for building from scratch.
- Four playable peoples with distinct strengths: humans gather more food everywhere, elves thrive in forests, dwarves gather food on hills and build cheaper homes, and orcs grow faster and fight harder.
- Settlers found villages, gather supplies, build houses, raise families, and age. Use Kingdoms to set peace, alliances, or wars; neighbouring kingdoms trade or raid according to their relationship, and nearby enemies fight on land.
- A 100-kingdom challenge starts on a broad continent with 300 settlers, autonomous diplomacy, rebellions off, fast calendar years, and chronicle milestones at years 100, 250, 500, and 1,000. The survival counter tracks the original founders. Toggle diplomacy or rebellions under Kingdoms at any time.
- Six kinds of wildlife: sheep, wolves, deer, bears, rabbits, and chickens. Grazers reproduce; wolves and bears hunt. Forests spread, lava cools, and ash recovers.
- Rain, fire, lightning, meteors, nuclear blasts, plague, acid rain, blessings, and a life eraser.
- Pause, 1×/2×/5×/20× time, zoom, pan, territory display, tile inspector, village focus, chronicle, and minimap.
- One manual device save slot; JSON export/import for portable worlds. Import validates terrain, entities, references, and size before replacing the current world.
- Optional synthesized ambient music and power sounds. No audio or image downloads.

This is an expanding playable sandbox. The 100-kingdom challenge is an original scenario inspired by a WorldBox video, not a recreation of its workshop map. War is local land combat and border raids; armies do not sail or capture distant towns yet. Seasons and age names are visual time markers. There are no boats, genetics, research trees, multiplayer, or campaign yet. A device save is overwritten when you press Save again; export worlds you want to keep separately. There is no automatic save.

## Controls

| Action | Control |
| --- | --- |
| Use brush | Left click / drag |
| Place people or animals; strike meteor or lightning | One application per click |
| Pan | Right or middle drag, Alt-drag, WASD |
| Zoom | Scroll, + / −, or map buttons |
| Fit world | Percentage button or minimap arrow |
| Visit village | Click village in sidebar |
| Manage kingdoms | Kingdoms button; select two villages, then choose alliance, peace, or war |
| Pause | Space |
| Speed | 1 / 2 / 3 / 4 for 1× / 2× / 5× / 20× |
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

See the [video comparison](docs/video-comparison.md) for the reference features and current gaps.

See [validation results](docs/validation.md) for the checks performed on the first build.
