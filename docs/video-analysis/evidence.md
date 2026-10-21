# Visual evidence and review boundaries

Reviewed 21 October 2026. Source: the user-supplied local MP4 named
`Simulating 4 Kingdoms Fighting Over A MASSIVE World (That I Made!).mp4`.

## Method

- `ffprobe` reports 2032.638503 seconds, H.264 video at 854×480/30 fps and AAC audio;
  no subtitle stream was reported.
- Initial orientation used 68 samples at 30-second intervals. After the user asked
  for the whole video, the review expanded to 1,016 samples at two-second intervals,
  arranged into 22 chronological contact sheets, followed by full-size inspection
  of selected menus, statistics, traits, equipment, war overlays, and the endpoints.
- Every two-second interval across the runtime is represented except the final
  partial interval, which was checked separately. Contact-sheet timestamps indicate
  sampling interval centers and are approximate within about one second.
- This is not frame-by-frame playback and cannot establish very brief actions,
  exact movement timing, or unseen mechanics. The narration was not analyzed;
  audio work stopped when the user asked to leave it out.
- Review images remain locally under `artifacts/video-analysis/` and are excluded
  from Git. The source video and its frame sequences are not uploaded with these
  original planning documents and diagrams.

## Timestamped observations

| Time in video | What is visible | Design implication / confidence boundary |
| --- | --- | --- |
| 00:01–01:11 | Whole-world overview and close views of islands, lakes, narrow channels, forest, snow, mushroom and mountain regions. | Geographic variety and readable zoom levels are central. Map dimensions and generation rules cannot be measured from this footage. |
| 01:13–01:25 | Four random wheels and a result listing several traits, outside the game's map UI. | Optional seeded trait randomizer for our setup. Do not call the wheels part of WorldBox. |
| 01:27–01:45 | Birth Editor, trait groups and hover explanations including Wise/Strong/Hard Skin; kingdom naming and banner. | Traits should explain concrete modifiers; kingdom identity should persist across views. |
| 01:59–03:41 | Further wheel results, grouped trait selection, explicit positive/negative modifiers, and kingdom naming. | Offer editable initial conditions and clear trade-offs. Do not infer a specific inheritance algorithm. |
| 03:43–05:19 | Growth across several starting regions; fires and an edited “RIP ORCS” caption. | Expose threats and failure causes. The caption alone does not prove why that group died. |
| 05:21–05:47 | Whole-world map, lower control strip, environment/rules window and cold-related tooltip. | Keep routine controls compact; place world laws in a separate view. |
| 05:49–07:13 | Close settlement and person views; farms/paths/buildings, portrait, health/status bars and trait tooltip. | Make economy visible at close zoom; inspect an individual without losing world context. |
| 07:19–08:01 | Settlement overview, ruler/person profile, many traits and quantitative tooltips. | Show brief identity/health first and detailed effects on demand. Avoid reproducing tiny text or a wall of icons. |
| 08:51–09:03 | Speed changes and New World template thumbnails in a focused modal. | Preview-driven setup, visible speed state, and an explicit world-replacement action. |
| 09:37–11:05 | Individual units and settlement conflict, fire/effects, health changes and wider map cuts. | Combat needs spatial feedback and accessible unit inspection. Exact damage formulas are not observable. |
| 11:53–12:13 | Town zoom followed by a citizen profile and damage/stat tooltip. | Connect a visible citizen to equipment and actual calculated stats. |
| 12:17–13:45 | Snow settlement expands and becomes dense; a Culture window includes Dense Dwellings. | Link culture effects to visible development; keep advanced rules inspectable. No hidden housing algorithm is asserted. |
| 13:49–14:21 | Another culture tooltip, then a kingdom summary over the political map. | Distinguish culture from political ownership; use contextual summaries. |
| 14:43–16:37 | Explicit time skip; denser settlements, borders and kingdom summaries. | Long-run observation needs milestones and recovery saves. A time skip is not a replay feature. |
| 17:01–17:43 | Large developed settlement and another subspecies/trait inspection. | Rich detail is useful when requested; the normal map remains the primary view. |
| 18:09–19:23 | Sustained fighting with many units, fire, individual selections and changing health. | Clear army identity, threats and battle feedback matter. Fire's exact cause is not established by visuals alone. |
| 19:25–19:43 | A Religion window, Bubble Shield tooltip and another ability tooltip. | Religion can be a later system with actual gameplay effects; a sanctuary building is not equivalent to that system. |
| 19:49–20:15 | Wider political view, kingdom summaries, ships and coastal activity. | Expose a consistent kingdom–town–citizen relationship and maritime presence. |
| 20:33–20:47 | Fighting near snow/coast, followed by a bronze helmet tooltip with maker, age, modifiers and durability. | Equipment can have an inspectable history; provenance/wear are later additions beyond current generic gear. |
| 21:01–21:33 | World/view controls, expanded Nature and Disasters tools, hover descriptions. | Group tools by purpose; show detailed options only for the selected category. |
| 22:25–23:13 | Citizen selection, “Now following”, close village view and a compact bottom time/stat strip. | A deliberate Follow action bridges individual stories and wider observation. |
| 23:35–25:11 | Coastal town summaries, combat/fire, political borders and dashed connections. | Provide conflict and route overlays. The exact meaning of every line is not established without the original tooltip. |
| 25:25–26:23 | Continued conflict and summary windows; another subspecies Birth Editor/Hard Skin tooltip. | Keep traits and population-group details discoverable separately from the main map. |
| 26:35–27:43 | Developed towns, kingdom summaries, widespread conflict and fire. | Preserve readable identity and visibility during dense late-game scenes. |
| 28:01–29:03 | Kingdom cards list capital, ruler, villages, population, culture/religion and alliance; overview changes to a dense battle. | Use layered information hierarchy and distinct diplomacy indicators. A listed alliance does not reveal its AI rules. |
| 29:05–31:43 | Fighting, ships, political overlays, dashed connections, hatched regions and additional trait inspection. | Give overlays names, legends and selection context. Occupation/frontline behavior is a proposed adaptation, not a proven interpretation of the hatching. |
| 32:01–33:35 | Several wide views and kingdom summaries; large, differently colored territories remain visible. | Allow long observation and comparison. Do not assume every run must end with one winner. |
| 33:37–33:52 | Close coastal scene with settlements, crops, ships, units, and local effects. | Connect settlement life and maritime activity at close zoom. Passenger/boarding rules require our own explicit design. |

