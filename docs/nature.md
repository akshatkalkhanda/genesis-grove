# Nature: first playable slice

Version 0.18.0 adds a Nature category to the compact map dock. Select an event and
click the world once. Pause freezes its simulation; Resume lets it develop. Existing
instant rain, lightning, fire and other powers remain available under Events.

| Event | Actual simulation effect | Duration |
| --- | --- | --- |
| Rain cloud | Drifts east, extinguishes fires and restores local soil fertility. | 24 simulation seconds |
| Thunderstorm | Moving rain, with an actual lightning strike every six seconds; lightning can hurt creatures and ignite vegetation. | 24 seconds |
| Lightning | Existing single strike damages nearby life and can start fire; no persistent weather event. | Instant |
| Drought | Reduces soil fertility and the current growth of farms in range. | 30 seconds |
| Blizzard | Drifts east, harms farm growth and damages exposed people/animals. Homes within three tiles reduce cold damage by 90%. | 24 seconds |
| Tsunami | Expanding wave damages coastal boats, people/animals, low coastal homes, building integrity, crop growth, roads and fertility. | 20 seconds / 40-tile maximum travel |
| Wildfire | Existing vegetation fire; moving rain and storms can quench it. | Until extinguished or fuel burns out |

These are intentionally simplified game mechanics. Weather does not permanently
change biomes. Rain is not a finite water budget, and tsunami flooding is not a
fluid solver. Blizzard cold does not yet make people evacuate or change jobs.

## Coastal wave rules

1. Click deep ocean with a five-by-five deep-water neighborhood. Land and shallows
   are rejected with an explanation, without starting a wave.
2. A reachable low coast must be within 40 tiles. The wave expands two tiles per
   simulation second and is visible while traveling through water.
3. A radial reach check blocks hills, mountains, lava and paths that cross land
   into another sea. Flooding reaches at most three lowland tiles inland.
4. Each newly reached coastal tile loses its road and some fertility; coastal homes
   are lost, buildings lose 45 integrity and farms lose growth. High ground protects
   locations behind it. Land remains land when the wave passes.
5. Named people/animals take recorded tsunami damage; coastal boats lose health.
   Trade shipments, settler voyages, aircraft, passenger rescue and evacuation are
   outside this first wave model. Those need later transport work.

Wave events, progress, pulse timers and weather scheduling are saved and validated.
Old worlds load with no active events and automatic natural events off.

## Optional automatic events

Enable **Natural weather and disasters** in setup or Kingdoms. Every 90 simulation
seconds the scheduler attempts one event at a valid location, with rain more common
than each destructive event. Six concurrent events is the hard limit. The setting
is saved. Turning it off stops future automatic events; existing events finish.
Manual tools work regardless of the setting. The Nature badge lists remaining
durations in its tooltip and opens the Nature tools.

## Build order from here

The map-focused UI and this nature slice come first. Version 0.19.0 adds general world slots and recovery snapshots; the four kingdoms
remain a reference example rather than a game-mode requirement. Continue with
clearer land warfare and transport. Later nature work can add flood depth
and drainage, coastal evacuation and warning behavior, tornadoes, volcanic eruptions,
earthquakes, and climate/season effects. Add one hazard at a time with visible
causes, bounded saved state and terrain-specific behavior. None of these later
hazards is included in 0.18.0.

## Validation expectations

Deterministic tests cover valid/invalid ocean sources, low coast versus inland/high
ground, real soil/fire/crop/health effects, actual lightning, legacy defaults,
malformed imports, event limits, optional scheduling and continuation through a
mid-event save. Native desktop checks exercise tool selection, rejected/accepted
tsunami placement and restoring active events. Build success alone is not Windows
gameplay verification.
