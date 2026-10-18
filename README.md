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

Version 0.9.0 adds finite kingdom claims, shared marching orders for trained soldiers, army banners, and a kingdom detail card. Packages are rebuilt for each release; see `docs/validation.md` for the current artifacts and platform verification.

## A living sandbox

- Eight terrain brushes: meadow, forest, ocean, shallows, sand, highlands, mountains, lava.
- Seeded islands, a great continent, or four separated continents, plus empty ocean for building from scratch.
- A main menu offers Create, Continue, and Load. The world setup preview matches the chosen seed; Regenerate makes another map. New worlds begin paused, and the four tool categories use a two-row selector that fits smaller windows.
- Four playable peoples with distinct strengths: humans gather more food everywhere, elves thrive in forests, dwarves gather food on hills and build cheaper homes, and orcs grow faster and fight harder.
- Each kingdom has its own banner color and finite claims around its towns, leaving distant wilderness unclaimed. Captured towns change the border. Creatures have different pixel silhouettes and selection icons.
- Hills and mountains contain copper, tin, iron, and coal deposits. Use matching Powers brushes to place deposits for a kingdom; miners gather finite ore from nearby veins.
- Kingdoms research Copper, Bronze, Iron, and Steel by reaching age milestones and paying the required ore. Forging consumes metal and wood; people wear their own weapons and armor, changing combat damage and protection. Kingdom profiles show material and spare-gear stocks.
- Later-age buildings gain stronger-looking materials and towers. The world-age display tracks the average progress of living kingdoms.
- Civilians work as farmers, woodcutters, miners, smiths, and builders. Their jobs change food and timber output, ore gathering, forging, and housing cost. Growing towns build barracks and recruit soldiers who use forged gear and consume extra food. Soldiers from the same town share a reachable land target, march under a visible army banner, and capture towns or capitals by siege while civilians continue town work.
- Peaceful neighbours send surplus food, wood, or ore by caravan or ship; goods leave the sender immediately and arrive after travel. With expansion enabled, kingdoms also send settlers to found towns. Open Kingdoms to inspect jobs, soldiers, supplies, routes, and relations or set peace, alliances, and wars.
- Click a kingdom in the sidebar to focus it and open a detail card with its towns, supplies, age, armies, allies, and enemies. Inspect mode identifies claimed and unclaimed land.
- A 100-kingdom challenge starts across four landmasses with 300 settlers, autonomous diplomacy and expansion, rebellions off, fast calendar years, and chronicle milestones at years 100, 250, 500, and 1,000. The survival counter tracks the original founders. Toggle diplomacy, expansion, or rebellions under Kingdoms at any time.
- Six kinds of wildlife: sheep, wolves, deer, bears, rabbits, and chickens. Grazers reproduce; wolves and bears hunt. Forests spread, lava cools, and ash recovers.
- Rain, fire, lightning, meteors, nuclear blasts, plague, acid rain, blessings, and a life eraser.
- Pause, 1×/2×/5×/20× time, zoom, pan, territory display, tile inspector, village focus, chronicle, and minimap.
- One manual device save slot; JSON export/import for portable worlds. Import validates terrain, entities, references, and size before replacing the current world.
- Optional synthesized ambient music and power sounds. No audio or image downloads.

This is an expanding playable sandbox. The 100-kingdom challenge is an original scenario inspired by a WorldBox video, not a recreation of its workshop map. Ships carry settlers and trade goods between landmasses; armies fight locally and do not launch naval invasions. The map stays 192 × 128 tiles, and the economy, diplomacy, sieges, and technology are simpler than WorldBox. Seasons remain visual time markers. There are no troop formations, genetics, branching research trees, multiplayer, or campaign yet. A device save is overwritten when you press Save again; export worlds you want to keep separately. There is no automatic save.

## Controls

| Action | Control |
| --- | --- |
| Use brush | Left click / drag |
| Open main menu | Menu button |
| Place people or animals; strike meteor or lightning | One application per click |
| Pan | Right or middle drag, Alt-drag, WASD |
| Zoom | Scroll, + / −, or map buttons |
| Fit world | Percentage button or minimap arrow |
| Visit and inspect kingdom | Click kingdom in sidebar |
| Manage kingdoms | Kingdoms button; inspect a kingdom, switch world laws, or set alliance, peace, and war |
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