## Baseline source references

These links identify the inspected implementation rather than inferred reference-game behavior.

| Capability / limit | Local source |
| --- | --- |
| Fixed dimensions, scenario choice, terrain, seeding and save validation | [`src/simulation.js`](../../src/simulation.js), constants and `World` constructor, `generate`, `seed_life`, `seed_realms`, `deserialize`. |
| Current army targeting and conquest | [`src/simulation.js`](../../src/simulation.js), `plan_armies`, `resolve_sieges`, `conquer_site`. Capital capture currently transfers all other towns and residents. |
| Supply-sensitive plans and pairwise diplomatic choices | [`src/strategy.js`](../../src/strategy.js), `kingdom_plan`, `diplomatic_choice`; `advance_history` chooses neighboring capitals within 30 tiles. |
| Land routing | [`src/pathfinding.js`](../../src/pathfinding.js), `find_path`; bounded A* requires walkable start and target. |
| Boats, aircraft and crew identities | [`src/machines.js`](../../src/machines.js), [`src/crews.js`](../../src/crews.js); voyages and trade also exist separately in `src/simulation.js`. |
| Traits, inherited aptitudes, relationships and fixed cultures | [`src/creatures.js`](../../src/creatures.js), [`src/society.js`](../../src/society.js). |
| Current panels, inputs and manual storage | [`index.html`](../../index.html), [`src/app.js`](../../src/app.js), [`src/layout.css`](../../src/layout.css). |
| Territory/labels and cached terrain | [`src/renderer.js`](../../src/renderer.js). |
| Latest-200 event log and present-day location visits | `World.log` in [`src/simulation.js`](../../src/simulation.js); `update_history`/`event_row` in [`src/app.js`](../../src/app.js). |

Original video UI, map, assets, code and hidden rules are not reproduced. The
roadmap, layout diagrams, sample identities and implementation choices are original
proposals for Genesis Grove.
