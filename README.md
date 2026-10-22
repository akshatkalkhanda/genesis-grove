# Genesis Grove

An original, offline, pixel-art god sandbox. Shape islands, start civilizations, introduce wildlife, and change the course of their history with divine powers. Inspired by the world-sandbox genre; no WorldBox code, artwork, branding, or packaged assets are used.

## Play

Download the Mac or Windows desktop packages from the [latest public release](https://github.com/akshatkalkhanda/genesis-grove/releases/latest).

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

Version 0.22.0 bounds wildfire spread, makes automatic tsunamis rare, and repairs
rebellion homes and households. See the [survival investigation](docs/survival-and-disasters.md).
Version 0.21.0 added saved autonomous army orders with visible reasons, reachable
campaign targets, assembly, defense and retreat. Version 0.20.0 added a compact
Army Inspector with selection, live member/equipment
summaries and focus/follow. Version 0.19.0 added named world saves, automatic recovery, pre-replacement snapshots,
map layers and a quiet presentation view. The map-first Observe UI and natural events
from 0.18.0 remain. The reference video's four kingdoms are an example; this update
continues the general sandbox without a dedicated four-kingdom scenario.

## A living sandbox

- Sixteen terrain brushes, including desert, savanna, jungle, snowfields, maple groves, mushroom glades, crystal wilds, and luminous Starbloom. New generated maps contain biome regions with distinct pixel vegetation and colors.
- Seeded islands, a great continent, four separated continents, or Prismatic Wildlands, plus empty ocean for building from scratch. Inhabited Wildlands starts eight different peoples, with wildlife placed in matching biomes.
- A main menu offers Create, Continue, and Load. The world setup preview matches the chosen seed; Regenerate makes another map. New worlds begin paused in Observe mode. The compact dock opens Land, People, Animals, Plants, Nature and Events only when selected. Contextual tools include illustrated choices and placement instructions; closing them gives the space back to the map. World information opens in a drawer.
- Eleven playable peoples: humans, elves, dwarves, orcs, foxfolk, harefolk, catfolk, frogfolk, wolfkin, hyenafolk, and beetlefolk. Habitat bonuses improve food gathering; foxfolk move faster, harefolk reproduce faster, and beetlefolk mine more ore and resist damage.
- Each kingdom has its own banner color and finite claims around its towns, leaving distant wilderness unclaimed. Captured towns change the border. Creatures have different pixel silhouettes and selection icons.
- Hills and mountains contain copper, tin, iron, and coal deposits. Use matching Powers brushes to place deposits for a kingdom; miners gather finite ore from nearby veins. Iron Age miners can prospect up to three deeper seams per rocky tile; the save records depletion.
- Fourteen ages run from Stone through Copper, Bronze, Iron, Steel, Renaissance, Gunpowder, Industrial, Modern, Lightyear, Interstellar, Alien, Supreme, and Cosmic Dust. Kingdoms advance by reaching knowledge milestones and paying the required ore. Gunpowder needs a university, Industrial a workshop, and Modern a factory. Later stages need cosmic institutions and stardust. The Ages panel explains unlocks; kingdom profiles show the next requirements. Once another kingdom has discovered an age, its knowledge can spread without a second ore payment. Rebellions inherit their parent's technology. Forging still consumes metal and wood; people wear their own weapons and armor, changing combat damage and protection. Kingdom profiles show material and spare-gear stocks.
- Distinct clubs, spears, swords, crossbows, muskets, rifles, and carbines appear on creatures and in their inspection portraits. Ranged soldiers stop to fire, reload, and produce visible bolts or shots. Later-age buildings gain stronger-looking materials, towers, and extra floors. The world-age display tracks the average progress of living kingdoms.
- Kingdom flags have persistent colors, patterns, and emblems on capitals, town labels, armies, settlers, and profile cards. Rulers wear crowns; a living successor takes over when the ruler dies or leaves. Flags remain tied to the kingdom.
- Towns construct farms with growing crops, windmills that boost harvests, armories that accelerate equipment production, and training camps that award nearby soldiers experience. Construction spends timber and depends on population and technology.
- Town roads follow walkable routes around obstacles, consume timber, and progress from dirt to stone and paved surfaces. Roads increase movement speed by 15%, 30%, or 45%. Farms store finite surplus for carts to collect and deliver to the capital; later ages unlock steam wagons and supply trucks.
- Cosmic civilizations build observatories, astral forges, stargate monuments, and dust condensers. Observatories gather one stardust per calendar year; stargates and condensers increase production. Crystal regions may contain stardust deposits, and the Powers palette can place more. Stardust funds the five cosmic ages and photon, plasma, void, sovereign, and dust weapons. Hovercraft and stardust carriers deliver farm surplus on the current world map. Cosmic armor adds a visible energy field.
- Steel kingdoms construct founders monuments that boost research. Universities accelerate learning; workshops and factories accelerate forging. Prospecting range grows with population, time, and technology while staying on the settlement landmass. Armor and transport preserve the next research material reserve. Armories recover part of a deceased creature's equipment material. Trees have varied broadleaf, birch, pine, snow, autumn, savanna, and magical silhouettes with trunks, canopies, highlights, and shadows.
- Coastal towns build docks and launch boats that patrol on water and gather fish. Gunpowder-era boats can fire at hostile soldiers near shore. Workshops manufacture mobile artillery that fires shells at troops and damages nearby structures.
- Watchtowers fire at hostile soldiers; castles protect nearby residents and make sieges harder. Prisons capture wounded enemy soldiers within range, house up to eight captives, and feed them from the captor's stores. Peace, a completed sentence, prison loss, or the Release prisoners button returns them home.
- Aerodromes unlock hot-air balloons at Industrial, courier aircraft at Modern, and larger flying transports at Lightyear. Balloons orbit and add survey research. Aircraft cross oceans to deliver actual food to peaceful kingdoms, subtracting it from the sender at pickup. Vehicles and structures carry kingdom flags.
- Kingdoms prioritize food recovery, timber, defense, or expansion. Autonomous diplomacy considers supplies and army strength; injured soldiers retreat. Bounded A* routes guide workers and marching armies around impassable land.
- Civilians work as farmers, woodcutters, miners, smiths, and builders. Their jobs change food and timber output, ore gathering, forging, and housing cost. Growing towns build barracks and recruit soldiers who use forged gear and consume extra food. Soldiers from the same town share a reachable land target, march under a visible army banner, and capture towns or capitals by siege while civilians continue town work.
- Peaceful neighbours send surplus food, wood, or ore by caravan or ship; goods leave the sender immediately and arrive after travel. With expansion enabled, kingdoms also send settlers to found towns. Open Kingdoms to inspect jobs, soldiers, supplies, routes, and relations or set peace, alliances, and wars.
- Click a kingdom in the sidebar to focus it and open a detail card with its towns, supplies, age, armies, allies, and enemies. Inspect mode identifies claimed and unclaimed land.
- A 100-kingdom challenge starts across four landmasses with 300 settlers, autonomous diplomacy and expansion, rebellions off, fast calendar years, and chronicle milestones at years 100, 250, 500, and 1,000. The survival counter tracks the original founders. Toggle diplomacy, expansion, or rebellions under Kingdoms at any time.
- Eighteen wildlife choices: sheep, wolves, deer, bears, rabbits, chickens, foxes, wildcats, frogs, beetles, hyenas, owls, boars, turtles, buffalo, butterflies, moths, and lizards. Predators hunt, prey flee, turtles move slowly, and butterflies and moths restore soil fertility. Forests spread, lava cools, and ash recovers.
- Angels and demons join the creature palette. Angels fly, heal nearby life, reduce infection, extinguish fires, and fight demons. Demons fly, attack villagers or angels, and ignite vegetation. These are placeable mythical creatures, not civilizations.
- People and animals have names, traits, XP, levels, strength, and intelligence. Age and experience gradually increase health capacity; work and combat grant XP. Strength affects damage, while intelligence improves gathering and research. Births record parent identities. Elder health declines after 85 years for people or 50 for wildlife.
- Towns build clinics from eight residents and hospitals at later technology levels. Adult doctors gather finite medicinal herbs and treat nearby patients using medicine and shared food. Badly injured citizens stop work or training to seek care. Inspect a creature to see its condition, current health risks, recent damage causes, and treatment; kingdom profiles show doctors and medical supplies. Damage before this update cannot be reconstructed from older saves.
- Towns prioritize enough shelters, staffed farms, wells and grain reserves. Farms scale with population; recruitment, births and optional building require food reserves. Schools give children learning experience, churches and temples support nearby rest, and markets speed supply shipments. Monuments remain available as towns advance. Kingdom profiles show shelter capacity, farm coverage and reserves.
- Coastal boats, artillery, balloons and flying transports require named adult crews. Crew members board, travel with the machine, consume meals, age, and can be inspected on the map. Empty machines remain idle. Fishing boats carry their catch back to a dock before crediting shared food.
- Turn on Inspect and click a person or animal for its portrait, stats, daily task, family links, social bonds, culture, kingdom, and equipment. Kingdom profiles show cultural tradition and ruler personality effects. Zoom close or Follow keeps the creature in view; scroll, the zoom slider, and the zoom buttons reach 2,400%. Large wheel events are capped and the buttons use gentle steps. Nearby labels show activity without overlapping. Close the card or press Esc to return to Observe.
- Day/night lighting has a separate clock with smooth dawn and dusk and warm windows at night. Use the map clock to choose 10 minutes, 24 minutes, or 24 real hours per cycle at 1×, or preview any time of day. At high simulation speeds, a lighting cycle still takes at least three real minutes. Lighting pauses with the game and is saved with the world.
- Lightning strikes a two-tile radius; each fire spreads at most six adjacent tiles beyond its ignition patch. Water and snow block spread, and rain quenches it.
- Rain, fire, lightning, meteors, nuclear blasts, plague, acid rain, blessings, and a life eraser.
- Observe starts with no brush armed: click to inspect life or a kingdom, drag to pan, and press Escape to cancel a creator tool. Land, People, Animals, Plants, Nature and Events open a contextual palette. Citizen and kingdom profiles show a short summary with expandable details. Pause, speed, year/age and zoom remain visible.
- Nature offers drifting rain clouds that restore soil and quench fires, thunderstorms with actual lightning, droughts that reduce fertility and farm growth, blizzards that harm crops and exposed life, and tsunamis. Automatic events are off by default and can be enabled in setup or Kingdoms. At most six events run at once, including only one newly placed tsunami. Automatic waves wait at least 100 normal game years between placements.
- Start a tsunami in a 5×5 deep-ocean area within 40 tiles of a reachable low coast. Its visible wave travels two tiles per simulation second, damages coastal boats, lowland homes, crop growth and exposed life, and washes out roads. Hills and mountains block it; flooding reaches at most three lowland tiles inland and leaves the original terrain behind. This is a bounded game model, not fluid simulation. Trade/settler voyages and emergency evacuation are not modeled as wave targets yet.
- World → View history opens a filterable record of up to 200 events. Kingdom founding, rulers, discoveries, diplomacy, trade, and disasters record their locations. Select Visit location to focus the present-day map on that place. Existing world files without event coordinates still load.
- Twelve named device saves with explicit create/update choices; recovery keeps up to three copies per world and six overall. Autosave runs every visible real minute by default, including paused editing; choose 30 seconds, five minutes or Off under Worlds. A recovery snapshot protects the current world before New, Load or Import. The older single device save migrates once and is retained. JSON export/import remains available; malformed imports or failed protection leave the active world unchanged.
- Layers show terrain, political borders, formed armies/targets, actual trade and settler routes, or remaining ore deposits. View/F8 opens a quiet presentation view; Pause and Exit remain available. Escape exits without arming a brush.
- In Observe, click an army's small numbered banner to inspect its home garrison. Armies layer also reveals idle garrisons. The compact profile shows active soldiers, their current activities, shared kingdom food and the current enemy-town target; expand equipment for weapons, armor, summed strength and target siege pressure. Focus or Follow tracks the garrison's center. See [army inspection](docs/army-inspector.md) for what these summaries mean.
- Optional synthesized ambient music and power sounds. No audio or image downloads.

This is an expanding playable sandbox. The 100-kingdom challenge is an original scenario inspired by a WorldBox video, not a recreation of its workshop map. Ships carry settlers and trade goods between landmasses. Coastal boats support shore defense; armies still do not launch naval invasions. Aircraft deliver food rather than passengers. The map stays 192 × 128 tiles, and the economy, diplomacy, sieges, and technology are simpler than WorldBox. Seasons remain visual time markers. There are no troop formations, multigenerational genealogy, configurable genetic traits, branching research trees, multiplayer, or campaign yet. Social bonds are bounded records, and cultural identity is a small set of fixed traditions rather than an evolving language or religion system. Cosmic ages are fantasy technologies on the same map; star-system travel and controllable spacecraft are future work. Named manual saves update only when you choose that destination. Recovery copies rotate within their limits; export worlds you want to keep outside device storage.

## Controls

| Action | Control |
| --- | --- |
| Use brush | Left click / drag |
| Open main menu | Menu button |
| Place people or animals; strike meteor or lightning | One application per click |
| Pan | Left drag in Observe; right or middle drag, Alt-drag, WASD |
| Zoom | Scroll, + / −, map slider, or map buttons |
| Technology unlocks | Ages button on the map |
| Follow a creature | Inspect its profile, then click Follow |
| Inspect / follow an army | Observe → click numbered army banner; use Armies layer for idle garrisons, then Focus or Follow |
| Day/night settings | Click the clock on the map |
| Fit world | Percentage button or minimap arrow |
| Visit and inspect kingdom | Click kingdom in sidebar |
| Manage kingdoms | Kingdoms button; inspect a kingdom, switch world laws, or set alliance, peace, and war |
| Pause | Space |
| Speed | 1 / 2 / 3 / 4 for 1× / 2× / 5× / 20× |
| Observe / inspect | Default mode; I or Observe, then select a person, animal or claimed kingdom. Esc cancels painting |
| Brush size | [ / ] |
| Save / worlds | Save or Cmd+S / Ctrl+S opens named save; Worlds opens saved and recovery copies |
| Map layers | Layers menu on the map |
| Quiet view | View button / F8; Exit or Esc returns |

Dialogs pause the simulation while open. Time does not advance in a hidden browser tab. Destructive powers have no undo; save or export first. New worlds, loads and imports keep a pre-replacement recovery copy when a world is active.

## Build and check

```sh
npm test             # deterministic simulation and save validation
npm run lint         # JavaScript syntax checks
npm run smoke        # actual Electron UI, native pointer input, screenshot and export checks
npm run smoke:army   # army badge, inspector, follow, compact layouts and save/load native checks
npm run build        # unpacked desktop app for the host platform
npm run dist:mac     # macOS ZIP
npm run dist:win     # Windows installer and portable executable; build on Windows
npm run dist:win:zip # cross-build an unsigned Windows x64 ZIP on macOS
```

`make setup`, `make dev`, `make test`, `make lint`, and `make build` wrap these commands. `npm run lint` checks syntax only; no formatter or type checker is configured. The CI workflow builds macOS and Windows packages on their respective runners, manually or on a version tag. It does not publish releases. Builds are unsigned by default; signing/notarization requires your own credentials. Windows execution must be tested on Windows before claiming that release is verified.

See [named saves, recovery and map views](docs/world-saves.md) for the current device library and observation controls.

See [architecture and simulation notes](docs/architecture.md) for implementation boundaries.

See the ordered [gameplay roadmap](docs/roadmap.md) for naval warfare, environmental events, richer maps, and save recovery.

See the [sandbox mechanics and UI plan](docs/video-analysis/README.md) for the
21 October video review, a clearer map-first interface, and the implementation chart.

See the [video comparison](docs/video-comparison.md) for the reference features and current gaps.

See [validation results](docs/validation.md) for the checks performed on the first build.
