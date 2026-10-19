# Architecture

The simulation and procedural renderer use web standards without runtime library dependencies. Electron wraps the same HTML entry point with sandboxing, context isolation, disabled Node integration, and external navigation blocked.

- `src/simulation.js`: seeded 192 × 128 world, towns, jobs, research, armies, trade, ecology, tools, and save validation.
- `src/creatures.js`: deterministic identities, personality traits, XP, levels, health capacity, strength, intelligence, and aging.
- `src/pathfinding.js`: bounded A* over walkable tiles. Pure next-waypoint caches are transient; worker intentions are saved so restored worlds evolve identically.
- `src/strategy.js`: supply and army assessments for recovery, construction, defense, expansion, and diplomacy.
- `src/settlements.js`: material-gated construction, crop growth and harvests, windmill bonuses, armories, and training camps.
- `src/daylight.js`: a presentation clock independent of calendar years, smooth lighting, and a minimum three-minute cycle at high speed.
- `src/renderer.js`: cached pixel terrain, creatures, town industries, lighting, effects, zoom, and labels.
- `src/app.js`: menu, map preview, input, fixed simulation steps, inspection and camera following, lighting controls, and manual save/export/import.
- `src/desktop.cjs`: Electron window and native application menu.
- `scripts/smoke.cjs`: isolated Electron UI checks using native pointer input, imports, and screenshots in ignored `artifacts/`.

World setup previews the same generated terrain used by the playable world. New worlds begin paused. Twenty simulation seconds make a sandbox year; challenge years take two seconds. XP and aging use that calendar. Elder decline begins after 85 years for people and 50 years for wildlife. Population caps remain 600 people in sandbox or 1,200 in the challenge, 350 animals, 120 kingdoms, 240 colonies, 40 voyages, and 60 concurrent trade shipments.

Biome IDs extend the original terrain IDs so old saves remain readable. Loading older creatures adds deterministic names, traits, and lifetime survival XP while preserving actual health. Validation checks health against derived capacity, limits experience and family records, and validates buildings, worker intentions, and lighting settings.

Hills, mountains, and crystal wilds hold finite ore. Research requires materials for a first discovery; later kingdoms can recover historical knowledge, and rebels inherit their parent's technology. Forging consumes ore and timber. Farms produce food, windmills improve harvests, armories accelerate forging, and nearby soldiers earn XP at training camps. Construction consumes timber; buildings can be destroyed by terrain changes and powers.

Kingdom decisions consider supplies and army strength. Workers seek food or timber, soldiers share land targets and can retreat, and A* routes avoid impassable tiles. Route searches are bounded to control cost. Ships carry settlers and actual trade cargo; naval combat is not implemented. Traits affect health growth, strength, learning, work XP, or retreat behavior. Parent records identify births but do not provide genetics or a full relationship model.

The lighting clock advances only while the visible game is running and pauses with the game. It supports 10 minutes, 24 minutes, or 24 real hours at 1×. Speed acceleration is capped so a lighting cycle never takes less than three real minutes. Its phase and duration are saved with the world. Lighting is visual and does not drive creature aging.

Build scripts use `--publish never` so version tags cannot accidentally request publishing credentials. GitHub Actions builds each platform independently and uploads artifacts; public releases are managed separately. See [validation](validation.md) and the ordered [roadmap](roadmap.md).
