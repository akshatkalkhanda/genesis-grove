# Version 0.23.0 validation — 22 October 2026\n\nSee [generation survival and dense-map checks](generations-and-map-readability.md)\nand the [release verification](release-0.23.0.md).\n\n# Version 0.22.0 validation — 22 October 2026

See the [survival and disaster investigation](survival-and-disasters.md) for measured
regressions, save compatibility and remaining challenge balance work, and the
[release checks](release-0.22.0.md) for packaging and native desktop coverage.

# Version 0.17.0 validation — 21 October 2026

- Food shortage was traced to farms yielding only 18 food per 30 simulation
  seconds, a three-field limit, and military/optional spending that did not wait
  for basic needs. Fields now scale with population and require adult farmers;
  basic shelter and food reserves precede discretionary development.
- The civic and crew suite passed 98 tests, including finite harvest accounting,
  granary conservation, field staffing, on-site schooling, wells, sanctuary rest,
  empty-machine inactivity, adult boarding, sailor cleanup over water, and crew
  save validation.
- The rebuilt v0.17.0 Mac package passed all 46 desktop checks with no renderer
  errors, including native boat/sailor and balloon/pilot inspection, visible crew,
  civic districts and basic-needs status. Packaged HTML and all 27 source JS/CSS
  modules matched the authoritative checkout byte for byte. Crew close-up images
  were visually reviewed. The staged `artifacts/fortress-showcase.json` includes
  the civic district and five crewed machine types for immediate import.
- Mac gameplay validation was performed locally. Windows interactive gameplay
  remains untested; packaging and CI results are verified separately on GitHub.
- A fresh 120-year `emerald-17` run retained all three kingdoms with 489 living
  citizens and ample food. All six boats/artillery pieces had valid adult crew,
  aboard positions matched their machines, and a save round trip passed. Fishing
  deliveries were recorded. This single seeded run is a regression check, not
  proof that every terrain or disaster scenario remains self-sufficient.

## Earlier local version 0.16.0

- 90 simulation tests passed, including actual births, adult parent selection, saved
  relationships and work routines, child labor/recruitment exclusion, finite timber
  cargo, harvesting the assigned forest tile, and construction timber reserves.
- Medical checks cover clinic/hospital construction, distinct staff assignments,
  doctor travel and finite herb collection, food and medicine consumption,
  infection treatment, return to training, island isolation, famine recovery,
  continued elder decline, no revival of dead citizens, bounded damage history,
  legacy saves, and malformed medical metadata.
- The medical 120-year default seed `emerald-17` ended with all three kingdoms
  alive and 311 citizens. Starving citizens resumed gathering instead of becoming
  stuck awaiting foodless treatment; the 18 recovering residents at the endpoint
  were elders. Two kingdoms still had low food reserves, so this is a regression
  and routing diagnostic rather than evidence of universally balanced food supply.
  Natural `color-world` development still produced farm, windmill, armory, and
  training camp by year 16.
- 44 checks passed against the rebuilt packaged Mac app after the sidebar and medical
  update, with no renderer errors. New checks cover docking, sidebar collapse
  resizing, completed-guide folding, and compact-window zoom/save/load access.
  Packaged HTML, app code, and the layout stylesheet match the source byte for byte. Checks
  include culture profiles, navigating living family/social links, save/import,
  existing industries, cosmic equipment, fortifications, and aircraft.
- The medical showcase imports a soldier injured through actual combat damage
  accounting and verifies live treatment, the visible health inspector, and the
  kingdom medical summary. Selecting a creature closes the overlapping world
  panel. `artifacts/medical-care.png` was visually reviewed; the accompanying
  `medical-showcase.json` is a staged care demonstration, not a natural world.
- The Documents copy had retained the older HTML page. It is now synchronized with
  the current source and the packaged entry point and core modules are compared
  byte for byte with the publishing checkout.
- Wildlands seed `color-world`, with expansion enabled, naturally constructs a
  farm, windmill, armory, and camp by year 18. Correcting forest worksite harvesting
  and bounding spare gear resolves the timber starvation found during validation.
- A 120-year fresh default-world run ended with all three kingdoms alive, 353
  citizens (67 under 18), 3,357 units delivered by citizens, and 421 vehicle
  deliveries. All five routine phases appeared, and save round trips preserved
  people, villages, and vehicles. This is one seeded run, not a broad balance benchmark.
- The final Mac application was rebuilt locally. Windows v0.16.0 has not been run
  or packaged during this check. No public v0.16.0 release has been published.

## Earlier release evidence

### Version 0.13.0 validation — 19 October 2026

This update adds fourteen ages through Cosmic Dust, visible ranged and energy weapons, working roads and farm transport, monuments and advanced industries, varied tree artwork, angels and demons, kingdom flags and ruler succession, and easier zoom controls.

## Verified on this Mac

- Sixty-two deterministic tests pass. New checks cover post-Steel and cosmic research gates, stardust collection and saves, ranged attacks, finite underground seams, job recovery, research material reserves, roads, finite cargo delivery, vehicle upgrades, mythic behavior, and ruler succession.
- JavaScript syntax checks pass.
- Thirty-eight Electron UI checks cover menus, older worlds, close zoom and Follow, the zoom slider, fourteen-age technology panel, kingdom flags and rulers, day/night, modern and cosmic showcase imports, compact layout, and renderer errors.
- A long diagnostic found miners initially unable to reach distant ore, then exposed missing jobs in mature populations and exhausted surface iron. Prospecting now expands with population and time, births fill job gaps, towns retrain missing professions, and Iron Age mines can uncover at most three finite seams per rocky tile.
- A previously stalled world recovered to Lightyear Age in all three kingdoms after 100 additional simulated years. After another 500 years, all three naturally reached level 13 / Cosmic Dust Age (2,714–2,717 knowledge), built the cosmic institutions, and operated six stardust carriers. The historical calendar was year 2,001, including the intentionally stalled snapshot; this is a recovery check, not a fresh-world timing benchmark.

- Machine and defense tests cover water-only boat movement and bounded fishing, artillery damage to troops and structures, castle siege protection, prisoner capture and peace release, ocean-crossing cargo conservation, balloon research, and malformed fleet saves.
- A staged fortress save is imported through the desktop UI to render all five machine kinds and the new fortifications. The Release prisoners control is exercised.

## Artifacts and boundaries

- `dist/mac-arm64/Genesis Grove.app` and `dist/Genesis Grove-0.13.0-arm64-mac.zip` — Apple silicon macOS build.
- `dist/Genesis Grove-0.13.0-win.zip` — Windows x64 archive. Extract the full archive and run `Genesis Grove.exe`.
- `artifacts/fortress-showcase.json` — castle, watchtower, prison, dock, aerodrome, coastal boat, artillery, balloon, aircraft, and flying transport demonstration, including a releasable prisoner.
- `artifacts/cosmic-showcase.json` — generated demonstration world with an advanced cosmic capital, imports through Load → Import. Its starting technology and stocks are deliberately staged for visual review.
- Available signing identities are expired or untrusted. The Mac package is unsigned and not notarized. Windows interactive gameplay remains untested on Windows.
- Cosmic institutions, energy equipment, and hover transports operate on the existing map. Orbital maps, star-system travel, and off-world colonization remain future work.
- Soldiers fight locally; naval invasions and troop formations remain future work.
