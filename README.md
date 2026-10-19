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

Version 0.11.0 adds close zoom and creature following, experience and aging, local kingdom strategy, obstacle-aware routes, working town industries, and a separate day/night clock. Packages are rebuilt for each release; see `docs/validation.md` for the current artifacts and platform verification.

## A living sandbox

- Sixteen terrain brushes, including desert, savanna, jungle, snowfields, maple groves, mushroom glades, crystal wilds, and luminous Starbloom. New generated maps contain biome regions with distinct pixel vegetation and colors.
- Seeded islands, a great continent, four separated continents, or Prismatic Wildlands, plus empty ocean for building from scratch. Inhabited Wildlands starts eight different peoples, with wildlife placed in matching biomes.
- A main menu offers Create, Continue, and Load. The world setup preview matches the chosen seed; Regenerate makes another map. New worlds begin paused, and the four tool categories use a two-row selector that fits smaller windows.
- Eleven playable peoples: humans, elves, dwarves, orcs, foxfolk, harefolk, catfolk, frogfolk, wolfkin, hyenafolk, and beetlefolk. Habitat bonuses improve food gathering; foxfolk move faster, harefolk reproduce faster, and beetlefolk mine more ore and resist damage.
- Each kingdom has its own banner color and finite claims around its towns, leaving distant wilderness unclaimed. Captured towns change the border. Creatures have different pixel silhouettes and selection icons.
- Hills and mountains contain copper, tin, iron, and coal deposits. Use matching Powers brushes to place deposits for a kingdom; miners gather finite ore from nearby veins.
- Kingdoms research Copper, Bronze, Iron, and Steel by reaching age milestones and paying the required ore for a new discovery. Once another kingdom has discovered an age, its knowledge can spread without a second ore payment. Rebellions inherit their parent's technology. Forging still consumes metal and wood; people wear their own weapons and armor, changing combat damage and protection. Kingdom profiles show material and spare-gear stocks.
- Later-age buildings gain stronger-looking materials and towers. The world-age display tracks the average progress of living kingdoms.
- Towns construct farms with growing crops, windmills that boost harvests, armories that accelerate equipment production, and training camps that award nearby soldiers experience. Construction spends timber and depends on population and technology.
- Kingdoms prioritize food recovery, timber, defense, or expansion. Autonomous diplomacy considers supplies and army strength; injured soldiers retreat. Bounded A* routes guide workers and marching armies around impassable land.
- Civilians work as farmers, woodcutters, miners, smiths, and builders. Their jobs change food and timber output, ore gathering, forging, and housing cost. Growing towns build barracks and recruit soldiers who use forged gear and consume extra food. Soldiers from the same town share a reachable land target, march under a visible army banner, and capture towns or capitals by siege while civilians continue town work.
- Peaceful neighbours send surplus food, wood, or ore by caravan or ship; goods leave the sender immediately and arrive after travel. With expansion enabled, kingdoms also send settlers to found towns. Open Kingdoms to inspect jobs, soldiers, supplies, routes, and relations or set peace, alliances, and wars.
- Click a kingdom in the sidebar to focus it and open a detail card with its towns, supplies, age, armies, allies, and enemies. Inspect mode identifies claimed and unclaimed land.
- A 100-kingdom challenge starts across four landmasses with 300 settlers, autonomous diplomacy and expansion, rebellions off, fast calendar years, and chronicle milestones at years 100, 250, 500, and 1,000. The survival counter tracks the original founders. Toggle diplomacy, expansion, or rebellions under Kingdoms at any time.
- Eighteen wildlife choices: sheep, wolves, deer, bears, rabbits, chickens, foxes, wildcats, frogs, beetles, hyenas, owls, boars, turtles, buffalo, butterflies, moths, and lizards. Predators hunt, prey flee, turtles move slowly, and butterflies and moths restore soil fertility. Forests spread, lava cools, and ash recovers.
- People and animals have names, traits, XP, levels, strength, and intelligence. Age and experience gradually increase health capacity; work and combat grant XP. Strength affects damage, while intelligence improves gathering and research. Births record parent identities. Elder health declines after 85 years for people or 50 for wildlife.
- Turn on Inspect and click a person or animal for its portrait, stats, task, family, kingdom, and equipment. Zoom close or Follow keeps the creature in view; scroll and the zoom buttons reach 2,400%. Nearby labels show activity without overlapping. Close the card or press Esc to return to painting.
- Day/night lighting has a separate clock with smooth dawn and dusk and warm windows at night. Use the map clock to choose 10 minutes, 24 minutes, or 24 real hours per cycle at 1×, or preview any time of day. At high simulation speeds, a lighting cycle still takes at least three real minutes. Lighting pauses with the game and is saved with the world.
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
| Follow a creature | Inspect its profile, then click Follow |
| Day/night settings | Click the clock on the map |
| Fit world | Percentage button or minimap arrow |
| Visit and inspect kingdom | Click kingdom in sidebar |
| Manage kingdoms | Kingdoms button; inspect a kingdom, switch world laws, or set alliance, peace, and war |
| Pause | Space |
| Speed | 1 / 2 / 3 / 4 for 1× / 2× / 5× / 20× |
| Inspect creature | I, then click a person or animal; Esc exits |
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

See the ordered [gameplay roadmap](docs/roadmap.md) for naval warfare, environmental events, richer maps, and save recovery.

See the [video comparison](docs/video-comparison.md) for the reference features and current gaps.

See [validation results](docs/validation.md) for the checks performed on the first build.
