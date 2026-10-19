# Version 0.12.0 validation — 19 October 2026

This update adds fourteen ages through Cosmic Dust, visible ranged and energy weapons, working roads and farm transport, monuments and advanced industries, varied tree artwork, angels and demons, kingdom flags and ruler succession, and easier zoom controls.

## Verified on this Mac

- Fifty-six deterministic tests pass. New checks cover post-Steel and cosmic research gates, stardust collection and saves, ranged attacks, finite underground seams, job recovery, research material reserves, roads, finite cargo delivery, vehicle upgrades, mythic behavior, and ruler succession.
- JavaScript syntax checks pass.
- Thirty-six Electron UI checks cover menus, older worlds, close zoom and Follow, the zoom slider, fourteen-age technology panel, kingdom flags and rulers, day/night, modern and cosmic showcase imports, compact layout, and renderer errors.
- A long diagnostic found miners initially unable to reach distant ore, then exposed missing jobs in mature populations and exhausted surface iron. Prospecting now expands with population and time, births fill job gaps, towns retrain missing professions, and Iron Age mines can uncover at most three finite seams per rocky tile.
- A previously stalled world recovered to Lightyear Age in all three kingdoms after 100 additional simulated years. After another 500 years, all three naturally reached level 13 / Cosmic Dust Age (2,714–2,717 knowledge), built the cosmic institutions, and operated six stardust carriers. The historical calendar was year 2,001, including the intentionally stalled snapshot; this is a recovery check, not a fresh-world timing benchmark.

## Artifacts and boundaries

- `dist/mac-arm64/Genesis Grove.app` and `dist/Genesis Grove-0.12.0-arm64-mac.zip` — Apple silicon macOS build.
- `dist/Genesis Grove-0.12.0-win.zip` — Windows x64 archive. Extract the full archive and run `Genesis Grove.exe`.
- `artifacts/cosmic-showcase.json` — generated demonstration world with an advanced cosmic capital, imports through Load → Import. Its starting technology and stocks are deliberately staged for visual review.
- Available signing identities are expired or untrusted. The Mac package is unsigned and not notarized. Windows interactive gameplay remains untested on Windows.
- Cosmic institutions, energy equipment, and hover transports operate on the existing map. Orbital maps, star-system travel, and off-world colonization remain future work.
- Soldiers fight locally; naval invasions and troop formations remain future work.
